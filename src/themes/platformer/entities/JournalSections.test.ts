import {
  JOURNAL_SECTION_ORDER,
  SECTION_BOOKMARK_COLOR,
  nonEmptySections,
  sectionLabel,
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
  it('always-excludesPersonalityAndActivities', () => {
    expect(JOURNAL_SECTION_ORDER).not.toContain('personality');
    expect(JOURNAL_SECTION_ORDER).not.toContain('activities');
  });

  it('always-containsExactlyTheSevenCollectibleBackedSections', () => {
    expect([...JOURNAL_SECTION_ORDER].sort()).toEqual(
      ['certificates', 'courses', 'education', 'experience', 'languages', 'projects', 'skills'].sort(),
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
  it('allSectionsEmpty-returnsEmptyArray', () => {
    expect(nonEmptySections(emptyCV)).toEqual([]);
  });

  it('onlySkillsNonEmpty-returnsOnlySkills', () => {
    const cv: CVData = { ...emptyCV, skills: [{ category: 'Frontend', skills: [{ name: 'React', level: 80 }] }] };
    expect(nonEmptySections(cv)).toEqual(['skills']);
  });

  it('languagesUndefined-treatedAsEmpty', () => {
    const cv: CVData = { ...emptyCV, languages: undefined };
    expect(nonEmptySections(cv)).toEqual([]);
  });

  it('multipleSectionsNonEmpty-returnsThemInJournalSectionOrder', () => {
    const cv: CVData = {
      ...emptyCV,
      projects: [{ name: 'A Project', description: 'desc' }],
      experience: [{ company: 'X', role: 'Y', startDate: '2020-01', highlights: [] }],
    };
    // experience comes before projects in JOURNAL_SECTION_ORDER
    expect(nonEmptySections(cv)).toEqual(['experience', 'projects']);
  });
});

describe('sectionLabel', () => {
  it('called-withKnownSection-returnsTranslatedLabel', () => {
    // Relies on the test environment's default locale being 'en' (jsdom's
    // default navigator.language), matching src/i18n/locales/en.json.
    expect(sectionLabel('experience')).toBe('Experience');
    expect(sectionLabel('languages')).toBe('Languages');
  });
});
