import { tileToPixel, RENDERED_TILE_SIZE } from './Terrain';
import { slugify } from './CollectibleMapper';
import type { CVData, Education, Certificate, Project, Activity, Language } from '@/types/cv';
import type { BlockDef } from '../types';

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

function activityToBlock(activity: Activity): BlockDef {
  const id = `block-activity-${slugify(activity.name)}`;
  return {
    id,
    blockKind: 'crate',
    fact: {
      id,
      sectionId: 'activities',
      sectionLabel: 'Activities',
      data: activity,
      sourceType: 'block',
    },
  };
}

function languageToBlock(language: Language): BlockDef {
  const id = `block-lang-${slugify(language.name)}`;
  return {
    id,
    blockKind: 'crate',
    fact: {
      id,
      sectionId: 'languages',
      sectionLabel: 'Languages',
      data: language,
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
 * Flattens CVData into one crate per Education entry, one per Activity
 * entry, and one per Language entry (spec.md FR-009 — Experience lives on
 * the chest collectible instead, see ChestMapper.ts), plus one question-mark
 * bonus-fruit def per Certificate and per Project. `placeBlocks` below zips
 * crate/questionMark defs against their respective markers; fragileRock
 * markers still place directly with no def to zip against. Mirrors
 * CollectibleMapper.ts's/EnemyMapper.ts's CVData-flattening pattern.
 */
export function mapCVDataToBlocks(cv: CVData): BlockDef[] {
  return [
    ...cv.education.map(educationToBlock),
    ...(cv.activities ?? []).map(activityToBlock),
    ...(cv.languages ?? []).map(languageToBlock),
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
  fragileRock: readonly { col: number; row: number }[];
  /** Optional so every pre-existing caller (production and test) that
   *  doesn't yet place coin-pots keeps compiling unchanged — treated as `[]`
   *  when omitted. */
  coinPot?: readonly { col: number; row: number }[];
}

/**
 * Places block defs/markers into the level. Crates and question-marks both
 * follow the same hand-authored-marker-zip convention as
 * placeCollectibles/placeEnemies — their defs (from `mapCVDataToBlocks`)
 * zipped against `markers.crate`/`markers.questionMark` in reading order. A
 * question-mark marker beyond the available Certificate/Project defs (or
 * when there are none at all) still becomes a placement — just with no
 * `fact` — so a level marker is never silently dropped for lack of data (see
 * `mapCVDataToBlocks`'s comment). FragileRock blocks have no CVData mapping
 * at all (spec.md FR-021) — every fragileRock marker becomes a placement
 * directly, with a position-derived id since there's no CVData-derived one
 * available. coinPot markers follow the same no-CVData-mapping convention
 * as fragileRock: a coin-pot carries no fact of its own — which CV fact it
 * eventually reveals is resolved dynamically at pickup time from the dropped
 * coin's own pool lookup (see `CollectibleMapper.ts`'s `mapCVDataToSkillFactPool`
 * doc comment), not bound to the block at placement time.
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

  for (const { col, row } of markers.fragileRock) {
    const { x, y } = tileToPixel(col, row);
    placements.push({ id: `fragileRock-${col}-${row}`, blockKind: 'fragileRock', x, y });
  }

  for (const { col, row } of markers.coinPot ?? []) {
    const { x, y } = tileToPixel(col, row);
    placements.push({ id: `coinpot-${col}-${row}`, blockKind: 'coinPot', x, y });
  }

  return placements;
}

/**
 * The block placement occupying tile (col, row), if any — the shared lookup
 * `blockIdAt` (just the id) and Physics.ts's per-kind hitbox inset (the
 * whole placement, to read its `blockKind`) both build on.
 */
export function blockAt(
  blockPlacements: readonly BlockPlacement[],
  col: number,
  row: number,
): BlockPlacement | undefined {
  return blockPlacements.find(
    (b) => Math.floor(b.x / RENDERED_TILE_SIZE) === col && Math.floor(b.y / RENDERED_TILE_SIZE) === row,
  );
}

/**
 * The id of the block placement occupying tile (col, row), if any — used by
 * Physics.ts to both treat the tile as solid AND report which specific block
 * a rising player's head just hit. `isBlockOccupied` below is a thin wrapper
 * for call sites that only need the yes/no answer.
 */
export function blockIdAt(
  blockPlacements: readonly BlockPlacement[],
  col: number,
  row: number,
): string | undefined {
  return blockAt(blockPlacements, col, row)?.id;
}

/**
 * Whether any block placement occupies tile (col, row) — used by
 * Physics.ts to treat block-occupied tiles as solid, the same way terrain
 * tiles already are, even though blocks aren't part of the terrain grid.
 * Every block is solid from every direction regardless of kind.
 */
export function isBlockOccupied(
  blockPlacements: readonly BlockPlacement[],
  col: number,
  row: number,
): boolean {
  return blockIdAt(blockPlacements, col, row) !== undefined;
}
