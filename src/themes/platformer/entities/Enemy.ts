import { RENDER_SCALE, RENDERED_TILE_SIZE } from '../level/Terrain';

/**
 * Both slime_green.png and slime_purple.png are 96x72 sheets: a 4x3 grid of
 * 24x24 frames. Pixel analysis (roadmap step 16) found frame (row 2, col 2)
 * alone recolored red in both sheets, while every frame follows a smooth
 * squash-stretch shape progression (heights 9px through 15px) with no shape
 * break between rows — there's no sheet metadata to confirm intent, so the
 * row 0 idle / row 1 walk / row 2 hit mapping below is a trial reading, not
 * a documented fact. Adjust ENEMY_ANIM_CONFIG's frameCount/frameDuration/sy
 * if it doesn't read well once actually on screen — centralizing it here in
 * one lookup table (same convention as Player.ts's ANIM_CONFIG) makes that
 * a one-line change instead of hunting through the renderer.
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

const ENEMY_ANIM_CONFIG: Record<
  EnemyAnimState,
  { frameCount: number; frameDuration: number; sy: number }
> = {
  idle: { frameCount: 4, frameDuration: 0.2, sy: 0 },
  walk: { frameCount: 4, frameDuration: 0.12, sy: ENEMY_FRAME_SIZE },
  hit: { frameCount: 4, frameDuration: 0.1, sy: ENEMY_FRAME_SIZE * 2 },
};

/** Seconds each idle frame is held before advancing — idle is the only
 *  animation state this step actually plays; walk/hit are wired up by
 *  roadmap steps 17/18. */
export const ENEMY_IDLE_FRAME_DURATION = ENEMY_ANIM_CONFIG.idle.frameDuration;
export const ENEMY_IDLE_FRAME_COUNT = ENEMY_ANIM_CONFIG.idle.frameCount;

/** Sprite-sheet source rect for a given animation state/frame — same
 *  row-lookup convention as Player.ts's playerFrameSource. */
export function enemyFrameSource(animState: EnemyAnimState, frame: number): { sx: number; sy: number } {
  const { frameCount, sy } = ENEMY_ANIM_CONFIG[animState];
  return { sx: (frame % frameCount) * ENEMY_FRAME_SIZE, sy };
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
