import { RENDERED_TILE_SIZE } from '../level/Terrain';

/**
 * Half-width (rendered px) of the centered band the player can move within
 * before the camera reacts. Tunable — bigger feels looser, smaller feels
 * tighter/more hard-locked.
 */
export const CAMERA_DEAD_ZONE_HALF_WIDTH = 96;

/**
 * Computes the next horizontal camera offset (world-space x of the
 * viewport's left edge) using a classic-platformer dead-zone follow: the
 * camera only moves once the player's center exits a band centered on the
 * viewport's midpoint, and then only enough to pin the player back to the
 * band's edge. Clamped so the camera never scrolls past the level's start
 * or end.
 */
export function updateCamera(
  previousCameraX: number,
  playerX: number,
  playerWidth: number,
  viewportWidth: number,
  levelPixelWidth: number,
): number {
  const playerCenterX = playerX + playerWidth / 2;
  const screenCenterX = playerCenterX - previousCameraX;
  const deadZoneLeft = viewportWidth / 2 - CAMERA_DEAD_ZONE_HALF_WIDTH;
  const deadZoneRight = viewportWidth / 2 + CAMERA_DEAD_ZONE_HALF_WIDTH;

  let cameraX = previousCameraX;
  if (screenCenterX < deadZoneLeft) {
    cameraX = playerCenterX - deadZoneLeft;
  } else if (screenCenterX > deadZoneRight) {
    cameraX = playerCenterX - deadZoneRight;
  }

  const maxCameraX = Math.max(0, levelPixelWidth - viewportWidth);
  return Math.min(Math.max(cameraX, 0), maxCameraX);
}

/** How many rendered-tile rows down from the TOP of the viewport the
 *  dead zone's own top edge sits — small on purpose, so the dead zone spans
 *  almost the entire canvas height above the bottom target row. The camera
 *  should only react once the player genuinely nears the top of the visible
 *  canvas (a big jump or climb), not whenever they're merely above the
 *  bottom target row — for a level shorter than the viewport especially,
 *  the player can sit anywhere in the upper portion of the canvas without
 *  the camera dragging them down toward the bottom target. Tunable. */
export const CAMERA_DEAD_ZONE_TOP_MARGIN_ROWS = 7;

/**
 * Vertical dead-zone slack BELOW the target row (rendered px) — zero. The
 * target row IS the player's resting position: standing still (or landing)
 * puts the player exactly at this row with no tolerance, so any downward
 * motion past it corrects the camera immediately. Asymmetric with the
 * generous top margin (`CAMERA_DEAD_ZONE_TOP_MARGIN_ROWS`) on purpose —
 * jumping shouldn't scroll the camera until the player genuinely gets some
 * real height, but
 * descending (falling, or coming back down from a jump) should track without
 * delay, and since standing rests exactly at this edge there's no separate
 * "grounded" formula needed — the same dead-zone math naturally pins the
 * player here whether they're landing or already at rest.
 */
export const CAMERA_DEAD_ZONE_BOTTOM_SLACK = 0;

/** How many rendered-tile rows up from the BOTTOM of the viewport the
 *  camera's dead-zone targets — not a percentage of viewport height, and not
 *  measured from the top. The play-mode canvas is a fixed, short height (see
 *  CanvasSize.ts's `PLAY_CANVAS_ROWS`), so a small, fixed distance from
 *  the bottom keeps the player near the ground with most of the canvas above
 *  them showing the sky/clouds/village background layers, regardless of how
 *  tall the level itself is. Tunable. */
export const PLAYER_TARGET_ROWS_FROM_BOTTOM = 3;

