import { signal, computed } from '@preact/signals-react';
import { tileToPixel, RENDERED_TILE_SIZE } from '../level/Terrain';
import { SPAWN_TILE, currentLevel } from './levelSession';
import {
  MAX_DARKNESS,
  DARKNESS_FADE_SECONDS,
  nextDarknessLevel,
  isCellDarkening,
  playerOccupiedCell,
} from '../engine/Lighting';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_VISUAL_CENTER_Y_OFFSET,
  PLAYER_HIT_REACTION_SECONDS,
} from '../entities/Player';
import type { PlayerState } from '../entities/Player';
import { MAX_HALF_HEARTS } from '../entities/Health';
import { activeRespawnPlacement } from './checkpointStore';

/**
 * The player's state standing in an arbitrary level cell — full health,
 * motion cleared, `lastGroundedX/Y` seeded to the position, and `hitTimer` at
 * the end of the refractory window (immediately vulnerable). The cell
 * is treated exactly as `spawnPlayerState` treats the spawn cell: the
 * character is horizontally centred over it and its feet land on the cell's
 * bottom edge (the ground surface guarantees for a checkpoint). Pure
 * and not reactive on its own; `respawnPlayerState` below composes it with
 * the active checkpoint.
 */
export function playerStateAtTile(col: number, row: number): PlayerState {
  const cell = tileToPixel(col, row);
  const groundSurfaceY = cell.y + RENDERED_TILE_SIZE;
  const x = cell.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
  const y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: false,
    climbing: false,
    crouching: false,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    // Seeded to the state's own feet, so a spawn/checkpoint respawn never
    // carries a stale pre-death feet line into the spear's swept test.
    prevFeetY: y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    blockContacts: [],
    hitPoints: MAX_HALF_HEARTS,
    alive: true,
    // `hitTimer` counts UP from a hit, so "no hit recently" is a value at or
    // past the reaction duration, not 0. Seeding 0 would hand the player a
    // free 0.8 s of invulnerability after every respawn.
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
  };
}

/**
 * The player's state at the level's spawn point — full health's worth of
 * idle standing on the ground. Delegates to `playerStateAtTile` so the spawn
 * and a checkpoint respawn share one set of placement maths.
 */
export function spawnPlayerState(): PlayerState {
  return playerStateAtTile(SPAWN_TILE.value.col, SPAWN_TILE.value.row);
}

/** Player position/animation state — mutated by the game loop. */
export const playerState = signal<PlayerState>(spawnPlayerState());

/**
 * Camera's horizontal scroll offset in rendered pixels — the world-space x
 * of the viewport's left edge. 0 at level start, increases rightward.
 * Updated once per game-loop tick (see PlatformerPage.tsx) via
 * Camera.ts's updateCamera; kept separate from playerState so renderer
 * code doesn't need to re-derive it from player position every frame.
 */
export const cameraPositionX = signal(0);

/**
 * Camera's vertical scroll offset — an additive amount on top of the
 * existing bottom-anchor baseline computed in `PlatformerPage.tsx`
 * (`canvas.height - levelPixelHeight`), not a replacement for it. See
 * `engine/Camera.ts`'s `updateCameraY` doc comment. Stays 0 whenever a
 * level's height fits the viewport — a verified no-op, not just an
 * assumption.
 */
export const cameraPositionY = signal(0);

/**
 * How dark the view currently is — `0` (fully bright) to `MAX_DARKNESS`
 *. The only new stored value this feature adds: it is eased every
 * `playing` tick from the cell under the player's feet toward either
 * `MAX_DARKNESS` (that cell is covered by a cave-family background piece) or
 * `0` (it is not), so entering/leaving a cave fades rather than snapping
 *. Because the tick only runs in the `playing` phase, the
 * value freezes with the world during pause/death.
 */
export const darknessLevel = signal(0);

/**
 * One game-loop tick of the darkness value. Reads the single cell under the
 * player's feet (bottom-centre, `playerOccupiedCell`) and eases the current
 * value toward `MAX_DARKNESS` or `0` over `DARKNESS_FADE_SECONDS`. Pure inputs
 * in, one signal write out; `resetGame()` returns it to `0` on respawn.
 */
