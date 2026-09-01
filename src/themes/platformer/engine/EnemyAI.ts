import { PHYSICS_CONFIG } from './PhysicsConfig';
import { isSolid, tileAt, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { LevelDef } from '../level/LevelData';
import type { EnemyState, EnemyDirection } from '../entities/Enemy';
import {
  ENEMY_PATROL_SPEED_MULTIPLIER,
  enemyRenderedSize,
  enemyTileOffsetX,
  enemyHitboxSidePadding,
} from '../entities/Enemy';

/** How long the `hit` reaction (red-flash/dissolve) plays before the enemy
 *  either reverts to patrolling (hit points remain) or is flagged dead —
 *  matches Enemy.ts's `hit` animation: 4 frames at 0.1s each. */
export const HIT_REACTION_DURATION_SECONDS = 0.4;

/** How long the spikes take to pop fully out at the start of the cooldown —
 *  see Renderer.ts's `spikeGrowthScale`. Fast: the pop should read as a
 *  snappy reaction, not a slow bloom. */
export const SPIKE_GROW_DURATION_SECONDS = 0.25;

/** How long the spikes stay fully extended (scale 1) between popping out and
 *  starting to retract — deliberately short, a brief "still dangerous" beat
 *  rather than a long hold. */
export const SPIKE_HOLD_DURATION_SECONDS = 0.25;

/** How long the spikes take to retract fully — deliberately slower than
 *  SPIKE_GROW_DURATION_SECONDS: popping out reads best as fast/sudden,
 *  retracting reads best as a more deliberate withdrawal. (This also happens
 *  to counteract a perceptual effect: `spikeGrowthScale`'s linear-scale
 *  animation shrinks its RENDERED AREA quadratically, not linearly, so an
 *  equal-duration retract would otherwise feel slower than an equal-duration
 *  grow even before accounting for the intentional speed difference here.) */
export const SPIKE_RETRACT_DURATION_SECONDS = 0.4;

/** Total time an enemy stays `spiked` (per Collision.ts, un-stompable from
 *  above during this window) — derived from the three animation phases
 *  above, not an independent value, so the enemy becomes stompable again
 *  exactly when the retract animation finishes, never before (looking like
 *  it's still got spikes out) or after (an idle beat with no visible spikes
 *  but still immune). */
export const SPIKE_COOLDOWN_DURATION_SECONDS =
  SPIKE_GROW_DURATION_SECONDS + SPIKE_HOLD_DURATION_SECONDS + SPIKE_RETRACT_DURATION_SECONDS;

/**
 * Advances one enemy's horizontal patrol by `dt` seconds: moves at a
 * constant `PHYSICS_CONFIG.enemyPatrolSpeed` in its current `direction`,
 * reversing direction (and snapping so its actual VISIBLE edge — not its
 * narrower tile-anchor `x`, and not its full render frame's edge either —
 * exactly touches the boundary, never overshooting into/over the obstacle,
 * nor stopping short with a visible gap) whenever the tile its leading edge
 * is about to enter, at the enemy's own grid row, is either a wall or has no
 * solid ground beneath it (a ledge/pit edge) — FR-019's "reverse at platform
 * edges or designated patrol boundaries". How far that leading edge sits
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
  const speed = PHYSICS_CONFIG.enemyPatrolSpeed * ENEMY_PATROL_SPEED_MULTIPLIER[enemy.type];
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

    const wallAhead = isSolid(tileAt(level, leadingCol, row)) || isBlockedTile(leadingCol, row);
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
 * tick. Once `HIT_REACTION_DURATION_SECONDS` has elapsed since the stomp
 * (applyStomp reset `hitTimer` to 0), either reverts to `'walk'` (hit points
 * remain — the enemy keeps patrolling) or flags the enemy dead in place (no
 * hit points remain — the game loop fires its reward that same tick and
 * leaves it in the array). Deliberately does not clamp/zero `vx` on revert:
 * the next `stepEnemyPatrol` call recomputes it from `direction`.
 */
export function stepEnemyHitReaction(enemy: EnemyState, dt: number): EnemyState {
  if (enemy.animState !== 'hit') return enemy;

  const hitTimer = enemy.hitTimer + dt;
  if (hitTimer < HIT_REACTION_DURATION_SECONDS) {
    return { ...enemy, hitTimer };
  }
  if (enemy.hitPoints <= 0) {
    return { ...enemy, hitTimer, alive: false };
  }
  return { ...enemy, hitTimer: 0, animState: 'walk', animFrame: 0, animTimer: 0 };
}

/**
 * Advances a spiked enemy's cooldown by `dt` seconds. No-op (returns the
 * same reference) for an enemy that isn't currently `spiked` — same
 * no-op-until-threshold shape as `stepEnemyHitReaction` above, but this
 * timer runs independently of `animState`/`hitTimer`: a purple slime keeps
 * counting down its spike cooldown while patrolling normally, not just
 * while mid hit-reaction.
 */
export function stepEnemySpikeCooldown(enemy: EnemyState, dt: number): EnemyState {
  if (!enemy.spiked) return enemy;

  const spikeTimer = enemy.spikeTimer + dt;
  if (spikeTimer < SPIKE_COOLDOWN_DURATION_SECONDS) {
    return { ...enemy, spikeTimer };
  }
  return { ...enemy, spiked: false, spikeTimer: 0 };
}

