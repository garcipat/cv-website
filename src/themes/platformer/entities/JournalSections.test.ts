import {
  JOURNAL_SECTION_ORDER,
  SECTION_BOOKMARK_COLOR,
  nonEmptySections,
  sectionLabel,
  sectionTotal,
  isPaginatedSection,
  buildJournalPages,
} from './JournalSections';
import type { CVData } from '@/types/cv';
import type { SectionId, CollectedFact } from '../types';

const emptyCV: CVData = {
  personality: { name: 'Test', tagline: 'Test', summary: 'Test' },
  experience: [],
  skills: [],
  courses: [],
  education: [],
  certificates: [],
  languages: [],
  projects: [],
};

describe('JOURNAL_SECTION_ORDER', () => {
  it('always-excludesActivities', () => {
    expect(JOURNAL_SECTION_ORDER).not.toContain('activities');
  });

  it('always-containsExactlyTheEightBookmarkedSections', () => {
    expect([...JOURNAL_SECTION_ORDER].sort()).toEqual(
      [
        'certificates',
        'courses',
        'education',
        'experience',
        'languages',
        'personality',
        'projects',
        'skills',
      ].sort(),
    );
  });
});

describe('SECTION_BOOKMARK_COLOR', () => {
  it('always-assignsAColorToEveryJournalSection', () => {
    for (const section of JOURNAL_SECTION_ORDER) {
      expect(SECTION_BOOKMARK_COLOR[section]).toBeTruthy();
    }
  });
});

describe('nonEmptySections', () => {
  it('allOtherSectionsEmpty-returnsOnlyPersonality', () => {
    // personality is always non-empty — CVData.personality is required.
    expect(nonEmptySections(emptyCV)).toEqual(['personality']);
  });

  it('onlySkillsNonEmpty-returnsPersonalityAndSkills', () => {
    const cv: CVData = { ...emptyCV, skills: [{ category: 'Frontend', skills: [{ name: 'React', level: 80 }] }] };
    expect(nonEmptySections(cv)).toEqual(['personality', 'skills']);
  });

  it('languagesUndefined-treatedAsEmpty', () => {
    const cv: CVData = { ...emptyCV, languages: undefined };
    expect(nonEmptySections(cv)).toEqual(['personality']);
  });

  it('multipleSectionsNonEmpty-returnsThemInJournalSectionOrder', () => {
    const cv: CVData = {
      ...emptyCV,
      projects: [{ name: 'A Project', description: 'desc' }],
      experience: [{ company: 'X', role: 'Y', startDate: '2020-01', highlights: [] }],
    };
    // personality, then experience, then projects — JOURNAL_SECTION_ORDER's order
    expect(nonEmptySections(cv)).toEqual(['personality', 'experience', 'projects']);
  });
});

describe('sectionLabel', () => {
  it('called-withKnownSection-returnsTranslatedLabel', () => {
    // Relies on the test environment's default locale being 'en' (jsdom's
    // default navigator.language), matching src/i18n/locales/en.json.
    expect(sectionLabel('experience')).toBe('Experience');
    expect(sectionLabel('languages')).toBe('Languages');
    expect(sectionLabel('personality')).toBe('About Me');
  });
});

