import { signal, computed } from '@preact/signals-react';
import { HAZARD_TILES } from './levelSession';
import { placeHazards } from '../level/HazardMapper';
import type { HazardPlacement } from '../level/HazardMapper';
import { advanceMushroomSquashes } from '../tiles/bouncyMushroom';
import type { MushroomSquashState } from '../tiles/bouncyMushroom';
import {
  armFloorSpike,
  advanceFloorSpikes,
  type FloorSpikeTimerState,
} from '../entities/hazards/FloorSpike';
import { armCrumblingFloor, advanceCrumblingFloors } from '../tiles/crumblingFloor';
import type { CrumblingFloorTimerState } from '../tiles/crumblingFloor';
import {
  armFallingStalactite,
  advanceFallingStalactites,
  type FallingStalactiteTimerState,
} from '../entities/hazards/FallingStalactite';
import { typeOf as hazardTypeOf } from '../entities/hazards';
import type { HazardKind } from '../entities/hazards';
import type { HazardTickContext } from '../entities/hazards/HazardType';
import { activeLevel } from './deployableItemStore';
import { blockStates } from './blockStore';

/**
 * Every spike hazard in the level, placed once at module load — same
 * non-reactive-to-CVData-but-reactive-to-`currentLayout` convention as
 * signPlacements above (a marker's character alone determines its
 * hazardType/facing, see HazardMapper.ts's placeHazards).
 */
export const hazardPlacements = computed<HazardPlacement[]>(() => placeHazards(HAZARD_TILES.value));

/**
 * The transient cosmetic dips of recently-bounced bouncy-mushroom caps — one
 * entry per cap cell, each carrying how long ago it was hit. The only mutable
 * state the mushroom feature introduces; purely visual, never consulted by
 * collision or standability. Advanced/pruned by
 * `tickMushroomSquashes` and cleared by `resetGame()`.
 */
export const mushroomSquashStates = signal<MushroomSquashState[]>([]);

/**
 * Advances every in-progress cap dip by `dt` and drops expired ones — called
 * once per game-loop tick in the `playing` phase (so it freezes with the world
 * during pause/death, alongside `tickDarkness`/`tickDeployableItems`).
 */
export function tickMushroomSquashes(dt: number): void {
  mushroomSquashStates.value = advanceMushroomSquashes(mushroomSquashStates.value, dt);
}

/**
 * Live per-instance cycle timers for floor spikes — one entry per tile that
 * has been triggered at least once, pruned back out once its cycle
 * completes. Same "presence means in progress" convention as
 * `mushroomSquashStates`/`deployableItems`. Advanced by `tickFloorSpikes` and
 * cleared by `resetGame()`.
 */
export const floorSpikeTimerStates = signal<FloorSpikeTimerState[]>([]);

/** One kind's arming action — writes that kind's own timer signal. */
interface HazardTimerStore {
  arm(id: string): void;
}

/**
 * Kind→arming-action registry. A brand-new armed-then-cycle hazard
 * kind declares its timer signal and one entry here (where signals live) — the
 * detection (`Collision.ts`), the per-tick merge (`hazardPlacementsForTick`),
 * and the page's damage/knockback block need no edit, exactly as records
 * for a new pickup family.
 */
const hazardTimerStores: Partial<Record<HazardKind, HazardTimerStore>> = {
  floorSpike: {
    arm: (id) => {
      floorSpikeTimerStates.value = armFloorSpike(floorSpikeTimerStates.value, id);
    },
  },
  fallingStalactite: {
    arm: (id) => {
      fallingStalactiteTimerStates.value = armFallingStalactite(
        fallingStalactiteTimerStates.value,
        id,
      );
    },
  },
};

/** Arms the hazard `id`'s cycle if it isn't already running
 * the caller (PlatformerPage.tsx) calls this once per tick for every id
 * `checkHazardArmTriggers` returns; the dispatched store's own presence check
 * makes a repeat call during an already-running cycle a no-op. */
export function armHazardTrigger(id: string): void {
  const hazard = hazardPlacements.value.find((h) => h.id === id);
  if (!hazard) return;
  hazardTimerStores[hazard.hazardType]?.arm(id);
}

/** Advances every running floor spike cycle by `dt` — called once per
 * game-loop tick in the `playing` phase, alongside `tickMushroomSquashes`,
 * so cycles freeze with the rest of the world during pause/death. */
export function tickFloorSpikes(dt: number): void {
  floorSpikeTimerStates.value = advanceFloorSpikes(floorSpikeTimerStates.value, dt);
}

