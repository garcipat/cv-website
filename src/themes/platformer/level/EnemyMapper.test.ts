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

/** Every fact a placement owns, in the same order `placeEnemies` assigns
 *  them: its own `fact` (if any) followed by any `extraFacts` — the flat
 *  form used to check the whole pool was distributed, without caring which
 *  specific placement ended up with which slice. */
function factsOf(placement: { fact?: unknown; extraFacts?: unknown[] }): unknown[] {
  return [...(placement.fact ? [placement.fact] : []), ...(placement.extraFacts ?? [])];
}

describe('placeEnemies', () => {
  // A green slime no longer carries a fixed fact bound to a specific
  // CVData-derived def — placement assigns each green marker its own fixed
  // slice of the course pool, based on its position among every green
  // marker (independent of the order the player later defeats them in), the
  // same proportional formula `level/SkillFactPacing.ts`'s
  // `revealedFactCountFor` already uses for coins.

  it('greenMarkerCountEqualsCourseCount-oneFactPerMarkerInOrder', () => {
    const defs = mapCVDataToEnemies(cv); // 3 courses
    const greenMarkers = [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
    ];
    const placed = placeEnemies(defs, { slimeGreen: greenMarkers, slimePurple: [] });

    expect(placed.map((p) => p.fact)).toEqual(defs.map((d) => d.fact));
    expect(placed.every((p) => p.extraFacts === undefined)).toBe(true);
  });

  it('onlyOneGreenMarker-thatOneEnemyOwnsEveryCourseFact', () => {
    // The example this feature was designed around: with only one enemy on
    // the map, defeating it must reveal every course.
    const defs = mapCVDataToEnemies(cv); // 3 courses
    const placed = placeEnemies(defs, { slimeGreen: [{ col: 1, row: 0 }], slimePurple: [] });

    expect(placed).toHaveLength(1);
    expect(factsOf(placed[0])).toEqual(defs.map((d) => d.fact));
  });

  it('moreGreenMarkersThanCourses-everyCourseStillReachableAcrossAllMarkersButSomeGetNone', () => {
    const defs = mapCVDataToEnemies(cv); // 3 courses
    const greenMarkers = [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
      { col: 4, row: 0 },
    ]; // 4 markers, 3 courses
    const placed = placeEnemies(defs, { slimeGreen: greenMarkers, slimePurple: [] });

    // Not every marker gets a fact when there are more markers than facts...
    expect(placed.some((p) => p.fact === undefined)).toBe(true);
    // ...but flattened in marker order, every course is still reachable
    // exactly once across the whole level.
    expect(placed.flatMap(factsOf)).toEqual(defs.map((d) => d.fact));
  });

  it('fewerGreenMarkersThanCourses-someMarkersOwnMoreThanOneCourse', () => {
    const defs = mapCVDataToEnemies(cv); // 3 courses
    const greenMarkers = [{ col: 1, row: 0 }, { col: 2, row: 0 }]; // 2 markers, 3 courses
    const placed = placeEnemies(defs, { slimeGreen: greenMarkers, slimePurple: [] });

    expect(placed.some((p) => (p.extraFacts?.length ?? 0) > 0)).toBe(true);
    expect(placed.flatMap(factsOf)).toEqual(defs.map((d) => d.fact));
  });

  it('purpleMarkers-neverCarryAFactOrExtraFacts', () => {
    const defs = mapCVDataToEnemies(cv);
    const placed = placeEnemies(defs, {
      slimeGreen: [{ col: 1, row: 0 }],
      slimePurple: [{ col: 5, row: 1 }],
    });

    const purple = placed.find((p) => p.type === 'slimePurple')!;
    expect(purple.fact).toBeUndefined();
    expect(purple.extraFacts).toBeUndefined();
  });

  it('everyPlacement-hasAStableIdDerivedFromItsPositionNotACVDataFact', () => {
    // Identity is now purely positional — which course(s) a marker owns
    // depends on where it sits among every marker of its color, not on any
    // CVData-derived id, so the placement's own id is position-derived for
    // every green/purple marker alike (no more CVData-id vs "plain"-id
    // distinction).
    const defs = mapCVDataToEnemies(cv);
    const placed = placeEnemies(defs, { slimeGreen: [{ col: 7, row: 4 }], slimePurple: [{ col: 2, row: 0 }] });

    expect(placed.find((p) => p.type === 'slimeGreen')?.id).toBe('enemy-slimeGreen-7-4');
    expect(placed.find((p) => p.type === 'slimePurple')?.id).toBe('enemy-slimePurple-2-0');
  });

  it('positions-comeFromTileToPixelOfEachMarker', () => {
    const defs = mapCVDataToEnemies(cv);
    const greenMarkers = [
      { col: 5, row: 2 },
      { col: 6, row: 2 },
    ];
    const purpleMarkers = [{ col: 8, row: 2 }];
    const placed = placeEnemies(defs, { slimeGreen: greenMarkers, slimePurple: purpleMarkers });

    const green = placed.filter((p) => p.type === 'slimeGreen');
    const purple = placed.filter((p) => p.type === 'slimePurple');
    expect(green[0]).toMatchObject(tileToPixel(greenMarkers[0].col, greenMarkers[0].row));
    expect(green[1]).toMatchObject(tileToPixel(greenMarkers[1].col, greenMarkers[1].row));
    expect(purple[0]).toMatchObject(tileToPixel(purpleMarkers[0].col, purpleMarkers[0].row));
  });

  it('noCoursesAtAll-everyGreenMarkerStillPlacedWithNoFact', () => {
    const placed = placeEnemies([], {
      slimeGreen: [{ col: 1, row: 0 }],
      slimePurple: [{ col: 2, row: 0 }],
    });
    expect(placed).toHaveLength(2);
    expect(placed.every((p) => p.fact === undefined && p.extraFacts === undefined)).toBe(true);
  });

  it('noMarkersAtAll-returnsEmptyArray', () => {
    const defs = mapCVDataToEnemies(cv);
    expect(placeEnemies(defs, { slimeGreen: [], slimePurple: [] })).toEqual([]);
  });
});
