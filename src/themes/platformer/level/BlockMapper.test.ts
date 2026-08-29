import { mapCVDataToBlocks, placeBlocks, isBlockOccupied } from './BlockMapper';
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
  ],
  skills: [],
  courses: [],
  education: [
    { degree: 'B.Sc. Computer Science', institution: 'Technical University Berlin', startDate: '2016-10' },
  ],
  certificates: [],
  languages: [],
  projects: [],
};

describe('mapCVDataToBlocks', () => {
  it('called-returns-oneCratePerExperiencePlusOneCratePerEducation', () => {
    const defs = mapCVDataToBlocks(cv);
    expect(defs.filter((d) => d.blockKind === 'crate')).toHaveLength(2);
  });

  it('called-returns-uniqueIds', () => {
    const defs = mapCVDataToBlocks(cv);
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('experienceEntry-buildsExperienceFact', () => {
    const defs = mapCVDataToBlocks(cv);
    const exp = defs.find((d) => d.fact && 'role' in d.fact.data && d.fact.data.role === 'Staff Frontend Engineer');
    expect(exp).toBeDefined();
    expect(exp?.fact?.sectionId).toBe('experience');
    expect(exp?.fact?.sourceType).toBe('block');
    expect(exp?.blockKind).toBe('crate');
  });

  it('educationEntry-buildsEducationFact', () => {
    const defs = mapCVDataToBlocks(cv);
    const edu = defs.find((d) => d.fact && 'degree' in d.fact.data);
    expect(edu).toBeDefined();
    expect(edu?.fact?.sectionId).toBe('education');
    expect(edu?.fact?.sourceType).toBe('block');
    expect(edu?.blockKind).toBe('crate');
  });

  it('noExperienceOrEducation-returnsNoBlocks', () => {
    const defs = mapCVDataToBlocks({ ...cv, experience: [], education: [] });
    expect(defs).toHaveLength(0);
  });

  it('everyFactId-matchesItsBlockId', () => {
    const defs = mapCVDataToBlocks(cv);
    expect(defs.every((d) => d.fact && d.id === d.fact.id)).toBe(true);
  });
});

describe('placeBlocks', () => {
  it('enoughCrateMarkers-returnsCratePlacementsAtMarkedPositionsInDefsOrder', () => {
    const defs = mapCVDataToBlocks(cv); // [experience(crate), education(crate)]
    const crateMarkers = [
      { col: 5, row: 2 },
      { col: 6, row: 2 },
    ];
    const placed = placeBlocks(defs, { crate: crateMarkers, questionMark: [], rock: [] });

    expect(placed.map((p) => p.id)).toEqual(defs.map((d) => d.id));
    expect(placed[0]).toMatchObject(tileToPixel(crateMarkers[0].col, crateMarkers[0].row));
    expect(placed[1]).toMatchObject(tileToPixel(crateMarkers[1].col, crateMarkers[1].row));
  });

  it('fewerCrateMarkersThanCrateDefs-onlyMarkedCountGetsPlaced', () => {
    const defs = mapCVDataToBlocks(cv); // 2 crate defs
    const placed = placeBlocks(defs, { crate: [{ col: 1, row: 0 }], questionMark: [], rock: [] });
    expect(placed.filter((p) => p.blockKind === 'crate')).toHaveLength(1);
  });

  it('noCrateMarkers-noCrateDefsPlaced', () => {
    const defs = mapCVDataToBlocks(cv);
    const placed = placeBlocks(defs, { crate: [], questionMark: [], rock: [] });
    expect(placed).toHaveLength(0);
  });

  it('questionMarkMarkers-eachBecomesAPlacementWithNoFact', () => {
    const markers = [
      { col: 2, row: 1 },
      { col: 3, row: 1 },
    ];
    const placed = placeBlocks([], { crate: [], questionMark: markers, rock: [] });
    expect(placed).toHaveLength(2);
    for (const p of placed) {
      expect(p.blockKind).toBe('questionMark');
      expect(p.fact).toBeUndefined();
    }
    expect(placed[0]).toMatchObject(tileToPixel(markers[0].col, markers[0].row));
    expect(placed[1]).toMatchObject(tileToPixel(markers[1].col, markers[1].row));
  });

  it('rockMarkers-eachBecomesAPlacementWithNoFact', () => {
    const markers = [{ col: 4, row: 1 }];
    const placed = placeBlocks([], { crate: [], questionMark: [], rock: markers });
    expect(placed).toHaveLength(1);
    expect(placed[0].blockKind).toBe('rock');
    expect(placed[0].fact).toBeUndefined();
    expect(placed[0]).toMatchObject(tileToPixel(markers[0].col, markers[0].row));
  });

  it('questionMarkAndRockPlacements-haveUniqueIdsDerivedFromPosition', () => {
    const placed = placeBlocks([], {
      crate: [],
      questionMark: [{ col: 2, row: 1 }],
      rock: [{ col: 4, row: 1 }],
    });
    const ids = placed.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('noMarkersAtAll-noDefs-returnsEmptyArray', () => {
    expect(placeBlocks([], { crate: [], questionMark: [], rock: [] })).toEqual([]);
  });
});

describe('isBlockOccupied', () => {
  it('tileMatchesABlockPlacement-returnsTrue', () => {
    const placed = placeBlocks([], { crate: [], questionMark: [{ col: 5, row: 2 }], rock: [] });
    expect(isBlockOccupied(placed, 5, 2)).toBe(true);
  });

  it('tileDoesNotMatchAnyBlockPlacement-returnsFalse', () => {
    const placed = placeBlocks([], { crate: [], questionMark: [{ col: 5, row: 2 }], rock: [] });
    expect(isBlockOccupied(placed, 6, 2)).toBe(false);
    expect(isBlockOccupied(placed, 5, 3)).toBe(false);
  });

  it('noPlacements-returnsFalse', () => {
    expect(isBlockOccupied([], 5, 2)).toBe(false);
  });
});
