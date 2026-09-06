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
  | 'coinPot'
  | 'potionPot'
  | 'chest';

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
  P: 'patrol',
  n: 'bush',
  N: 'fence',
  X: 'cobweb',
  c: 'crystalCluster',
  d: 'stalactite',
  a: 'stalagmite',
};

/**
 * Maps each entity-marker character usable in a level layout to what it
 * marks: `S` (spawn), `M` (green/Course enemy), `m` (purple enemy — carries
 * no CV fact, drops a key on defeat), `o` (Skill-category coin), `=` (crate block — Education/Activity/
 * Language fact), `Q` (question-mark block — no fact, spawns a bonus fruit),
 * `F` (fragileRock block — no fact, level-design filler), `u` (coin-pot block —
 * destroyed by landing on top, drops a coin; lowercase, a small urn-shaped
 * glyph, unlike every other entity marker which is uppercase), `p` (potion-pot
 * block — destroyed by landing on top like a coin-pot, drops a heart pickup
 * that heals half a heart; no fact, same no-CVData-binding convention as
 * coin-pot/fragileRock), `T` (chest —
 * Experience fact, opened via Arrow Up while standing on it, spec.md
 * FR-023). Kept as its own
 * map, separate from TERRAIN_CHARS, since an entity marker isn't a terrain
 * tile — the ground it sits on is always `empty` (see parseLevel below), and
 * it's a fundamentally different kind of fact about a cell ("what starts
 * here") than terrain is ("what's the ground").
 */
export const ENTITY_CHARS: Record<string, EntityKind | undefined> = {
  S: 'spawn',
  M: 'enemyGreen',
  m: 'enemyPurple',
  o: 'coin',
  '=': 'crate',
  Q: 'questionMark',
  F: 'fragileRock',
  u: 'coinPot',
  p: 'potionPot',
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

/** A spike hazard's facing — which of the 4 pre-drawn sprites in
 *  `staticObjects.png` (columns 3-4, rows 6-7) is shown. Purely cosmetic for
 *  collision purposes: touching any part of a spike's tile damages the
 *  player regardless of which face was touched (see Spike.ts's `box`) —
 *  facing only selects the sprite. */
export type HazardFacing = 'up' | 'down' | 'left' | 'right';

/** Every hazard kind the game knows about. Currently just `spike`, but every
 *  place that would otherwise hardcode the literal `'spike'` (HAZARD_CHARS's
 *  value type below, findHazardTiles's return type, HazardMapper.ts's
 *  HazardPlacement/placeHazards) is typed against this instead — adding a
 *  second kind is one line here plus its own module and registry entry
 *  (entities/hazards/index.ts), nothing else widens by hand. */
export type HazardKind = 'spike';

/**
 * Maps each hazard-marker character to the hazard it places. Same
 * hand-authored-content convention as SIGN_CHARS (the character itself
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
};

// A character can only mean one thing — guard against TERRAIN_CHARS,
// ENTITY_CHARS, SIGN_CHARS, and HAZARD_CHARS accidentally sharing a key, which
// independent maps don't prevent on their own the way one unified table
// would.
const charOwners: Record<string, string[]> = {};
for (const char of Object.keys(TERRAIN_CHARS)) (charOwners[char] ??= []).push('terrain');
for (const char of Object.keys(ENTITY_CHARS)) (charOwners[char] ??= []).push('entity');
for (const char of Object.keys(SIGN_CHARS)) (charOwners[char] ??= []).push('sign');
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
 * every `TERRAIN_CHARS`, `ENTITY_CHARS`, `SIGN_CHARS`, and `HAZARD_CHARS` key.
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
  | 'P'
  | 'S'
  | 'M'
  | 'm'
  | 'o'
  | '='
  | 'Q'
  | 'F'
  | 'T'
  | 'u'
  | 'p'
  | 'n'
  | 'N'
  | 'X'
  | 'c'
  | 'd'
  | 'a'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '^'
  | 'v'
  | '<'
  | '>';

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
      if (ENTITY_CHARS[char] || SIGN_CHARS[char] || HAZARD_CHARS[char]) return 'empty';
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

/**
 * Finds every hazard marker's position in a level layout, in reading order,
 * paired with its hazard kind and facing (HAZARD_CHARS) — same
 * scan-for-any-key convention as findSignTiles, since a hazard marker's
 * identity is fully carried by its character, not zipped against a
 * CVData-derived list.
 */
export function findHazardTiles(
  layout: readonly string[],
): { col: number; row: number; hazardType: HazardKind; facing: HazardFacing }[] {
  const tiles: { col: number; row: number; hazardType: HazardKind; facing: HazardFacing }[] = [];
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < layout[row].length; col++) {
      const hazard = HAZARD_CHARS[layout[row][col]];
      if (hazard) tiles.push({ col, row, ...hazard });
    }
  }
  return tiles;
}
