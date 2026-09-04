import { describe, it, expect } from 'vitest';
import { BACKGROUND_PALETTE_SPRITES, BACKGROUND_PALETTE_LABELS } from './backgroundPaletteTiles';
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
