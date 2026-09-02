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
  keyCounterX,
  KEY_COUNTER_Y,
  RESTART_PROMPT_FONT_FAMILY,
  HEARTS_START_X,
  CHEST_COUNTER_TEXT_GAP,
  CHEST_COUNTER_ICON_HEIGHT,
  drawSkyBackground,
  drawWaterForeground,
  SKY_WHITE_ROW_COUNT,
} from './Renderer';
import type { LevelDef } from '../level/LevelData';
import type { SignPlacement } from '../level/SignMapper';
import type { PlayerState } from '../entities/Player';
import { PLAYER_RENDERED_SIZE, PLAYER_HIT_REACTION_SECONDS } from '../entities/Player';
import { MAX_HALF_HEARTS, HEART_RENDERED_SIZE } from '../entities/Health';
import { startFlightEffect, tickFlightEffect, RISE_DURATION_SECONDS, SPARKLE_DURATION_SECONDS } from './CollectionEffects';
import type { CollectiblePlacement } from '../level/CollectibleMapper';
import type { BlockPlacement } from '../level/BlockMapper';
import { toBlockState, blockFrameSource } from '../entities/Block';
import type { BlockState } from '../entities/Block';
import { blockBumpOffsetY } from './BlockAI';
import { crateShatterOpacity } from '../entities/blocks/Crate';
import { spawnBonusFruit, bonusFruitY } from '../entities/BonusFruit';
import type { EnemyState } from '../entities/Enemy';
import { fruitFrameSource, FRUIT_FRAME_SIZE, FRUIT_RENDERED_SIZE } from '../entities/Fruit';
import {
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
  spawnKeyPickup,
} from '../entities/KeyPickup';
import type { KeyPickupState } from '../entities/KeyPickup';
import {
  SLIME_GREEN_SHEET,
  SLIME_PURPLE_SHEET,
  KEY_SHEET,
  COIN_SHEET,
  FRUIT_SHEET,
  WORLD_TILESET_SHEET,
  CRACK_OVERLAY_SHEET,
} from '../entities/sprites/sheets';
import type { DrawContext } from './DrawContext';

const ENEMY_FRAME_SIZE = SLIME_GREEN_SHEET.frameWidth;
import { RENDERED_TILE_SIZE, TILE_SIZE } from '../level/Terrain';
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
import { toChestState, openChest } from '../entities/Chest';
import type { ChestState } from '../entities/Chest';
import type { ChestPlacement } from '../level/ChestMapper';
import { CHEST_CLOSED_SHEET, CHEST_OPEN_SHEET } from '../entities/sprites/sheets';

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
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
}

/** The subset of CanvasRenderingContext2D drawSkyBackground's offscreen
 *  cloud-recolor canvas actually calls — see `stubOffscreenCanvas` below. */
interface MockOffscreenCtx {
  drawImage: ReturnType<typeof vi.fn>;
  getImageData: ReturnType<typeof vi.fn>;
  putImageData: ReturnType<typeof vi.fn>;
}

/**
 * Watches `document.createElement('canvas')` for the duration of one test —
 * used by drawSkyBackground's cloud-recolor tests, which create a small
 * offscreen canvas internally. Delegates to the REAL `createElement` (this
 * project's `src/test/setup.ts` already stubs every `HTMLCanvasElement`'s
 * `getContext('2d')` globally, `getImageData`/`putImageData` included — see
 * that file's own comment — so a real jsdom canvas works fine here without
 * a second, parallel fake). Optionally pre-seeds the created canvas's
 * `getImageData` return value (before production code ever calls it, by
 * warming the context eagerly right after creation — the setup.ts mock
 * caches one context object per canvas element, so this is the same object
 * production code goes on to use) for tests that need to control the
 * "source pixels" the recolor pass reads. `getCanvas()`/`getCtx()` are
 * getters (not plain values) since the canvas doesn't exist until
 * production code actually creates one. Call `restore()` in the test's own
 * cleanup to un-watch `document.createElement`.
 */
