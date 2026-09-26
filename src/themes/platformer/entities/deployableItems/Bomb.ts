import type { PickupSpawnSource, PickupType } from '../pickups/PickupType';
import type { Pickup } from '../../contracts/Pickup';
import { BOMB_SHEET } from '../sprites/sheets';
import { frameSource } from '../sprites/SpriteSheet';
import { coinBobOffset } from '../pickups/Coin';
import { tileSolidRegionAt, tileToPixel, RENDERED_TILE_SIZE } from '../../level/Terrain';
import type { LevelDef } from '../../level/LevelData';
import { isBlockOccupied } from '../../level/BlockMapper';
import type { BlockPlacement } from '../../level/BlockMapper';
import { PHYSICS_CONFIG } from '../../contracts/PhysicsConfig';
import type { CrumblingFloorTimerState } from '../../tiles/crumblingFloor';
import { findLandingRow } from '../../engine/Standable';
import type { DrawContext } from '../../contracts/DrawContext';
import type {
  DeployableItemState,
  DeployableItemTickContext,
  DeployableItemOutcome,
  DeployableSpawnContext,
  SpawnedType,
} from './DeployableItemType';

const NO_CRUMBLING_FLOOR_STATES: readonly CrumblingFloorTimerState[] = [];

/**
 * The bomb's **one home** (R-008 FR-007/FR-008): the placed/lit face (the
 * state machine, the fuse frames, fall/landing and removal) merged with the
 * held/dropped pickup face, over one shared `BOMB_SHEET` descriptor and one
 * fuse/fall constant set — so the two faces' art and rules can never drift.
 *
 * The placed face is registered as `DEPLOYABLE_ITEM_TYPES.bomb`; the held face
 * is re-exported as `PICKUP_TYPES.bomb`, so a destroyed bomb-pot still drops
 * through the unchanged generic pickup path (`bombPot.drop: 'bomb'`).
 */

/**
 * A placed bomb's live state — a pure, canvas-free value so the fuse/fall
 * rules are unit-testable without a DOM. A placed bomb is never written into
 * `blockPlacements`, so it is non-solid and never blocks the player.
 */
export interface PlacedBombState extends DeployableItemState {
  kind: 'bomb';
  /** px/s, positive down. */
  vy: number;
  /** Resting row, or `null` when the column has no floor. */
  landingRow: number | null;
  /** Seconds; always advances, even while falling. */
  fuseElapsed: number;
  landed: boolean;
}

/** One frame of the pre-detonation fuse animation. */
export interface BombFrame {
  /** `bomb.png` frame index, 1..5 (never 0 — that is the unlit icon). */
  frame: number;
  /** 1, or `BOMB_PULSE_SCALE` on the orange pre-detonation frame. */
  scale: number;
}

/** Falling acceleration (px/s²) — the player's own gravity, reused. */
export const BOMB_GRAVITY = PHYSICS_CONFIG.gravity;
/** Falling speed cap (px/s) — the player's own terminal velocity, reused. */
export const BOMB_TERMINAL_VELOCITY = PHYSICS_CONFIG.terminalVelocity;
/** Scale applied to the orange pre-detonation frame. */
export const BOMB_PULSE_SCALE = 1.25;
/** The fuse burn-down frames (1-3): the thread visibly shortening. */
export const BOMB_BURN_FRAMES: readonly number[] = [1, 2, 3];
/** The pulse frames: the orange 5 alternating with its 4 partner, ending on 5. */
export const BOMB_PULSE_FRAMES: readonly number[] = [4, 5, 4, 5, 4, 5];
/** Fixed pre-detonation frame order. */
export const BOMB_FUSE_SEQUENCE: readonly number[] = [...BOMB_BURN_FRAMES, ...BOMB_PULSE_FRAMES];
/** Seconds the burn-down frames occupy — deliberately the larger share, so the
 *  early fuse stages read clearly instead of flashing past (each of frames
 *  1-3 gets a third of this). */
export const BOMB_BURN_SECONDS = 1.2;
/** Seconds the pulse frames occupy — short, so the 4/5 alternation reads as
 *  urgent. */
