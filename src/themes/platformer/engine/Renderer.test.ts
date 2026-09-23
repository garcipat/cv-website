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
  drawPuffEffects,
  drawCollectibleCounter,
  drawChestCounter,
  drawCounterPopups,
  drawIrisOverlay,
  drawRestartPrompt,
  drawSigns,
  drawSignBubble,
  drawKeyPickups,
  drawHeartPickups,
  drawBombPickups,
  drawPlacedBombs,
  drawExplosions,
  EXPLOSION_DRAW_SCALE,
  drawHealAuraEffects,
  drawHazards,
  drawKeyCounter,
  drawBombCounter,
  keyCounterX,
  bombCounterX,
  KEY_COUNTER_Y,
  RESTART_PROMPT_FONT_FAMILY,
  HEARTS_START_X,
  CHEST_COUNTER_TEXT_GAP,
  CHEST_COUNTER_ICON_HEIGHT,
  drawWaterForeground,
  drawBackgroundTiles,
  drawFog,
  drawHitSplatterEffects,
  drawLowHealthGlow,
  lowHealthGlowAlpha,
  LOW_HEALTH_GLOW_WIDTH_PX,
  LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS,
  drawCheckpoints,
  drawFadeOutTexts,
  drawDarkness,
  drawEnemyEyes,
  drawHeldTorch,
  heldTorchLightPosition,
} from './Renderer';
import type { LevelDef } from '../level/LevelData';
import { backgroundAtlasCell } from './BackgroundAtlas';
import { parseLevel } from '../level/LevelParser';
import type { SignPlacement } from '../level/SignMapper';
import type { PlayerState } from '../entities/Player';
import { PLAYER_RENDERED_SIZE, PLAYER_FOOT_PADDING, PLAYER_HIT_REACTION_SECONDS } from '../entities/Player';
import { MAX_HALF_HEARTS, HEART_RENDERED_SIZE } from '../entities/Health';
import { startFlightEffect, tickFlightEffect, RISE_DURATION_SECONDS, SPARKLE_DURATION_SECONDS, startPuffEffect, tickPuffEffect, startHealAuraEffect, HEAL_AURA_DURATION_SECONDS, startPlayerHitSplatter, startEnemyHitSplatter, tickHitSplatterEffect, startFadeOutTextEffect, tickFadeOutTextEffect, FADE_OUT_TEXT_DURATION_SECONDS } from './CollectionEffects';
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
import { spawnHeartPickup, HEART_PICKUP_RENDERED_SIZE, HEART_PICKUP_TILE_OFFSET_X, HEART_PICKUP_TILE_OFFSET_Y } from '../entities/HeartPickup';
import type { HeartPickupState } from '../entities/HeartPickup';
import {
  spawnBombPickup,
  BOMB_PICKUP_RENDERED_SIZE,
  BOMB_PICKUP_TILE_OFFSET_X,
  BOMB_PICKUP_TILE_OFFSET_Y,
} from '../entities/BombPickup';
import type { BombPickupState } from '../entities/BombPickup';
import {
  bombFuseFrame,
  BOMB_FUSE_SECONDS,
  BOMB_FUSE_SEQUENCE,
  BOMB_PULSE_SCALE,
} from './PlacedBomb';
import type { PlacedBombState } from './PlacedBomb';
import { frameSource } from '../entities/sprites/SpriteSheet';
import {
  startExplosionEffect,
  explosionFrameIndex,
  EXPLOSION_DURATION_SECONDS,
} from './CollectionEffects';
import {
  SLIME_GREEN_SHEET,
  SLIME_PURPLE_SHEET,
  KEY_SHEET,
  COIN_SHEET,
  FRUIT_SHEET,
  WORLD_TILESET_SHEET,
  CRACK_OVERLAY_SHEET,
  HEARTS_SHEET,
  STATIC_OBJECTS_SHEET,
  BOMB_SHEET,
  EXPLOSION_SHEET,
} from '../entities/sprites/sheets';
import { computePotRenderPlan } from '../entities/blocks/potRenderPlan';
import type { DrawContext } from './DrawContext';
import { TORCH_LIGHT_RADIUS_PX, torchPulseScale } from './Lighting';
import type { TorchLight } from './Lighting';
import {
  MAX_DARKNESS,
  PLAYER_LIGHT_RADIUS_PX,
  ENEMY_EYE_COLOR,
  ENEMY_EYE_SIZE_PX,
  ENEMY_EYE_GAP_PX,
  ENEMY_EYE_BOB_PERIOD_SECONDS,
  ENEMY_EYE_BOB_AMPLITUDE_PX,
  FOG_TINT_RGB,
  FOG_PUFF_PLATEAU,
  FOG_PUFF_RADIUS_PX,
  fogPuffAt,
} from './Lighting';

const ENEMY_FRAME_SIZE = SLIME_GREEN_SHEET.frameWidth;
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
import { toChestState, openChest } from '../entities/Chest';
import type { ChestState } from '../entities/Chest';
import type { ChestPlacement } from '../level/ChestMapper';
import { CHEST_CLOSED_SHEET, CHEST_OPEN_SHEET, SPEAR_SHEET } from '../entities/sprites/sheets';
import { spike } from '../entities/hazards/Spike';
import type { HazardPlacement } from '../level/HazardMapper';
import {
  toCheckpointState,
  activateCheckpoint,
  CHECKPOINT_FRAME_WIDTH,
  CHECKPOINT_FRAME_HEIGHT,
  CHECKPOINT_RENDERED_WIDTH,
  CHECKPOINT_RENDERED_HEIGHT,
  CHECKPOINT_RAISE_DURATION_SECONDS,
} from '../entities/Checkpoint';
import type { CheckpointState } from '../entities/Checkpoint';

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
    rotate: vi.fn(),
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
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D;
}

const fakeTileset = {} as HTMLImageElement;
const fakeGroundAtlas = {} as HTMLImageElement;

function makePlacement(id: string, spriteType: 'coin' | 'fruit', x: number, y: number): CollectiblePlacement {
  return { id, spriteType, x, y };
}

function makeCoinPlacement(id = 'coin-1', x = 100, y = 100): CollectiblePlacement {
  return makePlacement(id, 'coin', x, y);
}

function makeFruitPlacement(id = 'fruit-1', x = 300, y = 300): CollectiblePlacement {
  return makePlacement(id, 'fruit', x, y);
}

function makeBlockPlacement(
  id: string,
  blockKind: 'crate' | 'questionMark' | 'fragileRock' | 'coinPot' | 'potionPot' | 'bombPot',
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
    deathEffectGiven: false,
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
      [HEARTS_SHEET.src]: { tag: 'hearts' } as unknown as HTMLImageElement,
      [CRACK_OVERLAY_SHEET.src]: { tag: 'crackOverlay' } as unknown as HTMLImageElement,
      [CHEST_CLOSED_SHEET.src]: { tag: 'chestClosed' } as unknown as HTMLImageElement,
      [CHEST_OPEN_SHEET.src]: { tag: 'chestOpen' } as unknown as HTMLImageElement,
      [STATIC_OBJECTS_SHEET.src]: { tag: 'staticObjects' } as unknown as HTMLImageElement,
      [BOMB_SHEET.src]: { tag: 'bomb' } as unknown as HTMLImageElement,
      [EXPLOSION_SHEET.src]: { tag: 'explosion' } as unknown as HTMLImageElement,
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

  it('keySpriteLoadedBeforeBodySprite-purpleSlimeDrawsNoFloatingKey', () => {
    // First-mount asset-load race (B-004): the key sheet can resolve before
    // the slime's own body sheet does. The overlay must not draw a key with
    // no body underneath it.
    const ctx = makeMockCtx() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, {
      sprites: { [KEY_SHEET.src]: { tag: 'key' } as unknown as HTMLImageElement },
    });

    drawEnemies(ctx as unknown as CanvasRenderingContext2D, [makePurpleEnemy({ id: 'a', x: 100, y: 100 })], dc);

    expect(ctx.drawImage.mock.calls).toHaveLength(0);
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
  kind: 'crate' | 'questionMark' | 'fragileRock' | 'coinPot' | 'potionPot' | 'bombPot',
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

describe('drawBlocks with a pot render plan', () => {
  it('mixedKindRun-ownerDrawsEachMemberAndEachFillerExactlyOnce', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const coin = { ...makeBlock('coinPot'), x: 0 };
    const potion = { ...makeBlock('potionPot'), x: RENDERED_TILE_SIZE };
    const plan = computePotRenderPlan([coin, potion]);

    drawBlocks(ctx as unknown as CanvasRenderingContext2D, [coin, potion], { ...dc, potPlan: plan });

    // Only the run's owner (the coin pot) draws: one clay base + one clay
    // filler from staticObjects.png, and the bottle once from the shared
    // tileset — no member or filler is drawn twice.
    expect(drawImageCallsFor(ctx, dc.sprites[STATIC_OBJECTS_SHEET.src])).toHaveLength(2);
    expect(drawImageCallsFor(ctx, dc.sprites[WORLD_TILESET_SHEET.src])).toHaveLength(1);
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

  it('freshEffect-drawsNoSparkleCircles-sparkleIsNowPuffOnly', () => {
    // Sparkle bursts are exclusively PuffEffect's concern now (see
    // drawPuffEffects below) — a flight effect (coin/fruit/key/enemy-fact
    // collection) shows only its flying text, never a sparkle ring.
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = startFlightEffect('a', 'German', 50, 60, 400, 300, 900, 900);

    drawCollectionEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.arc).not.toHaveBeenCalled();
  });
});

describe('drawPuffEffects', () => {
  it('freshPuff-drawsSixSparkleCircles', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = startPuffEffect('rock-1', 100, 200);

    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.arc).toHaveBeenCalledTimes(6);
  });

  it('freshPuff-neverCallsFillText', () => {
    // A puff has no text/icon at all — unlike drawCollectionEffects, there is
    // nothing here that could accidentally render an empty label.
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const effect = startPuffEffect('rock-1', 100, 200);

    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('puffAtItsOwnXY-drawsCirclesCenteredThere-not0-0', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = startPuffEffect('rock-1', 100, 200);

    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    const [cx, cy] = ctx.arc.mock.calls[0];
    expect(cx).toBeCloseTo(100, 0);
    expect(cy).toBeCloseTo(200, 0);
  });

  it('scaledPuff-drawsWiderCircleRadiusThanUnscaled', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const unscaled = startPuffEffect('a', 0, 0, 1);
    const scaled = startPuffEffect('b', 0, 0, 2);

    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, [unscaled]);
    const unscaledRadius = ctx.arc.mock.calls[0][2];
    ctx.arc.mockClear();
    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, [scaled]);
    const scaledRadius = ctx.arc.mock.calls[0][2];

    expect(scaledRadius).toBeGreaterThan(unscaledRadius);
  });

  it('expiredPuff-doesNotDrawSparkleCircles', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = tickPuffEffect(startPuffEffect('rock-1', 100, 200), SPARKLE_DURATION_SECONDS + 0.01);

    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('noPuffs-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    drawPuffEffects(ctx as unknown as CanvasRenderingContext2D, []);
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});

