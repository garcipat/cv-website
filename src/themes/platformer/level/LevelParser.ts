import type { LevelDef, TileMap, TileType } from './LevelData';

/** An entity marker's kind — what it means, not what it looks like on the
 *  ground (every entity marker sits on `empty` terrain, see parseLevel). */
export type EntityKind =
  | 'spawn'
  | 'enemyGreen'
  | 'enemyPurple'
  | 'coin'
  | 'fruit'
  | 'crate'
  | 'questionMark'
  | 'rock'
  | 'chest';

/**
 * Maps each terrain character usable in a level layout to its tile type.
 * Shared by every level's raw ASCII layout, not just `level1`.
 */
export const TERRAIN_CHARS: Record<string, TileType | undefined> = {
  '.': 'empty',
  G: 'groundGrass',
  R: 'groundRock',
  P: 'platform',
  W: 'wall',
  B: 'bridge',
};

/**
 * Maps each entity-marker character usable in a level layout to what it
 * marks: `S` (spawn), `E` (green/Course enemy), `M` (purple/Course
 * enemy), `C` (Skill-category coin), `F` (Language fruit, unused today —
 * see CollectibleMapper.ts), `X` (crate block — Education/Activity/Language
 * fact), `Q` (question-mark block — no fact, spawns a bonus fruit), `K` (rock
 * block — no fact, level-design filler), `H` (chest — Experience fact,
 * opened via Arrow Up while standing on it, spec.md FR-023). Kept as its own
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
  F: 'fruit',
  X: 'crate',
  Q: 'questionMark',
  K: 'rock',
  H: 'chest',
};

// A character can only mean one thing — guard against TERRAIN_CHARS and
// ENTITY_CHARS accidentally sharing a key, which two independent maps don't
// prevent on their own the way one unified table would.
const sharedChars = Object.keys(TERRAIN_CHARS).filter((char) => char in ENTITY_CHARS);
if (sharedChars.length > 0) {
  throw new Error(
    `Level character(s) defined as both terrain and entity marker: ${sharedChars.join(', ')}`,
  );
}

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
  const width = layout[0]?.length ?? 0;

  layout.forEach((row, index) => {
    if (row.length !== width) {
      throw new Error(`Row ${index} has length ${row.length}, expected ${width}`);
    }
  });

  const terrain: TileMap = layout.map((row) =>
    row.split('').map((char) => {
      const tile = TERRAIN_CHARS[char];
      if (tile) return tile;
      if (ENTITY_CHARS[char]) return 'empty';
      throw new Error(`Unknown level tile character: "${char}"`);
    }),
  );

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

/** Finds every `F` (Language fruit) marker's position in a level layout —
 *  same convention as findCoinTiles, for language-derived defs instead of
 *  skill-category-derived ones. */
export function findFruitTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'fruit');
}

/** Finds every `X` (crate block) marker's position in a level layout — same
 *  convention as findCoinTiles/findFruitTiles, for crate block defs instead
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

/** Finds every `K` (rock block) marker's position in a level layout — same
 *  no-CV-fact convention as findQuestionMarkTiles. */
export function findRockTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'rock');
}

/** Finds every `H` (chest) marker's position in a level layout — same
 *  convention as findCrateTiles/findRockTiles. Unlike those, a chest marker
 *  IS zipped against CVData-derived defs (one chest per Experience entry,
 *  spec.md FR-023) — see ChestMapper.ts's placeChests. */
export function findChestTiles(layout: readonly string[]): { col: number; row: number }[] {
  return findAllOfKind(layout, 'chest');
}
