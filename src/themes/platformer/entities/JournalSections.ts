import type { CVData } from '@/types/cv';
import { currentUI } from '@/state/locale';
import type { SectionId } from '../types';

/**
 * The CV sections that can back a journal bookmark today. Seven of these
 * (experience/education/courses/certificates/skills/languages/projects) are
 * per FR-009's collectible mapping. `personality` ("About Me") is a
 * provisional addition, pulled forward per user request ahead of step 22's
 * flagpole ending screen (which is FR-013's originally-specified route for
 * personality content) — shown directly from CV data rather than
 * `collectedFacts`, since it has no collectible source yet. `activities`
 * remains excluded: it isn't mapped to any collectible type in FR-009.
 * Order here is the order bookmarks are distributed (per
 * `journal-mockup.html`, adapted from a side layout to a top layout per
 * user feedback — see `BookmarkTabs.tsx`).
 */
export const JOURNAL_SECTION_ORDER = [
  'personality',
  'experience',
  'education',
  'courses',
  'certificates',
  'skills',
  'languages',
  'projects',
] as const satisfies readonly SectionId[];

type JournalSection = (typeof JOURNAL_SECTION_ORDER)[number];

export type BookmarkColor = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'yellow';

/**
 * Six sprite colors (`public/sprites/bookmark_{color}.png`) for eight
 * sections — `courses`/`certificates` share `red`, `languages`/`personality`
 * share `purple`. Per user request, duplicate colors are acceptable for now
 * ("we don't know if we keep them or need to switch anyway") until more
 * distinct bookmark art exists.
 */
export const SECTION_BOOKMARK_COLOR: Record<JournalSection, BookmarkColor> = {
  personality: 'purple',
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
 * progress). `personality` is always non-empty: `CVData.personality` is a
 * required (non-optional) object, always present. Returned in
 * `JOURNAL_SECTION_ORDER`'s order.
 */
export function nonEmptySections(cv: CVData): SectionId[] {
  const isNonEmpty: Record<JournalSection, boolean> = {
    personality: true,
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
