import { PHYSICS_CONFIG } from './PhysicsConfig';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import type { EnemyState, EnemyDirection } from '../entities/Enemy';
import { ENEMY_TYPES } from '../entities/enemies';
import {
  enemyRenderedSize,
  enemyTileOffsetX,
  enemyHitboxSidePadding,
  enemyHitboxTopPadding,
} from '../entities/Enemy';

/**
 * Advances one enemy's horizontal patrol by `dt` seconds: moves at a
 * constant `PHYSICS_CONFIG.enemyPatrolSpeed` in its current `direction`,
 * reversing direction (and snapping so its actual VISIBLE edge — not its
 * narrower tile-anchor `x`, and not its full render frame's edge either —
 * exactly touches the boundary, never overshooting into/over the obstacle,
 * nor stopping short with a visible gap) whenever the tile its leading edge
 * is about to enter, at any row the sprite's body spans (a render-scaled-up
 * enemy occupies multiple tile rows above its anchor row, so an obstacle at
 * head height blocks it just as a foot-height one does), is a wall, is a
 * `patrol` tile, or — testing the anchor row alone — has no solid ground
 * beneath it (a ledge/pit edge) — FR-019's "reverse at platform edges or
 * designated patrol boundaries". A `patrol` tile is the designated-boundary
 * half of that: invisible, non-solid terrain (the player walks straight
 * through it) whose only effect is to turn an enemy around here, with the
 * same snapping a wall gets — which is how a level author pens an enemy into
 * a stretch of open ground without putting a visible obstacle in the way. It
 * bounds only the row it's painted on, so one marker never silently fences
 * off a tall sprite's whole column — a purple slime is only turned around by
 * a `patrol` tile on its anchor row or the row directly above (the two rows
 * its own body spans), never by one further away. How far that leading edge
 * sits
 * ahead of the tile-anchor scales with the sprite's own render size, inset
 * by the same hitbox padding used for the player-collision hitbox and for
 * centering a purple slime's held key (see enemyHitboxSidePadding's doc
 * comment) — a sprite's full render frame has transparent padding around
 * its actual opaque blob, so using the raw frame's edge turned enemies
 * around noticeably before their visible body ever reached the wall/ledge.
 * A render-scaled-up enemy correctly starts turning around farther from the
 * obstacle than a tile-width one would, instead of visually overlapping it
 * by its own overhang. A tile counts as solid for both checks
 * if EITHER the static terrain grid says so (`isSolid`/`tileAt`) OR it
 * matches an entry in `blockedTiles` — the currently-live
 * `crate`/`questionMark`/`fragileRock` blocks, which `LevelParser.ts`
 * deliberately resolves to `'empty'` terrain since they're a separate
 * dynamic layer (`BlockState`) the static grid knows nothing about; without
 * this, an enemy patrolling onto or beside a live block would see a false
 * wall/ledge from the terrain grid alone. Enemies never move vertically;
 * `row` is derived once from `enemy.y` and never changes (a flat patrol row,
 * no gravity — this is a deliberately simple patrol-only AI per spec.md's
 * "Boss enemies or complex enemy AI" non-goal).
 *
 * If reversing would immediately hit an obstacle in the OTHER direction too
 * (the patrol lane is narrower than this sprite needs on both sides at
 * once), stands still (`vx: 0`, direction unchanged) instead of flipping
 * direction every single call — the two obstacles' safe-stopping points can
 * otherwise coincide almost exactly, which without this check reads as the
 * enemy vibrating in place, alternating direction every frame.
 */
