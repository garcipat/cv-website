import {
  drawTerrain,
  drawPlayer,
  drawHearts,
  drawCollectibles,
  drawEnemies,
  drawCollectionEffects,
  drawCollectibleCounter,
  drawIrisOverlay,
  drawRestartPrompt,
  RESTART_PROMPT_FONT_FAMILY,
  HEARTS_START_X,
} from './Renderer';
import type { LevelDef } from '../level/LevelData';
import type { PlayerState } from '../entities/Player';
import { PLAYER_RENDERED_SIZE } from '../entities/Player';
import { MAX_HALF_HEARTS, HEART_RENDERED_SIZE } from '../entities/Health';
import { startFlightEffect, tickFlightEffect, RISE_DURATION_SECONDS, SPARKLE_DURATION_SECONDS } from './CollectionEffects';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import type { EnemyState } from '../entities/Enemy';
import { fruitFrameSource } from '../entities/Fruit';
import {
  ENEMY_FRAME_SIZE,
  ENEMY_RENDERED_SIZE,
  ENEMY_TILE_OFFSET_X,
  ENEMY_TILE_OFFSET_Y,
} from '../entities/Enemy';

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
    measureText: vi.fn(() => ({ width: 10 })),
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

  it('middleFruitCollected-laterFruitKeepsSameIconAsWhenNoneCollected', () => {
    const fruitSprite = { tag: 'fruit' } as unknown as HTMLImageElement;
    const placements = [
      makePlacement('a', 'fruit', 100, 100),
      makePlacement('b', 'fruit', 200, 200),
      makePlacement('c', 'fruit', 300, 300),
    ];

    // Baseline: render all three, nothing collected.
    const baselineCtx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    drawCollectibles(
      baselineCtx as unknown as CanvasRenderingContext2D,
      placements,
      {} as HTMLImageElement,
      fruitSprite,
      new Set(),
      0,
    );
    const baselineThirdCall = baselineCtx.drawImage.mock.calls.find(
      (c: unknown[]) => c[5] === 300 && c[6] === 300,
    );
    expect(baselineThirdCall).toBeDefined();
    const [, baselineSx, baselineSy] = baselineThirdCall as unknown[];

    // Now collect the middle fruit ('b') and re-render — the third fruit's
    // icon (sx/sy) must be unchanged, since it's keyed to its own stable
    // position among all fruit placements, not a counter of visible fruits.
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    drawCollectibles(
      ctx as unknown as CanvasRenderingContext2D,
      placements,
      {} as HTMLImageElement,
      fruitSprite,
      new Set(['b']),
      0,
    );
    const thirdCall = ctx.drawImage.mock.calls.find((c: unknown[]) => c[5] === 300 && c[6] === 300);
    expect(thirdCall).toBeDefined();
    const [, sx, sy] = thirdCall as unknown[];

    expect(sx).toBe(baselineSx);
    expect(sy).toBe(baselineSy);
    // And it should match the icon for index 2 (its fixed position among
    // all fruit-type placements), regardless of collection order.
    const expected = fruitFrameSource(2);
    expect(sx).toBe(expected.sx);
    expect(sy).toBe(expected.sy);
  });

  it('fruitSpriteNull-coinsStillDrawAndFruitsSkipped', () => {
    const coinSprite = { tag: 'coin' } as unknown as HTMLImageElement;
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const placements = [makePlacement('a', 'coin', 100, 100), makePlacement('b', 'fruit', 300, 300)];

    drawCollectibles(ctx as unknown as CanvasRenderingContext2D, placements, coinSprite, null, new Set(), 0);

    const calls = ctx.drawImage.mock.calls;
    expect(calls.some((c: unknown[]) => c[0] === coinSprite)).toBe(true);
    expect(calls.length).toBe(1);
  });

  it('coinSpriteNull-fruitsStillDrawAndCoinsSkipped', () => {
    const fruitSprite = { tag: 'fruit' } as unknown as HTMLImageElement;
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const placements = [makePlacement('a', 'coin', 100, 100), makePlacement('b', 'fruit', 300, 300)];

    drawCollectibles(ctx as unknown as CanvasRenderingContext2D, placements, null, fruitSprite, new Set(), 0);

    const calls = ctx.drawImage.mock.calls;
    expect(calls.some((c: unknown[]) => c[0] === fruitSprite)).toBe(true);
    expect(calls.length).toBe(1);
  });
});

