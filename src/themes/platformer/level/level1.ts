import type { LevelDef } from './LevelData';
import {
  parseLevel,
  findSpawnTile,
  findGreenEnemyTiles,
  findPurpleEnemyTiles,
  findCoinTiles,
  findCrateTiles,
  findQuestionMarkTiles,
  findFragileRockTiles,
  findChestTiles,
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
// auto-placed: `S` (spawn), `E` (green Course enemy), `M` (purple Course
// enemy — amended 2026-08-30, live user feedback: both slime colors now
// guard the same Courses pool, alternating by index, rather than purple
// carrying Certificates+Projects; see EnemyMapper.ts's courseToEnemy
// comment), `C` (Skill-category coin), `T` (chest — Experience fact, see roadmap step 22). A marker is a slot on the map —
// EnemyMapper.ts's placeEnemies and CollectibleMapper.ts's
// placeCollectibles each draw the next fact from CVData (in its own section
// order) per marker of that type, with no auto-placement fallback. This
// level intentionally has only 1 `E`, 1 `M`, and 4 `C`s — a mechanics test
// layout, not a complete one; most of the real CV's courses/skills simply
// aren't represented on the map yet. The actual level design comes later,
// once the mechanics it exercises are all built. The Language-fruit marker
// concept that used to occupy `F` was removed 2026-08-30 (live user
// feedback) — question-mark blocks now spawn their own bonus fruit instead
// (see BlockMapper.ts's certificateToBlock/projectToBlock); where Languages
// themselves get surfaced is still an open design question. `F` now marks
// fragileRock blocks instead (renamed from `K`, see LevelParser.ts's
// ENTITY_CHARS — the old letter collided confusingly with the unrelated
// `groundRock` terrain tile).
//
// Roadmap step 20 (2026-08-29) relaid out the post-wall-pocket half of this
// level after live user feedback that it felt too spread out: one of the
// four Skill coins moved from col 50 to col 18 (a second nearby pickup,
// not just the col 10 one), and the other three coins/both fruits moved
// from their original cols 50/55/60/70/75 into a tight cluster at cols
// 43-46 right after the col 40-42 pit. Three new marker kinds were added
// immediately after that cluster, two of each: `X` (crate block), `Q`
// (question-mark block), `F` (fragileRock block), at cols 47-52. Like the
// enemy/coin markers, a level's marker count decides on-map coverage, not
// CVData's length — this mechanics-test level intentionally has just 2 of
// each new marker type (BlockMapper.ts's placeBlocks has no auto-placement
// fallback, same as EnemyMapper.ts/CollectibleMapper.ts).
//
// Follow-up (same day, after live user feedback on the render): the three
// new block marker kinds moved again — from row 2 (ground-adjacent, same
// height as the player's own standing position) to row 0 (elevated, with
// rows 1-2 kept empty beneath them — the same "2 rows of clearance above
// solid ground" shape the existing floating platform at cols 8-14 already
// uses), and from cols 47-52 (51 tiles from spawn, past the wall/pit
// gauntlet) to cols 19-24 (18-23 tiles from spawn, right after the second
// coin and before the gauntlet) — both changes make the "jump up and hit
// from below" gesture read correctly and cut the walk to reach them.
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
//
// Final review fix (2026-08-30): a blank leading row (row 0) was added above
// the elevated block row (now row 1) so a future step (FR-022b's fruit-pop
// mechanic) has somewhere for the popped fruit to rise into — the array is
// bottom-anchored, so this costs nothing visually.
//
// Final review fix, round 2 (2026-08-30, live user feedback): trimmed from 5
// `T` (chest) markers down to 2, both close together near spawn (cols 6 and
// 12) rather than spread across the level — see CHEST_TILES's doc comment
// below for the full reasoning (same mechanics-test-level convention as
// this file's other collectible/enemy marker counts).
const LEVEL_1_LAYOUT: readonly string[] = [
  // --- Ladder shaft (roadmap step 23) — throwaway/replaceable placeholder
  // content, not final level design. Exists only to give this step a real
  // manual browser Verify for climbing: a short 4-rung shaft between the
  // pre-existing floating platform (its bottom row) and a small landing
  // platform beside its top rung. Deliberately short so climbing to the
  // top — and the standing-on-the-top-rung behavior at the end of it — is
  // a couple of seconds of play-testing rather than a long haul. Vertical
  // camera follow no longer depends on this shaft's height for coverage;
  // Camera.test.ts's updateCameraY tests exercise it directly, at any
  // level size.
  '.............PPL', // top tier: platform beside the ladder's top tile (col 15), same row — not stacked above it, not a separate tile type
  '...............L',
  '...............L',
  // The shaft's bottom rung sits IN the floating platform's own row (col
  // 15, one column right of the platform's rightmost tile), so stepping
  // off the platform onto the ladder needs no jump.
  '........PPPBBPPL...XQFXQF.......................................................',
  '................................................................................',
  '.S....T...C.T.....C.......W.E..W....W.M....C.C..................................',
  'GGBBBGGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRR...RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  'GG...GGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRR...RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
];

export const level1: LevelDef = parseLevel(LEVEL_1_LAYOUT);

/** Player spawn point, read from `LEVEL_1_LAYOUT`'s `S` marker. */
export const SPAWN_TILE = findSpawnTile(LEVEL_1_LAYOUT);

/** Hand-placed green (Course) enemy positions, from `LEVEL_1_LAYOUT`'s `E` markers. */
export const ENEMY_TILES_GREEN = findGreenEnemyTiles(LEVEL_1_LAYOUT);

/** Hand-placed purple (Course) enemy positions, from `LEVEL_1_LAYOUT`'s `M`
 *  markers — amended 2026-08-30, see this file's top doc comment. */
export const ENEMY_TILES_PURPLE = findPurpleEnemyTiles(LEVEL_1_LAYOUT);

/** Hand-placed Skill-category coin positions, from `LEVEL_1_LAYOUT`'s `C` markers. */
export const COIN_TILES = findCoinTiles(LEVEL_1_LAYOUT);

/** Hand-placed crate block positions (2), from `LEVEL_1_LAYOUT`'s `X` markers. */
export const CRATE_TILES = findCrateTiles(LEVEL_1_LAYOUT);

/** Hand-placed question-mark block positions (2), from `LEVEL_1_LAYOUT`'s `Q` markers. */
export const QUESTIONMARK_TILES = findQuestionMarkTiles(LEVEL_1_LAYOUT);

/** Hand-placed fragileRock block positions (2), from `LEVEL_1_LAYOUT`'s `F`
 *  markers (renamed from `K` — the old letter collided confusingly with the
 *  unrelated `groundRock` terrain tile; the `F` letter itself was freed up by
 *  removing the dead Language-fruit marker concept it used to mean). */
export const FRAGILE_ROCK_TILES = findFragileRockTiles(LEVEL_1_LAYOUT);

/** Hand-placed chest positions (2), from `LEVEL_1_LAYOUT`'s `T` markers
 *  (spec.md FR-023, added 2026-08-30). Both markers sit close to spawn (cols
 *  6 and 12) — live user feedback, 2026-08-30, trimmed down from the original
 *  5 spread across the level for easier manual testing. Same mechanics-test
 *  convention as this file's other collectible/enemy marker counts (e.g. only
 *  1 `E` and 1 `M` enemy despite far more courses/certificates existing in
 *  the real CV data): a level's marker count decides on-map coverage, not
 *  CVData's length, and `placeChests` has no auto-placement fallback — the
 *  remaining 3 Experience entries (the newest ones, after this batch's `D5`
 *  chest-ordering reversal) simply have no chest yet. */
export const CHEST_TILES = findChestTiles(LEVEL_1_LAYOUT);
