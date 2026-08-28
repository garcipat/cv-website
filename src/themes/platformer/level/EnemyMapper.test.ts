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
  it('called-returns-oneSlimeGreenPerCertificatePlusOneSlimePurplePerProject', () => {
    const defs = mapCVDataToEnemies(cv);
    expect(defs.filter((d) => d.spriteType === 'slimeGreen')).toHaveLength(2);
    expect(defs.filter((d) => d.spriteType === 'slimePurple')).toHaveLength(1);
  });

  it('called-returns-uniqueIds', () => {
    const defs = mapCVDataToEnemies(cv);
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('certificateEntry-buildsCertificatesFact', () => {
    const defs = mapCVDataToEnemies(cv);
    const cert = defs.find(
      (d) => d.spriteType === 'slimeGreen' && 'name' in d.fact.data && d.fact.data.name === 'AWS Solutions Architect',
    );
    expect(cert).toBeDefined();
    expect(cert?.fact.sectionId).toBe('certificates');
    expect(cert?.fact.sourceType).toBe('enemy');
  });

  it('projectEntry-buildsProjectsFact', () => {
    const defs = mapCVDataToEnemies(cv);
    const project = defs.find((d) => d.spriteType === 'slimePurple');
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
    const defs = mapCVDataToEnemies(cv); // [cert, cert, project]
    const greenMarkers = [
      { col: 5, row: 2 },
      { col: 6, row: 2 },
    ];
    const purpleMarkers = [{ col: 7, row: 2 }];
    const placed = placeEnemies(defs, { slimeGreen: greenMarkers, slimePurple: purpleMarkers });

    expect(placed.map((p) => p.id)).toEqual(defs.map((d) => d.id));
    expect(placed[0]).toMatchObject(tileToPixel(greenMarkers[0].col, greenMarkers[0].row));
    expect(placed[1]).toMatchObject(tileToPixel(greenMarkers[1].col, greenMarkers[1].row));
    expect(placed[2]).toMatchObject(tileToPixel(purpleMarkers[0].col, purpleMarkers[0].row));
  });

  it('greenMarkersConsumedInReadingOrder-secondGreenDefGetsSecondMarker', () => {
    const defs = mapCVDataToEnemies(cv);
    const greenMarkers = [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
    ];
    const placed = placeEnemies(defs, { slimeGreen: greenMarkers, slimePurple: [{ col: 3, row: 0 }] });

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

    // Only the first green def had a marker — the second isn't on the map
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
    const defs = mapCVDataToEnemies({ ...cv, certificates: [], projects: [] });
    expect(placeEnemies(defs, { slimeGreen: [], slimePurple: [] })).toEqual([]);
  });
});
