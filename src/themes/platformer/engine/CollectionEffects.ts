import type { CounterKey } from '../entities/CollectiblesSummary';
import type { EnemyTypeKey } from '../entities/enemies';

/** Seconds each phase of a collected-fact animation takes: a quick rise from
 *  the collection point to the middle of the screen, a hold there so the
 *  fact is actually readable, then the flight to the journal icon. */
export const RISE_DURATION_SECONDS = 0.4;
export const HOLD_DURATION_SECONDS = 1.0;
export const FLIGHT_DURATION_SECONDS = 0.6;

/**
 * One in-flight collected-fact animation. `startX/startY` (the collection
 * point), `midX/midY` (the screen's center — where the text pauses to be
 * read), and `targetX/targetY` (the journal icon) are all SCREEN-space (not
 * world-space) — computed once at collection time by the caller
 * (RewardReveal.ts for fact reveals, PlatformerPage.tsx's key pickup) using
 * the camera origin and canvas size at that
 * instant, since the animation is short-lived (~2s) and re-deriving
 * world-to-screen every frame isn't worth the complexity for an effect this
 * brief. `text` is the short label shown throughout (the category or
 * language name — see the coin-collection plan's "Key design decisions" for
 * why it's not the full skill list).
 */
export interface FlightEffect {
  id: string;
  text: string;
  /** Optional icon (an emoji — a language's flag, or a section's generic
   * symbol) shown alongside `text`. Kept separate rather than baked into
   * `text` because Renderer.ts draws it with a different font: the pixel
   * font `text` uses has no emoji glyphs, so an emoji concatenated into the
   * same string would silently fail to render (canvas `fillText` doesn't
   * fall back to a system emoji font the way DOM text does). */
  icon?: string;
  startX: number;
  startY: number;
  midX: number;
  midY: number;
  targetX: number;
  targetY: number;
  elapsed: number;
  phase: 'rising' | 'holding' | 'flying' | 'done';
}

export function startFlightEffect(
  id: string,
  text: string,
  startX: number,
  startY: number,
  midX: number,
  midY: number,
  targetX: number,
  targetY: number,
  icon?: string,
): FlightEffect {
  return { id, text, icon, startX, startY, midX, midY, targetX, targetY, elapsed: 0, phase: 'rising' };
}

/** Fixed number of vertical text "slots" fast/simultaneous collections cycle
 *  through (handed out by `createSlotAllocator` below) — 1, 2, 3, 1, 2, 3, ...
 *  so collecting several pickups in quick succession reads as a short
 *  rotating list instead of every fact text landing on the exact same
 *  screen position. */
export const COLLECTION_TEXT_SLOT_COUNT = 3;

/** Vertical gap between successive collection-text slots, in screen px (see
 *  COLLECTION_TEXT_SLOT_COUNT). */
export const COLLECTION_TEXT_STACK_ROW_HEIGHT = 34;

/** Hands out the next collection-text stack offset, in screen px. */
export type SlotAllocator = () => number;

/**
 * Builds one tick's collection-text slot allocator: successive calls step down
 * a row (`COLLECTION_TEXT_STACK_ROW_HEIGHT`) and cycle through
 * `COLLECTION_TEXT_SLOT_COUNT` slots, starting from `inFlightCount` — how many
 * flight effects are still in the air from previous ticks.
 *
 * Seeded from the live in-flight count rather than an ever-incrementing
 * counter, so a pickup collected in isolation always lands on slot 0 (the
 * primary spot) and only genuinely concurrent pickups — whose effects are
 * still mid-animation — spread across further slots.
 *
 * ONE allocator is created per tick and SHARED by every flight-text site,
 * because two texts appearing in the same tick must never land on the same
 * row. That includes the key pickup, which is otherwise outside the fact-reveal
 * trigger (it reveals no fact, has a static caption and flies to the HUD key
 * counter): a per-site counter would let a key and a fact reveal both take
 * slot 0 and overlap.
 */
export function createSlotAllocator(inFlightCount: number): SlotAllocator {
  let nextSlot = inFlightCount % COLLECTION_TEXT_SLOT_COUNT;
  return () => {
    const slot = nextSlot;
    nextSlot = (nextSlot + 1) % COLLECTION_TEXT_SLOT_COUNT;
    return slot * COLLECTION_TEXT_STACK_ROW_HEIGHT;
  };
}

