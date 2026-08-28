import { sectionTotal } from './JournalSections';
import type { CVData } from '@/types/cv';
import type { CollectedFact } from '../types';

export interface CollectibleSummaryRow {
  icon: string;
  labelKey: 'coins' | 'fruits';
  collected: number;
  total: number;
}

/**
 * Collectible-type summary for the personality/"About Me" page's right
 * column (roadmap step 15, per user request) — framed around the game's
 * actual sprite types (coin.png/fruit.png, FR-009) rather than CV section
 * names, since this reads as a HUD-style overview rather than another
 * bookmark page. Only `skills` ("Coins") and `languages` ("Fruits") exist as
 * collectible types today; enemies/blocks (steps 16-20) get their own rows
 * once those steps actually place them — no placeholder rows for them here.
 * A row is omitted entirely when its section has nothing to collect
 * (`total` would be 0), matching how `nonEmptySections` hides empty
 * sections' bookmarks.
 */
export function collectiblesSummary(cv: CVData, facts: CollectedFact[]): CollectibleSummaryRow[] {
  const rows: CollectibleSummaryRow[] = [];

  const skillsTotal = sectionTotal(cv, 'skills');
  if (skillsTotal > 0) {
    rows.push({
      icon: '🪙',
      labelKey: 'coins',
      collected: facts.filter((f) => f.sectionId === 'skills').length,
      total: skillsTotal,
    });
  }

  const languagesTotal = sectionTotal(cv, 'languages');
  if (languagesTotal > 0) {
    rows.push({
      icon: '🍎',
      labelKey: 'fruits',
      collected: facts.filter((f) => f.sectionId === 'languages').length,
      total: languagesTotal,
    });
  }

  return rows;
}
