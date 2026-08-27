import type { LevelDef, TileMap, TileType } from './LevelData';

/**
 * Maps each character in LEVEL_1_LAYOUT to a tile type. `S` (spawn marker)
 * parses as `empty` — it marks the player's starting position but isn't a
 * distinct terrain tile.
 */
export const TILE_CHARS: Record<string, TileType | undefined> = {
  '.': 'empty',
  G: 'groundGrass',
  R: 'groundRock',
  P: 'platform',
  W: 'wall',
  B: 'bridge',
  S: 'empty',
};

// Visual layout of level1 — one character per tile (see TILE_CHARS), top row
// first. Every row must be the same length (the level's width in tiles).
// Grass ground (cols 0-11) meets rock ground (cols 12-19) partway across;
// a 2-tile pit (cols 2-3) is bridged at ground level; a floating platform
// row spans cols 8-14 as platform-platform-platform-bridge-bridge-platform-
// platform (cols 8-10 / 11-12 / 13-14) — the bridge segment is passable from
// below (jump up through it) and from above via Down/S (drop-through), with
// solid ground two tiles below for both to land on; a 3-tile-tall wall stands
// in the rock zone. `S` marks the player's spawn point — the empty space
// directly above the top-exposed grass tile it stands on.
const LEVEL_1_LAYOUT: readonly string[] = [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '........PPPBBPPW....',
  '...............W....',
  '.S.............W....',
  'GGBBGGGGGGGGRRRRRRRR',
  'GGGGGGGGGGGGRRRRRRRR',
];

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
      const tile = TILE_CHARS[char];
      if (!tile) {
        throw new Error(`Unknown level tile character: "${char}"`);
      }
      return tile;
    }),
  );

  return { terrain, width, height };
}

export const level1: LevelDef = parseLevel(LEVEL_1_LAYOUT);

/** Finds the `S` spawn marker's position in a level layout. */
function findSpawnTile(layout: readonly string[]): { col: number; row: number } {
  for (let row = 0; row < layout.length; row++) {
    const col = layout[row].indexOf('S');
    if (col !== -1) return { col, row };
  }
  throw new Error('Level layout has no spawn marker ("S")');
}

/** Player spawn point, read from `LEVEL_1_LAYOUT`'s `S` marker. */
export const SPAWN_TILE = findSpawnTile(LEVEL_1_LAYOUT);
