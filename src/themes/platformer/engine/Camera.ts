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
