import type {
  LevelDef,
  TileMap,
  TileType,
  BackgroundGrid,
  BackgroundMaterialId,
  MarkerEntry,
  MarkerGrid,
  MarkerPlacement,
} from './LevelData';
import type { HintId } from '../types';
import { DEFAULT_HINT_ID, isHintId } from './HintCatalog';

/** An entity marker's kind — what it means, not what it looks like on the
 *  ground (every entity marker sits on `empty` terrain, see parseLevel). */
export type EntityKind =
  | 'spawn'
  | 'enemyGreen'
  | 'enemyPurple'
  | 'enemyBee'
  | 'coin'
  | 'crate'
  | 'questionMark'
  | 'fragileRock'
  | 'coinPot'
  | 'potionPot'
  | 'bombPot'
  | 'chest'
  | 'checkpoint';

/**
 * Maps each terrain character usable in a level layout to its tile type.
 * Shared by every level's raw ASCII layout, not just `currentLevel`.
 */
export const TERRAIN_CHARS: Record<string, TileType | undefined> = {
  '.': 'empty',
  G: 'groundGrass',
  R: 'groundRock',
  '#': 'wall',
  B: 'bridge',
  H: 'ladder',
  I: 'chain',
  n: 'bush',
  N: 'fence',
  X: 'cobweb',
  c: 'crystalCluster',
  '⊤': 'stalactite',
  '⊥': 'stalagmite',
  '¥': 'torch',
  '@': 'ladderBundle',
  // '§' is not a valid JS identifier, so its key is quoted.
  '§': 'bouncyMushroom',
  s: 'decorativeMushroom',
  // O-023's crumbling floor. Half-height ledge art, own runtime cycle state
  // (engine/CrumblingFloor.ts) — the grid holds only its fixed placement.
  g: 'crumblingFloor',
};

/**
 * Maps each entity-marker character usable in a level layout to what it
 * marks: `S` (spawn), `M` (green/Course enemy), `m` (purple enemy — carries
 * no CV fact, drops a key on defeat), `o` (Skill-category coin), `=` (crate block — Education/Activity/
 * Language fact), `?` (question-mark block — no fact, spawns a bonus fruit),
 * `F` (fragileRock block — no fact, level-design filler), `u` (coin-pot block —
 * destroyed by landing on top, drops a coin; lowercase, a small urn-shaped
 * glyph, unlike every other entity marker which is uppercase), `p` (potion-pot
 * block — destroyed by landing on top like a coin-pot, drops a heart pickup
 * that heals half a heart; no fact, same no-CVData-binding convention as
 * `coin-pot/fragileRock), `b` (bomb-pot block — destroyed by landing on top
 * like the other pots, drops a bomb pickup the player carries and places;
 * no fact, same no-CVData-binding convention, O-012), `q` (bee enemy — flies
 * horizontally over gaps, stompable like a green slime, drops nothing and
 * counts toward nothing; O-024), `$` (chest —
 * Experience fact, opened via Arrow Up while standing on it, spec.md
 * FR-023), `C` (checkpoint — no CV fact, raises a flag once stepped on with
 * solid ground below and becomes the active respawn point for the rest of the
 * run; O-001). Kept as its own
 * map, separate from TERRAIN_CHARS, since an entity marker isn't a terrain
 * tile — the ground it sits on is always `empty` (see parseLevel below), and
 * it's a fundamentally different kind of fact about a cell ("what starts
 * here") than terrain is ("what's the ground").
 */
export const ENTITY_CHARS: Record<string, EntityKind | undefined> = {
  S: 'spawn',
  M: 'enemyGreen',
  m: 'enemyPurple',
  q: 'enemyBee',
  o: 'coin',
  '=': 'crate',
  '?': 'questionMark',
  F: 'fragileRock',
  u: 'coinPot',
  p: 'potionPot',
  b: 'bombPot',
  $: 'chest',
  C: 'checkpoint',
};

