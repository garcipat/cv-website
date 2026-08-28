import { mapCVDataToCollectibles, placeCollectibles } from './CollectibleMapper';
import { level1 } from './level1';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from './Terrain';
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
  it('nDefs-returns-nPlacementsWithMatchingIds', () => {
    const defs = mapCVDataToCollectibles(cv);
    const placed = placeCollectibles(defs, level1);
    expect(placed).toHaveLength(defs.length);
    expect(placed.map((p) => p.id)).toEqual(defs.map((d) => d.id));
  });

  it('everyPlacement-sitsOnAnEmptyTileDirectlyAboveASolidTile', () => {
    const defs = mapCVDataToCollectibles(cv);
    const placed = placeCollectibles(defs, level1);
    for (const p of placed) {
      const col = p.x / RENDERED_TILE_SIZE;
      const row = p.y / RENDERED_TILE_SIZE;
      expect(isSolid(tileAt(level1, col, row))).toBe(false);
      expect(isSolid(tileAt(level1, col, row + 1))).toBe(true);
    }
  });

  it('manyDefs-returns-noTwoPlacementsAtTheSamePosition', () => {
    // 40 fake defs, well beyond level1's ~19 real collectibles, to exercise
    // wrapping/spacing logic without depending on real CVData volume.
    const manyDefs = Array.from({ length: 40 }, (_, i) => ({
      id: `fake-${i}`,
      spriteType: 'coin' as const,
      fact: {
        id: `fake-${i}`,
        sectionId: 'skills' as const,
        sectionLabel: 'Skills',
        data: { category: `Cat ${i}`, skills: [] },
        sourceType: 'coin' as const,
      },
    }));
    const placed = placeCollectibles(manyDefs, level1);
    const positions = placed.map((p) => `${p.x},${p.y}`);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it('manyDefs-returns-everyPlacementUniqueAndOnAnEmptyTileAboveASolidTile', () => {
    // Combines the two properties checked separately above (uniqueness,
    // solidity) against the same 40-fake-defs wrap-triggering fixture, so a
    // future regression that reintroduces fabricated (unverified) rows in
    // the wrap path — valid positions that just happen to collide, or vice
    // versa — is caught even if it slips past either check alone.
    const manyDefs = Array.from({ length: 40 }, (_, i) => ({
      id: `fake-${i}`,
      spriteType: 'coin' as const,
      fact: {
        id: `fake-${i}`,
        sectionId: 'skills' as const,
        sectionLabel: 'Skills',
        data: { category: `Cat ${i}`, skills: [] },
        sourceType: 'coin' as const,
      },
    }));
    const placed = placeCollectibles(manyDefs, level1);

    const positions = placed.map((p) => `${p.x},${p.y}`);
    expect(new Set(positions).size).toBe(positions.length);

    for (const p of placed) {
      const col = p.x / RENDERED_TILE_SIZE;
      const row = p.y / RENDERED_TILE_SIZE;
      expect(isSolid(tileAt(level1, col, row))).toBe(false);
      expect(isSolid(tileAt(level1, col, row + 1))).toBe(true);
    }
  });
});
