import { describe, it, expect } from 'vitest';
import { BACKGROUND_CATALOG, backgroundCatalogEntry } from './BackgroundCatalog';
import type { BackgroundPieceId } from '../level/LevelData';

const SHEET_WIDTH = 128;
const SHEET_HEIGHT = 320;
const TILE_SIZE = 16;
const PIECE_IDS: BackgroundPieceId[] = [
  'dirtBlock3x3',
  'dirtBlock2x3',
  'dirtColumnA',
  'dirtColumnB',
  'charcoalBlock3x3',
  'charcoalBlock2x3',
  'charcoalColumnA',
  'charcoalColumnB',
];

describe('BackgroundCatalog', () => {
  it.each(PIECE_IDS)('%s-resolvesToARectInsideTheSheetOnA16pxGrid', (pieceId) => {
    const entry = backgroundCatalogEntry(pieceId);

    expect(entry.sx % TILE_SIZE).toBe(0);
    expect(entry.sy % TILE_SIZE).toBe(0);
    expect(entry.sx + entry.widthTiles * TILE_SIZE).toBeLessThanOrEqual(SHEET_WIDTH);
    expect(entry.sy + entry.heightTiles * TILE_SIZE).toBeLessThanOrEqual(SHEET_HEIGHT);
  });

  it('everyPieceFootprint-isNoBiggerThan3x3Tiles', () => {
    for (const pieceId of PIECE_IDS) {
      const entry = BACKGROUND_CATALOG[pieceId];
      expect(entry.widthTiles).toBeLessThanOrEqual(3);
      expect(entry.heightTiles).toBeLessThanOrEqual(3);
    }
  });

  it('dirtAndCharcoalVariants-shareTheSameShapeAt80pxApart', () => {
    const dirt = backgroundCatalogEntry('dirtBlock3x3');
    const charcoal = backgroundCatalogEntry('charcoalBlock3x3');
    expect(charcoal.sx).toBe(dirt.sx);
    expect(charcoal.sy).toBe(dirt.sy + 80);
    expect(charcoal.widthTiles).toBe(dirt.widthTiles);
    expect(charcoal.heightTiles).toBe(dirt.heightTiles);
  });
});
