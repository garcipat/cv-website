import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../level/Terrain';
import type { EnemyPlacement } from '../level/EnemyMapper';
import type { EnemyDef } from '../types';

/**
 * Both slime_green.png and slime_purple.png are 96x72 sheets: a 4x3 grid of
 * 24x24 frames read left-to-right, top-to-bottom as frames 1-12. Frame 11
 * (row 2, col 2) alone is recolored red in both sheets. Frames 1-3 read as a
 * mostly-featureless blob, frames 9-12 read as the slime dissolving toward a
 * near-black silhouette (a hit/defeat reaction), and frames 4-8 — spanning
 * the end of row 0 into all of row 1 — loop well as a breathing/bounce cycle.
 *
 * Enemy patrol uses constant-slide movement — a patrolling enemy is always
 * in motion, never actually standing still — so there is no reachable `idle`
 * state: `EnemyAnimState` below is `'walk' | 'hit'` only, and the tuned
 * frames 4-8 loop (below, `WALK_FRAMES`) is reused as-is for `walk` instead
 * of a separate idle state — it reads fine as movement too.
 * `ENEMY_ANIM_CONFIG`'s `walk` entry is an explicit frame list rather than a
 * single row since the loop crosses a row boundary. Adjust the frame
 * lists/frameDuration below if a future viewing suggests a better sequence —
 * centralizing it here in one lookup table (same convention as Player.ts's
 * ANIM_CONFIG) makes that a one-line change instead of hunting through the
 * renderer.
 */
export const ENEMY_FRAME_SIZE = 24;
export const ENEMY_RENDERED_SIZE = ENEMY_FRAME_SIZE * RENDER_SCALE;

/**
 * Every frame's opaque silhouette bottom sits at row 23 of the 24px native
 * frame (measured via pixel bounding-box analysis) — i.e. the sprite's feet
 * already touch the frame's bottom edge with no transparent padding, unlike
 * Player.ts's PLAYER_FOOT_PADDING. So the rendered sprite is bottom-anchored
 * to its placement tile's ground surface with no extra padding constant
 * needed.
 */
export const ENEMY_TILE_OFFSET_Y = RENDERED_TILE_SIZE - ENEMY_RENDERED_SIZE;

/** The rendered sprite (48px) is wider than one tile (32px) — center it
 *  horizontally over its placement tile. */
export const ENEMY_TILE_OFFSET_X = (RENDERED_TILE_SIZE - ENEMY_RENDERED_SIZE) / 2;

/**
 * Per-`spriteType` render-scale multiplier, patrol-speed multiplier, and hit
 * points — a purple slime is 1.5x a green slime's size, patrols at 70% of
 * its speed, and takes 3 stomps to defeat (green takes 1). Centralized here
 * as lookups (same convention as ENEMY_ANIM_CONFIG above) rather than
 * scattering per-type ternaries through Collision.ts/Renderer.ts/EnemyAI.ts.
 */
export const ENEMY_RENDER_SCALE: Record<EnemyDef['spriteType'], number> = {
  slimeGreen: 1,
  slimePurple: 1.5,
};

export const ENEMY_PATROL_SPEED_MULTIPLIER: Record<EnemyDef['spriteType'], number> = {
  slimeGreen: 1,
  slimePurple: 0.7,
};

export const ENEMY_HIT_POINTS: Record<EnemyDef['spriteType'], number> = {
  slimeGreen: 1,
  slimePurple: 3,
};

/** Actual rendered size for a given spriteType — ENEMY_RENDERED_SIZE scaled
 *  by ENEMY_RENDER_SCALE. Collision.ts's enemyHitbox and Renderer.ts's
 *  drawEnemies both call this instead of the flat ENEMY_RENDERED_SIZE
 *  constant so a bigger purple slime gets a proportionally bigger hitbox and
 *  draw rect. */
export function enemyRenderedSize(spriteType: EnemyDef['spriteType']): number {
  return ENEMY_FRAME_SIZE * RENDER_SCALE * ENEMY_RENDER_SCALE[spriteType];
}

/** Per-spriteType horizontal centering offset — same formula
 *  ENEMY_TILE_OFFSET_X uses, but against enemyRenderedSize(spriteType)
 *  instead of the flat green-sized constant, so a bigger purple slime still
 *  centers correctly over its placement tile. */
export function enemyTileOffsetX(spriteType: EnemyDef['spriteType']): number {
  return (RENDERED_TILE_SIZE - enemyRenderedSize(spriteType)) / 2;
}

/** Per-spriteType bottom-anchoring offset — same formula
 *  ENEMY_TILE_OFFSET_Y uses, against enemyRenderedSize(spriteType). */
export function enemyTileOffsetY(spriteType: EnemyDef['spriteType']): number {
  return RENDERED_TILE_SIZE - enemyRenderedSize(spriteType);
}

