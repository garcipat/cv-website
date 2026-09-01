import {
  drawTerrain,
  drawPlayer,
  drawHearts,
  drawCollectibles,
  drawEnemies,
  drawBlocks,
  drawChests,
  drawBonusFruits,
  drawCollectionEffects,
  drawCollectibleCounter,
  drawChestCounter,
  drawCounterPopups,
  drawIrisOverlay,
  drawRestartPrompt,
  drawSigns,
  drawSignBubble,
  drawKeyPickups,
  drawKeyCounter,
  KEY_COUNTER_X,
  KEY_COUNTER_Y,
  RESTART_PROMPT_FONT_FAMILY,
  HEARTS_START_X,
  CHEST_COUNTER_TEXT_GAP,
  CHEST_COUNTER_ICON_HEIGHT,
} from './Renderer';
import type { LevelDef } from '../level/LevelData';
import type { SignPlacement } from '../level/SignMapper';
import type { PlayerState } from '../entities/Player';
import { PLAYER_RENDERED_SIZE } from '../entities/Player';
import { MAX_HALF_HEARTS, HEART_RENDERED_SIZE } from '../entities/Health';
import { startFlightEffect, tickFlightEffect, RISE_DURATION_SECONDS, SPARKLE_DURATION_SECONDS } from './CollectionEffects';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import type { BlockPlacement } from '../level/BlockMapper';
import { toBlockState, blockFrameSource } from '../entities/Block';
import { blockBumpOffsetY, crateShatterOpacity } from './BlockAI';
import { spawnBonusFruit, bonusFruitY } from '../entities/BonusFruit';
import type { EnemyState } from '../entities/Enemy';
import { fruitFrameSource, FRUIT_FRAME_SIZE, FRUIT_RENDERED_SIZE } from '../entities/Fruit';
import {
  ENEMY_FRAME_SIZE,
  ENEMY_RENDERED_SIZE,
  ENEMY_TILE_OFFSET_X,
  ENEMY_TILE_OFFSET_Y,
} from '../entities/Enemy';
import {
  KEY_FRAME_WIDTH,
  KEY_FRAME_HEIGHT,
  KEY_RENDERED_WIDTH,
  KEY_RENDERED_HEIGHT,
  KEY_TILE_OFFSET_X,
  KEY_TILE_OFFSET_Y,
} from '../entities/KeyPickup';
import type { KeyPickupState } from '../entities/KeyPickup';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import {
  CHEST_CLOSED_WIDTH,
  CHEST_CLOSED_HEIGHT,
  CHEST_OPEN_WIDTH,
  CHEST_OPEN_HEIGHT,
  CHEST_CLOSED_RENDERED_WIDTH,
  CHEST_CLOSED_RENDERED_HEIGHT,
  CHEST_OPEN_RENDERED_WIDTH,
  CHEST_OPEN_RENDERED_HEIGHT,
  CHEST_CLOSED_OFFSET_X,
  CHEST_OPEN_OFFSET_X,
} from '../entities/Chest';
import type { ChestState } from '../entities/Chest';

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
    roundRect: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    fillRect: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    globalAlpha: 1,
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

