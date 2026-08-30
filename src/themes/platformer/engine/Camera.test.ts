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
  const VIEWPORT_HEIGHT = 480; // dead zone: [144, 336] around center 240

  it('levelShorterThanViewport-cameraStaysAtZeroRegardlessOfPlayerPosition', () => {
    const result = updateCameraY(0, 1000, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 192);
    expect(result).toBe(0);
  });

  it('tallLevel-playerCenteredWithinDeadZone-cameraStaysAtPreviousPosition', () => {
    // levelPixelHeight 800, originYBase = 480-800 = -320. previousCameraY 160
    // -> effective originY -160. playerY 368 -> center 400 -> screenCenterY
    // 400-160 = 240, dead-center — no movement.
    const result = updateCameraY(160, 368, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(160);
  });

  it('playerExitsTopEdgeOfDeadZone-cameraShiftsUpToKeepPlayerAtEdge', () => {
    // playerY 382 -> center 414 -> screenCenterY (previousCameraY 0) =
    // 414-320 = 94, past deadZoneTop (144) on the low side — camera shifts
    // up: 144-414-(-320) = 50.
    const result = updateCameraY(0, 382, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(50);
  });

  it('playerExitsBottomEdgeOfDeadZone-cameraShiftsDownToKeepPlayerAtEdge', () => {
    // playerY 518 -> center 550 -> screenCenterY (previousCameraY 160) =
    // 550-320+160 = 390, past deadZoneBottom (336) — camera shifts down:
    // 336-550-(-320) = 106.
    const result = updateCameraY(160, 518, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(106);
  });

  it('cameraWouldGoNegative-clampsToZero', () => {
    const result = updateCameraY(0, 668, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(0);
  });

  it('cameraWouldExceedLevelTop-clampsToLevelHeightMinusViewport', () => {
    const result = updateCameraY(0, 32, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(320); // max = 800 - 480
  });
});
