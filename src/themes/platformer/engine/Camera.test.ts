import { updateCamera, updateCameraY } from './Camera';

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
  // Target: viewportHeight(480) - PLAYER_TARGET_ROWS_FROM_BOTTOM(4) *
  // RENDERED_TILE_SIZE(32) = 480 - 128 = 352; dead zone: [256, 448] around
  // that fixed row, measured from the BOTTOM of the viewport.
  const VIEWPORT_HEIGHT = 480;

  it('levelShorterThanViewport-stillAppliesDeadZoneTarget-cameraGoesNonZero', () => {
    // levelPixelHeight 400 < viewport 480 (level fits, no ceiling should ever
    // force cameraY back to 0). originYBase = viewportHeight - levelPixelHeight
    // = 480-400 = 80. playerY 0 (top of the level) -> center 32 -> screenCenterY
    // (previousCameraY 0) = 32+80+0 = 112, past deadZoneTop (256) on the low
    // side — camera shifts up: 256-32-80 = 144. A nonzero result here proves
    // the dead-zone target row still takes effect for a short level, instead
    // of being overridden back to 0 by the old (now-removed) ceiling.
    const result = updateCameraY(0, 0, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 400);
    expect(result).toBe(144);
  });

  it('tallLevel-playerWithinDeadZone-cameraStaysAtPreviousPosition', () => {
    // levelPixelHeight 800, originYBase = 480-800 = -320. previousCameraY 160
    // -> playerY 468 -> center 500 -> screenCenterY 500-320+160 = 340, inside
    // the band [256, 448] — no movement.
    const result = updateCameraY(160, 468, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(160);
  });

  it('playerExitsTopEdgeOfDeadZone-cameraShiftsUpToKeepPlayerAtEdge', () => {
    // playerY 200 -> center 232 -> screenCenterY (previousCameraY 0,
    // originYBase -320) = 232-320 = -88, past deadZoneTop (256) on the low
    // side — camera shifts up: 256-232-(-320) = 344.
    const result = updateCameraY(0, 200, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(344);
  });

  it('playerExitsBottomEdgeOfDeadZone-cameraShiftsDownToKeepPlayerAtEdge', () => {
    // playerY 568 -> center 600 -> screenCenterY (previousCameraY 200,
    // originYBase -320) = 600-320+200 = 480, past deadZoneBottom (448) —
    // camera shifts down: 448-600-(-320) = 168.
    const result = updateCameraY(200, 568, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(168);
  });

  it('cameraWouldGoNegative-clampsToZero', () => {
    // playerY 760 -> center 792 -> screenCenterY (originYBase -320) =
    // 792-320 = 472, past deadZoneBottom (448) — uncorrected camera would be
    // 448-792-(-320) = -24, clamped to 0.
    const result = updateCameraY(0, 760, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(0);
  });
});
