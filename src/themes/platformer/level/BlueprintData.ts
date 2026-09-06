import type { BackgroundPlacement } from './LevelData';

/**
 * A named, reusable room authored on the Level Editor's own blueprint canvas
 * (roadmap step 44a). Deliberately the SAME shape a saved level file has —
 * `layout` is `exportLayout`'s cropped `readonly string[]`, `background` is
 * `LevelDef.background` — so importLayout/parseLevel/cropLevelForExport all
 * apply unchanged and step 44c's placement can parse a blueprint with the
 * same per-character mapping it already uses for levels. Purely editor-time:
 * see `specs/S-006-platformer-theme/plans/2026-09-06-blueprint-rooms-design.md`.
 */
export interface Blueprint {
  /** Slug, also the filename stem once step 44c writes real files — mirrors
   *  `LevelEntry`'s id. */
  id: string;
  name: string;
  layout: readonly string[];
  background?: BackgroundPlacement[];
}

/** The blank entry the Blueprint Select dropdown offers, mirroring the level
 *  registry's built-in `empty`: one empty cell, nothing painted. Unlike
 *  `SCRATCH_LAYOUT` it carries no `S` — a blueprint has no spawn. */
export const BLANK_BLUEPRINT: Blueprint = { id: 'new', name: 'new', layout: ['.'] };

const isLayout = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((row) => typeof row === 'string');

const isBackgroundPlacement = (value: unknown): value is BackgroundPlacement =>
  value !== null &&
  typeof value === 'object' &&
  typeof (value as { pieceId?: unknown }).pieceId === 'string' &&
  typeof (value as { col?: unknown }).col === 'number' &&
  typeof (value as { row?: unknown }).row === 'number';

/**
 * Whether `value` is a well-formed `Blueprint`. Same "skip anything
 * malformed" role `levelRegistry.ts`'s validation plays for level JSON: the
 * 44a store is hand-editable `localStorage`, and one bad entry must not take
 * the whole dropdown (or the editor) down with it.
 */
export function isBlueprint(value: unknown): value is Blueprint {
  if (value === null || typeof value !== 'object') return false;
  const { id, name, layout, background } = value as {
    id?: unknown;
    name?: unknown;
    layout?: unknown;
    background?: unknown;
  };
  if (typeof id !== 'string' || typeof name !== 'string') return false;
  if (!isLayout(layout)) return false;
  if (background !== undefined && !(Array.isArray(background) && background.every(isBackgroundPlacement)))
    return false;
  return true;
}
