import { tileToPixel, RENDERED_TILE_SIZE } from './Terrain';
import { slugify } from './CollectibleMapper';
import type { CVData, Experience, Education, Certificate, Project } from '@/types/cv';
import type { BlockDef } from '../types';

function experienceToBlock(experience: Experience): BlockDef {
  const id = `block-exp-${slugify(`${experience.role}-${experience.company}`)}`;
  return {
    id,
    blockKind: 'crate',
    fact: {
      id,
      sectionId: 'experience',
      sectionLabel: 'Experience',
      data: experience,
      sourceType: 'block',
    },
  };
}

function educationToBlock(education: Education): BlockDef {
  const id = `block-edu-${slugify(`${education.degree}-${education.institution}`)}`;
  return {
    id,
    blockKind: 'crate',
    fact: {
      id,
      sectionId: 'education',
      sectionLabel: 'Education',
      data: education,
      sourceType: 'block',
    },
  };
}

function certificateToBlock(certificate: Certificate): BlockDef {
  const id = `qmark-cert-${slugify(certificate.name)}`;
  return {
    id,
    blockKind: 'questionMark',
    fact: {
      id,
      sectionId: 'certificates',
      sectionLabel: 'Certificates',
      data: certificate,
      sourceType: 'block',
    },
  };
}

function projectToBlock(project: Project): BlockDef {
  const id = `qmark-project-${slugify(project.name)}`;
  return {
    id,
    blockKind: 'questionMark',
    fact: {
      id,
      sectionId: 'projects',
      sectionLabel: 'Projects',
      data: project,
      sourceType: 'block',
    },
  };
}

/**
 * Flattens CVData into one crate per Experience entry, one per Education
 * entry (spec.md FR-009, amended 2026-08-29), and — amended 2026-08-30, live
 * user feedback during step 21 verification — one question-mark bonus-fruit
 * def per Certificate and per Project (moved off enemies; see
 * `EnemyMapper.ts`'s courseToEnemy comment). Rock blocks still carry no CV
 * fact at all — pure level-design filler, unaffected by this change.
 * `placeBlocks` below zips crate/questionMark defs against their respective
 * markers; rock markers still place directly with no def to zip against.
 * Mirrors CollectibleMapper.ts's/EnemyMapper.ts's CVData-flattening pattern.
 */
export function mapCVDataToBlocks(cv: CVData): BlockDef[] {
  return [
    ...cv.experience.map(experienceToBlock),
    ...cv.education.map(educationToBlock),
    ...cv.certificates.map(certificateToBlock),
    ...cv.projects.map(projectToBlock),
  ];
}

export interface BlockPlacement extends BlockDef {
  x: number;
  y: number;
}

/** Hand-authored marker positions for each block kind — see `placeBlocks`
 *  below. */
export interface BlockMarkerPositions {
  crate: readonly { col: number; row: number }[];
  questionMark: readonly { col: number; row: number }[];
  rock: readonly { col: number; row: number }[];
}

/**
 * Places block defs/markers into the level. Crates and question-marks both
 * follow the same hand-authored-marker-zip convention as
 * placeCollectibles/placeEnemies — their defs (from `mapCVDataToBlocks`)
 * zipped against `markers.crate`/`markers.questionMark` in reading order. A
 * question-mark marker beyond the available Certificate/Project defs (or
 * when there are none at all) still becomes a placement — just with no
 * `fact`, matching pre-2026-08-30 behavior — so a level marker is never
 * silently dropped for lack of data (amended 2026-08-30, live user feedback:
 * question-mark blocks now carry Certificates/Projects, moved off enemies —
 * see `mapCVDataToBlocks`'s comment). Rock blocks still have no CVData
 * mapping at all (spec.md FR-021's amendment) — every rock marker becomes a
 * placement directly, with a position-derived id since there's no
 * CVData-derived one available.
 */
export function placeBlocks(defs: BlockDef[], markers: BlockMarkerPositions): BlockPlacement[] {
  const placements: BlockPlacement[] = [];
  const crateDefs = defs.filter((d) => d.blockKind === 'crate');
  const questionMarkDefs = defs.filter((d) => d.blockKind === 'questionMark');

  crateDefs.forEach((def, index) => {
    if (index >= markers.crate.length) return;
    const { col, row } = markers.crate[index];
    const { x, y } = tileToPixel(col, row);
    placements.push({ ...def, x, y });
  });

  markers.questionMark.forEach(({ col, row }, index) => {
    const { x, y } = tileToPixel(col, row);
    const def = questionMarkDefs[index];
    placements.push(def ? { ...def, x, y } : { id: `qmark-${col}-${row}`, blockKind: 'questionMark', x, y });
  });

  for (const { col, row } of markers.rock) {
    const { x, y } = tileToPixel(col, row);
    placements.push({ id: `rock-${col}-${row}`, blockKind: 'rock', x, y });
  }

  return placements;
}

/**
 * The id of the block placement occupying tile (col, row), if any — used by
 * Physics.ts to both treat the tile as solid AND report which specific block
 * a rising player's head just hit (roadmap step 21). `isBlockOccupied` below
 * is now a thin wrapper for call sites that only need the yes/no answer.
 */
export function blockIdAt(
  blockPlacements: readonly BlockPlacement[],
  col: number,
  row: number,
): string | undefined {
  const found = blockPlacements.find(
    (b) => Math.floor(b.x / RENDERED_TILE_SIZE) === col && Math.floor(b.y / RENDERED_TILE_SIZE) === row,
  );
  return found?.id;
}

/**
 * Whether any block placement occupies tile (col, row) — used by
 * Physics.ts to treat block-occupied tiles as solid, the same way terrain
 * tiles already are, even though blocks aren't part of the terrain grid.
 * Added 2026-08-29 (pulled forward from roadmap step 21, per live user
 * feedback): every block is solid from every direction regardless of kind.
 */
export function isBlockOccupied(
  blockPlacements: readonly BlockPlacement[],
  col: number,
  row: number,
): boolean {
  return blockIdAt(blockPlacements, col, row) !== undefined;
}
