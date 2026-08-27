import {
  drawTerrain,
  drawPlayer,
  drawHearts,
  drawCoins,
  drawCoinCounter,
  drawCollectibles,
  drawCollectionEffects,
  drawCollectibleCounter,
  drawIrisOverlay,
  drawRestartPrompt,
  RESTART_PROMPT_FONT_FAMILY,
} from './Renderer';
import { coinBobOffset, COIN_FRAME_DURATION } from '../entities/Coin';
import type { CoinPlacement } from '../entities/Coin';
import type { LevelDef } from '../level/LevelData';
import type { PlayerState } from '../entities/Player';
import { PLAYER_RENDERED_SIZE } from '../entities/Player';
import { MAX_HALF_HEARTS } from '../entities/Health';
import { startFlightEffect, tickFlightEffect, HOVER_DURATION_SECONDS } from './CollectionEffects';
import type { CollectiblePlacement } from '../level/CollectibleMapper';

function makeMockContext() {
  return {
    imageSmoothingEnabled: true,
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    drawImage: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

const fakeTileset = {} as HTMLImageElement;

function makePlacement(id: string, spriteType: 'coin' | 'fruit', x: number, y: number): CollectiblePlacement {
  return {
    id,
    spriteType,
    fact: { id, sectionId: 'skills', sectionLabel: 'Skills', data: { category: 'X', skills: [] }, sourceType: 'coin' },
    x,
    y,
  };
}

describe('drawCollectibles', () => {
  it('coinAndFruit-drawEachFromItsOwnSprite', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const coinSprite = { tag: 'coin' } as unknown as HTMLImageElement;
    const fruitSprite = { tag: 'fruit' } as unknown as HTMLImageElement;
    const placements = [makePlacement('a', 'coin', 100, 100), makePlacement('b', 'fruit', 300, 300)];

    drawCollectibles(ctx as unknown as CanvasRenderingContext2D, placements, coinSprite, fruitSprite, new Set(), 0);

    const calls = ctx.drawImage.mock.calls;
    expect(calls.some((c: unknown[]) => c[0] === coinSprite)).toBe(true);
    expect(calls.some((c: unknown[]) => c[0] === fruitSprite)).toBe(true);
  });

  it('collectedId-isSkipped', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const placements = [makePlacement('a', 'coin', 100, 100)];

    drawCollectibles(
      ctx as unknown as CanvasRenderingContext2D,
      placements,
      {} as HTMLImageElement,
      {} as HTMLImageElement,
      new Set(['a']),
      0,
    );

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawCollectionEffects', () => {
  it('hoveringEffect-drawsTextAtStartPosition', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effect = tickFlightEffect(startFlightEffect('a', 'German', 50, 60, 900, 900), HOVER_DURATION_SECONDS / 2);

    drawCollectionEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.fillText).toHaveBeenCalledWith('German', 50, expect.any(Number));
  });

  it('noEffects-doesNotCallFillText', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    drawCollectionEffects(ctx as unknown as CanvasRenderingContext2D, []);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});

describe('drawCollectibleCounter', () => {
  it('called-drawsIconThenSpacedText', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
      font: string;
    };
    const icon = {} as HTMLImageElement;

    drawCollectibleCounter(ctx as unknown as CanvasRenderingContext2D, icon, { sx: 0, sy: 0, size: 16 }, 3, 16, 200, 20);

    expect(ctx.drawImage).toHaveBeenCalledWith(icon, 0, 0, 16, 16, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('3 / 16', expect.any(Number), expect.any(Number));
    expect(ctx.font).toBe(`16px "${RESTART_PROMPT_FONT_FAMILY}", monospace`);
  });
});

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

    drawTerrain(ctx, level, fakeTileset, 0, 100);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 0, 0, 16, 16, 0, 100, 32, 32);
  });

  it('originX-shiftsEveryTileHorizontally', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, 100);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 0, 0, 16, 16, 100, 0, 32, 32);
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
    isDroppingThroughBridge: false,
    lastGroundedX: 16,
    lastGroundedY: 256,
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

    drawPlayer(ctx, idlePlayer, fakeSpriteSheet, 0, 100);

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

  it('originX-shiftsPlayerHorizontally', () => {
    const ctx = makeMockContext();

    drawPlayer(ctx, idlePlayer, fakeSpriteSheet, 100);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeSpriteSheet,
      0, 0, 32, 32,
      116, 256, 64, 64,
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

  it('facingLeft-withOriginX-translatesIncludingHorizontalShift', () => {
    const ctx = makeMockContext();
    const player: PlayerState = { ...idlePlayer, facing: 'left' };

    drawPlayer(ctx, player, fakeSpriteSheet, 100);

    expect(ctx.translate).toHaveBeenCalledWith(
      player.x + 100 + PLAYER_RENDERED_SIZE,
      player.y,
    );
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

    drawPlayer(ctx, player, fakeSpriteSheet, 0, 0, jumpSheet);

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

    drawPlayer(ctx, player, fakeSpriteSheet, 0, 0, jumpSheet);

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

    drawPlayer(ctx, player, fakeSpriteSheet, 0, 0, null);

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

    drawPlayer(ctx, player, fakeSpriteSheet, 0, 0, jumpSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(jumpSheet, 0, 0, 128, 128, 0, 0, 64, 64);
  });
});

describe('drawHearts', () => {
  const fakeHeartsSheet = {} as HTMLImageElement;

  it('fullHealth-drawsThreeFullHeartFrames', () => {
    const ctx = makeMockContext();

    drawHearts(ctx, MAX_HALF_HEARTS, fakeHeartsSheet);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeHeartsSheet, 0, 0, 16, 16, 16, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeHeartsSheet, 0, 0, 16, 16, 52, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(3, fakeHeartsSheet, 0, 0, 16, 16, 88, 16, 32, 32);
  });

  it('threeHalfHearts-drawsOneFullOneHalfOneEmpty', () => {
    const ctx = makeMockContext();

    drawHearts(ctx, 3, fakeHeartsSheet);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeHeartsSheet, 0, 0, 16, 16, 16, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeHeartsSheet, 16, 0, 16, 16, 52, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(3, fakeHeartsSheet, 32, 0, 16, 16, 88, 16, 32, 32);
  });

  it('zeroHealth-drawsAllEmptyFrames', () => {
    const ctx = makeMockContext();

    drawHearts(ctx, 0, fakeHeartsSheet);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeHeartsSheet, 32, 0, 16, 16, 16, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeHeartsSheet, 32, 0, 16, 16, 52, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(3, fakeHeartsSheet, 32, 0, 16, 16, 88, 16, 32, 32);
  });

  it('draws-setsImageSmoothingEnabledFalse', () => {
    const ctx = makeMockContext();

    drawHearts(ctx, MAX_HALF_HEARTS, fakeHeartsSheet);

    expect(ctx.imageSmoothingEnabled).toBe(false);
  });
});

describe('drawCoins', () => {
  it('twoCoinsAtElapsedZero-drawsBothAtFirstFrameWithOriginOffset', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const coins: CoinPlacement[] = [
      { id: 'a', x: 100, y: 200 },
      { id: 'b', x: 300, y: 400 },
    ];
    const sprite = {} as HTMLImageElement;

    drawCoins(ctx as unknown as CanvasRenderingContext2D, coins, sprite, 0, 10, 20);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, sprite, 0, 0, 16, 16, 110, 220, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, sprite, 0, 0, 16, 16, 310, 420, 32, 32);
  });

  it('elapsedAdvancedOneFrameDuration-usesSecondSpriteFrame', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const coins: CoinPlacement[] = [{ id: 'a', x: 0, y: 0 }];
    const sprite = {} as HTMLImageElement;

    drawCoins(ctx as unknown as CanvasRenderingContext2D, coins, sprite, COIN_FRAME_DURATION);

    // dy is omitted here — at elapsed=COIN_FRAME_DURATION the bob offset (see the dedicated
    // 'appliesBobOffset' test below) is a non-round number, so this test only
    // pins down the parts unaffected by bobbing: sprite frame and dx/dw/dh.
    const call = ctx.drawImage.mock.calls[0];
    expect(call[0]).toBe(sprite);
    expect(call.slice(1, 6)).toEqual([16, 0, 16, 16, 0]); // sx, sy, sw, sh, dx
    expect(call.slice(7)).toEqual([32, 32]); // dw, dh
  });

  it('elapsedQuarterBobPeriod-appliesBobOffsetToDestY', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const coins: CoinPlacement[] = [{ id: 'a', x: 0, y: 100 }];
    const sprite = {} as HTMLImageElement;
    const elapsed = 0.4; // COIN_BOB_PERIOD_SECONDS / 4 — see Coin.ts

    drawCoins(ctx as unknown as CanvasRenderingContext2D, coins, sprite, elapsed, 0, 0);

    const dy = ctx.drawImage.mock.calls[0][6] as number;
    expect(dy).toBeCloseTo(100 + coinBobOffset(elapsed));
  });

  it('noCoins-doesNotCallDrawImage', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawCoins(ctx as unknown as CanvasRenderingContext2D, [], {} as HTMLImageElement, 0);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawCoinCounter', () => {
  it('called-drawsCollectedSlashMaxText', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn>; font: string };

    drawCoinCounter(ctx as unknown as CanvasRenderingContext2D, 0, 4);

    expect(ctx.fillText).toHaveBeenCalledWith('0 / 4', expect.any(Number), expect.any(Number));
    expect(ctx.font).toBe(`16px "${RESTART_PROMPT_FONT_FAMILY}", monospace`);
  });
});

