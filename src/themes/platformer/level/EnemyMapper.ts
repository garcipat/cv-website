import { tileToPixel } from './Terrain';
import { slugify } from './CollectibleMapper';
import type { CVData, Certificate, Project, Course } from '@/types/cv';
import type { EnemyDef } from '../types';

function certificateToEnemy(certificate: Certificate): EnemyDef {
  const id = `enemy-cert-${slugify(certificate.name)}`;
  return {
    id,
    // Purple (2 hit points, roadmap step 18) now guards the combined
    // Certificates + Projects pool (amended 2026-08-29 — see
    // projectToEnemy's comment) instead of Certificates alone.
    spriteType: 'slimePurple',
    fact: {
      id,
      sectionId: 'certificates',
      sectionLabel: 'Certificates',
      data: certificate,
      sourceType: 'enemy',
    },
  };
}

function projectToEnemy(project: Project): EnemyDef {
  const id = `enemy-project-${slugify(project.name)}`;
  return {
    id,
    // Amended 2026-08-29: Projects moved from the green pool to the purple
    // pool, alongside Certificates — Courses (courseToEnemy below) took
    // over the green pool instead, since Courses' 12 CV entries fit green's
    // lightweight single-hit mechanic better than sharing the crate block
    // mechanic with Experience/Education. See spec.md's FR-009 amendment.
    spriteType: 'slimePurple',
    fact: {
      id,
      sectionId: 'projects',
      sectionLabel: 'Projects',
      data: project,
      sourceType: 'enemy',
    },
  };
}

function courseToEnemy(course: Course): EnemyDef {
  const id = `enemy-course-${slugify(course.title)}`;
  return {
    id,
    // Green (1 hit point) now carries Courses (amended 2026-08-29) — the
    // lightweight enemy for the largest single-hit pool. See
    // projectToEnemy's comment above for the full rationale.
    spriteType: 'slimeGreen',
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
 * Flattens CVData into one enemy per certificate and one per project (both
 * rendered as slime_purple.png, the tougher 2-hit enemy — amended
 * 2026-08-29; previously projects were slimeGreen) plus one enemy per
 * course (rendered as slime_green.png, the easier 1-hit enemy, replacing
 * its original Projects mapping). Mirrors CollectibleMapper.ts's coin/fruit
 * split (FR-009). Empty certificates/projects/courses arrays simply
 * produce no enemies of that kind.
 */
export function mapCVDataToEnemies(cv: CVData): EnemyDef[] {
  return [
    ...cv.certificates.map(certificateToEnemy),
    ...cv.projects.map(projectToEnemy),
    ...cv.courses.map(courseToEnemy),
  ];
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
