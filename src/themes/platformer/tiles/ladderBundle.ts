import type { LevelDef } from '../level/LevelData';
import { tileAt } from '../level/Terrain';
import type { TileModule } from './TileModule';

/**
 * `ladderBundle` — the rolled rope-ladder parcel (`@`). Fogged; rendered by
 * 's deployable-item pass, so `drawBand` is `'deployable'` (no terrain
 * draw).
 */

/**
 * Whether this cell is a rolled `ladderBundle` standable from above.
 * Deliberately UNCONDITIONAL on the cell above — unlike the ladder-shaft top, a
 * bundle is a solid little parcel the character stands ON regardless of what is
 * overhead, and it must stay standable throughout its unroll so
 * a character standing on it when it deploys does not fall. It is never `solid`
 * (so it blocks nothing horizontally) and never `climbable` (so a rolled bundle
 * cannot be climbed).
 */
function standableAt(level: LevelDef, col: number, row: number): boolean {
  return tileAt(level, col, row) === 'ladderBundle';
}

export const ladderBundleModule = {
  char: '@',
  fogExempt: false,
  drawBand: 'deployable',
  standableAt,
} as const satisfies TileModule;
