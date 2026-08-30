import { mapCVDataToEnemies, placeEnemies } from './EnemyMapper';
import { tileToPixel } from './Terrain';
import type { CVData } from '@/types/cv';

const cv: CVData = {
  personality: { name: 'Test', tagline: 'Test', summary: '' },
  experience: [],
  skills: [],
  courses: [
    { title: 'Advanced React Patterns', provider: 'Frontend Masters', date: '2024-06', category: 'Web Development' },
    { title: 'Kubernetes Deep Dive', provider: 'Linux Foundation', date: '2023-02', category: 'Infrastructure' },
    { title: 'System Design Fundamentals', provider: 'Educative', date: '2022-11', category: 'Architecture' },
  ],
  education: [],
  certificates: [],
  languages: [],
  projects: [],
};

describe('mapCVDataToEnemies', () => {
  it('called-returns-oneEnemyPerCourse-alternatingGreenAndPurpleByIndex', () => {
    // Amended 2026-08-30 (live user feedback): Certificates + Projects moved
    // off enemies entirely (now revealed by question-mark bonus fruit); both
    // slime colors now guard the same Courses pool, split by index —
    // see EnemyMapper.ts's courseToEnemy comment.
    const defs = mapCVDataToEnemies(cv);
    expect(defs).toHaveLength(3);
    expect(defs[0].spriteType).toBe('slimeGreen');
    expect(defs[1].spriteType).toBe('slimePurple');
    expect(defs[2].spriteType).toBe('slimeGreen');
  });

  it('called-returns-uniqueIds', () => {
    const defs = mapCVDataToEnemies(cv);
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('everyDef-carriesACoursesFactWithSourceTypeEnemy', () => {
    const defs = mapCVDataToEnemies(cv);
    expect(defs.every((d) => d.fact.sectionId === 'courses')).toBe(true);
    expect(defs.every((d) => d.fact.sourceType === 'enemy')).toBe(true);
  });

  it('noCourses-returnsNoEnemies', () => {
    const defs = mapCVDataToEnemies({ ...cv, courses: [] });
    expect(defs).toHaveLength(0);
  });

  it('everyFactId-matchesItsEnemyId', () => {
    const defs = mapCVDataToEnemies(cv);
    expect(defs.every((d) => d.id === d.fact.id)).toBe(true);
  });
});

describe('placeEnemies', () => {
  it('enoughMarkersOfEachType-returnsPlacementsAtMarkedPositionsInDefsOrder', () => {
    const defs = mapCVDataToEnemies(cv); // [green, purple, green]
    const greenMarkers = [
      { col: 5, row: 2 },
      { col: 6, row: 2 },
    ];
    const purpleMarkers = [{ col: 8, row: 2 }];
    const placed = placeEnemies(defs, { slimeGreen: greenMarkers, slimePurple: purpleMarkers });

    expect(placed.map((p) => p.id)).toEqual(defs.map((d) => d.id));
    expect(placed[0]).toMatchObject(tileToPixel(greenMarkers[0].col, greenMarkers[0].row));
    expect(placed[1]).toMatchObject(tileToPixel(purpleMarkers[0].col, purpleMarkers[0].row));
    expect(placed[2]).toMatchObject(tileToPixel(greenMarkers[1].col, greenMarkers[1].row));
  });

  it('greenMarkersConsumedInReadingOrder-secondGreenDefGetsSecondMarker', () => {
    const defs = mapCVDataToEnemies(cv); // [green, purple, green]
    const greenMarkers = [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
    ];
    const placed = placeEnemies(defs, { slimeGreen: greenMarkers, slimePurple: [{ col: 4, row: 0 }] });

    const greenPlacements = placed.filter((p) => p.spriteType === 'slimeGreen');
    expect(greenPlacements[0]).toMatchObject(tileToPixel(1, 0));
    expect(greenPlacements[1]).toMatchObject(tileToPixel(2, 0));
  });

  it('fewerGreenMarkersThanGreenDefs-onlyMarkedCountGetsPlaced', () => {
    const defs = mapCVDataToEnemies(cv); // 2 slimeGreen defs, 1 slimePurple def
    const placed = placeEnemies(defs, {
      slimeGreen: [{ col: 1, row: 0 }],
      slimePurple: [{ col: 2, row: 0 }],
    });

    // Only the first green def had a marker — the rest aren't on the map
    // yet, not an error (see placeEnemies's doc comment).
    expect(placed.filter((p) => p.spriteType === 'slimeGreen')).toHaveLength(1);
    expect(placed.filter((p) => p.spriteType === 'slimePurple')).toHaveLength(1);
    expect(placed).toHaveLength(2);
  });

  it('noPurpleMarkers-noPurpleDefsPlacedButGreenDefsStillAre', () => {
    const defs = mapCVDataToEnemies(cv); // 2 slimeGreen defs, 1 slimePurple def
    const placed = placeEnemies(defs, {
      slimeGreen: [
        { col: 1, row: 0 },
        { col: 2, row: 0 },
      ],
      slimePurple: [],
    });

    expect(placed.filter((p) => p.spriteType === 'slimeGreen')).toHaveLength(2);
    expect(placed.filter((p) => p.spriteType === 'slimePurple')).toHaveLength(0);
    expect(placed).toHaveLength(2);
  });

  it('noMarkersAtAll-noDefs-returnsEmptyArray', () => {
    const defs = mapCVDataToEnemies({ ...cv, courses: [] });
    expect(placeEnemies(defs, { slimeGreen: [], slimePurple: [] })).toEqual([]);
  });
});