/**
 * The one uniform sign layout character. Every sign is a `T` cell; its hint
 * lives on the tile meta layer as a `{ kind: 'sign', hintId }` marker, so the
 * layout can be freely edited without scrambling which sign shows which text
 * (FR-025). Resolves to `'empty'` terrain, exactly as the old digit sign
 * characters did.
 */
export const SIGN_CHAR = 'T';

/**
 * The **only** place a marker character exists: the load-time migration map
 * for a file authored before the tile meta layer (FR-015). Every entry lifts
 * to a typed `MarkerEntry` and its terrain cell is written `'empty'`. A legacy
 * `T` is not in this map because `T` is genuinely overloaded between the old
 * falling-stalactite hazard and the new sign character; `parseLevel` resolves
 * it by file generation instead (see its doc comment).
 */
export const LEGACY_MARKER_CHARS: Record<string, MarkerEntry | undefined> = {
  P: { kind: 'patrolBoundary' },
  '+': { kind: 'connectionPoint' },
  '1': { kind: 'sign', hintId: 'bridgeDropThrough' },
  '2': { kind: 'sign', hintId: 'ladderClimbUp' },
  '3': { kind: 'sign', hintId: 'fragileRockBreaksFromBelow' },
  '4': { kind: 'sign', hintId: 'chestNeedsKey' },
  '5': { kind: 'sign', hintId: 'openAllChestsHaveFun' },
  '6': { kind: 'sign', hintId: 'bomb' },
};

/** A spike hazard's facing — which of the 4 pre-drawn sprites in
 *  `staticObjects.png` (columns 3-4, rows 6-7) is shown. Purely cosmetic for
 *  collision purposes: touching any part of a spike's tile damages the
 *  player regardless of which face was touched (see Spike.ts's `box`) —
 *  facing only selects the sprite. */
export type HazardFacing = 'up' | 'down' | 'left' | 'right';

/** Every hazard kind the game knows about. `spike` (O-005), the floor
 *  `spear` (O-020) and the floor `floorSpike` (O-021) today, but every place
 *  that would otherwise hardcode the literal `'spike'` (HAZARD_CHARS's value
 *  type below, findHazardTiles's return type, HazardMapper.ts's
 *  HazardPlacement/placeHazards) is typed against this instead — adding
 *  another kind is one line here plus its own module and registry entry
 *  (entities/hazards/index.ts), nothing else widens by hand. */
export type HazardKind = 'spike' | 'spear' | 'floorSpike' | 'fallingStalactite';

/**
 * Maps each hazard-marker character to the hazard it places. Same
 * hand-authored-content convention as LEGACY_MARKER_CHARS (the character itself
 * carries the identity directly, no CVData zip) — a level author picks the
 * exact facing per cell, the same way every other tile is placed explicitly.
 * `hazardType` is carried on every entry (not hardcoded to `'spike'`
 * elsewhere) so a future hazard kind beyond spike only needs a new entry
 * here plus a new `HAZARD_TYPES` registry line (entities/hazards/index.ts) —
 * nothing else in this file changes.
 */
export const HAZARD_CHARS: Record<string, { hazardType: HazardKind; facing: HazardFacing } | undefined> = {
  '^': { hazardType: 'spike', facing: 'up' },
  v: { hazardType: 'spike', facing: 'down' },
  '<': { hazardType: 'spike', facing: 'left' },
  '>': { hazardType: 'spike', facing: 'right' },
  // O-020's floor spear: `¦` (U+00A6, BROKEN BAR), the floor orientation only.
  '¦': { hazardType: 'spear', facing: 'up' },
  // O-021's floor spike. Floor-only (FR-013) — no facing cycle, unlike the
  // static spike above.
  A: { hazardType: 'floorSpike', facing: 'up' },
  // O-027's falling stalactite is NO LONGER a hazard character: it is a
  // `{kind:'fallingStalactite'}` marker on the decorative `⊤` tile (FR-026),
  // discovered by `findHazardTiles` below. Its freed `T` is the sign
  // character (FR-025).
};

