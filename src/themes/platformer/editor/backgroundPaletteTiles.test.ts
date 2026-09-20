import { describe, it, expect } from 'vitest';
import {
  BACKGROUND_PALETTE_SPRITES,
  BACKGROUND_PALETTE_LABELS,
  BACKGROUND_PALETTE_SECTIONS,
  BACKGROUND_MATERIAL_CHAR,
} from './backgroundPaletteTiles';
import { backgroundAtlasCell } from '../engine/BackgroundAtlas';
import { BACKGROUND_MATERIAL_FAMILY } from '../level/LevelData';
import type { BackgroundMaterialId } from '../level/LevelData';
import { BACKGROUND_CHARS } from '../level/LevelParser';
import { BACKGROUND_TILES_SHEET } from '../entities/sprites/sheets';

const ALL_MATERIALS = Object.keys(BACKGROUND_MATERIAL_FAMILY) as BackgroundMaterialId[];

describe('backgroundPaletteTiles', () => {
  it.each(ALL_MATERIALS)('%s-hasASpriteSpecMatchingItsIsolatedAtlasEntry', (material) => {
    const atlasEntry = backgroundAtlasCell(material, 0);
    const sprite = BACKGROUND_PALETTE_SPRITES[material];

    expect(sprite.sheet).toBe(BACKGROUND_TILES_SHEET.src);
    expect(sprite.sheetWidth).toBe(73);
    expect(sprite.sheetHeight).toBe(354);
    expect(sprite.sx).toBe(atlasEntry.sx);
    expect(sprite.sy).toBe(atlasEntry.sy);
    expect(sprite.frameWidth).toBe(16);
    expect(sprite.frameHeight).toBe(16);
  });

  it.each(ALL_MATERIALS)('%s-hasANonEmptyLabel', (material) => {
    expect(BACKGROUND_PALETTE_LABELS[material].length).toBeGreaterThan(0);
  });
});

describe('BACKGROUND_PALETTE_SECTIONS', () => {
  it('membership-isTotalAndDisjointOverTheMaterialSet', () => {
    const listed = BACKGROUND_PALETTE_SECTIONS.flatMap((section) => section.materialIds);
    expect([...listed].sort()).toEqual([...ALL_MATERIALS].sort());
    expect(new Set(listed).size).toBe(listed.length);
  });

  it('surfaceSection-holdsExactlyTheSurfaceFamilyMaterials', () => {
    const surface = BACKGROUND_PALETTE_SECTIONS.find((section) => section.title === 'Surface');
    expect(surface).toBeDefined();
    for (const material of ALL_MATERIALS) {
      expect(surface!.materialIds.includes(material)).toBe(
        BACKGROUND_MATERIAL_FAMILY[material] === 'surface',
      );
    }
  });

  it('caveSection-holdsExactlyTheCaveFamilyMaterials', () => {
    const cave = BACKGROUND_PALETTE_SECTIONS.find((section) => section.title === 'Cave');
    expect(cave).toBeDefined();
    for (const material of ALL_MATERIALS) {
      expect(cave!.materialIds.includes(material)).toBe(
        BACKGROUND_MATERIAL_FAMILY[material] === 'cave',
      );
    }
  });

  it('sectionOrder-isStableSurfaceThenCave', () => {
    expect(BACKGROUND_PALETTE_SECTIONS.map((section) => section.title)).toEqual(['Surface', 'Cave']);
  });
});

describe('BACKGROUND_MATERIAL_CHAR', () => {
  it.each(ALL_MATERIALS)('%s-isTheInverseOfBackgroundChars', (material) => {
    const char = BACKGROUND_MATERIAL_CHAR[material];
    expect(BACKGROUND_CHARS[char]).toBe(material);
  });

  it('everyMaterial-hasExactlyOneChar', () => {
    const chars = ALL_MATERIALS.map((material) => BACKGROUND_MATERIAL_CHAR[material]);
    expect(new Set(chars).size).toBe(ALL_MATERIALS.length);
  });
});
