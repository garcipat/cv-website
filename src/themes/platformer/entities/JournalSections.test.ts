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
