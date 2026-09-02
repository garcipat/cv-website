import { ENEMY_TYPES, typeOf } from './enemies';
import { PICKUP_TYPES } from './pickups';
import { BLOCK_TYPES } from './blocks';
import { CHEST_TYPE } from './chests';
import {
  enemyRenderedSize,
  enemyTileOffsetX,
  enemyTileOffsetY,
  enemyHitboxSidePadding,
  enemyHitboxTopPadding,
} from './Enemy';
import type { EnemyState } from './Enemy';
import {
  CHEST_CLOSED_RENDERED_WIDTH,
  CHEST_CLOSED_RENDERED_HEIGHT,
  CHEST_CLOSED_OFFSET_X,
} from './Chest';
import type { ChestState } from './Chest';

/** A living enemy of the given type at the given position. Carries
 *  slimePurple's own fields too, so one helper covers both types. */
function makeEnemy(type: EnemyState['type'], x: number, y: number): EnemyState {
  const enemy = {
    id: 'e1',
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    direction: 'right' as const,
    animState: 'walk' as const,
    animFrame: 0,
    animTimer: 0,
    hitPoints: 1,
    hitTimer: 0,
    alive: true,
    spiked: false,
    spikeTimer: 0,
    homeX: x,
    homeY: y,
    rewardGiven: false,
  };
  return enemy;
}

function makeChest(x: number, y: number): ChestState {
  return {
    id: 'chest-1',
    x,
    y,
    state: 'closed',
    fact: {
      id: 'chest-1',
      sectionId: 'experience',
      sectionLabel: 'Experience',
      data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
      sourceType: 'chest',
    },
  };
}

describe('WorldType conformance', () => {
  it('everyTypeModule-exposesADraw', () => {
    const all = [
      ...Object.values(ENEMY_TYPES),
      ...Object.values(PICKUP_TYPES),
      ...Object.values(BLOCK_TYPES),
      CHEST_TYPE,
    ];
    for (const type of all) {
      expect(typeof type.draw).toBe('function');
    }
  });

  it('typesWithARectangle-exposeABox', () => {
    const boxed = [...Object.values(ENEMY_TYPES), ...Object.values(PICKUP_TYPES), CHEST_TYPE];
    for (const type of boxed) {
      expect(typeof type.box).toBe('function');
    }
  });

  it('blockTypes-exposeNoBox', () => {
    // Physics locates blocks by grid cell and never computes a block
    // rectangle, so a box here would have no consumer.
    for (const type of Object.values(BLOCK_TYPES)) {
      expect('box' in type).toBe(false);
    }
  });
});

describe('enemy box equivalence', () => {
  it('box-slimeGreen-insetFromRenderSlotByMeasuredSpriteConstants', () => {
    // Concrete anchor values (not derived from the code under test):
    // size=48, tileOffsetX=-8, tileOffsetY=-16, sidePad=10, topPad=18 ->
    // x=enemy.x+2, y=enemy.y+2, width=28, height=30.
    const enemy = makeEnemy('slimeGreen', 10, 20);
    expect(typeOf(enemy).box(enemy)).toEqual({ x: 12, y: 22, width: 28, height: 30 });
  });

  it('box-slimePurple-scalesOffsetAndInsetWithRenderScale', () => {
    // size=96, tileOffsetX=-32, tileOffsetY=-64, sidePad=20, topPad=36 ->
    // x=enemy.x-12, y=enemy.y-28, width=56, height=60.
    const enemy = makeEnemy('slimePurple', 10, 20);
    expect(typeOf(enemy).box(enemy)).toEqual({ x: -2, y: -8, width: 56, height: 60 });
  });

  it('box-everyEnemyType-matchesTheRenderSlotOffsetAndPaddingFormula', () => {
    // The formula the engine applied before each type owned its own box:
    // render-slot centering offsets plus the sprite's transparent margins.
    for (const type of ['slimeGreen', 'slimePurple'] as const) {
      const enemy = makeEnemy(type, 100, 200);
      const size = enemyRenderedSize(type);
      const sidePad = enemyHitboxSidePadding(type);
      const topPad = enemyHitboxTopPadding(type);
      expect(typeOf(enemy).box(enemy)).toEqual({
        x: 100 + enemyTileOffsetX(type) + sidePad,
        y: 200 + enemyTileOffsetY(type) + topPad,
        width: size - 2 * sidePad,
        height: size - topPad,
      });
    }
  });
});

describe('chest box equivalence', () => {
  it('box-closedChest-matchesTheRectChestPlayerIsStandingOnBuilds', () => {
    const chest = makeChest(10, 20);
    expect(CHEST_TYPE.box(chest)).toEqual({
      x: chest.x + CHEST_CLOSED_OFFSET_X,
      y: chest.y,
      width: CHEST_CLOSED_RENDERED_WIDTH,
      height: CHEST_CLOSED_RENDERED_HEIGHT,
    });
  });

  it('box-closedChest-isTheClosedFootprintCenteredOnItsTile', () => {
    // Concrete anchors: the closed art is 28x20 native, scaled so its height
    // matches the 32px tile -> 44.8 x 32, centered by an offset of -6.4.
    const box = CHEST_TYPE.box(makeChest(10, 20));
    expect(box.x).toBeCloseTo(3.6, 6);
    expect(box.y).toBe(20);
    expect(box.width).toBeCloseTo(44.8, 6);
    expect(box.height).toBe(32);
  });
});
