import { signal, computed } from '@preact/signals-react';
import type { LevelDef, BackgroundPlacement } from './LevelData';
import {
  parseLevel,
  findSpawnTile,
  findGreenEnemyTiles,
  findPurpleEnemyTiles,
  findCoinTiles,
  findCrateTiles,
  findQuestionMarkTiles,
  findFragileRockTiles,
  findCoinPotTiles,
  findChestTiles,
  findSignTiles,
} from './LevelParser';

// Visual layout of currentLevel — one character per tile (see LevelParser.ts's
// TERRAIN_CHARS/ENTITY_CHARS/SIGN_CHARS). Every row is the same length (the
// level's width in tiles, 220), and the array is bottom-anchored: its LAST row
// is the bedrock stratum, and rows above it add height only as far up as the
// tallest actual feature needs — there is no leading row of empty sky, which
// would only add unused vertical space here (the Level Editor's export crops
// it away anyway). Each row is written as its full literal string (not built
// from padding calls), so the level's shape is readable directly here — what
// you see is what's on screen, left edge to right edge. Renderer.ts/Camera.ts
// anchor the level to the bottom of the canvas and scroll vertically once it
// is taller than the viewport, which this one is.
//
// ## Vertical structure
//
// The map is not a flat line with a few holes in it. Its surface climbs and
// drops between four terraces, and two stacked cave galleries run underneath:
//
//   row 2      markers standing on the summit plateau
//   row 3      HIGH   — summit plateau ground
//   row 5      markers standing on the upper terrace
//   row 6      UPPER  — upper terrace ground
//   row 8      markers standing on the mid terrace / floating platforms
//   row 9      MID    — mid terrace and floating-platform ground
//   row 11     markers standing on the base
//   row 12     BASE   — the ground most of the level walks on
//   rows 13-15 upper cave gallery
//   row 16     upper cave floor
//   rows 17-19 lower cave gallery (the Deep Mine only)
//   row 20     lower cave floor
//   row 21     bedrock
//
// (The emitted array drops the two all-empty sky rows above row 2, so these
// row numbers are the layout's own indices minus 2.)
//
// The terraces sit exactly 3 rows apart, which is what makes them work
// against PhysicsConfig.ts: a jump peaks at roughly 3.5 tiles, so one jump
// climbs exactly one terrace and no step ever needs a ladder it doesn't have.
// The same 3-row spacing gives every block marker its 2 empty rows of
// clearance above solid ground, so "jump up and hit it from below" reads
// correctly everywhere.
//
// ## Materials
//
// `groundGrass` is the default material — the earth the whole map is made of,
// autotiled with its grass overlay wherever a tile is top-exposed (see
// Terrain.ts). `groundRock` is an accent, painted only where stone is meant to
// be SEEN rather than as a material filling whole columns: the single bedrock
// stratum along the bottom, the floor of each dug-out cave, and two short
// surface patches (the Deep Mine's mouth, the gauntlet's middle step).
// Everything buried behind those faces stays ground.
//
// ## Routes
//
// The level is deliberately NOT a single corridor. Surface and caves run in
// parallel over most of the map, joined at several points, and CV content is
// split across both — so seeing all of it means using both:
//
//   - Zone A, Meadow (cols 0-27): flat base ground, a bridged pit with no
//     floor beneath it (walking off the bridge's edge, or dropping through it
//     with Down/S, is a genuine pit fall), and the first elevated blocks.
//   - Zone B, Hillside (cols 28-57): the surface climbs a terrace, while a
//     cave underneath (ladders at cols 31 and 54) holds the level's FIRST
//     chest — deliberately placed before any key exists, so the player has to
//     come back for it.
//   - Zone C, Bridge Terrace (cols 58-90): a second cave, entered either by
//     the ladder at col 61 or by dropping through the bridge at cols 64-66,
//     holding the first purple slime and so the first key. The ladder is the
//     reliable way out; the two fragileRock blocks plugging the surface at
//     cols 84-85 are an optional shortcut, broken from below while standing
//     on the ledge underneath them.
//   - Zone D, Pit Run (cols 91-125): a ground route (jump the open pit, cross
//     the bridged one) and a mid-terrace platform route carrying a coin and
//     the second key — two independent ways past the same stretch.
//   - Zone E, Deep Mine (cols 126-170): two stacked galleries. A ladder at
//     col 128 drops to the upper one, col 140 continues to the lower, and col
//     166 is one long shaft running surface-to-bottom. Two keys and two chests
//     live down here, plus a second fragileRock plug (cols 152-153) over the
//     ledge that reaches it.
//   - Zone F, Terraced Gauntlet (cols 171-198): wall-bounded patrol pockets
//     exercising EnemyAI.ts's wall-reversal branch, on a staircase that climbs
//     base → mid → upper terrace.
//   - Zone G, Summit (cols 199-219): a ladder at col 206 up to the summit
//     plateau, holding the fifth key and the fourth chest, then a drop back to
//     the upper terrace where the fifth chest ends the run.
//
// ## Markers
//
// Every collectible/enemy/block/chest is a hand-placed marker, never
// auto-placed, and the counts now cover the WHOLE of CVData, so the Journal
// can be completed:
//
//   S  1   spawn
//   E  12  green slime — one per course
//   M  5   purple slime — no CV fact; each drops one key
//   C  16  coin — one per skill category
//   X  8   crate — 2 education + 3 activities + 3 languages
//   Q  5   question-mark block — 2 certificates + 3 projects, each popping a
//          bonus fruit rather than carrying a fact of its own
//   F  5   fragileRock block — no fact; the two surface plugs plus filler
//   T  5   chest — one per experience entry; opening all five ends the run
//
// A question-mark's fruit rests in the tile directly above the block and stays
// there, so a `Q` is only ever placed under open sky — one inside a cave would
// pop its fruit into the ceiling, where nothing could reach it. Crates and
// fragileRocks have no such constraint and do go underground.
//
// Keys and chests are deliberately kept apart. Chest 1 (col 40) sits in zone
// B's cave, while the first key is a zone C cave slime — so the first chest
// found cannot be opened yet, and the player either backtracks or remembers
// it. Five slimes for five chests means every key is needed and none is spare.
//
// `1`-`5` are hint signs (LevelParser.ts's SIGN_CHARS), each placed where its
// mechanic is first needed AND actually pays off: `5` (open all the chests) at
// spawn, `2` (ladder) beside the first ladder, `4` (chests need a key) beside
// the first chest, `3` (fragile rocks break from below) on the ledge under
// zone C's plug, and `1` (bridge drop-through) on zone C's cave-mouth bridge —
// deliberately NOT on the meadow bridge, where dropping through only earns a
// pit fall. On the cave mouth, dropping through is the way in.
export const LEVEL_1_LAYOUT: readonly string[] = [
  '..................................................................................................................................................................................................................M.C..T....',
  '.............................................................................................................................................................................................Q..........X.....LGGGGGGGGGGG..',
  '..............................................................................................................................................................................................................LGGGGGGGGGGG..',
  '................................................................................................................................................................................................E..C..........LGGGGGGGGGGG.T',
  '..............................................X......................................................................................................................................X.....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  '...........................................................................................................................................................................................GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  '........................................E...C....................................................C...........M........................................................................E..C.GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  '........................XQ........GGGGGGGGGGGGGGG.......................................Q......GGGGGGG.....GGGGGGG....XQFQ.........................................................RRRRRRRRGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  '..................................GGGGGGGGGGGGGGG..................................................................................................................................GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  '..S.5..C...C.........E.......E..2.GGGGGGGGGGGGGGG.........E......1.....................................E.C..........E.....E.......E........................E.................W.E..WGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGBBBGGGGGGGGGGGGGGLGGGGGGGGGGGGGGGGGGGGGGLGGGGGGLGGBBBGGGGGGGGGGGGGGGGGFFGGGGGGGGGG...GGGGGGGGGBBBGGGGGGGGGGGGGGGRRLRRRRRRRRRRRRGGGGGGGGGGGGGGGGGGGGGGGGGLGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGG.L......................L.GGGG.L..........X................GGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGG..L...............X...X.................L....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGG.L......................L.GGGG.L.....................3.....GGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGG..L.....................................L....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGG.L..C...4.T.............L.GGGG.L.....C..M....C....C.RRRRR..GGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGG..L..C.M..T.............................L....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRRRGGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGGRRRRRRRRRRRRRRLRRRRRRRRRRRFFRRRRRRRRRRRRLRRRRGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGG..............L.........................L....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGG..............L.........................L....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGG..............L....C.M...RRRR...C..C.T..L....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'RRRRRRRRRRRRRR...RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR...RRRRRRRRR...RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
];

