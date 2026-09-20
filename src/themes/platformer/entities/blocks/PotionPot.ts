import type { BlockType } from './BlockType';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';
import { drawBlockTile } from './drawBlockTile';
import { createPotType } from './pot';

/** Row 8, column 1 of `world_tileset.png` — the purple potion bottle
 *  (16px tiles, 16 columns; see this step's brainstorming for how it was
 *  located among the sheet's four bottle-color variants). */
const POTION_POT_FRAME = 8 * 16 + 1;

/**
 * The potion pot: a fixed-sprite bottle destroyed by landing on it, dropping
 * a heart on every break (including after a respawn). It is never assigned a
 * clay size variant (FR-008) — its `drawPot` always draws its one bottle
 * frame. Declares only its kind-specific facts and inherits everything
 * shared from `createPotType`.
 */
export const potionPot: BlockType = createPotType({
  key: 'potionPot',
  sprite: { sheet: WORLD_TILESET_SHEET, renderScale: 1, animations: {} },
  drop: 'heart',
  // A potion pot drops a fresh heart on every destruction, so it stays a
  // repeatable heal across respawns (FR-014/FR-017).
  dropPolicy: 'everyBreak',
  restoredOnRespawn: true,
  frameIndex: () => POTION_POT_FRAME,
  drawPot: (block, dc) => drawBlockTile(block, dc, POTION_POT_FRAME),
});
