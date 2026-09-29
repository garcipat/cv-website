import { describe, it, expect } from 'vitest';
import {
  PALETTE_TOOLS,
  terrainPaletteTools,
  HAZARD_PALETTE_KEYS,
  BLUEPRINT_GLYPH,
  PATROL_GLYPH,
  CONNECTION_POINT_GLYPH,
  type TileSpriteSpec,
} from './paletteTiles';
import { ENTITY_CHARS, SIGN_CHAR, HAZARD_CHARS } from '../../level/LevelParser';
import { TERRAIN_CHARS, TILE_MODULES } from '../../tiles/registry';
import type { EditorTool } from '../editorState';

describe('PALETTE_TOOLS', () => {
  it('has an entry for every TERRAIN_CHARS, ENTITY_CHARS, SIGN_CHAR and marker-tool key', () => {
    const allKeys: EditorTool[] = [
      ...(Object.keys(TERRAIN_CHARS) as EditorTool[]),
      ...(Object.keys(ENTITY_CHARS) as EditorTool[]),
      SIGN_CHAR,
      'patrolBoundary',
      'connectionPoint',
      'fallingStalactite',
    ];
    for (const key of allKeys) {
      expect(Object.keys(PALETTE_TOOLS)).toContain(key);
    }
  });

  it('maps "." (Eraser) to null — no sprite', () => {
    expect(PALETTE_TOOLS['.'].sprite).toBeNull();
  });

  it('maps "patrolBoundary" to null — it is invisible, so it has no sprite', () => {
    expect(PALETTE_TOOLS.patrolBoundary.sprite).toBeNull();
  });

  it('gives every sprite-less tool a glyph so the palette never shows two blank squares', () => {
    // '.' (Eraser), 'patrolBoundary' and 'connectionPoint' are the tools with
    // no sprite; without a glyph to tell them apart they would render as
    // identical empty squares. The Eraser is the deliberate exception — an
    // empty square already reads as "erase".
    const spriteless = (Object.keys(PALETTE_TOOLS) as EditorTool[]).filter(
      (key) => PALETTE_TOOLS[key].sprite === null,
    );
    expect([...spriteless].sort()).toEqual(['.', 'connectionPoint', 'patrolBoundary'].sort());
    expect(PALETTE_TOOLS['.'].glyph).toBeUndefined();
    expect(PALETTE_TOOLS.patrolBoundary.glyph).toBeTruthy();
    expect(PALETTE_TOOLS.connectionPoint.glyph).toBeTruthy();
  });

  it('gives every non-sprite-less tool a spec with a positive frame size', () => {
    const keys = Object.keys(PALETTE_TOOLS) as EditorTool[];
    for (const key of keys) {
      const spec = PALETTE_TOOLS[key].sprite;
      if (spec === null) continue;
      expect(spec.frameWidth).toBeGreaterThan(0);
      expect(spec.frameHeight).toBeGreaterThan(0);
      expect(spec.sheetWidth).toBeGreaterThanOrEqual(spec.sx + spec.frameWidth);
      expect(spec.sheetHeight).toBeGreaterThanOrEqual(spec.sy + spec.frameHeight);
    }
  });

  it('describes every tool, so no palette button hovers without an explanation', () => {
    const keys = Object.keys(PALETTE_TOOLS) as EditorTool[];
    for (const key of keys) {
      expect(PALETTE_TOOLS[key].description).toBeTruthy();
    }
  });

  it('describes the patrol boundary by the two things that are not visible about it', () => {
    expect(PALETTE_TOOLS.patrolBoundary.description).toMatch(/invisible in game/i);
  });

  it('labels the patrol boundary by what it does, not by its character', () => {
    expect(PALETTE_TOOLS.patrolBoundary.label).toBe('Patrol Boundary');
  });

  it('uses the coin sprite sheet for the coin tile', () => {
    expect(PALETTE_TOOLS.o.sprite?.sheet).toBe('/sprites/coin.png');
  });

  it('uses the chest-closed sprite for the chest tile, sized to the whole image', () => {
    expect(PALETTE_TOOLS.$.sprite).toEqual({
      sheet: '/sprites/chest_closed.png',
      sheetWidth: 28,
      sheetHeight: 20,
      sx: 0,
      sy: 0,
      frameWidth: 28,
      frameHeight: 20,
    });
  });

  it('star-hasASpritePreviewADescriptionAndALabel', () => {
    expect(PALETTE_TOOLS.A.sprite).toEqual({
      sheet: '/sprites/spikes.png',
      sheetWidth: 48,
      sheetHeight: 20,
      sx: 0,
      sy: 0,
      frameWidth: 16,
      frameHeight: 20,
      overlay: { sx: 32, sy: 4, frameHeight: 16 },
    });
    expect(PALETTE_TOOLS.A.description).toMatch(/floor spike/i);
    expect(PALETTE_TOOLS.A.label).toBe('Floor Spike');
  });
});

