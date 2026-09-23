import { describe, it, expect } from 'vitest';
import { TILE_FOG_EXEMPT, BACKGROUND_MATERIAL_FAMILY, backgroundMaterialFamily } from './LevelData';

describe('TILE_FOG_EXEMPT-wood-and-door-tiles-haveExplicitEntries', () => {
  it('groundWood is fog-exempt like other solid structure', () => {
    expect(TILE_FOG_EXEMPT.groundWood).toBe(true);
  });
  it('door tiles in every state stay fogged like other authored objects', () => {
    expect(TILE_FOG_EXEMPT.doorLeft).toBe(false);
    expect(TILE_FOG_EXEMPT.doorRight).toBe(false);
    expect(TILE_FOG_EXEMPT.doorLeftOpen).toBe(false);
    expect(TILE_FOG_EXEMPT.doorRightOpen).toBe(false);
  });
});

describe('backgroundMaterialFamily-wood-returnsSurface', () => {
  it('wood is a surface material', () => {
    expect(BACKGROUND_MATERIAL_FAMILY.wood).toBe('surface');
    expect(backgroundMaterialFamily('wood')).toBe('surface');
  });
});
