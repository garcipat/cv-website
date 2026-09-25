/**
 * Shared outlined-text drawing for the platformer's canvas HUD and transient
 * text effects, extracted from `Renderer.ts` (R-004 D7) so an effect module can
 * draw outlined text without importing the god renderer and without a cycle.
 * `Renderer.ts` imports the same helpers.
 */

/**
 * Family name registered with `document.fonts` by engine/FontLoader.ts's
 * `loadFont` call (see PlatformerPage.tsx's mount effect) for
 * `RESTART_PROMPT_FONT_URL`. Kept alongside the outlined-text helper so the
 * loaded family name and the drawn family name can't drift apart.
 */
export const RESTART_PROMPT_FONT_FAMILY = 'ByteBounce';

/** Outline color used behind every outlined text run — matches
 *  ControlsOverlay.tsx's DOM `textShadow` treatment (four 1px diagonal offsets
 *  in the same semi-transparent black), reproduced here via four offset
 *  fillText calls since canvas has no CSS text-shadow equivalent. Without it,
 *  plain white text is easy to lose against lighter terrain/sky backgrounds. */
const COUNTER_TEXT_OUTLINE_COLOR = 'rgba(0,0,0,0.8)';

/** Draws `text` with a 1px outline in every diagonal direction before the
 *  final fill, so the caller's already-set fillStyle/font/textAlign/
 *  textBaseline are used for both the outline and the fill — callers must set
 *  those on `ctx` before calling this, exactly as they would before a plain
 *  `ctx.fillText`. */
export function fillTextWithOutline(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
): void {
  const fillStyle = ctx.fillStyle;
  ctx.fillStyle = COUNTER_TEXT_OUTLINE_COLOR;
  ctx.fillText(text, x - 1, y - 1);
  ctx.fillText(text, x + 1, y - 1);
  ctx.fillText(text, x - 1, y + 1);
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = fillStyle;
  ctx.fillText(text, x, y);
}
