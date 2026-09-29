import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlatformerSession } from './PlatformerSession';
import type { PhaseGates } from './PlatformerSession';
import { DEATH_ANIM_SECONDS, introState, tickLifecycle } from './engine/GameLifecycle';
import { lifecycleState } from './PlatformerState';

/** A no-load `Image` stub — nothing ever resolves, which is fine: these cases
 * drive the controller, not the loader. */
class StubImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
}

const makeCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  document.body.append(canvas);
  return canvas;
};

/** The exact gates the frozen table in contracts/lifecycle-controller.md §4
 * prescribes for each phase. */
const EXPECTED: Record<string, PhaseGates> = {
  intro: {
    stepWorld: true,
    advanceLifecycle: true,
    advancePlayerAnimation: false,
    advanceEffectKinds: 'all',
    clearPendingInput: false,
    acceptInput: true,
    render: true,
  },
  playing: {
    stepWorld: true,
    advanceLifecycle: true,
    advancePlayerAnimation: false,
    advanceEffectKinds: 'all',
    clearPendingInput: false,
    acceptInput: true,
    render: true,
  },
  dying: {
    stepWorld: false,
    advanceLifecycle: true,
    advancePlayerAnimation: true,
    advanceEffectKinds: ['hitSplatter'],
    clearPendingInput: false,
    acceptInput: false,
    render: true,
  },
  awaitingRestart: {
    stepWorld: false,
    advanceLifecycle: false,
    advancePlayerAnimation: false,
    advanceEffectKinds: 'none',
    clearPendingInput: false,
    acceptInput: false,
    render: true,
  },
  paused: {
    stepWorld: false,
    advanceLifecycle: false,
    advancePlayerAnimation: false,
    advanceEffectKinds: 'none',
    clearPendingInput: true,
    acceptInput: false,
    render: true,
  },
  'ending-screen': {
    stepWorld: false,
    advanceLifecycle: false,
    advancePlayerAnimation: false,
    advanceEffectKinds: 'none',
    clearPendingInput: true,
    acceptInput: false,
    render: true,
  },
};

/** Puts the lifecycle into `phase` through the module's own pure functions. */
function setPhase(phase: string): void {
  switch (phase) {
    case 'intro':
      lifecycleState.value = introState(0, 0);
      return;
    case 'playing':
      lifecycleState.value = tickLifecycle(introState(0, 0), 10);
      return;
    case 'dying':
      lifecycleState.value = { phase: 'dying', elapsed: 0, centerX: 0, centerY: 0 };
      return;
    case 'awaitingRestart':
      lifecycleState.value = { phase: 'awaitingRestart', elapsed: 0, centerX: 0, centerY: 0 };
      return;
    case 'paused':
      lifecycleState.value = { phase: 'paused', elapsed: 0, centerX: 0, centerY: 0 };
      return;
    default:
      lifecycleState.value = { phase: 'ending-screen', elapsed: 0, centerX: 0, centerY: 0 };
  }
}

