import {
  JOURNAL_SECTION_ORDER,
  SECTION_BOOKMARK_COLOR,
  nonEmptySections,
  sectionLabel,
  sectionTotal,
  isPaginatedSection,
} from './JournalSections';
import type { CVData } from '@/types/cv';

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
