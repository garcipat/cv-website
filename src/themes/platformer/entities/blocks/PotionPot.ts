import type { BlockType } from './BlockType';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';
import { drawBlockTile } from './drawBlockTile';
import { PHYSICS_CONFIG } from '../../engine/PhysicsConfig';

/** Row 8, column 1 of `world_tileset.png` — the purple potion bottle
 *  (16px tiles, 16 columns; see this step's brainstorming for how it was
 *  located among the sheet's four bottle-color variants). */
const POTION_POT_FRAME = 8 * 16 + 1;

export const potionPot: BlockType = {
  key: 'potionPot',
  sprite: { sheet: WORLD_TILESET_SHEET, renderScale: 1, animations: {} },
  maxHits: 1,
  removeWhenUsedUp: true,
  triggerSides: ['top'],
  // Destroyed by landing on it, not by a hit from below — same convention as
  // coinPot. Always drops a heart pickup; healing is applied at pickup time
  // (Health.ts's healDamage), not here.
  onHit: () => ({
    spawnPickup: 'heart',
    bounceVelocity: PHYSICS_CONFIG.coinPotBounceVelocity,
  }),
  frameIndex: () => POTION_POT_FRAME,
  draw: (block, dc) => drawBlockTile(block, dc, POTION_POT_FRAME),
};
