/**
 * The effect kind → start/tick/draw/expiry registry that makes a new transient
 * effect one module plus one registry line (R-004 FR-002). Declaration order
 * is part of the contract: it fixes the intra-layer draw order
 * (`flight` → `puff` → `debris` → `hitSplatter` → `fadeOutText`).
 */
import {
  drawFlightEffect,
  flightEffectExpired,
  startFlightEffect,
  tickFlightEffect,
} from './flight';
import {
  drawCounterPopup,
  startCounterPopup,
  tickCounterPopup,
  type CounterPopupState,
} from './counterPopup';
import { drawPuffEffect, startPuffEffect } from './puff';
import { drawHealAuraEffect, startHealAuraEffect } from './healAura';
import { drawDebrisEffect, startDebrisEffect } from './debris';
import { drawHitSplatterEffect, startPlayerHitSplatter } from './hitSplatter';
import { drawFadeOutText, startFadeOutTextEffect } from './fadeOutText';
import { drawExplosionEffect, startExplosionEffect } from './explosion';
import { RESET_SCOPE_BY_KIND, type EffectRenderContext, type TransientEffect } from './transientEffect';

/** The fixed set of shipped effect families — no additions (FR-019). */
export type EffectKind =
  | 'flight'
  | 'counterPopup'
  | 'puff'
  | 'healAura'
  | 'hitSplatter'
  | 'fadeOutText'
  | 'explosion'
  | 'debris';

/** Pipeline depth for the single dispatch (FR-005). */
export type EffectLayer = 'midWorld' | 'worldEffects' | 'aboveWorld' | 'hudLast';

/** `'death'` is cleared by `resetGame()`; `'progress'` only by a full reset. */
export type EffectResetScope = 'death' | 'progress';

/**
 * Maps a kind to its start/tick/draw/expiry and the metadata the collection
 * needs. Only `flight` and `counterPopup` override `tick`/`expired`; only
 * `counterPopup` declares `keyOf` (a keyed replace-in-place slot).
 */
export interface EffectRegistryEntry<S = unknown> {
  readonly kind: EffectKind;
  readonly create: (...args: never[]) => TransientEffect<S>;
  readonly tick?: (effect: TransientEffect<S>, dt: number) => TransientEffect<S> | null;
  readonly draw: (effect: TransientEffect<S>, rc: EffectRenderContext) => void;
  readonly expired?: (effect: TransientEffect<S>) => boolean;
  readonly layer: EffectLayer;
  readonly resetScope: EffectResetScope;
  readonly keyOf?: (effect: TransientEffect<S>) => string;
}

/**
 * The registry is a heterogeneous list: each entry's `S` is its own family
 * payload. Rendering/dispatch only ever pass an effect whose `kind` guarantees
 * that payload shape, so each entry is widened once here rather than casting at
 * every call site.
 */
function widen<S>(entry: EffectRegistryEntry<S>): EffectRegistryEntry<unknown> {
  return entry as unknown as EffectRegistryEntry<unknown>;
}

/** The counter-popup keyed slot keys by its collectible label. */
function keyOfCounterPopup(effect: TransientEffect<unknown>): string {
  return (effect as TransientEffect<CounterPopupState>).state.labelKey;
}

/**
 * The one registry, in declaration order. Adding a transient effect is one
 * module plus one line here — no edit to state, the tick, the draw pass, or
 * reset code.
 */
export const EFFECT_REGISTRY: readonly EffectRegistryEntry<unknown>[] = [
  widen({
    kind: 'flight',
    create: startFlightEffect,
    tick: tickFlightEffect,
    draw: drawFlightEffect,
    expired: flightEffectExpired,
    layer: 'worldEffects',
    resetScope: RESET_SCOPE_BY_KIND.flight,
  }),
  widen({
    kind: 'counterPopup',
    create: startCounterPopup,
    tick: tickCounterPopup,
    draw: drawCounterPopup,
    layer: 'hudLast',
    resetScope: RESET_SCOPE_BY_KIND.counterPopup,
    keyOf: keyOfCounterPopup,
  }),
  widen({
    kind: 'puff',
    create: startPuffEffect,
    draw: drawPuffEffect,
    layer: 'worldEffects',
    resetScope: RESET_SCOPE_BY_KIND.puff,
  }),
  widen({
    kind: 'healAura',
    create: startHealAuraEffect,
    draw: drawHealAuraEffect,
    layer: 'midWorld',
    resetScope: RESET_SCOPE_BY_KIND.healAura,
  }),
  widen({
    kind: 'debris',
    create: startDebrisEffect,
    draw: drawDebrisEffect,
    layer: 'worldEffects',
    resetScope: RESET_SCOPE_BY_KIND.debris,
  }),
  widen({
    kind: 'hitSplatter',
    create: startPlayerHitSplatter,
    draw: drawHitSplatterEffect,
    layer: 'worldEffects',
    resetScope: RESET_SCOPE_BY_KIND.hitSplatter,
  }),
  widen({
    kind: 'fadeOutText',
    create: startFadeOutTextEffect,
    draw: drawFadeOutText,
    layer: 'worldEffects',
    resetScope: RESET_SCOPE_BY_KIND.fadeOutText,
  }),
  widen({
    kind: 'explosion',
    create: startExplosionEffect,
    draw: drawExplosionEffect,
    layer: 'aboveWorld',
    resetScope: RESET_SCOPE_BY_KIND.explosion,
  }),
];

/** The registry entry for a kind. */
export function effectEntry(kind: EffectKind): EffectRegistryEntry<unknown> {
  const entry = EFFECT_REGISTRY.find((candidate) => candidate.kind === kind);
  if (!entry) throw new Error(`Unknown effect kind: ${kind}`);
  return entry;
}

/** The keyed-slot key of an effect, or `undefined` for an append-only kind. */
export function effectKeyOf(effect: TransientEffect<unknown>): string | undefined {
  return effectEntry(effect.kind).keyOf?.(effect);
}