// A character can only mean one thing — guard against TERRAIN_CHARS,
// ENTITY_CHARS, SIGN_CHAR, and HAZARD_CHARS accidentally sharing a key, which
// independent maps don't prevent on their own the way one unified table
// would.
const charOwners: Record<string, string[]> = {};
for (const char of Object.keys(TERRAIN_CHARS)) (charOwners[char] ??= []).push('terrain');
for (const char of Object.keys(ENTITY_CHARS)) (charOwners[char] ??= []).push('entity');
(charOwners[SIGN_CHAR] ??= []).push('sign');
for (const char of Object.keys(HAZARD_CHARS)) (charOwners[char] ??= []).push('hazard');
const sharedChars = Object.entries(charOwners)
  .filter(([, owners]) => owners.length > 1)
  .map(([char]) => char);
if (sharedChars.length > 0) {
  throw new Error(
    `Level character(s) defined as more than one of terrain/entity/sign/hazard: ${sharedChars.join(', ')}`,
  );
}

/**
 * Every character a level layout string may legally contain — the union of
 * every `TERRAIN_CHARS`, `ENTITY_CHARS`, `SIGN_CHAR`, and `HAZARD_CHARS` key.
 * Deliberately NOT derived via `keyof typeof TERRAIN_CHARS | keyof typeof
 * ENTITY_CHARS`: the maps are annotated `Record<string, ... | undefined>`
 * (required so `parseLevel`'s and finder functions' lookups can index by a
 * plain `string`), which makes `keyof typeof` widen to plain `string` — a
 * `TileChar` derived that way would carry no type safety at all. Kept in sync
 * with the maps by a test asserting every key of all appears here, not by
 * direct derivation.
 */
export type TileChar =
  | '.'
  | 'G'
  | 'R'
  | '#'
  | 'B'
  | 'H'
  | 'I'
  | 'S'
  | 'M'
  | 'm'
  | 'q'
  | 'o'
  | '='
  | '?'
  | 'F'
  | '$'
  | 'u'
  | 'p'
  | 'b'
  | 'n'
  | 'N'
  | 'X'
  | 'c'
  | '⊤'
  | '⊥'
  | '¥'
  | '^'
  | 'v'
  | '<'
  | '>'
  | '¦'
  | 'A'
  | 'T'
  | 'C'
  | '@'
  | '§'
  | 's'
  | 'g';

/**
 * Parses a level's raw ASCII layout (one character per tile, see
 * TERRAIN_CHARS/ENTITY_CHARS, top row first) into a `LevelDef`'s terrain
 * grid. Width and height are read from the layout itself — never
 * hardcoded — so any layout of any size works, which is also what makes
 * this parser testable independently of any specific level's real data.
 * Entity markers resolve to `empty` terrain here — use findSpawnTile/
 * findGreenEnemyTiles/findPurpleEnemyTiles below to read their positions.
 *
 * An unrecognized character is skipped (treated as `empty`) and logged via
 * `console.warn` once per distinct character, rather than throwing. A level
 * authored against a newer palette (or a hand-edited layout with a typo)
 * should still load and play — a single stray character must not turn the
 * whole canvas blue — and the warning is what surfaces it to the author.
 */
/**
 * Builds the tile meta layer for a layout, lifting every legacy marker
 * character out of `layout` and merging `storedMarkers` on top (FR-015/FR-016).
 *
 * The **`T` generation rule** (FR-015 vs FR-025/FR-027): `T` is overloaded
 * between the old falling-stalactite hazard and the new sign character. The
 * `markers` field disambiguates. `storedMarkers === undefined` means the file
 * has no `markers` field at all, so it is pre-feature and a `T` lifts to
 * `{kind:'fallingStalactite'}`. When `storedMarkers` is present (even `[]`)
 * the file is new-format and `T` is a sign; its hint is the cell's `sign`
 * marker (applied below) or `DEFAULT_HINT_ID` when the marker is absent. An
 * explicit `sign` marker at a `T` cell always wins.
 *
 * A stored entry with an unrecognised `kind` or an out-of-bounds `(col, row)`
 * is ignored; a `sign` whose `hintId` is not registered falls back to
 * `DEFAULT_HINT_ID`. A later duplicate `(col, row)` replaces an earlier one.
 */
