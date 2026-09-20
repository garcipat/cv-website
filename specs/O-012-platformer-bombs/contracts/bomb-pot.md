# Contract: Bomb pot (`entities/blocks/BombPot.ts`)

The bomb pot is a third pot kind built entirely through the O-017
`createPotType` extension point. It declares only its kind-specific facts; every
shared behaviour (solid collision, land-on-top trigger, one-hit removal, bounce,
puff, bunch merging) comes from the factory. **No shared pot or merge code is
edited** (O-017 FR-002/FR-003).

## Declaration

```ts
import { WORLD_TILESET_SHEET } from '../sprites/sheets';
import { drawBlockTile } from './drawBlockTile';
import { createPotType } from './pot';

/** Row 8, column 0 of `world_tileset.png` (16px tiles, 16 columns) — the blue
 *  bottle directly left of the potion pot's red bottle (row 8, col 1). */
const BOMB_POT_FRAME = 8 * 16 + 0; // 128

export const bombPot: BlockType = createPotType({
  key: 'bombPot',
  sprite: { sheet: WORLD_TILESET_SHEET, renderScale: 1, animations: {} },
  drop: 'bomb',
  dropPolicy: 'everyBreak',
  restoredOnRespawn: true,
  frameIndex: () => BOMB_POT_FRAME,
  drawPot: (block, dc) => drawBlockTile(block, dc, BOMB_POT_FRAME),
});
```

## Required registrations

| File | Change |
| --- | --- |
| `entities/blocks/index.ts` | `import { bombPot } from './BombPot'`; add to `BLOCK_TYPES`. |
| `entities/Block.ts` | `BlockKind` union gains `'bombPot'`. |
| `types.ts` | `BlockDef['blockKind']` union gains `'bombPot'`. |
| `level/LevelParser.ts` | `EntityKind` gains `'bombPot'`; `ENTITY_CHARS.b = 'bombPot'`; `TileChar` gains `'b'`; `findBombPotTiles`. |
| `level/BlockMapper.ts` | `BlockMarkerPositions.bombPot?`; place `bombpot-${col}-${row}` in `placeBlocks`. |
| `level/level.ts` | `BOMB_POT_TILES = computed(() => findBombPotTiles(currentLayout.value))`. |
| `PlatformerState.ts` | `blockPlacements` passes `bombPot: BOMB_POT_TILES.value`. |
| `editor/paletteTiles.ts` | `b` sprite/label/description entries. |
| `editor/gridRenderState.ts` | `synthesizeBlockStates` maps `b` → `'bombPot'`. |

## Guarantees

- **Break trigger**: landing on it from above, exactly like every other pot
  (FR-002); shared bounce and puff.
- **Drop**: one `'bomb'` pickup on every break (FR-003/FR-004).
- **Respawn**: restored intact (FR-029).
- **Merge**: merges into a bunch with any other pot kind via
  `computePotRenderPlan`/`drawPotBunch`; renders its fixed frame 128 inside a
  bunch and is never swapped for a clay variant (FR-005/FR-006).
- **Regression**: coin-pot and potion-pot behaviour is untouched (FR-032).

## Invariants (asserted by `BombPot.test.ts` and existing registry tests)

1. `BLOCK_TYPES.bombPot.key === 'bombPot'`.
2. `maxHits === 1`, `removeWhenUsedUp === true`, `triggerSides` includes `'top'`.
3. `pot.drop === 'bomb'`, `pot.dropPolicy === 'everyBreak'`,
   `pot.restoredOnRespawn === true`.
4. `frameIndex(0) === 128`.
5. `computePotRenderPlan` merges a `bombPot` with a `coinPot`/`potionPot` on an
   adjacent tile and emits a filler on the seam.