function makeEnemyState(
  id: string,
  spriteType: 'slimeGreen' | 'slimePurple',
  x: number,
  y: number,
  overrides: Partial<EnemyState> = {},
): EnemyState {
  return {
    id,
    spriteType,
    fact: {
      id,
      sectionId: 'certificates',
      sectionLabel: 'Certificates',
      data: { name: 'X', issuer: 'Y', date: '2020-01' },
      sourceType: 'enemy',
    },
    x,
    y,
    vx: 0,
    direction: 'right',
    animState: 'walk',
    animFrame: 0,
    animTimer: 0,
    ...overrides,
  };
}

describe('drawEnemies', () => {
  it('greenAndPurple-drawEachFromItsOwnSprite', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const greenSprite = { tag: 'green' } as unknown as HTMLImageElement;
    const purpleSprite = { tag: 'purple' } as unknown as HTMLImageElement;
    const enemies = [
      makeEnemyState('a', 'slimeGreen', 100, 100),
      makeEnemyState('b', 'slimePurple', 300, 300),
    ];

    drawEnemies(ctx as unknown as CanvasRenderingContext2D, enemies, greenSprite, purpleSprite);

    const calls = ctx.drawImage.mock.calls;
    expect(calls.some((c: unknown[]) => c[0] === greenSprite)).toBe(true);
    expect(calls.some((c: unknown[]) => c[0] === purpleSprite)).toBe(true);
  });

  it('missingGreenSprite-skipsGreenEnemiesButStillDrawsPurple', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const purpleSprite = { tag: 'purple' } as unknown as HTMLImageElement;
    const enemies = [
      makeEnemyState('a', 'slimeGreen', 100, 100),
      makeEnemyState('b', 'slimePurple', 300, 300),
    ];

    drawEnemies(ctx as unknown as CanvasRenderingContext2D, enemies, null, purpleSprite);

    const calls = ctx.drawImage.mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(purpleSprite);
  });

  it('facingRight-drawsAtEnemyRenderedSizeUsingItsOwnAnimFrame', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const greenSprite = {} as HTMLImageElement;

    drawEnemies(
      ctx as unknown as CanvasRenderingContext2D,
      [makeEnemyState('a', 'slimeGreen', 100, 100, { animState: 'walk', animFrame: 2 })],
      greenSprite,
      null,
    );

    const call = ctx.drawImage.mock.calls[0];
    expect(call[1]).toBe(1 * ENEMY_FRAME_SIZE); // sx: walk frame 2 is sheet frame 6 (row 1, col 1)
    expect(call[2]).toBe(ENEMY_FRAME_SIZE); // sy: row 1
    expect(call[3]).toBe(ENEMY_FRAME_SIZE);
    expect(call[4]).toBe(ENEMY_FRAME_SIZE);
    expect(call[5]).toBe(100 + ENEMY_TILE_OFFSET_X);
    expect(call[6]).toBe(100 + ENEMY_TILE_OFFSET_Y);
    expect(call[7]).toBe(ENEMY_RENDERED_SIZE);
    expect(call[8]).toBe(ENEMY_RENDERED_SIZE);
  });

  it('withOrigin-addsOriginOnTopOfPlacementAndTileOffset', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const greenSprite = {} as HTMLImageElement;

    drawEnemies(
      ctx as unknown as CanvasRenderingContext2D,
      [makeEnemyState('a', 'slimeGreen', 100, 100)],
      greenSprite,
      null,
      50,
      20,
    );

    const call = ctx.drawImage.mock.calls[0];
    expect(call[5]).toBe(100 + ENEMY_TILE_OFFSET_X + 50);
    expect(call[6]).toBe(100 + ENEMY_TILE_OFFSET_Y + 20);
  });

  it('facingLeft-mirrorsViaSaveTranslateScale', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      save: ReturnType<typeof vi.fn>;
      translate: ReturnType<typeof vi.fn>;
      scale: ReturnType<typeof vi.fn>;
      restore: ReturnType<typeof vi.fn>;
    };
    const greenSprite = {} as HTMLImageElement;

    drawEnemies(
      ctx as unknown as CanvasRenderingContext2D,
      [makeEnemyState('a', 'slimeGreen', 100, 100, { direction: 'left' })],
      greenSprite,
      null,
    );

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    expect(ctx.restore).toHaveBeenCalled();
    const call = ctx.drawImage.mock.calls[0];
    expect(call[5]).toBe(0);
    expect(call[6]).toBe(0);
  });
});

