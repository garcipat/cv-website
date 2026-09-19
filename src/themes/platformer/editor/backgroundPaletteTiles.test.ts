import { describe, it, expect } from 'vitest';
import {
  BACKGROUND_PALETTE_SPRITES,
  BACKGROUND_PALETTE_LABELS,
  BACKGROUND_PALETTE_SECTIONS,
} from './backgroundPaletteTiles';
import { BACKGROUND_CATALOG } from '../engine/BackgroundCatalog';
import type { BackgroundPieceId } from '../level/LevelData';
import { TERRAIN_BACKGROUND_SHEET } from '../entities/sprites/sheets';

describe('backgroundPaletteTiles', () => {
  it.each(Object.keys(BACKGROUND_CATALOG) as BackgroundPieceId[])(
    '%s-hasASpriteSpecMatchingItsCatalogEntry',
    (pieceId) => {
      const catalogEntry = BACKGROUND_CATALOG[pieceId];
      const sprite = BACKGROUND_PALETTE_SPRITES[pieceId];

      expect(sprite.sheet).toBe(TERRAIN_BACKGROUND_SHEET.src);
      expect(sprite.sheetWidth).toBe(128);
      expect(sprite.sheetHeight).toBe(320);
      expect(sprite.sx).toBe(catalogEntry.sx);
      expect(sprite.sy).toBe(catalogEntry.sy);
      expect(sprite.frameWidth).toBe(catalogEntry.widthTiles * 16);
      expect(sprite.frameHeight).toBe(catalogEntry.heightTiles * 16);
    },
  );

  it.each(Object.keys(BACKGROUND_CATALOG) as BackgroundPieceId[])('%s-hasANonEmptyLabel', (pieceId) => {
    expect(BACKGROUND_PALETTE_LABELS[pieceId].length).toBeGreaterThan(0);
  });
});

describe('BACKGROUND_PALETTE_SECTIONS', () => {
  const allIds = Object.keys(BACKGROUND_CATALOG) as BackgroundPieceId[];

  it('membership-isTotalAndDisjointOverTheCatalog', () => {
    const listed = BACKGROUND_PALETTE_SECTIONS.flatMap((section) => section.pieceIds);
    expect([...listed].sort()).toEqual([...allIds].sort());
    expect(new Set(listed).size).toBe(listed.length);
  });

  it('surfaceSection-holdsEveryDirtPieceAndNoCharcoalPiece', () => {
    const surface = BACKGROUND_PALETTE_SECTIONS.find((section) => section.title === 'Surface');
    expect(surface).toBeDefined();
    for (const pieceId of allIds.filter((id) => id.startsWith('dirt'))) {
      expect(surface!.pieceIds).toContain(pieceId);
    }
    expect(surface!.pieceIds.some((id) => id.startsWith('charcoal'))).toBe(false);
  });

  it('caveSection-holdsEveryCharcoalPieceAndNoDirtPiece', () => {
    const cave = BACKGROUND_PALETTE_SECTIONS.find((section) => section.title === 'Cave');
    expect(cave).toBeDefined();
    for (const pieceId of allIds.filter((id) => id.startsWith('charcoal'))) {
      expect(cave!.pieceIds).toContain(pieceId);
    }
    expect(cave!.pieceIds.some((id) => id.startsWith('dirt'))).toBe(false);
  });

  it('sectionOrder-isStableSurfaceThenCave', () => {
    expect(BACKGROUND_PALETTE_SECTIONS.map((section) => section.title)).toEqual(['Surface', 'Cave']);
  });
});
