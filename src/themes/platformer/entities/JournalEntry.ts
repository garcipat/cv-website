import { isSkillCategoryFact } from '../types';
import type { CollectedFact, SectionId } from '../types';

export interface JournalEntryDisplay {
  icon: string;
  title: string;
  subtitle?: string;
}

/** One emoji per section, per FR-017 ("🏢 for experience, 🎓 for
 * education, etc."). Used as the fallback icon here — `languages` entries
 * use the fact's own flag emoji instead (see `formatJournalEntry` below) —
 * and reused by `BookmarkTabs` as the tab icon (a rotated text label on a
 * narrow tab was hard to read, per user feedback). */
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
      // Roadmap step 12: a whole skill category is collected as one unit
      // (too many individual CV skills to place one collectible each), so
      // `fact.data` here is a `SkillCategoryFact` rather than a plain
      // `Skill` — display the category name with its skills listed below.
      if (isSkillCategoryFact(fact.data)) {
        return {
          icon,
          title: fact.data.category,
          subtitle: fact.data.skills.map((skill) => skill.name).join(', '),
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
    default:
      return { icon, title: fact.sectionLabel };
  }
}
