import { updateCamera } from './Camera';

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