export function stepEnemyPatrol(
  enemy: EnemyState,
  level: LevelDef,
  dt: number,
  blockedTiles: readonly { col: number; row: number }[],
): EnemyState {
  const speed = PHYSICS_CONFIG.enemyPatrolSpeed * ENEMY_TYPES[enemy.type].patrolSpeedMultiplier;
  const row = Math.round(enemy.y / RENDERED_TILE_SIZE);
  const size = enemyRenderedSize(enemy.type);
  const offsetX = enemyTileOffsetX(enemy.type);
  // The sprite's full render frame has transparent padding around the
  // actual opaque slime blob (see enemyHitboxSidePadding's own doc comment —
  // the same inset already used for the player-collision hitbox and for
  // centering the held key inside a purple slime) — using the full frame's
  // edge here turned the enemy around noticeably before its VISIBLE body
  // ever reached the wall/ledge. Insetting by this padding aligns the
  // turn-around with the same silhouette the hitbox (and the eye) sees.
  const sidePadding = enemyHitboxSidePadding(enemy.type);

  const isBlockedTile = (col: number, tileRow: number) =>
    blockedTiles.some((tile) => tile.col === col && tile.row === tileRow);

  /** Tries moving one step in `direction` from `fromX`. `blocked` is whether
   *  the leading edge would enter a wall or run out of ground; `nextX` is
   *  where the tile-anchor lands if unblocked; `snapX` is where the
   *  tile-anchor must land, if blocked, for the sprite's actual leading edge
   *  to touch the obstacle exactly (used both for the real reversal and for
   *  the narrow-lane look-ahead below). */
  const attempt = (fromX: number, direction: EnemyDirection) => {
    const movingRight = direction === 'right';
    const nextX = fromX + (movingRight ? speed : -speed) * dt;
    const leadingEdgeAhead = movingRight ? offsetX + size - sidePadding : -(offsetX + sidePadding);
    const leadingCol = movingRight
      ? Math.floor((nextX + leadingEdgeAhead - 1) / RENDERED_TILE_SIZE)
      : Math.floor((nextX - leadingEdgeAhead) / RENDERED_TILE_SIZE);

    // Rows spanned by the sprite's actual visible silhouette, not its full
    // (mostly transparent) render frame — same reasoning as sidePadding
    // above. Its feet already touch the render slot's bottom edge (no
    // bottom inset, see enemyHitboxTopPadding's doc comment), so only the
    // top inset shrinks the frame height into a silhouette height here.
    const visibleHeight = size - enemyHitboxTopPadding(enemy.type);
    const rowsSpanned = Math.ceil(visibleHeight / RENDERED_TILE_SIZE);
    // A `patrol` tile is invisible and never solid (the player walks right
    // through it), so it has to be checked by name here rather than through
    // `isSolid` — it is a boundary for enemies only.
    const wallAhead = Array.from({ length: rowsSpanned }, (_, i) => row - i).some((r) => {
      const tile = tileAt(level, leadingCol, r);
      return isSolid(tile) || tile === 'patrol' || isBlockedTile(leadingCol, r);
    });
    const noGroundAhead = !isSolid(tileAt(level, leadingCol, row + 1)) && !isBlockedTile(leadingCol, row + 1);

    const snapX = movingRight
      ? leadingCol * RENDERED_TILE_SIZE - offsetX - size + sidePadding
      : (leadingCol + 1) * RENDERED_TILE_SIZE - offsetX - sidePadding;

    return { blocked: wallAhead || noGroundAhead, nextX, snapX };
  };

  const forward = attempt(enemy.x, enemy.direction);
  if (!forward.blocked) {
    return {
      ...enemy,
      x: forward.nextX,
      vx: enemy.direction === 'right' ? speed : -speed,
    };
  }

  const reversedDirection: EnemyDirection = enemy.direction === 'right' ? 'left' : 'right';
  const reversed = attempt(forward.snapX, reversedDirection);
  if (reversed.blocked) {
    return { ...enemy, x: forward.snapX, vx: 0 };
  }

  return {
    ...enemy,
    x: forward.snapX,
    direction: reversedDirection,
    vx: reversedDirection === 'right' ? speed : -speed,
  };
}

/**
 * Advances an enemy currently playing its stomp `hit` reaction. No-op
 * (returns the same reference) for an enemy still `'walk'`ing — patrol
 * movement is `stepEnemyPatrol`'s job, not this function's; the game loop
 * (PlatformerPage.tsx) picks whichever of the two applies per enemy per
 * tick. Once this type's own `hitReactionSeconds` has elapsed since the stomp
 * (`takeHit` reset `hitTimer` to 0), either reverts to `'walk'` (hit points
 * remain — the enemy keeps patrolling) or flags the enemy dead in place (no
 * hit points remain — the game loop fires its reward that same tick and
 * leaves it in the array). Deliberately does not clamp/zero `vx` on revert:
 * the next `stepEnemyPatrol` call recomputes it from `direction`.
 *
 * `hitTimer` is left at its accumulated value on revert rather than reset to
 * 0: the same timer answers "is this enemy still untouchable?" through
 * `isInvulnerable`, and a reset would read as a fresh hit that never
 * happened, leaving a patrolling enemy permanently harmless.
 */
export function stepEnemyHitReaction(enemy: EnemyState, dt: number): EnemyState {
  if (enemy.animState !== 'hit') return enemy;

  const hitTimer = enemy.hitTimer + dt;
  if (hitTimer < ENEMY_TYPES[enemy.type].hitReactionSeconds) {
    return { ...enemy, hitTimer };
  }
  if (enemy.hitPoints <= 0) {
    return { ...enemy, hitTimer, alive: false };
  }
  return { ...enemy, hitTimer, animState: 'walk', animFrame: 0, animTimer: 0 };
}