export function tickDarkness(dt: number): void {
  const cell = playerOccupiedCell(playerState.value);
  const target = isCellDarkening(currentLevel.value, cell.col, cell.row) ? MAX_DARKNESS : 0;
  darknessLevel.value = nextDarknessLevel(darknessLevel.value, target, dt, DARKNESS_FADE_SECONDS);
}

/**
 * How present the outside-a-cave fog currently is — `0` (none) to
 * `MAX_DARKNESS` (reuses darkness's own cap: 0.97 already reads as opaque,
 * and sharing the constant with `darknessLevel` keeps the two effects'
 * endpoints from drifting apart over time — design.md notes fog *could*
 * safely go all the way to full opacity, since a fogged cell is never the
 * player's own, but there's no visual reason to). Eased every `playing` tick
 * from the same cell
 * `darknessLevel` reads, toward `MAX_DARKNESS` when that cell is NOT
 * cave-family or `0` when it is — the inverse of `darknessLevel`'s target,
 * which is what keeps the two mutually exclusive. Because the
 * tick only runs in the `playing` phase, the value freezes with the world
 * during pause/death, matching `darknessLevel`.
 */
export const fogLevel = signal(0);

/**
 * One game-loop tick of the fog value — the mirror of `tickDarkness` with
 * the target inverted. Reads the same cell under the
 * player's feet and eases the current value toward `MAX_DARKNESS` (outside a
 * cave) or `0` (inside one) over the same `DARKNESS_FADE_SECONDS`, so the
 * two transitions read as one continuous effect. `resetGame()` returns it to
 * `0` on respawn.
 */
export function tickFog(dt: number): void {
  const cell = playerOccupiedCell(playerState.value);
  const target = isCellDarkening(currentLevel.value, cell.col, cell.row) ? 0 : MAX_DARKNESS;
  fogLevel.value = nextDarknessLevel(fogLevel.value, target, dt, DARKNESS_FADE_SECONDS);
}

/**
 * Where a death restarts the character: the active checkpoint's tile, or the
 * level's own spawn point when there is none. A `computed` so
 * `resetGame()` and the camera snap always see the current target.
 */
export const respawnPlayerState = computed<PlayerState>(() => {
  const placement = activeRespawnPlacement.value;
  return placement ? playerStateAtTile(placement.col, placement.row) : spawnPlayerState();
});

/** World-space visual centre of `respawnPlayerState` — what the restart/debug/
 * Reset Game iris is centered on. */
export const respawnCenter = computed<{ x: number; y: number }>(() => {
  const state = respawnPlayerState.value;
  return {
    x: state.x + PLAYER_RENDERED_SIZE / 2,
    y: state.y + PLAYER_VISUAL_CENTER_Y_OFFSET,
  };
});

/**
 * World-space center point (not top-left) of the spawned player — used to
 * center the iris-in transition on the character at game start/restart,
 * matching where the death iris-out is centered (the player's actual visual
 * midpoint, not its collision box's top-left corner).
 */
export function spawnCenter(): { x: number; y: number } {
  const spawn = spawnPlayerState();
  return { x: spawn.x + PLAYER_RENDERED_SIZE / 2, y: spawn.y + PLAYER_VISUAL_CENTER_Y_OFFSET };
}

/**
 * The player/camera/darkness/fog domain's reset hook. The respawn pass and the
 * full pass are identical here — the player always returns to the respawn
 * target, the camera scrolls back to the level start and both cave effects
 * clear — so `respawn` is accepted only for the shared hook signature.
 * Reads `respawnPlayerState` (which follows the active checkpoint), so this
 * must run AFTER `checkpointStore` has cleared its memory on a full reset
 * (see `resetGameProgress()`).
 */
export function reset(respawn: boolean): void {
  void respawn;
  playerState.value = respawnPlayerState.value;
  cameraPositionX.value = 0;
  cameraPositionY.value = 0;
  darknessLevel.value = 0;
  fogLevel.value = 0;
}

/** The full-reset hook — one body, shared with the respawn pass. */
export function resetFull(): void {
  reset(false);
}
