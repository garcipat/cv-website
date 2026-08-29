import { tileToPixel, RENDERED_TILE_SIZE } from './Terrain';
import { slugify } from './CollectibleMapper';
import type { CVData, Experience, Education } from '@/types/cv';
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

/**
 * Flattens CVData into one crate per Experience entry and one per Education
 * entry (spec.md FR-009, amended 2026-08-29) — question-mark and rock
 * blocks carry no CV fact, so they have no mapping function here;
 * `placeBlocks` below places them directly from their level markers
 * instead. Mirrors CollectibleMapper.ts's/EnemyMapper.ts's CVData-flattening
 * pattern.
 */
export function mapCVDataToBlocks(cv: CVData): BlockDef[] {
  return [...cv.experience.map(experienceToBlock), ...cv.education.map(educationToBlock)];
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
 * Places block defs/markers into the level. Crates follow the same
 * hand-authored-marker-zip convention as placeCollectibles/placeEnemies —
 * `defs` (from mapCVDataToBlocks) zipped against `markers.crate` in reading
 * order, extra defs simply not placed yet (a marker is a slot on the map;
 * see placeEnemies's doc comment for the full rationale). Question-mark and
 * rock blocks have no CVData mapping (spec.md FR-021's amendment) — every
 * one of their markers becomes a placement directly, with no def to zip
 * against and no "fewer markers than defs" case possible; each gets a
 * position-derived id since there's no CVData-derived one available.
 */
export function placeBlocks(defs: BlockDef[], markers: BlockMarkerPositions): BlockPlacement[] {
  const placements: BlockPlacement[] = [];
  const crateDefs = defs.filter((d) => d.blockKind === 'crate');

  crateDefs.forEach((def, index) => {
    if (index >= markers.crate.length) return;
    const { col, row } = markers.crate[index];
    const { x, y } = tileToPixel(col, row);
    placements.push({ ...def, x, y });
  });

  for (const { col, row } of markers.questionMark) {
    const { x, y } = tileToPixel(col, row);
    placements.push({ id: `qmark-${col}-${row}`, blockKind: 'questionMark', x, y });
  }

  for (const { col, row } of markers.rock) {
    const { x, y } = tileToPixel(col, row);
    placements.push({ id: `rock-${col}-${row}`, blockKind: 'rock', x, y });
  }

  return placements;
}

/**
 * Whether any block placement occupies tile (col, row) — used by
 * Physics.ts to treat block-occupied tiles as solid, the same way terrain
 * tiles already are, even though blocks aren't part of the terrain grid.
 * Added 2026-08-29 (pulled forward from roadmap step 21, per live user
 * feedback): every block is solid from every direction regardless of kind
 * — there's no crack/break/convert reaction yet, so there's nothing to
 * distinguish between kinds here.
 */
export function isBlockOccupied(
  blockPlacements: readonly BlockPlacement[],
  col: number,
  row: number,
): boolean {
  return blockPlacements.some(
    (b) => b.x / RENDERED_TILE_SIZE === col && b.y / RENDERED_TILE_SIZE === row,
  );
}
