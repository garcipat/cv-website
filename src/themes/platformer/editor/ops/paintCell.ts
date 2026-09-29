import { type GrowResult } from './growGrid';
import { paintGridCell } from './paintGrid';
import { HAZARD_CHARS, type TileChar, type HazardFacing } from '../../level/LevelParser';
import { TERRAIN_CHARS } from '../../tiles/registry';
import type { HazardKind } from '../../entities/hazards';
import { isSolid } from '../../level/Terrain';

/** Same shape as `growGrid`'s `GrowResult` — `paintCell` always returns a
 * grown-and-painted grid plus whatever shift growth applied, so callers
 * (see `EditorCanvas.tsx`) handle both the same way. */
export type PaintResult = GrowResult<TileChar>;

const HAZARD_KEYS = Object.keys(HAZARD_CHARS) as TileChar[];

/** The registered characters per hazard kind, in registration order — the
 * grouping that lets a single-character kind (the spear, and 's floor
 * spike) never cycle while a multi-character kind (the spike) still does. */
const HAZARD_CHARS_BY_KIND: Record<string, TileChar[]> = {};
for (const char of HAZARD_KEYS) {
  const kind = HAZARD_CHARS[char]!.hazardType;
  (HAZARD_CHARS_BY_KIND[kind] ??= []).push(char);
}

/** The character for each facing WITHIN a single kind — a per-kind inverse of
 * `HAZARD_CHARS`. Keying it per kind (not by facing alone) is required for
 * correctness: the spike's `^`, the spear's `¦`, and the floor spike's `A`
 * all face `'up'`, and a facing-only map would collide between them. */
function charForFacing(kind: HazardKind): Partial<Record<HazardFacing, TileChar>> {
  const map: Partial<Record<HazardFacing, TileChar>> = {};
  for (const char of HAZARD_CHARS_BY_KIND[kind] ?? []) {
    map[HAZARD_CHARS[char]!.facing] = char;
  }
  return map;
}

/** Auto-detect priority: floor spikes (needs solid ground below) are the
 * common case, checked first; ceiling and the two wall-mounted facings
 * follow. Also the order a fresh placement's facing is picked from when
 * more than one neighbor is solid. */
const FACING_PRIORITY: readonly HazardFacing[] = ['up', 'down', 'right', 'left'];

/** A spike hazard with no solid neighbor at all (placed over open air) has
 * nothing to auto-detect — this is the arbitrary but consistent fallback,
 * same convention as `firstUnusedSignChar`'s "fall back rather than fail"
 * edge case below. */
const FALLBACK_FACING: HazardFacing = 'up';

function isSolidCharAt(grid: readonly TileChar[][], col: number, row: number): boolean {
  const char = grid[row]?.[col];
  if (char === undefined) return false;
  const tile = TERRAIN_CHARS[char];
  return tile !== undefined && isSolid(tile);
}

/**
 * Which facings currently have a solid neighbor to attach to, in
 * `FACING_PRIORITY` order — `'up'` needs solid ground below, `'down'` needs
 * a solid ceiling above, `'right'` needs a solid wall to the left (mounted
 * on it, pointing away), `'left'` needs one to the right. Recomputed fresh
 * from the CURRENT grid on every call, so painting more terrain around an
 * already-placed spike changes what the next click cycles through.
 */
function validHazardFacings(grid: readonly TileChar[][], col: number, row: number): HazardFacing[] {
  const solidBelow = isSolidCharAt(grid, col, row + 1);
  const solidAbove = isSolidCharAt(grid, col, row - 1);
  const solidLeft = isSolidCharAt(grid, col - 1, row);
  const solidRight = isSolidCharAt(grid, col + 1, row);
  const validity: Record<HazardFacing, boolean> = {
    up: solidBelow,
    down: solidAbove,
    right: solidLeft,
    left: solidRight,
  };
  return FACING_PRIORITY.filter((facing) => validity[facing]);
}

/**
 * The character to actually paint for a multi-character hazard kind (the
 * spike), given the cell's existing character if it is of the SAME kind.
 * A fresh placement (no same-kind existing character) auto-picks the first
 * neighbor-backed facing in `FACING_PRIORITY` order, falling back to
 * `FALLBACK_FACING` if nothing around it is solid. Cycling (clicking an
 * already-placed hazard again) advances to the next neighbor-backed facing
 * after the current one, wrapping only through facings that are currently
 * valid — same "recompute and cycle" shape as `firstUnusedSignChar`, but
 * validity here means "has a solid neighbor to attach to". If the existing
 * facing itself is no longer valid (the author changed the surrounding
 * terrain since placing it), cycling starts from the first currently-valid
 * facing instead of counting from a facing that no longer applies.
 */
function nextHazardChar(
  grid: readonly TileChar[][],
  col: number,
  row: number,
  existing: TileChar | undefined,
  kind: HazardKind,
): TileChar {
  const chars = HAZARD_CHARS_BY_KIND[kind] ?? [];
  const charFor = charForFacing(kind);
  const validFacings = validHazardFacings(grid, col, row).filter(
    (facing) => charFor[facing] !== undefined,
  );
  if (validFacings.length === 0) return charFor[FALLBACK_FACING] ?? chars[0];

  const existingFacing = existing !== undefined ? HAZARD_CHARS[existing]?.facing : undefined;
  if (existingFacing === undefined) return charFor[validFacings[0]]!;

  const existingIndex = validFacings.indexOf(existingFacing);
  const nextFacing =
    existingIndex === -1
      ? validFacings[0]
      : validFacings[(existingIndex + 1) % validFacings.length];
  return charFor[nextFacing]!;
}

/**
 * Paints `tool` into cell `(col, row)`, growing the grid first if the
 * target is out of bounds — the copy/grow/write body itself lives in the
 * shared `paintGridCell`; only the foreground's own rules stay here.
 *
 * When `tool` is `'S'` (spawn), every other cell currently holding `'S'` is
 * cleared back to `'.'` in the same call — this guarantees exactly one spawn
 * marker exists at a time without ever blocking placement or prompting a
 * warning (spec / ).
 *
 * A hazard tool's character/cycle is computed from the CURRENT grid first
 * (reading `(col, row)` and its neighbours, which growth only ever borders
 * with empty cells, so the answer is identical to reading it post-growth),
 * then handed to `paintGridCell`.
 */
export function paintCell(
  grid: TileChar[][],
  col: number,
  row: number,
  tool: TileChar,
): PaintResult {
  if (tool === 'S') {
    const cleared = grid.map((r) => r.map((c) => (c === 'S' ? '.' : c)));
    return paintGridCell(cleared, col, row, 'S', '.', true);
  }

  if (HAZARD_KEYS.includes(tool)) {
    const kind = HAZARD_CHARS[tool]!.hazardType;
    const chars = HAZARD_CHARS_BY_KIND[kind] ?? [];
    const existing = grid[row]?.[col];
    let value: TileChar;
    if (chars.length === 1) {
      // A single-character kind (the spear, and 's floor spike) always
      // paints its one character and never cycles orientation — see nextHazardChar's own doc comment for why cycling
      // exists at all for a multi-character kind.
      value = chars[0];
    } else {
      // Only cycle when the cell already holds the SAME kind; a different
      // kind is replaced by the tool's kind rather than cycling the
      // existing one.
      const existingForKind =
        existing !== undefined && HAZARD_CHARS[existing]?.hazardType === kind
          ? existing
          : undefined;
      value = nextHazardChar(grid, col, row, existingForKind, kind);
    }
    return paintGridCell(grid, col, row, value, '.', true);
  }

  return paintGridCell(grid, col, row, tool, '.', true);
}
