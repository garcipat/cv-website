import { mapCVDataToCollectibles, placeCollectibles } from './CollectibleMapper';
import { tileToPixel } from './Terrain';
import { isSkillCategoryFact } from '../types';
import type { CVData } from '@/types/cv';
import type { CollectibleDef } from '../types';

const cv: CVData = {
  personality: { name: 'Test', tagline: 'Test', summary: '' },
  experience: [],
  skills: [
    {
      category: 'Backend',
      skills: [
        { name: 'C#', level: 90 },
        { name: '.NET', level: 85 },
      ],
    },
    {
      category: 'Frontend',
      skills: [{ name: 'React', level: 80 }],
      sections: [{ title: 'Tooling', skills: [{ name: 'Vite', level: 70 }] }],
    },
  ],
  courses: [],
  education: [],
  certificates: [],
  languages: [
    { name: 'German', flag: '🇩🇪', level: 100 },
    { name: 'English', flag: '🇬🇧', level: 90 },
  ],
  projects: [],
};

function fruitDef(id: string): CollectibleDef {
  return {
    id,
    spriteType: 'fruit',
    fact: { id, sectionId: 'languages', sectionLabel: 'Languages', data: { name: id, level: 50 }, sourceType: 'coin' },
  };
}

describe('mapCVDataToCollectibles', () => {
  it('called-returns-oneCoinPerCategory', () => {
    const defs = mapCVDataToCollectibles(cv);
    expect(defs.filter((d) => d.spriteType === 'coin')).toHaveLength(2); // Backend, Frontend
  });

  it('called-returns-uniqueIds', () => {
    const defs = mapCVDataToCollectibles(cv);
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('categoryWithSections-includesSectionSkillsInFactSkillList', () => {
    const defs = mapCVDataToCollectibles(cv);
    const frontend = defs.find((d) => d.spriteType === 'coin' && d.fact.data && isSkillCategoryFact(d.fact.data) && d.fact.data.category === 'Frontend');
    expect(frontend).toBeDefined();
    if (!frontend || !isSkillCategoryFact(frontend.fact.data)) throw new Error('unreachable');
    const names = frontend.fact.data.skills.map((s) => s.name);
    expect(names).toEqual(['React', 'Vite']);
  });

  // Amended 2026-08-30 (live user feedback during step 21 verification):
  // Languages no longer produce `fruit` collectibles — see
  // CollectibleMapper.ts's mapCVDataToCollectibles comment.
  it('languagesPresent-stillProducesNoFruitCollectibles', () => {
    const defs = mapCVDataToCollectibles(cv);
    expect(defs.filter((d) => d.spriteType === 'fruit')).toHaveLength(0);
  });

  it('noSkills-returnsNoCollectibles', () => {
    const defs = mapCVDataToCollectibles({ ...cv, skills: [] });
    expect(defs).toHaveLength(0);
  });

  it('everyCollectedFactId-matchesItsCollectibleId', () => {
    const defs = mapCVDataToCollectibles(cv);
    expect(defs.every((d) => d.id === d.fact.id)).toBe(true);
  });
});

describe('placeCollectibles', () => {
  it('enoughMarkersOfEachType-returnsPlacementsAtMarkedPositionsInDefsOrder', () => {
    // fruit-type defs are hand-built here (not via mapCVDataToCollectibles,
    // which no longer produces any) — placeCollectibles's fruit marker queue
    // is generic, reusable placement infrastructure, exercised directly.
    const defs = [...mapCVDataToCollectibles(cv), fruitDef('fruit-german'), fruitDef('fruit-english')];
    const coinMarkers = [
      { col: 5, row: 2 },
      { col: 6, row: 2 },
    ];
    const fruitMarkers = [
      { col: 7, row: 2 },
      { col: 8, row: 2 },
    ];
    const placed = placeCollectibles(defs, { coin: coinMarkers, fruit: fruitMarkers });

    expect(placed.map((p) => p.id)).toEqual(defs.map((d) => d.id));
    expect(placed[0]).toMatchObject(tileToPixel(coinMarkers[0].col, coinMarkers[0].row));
    expect(placed[1]).toMatchObject(tileToPixel(coinMarkers[1].col, coinMarkers[1].row));
    expect(placed[2]).toMatchObject(tileToPixel(fruitMarkers[0].col, fruitMarkers[0].row));
    expect(placed[3]).toMatchObject(tileToPixel(fruitMarkers[1].col, fruitMarkers[1].row));
  });

  it('fewerCoinMarkersThanCoinDefs-onlyMarkedCountGetsPlaced', () => {
    const defs = [...mapCVDataToCollectibles(cv), fruitDef('fruit-german'), fruitDef('fruit-english')]; // 2 coin defs, 2 fruit defs
    const placed = placeCollectibles(defs, {
      coin: [{ col: 1, row: 0 }],
      fruit: [
        { col: 2, row: 0 },
        { col: 3, row: 0 },
      ],
    });

    // Only the first coin def had a marker — the second isn't on the map
    // yet, not an error (see placeCollectibles's doc comment).
    expect(placed.filter((p) => p.spriteType === 'coin')).toHaveLength(1);
    expect(placed.filter((p) => p.spriteType === 'fruit')).toHaveLength(2);
    expect(placed).toHaveLength(3);
  });

  it('noFruitMarkers-noFruitDefsPlacedButCoinDefsStillAre', () => {
    const defs = [...mapCVDataToCollectibles(cv), fruitDef('fruit-german'), fruitDef('fruit-english')]; // 2 coin defs, 2 fruit defs
    const placed = placeCollectibles(defs, {
      coin: [
        { col: 1, row: 0 },
        { col: 2, row: 0 },
      ],
      fruit: [],
    });

    expect(placed.filter((p) => p.spriteType === 'coin')).toHaveLength(2);
    expect(placed.filter((p) => p.spriteType === 'fruit')).toHaveLength(0);
    expect(placed).toHaveLength(2);
  });

  it('noMarkersAtAll-noDefs-returnsEmptyArray', () => {
    const defs = mapCVDataToCollectibles({ ...cv, skills: [] });
    expect(placeCollectibles(defs, { coin: [], fruit: [] })).toEqual([]);
  });
});
