import { describe, it, expect, beforeEach } from 'vitest';
import {
  BLUEPRINT_STASH_KEY,
  blueprintId,
  findSavedBlueprint,
  readSavedBlueprints,
  saveBlueprintToStash,
  savedBlueprintsSignal,
} from './blueprintStash';

beforeEach(() => {
  savedBlueprintsSignal.value = [];
});

describe('blueprintId', () => {
  it('nameWithSpacesAndCaps-slugsToLowercaseHyphens', () => {
    expect(blueprintId('Cave Room Two')).toBe('cave-room-two');
  });

  it('nameWithNothingSlugWorthy-fallsBackToBlueprint', () => {
    expect(blueprintId('!!!')).toBe('blueprint');
  });
});

describe('saveBlueprintToStash', () => {
  it('savingABlueprint-storesItUnderItsSluggedId', () => {
    const saved = saveBlueprintToStash('Test Room', ['#G'], []);

    expect(saved).toEqual({ id: 'test-room', name: 'Test Room', layout: ['#G'] });
    expect(readSavedBlueprints()).toEqual([saved]);
  });

  it('emptyBackgroundList-isOmittedFromTheStoredEntry', () => {
    const saved = saveBlueprintToStash('Test Room', ['#'], []);

    expect('background' in saved).toBe(false);
  });

  it('nonEmptyBackgroundList-isStoredAsGiven', () => {
    const background = [{ pieceId: 'dirtColumnTop1x1' as const, col: 1, row: 2 }];
    const saved = saveBlueprintToStash('Test Room', ['#'], background);

    expect(saved.background).toEqual(background);
  });

  it('savingTheSameNameTwice-replacesTheEntryRatherThanAppendingASecond', () => {
    saveBlueprintToStash('Test Room', ['#'], []);
    saveBlueprintToStash('Test Room', ['GG'], []);

    expect(readSavedBlueprints()).toHaveLength(1);
    expect(readSavedBlueprints()[0].layout).toEqual(['GG']);
  });

  it('severalBlueprints-areListedSortedById', () => {
    saveBlueprintToStash('Zeta', ['#'], []);
    saveBlueprintToStash('Alpha', ['#'], []);

    expect(readSavedBlueprints().map((entry) => entry.id)).toEqual(['alpha', 'zeta']);
  });

  it('savingABlueprint-persistsToLocalStorageUnderTheExpectedKey', () => {
    saveBlueprintToStash('Test Room', ['#'], []);

    expect(JSON.parse(localStorage.getItem(BLUEPRINT_STASH_KEY)!)).toEqual([
      { id: 'test-room', name: 'Test Room', layout: ['#'] },
    ]);
  });
});

describe('readSavedBlueprints', () => {
  it('malformedStoredEntry-isSkippedRatherThanReturned', () => {
    // A hand-edited (or older-shape) localStorage entry must not reach the
    // dropdown — same rule levelRegistry.ts applies to broken level JSON.
    savedBlueprintsSignal.value = [
      { id: 'good', name: 'Good', layout: ['#'] },
      { id: 'bad', name: 'Bad', layout: [] },
    ];

    expect(readSavedBlueprints().map((entry) => entry.id)).toEqual(['good']);
  });
});

describe('findSavedBlueprint', () => {
  it('knownId-returnsThatBlueprint', () => {
    const saved = saveBlueprintToStash('Test Room', ['#'], []);

    expect(findSavedBlueprint('test-room')).toEqual(saved);
  });

  it('unknownId-returnsUndefined', () => {
    expect(findSavedBlueprint('nope')).toBeUndefined();
  });
});
