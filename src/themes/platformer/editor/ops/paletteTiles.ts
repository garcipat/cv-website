import type { TileChar } from '../../level/LevelParser';
import { HAZARD_CHARS } from '../../level/LevelParser';
import { TILE_MODULES } from '../../tiles/registry';
import type { TileDrawBand } from '../../tiles/TileModule';
import type { TileType } from '../../level/LevelData';
import type { EditorTool } from '../editorState';

/**
 * A crop rectangle (native, un-scaled pixels) into a sprite sheet image,
 * plus the sheet's own native dimensions — everything a CSS "sprite
 * cropping" technique (an `<img>` of the whole sheet, absolutely positioned
 * inside an `overflow: hidden` box) needs, with no runtime image
 * measurement. Coordinates are hand-picked to match the exact frame the
 * real engine renders for that tile/marker's "at rest" state (see the matching
 * `tiles/<kind>.ts` `draw`, and `coinFrameIndex`/`enemyFrameIndex`/
 * `blockFrameSource`/`playerFrameSource` in the respective entity files) —
 * this is a palette icon, not a live game sprite, so it intentionally
 * doesn't reuse those functions' animation/context-dependent logic; it just
 * needs one representative, correct-looking icon per tile.
 */
export interface TileSpriteSpec {
  sheet: string;
  sheetWidth: number;
  sheetHeight: number;
  sx: number;
  sy: number;
  frameWidth: number;
  frameHeight: number;
  /** Shifts the base sprite DOWN within its icon box by this many source
   *  px (scaled the same as everything else), without changing what's
   *  cropped from the sheet. Every existing tile omits this (defaults to
   *  0, unchanged). `g`'s ledge art is top-aligned within its own 16x16
   *  cell (rows 0-8 opaque, 9-15 transparent) — the same shape the live
   *  game renders — but the palette icon reads better nudged down a
   *  little rather than sitting flush against the box's own top edge. */
  topOffset?: number;
  /**
   * A translucent reddish wash drawn over the sprite in the palette (and, via
   * the same value, on the editor grid) to mark an otherwise camouflage hazard
   * — the falling stalactite (`T`), whose in-game art is pixel-identical to
   * the decorative `⊤`. Editor-only: the live game never reads this field, so
   * a hanging hazard stays untinted in play (O-027 FR-017/SC-001). Omitted for
   * every existing tile, unchanged.
   */
  tint?: string;
  /**
   * A second crop of the SAME sheet, drawn over the base crop at the same
   * scale and offset by its own `sx`/`sy`. Ground cells carry no grass — the
   * engine draws grass as a separate overlay pass — so a swatch that should
   * look like grassy ground composites the two the same way the renderer
   * does. `sheet`/`sheetWidth`/`sheetHeight` default to the base spec's own
   * when omitted; an overlay with its own `frameHeight` (shorter than the
   * base's) is clipped to that window and anchored per `anchor` (`'bottom'`,
   * the default, reads as emerging from the ground; `'top'` sits flush with
   * the base's own top edge). Omitted, behaviour is byte-for-byte identical
   * to before this field existed.
   */
  overlay?: {
    sheet?: string;
    sheetWidth?: number;
    sheetHeight?: number;
    sx: number;
    sy: number;
    frameHeight?: number;
    anchor?: 'top' | 'bottom';
  };
}

const WORLD_TILESET = '/sprites/world_tileset.png';
const TILE_ATLAS = '/sprites/tile_atlas.png';
const DECORATIONS = '/sprites/decorations.png';
const DECORATIONS_SHEET_WIDTH = 67;
const DECORATIONS_SHEET_HEIGHT = 35;

/** The group a palette tool is rendered under. Grouping is authoring
 *  metadata (the tile registry carries none), so it lives here. */
export type PaletteGroup =
  | 'terrain'
  | 'decoration'
  | 'entities'
  | 'hazards'
  | 'tools'
  | 'blueprints';