/**
 * The smallest layout that is still a playable level: three ground tiles with
 * the spawn on the middle one. The Level Editor's Scratch button loads this
 * so a layout can be built up from nothing instead of by carving down
 * `LEVEL_1_LAYOUT` — the editor grows the grid in any direction as soon as a
 * tile is painted outside it (see `editor/growGrid.ts`), so starting this
 * small costs nothing.
 */
export const SCRATCH_LAYOUT: readonly string[] = ['.S.', 'GGG'];

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

/** The GAME's background-layer placements — parallel to `currentLayout`
 *  above, and reset the same way (in-memory only, not localStorage-backed).
 *  Written by the Level Editor's Try button, the only place that sets it. */
export const currentBackground = signal<BackgroundPlacement[]>([]);

/** Parsed terrain/dimensions for `currentLayout`. Recomputes whenever the
 *  Level Editor's Try button changes `currentLayout` (see its doc comment
 *  above); every other read site (PlatformerPage.tsx, PlatformerState.ts)
 *  reads this reactively via `.value` instead of a plain module-load-time
 *  constant, so a Try'd layout actually renders/simulates instead of the
 *  stale default. */
export const currentLevel = computed<LevelDef>(() => ({
  ...parseLevel(currentLayout.value),
  background: currentBackground.value,
}));

