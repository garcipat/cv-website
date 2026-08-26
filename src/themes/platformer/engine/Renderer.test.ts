import { drawTerrain, drawPlayer } from './Renderer';
import type { LevelDef } from '../level/LevelData';
import type { PlayerState } from '../entities/Player';
import { PLAYER_RENDERED_SIZE } from '../entities/Player';

function makeMockContext() {
  return {
    imageSmoothingEnabled: true,
    drawImage: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    restore: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const fakeTileset = {} as HTMLImageElement;

describe('drawTerrain', () => {
  it('groundGrassTopExposed-draws-fromGrassTopSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 0, 0, 16, 16, 0, 0, 32, 32);
  });

  it('groundGrassNotExposed-draws-fromGrassFillSource', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeTileset, 0, 16, 16, 16, 0, 32, 32, 32);
  });

  it('groundRockTopExposed-draws-fromRockTopSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundRock']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 16, 0, 16, 16, 0, 0, 32, 32);
  });

  it('wallTile-draws-fromStoneBlockSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['wall']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 128, 0, 16, 16, 0, 0, 32, 32);
  });

  it('bridgeTile-singleWithNoBridgeNeighbors-draws-fromLowSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['bridge']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 160, 32, 16, 16, 0, 0, 32, 32);
  });

  it('bridgeRun-twoTiles-drawsRampDownThenRampUp', () => {
    const level: LevelDef = { width: 2, height: 1, terrain: [['bridge', 'bridge']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeTileset, 144, 32, 16, 16, 0, 0, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeTileset, 176, 32, 16, 16, 32, 0, 32, 32);
  });

  it('bridgeRun-threeTiles-drawsRampDownLowRampUp', () => {
    const level: LevelDef = { width: 3, height: 1, terrain: [['bridge', 'bridge', 'bridge']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeTileset, 144, 32, 16, 16, 0, 0, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeTileset, 160, 32, 16, 16, 32, 0, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(3, fakeTileset, 176, 32, 16, 16, 64, 0, 32, 32);
  });

  it('platformTile-draws-fromGrassTopSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['platform']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 0, 0, 16, 16, 0, 0, 32, 32);
  });

  it('emptyTile-doesNotDraw', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['empty']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('multiTileLevel-draws-atCorrectPixelPositions', () => {
    const level: LevelDef = { width: 2, height: 1, terrain: [['groundGrass', 'wall']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeTileset, 0, 0, 16, 16, 0, 0, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeTileset, 128, 0, 16, 16, 32, 0, 32, 32);
  });

  it('originY-shiftsEveryTileVertically', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, 100);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 0, 0, 16, 16, 0, 100, 32, 32);
  });

  it('originY-omitted-defaultsToZero', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 0, 0, 16, 16, 0, 0, 32, 32);
  });

  it('draws-setsImageSmoothingEnabledFalse', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.imageSmoothingEnabled).toBe(false);
  });
});

describe('drawPlayer', () => {
  const fakeSpriteSheet = {} as HTMLImageElement;
  const idlePlayer: PlayerState = {
    x: 16,
    y: 256,
    vx: 0,
    vy: 0,
    facing: 'right',
    grounded: true,
    animTimer: 0,
    animState: 'idle',
    animFrame: 0,
  };

  it('idleFrame0-draws-fromFirstIdleSource', () => {
    const ctx = makeMockContext();

    drawPlayer(ctx, idlePlayer, fakeSpriteSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeSpriteSheet,
      0,
      0,
      32,
      32,
      16,
      256,
      64,
      64,
    );
  });

  it('idleFrame2-draws-fromThirdIdleSource', () => {
    const ctx = makeMockContext();
    const player: PlayerState = { ...idlePlayer, animFrame: 2 };

    drawPlayer(ctx, player, fakeSpriteSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeSpriteSheet,
      64,
      0,
      32,
      32,
      16,
      256,
      64,
      64,
    );
  });

  it('originY-shiftsPlayerVertically', () => {
    const ctx = makeMockContext();

    drawPlayer(ctx, idlePlayer, fakeSpriteSheet, 100);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeSpriteSheet,
      0,
      0,
      32,
      32,
      16,
      356,
      64,
      64,
    );
  });

  it('draws-setsImageSmoothingEnabledFalse', () => {
    const ctx = makeMockContext();

    drawPlayer(ctx, idlePlayer, fakeSpriteSheet);

    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('facingLeft-draws-flippedAroundSpriteBoundingBox', () => {
    const ctx = makeMockContext();
    const player: PlayerState = { ...idlePlayer, facing: 'left' };

    drawPlayer(ctx, player, fakeSpriteSheet);

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.translate).toHaveBeenCalledWith(
      player.x + PLAYER_RENDERED_SIZE,
      player.y,
    );
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeSpriteSheet,
      0,
      0,
      32,
      32,
      0,
      0,
      PLAYER_RENDERED_SIZE,
      PLAYER_RENDERED_SIZE,
    );
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('facingRight-draws-withoutFlippingTransform', () => {
    const ctx = makeMockContext();

    drawPlayer(ctx, idlePlayer, fakeSpriteSheet);

    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.scale).not.toHaveBeenCalled();
  });

  it('jumpStateRising-withJumpSpriteSheet-drawsFromJumpSheetAtJumpFrameSize', () => {
    const ctx = makeMockContext();
    const jumpSheet = {} as HTMLImageElement;
    const player: PlayerState = { ...idlePlayer, animState: 'jump', vy: -300, animFrame: 2 };

    drawPlayer(ctx, player, fakeSpriteSheet, 0, jumpSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      jumpSheet,
      2 * 128,
      0,
      128,
      128,
      16,
      256,
      64,
      64,
    );
  });

  it('jumpStateFalling-withJumpSpriteSheet-drawsFromFallRow', () => {
    const ctx = makeMockContext();
    const jumpSheet = {} as HTMLImageElement;
    const player: PlayerState = { ...idlePlayer, animState: 'jump', vy: 100, animFrame: 1 };

    drawPlayer(ctx, player, fakeSpriteSheet, 0, jumpSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      jumpSheet,
      1 * 128,
      161,
      128,
      128,
      16,
      256,
      64,
      64,
    );
  });

  it('jumpState-noJumpSpriteSheetProvided-fallsBackToPrimarySheetIdleFrame', () => {
    const ctx = makeMockContext();
    const player: PlayerState = { ...idlePlayer, animState: 'jump', vy: -300 };

    drawPlayer(ctx, player, fakeSpriteSheet, 0, null);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeSpriteSheet,
      0,
      0,
      32,
      32,
      16,
      256,
      64,
      64,
    );
  });

  it('jumpStateFacingLeft-withJumpSpriteSheet-drawsFlippedFromJumpSheet', () => {
    const ctx = makeMockContext();
    const jumpSheet = {} as HTMLImageElement;
    const player: PlayerState = {
      ...idlePlayer,
      animState: 'jump',
      vy: -300,
      facing: 'left',
    };

    drawPlayer(ctx, player, fakeSpriteSheet, 0, jumpSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(jumpSheet, 0, 0, 128, 128, 0, 0, 64, 64);
  });
});
