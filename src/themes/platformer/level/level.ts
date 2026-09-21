import { signal, computed } from '@preact/signals-react';
import type { LevelDef } from './LevelData';
import {
  parseLevel,
  parseBackgroundLayout,
  findSpawnTile,
  findGreenEnemyTiles,
  findPurpleEnemyTiles,
  findCoinTiles,
  findCrateTiles,
  findQuestionMarkTiles,
  findFragileRockTiles,
  findCoinPotTiles,
  findPotionPotTiles,
  findBombPotTiles,
  findChestTiles,
  findCheckpointTiles,
  findSignTiles,
  findHazardTiles,
  findTorchTiles,
  findLadderBundleTiles,
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
// The first cave (Zone B) is also the one cave with authored dressing: a
// charcoal background layer behind its interior and three wall torches, so it
// reads as a stone gallery rather than open sky showing through the air (see
// `LEVEL_1_BACKGROUND` and the `¥` tiles in the layout below).
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
//   M  12  green slime — one per course
//   m  5   purple slime — no CV fact; each drops one key
//   o  13  coin — walk-over coins (16 skill categories total; the other 3 are
//          reachable via the `u` coin-pots below instead). A coin carries no
//          CVData binding of its own — see CollectibleMapper.ts's
//          mapCVDataToSkillFactPool doc comment — so this split is purely a
//          level-authoring choice, not a bookkeeping requirement.
//   =  8   crate — 2 education + 3 activities + 3 languages
//   ?  5   question-mark block — 2 certificates + 3 projects, each popping a
//          bonus fruit rather than carrying a fact of its own
//   F  5   fragileRock block — no fact; the two surface plugs plus filler
//   $  5   chest — one per experience entry; opening all five ends the run
//   C  0   checkpoint — no fact; raises its flag and becomes the active
//          respawn point once stepped on with solid ground below. Shipped
//          levels contain none: the tile is authorable in the editor only
//          (O-001).
//   u  3   coin-pot — destroyed by landing on top, drops a coin (2 adjacent
//          + 1 isolated, to exercise the merged-run rendering); same
//          no-CVData-binding convention as every other block kind
//   p  0   potion-pot — destroyed by landing on top, drops a heart pickup
//          that heals half a heart; no fact. Not yet placed anywhere in this
//          level — the mechanism exists (see entities/blocks/PotionPot.ts)
//          but no level-design placement decision has been made for it yet.
//   b  1   bomb-pot — destroyed by landing on top, drops a bomb pickup the
//          player carries and places (O-012); no fact, same
//          no-CVData-binding convention as the other pots. One is placed on
//          the base ground in zone A so the mechanic is reachable early.
//   ^  1   spike (floor) — damages the player on touch, no stomp-defeat
//   v  1   spike (ceiling)
//   <  1   spike (right wall)
//   >  1   spike (left wall)
//
// A question-mark's fruit rests in the tile directly above the block and stays
// there, so a `?` is only ever placed under open sky — one inside a cave would
// pop its fruit into the ceiling, where nothing could reach it. Crates and
// fragileRocks have no such constraint and do go underground.
//
// Keys and chests are deliberately kept apart. Chest 1 (col 40) sits in zone
// B's cave, while the first key is a zone C cave slime — so the first chest
// found cannot be opened yet, and the player either backtracks or remembers
// it. Five slimes for five chests means every key is needed and none is spare.
//
// `1`-`6` are hint signs (LevelParser.ts's SIGN_CHARS), each placed where its
// mechanic is first needed AND actually pays off: `5` (open all the chests) at
// spawn, `2` (ladder) beside the first ladder, `4` (chests need a key) beside
// the first chest, `3` (fragile rocks break from below) on the ledge under
// zone C's plug, `1` (bridge drop-through) on zone C's cave-mouth bridge —
// deliberately NOT on the meadow bridge, where dropping through only earns a
// pit fall; on the cave mouth, dropping through is the way in — and `6`
// (place a bomb with B) beside the first blue bomb-pot in zone A.
export const LEVEL_1_LAYOUT: readonly string[] = [
  '..................................................................................................................................................................................................................m....$....',
  '.............................................................................................................................................................................................?..........=.....HGGGGGGGGGGG..',
  '..............................................................................................................................................................................................................HGGGGGGGGGGG..',
  '................................................................................................................................................................................................M.............HGGGGGGGGGGG.$',
  '..............................................=......................................................................................................................................=.....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  '...........................................................................................................................................................................................GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  '........................................M........................................................o...........m........................................................................M..o.GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  '.............HGGGGGGGG@.=?........GGGGGGGGGGGGGGG.......................................?......GGGGGGG.....GGGGGGG....=?F?.........................................................RRRRRRRRGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  '.............H....................GGGGGGGGGGGGGGG..................................................................................................................................GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  '..S.5..o...oCH.......M....6b.M..2.GGGGGGGGGGGGGGGuu.u.....M......1.........^...........................M.o..........M.....M.......M........................M.................#.M..#GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGGBBBGGGGGGGGGGGGGGHGGGGGGGGGGGGGGGGGGGGGGHGGGGGGHGGBBBGGGGGGGGGGGGGGGGGFFGGGGGGGGGG...GGGGGGGGGBBBGGGGGGGGGGGGGGGRRHRRRRRRRRRRRRGGGGGGGGGGGGGGGGGGGGGGGGGHGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGG.H........⊤....⊤........H<GGGG>H..........=................GGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGG..H.......v.......=...=.................H....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGG.H..¥........¥........¥.H.GGGG.H.....................3.....GGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGG..H.....................................H....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGG.H..o...4.$.⊥...⊥.......H.GGGG.H.....o..m....o....o.RRRRR..GGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGG..H..o.m..$.............................H....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRRRGGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGGRRRRRRRRRRRRRRHRRRRRRRRRRRFFRRRRRRRRRRRRHRRRRGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGG..............H.........................H....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGGX.....X.......H.........................H....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGGc.............H....o.m...RRRR...o..o.$..H....GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'GGGGGGGGGGGGGG...GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG...GGGGGGGGG...GGGGGGGGGGGGGGGRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
  'RRRRRRRRRRRRRR...RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR...RRRRRRRRR...RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
];

/**
 * The shipped level's background layer — a `readonly string[]` layout
 * (`BACKGROUND_CHARS`, `LevelParser.ts`) aligned 1:1 with `LEVEL_1_LAYOUT`,
 * same row count, same storage shape `layout` itself has (O-014's storage-
 * unification revision). The first cave (Zone B, cols 30-56, rows 11-13 —
 * the gallery under the hillside, reached by the ladders at cols 31 and 54)
 * is filled with `c` (`charcoal`, cave family) so its interior reads as one
 * continuous stone mass instead of showing the open parallax sky through the
 * air — the same footprint the old nine stamped `charcoalBlock3x3` pieces
 * covered, now expressed as a dense fill rather than nine separate anchored
 * stamps. `parseBackgroundLayout` (below, via `currentLevel`) turns this into
 * the engine-facing `BackgroundGrid`, the same way `parseLevel` turns
 * `LEVEL_1_LAYOUT` into `TileMap`.
 */
export const LEVEL_1_BACKGROUND: readonly string[] = LEVEL_1_LAYOUT.map((_, row) =>
  Array.from({ length: LEVEL_1_LAYOUT[0].length }, (_, col) =>
    row >= 11 && row <= 13 && col >= 30 && col <= 56 ? 'c' : '.',
  ).join(''),
);

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
 * `editorLevelSignal` in `editor/editorState.ts`): a real page
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