/** One palette entry: everything a palette button needs, plus its group. */
export interface PaletteTool {
  label: string;
  description: string;
  sprite: TileSpriteSpec | null;
  /** Empty-square glyph when `sprite` is `null`. */
  glyph?: string;
  group: PaletteGroup;
}

/**
 * The one palette descriptor (FR-007). Keyed by `EditorTool`, in the exact
 * order the palette renders its groups: terrain, decoration, entities,
 * hazards, tools (sign, patrol boundary, connection point, Eraser last). It
 * is the single source of each tool's label, description, sprite spec, glyph
 * and grouping — adding a tool is one descriptor entry.
 *
 * Terrain **membership and the `char`/`fogExempt`/`drawBand` flags** come from
 * R-015's shipped `TILE_MODULES` registry (never a palette-local table); see
 * `terrainPaletteTools()`. The icon sprite stays here because R-015 carries no
 * palette icon metadata (FR-008).
 */
export const PALETTE_TOOLS: Record<EditorTool, PaletteTool> = {
  // --- Terrain ---------------------------------------------------------
  G: {
    label: 'Ground Grass',
    description: 'Solid earth; grows a grass top wherever it is exposed',
    sprite: {
      sheet: TILE_ATLAS,
      sheetWidth: 130,
      sheetHeight: 54,
      sx: 114,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
      overlay: { sx: 76, sy: 38 },
    },
    group: 'terrain',
  },
  R: {
    label: 'Ground Rock',
    description: 'Solid stone, for exposed rock faces and cave floors',
    sprite: {
      sheet: WORLD_TILESET,
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 16,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'terrain',
  },
  '#': {
    label: 'Wall',
    description: 'Solid wall block',
    sprite: {
      sheet: WORLD_TILESET,
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 128,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'terrain',
  },
  B: {
    label: 'Bridge',
    description: 'Solid from above; the player drops through it with Down',
    sprite: {
      sheet: WORLD_TILESET,
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 160,
      sy: 32,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'terrain',
  },
  H: {
    label: 'Ladder',
    description: 'Climbed with Up and Down',
    sprite: {
      sheet: WORLD_TILESET,
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 144,
      sy: 48,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'terrain',
  },
  I: {
    label: 'Chain',
    description:
      'Chain; climbs like a ladder, art hugs whichever wall (if any) it hangs against',
    sprite: {
      // The ceiling-attachment "cap" piece — not 16x16 like most other
      // entries, since chain art keeps its own true native size rather than
      // fit the tile grid.
      sheet: '/sprites/staticObjects.png',
      sheetWidth: 288,
      sheetHeight: 144,
      sx: 91,
      sy: 101,
      frameWidth: 5,
      frameHeight: 13,
    },
    group: 'terrain',
  },
  '@': {
    label: 'Rope Ladder Bundle',
    description:
      'Rope ladder bundle; press Up while standing on it to unroll a rope ladder down to the ground below',
    sprite: {
      sheet: '/sprites/rope_ladder.png',
      sheetWidth: 32,
      sheetHeight: 32,
      sx: 0,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'terrain',
  },
  '§': {
    label: 'Bouncy Mushroom',
    description: 'Land on its cap to be launched upward; walk and jump through it freely',
    sprite: {
      sheet: '/sprites/mushroom.png',
      sheetWidth: 64,
      sheetHeight: 64,
      sx: 0,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'terrain',
  },
  g: {
    label: 'Crumbling Floor',
    description:
      'Cracks and shakes underfoot, then breaks and falls away; reforms after a short delay',
    // crumble_floor.png is a 48x16 strip (3 frames): left cap, middle, right
    // cap. The palette icon previews the "single" variant (sx 48), rounded on
    // both edges, matching how a freshly-placed isolated tile renders. The
    // overlay composites crumble_cracks.png's frame 2 (heavy cracking) on
    // top, top-anchored like the live compositing.
    sprite: {
      sheet: '/sprites/crumble_floor.png',
      sheetWidth: 64,
      sheetHeight: 16,
      sx: 48,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
      topOffset: 4,
      overlay: {
        sheet: '/sprites/crumble_cracks.png',
        sheetWidth: 48,
        sheetHeight: 8,
        sx: 32,
        sy: 0,
        frameHeight: 8,
        anchor: 'top',
      },
    },
    group: 'terrain',
  },

  // --- Decoration ------------------------------------------------------
  n: {
    label: 'Bush / Tree',
    description: 'Bush; stack vertically to grow a tree (root, trunk, canopy)',
    sprite: {
      sheet: WORLD_TILESET,
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 16,
      sy: 48,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'decoration',
  },
  N: {
    label: 'Fence',
    description: 'Fence',
    sprite: {
      sheet: '/sprites/staticObjects.png',
      sheetWidth: 288,
      sheetHeight: 144,
      sx: 32,
      sy: 64,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'decoration',
  },
  X: {
    label: 'Cobweb',
    description: 'Cobweb; purely decorative, auto-orients to nearby solid terrain',
    sprite: {
      sheet: DECORATIONS,
      sheetWidth: DECORATIONS_SHEET_WIDTH,
      sheetHeight: DECORATIONS_SHEET_HEIGHT,
      sx: 17,
      sy: 0,
      frameWidth: 16,
      frameHeight: 17,
    },
    group: 'decoration',
  },
  c: {
    label: 'Crystal Cluster',
    description: 'Crystal cluster; purely decorative',
    sprite: {
      sheet: DECORATIONS,
      sheetWidth: DECORATIONS_SHEET_WIDTH,
      sheetHeight: DECORATIONS_SHEET_HEIGHT,
      sx: 33,
      sy: 0,
      frameWidth: 18,
      frameHeight: 18,
    },
    group: 'decoration',
  },
  '⊤': {
    label: 'Stalactite',
    description: 'Stalactite; purely decorative, auto-picks a size variant. Never falls',
    sprite: {
      sheet: DECORATIONS,
      sheetWidth: DECORATIONS_SHEET_WIDTH,
      sheetHeight: DECORATIONS_SHEET_HEIGHT,
      sx: 51,
      sy: 0,
      frameWidth: 16,
      frameHeight: 17,
    },
    group: 'decoration',
  },
  '⊥': {
    label: 'Stalagmite',
    description: 'Stalagmite; purely decorative, auto-picks a size variant',
    sprite: {
      sheet: DECORATIONS,
      sheetWidth: DECORATIONS_SHEET_WIDTH,
      sheetHeight: DECORATIONS_SHEET_HEIGHT,
      sx: 17,
      sy: 17,
      frameWidth: 16,
      frameHeight: 18,
    },
    group: 'decoration',
  },
  '¥': {
    label: 'Torch',
    description:
      'Wall torch; lights the cave. Click it again on the canvas to raise its light strength (0-9)',
    sprite: {
      // Frame 0 of torch.png's 48x14 strip — a representative still, since
      // the in-game frame animates by position hash + world clock.
      sheet: '/sprites/torch.png',
      sheetWidth: 48,
      sheetHeight: 14,
      sx: 0,
      sy: 0,
      frameWidth: 12,
      frameHeight: 14,
    },
    group: 'decoration',
  },
  s: {
    label: 'Small Mushroom',
    description: 'Small mushroom; purely decorative, no effect',
    sprite: {
      sheet: '/sprites/mushroom.png',
      sheetWidth: 64,
      sheetHeight: 64,
      sx: 32,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'decoration',
  },

  // --- Entities --------------------------------------------------------
  S: {
    label: 'Spawn',
    description: 'Where the player starts',
    sprite: {
      sheet: '/sprites/knight.png',
      sheetWidth: 256,
      sheetHeight: 288,
      sx: 0,
      sy: 0,
      frameWidth: 32,
      frameHeight: 32,
    },
    group: 'entities',
  },
  M: {
    label: 'Enemy Green',
    description: 'Green slime; stomping it reveals one CV fact',
    sprite: {
      sheet: '/sprites/slime_green.png',
      sheetWidth: 96,
      sheetHeight: 72,
      sx: 72,
      sy: 0,
      frameWidth: 24,
      frameHeight: 24,
    },
    group: 'entities',
  },
  m: {
    label: 'Enemy Purple',
    description: 'Purple slime; stomping it drops a key',
    sprite: {
      sheet: '/sprites/slime_purple.png',
      sheetWidth: 96,
      sheetHeight: 72,
      sx: 72,
      sy: 0,
      frameWidth: 24,
      frameHeight: 24,
    },
    group: 'entities',
  },
  q: {
    label: 'Bee',
    description: 'Bee; flies over gaps, stompable like a green slime, reveals nothing',
    sprite: {
      // The first frame of the bee's fly loop (sheet frame 32 = row 5 col 0).
      sheet: '/sprites/bee.png',
      sheetWidth: 192,
      sheetHeight: 168,
      sx: 0,
      sy: 96,
      frameWidth: 24,
      frameHeight: 24,
    },
    group: 'entities',
  },
  o: {
    label: 'Coin',
    description: 'Coin; collecting it reveals one skill category',
    sprite: {
      sheet: '/sprites/coin.png',
      sheetWidth: 192,
      sheetHeight: 16,
      sx: 0,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'entities',
  },
  '=': {
    label: 'Crate',
    description: 'Crate block; hit it from below to reveal a CV fact',
    sprite: {
      sheet: WORLD_TILESET,
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 112,
      sy: 48,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'entities',
  },
  '?': {
    label: 'Question Mark',
    description: 'Question block; hit it from below to pop a bonus fruit',
    sprite: {
      sheet: WORLD_TILESET,
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 0,
      sy: 32,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'entities',
  },
  F: {
    label: 'Fragile Rock',
    description: 'Fragile rock; hit it from below to break it open',
    sprite: {
      sheet: WORLD_TILESET,
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 48,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'entities',
  },
  u: {
    label: 'Coin Pot',
    description: 'Coin-pot; land on it from above to break it and drop a coin',
    sprite: {
      sheet: '/sprites/staticObjects.png',
      sheetWidth: 288,
      sheetHeight: 144,
      sx: 0,
      sy: 112,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'entities',
  },
  p: {
    label: 'Potion Pot',
    description:
      'Potion-pot; land on it from above to break it and drop a heart that heals half a heart',
    sprite: {
      sheet: WORLD_TILESET,
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 16,
      sy: 128,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'entities',
  },
  b: {
    label: 'Bomb Pot',
    description:
      'Bomb-pot; land on it from above to break it and drop a bomb you can place',
    sprite: {
      // Row 8, column 0 of world_tileset.png — the blue bottle left of the
      // potion pot's red bottle (see entities/blocks/BombPot.ts, O-012).
      sheet: WORLD_TILESET,
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 0,
      sy: 128,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'entities',
  },
  $: {
    label: 'Chest',
    description: 'Chest; costs a key, and holds one experience entry',
    sprite: {
      sheet: '/sprites/chest_closed.png',
      sheetWidth: 28,
      sheetHeight: 20,
      sx: 0,
      sy: 0,
      frameWidth: 28,
      frameHeight: 20,
    },
    group: 'entities',
  },
  C: {
    label: 'Checkpoint',
    description: 'Checkpoint; step on it to set your respawn point',
    sprite: {
      // The RAISED frame (index 3 -> sx 48) of the 4-frame flag strip.
      sheet: '/sprites/checkpoint-flag-strip.png',
      sheetWidth: 64,
      sheetHeight: 24,
      sx: 48,
      sy: 0,
      frameWidth: 16,
      frameHeight: 24,
    },
    group: 'entities',
  },

  // --- Hazards ---------------------------------------------------------
  '^': {
    label: 'Spike',
    description:
      'Spike; auto-orients to solid terrain nearby, click an already-placed one again to cycle its facing',
    sprite: {
      sheet: '/sprites/staticObjects.png',
      sheetWidth: 288,
      sheetHeight: 144,
      sx: 48,
      sy: 112,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'hazards',
  },
  v: {
    // Not rendered as its own palette button (the palette shows one button per
    // hazard KIND via HAZARD_PALETTE_KEYS); a facing variant must still have a
    // descriptor because `PALETTE_TOOLS` is keyed by every `EditorTool`.
    label: 'Spike Down',
    description: 'Spike (ceiling); damages the player on touch',
    sprite: {
      sheet: '/sprites/staticObjects.png',
      sheetWidth: 288,
      sheetHeight: 144,
      sx: 64,
      sy: 96,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'hazards',
  },
  '<': {
    label: 'Spike Left',
    description: 'Spike (right wall); damages the player on touch',
    sprite: {
      sheet: '/sprites/staticObjects.png',
      sheetWidth: 288,
      sheetHeight: 144,
      sx: 64,
      sy: 112,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'hazards',
  },
  '>': {
    label: 'Spike Right',
    description: 'Spike (left wall); damages the player on touch',
    sprite: {
      sheet: '/sprites/staticObjects.png',
      sheetWidth: 288,
      sheetHeight: 144,
      sx: 48,
      sy: 96,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'hazards',
  },
  '¦': {
    label: 'Floor Spear',
    description:
      'Floor spear; falling onto its points is fatal, walking or climbing through is safe',
    sprite: {
      // The whole standalone 32x32 spears.png tile, drawn 1:1 in game.
      sheet: '/sprites/spears.png',
      sheetWidth: 32,
      sheetHeight: 32,
      sx: 0,
      sy: 0,
      frameWidth: 32,
      frameHeight: 32,
    },
    group: 'hazards',
  },
  A: {
    label: 'Floor Spike',
    description:
      'Floor spike; hidden until triggered — a visitor stepping on it starts a delayed warning-then-strike cycle, then it retracts and re-arms',
    sprite: {
      // The at-rest tell (frame 0) as the base, with a bottom-anchored slice
      // of the spike frame (frame 2, x offset 32) composited on top.
      sheet: '/sprites/spikes.png',
      sheetWidth: 48,
      sheetHeight: 20,
      sx: 0,
      sy: 0,
      frameWidth: 16,
      frameHeight: 20,
      overlay: { sx: 32, sy: 4, frameHeight: 16 },
    },
    group: 'hazards',
  },
  fallingStalactite: {
    label: 'Falling Stalactite',
    description:
      'Stalactite; looks decorative until a visitor walks beneath it, then shakes and drops',
    sprite: {
      // The large stalactite crop with a reddish tint so it reads as the
      // falling variant, distinct from the untinted decorative `⊤`.
      sheet: DECORATIONS,
      sheetWidth: DECORATIONS_SHEET_WIDTH,
      sheetHeight: DECORATIONS_SHEET_HEIGHT,
      sx: 51,
      sy: 0,
      frameWidth: 16,
      frameHeight: 17,
      tint: 'rgba(220, 38, 38, 0.45)',
    },
    group: 'hazards',
  },

  // --- Tools (Eraser last) ---------------------------------------------
  T: {
    label: 'Sign',
    description: 'Hint sign; click it again on the canvas to cycle its hint',
    // Every sign shares the signpost sprite — the hint is carried by the
    // `sign` marker and shown as a corner badge, not by the art.
    sprite: {
      sheet: WORLD_TILESET,
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 128,
      sy: 48,
      frameWidth: 16,
      frameHeight: 16,
    },
    group: 'tools',
  },
  patrolBoundary: {
    label: 'Patrol Boundary',
    description: 'Invisible in game; turns patrolling enemies around. Paints over any tile',
    sprite: null,
    glyph: '⇄',
    group: 'tools',
  },
  connectionPoint: {
    label: 'Connection Point',
    description: 'Blueprint only; marks a border cell another blueprint can attach to',
    sprite: null,
    glyph: '⊕',
    group: 'tools',
  },
  '.': {
    label: 'Eraser',
    description: 'Clears a tile back to empty',
    sprite: null,
    group: 'tools',
  },
};

/** The turn-around character standing in for the patrol boundary's missing
 *  sprite — in the palette button and on the tile itself in the editor canvas
 *  (`EditorCanvas.tsx` re-exports it as `PATROL_MARKER_GLYPH`). */
export const PATROL_GLYPH = '⇄';

/** The socket character standing in for the blueprint connection point's
 *  missing sprite. Deliberately distinct from `PATROL_GLYPH`: both tiles are
 *  sprite-less markers and would otherwise be indistinguishable. */
export const CONNECTION_POINT_GLYPH = '⊕';

/** The room character standing in for a saved blueprint's missing sprite in the
 *  Palette's Blueprints section. Distinct from the other two glyphs; not part
 *  of `PALETTE_TOOLS`, since a blueprint is not a tile character. */
export const BLUEPRINT_GLYPH = '▦';

/**
 * One representative character per registered hazard kind, in registration
 * order — the palette shows a kind, not a facing. Derived from `HAZARD_CHARS`
 * (the first key of each `hazardType`), never hand-listed, so a future hazard
 * kind needs no palette edit here. Kept as a derived helper (not one of the
 * removed tables); the falling stalactite is a marker tool now, not a hazard
 * character, so it is not in this list.
 */
export const HAZARD_PALETTE_KEYS: TileChar[] = (() => {
  const keys: TileChar[] = [];
  const seenKinds = new Set<string>();
  for (const char of Object.keys(HAZARD_CHARS) as TileChar[]) {
    const kind = HAZARD_CHARS[char]?.hazardType;
    if (!kind || seenKinds.has(kind)) continue;
    seenKinds.add(kind);
    keys.push(char);
  }
  return keys;
})();

/** A terrain palette tool: its descriptor plus the registry-owned flags a
 *  terrain button/tile needs. */
export interface TerrainPaletteTool extends PaletteTool {
  tileType: TileType;
  /** The module's author-placeable character (== its `EditorTool` key). */
  char: string;
  fogExempt: boolean;
  drawBand: TileDrawBand;
}

/**
 * The terrain palette, derived from R-015's shipped `TILE_MODULES` (FR-008):
 * exactly the modules whose descriptor has `group === 'terrain'`. It therefore
 * excludes `'.'` (the Eraser, group `'tools'`), the decoration chars (group
 * `'decoration'`), and every non-author-placeable kind (`ropeLadder`, no
 * `char`) — and it never produces or duplicates the Eraser. `char`/`fogExempt`/
 * `drawBand` come from the registry, never a palette-local table.
 */
export function terrainPaletteTools(): TerrainPaletteTool[] {
  const tools: TerrainPaletteTool[] = [];
  for (const [tileType, module] of Object.entries(TILE_MODULES) as [
    TileType,
    (typeof TILE_MODULES)[TileType],
  ][]) {
    // `char` is absent on registry-only kinds (ropeLadder); narrow before use.
    const char = (module as { char?: string }).char;
    if (char === undefined) continue;
    const descriptor = PALETTE_TOOLS[char as EditorTool];
    if (!descriptor || descriptor.group !== 'terrain') continue;
    tools.push({
      ...descriptor,
      tileType,
      char,
      fogExempt: module.fogExempt,
      drawBand: module.drawBand,
    });
  }
  return tools;
}
