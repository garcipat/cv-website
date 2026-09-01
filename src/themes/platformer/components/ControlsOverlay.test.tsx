import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ControlsOverlay } from './ControlsOverlay';
import { lifecycleState, controlsOverlayDismissed, playerState } from '../PlatformerState';
import { introState } from '../engine/GameLifecycle';
import { RENDERED_TILE_SIZE } from '../level/Terrain';

const PLAYING_PHASE = { phase: 'playing' as const, elapsed: 0, centerX: 0, centerY: 0 };
const DISMISS_TRAVEL_DISTANCE_PX = RENDERED_TILE_SIZE * 2;

/** Flushes the component's double-rAF reveal (see ControlsOverlay.tsx's doc
 *  comment on `revealed`) so tests that need the baseline translucent/
 *  resting state don't have to re-derive the two-frame flush every time. */
const flushReveal = () => {
  act(() => {
    vi.advanceTimersToNextFrame();
  });
  act(() => {
    vi.advanceTimersToNextFrame();
  });
};

describe('ControlsOverlay', () => {
  const initialLifecycleState = lifecycleState.value;
  const initialPlayerState = playerState.value;

  beforeEach(() => {
    vi.useFakeTimers();
    lifecycleState.value = initialLifecycleState;
    controlsOverlayDismissed.value = false;
    playerState.value = initialPlayerState;
  });

  afterEach(() => {
    vi.useRealTimers();
    lifecycleState.value = initialLifecycleState;
    controlsOverlayDismissed.value = false;
    playerState.value = initialPlayerState;
  });

  it('render-phaseIntro-rendersNothing', () => {
    // Tried during 'intro' too (see the component's own doc comment) — it
    // renders over the iris's still-mostly-black canvas early on, so it
    // waits for 'playing' instead.
    lifecycleState.value = introState(0, 0);
    render(<ControlsOverlay />);
    expect(screen.queryByTestId('platformer-controls-overlay')).not.toBeInTheDocument();
  });

  it('render-phasePaused-rendersNothing', () => {
    lifecycleState.value = { phase: 'paused' as const, elapsed: 0, centerX: 0, centerY: 0 };
    render(<ControlsOverlay />);
    expect(screen.queryByTestId('platformer-controls-overlay')).not.toBeInTheDocument();
  });

  it('render-phasePlayingNotDismissed-showsOverlay', () => {
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);
    expect(screen.getByTestId('platformer-controls-overlay')).toBeInTheDocument();
  });

  it('render-phasePlayingAlreadyDismissed-rendersNothing', () => {
    lifecycleState.value = PLAYING_PHASE;
    controlsOverlayDismissed.value = true;
    render(<ControlsOverlay />);
    expect(screen.queryByTestId('platformer-controls-overlay')).not.toBeInTheDocument();
  });

  it('render-showsMoveJumpJournalCaptions', () => {
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);
    const overlay = screen.getByTestId('platformer-controls-overlay');
    expect(overlay).toHaveTextContent('Move');
    expect(overlay).toHaveTextContent('Jump');
    expect(overlay).toHaveTextContent('Journal');
    expect(screen.getByText('Interact')).toBeInTheDocument();
  });

  it('render-beforeReveal-isInvisibleAndOffsetLeft', () => {
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);
    const overlay = screen.getByTestId('platformer-controls-overlay');
    expect(overlay.className).toContain('opacity-0');
    expect(overlay.style.transform).toBe('translateX(-80px)');
  });

  it('afterReveal-isBaselineTranslucentAtRestingPosition', () => {
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);

    flushReveal();

    const overlay = screen.getByTestId('platformer-controls-overlay');
    expect(overlay.className).toContain('opacity-80');
    // No transform at all at rest (rather than 'translateX(0px)') — a
    // non-'none' transform value promotes the element to its own
    // GPU-composited layer, which softens the text inside it on displays
    // with a fractional device pixel ratio for as long as the layer exists.
    expect(overlay.style.transform).toBe('');
  });

  it('afterOneFrame-stillNotRevealed-onlyFlipsAfterTheSecond', () => {
    // Regression coverage, same reasoning as ThankYouScreen.test.tsx's
    // equivalent test: a single rAF isn't reliably enough.
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);

    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(screen.getByTestId('platformer-controls-overlay').className).toContain('opacity-0');

    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(screen.getByTestId('platformer-controls-overlay').className).toContain('opacity-80');
  });

  it('playerTravelsUnderThreshold-staysVisibleAndAtBaselineOpacity', () => {
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);
    flushReveal();

    act(() => {
      playerState.value = { ...playerState.value, x: playerState.value.x + DISMISS_TRAVEL_DISTANCE_PX - 1 };
    });

    expect(controlsOverlayDismissed.value).toBe(false);
    const overlay = screen.getByTestId('platformer-controls-overlay');
    expect(overlay.className).toContain('opacity-80');
  });

  it('playerTravelsThreshold-startsFadingOut-slidingRight-thenDismissesAfterFade', () => {
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);
    flushReveal();

    act(() => {
      playerState.value = { ...playerState.value, x: playerState.value.x + DISMISS_TRAVEL_DISTANCE_PX };
    });

    // Immediately starts fading/sliding right, but the permanent latch
    // hasn't flipped yet.
    const fadingOverlay = screen.getByTestId('platformer-controls-overlay');
    expect(fadingOverlay.className).toContain('opacity-0');
    expect(fadingOverlay.style.transform).toBe('translateX(120px)');
    expect(controlsOverlayDismissed.value).toBe(false);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(controlsOverlayDismissed.value).toBe(true);
    expect(screen.queryByTestId('platformer-controls-overlay')).not.toBeInTheDocument();
  });

  it('playerTravelsInNegativeDirection-alsoDismisses', () => {
    // Distance is unsigned — moving left counts the same as moving right.
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);
    flushReveal();

    act(() => {
      playerState.value = { ...playerState.value, x: playerState.value.x - DISMISS_TRAVEL_DISTANCE_PX };
    });

    expect(screen.getByTestId('platformer-controls-overlay').className).toContain('opacity-0');
  });

  it('noMovement-neverStartsFadingOut', () => {
    // No timeout fallback (removed per live design feedback): a visitor who
    // never moves keeps seeing the overlay indefinitely, by design.
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);
    flushReveal();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByTestId('platformer-controls-overlay').className).toContain('opacity-80');
    expect(controlsOverlayDismissed.value).toBe(false);
  });

  it('shouldShowFlipsFalseThenTrueAgain-revealedResets-fadesInAgainInsteadOfPoppingIn', () => {
    // Regression coverage: `shouldShow` also goes false for transient hides
    // (journal open, death/respawn), not just the permanent dismissal. If
    // `revealed` weren't reset on hide, a later reappearance would snap
    // straight to its baseline opacity/position instead of fading/sliding
    // in again.
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);
    flushReveal();
    expect(screen.getByTestId('platformer-controls-overlay').className).toContain('opacity-80');

    act(() => {
      lifecycleState.value = { phase: 'paused' as const, elapsed: 0, centerX: 0, centerY: 0 };
    });
    expect(screen.queryByTestId('platformer-controls-overlay')).not.toBeInTheDocument();

    act(() => {
      lifecycleState.value = PLAYING_PHASE;
    });

    const overlay = screen.getByTestId('platformer-controls-overlay');
    expect(overlay.className).toContain('opacity-0');
    expect(overlay.style.transform).toBe('translateX(-80px)');
  });

  it('unmountBeforeReveal-doesNotThrowOrDismiss', () => {
    lifecycleState.value = PLAYING_PHASE;
    const { unmount } = render(<ControlsOverlay />);
    unmount();

    expect(() => {
      flushReveal();
    }).not.toThrow();
    expect(controlsOverlayDismissed.value).toBe(false);
  });
});
