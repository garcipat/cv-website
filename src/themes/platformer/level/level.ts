import { signal, computed } from '@preact/signals-react';
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
  findSignTiles,
} from './LevelParser';

// Visual layout of currentLevel — one character per tile (see LevelParser.ts's
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
// through it on purpose (Down/S) both trigger real pit-fall damage. A
// floating ground strip (row 3 below, above the ladder shaft) spans cols
// 8-14 as
// ground-ground-ground-bridge-bridge-ground-ground (cols 8-10 /
// 11-12 / 13-14) — the bridge segment is passable from below (jump up
// through it) and from above via Down/S (drop-through), with solid ground
// two tiles below for both to land on.
//
// Every collectible/enemy on this map is a hand-placed marker, not
// auto-placed: `S` (spawn), `E` (green Course enemy), `M` (purple slime —
// delivers key collectible instead of CV facts), `C` (Skill-category
// coin), `T` (chest — Experience fact). A marker is a slot on the map —
// EnemyMapper.ts's placeEnemies and CollectibleMapper.ts's
// placeCollectibles each draw the next fact from CVData (in its own section
// order) per marker of that type, with no auto-placement fallback. This
// level intentionally has only 1 `E`, 2 `M`s, and 4 `C`s — a mechanics test
// layout, not a complete one; most of the real CV's courses/skills simply
// aren't represented on the map yet. The actual level design comes later,
// once the mechanics it exercises are all built. The level's two purple
// slimes (`M` markers) produce two keys (one per slime), which enables both
// chests (`T` markers) to be unlocked — each chest requires one key to open.
// Question-mark blocks spawn their own bonus fruit (see BlockMapper.ts's
// certificateToBlock/projectToBlock); where Languages themselves get
// surfaced is still an open design question. `F` marks fragileRock blocks,
// kept distinct from the unrelated `groundRock` terrain tile (see
// LevelParser.ts's ENTITY_CHARS).
//
// One of the four Skill coins sits at col 18 (a second nearby pickup,
// alongside the one at col 10); the other three coins/both fruits cluster at
// cols 43-46, right after the col 40-42 pit. The level's second purple slime
// (col 47) sits on the same flat, open rock ground right after that coin
// cluster — clear of the first purple slime's wall/pit sandwich pocket (cols
// 37-39) and of the col 43/45 coin markers. Three block marker kinds sit at
// cols 19-24, two of each: `X` (crate block), `Q` (question-mark block), `F`
// (fragileRock block), at row 3 (elevated), with rows 4-5 kept empty beneath
// them — the same "2 rows of clearance above solid ground" shape the
// floating platform at cols 8-14 uses, so the "jump up and hit from below"
// gesture reads correctly. Like the enemy/coin markers, a level's marker
// count decides on-map coverage, not CVData's length — this mechanics-test
// level intentionally has just 2 of each block marker type (BlockMapper.ts's
// placeBlocks has no auto-placement fallback, same as
// EnemyMapper.ts/CollectibleMapper.ts).
//
// Patrol test cases sit close to spawn (cols ~26-42), well past the player's
// critical walk-right threshold (~21 tiles), keeping manual testing
// convenient:
//   - Green enemy (col 28): bounded by two `W` walls (cols 26 and 31) — the
//     "patrol bounded by two walls" case.
//   - Purple enemy (col 38): bounded by a `W` wall on its left (col 31 — the
//     same wall that bounds the green enemy's pocket on its right; the wall
//     that used to sit at col 36 was removed once the sprite renderScale bumped
//     slimePurple to 2x, since a slime that wide needs roughly a tile of
//     clearance to its left and two to its right just to turn around
//     without visually overlapping the obstacle — see EnemyAI.ts's
//     stepEnemyPatrol doc comment — and the original 3-tile pocket (cols
//     37-39) left no room to patrol at all once turn-around correctly
//     accounted for that) and a genuine bottomless pit on its right (cols
//     40-42, no bridge) — the "wall, enemy, pit" sandwich, exercising BOTH
//     the wall-reversal and the ledge/pit-edge-reversal branches of
//     EnemyAI.ts's stepEnemyPatrol on a single enemy. The pocket this
//     sandwich now forms (cols 32-39) is 8 tiles wide, sized for this one
//     purple slime only; the level's second purple slime lives well clear of
//     it, at col 47 (see below).
//
// A blank leading row (row 0) sits above the elevated block row (row 1) so
// FR-022b's fruit-pop mechanic has somewhere for the popped fruit to rise
// into — the array is bottom-anchored, so this costs nothing visually.
//
// Two `T` (chest) markers sit close together near spawn (cols 6 and 12)
// rather than spread across the level — see CHEST_TILES's doc comment below
// for the full reasoning (same mechanics-test-level convention as this
// file's other collectible/enemy marker counts).
export const LEVEL_1_LAYOUT: readonly string[] = [
  // --- Ladder shaft — placeholder content, not final level design. Exists
  // only to give climbing a real manual browser Verify: a short 4-rung shaft
  // between the pre-existing floating platform (its bottom row) and a small
  // landing platform beside its top rung. Deliberately short so climbing to
  // the top — and the standing-on-the-top-rung behavior at the end of it —
  // is a couple of seconds of play-testing rather than a long haul. Vertical
  // camera follow does not depend on this shaft's height for coverage;
  // Camera.test.ts's updateCameraY tests exercise it directly, at any
  // level size.
  '.............GGL', // top tier: ground beside the ladder's top tile (col 15), same row — not stacked above it
  '...............L',
  '...............L',
  // The shaft's bottom rung sits IN the floating ground strip's own row (col
  // 15, one column right of the strip's rightmost tile), so stepping off the
  // strip onto the ladder needs no jump.
  '........GGGBBGGL...XQFXQF.......................................................',
  '................................................................................',
  '.S.1..T...C.T.....C.......W.E..W......M....C.C.M................................',
  'GGBBBGGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRR...RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  'GG...GGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRR...RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
];