/**
 * Live per-instance cycle timers for crumbling floor tiles — one entry per
 * cell that has been stepped on at least once, pruned back out once its
 * full cycle completes. Keyed by grid position, unlike
 * `floorSpikeTimerStates`' placement ids, since a crumbling floor tile has
 * no separate placement list. Advanced by `tickCrumblingFloors` and
 * cleared by `resetGame()`.
 */
export const crumblingFloorTimerStates = signal<CrumblingFloorTimerState[]>([]);

/** Arms `(col, row)`'s cycle if it isn't already running
 * — called once per tick for every cell `checkCrumblingFloorTriggers`
 * returns. */
export function armCrumblingFloorTrigger(col: number, row: number): void {
  crumblingFloorTimerStates.value = armCrumblingFloor(crumblingFloorTimerStates.value, col, row);
}

/** Advances every running crumbling floor cycle by `dt` — called once per
 * game-loop tick in the `playing` phase, alongside `tickFloorSpikes`, so
 * cycles freeze with the rest of the world during pause/death. */
export function tickCrumblingFloors(dt: number): void {
  crumblingFloorTimerStates.value = advanceCrumblingFloors(crumblingFloorTimerStates.value, dt);
}

/**
 * Live per-instance timer states for falling stalactites — one entry per
 * hazard that has been armed at least once. Unlike the floor spike's cycle,
 * entries are NEVER pruned: a `gone` (shattered) stalactite must stay gone for
 * the rest of the attempt, so its entry persists until `resetGame()`
 * clears the whole array.
 */
export const fallingStalactiteTimerStates = signal<FallingStalactiteTimerState[]>([]);

/** Advances every running falling-stalactite timer by `dt` — called once per
 * game-loop tick in the `playing` phase, so timers freeze with the rest of
 * the world during pause/death. Never prunes. */
export function tickFallingStalactites(dt: number): void {
  fallingStalactiteTimerStates.value = advanceFallingStalactites(
    fallingStalactiteTimerStates.value,
    dt,
  );
}

/**
 * `hazardPlacements` with each kind's live per-tick state merged in — the
 * merge itself is the hazard kind's own `withTickState` hook (floor spikes get
 * their cycle phase/extension, falling stalactites their phase and fall/shake
 * offsets; every other kind passes through unchanged by omitting the hook).
 * This is what `PlatformerPage.tsx` hands to `drawHazards`/`resolveHazardContacts`
 * instead of the raw (phase-unaware) `hazardPlacements` computed. Recomputed
 * fresh each call (not a `computed`) since it depends on signals that change
 * every tick during an active cycle. The state layer still assembles the
 * timer/context bundle; the hook reads only that parameter (no new
 * `entities/ → state/` edge).
 */
export function hazardPlacementsForTick(): HazardPlacement[] {
  const ctx: HazardTickContext = {
    floorSpikeTimers: floorSpikeTimerStates.value,
    fallingStalactiteTimers: fallingStalactiteTimerStates.value,
    activeLevel: activeLevel.value,
    blockStates: blockStates.value,
    crumblingFloorTimers: crumblingFloorTimerStates.value,
  };
  return hazardPlacements.value.map(
    (hazard) => hazardTypeOf(hazard).withTickState?.(hazard, ctx) ?? hazard,
  );
}

/**
 * The hazard-timer domain's reset hook. Every timer collection empties in both
 * modes — an in-progress cap dip, floor spike cycle, crumbling floor cycle or
 * shattered stalactite must not survive a death/respawn — so `respawn` is
 * accepted only for the shared hook signature.
 */
export function reset(respawn: boolean): void {
  void respawn;
  // An in-progress cap dip must not survive a death/respawn.
  mushroomSquashStates.value = [];
  // An in-progress floor spike cycle must not survive a death/respawn
  //, same convention as the mushroom cap squash above it.
  floorSpikeTimerStates.value = [];
  // An in-progress crumbling floor cycle must not survive a death/respawn
  // ( the spec's death/respawn reset requirement), same convention
  // as the floor spike cycle above it.
  crumblingFloorTimerStates.value = [];
  // Every shattered falling stalactite returns to hanging on death/respawn
  // — same convention as the floor spike/crumbling floor cycles above.
  fallingStalactiteTimerStates.value = [];
}

/** The full-reset hook — one body, shared with the respawn pass. */
export function resetFull(): void {
  reset(false);
}