describe('drawHealAuraEffects', () => {
  it('freshAura-drawsGlowCircleAndSparkleCircles', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = startHealAuraEffect('h1');

    drawHealAuraEffects(ctx as unknown as CanvasRenderingContext2D, [effect], 100, 200, 32);

    // 1 glow circle + 4 sparkle circles (see CollectionEffects.ts's
    // HEAL_AURA_SPARKLE_OFFSETS).
    expect(ctx.arc).toHaveBeenCalledTimes(5);
  });

  it('freshAura-drawsOneRayRectPerHealAuraRay', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    const effect = startHealAuraEffect('h1');

    drawHealAuraEffects(ctx as unknown as CanvasRenderingContext2D, [effect], 100, 200, 32);

    // 5 rays (see CollectionEffects.ts's HEAL_AURA_RAY_COUNT).
    expect(ctx.fillRect).toHaveBeenCalledTimes(5);
  });

  it('auraAtItsAnchor-drawsGlowCircleCenteredThere-notAt0-0', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    const effect = startHealAuraEffect('h1');

    drawHealAuraEffects(ctx as unknown as CanvasRenderingContext2D, [effect], 100, 200, 32);

    const [cx, cy] = ctx.arc.mock.calls[0];
    expect(cx).toBeCloseTo(100, 0);
    expect(cy).toBeCloseTo(200, 0);
  });

  it('expiredAura-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as {
      arc: ReturnType<typeof vi.fn>;
      fillRect: ReturnType<typeof vi.fn>;
    };
    const effect = { id: 'h1', elapsed: HEAL_AURA_DURATION_SECONDS + 0.01 };

    drawHealAuraEffects(ctx as unknown as CanvasRenderingContext2D, [effect], 100, 200, 32);

    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('noAuras-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { arc: ReturnType<typeof vi.fn> };
    drawHealAuraEffects(ctx as unknown as CanvasRenderingContext2D, [], 100, 200, 32);
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});

describe('drawHitSplatterEffects', () => {
  it('freshEffect-drawsOneFillRectPerDroplet', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    const effect = startPlayerHitSplatter('p', 100, 200, 1);

    drawHitSplatterEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.fillRect).toHaveBeenCalledTimes(effect.dropletCount);
  });

  it('expiredEffect-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    const effect = tickHitSplatterEffect(startPlayerHitSplatter('p', 100, 200, 1), 10);

    drawHitSplatterEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('noEffects-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    drawHitSplatterEffects(ctx as unknown as CanvasRenderingContext2D, []);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('enemyEffect-usesTheEffectsOwnColorAsFillStyle', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    const setFillStyle = vi.fn();
    Object.defineProperty(ctx, 'fillStyle', { set: setFillStyle, get: () => '' });
    const effect = startEnemyHitSplatter('e', 10, 20, 'slimePurple');

    drawHitSplatterEffects(ctx as unknown as CanvasRenderingContext2D, [effect]);

    expect(setFillStyle).toHaveBeenCalledWith(effect.color);
  });
});

describe('lowHealthGlowAlpha', () => {
  it('atPulsePeak-returnsBasePlusFullPulse', () => {
    const peakT = LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS / 4; // sin(2π·0.25) = 1
    expect(lowHealthGlowAlpha(peakT)).toBeCloseTo(0.25 + 0.45);
  });

  it('atPulseTrough-returnsBaseAlphaOnly', () => {
    const troughT = (LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS * 3) / 4; // sin(2π·0.75) = -1
    expect(lowHealthGlowAlpha(troughT)).toBeCloseTo(0.25);
  });
});

describe('drawLowHealthGlow', () => {
  it('anyElapsed-drawsFourEdgeFillRects', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    drawLowHealthGlow(ctx as unknown as CanvasRenderingContext2D, 800, 600, 0);
    expect(ctx.fillRect).toHaveBeenCalledTimes(4);
  });

  it('anyElapsed-callsCreateLinearGradientFourTimes', () => {
    const ctx = makeMockContext() as unknown as { createLinearGradient: ReturnType<typeof vi.fn> };
    drawLowHealthGlow(ctx as unknown as CanvasRenderingContext2D, 800, 600, 0);
    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(4);
  });

  it('canvasSize-edgeRectsSpanTheFullWidthOrHeight', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    drawLowHealthGlow(ctx as unknown as CanvasRenderingContext2D, 800, 600, 0);
    const calls = ctx.fillRect.mock.calls as number[][];
    // Left/right edges: height 600. Top/bottom edges: width 800.
    expect(calls.some(([, , w, h]) => w === LOW_HEALTH_GLOW_WIDTH_PX && h === 600)).toBe(true);
    expect(calls.some(([, , w, h]) => w === 800 && h === LOW_HEALTH_GLOW_WIDTH_PX)).toBe(true);
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
  it('patrolTile-drawsNothing-soThePatrolBoundaryStaysInvisibleInGame', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['patrol']] };
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('groundGrassIsolatedTile-draws-fromAllSidesClosedCellC0R0HalfTurned', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      rotate: ReturnType<typeof vi.fn>;
      translate: ReturnType<typeof vi.fn>;
    };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas);

    // No neighbours -> mask 0: every edge is bordered, which only c0r0 does.
    // It is half-turned so its bright end lands in the strip below the grass,
    // and a rotated cell is drawn through a transform centred on the cell, so
    // the destination is -16,-16 rather than the cell's top-left.
    expect(ctx.translate).toHaveBeenCalledWith(16, 16);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      1, fakeGroundAtlas, 0, 0, 16, 16, -16, -16, 32, 32,
    );
  });

  it('groundGrassTopOfTwoTallColumn-draws-fromBrightColumnTopCellC6R0', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    // Down neighbour only -> closed T L R -> c6r0 at 6*19 = 114.
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      1, fakeGroundAtlas, 114, 0, 16, 16, 0, 0, 32, 32,
    );
  });

  it('groundGrassBottomOfTwoTallColumn-draws-fromDarkColumnBottomCellC0R2', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    // Up neighbour only -> closed B L R -> c0r2 at sx 0, sy 2*19 = 38, drawn
    // into the second row. Asserted in full rather than by filtering on sy,
    // because the grass row shares sy = 38.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeGroundAtlas, 0, 38, 16, 16, 0, 32, 32, 32,
    );
  });

  it('groundGrassBuriedInterior-draws-fromDarkInteriorCellC5R1', () => {
    const level: LevelDef = {
      width: 3,
      height: 3,
      terrain: [
        ['groundGrass', 'groundGrass', 'groundGrass'],
        ['groundGrass', 'groundGrass', 'groundGrass'],
        ['groundGrass', 'groundGrass', 'groundGrass'],
      ],
    };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    // The centre cell has all four neighbours -> c5r1 at 5*19, 1*19.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeGroundAtlas, 95, 19, 16, 16, 32, 32, 32, 32,
    );
  });

  it('groundGrassLeftEdgeOfTallMass-rotatesTheBottomEdgeTile', () => {
    const level: LevelDef = {
      width: 2,
      height: 3,
      terrain: [
        ['groundGrass', 'groundGrass'],
        ['groundGrass', 'groundGrass'],
        ['groundGrass', 'groundGrass'],
      ],
    };
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      rotate: ReturnType<typeof vi.fn>;
      translate: ReturnType<typeof vi.fn>;
    };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas);

    // Cell (0,1): up, down and right are ground -> closed L only -> the
    // bottom-edge tile c1r1 turned a quarter-turn clockwise, so it is drawn
    // through a rotated transform centred on the cell rather than at its
    // top-left corner.
    // Cell (0,1): destX 0 + half 16, destY 32 + half 16.
    expect(ctx.translate).toHaveBeenCalledWith(16, 48);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeGroundAtlas, 19, 19, 16, 16, -16, -16, 32, 32,
    );
  });

  it('nonGroundGrassTiles-stillDrawFromTheWorldTileset', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['wall']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 128, 0, 16, 16, 0, 0, 32, 32);
  });

  it('groundRockTopExposed-draws-fromRockTopSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundRock']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 16, 0, 16, 16, 0, 0, 32, 32);
  });

  it('wallTile-draws-fromStoneBlockSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['wall']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 128, 0, 16, 16, 0, 0, 32, 32);
  });

  it('bridgeTile-singleWithNoBridgeNeighbors-draws-fromLowSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['bridge']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 160, 32, 16, 16, 0, 0, 32, 32);
  });

  it('bridgeRun-twoTiles-drawsRampDownThenRampUp', () => {
    const level: LevelDef = { width: 2, height: 1, terrain: [['bridge', 'bridge']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeTileset, 144, 32, 16, 16, 0, 0, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeTileset, 176, 32, 16, 16, 32, 0, 32, 32);
  });

  it('bridgeRun-threeTiles-drawsRampDownLowRampUp', () => {
    const level: LevelDef = { width: 3, height: 1, terrain: [['bridge', 'bridge', 'bridge']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeTileset, 144, 32, 16, 16, 0, 0, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeTileset, 160, 32, 16, 16, 32, 0, 32, 32);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(3, fakeTileset, 176, 32, 16, 16, 64, 0, 32, 32);
  });

  it('emptyTile-doesNotDraw', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['empty']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('ladderTile-notSolid-stillDraws-fromLadderSource', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['ladder']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 144, 48, 16, 16, 0, 0, 32, 32);
  });

  it('multiTileLevel-draws-atCorrectPixelPositions', () => {
    const level: LevelDef = { width: 2, height: 1, terrain: [['groundGrass', 'wall']] };
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      rotate: ReturnType<typeof vi.fn>;
      translate: ReturnType<typeof vi.fn>;
    };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas);

    // The grass cell draws from the atlas (plus a grass overlay), the wall
    // from the world tileset — both at their own grid position. The wall is
    // solid, so the grass cell's right edge is open -> mask 2, a one-tile-tall
    // run's left end -> c6r0 at 6*19 = 114 turned three quarters, drawn
    // through a transform centred on the cell (destination -16,-16).
    expect(ctx.translate).toHaveBeenCalledWith(16, 16);
    expect(ctx.rotate).toHaveBeenCalledWith((3 * Math.PI) / 2);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      1, fakeGroundAtlas, 114, 0, 16, 16, -16, -16, 32, 32,
    );
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 128, 0, 16, 16, 32, 0, 32, 32);
  });

  it('originY-shiftsEveryTileVertically', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      translate: ReturnType<typeof vi.fn>;
    };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 100);

    // Mask 0 -> the half-turned c0r0, so the shift lands on the rotated
    // transform's centre (destY 100 + half 16) rather than on drawImage.
    expect(ctx.translate).toHaveBeenCalledWith(16, 116);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      1, fakeGroundAtlas, 0, 0, 16, 16, -16, -16, 32, 32,
    );
  });

  it('originX-shiftsEveryTileHorizontally', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      translate: ReturnType<typeof vi.fn>;
    };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 100);

    // Mask 0 -> the half-turned c0r0; destX 100 + half 16.
    expect(ctx.translate).toHaveBeenCalledWith(116, 16);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      1, fakeGroundAtlas, 0, 0, 16, 16, -16, -16, 32, 32,
    );
  });

  it('originY-omitted-defaultsToZero', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      translate: ReturnType<typeof vi.fn>;
    };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas);

    // Mask 0 -> the half-turned c0r0, centred on the unshifted cell.
    expect(ctx.translate).toHaveBeenCalledWith(16, 16);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      1, fakeGroundAtlas, 0, 0, 16, 16, -16, -16, 32, 32,
    );
  });

  it('draws-setsImageSmoothingEnabledFalse', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('grassPass-topExposedSingleTile-drawsSingleGrassVariantOverTheGroundTile', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext();

    drawTerrain(ctx, level, fakeTileset, fakeGroundAtlas);

    // c4r2 at 4*19 = 76, 2*19 = 38; 9px tall source, 18px tall destination.
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      2, fakeGroundAtlas, 76, 38, 16, 9, 0, 0, 32, 18,
    );
  });

  it('grassPass-threeWideRun-drawsLeftMiddleRightVariants', () => {
    const level: LevelDef = {
      width: 3,
      height: 1,
      terrain: [['groundGrass', 'groundGrass', 'groundGrass']],
    };
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas);

    const grassSx = ctx.drawImage.mock.calls
      .filter((c: unknown[]) => c[0] === fakeGroundAtlas && c[4] === 9)
      .map((c: unknown[]) => c[1] as number);
    expect(grassSx).toEqual([19, 38, 57]);
  });

  it('grassPass-buriedTile-drawsNoGrass', () => {
    const level: LevelDef = {
      width: 1,
      height: 2,
      terrain: [['groundGrass'], ['groundGrass']],
    };
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas);

    // Only the top cell is top-exposed, so exactly one grass sprite is drawn.
    const grassCalls = ctx.drawImage.mock.calls.filter(
      (c: unknown[]) => c[0] === fakeGroundAtlas && c[4] === 9,
    );
    expect(grassCalls).toHaveLength(1);
    expect(grassCalls[0][6]).toBe(0);
  });

  it('grassPass-neighbourIsRock-capsTheRunAsSingle', () => {
    const level: LevelDef = {
      width: 2,
      height: 1,
      terrain: [['groundGrass', 'groundRock']],
    };
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas);

    const grassCalls = ctx.drawImage.mock.calls.filter(
      (c: unknown[]) => c[0] === fakeGroundAtlas && c[4] === 9,
    );
    expect(grassCalls).toHaveLength(1);
    expect(grassCalls[0][1]).toBe(76); // the 'single' variant, c4r2
  });

  it('grassPass-stepUpNeighbour-capsTheRunEvenThoughItIsGround', () => {
    // The right neighbour is groundGrass but buried under more ground, so the
    // grass must cap rather than run into it.
    const level: LevelDef = {
      width: 2,
      height: 2,
      terrain: [
        ['empty', 'groundGrass'],
        ['groundGrass', 'groundGrass'],
      ],
    };
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas);

    // Cell (0,1) is top-exposed; its right neighbour (1,1) is not.
    const grassAtBottomLeft = ctx.drawImage.mock.calls.find(
      (c: unknown[]) => c[0] === fakeGroundAtlas && c[4] === 9 && c[5] === 0 && c[6] === 32,
    );
    expect(grassAtBottomLeft![1]).toBe(76); // 'single', not 'left'
  });
});

