import { describe, it, expect } from 'vitest';
import {
  spawnKeyPickup,
  KEY_FRAME_WIDTH,
  KEY_FRAME_HEIGHT,
  KEY_RENDERED_WIDTH,
  KEY_RENDERED_HEIGHT,
  KEY_TILE_OFFSET_X,
  KEY_TILE_OFFSET_Y,
} from './KeyPickup';
import { RENDERED_TILE_SIZE } from '../level/Terrain';

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
  it('renderedHeight-fitsWithinOneRenderedTile', () => {
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