function makeBlockPlacement(
  id: string,
  blockKind: 'crate' | 'questionMark' | 'fragileRock',
  x: number,
  y: number,
): BlockPlacement {
  return { id, blockKind, x, y };
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
    hitPoints: 1,
    hitTimer: 0,
    defeated: false,
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

describe('drawBlocks', () => {
  it('crateQuestionMarkAndRock-eachDrawnFromItsOwnTileCoords', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const states = [
      toBlockState(makeBlockPlacement('b1', 'crate', 0, 0)),
      toBlockState(makeBlockPlacement('b2', 'questionMark', 32, 0)),
      toBlockState(makeBlockPlacement('b3', 'fragileRock', 64, 0)),
    ];

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, states, fakeTileset, null);

    const calls = ctx.drawImage.mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual([fakeTileset, 112, 48, 16, 16, 0, 0, 32, 32]);
    expect(calls[1]).toEqual([fakeTileset, 0, 32, 16, 16, 32, 0, 32, 32]);
    expect(calls[2]).toEqual([fakeTileset, 48, 0, 16, 16, 64, 0, 32, 32]);
  });

  it('originXOriginY-shiftsEveryBlockByTheSameAmount', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const states = [toBlockState(makeBlockPlacement('b1', 'crate', 0, 0))];

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, states, fakeTileset, null, -50, 20);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 112, 48, 16, 16, -50, 20, 32, 32);
  });

  it('noPlacements-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [], fakeTileset, null);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawBlocks with hit state', () => {
  it('crateWithOneHitAndCrackOverlaySprite-drawsBaseTileThenCrackOverlayAtSamePosition', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const fakeCrackOverlay = { tag: 'crack' } as unknown as HTMLImageElement;
    const placement = makeBlockPlacement('c1', 'crate', 40, 60);
    const state = { ...toBlockState(placement), hitsTaken: 1 };

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [state], fakeTileset, fakeCrackOverlay);

    const calls = ctx.drawImage.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual([fakeTileset, 112, 48, 16, 16, 40, 60, 32, 32]);
    expect(calls[1]).toEqual([fakeCrackOverlay, 0, 0, 16, 16, 40, 60, 32, 32]);
  });

  it('crateWithNoHitsAndCrackOverlaySprite-drawsOnlyBaseTile', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const fakeCrackOverlay = { tag: 'crack' } as unknown as HTMLImageElement;
    const placement = makeBlockPlacement('c1', 'crate', 0, 0);
    const state = toBlockState(placement);

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [state], fakeTileset, fakeCrackOverlay);

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('crateWithOneHitAndNullCrackOverlaySprite-drawsOnlyBaseTile', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const placement = makeBlockPlacement('c1', 'crate', 0, 0);
    const state = { ...toBlockState(placement), hitsTaken: 1 };

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [state], fakeTileset, null);

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('questionMarkAfterHit-drawsFromExclamationTileSource', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const placement = makeBlockPlacement('q1', 'questionMark', 0, 0);
    const state = { ...toBlockState(placement), hitsTaken: 1 };
    const { sx, sy } = blockFrameSource('questionMark', 1);

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [state], fakeTileset, null);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, sx, sy, 16, 16, 0, 0, 32, 32);
  });

  it('bumpingBlock-offsetsDestinationYByBlockBumpOffsetY', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const placement = makeBlockPlacement('r1', 'fragileRock', 0, 100);
    const state = { ...toBlockState(placement), animState: 'bump' as const, animTimer: 0.05 };
    const expectedOffset = blockBumpOffsetY(state);
    expect(expectedOffset).not.toBe(0);

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [state], fakeTileset, null);

    const call = ctx.drawImage.mock.calls[0];
    expect(call[6]).toBe(100 + expectedOffset);
  });

  it('shatteringCrate-appliesCrateShatterOpacityAsGlobalAlphaDuringDraw', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      globalAlpha: number;
    };
    const placement = makeBlockPlacement('c1', 'crate', 0, 0);
    const state = { ...toBlockState(placement), hitsTaken: 2, animState: 'shatter' as const, animTimer: 0.1 };
    const expectedOpacity = crateShatterOpacity(state);
    expect(expectedOpacity).toBeGreaterThan(0);
    expect(expectedOpacity).toBeLessThan(1);

    const alphaAtDrawCalls: number[] = [];
    ctx.drawImage.mockImplementation(() => {
      alphaAtDrawCalls.push(ctx.globalAlpha);
    });

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [state], fakeTileset, null);

    expect(alphaAtDrawCalls[0]).toBeCloseTo(expectedOpacity);
    // Restored to fully opaque afterward so it doesn't bleed into later draws.
    expect(ctx.globalAlpha).toBe(1);
  });
});