export const BOMB_PULSE_SECONDS = 0.8;
/** Fixed fuse duration. */
export const BOMB_FUSE_SECONDS = BOMB_BURN_SECONDS + BOMB_PULSE_SECONDS;

/**
 * The lowest row a bomb placed at `(col, row)` rests in: scans downward from
 * `row + 1` while the cell is not solid for a bomb, returning the last such
 * row (i.e. the resting row, which equals `row` when the cell directly below
 * is solid), or `null` when the column has no floor before the level's bottom.
 *
 * "Solid for a bomb" is the registry's `tileSolidRegionAt` (a plain solid,
 * including `bridge`, resolves to a full-cell region) `|| isBlockOccupied(...)`,
 * with one nuance: a crumbling floor tile counts as solid too, as long as it
 * isn't currently broken/reforming — a bomb rests on it exactly like ordinary
 * ground while it's there. A `ladder` is not solid and no one-way term is
 * consulted, so a ladder tile is open air. Never throws — `tileAt` resolves
 * out-of-bounds reads to `'empty'`.
 */
export function bombLandingRow(
  level: LevelDef,
  blocks: readonly BlockPlacement[],
  col: number,
  row: number,
  crumblingFloorStates: readonly CrumblingFloorTimerState[] = NO_CRUMBLING_FLOOR_STATES,
): number | null {
  const transient = { crumblingFloorTimers: crumblingFloorStates, mushroomSquashes: [] };
  const landing = findLandingRow(level, col, row, (l, c, r) => {
    const tileIsGround = tileSolidRegionAt(l, c, r, { transient }) !== null;
    return tileIsGround || isBlockOccupied(blocks, c, r);
  });
  return landing === null ? null : landing - 1;
}

/** Creates a placed bomb at `(col, row)` with its landing row resolved from
 *  the current level + live blocks. Pure; called once when the bomb is
 *  placed. */
export function createPlacedBomb(
  id: string,
  level: LevelDef,
  blocks: readonly BlockPlacement[],
  col: number,
  row: number,
  crumblingFloorStates: readonly CrumblingFloorTimerState[] = NO_CRUMBLING_FLOOR_STATES,
): PlacedBombState {
  const { x, y } = tileToPixel(col, row);
  return {
    id,
    kind: 'bomb',
    x,
    y,
    vy: 0,
    col,
    row,
    landingRow: bombLandingRow(level, blocks, col, row, crumblingFloorStates),
    fuseElapsed: 0,
    landed: false,
  };
}

/**
 * Advances a placed bomb by `dt` seconds. Always advances `fuseElapsed` (the
 * fuse keeps ticking while falling). While it has a landing row and has not
 * reached it, gravity is applied and `y` advances; on reaching the resting
 * surface's top edge the bomb snaps to it and stops. With no landing row it
 * keeps falling (the caller removes it once `checkBombFellOut` is true).
 * `dt <= 0` returns the same state unchanged; never mutates its input.
 */
export function stepPlacedBomb(state: PlacedBombState, dt: number): PlacedBombState {
  if (dt <= 0) return state;

  const fuseElapsed = state.fuseElapsed + dt;
  const vy = Math.min(state.vy + BOMB_GRAVITY * dt, BOMB_TERMINAL_VELOCITY);
  let y = state.y + vy * dt;
  let landed = state.landed;

  if (state.landingRow !== null) {
    const restingY = tileToPixel(state.col, state.landingRow).y;
    if (y >= restingY) {
      y = restingY;
      landed = true;
      return { ...state, y, vy: 0, fuseElapsed, landed };
    }
  }

  return { ...state, y, vy, fuseElapsed, landed };
}

/** True once the bomb's bottom edge has passed the level's bottom — only
 *  meaningful when `landingRow === null`. The caller removes the bomb and
 *  does NOT explode it. */
export function checkBombFellOut(state: PlacedBombState, level: LevelDef): boolean {
  return state.y + RENDERED_TILE_SIZE > level.height * RENDERED_TILE_SIZE;
}