describe('PlatformerSession', () => {
  let frameCount: number;
  let onFrame: (dt: number, gates: PhaseGates) => void;
  let canvas: HTMLCanvasElement;
  let created: Array<ReturnType<typeof createPlatformerSession>>;

  beforeEach(() => {
    vi.stubGlobal('Image', StubImage);
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    lifecycleState.value = introState(0, 0);
    frameCount = 0;
    onFrame = () => {
      frameCount += 1;
    };
    canvas = makeCanvas();
    created = [];
  });

  const makeSession = () => {
    const session = createPlatformerSession({ canvas, onFrame });
    created.push(session);
    return session;
  };

  afterEach(() => {
    // A session attaches window/canvas listeners; leaving one alive would leak
    // frames into the next case.
    for (const session of created) session.dispose();
    canvas.remove();
    vi.unstubAllGlobals();
  });

  it('gates-introAndPlaying-allowTheFullWorldStep', () => {
    // Arrange
    const session = makeSession();

    // Act / Assert
    for (const phase of ['intro', 'playing']) {
      setPhase(phase);
      expect(session.gates()).toEqual(EXPECTED[phase]);
    }
  });

  it('gates-dyingFreezesTheWorldButAdvancesTheDeathLeadIn', () => {
    // Arrange
    const session = makeSession();
    setPhase('dying');

    // Act / Assert — the anim tick is conditional on the lead-in's elapsed.
    expect(session.gates()).toEqual(EXPECTED.dying);
    lifecycleState.value = { phase: 'dying', elapsed: DEATH_ANIM_SECONDS, centerX: 0, centerY: 0 };
    expect(session.gates().advancePlayerAnimation).toBe(false);
    expect(session.gates().advanceLifecycle).toBe(true);
  });

  it('gates-pausedAndEndingScreenDrainInputAndOnlyRender', () => {
    // Arrange
    const session = makeSession();

    // Act / Assert
    for (const phase of ['paused', 'ending-screen']) {
      setPhase(phase);
      expect(session.gates()).toEqual(EXPECTED[phase]);
    }
  });

  it('gates-awaitingRestartHoldsEverythingAndOnlyRenders', () => {
    // Arrange
    const session = makeSession();
    setPhase('awaitingRestart');

    // Act / Assert
    expect(session.gates()).toEqual(EXPECTED.awaitingRestart);
  });

  it('start-calledTwice-bootsTheControllerOnlyOnce', () => {
    // Arrange
    const session = makeSession();

    // Act
    session.start();
    const afterFirstStart = frameCount;
    session.start();

    // Assert — one boot repaint, and no second boot's worth of frames.
    expect(afterFirstStart).toBe(1);
    expect(frameCount).toBe(afterFirstStart);
  });

  it('dispose-calledTwice-isIdempotent', () => {
    // Arrange
    const session = makeSession();
    session.start();

    // Act / Assert
    expect(() => {
      session.dispose();
      session.dispose();
    }).not.toThrow();
  });

  it('dispose-afterwardsFiresNoFrameForAResizeOrARestartInput', () => {
    // Arrange
    const session = makeSession();
    session.start();
    session.dispose();
    const frames = frameCount;

    // Act — the listeners a live session owns must be gone.
    setPhase('awaitingRestart');
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    // Assert
    expect(frameCount).toBe(frames);
  });

  it('canPauseAndCanResume-followThePhasePreconditions', () => {
    // Arrange
    const session = makeSession();

    // Act / Assert
    setPhase('playing');
    expect(session.canPause()).toBe(true);
    expect(session.canResume()).toBe(false);

    setPhase('paused');
    expect(session.canPause()).toBe(false);
    expect(session.canResume()).toBe(true);

    for (const phase of ['intro', 'dying', 'awaitingRestart', 'ending-screen']) {
      setPhase(phase);
      expect(session.canPause()).toBe(false);
      expect(session.canResume()).toBe(false);
    }
  });

  it('pauseAndResumeForJournal-delegateToTheLifecycleStateMachine', () => {
    // Arrange
    const session = makeSession();
    setPhase('playing');

    // Act
    session.pauseForJournal();

    // Assert
    expect(session.phase()).toBe('paused');

    // Act
    session.resumeFromJournal();

    // Assert
    expect(session.phase()).toBe('playing');
  });

  it('restart-fromAwaitingRestart-returnsToTheIntroIris', () => {
    // Arrange
    const session = makeSession();
    session.start();
    setPhase('awaitingRestart');
    const frames = frameCount;

    // Act
    session.restart();

    // Assert — resetGame + camera snap + intro, then a repaint.
    expect(session.phase()).toBe('intro');
    expect(frameCount).toBeGreaterThan(frames);
  });

  it('restart-inAnyOtherPhase-isANoOp', () => {
    // Arrange
    const session = makeSession();
    setPhase('playing');

    // Act
    session.restart();

    // Assert
    expect(session.phase()).toBe('playing');
  });

  it('showAndDismissEndingScreen-delegateToTheLifecycleStateMachine', () => {
    // Arrange
    const session = makeSession();
    setPhase('playing');

    // Act
    session.showEndingScreen();
    expect(session.phase()).toBe('ending-screen');

    // Act
    session.dismissEndingScreen();

    // Assert
    expect(session.phase()).toBe('playing');
  });

  it('beginDeath-startsTheDyingPhase', () => {
    // Arrange
    const session = makeSession();

    // Act
    session.beginDeath({ x: 12, y: 34 });

    // Assert
    expect(session.phase()).toBe('dying');
  });

  it('start-seedsTheIntroPhaseRatherThanThePageWritingIt', () => {
    // Arrange: a phase left over from a previous mount, as the persistence of
    // the module-level lifecycleState makes possible on a theme switch.
    const session = makeSession();
    setPhase('awaitingRestart');

    // Act
    session.start();

    // Assert: the session owns the opening phase (FR-016).
    expect(session.phase()).toBe('intro');
  });

  it('advanceLifecycle-ticksThePhaseThroughTheLifecycleMath', () => {
    // Arrange
    const session = makeSession();

    // Act
    session.advanceLifecycle(10);

    // Assert: exactly the value the page used to compute inline.
    expect(lifecycleState.value).toEqual(tickLifecycle(introState(0, 0), 10));
  });

  it('takeNextFruitIcon-returnsAConsecutiveIndex', () => {
    // Arrange
    const session = makeSession();

    // Act / Assert
    expect(session.takeNextFruitIcon()).toBe(0);
    expect(session.takeNextFruitIcon()).toBe(1);
  });
});
