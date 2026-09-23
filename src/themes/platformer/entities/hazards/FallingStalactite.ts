import type { HazardType } from './HazardType';
import type { HazardPlacement } from '../../level/HazardMapper';
import { DECORATIONS_SHEET } from '../sprites/sheets';
import { RENDER_SCALE, RENDERED_TILE_SIZE, TILE_SIZE } from '../../level/Terrain';
import { SIDE_HIT_DAMAGE } from '../Health';
import {
  isStalactiteTwin,
  stalactiteEntry,
  TWIN_LEFT_RECT,
  TWIN_RIGHT_RECT,
} from '../../engine/StaticObjectsCatalog';
import { fallingStalactiteRestOffsetY } from '../../engine/FallingStalactite';
import type { Rect } from '../geometry';
import type { DrawContext } from '../../engine/DrawContext';
import type { DebrisLayer } from '../../engine/CollectionEffects';

/** A native-pixel sprite crop. */
interface SpriteRect {
  sx: number;
  sy: number;
  width: number;
  height: number;
}

/** The large variant's own crop (the whole entry the decoration would draw). */
function largeRect(col: number, row: number): SpriteRect {
  const entry = stalactiteEntry(col, row);
  return { sx: entry.sx, sy: entry.sy, width: entry.width ?? TILE_SIZE, height: entry.height ?? TILE_SIZE };
}

/** The twin half that actually falls: left (larger) on an even column, right
 *  (smaller) on an odd column (FR-019). */
function selectedTwinRect(col: number): SpriteRect {
  return col % 2 === 0 ? TWIN_LEFT_RECT : TWIN_RIGHT_RECT;
}

/** The twin half that stays hanging — the other one. */
function survivorTwinRect(col: number): SpriteRect {
  return col % 2 === 0 ? TWIN_RIGHT_RECT : TWIN_LEFT_RECT;
}

/** The crop the falling sprite occupies. */
function fallingStalactiteRect(hazard: HazardPlacement): SpriteRect {
  return isStalactiteTwin(hazard.col, hazard.row)
    ? selectedTwinRect(hazard.col)
    : largeRect(hazard.col, hazard.row);
}

/**
 * The current falling rect: the large sprite (a whole tile wide) or the
 * parity-selected twin half (half a tile), shifted by the per-tick fall and
 * shake offsets merged into the placement. Non-solid at every phase (FR-010).
 */
function fallingStalactiteBox(hazard: HazardPlacement): Rect {
  const twin = isStalactiteTwin(hazard.col, hazard.row);
  const rect = fallingStalactiteRect(hazard);
  const shakeX = hazard.fallingStalactiteShakeOffsetX ?? 0;
  const offsetY = hazard.fallingStalactiteOffsetY ?? 0;
  const xOffset = twin ? rect.sx * RENDER_SCALE : 0;
  return {
    x: hazard.x + xOffset + shakeX,
    y: hazard.y + offsetY,
    width: rect.width * RENDER_SCALE,
    height: rect.height * RENDER_SCALE,
  };
}

/** Hazardous only while falling — hanging and shaking are inert (FR-005), and
 *  a `gone` hazard is no longer there (FR-013). Missing phase reads as
 *  hanging. */
function fallingStalactiteIsContact(hazard: HazardPlacement): boolean {
  return hazard.fallingStalactitePhase === 'falling';
}

/**
 * The world-space origin and single art layer of a landed hazard's shatter
 * debris (FR-020): the falling sprite's own crop, anchored at the hazard's
 * column (offset to the selected twin half) and at `landingRow`'s top edge —
 * exactly where the sprite came to rest.
 */
export function fallingStalactiteShatter(
  hazard: HazardPlacement,
  landingRow: number,
): { x: number; y: number; layers: DebrisLayer[] } {
  const twin = isStalactiteTwin(hazard.col, hazard.row);
  const rect = fallingStalactiteRect(hazard);
  const restOffset = fallingStalactiteRestOffsetY(hazard, landingRow) ?? 0;
  return {
    x: hazard.x + (twin ? rect.sx * RENDER_SCALE : 0),
    // The sprite's top at rest — one sprite-height above the landing row's
    // top, where its bottom came to meet the solid (not sunk into it).
    y: hazard.y + restOffset,
    layers: [
      { sheet: DECORATIONS_SHEET.src, sx: rect.sx, sy: rect.sy, width: rect.width, height: rect.height },
    ],
  };
}

/** Blits one crop of the decorations sheet, scaled to its own rendered size at
 *  `destX`/`destY` (world space; the caller adds no origin here). */
function blit(
  hazard: HazardPlacement,
  dc: DrawContext,
  image: HTMLImageElement,
  rect: SpriteRect,
  destX: number,
  destY: number,
): void {
  dc.ctx.drawImage(
    image,
    rect.sx,
    rect.sy,
    rect.width,
    rect.height,
    hazard.x + destX + dc.originX,
    hazard.y + destY + dc.originY,
    rect.width * RENDER_SCALE,
    rect.height * RENDER_SCALE,
  );
}

export const fallingStalactite: HazardType<HazardPlacement> = {
  key: 'fallingStalactite',
  damage: SIDE_HIT_DAMAGE,
  box: fallingStalactiteBox,
  isContact: fallingStalactiteIsContact,
  draw: (hazard, dc) => {
    const image = dc.sprites[DECORATIONS_SHEET.src];
    if (!image) return;
    const phase = hazard.fallingStalactitePhase ?? 'hanging';
    const shakeX = hazard.fallingStalactiteShakeOffsetX ?? 0;
    const offsetY = hazard.fallingStalactiteOffsetY ?? 0;
    dc.ctx.imageSmoothingEnabled = false;

    if (!isStalactiteTwin(hazard.col, hazard.row)) {
      // Large variant: one blit, exactly the decoration's own draw (source
      // 16x17 stretched to a full tile), so the hanging hazard is pixel-
      // identical to the decoration at its cell (SC-001).
      if (phase === 'gone') return;
      const entry = stalactiteEntry(hazard.col, hazard.row);
      dc.ctx.drawImage(
        image,
        entry.sx,
        entry.sy,
        entry.width ?? TILE_SIZE,
        entry.height ?? TILE_SIZE,
        hazard.x + shakeX + dc.originX,
        hazard.y + offsetY + dc.originY,
        RENDERED_TILE_SIZE,
        RENDERED_TILE_SIZE,
      );
      return;
    }

    // Twin variant: the survivor half always renders, statically and untinted,
    // for the rest of the attempt — including after the selected half has
    // shattered (FR-019) — so this branch never returns early on 'gone'.
    const survivor = survivorTwinRect(hazard.col);
    blit(hazard, dc, image, survivor, survivor.sx * RENDER_SCALE, 0);

    if (phase !== 'gone') {
      const selected = selectedTwinRect(hazard.col);
      blit(hazard, dc, image, selected, selected.sx * RENDER_SCALE + shakeX, offsetY);
    }
  },
};
