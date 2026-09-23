import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_LEVELS,
  parseLevelModules,
  findLevel,
  LEVELS,
  type LevelEntry,
} from './levelRegistry';
import { LEVEL_1_LAYOUT, LEVEL_1_MARKERS, SCRATCH_LAYOUT } from './level';

describe('BUILT_IN_LEVELS', () => {
  it('listsMainFirstThenEmpty', () => {
    expect(BUILT_IN_LEVELS.map((entry) => entry.id)).toEqual(['main', 'empty']);
  });

  it('mainEntry-carriesTheShippedLayout', () => {
    expect(BUILT_IN_LEVELS[0].layout).toEqual(LEVEL_1_LAYOUT);
  });

  it('mainEntry-carriesTheShippedMarkers', () => {
    expect(BUILT_IN_LEVELS[0].markers).toEqual(LEVEL_1_MARKERS);
  });

  it('emptyEntry-carriesTheScratchLayout', () => {
    expect(BUILT_IN_LEVELS[1].layout).toEqual(SCRATCH_LAYOUT);
  });

  it('emptyEntry-hasNoMarkersSoItIsTreatedAsNewFormatWithNone', () => {
    // `undefined` is what marks a pre-feature file for the `T` generation rule;
    // the scratch layout has no `T`, so either way is harmless, but it must not
    // accidentally gain a markers field.
    expect(BUILT_IN_LEVELS[1].markers).toBeUndefined();
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
    const entries = parseLevelModules({
      './levels/flat.json': { name: 'Flat', layout: ['GGG'] },
    });

    expect(entries).toEqual<LevelEntry[]>([{ id: 'flat', name: 'Flat', layout: ['GGG'] }]);
  });

  it('moduleWithoutAName-fallsBackToItsFilenameStem', () => {
    const entries = parseLevelModules({
      './levels/no-name.json': { default: { layout: ['GGG'] } },
    });

    expect(entries[0].name).toBe('no-name');
  });

  it('multipleModules-areSortedByIdSoTheDropdownOrderIsStable', () => {
    const entries = parseLevelModules({
      './levels/zulu.json': { default: { layout: ['GGG'] } },
      './levels/alpha.json': { default: { layout: ['GGG'] } },
      './levels/mike.json': { default: { layout: ['GGG'] } },
    });

    expect(entries.map((entry) => entry.id)).toEqual(['alpha', 'mike', 'zulu']);
  });

  it('emptyGlobResult-yieldsNoEntries', () => {
    expect(parseLevelModules({})).toEqual([]);
  });

  it('validMarkersField-isCarriedOntoTheEntry', () => {
    const markers = [{ col: 0, row: 0, marker: { kind: 'patrolBoundary' } }];
    const entries = parseLevelModules({
      './levels/cave-run.json': { default: { layout: ['GGG'], markers } },
    });
    expect(entries[0].markers).toEqual(markers);
  });

  it('malformedMarkersField-costsOnlyThatFieldNotTheWholeEntry', () => {
    const entries = parseLevelModules({
      './levels/cave-run.json': {
        default: { name: 'Cave Run', layout: ['GGG'], markers: 'nope' },
      },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].markers).toBeUndefined();
    expect(entries[0].layout).toEqual(['GGG']);
  });

  it('missingMarkersField-meansAPreFeatureFile', () => {
    const entries = parseLevelModules({
      './levels/old.json': { default: { layout: ['T.'] } },
    });
    expect(entries[0].markers).toBeUndefined();
  });

  describe('malformed files are skipped (FR-027)', () => {
    const malformed: Record<string, unknown> = {
      './levels/not-an-object.json': { default: 'nope' },
      './levels/null-module.json': null,
      './levels/no-layout.json': { default: { name: 'No Layout' } },
      './levels/layout-not-an-array.json': { default: { layout: 'GGG' } },
      './levels/layout-of-non-strings.json': { default: { layout: [1, 2, 3] } },
      './levels/empty-layout.json': { default: { layout: [] } },
    };

    Object.entries(malformed).forEach(([path, value]) => {
      it(`${path}-isSkipped`, () => {
        expect(parseLevelModules({ [path]: value })).toEqual([]);
      });
    });

    it('oneMalformedFile-doesNotSuppressTheWellFormedOnesAroundIt', () => {
      const entries = parseLevelModules({
        './levels/good-one.json': { default: { layout: ['GGG'] } },
        './levels/broken.json': { default: { layout: 'GGG' } },
        './levels/good-two.json': { default: { layout: ['.S.'] } },
      });

      expect(entries.map((entry) => entry.id)).toEqual(['good-one', 'good-two']);
    });
  });
});