function stubOffscreenCanvas(options?: { imageData?: Uint8ClampedArray }): {
  getCanvas: () => HTMLCanvasElement;
  getCtx: () => MockOffscreenCtx;
  createElementSpy: ReturnType<typeof vi.spyOn>;
  restore: () => void;
} {
  const realCreateElement = document.createElement.bind(document);
  let canvas: HTMLCanvasElement | undefined;
  let ctx: MockOffscreenCtx | undefined;
  const createElementSpy = vi
    .spyOn(document, 'createElement')
    .mockImplementation((tag: string, opts?: ElementCreationOptions) => {
      const el = realCreateElement(tag, opts);
      if (tag === 'canvas') {
        canvas = el as HTMLCanvasElement;
        ctx = canvas.getContext('2d') as unknown as MockOffscreenCtx;
        if (options?.imageData) {
          ctx.getImageData.mockReturnValue({ data: options.imageData });
        }
      }
      return el;
    });
  return {
    getCanvas: () => canvas!,
    getCtx: () => ctx!,
    createElementSpy,
    restore: () => createElementSpy.mockRestore(),
  };
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

function makeCoinPlacement(id = 'coin-1', x = 100, y = 100): CollectiblePlacement {
  return makePlacement(id, 'coin', x, y);
}

function makeFruitPlacement(id = 'fruit-1', x = 300, y = 300): CollectiblePlacement {
  return makePlacement(id, 'fruit', x, y);
}

function makeBlockPlacement(
  id: string,
  blockKind: 'crate' | 'questionMark' | 'fragileRock',
  x: number,
  y: number,
): BlockPlacement {
  return { id, blockKind, x, y };
}

function makeChestPlacement(id = 'c1', x = 10, y = 20): ChestPlacement {
  return {
    id,
    x,
    y,
    fact: {
      id,
      sectionId: 'experience',
      sectionLabel: 'Experience',
      data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
      sourceType: 'chest',
    },
  };
}

describe('drawCollectibles', () => {
  it('coinAndFruit-drawEachFromItsOwnSprite', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const placements = [makePlacement('a', 'coin', 100, 100), makePlacement('b', 'fruit', 300, 300)];

    drawCollectibles(ctx as unknown as CanvasRenderingContext2D, placements, new Set(), dc);

    expect(drawImageCallsFor(ctx, dc.sprites[COIN_SHEET.src])).toHaveLength(1);
    expect(drawImageCallsFor(ctx, dc.sprites[FRUIT_SHEET.src])).toHaveLength(1);
  });

  it('collectedId-isSkipped', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const placements = [makePlacement('a', 'coin', 100, 100)];

    drawCollectibles(ctx as unknown as CanvasRenderingContext2D, placements, new Set(['a']), dc);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('middleFruitCollected-laterFruitKeepsSameIconAsWhenNoneCollected', () => {
    const placements = [
      makePlacement('a', 'fruit', 100, 100),
      makePlacement('b', 'fruit', 200, 200),
      makePlacement('c', 'fruit', 300, 300),
    ];

    // Baseline: render all three, nothing collected.
    const baselineCtx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const baselineDc = makeDrawContext(baselineCtx as unknown as CanvasRenderingContext2D);
    drawCollectibles(baselineCtx as unknown as CanvasRenderingContext2D, placements, new Set(), baselineDc);
    const baselineThirdCall = baselineCtx.drawImage.mock.calls.find(
      (c: unknown[]) => c[5] === 300 && c[6] === 300,
    );
    expect(baselineThirdCall).toBeDefined();
    const [, baselineSx, baselineSy] = baselineThirdCall as unknown[];

    // Now collect the middle fruit ('b') and re-render — the third fruit's
    // icon (sx/sy) must be unchanged, since it's keyed to its own stable
    // position among all fruit placements, not a counter of visible fruits.
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    drawCollectibles(ctx as unknown as CanvasRenderingContext2D, placements, new Set(['b']), dc);
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
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, {
      sprites: { [COIN_SHEET.src]: { tag: 'coin' } as unknown as HTMLImageElement },
    });
    const placements = [makePlacement('a', 'coin', 100, 100), makePlacement('b', 'fruit', 300, 300)];

    drawCollectibles(ctx as unknown as CanvasRenderingContext2D, placements, new Set(), dc);

    const calls = ctx.drawImage.mock.calls;
    expect(calls.some((c: unknown[]) => c[0] === dc.sprites[COIN_SHEET.src])).toBe(true);
    expect(calls.length).toBe(1);
  });

  it('coinSpriteNull-fruitsStillDrawAndCoinsSkipped', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, {
      sprites: { [FRUIT_SHEET.src]: { tag: 'fruit' } as unknown as HTMLImageElement },
    });
    const placements = [makePlacement('a', 'coin', 100, 100), makePlacement('b', 'fruit', 300, 300)];

    drawCollectibles(ctx as unknown as CanvasRenderingContext2D, placements, new Set(), dc);

    const calls = ctx.drawImage.mock.calls;
    expect(calls.some((c: unknown[]) => c[0] === dc.sprites[FRUIT_SHEET.src])).toBe(true);
    expect(calls.length).toBe(1);
  });
});

function makeEnemyState(
  id: string,
  type: 'slimeGreen' | 'slimePurple',
  x: number,
  y: number,
  overrides: Partial<EnemyState> = {},
): EnemyState {
  return {
    id,
    type,
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
    vy: 0,
    direction: 'right',
    animState: 'walk',
    animFrame: 0,
    animTimer: 0,
    hitPoints: 1,
    hitTimer: 0,
    spiked: false,
    spikeTimer: 0,
    alive: true,
    homeX: x,
    homeY: y,
    rewardGiven: false,
    ...overrides,
  };
}

/** Alias kept for the type-owned-rendering tests below, which think in terms
 *  of a draw context rather than raw canvas mock construction. */
function makeMockCtx() {
  return makeMockContext();
}

/** A `DrawContext` whose `sprites` map gives every sheet a DISTINCT mock
 *  image object (by identity), so `drawImageCallsFor` can tell which sheet a
 *  given `drawImage` call came from. */
function makeDrawContext(
  ctx: CanvasRenderingContext2D,
  overrides: Partial<DrawContext> = {},
): DrawContext {
  return {
    ctx,
    sprites: {
      [SLIME_GREEN_SHEET.src]: { tag: 'green' } as unknown as HTMLImageElement,
      [SLIME_PURPLE_SHEET.src]: { tag: 'purple' } as unknown as HTMLImageElement,
      [KEY_SHEET.src]: { tag: 'key' } as unknown as HTMLImageElement,
      [COIN_SHEET.src]: { tag: 'coin' } as unknown as HTMLImageElement,
      [FRUIT_SHEET.src]: { tag: 'fruit' } as unknown as HTMLImageElement,
      [WORLD_TILESET_SHEET.src]: { tag: 'worldTileset' } as unknown as HTMLImageElement,
      [CRACK_OVERLAY_SHEET.src]: { tag: 'crackOverlay' } as unknown as HTMLImageElement,
      [CHEST_CLOSED_SHEET.src]: { tag: 'chestClosed' } as unknown as HTMLImageElement,
      [CHEST_OPEN_SHEET.src]: { tag: 'chestOpen' } as unknown as HTMLImageElement,
    },
    originX: 0,
    originY: 0,
    worldElapsed: 0,
    ...overrides,
  };
}

function makeGreenEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  return makeEnemyState('green-1', 'slimeGreen', 100, 100, overrides);
}

function makePurpleEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  return makeEnemyState('purple-1', 'slimePurple', 100, 100, overrides);
}

/** Every `drawImage` call whose image argument is `sprite`, by identity. */
function drawImageCallsFor(
  ctx: { drawImage: ReturnType<typeof vi.fn> },
  sprite: HTMLImageElement | null,
): unknown[][] {
  return ctx.drawImage.mock.calls.filter((c: unknown[]) => c[0] === sprite);
}

