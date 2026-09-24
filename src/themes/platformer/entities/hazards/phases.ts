/**
 * The hazard phase/timer vocabulary owned by the hazard kinds, extracted into
 * a dependency-free module so `level/` can reach it without importing
 * `engine/` (R-001).
 *
 * This module imports nothing. The engine's `FloorSpike.ts` /
 * `FallingStalactite.ts` own the behaviour, constants and cycle functions;
 * these are the pure type shapes those functions operate on.
 */

/**
 * A floor spike's cycle phase (spec.md's Key Entities). `'atRest'` is the
 * only phase with no tracked timer entry at all — everything else is driven
 * by elapsed time since arming, same shape as `PlacedBomb.ts`'s
 * `fuseElapsed`. `'delay'` and `'atRest'` render identically (the ground
 * tell only) but are distinct states so a second contact during the delay
 * is a no-op rather than a fresh trigger (spec FR-008). `'fullExtend'`
 * covers both the spec's "full-extend" and "holding" phases — both are
 * hazardous and render identically, so nothing observable distinguishes
 * them (see this plan's Architecture Decisions §1).
 */
export type FloorSpikePhase = 'atRest' | 'delay' | 'warning' | 'fullExtend' | 'retracting';

/** One floor spike's live timer. Presence in the states array means its
 *  cycle is running; absence means at rest and triggerable. */
export interface FloorSpikeTimerState {
  id: string;
  /** Seconds since this tile was armed. */
  elapsed: number;
}

/**
 * A falling stalactite's phase (O-027, spec.md's Key Entities). `'hanging'`
 * is the absence of a timer entry — the only triggerable phase — while the
 * timer-derived phases are `shaking` → `falling` → `gone`.
 *
 * Unlike the floor spike's cycle, a `gone` entry is NEVER pruned: it
 * persists for the rest of the attempt (FR-013) and is cleared only by
 * `resetGame()` (FR-014). Keeping `elapsed` as the only mutable field makes
 * every phase a pure function of elapsed time.
 */
export type FallingStalactitePhase = 'hanging' | 'shaking' | 'falling' | 'gone';

/** One falling stalactite's live timer. Presence in the states array means
 *  armed (shaking or later); absence means hanging and triggerable. */
export interface FallingStalactiteTimerState {
  id: string;
  /** Seconds since armed. */
  elapsed: number;
}
