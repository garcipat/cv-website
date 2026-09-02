import type { ChestType } from './ChestType';
import {
  CHEST_CLOSED_WIDTH,
  CHEST_CLOSED_HEIGHT,
  CHEST_OPEN_WIDTH,
  CHEST_OPEN_HEIGHT,
  CHEST_CLOSED_RENDERED_WIDTH,
  CHEST_CLOSED_RENDERED_HEIGHT,
  CHEST_OPEN_RENDERED_WIDTH,
  CHEST_OPEN_RENDERED_HEIGHT,
  CHEST_CLOSED_OFFSET_X,
  CHEST_OPEN_OFFSET_X,
  isChestOpen,
} from '../Chest';
import { CHEST_CLOSED_SHEET, CHEST_OPEN_SHEET } from '../sprites/sheets';

/**
 * The `ChestType` view of the (currently only) chest kind. There is one
 * chest kind today, so this is a single export rather than a keyed registry
 * like `BLOCK_TYPES`/`PICKUP_TYPES` — it would become one if a second chest
 * kind were ever added.
 *
 * Draws at its current open/closed sprite — each state is a standalone
 * image (not a shared sheet, unlike blocks), so this always crops from
 * (0, 0) at that state's own native size. Either sprite may independently be
 * null (not yet loaded); a chest whose current state's sprite is missing is
 * simply skipped for the frame, same convention as every other type's
 * null-sprite handling.
 *
 * The destination x is shifted by the state's `*_OFFSET_X`
 * (`entities/Chest.ts`) so the chest draws horizontally centered on its tile
 * rather than left-aligned to the tile's top-left corner — its rendered
 * width is wider than one tile.
 */
export const CHEST_TYPE: ChestType = {
  key: 'chest',
  closed: { sheet: CHEST_CLOSED_SHEET, renderScale: 1, animations: {} },
  open: { sheet: CHEST_OPEN_SHEET, renderScale: 1, animations: {} },
  draw: (chest, dc) => {
    const open = isChestOpen(chest);
    const sprite = dc.sprites[open ? CHEST_OPEN_SHEET.src : CHEST_CLOSED_SHEET.src];
    if (!sprite) return;
    const srcWidth = open ? CHEST_OPEN_WIDTH : CHEST_CLOSED_WIDTH;
    const srcHeight = open ? CHEST_OPEN_HEIGHT : CHEST_CLOSED_HEIGHT;
    const destWidth = open ? CHEST_OPEN_RENDERED_WIDTH : CHEST_CLOSED_RENDERED_WIDTH;
    const destHeight = open ? CHEST_OPEN_RENDERED_HEIGHT : CHEST_CLOSED_RENDERED_HEIGHT;
    const offsetX = open ? CHEST_OPEN_OFFSET_X : CHEST_CLOSED_OFFSET_X;
    dc.ctx.drawImage(
      sprite,
      0,
      0,
      srcWidth,
      srcHeight,
      chest.x + dc.originX + offsetX,
      chest.y + dc.originY,
      destWidth,
      destHeight,
    );
  },
};
