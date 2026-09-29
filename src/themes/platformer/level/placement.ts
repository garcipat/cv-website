import { tileToPixel } from './Terrain';
import { revealedFactCountFor } from './SkillFactPacing';
import type { CollectedFact } from '../types';

/**
 * The one marker→placement contract. Every
 * `level/*Mapper.ts` place function routes through `placeAtMarkers` (directly
 * or via `placeWithFactPool`); no mapper keeps its own `markers.map(...)`
 * loop. `placeWithFactPool` delegates to `placeAtMarkers`, so there is exactly
 * one loop and one id/position convention.
 */

/** A marker's grid position — the minimum `placeAtMarkers` needs. */
export interface MarkerPosition {
  col: number;
  row: number;
}

export interface PlaceAtMarkersDescriptor<M extends MarkerPosition, P> {
  /** Used for the default `id` when no `id` override is given. */
  idPrefix: string;
  /** Override for ids embedding more than prefix+cell (sign hintId, hazard type, chest def id). */
  id?: (marker: M, index: number) => string;
  /** Everything except the helper-assigned `id`/`x`/`y`. */
  build: (marker: M, index: number) => Omit<P, 'id' | 'x' | 'y'>;
}

/**
 * Places one `P` per marker: `id` = `id?.(marker, index) ?? \`${idPrefix}-${col}-${row}\``,
 * `x`/`y` = `tileToPixel(marker.col, marker.row)`. `id`/`x`/`y` are always
 * authoritative (build's fields are spread first).
 */
export function placeAtMarkers<M extends MarkerPosition, P>(
  markers: readonly M[],
  descriptor: PlaceAtMarkersDescriptor<M, P>,
): P[] {
  return markers.map((marker, index) => {
    const { x, y } = tileToPixel(marker.col, marker.row);
    const id =
      descriptor.id?.(marker, index) ?? `${descriptor.idPrefix}-${marker.col}-${marker.row}`;
    return { ...descriptor.build(marker, index), id, x, y } as P;
  });
}

/**
 * A placement that owns a fixed, position-based slice of a fact pool.
 *
 * Note: unlike the contract sketch, this deliberately does NOT extend
 * `MarkerPosition`. The only two fact-pool placements — `BlockPlacement` and
 * `EnemyPlacement` — carry no `col`/`row` (their consumers read `x`/`y`), and
 * the shared loop must not add fields the runtime placements never had
 *. `MarkerPosition` is the *input* marker's shape, not the output's.
 */
export interface FactPoolPlacement {
  id: string;
  x: number;
  y: number;
  fact?: CollectedFact;
  extraFacts?: CollectedFact[];
}

/**
 * `placeAtMarkers` plus the one proportional fact-pool slice. For
 * marker `i` of `n` with pool length `m`: `start =
 * revealedFactCountFor(i, n, m)`, `end = revealedFactCountFor(i + 1, n, m)`,
 * `slice = pool.slice(start, end)`; then `fact = slice[0]`, `extraFacts =
 * slice.length > 1 ? slice.slice(1) : undefined`. Implemented on top of
 * `placeAtMarkers`, so this is not a second loop. Used by `placeBlocks`
 * (crates) and `placeEnemies` (green slimes) only.
 */
export function placeWithFactPool<M extends MarkerPosition, P extends FactPoolPlacement>(
  markers: readonly M[],
  pool: readonly CollectedFact[],
  descriptor: {
    idPrefix: string;
    build: (marker: M, index: number) => Omit<P, keyof FactPoolPlacement>;
  },
): P[] {
  const total = markers.length;
  return placeAtMarkers<M, P>(markers, {
    idPrefix: descriptor.idPrefix,
    build: (marker, index) => {
      const start = revealedFactCountFor(index, total, pool.length);
      const end = revealedFactCountFor(index + 1, total, pool.length);
      const slice = pool.slice(start, end);
      return {
        ...descriptor.build(marker, index),
        fact: slice[0],
        extraFacts: slice.length > 1 ? slice.slice(1) : undefined,
      } as Omit<P, 'id' | 'x' | 'y'>;
    },
  });
}