/** Advances the effect by `dt` seconds, transitioning
 *  rising -> holding -> flying -> done as RISE_DURATION_SECONDS, then
 *  HOLD_DURATION_SECONDS, then FLIGHT_DURATION_SECONDS elapse. No-op (same
 *  reference) once `done`. */
export function tickFlightEffect(effect: FlightEffect, dt: number): FlightEffect {
  if (effect.phase === 'done') return effect;
  const elapsed = effect.elapsed + dt;
  const holdEnd = RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS;
  const flightEnd = holdEnd + FLIGHT_DURATION_SECONDS;
  if (elapsed >= flightEnd) {
    return { ...effect, elapsed, phase: 'done' };
  }
  const phase = elapsed >= holdEnd ? 'flying' : elapsed >= RISE_DURATION_SECONDS ? 'holding' : 'rising';
  return { ...effect, elapsed, phase };
}

/**
 * Current screen-space position and opacity (0-1) to draw the fact text at.
 * `rising`: interpolates start -> mid, full opacity. `holding`: fixed at
 * mid, full opacity — this is the readable pause. `flying`: linearly
 * interpolates mid -> target, fading out over the final 40% of the flight so
 * it doesn't pop out of existence right at the icon. `done`: invisible.
 */
export function flightEffectPosition(effect: FlightEffect): { x: number; y: number; opacity: number } {
  if (effect.phase === 'done') {
    return { x: effect.targetX, y: effect.targetY, opacity: 0 };
  }
  if (effect.phase === 'rising') {
    const progress = Math.min(1, effect.elapsed / RISE_DURATION_SECONDS);
    const x = effect.startX + (effect.midX - effect.startX) * progress;
    const y = effect.startY + (effect.midY - effect.startY) * progress;
    return { x, y, opacity: 1 };
  }
  if (effect.phase === 'holding') {
    return { x: effect.midX, y: effect.midY, opacity: 1 };
  }
  const flightElapsed = effect.elapsed - RISE_DURATION_SECONDS - HOLD_DURATION_SECONDS;
  const progress = Math.min(1, flightElapsed / FLIGHT_DURATION_SECONDS);
  const x = effect.midX + (effect.targetX - effect.midX) * progress;
  const y = effect.midY + (effect.targetY - effect.midY) * progress;
  const opacity = progress < 0.6 ? 1 : 1 - (progress - 0.6) / 0.4;
  return { x, y, opacity };
}

/** Seconds the "(icon) collected / total" counter popup stays fully visible
 *  before fading, and the total seconds until it's gone — a per-collection
 *  running-count popup shown near the collection point rather than a
 *  persistent HUD counter, to avoid clutter at the top. Sized so the popup's
 *  total lifetime (HOLD + FADE) slightly exceeds the fact-flight text's own
 *  total lifetime (RISE_DURATION_SECONDS + HOLD_DURATION_SECONDS +
 *  FLIGHT_DURATION_SECONDS = 2.0s), so the counter doesn't disappear before
 *  the flight text below it is done, which would read as vanishing too
 *  fast. */
export const COUNTER_POPUP_HOLD_SECONDS = 1.7;
export const COUNTER_POPUP_FADE_SECONDS = 0.4;
export const COUNTER_POPUP_DURATION_SECONDS = COUNTER_POPUP_HOLD_SECONDS + COUNTER_POPUP_FADE_SECONDS;

/**
 * Which collectible counters get a TRANSIENT popup — derived from `CounterKey`
 * rather than spelled out again, so adding a sixth counter cannot leave this
 * union silently stale. `'chests'` is the one exclusion: chests already have a
 * PERMANENT HUD counter (see Renderer.ts's chest counter), so a chest reveal
 * deliberately bumps no popup.
 */
export type CounterPopupLabelKey = Exclude<CounterKey, 'chests'>;

/**
 * One "(icon) collected / total" counter popup for a single collectible
 * type. `PlatformerState.ts`'s `activeCounterPopups` keeps at most one of
 * these PER TYPE (keyed by `labelKey`) — collecting another coin while a
 * coin popup is already showing refreshes that same slot (new count, timer
 * restarted) rather than queuing a second one, but collecting a coin and a
 * fruit close together shows both side by side, since they're genuinely
 * different information (unlike the fact-flight text's rotating slots, which
 * exist purely to avoid overlapping the SAME kind of text). Started by
 * RewardReveal.ts (and, for coins, by PlatformerPage.tsx's pickup site) and
 * drawn by Renderer.ts at a fixed screen position above the fact-flight text's
 * stacked slots, not tied to the collection point.
 */