/**
 * The layout the GAME actually renders/simulates against — starts out equal
 * to the hardcoded `LEVEL_1_LAYOUT` above, but is deliberately an in-memory
 * signal (NOT localStorage-backed, unlike the Level Editor's own
 * `editorLevelSignal` in `editor/editorLevelState.ts`): a real page
 * load/reload must always fall back to whatever `LEVEL_1_LAYOUT` says in
 * code, so shipping a new default layout always takes effect for every
 * visitor, and a play-tester's in-progress edits never leak into the live
 * site just by being open in a browser tab. The Level Editor's Try button
 * (`editor/LevelEditorPage.tsx`) is the only place that writes to this — it
 * sets `.value` to the exported grid, then client-side-navigates
 * (`@/state/navigation.ts`'s `navigateTo`, not a real reload) into the game,
 * which is what lets this value actually be seen before a reload would
 * discard it.
 */
export const currentLayout = signal<readonly string[]>(LEVEL_1_LAYOUT);

/** Parsed terrain/dimensions for `currentLayout`. Recomputes whenever the
 *  Level Editor's Try button changes `currentLayout` (see its doc comment
 *  above); every other read site (PlatformerPage.tsx, PlatformerState.ts)
 *  reads this reactively via `.value` instead of a plain module-load-time
 *  constant, so a Try'd layout actually renders/simulates instead of the
 *  stale default. */
export const currentLevel = computed<LevelDef>(() => parseLevel(currentLayout.value));

/** Player spawn point, read from `currentLayout`'s `S` marker. */
export const SPAWN_TILE = computed(() => findSpawnTile(currentLayout.value));

/** Hand-placed green (Course) enemy positions, from `currentLayout`'s `E` markers. */
export const ENEMY_TILES_GREEN = computed(() => findGreenEnemyTiles(currentLayout.value));

/** Hand-placed purple (Course) enemy positions, from `currentLayout`'s `M`
 *  markers; see this file's top doc comment for how green/purple share the
 *  Courses pool. */
export const ENEMY_TILES_PURPLE = computed(() => findPurpleEnemyTiles(currentLayout.value));

/** Hand-placed Skill-category coin positions, from `currentLayout`'s `C` markers. */
export const COIN_TILES = computed(() => findCoinTiles(currentLayout.value));

/** Hand-placed crate block positions (2), from `currentLayout`'s `X` markers. */
export const CRATE_TILES = computed(() => findCrateTiles(currentLayout.value));

/** Hand-placed question-mark block positions (2), from `currentLayout`'s `Q` markers. */
export const QUESTIONMARK_TILES = computed(() => findQuestionMarkTiles(currentLayout.value));

/** Hand-placed fragileRock block positions (2), from `currentLayout`'s `F`
 *  markers, kept distinct from the unrelated `groundRock` terrain tile. */
export const FRAGILE_ROCK_TILES = computed(() => findFragileRockTiles(currentLayout.value));

/** Hand-placed chest positions (2), from `currentLayout`'s `T` markers
 *  (spec.md FR-023). Both markers sit close to spawn (cols 6 and 12) for
 *  easier manual testing. Same mechanics-test convention as this file's
 *  other collectible/enemy marker counts (e.g. only 1 `E` and 1 `M` enemy
 *  despite far more courses/certificates existing in the real CV data): a
 *  level's marker count decides on-map coverage, not CVData's length, and
 *  `placeChests` has no auto-placement fallback — the remaining Experience
 *  entries simply have no chest yet. */
export const CHEST_TILES = computed(() => findChestTiles(currentLayout.value));

/** Hand-placed hint-sign positions, from `currentLayout`'s digit markers
 *  (`1`-`9`, see LevelParser.ts's SIGN_CHARS). Only one marker (`1`,
 *  bridgeDropThrough) exists today — placed right above `currentLayout`'s
 *  first ground-level pit bridge (spec.md FR-040). */
export const SIGN_TILES = computed(() => findSignTiles(currentLayout.value));
