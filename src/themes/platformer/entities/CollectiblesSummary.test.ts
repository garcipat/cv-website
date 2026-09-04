import { collectiblesSummary } from './CollectiblesSummary';
import type { CollectedFact } from '../types';

describe('collectiblesSummary', () => {
  it('coinsAndFruitsPlaced-noneCollected-returnsBothRowsWithZeroCollected', () => {
    const rows = collectiblesSummary([], { coins: 1, fruits: 1, enemies: 0, crates: 0, chests: 0 });

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

    const rows = collectiblesSummary(facts, { coins: 2, fruits: 1, enemies: 0, crates: 0, chests: 0 });

    expect(rows).toEqual([
      { labelKey: 'coins', collected: 1, total: 2 },
      { labelKey: 'fruits', collected: 1, total: 1 },
    ]);
  });

  it('nothingPlaced-returnsNoRows', () => {
    expect(collectiblesSummary([], { coins: 0, fruits: 0, enemies: 0, crates: 0, chests: 0 })).toEqual([]);
  });

  it('onlyCoinsPlaced-omitsFruitsEnemiesAndCratesRows', () => {
    expect(collectiblesSummary([], { coins: 1, fruits: 0, enemies: 0, crates: 0, chests: 0 })).toEqual([
      { labelKey: 'coins', collected: 0, total: 1 },
    ]);
  });

  it('fruitsRow-countsProjectsFactsToo-notJustCertificates', () => {
    // "fruits" combines both Certificates and Projects — a question-mark
    // block's bonus fruit can carry either.
    const facts: CollectedFact[] = [
      {
        id: 'qmark-project-x',
        sectionId: 'projects',
        sectionLabel: 'Projects',
        data: { name: 'X', description: 'Y' },
        sourceType: 'block',
      },
    ];
    expect(collectiblesSummary(facts, { coins: 0, fruits: 2, enemies: 0, crates: 0, chests: 0 })).toEqual([
      { labelKey: 'fruits', collected: 1, total: 2 },
    ]);
  });

  it('fruitsRow-doesNotCountLanguagesFacts', () => {
    // Languages is intentionally unmapped from the "fruits" row — bonus
    // fruits carry Certificates/Projects instead.
    const facts: CollectedFact[] = [
      {
        id: 'fruit-german',
        sectionId: 'languages',
        sectionLabel: 'Languages',
        data: { name: 'German', level: 100 },
        sourceType: 'coin',
      },
    ];
    expect(collectiblesSummary(facts, { coins: 0, fruits: 1, enemies: 0, crates: 0, chests: 0 })).toEqual([
      { labelKey: 'fruits', collected: 0, total: 1 },
    ]);
  });

  it('enemiesPlaced-noneDefeated-returnsEnemiesRowWithZeroCollected', () => {
    expect(collectiblesSummary([], { coins: 0, fruits: 0, enemies: 2, crates: 0, chests: 0 })).toEqual([
      { labelKey: 'enemies', collected: 0, total: 2 },
    ]);
  });

  it('enemiesRow-countsCoursesFactsBySectionId-notSourceType', () => {
    // "enemies" counts Courses (both slime colors guard the same pool) by
    // sectionId, not by sourceType — Certificates/Projects come from blocks,
    // not enemies.
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

    expect(collectiblesSummary(facts, { coins: 1, fruits: 0, enemies: 3, crates: 0, chests: 0 })).toEqual([
      { labelKey: 'coins', collected: 1, total: 1 },
      { labelKey: 'enemies', collected: 1, total: 3 },
    ]);
  });

  it('cratesPlaced-noneCollected-returnsCratesRowWithZeroCollected', () => {
    expect(collectiblesSummary([], { coins: 0, fruits: 0, enemies: 0, crates: 2, chests: 0 })).toEqual([
      { labelKey: 'crates', collected: 0, total: 2 },
    ]);
  });

  it('cratesRow-countsEducationActivityAndLanguageFactsBySectionId', () => {
    // Crates carry Education + Activities + Languages; Experience belongs to
    // chests instead.
    const facts: CollectedFact[] = [
      {
        id: 'block-edu-y',
        sectionId: 'education',
        sectionLabel: 'Education',
        data: { degree: 'X', institution: 'Y', startDate: '2016-01' },
        sourceType: 'block',
      },
      {
        id: 'block-activity-z',
        sectionId: 'activities',
        sectionLabel: 'Activities',
        data: { name: 'X', startDate: '2019-01', endDate: '2019-06' },
        sourceType: 'block',
      },
      {
        id: 'block-lang-de',
        sectionId: 'languages',
        sectionLabel: 'Languages',
        data: { name: 'German', level: 90 },
        sourceType: 'block',
      },
      // A chest-sourced Experience fact must never count toward crates.
      {
        id: 'chest-exp-x',
        sectionId: 'experience',
        sectionLabel: 'Experience',
        data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
        sourceType: 'chest',
      },
    ];

    expect(collectiblesSummary(facts, { coins: 0, fruits: 0, enemies: 0, crates: 4, chests: 1 })).toEqual([
      { labelKey: 'crates', collected: 3, total: 4 },
      { labelKey: 'chests', collected: 1, total: 1 },
    ]);
  });

  it('chestsPlaced-noneOpened-returnsChestsRowWithZeroCollected', () => {
    expect(collectiblesSummary([], { coins: 0, fruits: 0, enemies: 0, crates: 0, chests: 3 })).toEqual([
      { labelKey: 'chests', collected: 0, total: 3 },
    ]);
  });

  it('chestsRow-countsExperienceFactsBySourceType-chestOnly', () => {
    // An Experience fact could in principle come from anywhere, but today
    // only chests ever produce one — this documents that the row counts
    // sectionId 'experience' regardless of sourceType, same convention every
    // other row uses.
    const facts: CollectedFact[] = [
      {
        id: 'chest-exp-x',
        sectionId: 'experience',
        sectionLabel: 'Experience',
        data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
        sourceType: 'chest',
      },
    ];
    expect(collectiblesSummary(facts, { coins: 0, fruits: 0, enemies: 0, crates: 0, chests: 2 })).toEqual([
      { labelKey: 'chests', collected: 1, total: 2 },
    ]);
  });

  it('rowOrder-cratesThenChests-afterEnemies', () => {
    const rows = collectiblesSummary([], { coins: 1, fruits: 1, enemies: 1, crates: 1, chests: 1 });
    expect(rows.map((r) => r.labelKey)).toEqual(['coins', 'fruits', 'enemies', 'crates', 'chests']);
  });

  it('nothingPlacedForAnyRow-omitsAllRows', () => {
    expect(collectiblesSummary([], { coins: 0, fruits: 0, enemies: 0, crates: 0, chests: 0 })).toEqual([]);
  });

  it('coinsCollectedProvided-overridesTheFactsDerivedCount', () => {
    // Under proportional fact pacing (level/SkillFactPacing.ts), "skill
    // facts revealed" and "coins collected" are different numbers whenever
    // the coin count and skill-category count differ — passing
    // `coinsCollected` explicitly (as Journal.tsx now does) must win over
    // deriving it from `facts`, even when `facts` alone would suggest a
    // different, wrong number.
    const facts: CollectedFact[] = [
      {
        id: 'coin-frontend',
        sectionId: 'skills',
        sectionLabel: 'Skills',
        data: { category: 'Frontend', skills: [] },
        sourceType: 'coin',
      },
    ];
    const rows = collectiblesSummary(facts, {
      coins: 10,
      fruits: 0,
      enemies: 0,
      crates: 0,
      chests: 0,
      coinsCollected: 3,
    });
    expect(rows).toEqual([{ labelKey: 'coins', collected: 3, total: 10 }]);
  });
});
