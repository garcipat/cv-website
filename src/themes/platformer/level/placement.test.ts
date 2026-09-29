import { describe, it, expect } from 'vitest';
import { placeAtMarkers, placeWithFactPool, type FactPoolPlacement } from './placement';
import { revealedFactCountFor } from './SkillFactPacing';
import { tileToPixel } from './Terrain';
import type { CollectedFact } from '../types';

const fact = (id: string): CollectedFact => ({
  id,
  sectionId: 'courses',
  sectionLabel: 'Courses',
  data: { title: id, provider: 'p', date: '2024-01', category: 'c' },
  sourceType: 'enemy',
});

describe('placeAtMarkers', () => {
  it('plainMarkers-usesPrefixColRowIdsAndTilePixelPositions', () => {
    const placements = placeAtMarkers(
      [
        { col: 1, row: 2 },
        { col: 3, row: 4 },
      ],
      { idPrefix: 'coin', build: () => ({ kind: 'coin' as const, collected: false }) },
    );
    expect(placements).toEqual([
      { id: 'coin-1-2', ...tileToPixel(1, 2), kind: 'coin', collected: false },
      { id: 'coin-3-4', ...tileToPixel(3, 4), kind: 'coin', collected: false },
    ]);
  });

  it('anIdOverride-usesTheOverrideInsteadOfPrefixColRow', () => {
    const placements = placeAtMarkers([{ col: 7, row: 8, hintId: 'bomb' }], {
      idPrefix: 'sign',
      id: (m) => `sign-${m.hintId}-${m.col}-${m.row}`,
      build: (m) => ({ hintId: m.hintId }),
    });
    expect(placements).toEqual([{ hintId: 'bomb', id: 'sign-bomb-7-8', ...tileToPixel(7, 8) }]);
  });

  it('theBuildCallback-receivesTheMarkerIndex', () => {
    const indices: number[] = [];
    placeAtMarkers(
      [
        { col: 0, row: 0 },
        { col: 1, row: 0 },
      ],
      {
        idPrefix: 'x',
        build: (_m, index) => {
          indices.push(index);
          return {};
        },
      },
    );
    expect(indices).toEqual([0, 1]);
  });
});

describe('placeWithFactPool', () => {
  const pool = [fact('f0'), fact('f1'), fact('f2')];

  it('fewerMarkersThanFacts-spreadsThePoolProportionally', () => {
    const placements = placeWithFactPool<{ col: number; row: number }, FactPoolPlacement>(
      [
        { col: 0, row: 0 },
        { col: 1, row: 0 },
      ],
      pool,
      { idPrefix: 'crate', build: () => ({}) },
    );

    // Compute the expected slices through the same rule the runtime uses.
    const slice = (i: number, n: number) => {
      const start = revealedFactCountFor(i, n, pool.length);
      const end = revealedFactCountFor(i + 1, n, pool.length);
      return pool.slice(start, end);
    };
    const [a, b] = [slice(0, 2), slice(1, 2)];
    expect(placements[0]).toEqual({
      id: 'crate-0-0',
      ...tileToPixel(0, 0),
      fact: a[0],
      extraFacts: a.length > 1 ? a.slice(1) : undefined,
    });
    expect(placements[1]).toEqual({
      id: 'crate-1-0',
      ...tileToPixel(1, 0),
      fact: b[0],
      extraFacts: b.length > 1 ? b.slice(1) : undefined,
    });
  });

  it('oneMarkerAndSeveralFacts-ownsTheWholePool', () => {
    const placements = placeWithFactPool<{ col: number; row: number }, FactPoolPlacement>(
      [{ col: 2, row: 3 }],
      pool,
      { idPrefix: 'enemy-slimeGreen', build: () => ({ type: 'slimeGreen' }) },
    );
    expect(placements).toEqual([
      {
        ...tileToPixel(2, 3),
        type: 'slimeGreen',
        id: 'enemy-slimeGreen-2-3',
        fact: pool[0],
        extraFacts: [pool[1], pool[2]],
      },
    ]);
  });

  it('moreMarkersThanFacts-leavesSomeSlicesEmpty', () => {
    const placements = placeWithFactPool<{ col: number; row: number }, FactPoolPlacement>(
      [
        { col: 0, row: 0 },
        { col: 1, row: 0 },
        { col: 2, row: 0 },
      ],
      [fact('only')],
      { idPrefix: 'crate', build: () => ({}) },
    );
    expect(placements[0].fact).toBeUndefined();
    expect(placements[1].fact).toBeUndefined();
    expect(placements[2].fact).toEqual(fact('only'));
  });

  it('anEmptyPool-givesEveryPlacementNoFact', () => {
    const placements = placeWithFactPool<{ col: number; row: number }, FactPoolPlacement>(
      [{ col: 0, row: 0 }],
      [],
      { idPrefix: 'crate', build: () => ({}) },
    );
    expect(placements[0].fact).toBeUndefined();
    expect(placements[0].extraFacts).toBeUndefined();
  });
});
