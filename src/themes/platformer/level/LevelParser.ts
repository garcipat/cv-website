import type { LevelDef, TileMap, TileType } from './LevelData';
import type { HintId } from '../types';

/** An entity marker's kind — what it means, not what it looks like on the
 *  ground (every entity marker sits on `empty` terrain, see parseLevel). */
export type EntityKind =
  | 'spawn'
  | 'enemyGreen'
  | 'enemyPurple'
  | 'coin'
  | 'crate'
  | 'questionMark'
  | 'fragileRock'
  | 'chest';

/**
 * Maps each terrain character usable in a level layout to its tile type.
 * Shared by every level's raw ASCII layout, not just `currentLevel`.
 */
export const TERRAIN_CHARS: Record<string, TileType | undefined> = {
  '.': 'empty',
  G: 'groundGrass',
  R: 'groundRock',
  W: 'wall',
  B: 'bridge',
  L: 'ladder',
  P: 'patrol',
  n: 'bush',
  N: 'fence',
};

/**
 * Maps each entity-marker character usable in a level layout to what it
 * marks: `S` (spawn), `E` (green/Course enemy), `M` (purple enemy — carries
 * no CV fact, drops a key on defeat), `C` (Skill-category coin), `X` (crate block — Education/Activity/
 * Language fact), `Q` (question-mark block — no fact, spawns a bonus fruit),
 * `F` (fragileRock block — no fact, level-design filler), `T` (chest —
 * Experience fact, opened via Arrow Up while standing on it, spec.md
 * FR-023). Kept as its own
 * map, separate from TERRAIN_CHARS, since an entity marker isn't a terrain
 * tile — the ground it sits on is always `empty` (see parseLevel below), and
 * it's a fundamentally different kind of fact about a cell ("what starts
 * here") than terrain is ("what's the ground").
 */
export const ENTITY_CHARS: Record<string, EntityKind | undefined> = {
  S: 'spawn',
  E: 'enemyGreen',
  M: 'enemyPurple',
  C: 'coin',
  X: 'crate',
  Q: 'questionMark',
  F: 'fragileRock',
  T: 'chest',
};

/**
 * Maps each sign-marker character to the hint it shows. Unlike ENTITY_CHARS
 * (coins/enemies/blocks/chests, whose specific CV fact comes from zipping
 * marker discovery order against CVData), a sign's content is hand-authored,
 * not derived from CVData — so the character itself carries the hint's
 * identity directly. This means the level layout can be freely edited
 * (rows/columns added, removed, reordered) without ever scrambling which
 * sign shows which text — a zip-by-discovery-order approach couldn't
 * guarantee that. Capped at digits 1-9 (an accepted constraint, FR-037):
 * this level is expected to need only a handful of distinct hints ever.
 */
export const SIGN_CHARS: Record<string, HintId | undefined> = {
  '1': 'bridgeDropThrough',
  '2': 'ladderClimbUp',
  '3': 'fragileRockBreaksFromBelow',
  '4': 'chestNeedsKey',
  '5': 'openAllChestsHaveFun',
};

// A character can only mean one thing — guard against TERRAIN_CHARS,
// ENTITY_CHARS, and SIGN_CHARS accidentally sharing a key, which three
// independent maps don't prevent on their own the way one unified table
// would.
const charOwners: Record<string, string[]> = {};
for (const char of Object.keys(TERRAIN_CHARS)) (charOwners[char] ??= []).push('terrain');
for (const char of Object.keys(ENTITY_CHARS)) (charOwners[char] ??= []).push('entity');
for (const char of Object.keys(SIGN_CHARS)) (charOwners[char] ??= []).push('sign');
const sharedChars = Object.entries(charOwners)
  .filter(([, owners]) => owners.length > 1)
  .map(([char]) => char);
if (sharedChars.length > 0) {
  throw new Error(
    `Level character(s) defined as more than one of terrain/entity/sign: ${sharedChars.join(', ')}`,
  );
}

/**
 * Every character a level layout string may legally contain — the union of
 * every `TERRAIN_CHARS` and `ENTITY_CHARS` key. Deliberately NOT derived via
 * `keyof typeof TERRAIN_CHARS | keyof typeof ENTITY_CHARS`: both maps are
 * annotated `Record<string, ... | undefined>` (required so `parseLevel`'s
 * and `findAllOfKind`'s existing `TERRAIN_CHARS[char]`/`ENTITY_CHARS[char]`
 * lookups can index by a plain `string`), which makes `keyof typeof` widen
 * to plain `string` — a `TileChar` derived that way would carry no type
 * safety at all. Kept in sync with the two maps by a test asserting every
 * key of both appears here, not by direct derivation.
 */
