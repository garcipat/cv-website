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
  it('called-returns-oneEnemyPerCourse-allAsSlimeGreen', () => {
    // Certificates and Projects are revealed by question-mark bonus fruit,
    // not by enemies; every course is a green slime that reveals CV content.
    const defs = mapCVDataToEnemies(cv);
    expect(defs).toHaveLength(3);
    expect(defs[0].type).toBe('slimeGreen');
    expect(defs[1].type).toBe('slimeGreen');
    expect(defs[2].type).toBe('slimeGreen');
  });

  it('called-returns-uniqueIds', () => {
    const defs = mapCVDataToEnemies(cv);
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('everyDef-carriesACoursesFactWithSourceTypeEnemy', () => {
    // mapCVDataToEnemies always assigns a fact (courseToEnemy) — EnemyDef's
    // `fact` is optional only for EnemyMapper.ts's placeEnemies-synthesized
    // "plain" defs, never for CVData-derived ones.
    const defs = mapCVDataToEnemies(cv);
    expect(defs.every((d) => d.fact?.sectionId === 'courses')).toBe(true);
    expect(defs.every((d) => d.fact?.sourceType === 'enemy')).toBe(true);
  });

  it('noCourses-returnsNoEnemies', () => {
    const defs = mapCVDataToEnemies({ ...cv, courses: [] });
    expect(defs).toHaveLength(0);
  });

  it('everyFactId-matchesItsEnemyId', () => {
    const defs = mapCVDataToEnemies(cv);
    expect(defs.every((d) => d.id === d.fact?.id)).toBe(true);
  });
});

describe('mapCVDataToEnemies (green-only Courses)', () => {
  it('mapCVDataToEnemies-everyCourse-mapsToSlimeGreen', () => {
    const cv = {
      courses: [
        { title: 'Course A', provider: 'X', year: 2020 },
        { title: 'Course B', provider: 'Y', year: 2021 },
        { title: 'Course C', provider: 'Z', year: 2022 },
      ],
    } as unknown as CVData;
    const defs = mapCVDataToEnemies(cv);
    expect(defs).toHaveLength(3);
    expect(defs.every((d) => d.type === 'slimeGreen')).toBe(true);
  });

  it('mapCVDataToEnemies-emptyCourses-returnsEmptyArray', () => {
    expect(mapCVDataToEnemies({ courses: [] } as unknown as CVData)).toEqual([]);
  });
});

describe('placeEnemies (purple markers have no defs to draw from)', () => {
  it('placeEnemies-purpleMarkerWithNoDefs-producesPlainEnemyDefWithNoFact', () => {
    const defs = mapCVDataToEnemies({ courses: [{ title: 'Course A', provider: 'X', year: 2020 }] } as unknown as CVData);
    const placements = placeEnemies(defs, {
      slimeGreen: [{ col: 1, row: 1 }],
      slimePurple: [{ col: 5, row: 1 }],
    });
    const purplePlacement = placements.find((p) => p.type === 'slimePurple')!;
    expect(purplePlacement.fact).toBeUndefined();
    const greenPlacement = placements.find((p) => p.type === 'slimeGreen')!;
    expect(greenPlacement.fact).toBeDefined();
  });
});

