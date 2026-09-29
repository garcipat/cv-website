import {
  DEATH_ANIM_SECONDS,
  dismissEndingScreen,
  introState,
  pauseForJournal,
  resumeFromJournal,
  showEndingScreen,
  startDeath,
  tickLifecycle,
} from './engine/GameLifecycle';
import type { GamePhase, LifecycleState } from './engine/GameLifecycle';
import { playCanvasSize } from './engine/CanvasSize';
import { createGameLoop } from './engine/GameLoop';
import type { GameLoop } from './engine/GameLoop';
import { createKeyboardInput } from './engine/Input';
import type { KeyboardInput } from './engine/Input';
import { backgroundBandGeometry } from './engine/BackgroundLayers';
import { createCloudField, stepCloudField } from './engine/AmbientClouds';
import type { CloudField } from './engine/AmbientClouds';
import { initialCameraX, initialCameraY } from './engine/Camera';
import { createAssetLoader } from './engine/AssetLoader';
import { SPRITE_MANIFEST } from './entities/sprites/SpriteManifest';
import type { AssetLoader } from './engine/AssetLoader';
import type { SpriteLookup } from './contracts/SpriteLookup';
import { PLAYER_RENDERED_SIZE } from './entities/Player';
import { RENDERED_TILE_SIZE } from './level/Terrain';
import {
  cameraPositionX,
  cameraPositionY,
  lifecycleState,
  resetGame,
  respawnCenter,
  respawnPlayerState,
} from './PlatformerState';
import { currentLevel } from './state/levelSession';
import type { EffectKind } from './engine/effects';

/**
 * What one frame's phase allows. The page asks for these instead of
 * re-deriving the phase branches, so the gating has exactly one owner
 * (FR-016). The frozen values per phase are tabulated in
 * `contracts/lifecycle-controller.md` §4 and reproduced by `gates()`.
 */
export interface PhaseGates {
  /** Physics, collisions, deployables, hazard ticks — the world step. */
  readonly stepWorld: boolean;
  /** `GameLifecycle.tickLifecycle` (intro / dying). */
  readonly advanceLifecycle: boolean;
  /** The dying lead-in's death-animation tick only. */
  readonly advancePlayerAnimation: boolean;
  /** `'all'`, `'none'`, or the effect kinds a phase still advances. */
  readonly advanceEffectKinds: 'all' | 'none' | readonly EffectKind[];
  /** Drains buffered presses (paused / ending-screen). */
  readonly clearPendingInput: boolean;
  /** Whether the world step may read input this frame. */
  readonly acceptInput: boolean;
  /** Whether the frame repaints. */
  readonly render: boolean;
}

/**
 * The loop-owned values the page's draw pipeline reads. They are owned by the
 * session (sized/rebuilt here), exposed read-only so the composition stays in
 * the page without duplicating the state.
 */
export interface SessionRuntime {
  readonly backgroundColor: string;
  readonly cloudField: CloudField;
  readonly darknessLayer: HTMLCanvasElement | null;
  readonly hitTintLayer: HTMLCanvasElement | null;
  /** Clamped world-animation seconds, advanced on every stepping frame. */
  readonly worldElapsed: number;
}

/**
 * The platformer's lifecycle controller — the app-layer owner of canvas
 * sizing, the game loop, keyboard input, the window/canvas listeners, asset
 * loading, the phase transitions and the per-phase gating.
 *
 * It never re-implements the phase state machine or its timings: every
 * transition delegates to `engine/GameLifecycle.ts`'s pure functions. The
 * page supplies its world-step/render composition through `onFrame`, which
 * the session calls once per tick with the frame's gates.
 */
