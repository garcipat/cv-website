import type { CollectedFact, SectionId } from '../types';

/** Which collectible counters exist — the HUD's transient popups
 *  (`CounterPopupLabelKey`, which omits `chests`: chests have a permanent HUD
 *  counter instead) plus the journal's summary rows, which do include it. */
export type CounterKey = 'coins' | 'fruits' | 'enemies' | 'crates' | 'chests';

/**
 * Which CV sections each collectible counter is fed by — the single source of
 * truth for both the journal's summary rows and the in-game counter popups.
 *
 * This mapping used to exist twice, and the two copies disagreed: the crate
 * popup counted `'experience'` (the CHEST pool) as a crate and ignored
 * activities/languages entirely, so the HUD and the journal reported
 * different numbers for the same thing. One map, two consumers, no way to
 * drift again — `COUNTER_SECTIONS`'s own test asserts no section feeds two
 * counters, which is exactly the invariant that broke.
 *
 * Keyed by `sectionId` rather than `sourceType`: a fact's `sourceType` alone
 * cannot distinguish which pool it came from (`'block'` covers both crates and
 * question-mark fruit).
 */
export const COUNTER_SECTIONS: Record<CounterKey, readonly SectionId[]> = {
  coins: ['skills'],
  fruits: ['certificates', 'projects'],
  enemies: ['courses'],
  crates: ['education', 'activities', 'languages'],
  chests: ['experience'],
};

/** How many of `facts` feed the given counter. The numerator for every
 *  counter popup and summary row — except the coins row, which overrides it
 *  (see `CollectibleSummaryTotals.coinsCollected`): under proportional
 *  pacing a coin carries no fixed fact, so "skill facts revealed" and "coins
 *  collected" are different numbers. */
export function countCollectedFor(
  counterKey: CounterKey,
  facts: readonly CollectedFact[],
): number {
  const sections = COUNTER_SECTIONS[counterKey];
  return facts.filter((fact) => sections.includes(fact.sectionId)).length;
}

export interface CollectibleSummaryRow {
  labelKey: CounterKey;
  collected: number;
  total: number;
}

/**
 * Every placed-in-level count, one per collectible counter. Derived once by
 * `PlatformerState.ts`'s `levelTotals` computed and read by both the journal's
 * summary rows and the HUD's counter popups, so the two can never disagree.
 * Totalling against placement counts rather than raw CVData length avoids a
 * row showing more than the level actually has placed — e.g. Projects showing
 * "0/3" forever when 0 of its 3 entries have a question-mark marker.
 */
export interface LevelTotals {
  coins: number;
  fruits: number;
  enemies: number;
  crates: number;
  chests: number;
}

export type CollectibleSummaryTotals = LevelTotals & {
  /**
   * Overrides the coins row's "collected" count — needed because a coin no
   * longer carries a fixed 1:1 fact binding (see CollectibleMapper.ts's
   * mapCVDataToSkillFactPool doc comment): under proportional fact pacing
   * (level/SkillFactPacing.ts), "skill facts revealed" and "coins collected"
   * are different numbers whenever the coin count and the skill-category
   * count differ, so deriving "collected" from `facts` the way every other
   * row still does would show a numerator in different units than the
   * denominator (and could even exceed it). Falls back to the
   * facts-derived count when omitted.
   */
  coinsCollected?: number;
};

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
      collected: totals.coinsCollected ?? countCollectedFor('coins', facts),
      total: totals.coins,
    });
  }

  if (totals.fruits > 0) {
    rows.push({ labelKey: 'fruits', collected: countCollectedFor('fruits', facts), total: totals.fruits });
  }

  if (totals.enemies > 0) {
    rows.push({ labelKey: 'enemies', collected: countCollectedFor('enemies', facts), total: totals.enemies });
  }

  if (totals.crates > 0) {
    rows.push({ labelKey: 'crates', collected: countCollectedFor('crates', facts), total: totals.crates });
  }

  if (totals.chests > 0) {
    rows.push({ labelKey: 'chests', collected: countCollectedFor('chests', facts), total: totals.chests });
  }

  return rows;
}
