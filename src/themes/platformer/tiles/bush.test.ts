import { describe, it, expect } from 'vitest';
import { bushOrTreeEntry } from './bush';

// Bush/tree art comes from world_tileset.png (256x256).
const TILESET_SHEET_WIDTH = 256;
const TILESET_SHEET_HEIGHT = 256;
const TILE_SIZE = 16;
const ROLES = ['only', 'bottom', 'middle', 'top'] as const;

describe('bushOrTreeEntry', () => {
  it.each(ROLES)('%s-resolvesToARectInsideTheTilesetOnA16pxGrid', (role) => {
    const entry = bushOrTreeEntry(role, 0, 0);
    expect(entry.sx % TILE_SIZE).toBe(0);
    expect(entry.sy % TILE_SIZE).toBe(0);
    expect(entry.sx + TILE_SIZE).toBeLessThanOrEqual(TILESET_SHEET_WIDTH);
    expect(entry.sy + TILE_SIZE).toBeLessThanOrEqual(TILESET_SHEET_HEIGHT);
  });

  it('sameRoleAndPosition-isDeterministic', () => {
    expect(bushOrTreeEntry('bottom', 3, 5)).toEqual(bushOrTreeEntry('bottom', 3, 5));
  });

  it('differentRoles-resolveToDifferentEntries', () => {
    const only = bushOrTreeEntry('only', 0, 0);
    const bottom = bushOrTreeEntry('bottom', 0, 0);
    const middle = bushOrTreeEntry('middle', 0, 0);
    const top = bushOrTreeEntry('top', 0, 0);
    expect(only).not.toEqual(bottom);
    expect(bottom).not.toEqual(middle);
    expect(middle).not.toEqual(top);
    expect(top).not.toEqual(only);
  });
});