describe('drawTerrain — bush/fence', () => {
  const fakeStaticObjects = {} as HTMLImageElement;

  it('fenceTile-drawnFromStaticObjectsAtTheRightDestination', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['fence']], width: 1, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 32, 64, 16, 16,
      0, 0, 32, 32,
    );
  });

  it('loneBushTile-drawsTheOnlyRoleArtFromTheTileset', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['bush']], width: 1, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // (col:0, row:0) picks the 'only' variant at index (0*31+0*17)%4 = 0 -> sx:16, sy:48
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset, 16, 48, 16, 16,
      0, 0, 32, 32,
    );
  });

  it('twoStackedBushTiles-drawBottomAndTopRoleArtAtTheirOwnCellsFromTheTileset', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['bush'], ['bush']], width: 1, height: 2 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // row 0 (top of the level, top of the run) draws canopy art at sx:0, sy:48
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset, 0, 48, 16, 16,
      0, 0, 32, 32,
    );
    // row 1 (bottom of the run) draws root art at sx:0, sy:80
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset, 0, 80, 16, 16,
      0, 32, 32, 32,
    );
  });

  it('threeStackedBushTiles-middleTileDrawsTrunkRoleArtFromTheTileset', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['bush'], ['bush'], ['bush']], width: 1, height: 3 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // row 1 (middle of the run) draws trunk art at sx:0, sy:64
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset, 0, 64, 16, 16,
      0, 32, 32, 32,
    );
  });

  it('staticObjectsNotLoaded-fenceDrawsNothingButBushAndOtherTerrainStillRender', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['fence', 'wall', 'bush']], width: 3, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null);

    // wall (sx: 8*16=128, sy: 0) still draws from the tileset.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset, 128, 0, 16, 16,
      32, 0, 32, 32,
    );
    // bush (at col:2, row:0) draws from the tileset too — it never depended
    // on `staticObjects`. Variant index (2*31+0*17)%4 = 2 -> sx:16, sy:80.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset, 16, 80, 16, 16,
      64, 0, 32, 32,
    );
    // fence is the only tile that goes dark without staticObjects loaded.
    expect(ctx.drawImage).not.toHaveBeenCalledWith(
      fakeStaticObjects, expect.anything(), expect.anything(), expect.anything(), expect.anything(),
      0, 0, expect.anything(), expect.anything(),
    );
  });

  it('levelLayoutWithStackedNCharacters-rendersRootTrunkCanopyThroughTheFullChain', () => {
    // Spans the full chain from a raw level layout character all the way to
    // the canvas call: parseLevel's 'n' -> 'bush' terrain, then drawTerrain's
    // per-role sprite lookup -> drawImage. LevelParser.test.ts and this
    // file's other drawTerrain tests each cover one half of that chain in
    // isolation; nothing previously joined the two.
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level = parseLevel(['n', 'n', 'n']);

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // row 0: top of the run (canopy) at sx:0, sy:48
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset, 0, 48, 16, 16,
      0, 0, 32, 32,
    );
    // row 1: middle of the run (trunk) at sx:0, sy:64
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset, 0, 64, 16, 16,
      0, 32, 32, 32,
    );
    // row 2: bottom of the run (root) at sx:0, sy:80
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset, 0, 80, 16, 16,
      0, 64, 32, 32,
    );
  });

  it('chainRun-length1-ceilingAttached-drawsOnlyTheCeilingCapCenteredInItsCell', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['wall'], ['chain']], width: 1, height: 2 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // (col:0, row:1) has a solid tile above -> 'ceiling', run length 1 -> the
    // ceiling cap alone (sx:91,sy:101,5x13 native -> 10x26 rendered),
    // centered: destX = (32-10)/2 = 11. destY is the cell's own row*32=32.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 91, 101, 5, 13,
      11, 32, 10, 26,
    );
  });

  it('chainRun-length1-leftAttached-drawsOnlyTheLeftCapFlushHorizontallyButOffsetDownFromTheTop', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['wall', 'chain']], width: 2, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // (col:1, row:0): nothing above, solid to the left -> 'left', run length
    // 1 -> the left cap (sx:99,sy:102,7x12 native -> 14x24 rendered). It's
    // the run's TOP (and only) piece: no horizontal CHAIN_WALL_GAP (its own
    // art already reads as attached to the wall) — destX = col1*32 = 32 —
    // but it DOES get the vertical CHAIN_WALL_GAP (4 rendered px), since its
    // hook art has no top-side neck margin: destY = 0 + 4 = 4.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 99, 102, 7, 12,
      32, 4, 14, 24,
    );
  });

  it('chainRun-length1-rightAttached-drawsOnlyTheRightCapFlushHorizontallyButOffsetDownFromTheTop', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['chain', 'wall']], width: 2, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // (col:0, row:0): nothing above or left, solid to the right -> 'right',
    // run length 1 -> the right cap (sx:110,sy:102,7x12 native -> 14x24
    // rendered), the run's top (and only) piece — flush horizontally against
    // the RIGHT edge (destX = 0 + 32 - 14 = 18), offset down vertically
    // (destY = 0 + 4 = 4).
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 110, 102, 7, 12,
      18, 4, 14, 24,
    );
  });

  it('chainRun-length1-noSolidNeighbourAnywhere-drawsTheFloatingCapCentered', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['chain']], width: 1, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // floating cap (sx:119,sy:102,5x12 native -> 10x24 rendered), centered:
    // destX = (32-10)/2 = 11.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeStaticObjects, 119, 102, 5, 12,
      11, 0, 10, 24,
    );
  });

  it('chainRun-onlyTheTopCellDraws-noCallsOriginateFromCellsBelowIt', () => {
    // The core of the run-composition architecture: a shaft's cells below
    // the top must never independently draw anything — everything for the
    // whole run comes from the top cell's one set of drawImage calls.
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['chain'], ['chain'], ['chain']], width: 1, height: 3 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    // Composing a floating run of length 3: continues(15) + middle(18) +
    // bottom(15) = 48 > 3*16=48? No — 48 == 48 exactly, so one middle fits.
    expect(ctx.drawImage).toHaveBeenCalledTimes(3);
  });

  it('chainRun-length4-ceilingAttached-composesContinuesThenOneMiddleThenBottom-cappedNotOverflowing', () => {
    // continues(16 native, ceiling) + middle(18) + bottom(15) = 49 native px
    // <= 4*16=64 native px budget, but a second middle (49+18=67) would not
    // fit — so exactly one middle, and the composed total (49 native = 98
    // rendered) falls short of the full 128 rendered px rather than
    // overflowing into whatever is below the shaft (there's nothing below
    // here, but the cap logic must not depend on that).
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = {
      terrain: [['wall'], ['chain'], ['chain'], ['chain'], ['chain']],
      width: 1,
      height: 5,
    };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeStaticObjects, 91, 120, 5, 16, 11, 32, 10, 32);
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeStaticObjects, 128, 118, 5, 18, 11, 64, 10, 36);
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeStaticObjects, 137, 118, 5, 15, 11, 100, 10, 30);
    // wall (1 call) + the 3 chain pieces above — nothing else.
    expect(ctx.drawImage).toHaveBeenCalledTimes(4);
  });

  it('chainRun-length2-leftAttached-composesContinuesThenBottomWithNoMiddle-topFlushBottomOffset', () => {
    // continues(15, left) + middle(18) + bottom(15) = 48 > 2*16=32, so no
    // middle fits — just the two pieces. The top (continues) piece draws
    // flush horizontally against the wall like the length-1 cap, offset
    // down 4 rendered px from the cell's top; the bottom piece below it
    // gets the horizontal CHAIN_WALL_GAP offset instead (only the top
    // piece's own art has that gap built in) and simply continues where the
    // top piece's draw left off vertically.
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = {
      terrain: [
        ['wall', 'chain'],
        ['wall', 'chain'],
      ],
      width: 2,
      height: 2,
    };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, fakeStaticObjects);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeStaticObjects, 99, 121, 7, 15, 32, 4, 14, 30);
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeStaticObjects, 137, 118, 5, 15, 36, 34, 10, 30);
  });

  it('staticObjectsNotLoaded-chainDrawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['chain']], width: 1, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawTerrain — cave decorations', () => {
  const fakeDecorations = {} as HTMLImageElement;

  it('cobwebTile-cornerOrientation-drawnFromDecorationsRotatedAboutTheCellCenter', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    // The cobweb cell (col 0, row 1) has a solid neighbour above (wall) and
    // to its right (wall) — an up+right corner, so rotation 1.
    const level: LevelDef = {
      terrain: [
        ['wall', 'empty'],
        ['cobweb', 'wall'],
      ],
      width: 2,
      height: 2,
    };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, fakeDecorations);

    // up+right -> rotation 1, so the corner sprite (0,0, 16x16) is drawn
    // rotated about the cell's own center (destX+16, destY+32 at
    // RENDERED_TILE_SIZE=32).
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeDecorations, 0, 0, 16, 16,
      -16, -16, 32, 32,
    );
  });

  it('cobwebTile-flatOrientation-drawnPlainFromDecorations', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['cobweb']], width: 1, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, fakeDecorations);

    // COBWEB_FLAT_ENTRY: sx 17, sy 0, 16x17 (decorations.png's hand-spaced
    // layout — see StaticObjectsCatalog.ts).
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeDecorations, 17, 0, 16, 17,
      0, 0, 32, 32,
    );
  });

  it('stalagmiteTile-drawnFromDecorationsAtTheRightDestination', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['stalagmite']], width: 1, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, fakeDecorations);

    // (0, 0)'s position hash deterministically picks the "large" variant
    // (sx 17, sy 17, 16x18) — see StaticObjectsCatalog.test.ts for the
    // general determinism/bounds coverage of stalagmiteEntry itself.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeDecorations, 17, 17, 16, 18,
      0, 0, 32, 32,
    );
  });

  it('decorationsNotLoaded-cobwebDrawsNothingButOtherTerrainStillRenders', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['cobweb', 'wall']], width: 2, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, null);

    // wall (sx: 8*16=128, sy: 0) still draws from the tileset.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset, 128, 0, 16, 16,
      32, 0, 32, 32,
    );
    expect(ctx.drawImage).not.toHaveBeenCalledWith(
      fakeDecorations, expect.anything(), expect.anything(), expect.anything(), expect.anything(),
      0, 0, expect.anything(), expect.anything(),
    );
  });
});

