import { vi } from 'vitest';
import { PICKUP_TYPES } from './index';
import { COIN_SHEET, FRUIT_SHEET, KEY_SHEET, HEARTS_SHEET, BOMB_SHEET } from '../sprites/sheets';
import { spawnKeyPickup } from './Key';
import { spawnHeartPickup, HEART_PICKUP_RENDERED_SIZE, HEART_PICKUP_TILE_OFFSET_X } from './Heart';
import {
  spawnBombPickup,
  BOMB_PICKUP_RENDERED_SIZE,
  BOMB_PICKUP_TILE_OFFSET_X,
  BOMB_PICKUP_TILE_OFFSET_Y,
} from './Bomb';
import { spawnFruit, FRUIT_RISE_DURATION_SECONDS, fruitY, tickFruit } from './Fruit';
import type { FruitState } from './Fruit';
import type { CollectiblePlacement } from '../../level/CollectibleMapper';
import type { CollectedFact } from '../../types';

function makePlacement(x: number, y: number): CollectiblePlacement {
  return { id: 'coin-x', kind: 'coin', x, y, collected: false };
}

const testFact: CollectedFact = {
  id: 'qmark-cert-x',
  sectionId: 'certificates',
  sectionLabel: 'Certificates',
  data: { name: 'Test Cert', issuer: 'Test', date: '2024-01' },
  sourceType: 'block',
};

describe('PICKUP_TYPES', () => {
  it('everyEntry-declaresItsOwnKey', () => {
    for (const [key, type] of Object.entries(PICKUP_TYPES)) {
      expect(type.key).toBe(key);
    }
  });

  it('everyEntry-declaresItsOwnDrawLayer', () => {
    for (const type of Object.values(PICKUP_TYPES)) {
      expect(['belowBlocks', 'beforeEnemies', 'afterEnemies']).toContain(type.drawLayer);
    }
  });

  it('eachEntry-pointsAtItsOwnSheet', () => {
    expect(PICKUP_TYPES.coin.sprite.sheet).toBe(COIN_SHEET);
    expect(PICKUP_TYPES.fruit.sprite.sheet).toBe(FRUIT_SHEET);
    expect(PICKUP_TYPES.key.sprite.sheet).toBe(KEY_SHEET);
    expect(PICKUP_TYPES.heart.sprite.sheet).toBe(HEARTS_SHEET);
    expect(PICKUP_TYPES.bomb.sprite.sheet).toBe(BOMB_SHEET);
  });

  it('everySpawnedState-kindEqualsItsRegistrySlot-andExposesABooleanCollectedFlag', () => {
    // SC-002: each state's `kind` equals the registry slot it is stored under,
    // and carries the shared boolean collect-once flag.
    const states = [
      PICKUP_TYPES.coin.spawn({ id: 'c', x: 0, y: 0 }),
      PICKUP_TYPES.fruit.spawn({ id: 'f', x: 0, y: 0 }),
      PICKUP_TYPES.key.spawn({ id: 'k', x: 0, y: 0 }),
      PICKUP_TYPES.heart.spawn({ id: 'h', x: 0, y: 0 }),
      PICKUP_TYPES.bomb.spawn({ id: 'b', x: 0, y: 0 }),
    ];
    for (const state of states) {
      expect(state.kind).toBe(PICKUP_TYPES[state.kind].key);
      expect(typeof state.collected).toBe('boolean');
      expect(state.collected).toBe(false);
    }
  });
});

describe('every kind spawns itself from a source (US2)', () => {
  it('coin-spawnsAPositionalCoinThatIgnoresFactAndIconIndex', () => {
    const iconIndex = vi.fn(() => 5);
    const state = PICKUP_TYPES.coin.spawn({ id: 'pot-1', x: 10, y: 20, fact: testFact, iconIndex });
    expect(state).toEqual({ id: 'pot-1', kind: 'coin', x: 10, y: 20, collected: false });
    // The lazy icon supplier is only invoked for the fruit kind.
    expect(iconIndex).not.toHaveBeenCalled();
  });

  it('fruit-spawnsItsRisingStateWithTheSourceFactAndLazyIconIndex', () => {
    const iconIndex = vi.fn(() => 5);
    const state = PICKUP_TYPES.fruit.spawn({ id: 'qmark-1', x: 30, y: 40, fact: testFact, iconIndex }) as FruitState;
    expect(state.kind).toBe('fruit');
    expect(state.id).toBe('qmark-1');
    expect(state.x).toBe(30);
    expect(state.y).toBe(40);
    expect(state.collected).toBe(false);
    expect(state.fact).toBe(testFact);
    expect(state.iconIndex).toBe(5);
    expect(iconIndex).toHaveBeenCalledTimes(1);
  });

  it('key-spawnsAnUncollectedKeyAtTheSourcePosition', () => {
    const state = PICKUP_TYPES.key.spawn({ id: 'enemy-1', x: 1, y: 2 });
    expect(state).toEqual({ id: 'enemy-1', kind: 'key', x: 1, y: 2, collected: false });
  });

  it('heart-spawnsAnUncollectedHeartAtTheSourcePosition', () => {
    const state = PICKUP_TYPES.heart.spawn({ id: 'pot-1', x: 1, y: 2 });
    expect(state).toEqual({ id: 'pot-1', kind: 'heart', x: 1, y: 2, collected: false });
  });

  it('bomb-spawnsAnUncollectedBombAtTheSourcePosition', () => {
    const state = PICKUP_TYPES.bomb.spawn({ id: 'pot-1', x: 1, y: 2 });
    expect(state).toEqual({ id: 'pot-1', kind: 'bomb', x: 1, y: 2, collected: false });
  });
});