describe('PALETTE_TOOLS — labels', () => {
  it('has a non-empty label for every TERRAIN_CHARS, ENTITY_CHARS and SIGN_CHAR key', () => {
    const allKeys: EditorTool[] = [
      ...(Object.keys(TERRAIN_CHARS) as EditorTool[]),
      ...(Object.keys(ENTITY_CHARS) as EditorTool[]),
      SIGN_CHAR,
    ];
    for (const key of allKeys) {
      expect(PALETTE_TOOLS[key].label).toBeTruthy();
    }
  });

  it('labels "." as Eraser', () => {
    expect(PALETTE_TOOLS['.'].label).toBe('Eraser');
  });
});

describe('PALETTE_TOOLS — sprite specs', () => {
  it('theSignCharacter-hasASpriteMatchingTheInGameSignpostTile', () => {
    expect(PALETTE_TOOLS[SIGN_CHAR].sprite).toEqual({
      sheet: '/sprites/world_tileset.png',
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 128,
      sy: 48,
      frameWidth: 16,
      frameHeight: 16,
    });
  });

  it('theSignCharacter-hasAHumanReadableLabel', () => {
    expect(PALETTE_TOOLS[SIGN_CHAR].label).toBe('Sign');
  });

  it('C-hasASpriteCroppingTheRaisedFrameOfTheFlagStrip', () => {
    expect(PALETTE_TOOLS.C.sprite).toEqual({
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
    expect(PALETTE_TOOLS.C.label).toBe('Checkpoint');
  });

  it('C-describesTheFinishedLevelBehaviour', () => {
    expect(PALETTE_TOOLS.C.description).toBe('Checkpoint; step on it to set your respawn point');
  });

  it('p-hasASpriteMatchingThePurpleBottleFrame', () => {
    expect(PALETTE_TOOLS.p.sprite).toEqual({
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
    expect(PALETTE_TOOLS.p.label).toBe('Potion Pot');
  });

  it('b-hasASpriteMatchingTheBlueBottleFrame', () => {
    expect(PALETTE_TOOLS.b.sprite).toEqual({
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
    expect(PALETTE_TOOLS.b.label).toBe('Bomb Pot');
  });

  it('b-describesTheFinishedLevelBehaviour', () => {
    expect(PALETTE_TOOLS.b.description).toBe(
      'Bomb-pot; land on it from above to break it and drop a bomb you can place',
    );
  });

  it('G-hasASpriteCompositingGrassOverTheGroundBlock', () => {
    expect(PALETTE_TOOLS.G.sprite).toEqual({
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

  it('n-hasANonNullSprite', () => {
    expect(PALETTE_TOOLS.n.sprite).not.toBeNull();
  });

  it('N-hasANonNullSprite', () => {
    expect(PALETTE_TOOLS.N.sprite).not.toBeNull();
  });

  it('nAndN-haveNonEmptyLabelsAndDescriptions', () => {
    expect(PALETTE_TOOLS.n.label.length).toBeGreaterThan(0);
    expect(PALETTE_TOOLS.N.label.length).toBeGreaterThan(0);
    expect(PALETTE_TOOLS.n.description.length).toBeGreaterThan(0);
    expect(PALETTE_TOOLS.N.description.length).toBeGreaterThan(0);
  });

  it('q-hasASpriteCroppingTheFirstFlyFrame', () => {
    expect(PALETTE_TOOLS.q.sprite).toEqual({
      sheet: '/sprites/bee.png',
      sheetWidth: 192,
      sheetHeight: 168,
      sx: 0,
      sy: 96,
      frameWidth: 24,
      frameHeight: 24,
    });
  });

  it('q-hasAHumanReadableLabel', () => {
    expect(PALETTE_TOOLS.q.label).toBe('Bee');
  });

  it('q-hasANonEmptyDescription', () => {
    expect(PALETTE_TOOLS.q.description).toBeTruthy();
  });

  it('yen-hasASpriteCroppingTheTorchSheetsFirstFrame', () => {
    expect(PALETTE_TOOLS['¥'].sprite).toEqual({
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
    expect(PALETTE_TOOLS['¥'].label).toBe('Torch');
  });

  it('yen-hasANonEmptyDescription', () => {
    expect(PALETTE_TOOLS['¥'].description).toBeTruthy();
  });

  it('sectionSign-hasASpriteCroppingTheCompleteMushroom', () => {
    expect(PALETTE_TOOLS['§'].sprite).toEqual({
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
    expect(PALETTE_TOOLS.s.sprite).toEqual({
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
    expect(PALETTE_TOOLS['§'].label).toBe('Bouncy Mushroom');
  });

  it('s-hasAHumanReadableLabel', () => {
    expect(PALETTE_TOOLS.s.label).toBe('Small Mushroom');
  });

  it('bothMushrooms-haveNonEmptyDescriptions', () => {
    expect(PALETTE_TOOLS['§'].description.length).toBeGreaterThan(0);
    expect(PALETTE_TOOLS.s.description.length).toBeGreaterThan(0);
  });

  it('brokenBar-hasASpriteCroppingTheWholeSpearsTile', () => {
    expect(PALETTE_TOOLS['¦'].sprite).toEqual({
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
    expect(PALETTE_TOOLS['¦'].label).toBe('Floor Spear');
  });

  it('brokenBar-hasANonEmptyDescription', () => {
    expect(PALETTE_TOOLS['¦'].description.length).toBeGreaterThan(0);
  });

  it('theFallingTool-hasASpriteCroppingTheLargeStalactiteWithAReddishTint', () => {
    expect(PALETTE_TOOLS.fallingStalactite.sprite).toEqual({
      sheet: '/sprites/decorations.png',
      sheetWidth: 67,
      sheetHeight: 35,
      sx: 51,
      sy: 0,
      frameWidth: 16,
      frameHeight: 17,
      tint: 'rgba(220, 38, 38, 0.45)',
    });
  });

  it('theFallingTool-hasAHumanReadableLabelDistinctFromTheDecoration', () => {
    expect(PALETTE_TOOLS.fallingStalactite.label).toBe('Falling Stalactite');
    expect(PALETTE_TOOLS.fallingStalactite.label).not.toBe(PALETTE_TOOLS['⊤'].label);
  });

  it('theFallingTool-hasADescriptionDistinctFromTheDecoration', () => {
    expect(PALETTE_TOOLS.fallingStalactite.description).toBeTruthy();
    expect(PALETTE_TOOLS.fallingStalactite.description).not.toBe(PALETTE_TOOLS['⊤'].description);
  });

  it('theDecorativeStalactite-hasNoTint', () => {
    expect(PALETTE_TOOLS['⊤'].sprite?.tint).toBeUndefined();
  });
});

describe('BLUEPRINT_GLYPH', () => {
  it('gives a blueprint tile its own glyph, distinct from the other sprite-less tools', () => {
    expect(BLUEPRINT_GLYPH).toBeTruthy();
    expect(BLUEPRINT_GLYPH).not.toBe(PATROL_GLYPH);
    expect(BLUEPRINT_GLYPH).not.toBe(CONNECTION_POINT_GLYPH);
  });
});

describe('blueprint connection point marker', () => {
  it('maps "connectionPoint" to null — like the patrol boundary, it has no in-game sprite', () => {
    expect(PALETTE_TOOLS.connectionPoint.sprite).toBeNull();
  });

  it('gives "connectionPoint" a glyph, so it is not a second blank square next to the patrol boundary', () => {
    expect(PALETTE_TOOLS.connectionPoint.glyph).toBeTruthy();
    expect(PALETTE_TOOLS.connectionPoint.glyph).not.toBe(PALETTE_TOOLS.patrolBoundary.glyph);
  });

  it('labels "connectionPoint" by what it is, not by its character', () => {
    expect(PALETTE_TOOLS.connectionPoint.label).toBe('Connection Point');
  });

  it('describes "connectionPoint" by where it belongs and what it is for', () => {
    expect(PALETTE_TOOLS.connectionPoint.description).toBe(
      'Blueprint only; marks a border cell another blueprint can attach to',
    );
  });
});

describe('TileSpriteSpec tint', () => {
  it('tint-isOptional', () => {
    const spec: TileSpriteSpec = {
      sheet: '/sprites/decorations.png',
      sheetWidth: 67,
      sheetHeight: 35,
      sx: 51,
      sy: 0,
      frameWidth: 16,
      frameHeight: 17,
    };
    expect(spec.tint).toBeUndefined();
  });
});

describe('HAZARD_PALETTE_KEYS', () => {
  it('containsExactlyOneKeyPerRegisteredHazardKindInRegistrationOrder', () => {
    const expected: string[] = [];
    for (const char of Object.keys(HAZARD_CHARS)) {
      const kind = HAZARD_CHARS[char]!.hazardType;
      const alreadyRepresented = expected.some((key) => HAZARD_CHARS[key]!.hazardType === kind);
      if (!alreadyRepresented) expected.push(char);
    }
    expect(HAZARD_PALETTE_KEYS).toEqual(expected);
    expect(HAZARD_PALETTE_KEYS).toEqual(['^', '¦', 'A']);
  });

  it('hasNoDuplicates', () => {
    expect(new Set(HAZARD_PALETTE_KEYS).size).toBe(HAZARD_PALETTE_KEYS.length);
  });

  it('everyKeyHasAPaletteLabelAndSprite', () => {
    for (const key of HAZARD_PALETTE_KEYS) {
      expect(PALETTE_TOOLS[key].label).toBeTruthy();
      expect(PALETTE_TOOLS[key].sprite).toBeTruthy();
    }
  });
});

describe('PALETTE_TOOLS grouping', () => {
  const keysInGroup = (group: string) =>
    (Object.keys(PALETTE_TOOLS) as EditorTool[]).filter(
      (key) => PALETTE_TOOLS[key].group === group,
    );

  it('placesEachToolInTheSameGroupAsBefore', () => {
    expect(keysInGroup('terrain')).toEqual(['G', 'R', '#', 'B', 'H', 'I', '@', '§', 'g']);
    expect(keysInGroup('decoration')).toEqual(['n', 'N', 'X', 'c', '⊤', '⊥', '¥', 's']);
    expect(keysInGroup('entities')).toEqual([
      'S',
      'M',
      'm',
      'q',
      'o',
      '=',
      '?',
      'F',
      'u',
      'p',
      'b',
      '$',
      'C',
    ]);
    // The spike's facing variants carry the hazards group too but are never
    // rendered as separate buttons (see Palette.tsx's HAZARD_PALETTE_KEYS).
    expect(keysInGroup('hazards')).toEqual(['^', 'v', '<', '>', '¦', 'A', 'fallingStalactite']);
    expect(keysInGroup('tools')).toEqual(['T', 'patrolBoundary', 'connectionPoint', '.']);
  });

  it('keepsTheEraserLastInTheToolsGroup', () => {
    const tools = keysInGroup('tools');
    expect(tools.at(-1)).toBe('.');
  });

  it('keepsTheEightDecorationCharsInDecorationAndNotTerrain', () => {
    const decoration = keysInGroup('decoration');
    expect(decoration).toEqual(['n', 'N', 'X', 'c', '⊤', '⊥', '¥', 's']);
    for (const key of decoration) {
      expect(keysInGroup('terrain')).not.toContain(key);
    }
  });
});

describe('terrainPaletteTools', () => {
  it('returnsExactlyTheDescriptorKeysWhoseGroupIsTerrain', () => {
    const terrainKeys = (Object.keys(PALETTE_TOOLS) as EditorTool[]).filter(
      (key) => PALETTE_TOOLS[key].group === 'terrain',
    );
    expect(
      terrainPaletteTools()
        .map((tool) => tool.char)
        .sort(),
    ).toEqual([...terrainKeys].sort());
  });

  it('readsCharFogExemptAndDrawBandFromTileModules', () => {
    for (const tool of terrainPaletteTools()) {
      const module = TILE_MODULES[tool.tileType];
      expect(tool.char).toBe((module as { char?: string }).char);
      expect(tool.fogExempt).toBe(module.fogExempt);
      expect(tool.drawBand).toBe(module.drawBand);
    }
  });

  it('excludesTheEraserAndTheDecorationChars', () => {
    const chars = terrainPaletteTools().map((tool) => tool.char);
    expect(chars).not.toContain('.');
    for (const decoration of ['n', 'N', 'X', 'c', '⊤', '⊥', '¥', 's']) {
      expect(chars).not.toContain(decoration);
    }
    // ropeLadder is registry-only (no author-placeable char), so no terrain
    // tool can carry its kind; every returned tool maps to a real module char.
    for (const tool of terrainPaletteTools()) {
      expect((TILE_MODULES[tool.tileType] as { char?: string }).char).toBe(tool.char);
    }
  });
});
