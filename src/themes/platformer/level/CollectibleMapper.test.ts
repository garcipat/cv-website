import { mapCVDataToCollectibles, placeCollectibles } from './CollectibleMapper';
import { tileToPixel } from './Terrain';
import { isSkillCategoryFact } from '../types';
import type { CVData } from '@/types/cv';

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

describe('mapCVDataToCollectibles', () => {
  it('called-returns-oneCoinPerCategoryPlusOneFruitPerLanguage', () => {
    const defs = mapCVDataToCollectibles(cv);
    const coins = defs.filter((d) => d.spriteType === 'coin');
    const fruits = defs.filter((d) => d.spriteType === 'fruit');
    expect(coins).toHaveLength(2); // Backend, Frontend
    expect(fruits).toHaveLength(2); // German, English
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

  it('languageEntry-buildsSingleLanguageFact', () => {
    const defs = mapCVDataToCollectibles(cv);
    const german = defs.find((d) => d.spriteType === 'fruit' && d.fact.sectionLabel === 'Languages' && !isSkillCategoryFact(d.fact.data) && 'name' in d.fact.data && d.fact.data.name === 'German');
    expect(german).toBeDefined();
    expect(german?.fact.sourceType).toBe('coin'); // FR-009: languages are still "coin" collectibles, spriteType is the visual-only distinction
  });

  it('noLanguages-returnsNoFruitCollectibles', () => {
    const defs = mapCVDataToCollectibles({ ...cv, languages: undefined });
    expect(defs.filter((d) => d.spriteType === 'fruit')).toHaveLength(0);
  });

  it('everyCollectedFactId-matchesItsCollectibleId', () => {
    const defs = mapCVDataToCollectibles(cv);
    expect(defs.every((d) => d.id === d.fact.id)).toBe(true);
  });
});

describe('placeCollectibles', () => {
  it('enoughMarkersOfEachType-returnsPlacementsAtMarkedPositionsInDefsOrder', () => {
    const defs = mapCVDataToCollectibles(cv); // [Backend, Frontend, German, English]
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
    const defs = mapCVDataToCollectibles(cv); // 2 coin defs, 2 fruit defs
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

  it('noMarkersAtAll-noDefs-returnsEmptyArray', () => {
    const defs = mapCVDataToCollectibles({ ...cv, skills: [], languages: undefined });
    expect(placeCollectibles(defs, { coin: [], fruit: [] })).toEqual([]);
  });
});
