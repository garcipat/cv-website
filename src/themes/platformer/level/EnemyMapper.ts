import { tileToPixel } from './Terrain';
import { slugify } from './CollectibleMapper';
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

/**
 * The ordered pool of course facts a defeated green slime can reveal — same
 * facts and order as `mapCVDataToEnemies`' defs, just exposed as a pool
 * rather than zipped 1:1 to a specific enemy. Every def `mapCVDataToEnemies`
 * produces has a fact (see its own doc comment), so mapping `.fact` directly
 * is exhaustive. `PlatformerPage.tsx` resolves how many of this pool's
 * entries have been revealed so far — and therefore which one a given
 * defeated enemy reveals — via `level/SkillFactPacing.ts`'s
 * `revealedFactCountFor`, proportionally across every green slime the level
 * has, mirroring how `skillFactPool` already works for coins.
 */
export function mapCVDataToEnemyFactPool(cv: CVData): CollectedFact[] {
  return mapCVDataToEnemies(cv).map((d) => d.fact!);
}

export interface EnemyPlacement extends EnemyDef {
  x: number;
  y: number;
}

/** Hand-authored marker positions for each enemy type, keyed the same way
 *  `EnemyDef.type` is — see `placeEnemies` below. */
export interface EnemyMarkerPositions {
  slimeGreen: readonly { col: number; row: number }[];
  slimePurple: readonly { col: number; row: number }[];
}

/**
 * Every marker on the map becomes an enemy — placement is not capped at
 * CVData's length; only the first enemies of each color reveal CVData. A
 * marker beyond its color's def count still places a fully functional,
 * killable enemy — it just has no `fact` to award (see `EnemyDef.fact`'s
 * doc comment), same convention `BlockMapper.ts`'s question-mark/
 * fragileRock blocks already use for CV-mapping-free entities.
 */
function plainEnemyDef(type: EnemyDef['type'], col: number, row: number): EnemyDef {
  return { id: `enemy-plain-${type}-${col}-${row}`, type };
}

/**
 * Places one enemy per marker of `type`, in reading order: the first
 * `defs.length` markers each get the next def (and its `fact`) in order;
 * any further marker gets a `plainEnemyDef` instead. Shared by both colors
 * in `placeEnemies` below.
 */
function placeQueue(
  defs: EnemyDef[],
  markers: readonly { col: number; row: number }[],
  type: EnemyDef['type'],
): EnemyPlacement[] {
  return markers.map((marker, index) => {
    const def = defs[index] ?? plainEnemyDef(type, marker.col, marker.row);
    const { x, y } = tileToPixel(marker.col, marker.row);
    return { ...def, x, y };
  });
}

/**
 * Places enemy defs at hand-authored marker positions — `E` markers
 * (LevelParser.ts's findGreenEnemyTiles) for `slimeGreen` defs, `M` markers
 * (findPurpleEnemyTiles) for `slimePurple` defs, each type matched to its
 * own marker queue in reading order. There is no auto-placement: an enemy's
 * position is always exactly where a level author put its marker. If a
 * level has fewer markers of a type than CVData has facts of that type, the
 * excess facts simply have no enemy yet — not an error, since a level is
 * built incrementally and isn't expected to represent every CV fact until
 * it's the final design.
 */
export function placeEnemies(defs: EnemyDef[], markers: EnemyMarkerPositions): EnemyPlacement[] {
  const greenDefs = defs.filter((def) => def.type === 'slimeGreen');
  const purpleDefs = defs.filter((def) => def.type === 'slimePurple');

  return [
    ...placeQueue(greenDefs, markers.slimeGreen, 'slimeGreen'),
    ...placeQueue(purpleDefs, markers.slimePurple, 'slimePurple'),
  ];
}