export interface CounterPopupEffect {
  labelKey: CounterPopupLabelKey;
  collected: number;
  total: number;
  elapsed: number;
}

export function startCounterPopup(
  labelKey: CounterPopupEffect['labelKey'],
  collected: number,
  total: number,
): CounterPopupEffect {
  return { labelKey, collected, total, elapsed: 0 };
}

/** Advances the popup by `dt` seconds; returns `null` once its total
 *  duration has elapsed (the caller clears the signal at that point). */
export function tickCounterPopup(effect: CounterPopupEffect, dt: number): CounterPopupEffect | null {
  const elapsed = effect.elapsed + dt;
  if (elapsed >= COUNTER_POPUP_DURATION_SECONDS) return null;
  return { ...effect, elapsed };
}

/** 1 while held, then linearly fades to 0 over the final
 *  COUNTER_POPUP_FADE_SECONDS. */
export function counterPopupOpacity(effect: CounterPopupEffect): number {
  if (effect.elapsed < COUNTER_POPUP_HOLD_SECONDS) return 1;
  return Math.max(0, 1 - (effect.elapsed - COUNTER_POPUP_HOLD_SECONDS) / COUNTER_POPUP_FADE_SECONDS);
}

export const SPARKLE_DURATION_SECONDS = 0.4;
const SPARKLE_COUNT = 6;
const SPARKLE_MAX_RADIUS = 18;

export interface SparkleParticle {
  dx: number;
  dy: number;
  opacity: number;
}

/**
 * A fixed ring of small dots radiating outward from a collection point and
 * fading, in place of a full particle system — see the coin-collection
 * plan's "Key design decisions". Returns offsets (dx/dy) relative to the
 * collection point, not absolute positions, so the caller (Renderer.ts)
 * just adds them to wherever the collectible was. `scale` multiplies the
 * ring's radius (default 1, unchanged from before this parameter existed) —
 * PuffEffect below uses it to make a bigger entity's puff visibly bigger.
 */
export function sparkleParticles(elapsedSinceCollect: number, scale = 1): SparkleParticle[] {
  if (elapsedSinceCollect < 0 || elapsedSinceCollect > SPARKLE_DURATION_SECONDS) return [];
  const progress = elapsedSinceCollect / SPARKLE_DURATION_SECONDS;
  const radius = SPARKLE_MAX_RADIUS * scale * progress;
  const opacity = 1 - progress;
  return Array.from({ length: SPARKLE_COUNT }, (_, i) => {
    const angle = (i / SPARKLE_COUNT) * Math.PI * 2;
    return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius, opacity };
  });
}

/**
 * A standalone sparkle burst at a world event — an enemy defeated, a block
 * broken — that carries no fact and flies nowhere (unlike FlightEffect,
 * which is always fact-bearing). Kept as its own type rather than a
 * degenerate FlightEffect (empty text, equal start/mid/target coordinates):
 * see B-003 (docs/bugs/B-003-puff-bound-to-fact-reward/ticket.md) for why
 * that hack was the wrong shape. `scale` lets a bigger entity (a purple
 * slime vs. a green slime) produce a visibly bigger burst — see
 * entities/Enemy.ts's `enemyEffectAnchor`.
 */
export interface PuffEffect {
  id: string;
  x: number;
  y: number;
  scale: number;
  elapsed: number;
}

export function startPuffEffect(id: string, x: number, y: number, scale = 1): PuffEffect {
  return { id, x, y, scale, elapsed: 0 };
}

/** Advances the puff by `dt` seconds. No phase machine (unlike
 *  tickFlightEffect) — a puff has exactly one phase, bursting, and callers
 *  filter it out once `elapsed` passes SPARKLE_DURATION_SECONDS (same bound
 *  `sparkleParticles` itself already enforces by returning `[]`). */
export function tickPuffEffect(effect: PuffEffect, dt: number): PuffEffect {
  return { ...effect, elapsed: effect.elapsed + dt };
}

/** One cycle of a heal aura's rise-and-fade takes this long. */
export const HEAL_AURA_DURATION_SECONDS = 0.5;

