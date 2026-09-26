import { RENDERED_TILE_SIZE, TILE_SIZE, markerAt } from '../level/Terrain';
import { pickVariant } from '../shared/variants';
import type { StaticObjectEntry } from './spriteRects';
import type { TileDrawContext, TileModule } from './TileModule';

/**
 * `stalactite` — the ceiling-hanging cave decoration (`⊤`). Non-solid,
 * non-climbable, fogged; drawn in the terrain band. Owns its variant/twin
 * geometry + draw relocated from `engine/StaticObjectsCatalog.ts`/`Renderer.ts`
 * (US4/T034); `entities/hazards/FallingStalactite.ts` imports the twin geometry
 * back (an allowed `entities/ → tiles/` edge).
 */

/**
 * Size variants for `stalactite` — a level author places one tile each; which
 * size (large or twin) renders at a given cell is picked deterministically from
 * its own position (see `pickVariant`), the same way a bush picks among its
 * sizes.
 */
const STALACTITE_VARIANTS: StaticObjectEntry[] = [
  { sx: 51, sy: 0, width: 16, height: 17 }, // large
  { sx: 0, sy: 19, width: 16, height: 16 }, // twin
];

/** Picks a `stalactite` tile's large-vs-twin sprite deterministically from its
 *  own position. */
export function stalactiteEntry(col: number, row: number): StaticObjectEntry {
  return pickVariant(STALACTITE_VARIANTS, col, row);
}

/**
 * Whether the decoration at `(col, row)` renders the twin variant (the second
 * `STALACTITE_VARIANTS` entry), using the same position hash as
 * `stalactiteEntry` so a falling-stalactite hazard's variant always matches the
 * decoration at its cell (O-027 research D7).
 */
export function isStalactiteTwin(col: number, row: number): boolean {
  return pickVariant(STALACTITE_VARIANTS, col, row) === STALACTITE_VARIANTS[1];
}

/**
 * The two stalactites of the twin variant (`decorations.png`, region
 * `sx=0, sy=19, w=16, h=16`), split exactly at x=8. The left one is taller (the
 * larger); the right one is shorter. A falling-stalactite hazard on a twin cell
 * uses whichever half its column parity selects (even → left, odd → right) for
 * both its sprite and its half-tile hitbox (O-027 FR-019).
 */
export const TWIN_LEFT_RECT: Required<StaticObjectEntry> = { sx: 0, sy: 19, width: 8, height: 16 };
export const TWIN_RIGHT_RECT: Required<StaticObjectEntry> = { sx: 8, sy: 19, width: 8, height: 10 };

function draw(rc: TileDrawContext): void {
  const { ctx, level, col, row, destX, destY, images } = rc;
  const decorations = images.decorations;
  if (!decorations) return;
  // A cell carrying a `fallingStalactite` marker is rendered by that hazard's
  // own `draw` — which shows the large sprite while hanging, renders nothing
  // once it has fallen, and keeps only the survivor half of a twin. Drawing the
  // static decoration here too would leave a ghost on the cell after the
  // stalactite falls.
  if (markerAt(level, col, row)?.kind === 'fallingStalactite') return;
  const entry = stalactiteEntry(col, row);
  ctx.drawImage(
    decorations, entry.sx, entry.sy, entry.width ?? TILE_SIZE, entry.height ?? TILE_SIZE,
    destX, destY, RENDERED_TILE_SIZE, RENDERED_TILE_SIZE,
  );
}

export const stalactiteModule = {
  char: '⊤',
  fogExempt: false,
  drawBand: 'terrain',
  draw,
} as const satisfies TileModule;