describe('sectionTotal', () => {
  it('sectionWithItems-returnsItemCount', () => {
    const cv: CVData = {
      ...emptyCV,
      experience: [
        { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
        { company: 'Z', role: 'W', startDate: '2021-01', highlights: [] },
      ],
    };
    expect(sectionTotal(cv, 'experience')).toBe(2);
  });

  it('emptySection-returnsZero', () => {
    expect(sectionTotal(emptyCV, 'projects')).toBe(0);
  });

  it('languagesUndefined-returnsZero', () => {
    const cv: CVData = { ...emptyCV, languages: undefined };
    expect(sectionTotal(cv, 'languages')).toBe(0);
  });

  it('skillsSection-countsCategoriesNotIndividualSkills', () => {
    // One collectible is placed per skill CATEGORY (roadmap step 12), not
    // per individual skill — the total must match that, not cv.skills'
    // nested skill counts.
    const cv: CVData = {
      ...emptyCV,
      skills: [
        { category: 'Frontend', skills: [{ name: 'React', level: 80 }, { name: 'Vue', level: 60 }] },
        { category: 'Backend', skills: [{ name: 'Go', level: 70 }] },
      ],
    };
    expect(sectionTotal(cv, 'skills')).toBe(2);
  });
});

describe('isPaginatedSection', () => {
  it('longEntrySectionsAndSkills-returnTrue', () => {
    expect(isPaginatedSection('experience')).toBe(true);
    expect(isPaginatedSection('projects')).toBe(true);
    expect(isPaginatedSection('education')).toBe(true);
    expect(isPaginatedSection('courses')).toBe(true);
    expect(isPaginatedSection('certificates')).toBe(true);
    expect(isPaginatedSection('skills')).toBe(true);
  });

  it('languages-returnsFalse', () => {
    // A language entry is one short "Name ★★★★☆" line — all of them fit
    // together on one page, unlike skill categories (whose skill lists can
    // run long) or the other long-entry sections.
    expect(isPaginatedSection('languages')).toBe(false);
  });
});

describe('buildJournalPages', () => {
  const fact = (sectionId: SectionId, id: string): CollectedFact => ({
    id,
    sectionId,
    sectionLabel: sectionId,
    data: { category: id, skills: [] },
    sourceType: 'coin',
  });

  it('personalitySection-contributesOnePersonalityPage', () => {
    expect(buildJournalPages(['personality'], [])).toEqual([
      { section: 'personality', content: { kind: 'personality' } },
    ]);
  });

  it('ungroupedNonPersonalitySection-contributesOneGroupedListPageWithAllItsFacts', () => {
    const facts = [fact('languages', 'a'), fact('languages', 'b')];
    expect(buildJournalPages(['languages'], facts)).toEqual([
      { section: 'languages', content: { kind: 'groupedList', facts } },
    ]);
  });

  it('paginatedSectionWithNoCollectedFacts-contributesOneEmptyStatePage', () => {
    // A bookmark for a section with nothing collected yet still needs a
    // page to land on (the empty-state placeholder message).
    expect(buildJournalPages(['experience'], [])).toEqual([
      { section: 'experience', content: { kind: 'emptyState' } },
    ]);
  });

  it('paginatedSectionWithMultipleCollectedFacts-contributesOneFactPagePerFact', () => {
    const facts = [fact('skills', 'a'), fact('skills', 'b'), fact('skills', 'c')];
    expect(buildJournalPages(['skills'], facts)).toEqual([
      { section: 'skills', content: { kind: 'fact', fact: facts[0] } },
      { section: 'skills', content: { kind: 'fact', fact: facts[1] } },
      { section: 'skills', content: { kind: 'fact', fact: facts[2] } },
    ]);
  });

  it('paginatedSectionFacts-onlyCountsFactsBelongingToThatSection', () => {
    const facts = [fact('skills', 'a'), fact('experience', 'b'), fact('skills', 'c')];
    expect(buildJournalPages(['skills'], facts)).toHaveLength(2);
  });

  it('multipleSections-flattensInGivenOrderWithEachSectionsPagesTogether', () => {
    const facts = [fact('experience', 'e1'), fact('experience', 'e2')];
    const pages = buildJournalPages(['personality', 'experience', 'languages'], facts);
    expect(pages).toEqual([
      { section: 'personality', content: { kind: 'personality' } },
      { section: 'experience', content: { kind: 'fact', fact: facts[0] } },
      { section: 'experience', content: { kind: 'fact', fact: facts[1] } },
      { section: 'languages', content: { kind: 'groupedList', facts: [] } },
    ]);
  });

  it('emptySectionsList-returnsEmptyArray', () => {
    expect(buildJournalPages([], [])).toEqual([]);
  });
});
