import type { CVData } from '@/types/cv';
import type { TileChar } from '../../level/LevelParser';
import {
  findBeeTiles,
  findBombPotTiles,
  findCheckpointTiles,
  findChestTiles,
  findCoinPotTiles,
  findCoinTiles,
  findCrateTiles,
  findFragileRockTiles,
  findGreenEnemyTiles,
  findHazardTiles,
  findLadderBundleTiles,
  findOptionalSpawnTile,
  findPotionPotTiles,
  findPurpleEnemyTiles,
  findQuestionMarkTiles,
  findSignTiles,
} from '../../level/LevelParser';
import type { LevelDef, MarkerGrid } from '../../level/LevelData';
import { RENDERED_TILE_SIZE, tileToPixel } from '../../level/Terrain';
import {
  PLAYER_FOOT_PADDING,
  PLAYER_HIT_REACTION_SECONDS,
  PLAYER_RENDERED_SIZE,
} from '../../entities/Player';
import type { PlayerState } from '../../entities/Player';
import { MAX_HALF_HEARTS } from '../../entities/Health';
import { toEnemyState, type EnemyState } from '../../entities/Enemy';
import { toBlockState, type BlockState } from '../../entities/Block';
import { toChestState, type ChestState } from '../../entities/chests';
import { toCheckpointState, type CheckpointState } from '../../entities/Checkpoint';
import {
  createRopeLadderState,
  type RopeLadderState,
} from '../../entities/deployableItems/RopeLadder';
import { mapCVDataToEnemies, placeEnemies } from '../../level/EnemyMapper';
import { mapCVDataToBlocks, placeBlocks } from '../../level/BlockMapper';
import { mapCVDataToChests, placeChests } from '../../level/ChestMapper';
import { placeCollectibles, type CollectiblePlacement } from '../../level/CollectibleMapper';
import { placeCheckpoints } from '../../level/CheckpointMapper';
import { placeSigns, type SignPlacement } from '../../level/SignMapper';
import { placeHazards, type HazardPlacement } from '../../level/HazardMapper';
import type { ChestDef, CollectedFact } from '../../types';
import { gridToLayout, previewLevelDef } from './gridLayout';

/**
 * The editor preview, produced by the **runtime** finder + mapper chain
 *. Every collection below is built by calling the same
 * `LevelParser` finders and `*Mapper` place functions the running game uses,
 * fed from the one `gridToLayout` adapter — there is no editor-local finder or
 * placement loop.
 *
 * The editor's in-memory grid holds `TileChar`s, so each runtime finder scans
 * `gridToLayout(grid)` (the whole grid as raw layout rows). Sign/hazard
 * finders additionally take the dense marker grid, exactly as at runtime.
 *
 * Internal preview ids come from the shared mappers now (e.g.
 * `coin-${col}-${row}` rather than the old `editor-coin-0`) — a sanctioned,
 * behaviour-preserving change (spec Edge Case). Position/kind/appearance are
 * unchanged.
 */
export interface PreviewPlacements {
  /** The grid's `LevelDef`, for terrain/rope-ladder preview geometry. */
  levelDef: LevelDef;
  /** The editor-only static player placeholder, or `null` with no spawn. */
  player: PlayerState | null;
  coins: CollectiblePlacement[];
  enemies: EnemyState[];
  blocks: BlockState[];
  chests: ChestState[];
  checkpoints: CheckpointState[];
  signs: SignPlacement[];
  hazards: HazardPlacement[];
  bundles: RopeLadderState[];
}

/**
 * A fixed stub fact for padded chest defs — none of the reused draw functions
 * read `fact`, only position/kind/state fields.
 */
const PLACEHOLDER_FACT: CollectedFact = {
  id: 'editor-placeholder',
  sectionId: 'skills',
  sectionLabel: 'Skills',
  data: { category: 'Placeholder', skills: [] },
  sourceType: 'coin',
};

/**
 * OQ-1: the editor preview keeps one chest per `$` marker even when there are
 * fewer CV experience entries than markers (the shipped level has 7 markers, 5
 * entries). Appending placeholder-fact defs until the def count reaches the
 * marker count lets the **shared** `findChestTiles`/`placeChests` do the work,
 * so every marker stays visible and deletable in the editor. The runtime
 * passes the unpadded list, so gameplay is unchanged. This adds no placement
 * logic — only preview def *inputs*.
 */