describe('drawTerrain — torch', () => {
  const fakeTorch = {} as HTMLImageElement;

  it('torchTile-loaded-drawsItsFrameBottomAlignedAndCentred', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['torch']], width: 1, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, null, fakeTorch, 0);

    // (0,0) hashes to phase 0, so frame 0 (sx 0, sy 0) of torch.png draws.
    // The 12x14 frame is centred horizontally (TORCH_INSET_X=2 -> 4 rendered
    // px) and bottom-aligned ((16-14)*2 = 4 rendered px down), scaled 2x to
    // 24x28.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTorch, 0, 0, 12, 14,
      4, 4, 24, 28,
    );
  });

  it('largerWorldElapsed-advancesToTheNextFrame', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['torch']], width: 1, height: 1 };

    // 0.2s is exactly one TORCH_FRAME_DURATION_SECONDS, so (0,0) advances from
    // frame 0 to frame 1 — a 12px stride along the strip.
    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, null, fakeTorch, 0.2);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTorch, 12, 0, 12, 14,
      4, 4, 24, 28,
    );
  });

  it('torchNotLoaded-drawsNothingButOtherTerrainStillRenders', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['torch', 'wall']], width: 2, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, null, null, 0);

    // wall (sx: 8*16=128, sy: 0) still draws from the tileset.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset, 128, 0, 16, 16,
      32, 0, 32, 32,
    );
    // The unloaded torch contributes no drawImage call at all.
    expect(ctx.drawImage).not.toHaveBeenCalledWith(
      fakeTorch, expect.anything(), expect.anything(), 12, 14,
      expect.anything(), expect.anything(), expect.anything(), expect.anything(),
    );
  });
});

describe('drawTerrain — bouncy mushroom', () => {
  // Deliberately a distinct object (not a bare `{}`) so a
  // `not.toHaveBeenCalledWith(fakeMushroom, …)` assertion can't accidentally
  // match a `fakeTileset` draw — both would deep-equal `{}` otherwise.
  const fakeMushroom = { src: 'mushroom' } as unknown as HTMLImageElement;

  it('loneBouncyMushroom-drawsStemThenCapSubRects', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['bouncyMushroom']], width: 1, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, null, null, 0, fakeMushroom);

    // `only` role: sx 0, sy 0. Stem sub-rect (rows 11-15) drawn unshifted at
    // destY + 11*RENDER_SCALE = 22; cap sub-rect (rows 0-10) at destY.
    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeMushroom, 0, 11, 16, 5, 0, 22, 32, 10);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeMushroom, 0, 0, 16, 11, 0, 0, 32, 22);
  });

  it('topCellOfARun-drawsTheTopRoleCapAndConnector', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['bouncyMushroom'], ['bouncyMushroom']], width: 1, height: 2 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, null, null, 0, fakeMushroom);

    // `top` role: sx 16, sy 0.
    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeMushroom, 16, 11, 16, 5, 0, 22, 32, 10);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeMushroom, 16, 0, 16, 11, 0, 0, 32, 22);
  });

  it('activeSquash-shiftsOnlyTheCap', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['bouncyMushroom']], width: 1, height: 1 };
    const squashes = [{ col: 0, row: 0, elapsed: 0 }];

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, null, null, 0, fakeMushroom, squashes);

    // Stem stays put; the cap moves down by the full 2px dip.
    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, fakeMushroom, 0, 11, 16, 5, 0, 22, 32, 10);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, fakeMushroom, 0, 0, 16, 11, 0, 2, 32, 22);
  });

  it('middleAndBottomCellsOfARun-drawOneWholeRoleCellEach', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level = parseLevel(['§', '§', '§']);

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, null, null, 0, fakeMushroom);

    // row 0 is `top`, row 1 is `middle` (sx 48, sy 0), row 2 is `bottom`
    // (sx 48, sy 16) — both drawn as one whole cell.
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeMushroom, 48, 0, 16, 16, 0, 32, 32, 32);
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeMushroom, 48, 16, 16, 16, 0, 64, 32, 32);
  });

  it('multiCellRun-drawsTopCapConnectorInteriorStemAndBottomFoot', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level = parseLevel(['§', '§', '§']);

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, null, null, 0, fakeMushroom);

    // Top cell: cap + connector, split into stem then cap sub-rects.
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeMushroom, 16, 11, 16, 5, 0, 22, 32, 10);
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeMushroom, 16, 0, 16, 11, 0, 0, 32, 22);
    // Interior cell: the plain stem cell.
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeMushroom, 48, 0, 16, 16, 0, 32, 32, 32);
    // Bottom cell: the stem-with-foot cell.
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeMushroom, 48, 16, 16, 16, 0, 64, 32, 32);
  });

  it('loneMushroom-drawsTheCompleteOnlyCrop', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['bouncyMushroom']], width: 1, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, null, null, 0, fakeMushroom);

    // `only` role (sx 0, sy 0), split into its stem and cap sub-rects.
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeMushroom, 0, 11, 16, 5, 0, 22, 32, 10);
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeMushroom, 0, 0, 16, 11, 0, 0, 32, 22);
  });

  it('mushroomSheetNotLoaded-drawsNothingButOtherTerrainStillRenders', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['bouncyMushroom', 'wall']], width: 2, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, null, null, 0, null);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeTileset, 128, 0, 16, 16,
      32, 0, 32, 32,
    );
    expect(ctx.drawImage).not.toHaveBeenCalledWith(
      fakeMushroom, expect.anything(), expect.anything(), expect.anything(), expect.anything(),
      expect.anything(), expect.anything(), expect.anything(), expect.anything(),
    );
  });
});