/**
 * A one-shot golden aura played on the PLAYER when a heart pickup heals
 * them — a glow, a handful of light rays, and a few sparkles, all anchored
 * to wherever the player currently is (unlike `PuffEffect`, which is
 * anchored to a fixed world point set once at spawn time: an enemy/block
 * doesn't move, but the player does, so this effect carries no x/y of its
 * own — the caller re-derives the anchor from the live `playerState` every
 * frame it draws). Deliberately not a phase machine like `FlightEffect`:
 * like `PuffEffect`, it has exactly one phase, and every visual (glow,
 * rays, sparkles) shares the same single fade curve (`healAuraOpacity`)
 * rather than needing its own.
 */
export interface HealAuraEffect {
  id: string;
  elapsed: number;
}

export function startHealAuraEffect(id: string): HealAuraEffect {
  return { id, elapsed: 0 };
}

/** Advances the aura by `dt` seconds. No phase machine — same convention as
 *  `tickPuffEffect`. */
export function tickHealAuraEffect(effect: HealAuraEffect, dt: number): HealAuraEffect {
  return { ...effect, elapsed: effect.elapsed + dt };
}

/** Shared fade curve for every part of the aura (glow, rays, sparkles) — 1
 *  at the instant it starts, linearly down to 0 by `HEAL_AURA_DURATION_SECONDS`,
 *  and 0 outside that range (before start, or after the caller should have
 *  already filtered the effect out). */
export function healAuraOpacity(elapsed: number): number {
  if (elapsed < 0 || elapsed > HEAL_AURA_DURATION_SECONDS) return 0;
  return 1 - elapsed / HEAL_AURA_DURATION_SECONDS;
}

const HEAL_AURA_RAY_COUNT = 5;

/** One light ray's horizontal offset from the anchor (`dx`) and current
 *  height, both in px. `dx` stays fixed for a ray's whole lifetime — only
 *  `height` grows, from a short stub up to roughly `width` tall, so the
 *  rays read as "shooting up" rather than appearing at full height at once. */
export interface HealAuraRay {
  dx: number;
  height: number;
}

/**
 * Returns the aura's light rays for the given elapsed time, spread evenly
 * across `width` (the player's own rendered width, so the rays stay
 * compact — hugging the player rather than spreading across the screen).
 * Empty outside the effect's active window, same convention as
 * `sparkleParticles`.
 */
export function healAuraRays(elapsed: number, width: number): HealAuraRay[] {
  if (elapsed < 0 || elapsed > HEAL_AURA_DURATION_SECONDS) return [];
  const progress = elapsed / HEAL_AURA_DURATION_SECONDS;
  const height = width * (0.25 + 0.75 * progress);
  const spacing = width / (HEAL_AURA_RAY_COUNT + 1);
  return Array.from({ length: HEAL_AURA_RAY_COUNT }, (_, i) => ({
    dx: spacing * (i + 1) - width / 2,
    height,
  }));
}

const HEAL_AURA_SPARKLE_OFFSETS = [-0.3, -0.1, 0.15, 0.35];

/** One sparkle mote's offset from the anchor, in px — `dx` fixed, `dy`
 *  negative and growing in magnitude as the sparkle rises. */
export interface HealAuraSparkle {
  dx: number;
  dy: number;
}

/**
 * Returns the aura's sparkle motes for the given elapsed time, drifting
 * upward from the anchor by up to roughly `0.6 * width` — a shorter rise
 * than `sparkleParticles`'s radial burst, since this stays compact around
 * the player rather than spreading outward. Empty outside the effect's
 * active window.
 */
export function healAuraSparkles(elapsed: number, width: number): HealAuraSparkle[] {
  if (elapsed < 0 || elapsed > HEAL_AURA_DURATION_SECONDS) return [];
  const progress = elapsed / HEAL_AURA_DURATION_SECONDS;
  const rise = width * 0.6 * progress;
  return HEAL_AURA_SPARKLE_OFFSETS.map((frac) => ({ dx: frac * width, dy: -rise }));
}

