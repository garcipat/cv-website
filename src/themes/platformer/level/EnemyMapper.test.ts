import { mapCVDataToEnemies, placeEnemies } from './EnemyMapper';
import { level1 } from './level1';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from './Terrain';
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
  it('nDefs-returns-nPlacementsWithMatchingIds', () => {
    const defs = mapCVDataToEnemies(cv);
    const placed = placeEnemies(defs, level1);
    expect(placed).toHaveLength(defs.length);
    expect(placed.map((p) => p.id)).toEqual(defs.map((d) => d.id));
  });

  it('everyPlacement-sitsOnAnEmptyTileDirectlyAboveASolidTile', () => {
    const defs = mapCVDataToEnemies(cv);
    const placed = placeEnemies(defs, level1);
    for (const p of placed) {
      const col = p.x / RENDERED_TILE_SIZE;
      const row = p.y / RENDERED_TILE_SIZE;
      expect(isSolid(tileAt(level1, col, row))).toBe(false);
      expect(isSolid(tileAt(level1, col, row + 1))).toBe(true);
    }
  });

  it('manyDefs-returns-noTwoPlacementsAtTheSamePosition', () => {
    const manyDefs = Array.from({ length: 30 }, (_, i) => ({
      id: `fake-${i}`,
      spriteType: 'slimeGreen' as const,
      fact: {
        id: `fake-${i}`,
        sectionId: 'certificates' as const,
        sectionLabel: 'Certificates',
        data: { name: `Cert ${i}`, issuer: 'X', date: '2020-01' },
        sourceType: 'enemy' as const,
      },
    }));
    const placed = placeEnemies(manyDefs, level1);
    const positions = placed.map((p) => `${p.x},${p.y}`);
    expect(new Set(positions).size).toBe(positions.length);
  });
});
