import { describe, it, expect } from 'vitest';
import { layoutFileJson } from './layoutFileJson';
import { importLayout } from '../ops/importLayout';
import { exportLayout } from '../ops/exportLayout';
import { parseLevelModules, parseBlueprintModules } from '../../level/layoutFile';
import { SCRATCH_LAYOUT } from '../../level/level';
import type { MarkerPlacement } from '../../level/LevelData';

describe('layoutFileJson', () => {
  const layout = exportLayout(importLayout(SCRATCH_LAYOUT));

  it('holdsTheGivenNameAndLayout', () => {
    expect(JSON.parse(layoutFileJson('Cave Run', layout, []))).toEqual({
      name: 'Cave Run',
      layout,
    });
  });

  it('isPrettyPrintedSoTheFileIsReadableInTheRepo', () => {
    expect(layoutFileJson('Cave Run', layout, [])).toContain('\n  "name"');
  });

  it('endsWithANewline', () => {
    expect(layoutFileJson('Cave Run', layout, []).endsWith('\n')).toBe(true);
  });

  // : a file the editor saved has to be a file the registry accepts.
  it('aLevelFile-roundTripsBackThroughTheRegistryToAGridEqualToTheSavedOne', () => {
    const entries = parseLevelModules({
      './levels/cave-run.json': {
        default: JSON.parse(layoutFileJson('Cave Run', layout, [])),
      },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Cave Run');
    expect(importLayout(entries[0].layout)).toEqual(importLayout(layout));
  });

  it('aBlueprintFile-roundTripsBackThroughTheBlueprintRegistry', () => {
    const entries = parseBlueprintModules({
      './blueprints/cave-room.json': {
        default: JSON.parse(layoutFileJson('Cave Room', ['#G#'], [])),
      },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Cave Room');
    expect(entries[0].layout).toEqual(['#G#']);
  });
});

describe('layoutFileJson — background field', () => {
  it('nonEmptyBackground-isIncludedInTheSerializedJsonAsAStringArray', () => {
    expect(JSON.parse(layoutFileJson('Cave', ['S'], ['d']))).toEqual({
      name: 'Cave',
      layout: ['S'],
      background: ['d'],
    });
  });

  it('emptyBackground-isOmittedFromTheSerializedJson', () => {
    expect(JSON.parse(layoutFileJson('Plain', ['S'], []))).toEqual({
      name: 'Plain',
      layout: ['S'],
    });
  });

  it('backgroundOfAllEmptyRows-isOmittedFromTheSerializedJson', () => {
    expect(JSON.parse(layoutFileJson('Plain', ['SS'], ['..', '..']))).toEqual({
      name: 'Plain',
      layout: ['SS'],
    });
  });
});

describe('layoutFileJson — markers field', () => {
  const markers: MarkerPlacement[] = [{ col: 1, row: 0, marker: { kind: 'sign', hintId: 'bomb' } }];

  it('nonEmptyMarkers-areIncludedAsTypedPlacements', () => {
    expect(JSON.parse(layoutFileJson('Cave', ['T'], [], markers))).toEqual({
      name: 'Cave',
      layout: ['T'],
      markers,
    });
  });

  it('emptyMarkers-areOmittedEntirely', () => {
    expect(JSON.parse(layoutFileJson('Plain', ['S'], [], []))).toEqual({
      name: 'Plain',
      layout: ['S'],
    });
  });
});
