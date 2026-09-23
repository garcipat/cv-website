import { PHYSICS_CONFIG } from '../../../engine/PhysicsConfig';
import { isSolid, tileAt, markerAt, RENDER_SCALE, RENDERED_TILE_SIZE } from '../../../level/Terrain';
import type { LevelDef } from '../../../level/LevelData';
import type { Direction } from '../../geometry';
import type { SpriteDescriptor } from '../../sprites/SpriteSheet';
import type { BaseEnemyState } from '../EnemyType';
import type { MovementStrategy } from './MovementStrategy';
import { isCrumblingFloorBroken, type CrumblingFloorTimerState } from '../../../engine/CrumblingFloor';

const NO_CRUMBLING_FLOOR_STATES: readonly CrumblingFloorTimerState[] = [];

/** The transparent-margin inset a kind declares, in pre-scale pixels. */
export interface HitboxPaddingNative {
  side: number;
  top: number;
  bottom: number;
}

/** Everything the shared horizontal helper needs — the same wall/`patrol`-tile
 *  reversal, edge snapping and narrow-lane stand-still `patrol` and `fly`
 *  both use, parameterized on whether the ledge test runs and which world Y
 *  the row test anchors to. */
export interface StepHorizontalParams {
  x: number;
  direction: Direction;
  speed: number;
  /** Whether "no solid ground ahead" turns the enemy around. Patrol: true;
   *  fly: false (FR-005 — the bee crosses gaps). */
  checkLedges: boolean;
  sprite: SpriteDescriptor;
  hitboxPaddingNative: HitboxPaddingNative;
  /** World Y whose tile row the horizontal blocking test anchors on. Patrol
   *  passes `enemy.y`, fly passes `enemy.homeY` so the bob never changes
   *  which tiles block it (research D9). */
  anchorY: number;
  level: LevelDef;
  blockedTiles: readonly { col: number; row: number }[];
  dt: number;
  /** See `MovementContext`'s own doc comment (O-023) — threaded through so
   *  an at-rest/cracking crumbling floor tile counts as solid ground here
   *  exactly like ordinary terrain. */
  crumblingFloorStates?: readonly CrumblingFloorTimerState[];
}

export interface StepHorizontalResult {
  x: number;
  direction: Direction;
  vx: number;
}

/**
 * The horizontal half of a patrol/fly step, shared verbatim by both so a
 * slime's turn points stay bit-for-bit what they were before the seam
 * (SC-001). Moves at `speed` in `direction`; reverses (snapping so the
 * sprite's VISIBLE leading edge exactly touches the obstacle) at a static
 * solid tile, a `patrolBoundary` marker or a live `blockedTiles` cell at any row the
 * silhouette spans from the anchor row; and, when `checkLedges` is true,
 * reverses at a ledge. If the reversed direction is blocked too (the lane is
 * narrower than the sprite on both sides), stands still rather than flipping
 * every frame.
 *
 * Geometry (rendered size, tile offsets, insets) is computed here from the
 * passed `sprite` + padding — never imported from Enemy.ts, which depends on
 * this directory through ENEMY_TYPES (research D1).
 */