describe('drawIrisOverlay', () => {
  it('positiveRadius-fillsRectAndCutsCircularHoleWithEvenOdd', () => {
    const ctx = makeMockContext() as unknown as {
      rect: ReturnType<typeof vi.fn>;
      moveTo: ReturnType<typeof vi.fn>;
      arc: ReturnType<typeof vi.fn>;
      fill: ReturnType<typeof vi.fn>;
    };

    drawIrisOverlay(ctx as unknown as CanvasRenderingContext2D, 800, 600, 400, 300, 100);

    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.arc).toHaveBeenCalledWith(400, 300, 100, 0, Math.PI * 2, true);
    expect(ctx.fill).toHaveBeenCalledWith('evenodd');
  });

  it('zeroRadius-fillsRectWithoutDrawingCircle', () => {
    const ctx = makeMockContext() as unknown as {
      rect: ReturnType<typeof vi.fn>;
      arc: ReturnType<typeof vi.fn>;
      fill: ReturnType<typeof vi.fn>;
    };

    drawIrisOverlay(ctx as unknown as CanvasRenderingContext2D, 800, 600, 400, 300, 0);

    expect(ctx.rect).toHaveBeenCalledWith(0, 0, 800, 600);
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalledWith('evenodd');
  });
});

describe('drawRestartPrompt', () => {
  it('called-drawsPromptTextCenteredOnCanvas', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };

    drawRestartPrompt(ctx as unknown as CanvasRenderingContext2D, 800, 600);

    expect(ctx.fillText).toHaveBeenCalledWith('Press any button to restart', 400, 300);
  });

  it('called-usesRestartPromptFontFamilyWithSansSerifFallback', () => {
    const ctx = makeMockContext() as unknown as { font: string };

    drawRestartPrompt(ctx as unknown as CanvasRenderingContext2D, 800, 600);

    expect(ctx.font).toContain(RESTART_PROMPT_FONT_FAMILY);
    expect(ctx.font).toContain('sans-serif');
  });
});