describe('drawEnemies', () => {
  it('greenAndPurple-drawEachFromItsOwnSprite', () => {
    const ctx = makeMockCtx() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const enemies = [makeGreenEnemy({ id: 'a', x: 100, y: 100 }), makePurpleEnemy({ id: 'b', x: 300, y: 300 })];

    drawEnemies(ctx as unknown as CanvasRenderingContext2D, enemies, dc);

    expect(drawImageCallsFor(ctx, dc.sprites[SLIME_GREEN_SHEET.src])).not.toHaveLength(0);
    expect(drawImageCallsFor(ctx, dc.sprites[SLIME_PURPLE_SHEET.src])).not.toHaveLength(0);
  });

  it('missingGreenSprite-skipsGreenEnemiesButStillDrawsPurple', () => {
    const ctx = makeMockCtx() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, {
      sprites: { [SLIME_PURPLE_SHEET.src]: { tag: 'purple' } as unknown as HTMLImageElement },
    });
    const enemies = [makeGreenEnemy({ id: 'a', x: 100, y: 100 }), makePurpleEnemy({ id: 'b', x: 300, y: 300 })];

    drawEnemies(ctx as unknown as CanvasRenderingContext2D, enemies, dc);

    const calls = ctx.drawImage.mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(dc.sprites[SLIME_PURPLE_SHEET.src]);
  });

  it('facingRight-drawsAtEnemyRenderedSizeUsingItsOwnAnimFrame', () => {
    const ctx = makeMockCtx() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, {
      sprites: { [SLIME_GREEN_SHEET.src]: {} as HTMLImageElement },
    });

    drawEnemies(
      ctx as unknown as CanvasRenderingContext2D,
      [makeGreenEnemy({ id: 'a', x: 100, y: 100, animState: 'walk', animFrame: 2 })],
      dc,
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
    const ctx = makeMockCtx() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, {
      sprites: { [SLIME_GREEN_SHEET.src]: {} as HTMLImageElement },
      originX: 50,
      originY: 20,
    });

    drawEnemies(ctx as unknown as CanvasRenderingContext2D, [makeGreenEnemy({ id: 'a', x: 100, y: 100 })], dc);

    const call = ctx.drawImage.mock.calls[0];
    expect(call[5]).toBe(100 + ENEMY_TILE_OFFSET_X + 50);
    expect(call[6]).toBe(100 + ENEMY_TILE_OFFSET_Y + 20);
  });

  it('facingLeft-mirrorsViaSaveTranslateScale', () => {
    const ctx = makeMockCtx() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      save: ReturnType<typeof vi.fn>;
      translate: ReturnType<typeof vi.fn>;
      scale: ReturnType<typeof vi.fn>;
      restore: ReturnType<typeof vi.fn>;
    };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, {
      sprites: { [SLIME_GREEN_SHEET.src]: {} as HTMLImageElement },
    });

    drawEnemies(
      ctx as unknown as CanvasRenderingContext2D,
      [makeGreenEnemy({ id: 'a', x: 100, y: 100, direction: 'left' })],
      dc,
    );

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    expect(ctx.restore).toHaveBeenCalled();
    const call = ctx.drawImage.mock.calls[0];
    expect(call[5]).toBe(0);
    expect(call[6]).toBe(0);
  });

  it('purpleSlimeWithKeySprite-drawsTheKeyUnderneathTheBody', () => {
    const ctx = makeMockCtx() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);

    drawEnemies(ctx as unknown as CanvasRenderingContext2D, [makePurpleEnemy({ id: 'a', x: 100, y: 100 })], dc);

    const calls = ctx.drawImage.mock.calls;
    expect(calls.some((c: unknown[]) => c[0] === dc.sprites[KEY_SHEET.src])).toBe(true);
    // Key is drawn BEFORE the (translucent) body, so it reads as underneath.
    expect(calls.findIndex((c: unknown[]) => c[0] === dc.sprites[KEY_SHEET.src])).toBeLessThan(
      calls.findIndex((c: unknown[]) => c[0] === dc.sprites[SLIME_PURPLE_SHEET.src]),
    );
  });

  it('greenSlimeWithKeySprite-neverDrawsAKey', () => {
    const ctx = makeMockCtx() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, {
      sprites: {
        [SLIME_GREEN_SHEET.src]: { tag: 'green' } as unknown as HTMLImageElement,
        [KEY_SHEET.src]: { tag: 'key' } as unknown as HTMLImageElement,
      },
    });

    drawEnemies(ctx as unknown as CanvasRenderingContext2D, [makeGreenEnemy({ id: 'a', x: 100, y: 100 })], dc);

    expect(ctx.drawImage.mock.calls.some((c: unknown[]) => c[0] === dc.sprites[KEY_SHEET.src])).toBe(false);
  });

  it('noKeySpriteProvided-purpleSlimeDrawsWithNoKeyUnderneath', () => {
    const ctx = makeMockCtx() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, {
      sprites: { [SLIME_PURPLE_SHEET.src]: { tag: 'purple' } as unknown as HTMLImageElement },
    });

    drawEnemies(ctx as unknown as CanvasRenderingContext2D, [makePurpleEnemy({ id: 'a', x: 100, y: 100 })], dc);

    expect(ctx.drawImage.mock.calls).toHaveLength(1);
    expect(ctx.drawImage.mock.calls[0][0]).toBe(dc.sprites[SLIME_PURPLE_SHEET.src]);
  });
});

