/**
 * The one transient-effect base every platformer effect family is expressed in
 * (R-004 FR-001/FR-003/FR-004). It carries the issue's named fields — `id`,
 * `elapsed`, `duration`, `tick`, `draw`, `expired` — plus the per-family
 * `state` payload and the `kind`/`duration` metadata the unified collection
 * needs. `advanceEffects` is the one advance; per-kind modules own their
 * `start`/`tick`/derive/`draw`.
 *
 * This module imports `contracts/`, `shared/`, `entities/sprites`, and
 * `engine/textDraw` only — never a state module (no `engine/ → state/`) and
 * never `level/`.
 */
import type { DrawContext } from '../../contracts/DrawContext';
import type { CounterPopupLabelKey } from '../../contracts/counters';
import type { EffectKind, EffectResetScope } from './registry';

/** A resolved HUD popup icon (see `EffectRenderContext.popupIcons`). */
export interface PopupIcon {
  icon: HTMLImageElement;
  iconFrame: { sx: number; sy: number; size: number };
  iconYOffset?: number;
}

/** This frame's resolved popup icons, keyed by `CounterPopupLabelKey`. */
export type PopupIconLookup = Partial<Record<CounterPopupLabelKey, PopupIcon>>;

/**
 * The render context every registered `draw` receives (FR-017), so no family
 * loses information in the move. `ctx` doubles as `dc.ctx`; `dc` carries the
 * sprite lookup and camera origin for world-space families.
 */
export interface EffectRenderContext {
  ctx: CanvasRenderingContext2D;
  dc: DrawContext;
  canvasWidth: number;
  canvasHeight: number;
  /** Live player anchor for the position-less heal aura. */
  playerAnchor: { x: number; y: number; width: number };
  /** Page-resolved popup icons, keyed by `CounterPopupLabelKey`. */
  popupIcons: PopupIconLookup;
  /** The live unified collection this frame, so a kind whose layout depends on
   *  its siblings (the counter-popup row) can compute its own slot. */
  effects: readonly TransientEffect<unknown>[];
}

/**
 * One transient effect instance. `state` is the family-specific payload;
 * `tick` returns the next effect (or the same reference for a no-op, or `null`
 * to signal "drop now" — the counter popup's sentinel); `expired` reproduces
 * the family's exact pre-refactor boundary.
 */
export interface TransientEffect<S = unknown> {
  readonly kind: EffectKind;
  readonly id: string;
  readonly duration: number;
  elapsed: number;
  readonly state: S;
  tick(effect: TransientEffect<S>, dt: number): TransientEffect<S> | null;
  draw(effect: TransientEffect<S>, rc: EffectRenderContext): void;
  expired(effect: TransientEffect<S>): boolean;
}

/** The six families that share one advance body: `{ ...effect, elapsed: elapsed + dt }`. */
export function defaultTick<S>(effect: TransientEffect<S>, dt: number): TransientEffect<S> {
  return { ...effect, elapsed: effect.elapsed + dt };
}

/** The default expiry boundary: strictly past the duration (never `>=`). */
export function defaultExpired<S>(effect: TransientEffect<S>): boolean {
  return effect.elapsed > effect.duration;
}

/**
 * Per-kind reset scope (FR-006). Only `fadeOutText` is `'death'`-scoped, so a
 * death/respawn clears exactly the labels it clears today; every other kind is
 * `'progress'`-scoped and survives until a full Reset Game. The registry reads
 * this map so the policy lives with the kind list rather than being respelled.
 */
export const RESET_SCOPE_BY_KIND: Record<EffectKind, EffectResetScope> = {
  flight: 'progress',
  counterPopup: 'progress',
  puff: 'progress',
  healAura: 'progress',
  hitSplatter: 'progress',
  fadeOutText: 'death',
  explosion: 'progress',
  debris: 'progress',
};

/**
 * Advance the whole collection (or only the filtered kinds) through each
 * effect's registered `tick`, dropping `null`/expired results. This is the one
 * advance (FR-004/FR-007): the six byte-identical per-kind bodies collapse to
 * the readers' `defaultTick`. Filtering ticks/prunes only the named kinds and
 * leaves every other effect's `elapsed` frozen (the dying lead-in, US5-3).
 */
export function advanceEffects(
  effects: readonly TransientEffect<unknown>[],
  dt: number,
  options?: { kinds?: readonly EffectKind[] },
): TransientEffect<unknown>[] {
  const kinds = options?.kinds;
  const next: TransientEffect<unknown>[] = [];
  for (const effect of effects) {
    if (kinds && !kinds.includes(effect.kind)) {
      next.push(effect);
      continue;
    }
    const ticked = effect.tick(effect, dt);
    if (ticked === null) continue;
    if (ticked.expired(ticked)) continue;
    next.push(ticked);
  }
  return next;
}

/**
 * Remove effects whose kind's reset scope matches; omitting `scope` clears the
 * whole collection (the full Reset Game, FR-006).
 */
export function clearEffectsByResetScope(
  effects: readonly TransientEffect<unknown>[],
  scope?: EffectResetScope,
): TransientEffect<unknown>[] {
  if (scope === undefined) return [];
  return effects.filter((effect) => RESET_SCOPE_BY_KIND[effect.kind] !== scope);
}

/**
 * Insert an effect: append it, or — when it declares a keyed slot via `keyOf`
 * — replace any existing effect with the same `(kind, key)` so a fresh collect
 * of the same type refreshes that slot rather than queuing a second one
 * (FR-016). The state module owns the signal write; this is the pure part.
 */
export function upsertEffect(
  effects: readonly TransientEffect<unknown>[],
  effect: TransientEffect<unknown>,
  keyOf: (effect: TransientEffect<unknown>) => string | undefined,
): TransientEffect<unknown>[] {
  const key = keyOf(effect);
  if (key === undefined) return [...effects, effect];
  return [
    ...effects.filter(
      (existing) => !(existing.kind === effect.kind && keyOf(existing) === key),
    ),
    effect,
  ];
}

/** Live count of one kind (e.g. flight effects seed the slot allocator). */
export function effectCount(effects: readonly TransientEffect<unknown>[], kind: EffectKind): number {
  let count = 0;
  for (const effect of effects) {
    if (effect.kind === kind) count += 1;
  }
  return count;
}