export function parseMarkers(
  layout: readonly string[],
  storedMarkers: readonly MarkerPlacement[] | undefined,
  width: number,
  height: number,
): MarkerGrid {
  const grid: MarkerGrid = Array.from({ length: height }, () =>
    new Array<MarkerEntry | null>(width).fill(null),
  );

  for (let row = 0; row < height; row++) {
    const line = layout[row] ?? '';
    for (let col = 0; col < width; col++) {
      const char = line[col];
      if (char === undefined) continue;
      if (char === SIGN_CHAR) {
        if (storedMarkers === undefined) grid[row][col] = { kind: 'fallingStalactite' };
        continue;
      }
      const legacy = LEGACY_MARKER_CHARS[char];
      if (legacy) grid[row][col] = legacy;
    }
  }

  if (storedMarkers !== undefined) {
    for (const placement of storedMarkers) {
      if (placement === null || typeof placement !== 'object') continue;
      const { col, row } = placement;
      if (
        typeof col !== 'number' ||
        typeof row !== 'number' ||
        !Number.isInteger(col) ||
        !Number.isInteger(row) ||
        col < 0 ||
        row < 0 ||
        col >= width ||
        row >= height
      ) {
        continue;
      }
      const marker = normalizeMarkerEntry(placement.marker);
      if (marker) grid[row][col] = marker;
    }
  }

  return grid;
}

/** Narrows a stored marker value to the closed `MarkerEntry` union, falling
 *  back to `DEFAULT_HINT_ID` for a `sign` whose `hintId` is unregistered and
 *  returning `null` for anything unrecognised (FR-016/FR-027). */
function normalizeMarkerEntry(value: unknown): MarkerEntry | null {
  if (value === null || typeof value !== 'object') return null;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === 'patrolBoundary' || kind === 'connectionPoint' || kind === 'fallingStalactite') {
    return { kind };
  }
  if (kind === 'sign') {
    const hintId = (value as { hintId?: unknown }).hintId;
    return { kind: 'sign', hintId: isHintId(hintId) ? hintId : DEFAULT_HINT_ID };
  }
  return null;
}

/**
 * Parses a level's raw ASCII layout (one character per tile, see
 * TERRAIN_CHARS/ENTITY_CHARS, top row first) into a `LevelDef`'s terrain
 * grid, plus the tile meta layer when `storedMarkers` is supplied. Width and
 * height are read from the layout itself — never hardcoded — so any layout of
 * any size works, which is also what makes this parser testable independently
 * of any specific level's real data. Entity markers resolve to `empty` terrain
 * here — use findSpawnTile/findGreenEnemyTiles/findPurpleEnemyTiles below to
 * read their positions.
 *
 * Legacy marker characters (`P`/`+`/digits, and a pre-feature `T`) lift out of
 * the terrain into the layer and their cell is written `'empty'` (a legacy `T`
 * becomes the decorative `⊤` tile) — see `parseMarkers`. `markers` is attached
 * only when at least one marker exists, so a marker-free `LevelDef` keeps its
 * pre-feature shape (FR-014).
 *
 * An unrecognized character is skipped (treated as `empty`) and logged via
 * `console.warn` once per distinct character, rather than throwing. A level
 * authored against a newer palette (or a hand-edited layout with a typo)
 * should still load and play — a single stray character must not turn the
 * whole canvas blue — and the warning is what surfaces it to the author.
 */
