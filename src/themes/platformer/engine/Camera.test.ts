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
  // Target: viewportHeight(480) - PLAYER_TARGET_ROWS_FROM_BOTTOM(3) *
  // RENDERED_TILE_SIZE(32) = 480 - 96 = 384; dead zone: [224, 384] — top edge
  // fixed at CAMERA_DEAD_ZONE_TOP_MARGIN_ROWS(7) * RENDERED_TILE_SIZE(32) =
  // 224 rows down from the canvas TOP (not derived from the target row),
  // bottom edge at the target row itself (CAMERA_DEAD_ZONE_BOTTOM_SLACK is 0
  // — the target row IS the resting position, so any descent past it
  // corrects immediately). The same formula applies whether the player is
  // standing, jumping, or falling — there is no grounded/airborne branch.
  const VIEWPORT_HEIGHT = 480;

  it('levelShorterThanViewport-playerWithinEnlargedDeadZone-cameraStaysAtPreviousPosition', () => {
    // levelPixelHeight 440 < viewport 480. originYBase = viewportHeight -
    // levelPixelHeight = 480-440 = 40. playerY 250 -> center 282 ->
    // screenCenterY (previousCameraY 0) = 282+40+0 = 322 — inside the band
    // [224, 384], so no correction at all: the camera stays at its previous
    // value (0) rather than being dragged toward the bottom target row. A
    // short level shouldn't force the player down to the target row just
    // because they're above it.
    const result = updateCameraY(0, 250, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 440);
    expect(result).toBe(0);
  });

  it('tallLevel-playerWithinDeadZone-cameraStaysAtPreviousPosition', () => {
    // levelPixelHeight 800, originYBase = 480-800 = -320. previousCameraY 160
    // -> playerY 480 -> center 512 -> screenCenterY 512-320+160 = 352, inside
    // the band [224, 384] — no movement.
    const result = updateCameraY(160, 480, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(160);
  });

  it('playerExitsTopEdgeOfDeadZone-cameraShiftsUpToKeepPlayerAtEdge', () => {
    // playerY 200 -> center 232 -> screenCenterY (previousCameraY 0,
    // originYBase -320) = 232-320 = -88, past deadZoneTop (224) on the low
    // side — camera shifts up: 224-232-(-320) = 312.
    const result = updateCameraY(0, 200, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(312);
  });

  it('playerAtOrBelowTargetRow-cameraShiftsImmediatelyToKeepPlayerAtEdge', () => {
    // playerY 640 -> center 672 -> screenCenterY (previousCameraY 200,
    // originYBase -320) = 672-320+200 = 552, past deadZoneBottom (384, zero
    // slack) — camera shifts down: 384-672-(-320) = 32.
    const result = updateCameraY(200, 640, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(32);
  });

  it('deepDescent-cameraGoesNegative-noLongerClampedToZero', () => {
    // playerY 1000 -> center 1032 -> screenCenterY (previousCameraY 0,
    // originYBase -320) = 1032-320 = 712, past deadZoneBottom (384) —
    // uncorrected camera: 384-1032-(-320) = -328. Deliberately negative and
    // NOT clamped: a floor at 0 here would reproduce the same bug the
    // removed ceiling had (silently overriding the dead-zone target once the
    // player descends far enough), which the background layers are built to
    // tolerate — see updateCameraY's own doc comment.
    const result = updateCameraY(0, 1000, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 800);
    expect(result).toBe(-328);
  });

  it('standingAtRestingRow-cameraStaysPut-noSeparateGroundedFormula', () => {
    // Proves landing/standing needs no special case: a player resting
    // exactly at the target row (the zero-slack bottom edge) triggers no
    // correction at all, the same as any other in-band frame.
    // levelPixelHeight 480 -> originYBase 0. playerY 352 -> center 384,
    // matching targetY (384) exactly -> screenCenterY (previousCameraY 0) =
    // 384+0+0 = 384, not past deadZoneBottom (strict >) — no correction.
    const result = updateCameraY(0, 352, PLAYER_HEIGHT, VIEWPORT_HEIGHT, 480);
    expect(result).toBe(0);
  });
});