describe('drawChests', () => {
  it('closedChest-drawsFromClosedSprite-atNativeSize', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const closedSprite = {} as HTMLImageElement;
    const chest: ChestState = {
      id: 'c1',
      x: 10,
      y: 20,
      state: 'closed',
      fact: {
        id: 'c1',
        sectionId: 'experience',
        sectionLabel: 'Experience',
        data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
        sourceType: 'chest',
      },
    };

    drawChests(ctx as unknown as CanvasRenderingContext2D, [chest], closedSprite, null);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      closedSprite,
      0,
      0,
      CHEST_CLOSED_WIDTH,
      CHEST_CLOSED_HEIGHT,
      10 + CHEST_CLOSED_OFFSET_X,
      20,
      CHEST_CLOSED_RENDERED_WIDTH,
      CHEST_CLOSED_RENDERED_HEIGHT,
    );
  });

  it('openChest-drawsFromOpenSprite-atItsOwnNativeSize', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const openSprite = {} as HTMLImageElement;
    const chest: ChestState = {
      id: 'c1',
      x: 10,
      y: 20,
      state: 'open',
      fact: {
        id: 'c1',
        sectionId: 'experience',
        sectionLabel: 'Experience',
        data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
        sourceType: 'chest',
      },
    };

    drawChests(ctx as unknown as CanvasRenderingContext2D, [chest], null, openSprite);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      openSprite,
      0,
      0,
      CHEST_OPEN_WIDTH,
      CHEST_OPEN_HEIGHT,
      10 + CHEST_OPEN_OFFSET_X,
      20,
      CHEST_OPEN_RENDERED_WIDTH,
      CHEST_OPEN_RENDERED_HEIGHT,
    );
  });

  it('missingSpriteForCurrentState-skipsThatChest-noThrow', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const chest: ChestState = {
      id: 'c1',
      x: 10,
      y: 20,
      state: 'closed',
      fact: {
        id: 'c1',
        sectionId: 'experience',
        sectionLabel: 'Experience',
        data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
        sourceType: 'chest',
      },
    };

    expect(() => drawChests(ctx as unknown as CanvasRenderingContext2D, [chest], null, null)).not.toThrow();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawChestCounter', () => {
  it('called-drawsIconAndCollectedOverTotalText', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
      font: string;
    };
    const sprite = {} as HTMLImageElement;

    drawChestCounter(ctx as unknown as CanvasRenderingContext2D, sprite, 2, 5, 100, 50);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      sprite,
      0,
      0,
      CHEST_CLOSED_WIDTH,
      CHEST_CLOSED_HEIGHT,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
    const expectedIconWidth = (CHEST_CLOSED_WIDTH / CHEST_CLOSED_HEIGHT) * CHEST_COUNTER_ICON_HEIGHT;
    expect(ctx.fillText).toHaveBeenCalledWith(
      '2 / 5',
      100 + expectedIconWidth + CHEST_COUNTER_TEXT_GAP,
      50,
    );
  });
});

