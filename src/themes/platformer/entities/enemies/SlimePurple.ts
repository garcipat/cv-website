import type { EnemyType, BaseEnemyState } from './EnemyType';
import { baseEnemyState, baseRevive, takeHit, ENEMY_HIT_REACTION_SECONDS } from './shared';
import { isInvulnerable } from '../capabilities';
import { ENEMY_ANIMATIONS } from './EnemyAnimation';
import { SLIME_PURPLE_SHEET, KEY_SHEET } from '../sprites/sheets';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import { drawSpriteSheetEntity } from './drawSpriteSheetEntity';
import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../../level/Terrain';
import { KEY_FRAME_WIDTH, KEY_FRAME_HEIGHT } from '../KeyPickup';
import type { DrawContext } from '../../engine/DrawContext';

export interface SlimePurpleState extends BaseEnemyState {
  type: 'slimePurple';
  /** True while this slime's top is spiked and un-stompable — set by a
   *  non-fatal stomp, cleared by `onTick` once the cooldown elapses. */
  spiked: boolean;
  /** Seconds since `spiked` was last set. Meaningless while `spiked` is
   *  false. */
  spikeTimer: number;
}

const SLIME_PURPLE_SPRITE: SpriteDescriptor = {
  sheet: SLIME_PURPLE_SHEET,
  renderScale: 2,
  animations: ENEMY_ANIMATIONS,
};

/** Transparent margin inside the native frame, in pre-scale pixels — same
 *  values Collision.ts's enemyHitbox reads via `hitboxPaddingNative` below. */
const HITBOX_PADDING_NATIVE = { side: 5, top: 9 };

/** The held key is drawn at a FRACTION of the slime's own opaque silhouette
 *  height (not KEY_RENDERED_WIDTH/HEIGHT, which is sized for the standalone
 *  ground pickup and reads as oversized crammed inside a slime's body; and
 *  not the sprite's full bounding square either — see the silhouette-padding
 *  comment below). Width follows from the sprite's native 14:28 aspect ratio
 *  so it isn't stretched. */
const SLIME_PURPLE_HELD_KEY_HEIGHT_RATIO = 0.5;

/** Nudges the held key down from dead-center in the silhouette — reads
 *  slightly better sitting a bit lower in the blob than perfectly centered. */
const SLIME_PURPLE_HELD_KEY_Y_NUDGE = 4;

/** How long the spikes take to pop fully out at the start of the cooldown —
 *  see `spikeGrowthScale` below. Fast: the pop should read as a snappy
 *  reaction, not a slow bloom. */
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

/** Total time this slime stays `spiked` (un-stompable from above during this
 *  window) — the sum of the three phase durations above, not an independent
 *  value, so it becomes stompable again exactly when the retract animation
 *  finishes, never before (looking like it's still got spikes out) or after
 *  (an idle beat with no visible spikes but still immune). */
export const SPIKE_COOLDOWN_DURATION_SECONDS =
  SPIKE_GROW_DURATION_SECONDS + SPIKE_HOLD_DURATION_SECONDS + SPIKE_RETRACT_DURATION_SECONDS;

const TOP_SPIKE_FRACTIONS = [0.3, 0.7];

/** Tinted toward this slime's own body color (an approximate match, not
 *  sampled from the sprite sheet — there's no existing color constant for
 *  the slime PNG to reuse) so the spikes read as part of the slime, not an
 *  unrelated bone/rock overlay. Only slimePurple ever spikes — a green slime
 *  has 1 hit point, so it never survives a stomp to reach the spiked
 *  cooldown. */
const SPIKE_COLORS = { fill: '#9a6fd6', outline: '#4d2f7a' };

/**
 * Returns a 0-1-0 growth curve across three explicit, sequential phases of
 * `spikeTimer` (see the SPIKE_*_DURATION_SECONDS constants above, whose sum
 * is the total spiked cooldown): pop up to 1 over the grow phase, hold at 1
 * for the hold phase, retract back to 0 over the retract phase — each
 * phase's own duration, not carved out of one shared total, so grow and
 * retract can (and deliberately do) move at different speeds. A
 * `spikeTimer` at or past the total is clamped to the fully-retracted end of
 * that last phase, covering the one frame before `onTick` below clears
 * `spiked` that same tick.
 */
