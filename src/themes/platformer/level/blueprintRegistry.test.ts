import { describe, it, expect } from 'vitest';
import { parseBlueprintModules, findBlueprint, BLUEPRINTS } from './blueprintRegistry';
import { blueprintFileJson } from '../editor/saveBlueprintFile';
import type { Blueprint } from './BlueprintData';

describe('parseBlueprintModules', () => {
  it('wellFormedModule-becomesAnEntryWithItsFilenameStemAsId', () => {
    const entries = parseBlueprintModules({
      './blueprints/cave-room.json': { default: { name: 'Cave Room', layout: ['#+#', '#.#'] } },
    });

    expect(entries).toEqual<Blueprint[]>([
      { id: 'cave-room', name: 'Cave Room', layout: ['#+#', '#.#'] },
    ]);
  });

  it('moduleWithoutADefaultWrapper-isStillAccepted', () => {
    const entries = parseBlueprintModules({
      './blueprints/flat.json': { name: 'Flat', layout: ['GGG'] },
    });

    expect(entries).toEqual<Blueprint[]>([{ id: 'flat', name: 'Flat', layout: ['GGG'] }]);
  });

  it('moduleWithoutAName-fallsBackToItsFilenameStem', () => {
    const entries = parseBlueprintModules({
      './blueprints/no-name.json': { default: { layout: ['GGG'] } },
    });

    expect(entries[0].name).toBe('no-name');
  });

  it('multipleModules-areSortedByIdSoTheDropdownOrderIsStable', () => {
    const entries = parseBlueprintModules({
      './blueprints/zulu.json': { default: { layout: ['G'] } },
      './blueprints/alpha.json': { default: { layout: ['G'] } },
      './blueprints/mike.json': { default: { layout: ['G'] } },
    });

    expect(entries.map((entry) => entry.id)).toEqual(['alpha', 'mike', 'zulu']);
  });

  it('emptyGlobResult-yieldsNoEntries', () => {
    expect(parseBlueprintModules({})).toEqual([]);
  });

  it('validBackgroundArray-isCarriedOntoTheEntry', () => {
    const entries = parseBlueprintModules({
      './blueprints/cave.json': {
        name: 'Cave',
        layout: ['G'],
        background: [{ pieceId: 'dirtColumnTop1x1', col: -1, row: 2 }],
      },
    });

    expect(entries[0].background).toEqual([{ pieceId: 'dirtColumnTop1x1', col: -1, row: 2 }]);
  });

  it('malformedBackgroundField-dropsOnlyThatFieldNotTheWholeEntry', () => {
    const entries = parseBlueprintModules({
      './blueprints/broken-bg.json': { name: 'Broken', layout: ['G'], background: 'nope' },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].background).toBeUndefined();
  });

  it('savedBlueprintFileContents-roundTripBackIntoAnEntryWithTheSameLayout', () => {
    // SC-012's blueprint counterpart: a file the editor wrote has to be a file
    // this registry accepts, connection point characters included.
    const contents = JSON.parse(blueprintFileJson('Cave Room', ['#+#', '#.#'], []));
    const entries = parseBlueprintModules({ './blueprints/cave-room.json': { default: contents } });

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Cave Room');
    expect(entries[0].layout).toEqual(['#+#', '#.#']);
  });

  describe('malformed files are skipped rather than taking the editor down', () => {
    const malformed: Record<string, unknown> = {
      './blueprints/not-an-object.json': { default: 'nope' },
      './blueprints/null-module.json': null,
      './blueprints/no-layout.json': { default: { name: 'No Layout' } },
      './blueprints/layout-not-an-array.json': { default: { layout: 'GGG' } },
      './blueprints/layout-of-non-strings.json': { default: { layout: [1, 2, 3] } },
      './blueprints/empty-layout.json': { default: { layout: [] } },
    };

    Object.entries(malformed).forEach(([path, value]) => {
      it(`${path}-isSkipped`, () => {
        expect(parseBlueprintModules({ [path]: value })).toEqual([]);
      });
    });

    it('oneMalformedFile-doesNotSuppressTheWellFormedOnesAroundIt', () => {
      const entries = parseBlueprintModules({
        './blueprints/good-one.json': { default: { layout: ['G'] } },
        './blueprints/broken.json': { default: { layout: 'G' } },
        './blueprints/good-two.json': { default: { layout: ['#'] } },
      });

      expect(entries.map((entry) => entry.id)).toEqual(['good-one', 'good-two']);
    });
  });
});

describe('BLUEPRINTS', () => {
  it('everyEntry-hasANonEmptyLayout', () => {
    BLUEPRINTS.forEach((entry) => {
      expect(entry.layout.length).toBeGreaterThan(0);
    });
  });

  it('everyId-isUnique', () => {
    const ids = BLUEPRINTS.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hasNoBuiltInEntries-unlikeLEVELS', () => {
    // A blueprint library starts empty: there is no shipped room, and the
    // dropdown's blank `new` entry comes from BLANK_BLUEPRINT, not from here.
    expect(BLUEPRINTS.every((entry) => entry.id !== 'new')).toBe(true);
  });
});

describe('findBlueprint', () => {
  it('unknownId-returnsUndefined', () => {
    expect(findBlueprint('no-such-blueprint')).toBeUndefined();
  });
});