describe('pickup boxes match the boxes collision uses today', () => {
  it('coin-boxIsItsPlacementAtRenderedSize', () => {
    expect(PICKUP_TYPES.coin.box(makePlacement(100, 200))).toEqual({
      x: 100,
      y: 200,
      width: 32,
      height: 32,
    });
  });

  it('key-boxIsOffsetAndNarrowerThanATile', () => {
    // KEY_RENDERED_WIDTH is round(14/22 * 32) = 20, so the key is centered
    // over its tile with a 6px inset each side; its height fills the tile.
    expect(PICKUP_TYPES.key.box(spawnKeyPickup('k', 100, 200))).toEqual({
      x: 106,
      y: 200,
      width: 20,
      height: 32,
    });
  });

  it('fruit-boxFollowsTheStoredRisePosition', () => {
    const fruit = spawnFruit('b', 100, 200, undefined, 0);
    expect(PICKUP_TYPES.fruit.box(fruit).y).toBe(fruit.y);
    expect(fruit.y).toBe(fruitY(fruit));

    const risen = tickFruit(fruit, FRUIT_RISE_DURATION_SECONDS);
    expect(PICKUP_TYPES.fruit.box(risen).y).toBe(risen.restY);
    expect(risen.y).toBe(fruitY(risen));
  });

  it('heart-boxIsCenteredAtItsSmallerRenderedSize', () => {
    expect(PICKUP_TYPES.heart.box(spawnHeartPickup('h', 100, 200))).toEqual({
      x: 100 + HEART_PICKUP_TILE_OFFSET_X,
      y: 200 + HEART_PICKUP_TILE_OFFSET_X,
      width: HEART_PICKUP_RENDERED_SIZE,
      height: HEART_PICKUP_RENDERED_SIZE,
    });
  });

  it('bomb-boxIsCenteredAtItsSmallerRenderedSize', () => {
    expect(PICKUP_TYPES.bomb.box(spawnBombPickup('b', 100, 200))).toEqual({
      x: 100 + BOMB_PICKUP_TILE_OFFSET_X,
      y: 200 + BOMB_PICKUP_TILE_OFFSET_Y,
      width: BOMB_PICKUP_RENDERED_SIZE,
      height: BOMB_PICKUP_RENDERED_SIZE,
    });
  });
});

describe('pickup frames match their existing frame functions', () => {
  it('coinFrameIndex-followsTheSharedWorldClock', () => {
    expect(PICKUP_TYPES.coin.frameIndex(makePlacement(0, 0), 0, 0)).toBe(0);
    expect(PICKUP_TYPES.coin.frameIndex(makePlacement(0, 0), 0.12 * 3, 0)).toBe(3);
  });

  it('key-hasASingleFrame', () => {
    expect(PICKUP_TYPES.key.frameIndex(spawnKeyPickup('k', 0, 0), 99, 0)).toBe(0);
  });

  it('fruitFrameIndex-returnsItsOwnIconIndex', () => {
    // The question-mark reward's `fruit` pickup carries its own per-instance
    // icon index (wrapped at spawn), unlike the former order-derived
    // placed-fruit.
    expect(PICKUP_TYPES.fruit.frameIndex(spawnFruit('f', 0, 0, undefined, 0), 0, 0)).toBe(0);
    expect(PICKUP_TYPES.fruit.frameIndex(spawnFruit('f', 0, 0, undefined, 5), 0, 0)).toBe(5);
  });

  it('heart-alwaysShowsTheFullHeartFrame', () => {
    // Frame 0 of hearts.png (see Health.ts's heartFrameIndex) — a dropped
    // heart is always a whole half-heart's worth, never half or empty.
    expect(PICKUP_TYPES.heart.frameIndex(spawnHeartPickup('h', 0, 0), 99, 0)).toBe(0);
  });

  it('bomb-alwaysShowsTheUnlitFrame', () => {
    // Frame 0 of bomb.png — the same unlit bomb the HUD counter uses; a
    // placed bomb's lit frames 1-5 never appear on a world pickup (O-012).
    expect(PICKUP_TYPES.bomb.frameIndex(spawnBombPickup('b', 0, 0), 99, 0)).toBe(0);
  });
});

describe('bomb pickup carries no CV fact (FR-011)', () => {
  it('bomb-hasNoFactField', () => {
    expect('fact' in PICKUP_TYPES.bomb).toBe(false);
  });

  it('bomb-isNeverACollectiblePlacementKind', () => {
    // A CollectiblePlacement's `kind` is the fact-bearing coin variant (a
    // question-mark reward is a separately-drawn rising fruit); a bomb feeds
    // no fact pool and no journal counter.
    const collectibleKinds: CollectiblePlacement['kind'][] = ['coin'];
    expect(collectibleKinds.includes(PICKUP_TYPES.bomb.key as CollectiblePlacement['kind'])).toBe(
      false,
    );
  });
});
