import type { CVData } from '@/types/cv';
import { currentUI } from '@/state/locale';
import type { SectionId, CollectedFact } from '../types';

/**
 * The CV sections that can back a journal bookmark today. Seven of these
 * (experience/education/courses/certificates/skills/languages/projects) are
 * per FR-009's collectible mapping. `personality` ("About Me") is shown
 * directly from CV data rather than `collectedFacts`, since it has no
 * collectible source. `activities` remains excluded: it isn't mapped to any
 * collectible type in FR-009. Order here is the order bookmarks are
 * distributed (per `journal-mockup.html`, laid out as a top layout — see
 * `BookmarkTabs.tsx`).
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
 * share `purple`. Duplicate colors are acceptable until more distinct
 * bookmark art exists.
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

/**
 * Total possible facts for a section (the "Skills 3/5" counter, FR-017b) —
 * the section's raw CVData item count. This is a 1:1
 * count for every section except `skills`, where one collectible is placed
 * per skill *category* (not per individual skill, see CollectibleMapper.ts)
 * — `cv.skills.length` already counts categories, so no special-casing is
 * needed. `languages` defaults to 0 (matches `nonEmptySections`' handling of
 * an undefined array). Not meaningful for `personality` (no counter, per
 * FR-017b's exception) — callers exclude it themselves.
 */
export function sectionTotal(cv: CVData, section: SectionId): number {
  if (section === 'languages') return cv.languages?.length ?? 0;
  if (section === 'personality' || section === 'activities') return 0;
  return cv[section].length;
}

/**
 * Sections that paginate one entry per page: `experience`/`projects`/
 * `education`/`courses`/`certificates` because their entries are long and
 * may need the full page spread each; `skills` too, because a category's
 * skill list (with star ratings, see `formatJournalEntry`) reads better one
 * category per page than all categories crammed into one scrolling list.
 * `languages` is the one exception left ungrouped-by-page — a language
 * entry is a single short "Name ★★★★☆" line, so all of them fit together
 * on one page without needing page controls.
 */
const PAGINATED_SECTIONS = new Set<SectionId>([
  'experience',
  'projects',
  'education',
  'courses',
  'certificates',
  'skills',
]);

export function isPaginatedSection(section: SectionId): boolean {
  return PAGINATED_SECTIONS.has(section);
}

/**
 * What a journal page actually shows — a discriminated union so a
 * consumer (`Journal.tsx`) switches on `content.kind` instead of
 * re-deriving "is this the personality page / an empty section / which
 * fact" from `section`+some index on every render. Each variant carries
 * exactly the data its rendering needs and nothing else.
 */
export type JournalPageContent =
  | { kind: 'personality' }
  /** Every collected fact for an ungrouped section (today, only
   *  `languages`) shown together on one page — not paginated. */
  | { kind: 'groupedList'; facts: CollectedFact[] }
  /** One collected fact for a paginated section (`isPaginatedSection`). */
  | { kind: 'fact'; fact: CollectedFact }
  /** A paginated section with nothing collected yet — still gets a page
   *  (the empty-state placeholder) so its bookmark has somewhere to land. */
  | { kind: 'emptyState' };

/** One physical page of the journal book. */
export interface JournalPage {
  section: SectionId;
  content: JournalPageContent;
}

/**
 * Flattens a list of sections into the sequence of physical pages the book
 * actually contains: sections insert pages with their content — Skills
 * inserts multiple pages, one per category found, Experience one page per
 * experience entry, and Languages just one page with all of them.
 * `sections` is expected to already be filtered/ordered
 * (typically `nonEmptySections(cv)` in `JOURNAL_SECTION_ORDER`) — this
 * function only flattens, it doesn't re-derive that list.
 */
export function buildJournalPages(sections: SectionId[], facts: CollectedFact[]): JournalPage[] {
  const pages: JournalPage[] = [];
  for (const section of sections) {
    if (section === 'personality') {
      pages.push({ section, content: { kind: 'personality' } });
      continue;
    }
    const sectionFacts = facts.filter((fact) => fact.sectionId === section);
    if (!isPaginatedSection(section)) {
      pages.push({ section, content: { kind: 'groupedList', facts: sectionFacts } });
      continue;
    }
    if (sectionFacts.length === 0) {
      pages.push({ section, content: { kind: 'emptyState' } });
      continue;
    }
    for (const fact of sectionFacts) {
      pages.push({ section, content: { kind: 'fact', fact } });
    }
  }
  return pages;
}

