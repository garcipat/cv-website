import { slugId } from './ids';
import { cvFact } from './cvFacts';
import { placeAtMarkers, placeWithFactPool } from './placement';
import type { CVData, Course } from '@/types/cv';
import type { EnemyDef, CollectedFact } from '../types';

/**
 * Certificates and Projects are revealed by the question-mark blocks' bonus
 * fruit, not by enemies (see `BlockMapper.ts`'s
 * `certificateToBlock`/`projectToBlock`). Every course is a green slime that
 * reveals CV content; purple slimes carry no CV content and instead drop a key
 * on defeat (see `entities/KeyPickup.ts` and `PlatformerPage.tsx`'s defeat handler).
 */
function courseToEnemy(course: Course, type: EnemyDef['type']): EnemyDef {
  const id = slugId('enemy-course', course.title);
  return {
    id,
    type,
    fact: cvFact('courses', 'Courses', 'enemy', id, course),
  };
}

/**
 * Flattens CVData into one green slime enemy per course. Every course maps to
 * slimeGreen; purple slimes carry no CV content. Certificates/Projects do not
 * produce enemies. An empty courses array simply produces no enemies.
 */
export function mapCVDataToEnemies(cv: CVData): EnemyDef[] {
  return cv.courses.map((course) => courseToEnemy(course, 'slimeGreen'));
}

export interface EnemyPlacement extends EnemyDef {
  x: number;
  y: number;
  /** Any course facts beyond `fact` itself — populated only when this level
   * has fewer green markers than courses, so a single slime's position-based
   * slice of the pool (see `placeEnemies` below) spans more than one course.
   * Undefined (not `[]`) when there's nothing extra, matching how `fact`
   * itself is undefined rather than present-but-empty. */
  extraFacts?: CollectedFact[];
}

/** Hand-authored marker positions for each enemy type, keyed the same way
 * `EnemyDef.type` is — see `placeEnemies` below. */
export interface EnemyMarkerPositions {
  slimeGreen: readonly { col: number; row: number }[];
  slimePurple: readonly { col: number; row: number }[];
  bee: readonly { col: number; row: number }[];
}

/**
 * Places enemy defs at hand-authored marker positions, all through the one
 * `placeAtMarkers` loop — `M` markers (LevelParser.ts's
 * findGreenEnemyTiles) become green slimes, `m` markers
 * (findPurpleEnemyTiles) become purple ones, `q` markers (findBeeTiles)
 * become bees. There is no auto-placement: an enemy's position is always
 * exactly where a level author put its marker.
 *
 * Green slimes own a fixed, position-based slice of the course pool via
 * `placeWithFactPool` (proportional across however many green slimes the level
 * has): with one marker and several courses that marker's slice is the whole
 * pool; with more markers than courses some markers' slices are empty — a
 * fully functional, killable enemy that simply has nothing to award.
 * Certificates/Projects do not produce enemies. Purple slimes and bees carry
 * no CV content at all, so every placement is a plain, position-derived enemy.
 */
export function placeEnemies(defs: EnemyDef[], markers: EnemyMarkerPositions): EnemyPlacement[] {
  const pool = defs.filter((def) => def.type === 'slimeGreen').map((def) => def.fact!);

  return [
    ...placeWithFactPool<{ col: number; row: number }, EnemyPlacement>(markers.slimeGreen, pool, {
      idPrefix: 'enemy-slimeGreen',
      build: () => ({ type: 'slimeGreen' }),
    }),
    ...placeAtMarkers<{ col: number; row: number }, EnemyPlacement>(markers.slimePurple, {
      idPrefix: 'enemy-slimePurple',
      build: () => ({ type: 'slimePurple' }),
    }),
    ...placeAtMarkers<{ col: number; row: number }, EnemyPlacement>(markers.bee, {
      idPrefix: 'enemy-bee',
      build: () => ({ type: 'bee' }),
    }),
  ];
}
