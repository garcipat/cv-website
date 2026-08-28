import { collectiblesSummary } from './CollectiblesSummary';
import type { CVData } from '@/types/cv';
import type { CollectedFact } from '../types';

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

describe('collectiblesSummary', () => {
  it('cvWithSkillsAndLanguages-noneCollected-returnsBothRowsWithZeroCollected', () => {
    const cv: CVData = {
      ...emptyCV,
      skills: [{ category: 'Frontend', skills: [{ name: 'React', level: 80 }] }],
      languages: [{ name: 'English', level: 100 }],
    };

    const rows = collectiblesSummary(cv, []);

    expect(rows).toEqual([
      { labelKey: 'coins', collected: 0, total: 1 },
      { labelKey: 'fruits', collected: 0, total: 1 },
    ]);
  });

  it('cvWithSkillsAndLanguages-someCollected-countsMatchingFactsPerType', () => {
    const cv: CVData = {
      ...emptyCV,
      skills: [
        { category: 'Frontend', skills: [{ name: 'React', level: 80 }] },
        { category: 'Backend', skills: [{ name: 'Go', level: 70 }] },
      ],
      languages: [{ name: 'English', level: 100 }],
    };
    const facts: CollectedFact[] = [
      {
        id: 'coin-frontend',
        sectionId: 'skills',
        sectionLabel: 'Skills',
        data: { category: 'Frontend', skills: [{ name: 'React', level: 80 }] },
        sourceType: 'coin',
      },
      {
        id: 'fruit-english',
        sectionId: 'languages',
        sectionLabel: 'Languages',
        data: { name: 'English', level: 100 },
        sourceType: 'coin',
      },
    ];

    const rows = collectiblesSummary(cv, facts);

    expect(rows).toEqual([
      { labelKey: 'coins', collected: 1, total: 2 },
      { labelKey: 'fruits', collected: 1, total: 1 },
    ]);
  });

  it('cvWithNoSkillsOrLanguages-returnsNoRows', () => {
    expect(collectiblesSummary(emptyCV, [])).toEqual([]);
  });

  it('cvWithOnlySkills-omitsFruitsRow', () => {
    const cv: CVData = {
      ...emptyCV,
      skills: [{ category: 'Frontend', skills: [{ name: 'React', level: 80 }] }],
    };

    expect(collectiblesSummary(cv, [])).toEqual([
      { labelKey: 'coins', collected: 0, total: 1 },
    ]);
  });
});