export function parseLevel(
  layout: readonly string[],
  storedMarkers?: readonly MarkerPlacement[],
): LevelDef {
  const height = layout.length;
  const width = layout.reduce((max, row) => Math.max(max, row.length), 0);
  const unknownChars = new Set<string>();

  const terrain: TileMap = layout.map((row) => {
    const chars = row.split('').map((char) => {
      const tile = TERRAIN_CHARS[char];
      if (tile) return tile;
      if (char === SIGN_CHAR) {
        // A pre-feature `T` is the old falling-stalactite hazard, which is now
        // the decorative `⊤` tile plus a marker; a new-format `T` is a sign.
        return storedMarkers === undefined ? 'stalactite' : 'empty';
      }
      if (ENTITY_CHARS[char] || LEGACY_MARKER_CHARS[char] || HAZARD_CHARS[char]) return 'empty';
      unknownChars.add(char);
      return 'empty';
    });
    while (chars.length < width) chars.push('empty');
    return chars;
  });

  if (unknownChars.size > 0) {
    console.warn(
      `Skipping unknown level tile character(s): ${[...unknownChars].map((c) => `"${c}"`).join(', ')}`,
    );
  }

  const markers = parseMarkers(layout, storedMarkers, width, height);
  const hasMarker = markers.some((markerRow) => markerRow.some((marker) => marker !== null));

  return hasMarker ? { terrain, width, height, markers } : { terrain, width, height };
}

/**
 * Maps each background-layer character to the material it paints — the
 * background's own analogue of `TERRAIN_CHARS`, mirroring it exactly except
 * that `'.'` (empty) is deliberately absent rather than mapped to a sentinel
 * value: there is no `BackgroundMaterialId` for "empty", `null` fills that
 * role in `BackgroundGrid` (see `LevelData.ts`), so `'.'` simply falls
 * through to `parseBackgroundLayout`'s unrecognized-character branch, which
 * already resolves to `null`.
 */
export const BACKGROUND_CHARS: Record<string, BackgroundMaterialId | undefined> = {
  d: 'dirt',
  r: 'rust',
  s: 'surfaceStone',
  c: 'charcoal',
  m: 'maroon',
  v: 'caveStone',
};

/**
 * Every character a background layout string may legally contain — the
 * union of `BACKGROUND_CHARS`' keys plus `'.'` (empty), mirroring `TileChar`.
 * Also the editor's background grid's own cell type (`BackgroundChar[][]`,
 * the background-layer analogue of `editorLevelSignal`'s `TileChar[][]`).
 */
export type BackgroundChar = '.' | 'd' | 'r' | 's' | 'c' | 'm' | 'v';

/**
 * Parses a background layout (the same one-character-per-cell `string[]`
 * shape as a foreground layout, via `BACKGROUND_CHARS`) into the dense
 * `BackgroundGrid` the engine/renderer consume — mirrors `parseLevel`'s
 * terrain-building loop, but simpler: no entity/sign/hazard concerns, and no
 * unknown-character warning, since an unrecognized background character is
 * purely decorative and silently reads as empty (`null`) rather than being
 * a level-breaking authoring mistake worth surfacing.
 *
 * Always clamps/pads its result to exactly `terrainWidth` x `terrainHeight`
 * rather than trusting the stored layout's own size: a background layout
 * shorter or narrower than the terrain reads as empty beyond its own bounds
 * (mirroring `backgroundAt`'s existing out-of-bounds-is-null contract), and
 * one taller or wider than the terrain must not let background draw past
 * where no terrain exists, so anything beyond the terrain's own bounds is
 * dropped here at parse time rather than left for a renderer to bounds-check
 * per cell.
 */
export function parseBackgroundLayout(
  layout: readonly string[],
  terrainWidth: number,
  terrainHeight: number,
): BackgroundGrid {
  const grid: BackgroundGrid = [];
  for (let row = 0; row < terrainHeight; row++) {
    const sourceRow = layout[row];
    const bgRow: (BackgroundMaterialId | null)[] = [];
    for (let col = 0; col < terrainWidth; col++) {
      const char = sourceRow?.[col];
      bgRow.push(char !== undefined ? (BACKGROUND_CHARS[char] ?? null) : null);
    }
    grid.push(bgRow);
  }
  return grid;
}

/** Finds every character in a level layout whose ENTITY_CHARS entry has the
 *  given `kind`, in reading order (top-to-bottom, left-to-right). Shared by
 *  findSpawnTile/findGreenEnemyTiles/findPurpleEnemyTiles below — all three
 *  just look for a different entity kind. */