/**
 * Transparent margin inside each 24px native frame, measured via pixel
 * bounding-box analysis across the shared walk-cycle frames of both
 * slime_green.png and slime_purple.png (identical silhouette geometry,
 * only the palette differs): the opaque silhouette spans x 5-18 (5px
 * margin each side) and y 9-23 (9px margin above, 0px below — the feet
 * already touch the frame's bottom edge, per ENEMY_TILE_OFFSET_Y's doc
 * comment above). Used to inset the collision hitbox away from the
 * sprite's transparent corners — a slime's silhouette is rounded, not a
 * filled square, so a hitbox spanning the full render slot would register
 * a hit against visibly empty space, worse the bigger ENEMY_RENDER_SCALE
 * gets. Same convention as Player.ts's PLAYER_SIDE_PADDING/
 * PLAYER_HEAD_PADDING/PLAYER_FOOT_PADDING.
 */
const ENEMY_HITBOX_SIDE_PADDING_NATIVE = 5;
const ENEMY_HITBOX_TOP_PADDING_NATIVE = 9;

/** Per-spriteType collision-hitbox side inset — scaled the same way
 *  enemyRenderedSize scales the frame itself, so the inset grows
 *  proportionally with a bigger slime instead of staying a fixed pixel
 *  amount. */
export function enemyHitboxSidePadding(spriteType: EnemyDef['spriteType']): number {
  return ENEMY_HITBOX_SIDE_PADDING_NATIVE * RENDER_SCALE * ENEMY_RENDER_SCALE[spriteType];
}

/** Per-spriteType collision-hitbox top inset — see enemyHitboxSidePadding.
 *  No corresponding bottom-inset function: the silhouette's feet already
 *  touch the native frame's bottom edge, so the hitbox's bottom edge stays
 *  at the render slot's bottom. */
export function enemyHitboxTopPadding(spriteType: EnemyDef['spriteType']): number {
  return ENEMY_HITBOX_TOP_PADDING_NATIVE * RENDER_SCALE * ENEMY_RENDER_SCALE[spriteType];
}

export type EnemyAnimState = 'walk' | 'hit';

export type EnemyDirection = 'left' | 'right';

type FrameCoord = { sx: number; sy: number };

/** Frame 4 (row 0, col 3) through frame 8 (row 1, col 3) — see the file
 *  doc comment above for why this crosses the row boundary. */
const WALK_FRAMES: FrameCoord[] = [
  { sx: 3 * ENEMY_FRAME_SIZE, sy: 0 },
  { sx: 0 * ENEMY_FRAME_SIZE, sy: ENEMY_FRAME_SIZE },
  { sx: 1 * ENEMY_FRAME_SIZE, sy: ENEMY_FRAME_SIZE },
  { sx: 2 * ENEMY_FRAME_SIZE, sy: ENEMY_FRAME_SIZE },
  { sx: 3 * ENEMY_FRAME_SIZE, sy: ENEMY_FRAME_SIZE },
];

const ENEMY_ANIM_CONFIG: Record<EnemyAnimState, { frames: FrameCoord[]; frameDuration: number }> = {
  walk: { frames: WALK_FRAMES, frameDuration: 0.15 },
  hit: {
    frames: Array.from({ length: 4 }, (_, i) => ({ sx: i * ENEMY_FRAME_SIZE, sy: ENEMY_FRAME_SIZE * 2 })),
    frameDuration: 0.1,
  },
};

/** Sprite-sheet source rect for a given animation state/frame — looks up
 *  an explicit frame-coordinate list per state (see WALK_FRAMES above)
 *  rather than assuming every state's frames sit on one sheet row. */
export function enemyFrameSource(animState: EnemyAnimState, frame: number): { sx: number; sy: number } {
  const { frames } = ENEMY_ANIM_CONFIG[animState];
  return frames[frame % frames.length];
}

export interface EnemyState extends EnemyPlacement {
  /** Horizontal velocity in px/s. Positive is rightward. Enemies never move
   *  vertically — patrol is a simple back-and-forth walk along the row an
   *  enemy is placed on (FR-019's "simple patrol-only" scope; no gravity). */
  vx: number;
  /** Direction the sprite is drawn facing and currently moving — always in
   *  sync with `vx`'s sign once patrol has run at least one frame. */
  direction: EnemyDirection;
  animState: EnemyAnimState;
  animFrame: number;
  /** Seconds accumulated toward the next animation frame advance. */
  animTimer: number;
  /** Stomps remaining before this enemy is defeated — 1 for slimeGreen, 3 for
   *  slimePurple (see ENEMY_HIT_POINTS above). Decremented by
   *  `applyStomp` on every registered stomp, regardless of whether it's the
   *  finishing blow. */
  hitPoints: number;
  /** Seconds elapsed since entering the `'hit'` animState — drives
   *  EnemyAI.ts's `stepEnemyHitReaction`, which reverts to `'walk'` (if
   *  `hitPoints` remains) or sets `defeated: true` (if not) once this reaches
   *  `HIT_REACTION_DURATION_SECONDS`. Meaningless while `animState` is `'walk'`. */
  hitTimer: number;
  /** True while this enemy's top is spiked and un-stompable — set by
   *  `applyStomp` whenever a stomp doesn't finish the enemy off, cleared by
   *  `EnemyAI.ts`'s `stepEnemySpikeCooldown` once `spikeTimer` reaches
   *  `SPIKE_COOLDOWN_DURATION_SECONDS`. While `true`, `Collision.ts`'s
   *  `checkEnemyStompCollisions` excludes this enemy from stomp
   *  registration, and `checkEnemySideCollisions` treats a top-landing on it
   *  as player damage instead of a stomp. Independent of `animState`/
   *  `hitTimer` — the hit-reaction animation (0.4s) and the spike cooldown
   *  (longer, see EnemyAI.ts) run as two separate timers driven by the same
   *  per-tick `dt`. */
  spiked: boolean;
  /** Seconds elapsed since `spiked` was last set `true` — meaningless while
   *  `spiked` is `false`. Same convention as `hitTimer` above. */
  spikeTimer: number;
  /** True once `hitPoints` has reached 0 and the hit-reaction animation has
   *  finished playing — the game loop removes a `defeated` enemy from
   *  `enemyStates` and fires its reward the same tick this flips true. */
  defeated: boolean;
}

