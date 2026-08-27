import type { CVData } from '@/types/cv';
import { currentUI } from '@/state/locale';
import type { SectionId } from '../types';

/**
 * The CV sections that can back a journal bookmark today, per FR-009's
 * collectible mapping (Coins → Skills/Languages, Blocks → Experience/
 * Education/Courses, Enemies → Certificates/Projects). `personality` and
 * `activities` are deliberately excluded: Personality has no collectibles
 * until step 22's flagpole ending screen adds it (FR-013), and `activities`
 * isn't mapped to any collectible type in FR-009. Order here is the order
 * bookmarks are distributed top-to-bottom (per `journal-mockup.html`).
 */
export const JOURNAL_SECTION_ORDER: SectionId[] = [
  'experience',
  'education',
  'courses',
  'certificates',
  'skills',
  'languages',
  'projects',
];

export type BookmarkColor = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow';

/**
 * Six sprite colors (`public/sprites/bookmark_{color}.png`) for seven
 * sections — `courses` and `certificates` share `red` (both
 * "credentials/learning" in spirit), the closest pairing available. See
 * this plan's "six bookmark colors for seven sections" design note if this
 * needs revisiting.
 */
export const SECTION_BOOKMARK_COLOR: Record<(typeof JOURNAL_SECTION_ORDER)[number], BookmarkColor> = {
  experience: 'orange',
  education: 'green',
  courses: 'red',
  certificates: 'red',
  skills: 'yellow',
  languages: 'purple',
  projects: 'blue',
};

/**
 * Which journal sections have at least one CV item — and therefore get a
 * bookmark — regardless of whether anything in them has been *collected*
 * yet (FR-013: "Empty CV sections produce no collectibles and hide their
 * journal bookmark", evaluated against the CV data itself, not session
 * progress). Returned in `JOURNAL_SECTION_ORDER`'s order.
 */
export function nonEmptySections(cv: CVData): SectionId[] {
  const isNonEmpty: Record<(typeof JOURNAL_SECTION_ORDER)[number], boolean> = {
    experience: cv.experience.length > 0,
    education: cv.education.length > 0,
    courses: cv.courses.length > 0,
    certificates: cv.certificates.length > 0,
    skills: cv.skills.length > 0,
    languages: (cv.languages?.length ?? 0) > 0,
    projects: cv.projects.length > 0,
  };
  return JOURNAL_SECTION_ORDER.filter((section) => isNonEmpty[section]);
}

/**
 * Locale-aware display label for a journal section, e.g. `'skills'` →
 * `'Skills'` (en) / `'Kenntnisse'` (de). Shared by `BookmarkTabs` (tab
 * labels) and `Journal` (active section's page header) so the two never
 * drift out of sync with each other.
 */
export function sectionLabel(section: SectionId): string {
  return currentUI.value.sections[section as keyof typeof currentUI.value.sections] ?? section;
}
