import { mapCVDataToEnemies, placeEnemies } from './EnemyMapper';
import { tileToPixel } from './Terrain';
import type { CVData } from '@/types/cv';

const cv: CVData = {
  personality: { name: 'Test', tagline: 'Test', summary: '' },
  experience: [],
  skills: [],
  courses: [
    { title: 'Advanced React Patterns', provider: 'Frontend Masters', date: '2024-06', category: 'Web Development' },
  ],
  education: [],
  certificates: [
    { name: 'AWS Solutions Architect', issuer: 'AWS', date: '2023-06' },
    { name: 'Scrum Master', issuer: 'Scrum.org', date: '2021-01' },
  ],
  languages: [],
  projects: [{ name: 'Open Source Task Runner', description: 'A CLI task runner.' }],
};

describe('mapCVDataToEnemies', () => {
  it('called-returns-slimePurplePerCertificateAndProject-slimeGreenPerCourse', () => {
    // Amended 2026-08-29: Certificates + Projects now share the purple (2
    // hit point) pool; Courses moved to the green (1 hit point) pool — see
    // EnemyMapper.ts's projectToEnemy/courseToEnemy comments.
    const defs = mapCVDataToEnemies(cv);
    expect(defs.filter((d) => d.spriteType === 'slimePurple')).toHaveLength(3); // 2 certs + 1 project
    expect(defs.filter((d) => d.spriteType === 'slimeGreen')).toHaveLength(1); // 1 course
  });

  it('called-returns-uniqueIds', () => {
    const defs = mapCVDataToEnemies(cv);
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('certificateEntry-buildsCertificatesFactOnPurple', () => {
    const defs = mapCVDataToEnemies(cv);
    const cert = defs.find(
      (d) => d.spriteType === 'slimePurple' && 'name' in d.fact.data && d.fact.data.name === 'AWS Solutions Architect',
    );
    expect(cert).toBeDefined();
    expect(cert?.fact.sectionId).toBe('certificates');
    expect(cert?.fact.sourceType).toBe('enemy');
  });

  it('projectEntry-buildsProjectsFactOnPurple', () => {
    const defs = mapCVDataToEnemies(cv);
    const project = defs.find((d) => d.fact.sectionId === 'projects');
    expect(project).toBeDefined();
    expect(project?.spriteType).toBe('slimePurple');
    expect(project?.fact.sourceType).toBe('enemy');
  });

  it('courseEntry-buildsCoursesFactOnGreen', () => {
    const defs = mapCVDataToEnemies(cv);
    const course = defs.find((d) => d.spriteType === 'slimeGreen');
    expect(course).toBeDefined();
    expect(course?.fact.sectionId).toBe('courses');
    expect(course?.fact.sourceType).toBe('enemy');
  });

  it('noCertificatesProjectsOrCourses-returnsNoEnemies', () => {
    const defs = mapCVDataToEnemies({ ...cv, certificates: [], projects: [], courses: [] });
    expect(defs).toHaveLength(0);
  });

  it('everyFactId-matchesItsEnemyId', () => {
    const defs = mapCVDataToEnemies(cv);
    expect(defs.every((d) => d.id === d.fact.id)).toBe(true);
  });
});

describe('placeEnemies', () => {
  it('enoughMarkersOfEachType-returnsPlacementsAtMarkedPositionsInDefsOrder', () => {
    const defs = mapCVDataToEnemies(cv); // [cert(purple), cert(purple), project(purple), course(green)]
    const purpleMarkers = [
      { col: 5, row: 2 },
      { col: 6, row: 2 },
      { col: 7, row: 2 },
    ];
    const greenMarkers = [{ col: 8, row: 2 }];
    const placed = placeEnemies(defs, { slimeGreen: greenMarkers, slimePurple: purpleMarkers });

    expect(placed.map((p) => p.id)).toEqual(defs.map((d) => d.id));
    expect(placed[0]).toMatchObject(tileToPixel(purpleMarkers[0].col, purpleMarkers[0].row));
    expect(placed[1]).toMatchObject(tileToPixel(purpleMarkers[1].col, purpleMarkers[1].row));
    expect(placed[2]).toMatchObject(tileToPixel(purpleMarkers[2].col, purpleMarkers[2].row));
    expect(placed[3]).toMatchObject(tileToPixel(greenMarkers[0].col, greenMarkers[0].row));
  });

  it('purpleMarkersConsumedInReadingOrder-secondPurpleDefGetsSecondMarker', () => {
    const defs = mapCVDataToEnemies(cv);
    const purpleMarkers = [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
    ];
    const placed = placeEnemies(defs, { slimeGreen: [{ col: 4, row: 0 }], slimePurple: purpleMarkers });

    const purplePlacements = placed.filter((p) => p.spriteType === 'slimePurple');
    expect(purplePlacements[0]).toMatchObject(tileToPixel(1, 0));
    expect(purplePlacements[1]).toMatchObject(tileToPixel(2, 0));
    expect(purplePlacements[2]).toMatchObject(tileToPixel(3, 0));
  });

  it('fewerPurpleMarkersThanPurpleDefs-onlyMarkedCountGetsPlaced', () => {
    const defs = mapCVDataToEnemies(cv); // 3 slimePurple defs, 1 slimeGreen def
    const placed = placeEnemies(defs, {
      slimeGreen: [{ col: 2, row: 0 }],
      slimePurple: [{ col: 1, row: 0 }],
    });

    // Only the first purple def had a marker — the rest aren't on the map
    // yet, not an error (see placeEnemies's doc comment).
    expect(placed.filter((p) => p.spriteType === 'slimePurple')).toHaveLength(1);
    expect(placed.filter((p) => p.spriteType === 'slimeGreen')).toHaveLength(1);
    expect(placed).toHaveLength(2);
  });

  it('noGreenMarkers-noGreenDefsPlacedButPurpleDefsStillAre', () => {
    const defs = mapCVDataToEnemies(cv); // 3 slimePurple defs, 1 slimeGreen def
    const placed = placeEnemies(defs, {
      slimeGreen: [],
      slimePurple: [
        { col: 1, row: 0 },
        { col: 2, row: 0 },
        { col: 3, row: 0 },
      ],
    });

    expect(placed.filter((p) => p.spriteType === 'slimePurple')).toHaveLength(3);
    expect(placed.filter((p) => p.spriteType === 'slimeGreen')).toHaveLength(0);
    expect(placed).toHaveLength(3);
  });

  it('noMarkersAtAll-noDefs-returnsEmptyArray', () => {
    const defs = mapCVDataToEnemies({ ...cv, certificates: [], projects: [], courses: [] });
    expect(placeEnemies(defs, { slimeGreen: [], slimePurple: [] })).toEqual([]);
  });
});
