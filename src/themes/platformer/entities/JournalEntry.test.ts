import { formatJournalEntry } from './JournalEntry';
import type { CollectedFact } from '../types';

const fact = (overrides: Partial<CollectedFact>): CollectedFact => ({
  id: 'x',
  sectionId: 'skills',
  sectionLabel: 'Skills',
  data: {},
  sourceType: 'coin',
  ...overrides,
});

describe('formatJournalEntry', () => {
  it('skillFact-fullLevel-titleIncludesNameAndFiveFilledStars', () => {
    const result = formatJournalEntry(
      fact({ sectionId: 'skills', data: { name: 'TypeScript', level: 100 } }),
    );
    expect(result.title).toBe('TypeScript ★★★★★');
  });

  it('skillFact-zeroLevel-titleIncludesNameAndZeroFilledStars', () => {
    const result = formatJournalEntry(
      fact({ sectionId: 'skills', data: { name: 'COBOL', level: 0 } }),
    );
    expect(result.title).toBe('COBOL ☆☆☆☆☆');
  });

  it('skillFact-midLevel-roundsToNearestStar', () => {
    // 80/20 = 4 exactly
    const result = formatJournalEntry(
      fact({ sectionId: 'skills', data: { name: 'React', level: 80 } }),
    );
    expect(result.title).toBe('React ★★★★☆');
  });

  it('languageFact-anyLevel-titleIncludesNameAndStarsIconIsFlag', () => {
    const result = formatJournalEntry(
      fact({
        sectionId: 'languages',
        data: { name: 'German', flag: '🇩🇪', level: 100 },
      }),
    );
    expect(result.title).toBe('German ★★★★★');
    expect(result.icon).toBe('🇩🇪');
  });

  it('experienceFact-anyData-titleIsCompanyAndRoleSubtitleIsDateRange', () => {
    const result = formatJournalEntry(
      fact({
        sectionId: 'experience',
        data: {
          company: 'Acme Corp',
          role: 'Senior Engineer',
          startDate: '2020-01',
          endDate: '2023-06',
          highlights: [],
        },
      }),
    );
    expect(result.title).toBe('Acme Corp — Senior Engineer');
    expect(result.subtitle).toBe('2020-01–2023-06');
    expect(result.icon).toBe('🏢');
  });

  it('experienceFact-noEndDate-subtitleSaysPresent', () => {
    const result = formatJournalEntry(
      fact({
        sectionId: 'experience',
        data: { company: 'Acme Corp', role: 'Senior Engineer', startDate: '2020-01', highlights: [] },
      }),
    );
    expect(result.subtitle).toBe('2020-01–Present');
  });

  it('educationFact-anyData-titleIsDegreeSubtitleIsInstitution', () => {
    const result = formatJournalEntry(
      fact({
        sectionId: 'education',
        data: { degree: 'B.Sc. Computer Science', institution: 'TU Berlin', startDate: '2016-10' },
      }),
    );
    expect(result.title).toBe('B.Sc. Computer Science');
    expect(result.subtitle).toBe('TU Berlin');
    expect(result.icon).toBe('🎓');
  });

  it('courseFact-anyData-titleIsCourseTitleSubtitleIsProvider', () => {
    const result = formatJournalEntry(
      fact({
        sectionId: 'courses',
        data: { title: 'Advanced React Patterns', provider: 'Frontend Masters', date: '2024-06', category: 'Web Development' },
      }),
    );
    expect(result.title).toBe('Advanced React Patterns');
    expect(result.subtitle).toBe('Frontend Masters');
    expect(result.icon).toBe('📘');
  });

  it('certificateFact-anyData-titleIsNameSubtitleIsIssuer', () => {
    const result = formatJournalEntry(
      fact({
        sectionId: 'certificates',
        data: { name: 'AWS Solutions Architect Associate', issuer: 'Amazon Web Services', date: '2023-06' },
      }),
    );
    expect(result.title).toBe('AWS Solutions Architect Associate');
    expect(result.subtitle).toBe('Amazon Web Services');
    expect(result.icon).toBe('📜');
  });

  it('projectFact-anyData-titleIsNameNoSubtitle', () => {
    const result = formatJournalEntry(
      fact({ sectionId: 'projects', data: { name: 'Open Source Task Runner', description: 'A thing' } }),
    );
    expect(result.title).toBe('Open Source Task Runner');
    expect(result.subtitle).toBeUndefined();
    expect(result.icon).toBe('🚀');
  });

  it('unrecognizedSectionShapeMissingFields-fallsBackToSectionLabel', () => {
    const result = formatJournalEntry(
      fact({ sectionId: 'activities', sectionLabel: 'Activities', data: {} }),
    );
    expect(result.title).toBe('Activities');
  });
});
