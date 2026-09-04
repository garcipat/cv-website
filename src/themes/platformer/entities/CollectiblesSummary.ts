import type { CollectedFact } from '../types';

export interface CollectibleSummaryRow {
  labelKey: 'coins' | 'fruits' | 'enemies' | 'crates' | 'chests';
  collected: number;
  total: number;
}

/**
 * Every placed-in-level count this summary needs, one per row — the caller
 * (`Journal.tsx`) computes these from the same placement arrays
 * (`collectiblePlacements`/`blockPlacements`/`enemyPlacements`) the HUD's
 * own counters already use, so both places always agree. Totaling against
 * placement counts rather than raw CVData length avoids a row showing more
 * than the level actually has placed — e.g. Projects showing "0/3" forever
 * when 0 of its 3 entries have a question-mark marker.
 */
export interface CollectibleSummaryTotals {
  coins: number;
  fruits: number;
  enemies: number;
  crates: number;
  chests: number;
  /**
   * Overrides the coins row's "collected" count — needed because a coin no
   * longer carries a fixed 1:1 fact binding (see CollectibleMapper.ts's
   * mapCVDataToSkillFactPool doc comment): under proportional fact pacing
   * (level/SkillFactPacing.ts), "skill facts revealed" and "coins collected"
   * are different numbers whenever the coin count and the skill-category
   * count differ, so deriving "collected" from `facts` the way every other
   * row still does would show a numerator in different units than the
   * denominator (and could even exceed it). Falls back to the old
   * facts-derived count when omitted, purely so this file's own pre-existing
   * tests (which don't know about pacing) keep passing unchanged.
   */
  coinsCollected?: number;
}

/**
 * Collectible-type summary for the personality/"About Me" page's right
 * column — framed around the game's actual sprite types
 * (coin.png/fruit.png/slime, FR-009) rather than CV section names, since
 * this reads as a HUD-style overview rather than another bookmark page.
 *
 * "coins" counts Skills; "fruits" counts Certificates+Projects
 * (question-mark blocks' bonus fruit — see `BlockMapper.ts`'s
 * `certificateToBlock`/`projectToBlock`), not Languages; "enemies" counts
 * Courses (both slime colors guard the same pool — see `EnemyMapper.ts`'s
 * `courseToEnemy`). Keyed by `sectionId` rather than `sourceType` for
 * "fruits"/"coins" (a fact's `sourceType` alone can't distinguish "which
 * pool", e.g. `'block'` also covers crates) — "enemies" can still key on
 * either since Courses is the only enemy-sourced section today, but
 * `sectionId` is used for consistency and to stay correct if that ever
 * changes. A row is omitted entirely when its `total` is 0 (nothing placed
 * in the level yet), matching how `nonEmptySections` hides empty sections'
 * bookmarks. "crates" counts Education+Activities+Languages; "chests"
 * counts Experience, placed below "crates" in the row order.
 */
export function collectiblesSummary(
  facts: CollectedFact[],
  totals: CollectibleSummaryTotals,
): CollectibleSummaryRow[] {
  const rows: CollectibleSummaryRow[] = [];

  if (totals.coins > 0) {
    rows.push({
      labelKey: 'coins',
      collected: totals.coinsCollected ?? facts.filter((f) => f.sectionId === 'skills').length,
      total: totals.coins,
    });
  }

  if (totals.fruits > 0) {
    rows.push({
      labelKey: 'fruits',
      collected: facts.filter((f) => f.sectionId === 'certificates' || f.sectionId === 'projects').length,
      total: totals.fruits,
    });
  }

  if (totals.enemies > 0) {
    rows.push({
      labelKey: 'enemies',
      collected: facts.filter((f) => f.sectionId === 'courses').length,
      total: totals.enemies,
    });
  }

  if (totals.crates > 0) {
    rows.push({
      labelKey: 'crates',
      collected: facts.filter(
        (f) => f.sectionId === 'education' || f.sectionId === 'activities' || f.sectionId === 'languages',
      ).length,
      total: totals.crates,
    });
  }

  if (totals.chests > 0) {
    rows.push({
      labelKey: 'chests',
      collected: facts.filter((f) => f.sectionId === 'experience').length,
      total: totals.chests,
    });
  }

  return rows;
}