function spikeGrowthScale(spikeTimer: number): number {
  if (spikeTimer < SPIKE_GROW_DURATION_SECONDS) {
    return spikeTimer / SPIKE_GROW_DURATION_SECONDS;
  }
  const sinceHoldStart = spikeTimer - SPIKE_GROW_DURATION_SECONDS;
  if (sinceHoldStart < SPIKE_HOLD_DURATION_SECONDS) {
    return 1;
  }
  const sinceRetractStart = sinceHoldStart - SPIKE_HOLD_DURATION_SECONDS;
  return Math.max(1 - sinceRetractStart / SPIKE_RETRACT_DURATION_SECONDS, 0);
}

/** Fills one spike triangle with a thin stroked outline — a flat outline
 *  works for any triangle orientation (top-pointing or side-pointing),
 *  unlike the old top-only overlay's offset-vertex outline trick. */
function fillSpikeTriangle(
  ctx: CanvasRenderingContext2D,
  colors: { fill: string; outline: string },
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.closePath();
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.strokeStyle = colors.outline;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// A purple slime reads as a distinctly bigger, slower, tougher variant of the
// green one — twice the size, 70% of the patrol speed, three stomps.
export const slimePurple: EnemyType<SlimePurpleState> = {
  key: 'slimePurple',
  maxHitPoints: 3,
  hitReactionSeconds: ENEMY_HIT_REACTION_SECONDS,
  patrolSpeedMultiplier: 0.7,
  hitboxPaddingNative: HITBOX_PADDING_NATIVE,
  sprite: SLIME_PURPLE_SPRITE,
  heldItem: 'key',

  create: (placement, index) => ({
    ...baseEnemyState(placement, index, 3, slimePurple.hitReactionSeconds),
    type: 'slimePurple',
    spiked: false,
    spikeTimer: 0,
  }),
  revive: (enemy) => ({
    ...baseRevive(enemy, 3, slimePurple.hitReactionSeconds),
    type: 'slimePurple',
    spiked: false,
    spikeTimer: 0,
  }),

  /** Advances the spiked cooldown by `dt` seconds. No-op (returns the same
   *  reference) while not currently `spiked` — this timer runs independently
   *  of `animState`/`hitTimer`: this slime keeps counting up toward the
   *  cooldown's end while patrolling normally, not just while mid
   *  hit-reaction. */
  onTick: (enemy, dt) => {
    if (!enemy.spiked) return enemy;
    const spikeTimer = enemy.spikeTimer + dt;
    if (spikeTimer < SPIKE_COOLDOWN_DURATION_SECONDS) return { ...enemy, spikeTimer };
    return { ...enemy, spiked: false, spikeTimer: 0 };
  },

  draw(enemy, dc) {
    const size = SLIME_PURPLE_SPRITE.sheet.frameWidth * RENDER_SCALE * SLIME_PURPLE_SPRITE.renderScale;
    const sidePadding = HITBOX_PADDING_NATIVE.side * RENDER_SCALE * SLIME_PURPLE_SPRITE.renderScale;
    const topPadding = HITBOX_PADDING_NATIVE.top * RENDER_SCALE * SLIME_PURPLE_SPRITE.renderScale;
    const dx = enemy.x + (RENDERED_TILE_SIZE - size) / 2 + dc.originX;
    const dy = enemy.y + (RENDERED_TILE_SIZE - size) + dc.originY;

    const keySprite = dc.sprites[KEY_SHEET.src];
    const showsHeldKey = keySprite != null && !enemy.rewardGiven;

    if (showsHeldKey) {
      // Centered against the sprite's ACTUAL opaque silhouette, not its full
      // (mostly transparent) bounding square — a slime's blob shape sits
      // bottom-anchored with a big gap above it (see HITBOX_PADDING_NATIVE's
      // own doc comment: 9px of a 24px native frame, none below), so
      // centering against the full size×size box put the key well above the
      // visible body and made it look larger than the blob itself.
      const silhouetteWidth = size - sidePadding * 2;
      const silhouetteHeight = size - topPadding; // bottom padding is 0
      const silhouetteLeft = dx + sidePadding;
      const silhouetteTop = dy + topPadding;

      const heldKeyHeight = silhouetteHeight * SLIME_PURPLE_HELD_KEY_HEIGHT_RATIO;
      const heldKeyWidth = heldKeyHeight * (KEY_FRAME_WIDTH / KEY_FRAME_HEIGHT);
      dc.ctx.drawImage(
        keySprite,
        0,
        0,
        KEY_FRAME_WIDTH,
        KEY_FRAME_HEIGHT,
        silhouetteLeft + (silhouetteWidth - heldKeyWidth) / 2,
        silhouetteTop + (silhouetteHeight - heldKeyHeight) / 2 + SLIME_PURPLE_HELD_KEY_Y_NUDGE,
        heldKeyWidth,
        heldKeyHeight,
      );
    }

    drawSpriteSheetEntity(enemy, dc, SLIME_PURPLE_SPRITE);

    if (enemy.alive && enemy.spiked) {
      drawSpikes(enemy, dc, dx, dy, size, sidePadding, topPadding);
    }
  },

  onPlayerCollide: (enemy, _player, contact) => {
    // Mid-reaction, this slime is harmless in every way — not merely immune
    // to a second stomp. Without that, bouncing off a stomp while still
    // overlapping the now-frozen enemy registers as a spurious side-hit
    // against the very enemy just stomped.
    if (isInvulnerable(enemy, slimePurple.hitReactionSeconds) || enemy.hitPoints <= 0) return {};
    if (enemy.spiked) {
      // A failed stomp should read as bouncing off the spikes, not as an
      // ordinary side touch.
      return { damagePlayer: 1, knockback: contact.side === 'top' ? 'awayAndUp' : 'away' };
    }
    if (contact.side === 'top') return { self: takeHit(enemy), bouncePlayer: true };
    return { damagePlayer: 1, knockback: 'away' };
  },

  /** Surviving a hit grows spikes that make the top un-stompable until they
   *  retract, and any fresh hit restarts the cooldown. A hit that finished
   *  this slime off grows nothing — a corpse with spikes out would be both
   *  wrong to look at and, for the frame before it is cleared away, wrong to
   *  touch. */
  onDamaged: (enemy) => ({ ...enemy, spiked: enemy.hitPoints > 0, spikeTimer: 0 }),
};

/**
 * Draws 4 triangles sticking out of the slime's visible silhouette — 2 out
 * of the top edge, 2 out of the left/right side edges — rather than a single
 * row floating above the top edge. Each triangle's base sinks well *into*
 * the hitbox (not flush with the edge), and each triangle itself is kept
 * short, so the visible part reads as a short spike breaking the surface
 * close to the slime's body, not a shape hovering apart from it. Insets by
 * the same hitbox padding `enemyHitbox` (Collision.ts) uses, so the spikes
 * are positioned relative to the actual visible slime blob, not the
 * sprite's transparent render-slot margin. `enemy.spikeTimer` drives a
 * one-shot grow-then-shrink size curve (`spikeGrowthScale`) independently —
 * every spiked enemy pulses on its own cooldown, not in shared lockstep.
 */
function drawSpikes(
  enemy: SlimePurpleState,
  dc: DrawContext,
  dx: number,
  dy: number,
  size: number,
  sidePad: number,
  topPad: number,
): void {
  const scale = spikeGrowthScale(enemy.spikeTimer);
  const colors = SPIKE_COLORS;
  const left = dx + sidePad;
  const top = dy + topPad;
  const width = size - 2 * sidePad;
  const height = size - topPad;
  const right = left + width;
  const midY = top + height / 2;

  const topSpikeLength = width * 0.3 * scale;
  const topSpikeHalfWidth = width * 0.12;
  const topSpikeSink = topSpikeHalfWidth * 1.5;
  for (const fraction of TOP_SPIKE_FRACTIONS) {
    const baseX = left + width * fraction;
    const baseY = top + topSpikeSink;
    fillSpikeTriangle(
      dc.ctx,
      colors,
      baseX - topSpikeHalfWidth,
      baseY,
      baseX + topSpikeHalfWidth,
      baseY,
      baseX,
      baseY - topSpikeLength,
    );
  }

  const sideSpikeLength = height * 0.26 * scale;
  const sideSpikeHalfHeight = height * 0.1;
  const sideSpikeSink = sideSpikeHalfHeight * 1.5;
  fillSpikeTriangle(
    dc.ctx,
    colors,
    left + sideSpikeSink,
    midY - sideSpikeHalfHeight,
    left + sideSpikeSink,
    midY + sideSpikeHalfHeight,
    left - sideSpikeLength,
    midY,
  );
  fillSpikeTriangle(
    dc.ctx,
    colors,
    right - sideSpikeSink,
    midY - sideSpikeHalfHeight,
    right - sideSpikeSink,
    midY + sideSpikeHalfHeight,
    right + sideSpikeLength,
    midY,
  );
}
