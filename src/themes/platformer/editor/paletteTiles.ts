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
}

const WORLD_TILESET = '/sprites/world_tileset.png';
const TILE_ATLAS = '/sprites/tile_atlas.png';

/**
 * One sprite spec per `TileChar`, or `null` for `.` (the Eraser tool, which
 * has no sprite — it renders as an empty bordered square instead).
 */
export const PALETTE_TILE_SPRITES: Record<TileChar, TileSpriteSpec | null> = {
  '.': null,
  G: {
    sheet: TILE_ATLAS,
    sheetWidth: 130,
    sheetHeight: 54,
    sx: 76,
    sy: 0,
    frameWidth: 16,
    frameHeight: 16,
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
  T: {
    sheet: '/sprites/chest_closed.png',
    sheetWidth: 28,
    sheetHeight: 20,
    sx: 0,
    sy: 0,
    frameWidth: 28,
    frameHeight: 20,
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
  S: 'Spawn',
  E: 'Enemy Green',
  M: 'Enemy Purple',
  C: 'Coin',
  X: 'Crate',
  Q: 'Question Mark',
  F: 'Fragile Rock',
  T: 'Chest',
  '1': 'Sign',
  '2': 'Sign 2',
  '3': 'Sign 3',
  '4': 'Sign 4',
  '5': 'Sign 5',
};
