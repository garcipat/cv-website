import type { LevelDef } from './LevelData';
import {
  parseLevel,
  findSpawnTile,
  findGreenEnemyTiles,
  findPurpleEnemyTiles,
  findCoinTiles,
  findFruitTiles,
  findCrateTiles,
  findQuestionMarkTiles,
  findRockTiles,
} from './LevelParser';

// Visual layout of level1 — one character per tile (see LevelParser.ts's
// TERRAIN_CHARS/ENTITY_CHARS). Every row must be the same length (the level's
// width in tiles), but the number of rows (the level's height) is NOT a fixed
// constant — it's however many rows this array has. The array is
// bottom-anchored: its LAST row is always the lowest ground row, and rows
// above it add height only as far up as the tallest actual feature needs (no
// filler rows of empty sky above that). Renderer.ts/Camera.ts already anchor
// the level to the bottom of the canvas, so adding or removing purely-empty
// leading rows here has no visual effect — it only changes how much unused
// vertical space this file has to contain. Each row is written as its full
// literal string (not built from padding calls), so the level's shape is
// readable directly here — what you see is what's on screen, left edge to
// right edge.
//
// Grass ground (cols 0-11) meets rock ground (cols 12-79) partway across; a
// 3-tile pit (cols 2-4) is bridged at ground level with NO floor below — it's
// a genuine bottomless drop, so walking off the bridge's edge or dropping
// through it on purpose (Down/S) both trigger real pit-fall damage (roadmap
// step 9). A floating platform row (row 0 below) spans cols 8-14 as
// platform-platform-platform-bridge-bridge-platform-platform (cols 8-10 /
// 11-12 / 13-14) — the bridge segment is passable from below (jump up
// through it) and from above via Down/S (drop-through), with solid ground
// two tiles below for both to land on.
//
// Every collectible/enemy on this map is a hand-placed marker, not
// auto-placed: `S` (spawn), `E` (green/Project enemy), `M` (purple/
// Certificate enemy), `C` (Skill-category coin), `F` (Language fruit). A marker
// is a slot on the map — EnemyMapper.ts's placeEnemies and
// CollectibleMapper.ts's placeCollectibles each draw the next fact from
// CVData (in its own section order) per marker of that type, with no
// auto-placement fallback. This level intentionally has only 1 `E`, 1 `M`,
// 4 `C`s, and 2 `F`s — a mechanics test layout, not a complete one; most of
// the real CV's certificates/projects/skills/languages simply aren't
// represented on the map yet. The actual level design comes later, once the
// mechanics it exercises are all built.
//
// Roadmap step 20 (2026-08-29) relaid out the post-wall-pocket half of this
// level after live user feedback that it felt too spread out: one of the
// four Skill coins moved from col 50 to col 18 (a second nearby pickup,
// not just the col 10 one), and the other three coins/both fruits moved
// from their original cols 50/55/60/70/75 into a tight cluster at cols
// 43-46 right after the col 40-42 pit. Three new marker kinds were added
// immediately after that cluster, two of each: `X` (crate block), `Q`
// (question-mark block), `K` (rock block), at cols 47-52. Like the
// enemy/coin markers, a level's marker count decides on-map coverage, not
// CVData's length — this mechanics-test level intentionally has just 2 of
// each new marker type (BlockMapper.ts's placeBlocks has no auto-placement
// fallback, same as EnemyMapper.ts/CollectibleMapper.ts).
//
// Reworked for roadmap step 17 (enemy patrol) — patrol test cases now sit
// close to spawn (cols ~26-42) instead of the original far-right (cols 44-65),
// making manual testing convenient while staying well past the player's
// critical walk-right threshold (~21 tiles):
//   - Green enemy (col 28): bounded by two `W` walls (cols 26 and 31) — the
//     "patrol bounded by two walls" case.
//   - Purple enemy (col 38): bounded by a `W` wall on its left (col 36) and a
//     genuine bottomless pit on its right (cols 40-42, no bridge) — the
//     user-requested "wall, enemy, pit" sandwich, exercising BOTH the
//     wall-reversal and the ledge/pit-edge-reversal branches of
//     EnemyAI.ts's stepEnemyPatrol on a single enemy.
const LEVEL_1_LAYOUT: readonly string[] = [
  '........PPPBBPP.................................................................',
  '................................................................................',
  '.S........C.......C.......W.E..W....W.M....CFCFXQKXQK...........................',
  'GGBBBGGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRR...RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  'GG...GGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRR...RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
];

export const level1: LevelDef = parseLevel(LEVEL_1_LAYOUT);

/** Player spawn point, read from `LEVEL_1_LAYOUT`'s `S` marker. */
export const SPAWN_TILE = findSpawnTile(LEVEL_1_LAYOUT);

/** Hand-placed green (Project) enemy positions, from `LEVEL_1_LAYOUT`'s `E` markers. */
export const ENEMY_TILES_GREEN = findGreenEnemyTiles(LEVEL_1_LAYOUT);

/** Hand-placed purple (Certificate) enemy positions, from `LEVEL_1_LAYOUT`'s `M` markers. */
export const ENEMY_TILES_PURPLE = findPurpleEnemyTiles(LEVEL_1_LAYOUT);

/** Hand-placed Skill-category coin positions, from `LEVEL_1_LAYOUT`'s `C` markers. */
export const COIN_TILES = findCoinTiles(LEVEL_1_LAYOUT);

/** Hand-placed Language fruit positions, from `LEVEL_1_LAYOUT`'s `F` markers. */
export const FRUIT_TILES = findFruitTiles(LEVEL_1_LAYOUT);

/** Hand-placed crate block positions (2), from `LEVEL_1_LAYOUT`'s `X` markers. */
export const CRATE_TILES = findCrateTiles(LEVEL_1_LAYOUT);

/** Hand-placed question-mark block positions (2), from `LEVEL_1_LAYOUT`'s `Q` markers. */
export const QUESTIONMARK_TILES = findQuestionMarkTiles(LEVEL_1_LAYOUT);

/** Hand-placed rock block positions (2), from `LEVEL_1_LAYOUT`'s `K` markers. */
export const ROCK_TILES = findRockTiles(LEVEL_1_LAYOUT);
