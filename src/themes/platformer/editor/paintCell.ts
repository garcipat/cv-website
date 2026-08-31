import { growGrid, type GrowResult } from './growGrid';
import { SIGN_CHARS, type TileChar } from '../level/LevelParser';

/** Same shape as `growGrid`'s `GrowResult` — `paintCell` always returns a
 *  grown-and-painted grid plus whatever shift growth applied, so callers
 *  (see `EditorCanvas.tsx`) handle both the same way. */
export type PaintResult = GrowResult;

const SIGN_KEYS = Object.keys(SIGN_CHARS) as TileChar[];

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
  } else {
    nextGrid[targetRow][targetCol] = tool;
  }

  return { grid: nextGrid, colShift, rowShift };
}
