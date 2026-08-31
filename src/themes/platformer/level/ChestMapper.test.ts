import { mapCVDataToChests, placeChests } from './ChestMapper';
import { tileToPixel } from './Terrain';
import type { CVData } from '@/types/cv';

const cv: CVData = {
  personality: { name: 'Test', tagline: 'Test', summary: '' },
  experience: [
    {
      company: 'Tech Innovations Inc.',
      role: 'Staff Frontend Engineer',
      startDate: '2021-04',
      highlights: ['Led the redesign.'],
    },
    {
      company: 'Prior Co',
      role: 'Frontend Engineer',
      startDate: '2018-01',
      endDate: '2021-03',
      highlights: [],
    },
  ],
  skills: [],
  courses: [],
  education: [],
  certificates: [],
  languages: [],
  projects: [],
  activities: [],
};

describe('mapCVDataToChests', () => {
  it('called-returns-oneChestPerExperienceEntry', () => {
    expect(mapCVDataToChests(cv)).toHaveLength(2);
  });

  it('called-returns-uniqueIds', () => {
    const defs = mapCVDataToChests(cv);
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('experienceEntry-buildsExperienceFactWithChestSourceType', () => {
    const defs = mapCVDataToChests(cv);
    const first = defs.find((d) => d.fact.data === cv.experience[0]);
    expect(first).toBeDefined();
    expect(first?.fact.sectionId).toBe('experience');
    expect(first?.fact.sourceType).toBe('chest');
  });

  it('everyFactId-matchesItsChestId', () => {
    const defs = mapCVDataToChests(cv);
    for (const def of defs) {
      expect(def.fact.id).toBe(def.id);
    }
  });

  it('noExperience-returnsNoChests', () => {
    expect(mapCVDataToChests({ ...cv, experience: [] })).toEqual([]);
  });

  it('called-reversesExperienceOrder-oldestFirstNewestLast', () => {
    // cv.experience is newest-first (src/types/cv.ts's doc comment); chests
    // are zipped against level markers in reading order (level.ts, near
    // spawn to farther away), so reversing here makes the closest chest
    // reveal the OLDEST job and the farthest chest reveal the NEWEST one —
    // a chronological career progression as the visitor plays further
    // (2026-08-30, live user feedback).
    const defs = mapCVDataToChests(cv);
    expect(defs[0].fact.data).toBe(cv.experience[cv.experience.length - 1]);
    expect(defs[defs.length - 1].fact.data).toBe(cv.experience[0]);
  });
});

describe('placeChests', () => {
  it('fewerMarkersThanDefs-placesOnlyWhatHasAMarker', () => {
    const defs = mapCVDataToChests(cv);
    const placements = placeChests(defs, [{ col: 5, row: 3 }]);
    expect(placements).toHaveLength(1);
    expect(placements[0].id).toBe(defs[0].id);
    expect(placements[0]).toMatchObject(tileToPixel(5, 3));
  });

  it('moreMarkersThanDefs-placesOneChestPerDef-ignoringExcessMarkers', () => {
    const defs = mapCVDataToChests(cv);
    const placements = placeChests(defs, [
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 3, row: 1 },
    ]);
    expect(placements).toHaveLength(2);
  });

  it('noMarkers-returnsEmptyArray', () => {
    expect(placeChests(mapCVDataToChests(cv), [])).toEqual([]);
  });
});
