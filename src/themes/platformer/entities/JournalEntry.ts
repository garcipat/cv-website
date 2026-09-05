import { isSkillCategoryFact } from '../types';
import type { CollectedFact, SectionId } from '../types';

export interface JournalEntryDisplay {
  icon: string;
  title: string;
  subtitle?: string;
  /**
   * A list of name/rating rows (skill categories only) — rendered as one
   * flex row per skill with the star rating right-aligned, instead of
   * `subtitle`'s plain text. Kept separate from `subtitle` because plain
   * text can't right-align a rating against variable-length names; the
   * component renders each row as its own flex container.
   */
  ratedItems?: { name: string; stars: string }[];
}

/** One emoji per section, per FR-017 ("🏢 for experience, 🎓 for
 * education, etc."). Used as the fallback icon here — `languages` entries
 * use the fact's own flag emoji instead (see `formatJournalEntry` below) —
 * and reused by `BookmarkTabs` as the tab icon, since a rotated text label
 * on a narrow tab is hard to read. */
export const SECTION_ICON: Record<SectionId, string> = {
  personality: '👤',
  experience: '🏢',
  skills: '💡',
  courses: '📘',
  education: '🎓',
  certificates: '📜',
  languages: '🌐',
  projects: '🚀',
  activities: '🧭',
};

/** 0-100 integer level → a 5-star rating string, e.g. level 80 → "★★★★☆"
 * (FR-017: "TypeScript ★★★★☆"). Rounds to the nearest star rather than
 * flooring, so 80 (exactly 4 stars) doesn't read as weaker than intended. */
function starRating(level: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(level / 20)));
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

/**
 * Formats a collected fact for the Simple List entry style (FR-017): an
 * icon, a one-line title, and an optional subtitle (dates/institution/
 * provider — whatever the section's second-most-important field is).
 * Falls back to the fact's `sectionLabel` for any section shape not
 * explicitly handled below (defensive — every section FR-009 maps to a
 * collectible is covered; this only matters for malformed/future data).
 */
export function formatJournalEntry(fact: CollectedFact): JournalEntryDisplay {
  const icon = SECTION_ICON[fact.sectionId];
  const data = fact.data as unknown as Record<string, unknown>;

  switch (fact.sectionId) {
    case 'skills':
      // A whole skill category is collected as one unit (too many individual
      // CV skills to place one collectible each), so `fact.data` here is a
      // `SkillCategoryFact` rather than a plain `Skill` — display the
      // category name with its skills listed below.
      if (isSkillCategoryFact(fact.data)) {
        return {
          icon,
          title: fact.data.category,
          // One skill per row, each with its own right-aligned star rating
          // (`ratedItems`, not `subtitle` — plain joined text leaves the
          // stars ragged against variable-length names).
          ratedItems: fact.data.skills.map((skill) => ({
            name: skill.name,
            stars: starRating(skill.level),
          })),
        };
      }
      return { icon, title: `${data.name} ${starRating(data.level as number)}` };
    case 'languages':
      return {
        icon: typeof data.flag === 'string' ? data.flag : icon,
        title: `${data.name} ${starRating(data.level as number)}`,
      };
    case 'experience':
      return {
        icon,
        title: `${data.company} — ${data.role}`,
        subtitle: `${data.startDate}–${data.endDate ?? 'Present'}`,
      };
    case 'education':
      return { icon, title: `${data.degree}`, subtitle: `${data.institution}` };
    case 'courses':
      return { icon, title: `${data.title}`, subtitle: `${data.provider}` };
    case 'certificates':
      return { icon, title: `${data.name}`, subtitle: `${data.issuer}` };
    case 'projects':
      return { icon, title: `${data.name}` };
    case 'activities':
      return { icon, title: `${data.name}`, subtitle: `${data.startDate}–${data.endDate}` };
    default:
      return { icon, title: fact.sectionLabel };
  }
}

/**
 * Splits a list into two column-order halves — left gets the first half
 * (the extra item on an odd length), right the rest.
 *
 * Used instead of CSS multi-column layout (`columns-2` + `column-fill:
 * auto`) for a skill category's `ratedItems` list: that CSS approach needs
 * a fixed container height to fill the left column first, but a category
 * long enough to overflow both columns at that height silently drops the
 * remainder — its "ink overflow" doesn't count toward an ancestor's
 * scrollable area (a well-known CSS multicol limitation), so those rows
 * are never shown and never reachable by scrolling either. Two real JS
 * arrays rendered as ordinary block content can't lose an item regardless
 * of length, and their combined height correctly drives an ancestor
 * scrollbar when there are enough of them.
 */
export function splitIntoTwoColumns<T>(items: readonly T[]): [T[], T[]] {
  const mid = Math.ceil(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
}