/**
 * Maps the fuse's elapsed time onto the fixed pre-detonation frame sequence.
 * The burn-down frames (1-3) share `BOMB_BURN_SECONDS` and the pulse frames
 * share `BOMB_PULSE_SECONDS`, so the early stages linger while the final 4/5
 * alternation is urgent. `bombFuseFrame(0)` is frame 1, the final segment is
 * frame 5, and frame 0 (the unlit icon) never appears.
 */
export function bombFuseFrame(fuseElapsed: number): BombFrame {
  const t = Math.min(BOMB_FUSE_SECONDS, Math.max(0, fuseElapsed));
  let frame: number;
  if (t < BOMB_BURN_SECONDS) {
    const per = BOMB_BURN_SECONDS / BOMB_BURN_FRAMES.length;
    const index = Math.min(Math.floor(t / per), BOMB_BURN_FRAMES.length - 1);
    frame = BOMB_BURN_FRAMES[index];
  } else {
    const per = BOMB_PULSE_SECONDS / BOMB_PULSE_FRAMES.length;
    const index = Math.min(Math.floor((t - BOMB_BURN_SECONDS) / per), BOMB_PULSE_FRAMES.length - 1);
    frame = BOMB_PULSE_FRAMES[index];
  }
  return { frame, scale: frame === 5 ? BOMB_PULSE_SCALE : 1 };
}

/** Whether the fuse has burned down to detonation. The caller detonates
 *  exactly once and removes the bomb. */
export function hasDetonated(state: PlacedBombState): boolean {
  return state.fuseElapsed >= BOMB_FUSE_SECONDS;
}

/**
 * The placed/lit face: a `SpawnedType<PlacedBombState>` entry owned by this
 * module. The `spawn` entry point wraps `createPlacedBomb`; `step` is the pure
 * fuse/fall advance; `onTick` returns the declarative blast/removal outcome
 * the shared late pass resolves; `draw` is the moved `drawPlacedBombs` body
 * for one bomb.
 */
export const bombDeployableItem: SpawnedType<PlacedBombState> = {
  key: 'bomb',
  sprite: { sheet: BOMB_SHEET, renderScale: 1, animations: {} },
  drawLayer: 'afterBlocks',
  resetScope: 'death',
  spawn: (ctx: DeployableSpawnContext): PlacedBombState =>
    createPlacedBomb(ctx.id, ctx.level, ctx.blocks, ctx.col, ctx.row, ctx.crumblingFloorStates),
  step: (state, dt) => stepPlacedBomb(state, dt),
  onTick: (state: PlacedBombState, ctx: DeployableItemTickContext): DeployableItemOutcome => {
    if (hasDetonated(state)) {
      return {
        disposition: 'remove',
        blasts: [
          {
            col: Math.round(state.x / RENDERED_TILE_SIZE),
            row: Math.round(state.y / RENDERED_TILE_SIZE),
            x: state.x,
            y: state.y,
            effectId: state.id,
            hitEffectId: `bomb-${state.id}`,
          },
        ],
      };
    }
    if (checkBombFellOut(state, ctx.level)) return { disposition: 'remove' };
    return { disposition: 'keep' };
  },
  draw: (placed: PlacedBombState, dc: DrawContext) => {
    const image = dc.sprites[BOMB_SHEET.src];
    if (!image) return;
    dc.ctx.imageSmoothingEnabled = false;

    const { frame, scale } = bombFuseFrame(placed.fuseElapsed);
    const { sx, sy } = frameSource(BOMB_SHEET, frame);
    const centerX = placed.x + RENDERED_TILE_SIZE / 2 + dc.originX;
    const centerY = placed.y + RENDERED_TILE_SIZE / 2 + dc.originY;

    dc.ctx.save();
    dc.ctx.translate(centerX, centerY);
    dc.ctx.scale(scale, scale);
    dc.ctx.drawImage(
      image,
      sx,
      sy,
      BOMB_SHEET.frameWidth,
      BOMB_SHEET.frameHeight,
      -RENDERED_TILE_SIZE / 2,
      -RENDERED_TILE_SIZE / 2,
      RENDERED_TILE_SIZE,
      RENDERED_TILE_SIZE,
    );
    dc.ctx.restore();
  },
};

