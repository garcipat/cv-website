import { mapCVDataToEnemies, placeEnemies } from './EnemyMapper';
import { tileToPixel } from './Terrain';
import type { CVData } from '@/types/cv';

const cv: CVData = {
  personality: { name: 'Test', tagline: 'Test', summary: '' },
  experience: [],
  skills: [],
  courses: [],
  education: [],
  certificates: [
    { name: 'AWS Solutions Architect', issuer: 'AWS', date: '2023-06' },
    { name: 'Scrum Master', issuer: 'Scrum.org', date: '2021-01' },
  ],
  languages: [],
  projects: [{ name: 'Open Source Task Runner', description: 'A CLI task runner.' }],
};

describe('mapCVDataToEnemies', () => {
  it('called-returns-oneSlimePurplePerCertificatePlusOneSlimeGreenPerProject', () => {
    // Purple (2 hit points) is matched to Certificates, the rarer section —
    // see EnemyMapper.ts's certificateToEnemy comment for the rationale.
    const defs = mapCVDataToEnemies(cv);
    expect(defs.filter((d) => d.spriteType === 'slimePurple')).toHaveLength(2);
    expect(defs.filter((d) => d.spriteType === 'slimeGreen')).toHaveLength(1);
  });

  it('called-returns-uniqueIds', () => {
    const defs = mapCVDataToEnemies(cv);
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('certificateEntry-buildsCertificatesFact', () => {
    const defs = mapCVDataToEnemies(cv);
    const cert = defs.find(
      (d) => d.spriteType === 'slimePurple' && 'name' in d.fact.data && d.fact.data.name === 'AWS Solutions Architect',
    );
    expect(cert).toBeDefined();
    expect(cert?.fact.sectionId).toBe('certificates');
    expect(cert?.fact.sourceType).toBe('enemy');
  });

  it('projectEntry-buildsProjectsFact', () => {
    const defs = mapCVDataToEnemies(cv);
    const project = defs.find((d) => d.spriteType === 'slimeGreen');
    expect(project).toBeDefined();
    expect(project?.fact.sectionId).toBe('projects');
    expect(project?.fact.sourceType).toBe('enemy');
  });

  it('noCertificatesOrProjects-returnsNoEnemies', () => {
    const defs = mapCVDataToEnemies({ ...cv, certificates: [], projects: [] });
    expect(defs).toHaveLength(0);
  });

  it('everyFactId-matchesItsEnemyId', () => {
    const defs = mapCVDataToEnemies(cv);
    expect(defs.every((d) => d.id === d.fact.id)).toBe(true);
  });
});

describe('placeEnemies', () => {
  it('enoughMarkersOfEachType-returnsPlacementsAtMarkedPositionsInDefsOrder', () => {
    const defs = mapCVDataToEnemies(cv); // [cert(purple), cert(purple), project(green)]
    const purpleMarkers = [
      { col: 5, row: 2 },
      { col: 6, row: 2 },
    ];
    const greenMarkers = [{ col: 7, row: 2 }];
    const placed = placeEnemies(defs, { slimeGreen: greenMarkers, slimePurple: purpleMarkers });

    expect(placed.map((p) => p.id)).toEqual(defs.map((d) => d.id));
    expect(placed[0]).toMatchObject(tileToPixel(purpleMarkers[0].col, purpleMarkers[0].row));
    expect(placed[1]).toMatchObject(tileToPixel(purpleMarkers[1].col, purpleMarkers[1].row));
    expect(placed[2]).toMatchObject(tileToPixel(greenMarkers[0].col, greenMarkers[0].row));
  });

  it('purpleMarkersConsumedInReadingOrder-secondPurpleDefGetsSecondMarker', () => {
    const defs = mapCVDataToEnemies(cv);
    const purpleMarkers = [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
    ];
    const placed = placeEnemies(defs, { slimeGreen: [{ col: 3, row: 0 }], slimePurple: purpleMarkers });

    const purplePlacements = placed.filter((p) => p.spriteType === 'slimePurple');
    expect(purplePlacements[0]).toMatchObject(tileToPixel(1, 0));
    expect(purplePlacements[1]).toMatchObject(tileToPixel(2, 0));
  });

  it('fewerPurpleMarkersThanPurpleDefs-onlyMarkedCountGetsPlaced', () => {
    const defs = mapCVDataToEnemies(cv); // 2 slimePurple defs, 1 slimeGreen def
    const placed = placeEnemies(defs, {
      slimeGreen: [{ col: 2, row: 0 }],
      slimePurple: [{ col: 1, row: 0 }],
    });

    // Only the first purple def had a marker — the second isn't on the map
    // yet, not an error (see placeEnemies's doc comment).
    expect(placed.filter((p) => p.spriteType === 'slimePurple')).toHaveLength(1);
    expect(placed.filter((p) => p.spriteType === 'slimeGreen')).toHaveLength(1);
    expect(placed).toHaveLength(2);
  });

  it('noGreenMarkers-noGreenDefsPlacedButPurpleDefsStillAre', () => {
    const defs = mapCVDataToEnemies(cv); // 2 slimePurple defs, 1 slimeGreen def
    const placed = placeEnemies(defs, {
      slimeGreen: [],
      slimePurple: [
        { col: 1, row: 0 },
        { col: 2, row: 0 },
      ],
    });

    expect(placed.filter((p) => p.spriteType === 'slimePurple')).toHaveLength(2);
    expect(placed.filter((p) => p.spriteType === 'slimeGreen')).toHaveLength(0);
    expect(placed).toHaveLength(2);
  });

  it('noMarkersAtAll-noDefs-returnsEmptyArray', () => {
    const defs = mapCVDataToEnemies({ ...cv, certificates: [], projects: [] });
    expect(placeEnemies(defs, { slimeGreen: [], slimePurple: [] })).toEqual([]);
  });
});
