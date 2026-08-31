import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ControlsOverlay } from './ControlsOverlay';
import { lifecycleState, controlsOverlayDismissed } from '../PlatformerState';
import { introState } from '../engine/GameLifecycle';

const PLAYING_PHASE = { phase: 'playing' as const, elapsed: 0, centerX: 0, centerY: 0 };

describe('ControlsOverlay', () => {
  const initialLifecycleState = lifecycleState.value;

  beforeEach(() => {
    vi.useFakeTimers();
    lifecycleState.value = initialLifecycleState;
    controlsOverlayDismissed.value = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    lifecycleState.value = initialLifecycleState;
    controlsOverlayDismissed.value = false;
  });

  it('render-phaseIntro-rendersNothing', () => {
    lifecycleState.value = introState(0, 0);
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
  });

  it('arrowLeftPress-dismissesOverlay', () => {
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);

    fireEvent.keyDown(window, { code: 'ArrowLeft' });

    expect(controlsOverlayDismissed.value).toBe(true);
    expect(screen.queryByTestId('platformer-controls-overlay')).not.toBeInTheDocument();
  });

  it('spacePress-dismissesOverlay', () => {
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);

    fireEvent.keyDown(window, { code: 'Space' });

    expect(controlsOverlayDismissed.value).toBe(true);
  });

  it('journalKeyPress-doesNotDismissOverlay', () => {
    // FR-036: only movement/jump input dismisses it — the journal toggle key
    // is listed IN the overlay's own content, not a dismiss trigger.
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);

    fireEvent.keyDown(window, { code: 'KeyJ' });

    expect(controlsOverlayDismissed.value).toBe(false);
    expect(screen.getByTestId('platformer-controls-overlay')).toBeInTheDocument();
  });

  it('timeoutElapses-dismissesOverlay', () => {
    lifecycleState.value = PLAYING_PHASE;
    render(<ControlsOverlay />);

    act(() => {
      vi.advanceTimersByTime(6000);
    });

    expect(controlsOverlayDismissed.value).toBe(true);
  });

  it('unmountBeforeTimeout-doesNotThrowOrDismiss', () => {
    lifecycleState.value = PLAYING_PHASE;
    const { unmount } = render(<ControlsOverlay />);
    unmount();

    expect(() => {
      act(() => {
        vi.advanceTimersByTime(6000);
      });
    }).not.toThrow();
    expect(controlsOverlayDismissed.value).toBe(false);
  });
});