describe('drawTerrain — decorative mushroom', () => {
  const fakeMushroom = { src: 'mushroom' } as unknown as HTMLImageElement;

  it('decorativeMushroom-loaded-drawsTheFixedCellAtTheTilesOwnDestination', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['decorativeMushroom']], width: 1, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, null, null, 0, fakeMushroom);

    // The small mushroom's fixed (32, 0) crop, drawn as one whole cell.
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeMushroom, 32, 0, 16, 16, 0, 0, 32, 32);
  });

  it('decorativeMushroom-mushroomSheetNotLoaded-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [['decorativeMushroom']], width: 1, height: 1 };

    drawTerrain(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, fakeGroundAtlas, 0, 0, null, null, null, 0, null);

    expect(ctx.drawImage).not.toHaveBeenCalled();
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
    prevFeetY: 256 + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING,
    animTimer: 0,
    animState: 'idle',
    animFrame: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    blockContacts: [],
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

  it('hitState-draws-fromHitTimerNotAnimFrame', () => {
    // hitTimer 0.25 lands in the 3rd HIT column (the red-tint flash, sy
    // 192) — animFrame is deliberately a different value (0) to prove the
    // sprite source comes from hitTimer, not the incrementally-advanced
    // counter (see Player.ts's hitFrameFromTimer).
    const ctx = makeMockContext();
    const player: PlayerState = { ...idlePlayer, animState: 'hit', animFrame: 0, hitTimer: 0.25 };

    drawPlayer(ctx, player, fakeSpriteSheet);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeSpriteSheet,
      64,
      192,
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

describe('drawHeartPickups', () => {
  it('someHearts-drawsTheFullHeartFrameAtItsSmallerRenderedSize', () => {
    const ctx = makeMockContext();
    // No bob: worldElapsed 0 gives coinBobOffset(0) === 0.
    const dc = makeDrawContext(ctx, { worldElapsed: 0 });
    const hearts: HeartPickupState[] = [spawnHeartPickup('h1', 100, 200)];

    drawHeartPickups(ctx, hearts, dc);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      dc.sprites[HEARTS_SHEET.src],
      0,
      0,
      HEARTS_SHEET.frameWidth,
      HEARTS_SHEET.frameHeight,
      100 + HEART_PICKUP_TILE_OFFSET_X,
      200 + HEART_PICKUP_TILE_OFFSET_Y,
      HEART_PICKUP_RENDERED_SIZE,
      HEART_PICKUP_RENDERED_SIZE,
    );
  });

  it('noHearts-drawsNothing', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);

    drawHeartPickups(ctx, [], dc);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawBombPickups', () => {
  it('someBombs-drawsTheUnlitFrameAtItsSmallerRenderedSize', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx, { worldElapsed: 0 });
    const bombs: BombPickupState[] = [spawnBombPickup('b1', 100, 200)];

    drawBombPickups(ctx, bombs, dc);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      dc.sprites[BOMB_SHEET.src],
      0,
      0,
      BOMB_SHEET.frameWidth,
      BOMB_SHEET.frameHeight,
      100 + BOMB_PICKUP_TILE_OFFSET_X,
      200 + BOMB_PICKUP_TILE_OFFSET_Y,
      BOMB_PICKUP_RENDERED_SIZE,
      BOMB_PICKUP_RENDERED_SIZE,
    );
  });

  it('noBombs-drawsNothing', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);

    drawBombPickups(ctx, [], dc);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawPlacedBombs', () => {
  const baseBomb: PlacedBombState = {
    id: 'bomb-1',
    x: 64,
    y: 32,
    vy: 0,
    col: 2,
    row: 1,
    landingRow: 1,
    fuseElapsed: 0,
    landed: true,
  };

  it('drawsTheFuseFrameForItsElapsedTime', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx, { worldElapsed: 0 });

    drawPlacedBombs(ctx, [baseBomb], dc);

    const { sx, sy } = frameSource(BOMB_SHEET, bombFuseFrame(0).frame);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      dc.sprites[BOMB_SHEET.src],
      sx,
      sy,
      BOMB_SHEET.frameWidth,
      BOMB_SHEET.frameHeight,
      expect.any(Number),
      expect.any(Number),
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
  });

  it('acrossTheWholeFuse-neverDrawsTheUnlitFrame', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, { worldElapsed: 0 });
    const unlit = frameSource(BOMB_SHEET, 0);
    const frames: number[] = [];

    for (let i = 0; i < BOMB_FUSE_SEQUENCE.length; i++) {
      const fuseElapsed = ((i + 0.5) * BOMB_FUSE_SECONDS) / BOMB_FUSE_SEQUENCE.length;
      drawPlacedBombs(ctx as unknown as CanvasRenderingContext2D, [{ ...baseBomb, fuseElapsed }], dc);
      frames.push(bombFuseFrame(fuseElapsed).frame);
    }

    expect(frames).not.toContain(0);
    for (const call of ctx.drawImage.mock.calls) {
      expect([call[1], call[2]]).not.toEqual([unlit.sx, unlit.sy]);
    }
  });

  it('theOrangeFrame-isScaledUpAboutTheTileCentre', () => {
    const ctx = makeMockContext() as unknown as {
      scale: ReturnType<typeof vi.fn>;
    };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, { worldElapsed: 0 });

    drawPlacedBombs(
      ctx as unknown as CanvasRenderingContext2D,
      [{ ...baseBomb, fuseElapsed: BOMB_FUSE_SECONDS * 0.999 }],
      dc,
    );

    expect(ctx.scale).toHaveBeenCalledWith(BOMB_PULSE_SCALE, BOMB_PULSE_SCALE);
  });

  it('aFallingBomb-isDrawnAtItsCurrentY', () => {
    const ctx = makeMockContext() as unknown as { translate: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, { worldElapsed: 0 });

    drawPlacedBombs(ctx as unknown as CanvasRenderingContext2D, [{ ...baseBomb, y: 96 }], dc);

    expect(ctx.translate).toHaveBeenCalledWith(
      64 + RENDERED_TILE_SIZE / 2,
      96 + RENDERED_TILE_SIZE / 2,
    );
  });
});

describe('drawExplosions', () => {
  it('drawsTheActiveSheetFrameAtTheEnlargedScaleCentredOnTheBlast', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx, { worldElapsed: 0 });
    const effect = startExplosionEffect('bomb-1', 80, 48);

    drawExplosions(ctx, [effect], dc);

    const { sx, sy } = frameSource(EXPLOSION_SHEET, explosionFrameIndex(effect));
    const size = EXPLOSION_SHEET.frameWidth * 2 * EXPLOSION_DRAW_SCALE;
    expect(ctx.drawImage).toHaveBeenCalledWith(
      dc.sprites[EXPLOSION_SHEET.src],
      sx,
      sy,
      EXPLOSION_SHEET.frameWidth,
      EXPLOSION_SHEET.frameHeight,
      80 - size / 2,
      48 - size / 2,
      size,
      size,
    );
  });

  it('playsEachFrameOnceInOrder', () => {
    const frames: number[] = [];
    for (let i = 0; i < EXPLOSION_SHEET.columns; i++) {
      const elapsed = ((i + 0.5) * EXPLOSION_DURATION_SECONDS) / EXPLOSION_SHEET.columns;
      frames.push(explosionFrameIndex({ ...startExplosionEffect('b', 0, 0), elapsed }));
    }
    expect(frames).toEqual(Array.from({ length: EXPLOSION_SHEET.columns }, (_, i) => i));
  });

  it('noExplosions-drawsNothing', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);

    drawExplosions(ctx, [], dc);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawBombCounter', () => {
  it('drawsTheUnlitBombIconAndTheCountWithNoDenominator', () => {
    const ctx = makeMockContext();
    const fakeBombSprite = {} as HTMLImageElement;

    drawBombCounter(ctx, fakeBombSprite, 3, bombCounterX(ctx, 0, 0, 0), KEY_COUNTER_Y);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      fakeBombSprite,
      0,
      0,
      BOMB_SHEET.frameWidth,
      BOMB_SHEET.frameHeight,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
    expect(ctx.fillText).toHaveBeenCalledWith('3', expect.any(Number), KEY_COUNTER_Y);
  });
});

describe('bombCounterX', () => {
  it('withNoKeys-landsExactlyAtTheKeyCounterX', () => {
    // The key counter is hidden at zero keys, so the bomb group must not
    // reserve a gap for it.
    const ctx = makeMockContext();
    expect(bombCounterX(ctx, 0, 0, 0)).toBe(keyCounterX(ctx, 0, 0));
  });

  it('withKeys-sitsStrictlyPastTheKeyCountersMeasuredWidth', () => {
    const ctx = makeMockContext();
    expect(bombCounterX(ctx, 0, 0, 3)).toBeGreaterThan(bombCounterX(ctx, 0, 0, 0));
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

describe('drawHazards', () => {
  it('everyHazard-callsItsTypesDrawWithItself', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);
    const drawSpy = vi.spyOn(spike, 'draw');
    const hazards: HazardPlacement[] = [{ id: 'h1', hazardType: 'spike', facing: 'up', x: 0, y: 0 }];

    drawHazards(ctx, hazards, dc);

    expect(drawSpy).toHaveBeenCalledWith(hazards[0], dc);
  });

  it('spear-drawsFromItsSheetAtItsWorldTileWithTheNativeFrameAndNoSmoothing', () => {
    const ctx = makeMockContext();
    const spearImage = { tag: 'spear' } as unknown as HTMLImageElement;
    const dc = makeDrawContext(ctx, { sprites: { [SPEAR_SHEET.src]: spearImage } });
    const hazards: HazardPlacement[] = [{ id: 's1', hazardType: 'spear', facing: 'up', x: 64, y: 32 }];

    drawHazards(ctx, hazards, dc);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      spearImage,
      0,
      0,
      32,
      32,
      64,
      32,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('spear-imageMissingFromSprites-isANoOp', () => {
    const ctx = makeMockContext();
    const dc = makeDrawContext(ctx);
    const hazards: HazardPlacement[] = [{ id: 's1', hazardType: 'spear', facing: 'up', x: 64, y: 32 }];

    drawHazards(ctx, hazards, dc);

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

describe('drawWaterForeground', () => {
  it('drawsCrestAcrossFullLevelWidthOverlappingTheLevelsBottomRow', () => {
    const level: LevelDef = { width: 2, height: 1, terrain: [['groundGrass', 'groundGrass']] };
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    // Canvas exactly as wide/tall as the level's own rendered extent (2*32
    // wide, crest sits flush with the bottom edge at 3*32 tall) — no gap on
    // either axis, so this test stays focused on the crest tiles alone.
    const canvasWidth = RENDERED_TILE_SIZE * 2;
    const canvasHeight = RENDERED_TILE_SIZE * 3;

    drawWaterForeground(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, canvasWidth, canvasHeight);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 64, 144, 16, 16, 0, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 64, 144, 16, 16, 32, 16, 32, 32);
  });

  it('crestOnly-noBodyTileIsEverDrawn', () => {
    // Water renders as a single crest tile per column — the body below it is
    // a flat fill (see the next tests), never a repeated tile.
    const level: LevelDef = { width: 1, height: 3, terrain: [['groundGrass'], ['groundGrass'], ['groundGrass']] };
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawWaterForeground(
      ctx as unknown as CanvasRenderingContext2D,
      level,
      fakeTileset,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE * 3,
    );

    // Crest still drawn, overlapping the level's last terrain row as before.
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 64, 144, 16, 16, 0, 80, 32, 32);
    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('gapBelowTheMap-fillsDownToCanvasBottomWithSolidWaterColor', () => {
    // The vertical camera is unclamped (see Camera.ts), so a spawn/descent
    // low in the map can leave the level's bottom row scrolled above the
    // canvas's own bottom edge — simulated here with a generously tall
    // canvas relative to a single-row level. Without the fill, that gap
    // would expose the parallax background layers instead of reading as
    // more water.
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillRect: ReturnType<typeof vi.fn>;
    };

    drawWaterForeground(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, 32, 200);

    // Crest bottom edge is at topY(16) + RENDERED_TILE_SIZE(32) = 48; fill
    // covers from there down to the full canvas height (200).
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 48, 32, 152);
  });

  it('canvasWiderThanTheMap-crestTilingContinuesToTheCanvasEdge', () => {
    // The horizontal camera clamps to 0 rather than scrolling past the
    // level's own edges (see Camera.ts's updateCamera), so a canvas wider
    // than the level would otherwise leave a gap past the map's right edge.
    // The crest keeps tiling across the full canvas width (not just the
    // level's own width) so the wave texture reads as continuous water
    // rather than stopping abruptly at the map's edge.
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawWaterForeground(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, 100, RENDERED_TILE_SIZE);

    // Tiles at x = 0, 32, 64, 96 (the next, 128, is past canvasWidth 100).
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 64, 144, 16, 16, 0, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 64, 144, 16, 16, 32, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 64, 144, 16, 16, 64, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 64, 144, 16, 16, 96, 16, 32, 32);
    expect(ctx.drawImage).toHaveBeenCalledTimes(4);
  });

  it('cameraOrigin-shiftsWaterWithTheLevelLikeTerrain', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };

    drawWaterForeground(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, 42, 200, 10, -20);

    expect(ctx.drawImage).toHaveBeenCalledWith(fakeTileset, 64, 144, 16, 16, 10, -4, 32, 32);
  });

  it('bandScrolledFullyBelowTheViewport-drawsNothing', () => {
    const level: LevelDef = { width: 1, height: 1, terrain: [['groundGrass']] };
    const ctx = makeMockContext() as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      fillRect: ReturnType<typeof vi.fn>;
    };

    drawWaterForeground(ctx as unknown as CanvasRenderingContext2D, level, fakeTileset, 32, 10, 0, 50);

    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

describe('drawBackgroundTiles', () => {
  it('levelWithNoBackgroundField-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [], width: 0, height: 0 };

    drawBackgroundTiles(ctx as unknown as CanvasRenderingContext2D, level, {} as HTMLImageElement);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('emptyGrid-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = { terrain: [], width: 1, height: 1, background: [[null]] };

    drawBackgroundTiles(ctx as unknown as CanvasRenderingContext2D, level, {} as HTMLImageElement);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('oneIsolatedCell-drawsItScaledToRenderedTileSizeAtItsGridPosition', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = {
      terrain: [],
      width: 3,
      height: 2,
      background: [
        [null, null, null],
        [null, 'dirt', null],
      ],
    };

    drawBackgroundTiles(ctx as unknown as CanvasRenderingContext2D, level, {} as HTMLImageElement, 0, 0);

    const isolated = backgroundAtlasCell('dirt', 0);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      isolated.sx, isolated.sy, 16, 16,
      1 * 32, 1 * 32,
      32, 32,
    );
  });

  it('originOffset-shiftsTheDestinationRect', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = {
      terrain: [],
      width: 1,
      height: 1,
      background: [['dirt']],
    };

    drawBackgroundTiles(ctx as unknown as CanvasRenderingContext2D, level, {} as HTMLImageElement, 100, -50);

    const isolated = backgroundAtlasCell('dirt', 0);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      isolated.sx, isolated.sy, 16, 16,
      100, -50,
      32, 32,
    );
  });

  it('twoAdjacentSameMaterialCells-eachDrawWithTheOpenSideBitSet', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = {
      terrain: [],
      width: 2,
      height: 1,
      background: [['dirt', 'dirt']],
    };

    drawBackgroundTiles(ctx as unknown as CanvasRenderingContext2D, level, {} as HTMLImageElement);

    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  });

  it('twoDifferentAdjacentMaterials-neitherCountsAsConnected', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = {
      terrain: [],
      width: 2,
      height: 1,
      background: [['dirt', 'charcoal']],
    };

    drawBackgroundTiles(ctx as unknown as CanvasRenderingContext2D, level, {} as HTMLImageElement);

    const isolatedDirt = backgroundAtlasCell('dirt', 0);
    const isolatedCharcoal = backgroundAtlasCell('charcoal', 0);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      1, expect.anything(), isolatedDirt.sx, isolatedDirt.sy, 16, 16, 0, 0, 32, 32,
    );
    expect(ctx.drawImage).toHaveBeenNthCalledWith(
      2, expect.anything(), isolatedCharcoal.sx, isolatedCharcoal.sy, 16, 16, 32, 0, 32, 32,
    );
  });

  it('fullyInteriorCellWithDecorationsLoaded-alsoDrawsARockOnTop', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = {
      terrain: [],
      width: 3,
      height: 3,
      background: [
        ['dirt', 'dirt', 'dirt'],
        ['dirt', 'dirt', 'dirt'],
        ['dirt', 'dirt', 'dirt'],
      ],
    };
    const decorations = {} as HTMLImageElement;

    drawBackgroundTiles(
      ctx as unknown as CanvasRenderingContext2D,
      level,
      {} as HTMLImageElement,
      0,
      0,
      decorations,
    );

    // The centre cell (1,1) is the only fully-interior (mask 15) cell — its
    // draw call is the background tile itself, then the rock on top.
    const calls = (ctx.drawImage as ReturnType<typeof vi.fn>).mock.calls;
    const rockCalls = calls.filter((call) => call[0] === decorations);
    expect(rockCalls).toHaveLength(1);
  });

  it('noDecorationsImage-neverDrawsARockEvenOnAFullyInteriorCell', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const level: LevelDef = {
      terrain: [],
      width: 3,
      height: 3,
      background: [
        ['dirt', 'dirt', 'dirt'],
        ['dirt', 'dirt', 'dirt'],
        ['dirt', 'dirt', 'dirt'],
      ],
    };

    drawBackgroundTiles(ctx as unknown as CanvasRenderingContext2D, level, {} as HTMLImageElement, 0, 0, null);

    expect(ctx.drawImage).toHaveBeenCalledTimes(9);
  });
});

