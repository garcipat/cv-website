import { signal } from '@preact/signals-react';
import type { TransientEffect } from '../engine/effects';
import {
  activeSpeechBubble,
  clearEffectsByResetScope,
  effectKeyOf,
  upsertEffect,
  withSpeechBubbleText,
} from '../engine/effects';
import { hintText } from './hintText';

/**
 * THE one collection of live transient effects. Every effect
 * family — flying text, counter popups, puffs, heal auras, hit splatters,
 * fade-out labels, explosions, debris — lives here; no family keeps a parallel
 * store. Effects are appended by `spawnEffect` below, advanced by the single
 * `advanceEffects` in the game tick, and drawn by the single `drawEffects`
 * dispatch at its pipeline layer. The four timed-tile timer signals in
 * `hazardTimerStore` remain separate: they are keyed timers, not effect
 * instances.
 */
export const activeEffects = signal<TransientEffect<unknown>[]>([]);

/**
 * Appends a transient effect to `activeEffects`, replacing in place when the
 * kind declares a keyed slot (`counterPopup`, keyed by `labelKey`) so a fresh
 * collect of the same type refreshes that slot rather than queuing a second
 * popup. State-owned, so `engine/effects` keeps no `engine/ → state/`
 * import.
 */
export function spawnEffect(effect: TransientEffect<unknown>): void {
  activeEffects.value = upsertEffect(activeEffects.value, effect, effectKeyOf);
}

/**
 * Re-resolves the active speech bubble's stored localized text from the
 * derived `hintText` signal and rewrites that one effect only when the text
 * differs (the pure `withSpeechBubbleText` identity check). Called by the
 * render loop each frame, so a live bubble follows a language switch in the
 * same frame while a steady-state frame performs no collection write
 *. State-owned, like `spawnEffect`, so `engine/effects` keeps
 * no `engine/ → state/` import.
 */
export function refreshSpeechBubbleText(): void {
  const bubble = activeSpeechBubble(activeEffects.value);
  if (!bubble) return;
  const resolved = hintText.value[bubble.state.messageId];
  if (resolved === bubble.state.text) return;
  activeEffects.value = activeEffects.value.map((effect) =>
    effect === bubble ? withSpeechBubbleText(bubble, resolved) : effect,
  );
}

/**
 * The transient-effects domain's reset hook. Only the `'death'`-scoped kinds
 * (the fade-out labels) are filtered out on a death/respawn — so puffs, heal
 * auras, hit splatters, debris, explosions, flying text and counter popups,
 * which survive a death today, keep fading on their own duration. A full Reset
 * Game empties the whole collection, whatever each kind's reset scope.
 */
export function reset(respawn: boolean): void {
  activeEffects.value = respawn ? clearEffectsByResetScope(activeEffects.value, 'death') : [];
}

/** The full-reset hook — one body, shared with the respawn pass. */
export function resetFull(): void {
  reset(false);
}
