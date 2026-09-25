import type { PickupSpawnSource, PickupType } from './PickupType';
import type { CollectiblePlacement } from '../../level/CollectibleMapper';
import { COIN_SHEET } from '../sprites/sheets';
import { frameSource } from '../sprites/SpriteSheet';
import { revealedFactCountFor } from '../../level/SkillFactPacing';
import type { PickupReveal } from '../../contracts/PickupOutcome';
import { RENDER_SCALE } from '../../level/Terrain';

/** `coin.png` is a 192x16 sheet: 12 frames of 16x16, one spin cycle. */
export const COIN_FRAME_SIZE = 16;
export const COIN_RENDERED_SIZE = COIN_FRAME_SIZE * RENDER_SCALE;
export const COIN_FRAME_COUNT = 12;

/** Seconds each spin frame is held before advancing — a snappier cycle than
 *  the player's idle animation, since a coin's spin is a small ambient loop
 *  rather than a state-driven animation. */
export const COIN_FRAME_DURATION = 0.12;

/**
 * Spin-cycle frame index for a given elapsed time, shared by every coin (all
 * coins spin in sync, so no per-coin animation state is needed — unlike
 * Player.ts's animState/animFrame/animTimer, which vary per player). Clamps
 * negative elapsed time to frame 0 defensively, though callers only ever pass
 * an accumulated (non-negative) timer.
 */
export function coinFrameIndex(elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  const frame = Math.floor(elapsedSeconds / COIN_FRAME_DURATION);
  return frame % COIN_FRAME_COUNT;
}

/** Vertical bob distance in rendered px, and the full up-down-up cycle's
 *  duration in seconds — a small ambient float layered on top of the spin,
 *  driven by the same shared elapsed clock as coinFrameIndex. */
export const COIN_BOB_AMPLITUDE = 3;
export const COIN_BOB_PERIOD_SECONDS = 1.6;

/**
 * Vertical offset (rendered px, positive = downward, matching the canvas y
 * axis) to add to every pickup's y position for the current elapsed time — a
 * sine wave shared by every bobbing pickup (coin, key, heart, bomb), so they
 * all bob in sync just like they all spin in sync (see coinFrameIndex).
 * Independent of the spin frame's own timing (COIN_FRAME_DURATION) since the
 * two are unrelated cycles.
 */
export function coinBobOffset(elapsedSeconds: number): number {
  return COIN_BOB_AMPLITUDE * Math.sin((elapsedSeconds / COIN_BOB_PERIOD_SECONDS) * Math.PI * 2);
}

/**
 * The `PickupType` view (and, since R-006, the single home) of the placed
 * coin. The placed coin is the one pickup whose state is keyed by its own
 * position (`CollectiblePlacement`) — see `level/CollectibleMapper.ts`.
 * Collecting it declares the paced skill-fact consequences; the shared applier
 * flags it `collected` (retained) and applies them.
 */
export const coin: PickupType<CollectiblePlacement> = {
  key: 'coin',
  drawLayer: 'beforeEnemies',
  sprite: {
    sheet: COIN_SHEET,
    renderScale: 1,
    // Frame selection goes through frameIndex (coinFrameIndex), not through
    // named animations — this stays empty so the frame count/duration have
    // one source of truth instead of two that could silently diverge.
    animations: {},
  },
  box: (placement) => ({
    x: placement.x,
    y: placement.y,
    width: COIN_RENDERED_SIZE,
    height: COIN_RENDERED_SIZE,
  }),
  frameIndex: (_placement, elapsed) => coinFrameIndex(elapsed),
  bobOffset: (_placement, elapsed) => coinBobOffset(elapsed),
  spawn: (source: PickupSpawnSource): CollectiblePlacement => ({
    id: source.id,
    kind: 'coin',
    x: source.x,
    y: source.y,
    collected: false,
  }),
  // A coin carries no fact of its own (see CollectibleMapper.ts's
  // mapCVDataToSkillFactPool doc comment). How many facts a given
  // collected-coin count should reveal is resolved by SkillFactPacing.ts's
  // revealedFactCountFor against the pre-tick `collectedBefore`, which the
  // shared applier advances per processed hit so several same-tick coins
  // reveal successive fact windows.
  onPickup: (placement, ctx) => {
    const poolLength = ctx.pool.length;
    const factCountBefore = revealedFactCountFor(ctx.collectedBefore, ctx.total, poolLength);
    const factCountAfter = revealedFactCountFor(ctx.collectedBefore + 1, ctx.total, poolLength);
    const facts: PickupReveal[] = [];
    for (let factIndex = factCountBefore; factIndex < factCountAfter; factIndex++) {
      const fact = ctx.pool[factIndex];
      if (!fact) continue; // defensive only — factCountAfter never exceeds poolLength
      // A unique key per revealed fact, not just per coin — one coin can
      // reveal more than one fact when fewer coins are placed than there are
      // CVData facts.
      facts.push({ fact, effectId: `${placement.id}-${factIndex}` });
    }
    // The coins popup is bumped by the shared applier once per tick, for every
    // coin rather than only the ones that reveal a fact.
    return { facts, counterKey: 'coins' };
  },
  draw: (placement, dc) => {
    const image = dc.sprites[COIN_SHEET.src];
    if (!image) return;

    const coinSource = frameSource(COIN_SHEET, coin.frameIndex(placement, dc.worldElapsed, 0));
    const bob = coin.bobOffset(placement, dc.worldElapsed);

    dc.ctx.imageSmoothingEnabled = false;
    dc.ctx.drawImage(
      image,
      coinSource.sx,
      coinSource.sy,
      COIN_FRAME_SIZE,
      COIN_FRAME_SIZE,
      placement.x + dc.originX,
      placement.y + dc.originY + bob,
      COIN_RENDERED_SIZE,
      COIN_RENDERED_SIZE,
    );
  },
};
