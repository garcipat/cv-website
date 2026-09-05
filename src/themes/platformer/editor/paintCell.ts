import { growGrid, type GrowResult } from './growGrid';
import { SIGN_CHARS, TERRAIN_CHARS, HAZARD_CHARS, type TileChar, type HazardFacing } from '../level/LevelParser';
import { isSolid } from '../level/Terrain';

/** Same shape as `growGrid`'s `GrowResult` — `paintCell` always returns a
 *  grown-and-painted grid plus whatever shift growth applied, so callers
 *  (see `EditorCanvas.tsx`) handle both the same way. */
export type PaintResult = GrowResult;

const SIGN_KEYS = Object.keys(SIGN_CHARS) as TileChar[];

const HAZARD_KEYS = Object.keys(HAZARD_CHARS) as TileChar[];

/** The character for each facing — the inverse of `HAZARD_CHARS`, built once
 *  since every facing has exactly one registered character. */
const CHAR_FOR_FACING = Object.fromEntries(
  HAZARD_KEYS.map((char) => [HAZARD_CHARS[char]!.facing, char]),
) as Record<HazardFacing, TileChar>;

/** Auto-detect priority: floor spikes (needs solid ground below) are the
 *  common case, checked first; ceiling and the two wall-mounted facings
 *  follow. Also the order a fresh placement's facing is picked from when
 *  more than one neighbor is solid. */
const FACING_PRIORITY: readonly HazardFacing[] = ['up', 'down', 'right', 'left'];

/** A spike hazard with no solid neighbor at all (placed over open air) has
 *  nothing to auto-detect — this is the arbitrary but consistent fallback,
 *  same convention as `firstUnusedSignChar`'s "fall back rather than fail"
 *  edge case below. */
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
 * The character to actually paint when `tool` is a registered hazard
 * marker. A fresh placement (the target cell doesn't already hold a
 * hazard) auto-picks the first neighbor-backed facing in
 * `FACING_PRIORITY` order, falling back to `FALLBACK_FACING` if nothing
 * around it is solid. Cycling (clicking an already-placed hazard again)
 * advances to the next neighbor-backed facing after the current one,
 * wrapping only through facings that are currently valid — same
 * "recompute and cycle" shape as `firstUnusedSignChar`, but validity here
 * means "has a solid neighbor to attach to", not "not already used
 * elsewhere". If the existing facing itself is no longer valid (the
 * author changed the surrounding terrain since placing it), cycling
 * starts from the first currently-valid facing instead of counting from a
 * facing that no longer applies.
 */
function nextHazardChar(grid: readonly TileChar[][], col: number, row: number, existing: TileChar): TileChar {
  const validFacings = validHazardFacings(grid, col, row);
  if (validFacings.length === 0) return CHAR_FOR_FACING[FALLBACK_FACING];

  const existingFacing = HAZARD_CHARS[existing]?.facing;
  if (existingFacing === undefined) return CHAR_FOR_FACING[validFacings[0]];

  const existingIndex = validFacings.indexOf(existingFacing);
  const nextFacing = existingIndex === -1 ? validFacings[0] : validFacings[(existingIndex + 1) % validFacings.length];
  return CHAR_FOR_FACING[nextFacing];
}

/**
 * The character to actually paint when `tool` is a registered sign marker.
 * Scans the WHOLE grid (excluding the target cell itself, which is about to
 * be overwritten) for hints already placed elsewhere, then returns the
 * first registered hint — starting from `startFrom` and wrapping — that
 * ISN'T already used elsewhere. Falls back to `startFrom` itself only if
 * every registered hint is already placed somewhere else (an expected-rare
 * edge case, not a hard failure).
 */
function firstUnusedSignChar(
  grid: TileChar[][],
  excludeCol: number,
  excludeRow: number,
  startFrom: TileChar,
): TileChar {
  const usedElsewhere = new Set<TileChar>();
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (r === excludeRow && c === excludeCol) continue;
      const char = grid[r][c];
      if (SIGN_KEYS.includes(char)) usedElsewhere.add(char);
    }
  }
  // Defensive: both call sites always pass a valid sign key today, so
  // `indexOf` can't actually return -1 — but if it ever did, the modulo
  // indexing below would read `SIGN_KEYS[-1]` (`undefined`) and paint that
  // into the grid, so clamp to 0 rather than let that happen silently.
  const startIndex = Math.max(0, SIGN_KEYS.indexOf(startFrom));
  for (let i = 0; i < SIGN_KEYS.length; i++) {
    const candidate = SIGN_KEYS[(startIndex + i) % SIGN_KEYS.length];
    if (!usedElsewhere.has(candidate)) return candidate;
  }
  return startFrom;
}

/**
 * Paints `tool` into cell `(col, row)`, growing the grid first if the
 * target is out of bounds (see `growGrid`). When `tool` is `'S'` (spawn),
 * every other cell currently holding `'S'` is cleared back to `'.'` in the
 * same call — this guarantees exactly one spawn marker exists at a time
 * without ever blocking placement or prompting a warning (spec User Story
 * 3 / FR-006).
 */
export function paintCell(
  grid: TileChar[][],
  col: number,
  row: number,
  tool: TileChar,
): PaintResult {
  const { grid: grownGrid, colShift, rowShift } = growGrid(grid, col, row);
  const targetCol = col + colShift;
  const targetRow = row + rowShift;

  const nextGrid = grownGrid.map((r) => [...r]);

  if (tool === 'S') {
    for (let r = 0; r < nextGrid.length; r++) {
      for (let c = 0; c < nextGrid[r].length; c++) {
        if (nextGrid[r][c] === 'S') {
          nextGrid[r][c] = '.';
        }
      }
    }
  }

  if (SIGN_KEYS.includes(tool)) {
    const existing = nextGrid[targetRow][targetCol];
    // Cycling (clicking an already-placed sign again) starts its search
    // right AFTER the existing digit; a fresh placement (anything else
    // already there) starts at the tool's own default digit.
    const startFrom = SIGN_KEYS.includes(existing)
      ? SIGN_KEYS[(SIGN_KEYS.indexOf(existing) + 1) % SIGN_KEYS.length]
      : tool;
    nextGrid[targetRow][targetCol] = firstUnusedSignChar(nextGrid, targetCol, targetRow, startFrom);
  } else if (HAZARD_KEYS.includes(tool)) {
    const existing = nextGrid[targetRow][targetCol];
    nextGrid[targetRow][targetCol] = nextHazardChar(nextGrid, targetCol, targetRow, existing);
  } else {
    nextGrid[targetRow][targetCol] = tool;
  }

  return { grid: nextGrid, colShift, rowShift };
}
