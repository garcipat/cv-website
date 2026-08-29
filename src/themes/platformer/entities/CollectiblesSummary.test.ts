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
      languages: [{ name: 'English', flag: '🇬🇧', level: 100 }],
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
      languages: [{ name: 'English', flag: '🇬🇧', level: 100 }],
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

  it('cvWithCertificatesAndProjects-noneDefeated-returnsCombinedEnemiesRowWithZeroCollected', () => {
    const cv: CVData = {
      ...emptyCV,
      certificates: [{ name: 'AWS Solutions Architect', issuer: 'AWS', date: '2023-06' }],
      projects: [{ name: 'Interactive Resume', description: 'This site.' }],
    };

    expect(collectiblesSummary(cv, [])).toEqual([{ labelKey: 'enemies', collected: 0, total: 2 }]);
  });

  it('cvWithCertificatesAndProjects-someDefeated-countsBothSectionsTogetherBySourceType', () => {
    const cv: CVData = {
      ...emptyCV,
      certificates: [
        { name: 'AWS Solutions Architect', issuer: 'AWS', date: '2023-06' },
        { name: 'Scrum Master', issuer: 'Scrum.org', date: '2021-01' },
      ],
      projects: [{ name: 'Interactive Resume', description: 'This site.' }],
    };
    const facts: CollectedFact[] = [
      {
        id: 'enemy-cert-aws',
        sectionId: 'certificates',
        sectionLabel: 'Certificates',
        data: { name: 'AWS Solutions Architect', issuer: 'AWS', date: '2023-06' },
        sourceType: 'enemy',
      },
      // A coin-sourced fact must never count toward the enemies row, even
      // if it happens to share a sectionId enemies can also produce facts
      // for — the row is keyed on sourceType, not sectionId.
      {
        id: 'coin-frontend',
        sectionId: 'skills',
        sectionLabel: 'Skills',
        data: { category: 'Frontend', skills: [] },
        sourceType: 'coin',
      },
    ];

    expect(collectiblesSummary(cv, facts)).toEqual([{ labelKey: 'enemies', collected: 1, total: 3 }]);
  });

  it('cvWithNoCertificatesOrProjects-omitsEnemiesRow', () => {
    expect(collectiblesSummary(emptyCV, [])).toEqual([]);
  });
});