/**
 * The enemy factory: converts a placed-but-static `EnemyPlacement` (which
 * may carry the CV fact this enemy drops on defeat — see `EnemyMapper.ts`'s
 * `courseToEnemy`; a "plain" enemy beyond its color's CVData course count has
 * no fact and drops nothing — unaffected by this function) into its initial
 * live patrol state: `'walk'` (patrol enemies are always moving — see this
 * file's top doc comment for why there's no `'idle'`), facing right (the
 * direction its very first patrol tick — see
 * EnemyAI.ts's stepEnemyPatrol — will move it, unless a wall or ledge
 * immediately reverses it).
 *
 * `index` (the enemy's position among all placed enemies — see
 * PlatformerState.ts's call site) offsets the starting walk frame/timer so
 * multiple enemies don't all animate in perfect lockstep: without this, every
 * enemy starts at frame 0 with a zeroed timer and — since each enemy's frame
 * advance is driven by its own `dt`-accumulated timer, not a shared clock —
 * would stay frame-for-frame identical forever. Defaults to 0 (frame 0, timer
 * 0) so a single ad-hoc enemy (e.g. in a test) still gets deterministic
 * behavior.
 */
export function toEnemyState(placement: EnemyPlacement, index = 0): EnemyState {
  const { frames, frameDuration } = ENEMY_ANIM_CONFIG.walk;
  return {
    ...placement,
    vx: 0,
    direction: 'right',
    animState: 'walk',
    animFrame: index % frames.length,
    animTimer: (index * 0.05) % frameDuration,
    hitPoints: ENEMY_HIT_POINTS[placement.spriteType],
    hitTimer: 0,
    spiked: false,
    spikeTimer: 0,
    defeated: false,
  };
}

/** Advances the enemy's animation timer/frame by `dt` seconds — same
 *  convention as Player.ts's advancePlayerAnimation. */
export function advanceEnemyAnimation(enemy: EnemyState, dt: number): EnemyState {
  const { frames, frameDuration } = ENEMY_ANIM_CONFIG[enemy.animState];
  const animTimer = enemy.animTimer + dt;
  if (animTimer < frameDuration) {
    return { ...enemy, animTimer };
  }
  return {
    ...enemy,
    animTimer: animTimer - frameDuration,
    animFrame: (enemy.animFrame + 1) % frames.length,
  };
}

/**
 * Applies one stomp: decrements `hitPoints`, freezes horizontal movement,
 * enters the `hit` reaction (red-flash/dissolve) animation from its first
 * frame, and — if the enemy survives (`hitPoints` still > 0 after the
 * decrement) — grows spikes (`spiked: true`, `spikeTimer` reset to 0) that
 * make its top un-stompable for a cooldown (see `EnemyAI.ts`'s
 * `stepEnemySpikeCooldown` and `Collision.ts`'s `checkEnemyStompCollisions`/
 * `checkEnemySideCollisions`). This function itself doesn't gate re-entry —
 * calling it twice in a row always applies a second stomp — the `spiked`
 * exclusion lives entirely in `Collision.ts`, which decides whether a given
 * frame's landing counts as a legal stomp before this function is ever
 * called. A fresh stomp always restarts the cooldown timer, even if the
 * enemy was already `spiked` from an earlier stomp. Does NOT decide defeat
 * here — EnemyAI.ts's `stepEnemyHitReaction` checks `hitPoints` once the
 * reaction animation finishes playing, so the player always sees the same
 * brief "stunned" reaction whether or not this stomp was the finishing blow.
 */
export function applyStomp(enemy: EnemyState): EnemyState {
  const hitPoints = enemy.hitPoints - 1;
  return {
    ...enemy,
    hitPoints,
    vx: 0,
    animState: 'hit',
    animFrame: 0,
    animTimer: 0,
    hitTimer: 0,
    spiked: hitPoints > 0,
    spikeTimer: 0,
  };
}
