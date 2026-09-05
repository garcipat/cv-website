import { tileToPixel, RENDERED_TILE_SIZE } from './Terrain';
import { slugify } from './CollectibleMapper';
import { revealedFactCountFor } from './SkillFactPacing';
import type { CVData, Education, Certificate, Project, Activity, Language } from '@/types/cv';
import type { BlockDef, CollectedFact } from '../types';

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
  /** Any Education/Activity/Language facts beyond `fact` itself — populated
   *  only when this level has fewer crate markers than crate facts, so a
   *  single crate's position-based slice of the pool (see `placeCrates`
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
}

/**
 * Places every crate marker, each owning a FIXED slice of the
 * Education/Activity/Language pool decided by its position among every
 * crate marker — proportional across however many crates the level has, via
 * the same formula (`revealedFactCountFor`) `level/SkillFactPacing.ts`
 * already uses for coins. This is a fixed, load-time assignment, not
 * resolved by play order: the same marker always owns the same fact(s) no
 * matter which order the player breaks them in — only "already broken"
 * (`BlockState`'s `hitsTaken`) needs tracking at hit time. Mirrors
 * `EnemyMapper.ts`'s `placeGreenSlimes`.
 *
 * With one marker and several facts, that one marker's slice is the WHOLE
 * pool (`fact` plus every other fact in `extraFacts`) — breaking it reveals
 * everything. With more markers than facts, some markers' slices are empty
 * (`fact` and `extraFacts` both undefined) — a fully functional, breakable
 * crate that simply has nothing to award.
 */
function placeCrates(
  markers: readonly { col: number; row: number }[],
  pool: readonly CollectedFact[],
): BlockPlacement[] {
  const total = markers.length;
  return markers.map((marker, index) => {
    const start = revealedFactCountFor(index, total, pool.length);
    const end = revealedFactCountFor(index + 1, total, pool.length);
    const slice = pool.slice(start, end);
    const { x, y } = tileToPixel(marker.col, marker.row);
    return {
      id: `crate-${marker.col}-${marker.row}`,
      blockKind: 'crate',
      fact: slice[0],
      extraFacts: slice.length > 1 ? slice.slice(1) : undefined,
      x,
      y,
    };
  });
}

/**
 * Places block defs/markers into the level. Question-marks follow the same
 * hand-authored-marker-zip convention as placeCollectibles/placeEnemies —
 * their defs (from `mapCVDataToBlocks`) zipped against `markers.questionMark`
 * in reading order. A question-mark marker beyond the available
 * Certificate/Project defs (or when there are none at all) still becomes a
 * placement — just with no `fact` — so a level marker is never silently
 * dropped for lack of data (see `mapCVDataToBlocks`'s comment). Crates
 * instead use `placeCrates`'s fixed, position-based pool slice (see its doc
 * comment) rather than a 1:1 zip against `defs` — `defs` here only supplies
 * that pool (every crate def always has a `fact`, see `mapCVDataToBlocks`'s
 * comment). FragileRock blocks have no CVData mapping at all (spec.md
 * FR-021) — every fragileRock marker becomes a placement directly, with a
 * position-derived id since there's no CVData-derived one available. coinPot
 * markers follow the same no-CVData-mapping convention as fragileRock: a
 * coin-pot carries no fact of its own — which CV fact it eventually reveals
 * is resolved dynamically at pickup time from the dropped coin's own pool
 * lookup (see `CollectibleMapper.ts`'s `mapCVDataToSkillFactPool` doc
 * comment), not bound to the block at placement time.
 */
export function placeBlocks(defs: BlockDef[], markers: BlockMarkerPositions): BlockPlacement[] {
  const placements: BlockPlacement[] = [];
  const questionMarkDefs = defs.filter((d) => d.blockKind === 'questionMark');

  const cratePool = defs.filter((d) => d.blockKind === 'crate').map((d) => d.fact!);
  placements.push(...placeCrates(markers.crate, cratePool));

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
