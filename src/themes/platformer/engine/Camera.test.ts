import { updateCamera, updateCameraY, CAMERA_TOP_OVERSCROLL } from './Camera';

describe('updateCamera', () => {
  const PLAYER_WIDTH = 64;
  const VIEWPORT_WIDTH = 1024; // dead zone: [416, 608] around center 512

  it('playerCenteredWithinDeadZone-cameraStaysAtPreviousPosition', () => {
    // playerCenterX = 480 + 32 = 512, screen-relative to cameraX=0 that's
    // 512, inside [416, 608] — no movement.
    const result = updateCamera(0, 480, PLAYER_WIDTH, VIEWPORT_WIDTH, 2560);
    expect(result).toBe(0);
  });

  it('playerExitsRightEdgeOfDeadZone-cameraShiftsRightToKeepPlayerAtEdge', () => {
    // playerCenterX = 1000 + 32 = 1032, screen-relative to cameraX=0 that's
    // 1032, past deadZoneRight (608) — camera shifts to pin the player back
    // to the dead zone's right edge: 1032 - 608 = 424.
    const result = updateCamera(0, 1000, PLAYER_WIDTH, VIEWPORT_WIDTH, 2560);
    expect(result).toBe(424);
  });

  it('playerExitsLeftEdgeOfDeadZone-cameraShiftsLeftToKeepPlayerAtEdge', () => {
    // playerCenterX = 768 + 32 = 800, screen-relative to cameraX=500 that's
    // 300, past deadZoneLeft (416) on the low side — camera shifts left to
    // pin the player to the dead zone's left edge: 800 - 416 = 384 (less
    // than the previous 500, i.e. genuinely moved left, not clamped).
    const result = updateCamera(500, 768, PLAYER_WIDTH, VIEWPORT_WIDTH, 2560);
    expect(result).toBe(384);
  });

  it('cameraWouldGoNegative-clampsToLevelStart', () => {
    // playerCenterX = 10 + 32 = 42; uncorrected camera would be
    // 42 - 416 = -374 — clamped to 0.
    const result = updateCamera(50, 10, PLAYER_WIDTH, VIEWPORT_WIDTH, 2560);
    expect(result).toBe(0);
  });

  it('cameraWouldExceedLevelEnd-clampsToLevelWidthMinusViewport', () => {
    // levelPixelWidth 1200, viewport 1024 -> max camera 176. Player far
    // right pushes the uncorrected camera (574) past that max.
    const result = updateCamera(150, 1150, PLAYER_WIDTH, VIEWPORT_WIDTH, 1200);
    expect(result).toBe(176);
  });

  it('viewportWiderThanLevel-cameraStaysAtZero', () => {
    // levelPixelWidth 800 < viewport 1024 -> max camera is 0 regardless of
    // player position.
    const result = updateCamera(0, 780, PLAYER_WIDTH, VIEWPORT_WIDTH, 800);
    expect(result).toBe(0);
  });
});

describe('updateCameraY', () => {
  const PLAYER_HEIGHT = 64;
  // Target row 5 * RENDERED_TILE_SIZE(32) = 160; dead zone: [64, 256] around
  // that fixed row (no longer a function of VIEWPORT_HEIGHT).
  const VIEWPORT_HEIGHT = 480;

  it('levelShorterThanViewport-cameraStaysAtZeroRegardlessOfPlayerPosition', () => {
    const result = updateCameraY(0, 1000, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 192);
    expect(result).toBe(0);
  });

  it('tallLevel-playerWithinDeadZone-cameraStaysAtPreviousPosition', () => {
    // levelPixelHeight 800, originYBase = 480-800 = -320. previousCameraY 160
    // -> effective originY -160. playerY 368 -> center 400 -> screenCenterY
    // 400-160 = 240, inside the new band [64, 256] (no longer dead-center,
    // just within it) — no movement.
    const result = updateCameraY(160, 368, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(160);
  });

  it('playerExitsTopEdgeOfDeadZone-cameraShiftsUpToKeepPlayerAtEdge', () => {
    // playerY 100 -> center 132 -> screenCenterY (previousCameraY 0,
    // originYBase -320) = 132-320 = -188, past deadZoneTop (64) on the low
    // side — camera shifts up: 64-132-(-320) = 252.
    const result = updateCameraY(0, 100, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(252);
  });

  it('playerExitsBottomEdgeOfDeadZone-cameraShiftsDownToKeepPlayerAtEdge', () => {
    // playerY 518 -> center 550 -> screenCenterY (previousCameraY 160,
    // originYBase -320) = 550-320+160 = 390, past deadZoneBottom (256) —
    // camera shifts down: 256-550-(-320) = 26.
    const result = updateCameraY(160, 518, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(26);
  });

  it('cameraWouldGoNegative-clampsToZero', () => {
    // playerY 668 -> center 700 -> screenCenterY (originYBase -320) =
    // 700-320 = 380, past deadZoneBottom (256) — uncorrected camera would be
    // 256-700-(-320) = -124, clamped to 0.
    const result = updateCameraY(0, 668, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(0);
  });

  it('cameraWouldExceedLevelTop-clampsToLevelHeightMinusViewportPlusOverscroll', () => {
    // With PLAYER_TARGET_ROW=5, CAMERA_DEAD_ZONE_HALF_HEIGHT=96 and
    // CAMERA_TOP_OVERSCROLL=64, deadZoneTop(64) - CAMERA_TOP_OVERSCROLL(64)
    // = 0 exactly, so the top clamp can only trigger for a playerCenterY
    // below 0 — i.e. a player positioned above the level's own top edge.
    // That's not reachable in normal play, but the clamp must still hold as
    // a safety net (e.g. if some other bug ever hands the camera an
    // out-of-range Y), so this test constructs that synthetic case
    // directly: playerY -400 -> center -368 -> originYBase -320 ->
    // uncorrected camera = 64-(-368)-(-320) = 752, far past
    // maxCameraY = (800-480) + 64 = 384 -> clamps to 384.
    const result = updateCameraY(0, -400, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(320 + CAMERA_TOP_OVERSCROLL); // max = (800 - 480) + overscroll
  });
});