describe('drawEnemies with type-owned rendering', () => {
  it('deadEnemy-drawsNothing', () => {
    const ctx = makeMockCtx();
    const dc = makeDrawContext(ctx);
    drawEnemies(ctx, [makeGreenEnemy({ alive: false })], dc);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('greenAndPurpleTogether-drawsEachFromItsOwnSheet', () => {
    const ctx = makeMockCtx();
    const dc = makeDrawContext(ctx);
    drawEnemies(ctx, [makeGreenEnemy(), makePurpleEnemy()], dc);
    expect(drawImageCallsFor(ctx as unknown as { drawImage: ReturnType<typeof vi.fn> }, dc.sprites[SLIME_GREEN_SHEET.src])).toHaveLength(1);
    expect(drawImageCallsFor(ctx as unknown as { drawImage: ReturnType<typeof vi.fn> }, dc.sprites[SLIME_PURPLE_SHEET.src])).toHaveLength(1);
  });

  it('purpleThatAlreadyGaveItsReward-drawsNoHeldKey', () => {
    const ctx = makeMockCtx();
    const dc = makeDrawContext(ctx);
    drawEnemies(ctx, [makePurpleEnemy({ rewardGiven: true })], dc);
    expect(drawImageCallsFor(ctx as unknown as { drawImage: ReturnType<typeof vi.fn> }, dc.sprites[KEY_SHEET.src])).toHaveLength(0);
  });

  it('purpleThatHasNotGivenItsReward-drawsAHeldKey', () => {
    const ctx = makeMockCtx();
    const dc = makeDrawContext(ctx);
    drawEnemies(ctx, [makePurpleEnemy({ rewardGiven: false })], dc);
    expect(drawImageCallsFor(ctx as unknown as { drawImage: ReturnType<typeof vi.fn> }, dc.sprites[KEY_SHEET.src]).length).toBeGreaterThan(0);
  });
});

function makeBlock(
  kind: 'crate' | 'questionMark' | 'fragileRock',
  overrides: Partial<BlockState> = {},
): BlockState {
  return { ...toBlockState(makeBlockPlacement(`${kind}-1`, kind, 0, 0)), ...overrides };
}

describe('drawBlocks', () => {
  it('crateQuestionMarkAndRock-eachDrawnFromItsOwnTileCoords', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const tileset = dc.sprites[WORLD_TILESET_SHEET.src];
    const states = [
      { ...makeBlock('crate'), x: 0 },
      { ...makeBlock('questionMark'), x: 32 },
      { ...makeBlock('fragileRock'), x: 64 },
    ];

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, states, dc);

    const calls = drawImageCallsFor(ctx, tileset);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual([tileset, 112, 48, 16, 16, 0, 0, 32, 32]);
    expect(calls[1]).toEqual([tileset, 0, 32, 16, 16, 32, 0, 32, 32]);
    expect(calls[2]).toEqual([tileset, 48, 0, 16, 16, 64, 0, 32, 32]);
  });

  it('originXOriginY-shiftsEveryBlockByTheSameAmount', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, { originX: -50, originY: 20 });
    const states = [makeBlock('crate')];

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, states, dc);

    expect(ctx.drawImage).toHaveBeenCalledWith(dc.sprites[WORLD_TILESET_SHEET.src], 112, 48, 16, 16, -50, 20, 32, 32);
  });

  it('noPlacements-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [], dc);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawBlocks with hit state', () => {
  it('crateWithOneHitAndCrackOverlaySprite-drawsBaseTileThenCrackOverlayAtSamePosition', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const state = { ...makeBlock('crate', { hitsTaken: 1 }), x: 40, y: 60 };

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [state], dc);

    const calls = ctx.drawImage.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual([dc.sprites[WORLD_TILESET_SHEET.src], 112, 48, 16, 16, 40, 60, 32, 32]);
    expect(calls[1]).toEqual([dc.sprites[CRACK_OVERLAY_SHEET.src], 0, 0, 16, 16, 40, 60, 32, 32]);
  });

  it('crateWithNoHitsAndCrackOverlaySprite-drawsOnlyBaseTile', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const state = makeBlock('crate');

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [state], dc);

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('crateWithOneHitAndNullCrackOverlaySprite-drawsOnlyBaseTile', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, {
      sprites: { [WORLD_TILESET_SHEET.src]: { tag: 'worldTileset' } as unknown as HTMLImageElement },
    });
    const state = makeBlock('crate', { hitsTaken: 1 });

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [state], dc);

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('questionMarkAfterHit-drawsFromExclamationTileSource', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const state = makeBlock('questionMark', { hitsTaken: 1 });
    const { sx, sy } = blockFrameSource('questionMark', 1);

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [state], dc);

    expect(ctx.drawImage).toHaveBeenCalledWith(dc.sprites[WORLD_TILESET_SHEET.src], sx, sy, 16, 16, 0, 0, 32, 32);
  });

  it('bumpingBlock-offsetsDestinationYByBlockBumpOffsetY', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const state = { ...makeBlock('fragileRock', { animState: 'bump' as const, animTimer: 0.05 }), y: 100 };
    const expectedOffset = blockBumpOffsetY(state);
    expect(expectedOffset).not.toBe(0);

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [state], dc);

    const call = ctx.drawImage.mock.calls[0];
    expect(call[6]).toBe(100 + expectedOffset);
  });

  it('shatteringCrate-appliesCrateShatterOpacityAsGlobalAlphaDuringDraw', () => {
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      globalAlpha: number;
    };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const state = makeBlock('crate', { hitsTaken: 2, animState: 'shatter' as const, animTimer: 0.1 });
    const expectedOpacity = crateShatterOpacity(state);
    expect(expectedOpacity).toBeGreaterThan(0);
    expect(expectedOpacity).toBeLessThan(1);

    const alphaAtDrawCalls: number[] = [];
    ctx.drawImage.mockImplementation(() => {
      alphaAtDrawCalls.push(ctx.globalAlpha);
    });

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [state], dc);

    expect(alphaAtDrawCalls[0]).toBeCloseTo(expectedOpacity);
    // Restored to fully opaque afterward so it doesn't bleed into later draws.
    expect(ctx.globalAlpha).toBe(1);
  });
});

