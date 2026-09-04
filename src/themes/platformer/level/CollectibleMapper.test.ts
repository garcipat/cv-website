import { mapCVDataToSkillFactPool, placeCollectibles } from './CollectibleMapper';
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

describe('mapCVDataToSkillFactPool', () => {
  it('called-returns-oneFactPerCategory', () => {
    const pool = mapCVDataToSkillFactPool(cv);
    expect(pool).toHaveLength(2); // Backend, Frontend
  });

  it('called-returns-uniqueIds', () => {
    const pool = mapCVDataToSkillFactPool(cv);
    const ids = pool.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('categoryWithSections-includesSectionSkillsInFactSkillList', () => {
    const pool = mapCVDataToSkillFactPool(cv);
    const frontend = pool.find((f) => isSkillCategoryFact(f.data) && f.data.category === 'Frontend');
    expect(frontend).toBeDefined();
    if (!frontend || !isSkillCategoryFact(frontend.data)) throw new Error('unreachable');
    const names = frontend.data.skills.map((s) => s.name);
    expect(names).toEqual(['React', 'Vite']);
  });

  it('everyEntry-hasSkillsSectionIdAndCoinSourceType', () => {
    const pool = mapCVDataToSkillFactPool(cv);
    expect(pool.every((f) => f.sectionId === 'skills' && f.sourceType === 'coin')).toBe(true);
  });

  it('noSkills-returnsEmptyPool', () => {
    expect(mapCVDataToSkillFactPool({ ...cv, skills: [] })).toHaveLength(0);
  });
});

describe('placeCollectibles', () => {
  it('coinAndFruitMarkers-returnsOnePlacementPerMarkerInReadingOrder', () => {
    // Purely positional now — no CVData involved (see
    // mapCVDataToSkillFactPool's doc comment for why).
    const coinMarkers = [
      { col: 5, row: 2 },
      { col: 6, row: 2 },
    ];
    const fruitMarkers = [{ col: 7, row: 2 }];
    const placed = placeCollectibles({ coin: coinMarkers, fruit: fruitMarkers });

    expect(placed).toHaveLength(3);
    expect(placed[0]).toMatchObject({ spriteType: 'coin', ...tileToPixel(coinMarkers[0].col, coinMarkers[0].row) });
    expect(placed[1]).toMatchObject({ spriteType: 'coin', ...tileToPixel(coinMarkers[1].col, coinMarkers[1].row) });
    expect(placed[2]).toMatchObject({ spriteType: 'fruit', ...tileToPixel(fruitMarkers[0].col, fruitMarkers[0].row) });
  });

  it('everyPlacement-hasAUniquePositionDerivedId', () => {
    const placed = placeCollectibles({
      coin: [
        { col: 1, row: 0 },
        { col: 2, row: 0 },
      ],
      fruit: [{ col: 3, row: 0 }],
    });
    const ids = placed.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('noMarkersAtAll-returnsEmptyArray', () => {
    expect(placeCollectibles({ coin: [], fruit: [] })).toEqual([]);
  });

  it('onlyCoinMarkers-noFruitPlacements', () => {
    const placed = placeCollectibles({ coin: [{ col: 1, row: 0 }], fruit: [] });
    expect(placed).toHaveLength(1);
    expect(placed[0].spriteType).toBe('coin');
  });
});
