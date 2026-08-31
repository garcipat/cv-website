import { tileToPixel } from './Terrain';
import { slugify } from './CollectibleMapper';
import type { CVData, Experience } from '@/types/cv';
import type { ChestDef } from '../types';

function experienceToChest(experience: Experience): ChestDef {
  const id = `chest-exp-${slugify(`${experience.role}-${experience.company}`)}`;
  return {
    id,
    fact: {
      id,
      sectionId: 'experience',
      sectionLabel: 'Experience',
      data: experience,
      sourceType: 'chest',
    },
  };
}

/**
 * Flattens CVData into one chest per Experience entry (spec.md FR-009/023,
 * added 2026-08-30) — Experience is treated as the CV's "most valuable"
 * section, worth its own dedicated main-objective collectible rather than
 * sharing the crate mechanic with Education/Activities/Languages. Mirrors
 * BlockMapper.ts's/EnemyMapper.ts's CVData-flattening pattern. An empty
 * `experience` array simply produces no chests.
 *
 * Reverses `cv.experience` before mapping (2026-08-30, live user feedback):
 * per `src/types/cv.ts`'s doc comment, `experience` is stored newest-first,
 * but `placeChests` below zips defs against markers in level-reading order
 * (left-to-right, near spawn to farther away per level.ts) — without the
 * reversal, the closest/first-reached chest would reveal the newest job and
 * the farthest/last chest the oldest one. Reversing makes the chests read as
 * a chronological career progression as the visitor plays further: oldest
 * job first, newest job last. `[...cv.experience].reverse()` (not
 * `cv.experience.reverse()`) since `Array.prototype.reverse()` mutates in
 * place and `cv.experience` must not be altered.
 */
export function mapCVDataToChests(cv: CVData): ChestDef[] {
  return [...cv.experience].reverse().map(experienceToChest);
}

export interface ChestPlacement extends ChestDef {
  x: number;
  y: number;
}

/**
 * Places chest defs at hand-authored `T` marker positions (LevelParser.ts's
 * findChestTiles), zipped against `defs` in reading order — same
 * marker-is-a-slot convention as placeCollectibles/placeEnemies/placeBlocks'
 * crate zip (no auto-placement; excess defs beyond the available markers
 * simply aren't placed yet).
 */
export function placeChests(
  defs: ChestDef[],
  markers: readonly { col: number; row: number }[],
): ChestPlacement[] {
  const placements: ChestPlacement[] = [];
  defs.forEach((def, index) => {
    if (index >= markers.length) return;
    const { col, row } = markers[index];
    const { x, y } = tileToPixel(col, row);
    placements.push({ ...def, x, y });
  });
  return placements;
}