export function stepHorizontal(params: StepHorizontalParams): StepHorizontalResult {
  const {
    x,
    direction,
    speed,
    checkLedges,
    sprite,
    hitboxPaddingNative,
    anchorY,
    level,
    blockedTiles,
    dt,
    crumblingFloorStates = NO_CRUMBLING_FLOOR_STATES,
  } = params;

  const scale = RENDER_SCALE * sprite.renderScale;
  const size = sprite.sheet.frameWidth * scale;
  const offsetX = (RENDERED_TILE_SIZE - size) / 2;
  const sidePadding = hitboxPaddingNative.side * scale;
  const topPadding = hitboxPaddingNative.top * scale;
  const bottomPadding = hitboxPaddingNative.bottom * scale;
  const row = Math.round(anchorY / RENDERED_TILE_SIZE);

  const isBlockedTile = (col: number, tileRow: number) =>
    blockedTiles.some((tile) => tile.col === col && tile.row === tileRow);

  // A crumbling floor tile (O-023) counts as solid ground here exactly
  // like ordinary terrain, as long as it isn't currently broken/reforming
  // — otherwise an enemy would treat an intact crumbling floor tile as a
  // wall/ledge edge and reverse in front of it as if it were a pit, even
  // though the player can walk right onto it.
  const tileIsGroundFor = (col: number, tileRow: number, tile = tileAt(level, col, tileRow)): boolean =>
    tile === 'crumblingFloor' ? !isCrumblingFloorBroken(crumblingFloorStates, col, tileRow) : isSolid(tile);

  /** Tries moving one step in `direction` from `fromX`. `blocked` is whether
   *  the leading edge would enter a wall or run out of ground; `nextX` is
   *  where the tile-anchor lands if unblocked; `snapX` is where the
   *  tile-anchor must land, if blocked, for the sprite's actual leading edge
   *  to touch the obstacle exactly. */
  const attempt = (fromX: number, dir: Direction) => {
    const movingRight = dir === 'right';
    const nextX = fromX + (movingRight ? speed : -speed) * dt;
    const leadingEdgeAhead = movingRight ? offsetX + size - sidePadding : -(offsetX + sidePadding);
    const leadingCol = movingRight
      ? Math.floor((nextX + leadingEdgeAhead - 1) / RENDERED_TILE_SIZE)
      : Math.floor((nextX - leadingEdgeAhead) / RENDERED_TILE_SIZE);

    // Rows spanned by the sprite's actual visible silhouette, not its full
    // (mostly transparent) render frame — same reasoning as sidePadding.
    const visibleHeight = size - topPadding - bottomPadding;
    const rowsSpanned = Math.ceil(visibleHeight / RENDERED_TILE_SIZE);
    // A patrol boundary is invisible and never solid (the player walks right
    // through it), so it has to be read from the tile meta layer rather than
    // through `isSolid` — it is a boundary for enemies only (FR-021).
    const wallAhead = Array.from({ length: rowsSpanned }, (_, i) => row - i).some((r) => {
      const tile = tileAt(level, leadingCol, r);
      return (
        tileIsGroundFor(leadingCol, r, tile) ||
        markerAt(level, leadingCol, r)?.kind === 'patrolBoundary' ||
        isBlockedTile(leadingCol, r)
      );
    });
    const noGroundAhead =
      checkLedges &&
      !tileIsGroundFor(leadingCol, row + 1) &&
      !isBlockedTile(leadingCol, row + 1);

    const snapX = movingRight
      ? leadingCol * RENDERED_TILE_SIZE - offsetX - size + sidePadding
      : (leadingCol + 1) * RENDERED_TILE_SIZE - offsetX - sidePadding;

    return { blocked: wallAhead || noGroundAhead, nextX, snapX };
  };

  const forward = attempt(x, direction);
  if (!forward.blocked) {
    return { x: forward.nextX, direction, vx: direction === 'right' ? speed : -speed };
  }

  const reversedDirection: Direction = direction === 'right' ? 'left' : 'right';
  const reversed = attempt(forward.snapX, reversedDirection);
  if (reversed.blocked) {
    return { x: forward.snapX, direction, vx: 0 };
  }

  return {
    x: forward.snapX,
    direction: reversedDirection,
    vx: reversedDirection === 'right' ? speed : -speed,
  };
}

export interface PatrolMovementConfig {
  /** Multiplier on PHYSICS_CONFIG.enemyPatrolSpeed (60 px/s). Green 1,
   *  purple 0.7. */
  speedMultiplier: number;
  /** The kind's own descriptor — size/offsets derive from it. */
  sprite: SpriteDescriptor;
  hitboxPaddingNative: HitboxPaddingNative;
  /** State set while patrolling; defaults to 'walk'. */
  animState?: string;
}

/**
 * The existing ground behavior, extracted from the pre-seam
 * `stepEnemyPatrol` — a move, not a rewrite, which is what lets the slimes'
 * results be asserted bit-for-bit (SC-001).
 */
export function patrolMovement<S extends BaseEnemyState>(
  config: PatrolMovementConfig,
): MovementStrategy<S> {
  const speed = PHYSICS_CONFIG.enemyPatrolSpeed * config.speedMultiplier;
  const animState = config.animState ?? 'walk';
  return {
    kind: 'patrol',
    step: (enemy, ctx, dt) => {
      if (dt <= 0) return enemy;
      const { x, direction, vx } = stepHorizontal({
        x: enemy.x,
        direction: enemy.direction,
        speed,
        checkLedges: true,
        sprite: config.sprite,
        hitboxPaddingNative: config.hitboxPaddingNative,
        anchorY: enemy.y,
        level: ctx.level,
        blockedTiles: ctx.blockedTiles,
        dt,
        crumblingFloorStates: ctx.crumblingFloorStates,
      });
      return { ...enemy, x, direction, vx, animState };
    },
  };
}
