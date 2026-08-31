import { describe, it, expect } from 'vitest';
import { PALETTE_TILE_SPRITES, PALETTE_TILE_LABELS } from './paletteTiles';
import { TERRAIN_CHARS, ENTITY_CHARS } from '../level/LevelParser';
import type { TileChar } from '../level/LevelParser';

describe('PALETTE_TILE_SPRITES', () => {
  it('has an entry for every TERRAIN_CHARS and ENTITY_CHARS key', () => {
    const allKeys = [...Object.keys(TERRAIN_CHARS), ...Object.keys(ENTITY_CHARS)];
    for (const key of allKeys) {
      expect(Object.keys(PALETTE_TILE_SPRITES)).toContain(key);
    }
  });

  it('maps "." (Eraser) to null — no sprite', () => {
    expect(PALETTE_TILE_SPRITES['.']).toBeNull();
  });

  it('gives every non-"." tile a spec with a positive frame size', () => {
    const keys = Object.keys(PALETTE_TILE_SPRITES) as TileChar[];
    for (const key of keys) {
      if (key === '.') continue;
      const spec = PALETTE_TILE_SPRITES[key];
      expect(spec).not.toBeNull();
      expect(spec!.frameWidth).toBeGreaterThan(0);
      expect(spec!.frameHeight).toBeGreaterThan(0);
      expect(spec!.sheetWidth).toBeGreaterThanOrEqual(spec!.sx + spec!.frameWidth);
      expect(spec!.sheetHeight).toBeGreaterThanOrEqual(spec!.sy + spec!.frameHeight);
    }
  });

  it('uses the coin sprite sheet for the coin tile', () => {
    expect(PALETTE_TILE_SPRITES.C?.sheet).toBe('/sprites/coin.png');
  });

  it('uses the chest-closed sprite for the chest tile, sized to the whole image', () => {
    expect(PALETTE_TILE_SPRITES.T).toEqual({
      sheet: '/sprites/chest_closed.png',
      sheetWidth: 28,
      sheetHeight: 20,
      sx: 0,
      sy: 0,
      frameWidth: 28,
      frameHeight: 20,
    });
  });
});

describe('PALETTE_TILE_LABELS', () => {
  it('has a non-empty label for every TERRAIN_CHARS and ENTITY_CHARS key', () => {
    const allKeys = [...Object.keys(TERRAIN_CHARS), ...Object.keys(ENTITY_CHARS)] as TileChar[];
    for (const key of allKeys) {
      expect(PALETTE_TILE_LABELS[key]).toBeTruthy();
    }
  });

  it('labels "." as Eraser', () => {
    expect(PALETTE_TILE_LABELS['.']).toBe('Eraser');
  });
});

describe('sign marker', () => {
  it('digitOne-hasASpriteMatchingTheInGameSignpostTile', () => {
    expect(PALETTE_TILE_SPRITES['1']).toEqual({
      sheet: '/sprites/world_tileset.png',
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 128,
      sy: 48,
      frameWidth: 16,
      frameHeight: 16,
    });
  });

  it('digitOne-hasAHumanReadableLabel', () => {
    expect(PALETTE_TILE_LABELS['1']).toBe('Sign');
  });
});
