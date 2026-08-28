import type { LevelDef } from './LevelData';
import {
  parseLevel,
  findSpawnTile,
  findGreenEnemyTiles,
  findPurpleEnemyTiles,
  findCoinTiles,
  findFruitTiles,
} from './LevelParser';

// Visual layout of level1 — one character per tile (see LevelParser.ts's
// LEVEL_SYMBOLS). Every row must be the same length (the level's width in
// tiles), but the number of rows (the level's height) is NOT a fixed
// constant — it's however many rows this array has. The array is
// bottom-anchored: its LAST row is always the lowest ground row, and rows
// above it add height only as far up as the tallest actual feature needs
// (no filler rows of empty sky above that). Renderer.ts/Camera.ts already
// anchor the level to the bottom of the canvas, so adding or removing
// purely-empty leading rows here has no visual effect — it only changes how
// much unused vertical space this file has to contain. Each row is written
// as its full literal string (not built from padding calls), so the
// level's shape is readable directly here — what you see is what's on
// screen, left edge to right edge.
//
// Grass ground (cols 0-11) meets rock ground (cols 12-79) partway across; a
// 3-tile pit (cols 2-4) is bridged at ground level with NO floor below — it's
// a genuine bottomless drop, so walking off the bridge's edge or dropping
// through it on purpose (Down/S) both trigger real pit-fall damage (roadmap
// step 9). A floating platform row (row 0 below) spans cols 8-14 as
// platform-platform-platform-bridge-bridge-platform-platform (cols 8-10 /
// 11-12 / 13-14) — the bridge segment is passable from below (jump up
// through it) and from above via Down/S (drop-through), with solid ground
// two tiles below for both to land on. Two `W` wall tiles (cols 44 and 49)
// bound a short pocket in the rock ground — a first mechanics test spot for
// roadmap step 17's walled-patrol case, once patrol exists.
//
// Every collectible/enemy on this map is a hand-placed marker, not
// auto-placed: `S` (spawn), `E` (green/Certificate enemy), `M` (purple/
// Project enemy), `C` (Skill-category coin), `F` (Language fruit). A marker
// is a slot on the map — EnemyMapper.ts's placeEnemies and
// CollectibleMapper.ts's placeCollectibles each draw the next fact from
// CVData (in its own section order) per marker of that type, with no
// auto-placement fallback. This level intentionally has only 1 `E`, 1 `M`,
// 4 `C`s, and 2 `F`s — a mechanics test layout, not a complete one; most of
// the real CV's certificates/projects/skills/languages simply aren't
// represented on the map yet. The actual level design comes later, once the
// mechanics it exercises are all built.
const LEVEL_1_LAYOUT: readonly string[] = [
  '........PPPBBPP.................................................................',
  '................................................................................',
  '.S........C....C.........C....M....C..........E........F.........F..............',
  'GGBBBGGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRWRRRRWRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  'GG...GGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
];

export const level1: LevelDef = parseLevel(LEVEL_1_LAYOUT);

/** Player spawn point, read from `LEVEL_1_LAYOUT`'s `S` marker. */
export const SPAWN_TILE = findSpawnTile(LEVEL_1_LAYOUT);

/** Hand-placed green (Certificate) enemy positions, from `LEVEL_1_LAYOUT`'s `E` markers. */
export const ENEMY_TILES_GREEN = findGreenEnemyTiles(LEVEL_1_LAYOUT);

/** Hand-placed purple (Project) enemy positions, from `LEVEL_1_LAYOUT`'s `M` markers. */
export const ENEMY_TILES_PURPLE = findPurpleEnemyTiles(LEVEL_1_LAYOUT);

/** Hand-placed Skill-category coin positions, from `LEVEL_1_LAYOUT`'s `C` markers. */
export const COIN_TILES = findCoinTiles(LEVEL_1_LAYOUT);

/** Hand-placed Language fruit positions, from `LEVEL_1_LAYOUT`'s `F` markers. */
export const FRUIT_TILES = findFruitTiles(LEVEL_1_LAYOUT);
