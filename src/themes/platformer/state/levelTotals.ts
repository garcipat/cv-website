import { computed } from '@preact/signals-react';
import type { LevelTotals } from '../entities/CollectiblesSummary';
import { collectiblePlacements } from './collectibleStore';
import { blockPlacements } from './blockStore';
import { enemyPlacements } from './enemyStore';
import { chestPlacements } from './deployableItemStore';

/**
 * Every placed-in-level count, computed once. Read by `PlatformerPage.tsx`'s
 * counter popups and `Journal.tsx`'s `collectiblesSummary` call — this used to
 * be seven separate `.filter(...).length` expressions across those two files,
 * with the coin total spelled two different ways.
 *
 * Two constraints that must survive later edits:
 *
 * 1. It reads base `collectiblePlacements`, NOT `allCollectiblePlacements`.
 * Every coin-pot WILL drop a coin eventually, so counting placed coins plus
 * every pot up front makes the coin total a fixed session constant by
 * construction — and keeps this computed invalidated only by
 * `currentLayout`/`currentCV` changes. Reading `allCollectiblePlacements`
 * would invalidate it on every pot drop, mid-play.
 * 2. ONE combined computed, not five. Every input derives from `currentLayout`
 * + `currentCV`, so no event invalidates one total without invalidating all
 * of them; splitting per field would skip zero work and re-scatter the
 * single source of truth this exists to create.
 *
 * `skillFactPool` deliberately stays separate: every total here is
 * level-dependent by construction (COIN_TILES/CRATE_TILES/etc. are all
 * `computed(() => findXTiles(currentLayout.value))`, which is what makes the
 * Level Editor's "Try" button update every downstream total reactively),
 * whereas the pool is CVData-derived and level-independent. Do not collapse
 * the two.
 */
export const levelTotals = computed<LevelTotals>(() => ({
  coins:
    collectiblePlacements.value.filter((p) => p.kind === 'coin').length +
    blockPlacements.value.filter((b) => b.blockKind === 'coinPot').length,
  fruits: blockPlacements.value.filter((b) => b.blockKind === 'questionMark' && b.fact).length,
  // Every green slime placed, not just the ones that happen to have a fact
  // a green slime's fact(s) are now assigned proportionally by position
  // among every green marker (see EnemyMapper.ts's placeGreenSlimes), so the
  // denominator must be every instance of the type, not a fixed
  // 1:1-bound subset.
  enemies: enemyPlacements.value.filter((p) => p.type === 'slimeGreen').length,
  crates: blockPlacements.value.filter((b) => b.blockKind === 'crate').length,
  chests: chestPlacements.value.length,
}));
