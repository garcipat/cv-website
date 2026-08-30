import { collectiblesSummary } from './CollectiblesSummary';
import type { CollectedFact } from '../types';

describe('collectiblesSummary', () => {
  it('coinsAndFruitsPlaced-noneCollected-returnsBothRowsWithZeroCollected', () => {
    const rows = collectiblesSummary([], { coins: 1, fruits: 1, enemies: 0, crates: 0 });

    expect(rows).toEqual([
      { labelKey: 'coins', collected: 0, total: 1 },
      { labelKey: 'fruits', collected: 0, total: 1 },
    ]);
  });

  it('coinsAndFruitsPlaced-someCollected-countsMatchingFactsBySectionId', () => {
    const facts: CollectedFact[] = [
      {
        id: 'coin-frontend',
        sectionId: 'skills',
        sectionLabel: 'Skills',
        data: { category: 'Frontend', skills: [{ name: 'React', level: 80 }] },
        sourceType: 'coin',
      },
      {
        id: 'qmark-cert-aws',
        sectionId: 'certificates',
        sectionLabel: 'Certificates',
        data: { name: 'AWS Solutions Architect', issuer: 'AWS', date: '2023-06' },
        sourceType: 'block',
      },
    ];

    const rows = collectiblesSummary(facts, { coins: 2, fruits: 1, enemies: 0, crates: 0 });

    expect(rows).toEqual([
      { labelKey: 'coins', collected: 1, total: 2 },
      { labelKey: 'fruits', collected: 1, total: 1 },
    ]);
  });

  it('nothingPlaced-returnsNoRows', () => {
    expect(collectiblesSummary([], { coins: 0, fruits: 0, enemies: 0, crates: 0 })).toEqual([]);
  });

  it('onlyCoinsPlaced-omitsFruitsEnemiesAndCratesRows', () => {
    expect(collectiblesSummary([], { coins: 1, fruits: 0, enemies: 0, crates: 0 })).toEqual([
      { labelKey: 'coins', collected: 0, total: 1 },
    ]);
  });

  it('fruitsRow-countsProjectsFactsToo-notJustCertificates', () => {
    // "fruits" combines both Certificates and Projects — a question-mark
    // block's bonus fruit can carry either (amended 2026-08-30).
    const facts: CollectedFact[] = [
      {
        id: 'qmark-project-x',
        sectionId: 'projects',
        sectionLabel: 'Projects',
        data: { name: 'X', description: 'Y' },
        sourceType: 'block',
      },
    ];
    expect(collectiblesSummary(facts, { coins: 0, fruits: 2, enemies: 0, crates: 0 })).toEqual([
      { labelKey: 'fruits', collected: 1, total: 2 },
    ]);
  });

  it('fruitsRow-doesNotCountLanguagesFacts', () => {
    // Languages is intentionally unmapped from the "fruits" row now that
    // bonus fruits carry Certificates/Projects instead (amended 2026-08-30)
    // — this is what the pre-2026-08-30 version of this file got wrong.
    const facts: CollectedFact[] = [
      {
        id: 'fruit-german',
        sectionId: 'languages',
        sectionLabel: 'Languages',
        data: { name: 'German', level: 100 },
        sourceType: 'coin',
      },
    ];
    expect(collectiblesSummary(facts, { coins: 0, fruits: 1, enemies: 0, crates: 0 })).toEqual([
      { labelKey: 'fruits', collected: 0, total: 1 },
    ]);
  });

  it('enemiesPlaced-noneDefeated-returnsEnemiesRowWithZeroCollected', () => {
    expect(collectiblesSummary([], { coins: 0, fruits: 0, enemies: 2, crates: 0 })).toEqual([
      { labelKey: 'enemies', collected: 0, total: 2 },
    ]);
  });

  it('enemiesRow-countsCoursesFactsBySectionId-notSourceType', () => {
    // Amended 2026-08-30: "enemies" now counts Courses (both slime colors
    // guard the same pool), not Certificates+Projects — this is what the
    // pre-2026-08-30 version of this file (keyed on sourceType 'enemy') got
    // wrong once Certificates/Projects moved to blocks.
    const facts: CollectedFact[] = [
      {
        id: 'enemy-course-x',
        sectionId: 'courses',
        sectionLabel: 'Courses',
        data: { title: 'X', provider: 'Y', date: '2024-01', category: 'Z' },
        sourceType: 'enemy',
      },
      {
        id: 'coin-frontend',
        sectionId: 'skills',
        sectionLabel: 'Skills',
        data: { category: 'Frontend', skills: [] },
        sourceType: 'coin',
      },
    ];

    expect(collectiblesSummary(facts, { coins: 1, fruits: 0, enemies: 3, crates: 0 })).toEqual([
      { labelKey: 'coins', collected: 1, total: 1 },
      { labelKey: 'enemies', collected: 1, total: 3 },
    ]);
  });

  it('cratesPlaced-noneCollected-returnsCratesRowWithZeroCollected', () => {
    // Added 2026-08-30, live user feedback: crates (Experience+Education)
    // had no summary row at all until now.
    expect(collectiblesSummary([], { coins: 0, fruits: 0, enemies: 0, crates: 2 })).toEqual([
      { labelKey: 'crates', collected: 0, total: 2 },
    ]);
  });

  it('cratesRow-countsExperienceAndEducationFactsBySectionId', () => {
    const facts: CollectedFact[] = [
      {
        id: 'block-exp-x',
        sectionId: 'experience',
        sectionLabel: 'Experience',
        data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
        sourceType: 'block',
      },
      {
        id: 'block-edu-y',
        sectionId: 'education',
        sectionLabel: 'Education',
        data: { degree: 'X', institution: 'Y', startDate: '2016-01' },
        sourceType: 'block',
      },
      // A bonus-fruit-sourced fact must never count toward crates, even
      // though it shares `sourceType: 'block'` — the row is keyed on
      // sectionId, not sourceType.
      {
        id: 'qmark-cert-x',
        sectionId: 'certificates',
        sectionLabel: 'Certificates',
        data: { name: 'X', issuer: 'Y', date: '2023-01' },
        sourceType: 'block',
      },
    ];

    expect(collectiblesSummary(facts, { coins: 0, fruits: 1, enemies: 0, crates: 3 })).toEqual([
      { labelKey: 'fruits', collected: 1, total: 1 },
      { labelKey: 'crates', collected: 2, total: 3 },
    ]);
  });

  it('rowOrder-cratesAlwaysComesAfterEnemies', () => {
    const rows = collectiblesSummary([], { coins: 1, fruits: 1, enemies: 1, crates: 1 });
    expect(rows.map((r) => r.labelKey)).toEqual(['coins', 'fruits', 'enemies', 'crates']);
  });

  it('nothingPlacedForAnyRow-omitsAllRows', () => {
    expect(collectiblesSummary([], { coins: 0, fruits: 0, enemies: 0, crates: 0 })).toEqual([]);
  });
});
