import type { HazardType } from './HazardType';
import type { HazardPlacement } from '../../level/HazardMapper';
import { FLOOR_SPIKE_SHEET } from '../sprites/sheets';
import { RENDERED_TILE_SIZE, RENDER_SCALE } from '../../level/Terrain';
import { SIDE_HIT_DAMAGE } from '../Health';
import type { Rect } from '../../contracts/geometry';
import type { DrawContext } from '../../contracts/DrawContext';
import { clamp01 } from '../../shared/math';

/** Same visible-band convention as Spike.ts's BAND_NATIVE for the 'up'
 *  facing — a floor spike is floor-only (FR-013), so it only ever needs
 *  that one band. */
const BAND_NATIVE = 5;

/**
 * The hazardous rect — identical to the static spike's 'up'-facing band
 * (Spike.ts's facingBox), and NOT phase-gated: it's the broad-phase overlap
 * test `resolveHazardContacts` runs before checking `isContact` below, so it
 * must stay a constant geometric rect. A zero-size rect at the hazard's own
 * position would still satisfy `aabbOverlap`'s strict `<`/`>` comparisons
 * whenever the player's hitbox straddles that exact point — which it almost
 * always does while simply standing on the tile — so phase-gating belongs in
 * `isContact`, not here.
 */
function floorSpikeBox(hazard: HazardPlacement): Rect {
  const band = BAND_NATIVE * RENDER_SCALE;
  return {
    x: hazard.x,
    y: hazard.y + RENDERED_TILE_SIZE - band,
    width: RENDERED_TILE_SIZE,
    height: band,
  };
}

/** `hazard.floorSpikePhase` is only meaningful once PlatformerPage.tsx has
 *  merged the live timer state in for this tick (see PlatformerState.ts's
 *  `hazardPlacementsForTick`); missing/`'atRest'` and every non-hazardous
 *  phase all fail this check, matching FR-005 (only full-extend is
 *  hazardous). */
function floorSpikeIsContact(hazard: HazardPlacement): boolean {
  return hazard.floorSpikePhase === 'fullExtend';
}

/** Native px per frame, read from the sheet itself rather than hardcoded —
 *  FLOOR_SPIKE_SHEET's frames are a couple px taller than a tile, so a
 *  frame drawn at a hazard's own tile-aligned position always bleeds its
 *  bottom rows onto the tile below (see sheets.ts's FLOOR_SPIKE_SHEET doc
 *  comment). */
const FRAME_W = FLOOR_SPIKE_SHEET.frameWidth;
const FRAME_H = FLOOR_SPIKE_SHEET.frameHeight;

/** x-offsets (native px) of each of the 3 horizontally-laid-out frames. */
const TELL_FRAME_X = 0;
const ARMED_FRAME_X = FRAME_W;
const SPIKE_FRAME_X = FRAME_W * 2;

/**
 * Draws a `cropHeight`-native-px-tall bottom-anchored slice of the frame at
 * `sx`, starting `cropTop` native px down from the frame's own top. Every
 * frame shares the same fixed bottom anchor (`hazard.y` plus the full
 * frame's rendered height) regardless of how much of it is drawn, so a
 * partial crop of the spike frame (`floorSpikeBox`'s variable-height
 * reveal) never shifts relative to the full tell/armed frames drawn
 * elsewhere in the cycle.
 */
function drawFrameSlice(
  hazard: HazardPlacement,
  dc: DrawContext,
  sx: number,
  cropTop: number,
  cropHeight: number,
): void {
  if (cropHeight <= 0) return;
  const image = dc.sprites[FLOOR_SPIKE_SHEET.src];
  if (!image) return;
  const destHeight = cropHeight * RENDER_SCALE;
  const destY = hazard.y + FRAME_H * RENDER_SCALE - destHeight;
  dc.ctx.imageSmoothingEnabled = false;
  dc.ctx.drawImage(
    image,
    sx,
    cropTop,
    FRAME_W,
    cropHeight,
    hazard.x + dc.originX,
    destY + dc.originY,
    RENDERED_TILE_SIZE,
    destHeight,
  );
}

export const floorSpike: HazardType<HazardPlacement> = {
  key: 'floorSpike',
  damage: SIDE_HIT_DAMAGE,
  box: floorSpikeBox,
  isContact: floorSpikeIsContact,
  draw: (hazard, dc) => {
    // The ground tell (the holes) is the base every other pose is drawn on
    // top of. It's what stays visible under/around the spike once it's
    // out — the spike frame's own art doesn't repeat the holes (unlike the
    // armed frame, which does), so without this base layer they'd vanish
    // the instant the spike starts rising.
    drawFrameSlice(hazard, dc, TELL_FRAME_X, 0, FRAME_H);

    const phase = hazard.floorSpikePhase ?? 'atRest';
    if (phase === 'atRest') return;
    if (phase === 'delay') {
      drawFrameSlice(hazard, dc, ARMED_FRAME_X, 0, FRAME_H);
      return;
    }
    // warning / fullExtend / retracting: the spike frame, cropped to a
    // bottom-anchored slice proportional to how far out it currently is
    // (0..1, see engine/FloorSpike.ts's floorSpikeExtensionAt) — one piece
    // of art growing/shrinking continuously, rather than a fixed "half up"
    // pose.
    const ratio = clamp01(hazard.floorSpikeExtension ?? 0);
    const cropHeight = Math.round(FRAME_H * ratio);
    if (cropHeight <= 0) return;
    const cropTop = FRAME_H - cropHeight;
    drawFrameSlice(hazard, dc, SPIKE_FRAME_X, cropTop, cropHeight);
  },
};