/** The GAME's background layer — parallel to `currentLayout` above, and
 *  reset the same way (in-memory only, not localStorage-backed), holding the
 *  same raw `readonly string[]` layout shape (not a parsed `BackgroundGrid`
 *  — see `currentLevel` below, which is where parsing happens, mirroring
 *  `currentLayout`'s own relationship to `parseLevel`). Starts at the
 *  shipped cave backdrop (`LEVEL_1_BACKGROUND`); the Level Editor's Try
 *  button is the only place that overwrites it at runtime. */
export const currentBackgroundLayout = signal<readonly string[]>(LEVEL_1_BACKGROUND);

/** Parsed terrain/dimensions for `currentLayout`, with `background` parsed
 *  from `currentBackgroundLayout` via `parseBackgroundLayout` and clamped to
 *  the freshly-parsed terrain's own bounds. Recomputes whenever the Level
 *  Editor's Try button changes `currentLayout`/`currentBackgroundLayout` (see
 *  their doc comments above); every other read site (PlatformerPage.tsx,
 *  PlatformerState.ts) reads this reactively via `.value` instead of a plain
 *  module-load-time constant, so a Try'd layout actually renders/simulates
 *  instead of the stale default. */
export const currentLevel = computed<LevelDef>(() => {
  const terrain = parseLevel(currentLayout.value);
  return {
    ...terrain,
    background: parseBackgroundLayout(currentBackgroundLayout.value, terrain.width, terrain.height),
  };
});

/** Player spawn point, read from `currentLayout`'s `S` marker. */
export const SPAWN_TILE = computed(() => findSpawnTile(currentLayout.value));

/** Hand-placed green (Course) enemy positions, from `currentLayout`'s `M` markers. */
export const ENEMY_TILES_GREEN = computed(() => findGreenEnemyTiles(currentLayout.value));

/** Hand-placed purple enemy positions, from `currentLayout`'s `m` markers.
 *  Purple slimes carry no CV fact — each drops one key, and the level holds
 *  exactly as many of them as it has chests. */
