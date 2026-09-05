import { tileToPixel } from './Terrain';
import { slugify } from './CollectibleMapper';
import { revealedFactCountFor } from './SkillFactPacing';
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
  const id = `enemy-course-${slugify(course.title)}`;
  return {
    id,
    type,
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
   *  has fewer green markers than courses, so a single slime's position-based
   *  slice of the pool (see `placeGreenSlimes` below) spans more than one
   *  course. Undefined (not `[]`) when there's nothing extra, matching how
   *  `fact` itself is undefined rather than present-but-empty. */
  extraFacts?: CollectedFact[];
}

/** Hand-authored marker positions for each enemy type, keyed the same way
 *  `EnemyDef.type` is — see `placeEnemies` below. */
export interface EnemyMarkerPositions {
  slimeGreen: readonly { col: number; row: number }[];
  slimePurple: readonly { col: number; row: number }[];
}

/**
 * Places every green marker, each owning a FIXED slice of the course pool
 * decided by its position among every green marker — proportional across
 * however many green slimes the level has, via the same formula
 * (`revealedFactCountFor`) `level/SkillFactPacing.ts` already uses for
 * coins. This is a fixed, load-time assignment, not resolved by play order:
 * the same marker always owns the same course(s) no matter which order the
 * player defeats them in — only "already given" (`EnemyState.rewardGiven`)
 * needs tracking at defeat time.
 *
 * With one marker and several courses, that one marker's slice is the WHOLE
 * pool (`fact` plus every other course in `extraFacts`) — defeating it
 * reveals everything. With more markers than courses, some markers' slices
 * are empty (`fact` and `extraFacts` both undefined) — a fully functional,
 * killable enemy that simply has nothing to award, the same convention
 * `BlockMapper.ts`'s question-mark/fragileRock blocks already use for
 * CV-mapping-free entities.
 */
function placeGreenSlimes(
  markers: readonly { col: number; row: number }[],
  pool: readonly CollectedFact[],
): EnemyPlacement[] {
  const total = markers.length;
  return markers.map((marker, index) => {
    const start = revealedFactCountFor(index, total, pool.length);
    const end = revealedFactCountFor(index + 1, total, pool.length);
    const slice = pool.slice(start, end);
    const { x, y } = tileToPixel(marker.col, marker.row);
    return {
      id: `enemy-slimeGreen-${marker.col}-${marker.row}`,
      type: 'slimeGreen',
      fact: slice[0],
      extraFacts: slice.length > 1 ? slice.slice(1) : undefined,
      x,
      y,
    };
  });
}

/** Places every purple marker — a purple slime carries no CV content at all
 *  (see this file's top doc comment), so every placement is a plain,
 *  position-derived enemy with no fact. */
function placePurpleSlimes(markers: readonly { col: number; row: number }[]): EnemyPlacement[] {
  return markers.map((marker) => {
    const { x, y } = tileToPixel(marker.col, marker.row);
    return { id: `enemy-slimePurple-${marker.col}-${marker.row}`, type: 'slimePurple', x, y };
  });
}

/**
 * Places enemy defs at hand-authored marker positions — `E` markers
 * (LevelParser.ts's findGreenEnemyTiles) become green slimes, `M` markers
 * (findPurpleEnemyTiles) become purple ones. There is no auto-placement: an
 * enemy's position is always exactly where a level author put its marker.
 * Every green marker's course fact(s) come from a fixed, position-based
 * slice of the course pool (see `placeGreenSlimes`) rather than a 1:1 zip
 * against `defs` — `defs` here only supplies that pool (every green def
 * always has a `fact`, see `mapCVDataToEnemies`'s doc comment).
 */
export function placeEnemies(defs: EnemyDef[], markers: EnemyMarkerPositions): EnemyPlacement[] {
  const pool = defs.filter((def) => def.type === 'slimeGreen').map((def) => def.fact!);

  return [...placeGreenSlimes(markers.slimeGreen, pool), ...placePurpleSlimes(markers.slimePurple)];
}
