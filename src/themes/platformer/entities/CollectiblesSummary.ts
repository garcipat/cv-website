import { sectionTotal } from './JournalSections';
import type { CVData } from '@/types/cv';
import type { CollectedFact } from '../types';

export interface CollectibleSummaryRow {
  labelKey: 'coins' | 'fruits' | 'enemies';
  collected: number;
  total: number;
}

/**
 * Collectible-type summary for the personality/"About Me" page's right
 * column (roadmap step 15, per user request) — framed around the game's
 * actual sprite types (coin.png/fruit.png/slime, FR-009) rather than CV
 * section names, since this reads as a HUD-style overview rather than
 * another bookmark page. `skills` ("Coins") and `languages` ("Fruits") are
 * each one collectible type; `certificates` + `projects` combine into one
 * "Enemies" row (roadmap step 18, added per live user feedback) since both
 * are defeated the same way (stomping a slime) regardless of color — same
 * combined-count convention the HUD's own enemy-defeated counter uses (see
 * PlatformerPage.tsx). Blocks (step 20) get their own row once that step
 * actually places them. A row is omitted entirely when its section(s) have
 * nothing to collect (`total` would be 0), matching how `nonEmptySections`
 * hides empty sections' bookmarks.
 */
export function collectiblesSummary(cv: CVData, facts: CollectedFact[]): CollectibleSummaryRow[] {
  const rows: CollectibleSummaryRow[] = [];

  const skillsTotal = sectionTotal(cv, 'skills');
  if (skillsTotal > 0) {
    rows.push({
      labelKey: 'coins',
      collected: facts.filter((f) => f.sectionId === 'skills').length,
      total: skillsTotal,
    });
  }

  const languagesTotal = sectionTotal(cv, 'languages');
  if (languagesTotal > 0) {
    rows.push({
      labelKey: 'fruits',
      collected: facts.filter((f) => f.sectionId === 'languages').length,
      total: languagesTotal,
    });
  }

  const enemiesTotal = sectionTotal(cv, 'certificates') + sectionTotal(cv, 'projects');
  if (enemiesTotal > 0) {
    rows.push({
      labelKey: 'enemies',
      collected: facts.filter((f) => f.sourceType === 'enemy').length,
      total: enemiesTotal,
    });
  }

  return rows;
}