export const ENEMY_TILES_PURPLE = computed(() => findPurpleEnemyTiles(currentLayout.value));

/** Hand-placed Skill-category coin positions, from `currentLayout`'s `o` markers. */
export const COIN_TILES = computed(() => findCoinTiles(currentLayout.value));

/** Hand-placed crate block positions (8 — one per Education, Activity and
 *  Language entry), from `currentLayout`'s `=` markers. */
export const CRATE_TILES = computed(() => findCrateTiles(currentLayout.value));

/** Hand-placed question-mark block positions (5 — one per Certificate and
 *  Project), from `currentLayout`'s `?` markers. */
export const QUESTIONMARK_TILES = computed(() => findQuestionMarkTiles(currentLayout.value));

/** Hand-placed fragileRock block positions, from `currentLayout`'s `F`
 *  markers, kept distinct from the unrelated `groundRock` terrain tile. Two
 *  pairs plug holes in the surface above a cave (cols 65-66 and 134-135),
 *  opening a shortcut when broken from below; the rest is filler. */
export const FRAGILE_ROCK_TILES = computed(() => findFragileRockTiles(currentLayout.value));

/** Hand-placed coin-pot block positions, from `currentLayout`'s `u` markers
 *  — purely positional, no CVData binding (see CollectibleMapper.ts's
 *  mapCVDataToSkillFactPool doc comment and BlockMapper.ts's placeBlocks). */
export const COIN_POT_TILES = computed(() => findCoinPotTiles(currentLayout.value));

/** Hand-placed potion-pot block positions, from `currentLayout`'s `p` markers
 *  — purely positional, no CVData binding (same convention as COIN_POT_TILES
 *  above; a potion-pot's dropped heart heals a fixed amount, never reveals a
 *  fact). currentLevel has none of these yet — this is the mechanism only,
 *  not a level-design placement decision. */
export const POTION_POT_TILES = computed(() => findPotionPotTiles(currentLayout.value));

/** Hand-placed bomb-pot block positions, from `currentLayout`'s `b` markers
 *  — purely positional, no CVData binding (same convention as
 *  COIN_POT_TILES/POTION_POT_TILES above; a bomb-pot's dropped bomb is an
 *  inventory resource carrying no fact). O-012. */
export const BOMB_POT_TILES = computed(() => findBombPotTiles(currentLayout.value));

/** Hand-placed chest positions (5 — one per Experience entry), from
 *  `currentLayout`'s `$` markers (spec.md FR-023). Opening all five is the
 *  level's win condition, so this count must stay equal to CVData's
 *  `experience` length: `placeChests` has no auto-placement fallback, and a
 *  missing marker would leave an Experience entry unreachable. */
export const CHEST_TILES = computed(() => findChestTiles(currentLayout.value));

/** Hand-placed checkpoint positions, from `currentLayout`'s `C` markers —
 *  purely positional, no CVData binding (same convention as COIN_POT_TILES
 *  above). Zero in the shipped level: checkpoints are authorable in the Level
 *  Editor, not shipped (O-001 spec Out of Scope). Reading order is preserved
 *  — the deterministic same-tick tie-break depends on it (see
 *  CheckpointLogic.ts). */
export const CHECKPOINT_TILES = computed(() => findCheckpointTiles(currentLayout.value));

/** Hand-placed hint-sign positions, from `currentLayout`'s digit markers
 *  (`1`-`9`, see LevelParser.ts's SIGN_CHARS, spec.md FR-040). One sign per
 *  hint, each standing where its mechanic is first needed — see this file's
 *  top doc comment. */
export const SIGN_TILES = computed(() => findSignTiles(currentLayout.value));

/** Hand-placed spike-hazard positions, from `currentLayout`'s `^`/`v`/`<`/`>`
 *  markers (LevelParser.ts's HAZARD_CHARS) — purely positional/cosmetic-
 *  facing, no CVData binding, same convention as SIGN_TILES. */
export const HAZARD_TILES = computed(() => findHazardTiles(currentLayout.value));

/** Hand-placed wall-torch positions, from `currentLayout`'s `¥` markers (a
 *  `torch` TERRAIN_CHARS entry). Torches are the only light sources the cave
 *  lighting reads: `PlatformerState.ts`'s `torchPositions` maps each of these
 *  cells to its world-space centre for the render pass (research D4). */
export const TORCH_TILES = computed(() => findTorchTiles(currentLayout.value));

/** Hand-placed deployable rope-ladder bundle positions, from `currentLayout`'s
 *  `@` markers (a `ladderBundle` TERRAIN_CHARS entry). `PlatformerState.ts`
 *  seeds one `DeployableLadderState` per cell here; the shipped level uses
 *  them to demonstrate the mechanic (see this file's `LEVEL_1_LAYOUT`). */
export const LADDER_BUNDLE_TILES = computed(() => findLadderBundleTiles(currentLayout.value));