export type TileChar =
  | '.'
  | 'G'
  | 'R'
  | 'W'
  | 'B'
  | 'L'
  | 'P'
  | 'S'
  | 'E'
  | 'M'
  | 'C'
  | 'X'
  | 'Q'
  | 'F'
  | 'T'
  | 'n'
  | 'N'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5';

/**
 * Parses a level's raw ASCII layout (one character per tile, see
 * TERRAIN_CHARS/ENTITY_CHARS, top row first) into a `LevelDef`'s terrain
 * grid. Width and height are read from the layout itself — never
 * hardcoded — so any layout of any size works, which is also what makes
 * this parser testable independently of any specific level's real data.
 * Entity markers resolve to `empty` terrain here — use findSpawnTile/
 * findGreenEnemyTiles/findPurpleEnemyTiles below to read their positions.
 */
export function parseLevel(layout: readonly string[]): LevelDef {
  const height = layout.length;
  const width = layout.reduce((max, row) => Math.max(max, row.length), 0);

  const terrain: TileMap = layout.map((row) => {
    const chars = row.split('').map((char) => {
      const tile = TERRAIN_CHARS[char];
      if (tile) return tile;
      if (ENTITY_CHARS[char] || SIGN_CHARS[char]) return 'empty';
      throw new Error(`Unknown level tile character: "${char}"`);
    });
    while (chars.length < width) chars.push('empty');
    return chars;
  });

  return { terrain, width, height };
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
 * Finds every `E` (green/Project) enemy marker's position in a level
 * layout, in reading order — this order is what `EnemyMapper.ts`'s
 * `placeEnemies` zips against the project-derived enemy defs (in
 * `mapCVDataToEnemies`'s output order) to assign hand-authored positions to
 * specific CV facts. Zero markers is valid — that CVData type simply has no
 * enemy on the map yet (there is no auto-placement fallback).
 */
export function findGreenEnemyTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'enemyGreen');
}

/** Finds every `M` (purple/Certificate) enemy marker's position in a level
 *  layout — same convention as findGreenEnemyTiles, for certificate-derived
 *  enemy defs instead of project-derived ones. */
export function findPurpleEnemyTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'enemyPurple');
}

/** Finds every `C` (Skill-category coin) marker's position in a level
 *  layout, in reading order — `CollectibleMapper.ts`'s `placeCollectibles`
 *  zips this against `mapCVDataToCollectibles`'s skill-category-derived
 *  defs the same way findGreenEnemyTiles/findPurpleEnemyTiles do for
 *  enemies. */
export function findCoinTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'coin');
}

/** Finds every `X` (crate block) marker's position in a level layout — same
 *  convention as findCoinTiles, for crate block defs instead
 *  of collectible defs (see BlockMapper.ts's placeBlocks). */
export function findCrateTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'crate');
}

/** Finds every `Q` (question-mark block) marker's position in a level
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

/** Finds every `T` (chest) marker's position in a level layout — same
 *  convention as findCrateTiles/findFragileRockTiles. Unlike those, a chest marker
 *  IS zipped against CVData-derived defs (one chest per Experience entry,
 *  spec.md FR-023) — see ChestMapper.ts's placeChests. */
export function findChestTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'chest');
}

/**
 * Finds every sign marker's position in a level layout, in reading order,
 * paired with the hint it shows (SIGN_CHARS). Unlike findCoinTiles/
 * findChestTiles/findGreenEnemyTiles/etc. (which all look for one specific
 * EntityKind), this scans for ANY key of SIGN_CHARS at once and returns the
 * resolved hintId directly — there's no separate CVData-derived list to zip
 * these positions against.
 */
export function findSignTiles(
  layout: readonly string[],
): { col: number; row: number; hintId: HintId }[] {
  const tiles: { col: number; row: number; hintId: HintId }[] = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      const hintId = SIGN_CHARS[layout[row][col]];
      if (hintId) tiles.push({ col, row, hintId });
    }
  }
  return tiles;
}
