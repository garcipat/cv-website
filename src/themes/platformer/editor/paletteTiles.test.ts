import { describe, it, expect } from 'vitest';
import {
  PALETTE_TILE_SPRITES,
  PALETTE_TILE_LABELS,
  PALETTE_TILE_GLYPHS,
  PALETTE_TILE_DESCRIPTIONS,
  HAZARD_PALETTE_KEYS,
  BLUEPRINT_GLYPH,
  PATROL_GLYPH,
  CONNECTION_POINT_GLYPH,
} from './paletteTiles';
import { TERRAIN_CHARS, ENTITY_CHARS, SIGN_CHARS, HAZARD_CHARS } from '../level/LevelParser';
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
    // '.' (Eraser), 'P' (Patrol Boundary) and '+' (blueprint Connection
    // Point) are the tiles with no sprite; without a glyph to tell them
    // apart they would render as identical empty squares. The Eraser is the
    // deliberate exception — an empty square already reads as "erase".
    const spriteless = (Object.keys(PALETTE_TILE_SPRITES) as TileChar[]).filter(
      (key) => PALETTE_TILE_SPRITES[key] === null,
    );
    expect(spriteless).toEqual(['.', 'P', '+']);
    expect(PALETTE_TILE_GLYPHS['.']).toBeUndefined();
    expect(PALETTE_TILE_GLYPHS.P).toBeTruthy();
    expect(PALETTE_TILE_GLYPHS['+']).toBeTruthy();
  });

  it('gives every non-sprite-less tile a spec with a positive frame size', () => {
    const keys = Object.keys(PALETTE_TILE_SPRITES) as TileChar[];
    for (const key of keys) {
      if (key === '.' || key === 'P' || key === '+') continue;
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
    expect(PALETTE_TILE_SPRITES.o?.sheet).toBe('/sprites/coin.png');
  });

  it('uses the chest-closed sprite for the chest tile, sized to the whole image', () => {
    expect(PALETTE_TILE_SPRITES.$).toEqual({
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

describe('checkpoint marker', () => {
  it('C-hasASpriteCroppingTheRaisedFrameOfTheFlagStrip', () => {
    // checkpoint-flag-strip.png is 64x24: four 16x24 frames. Frame 3 (the
    // raised/activated flag) is the palette preview — sx 48.
    expect(PALETTE_TILE_SPRITES.C).toEqual({
      sheet: '/sprites/checkpoint-flag-strip.png',
      sheetWidth: 64,
      sheetHeight: 24,
      sx: 48,
      sy: 0,
      frameWidth: 16,
      frameHeight: 24,
    });
  });

  it('C-hasAHumanReadableLabel', () => {
    expect(PALETTE_TILE_LABELS.C).toBe('Checkpoint');
  });

  it('C-describesTheFinishedLevelBehaviour', () => {
    expect(PALETTE_TILE_DESCRIPTIONS.C).toBe(
      'Checkpoint; step on it to set your respawn point',
    );
  });
});

describe('potionPot marker', () => {
  it('p-hasASpriteMatchingThePurpleBottleFrame', () => {
    // Row 8, column 1 of world_tileset.png (16px tiles) — see
    // entities/blocks/PotionPot.ts's POTION_POT_FRAME.
    expect(PALETTE_TILE_SPRITES.p).toEqual({
      sheet: '/sprites/world_tileset.png',
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 16,
      sy: 128,
      frameWidth: 16,
      frameHeight: 16,
    });
  });

  it('p-hasAHumanReadableLabel', () => {
    expect(PALETTE_TILE_LABELS.p).toBe('Potion Pot');
  });
});

describe('bombPot marker', () => {
  it('b-hasASpriteMatchingTheBlueBottleFrame', () => {
    // Row 8, column 0 of world_tileset.png (16px tiles) — see
    // entities/blocks/BombPot.ts's BOMB_POT_FRAME.
    expect(PALETTE_TILE_SPRITES.b).toEqual({
      sheet: '/sprites/world_tileset.png',
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 0,
      sy: 128,
      frameWidth: 16,
      frameHeight: 16,
    });
  });

  it('b-hasAHumanReadableLabel', () => {
    expect(PALETTE_TILE_LABELS.b).toBe('Bomb Pot');
  });

  it('b-describesTheFinishedLevelBehaviour', () => {
    expect(PALETTE_TILE_DESCRIPTIONS.b).toBe(
      'Bomb-pot; land on it from above to break it and drop a bomb you can place',
    );
  });

  it('six-hasASpriteMatchingTheInGameSignpostTile', () => {
    expect(PALETTE_TILE_SPRITES['6']).toEqual({
      sheet: '/sprites/world_tileset.png',
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 128,
      sy: 48,
      frameWidth: 16,
      frameHeight: 16,
    });
  });

  it('six-hasAHumanReadableLabel', () => {
    expect(PALETTE_TILE_LABELS['6']).toBe('Sign 6');
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

describe('BLUEPRINT_GLYPH', () => {
  // Prose `it(...)` name, matching every other test in this file (see the
  // `blueprint connection point marker` describe just above it) rather than
  // importing the camel-case convention from elsewhere.
  it('gives a blueprint tile its own glyph, distinct from the other sprite-less tools', () => {
    // A Blueprints tile is another empty bordered square; sharing a symbol with
    // the patrol boundary or a connection point would make the palette
    // unreadable.
    expect(BLUEPRINT_GLYPH).toBeTruthy();
    expect(BLUEPRINT_GLYPH).not.toBe(PATROL_GLYPH);
    expect(BLUEPRINT_GLYPH).not.toBe(CONNECTION_POINT_GLYPH);
  });
});

describe('blueprint connection point marker', () => {
  it('maps "+" (Connection Point) to null — like the patrol tile, it has no in-game sprite', () => {
    expect(PALETTE_TILE_SPRITES['+']).toBeNull();
  });

  it('gives "+" a glyph, so it is not a second blank square next to the patrol tile', () => {
    expect(PALETTE_TILE_GLYPHS['+']).toBeTruthy();
    expect(PALETTE_TILE_GLYPHS['+']).not.toBe(PALETTE_TILE_GLYPHS.P);
  });

  it('labels "+" by what it is, not by its character', () => {
    expect(PALETTE_TILE_LABELS['+']).toBe('Connection Point');
  });

  it('describes "+" by where it belongs and what it is for', () => {
    expect(PALETTE_TILE_DESCRIPTIONS['+']).toBe(
      'Blueprint only; marks a border cell another blueprint can attach to',
    );
  });
});

describe('torch marker', () => {
  it('yen-hasASpriteCroppingTheTorchSheetsFirstFrame', () => {
    // A crop of torch.png's first frame (48x14 strip, 4 frames of 12x14) —
    // the same frame the engine draws at rest for a cell whose position hash
    // resolves to phase 0.
    expect(PALETTE_TILE_SPRITES['¥']).toEqual({
      sheet: '/sprites/torch.png',
      sheetWidth: 48,
      sheetHeight: 14,
      sx: 0,
      sy: 0,
      frameWidth: 12,
      frameHeight: 14,
    });
  });

  it('yen-hasAHumanReadableLabel', () => {
    expect(PALETTE_TILE_LABELS['¥']).toBe('Torch');
  });

  it('yen-hasANonEmptyDescription', () => {
    expect(PALETTE_TILE_DESCRIPTIONS['¥']).toBeTruthy();
  });
});

describe('mushroom tiles', () => {
  it('sectionSign-hasASpriteCroppingTheCompleteMushroom', () => {
    expect(PALETTE_TILE_SPRITES['§']).toEqual({
      sheet: '/sprites/mushroom.png',
      sheetWidth: 64,
      sheetHeight: 64,
      sx: 0,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
    });
  });

  it('s-hasASpriteCroppingTheSmallMushroom', () => {
    expect(PALETTE_TILE_SPRITES.s).toEqual({
      sheet: '/sprites/mushroom.png',
      sheetWidth: 64,
      sheetHeight: 64,
      sx: 32,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
    });
  });

  it('sectionSign-hasAHumanReadableLabel', () => {
    expect(PALETTE_TILE_LABELS['§']).toBe('Bouncy Mushroom');
  });

  it('s-hasAHumanReadableLabel', () => {
    expect(PALETTE_TILE_LABELS.s).toBe('Small Mushroom');
  });

  it('bothMushrooms-haveNonEmptyDescriptions', () => {
    expect(PALETTE_TILE_DESCRIPTIONS['§'].length).toBeGreaterThan(0);
    expect(PALETTE_TILE_DESCRIPTIONS.s.length).toBeGreaterThan(0);
  });
});

describe('floor spear marker', () => {
  it('brokenBar-hasASpriteCroppingTheWholeSpearsTile', () => {
    expect(PALETTE_TILE_SPRITES['¦']).toEqual({
      sheet: '/sprites/spears.png',
      sheetWidth: 32,
      sheetHeight: 32,
      sx: 0,
      sy: 0,
      frameWidth: 32,
      frameHeight: 32,
    });
  });

  it('brokenBar-hasAHumanReadableLabel', () => {
    expect(PALETTE_TILE_LABELS['¦']).toBe('Floor Spear');
  });

  it('brokenBar-hasANonEmptyDescription', () => {
    expect(PALETTE_TILE_DESCRIPTIONS['¦'].length).toBeGreaterThan(0);
  });
});

describe('HAZARD_PALETTE_KEYS', () => {
  it('containsExactlyOneKeyPerRegisteredHazardKindInRegistrationOrder', () => {
    // One representative character per hazard kind, derived from HAZARD_CHARS
    // rather than hand-listed: the first key of each kind in registration
    // order.
    const expected: string[] = [];
    for (const char of Object.keys(HAZARD_CHARS)) {
      const kind = HAZARD_CHARS[char]!.hazardType;
      const alreadyRepresented = expected.some(
        (key) => HAZARD_CHARS[key]!.hazardType === kind,
      );
      if (!alreadyRepresented) expected.push(char);
    }
    expect(HAZARD_PALETTE_KEYS).toEqual(expected);
    expect(HAZARD_PALETTE_KEYS).toEqual(['^', '¦']);
  });

  it('hasNoDuplicates', () => {
    expect(new Set(HAZARD_PALETTE_KEYS).size).toBe(HAZARD_PALETTE_KEYS.length);
  });

  it('everyKeyHasAPaletteLabelAndSprite', () => {
    for (const key of HAZARD_PALETTE_KEYS) {
      expect(PALETTE_TILE_LABELS[key]).toBeTruthy();
      expect(PALETTE_TILE_SPRITES[key]).toBeTruthy();
    }
  });
});