describe('drawCollectionEffects', () => {
  it('risingEffect-drawsTextPartwayToMid', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effect = tickFlightEffect(
      startFlightEffect('a', 'German', 50, 60, 400, 300, 900, 900),
      RISE_DURATION_SECONDS / 2,
    );

    drawCollectionEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.fillText).toHaveBeenCalledWith('German', expect.any(Number), expect.any(Number));
  });

  it('effectWithIcon-drawsIconInSeparateSansSerifFillTextCall', () => {
    // The custom pixel font `text` is drawn with has no emoji glyphs —
    // canvas text doesn't fall back to a system emoji font mid-string the
    // way DOM text does, so the icon must be its own fillText call in a
    // plain font, not baked into the same string/font as the text.
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn>; font: string };
    const fontsAtCall: string[] = [];
    ctx.fillText.mockImplementation(() => {
      fontsAtCall.push(ctx.font);
    });
    const effect = startFlightEffect('a', 'German', 50, 60, 400, 300, 900, 900, '🇩🇪');

    drawCollectionEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.fillText).toHaveBeenCalledTimes(2);
    expect(ctx.fillText).toHaveBeenNthCalledWith(2, '🇩🇪', expect.any(Number), expect.any(Number));
    expect(fontsAtCall[1]).toContain('sans-serif');
    // The text call's font quotes the custom pixel font family name; the
    // icon call's font doesn't reference it at all.
    expect(fontsAtCall[1]).not.toContain('"');
  });

  it('effectWithoutIcon-onlyDrawsTextOnce', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effect = startFlightEffect('a', 'German', 50, 60, 400, 300, 900, 900);

    drawCollectionEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.fillText).toHaveBeenCalledTimes(1);
  });

  it('noEffects-doesNotCallFillText', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    drawCollectionEffects(ctx as unknown as CanvasRenderingContext2D, []);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('freshEffect-drawsSixSparkleCircles', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = startFlightEffect('a', 'German', 50, 60, 400, 300, 900, 900);

    drawCollectionEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.arc).toHaveBeenCalledTimes(6);
  });

  it('sparkleExpired-doesNotDrawSparkleCircles', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = tickFlightEffect(
      startFlightEffect('a', 'German', 50, 60, 400, 300, 900, 900),
      SPARKLE_DURATION_SECONDS + 0.01,
    );

    drawCollectionEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.arc).not.toHaveBeenCalled();
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
    expect(ctx.font).toBe(`22px "${RESTART_PROMPT_FONT_FAMILY}", monospace`);
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

  it('called-withCustomStartX-offsetsAllHeartsHorizontally', () => {
    const ctx = makeMockContext();

    drawHearts(ctx, MAX_HALF_HEARTS, fakeHeartsSheet, HEARTS_START_X);

    const firstCall = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls[0];
    const secondCall = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(firstCall[5]).toBe(HEARTS_START_X); // dx
    expect(secondCall[5]).toBe(HEARTS_START_X + HEART_RENDERED_SIZE + 4); // + spacing
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