describe('placeEnemies', () => {
  it('enoughMarkersOfEachType-firstMarkersOfEachColorGetThatColorsDefsInOrder', () => {
    const defs = mapCVDataToEnemies(cv); // [green0, green1, green2]
    const greenMarkers = [
      { col: 5, row: 2 },
      { col: 6, row: 2 },
    ];
    const purpleMarkers = [{ col: 8, row: 2 }];
    const placed = placeEnemies(defs, { slimeGreen: greenMarkers, slimePurple: purpleMarkers });

    const green = placed.filter((p) => p.type === 'slimeGreen');
    const purple = placed.filter((p) => p.type === 'slimePurple');
    // All green defs get placed with facts from the defs
    expect(green.map((p) => p.id)).toEqual([defs[0].id, defs[1].id]);
    // Purple marker gets placed as a plain enemy (no fact) since all defs are green
    expect(purple).toHaveLength(1);
    expect(purple[0].fact).toBeUndefined();
    expect(green[0]).toMatchObject(tileToPixel(greenMarkers[0].col, greenMarkers[0].row));
    expect(green[1]).toMatchObject(tileToPixel(greenMarkers[1].col, greenMarkers[1].row));
    expect(purple[0]).toMatchObject(tileToPixel(purpleMarkers[0].col, purpleMarkers[0].row));
  });

  it('greenMarkersConsumedInReadingOrder-secondGreenDefGetsSecondMarker', () => {
    const defs = mapCVDataToEnemies(cv); // [green, green, green]
    const greenMarkers = [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
    ];
    const placed = placeEnemies(defs, { slimeGreen: greenMarkers, slimePurple: [{ col: 4, row: 0 }] });

    const greenPlacements = placed.filter((p) => p.type === 'slimeGreen');
    expect(greenPlacements[0]).toMatchObject(tileToPixel(1, 0));
    expect(greenPlacements[1]).toMatchObject(tileToPixel(2, 0));
  });

  it('fewerGreenMarkersThanGreenDefs-onlyMarkedCountGetsPlaced', () => {
    const defs = mapCVDataToEnemies(cv); // 3 slimeGreen defs, 0 slimePurple defs
    const placed = placeEnemies(defs, {
      slimeGreen: [{ col: 1, row: 0 }],
      slimePurple: [{ col: 2, row: 0 }],
    });

    // Only the first green def had a marker — the second and third green defs' facts
    // simply have no enemy yet, not an error (see placeEnemies's doc comment).
    // The purple marker gets a plain enemy with no fact.
    expect(placed.filter((p) => p.type === 'slimeGreen')).toHaveLength(1);
    expect(placed.filter((p) => p.type === 'slimePurple')).toHaveLength(1);
    expect(placed.filter((p) => p.fact)).toHaveLength(1);
    expect(placed).toHaveLength(2);
  });

  it('noPurpleMarkers-noPurpleDefsPlacedButGreenDefsStillAre', () => {
    const defs = mapCVDataToEnemies(cv); // 3 slimeGreen defs, 0 slimePurple defs
    const placed = placeEnemies(defs, {
      slimeGreen: [
        { col: 1, row: 0 },
        { col: 2, row: 0 },
      ],
      slimePurple: [],
    });

    expect(placed.filter((p) => p.type === 'slimeGreen')).toHaveLength(2);
    expect(placed.filter((p) => p.type === 'slimePurple')).toHaveLength(0);
    expect(placed).toHaveLength(2);
  });

  it('noMarkersAtAll-noDefs-returnsEmptyArray', () => {
    const defs = mapCVDataToEnemies({ ...cv, courses: [] });
    expect(placeEnemies(defs, { slimeGreen: [], slimePurple: [] })).toEqual([]);
  });

  describe('markers beyond that color\'s def count (enemies are not capped)', () => {
    it('moreGreenMarkersThanGreenDefs-excessMarkerStillPlacedAsAPlainEnemy', () => {
      const defs = mapCVDataToEnemies(cv); // 3 slimeGreen defs, 0 slimePurple defs
      const greenMarkers = [
        { col: 1, row: 0 },
        { col: 2, row: 0 },
        { col: 3, row: 0 },
        { col: 4, row: 0 }, // beyond the 3 green defs
      ];
      const placed = placeEnemies(defs, { slimeGreen: greenMarkers, slimePurple: [] });

      const green = placed.filter((p) => p.type === 'slimeGreen');
      expect(green).toHaveLength(4);
      expect(green[3].fact).toBeUndefined();
      expect(green[3]).toMatchObject(tileToPixel(4, 0));
    });

    it('plainEnemy-hasAStableIdDerivedFromItsPositionNotACVDataFact', () => {
      const placed = placeEnemies([], { slimeGreen: [{ col: 7, row: 4 }], slimePurple: [] });
      expect(placed).toHaveLength(1);
      expect(placed[0].id).toBe('enemy-plain-slimeGreen-7-4');
      expect(placed[0].fact).toBeUndefined();
    });

    it('noCVDataAtAll-everyMarkerStillPlacedAsPlainEnemies', () => {
      const placed = placeEnemies([], {
        slimeGreen: [{ col: 1, row: 0 }],
        slimePurple: [{ col: 2, row: 0 }],
      });
      expect(placed).toHaveLength(2);
      expect(placed.every((p) => p.fact === undefined)).toBe(true);
    });
  });
});