describe('block drawing delegates to the type modules', () => {
  it('everyBlockKind-drawsFromTheSharedTileset', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [makeBlock('crate'), makeBlock('questionMark'), makeBlock('fragileRock')], dc);
    expect(drawImageCallsFor(ctx, dc.sprites[WORLD_TILESET_SHEET.src])).toHaveLength(3);
  });

  it('crateOnItsFirstHit-alsoDrawsTheCrackOverlay', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [makeBlock('crate', { hitsTaken: 1 })], dc);
    expect(drawImageCallsFor(ctx, dc.sprites[CRACK_OVERLAY_SHEET.src])).toHaveLength(1);
  });

  it('intactCrate-drawsNoCrackOverlay', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [makeBlock('crate', { hitsTaken: 0 })], dc);
    expect(drawImageCallsFor(ctx, dc.sprites[CRACK_OVERLAY_SHEET.src])).toHaveLength(0);
  });

  it('missingTilesetImage-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, {
      sprites: { [WORLD_TILESET_SHEET.src]: null },
    });
    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [makeBlock('crate')], dc);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawChests', () => {
  it('closedChest-drawsFromClosedSprite-atNativeSize', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const chest: ChestState = toChestState(makeChestPlacement());

    drawChests(ctx as unknown as CanvasRenderingContext2D, [chest], dc);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      dc.sprites[CHEST_CLOSED_SHEET.src],
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
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const chest: ChestState = openChest(toChestState(makeChestPlacement()));

    drawChests(ctx as unknown as CanvasRenderingContext2D, [chest], dc);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      dc.sprites[CHEST_OPEN_SHEET.src],
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
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, {
      sprites: { [CHEST_CLOSED_SHEET.src]: null, [CHEST_OPEN_SHEET.src]: null },
    });
    const chest: ChestState = toChestState(makeChestPlacement());

    expect(() => drawChests(ctx as unknown as CanvasRenderingContext2D, [chest], dc)).not.toThrow();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('chest drawing delegates to the type module', () => {
  it('closedChest-drawsFromTheClosedSheet', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);
    drawChests(ctx, [toChestState(makeChestPlacement())], dc);
    expect(drawImageCallsFor(ctx as unknown as { drawImage: ReturnType<typeof vi.fn> }, dc.sprites[CHEST_CLOSED_SHEET.src])).toHaveLength(1);
    expect(drawImageCallsFor(ctx as unknown as { drawImage: ReturnType<typeof vi.fn> }, dc.sprites[CHEST_OPEN_SHEET.src])).toHaveLength(0);
  });

  it('openChest-drawsFromTheOpenSheet', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);
    drawChests(ctx, [openChest(toChestState(makeChestPlacement()))], dc);
    expect(drawImageCallsFor(ctx as unknown as { drawImage: ReturnType<typeof vi.fn> }, dc.sprites[CHEST_OPEN_SHEET.src])).toHaveLength(1);
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
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const fruit = spawnBonusFruit('bf1', 40, 100, undefined, 0);
    const { sx, sy } = fruitFrameSource(0);

    drawBonusFruits(ctx as unknown as CanvasRenderingContext2D, [fruit], dc);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      dc.sprites[FRUIT_SHEET.src],
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
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const fruit = spawnBonusFruit('bf1', 40, 100, undefined, 5);
    const { sx, sy } = fruitFrameSource(5);

    drawBonusFruits(ctx as unknown as CanvasRenderingContext2D, [fruit], dc);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      dc.sprites[FRUIT_SHEET.src],
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
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, { sprites: {} });
    const fruit = spawnBonusFruit('bf1', 0, 100, undefined, 0);

    drawBonusFruits(ctx as unknown as CanvasRenderingContext2D, [fruit], dc);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('noFruits-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);

    drawBonusFruits(ctx as unknown as CanvasRenderingContext2D, [], dc);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('withOrigin-shiftsEveryFruitByTheSameAmount', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, { originX: 50, originY: 20 });
    const fruit = spawnBonusFruit('bf1', 0, 100, undefined, 0);

    drawBonusFruits(ctx as unknown as CanvasRenderingContext2D, [fruit], dc);

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

    // The text itself is drawn with an outline (fillTextWithOutline: 4
    // offset fillText calls plus the final fill), so the icon — drawn after
    // it — is the LAST fillText call, not the 2nd.
    expect(ctx.fillText).toHaveBeenCalledTimes(6);
    const lastCall = ctx.fillText.mock.calls.length;
    expect(ctx.fillText).toHaveBeenNthCalledWith(lastCall, '🇩🇪', expect.any(Number), expect.any(Number));
    const iconFont = fontsAtCall[fontsAtCall.length - 1];
    expect(iconFont).toContain('sans-serif');
    // The text call's font quotes the custom pixel font family name; the
    // icon call's font doesn't reference it at all.
    expect(iconFont).not.toContain('"');
  });

  it('effectWithoutIcon-drawsOutlinedTextOnly', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effect = startFlightEffect('a', 'German', 50, 60, 400, 300, 900, 900);

    drawCollectionEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    // 4 outline offsets + 1 final fill, all for 'German' — no icon call.
    expect(ctx.fillText).toHaveBeenCalledTimes(5);
    ctx.fillText.mock.calls.forEach((call) => expect(call[0]).toBe('German'));
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
    direction: 'right',
    grounded: true,
    climbing: false,
    isDroppingThroughBridge: false,
    lastGroundedX: 16,
    lastGroundedY: 256,
    animTimer: 0,
    animState: 'idle',
    animFrame: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    hitBlockIds: [],
    hitPoints: 6,
    alive: true,
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
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
    const player: PlayerState = { ...idlePlayer, direction: 'left' };

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
    const player: PlayerState = { ...idlePlayer, direction: 'left' };

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
      direction: 'left',
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
    const dc = makeDrawContext(ctx);
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 0, y: 0, collected: false }];
    drawKeyPickups(ctx, pickups, dc);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      dc.sprites[KEY_SHEET.src],
      0, 0, KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT,
      expect.any(Number), expect.any(Number),
      KEY_RENDERED_WIDTH, KEY_RENDERED_HEIGHT,
    );
  });

  it('drawKeyPickups-collectedPickup-doesNotDraw', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 0, y: 0, collected: true }];
    drawKeyPickups(ctx, pickups, dc);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('drawKeyPickups-uncollectedPickup-fitsWithinOneTileAndIsBottomAnchored', () => {
    const ctx = makeMockContext();
    // No bob: worldElapsed 0 gives coinBobOffset(0) === 0, so the drawn y is
    // exactly pickup.y + KEY_TILE_OFFSET_Y with no ambient float noise.
    const dc = makeDrawContext(ctx, { worldElapsed: 0 });
    const pickups: KeyPickupState[] = [{ id: 'k1', x: 100, y: 200, collected: false }];
    drawKeyPickups(ctx, pickups, dc);
    expect(KEY_RENDERED_HEIGHT).toBe(RENDERED_TILE_SIZE);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      dc.sprites[KEY_SHEET.src],
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

describe('pickup drawing delegates to the type modules', () => {
  it('coinsAndFruits-eachDrawFromTheirOwnSheet', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    drawCollectibles(
      ctx as unknown as CanvasRenderingContext2D,
      [makeCoinPlacement(), makeFruitPlacement()],
      new Set(),
      dc,
    );
    expect(drawImageCallsFor(ctx, dc.sprites[COIN_SHEET.src])).toHaveLength(1);
    expect(drawImageCallsFor(ctx, dc.sprites[FRUIT_SHEET.src])).toHaveLength(1);
  });

  it('alreadyCollectedCollectible-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const coin = makeCoinPlacement();
    drawCollectibles(ctx as unknown as CanvasRenderingContext2D, [coin], new Set([coin.id]), dc);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('collectedKeyPickup-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    drawKeyPickups(
      ctx as unknown as CanvasRenderingContext2D,
      [{ ...spawnKeyPickup('k', 100, 200), collected: true }],
      dc,
    );
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawKeyCounter', () => {
  it('drawKeyCounter-drawsIconAndCountText', () => {
    const ctx = makeMockContext();
    const fakeKeySprite = {} as HTMLImageElement;
    drawKeyCounter(ctx, fakeKeySprite, 3, keyCounterX(ctx, 0, 0), KEY_COUNTER_Y);
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith('3', expect.any(Number), KEY_COUNTER_Y);
  });
});

describe('drawEnemies spike overlay', () => {
  it('spikedEnemy-drawsFourTrianglesWithOutlineStroke', () => {
    const ctx = makeMockCtx();
    const dc = makeDrawContext(ctx);
    const enemy = makePurpleEnemy({ id: 'e1', x: 0, y: 0, spiked: true, spikeTimer: 0.1 });
    drawEnemies(ctx, [enemy], dc);
    // 2 top spikes + 2 side spikes = 4 triangles, one fill + one stroke each.
    expect(ctx.fill).toHaveBeenCalledTimes(4);
    expect(ctx.stroke).toHaveBeenCalledTimes(4);
    expect(ctx.moveTo).toHaveBeenCalled();
  });

  it('nonSpikedEnemy-drawsNothing', () => {
    const ctx = makeMockCtx();
    const dc = makeDrawContext(ctx);
    const enemy = makePurpleEnemy({ id: 'e1', x: 0, y: 0, spiked: false, spikeTimer: 0 });
    drawEnemies(ctx, [enemy], dc);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('mixedSpikedAndNonSpikedEnemies-onlyDrawsForTheSpikedOne', () => {
    const ctx = makeMockCtx();
    const dc = makeDrawContext(ctx);
    const spiked = makePurpleEnemy({ id: 'a', x: 0, y: 0, spiked: true, spikeTimer: 0.1 });
    const notSpiked = makeGreenEnemy({ id: 'b', x: 100, y: 0, spiked: false, spikeTimer: 0 });
    drawEnemies(ctx, [spiked, notSpiked], dc);
    // Still exactly 4 triangles total — the non-spiked enemy contributes none,
    // proving the per-enemy skip doesn't short-circuit the whole array.
    expect(ctx.fill).toHaveBeenCalledTimes(4);
  });

  it('spikeTimerJustStarted-tipCollapsesOntoBase', () => {
    const ctx = makeMockCtx() as unknown as { lineTo: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    // spikeTimer 0 is the instant spikes appear — spikeGrowthScale(0) is 0,
    // so every triangle's tip vertex collapses onto its base-edge y
    // (zero-length spike) rather than poking out immediately at full size.
    const enemy = makePurpleEnemy({ id: 'e1', x: 0, y: 0, spiked: true, spikeTimer: 0 });
    drawEnemies(ctx as unknown as CanvasRenderingContext2D, [enemy], dc);

    const baseEdgeY = ctx.lineTo.mock.calls[0][1]; // (baseX + halfWidth, baseY)
    const tipY = ctx.lineTo.mock.calls[1][1]; // (baseX, baseY - length)
    expect(tipY).toBe(baseEdgeY);
  });

  it('differentSpikeTimers-growsThenShrinksSpikeSizeOverTheCooldown', () => {
    const ctxEarly = makeMockCtx() as unknown as { lineTo: ReturnType<typeof vi.fn> };
    const ctxMidCooldown = makeMockCtx() as unknown as { lineTo: ReturnType<typeof vi.fn> };
    const ctxLate = makeMockCtx() as unknown as { lineTo: ReturnType<typeof vi.fn> };
    const dcEarly = makeDrawContext(ctxEarly as unknown as CanvasRenderingContext2D);
    const dcMid = makeDrawContext(ctxMidCooldown as unknown as CanvasRenderingContext2D);
    const dcLate = makeDrawContext(ctxLate as unknown as CanvasRenderingContext2D);
    const early = makePurpleEnemy({ id: 'e1', x: 0, y: 0, spiked: true, spikeTimer: 0.05 });
    const midCooldown = makePurpleEnemy({ id: 'e1', x: 0, y: 0, spiked: true, spikeTimer: 0.75 });
    const late = makePurpleEnemy({ id: 'e1', x: 0, y: 0, spiked: true, spikeTimer: 1.45 });

    drawEnemies(ctxEarly as unknown as CanvasRenderingContext2D, [early], dcEarly);
    drawEnemies(ctxMidCooldown as unknown as CanvasRenderingContext2D, [midCooldown], dcMid);
    drawEnemies(ctxLate as unknown as CanvasRenderingContext2D, [late], dcLate);

    // The tip vertex is the second lineTo call for the first top spike —
    // its y-coordinate is baseY - length, so a bigger spike means a smaller
    // (more negative) y here. Mid-cooldown (near the peak of the one-shot
    // grow-then-shrink curve) should be the biggest of the three.
    const earlyTipY = ctxEarly.lineTo.mock.calls[1][1];
    const midTipY = ctxMidCooldown.lineTo.mock.calls[1][1];
    const lateTipY = ctxLate.lineTo.mock.calls[1][1];

    expect(midTipY).toBeLessThan(earlyTipY);
    expect(midTipY).toBeLessThan(lateTipY);
  });
});

describe('drawSkyBackground', () => {
  const SKY_COLOR = 'oklch(0.72 0.11 232)';

  it('oneColumn-drawsWhiteRowsThenFillsSkyColorBehindTheRecoloredCloudTileThenFillsSkyColorDownToCanvasHeight', () => {
    // Unique to this test — see sameSkyColorAcrossCalls's comment below on
    // why the module-level cloud-tile cache makes shared colors order-dependent.
    const UNIQUE_SKY_COLOR = 'oklch(0.72 0.11 232) /* oneColumn */';
    const { getCanvas, restore } = stubOffscreenCanvas();
    try {
      const ctx = makeMockContext() as unknown as {
        drawImage: ReturnType<typeof vi.fn>;
        fillRect: ReturnType<typeof vi.fn>;
        fillStyle: string;
      };
      const canvasHeight = RENDERED_TILE_SIZE * (SKY_WHITE_ROW_COUNT + 2);

      drawSkyBackground(ctx as unknown as CanvasRenderingContext2D, fakeTileset, RENDERED_TILE_SIZE, canvasHeight, UNIQUE_SKY_COLOR);

      const calls = ctx.drawImage.mock.calls;
      for (let row = 0; row < SKY_WHITE_ROW_COUNT; row++) {
        expect(calls[row]).toEqual([fakeTileset, 0, 144, 16, 16, 0, row * RENDERED_TILE_SIZE, 32, 32]);
      }
      // The cloud tile itself is no longer blitted straight from `fakeTileset`
      // (see `recoloredCloudTile`'s doc comment) — it's drawn from the
      // recolored offscreen canvas, at the offscreen canvas's own (0, 0)
      // origin rather than the tileset's SKY_CLOUD_SY source row, and at
      // CLOUD_TILE_SCALE's larger destination size, not RENDERED_TILE_SIZE.
      const cloudTileSize = RENDERED_TILE_SIZE * 1.5;
      expect(calls[SKY_WHITE_ROW_COUNT]).toEqual([
        getCanvas(),
        0,
        0,
        16,
        16,
        0,
        SKY_WHITE_ROW_COUNT * RENDERED_TILE_SIZE,
        cloudTileSize,
        cloudTileSize,
      ]);
      expect(calls).toHaveLength(SKY_WHITE_ROW_COUNT + 1);
      expect(ctx.fillStyle).toBe(UNIQUE_SKY_COLOR);
      // Filled once behind the cloud row (so the recolored tile's transparent
      // pixels show skyColor, not whatever was drawn underneath before), and
      // once more for the flat sky below the cloud row down to canvas height.
      const cloudRowY = SKY_WHITE_ROW_COUNT * RENDERED_TILE_SIZE;
      expect(ctx.fillRect).toHaveBeenCalledWith(0, cloudRowY, RENDERED_TILE_SIZE, cloudTileSize);
      const blueStartY = cloudRowY + cloudTileSize;
      expect(ctx.fillRect).toHaveBeenCalledWith(0, blueStartY, RENDERED_TILE_SIZE, canvasHeight - blueStartY);
    } finally {
      restore();
    }
  });

  it('multipleColumns-tilesWhiteRowsAtRenderedTileSizeAndCloudRowAtItsOwnLargerStride', () => {
    // The cloud tile is bigger than RENDERED_TILE_SIZE (CLOUD_TILE_SCALE), so
    // it tiles at its own stride, independent of the white rows' — this test
    // checks each band's x positions separately rather than pooling them
    // into one set, since they're no longer the same values.
    const { getCanvas, restore } = stubOffscreenCanvas();
    try {
      const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
      const canvasWidth = RENDERED_TILE_SIZE * 3;
      const canvasHeight = RENDERED_TILE_SIZE * (SKY_WHITE_ROW_COUNT + 2);

      drawSkyBackground(ctx as unknown as CanvasRenderingContext2D, fakeTileset, canvasWidth, canvasHeight, SKY_COLOR);

      const cloudCanvas = getCanvas();
      const whiteXPositions = new Set(
        ctx.drawImage.mock.calls.filter((c: unknown[]) => c[0] === fakeTileset).map((c: unknown[]) => c[5]),
      );
      expect(whiteXPositions).toEqual(new Set([0, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE * 2]));

      const cloudTileSize = RENDERED_TILE_SIZE * 1.5;
      const cloudXPositions = new Set(
        ctx.drawImage.mock.calls.filter((c: unknown[]) => c[0] === cloudCanvas).map((c: unknown[]) => c[5]),
      );
      expect(cloudXPositions).toEqual(new Set([0, cloudTileSize]));
    } finally {
      restore();
    }
  });

  it('shortCanvas-stillFillsBehindTheCloudRowButNotTheSkyBelowIt', () => {
    const { restore } = stubOffscreenCanvas();
    try {
      const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
      // Exactly tall enough for the cloud row and nothing more — the old
      // "no fillRect at all" behavior no longer applies, since the cloud
      // row itself always needs its skyColor backing fill regardless of
      // canvas height; only the sky fill BELOW the cloud row is skipped.
      const canvasHeight = RENDERED_TILE_SIZE * (SKY_WHITE_ROW_COUNT + 1);

      drawSkyBackground(ctx as unknown as CanvasRenderingContext2D, fakeTileset, RENDERED_TILE_SIZE, canvasHeight, SKY_COLOR);

      const cloudRowY = SKY_WHITE_ROW_COUNT * RENDERED_TILE_SIZE;
      const cloudTileSize = RENDERED_TILE_SIZE * 1.5;
      expect(ctx.fillRect).toHaveBeenCalledTimes(1);
      expect(ctx.fillRect).toHaveBeenCalledWith(0, cloudRowY, RENDERED_TILE_SIZE, cloudTileSize);
    } finally {
      restore();
    }
  });

  it('cloudTileSourcePixels-onlyNearWhitePixelsSurviveRecoloring', () => {
    // A 2-pixel fake source: pixel 0 near-white (should survive, alpha kept),
    // pixel 1 the tileset's own blue (should be cut to fully transparent).
    // Unique color, same reasoning as oneColumn's comment above. Seeded via
    // stubOffscreenCanvas's `imageData` option — the offscreen ctx doesn't
    // exist until drawSkyBackground creates it, so this must be provided
    // up front rather than configured on a ctx object we don't have yet.
    const UNIQUE_SKY_COLOR = 'oklch(0.72 0.11 232) /* cloudTileSourcePixels */';
    const data = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4).fill(0);
    data.set([255, 255, 255, 255], 0); // near-white pixel
    data.set([40, 90, 200, 255], 4); // the tileset's own blue
    const { getCtx, restore } = stubOffscreenCanvas({ imageData: data });
    try {
      const ctx = makeMockContext();
      drawSkyBackground(ctx, fakeTileset, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE * (SKY_WHITE_ROW_COUNT + 1), UNIQUE_SKY_COLOR);

      const putData = getCtx().putImageData.mock.calls[0][0].data as Uint8ClampedArray;
      expect(putData[3]).toBe(255); // near-white pixel's alpha untouched
      expect(putData[7]).toBe(0); // blue pixel's alpha zeroed
    } finally {
      restore();
    }
  });

  it('sameSkyColorAcrossCalls-recolorsTheCloudTileOnlyOnce', () => {
    // A skyColor literal used nowhere else in this file — the cache is
    // module-level and persists across tests, so reusing SKY_COLOR here
    // would make this assertion depend on what earlier tests already
    // cached, which is exactly what this test must NOT depend on.
    const UNIQUE_SKY_COLOR = 'oklch(0.51 0.07 111) /* sameSkyColorAcrossCalls */';
    const { createElementSpy, restore } = stubOffscreenCanvas();
    try {
      const ctx = makeMockContext();
      const canvasHeight = RENDERED_TILE_SIZE * (SKY_WHITE_ROW_COUNT + 1);

      drawSkyBackground(ctx, fakeTileset, RENDERED_TILE_SIZE, canvasHeight, UNIQUE_SKY_COLOR);
      drawSkyBackground(ctx, fakeTileset, RENDERED_TILE_SIZE, canvasHeight, UNIQUE_SKY_COLOR);

      const canvasCreations = createElementSpy.mock.calls.filter((c: unknown[]) => c[0] === 'canvas');
      expect(canvasCreations).toHaveLength(1);
    } finally {
      restore();
    }
  });

  it('differentSkyColor-recolorsTheCloudTileAgain', () => {
    // Same reasoning as above: both colors here are unique to this test.
    const FIRST_SKY_COLOR = 'oklch(0.12 0.03 20) /* differentSkyColor-a */';
    const SECOND_SKY_COLOR = 'oklch(0.34 0.09 300) /* differentSkyColor-b */';
    const { createElementSpy, restore } = stubOffscreenCanvas();
    try {
      const ctx = makeMockContext();
      const canvasHeight = RENDERED_TILE_SIZE * (SKY_WHITE_ROW_COUNT + 1);

      drawSkyBackground(ctx, fakeTileset, RENDERED_TILE_SIZE, canvasHeight, FIRST_SKY_COLOR);
      drawSkyBackground(ctx, fakeTileset, RENDERED_TILE_SIZE, canvasHeight, SECOND_SKY_COLOR);

      const canvasCreations = createElementSpy.mock.calls.filter((c: unknown[]) => c[0] === 'canvas');
      expect(canvasCreations).toHaveLength(2);
    } finally {
      restore();
    }
  });
});

describe('drawWaterForeground', () => {
  it('drawsCrestAcrossFullLevelWidthOverlappingTheLevelsBottomRow', () => {
    const level: LevelDef = { width: 2, height: 1, terrain: [['groundGrass', 'groundGrass']] };
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawWaterForeground(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, RENDERED_TILE_SIZE * 3);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 64, 144, 16, 16, 0, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 64, 144, 16, 16, 32, 16, 32, 32);
  });

  it('fillsBodyTilesBelowTheCrestDownToCanvasHeight', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawWaterForeground(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, RENDERED_TILE_SIZE * 3);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 64, 160, 16, 16, 0, 48, 32, 32);
    expect(ctx.drawImage).not.toHaveBeenCalledWith(fakeTileset, 64, 160, 16, 16, 0, 112, 32, 32);
  });

  it('cameraOrigin-shiftsWaterWithTheLevelLikeTerrain', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawWaterForeground(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, 200, 10, -20);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 64, 144, 16, 16, 10, -4, 32, 32);
  });

  it('bandScrolledFullyBelowTheViewport-drawsNothing', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawWaterForeground(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, 10, 0, 50);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