export interface PlatformerSession {
  /** The one live asset lookup the render path reads (path-keyed). */
  readonly lookup: SpriteLookup;
  start(): void;
  dispose(): void;
  gates(): PhaseGates;
  /** The current phase — asked instead of reading `lifecycleState` inline. */
  phase(): GamePhase;
  /** Journal/floating controls may open: `playing` only. */
  canPause(): boolean;
  /** Journal/floating controls may close: `paused` only. */
  canResume(): boolean;
  beginIntro(center: { x: number; y: number }): void;
  beginDeath(center: { x: number; y: number }): void;
  /** Advances the phase's own timeline (the `dying`/`intro` lead-in). */
  advanceLifecycle(dt: number): void;
  pauseForJournal(): void;
  resumeFromJournal(): void;
  showEndingScreen(): void;
  dismissEndingScreen(): void;
  /** `awaitingRestart` → `resetGame` + camera snap + intro at the respawn. */
  restart(): void;
  /** Drains buffered input (the ending-screen dismissal path). */
  clearPendingInput(): void;
  /** The loop-owned render values, read by the page's draw pipeline. */
  runtime(): SessionRuntime;
  /** Re-frames the camera on the respawn point (spawn/checkpoint). */
  snapCameraToRespawn(): void;
  /** The next fruit icon index; the session owns the counter. */
  takeNextFruitIcon(): number;
  /** The live keyboard input, or null before `start()`/after `dispose()`. The
   * world step reads presses/held keys through it. */
  keyboard(): KeyboardInput | null;
  /** Repaints through the page's own composition at `dt = 0`. */
  repaint(): void;
}

/** The gates a pure repaint reports: everything off except the draw. */
const RENDER_ONLY_GATES: PhaseGates = {
  stepWorld: false,
  advanceLifecycle: false,
  advancePlayerAnimation: false,
  advanceEffectKinds: 'none',
  clearPendingInput: false,
  acceptInput: false,
  render: true,
};