/**
 * A brief, deterministic burst of colored debris played the instant a hit
 * lands on the character or an enemy (see S-010-platformer-hurt-feedback).
 * Deliberately NOT randomized (unlike the throwaway visual mockups this was
 * tuned against — see specs/S-010-platformer-hurt-feedback/design.md):
 * every droplet's position is a fixed function of its own index, so the
 * same effect always produces the same burst, same convention as
 * `sparkleParticles`'s angle-per-index placement. `dirBiasX`/`dirBiasY` lean
 * the burst toward the side contact came from (player: left/right; enemy:
 * always upward, since the only thing that damages an enemy is a stomp from
 * above); `spreadX`/`spreadY` control how wide it fans out.
 */
export interface HitSplatterEffect {
  id: string;
  x: number;
  y: number;
  color: string;
  dropletCount: number;
  dirBiasX: number;
  dirBiasY: number;
  spreadX: number;
  spreadY: number;
  elapsed: number;
}

/** Total seconds a hit splatter plays before it's fully faded and removed. */
export const HIT_SPLATTER_DURATION_SECONDS = 0.6;
/** Opaque until this fraction of the duration has elapsed, then fades
 *  linearly to 0 by the end — same shape as FlightEffect's flight-phase
 *  fade, just with different numbers. */
const HIT_SPLATTER_FADE_START_FRACTION = 0.7;
/** Downward pixel-acceleration term (`gravity * progress^2`) pulling every
 *  droplet back down over the burst's lifetime, same curve the original
 *  mockups were tuned against. */
const HIT_SPLATTER_GRAVITY = 60;
/**
 * Stride used to shuffle which droplet index gets which vertical-spread
 * slot (see `hitSplatterDroplets` below). MUST be coprime with every
 * `dropletCount` this effect is ever started with (currently 7 and 13) —
 * a stride sharing a factor with the count collapses every droplet to the
 * same vertical slot instead of spreading them (caught by
 * CollectionEffects.test.ts's "verticalSpreadIsNotDegenerate" tests).
 */
const HIT_SPLATTER_SHUFFLE_STRIDE = 3;

const PLAYER_HIT_SPLATTER_COLOR = '#a30f1f';
const PLAYER_HIT_SPLATTER_DROPLET_COUNT = 7;
/**
 * How far the anchor itself shifts toward the contact side, roughly torso
 * height on the vertical axis. design.md's approved-parameters table was
 * measured against the browser mockup's own sprite scale (the player drawn
 * at 160px tall there), not this game's actual rendered size (64px — see
 * `entities/Player.ts`'s `PLAYER_RENDERED_SIZE`, `PLAYER_FRAME_SIZE * 2`).
 * These four constants are the mockup's numbers scaled down by that same
 * 64/160 ratio (0.4x) — applying the mockup's literal pixel values here
 * made the splatter read as floating well off the character.
 */
const PLAYER_HIT_SPLATTER_ANCHOR_OFFSET_X = 11;
const PLAYER_HIT_SPLATTER_ANCHOR_OFFSET_Y = 2;
const PLAYER_HIT_SPLATTER_DIR_BIAS_X = 6;
const PLAYER_HIT_SPLATTER_SPREAD_X = 17;
const PLAYER_HIT_SPLATTER_SPREAD_Y = 12;

/**
 * Starts a red hit-splatter burst on the character. `contactSide` is -1
 * (hit came from the left), 1 (from the right), or 0 when no side is known
 * (a pit fall — spec.md FR-001's edge case) — the anchor offset and
 * directional bias both scale by this, so 0 anchors dead-center with no
 * lean, and -1/1 mirror each other exactly.
 */
export function startPlayerHitSplatter(
  id: string,
  playerCenterX: number,
  playerCenterY: number,
  contactSide: -1 | 0 | 1,
): HitSplatterEffect {
  return {
    id,
    x: playerCenterX + PLAYER_HIT_SPLATTER_ANCHOR_OFFSET_X * contactSide,
    y: playerCenterY + PLAYER_HIT_SPLATTER_ANCHOR_OFFSET_Y,
    color: PLAYER_HIT_SPLATTER_COLOR,
    dropletCount: PLAYER_HIT_SPLATTER_DROPLET_COUNT,
    dirBiasX: PLAYER_HIT_SPLATTER_DIR_BIAS_X * contactSide,
    dirBiasY: 0,
    spreadX: PLAYER_HIT_SPLATTER_SPREAD_X,
    spreadY: PLAYER_HIT_SPLATTER_SPREAD_Y,
    elapsed: 0,
  };
}