function findAllOfKind(layout: readonly string[], kind: EntityKind): { col: number; row: number }[] {
  const tiles: { col: number; row: number }[] = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      if (ENTITY_CHARS[layout[row][col]] === kind) {
        tiles.push({ col, row });
      }
    }
  }
  return tiles;
}

/** Finds the `S` spawn marker's position in a level layout. */
export function findSpawnTile(layout: readonly string[]): { col: number; row: number } {
  const [first] = findAllOfKind(layout, 'spawn');
  if (!first) {
    throw new Error('Level layout has no spawn marker ("S")');
  }
  return first;
}

/**
 * Finds every `M` (green/Project) enemy marker's position in a level
 * layout, in reading order — this order is what `EnemyMapper.ts`'s
 * `placeEnemies` zips against the project-derived enemy defs (in
 * `mapCVDataToEnemies`'s output order) to assign hand-authored positions to
 * specific CV facts. Zero markers is valid — that CVData type simply has no
 * enemy on the map yet (there is no auto-placement fallback).
 */
export function findGreenEnemyTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'enemyGreen');
}

/** Finds every `m` (purple/Certificate) enemy marker's position in a level
 *  layout — same convention as findGreenEnemyTiles, for certificate-derived
 *  enemy defs instead of project-derived ones. */
export function findPurpleEnemyTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'enemyPurple');
}

/** Finds every `q` (bee) marker's position in a level layout, in reading
 *  order — a plain, position-derived enemy carrying no CV fact (O-024), so
 *  every marker found here becomes one placement directly (see
 *  EnemyMapper.ts's placeBees). */
export function findBeeTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'enemyBee');
}

/** Finds every `o` (Skill-category coin) marker's position in a level
 *  layout, in reading order — `CollectibleMapper.ts`'s `placeCollectibles`
 *  turns each into a purely positional placement; which skill-category fact
 *  (if any) a given coin reveals is resolved dynamically at pickup time
 *  (see `mapCVDataToSkillFactPool`'s doc comment), not bound here. */
export function findCoinTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'coin');
}

/** Finds every `=` (crate block) marker's position in a level layout — same
 *  convention as findCoinTiles, for crate block defs instead
 *  of collectible defs (see BlockMapper.ts's placeBlocks). */
export function findCrateTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'crate');
}

/** Finds every `?` (question-mark block) marker's position in a level
 *  layout. Question-mark blocks carry no CV fact (spec.md's FR-021
 *  amendment) — every marker found here becomes a placement directly (see
 *  BlockMapper.ts's placeBlocks), unlike findCrateTiles's markers which are
 *  zipped against CVData-derived defs. */
export function findQuestionMarkTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'questionMark');
}

/** Finds every `F` (fragileRock block) marker's position in a level layout —
 *  same no-CV-fact convention as findQuestionMarkTiles. */
export function findFragileRockTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'fragileRock');
}

/** Finds every `u` (coin-pot block) marker's position in a level layout —
 *  same no-CVData-mapping convention as findFragileRockTiles; the coin a
 *  destroyed coin-pot drops is resolved dynamically at pickup time (see
 *  CollectibleMapper.ts's mapCVDataToSkillFactPool doc comment). */
export function findCoinPotTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'coinPot');
}

/** Finds every `p` (potion-pot block) marker's position in a level layout —
 *  same no-CVData-mapping convention as findCoinPotTiles; the heart a
 *  destroyed potion-pot drops carries no fact of its own, only a fixed heal
 *  amount (see Health.ts's HEART_PICKUP_HEAL_AMOUNT). */
export function findPotionPotTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'potionPot');
}

/** Finds every `b` (bomb-pot block) marker's position in a level layout —
 *  same no-CVData-mapping convention as findCoinPotTiles/findPotionPotTiles;
 *  the bomb a destroyed bomb-pot drops carries no fact of its own, only an
 *  inventory count (O-012). */
export function findBombPotTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'bombPot');
}

/** Finds every `$` (chest) marker's position in a level layout — same
 *  convention as findCrateTiles/findFragileRockTiles. Unlike those, a chest marker
 *  IS zipped against CVData-derived defs (one chest per Experience entry,
 *  spec.md FR-023) — see ChestMapper.ts's placeChests. */
