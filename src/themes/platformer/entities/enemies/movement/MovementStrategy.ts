import type { LevelDef } from '../../../level/LevelData';
import type { BaseEnemyState } from '../EnemyType';

/**
 * The per-tick inputs a movement strategy receives. Built once per tick by
 * `PlatformerPage.tsx` and shared by every enemy that tick; `player` is
 * `null` in headless tests and the editor preview.
 *
 * Pure data — no signals, canvas or React. See
 * `specs/O-024-enemy-movement-seam/contracts/movement-strategy.md`.
 */
export interface MovementContext {
  /** Static terrain (walls, `patrol` tiles, ground). */
  level: LevelDef;
  /** Live crate/questionMark/fragileRock cells — the same set the pre-seam
   *  patrol step already received (see PlatformerPage.tsx). */
  blockedTiles: readonly { col: number; row: number }[];
  /** Player box for proximity strategies; `null` when absent. */
  player: { x: number; y: number; width: number; height: number } | null;
  /** Seconds since level start; freezes with the world on pause/death. The
   *  fly bob's phase clock. */
  elapsed: number;
}

/**
 * A kind's own movement rule: a pure function of `(enemy, ctx, dt)` returning
 * a new state. Every registered kind declares one; the shared game loop
 * applies `typeOf(enemy).movement.step(...)` and never branches on kind.
 *
 * Invariants (see the contract): never mutates `enemy`/`ctx`; returns the
 * same state shape `S`; sets `animState` to a state the kind declares;
 * deterministic; `dt <= 0` is a no-op; O(1) work; and never imports
 * `Enemy.ts` or `ENEMY_TYPES` (geometry arrives through the strategy's own
 * config).
 */
export interface MovementStrategy<S extends BaseEnemyState> {
  readonly kind: 'patrol' | 'fly' | 'chase';
  step(enemy: S, ctx: MovementContext, dt: number): S;
}
