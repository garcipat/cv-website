import type { TileChar } from '../level/LevelParser';

/**
 * A crop rectangle (native, un-scaled pixels) into a sprite sheet image,
 * plus the sheet's own native dimensions — everything a CSS "sprite
 * cropping" technique (an `<img>` of the whole sheet, absolutely positioned
 * inside an `overflow: hidden` box) needs, with no runtime image
 * measurement. Coordinates are hand-picked to match the exact frame the
 * real engine renders for that tile/marker's "at rest" state (see
 * `Renderer.ts`'s `tileSource`, and `coinFrameSource`/`enemyFrameIndex`/
 * `blockFrameSource`/`playerFrameSource` in the respective entity files) —
 * this is a palette icon, not a live game sprite, so it intentionally
 * doesn't reuse those functions' animation/context-dependent logic (e.g.
 * `tileSource`'s top-exposed/buried variants, `bridgeRunPosition`); it just
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
  /**
   * A second crop of the SAME sheet, drawn over the base crop at the same
   * scale and offset by its own `sx`/`sy`. Ground cells carry no grass — the
   * engine draws grass as a separate overlay pass — so a swatch that should
   * look like grassy ground composites the two the same way the renderer
   * does. A grass cell is 9px of tuft at the top of a 16px cell with the rest
   * transparent, which is why this needs no height of its own.
   */
  overlay?: { sx: number; sy: number };
}

const WORLD_TILESET = '/sprites/world_tileset.png';
const TILE_ATLAS = '/sprites/tile_atlas.png';

/**
 * One sprite spec per `TileChar`, or `null` for the two tiles that have no
 * sprite at all: `.` (the Eraser tool) and `P` (the patrol boundary, which
 * is invisible in game by design). Both render as an empty bordered square,
 * told apart by `PALETTE_TILE_GLYPHS` below.
 */
export const PALETTE_TILE_SPRITES: Record<TileChar, TileSpriteSpec | null> = {
  '.': null,
  G: {
    sheet: TILE_ATLAS,
    sheetWidth: 130,
    sheetHeight: 54,
    sx: 114,
    sy: 0,
    frameWidth: 16,
    frameHeight: 16,
    overlay: { sx: 76, sy: 38 },
  },
  R: {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 16,
    sy: 0,
    frameWidth: 16,
    frameHeight: 16,
  },
  W: {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 128,
    sy: 0,
    frameWidth: 16,
    frameHeight: 16,
  },
  B: {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 160,
    sy: 32,
    frameWidth: 16,
    frameHeight: 16,
  },
  L: {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 144,
    sy: 48,
    frameWidth: 16,
    frameHeight: 16,
  },
  I: {
    sheet: '/sprites/staticObjects.png',
    sheetWidth: 288,
    sheetHeight: 144,
    sx: 80,
    sy: 112,
    frameWidth: 16,
    frameHeight: 16,
  },
  P: null,
  S: {
    sheet: '/sprites/knight.png',
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 0,
    sy: 0,
    frameWidth: 32,
    frameHeight: 32,
  },
  E: {
    sheet: '/sprites/slime_green.png',
    sheetWidth: 96,
    sheetHeight: 72,
    sx: 72,
    sy: 0,
    frameWidth: 24,
    frameHeight: 24,
  },
  M: {
    sheet: '/sprites/slime_purple.png',
    sheetWidth: 96,
    sheetHeight: 72,
    sx: 72,
    sy: 0,
    frameWidth: 24,
    frameHeight: 24,
  },
  C: {
    sheet: '/sprites/coin.png',
    sheetWidth: 192,
    sheetHeight: 16,
    sx: 0,
    sy: 0,
    frameWidth: 16,
    frameHeight: 16,
  },
  X: {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 112,
    sy: 48,
    frameWidth: 16,
    frameHeight: 16,
  },
  Q: {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 0,
    sy: 32,
    frameWidth: 16,
    frameHeight: 16,
  },
  F: {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 48,
    sy: 0,
    frameWidth: 16,
    frameHeight: 16,
  },
  u: {
    sheet: '/sprites/staticObjects.png',
    sheetWidth: 288,
    sheetHeight: 144,
    sx: 0,
    sy: 112,
    frameWidth: 16,
    frameHeight: 16,
  },
  T: {
    sheet: '/sprites/chest_closed.png',
    sheetWidth: 28,
    sheetHeight: 20,
    sx: 0,
    sy: 0,
    frameWidth: 28,
    frameHeight: 20,
  },
  n: {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 16,
    sy: 48,
    frameWidth: 16,
    frameHeight: 16,
  },
  N: {
    sheet: '/sprites/staticObjects.png',
    sheetWidth: 288,
    sheetHeight: 144,
    sx: 32,
    sy: 64,
    frameWidth: 16,
    frameHeight: 16,
  },
  // '1'-'5' are all the same signpost sprite — the digit is what
  // distinguishes a sign's hint content (SIGN_CHARS), not its appearance.
  // Only the first (`'1'`) ever renders as its own palette button (see
  // Palette.tsx's firstSignKey); the rest exist purely so this exhaustive
  // Record has an entry for every TileChar.
  '1': {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 128,
    sy: 48,
    frameWidth: 16,
    frameHeight: 16,
  },
  '2': {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 128,
    sy: 48,
    frameWidth: 16,
    frameHeight: 16,
  },
  '3': {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 128,
    sy: 48,
    frameWidth: 16,
    frameHeight: 16,
  },
  '4': {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 128,
    sy: 48,
    frameWidth: 16,
    frameHeight: 16,
  },
  '5': {
    sheet: WORLD_TILESET,
    sheetWidth: 256,
    sheetHeight: 256,
    sx: 128,
    sy: 48,
    frameWidth: 16,
    frameHeight: 16,
  },
};

