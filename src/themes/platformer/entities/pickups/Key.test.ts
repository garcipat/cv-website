import { describe, it, expect } from 'vitest';
import {
  spawnKeyPickup,
  KEY_FRAME_WIDTH,
  KEY_FRAME_HEIGHT,
  KEY_RENDERED_WIDTH,
  KEY_RENDERED_HEIGHT,
  KEY_TILE_OFFSET_X,
  KEY_TILE_OFFSET_Y,
  key,
} from './Key';
import { RENDERED_TILE_SIZE } from '../../level/Terrain';

describe('spawnKeyPickup', () => {
  it('spawnKeyPickup-givenIdAndPosition-returnsUncollectedState', () => {
    expect(spawnKeyPickup('enemy-plain-slimePurple-5-6', 100, 200)).toEqual({
      id: 'enemy-plain-slimePurple-5-6',
      kind: 'key',
      x: 100,
      y: 200,
      collected: false,
    });
  });
});

describe('KEY sizing constants', () => {
  it('renderedHeight-fixedToExactlyOneRenderedTile-independentOfOtherPickups', () => {
    expect(KEY_RENDERED_HEIGHT).toBe(RENDERED_TILE_SIZE);
  });

  it('renderedWidth-preservesNativeAspectRatio', () => {
    expect(KEY_RENDERED_WIDTH).toBe(Math.round((KEY_FRAME_WIDTH / KEY_FRAME_HEIGHT) * KEY_RENDERED_HEIGHT));
  });

  it('tileOffsetY-bottomAnchorsKeyWithinItsTile', () => {
    expect(KEY_TILE_OFFSET_Y).toBe(RENDERED_TILE_SIZE - KEY_RENDERED_HEIGHT);
  });

  it('tileOffsetX-centersKeyHorizontallyOnItsTile', () => {
    expect(KEY_TILE_OFFSET_X).toBe((RENDERED_TILE_SIZE - KEY_RENDERED_WIDTH) / 2);
  });
});

describe('key view', () => {
  it('key-isKey-andDrawLayerIsAfterEnemies', () => {
    expect(key.key).toBe('key');
    expect(key.drawLayer).toBe('afterEnemies');
  });

  it('onPickup-banksAKeyAndFliesATextToTheKeyCounter', () => {
    const outcome = key.onPickup(spawnKeyPickup('k1', 100, 200), {
      pool: [],
      total: 0,
      collectedBefore: 0,
    });
    expect(outcome.bankKey).toBe(true);
    expect(outcome.flyingText).toEqual({
      effectId: 'k1',
      label: 'Key',
      x: 100 + KEY_TILE_OFFSET_X,
      y: 200 + KEY_TILE_OFFSET_Y,
      target: 'keyCounter',
    });
    expect(outcome).not.toHaveProperty('disposition');
    expect(outcome).not.toHaveProperty('self');
  });
});
