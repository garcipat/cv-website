import { describe, it, expect } from 'vitest';
import {
  idFromPath,
  isLayout,
  isBackground,
  isMarkers,
  parseLevelModules,
  parseBlueprintModules,
} from './layoutFile';
import type { LevelEntry } from './levelRegistry';
import type { Blueprint } from './BlueprintData';

describe('idFromPath', () => {
  it('levelPath-returnsTheFilenameStem', () => {
    expect(idFromPath('./levels/cave-run.json')).toBe('cave-run');
  });

  it('blueprintPath-returnsTheFilenameStem', () => {
    expect(idFromPath('./blueprints/cave-room.json')).toBe('cave-room');
  });

  it('bareFilename-dropsTheJsonSuffix', () => {
    expect(idFromPath('flat.json')).toBe('flat');
  });

  it('pathWithNoSlashAndNoSuffix-returnsItUnchanged', () => {
    expect(idFromPath('odd')).toBe('odd');
  });
});

describe('isLayout', () => {
  it('nonEmptyArrayOfStrings-isTrue', () => {
    expect(isLayout(['.S.', 'GGG'])).toBe(true);
  });

  it('emptyArray-isFalse-theNonEmptyRequirement', () => {
    expect(isLayout([])).toBe(false);
  });

  it('arrayWithANonStringRow-isFalse', () => {
    expect(isLayout(['GGG', 7])).toBe(false);
  });

  it('nonArray-isFalse', () => {
    expect(isLayout('GGG')).toBe(false);
    expect(isLayout(null)).toBe(false);
  });
});

describe('isBackground', () => {
  it('arrayOfStrings-isTrue', () => {
    expect(isBackground(['d.', '..'])).toBe(true);
  });

  it('emptyArray-isTrue-unlikeIsLayout', () => {
    expect(isBackground([])).toBe(true);
  });

  it('arrayWithANonStringRow-isFalse', () => {
    expect(isBackground([['dirt']])).toBe(false);
  });
});

describe('isMarkers', () => {
  it('entriesWithNumericColRowAndMarkerKind-areTrue', () => {
    expect(
      isMarkers([
        { col: 0, row: 1, marker: { kind: 'patrolBoundary' } },
        { col: 2, row: 3, marker: { kind: 'torch', strength: 5 } },
      ]),
    ).toBe(true);
  });

  it('emptyArray-isTrue', () => {
    expect(isMarkers([])).toBe(true);
  });

  it('entryMissingItsMarker-isFalse', () => {
    expect(isMarkers([{ col: 0, row: 0 }])).toBe(false);
  });

  it('entryWithANonNumericCol-isFalse', () => {
    expect(isMarkers([{ col: 'x', row: 0, marker: { kind: 'sign' } }])).toBe(false);
  });
});