const ENEMY_HIT_SPLATTER_DROPLET_COUNT = 13;
const ENEMY_HIT_SPLATTER_DIR_BIAS_Y = -45;
const ENEMY_HIT_SPLATTER_SPREAD_X = 64;
const ENEMY_HIT_SPLATTER_SPREAD_Y = 44;

/** Each enemy type splatters its own color, not one shared by every enemy
 *  (spec.md FR-004) — matches that type's own body color, same choice
 *  the green slime's goo color was picked with (design.md). Purple's exact
 *  tone was not separately mocked; confirm it visually once this is on
 *  screen and adjust here if it needs its own tuning pass. */
const ENEMY_HIT_SPLATTER_COLOR: Record<EnemyTypeKey, string> = {
  slimeGreen: '#3ddc55',
  slimePurple: '#8e3dd9',
};

/**
 * Starts a goo hit-splatter burst on an enemy, colored to match its type.
 * `topX`/`topY` must already be the top of the enemy's own hitbox (where a
 * stomp actually lands) — this function applies no further offset, unlike
 * the player's version, since the caller (PlatformerPage.tsx) already has
 * that exact point from the same collision geometry that decided the stomp
 * landed.
 */
export function startEnemyHitSplatter(
  id: string,
  topX: number,
  topY: number,
  enemyType: EnemyTypeKey,
): HitSplatterEffect {
  return {
    id,
    x: topX,
    y: topY,
    color: ENEMY_HIT_SPLATTER_COLOR[enemyType],
    dropletCount: ENEMY_HIT_SPLATTER_DROPLET_COUNT,
    dirBiasX: 0,
    dirBiasY: ENEMY_HIT_SPLATTER_DIR_BIAS_Y,
    spreadX: ENEMY_HIT_SPLATTER_SPREAD_X,
    spreadY: ENEMY_HIT_SPLATTER_SPREAD_Y,
    elapsed: 0,
  };
}

/** Advances a hit splatter by `dt` seconds. No phase machine (same
 *  convention as `tickPuffEffect`) — callers filter out expired effects by
 *  comparing `elapsed` against `HIT_SPLATTER_DURATION_SECONDS`. */
export function tickHitSplatterEffect(effect: HitSplatterEffect, dt: number): HitSplatterEffect {
  return { ...effect, elapsed: effect.elapsed + dt };
}

export interface HitSplatterDroplet {
  dx: number;
  dy: number;
  opacity: number;
}

/**
 * Current per-droplet offsets/opacity for a hit splatter. Every droplet's
 * horizontal slot is evenly spaced across `spreadX` (so `dropletCount` and
 * `spreadX` have an exact, reproducible relationship); its vertical slot
 * uses a SHUFFLED index (`(i * HIT_SPLATTER_SHUFFLE_STRIDE) % count`) rather
 * than the same even spacing, so droplets don't just draw a straight
 * diagonal line pairing the same rank on both axes. Both axes are still a
 * pure function of `i` — no randomness anywhere (see this file's own
 * `sparkleParticles` for the same determinism convention).
 */
export function hitSplatterDroplets(effect: HitSplatterEffect): HitSplatterDroplet[] {
  const progress = Math.min(1, effect.elapsed / HIT_SPLATTER_DURATION_SECONDS);
  const count = effect.dropletCount;
  return Array.from({ length: count }, (_, i) => {
    const spreadFracX = count === 1 ? 0 : i / (count - 1) - 0.5;
    const shuffled = (i * HIT_SPLATTER_SHUFFLE_STRIDE) % count;
    const spreadFracY = count === 1 ? 0 : shuffled / (count - 1) - 0.5;
    // The `+ 0` terms normalize IEEE-754 −0 to +0: at progress 0, a negative base times zero yields −0,
    // but fresh effect droplets should read as a clean +0 for tests using strict equality (e.g. Object.is).
    const dx = (effect.dirBiasX + spreadFracX * effect.spreadX) * progress + 0;
    const dy =
      (effect.dirBiasY + spreadFracY * effect.spreadY) * progress +
      HIT_SPLATTER_GRAVITY * progress * progress +
      0;
    const opacity =
      progress < HIT_SPLATTER_FADE_START_FRACTION
        ? 1
        : Math.max(
            0,
            1 - (progress - HIT_SPLATTER_FADE_START_FRACTION) / (1 - HIT_SPLATTER_FADE_START_FRACTION),
          );
    return { dx, dy, opacity };
  });
}
