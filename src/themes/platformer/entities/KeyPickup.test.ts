import { describe, it, expect } from 'vitest';
import { spawnKeyPickup, KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT, KEY_RENDERED_WIDTH, KEY_RENDERED_HEIGHT } from './KeyPickup';
import { RENDER_SCALE } from '../level/Terrain';

describe('spawnKeyPickup', () => {
  it('spawnKeyPickup-givenIdAndPosition-returnsUncollectedState', () => {
    expect(spawnKeyPickup('enemy-plain-slimePurple-5-6', 100, 200)).toEqual({
      id: 'enemy-plain-slimePurple-5-6',
      x: 100,
      y: 200,
      collected: false,
    });
  });
});

describe('KEY sizing constants', () => {
  it('renderedSize-equalsFrameSizeTimesRenderScale', () => {
    expect(KEY_RENDERED_WIDTH).toBe(KEY_FRAME_WIDTH * RENDER_SCALE);
    expect(KEY_RENDERED_HEIGHT).toBe(KEY_FRAME_HEIGHT * RENDER_SCALE);
  });
});
