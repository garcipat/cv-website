import { describe, it, expect } from 'vitest';
import {
  PALETTE_TILE_SPRITES,
  PALETTE_TILE_LABELS,
  PALETTE_TILE_GLYPHS,
  PALETTE_TILE_DESCRIPTIONS,
} from './paletteTiles';
import { TERRAIN_CHARS, ENTITY_CHARS, SIGN_CHARS } from '../level/LevelParser';
import type { TileChar } from '../level/LevelParser';

describe('PALETTE_TILE_SPRITES', () => {
  it('has an entry for every TERRAIN_CHARS, ENTITY_CHARS, and SIGN_CHARS key', () => {
    const allKeys = [...Object.keys(TERRAIN_CHARS), ...Object.keys(ENTITY_CHARS), ...Object.keys(SIGN_CHARS)];
    for (const key of allKeys) {
      expect(Object.keys(PALETTE_TILE_SPRITES)).toContain(key);
    }
  });

  it('maps "." (Eraser) to null — no sprite', () => {
    expect(PALETTE_TILE_SPRITES['.']).toBeNull();
  });

  it('maps "P" (Patrol Boundary) to null — it is invisible, so it has no sprite', () => {
    expect(PALETTE_TILE_SPRITES.P).toBeNull();
  });

  it('gives every sprite-less tile a glyph so the palette never shows two blank squares', () => {
    // '.' (Eraser) and 'P' (Patrol Boundary) are the only two tiles with no
    // sprite; without a glyph to tell them apart they would render as
    // identical empty squares.
    const spriteless = (Object.keys(PALETTE_TILE_SPRITES) as TileChar[]).filter(
      (key) => PALETTE_TILE_SPRITES[key] === null,
    );
    expect(spriteless).toEqual(['.', 'P']);
    expect(PALETTE_TILE_GLYPHS['.']).toBeUndefined();
    expect(PALETTE_TILE_GLYPHS.P).toBeTruthy();
  });

  it('gives every non-sprite-less tile a spec with a positive frame size', () => {
    const keys = Object.keys(PALETTE_TILE_SPRITES) as TileChar[];
    for (const key of keys) {
      if (key === '.' || key === 'P') continue;
      const spec = PALETTE_TILE_SPRITES[key];
      expect(spec).not.toBeNull();
      expect(spec!.frameWidth).toBeGreaterThan(0);
      expect(spec!.frameHeight).toBeGreaterThan(0);
      expect(spec!.sheetWidth).toBeGreaterThanOrEqual(spec!.sx + spec!.frameWidth);
      expect(spec!.sheetHeight).toBeGreaterThanOrEqual(spec!.sy + spec!.frameHeight);
    }
  });

  it('describes every tile, so no palette button hovers without an explanation', () => {
    const keys = Object.keys(PALETTE_TILE_SPRITES) as TileChar[];
    for (const key of keys) {
      expect(PALETTE_TILE_DESCRIPTIONS[key]).toBeTruthy();
    }
  });

  it('describes the patrol tile by the two things that are not visible about it', () => {
    expect(PALETTE_TILE_DESCRIPTIONS.P).toBe('Invisible in game; turns patrolling enemies around');
  });

  it('labels the patrol tile by what it does, not by its character', () => {
    expect(PALETTE_TILE_LABELS.P).toBe('Patrol Boundary');
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
  it('has a non-empty label for every TERRAIN_CHARS, ENTITY_CHARS, and SIGN_CHARS key', () => {
    const allKeys = [
      ...Object.keys(TERRAIN_CHARS),
      ...Object.keys(ENTITY_CHARS),
      ...Object.keys(SIGN_CHARS),
    ] as TileChar[];
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

describe('ground marker', () => {
  it('G-hasASpriteCompositingGrassOverTheGroundBlock', () => {
    expect(PALETTE_TILE_SPRITES['G']).toEqual({
      sheet: '/sprites/tile_atlas.png',
      sheetWidth: 130,
      sheetHeight: 54,
      sx: 114,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
      overlay: { sx: 76, sy: 38 },
    });
  });
});

describe('paletteTiles — bush/fence', () => {
  it('n-hasANonNullSprite', () => {
    expect(PALETTE_TILE_SPRITES.n).not.toBeNull();
  });

  it('N-hasANonNullSprite', () => {
    expect(PALETTE_TILE_SPRITES.N).not.toBeNull();
  });

  it('nAndN-haveNonEmptyLabelsAndDescriptions', () => {
    expect(PALETTE_TILE_LABELS.n.length).toBeGreaterThan(0);
    expect(PALETTE_TILE_LABELS.N.length).toBeGreaterThan(0);
    expect(PALETTE_TILE_DESCRIPTIONS.n.length).toBeGreaterThan(0);
    expect(PALETTE_TILE_DESCRIPTIONS.N.length).toBeGreaterThan(0);
  });
});
