import { formatJournalEntry, splitIntoTwoColumns } from './JournalEntry';
import type { CollectedFact } from '../types';

const fact = (overrides: Partial<CollectedFact>): CollectedFact => ({
  id: 'x',
  sectionId: 'skills',
  sectionLabel: 'Skills',
  data: { name: 'Test', level: 0 },
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

  it('skillCategoryFact-anyLevel-ratedItemsListsEachSkillWithItsOwnStarRating', () => {
    const result = formatJournalEntry(
      fact({
        sectionId: 'skills',
        data: {
          category: 'Backend',
          skills: [
            { name: 'C#', level: 90 },
            { name: '.NET', level: 60 },
          ],
        },
      }),
    );
    expect(result.title).toBe('Backend');
    expect(result.subtitle).toBeUndefined();
    expect(result.ratedItems).toEqual([
      { name: 'C#', stars: '★★★★★' },
      { name: '.NET', stars: '★★★☆☆' },
    ]);
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

  it('activitiesFact-formats-nameAndDateRange', () => {
    const fact_: CollectedFact = {
      id: 'block-activity-volunteering',
      sectionId: 'activities',
      sectionLabel: 'Activities',
      data: { name: 'Volunteering', startDate: '2019-01', endDate: '2019-06' },
      sourceType: 'block',
    };
    expect(formatJournalEntry(fact_)).toEqual({
      icon: '🧭',
      title: 'Volunteering',
      subtitle: '2019-01–2019-06',
    });
  });

  it('unhandledSectionId-fallsBackToSectionLabel', () => {
    // 'personality' is a valid SectionId but has no case in formatJournalEntry's switch,
    // so it falls through to the default case which returns just the sectionLabel
    const result = formatJournalEntry(
      fact({
        sectionId: 'personality',
        sectionLabel: 'Profile',
        data: { name: 'Something', tagline: 'Test', summary: 'Test' },
      }),
    );
    expect(result.title).toBe('Profile');
  });
});

describe('splitIntoTwoColumns', () => {
  it('evenLength-splitsExactlyInHalf', () => {
    expect(splitIntoTwoColumns([1, 2, 3, 4])).toEqual([[1, 2], [3, 4]]);
  });

  it('oddLength-leftColumnGetsTheExtraOne', () => {
    expect(splitIntoTwoColumns([1, 2, 3])).toEqual([[1, 2], [3]]);
  });

  it('empty-returnsTwoEmptyColumns', () => {
    expect(splitIntoTwoColumns([])).toEqual([[], []]);
  });

  it('singleItem-allInLeftColumn', () => {
    expect(splitIntoTwoColumns(['only'])).toEqual([['only'], []]);
  });

  it('everyItemStillAccountedFor-regardlessOfLength', () => {
    // The bug this exists to fix: CSS multi-column layout with a fixed
    // container height and column-fill: auto silently drops rows past the
    // container's height instead of scrolling to them (a long skill
    // category's ink overflow doesn't count toward the ancestor's
    // scrollable area). A manual split into two real arrays can never lose
    // an item, no matter how long the list is.
    const items = Array.from({ length: 47 }, (_, i) => i);
    const [left, right] = splitIntoTwoColumns(items);
    expect([...left, ...right]).toEqual(items);
  });
});
