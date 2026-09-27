import { RENDERED_TILE_SIZE } from './Terrain';
import { slugId } from './ids';
import { cvFact } from './cvFacts';
import { placeAtMarkers, placeWithFactPool } from './placement';
import type { CVData, Education, Certificate, Project, Activity, Language } from '@/types/cv';
import type { BlockDef, CollectedFact } from '../types';

function educationToBlock(education: Education): BlockDef {
  const id = slugId('block-edu', education.degree, education.institution);
  return {
    id,
    blockKind: 'crate',
    fact: cvFact('education', 'Education', 'block', id, education),
  };
}

function activityToBlock(activity: Activity): BlockDef {
  const id = slugId('block-activity', activity.name);
  return {
    id,
    blockKind: 'crate',
    fact: cvFact('activities', 'Activities', 'block', id, activity),
  };
}

function languageToBlock(language: Language): BlockDef {
  const id = slugId('block-lang', language.name);
  return {
    id,
    blockKind: 'crate',
    fact: cvFact('languages', 'Languages', 'block', id, language),
  };
}

function certificateToBlock(certificate: Certificate): BlockDef {
  const id = slugId('qmark-cert', certificate.name);
  return {
    id,
    blockKind: 'questionMark',
    fact: cvFact('certificates', 'Certificates', 'block', id, certificate),
  };
}

function projectToBlock(project: Project): BlockDef {
  const id = slugId('qmark-project', project.name);
  return {
    id,
    blockKind: 'questionMark',
    fact: cvFact('projects', 'Projects', 'block', id, project),
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
  /** Any Education/Activity/Language facts beyond `fact` itself — populated
   *  only when this level has fewer crate markers than crate facts, so a
   *  single crate's position-based slice of the pool (see `placeBlocks`
   *  below) spans more than one fact. Undefined (not `[]`) when there's
   *  nothing extra, matching how `fact` itself is undefined rather than
   *  present-but-empty. Only ever set for `blockKind === 'crate'`. */
  extraFacts?: CollectedFact[];
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
  /** Optional for the same reason as `coinPot` above — every pre-existing
   *  caller that doesn't yet place potion-pots keeps compiling unchanged. */
  potionPot?: readonly { col: number; row: number }[];
  /** Optional for the same reason as `coinPot` above — every pre-existing
   *  caller that doesn't yet place bomb-pots keeps compiling unchanged. */
  bombPot?: readonly { col: number; row: number }[];
}

/**
 * Places block defs/markers into the level, all through the one
 * `placeAtMarkers` loop (FR-003/FR-005).
 *
 * Crates own a fixed, position-based slice of the Education/Activity/Language
 * pool decided by `placeWithFactPool` (proportional across however many crates
 * the level has, the same formula `level/SkillFactPacing.ts` already uses for
 * coins): with one marker and several facts that marker's slice is the whole
 * pool; with more markers than facts some markers' slices are empty. The
 * slice is a fixed, load-time assignment, not resolved by play order.
 *
 * Question-marks follow the hand-authored-marker-zip convention — their defs
 * (from `mapCVDataToBlocks`) zipped against `markers.questionMark` in reading
 * order; a marker beyond the available Certificate/Project defs still becomes
 * a placement with no fact, so a level marker is never silently dropped.
 * FragileRock and the three pot kinds have no CVData mapping at all: every
 * marker becomes a placement directly, with a position-derived id.
 */
export function placeBlocks(defs: BlockDef[], markers: BlockMarkerPositions): BlockPlacement[] {
  const questionMarkDefs = defs.filter((d) => d.blockKind === 'questionMark');
  const cratePool = defs.filter((d) => d.blockKind === 'crate').map((d) => d.fact!);

  return [
    ...placeWithFactPool<{ col: number; row: number }, BlockPlacement>(markers.crate, cratePool, {
      idPrefix: 'crate',
      build: () => ({ blockKind: 'crate' }),
    }),

    ...placeAtMarkers<{ col: number; row: number }, BlockPlacement>(markers.questionMark, {
      idPrefix: 'qmark',
      id: (marker, index) =>
        questionMarkDefs[index]?.id ?? `qmark-${marker.col}-${marker.row}`,
      build: (_marker, index) => {
        const def = questionMarkDefs[index];
        return def ? { blockKind: def.blockKind, fact: def.fact } : { blockKind: 'questionMark' };
      },
    }),

    ...placeAtMarkers<{ col: number; row: number }, BlockPlacement>(markers.fragileRock, {
      idPrefix: 'fragileRock',
      build: () => ({ blockKind: 'fragileRock' as const }),
    }),

    ...placeAtMarkers<{ col: number; row: number }, BlockPlacement>(markers.coinPot ?? [], {
      idPrefix: 'coinpot',
      build: () => ({ blockKind: 'coinPot' as const }),
    }),

    ...placeAtMarkers<{ col: number; row: number }, BlockPlacement>(markers.potionPot ?? [], {
      idPrefix: 'potionpot',
      build: () => ({ blockKind: 'potionPot' as const }),
    }),

    ...placeAtMarkers<{ col: number; row: number }, BlockPlacement>(markers.bombPot ?? [], {
      idPrefix: 'bombpot',
      build: () => ({ blockKind: 'bombPot' as const }),
    }),
  ];
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
