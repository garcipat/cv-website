import { tileToPixel } from './Terrain';
import { slugify } from './CollectibleMapper';
import type { CVData, Course } from '@/types/cv';
import type { EnemyDef } from '../types';

/**
 * Amended 2026-08-30 (live user feedback during step 21 verification):
 * Certificates + Projects moved OFF enemies entirely — they're now revealed
 * by the question-mark blocks' bonus fruit instead (see `BlockMapper.ts`'s
 * `certificateToBlock`/`projectToBlock`). Both slime types now guard the
 * same Courses pool, alternating by index so the pool is split roughly
 * evenly between the lightweight 1-hit green slime and the tougher 2-hit
 * purple slime, rather than Courses being green-only. See spec.md's FR-009
 * 2026-08-30 amendment.
 */
function courseToEnemy(course: Course, spriteType: EnemyDef['spriteType']): EnemyDef {
  const id = `enemy-course-${slugify(course.title)}`;
  return {
    id,
    spriteType,
    fact: {
      id,
      sectionId: 'courses',
      sectionLabel: 'Courses',
      data: course,
      sourceType: 'enemy',
    },
  };
}

/**
 * Flattens CVData into one enemy per course, alternating slimeGreen/
 * slimePurple by index (amended 2026-08-30 — see `courseToEnemy`'s comment).
 * Certificates/Projects no longer produce enemies at all. Mirrors
 * CollectibleMapper.ts's coin/fruit split (FR-009). An empty courses array
 * simply produces no enemies.
 */
export function mapCVDataToEnemies(cv: CVData): EnemyDef[] {
  return cv.courses.map((course, index) =>
    courseToEnemy(course, index % 2 === 0 ? 'slimeGreen' : 'slimePurple'),
  );
}

export interface EnemyPlacement extends EnemyDef {
  x: number;
  y: number;
}

/** Hand-authored marker positions for each enemy type, keyed the same way
 *  `EnemyDef.spriteType` is — see `placeEnemies` below. */
export interface EnemyMarkerPositions {
  slimeGreen: readonly { col: number; row: number }[];
  slimePurple: readonly { col: number; row: number }[];
}

/**
 * Places enemy defs at hand-authored marker positions — `E` markers
 * (LevelParser.ts's findGreenEnemyTiles) for `slimeGreen` defs, `M` markers
 * (findPurpleEnemyTiles) for `slimePurple` defs, each type matched to its
 * own marker queue in reading order. The level's marker count decides how
 * many enemies actually appear, not CVData's length: a marker is a slot on
 * the map, and each slot draws the next available fact from `defs` (in
 * `mapCVDataToEnemies`'s Certificates-then-Projects-then-Courses order) as
 * its reward. If a level has fewer markers of a type than CVData has facts
 * of that type, the excess facts simply have no enemy yet — not an error,
 * since a level is built incrementally and isn't expected to represent
 * every CV fact until it's the final design. There is no auto-placement: an
 * enemy's position is always exactly where a level author put its marker.
 */
export function placeEnemies(defs: EnemyDef[], markers: EnemyMarkerPositions): EnemyPlacement[] {
  let greenIndex = 0;
  let purpleIndex = 0;
  const placements: EnemyPlacement[] = [];

  for (const def of defs) {
    const isGreen = def.spriteType === 'slimeGreen';
    const queue = isGreen ? markers.slimeGreen : markers.slimePurple;
    const index = isGreen ? greenIndex : purpleIndex;

    if (index >= queue.length) continue; // no marker left for this fact — not placed yet

    if (isGreen) greenIndex++;
    else purpleIndex++;

    const { col, row } = queue[index];
    const { x, y } = tileToPixel(col, row);
    placements.push({ ...def, x, y });
  }

  return placements;
}
