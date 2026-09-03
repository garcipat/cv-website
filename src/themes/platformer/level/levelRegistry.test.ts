import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_LEVELS,
  parseLevelModules,
  findLevel,
  LEVELS,
  type LevelEntry,
} from './levelRegistry';
import { LEVEL_1_LAYOUT, SCRATCH_LAYOUT } from './level';

describe('BUILT_IN_LEVELS', () => {
  it('listsMainFirstThenEmpty', () => {
    expect(BUILT_IN_LEVELS.map((entry) => entry.id)).toEqual(['main', 'empty']);
  });

  it('mainEntry-carriesTheShippedLayout', () => {
    expect(BUILT_IN_LEVELS[0].layout).toEqual(LEVEL_1_LAYOUT);
  });

  it('emptyEntry-carriesTheScratchLayout', () => {
    expect(BUILT_IN_LEVELS[1].layout).toEqual(SCRATCH_LAYOUT);
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
  it('moduleWithAValidBackgroundArray-carriesItOntoTheEntry', () => {
    const modules = {
      './levels/cave.json': {
        name: 'Cave',
        layout: ['.S.', 'GGG'],
        background: [{ pieceId: 'dirtColumnA', col: 0, row: 0 }],
      },
    };
    const [entry] = parseLevelModules(modules);
    expect(entry.background).toEqual([{ pieceId: 'dirtColumnA', col: 0, row: 0 }]);
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
});