describe('drawBonusFruits', () => {
  it('someFruits-drawsFromFirstFruitIconAtCurrentRisePosition', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const fakeFruitSprite = { tag: 'fruit' } as unknown as HTMLImageElement;
    const fruit = spawnBonusFruit('bf1', 40, 100, undefined, 0);
    const { sx, sy } = fruitFrameSource(0);

    drawBonusFruits(ctx as unknown as CanvasRenderingContext2D, [fruit], fakeFruitSprite);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeFruitSprite,
      sx,
      sy,
      FRUIT_FRAME_SIZE,
      FRUIT_FRAME_SIZE,
      40,
      bonusFruitY(fruit),
      FRUIT_RENDERED_SIZE,
      FRUIT_RENDERED_SIZE,
    );
  });

  it('fruitWithNonZeroIconIndex-drawsFromThatIcon', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const fakeFruitSprite = { tag: 'fruit' } as unknown as HTMLImageElement;
    const fruit = spawnBonusFruit('bf1', 40, 100, undefined, 5);
    const { sx, sy } = fruitFrameSource(5);

    drawBonusFruits(ctx as unknown as CanvasRenderingContext2D, [fruit], fakeFruitSprite);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeFruitSprite,
      sx,
      sy,
      FRUIT_FRAME_SIZE,
      FRUIT_FRAME_SIZE,
      40,
      bonusFruitY(fruit),
      FRUIT_RENDERED_SIZE,
      FRUIT_RENDERED_SIZE,
    );
  });

  it('nullFruitSprite-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const fruit = spawnBonusFruit('bf1', 0, 100, undefined, 0);

    drawBonusFruits(ctx as unknown as CanvasRenderingContext2D, [fruit], null);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('noFruits-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const fakeFruitSprite = { tag: 'fruit' } as unknown as HTMLImageElement;

    drawBonusFruits(ctx as unknown as CanvasRenderingContext2D, [], fakeFruitSprite);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('withOrigin-shiftsEveryFruitByTheSameAmount', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const fakeFruitSprite = { tag: 'fruit' } as unknown as HTMLImageElement;
    const fruit = spawnBonusFruit('bf1', 0, 100, undefined, 0);

    drawBonusFruits(ctx as unknown as CanvasRenderingContext2D, [fruit], fakeFruitSprite, 50, 20);

    const call = ctx.drawImage.mock.calls[0];
    expect(call[5]).toBe(0 + 50);
    expect(call[6]).toBe(bonusFruitY(fruit) + 20);
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

describe('drawCounterPopups', () => {
  it('calledWithOneItem-drawsIconThenSpacedText', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };
    const icon = {} as HTMLImageElement;

    drawCounterPopups(
      ctx as unknown as CanvasRenderingContext2D,
      [{ icon, iconFrame: { sx: 0, sy: 0, size: 16 }, collected: 1, total: 4, opacity: 1 }],
      400,
      20,
    );

    expect(ctx.drawImage).toHaveBeenCalledWith(icon, 0, 0, 16, 16, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('1 / 4', expect.any(Number), 20);
  });

  it('calledWithZeroOpacityItem-skipsIt', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn>; fillText: ReturnType<typeof vi.fn> };
    const icon = {} as HTMLImageElement;

    drawCounterPopups(
      ctx as unknown as CanvasRenderingContext2D,
      [{ icon, iconFrame: { sx: 0, sy: 0, size: 16 }, collected: 1, total: 4, opacity: 0 }],
      400,
      20,
    );

    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('calledWithNoItems-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn>; fillText: ReturnType<typeof vi.fn> };

    drawCounterPopups(ctx as unknown as CanvasRenderingContext2D, [], 400, 20);

    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('calledWithTwoItems-drawsBothSideBySideAsOneCenteredGroup', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };
    const coinIcon = { tag: 'coin' } as unknown as HTMLImageElement;
    const fruitIcon = { tag: 'fruit' } as unknown as HTMLImageElement;

    drawCounterPopups(
      ctx as unknown as CanvasRenderingContext2D,
      [
        { icon: coinIcon, iconFrame: { sx: 0, sy: 0, size: 16 }, collected: 2, total: 4, opacity: 1 },
        { icon: fruitIcon, iconFrame: { sx: 0, sy: 0, size: 16 }, collected: 1, total: 2, opacity: 1 },
      ],
      400,
      20,
    );

    expect(ctx.fillText).toHaveBeenCalledWith('2 / 4', expect.any(Number), 20);
    expect(ctx.fillText).toHaveBeenCalledWith('1 / 2', expect.any(Number), 20);

    // The second item's icon must be drawn strictly to the right of the
    // first item's icon — otherwise they'd overlap instead of sitting side
    // by side.
    const coinCallX = ctx.drawImage.mock.calls.find((c: unknown[]) => c[0] === coinIcon)![5] as number;
    const fruitCallX = ctx.drawImage.mock.calls.find((c: unknown[]) => c[0] === fruitIcon)![5] as number;
    expect(fruitCallX).toBeGreaterThan(coinCallX);
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

  it('emptyTile-doesNotDraw', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['empty']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('ladderTile-notSolid-stillDraws-fromLadderSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['ladder']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 144, 48, 16, 16, 0, 0, 32, 32);
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
    climbing: false,
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

  it('climbState-withJumpSpriteSheet-drawsFromClimbRowAtHighResFrameSize', () => {
    const ctx = makeMockContext();
    const jumpSheet = {} as HTMLImageElement;
    const player: PlayerState = { ...idlePlayer, animState: 'climb', climbing: true, animFrame: 1 };

    drawPlayer(ctx, player, fakeSpriteSheet, 0, 0, jumpSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      jumpSheet,
      1 * 128,
      322,
      128,
      128,
      16,
      256,
      64,
      64,
    );
  });

  it('climbState-noJumpSpriteSheetProvided-fallsBackToPrimarySheetIdleFrame', () => {
    const ctx = makeMockContext();
    const player: PlayerState = { ...idlePlayer, animState: 'climb', climbing: true };

    drawPlayer(ctx, player, fakeSpriteSheet, 0, 0, null);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeSpriteSheet, 0, 0, 32, 32, 16, 256, 64, 64);
  });

  it('visibleFalse-skipsDrawingEntirely', () => {
    const ctx = makeMockContext();

    drawPlayer(ctx, idlePlayer, fakeSpriteSheet, 0, 0, null, false);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('visibleOmitted-defaultsToTrueAndDrawsNormally', () => {
    const ctx = makeMockContext();

    drawPlayer(ctx, idlePlayer, fakeSpriteSheet);

    expect(ctx.drawImage).toHaveBeenCalled();
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

describe('drawSigns', () => {
  it('onePlacement-drawsSignpostTileAtItsPosition', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const sign: SignPlacement = { id: 'sign-bridgeDropThrough-1-1', hintId: 'bridgeDropThrough', x: 64, y: 96 };

    drawSigns(ctx as unknown as CanvasRenderingContext2D, [sign], fakeTileset, 10, 20);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 128, 48, 16, 16, 64 + 10, 96 + 20, 32, 32);
  });

  it('noPlacements-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawSigns(ctx as unknown as CanvasRenderingContext2D, [], fakeTileset);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawSignBubble', () => {
  it('growth1-drawsBorderAndBubbleRoundRectsPlusCenteredText', () => {
    const ctx = makeMockContext() as unknown as {
      roundRect: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hold Down to drop through a bridge.', 200, 300);

    expect(ctx.roundRect).toHaveBeenCalledTimes(2); // border rounded-rect, then the inset bubble rounded-rect on top
    expect(ctx.fillText).toHaveBeenCalledWith(
      'Hold Down to drop through a bridge.',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('growthZero-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as {
      roundRect: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 0);

    expect(ctx.roundRect).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('halfGrowth-drawsABubbleRectHalfAsTallAsFullGrowth', () => {
    const ctx = makeMockContext() as unknown as { roundRect: ReturnType<typeof vi.fn> };

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 1);
    const [, , , fullHeight] = ctx.roundRect.mock.calls[1]; // index 1: the inset bubble rect, not the border rect
    ctx.roundRect.mockClear();

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 0.5);
    const [, , , halfHeight] = ctx.roundRect.mock.calls[1];

    expect(halfHeight).toBeCloseTo(fullHeight / 2);
  });

  it('everyGrowth-keepsTheBoxsBottomEdgeFixed', () => {
    // The bubble must grow UPWARD from a fixed bottom edge (where the tail
    // meets it), not scale symmetrically — this is what makes it read as
    // "rising out of" the anchor point rather than just scaling in place.
    const ctx = makeMockContext() as unknown as { roundRect: ReturnType<typeof vi.fn> };

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 1);
    const [, fullTop, , fullHeight] = ctx.roundRect.mock.calls[1];
    const fullBottom = fullTop + fullHeight;
    ctx.roundRect.mockClear();

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 0.5);
    const [, halfTop, , halfHeight] = ctx.roundRect.mock.calls[1];
    const halfBottom = halfTop + halfHeight;

    expect(halfBottom).toBeCloseTo(fullBottom);
  });

  it('halfGrowth-tailWidthStaysFullWidthUnlikeItsHeight', () => {
    // Per the plan's explicit constraint: the bubble reveals at its full
    // WIDTH immediately — only height animates. The tail's horizontal span
    // (moveTo/lineTo x deltas around anchorX in the inset triangle, the
    // second beginPath/fill pair) must be identical at growth=1 and
    // growth=0.5, unlike its height which does shrink.
    const ctx = makeMockContext() as unknown as {
      moveTo: ReturnType<typeof vi.fn>;
      lineTo: ReturnType<typeof vi.fn>;
    };

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 1);
    // moveTo index 1 and lineTo index 3 are the inset cream tail's first
    // and last points (index 0/1 lineTo belong to the border tail drawn
    // first): moveTo(anchorX - tailHalfWidth, boxBottom) ... lineTo(anchorX
    // + tailHalfWidth, boxBottom) — their x delta is the tail's base span.
    const [fullMoveX] = ctx.moveTo.mock.calls[1];
    const [fullLineX] = ctx.lineTo.mock.calls[3];
    const fullSpan = fullLineX - fullMoveX;
    ctx.moveTo.mockClear();
    ctx.lineTo.mockClear();

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 0.5);
    const [halfMoveX] = ctx.moveTo.mock.calls[1];
    const [halfLineX] = ctx.lineTo.mock.calls[3];
    const halfSpan = halfLineX - halfMoveX;

    expect(halfSpan).toBeCloseTo(fullSpan);
  });

  it('withOpacity-setsGlobalAlphaBeforeDrawing', () => {
    const ctx = makeMockContext() as unknown as { globalAlpha: number; roundRect: ReturnType<typeof vi.fn> };
    // Capture globalAlpha at the moment roundRect is called — save()/restore()
    // are no-ops in the mock, so without capturing mid-call, reading
    // ctx.globalAlpha afterward could reflect whatever restore() reset it to.
    let alphaDuringDraw: number | undefined;
    ctx.roundRect.mockImplementation(() => {
      if (alphaDuringDraw === undefined) alphaDuringDraw = ctx.globalAlpha;
    });

    drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 1, 0.4);

    expect(alphaDuringDraw).toBe(0.4);
  });

  describe('multi-line text (\\n-separated)', () => {
    it('twoLineText-callsFillTextOncePerLineWithEachLinesOwnText', () => {
      const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };

      drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Line one\nLine two', 200, 300);

      expect(ctx.fillText).toHaveBeenCalledTimes(2);
      expect(ctx.fillText).toHaveBeenCalledWith('Line one', expect.any(Number), expect.any(Number));
      expect(ctx.fillText).toHaveBeenCalledWith('Line two', expect.any(Number), expect.any(Number));
    });

    it('singleLineText-stillCallsFillTextExactlyOnce-unaffectedByTheMultiLineChange', () => {
      const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };

      drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Just one line.', 200, 300);

      expect(ctx.fillText).toHaveBeenCalledTimes(1);
      expect(ctx.fillText).toHaveBeenCalledWith('Just one line.', expect.any(Number), expect.any(Number));
    });

    it('twoLineText-boxWidthUsesTheWidestLineNotJustTheFirst', () => {
      const ctx = makeMockContext() as unknown as {
        roundRect: ReturnType<typeof vi.fn>;
        measureText: ReturnType<typeof vi.fn>;
      };
      // Second line measures wider than the first — box width must track
      // the max, not whichever line happens to come first.
      ctx.measureText.mockImplementation((text: string) => ({
        width: text === 'A short line' ? 20 : 200,
      }));

      drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'A short line\nA much much longer second line', 200, 300);

      const [, , insetBoxWidth] = ctx.roundRect.mock.calls[1]; // index 1: inset bubble rect
      // BUBBLE_PADDING_X is 10 (module-private constant in Renderer.ts) —
      // box width = widest line's measured width (200) + padding on both sides.
      expect(insetBoxWidth).toBeCloseTo(200 + 10 * 2);
    });

    it('twoLineText-boxIsTallerThanOneLineTextAtFullGrowth', () => {
      const ctx = makeMockContext() as unknown as { roundRect: ReturnType<typeof vi.fn> };

      drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi', 200, 300, 1);
      const [, , , oneLineHeight] = ctx.roundRect.mock.calls[1];
      ctx.roundRect.mockClear();

      drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Hi\nHi', 200, 300, 1);
      const [, , , twoLineHeight] = ctx.roundRect.mock.calls[1];

      expect(twoLineHeight).toBeGreaterThan(oneLineHeight);
    });

    it('twoLineText-everyGrowth-stillKeepsTheBoxsBottomEdgeFixed', () => {
      // Same fixed-bottom-edge invariant as the single-line tests above,
      // regression-checked for the multi-line (taller) box too.
      const ctx = makeMockContext() as unknown as { roundRect: ReturnType<typeof vi.fn> };

      drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Line one\nLine two', 200, 300, 1);
      const [, fullTop, , fullHeight] = ctx.roundRect.mock.calls[1];
      const fullBottom = fullTop + fullHeight;
      ctx.roundRect.mockClear();

      drawSignBubble(ctx as unknown as CanvasRenderingContext2D, 'Line one\nLine two', 200, 300, 0.5);
      const [, halfTop, , halfHeight] = ctx.roundRect.mock.calls[1];
      const halfBottom = halfTop + halfHeight;

      expect(halfBottom).toBeCloseTo(fullBottom);
    });
  });
});

describe('drawKeyPickups', () => {
  it('drawKeyPickups-uncollectedPickup-drawsKeySprite', () => {
    const ctx = makeMockContext();
    const fakeKeySprite = {} as HTMLImageElement;
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 0, y: 0, collected: false }];
    drawKeyPickups(ctx, pickups, fakeKeySprite, 0);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeKeySprite,
      0, 0, KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT,
      expect.any(Number), expect.any(Number),
      KEY_RENDERED_WIDTH, KEY_RENDERED_HEIGHT,
    );
  });

  it('drawKeyPickups-collectedPickup-doesNotDraw', () => {
    const ctx = makeMockContext();
    const fakeKeySprite = {} as HTMLImageElement;
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 0, y: 0, collected: true }];
    drawKeyPickups(ctx, pickups, fakeKeySprite, 0);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('drawKeyPickups-uncollectedPickup-fitsWithinOneTileAndIsBottomAnchored', () => {
    const ctx = makeMockContext();
    const fakeKeySprite = {} as HTMLImageElement;
    // No bob: elapsedSeconds 0 gives coinBobOffset(0) === 0, so the drawn y
    // is exactly pickup.y + KEY_TILE_OFFSET_Y with no ambient float noise.
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 100, y: 200, collected: false }];
    drawKeyPickups(ctx, pickups, fakeKeySprite, 0);
    expect(KEY_RENDERED_HEIGHT).toBe(RENDERED_TILE_SIZE);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeKeySprite,
      0,
      0,
      KEY_FRAME_WIDTH,
      KEY_FRAME_HEIGHT,
      100 + KEY_TILE_OFFSET_X,
      200 + KEY_TILE_OFFSET_Y,
      KEY_RENDERED_WIDTH,
      KEY_RENDERED_HEIGHT,
    );
  });
});

describe('drawKeyCounter', () => {
  it('drawKeyCounter-drawsIconAndCountText', () => {
    const ctx = makeMockContext();
    const fakeKeySprite = {} as HTMLImageElement;
    drawKeyCounter(ctx, fakeKeySprite, 3, KEY_COUNTER_X, KEY_COUNTER_Y);
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('3', expect.any(Number), KEY_COUNTER_Y);
  });
});