describe('drawFog', () => {
  it('atOrBelowZero-drawsNothingAtAll', () => {
    const { ctx, raw } = makeLightingContext();
    const level: LevelDef = { terrain: [['empty']], width: 1, height: 1, background: [['charcoal']] };

    drawFog(ctx, level, 0);

    expect(raw.createRadialGradient).not.toHaveBeenCalled();
    expect(raw.fill).not.toHaveBeenCalled();
  });

  it('caveFamilyCell-drawsASoftPuffGradientAtTheFogAlpha', () => {
    const { ctx, raw } = makeLightingContext();
    const level: LevelDef = { terrain: [['empty']], width: 1, height: 1, background: [['charcoal']] };

    drawFog(ctx, level, 0.5, 0, 0, 0);

    const puff = fogPuffAt(0, 0, 0);
    expect(raw.createRadialGradient).toHaveBeenCalledWith(puff.x, puff.y, 0, puff.x, puff.y, puff.radius);
    const gradient = raw.createRadialGradient.mock.results[0].value;
    expect(gradient.addColorStop).toHaveBeenNthCalledWith(1, 0, `rgba(${FOG_TINT_RGB}, 0.5)`);
    expect(gradient.addColorStop).toHaveBeenNthCalledWith(2, FOG_PUFF_PLATEAU, `rgba(${FOG_TINT_RGB}, 0.5)`);
    expect(gradient.addColorStop).toHaveBeenNthCalledWith(3, 1, `rgba(${FOG_TINT_RGB}, 0)`);
    expect(raw.arc).toHaveBeenCalledWith(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
    expect(raw.fill).toHaveBeenCalledTimes(1);
  });

  it('surfaceFamilyCell-drawsNothing', () => {
    const { ctx, raw } = makeLightingContext();
    const level: LevelDef = { terrain: [['empty']], width: 1, height: 1, background: [['dirt']] };

    drawFog(ctx, level, 0.5);

    expect(raw.createRadialGradient).not.toHaveBeenCalled();
  });

  it('emptyCell-drawsNothing', () => {
    const { ctx, raw } = makeLightingContext();
    const level: LevelDef = { terrain: [['empty']], width: 1, height: 1, background: [[null]] };

    drawFog(ctx, level, 0.5);

    expect(raw.createRadialGradient).not.toHaveBeenCalled();
  });

  it('levelWithNoBackgroundField-drawsNothing', () => {
    const { ctx, raw } = makeLightingContext();
    const level: LevelDef = { terrain: [], width: 0, height: 0 };

    drawFog(ctx, level, 0.5);

    expect(raw.createRadialGradient).not.toHaveBeenCalled();
  });

  it('originOffset-shiftsThePuffCentre', () => {
    const { ctx, raw } = makeLightingContext();
    const level: LevelDef = { terrain: [['empty']], width: 1, height: 1, background: [['caveStone']] };

    drawFog(ctx, level, 0.5, 100, -50, 0);

    const puff = fogPuffAt(0, 0, 0);
    expect(raw.arc).toHaveBeenCalledWith(puff.x + 100, puff.y - 50, puff.radius, 0, Math.PI * 2);
  });

  it('mixedGrid-drawsOnlyTheCaveFamilyCells', () => {
    const { ctx, raw } = makeLightingContext();
    const level: LevelDef = {
      terrain: [['empty', 'empty', 'empty']],
      width: 3,
      height: 1,
      background: [['dirt', 'charcoal', null]],
    };

    drawFog(ctx, level, 0.5, 0, 0, 0);

    expect(raw.createRadialGradient).toHaveBeenCalledTimes(1);
    const puff = fogPuffAt(1, 0, 0);
    expect(raw.arc).toHaveBeenCalledWith(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
    expect(raw.fill).toHaveBeenCalledTimes(1);
  });

  it('twoAdjacentCaveFamilyCells-eachGetsItsOwnPuffAtItsOwnJitteredPosition', () => {
    const { ctx, raw } = makeLightingContext();
    const level: LevelDef = {
      terrain: [['empty', 'empty']],
      width: 2,
      height: 1,
      background: [['charcoal', 'charcoal']],
    };

    drawFog(ctx, level, 0.5, 0, 0, 0);

    const puffA = fogPuffAt(0, 0, 0);
    const puffB = fogPuffAt(1, 0, 0);
    // Each cell's puff is independently jittered, so two neighbouring cells
    // don't land on the exact same centre despite sharing a tile spacing.
    expect(puffA.x).not.toBe(puffB.x);
    expect(raw.createRadialGradient).toHaveBeenCalledTimes(2);
    expect(raw.arc).toHaveBeenCalledWith(puffA.x, puffA.y, puffA.radius, 0, Math.PI * 2);
    expect(raw.arc).toHaveBeenCalledWith(puffB.x, puffB.y, puffB.radius, 0, Math.PI * 2);
  });

  it('worldElapsed-breathesThePuffsRadiusOverTime', () => {
    const { ctx, raw } = makeLightingContext();
    const level: LevelDef = { terrain: [['empty']], width: 1, height: 1, background: [['charcoal']] };

    drawFog(ctx, level, 0.5, 0, 0, 1.7);

    const puff = fogPuffAt(0, 0, 1.7);
    expect(raw.arc).toHaveBeenCalledWith(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
    // The pulse genuinely varies the radius from the base constant over time.
    expect(puff.radius).not.toBe(FOG_PUFF_RADIUS_PX);
  });

  it('solidTerrainOnACaveFamilyCell-drawsNothing', () => {
    const { ctx, raw } = makeLightingContext();
    const level: LevelDef = {
      terrain: [['groundRock']],
      width: 1,
      height: 1,
      background: [['charcoal']],
    };

    drawFog(ctx, level, 0.5);

    expect(raw.createRadialGradient).not.toHaveBeenCalled();
  });

  it('mixOfSolidAndOpenCaveFamilyCells-drawsOnlyTheOpenOne', () => {
    const { ctx, raw } = makeLightingContext();
    const level: LevelDef = {
      terrain: [['wall', 'empty']],
      width: 2,
      height: 1,
      background: [['charcoal', 'charcoal']],
    };

    drawFog(ctx, level, 0.5, 0, 0, 0);

    expect(raw.createRadialGradient).toHaveBeenCalledTimes(1);
    const puff = fogPuffAt(1, 0, 0);
    expect(raw.arc).toHaveBeenCalledWith(puff.x, puff.y, puff.radius, 0, Math.PI * 2);
  });
});

function makeCheckpoint(id: string, x: number, y: number): CheckpointState {
  return toCheckpointState({ id, col: 0, row: 0, x, y });
}

describe('drawCheckpoints', () => {
  const image = {} as HTMLImageElement;

  it('dormantState-drawsTheDormantFrameBottomAnchoredAndCentredOnItsTile', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, { originX: 5, originY: 7 });

    drawCheckpoints(ctx as unknown as CanvasRenderingContext2D, [makeCheckpoint('c', 32, 64)], image, null, dc);

    expect(ctx.drawImage).toHaveBeenCalledWith(
      image,
      0,
      0,
      CHECKPOINT_FRAME_WIDTH,
      CHECKPOINT_FRAME_HEIGHT,
      32 + 5,
      64 + 7 + RENDERED_TILE_SIZE - CHECKPOINT_RENDERED_HEIGHT,
      CHECKPOINT_RENDERED_WIDTH,
      CHECKPOINT_RENDERED_HEIGHT,
    );
  });

  it('activatedState-drawsTheRaisedFrame', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, {
      worldElapsed: CHECKPOINT_RAISE_DURATION_SECONDS,
    });
    const state = activateCheckpoint(makeCheckpoint('c', 0, 0), 0);

    drawCheckpoints(ctx as unknown as CanvasRenderingContext2D, [state], image, null, dc);

    // Frame 3 -> sx 48.
    expect(ctx.drawImage).toHaveBeenCalledWith(
      image,
      48,
      0,
      CHECKPOINT_FRAME_WIDTH,
      CHECKPOINT_FRAME_HEIGHT,
      expect.any(Number),
      expect.any(Number),
      CHECKPOINT_RENDERED_WIDTH,
      CHECKPOINT_RENDERED_HEIGHT,
    );
  });

  it('activeCheckpointId-drawsTwinklesForItOnly', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const states = [makeCheckpoint('a', 0, 0), makeCheckpoint('b', 32, 0)];

    drawCheckpoints(ctx as unknown as CanvasRenderingContext2D, states, image, 'b', dc);

    // Only the active checkpoint twinkles — 3 spots, two rects each.
    expect(ctx.fillRect).toHaveBeenCalledTimes(6);
  });

  it('noActiveCheckpointId-drawsNoTwinkles', () => {
    const ctx = makeMockContext() as unknown as { fillRect: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);

    drawCheckpoints(ctx as unknown as CanvasRenderingContext2D, [makeCheckpoint('a', 0, 0)], image, null, dc);

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('missingImage-drawsNothingRatherThanThrowing', () => {
    const ctx = makeMockContext() as unknown as { drawImage: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);

    expect(() =>
      drawCheckpoints(ctx as unknown as CanvasRenderingContext2D, [makeCheckpoint('a', 0, 0)], null, null, dc),
    ).not.toThrow();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('drawFadeOutTexts', () => {
  it('drawsEachEffectsOwnTextAtItsOwnOriginShiftedPosition', () => {
    const ctx = makeMockContext() as unknown as {
      fillText: ReturnType<typeof vi.fn>;
      globalAlpha: number;
    };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D, { originX: 5, originY: 7 });
    const a = startFadeOutTextEffect('a', 100, 200, 'Checkpoint');
    const b = startFadeOutTextEffect('b', 300, 400, 'Kontrollpunkt');

    drawFadeOutTexts(ctx as unknown as CanvasRenderingContext2D, [a, b], dc);

    expect(ctx.fillText).toHaveBeenCalledWith('Checkpoint', 105, 207);
    expect(ctx.fillText).toHaveBeenCalledWith('Kontrollpunkt', 305, 407);
  });

  it('anExpiredEffect-drawsNothing', () => {
    const ctx = makeMockContext() as unknown as { fillText: ReturnType<typeof vi.fn> };
    const dc = makeDrawContext(ctx as unknown as CanvasRenderingContext2D);
    const expired = tickFadeOutTextEffect(
      startFadeOutTextEffect('a', 0, 0, 'x'),
      FADE_OUT_TEXT_DURATION_SECONDS + 1,
    );

    drawFadeOutTexts(ctx as unknown as CanvasRenderingContext2D, [expired], dc);

    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});

/**
 * Records every assignment to a string property (e.g.
 * `globalCompositeOperation`) so a test can prove the pass set it — and, when
 * it ends back at `initial`, that it restored it. The shared setup mock has no
 * such property, and a plain object field would only show the final value.
 */
function trackStringProperty(
  target: Record<string, unknown>,
  key: string,
  initial: string,
): string[] {
  const assignments: string[] = [];
  let current = initial;
  Object.defineProperty(target, key, {
    configurable: true,
    get: () => current,
    set: (value: string) => {
      current = value;
      assignments.push(value);
    },
  });
  return assignments;
}

function makeLightingContext() {
  const raw = {
    imageSmoothingEnabled: true,
    fillStyle: '',
    globalAlpha: 1,
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  const compositeOps = trackStringProperty(raw, 'globalCompositeOperation', 'source-over');
  return { ctx: raw as unknown as CanvasRenderingContext2D, raw, compositeOps };
}

function makeLightingLayer(width = 320, height = 180) {
  const layerCtx = {
    fillStyle: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
  const compositeOps = trackStringProperty(layerCtx, 'globalCompositeOperation', 'source-over');
  const layer = {
    width,
    height,
    getContext: vi.fn(() => layerCtx),
  } as unknown as HTMLCanvasElement;
  return { layer, layerCtx, compositeOps };
}

function makeTorchLight(overrides: Partial<TorchLight> = {}): TorchLight {
  return { col: 0, row: 0, x: 100, y: 100, ...overrides };
}

describe('drawDarkness', () => {
  it('atOrBelowZero-darknessDrawsNothingAtAll', () => {
    const { ctx, raw } = makeLightingContext();
    const { layer, layerCtx } = makeLightingLayer();

    drawDarkness(ctx, layer, 320, 180, 0, [], 0, 0, 0);

    expect(raw.drawImage).not.toHaveBeenCalled();
    expect(layerCtx.fillRect).not.toHaveBeenCalled();
  });

  it('aboveZero-fillsTheLayerWithBlackAtTheDarknessAlpha', () => {
    const { ctx } = makeLightingContext();
    const { layer, layerCtx } = makeLightingLayer();

    drawDarkness(ctx, layer, 320, 180, 0.5, [], 0, 0, 0);

    expect(layerCtx.fillRect).toHaveBeenCalledWith(0, 0, 320, 180);
    expect(layerCtx.fillStyle).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('aboveZero-compositesTheLayerOntoTheMainContextWithSourceOver', () => {
    const { ctx, raw } = makeLightingContext();
    const { layer, layerCtx, compositeOps } = makeLightingLayer();

    drawDarkness(ctx, layer, 320, 180, 0.5, [], 0, 0, 0);

    expect(raw.drawImage).toHaveBeenCalledWith(layer, 0, 0, 320, 180);
    expect(compositeOps).toContain('source-over');
    expect(layerCtx.globalCompositeOperation).toBe('source-over');
  });

  it('oneVisibleTorch-erasesOneHoleAndPaintsOneWarmGlow', () => {
    const { ctx, raw, compositeOps: mainCompositeOps } = makeLightingContext();
    const { layer, layerCtx, compositeOps } = makeLightingLayer();
    const torch = makeTorchLight({ col: 0, row: 0, x: 100, y: 100 });
    const radius = TORCH_LIGHT_RADIUS_PX * torchPulseScale(torch, 0);

    drawDarkness(ctx, layer, 320, 180, 0.5, [torch], 0, 0, 0);

    // Hole punched through the darkness layer.
    expect(layerCtx.createRadialGradient).toHaveBeenCalledTimes(1);
    expect(layerCtx.arc).toHaveBeenCalledWith(100, 100, radius, 0, Math.PI * 2);
    expect(compositeOps).toContain('destination-out');
    expect(layerCtx.globalCompositeOperation).toBe('source-over');

    // Warm additive pool on the main context, kept inside the hole.
    expect(raw.createRadialGradient).toHaveBeenCalledTimes(1);
    const glowRadius = raw.arc.mock.calls[0][2] as number;
    expect(glowRadius).toBeLessThan(radius);
    expect(mainCompositeOps).toContain('lighter');
  });

  it('twoVisibleTorches-eraseTwoHolesAndPaintTwoGlows', () => {
    const { ctx, raw } = makeLightingContext();
    const { layer, layerCtx } = makeLightingLayer();
    const torches = [
      makeTorchLight({ col: 0, row: 0, x: 100, y: 100 }),
      makeTorchLight({ col: 1, row: 0, x: 200, y: 100 }),
    ];

    drawDarkness(ctx, layer, 320, 180, 0.5, torches, 0, 0, 0);

    expect(layerCtx.createRadialGradient).toHaveBeenCalledTimes(2);
    expect(raw.createRadialGradient).toHaveBeenCalledTimes(2);
  });

  it('cameraOrigin-shiftsTheHoleAndGlowToTheScreenPosition', () => {
    const { ctx, raw } = makeLightingContext();
    const { layer, layerCtx } = makeLightingLayer();
    const torch = makeTorchLight({ col: 0, row: 0, x: 100, y: 100 });
    const radius = TORCH_LIGHT_RADIUS_PX * torchPulseScale(torch, 0);

    drawDarkness(ctx, layer, 320, 180, 0.5, [torch], -40, 10, 0);

    expect(layerCtx.arc).toHaveBeenCalledWith(60, 110, radius, 0, Math.PI * 2);
    expect(raw.arc).toHaveBeenCalledWith(60, 110, expect.any(Number), 0, Math.PI * 2);
  });

  it('torchFullyOutsideTheViewport-contributesNoHoleOrGlow', () => {
    const { ctx, raw } = makeLightingContext();
    const { layer, layerCtx } = makeLightingLayer();
    const torch = makeTorchLight({ x: -10000, y: -10000 });

    drawDarkness(ctx, layer, 320, 180, 0.5, [torch], 0, 0, 0);

    expect(layerCtx.createRadialGradient).not.toHaveBeenCalled();
    expect(raw.createRadialGradient).not.toHaveBeenCalled();
  });

  it('playerLight-punchesASmallerHoleAndGlowThanATorch', () => {
    const { ctx, raw } = makeLightingContext();
    const { layer, layerCtx } = makeLightingLayer();

    drawDarkness(ctx, layer, 320, 180, 0.5, [], 0, 0, 0, { x: 100, y: 100 });

    expect(layerCtx.createRadialGradient).toHaveBeenCalledTimes(1);
    expect(layerCtx.arc).toHaveBeenCalledWith(100, 100, PLAYER_LIGHT_RADIUS_PX, 0, Math.PI * 2);
    expect(raw.createRadialGradient).toHaveBeenCalledTimes(1);
    expect(PLAYER_LIGHT_RADIUS_PX).toBeLessThan(TORCH_LIGHT_RADIUS_PX);
  });

  it('noPlayerLight-doesNotPunchAPlayerHole', () => {
    const { ctx, raw } = makeLightingContext();
    const { layer, layerCtx } = makeLightingLayer();

    drawDarkness(ctx, layer, 320, 180, 0.5, [], 0, 0, 0);

    expect(layerCtx.createRadialGradient).not.toHaveBeenCalled();
    expect(raw.createRadialGradient).not.toHaveBeenCalled();
  });

  // The `zoom` parameter (O-019) lets a caller that runs this at IDENTITY
  // transform — the editor canvas — get correct hole positions AND correct
  // full-canvas coverage at once, which is impossible when the composite
  // `drawImage` falls under an ambient `ctx.scale()`.
  describe('zoom parameter', () => {
    it('omittedZoom-behavesIdenticallyToAnExplicitOne', () => {
      const withDefault = makeLightingContext();
      const defaultLayer = makeLightingLayer();
      const withExplicit = makeLightingContext();
      const explicitLayer = makeLightingLayer();
      const torch = makeTorchLight({ x: 100, y: 100 });

      drawDarkness(withDefault.ctx, defaultLayer.layer, 320, 180, 0.5, [torch], -40, 10, 0, {
        x: 60,
        y: 70,
      });
      drawDarkness(
        withExplicit.ctx,
        explicitLayer.layer,
        320,
        180,
        0.5,
        [torch],
        -40,
        10,
        0,
        { x: 60, y: 70 },
        1,
      );

      expect(explicitLayer.layerCtx.arc.mock.calls).toEqual(
        defaultLayer.layerCtx.arc.mock.calls,
      );
      expect(withExplicit.raw.arc.mock.calls).toEqual(withDefault.raw.arc.mock.calls);
      // Compare the destination rect only — arg 0 is each run's own distinct
      // layer stub, which deep-equality would (correctly) call different.
      expect(withExplicit.raw.drawImage.mock.calls.map((call) => call.slice(1))).toEqual(
        withDefault.raw.drawImage.mock.calls.map((call) => call.slice(1)),
      );
    });

    it('halfZoom-halvesTheTorchHolePositionRelativeToOriginAndItsRadius', () => {
      const { ctx } = makeLightingContext();
      const { layer, layerCtx } = makeLightingLayer();
      const torch = makeTorchLight({ x: 100, y: 100 });
      const radius = TORCH_LIGHT_RADIUS_PX * torchPulseScale(torch, 0);

      drawDarkness(ctx, layer, 320, 180, 0.5, [torch], -40, 10, 0, null, 0.5);

      // world 100 * 0.5 + origin(-40) = 10; world 100 * 0.5 + origin(10) = 60.
      expect(layerCtx.arc).toHaveBeenCalledWith(10, 60, radius * 0.5, 0, Math.PI * 2);
    });

    it('halfZoom-halvesThePlayerLightPositionAndRadius', () => {
      const { ctx } = makeLightingContext();
      const { layer, layerCtx } = makeLightingLayer();

      drawDarkness(ctx, layer, 320, 180, 0.5, [], 20, 40, 0, { x: 100, y: 100 }, 0.5);

      expect(layerCtx.arc).toHaveBeenCalledWith(
        70,
        90,
        PLAYER_LIGHT_RADIUS_PX * 0.5,
        0,
        Math.PI * 2,
      );
    });

    it('halfZoom-stillCompositesTheLayerOverTheRawFullCanvasSize', () => {
      // The actual coverage bug this parameter exists to fix: the composite
      // destination rect must stay the raw physical canvas size, never scaled.
      const { ctx, raw } = makeLightingContext();
      const { layer } = makeLightingLayer();

      drawDarkness(ctx, layer, 320, 180, 0.5, [], 0, 0, 0, null, 0.5);

      expect(raw.drawImage).toHaveBeenCalledWith(layer, 0, 0, 320, 180);
    });
  });
});

describe('drawHeldTorch', () => {
  const fakeTorchSheet = {} as HTMLImageElement;
  const basePlayer: PlayerState = {
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: true,
    climbing: false,
    isDroppingThroughBridge: false,
    lastGroundedX: 100,
    lastGroundedY: 100,
    prevFeetY: 100 + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING,
    animTimer: 0,
    animState: 'walk',
    animFrame: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    blockContacts: [],
    hitPoints: 6,
    alive: true,
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
  };

  it('walkingPlayerInDarkness-drawsTheTorchInHand', () => {
    const ctx = makeMockContext();

    drawHeldTorch(ctx, basePlayer, fakeTorchSheet, MAX_DARKNESS, 0, 0, 0);

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('idlePlayerInDarkness-drawsTheTorchInHand', () => {
    const ctx = makeMockContext();

    drawHeldTorch(ctx, { ...basePlayer, animState: 'idle' }, fakeTorchSheet, MAX_DARKNESS, 0, 0, 0);

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('atFullBrightness-drawsNothing', () => {
    const ctx = makeMockContext();

    drawHeldTorch(ctx, basePlayer, fakeTorchSheet, 0, 0, 0, 0);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('jumpingOrClimbingPlayer-drawsNothing', () => {
    for (const animState of ['jump', 'climb'] as const) {
      const ctx = makeMockContext();
      drawHeldTorch(ctx, { ...basePlayer, animState }, fakeTorchSheet, MAX_DARKNESS, 0, 0, 0);
      expect(ctx.drawImage).not.toHaveBeenCalled();
    }
  });

  it('missingTorchSheet-drawsNothing', () => {
    const ctx = makeMockContext();

    drawHeldTorch(ctx, basePlayer, null, MAX_DARKNESS, 0, 0, 0);

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('leftFacing-mirrorsTheTorch', () => {
    const ctx = makeMockContext();

    drawHeldTorch(ctx, { ...basePlayer, direction: 'left' }, fakeTorchSheet, MAX_DARKNESS, 0, 0, 0);

    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
  });
});

describe('heldTorchLightPosition', () => {
  const basePlayer: PlayerState = {
    x: 100,
    y: 100,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: true,
    climbing: false,
    isDroppingThroughBridge: false,
    lastGroundedX: 100,
    lastGroundedY: 100,
    prevFeetY: 100 + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING,
    animTimer: 0,
    animState: 'idle',
    animFrame: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    blockContacts: [],
    hitPoints: 6,
    alive: true,
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
  };

  it('rightFacing-sitsToTheRightOfThePlayerCentre', () => {
    const light = heldTorchLightPosition(basePlayer);

    expect(light.x).toBeGreaterThan(basePlayer.x + PLAYER_RENDERED_SIZE / 2);
  });

  it('leftFacing-mirrorsToTheLeftOfThePlayerCentre', () => {
    const right = heldTorchLightPosition(basePlayer);
    const left = heldTorchLightPosition({ ...basePlayer, direction: 'left' });

    expect(left.x).toBeLessThan(basePlayer.x + PLAYER_RENDERED_SIZE / 2);
    expect(basePlayer.x + PLAYER_RENDERED_SIZE / 2 - left.x).toBeCloseTo(
      right.x - (basePlayer.x + PLAYER_RENDERED_SIZE / 2),
    );
  });
});

describe('drawEnemyEyes', () => {
  it('atOrBelowZeroDarkness-drawsNothingAtAll', () => {
    const { ctx, raw } = makeLightingContext();

    drawEnemyEyes(ctx, [makeGreenEnemy()], 0, [], 0, 0, 0);

    expect(raw.fillRect).not.toHaveBeenCalled();
  });

  it('livingEnemyInDarkness-drawsTwoYellowEyesOfTheFixedSizeAndGap', () => {
    const { ctx, raw } = makeLightingContext();

    drawEnemyEyes(ctx, [makeGreenEnemy({ x: 100, y: 100 })], MAX_DARKNESS, [], 0, 0, 0);

    expect(raw.fillStyle).toBe(ENEMY_EYE_COLOR);
    const rects = raw.fillRect.mock.calls as [number, number, number, number][];
    expect(rects).toHaveLength(2);
    for (const [, , width, height] of rects) {
      expect(width).toBe(ENEMY_EYE_SIZE_PX);
      expect(height).toBe(ENEMY_EYE_SIZE_PX);
    }
    const centre0 = rects[0][0] + ENEMY_EYE_SIZE_PX / 2;
    const centre1 = rects[1][0] + ENEMY_EYE_SIZE_PX / 2;
    expect(Math.abs(centre1 - centre0)).toBe(ENEMY_EYE_GAP_PX);
  });

  it('defeatedEnemy-drawsNoEyes', () => {
    const { ctx, raw } = makeLightingContext();

    drawEnemyEyes(ctx, [makeGreenEnemy({ alive: false })], MAX_DARKNESS, [], 0, 0, 0);

    expect(raw.fillRect).not.toHaveBeenCalled();
  });

  it('enemyInsideATorchPool-showsNoMarker', () => {
    const { ctx, raw } = makeLightingContext();
    // The torch sits exactly on the enemy's own effect anchor, so its local
    // darkness is 0 — well below the eye threshold.
    const torch = makeTorchLight({ col: 0, row: 0, x: 116, y: 125 });

    drawEnemyEyes(ctx, [makeGreenEnemy({ x: 100, y: 100 })], MAX_DARKNESS, [torch], 0, 0, 0);

    expect(raw.fillRect).not.toHaveBeenCalled();
  });

  it('cameraOrigin-shiftsTheEyesWithTheWorld', () => {
    const enemy = makeGreenEnemy({ x: 100, y: 100 });
    const { ctx: ctxAtOrigin, raw: rawAtOrigin } = makeLightingContext();
    const { ctx: ctxScrolled, raw: rawScrolled } = makeLightingContext();

    drawEnemyEyes(ctxAtOrigin, [enemy], MAX_DARKNESS, [], 0, 0, 0);
    drawEnemyEyes(ctxScrolled, [enemy], MAX_DARKNESS, [], 0, -40, 10);

    const [ax, ay] = rawAtOrigin.fillRect.mock.calls[0] as [number, number];
    const [bx, by] = rawScrolled.fillRect.mock.calls[0] as [number, number];
    expect(bx).toBe(ax - 40);
    expect(by).toBe(ay + 10);
  });

  it('worldClock-bobsTheEyesUpAndDown', () => {
    const enemy = makeGreenEnemy({ x: 100, y: 100 });
    const { ctx: ctxRest, raw: rawRest } = makeLightingContext();
    const { ctx: ctxPeak, raw: rawPeak } = makeLightingContext();

    drawEnemyEyes(ctxRest, [enemy], MAX_DARKNESS, [], 0, 0, 0);
    drawEnemyEyes(ctxPeak, [enemy], MAX_DARKNESS, [], ENEMY_EYE_BOB_PERIOD_SECONDS / 4, 0, 0);

    const [, restY] = rawRest.fillRect.mock.calls[0] as [number, number];
    const [, peakY] = rawPeak.fillRect.mock.calls[0] as [number, number];
    expect(peakY).toBe(restY + ENEMY_EYE_BOB_AMPLITUDE_PX);
  });
});
