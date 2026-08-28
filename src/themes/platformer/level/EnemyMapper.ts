import { tileToPixel, groundColumns, groundRowForColumn } from './Terrain';
import { slugify } from './CollectibleMapper';
import type { LevelDef } from './LevelData';
import type { CVData, Certificate, Project } from '@/types/cv';
import type { EnemyDef } from '../types';

function certificateToEnemy(certificate: Certificate): EnemyDef {
  const id = `enemy-cert-${slugify(certificate.name)}`;
  return {
    id,
    spriteType: 'slimeGreen',
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

/**
 * Flattens CVData into one enemy per certificate (rendered as
 * slime_green.png) and one per project (rendered as slime_purple.png) —
 * mirrors CollectibleMapper.ts's coin/fruit split (FR-009). Empty
 * certificates/projects arrays simply produce no enemies of that kind.
 */
export function mapCVDataToEnemies(cv: CVData): EnemyDef[] {
  return [...cv.certificates.map(certificateToEnemy), ...cv.projects.map(projectToEnemy)];
}

export interface EnemyPlacement extends EnemyDef {
  x: number;
  y: number;
}

/**
 * Spacing between placed enemies, offset from CollectibleMapper.ts's
 * COLLECTIBLE_SPACING_COLS (which effectively starts at offset 0) so
 * enemies land on different ground columns than coins/fruits — both mappers
 * scan the same groundColumns() candidate list, and without this offset
 * they'd tend to pick the same columns and visually stack. A placement
 * nicety for this step's static render, not a hard requirement — step 17's
 * level1 rework (walls/ledges) will likely reposition enemies more
 * deliberately anyway.
 */
const ENEMY_SPACING_COLS = 3;
const ENEMY_COLUMN_OFFSET = 1;

export function placeEnemies(defs: EnemyDef[], level: LevelDef): EnemyPlacement[] {
  const candidateCols = groundColumns(level);

  const spacedCols = candidateCols.filter(
    (_, i) => i % ENEMY_SPACING_COLS === ENEMY_COLUMN_OFFSET % ENEMY_SPACING_COLS,
  );
  const pool =
    defs.length <= spacedCols.length && spacedCols.length > 0 ? spacedCols : candidateCols;

  return defs.map((def, i) => {
    const col = pool[i % pool.length];
    const row = groundRowForColumn(level, col) ?? 0; // pool only ever contains verified ground columns
    const { x, y } = tileToPixel(col, row);
    return { ...def, x, y };
  });
}
