import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../level/Terrain';

/**
 * Both slime_green.png and slime_purple.png are 96x72 sheets: a 4x3 grid of
 * 24x24 frames read left-to-right, top-to-bottom as frames 1-12. Frame 11
 * (row 2, col 2) alone is recolored red in both sheets. Watching the full
 * sheet animate live (roadmap step 16) showed frames 1-3 read as a
 * mostly-featureless blob, frames 9-12 read as the slime dissolving toward
 * a near-black silhouette (a hit/defeat reaction, not idle), and frames 4-8
 * — spanning the end of row 0 into all of row 1 — loop well as an idle
 * breathing/bounce cycle. That's why ENEMY_ANIM_CONFIG's `idle` entry below
 * is an explicit frame list rather than a single row: the loop crosses a
 * row boundary. Adjust the frame lists/frameDuration below if a future
 * viewing suggests a better sequence — centralizing it here in one lookup
 * table (same convention as Player.ts's ANIM_CONFIG) makes that a one-line
 * change instead of hunting through the renderer.
 */
export const ENEMY_FRAME_SIZE = 24;
export const ENEMY_RENDERED_SIZE = ENEMY_FRAME_SIZE * RENDER_SCALE;

/**
 * Every frame's opaque silhouette bottom sits at row 23 of the 24px native
 * frame (measured via pixel bounding-box analysis, roadmap step 16) — i.e.
 * the sprite's feet already touch the frame's bottom edge with no
 * transparent padding, unlike Player.ts's PLAYER_FOOT_PADDING. So the
 * rendered sprite is bottom-anchored to its placement tile's ground surface
 * with no extra padding constant needed.
 */
export const ENEMY_TILE_OFFSET_Y = RENDERED_TILE_SIZE - ENEMY_RENDERED_SIZE;

/** The rendered sprite (48px) is wider than one tile (32px) — center it
 *  horizontally over its placement tile. */
export const ENEMY_TILE_OFFSET_X = (RENDERED_TILE_SIZE - ENEMY_RENDERED_SIZE) / 2;

export type EnemyAnimState = 'idle' | 'walk' | 'hit';

type FrameCoord = { sx: number; sy: number };

/** Frame 4 (row 0, col 3) through frame 8 (row 1, col 3) — see the file
 *  doc comment above for why this crosses the row boundary. */
const IDLE_FRAMES: FrameCoord[] = [
  { sx: 3 * ENEMY_FRAME_SIZE, sy: 0 },
  { sx: 0 * ENEMY_FRAME_SIZE, sy: ENEMY_FRAME_SIZE },
  { sx: 1 * ENEMY_FRAME_SIZE, sy: ENEMY_FRAME_SIZE },
  { sx: 2 * ENEMY_FRAME_SIZE, sy: ENEMY_FRAME_SIZE },
  { sx: 3 * ENEMY_FRAME_SIZE, sy: ENEMY_FRAME_SIZE },
];

// NOTE (landmine for step 17): after the idle tuning above, `walk`'s frames
// (row 1, sheet frames 5-8) are now a subset of tuned `idle`'s frames
// (sheet frames 4-8, which includes 5-8 plus one lead-in frame) — the two
// states are near-identical today. `walk` is unreachable/unused as of this
// step (only `idle` is ever played — see `drawEnemies` in Renderer.ts), so
// this isn't a step-16 bug, but step 17's verify criterion ("an enemy
// patrolling should visibly animate a distinct walk cycle") will silently
// fail unless `walk` is given a genuinely distinct frame range (if the
// sheet has one) or redesigned first, via the same kind of live visual
// inspection idle got.
const ENEMY_ANIM_CONFIG: Record<EnemyAnimState, { frames: FrameCoord[]; frameDuration: number }> = {
  idle: { frames: IDLE_FRAMES, frameDuration: 0.15 },
  walk: {
    frames: Array.from({ length: 4 }, (_, i) => ({ sx: i * ENEMY_FRAME_SIZE, sy: ENEMY_FRAME_SIZE })),
    frameDuration: 0.12,
  },
  hit: {
    frames: Array.from({ length: 4 }, (_, i) => ({ sx: i * ENEMY_FRAME_SIZE, sy: ENEMY_FRAME_SIZE * 2 })),
    frameDuration: 0.1,
  },
};

/** Seconds each idle frame is held before advancing — idle is the only
 *  animation state this step actually plays; walk/hit are wired up by
 *  roadmap steps 17/18. */
export const ENEMY_IDLE_FRAME_DURATION = ENEMY_ANIM_CONFIG.idle.frameDuration;
export const ENEMY_IDLE_FRAME_COUNT = ENEMY_ANIM_CONFIG.idle.frames.length;

/** Sprite-sheet source rect for a given animation state/frame — looks up
 *  an explicit frame-coordinate list per state (see IDLE_FRAMES above)
 *  rather than assuming every state's frames sit on one sheet row. */
export function enemyFrameSource(animState: EnemyAnimState, frame: number): { sx: number; sy: number } {
  const { frames } = ENEMY_ANIM_CONFIG[animState];
  return frames[frame % frames.length];
}

/**
 * Idle-loop frame index for a given elapsed time — shared by every enemy
 * (all enemies idle in sync), matching Coin.ts's coinFrameIndex convention.
 * Movement (step 17) will need per-enemy animation state once enemies can
 * differ from each other (mid-patrol vs. turning); this step has no
 * movement yet, so a single shared clock is enough.
 */
export function enemyIdleFrameIndex(elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  const frame = Math.floor(elapsedSeconds / ENEMY_IDLE_FRAME_DURATION);
  return frame % ENEMY_IDLE_FRAME_COUNT;
}