export function findChestTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'chest');
}

/** Finds every `C` (checkpoint) marker's position in a level layout, in
 *  reading order — same convention as findChestTiles. Unlike a chest, a
 *  checkpoint carries no CVData binding at all: every marker found here
 *  becomes one placement directly (see CheckpointMapper.ts's
 *  placeCheckpoints), and the reading order is the contract the deterministic
 *  same-tick tie-break depends on (see CheckpointLogic.ts). */
export function findCheckpointTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'checkpoint');
}

/**
 * Finds every sign in a level layout, in reading order, paired with the hint
 * it shows. Each `SIGN_CHAR` (`T`) cell is paired with a `sign` marker at that
 * cell, or `DEFAULT_HINT_ID` when the marker is absent (FR-027) — the runtime
 * analogue of the editor's `synthesizeSignPlacements`. There is no separate
 * CVData-derived list to zip these positions against.
 */
export function findSignTiles(
  layout: readonly string[],
  markers?: MarkerGrid,
): { col: number; row: number; hintId: HintId }[] {
  const tiles: { col: number; row: number; hintId: HintId }[] = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      if (layout[row][col] !== SIGN_CHAR) continue;
      const marker = markers?.[row]?.[col];
      const hintId = marker?.kind === 'sign' ? marker.hintId : DEFAULT_HINT_ID;
      tiles.push({ col, row, hintId });
    }
  }
  return tiles;
}

/**
 * Finds every hazard in a level layout, in reading order, paired with its
 * hazard kind and facing. This is the **single** hazard-discovery entry point:
 * it scans the layout for the character hazards (`^`/`v`/`<`/`>`/`¦`/`A`) and
 * the marker grid for `{kind:'fallingStalactite'}` entries, returning one
 * combined list for the existing `placeHazards` pipeline. A caller asks for
 * "the level's hazards", never for each source separately (FR-032).
 */
export function findHazardTiles(
  layout: readonly string[],
  markers?: MarkerGrid,
): { col: number; row: number; hazardType: HazardKind; facing: HazardFacing }[] {
  const tiles: { col: number; row: number; hazardType: HazardKind; facing: HazardFacing }[] = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      const hazard = HAZARD_CHARS[layout[row][col]];
      if (hazard) tiles.push({ col, row, ...hazard });
      if (markers?.[row]?.[col]?.kind === 'fallingStalactite') {
        tiles.push({ col, row, hazardType: 'fallingStalactite', facing: 'down' });
      }
    }
  }
  return tiles;
}

/**
 * Finds every `¥` (wall torch) tile's position in a level layout, in reading
 * order. A torch is terrain, not an entity marker, so this is a direct scan of
 * `TERRAIN_CHARS` — the same scan-for-a-known-character shape as
 * `findSignTiles`/`findHazardTiles`, NOT the `ENTITY_CHARS`/`findAllOfKind`
 * path `findCoinTiles` uses. The positions feed `TORCH_TILES` and, through it,
 * the `torchPositions` light sources the lighting pass reads (research D4).
 */
export function findTorchTiles(layout: readonly string[]): { col: number; row: number }[] {
  const tiles: { col: number; row: number }[] = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      if (TERRAIN_CHARS[layout[row][col]] === 'torch') {
        tiles.push({ col, row });
      }
    }
  }
  return tiles;
}

/**
 * Finds every `@` (deployable rope-ladder bundle) tile's position in a level
 * layout, in reading order — the same direct `TERRAIN_CHARS` scan shape as
 * `findTorchTiles`, since a bundle is terrain rather than an entity marker.
 * The positions feed `LADDER_BUNDLE_TILES` and, through it, the per-bundle
 * deployment state `PlatformerState.ts` seeds (O-011).
 */
export function findLadderBundleTiles(layout: readonly string[]): { col: number; row: number }[] {
  const tiles: { col: number; row: number }[] = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      if (TERRAIN_CHARS[layout[row][col]] === 'ladderBundle') {
        tiles.push({ col, row });
      }
    }
  }
  return tiles;
}
