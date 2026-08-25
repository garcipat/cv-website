import type { LevelDef, TileMap, TileType } from './LevelData';

/** Maps each character in LEVEL_1_LAYOUT to a tile type. */
export const TILE_CHARS: Record<string, TileType> = {
  '.': 'empty',
  G: 'groundGrass',
  R: 'groundRock',
  P: 'platform',
  W: 'wall',
  B: 'bridge',
};

// Visual layout of level1 — one character per tile (see TILE_CHARS), top row
// first. Every row must be the same length (the level's width in tiles).
// Grass ground (cols 0-11) meets rock ground (cols 12-19) partway across;
// a 2-tile pit (cols 2-3) is bridged at ground level; a 3-tile platform
// floats above the grass zone; a 3-tile-tall wall stands in the rock zone.
const LEVEL_1_LAYOUT: readonly string[] = [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '........PPP....W....',
  '...............W....',
  '...............W....',
  'GGBBGGGGGGGGRRRRRRRR',
  'GG..GGGGGGGGRRRRRRRR',
];

export function parseLevel(layout: readonly string[]): LevelDef {
  const height = layout.length;
  const width = layout[0]?.length ?? 0;

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
