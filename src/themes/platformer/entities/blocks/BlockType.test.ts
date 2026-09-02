import { frameSource } from '../sprites/SpriteSheet';
import { WORLD_TILESET_SHEET } from '../sprites/sheets';
import { blockFrameSource } from '../Block';

describe('WORLD_TILESET_SHEET', () => {
  it('columns-matchesTheTilesetGrid', () => {
    // world_tileset.png is 256x256 of 16px tiles.
    expect(WORLD_TILESET_SHEET.columns).toBe(16);
  });
});

describe('block frame indices match blockFrameSource', () => {
  // These indices are what the modules will declare. Pinning them against the
  // live coordinate switch is what makes the conversion safe: index = row*16 + col.
  it('crateIndex-matchesItsCurrentCoordinates', () => {
    expect(frameSource(WORLD_TILESET_SHEET, 55)).toEqual(blockFrameSource('crate'));
  });

  it('intactQuestionMarkIndex-matchesItsCurrentCoordinates', () => {
    expect(frameSource(WORLD_TILESET_SHEET, 32)).toEqual(blockFrameSource('questionMark', 0));
  });

  it('usedUpQuestionMarkIndex-matchesItsCurrentCoordinates', () => {
    // A spent question-mark swaps to the plain top-exposed groundRock tile so
    // it blends into ordinary ground rather than reading as a distinct block.
    expect(frameSource(WORLD_TILESET_SHEET, 1)).toEqual(blockFrameSource('questionMark', 1));
  });

  it('fragileRockIndex-matchesItsCurrentCoordinates', () => {
    expect(frameSource(WORLD_TILESET_SHEET, 3)).toEqual(blockFrameSource('fragileRock'));
  });
});