export function padChestDefs(
  defs: readonly ChestDef[],
  markers: readonly { col: number; row: number }[],
): ChestDef[] {
  if (defs.length >= markers.length) return [...defs];
  const padded = [...defs];
  for (let index = defs.length; index < markers.length; index++) {
    padded.push({ id: `editor-placeholder-${index}`, fact: PLACEHOLDER_FACT });
  }
  return padded;
}

/**
 * The static player placeholder at the grid's `S` marker, or `null` if none
 * exists yet. This is the one sanctioned editor-only preview helper
 * (contract §2/): it mirrors the state layer's `spawnPlayerState` but must
 * not import it (`state/ → editor/` is the wrong direction), and it gets its
 * spawn from the shared `findOptionalSpawnTile` rather than a local `S` scan.
 * The player's 64px render slot is horizontally centered over the 32px spawn
 * tile and vertically placed so the sprite's visible feet (not the render
 * slot's bottom edge) land on the tile's ground surface.
 */
export function previewPlayerState(layout: readonly string[]): PlayerState | null {
  const spawn = findOptionalSpawnTile(layout);
  if (!spawn) return null;
  const spawnCell = tileToPixel(spawn.col, spawn.row);
  const groundSurfaceY = spawnCell.y + RENDERED_TILE_SIZE;
  const x = spawnCell.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
  const y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: true,
    climbing: false,
    crouching: false,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    // Seeded to the state's own feet — the editor's static preview
    // player is always at rest, so this is the only safe history value.
    prevFeetY: y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    knockbackTimer: 0,
    blockContacts: [],
    bounceAscending: false,
    hitPoints: MAX_HALF_HEARTS,
    alive: true,
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
  };
}

/**
 * Builds every preview collection from `grid` (plus its dense `markers`) and
 * the current CV data. `cv` is an explicit argument (never a signal import)
 * so this module stays React/signals-free and directly unit-testable.
 *
 * Enemies use the explicit single-argument `(placement) => toEnemyState(placement)`
 * — the runtime's `.map((p, index) => toEnemyState(p, index))` staggers the
 * starting animation frame per enemy, which the editor preview deliberately
 * does NOT do. `.map(toEnemyState)` would forward the map index and stagger
 * the preview, a visible change / forbid.
 */
export function previewPlacements(
  grid: TileChar[][],
  markers: MarkerGrid,
  cv: CVData,
): PreviewPlacements {
  const layout = gridToLayout(grid);
  const levelDef = previewLevelDef(grid, markers);
  const chestMarkers = findChestTiles(layout);

  return {
    levelDef,
    player: previewPlayerState(layout),
    coins: placeCollectibles(findCoinTiles(layout)),
    enemies: placeEnemies(mapCVDataToEnemies(cv), {
      slimeGreen: findGreenEnemyTiles(layout),
      slimePurple: findPurpleEnemyTiles(layout),
      bee: findBeeTiles(layout),
    }).map((placement) => toEnemyState(placement)),
    blocks: placeBlocks(mapCVDataToBlocks(cv), {
      crate: findCrateTiles(layout),
      questionMark: findQuestionMarkTiles(layout),
      fragileRock: findFragileRockTiles(layout),
      coinPot: findCoinPotTiles(layout),
      potionPot: findPotionPotTiles(layout),
      bombPot: findBombPotTiles(layout),
    }).map(toBlockState),
    chests: placeChests(padChestDefs(mapCVDataToChests(cv), chestMarkers), chestMarkers).map(
      toChestState,
    ),
    checkpoints: placeCheckpoints(findCheckpointTiles(layout)).map(toCheckpointState),
    signs: placeSigns(findSignTiles(layout, markers)),
    hazards: placeHazards(findHazardTiles(layout, markers)),
    bundles: findLadderBundleTiles(layout).map(({ col, row }) =>
      createRopeLadderState(levelDef, col, row),
    ),
  };
}
