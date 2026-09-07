import { RENDERED_TILE_SIZE } from '../level/Terrain';

/** Play mode renders at a fixed, capped canvas WIDTH — a deliberately
 *  bounded number of tile columns, not the full browser window — so a wide
 *  monitor doesn't spoil the level far ahead of the player. Uncapped, a
 *  1920px window showed 60 columns and a 2560px one 80, against the ~16
 *  columns a classic platformer framed; the player could see every enemy
 *  and gap long before reaching them, which drains the level of any
 *  surprise. Capped, the canvas simply stops growing and the page's flex
 *  centering letterboxes it against the black background. */
export const PLAY_CANVAS_COLS = 40;

/** Play mode renders at a fixed, short canvas HEIGHT — a deliberately
 *  small number of tile rows — so the player sits low in frame with most
 *  of the canvas showing the background layers above them (paired with
 *  Camera.ts's PLAYER_TARGET_ROWS_FROM_BOTTOM). */
export const PLAY_CANVAS_ROWS = 24;

/**
 * The play canvas's pixel dimensions for a given window size: the intended
 * 1280x768 (5:3) frame, each axis clamped down to the window so it never
 * overflows a viewport smaller than the cap. Below either cap the frame's
 * aspect ratio drifts — fitting the window matters more than holding the
 * format on a screen that can't show it.
 *
 * The level editor is unaffected; it sizes its own canvas separately, not
 * from the window at all.
 */
export function playCanvasSize(
  windowWidth: number,
  windowHeight: number,
): { width: number; height: number } {
  return {
    width: Math.min(PLAY_CANVAS_COLS * RENDERED_TILE_SIZE, windowWidth),
    height: Math.min(PLAY_CANVAS_ROWS * RENDERED_TILE_SIZE, windowHeight),
  };
}
