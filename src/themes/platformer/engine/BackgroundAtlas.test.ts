import { describe, it, expect } from 'vitest';
import {
  BACKGROUND_ATLAS_STRIDE,
  BACKGROUND_ATLAS_ROW_PITCH,
  backgroundAtlasCell,
} from './BackgroundAtlas';
import type { BackgroundMaterialId } from '../level/LevelData';
import {
  NEIGHBOUR_UP,
  NEIGHBOUR_RIGHT,
  NEIGHBOUR_DOWN,
  NEIGHBOUR_LEFT,
} from '../level/Terrain';

const ALL_MASKS = Array.from({ length: 16 }, (_, mask) => mask);
const ALL_MATERIALS: BackgroundMaterialId[] = [
  'dirt',
  'rust',
  'surfaceStone',
  'charcoal',
  'maroon',
  'caveStone',
];

describe('backgroundAtlasCell', () => {
  it.each(ALL_MATERIALS)('%s-everyMask-hasAnEntry', (material) => {
    for (const mask of ALL_MASKS) {
      expect(backgroundAtlasCell(material, mask)).toBeDefined();
    }
  });

  it.each(ALL_MATERIALS)('%s-everyEntry-coordinatesLieOnTheAtlasGrid', (material) => {
    for (const mask of ALL_MASKS) {
      const { sx } = backgroundAtlasCell(material, mask);
      expect(sx % BACKGROUND_ATLAS_STRIDE).toBe(0);
      expect(sx / BACKGROUND_ATLAS_STRIDE).toBeLessThanOrEqual(3);
    }
  });

  it('unknownMask-throws', () => {
    expect(() => backgroundAtlasCell('dirt', 16)).toThrow();
    expect(() => backgroundAtlasCell('dirt', -1)).toThrow();
  });

  it('isolatedMask-usesTheSheetsIsolatedTile', () => {
    expect(backgroundAtlasCell('dirt', 0)).toEqual({
      sx: 3 * BACKGROUND_ATLAS_STRIDE,
      sy: 0 * BACKGROUND_ATLAS_STRIDE,
      rotation: 0,
    });
  });

  it('fullyInteriorMask-usesTheMiddleTile', () => {
    const mask = NEIGHBOUR_UP | NEIGHBOUR_RIGHT | NEIGHBOUR_DOWN | NEIGHBOUR_LEFT;
    expect(backgroundAtlasCell('dirt', mask)).toEqual({
      sx: 1 * BACKGROUND_ATLAS_STRIDE,
      sy: 1 * BACKGROUND_ATLAS_STRIDE,
      rotation: 0,
    });
  });

  it('oneWideStrip-capAndBody-useDistinctSourceTilesFromEachOther', () => {
    const cap = backgroundAtlasCell('dirt', NEIGHBOUR_DOWN);
    const body = backgroundAtlasCell('dirt', NEIGHBOUR_UP | NEIGHBOUR_DOWN);
    expect(cap).not.toEqual(body);
  });

  it('stripCap-reusesTheSameSourceTileAcrossAllFourRotations', () => {
    const up = backgroundAtlasCell('dirt', NEIGHBOUR_UP);
    const right = backgroundAtlasCell('dirt', NEIGHBOUR_RIGHT);
    const down = backgroundAtlasCell('dirt', NEIGHBOUR_DOWN);
    const left = backgroundAtlasCell('dirt', NEIGHBOUR_LEFT);
    const sourceOf = (e: { sx: number; sy: number }) => `${e.sx},${e.sy}`;
    expect(new Set([up, right, down, left].map(sourceOf)).size).toBe(1);
    expect(new Set([up, right, down, left].map((e) => e.rotation)).size).toBe(4);
  });

  it('cornersAndEdges-areAuthoredDirectlyInTheSheetWithNoRotation', () => {
    // Per data-model.md: the four corner and four edge orientations are each
    // distinct sheet crops, referenced with rotation 0 — not re-rotated.
    const corner = backgroundAtlasCell('dirt', NEIGHBOUR_UP | NEIGHBOUR_RIGHT);
    const edge = backgroundAtlasCell('dirt', NEIGHBOUR_UP | NEIGHBOUR_RIGHT | NEIGHBOUR_DOWN);
    expect(corner.rotation).toBe(0);
    expect(edge.rotation).toBe(0);
  });

  it('sameMaskAcrossDifferentMaterials-usesEachMaterialsOwnRowOfTheSheet', () => {
    const dirtMiddle = backgroundAtlasCell('dirt', 15);
    const charcoalMiddle = backgroundAtlasCell('charcoal', 15);
    expect(dirtMiddle.sx).toBe(charcoalMiddle.sx);
    expect(dirtMiddle.sy).not.toBe(charcoalMiddle.sy);
    expect(charcoalMiddle.sy - dirtMiddle.sy).toBe(5 * BACKGROUND_ATLAS_ROW_PITCH);
  });

  it('rowPitch-and-stride-arePositiveIntegers', () => {
    expect(Number.isInteger(BACKGROUND_ATLAS_STRIDE)).toBe(true);
    expect(BACKGROUND_ATLAS_STRIDE).toBeGreaterThan(0);
    expect(Number.isInteger(BACKGROUND_ATLAS_ROW_PITCH)).toBe(true);
    expect(BACKGROUND_ATLAS_ROW_PITCH).toBeGreaterThan(0);
  });
});