describe('LEVELS', () => {
  it('startsWithTheBuiltInEntries', () => {
    expect(LEVELS.slice(0, 2)).toEqual(BUILT_IN_LEVELS);
  });

  it('everyEntry-hasANonEmptyLayout', () => {
    LEVELS.forEach((entry) => {
      expect(entry.layout.length).toBeGreaterThan(0);
    });
  });

  it('everyId-isUnique', () => {
    const ids = LEVELS.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('findLevel', () => {
  it('knownId-returnsThatEntry', () => {
    expect(findLevel('empty')?.layout).toEqual(SCRATCH_LAYOUT);
  });

  it('unknownId-returnsUndefined', () => {
    expect(findLevel('no-such-level')).toBeUndefined();
  });
});

describe('parseLevelModules — background field', () => {
  it('moduleWithAValidBackgroundLayout-carriesItOntoTheEntry', () => {
    const modules = {
      './levels/cave.json': {
        name: 'Cave',
        layout: ['.S.', 'GGG'],
        background: ['d.'],
      },
    };
    const [entry] = parseLevelModules(modules);
    expect(entry.background).toEqual(['d.']);
  });

  it('moduleWithNoBackgroundField-hasUndefinedBackgroundOnTheEntry', () => {
    const modules = { './levels/plain.json': { name: 'Plain', layout: ['.S.', 'GGG'] } };
    const [entry] = parseLevelModules(modules);
    expect(entry.background).toBeUndefined();
  });

  it('moduleWithAMalformedBackgroundField-dropsOnlyTheBackgroundFieldNotTheWholeEntry', () => {
    const modules = {
      './levels/broken-bg.json': { name: 'Broken', layout: ['.S.', 'GGG'], background: 'not-an-array' },
    };
    const [entry] = parseLevelModules(modules);
    expect(entry).toBeDefined();
    expect(entry.background).toBeUndefined();
  });

  it('moduleWithTheOldFlatPlacementListFormat-dropsTheBackgroundFieldRatherThanConvertingIt', () => {
    // FR-013: a level saved under the pre-O-014 `BackgroundPlacement[]`
    // format (a flat array of {pieceId, col, row} objects, not a string[]
    // layout) fails the shape check and loads with no background field at
    // all — no attempt to convert placements to cells.
    const modules = {
      './levels/old-format.json': {
        name: 'Old',
        layout: ['.S.', 'GGG'],
        background: [{ pieceId: 'dirtBlock3x3', col: 0, row: 0 }],
      },
    };
    const [entry] = parseLevelModules(modules);
    expect(entry.background).toBeUndefined();
  });

  it('moduleWithTheOldArrayOfArraysBackgroundGridFormat-dropsTheBackgroundFieldRatherThanConvertingIt', () => {
    // The pre-storage-unification-revision `BackgroundGrid` shape (array of
    // arrays of material ids) also fails the new string[] shape check — its
    // rows are arrays, not strings.
    const modules = {
      './levels/pre-revision.json': {
        name: 'PreRevision',
        layout: ['.S.', 'GGG'],
        background: [['dirt', null]],
      },
    };
    const [entry] = parseLevelModules(modules);
    expect(entry.background).toBeUndefined();
  });
});
