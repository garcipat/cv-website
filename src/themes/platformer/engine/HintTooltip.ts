import type { HintId } from '../types';

/**
 * Grow+fade animation state for the hint-sign tooltip (roadmap step 26,
 * live UX feedback: "the bubble should be shown from bottom to top like the
 * sign is starting to talk... and disappears the same way") — mirrors the
 * phase/elapsed shape `engine/CollectionEffects.ts`'s `FlightEffect` already
 * uses for the fact-flight text animation, generalized here to just two
 * transitions instead of three.
 */
export type HintTooltipPhase = 'entering' | 'shown' | 'exiting';

export interface HintTooltipState {
  hintId: HintId;
  phase: HintTooltipPhase;
  elapsed: number;
}

/**
 * Kept short and roughly equal (unlike ControlsOverlay.tsx's much longer
 * 400ms/600ms — that overlay is a one-time, whole-session event; a sign's
 * tooltip can be re-revealed every time the player walks back onto it and
 * presses Up again, so a snappier transition reads better for a
 * frequently-repeated interaction).
 */
export const HINT_TOOLTIP_FADE_IN_SECONDS = 0.2;
export const HINT_TOOLTIP_FADE_OUT_SECONDS = 0.25;

/** Starts a fresh tooltip in its 'entering' phase (roadmap step 26: only
 *  called once the player presses Up/`W` while overlapping a sign, not on
 *  mere overlap — see PlatformerPage.tsx). */
export function startHintTooltip(hintId: HintId): HintTooltipState {
  return { hintId, phase: 'entering', elapsed: 0 };
}

/** Switches an already-active tooltip into its 'exiting' phase, resetting
 *  elapsed. Called as soon as the player leaves the sign's overlap zone,
 *  regardless of whether Up was ever pressed while they were on it. */
export function beginHintTooltipExit(state: HintTooltipState): HintTooltipState {
  return { ...state, phase: 'exiting', elapsed: 0 };
}

/**
 * Advances the animation by `dt` seconds. 'entering' becomes 'shown' (elapsed
 * reset to 0) once HINT_TOOLTIP_FADE_IN_SECONDS elapses; 'shown' just
 * accumulates elapsed with no transition (the caller decides when to call
 * beginHintTooltipExit); 'exiting' returns `null` once
 * HINT_TOOLTIP_FADE_OUT_SECONDS elapses — the caller clears its signal to
 * `null` at that point, same convention as CollectionEffects.ts's
 * tickFlightEffect/tickCounterPopup returning a sentinel for "done".
 */
export function tickHintTooltip(state: HintTooltipState, dt: number): HintTooltipState | null {
  const elapsed = state.elapsed + dt;
  if (state.phase === 'entering') {
    if (elapsed >= HINT_TOOLTIP_FADE_IN_SECONDS) return { ...state, phase: 'shown', elapsed: 0 };
    return { ...state, elapsed };
  }
  if (state.phase === 'exiting') {
    if (elapsed >= HINT_TOOLTIP_FADE_OUT_SECONDS) return null;
    return { ...state, elapsed };
  }
  return { ...state, elapsed };
}

/**
 * Current vertical growth (0-1) and opacity (0-1) for the given state — the
 * caller (Renderer.ts's `drawSignBubble`) scales the bubble's HEIGHT by
 * `growth` while keeping its bottom edge (where the tail meets it) fixed, so
 * the whole thing visibly rises out of that fixed point rather than just
 * scaling in place — reading as "the sign starting to talk." 'entering'
 * interpolates growth/opacity 0 -> 1 as HINT_TOOLTIP_FADE_IN_SECONDS elapses;
 * 'shown' is always fully grown/opaque; 'exiting' interpolates the exact
 * reverse, 1 -> 0, over HINT_TOOLTIP_FADE_OUT_SECONDS — collapsing back down
 * into the same fixed point it grew from. Both progress ratios are clamped to
 * [0, 1] so a stale `elapsed` past either duration still returns a sane
 * (fully collapsed, not negative) result.
 */
export function hintTooltipGrowthAndOpacity(state: HintTooltipState): { growth: number; opacity: number } {
  if (state.phase === 'entering') {
    const progress = Math.min(1, state.elapsed / HINT_TOOLTIP_FADE_IN_SECONDS);
    return { growth: progress, opacity: progress };
  }
  if (state.phase === 'exiting') {
    const progress = Math.min(1, state.elapsed / HINT_TOOLTIP_FADE_OUT_SECONDS);
    return { growth: 1 - progress, opacity: 1 - progress };
  }
  return { growth: 1, opacity: 1 };
}
