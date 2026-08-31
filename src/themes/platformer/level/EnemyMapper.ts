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
 * Every marker on the map becomes an enemy — placement is no longer capped
 * at CVData's length (amended 2026-08-31, live user feedback: "the enemies
 * should not be capped, just the first enemies should reveal CVData"). A
 * marker beyond its color's def count still places a fully functional,
 * killable enemy — it just has no `fact` to award (see `EnemyDef.fact`'s
 * doc comment), same convention `BlockMapper.ts`'s question-mark/
 * fragileRock blocks already use for CV-mapping-free entities.
 */
function plainEnemyDef(spriteType: EnemyDef['spriteType'], col: number, row: number): EnemyDef {
  return { id: `enemy-plain-${spriteType}-${col}-${row}`, spriteType };
}

/**
 * Places one enemy per marker of `spriteType`, in reading order: the first
 * `defs.length` markers each get the next def (and its `fact`) in order;
 * any further marker gets a `plainEnemyDef` instead. Shared by both colors
 * in `placeEnemies` below.
 */
function placeQueue(
  defs: EnemyDef[],
  markers: readonly { col: number; row: number }[],
  spriteType: EnemyDef['spriteType'],
): EnemyPlacement[] {
  return markers.map((marker, index) => {
    const def = defs[index] ?? plainEnemyDef(spriteType, marker.col, marker.row);
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
  const greenDefs = defs.filter((def) => def.spriteType === 'slimeGreen');
  const purpleDefs = defs.filter((def) => def.spriteType === 'slimePurple');

  return [
    ...placeQueue(greenDefs, markers.slimeGreen, 'slimeGreen'),
    ...placeQueue(purpleDefs, markers.slimePurple, 'slimePurple'),
  ];
}
