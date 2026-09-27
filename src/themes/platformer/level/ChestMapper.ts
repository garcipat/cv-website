import { slugId } from './ids';
import { cvFact } from './cvFacts';
import { placeAtMarkers } from './placement';
import type { CVData, Experience } from '@/types/cv';
import type { ChestDef } from '../types';

function experienceToChest(experience: Experience): ChestDef {
  const id = slugId('chest-exp', experience.role, experience.company);
  return {
    id,
    fact: cvFact('experience', 'Experience', 'chest', id, experience),
  };
}

/**
 * Flattens CVData into one chest per Experience entry (spec.md FR-009/023)
 * — Experience is treated as the CV's "most valuable" section, worth its own
 * dedicated main-objective collectible rather than sharing the crate
 * mechanic with Education/Activities/Languages. Mirrors
 * BlockMapper.ts's/EnemyMapper.ts's CVData-flattening pattern. An empty
 * `experience` array simply produces no chests.
 *
 * Reverses `cv.experience` before mapping: per `src/types/cv.ts`'s doc
 * comment, `experience` is stored newest-first, but `placeChests` below zips
 * defs against markers in level-reading order (left-to-right, near spawn to
 * farther away per level.ts) — without the reversal, the closest/first-reached
 * chest would reveal the newest job and the farthest/last chest the oldest
 * one. Reversing makes the chests read as a chronological career progression
 * as the visitor plays further: oldest job first, newest job last.
 * `[...cv.experience].reverse()` (not `cv.experience.reverse()`) since
 * `Array.prototype.reverse()` mutates in place and `cv.experience` must not
 * be altered.
 */
export function mapCVDataToChests(cv: CVData): ChestDef[] {
  return [...cv.experience].reverse().map(experienceToChest);
}

export interface ChestPlacement extends ChestDef {
  /** Placement tile column (markers already carry it; no level data change). */
  col: number;
  /** Placement tile row. */
  row: number;
  x: number;
  y: number;
}

/**
 * Places chest defs at hand-authored `$` marker positions (LevelParser.ts's
 * findChestTiles) through the one `placeAtMarkers` loop, zipped against
 * `defs` in reading order — same marker-is-a-slot convention as
 * placeCollectibles/placeEnemies/placeBlocks' crate zip (no auto-placement;
 * excess defs beyond the available markers are simply not placed yet). The
 * marker slice is `markers.slice(0, defs.length)` so today's exact
 * def-driven zip is preserved; `id` comes from the def (the helper's default
 * `chest-${col}-${row}` is unused here), while `col`/`row` come from the
 * marker.
 */
export function placeChests(
  defs: ChestDef[],
  markers: readonly { col: number; row: number }[],
): ChestPlacement[] {
  return placeAtMarkers<{ col: number; row: number }, ChestPlacement>(
    markers.slice(0, defs.length),
    {
      idPrefix: 'chest',
      id: (_marker, index) => defs[index].id,
      build: (marker, index) => ({
        fact: defs[index].fact,
        col: marker.col,
        row: marker.row,
      }),
    },
  );
}