export function createPlatformerSession(init: {
  canvas: HTMLCanvasElement;
  onFrame(dt: number, gates: PhaseGates): void;
}): PlatformerSession {
  const { canvas, onFrame } = init;

  let started = false;
  let disposed = false;
  let loop: GameLoop | null = null;
  let input: KeyboardInput | null = null;

  // Created eagerly so `lookup` is a stable identity the caller can publish
  // into its render path before `start()`; loading begins in `start()`.
  const loader: AssetLoader = createAssetLoader(SPRITE_MANIFEST, {
    // One repaint per resolved asset — progressive reveal, with no per-asset
    // bookkeeping anywhere else.
    onAssetLoaded: () => repaint(),
    onReady: () => repaint(),
  });

  // Canvas sizing + the scratch layers + the cached backdrop colour. Sized in
  // `resize()`, reused every frame.
  let backgroundColor = '#000';
  let darknessLayer: HTMLCanvasElement | null = null;
  let hitTintLayer: HTMLCanvasElement | null = null;

  // Loop locals — plain values, not signals, since nothing outside this
  // controller (and the page's injected frame) reads them.
  let worldElapsed = 0;
  let nextFruitIcon = 0;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cloudField: CloudField = createCloudField(0, 0, 0);

  const phase = (): GamePhase => lifecycleState.value.phase;

  const gates = (): PhaseGates => {
    if (disposed) return { ...RENDER_ONLY_GATES, render: false };
    switch (phase()) {
      case 'dying':
        return {
          stepWorld: false,
          advanceLifecycle: true,
          advancePlayerAnimation: lifecycleState.value.elapsed < DEATH_ANIM_SECONDS,
          advanceEffectKinds: ['hitSplatter'],
          clearPendingInput: false,
          acceptInput: false,
          render: true,
        };
      case 'awaitingRestart':
        return {
          stepWorld: false,
          advanceLifecycle: false,
          advancePlayerAnimation: false,
          advanceEffectKinds: 'none',
          clearPendingInput: false,
          acceptInput: false,
          render: true,
        };
      case 'paused':
      case 'ending-screen':
        return {
          stepWorld: false,
          advanceLifecycle: false,
          advancePlayerAnimation: false,
          advanceEffectKinds: 'none',
          clearPendingInput: true,
          acceptInput: false,
          render: true,
        };
      case 'intro':
      case 'playing':
      default:
        return {
          stepWorld: true,
          advanceLifecycle: true,
          advancePlayerAnimation: false,
          advanceEffectKinds: 'all',
          clearPendingInput: false,
          acceptInput: true,
          render: true,
        };
    }
  };

  const resize = (): void => {
    const { width, height } = playCanvasSize(window.innerWidth, window.innerHeight);
    canvas.width = width;
    canvas.height = height;

    if (!darknessLayer) darknessLayer = document.createElement('canvas');
    darknessLayer.width = width;
    darknessLayer.height = height;

    // Sized only on creation: it never depends on the viewport.
    if (!hitTintLayer) {
      hitTintLayer = document.createElement('canvas');
      hitTintLayer.width = PLAYER_RENDERED_SIZE;
      hitTintLayer.height = PLAYER_RENDERED_SIZE;
    }

    const geometry = backgroundBandGeometry(canvas.height);
    cloudField = createCloudField(width, geometry.skyTop, geometry.cloudsTop);

    backgroundColor =
      getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || '#000';
  };

  const snapCameraToRespawn = (): void => {
    if (canvas.height === 0) return;
    const levelPixelHeight = currentLevel.value.height * RENDERED_TILE_SIZE;
    const levelPixelWidth = currentLevel.value.width * RENDERED_TILE_SIZE;
    const respawn = respawnPlayerState.value;
    cameraPositionX.value = initialCameraX(
      respawn.x,
      PLAYER_RENDERED_SIZE,
      canvas.width,
      levelPixelWidth,
    );
    cameraPositionY.value = initialCameraY(
      respawn.y,
      PLAYER_RENDERED_SIZE,
      canvas.height,
      levelPixelHeight,
    );
  };

  const transition = (next: LifecycleState): void => {
    lifecycleState.value = next;
  };

  const restart = (): void => {
    if (phase() !== 'awaitingRestart') return;
    resetGame();
    snapCameraToRespawn();
    const center = respawnCenter.value;
    transition(introState(center.x, center.y));
    repaint();
  };

  function repaint(): void {
    if (disposed) return;
    // A repaint is a draw only — never a world step. The caller has already
    // changed whatever it wanted drawn (a resolved asset, a resize, a phase
    // transition), and stepping here would re-run physics/camera logic on a
    // frame that is not a game tick.
    onFrame(0, RENDER_ONLY_GATES);
  }

  const onResize = (): void => {
    resize();
    repaint();
  };

  const restartIfAwaiting = (): void => {
    restart();
  };

  const session: PlatformerSession = {
    start(): void {
      if (started) return;
      started = true;

      // The session owns the phase from the outset: a fresh mount opens in
      // 'intro' at the respawn point, before the first repaint draws it. The
      // page no longer seeds `lifecycleState` (FR-016).
      const center = respawnCenter.value;
      transition(introState(center.x, center.y));

      resize();
      snapCameraToRespawn();
      repaint();
      canvas.focus();

      window.addEventListener('resize', onResize);
      input = createKeyboardInput();
      window.addEventListener('keydown', restartIfAwaiting);
      canvas.addEventListener('click', restartIfAwaiting);

      loop = createGameLoop((dt) => {
        if (disposed) return;
        const frameGates = gates();

        // Loop-owned world time and ambient drift advance on stepping frames
        // only, so they freeze with the world during pause/death/restart.
        if (frameGates.stepWorld) {
          worldElapsed += dt;
          cloudField = stepCloudField(cloudField, dt, prefersReducedMotion);
        }

        if (frameGates.clearPendingInput) input?.clearPending();

        onFrame(dt, frameGates);
      });
      loop.start();

      loader.start();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      loader.cancel();
      loop?.stop();
      loop = null;
      input?.destroy();
      input = null;
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', restartIfAwaiting);
      canvas.removeEventListener('click', restartIfAwaiting);
    },

    lookup: loader.lookup,

    gates,
    phase,
    canPause: () => phase() === 'playing',
    canResume: () => phase() === 'paused',

    beginIntro(center: { x: number; y: number }): void {
      transition(introState(center.x, center.y));
    },
    beginDeath(center: { x: number; y: number }): void {
      transition(startDeath(center.x, center.y));
    },
    advanceLifecycle(dt: number): void {
      transition(tickLifecycle(lifecycleState.value, dt));
    },
    pauseForJournal(): void {
      transition(pauseForJournal(lifecycleState.value));
    },
    resumeFromJournal(): void {
      transition(resumeFromJournal(lifecycleState.value));
    },
    showEndingScreen(): void {
      transition(showEndingScreen(lifecycleState.value));
    },
    dismissEndingScreen(): void {
      transition(dismissEndingScreen(lifecycleState.value));
    },
    restart,

    clearPendingInput(): void {
      input?.clearPending();
    },

    runtime: () => ({
      backgroundColor,
      cloudField,
      darknessLayer,
      hitTintLayer,
      worldElapsed,
    }),

    snapCameraToRespawn,

    takeNextFruitIcon(): number {
      const current = nextFruitIcon;
      nextFruitIcon += 1;
      return current;
    },

    keyboard: () => input,

    repaint,
  };

  return session;
}