/**
 * Rendered size of a dropped bomb pickup — deliberately smaller than a tile,
 * matching the heart pickup's `HEART_PICKUP_RENDERED_SIZE` (24). A bomb lying
 * in the world reads as a collectible version of the HUD icon rather than a
 * placed bomb.
 */
export const BOMB_PICKUP_RENDERED_SIZE = 24;

/** Centers the smaller rendered pickup within its one-tile marker, on both
 *  axes — mirrors Heart.ts's offsets. */
export const BOMB_PICKUP_TILE_OFFSET_X = (RENDERED_TILE_SIZE - BOMB_PICKUP_RENDERED_SIZE) / 2;
export const BOMB_PICKUP_TILE_OFFSET_Y = (RENDERED_TILE_SIZE - BOMB_PICKUP_RENDERED_SIZE) / 2;

/**
 * A bomb dropped by a destroyed bomb-pot, sitting in the world as its own
 * bobbing pickup (bob reuses Coin.ts's coinBobOffset, same as the heart).
 * Composes the shared `Pickup` base: a touched bomb is retained and flagged
 * `collected` (skipped on draw/collision) and cleared from its array by
 * `resetGame()`. At the inventory cap the bomb kind's `maxPerTick` yields
 * nothing, so it is left in the world untouched. A bomb carries no CV fact.
 */
export interface BombPickupState extends Pickup {
  kind: 'bomb';
}

/** Spawns a bomb pickup at a just-destroyed bomb-pot's position, reusing the
 *  pot's own id — a bomb-pot is removed from the world on its one hit, and
 *  `bombPickupStates` is cleared on respawn, so there's no collision risk
 *  (same convention as `spawnHeartPickup`). */
export function spawnBombPickup(id: string, x: number, y: number): BombPickupState {
  return { id, kind: 'bomb', x, y, collected: false };
}

/**
 * The `PickupType` view of a dropped bomb. Always draws `bomb.png`'s frame 0
 * (the unlit bomb, the same art the HUD icon uses); the placed bomb's lit
 * frames 1-5 are never drawn for a world pickup. Bobs exactly like a
 * coin/heart. Its `maxPerTick` (the remaining inventory capacity) is what
 * leaves a bomb in the world at the cap.
 */
export const bomb: PickupType<BombPickupState> = {
  key: 'bomb',
  drawLayer: 'afterEnemies',
  sprite: {
    sheet: BOMB_SHEET,
    renderScale: 1,
    // Frame selection goes through frameIndex (always 0), not named
    // animations — same convention as Heart.ts/Key.ts.
    animations: {},
  },
  box: (pickup) => ({
    x: pickup.x + BOMB_PICKUP_TILE_OFFSET_X,
    y: pickup.y + BOMB_PICKUP_TILE_OFFSET_Y,
    width: BOMB_PICKUP_RENDERED_SIZE,
    height: BOMB_PICKUP_RENDERED_SIZE,
  }),
  frameIndex: () => 0,
  bobOffset: (_pickup, elapsed) => coinBobOffset(elapsed),
  spawn: (source: PickupSpawnSource): BombPickupState =>
    spawnBombPickup(source.id, source.x, source.y),
  maxPerTick: (ctx) => ctx.capacity ?? 0,
  onPickup: () => ({ bombs: 1 }),
  draw: (pickup, dc) => {
    const image = dc.sprites[BOMB_SHEET.src];
    if (!image) return;

    const { sx, sy } = frameSource(BOMB_SHEET, bomb.frameIndex(pickup, dc.worldElapsed, 0));
    const bob = bomb.bobOffset(pickup, dc.worldElapsed);

    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      sx,
      sy,
      BOMB_SHEET.frameWidth,
      BOMB_SHEET.frameHeight,
      pickup.x + BOMB_PICKUP_TILE_OFFSET_X + dc.originX,
      pickup.y + BOMB_PICKUP_TILE_OFFSET_Y + dc.originY + bob,
      BOMB_PICKUP_RENDERED_SIZE,
      BOMB_PICKUP_RENDERED_SIZE,
    );
  },
};