/**
 * Computes the next vertical camera offset — an ADDITIVE amount on top of
 * the existing bottom-anchor baseline (`viewportHeight - levelPixelHeight`),
 * not a replacement for it. At 0 (its minimum), the level is exactly
 * bottom-anchored; it grows as needed to keep the player pinned at the
 * dead-zone's target row.
 *
 * The dead-zone's target is `PLAYER_TARGET_ROWS_FROM_BOTTOM` rows from the
 * BOTTOM of the viewport, not a percentage of viewport height — so the player
 * consistently starts near the bottom rather than vertically centered (which
 * would show as much terrain below as background above, wasteful in a level
 * with a deep section below the player). Since the camera below snaps directly to
 * whatever value keeps the player pinned at the dead-zone edge (no gradual
 * lerp — it's a single assignment, not an interpolation toward a target),
 * this one formula change handles both the initial spawn framing (no
 * special-case "initial camera" code needed — frame 1 already resolves to
 * the same dead-zone math) and ongoing behavior anywhere later in the level.
 *
 * Deliberately UNCLAMPED — no floor, no ceiling. Earlier versions clamped
 * to a floor of `0` (never scroll below the bottom-anchor baseline) and/or a
 * ceiling tied to level height (never scroll past the level's own top edge
 * plus a little overscroll). Both turned out to be the same class of bug on
 * opposite edges: either one forces `cameraY` back to a level-geometry-derived
 * bound regardless of where the dead-zone target actually needs the camera,
 * silently overriding `PLAYER_TARGET_ROWS_FROM_BOTTOM` — the ceiling did this
 * for any level shorter than the viewport (player renders wherever their row
 * falls in the fully-visible level, ignoring the target), and the floor did
 * the exact same thing in the opposite direction once the player is near the
 * level's bottom edge (needed a negative `cameraY` to keep tracking the
 * target while descending, got clamped back to 0 instead). Scrolling the
 * level's top edge below the canvas's own top edge, or its bottom edge above
 * the canvas's own bottom edge, is now the INTENDED outcome whenever framing
 * the player at the target row requires it — the background layers are built
 * to fill exactly that resulting empty space, both above and below the
 * level's own bounds. `playerY` is always bounded by the level's own
 * dimensions in practice, so this can't run away unboundedly.
 *
 * The camera follows the player continuously — there is no grounded/airborne
 * branch. The same dead-zone formula applies every frame regardless of
 * whether the player is standing, jumping, or falling; it's the asymmetric
 * slack (generous above, zero below) that produces the desired feel, not a
 * state check.
 */
export function updateCameraY(
  previousCameraY: number,
  playerY: number,
  playerHeight: number,
  viewportHeight: number,
  levelPixelHeight: number,
): number {
  const originYBase = viewportHeight - levelPixelHeight;
  const playerCenterY = playerY + playerHeight / 2;
  const targetY = viewportHeight - PLAYER_TARGET_ROWS_FROM_BOTTOM * RENDERED_TILE_SIZE;
  const screenCenterY = playerCenterY + originYBase + previousCameraY;

  const deadZoneTop = CAMERA_DEAD_ZONE_TOP_MARGIN_ROWS * RENDERED_TILE_SIZE;
  const deadZoneBottom = targetY + CAMERA_DEAD_ZONE_BOTTOM_SLACK;

  let cameraY = previousCameraY;
  if (screenCenterY < deadZoneTop) {
    cameraY = deadZoneTop - playerCenterY - originYBase;
  } else if (screenCenterY > deadZoneBottom) {
    cameraY = deadZoneBottom - playerCenterY - originYBase;
  }

  return cameraY;
}

/**
 * Computes the vertical camera offset that exactly frames the player at the
 * dead-zone's own target row — a ONE-TIME initializer for spawn/respawn, not
 * a per-frame branch. `updateCameraY` only corrects once the player exits
 * the dead-zone band, so on a fresh spawn (previousCameraY unknown/stale,
 * e.g. 0) the player can land anywhere inside the band with no correction at
 * all, appearing wherever their raw world position happens to be rather
 * than reliably framed near the bottom target row. Callers use this once
 * right after resetting player position (initial mount, respawn, restart),
 * then let `updateCameraY` take over every frame after that.
 */
export function initialCameraY(
  playerY: number,
  playerHeight: number,
  viewportHeight: number,
  levelPixelHeight: number,
): number {
  const originYBase = viewportHeight - levelPixelHeight;
  const playerCenterY = playerY + playerHeight / 2;
  const targetY = viewportHeight - PLAYER_TARGET_ROWS_FROM_BOTTOM * RENDERED_TILE_SIZE;
  return targetY - playerCenterY - originYBase;
}
