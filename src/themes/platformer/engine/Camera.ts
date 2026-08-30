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

/**
 * Half-height (rendered px) of the vertical dead-zone band — same value as
 * `CAMERA_DEAD_ZONE_HALF_WIDTH`, no reason yet to differ.
 */
export const CAMERA_DEAD_ZONE_HALF_HEIGHT = 96;

/**
 * Computes the next vertical camera offset (roadmap step 23) — an ADDITIVE
 * amount on top of the existing bottom-anchor baseline
 * (`viewportHeight - levelPixelHeight`, unchanged since roadmap step 1),
 * not a replacement for it. At 0 (its minimum), the level is exactly
 * bottom-anchored, matching every level shipped before this step; it grows
 * as the player climbs toward the level's top, capped so the origin never
 * scrolls past showing the level's very top row. Clamping to
 * `[0, max(0, levelPixelHeight - viewportHeight)]` means a level that
 * already fits the viewport ALWAYS returns 0 here, regardless of the
 * dead-zone math below — a level shorter than the viewport can never need
 * to scroll, by construction.
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
  const screenCenterY = playerCenterY + originYBase + previousCameraY;
  const deadZoneTop = viewportHeight / 2 - CAMERA_DEAD_ZONE_HALF_HEIGHT;
  const deadZoneBottom = viewportHeight / 2 + CAMERA_DEAD_ZONE_HALF_HEIGHT;

  let cameraY = previousCameraY;
  if (screenCenterY < deadZoneTop) {
    cameraY = deadZoneTop - playerCenterY - originYBase;
  } else if (screenCenterY > deadZoneBottom) {
    cameraY = deadZoneBottom - playerCenterY - originYBase;
  }

  const maxCameraY = Math.max(0, levelPixelHeight - viewportHeight);
  return Math.min(Math.max(cameraY, 0), maxCameraY);
}
