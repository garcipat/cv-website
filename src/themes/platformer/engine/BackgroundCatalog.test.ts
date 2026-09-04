import { describe, it, expect } from 'vitest';
import { BACKGROUND_CATALOG, backgroundCatalogEntry } from './BackgroundCatalog';
import type { BackgroundPieceId } from '../level/LevelData';

const SHEET_WIDTH = 128;
const SHEET_HEIGHT = 320;
const TILE_SIZE = 16;
const PIECE_IDS: BackgroundPieceId[] = [
  'dirtBlock3x3',
  'dirtBlockTop2x1',
  'dirtBlockBottom2x2',
  'dirtColumnTop1x1',
  'dirtColumnBottom1x2',
  'charcoalBlock3x3',
  'charcoalBlockTop2x1',
  'charcoalBlockBottom2x2',
  'charcoalColumnTop1x1',
  'charcoalColumnBottom1x2',
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

  const DIRT_CHARCOAL_PAIRS: [BackgroundPieceId, BackgroundPieceId][] = [
    ['dirtBlock3x3', 'charcoalBlock3x3'],
    ['dirtBlockTop2x1', 'charcoalBlockTop2x1'],
    ['dirtBlockBottom2x2', 'charcoalBlockBottom2x2'],
    ['dirtColumnTop1x1', 'charcoalColumnTop1x1'],
    ['dirtColumnBottom1x2', 'charcoalColumnBottom1x2'],
  ];

  it.each(DIRT_CHARCOAL_PAIRS)('%s-and-%s-shareTheSameShapeAt80pxApart', (dirtId, charcoalId) => {
    const dirt = backgroundCatalogEntry(dirtId);
    const charcoal = backgroundCatalogEntry(charcoalId);
    expect(charcoal.sx).toBe(dirt.sx);
    expect(charcoal.sy).toBe(dirt.sy + 80);
    expect(charcoal.widthTiles).toBe(dirt.widthTiles);
    expect(charcoal.heightTiles).toBe(dirt.heightTiles);
  });

  const EXPECTED_ENTRIES: Record<BackgroundPieceId, { sx: number; sy: number; widthTiles: number; heightTiles: number }> = {
    dirtBlock3x3: { sx: 0, sy: 32, widthTiles: 3, heightTiles: 3 },
    dirtBlockTop2x1: { sx: 48, sy: 32, widthTiles: 2, heightTiles: 1 },
    dirtBlockBottom2x2: { sx: 48, sy: 48, widthTiles: 2, heightTiles: 2 },
    dirtColumnTop1x1: { sx: 80, sy: 32, widthTiles: 1, heightTiles: 1 },
    dirtColumnBottom1x2: { sx: 80, sy: 48, widthTiles: 1, heightTiles: 2 },
    charcoalBlock3x3: { sx: 0, sy: 112, widthTiles: 3, heightTiles: 3 },
    charcoalBlockTop2x1: { sx: 48, sy: 112, widthTiles: 2, heightTiles: 1 },
    charcoalBlockBottom2x2: { sx: 48, sy: 128, widthTiles: 2, heightTiles: 2 },
    charcoalColumnTop1x1: { sx: 80, sy: 112, widthTiles: 1, heightTiles: 1 },
    charcoalColumnBottom1x2: { sx: 80, sy: 128, widthTiles: 1, heightTiles: 2 },
  };

  it.each(PIECE_IDS)('%s-matchesThePixelVerifiedRect', (pieceId) => {
    const entry = backgroundCatalogEntry(pieceId);
    expect(entry).toEqual(EXPECTED_ENTRIES[pieceId]);
  });

  it('unknownPieceId-returnsUndefinedInsteadOfThrowing', () => {
    expect(backgroundCatalogEntry('notARealPieceId' as BackgroundPieceId)).toBeUndefined();
  });
});
