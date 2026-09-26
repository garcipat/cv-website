import { describe, it, expect } from 'vitest';
import { MUSHROOM_DECORATIVE_ENTRY, decorativeMushroomModule } from './decorativeMushroom';
import type { TileModule } from './TileModule';

const module: TileModule = decorativeMushroomModule;

describe('MUSHROOM_DECORATIVE_ENTRY', () => {
  it('isTheThirdSixteenPixelCellOfTheMushroomsTopRow', () => {
    // Column 2, row 0 of the red row of mushroom.png — a single fixed cell,
    // drawn whole and never split/squashed.
    expect(MUSHROOM_DECORATIVE_ENTRY).toEqual({ sx: 32, sy: 0 });
  });

  it('decorativeMushroomModule-carriesNoRules', () => {
    expect(module.solid).toBeUndefined();
    expect(module.climbable).toBeUndefined();
    expect(module.standableAt).toBeUndefined();
    expect(module.drawBand).toBe('terrain');
  });
});
