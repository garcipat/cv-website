import { drawDebugOverlay } from './DebugOverlay';
import type { LevelDef } from '../level/LevelData';
import type { PlayerState } from '../entities/Player';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_SIDE_PADDING,
  PLAYER_FOOT_PADDING,
  PLAYER_HEAD_PADDING,
} from '../entities/Player';
import { RENDERED_TILE_SIZE } from '../level/Terrain';

function makeMockContext() {
  return {
    strokeStyle: '',
    lineWidth: 1,
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const idlePlayer: PlayerState = {
  x: 16,
  y: 256,
  vx: 0,
  vy: 0,
  facing: 'right',
  grounded: true,
  isDroppingThroughBridge: false,
  lastGroundedX: 16,
  lastGroundedY: 256,
  animTimer: 0,
  animState: 'idle',
  animFrame: 0,
  invincibleTimer: 0,
  knockbackTimer: 0,
  bounceAscending: false,
  hitBlockIds: [],
};

describe('drawDebugOverlay', () => {
  it('player-drawsRedHitboxRectAtFullSize', () => {
    const ctx = makeMockContext();
    const level: LevelDef = { width: 1, height: 1, terrain: [['empty']] };

    drawDebugOverlay(ctx, idlePlayer, level, 0, 0);

    // Verify exactly one call matches the full hitbox dimensions.
    const hitboxCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) =>
        call[0] === idlePlayer.x &&
        call[1] === idlePlayer.y &&
        call[2] === PLAYER_RENDERED_SIZE &&
        call[3] === PLAYER_RENDERED_SIZE,
    );
    expect(hitboxCalls).toHaveLength(1);
  });

  it('player-drawsYellowVisibleWindowRectNarrowerThanHitbox', () => {
    const ctx = makeMockContext();
    const level: LevelDef = { width: 1, height: 1, terrain: [['empty']] };

    drawDebugOverlay(ctx, idlePlayer, level, 0, 0);

    const expectedX = idlePlayer.x + PLAYER_SIDE_PADDING;
    const expectedWidth = PLAYER_RENDERED_SIZE - PLAYER_SIDE_PADDING * 2 - 1;
    const visibleCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) =>
        call[0] === expectedX &&
        call[1] === idlePlayer.y &&
        call[2] === expectedWidth &&
        call[3] === PLAYER_RENDERED_SIZE,
    );
    expect(visibleCalls).toHaveLength(1);
  });

  it('player-drawsCyanHeadLineAtHeadPaddingOffset', () => {
    const ctx = makeMockContext();
    const level: LevelDef = { width: 1, height: 1, terrain: [['empty']] };

    drawDebugOverlay(ctx, idlePlayer, level, 0, 0);

    const headY = idlePlayer.y + PLAYER_HEAD_PADDING;
    const visibleLeft = idlePlayer.x + PLAYER_SIDE_PADDING;
    const visibleRight = idlePlayer.x + PLAYER_RENDERED_SIZE - PLAYER_SIDE_PADDING - 1;

    expect(ctx.moveTo).toHaveBeenCalledWith(visibleLeft, headY);
    expect(ctx.lineTo).toHaveBeenCalledWith(visibleRight, headY);
  });

  it('player-drawsMagentaFootLineAtFootPaddingOffset', () => {
    const ctx = makeMockContext();
    const level: LevelDef = { width: 1, height: 1, terrain: [['empty']] };

    drawDebugOverlay(ctx, idlePlayer, level, 0, 0);

    const footY = idlePlayer.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING;
    const visibleLeft = idlePlayer.x + PLAYER_SIDE_PADDING;
    const visibleRight = idlePlayer.x + PLAYER_RENDERED_SIZE - PLAYER_SIDE_PADDING - 1;

    expect(ctx.moveTo).toHaveBeenCalledWith(visibleLeft, footY);
    expect(ctx.lineTo).toHaveBeenCalledWith(visibleRight, footY);
  });

  it('originY-offsetsPlayerRectsAndLines', () => {
    const ctx = makeMockContext();
    const level: LevelDef = { width: 1, height: 1, terrain: [['empty']] };
    const originY = 100;

    drawDebugOverlay(ctx, idlePlayer, level, 0, originY);

    const hitboxCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) =>
        call[0] === idlePlayer.x &&
        call[1] === idlePlayer.y + originY &&
        call[2] === PLAYER_RENDERED_SIZE &&
        call[3] === PLAYER_RENDERED_SIZE,
    );
    expect(hitboxCalls).toHaveLength(1);
  });

  it('twoTileLevelOneSolid-drawsOneGreenRectForSolidTileOnly', () => {
    const ctx = makeMockContext();
    const level: LevelDef = { width: 2, height: 1, terrain: [['wall', 'empty']] };

    drawDebugOverlay(ctx, idlePlayer, level, 0, 0);

    const greenTileCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === 0 && call[1] === 0 && call[2] === RENDERED_TILE_SIZE && call[3] === RENDERED_TILE_SIZE,
    );
    expect(greenTileCalls).toHaveLength(1);

    const emptyTileCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) =>
        call[0] === RENDERED_TILE_SIZE &&
        call[1] === 0 &&
        call[2] === RENDERED_TILE_SIZE &&
        call[3] === RENDERED_TILE_SIZE,
    );
    expect(emptyTileCalls).toHaveLength(0);
  });

  it('solidTile-originY-offsetsTileRectVertically', () => {
    const ctx = makeMockContext();
    const level: LevelDef = { width: 1, height: 1, terrain: [['wall']] };
    const originY = 50;

    drawDebugOverlay(ctx, idlePlayer, level, 0, originY);

    const greenTileCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) =>
        call[0] === 0 &&
        call[1] === originY &&
        call[2] === RENDERED_TILE_SIZE &&
        call[3] === RENDERED_TILE_SIZE,
    );
    expect(greenTileCalls).toHaveLength(1);
  });

  it('originX-offsetsPlayerRectsAndLinesHorizontally', () => {
    const ctx = makeMockContext();
    const level: LevelDef = { width: 1, height: 1, terrain: [['empty']] };
    const originX = 40;

    drawDebugOverlay(ctx, idlePlayer, level, originX, 0);

    const hitboxCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) =>
        call[0] === idlePlayer.x + originX &&
        call[1] === idlePlayer.y &&
        call[2] === PLAYER_RENDERED_SIZE &&
        call[3] === PLAYER_RENDERED_SIZE,
    );
    expect(hitboxCalls).toHaveLength(1);
  });

  it('solidTile-originX-offsetsTileRectHorizontally', () => {
    const ctx = makeMockContext();
    const level: LevelDef = { width: 1, height: 1, terrain: [['wall']] };
    const originX = 24;

    drawDebugOverlay(ctx, idlePlayer, level, originX, 0);

    const greenTileCalls = (ctx.strokeRect as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) =>
        call[0] === originX &&
        call[1] === 0 &&
        call[2] === RENDERED_TILE_SIZE &&
        call[3] === RENDERED_TILE_SIZE,
    );
    expect(greenTileCalls).toHaveLength(1);
  });
});