describe('parseLevelModules', () => {
  it('wellFormedModule-becomesAnEntryWithItsFilenameStemAsId', () => {
    const entries = parseLevelModules({
      './levels/cave-run.json': { default: { name: 'Cave Run', layout: ['.S.', 'GGG'] } },
    });

    expect(entries).toEqual<LevelEntry[]>([
      { id: 'cave-run', name: 'Cave Run', layout: ['.S.', 'GGG'] },
    ]);
  });

  it('moduleWithoutADefaultWrapper-isStillAccepted', () => {
    const entries = parseLevelModules({ './levels/flat.json': { name: 'Flat', layout: ['GGG'] } });
    expect(entries).toEqual<LevelEntry[]>([{ id: 'flat', name: 'Flat', layout: ['GGG'] }]);
  });

  it('moduleWithoutAName-fallsBackToItsFilenameStem', () => {
    const entries = parseLevelModules({ './levels/no-name.json': { default: { layout: ['GGG'] } } });
    expect(entries[0].name).toBe('no-name');
  });

  it('validBackgroundAndMarkersFields-areCarriedOntoTheEntry', () => {
    const markers = [{ col: 0, row: 0, marker: { kind: 'patrolBoundary' } }];
    const entries = parseLevelModules({
      './levels/cave.json': { default: { layout: ['GGG'], background: ['d.'], markers } },
    });
    expect(entries[0].background).toEqual(['d.']);
    expect(entries[0].markers).toEqual(markers);
  });

  it('malformedOptionalFields-dropOnlyThoseFieldsNotTheWholeEntry', () => {
    const entries = parseLevelModules({
      './levels/broken.json': { default: { layout: ['GGG'], background: 'nope', markers: 'nope' } },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].layout).toEqual(['GGG']);
    expect(entries[0].background).toBeUndefined();
    expect(entries[0].markers).toBeUndefined();
  });

  it('emptyLayout-isSkipped', () => {
    expect(parseLevelModules({ './levels/empty.json': { default: { layout: [] } } })).toEqual([]);
  });

  it('nonObjectModule-isSkipped', () => {
    expect(parseLevelModules({ './levels/not-an-object.json': { default: 'nope' } })).toEqual([]);
    expect(parseLevelModules({ './levels/null-module.json': null })).toEqual([]);
  });

  it('multipleModules-areSortedById', () => {
    const entries = parseLevelModules({
      './levels/zulu.json': { default: { layout: ['G'] } },
      './levels/alpha.json': { default: { layout: ['G'] } },
      './levels/mike.json': { default: { layout: ['G'] } },
    });
    expect(entries.map((entry) => entry.id)).toEqual(['alpha', 'mike', 'zulu']);
  });

  it('oneMalformedFile-doesNotSuppressTheWellFormedOnesAroundIt', () => {
    const entries = parseLevelModules({
      './levels/good-one.json': { default: { layout: ['G'] } },
      './levels/broken.json': { default: { layout: 'G' } },
      './levels/good-two.json': { default: { layout: ['#'] } },
    });
    expect(entries.map((entry) => entry.id)).toEqual(['good-one', 'good-two']);
  });
});

describe('parseBlueprintModules', () => {
  it('wellFormedModule-becomesABlueprintWithItsFilenameStemAsId', () => {
    const entries = parseBlueprintModules({
      './blueprints/cave-room.json': { default: { name: 'Cave Room', layout: ['#+#', '#.#'] } },
    });

    expect(entries).toEqual<Blueprint[]>([
      { id: 'cave-room', name: 'Cave Room', layout: ['#+#', '#.#'] },
    ]);
  });

  it('validBackgroundAndMarkersFields-areAttachedIndependently', () => {
    const markers = [{ col: 0, row: 0, marker: { kind: 'connectionPoint' } }];
    const entries = parseBlueprintModules({
      './blueprints/cave.json': { name: 'Cave', layout: ['G'], background: ['d.'], markers },
    });
    expect(entries[0].background).toEqual(['d.']);
    expect(entries[0].markers).toEqual(markers);
  });

  it('malformedOptionalFields-dropOnlyThoseFieldsNotTheWholeEntry', () => {
    const entries = parseBlueprintModules({
      './blueprints/broken.json': { name: 'Broken', layout: ['G'], background: 'nope', markers: 'nope' },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].layout).toEqual(['G']);
    expect(entries[0].background).toBeUndefined();
    expect(entries[0].markers).toBeUndefined();
  });

  it('emptyLayout-isSkipped', () => {
    expect(parseBlueprintModules({ './blueprints/empty.json': { default: { layout: [] } } })).toEqual(
      [],
    );
  });

  it('multipleModules-areSortedById', () => {
    const entries = parseBlueprintModules({
      './blueprints/zulu.json': { default: { layout: ['G'] } },
      './blueprints/alpha.json': { default: { layout: ['G'] } },
    });
    expect(entries.map((entry) => entry.id)).toEqual(['alpha', 'zulu']);
  });
});