/** Player spawn point, read from `currentLayout`'s `S` marker. */
export const SPAWN_TILE = computed(() => findSpawnTile(currentLayout.value));

/** Hand-placed green (Course) enemy positions, from `currentLayout`'s `E` markers. */
export const ENEMY_TILES_GREEN = computed(() => findGreenEnemyTiles(currentLayout.value));

/** Hand-placed purple enemy positions, from `currentLayout`'s `M` markers.
 *  Purple slimes carry no CV fact — each drops one key, and the level holds
 *  exactly as many of them as it has chests. */
export const ENEMY_TILES_PURPLE = computed(() => findPurpleEnemyTiles(currentLayout.value));

/** Hand-placed Skill-category coin positions, from `currentLayout`'s `C` markers. */
export const COIN_TILES = computed(() => findCoinTiles(currentLayout.value));

/** Hand-placed crate block positions (8 — one per Education, Activity and
 *  Language entry), from `currentLayout`'s `X` markers. */
export const CRATE_TILES = computed(() => findCrateTiles(currentLayout.value));

/** Hand-placed question-mark block positions (5 — one per Certificate and
 *  Project), from `currentLayout`'s `Q` markers. */
export const QUESTIONMARK_TILES = computed(() => findQuestionMarkTiles(currentLayout.value));

/** Hand-placed fragileRock block positions, from `currentLayout`'s `F`
 *  markers, kept distinct from the unrelated `groundRock` terrain tile. Two
 *  pairs plug holes in the surface above a cave (cols 65-66 and 134-135),
 *  opening a shortcut when broken from below; the rest is filler. */
export const FRAGILE_ROCK_TILES = computed(() => findFragileRockTiles(currentLayout.value));

/** Hand-placed coin-pot block positions, from `currentLayout`'s `u` markers
 *  — zipped against leftover skill-category defs a `C` marker didn't
 *  already claim (see BlockMapper.ts's `mapSkillCollectiblesToCoinPotBlocks`
 *  and PlatformerState.ts's `blockPlacements`). */
export const COIN_POT_TILES = computed(() => findCoinPotTiles(currentLayout.value));

/** Hand-placed chest positions (5 — one per Experience entry), from
 *  `currentLayout`'s `T` markers (spec.md FR-023). Opening all five is the
 *  level's win condition, so this count must stay equal to CVData's
 *  `experience` length: `placeChests` has no auto-placement fallback, and a
 *  missing marker would leave an Experience entry unreachable. */
export const CHEST_TILES = computed(() => findChestTiles(currentLayout.value));

/** Hand-placed hint-sign positions, from `currentLayout`'s digit markers
 *  (`1`-`9`, see LevelParser.ts's SIGN_CHARS, spec.md FR-040). One sign per
 *  hint, each standing where its mechanic is first needed — see this file's
 *  top doc comment. */
export const SIGN_TILES = computed(() => findSignTiles(currentLayout.value));
