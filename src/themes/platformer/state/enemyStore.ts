import { signal, computed } from '@preact/signals-react';
import { ENEMY_TILES_GREEN, ENEMY_TILES_PURPLE, BEE_TILES } from './levelSession';
import { currentCV } from '@/state/locale';
import { mapCVDataToEnemies, placeEnemies } from '../level/EnemyMapper';
import type { EnemyPlacement } from '../level/EnemyMapper';
import { toEnemyState, reviveEnemy } from '../entities/Enemy';
import type { EnemyState } from '../entities/Enemy';

/**
 * Every enemy in the level, placed once at module load — same non-reactive
 * convention as collectiblePlacements (see its comment): no
 * locale-reactivity. Every position comes from currentLevel's hand-placed
 * `M`/`m` markers (see ENEMY_TILES_GREEN/
 * ENEMY_TILES_PURPLE) — placeEnemies has no auto-placement. A marker is a
 * slot on the map; each slot draws the next fact from CVData as its reward.
 * currentLevel currently has one `M` and one `m`, so only the first course
 * and first certificate actually have an enemy — the rest of CVData's
 * certificates/projects/courses simply aren't on the map yet, which is expected for
 * this mechanics-test level, not a bug (see level.ts's doc comment).
 */
export const enemyPlacements = computed<EnemyPlacement[]>(() =>
  placeEnemies(mapCVDataToEnemies(currentCV.value), {
    slimeGreen: ENEMY_TILES_GREEN.value,
    slimePurple: ENEMY_TILES_PURPLE.value,
    bee: BEE_TILES.value,
  }),
);

/**
 * Live, per-frame patrol state for every enemy — position/velocity/
 * direction/animation, updated by the game loop's `stepEnemyPatrol` (see
 * PlatformerPage.tsx). Seeded from `enemyPlacements` (module load) and reset
 * back to that seed in `resetGame()`, same convention as `playerState`.
 */
export const enemyStates = signal<EnemyState[]>(
  enemyPlacements.value.map((placement, index) => toEnemyState(placement, index)),
);

/**
 * How many green slimes have been defeated this session — read by
 * `PlatformerPage.tsx`'s enemies counter popup and `Journal.tsx`'s summary
 * row, so the two can never disagree. Unlike `cratesDestroyed` above, a
 * defeated enemy is never removed from `enemyStates` (it stays, revivable
 * see `Enemy.ts`'s `reviveEnemy`), so filtering by the permanent
 * `rewardGiven` flag is exact with no analogous undercount risk.
 */
export const enemiesDefeated = computed<number>(
  () => enemyStates.value.filter((e) => e.type === 'slimeGreen' && e.rewardGiven).length,
);

/**
 * The enemies domain's respawn-pass hook. Enemies are revived via
 * `reviveEnemy` on the existing `enemyStates` objects rather than rebuilt from
 * `enemyPlacements` — the same enemy objects survive a death/respawn cycle so
 * per-instance session state (see `EnemyState.rewardGiven`) isn't wiped out by
 * a fresh rebuild. `resetGameProgress()` is the only place still allowed to
 * rebuild from placements, which is what actually clears that session state.
 */
export function reset(respawn: boolean): void {
  if (respawn) {
    enemyStates.value = enemyStates.value.map(reviveEnemy);
    return;
  }
  enemyStates.value = enemyPlacements.value.map((placement, index) =>
    toEnemyState(placement, index),
  );
}

/** The full-reset hook — one body, shared with the respawn pass. */
export function resetFull(): void {
  reset(false);
}
