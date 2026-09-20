import type { BlockType } from './BlockType';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';
import { drawBlockTile } from './drawBlockTile';
import { createPotType } from './pot';

/** Row 8, column 0 of `world_tileset.png` — the blue bottle directly left of
 *  the potion pot's red bottle (row 8, col 1; 16px tiles, 16 columns). */
const BOMB_POT_FRAME = 8 * 16 + 0; // 128

/**
 * The bomb pot: a fixed-sprite blue bottle destroyed by landing on it,
 * dropping a bomb pickup on every break (including after a respawn). It is
 * never assigned a clay size variant (FR-006) — its `drawPot` always draws
 * its one bottle frame. Declares only its kind-specific facts and inherits
 * everything shared from `createPotType` (O-012).
 */
export const bombPot: BlockType = createPotType({
  key: 'bombPot',
  sprite: { sheet: WORLD_TILESET_SHEET, renderScale: 1, animations: {} },
  drop: 'bomb',
  // A bomb pot drops a fresh bomb on every destruction, so it stays a
  // repeatable bomb source across respawns (FR-003/FR-029).
  dropPolicy: 'everyBreak',
  restoredOnRespawn: true,
  frameIndex: () => BOMB_POT_FRAME,
  drawPot: (block, dc) => drawBlockTile(block, dc, BOMB_POT_FRAME),
});