/** The turn-around character standing in for the patrol boundary's missing
 *  sprite — in the palette button below, and on the tile itself in the
 *  editor canvas (`EditorCanvas.tsx` re-exports it as
 *  `PATROL_MARKER_GLYPH`), so both always show the same symbol. */
export const PATROL_GLYPH = '⇄';

/**
 * The character drawn inside a sprite-less tile's empty palette square, so
 * two of them are never indistinguishable. Only `P` needs one today — the
 * Eraser's empty square already reads as "erase", and giving it a glyph
 * would make it look like a tile you can paint.
 */
export const PALETTE_TILE_GLYPHS: Partial<Record<TileChar, string>> = {
  P: PATROL_GLYPH,
};

/**
 * What each tile actually does, shown as the palette button's hover tooltip
 * next to its name. The palette is a grid of 16px icons with no captions, and
 * several tiles are not self-explanatory from their sprite alone — a crate
 * and a fragile rock look equally breakable, and the patrol boundary has no
 * sprite at all — so this is where an author finds out which is which.
 * Phrased as what the tile does in the finished level, not as how to paint
 * it.
 */
export const PALETTE_TILE_DESCRIPTIONS: Record<TileChar, string> = {
  '.': 'Clears a tile back to empty',
  G: 'Solid earth; grows a grass top wherever it is exposed',
  R: 'Solid stone, for exposed rock faces and cave floors',
  W: 'Solid wall block',
  B: 'Solid from above; the player drops through it with Down',
  L: 'Climbed with Up and Down',
  I: 'Chain; climbs like a ladder, art hugs whichever wall (if any) it hangs against',
  P: 'Invisible in game; turns patrolling enemies around',
  S: 'Where the player starts',
  E: 'Green slime; stomping it reveals one CV fact',
  M: 'Purple slime; stomping it drops a key',
  C: 'Coin; collecting it reveals one skill category',
  X: 'Crate block; hit it from below to reveal a CV fact',
  Q: 'Question block; hit it from below to pop a bonus fruit',
  F: 'Fragile rock; hit it from below to break it open',
  u: 'Coin-pot; land on it from above to break it and drop a coin',
  T: 'Chest; costs a key, and holds one experience entry',
  n: 'Bush; stack vertically to grow a tree (root, trunk, canopy)',
  N: 'Fence',
  '1': 'Hint sign; click it again on the canvas to cycle its hint',
  '2': 'Hint sign; click it again on the canvas to cycle its hint',
  '3': 'Hint sign; click it again on the canvas to cycle its hint',
  '4': 'Hint sign; click it again on the canvas to cycle its hint',
  '5': 'Hint sign; click it again on the canvas to cycle its hint',
};

/** Human-readable name per `TileChar`, so the palette reads by name rather
 *  than by memorized character — matches `TERRAIN_CHARS`/`ENTITY_CHARS`'s
 *  own `TileType`/`EntityKind` values, just spaced and capitalized. */
export const PALETTE_TILE_LABELS: Record<TileChar, string> = {
  '.': 'Eraser',
  G: 'Ground Grass',
  R: 'Ground Rock',
  W: 'Wall',
  B: 'Bridge',
  L: 'Ladder',
  I: 'Chain',
  P: 'Patrol Boundary',
  S: 'Spawn',
  E: 'Enemy Green',
  M: 'Enemy Purple',
  C: 'Coin',
  X: 'Crate',
  Q: 'Question Mark',
  F: 'Fragile Rock',
  u: 'Coin Pot',
  T: 'Chest',
  n: 'Bush / Tree',
  N: 'Fence',
  '1': 'Sign',
  '2': 'Sign 2',
  '3': 'Sign 3',
  '4': 'Sign 4',
  '5': 'Sign 5',
};
