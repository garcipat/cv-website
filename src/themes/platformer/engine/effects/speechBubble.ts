/**
 * The one reusable player-overhead speech bubble (R-005): a registered
 * transient effect kind driven identically by the sign-hint trigger, the
 * locked-chest message and the transient no-bombs message. It carries its own
 * resolved localized text in `state.text` — resolved by the page at spawn from
 * the derived `state/hintText.ts` signal and refreshed by the page when the
 * language changes — so the registered draw reads only the effect's own state
 * and the effect subsystem never imports app/i18n state (FR-005/FR-020).
 */
import type { BubbleMessageId } from '../../level/HintCatalog';
import { RESTART_PROMPT_FONT_FAMILY } from '../textDraw';
import type { EffectRenderContext, TransientEffect } from './transientEffect';

export type SpeechBubblePhase = 'entering' | 'shown' | 'exiting';

export interface SpeechBubbleState {
  messageId: BubbleMessageId;
  /** The resolved localized message, stored at spawn from the page's
   *  `hintText` signal and refreshed by the page on a language change. The
   *  registered draw reads this field — never state or i18n. */
  text: string;
  phase: SpeechBubblePhase;
  /**
   * When true, the bubble auto-begins its exit after
   * `SPEECH_BUBBLE_TRANSIENT_DWELL_SECONDS` instead of waiting for
   * `beginSpeechBubbleExit`. Used by a keypress-triggered bubble (the
   * empty-inventory "no bombs" bubble), which has no sign overlap to leave
   * and so must dismiss itself. A sign's own bubble omits this.
   */
  transient?: boolean;
}

/**
 * Kept short and roughly equal (unlike ControlsOverlay.tsx's much longer
 * 400ms/600ms — that overlay is a one-time, whole-session event; a sign's
 * bubble can be re-revealed every time the player walks back onto it and
 * presses Up again, so a snappier transition reads better for a
 * frequently-repeated interaction).
 */
export const SPEECH_BUBBLE_FADE_IN_SECONDS = 0.2;
export const SPEECH_BUBBLE_FADE_OUT_SECONDS = 0.25;

/** How long a transient (keypress-triggered) bubble stays fully shown before
 *  it begins its own exit — long enough to read a short sentence. */
export const SPEECH_BUBBLE_TRANSIENT_DWELL_SECONDS = 1.5;

/** The bubble never expires on `elapsed` (the phase machine's `null` sentinel
 *  ends it); this bound only satisfies the base shape. */
export const SPEECH_BUBBLE_DURATION_SECONDS =
  SPEECH_BUBBLE_FADE_IN_SECONDS + SPEECH_BUBBLE_FADE_OUT_SECONDS;

/** Starts a fresh bubble in its 'entering' phase — called once the player
 *  presses Up/`W` while overlapping a sign, or presses the place-bomb input
 *  with no bombs. Pass `{ transient: true }` for the latter, so the bubble
 *  dismisses itself (see `tickSpeechBubbleEffect`). The page passes the already
 *  resolved localized `text`. */
export function startSpeechBubble(
  messageId: BubbleMessageId,
  text: string,
  options?: { transient?: boolean },
): TransientEffect<SpeechBubbleState> {
  return {
    kind: 'speechBubble',
    id: 'speechBubble',
    duration: SPEECH_BUBBLE_DURATION_SECONDS,
    elapsed: 0,
    state: { messageId, text, phase: 'entering', transient: options?.transient },
    tick: tickSpeechBubbleEffect,
    draw: drawSpeechBubbleEffect,
    expired: () => false,
  };
}

/**
 * Returns the effect unchanged when its stored text already matches `text`,
 * otherwise a copy carrying the new text. Backs the page's language-change
 * refresh, so the steady state performs no collection write (FR-005).
 */
export function withSpeechBubbleText(
  effect: TransientEffect<SpeechBubbleState>,
  text: string,
): TransientEffect<SpeechBubbleState> {
  if (effect.state.text === text) return effect;
  return { ...effect, state: { ...effect.state, text } };
}

/** Switches an already-active bubble into its 'exiting' phase, resetting
 *  elapsed. Called as soon as the player leaves the sign's overlap zone,
 *  regardless of whether Up was ever pressed while they were on it. */
export function beginSpeechBubbleExit(
  effect: TransientEffect<SpeechBubbleState>,
): TransientEffect<SpeechBubbleState> {
  return { ...effect, elapsed: 0, state: { ...effect.state, phase: 'exiting' } };
}

/** Restarts an already-active bubble into its 'entering' phase, resetting
 *  elapsed — the restart-on-exit rule when interact is pressed again mid-exit. */
export function beginSpeechBubbleEnter(
  effect: TransientEffect<SpeechBubbleState>,
): TransientEffect<SpeechBubbleState> {
  return { ...effect, elapsed: 0, state: { ...effect.state, phase: 'entering' } };
}

/**
 * Advances the animation by `dt` seconds. 'entering' becomes 'shown' (elapsed
 * reset to 0) once `SPEECH_BUBBLE_FADE_IN_SECONDS` elapses; 'shown' just
 * accumulates elapsed with no transition (the caller decides when to call
 * `beginSpeechBubbleExit`), except a transient bubble, which begins its own
 * exit after the dwell; 'exiting' returns `null` once
 * `SPEECH_BUBBLE_FADE_OUT_SECONDS` elapses — the collection drops it at that
 * point, the same sentinel convention `flyingText`/`counterPopup` use.
 */
export function tickSpeechBubbleEffect(
  effect: TransientEffect<SpeechBubbleState>,
  dt: number,
): TransientEffect<SpeechBubbleState> | null {
  const elapsed = effect.elapsed + dt;
  if (effect.state.phase === 'entering') {
    if (elapsed >= SPEECH_BUBBLE_FADE_IN_SECONDS) {
      return { ...effect, elapsed: 0, state: { ...effect.state, phase: 'shown' } };
    }
    return { ...effect, elapsed };
  }
  if (effect.state.phase === 'exiting') {
    if (elapsed >= SPEECH_BUBBLE_FADE_OUT_SECONDS) return null;
    return { ...effect, elapsed };
  }
  if (effect.state.transient && elapsed >= SPEECH_BUBBLE_TRANSIENT_DWELL_SECONDS) {
    // A transient bubble has no sign overlap to leave, so it begins its own
    // exit after the fixed dwell.
    return beginSpeechBubbleExit(effect);
  }
  return { ...effect, elapsed };
}

/**
 * Current vertical growth (0-1) and opacity (0-1) for the given effect — the
 * draw scales the bubble's HEIGHT by `growth` while keeping its bottom edge
 * (where the tail meets it) fixed, so the whole thing visibly rises out of
 * that fixed point rather than just scaling in place. 'entering' interpolates
 * growth/opacity 0 -> 1 as `SPEECH_BUBBLE_FADE_IN_SECONDS` elapses; 'shown' is
 * always fully grown/opaque; 'exiting' interpolates the exact reverse, 1 -> 0,
 * over `SPEECH_BUBBLE_FADE_OUT_SECONDS`. Both progress ratios are clamped to
 * [0, 1] so a stale `elapsed` past either duration still returns a sane
 * (fully collapsed, not negative) result.
 */
export function speechBubbleGrowthAndOpacity(
  effect: TransientEffect<SpeechBubbleState>,
): { growth: number; opacity: number } {
  if (effect.state.phase === 'entering') {
    const progress = Math.min(1, effect.elapsed / SPEECH_BUBBLE_FADE_IN_SECONDS);
    return { growth: progress, opacity: progress };
  }
  if (effect.state.phase === 'exiting') {
    const progress = Math.min(1, effect.elapsed / SPEECH_BUBBLE_FADE_OUT_SECONDS);
    return { growth: 1 - progress, opacity: 1 - progress };
  }
  return { growth: 1, opacity: 1 };
}

/** The single live bubble (kind-filtered) or `undefined`, for the trigger
 *  site's phase/message comparison (FR-003). */
export function activeSpeechBubble(
  effects: readonly TransientEffect<unknown>[],
): TransientEffect<SpeechBubbleState> | undefined {
  return effects.find(
    (effect): effect is TransientEffect<SpeechBubbleState> => effect.kind === 'speechBubble',
  );
}

const BUBBLE_FONT_SIZE = 16;
const BUBBLE_PADDING_X = 10;
const BUBBLE_PADDING_Y = 6;
const BUBBLE_BORDER_WIDTH = 2;
/** Extra vertical gap between wrapped lines, on top of BUBBLE_FONT_SIZE
 *  (the `lines.length - 1` term below). */
const BUBBLE_LINE_SPACING = 4;
/** Corner radius for the bubble's rounded rect (both the border and the
 *  inset fill), drawn via `ctx.roundRect` — a smooth curve, not a pixel-art
 *  chamfer (a chamfer's cut-corner notches read as just cutting away the
 *  corners, not as a rounded shape). A curved corner is always
 *  anti-aliased regardless of `imageSmoothingEnabled` (that flag only
 *  affects `drawImage` scaling), so it reads slightly softer than this
 *  game's pixel-art tileset — an accepted, deliberate tradeoff here. */
const BUBBLE_CORNER_RADIUS = 6;
/** Nudges the text down from dead-center by a couple px — a purely visual
 *  correction: centered text reads as sitting slightly high against the
 *  box, likely due to font metrics' cap-height vs. middle-baseline not
 *  perfectly bisecting the box. */
const BUBBLE_TEXT_VERTICAL_NUDGE = 2;
/** Vertical gap between the bubble tail's tip and its anchor point
 *  (anchorBottomY), so it floats just above the character's head rather
 *  than overlapping it. Kept small — this is the gap ABOVE the anchor, which
 *  itself is already the head's own position, not extra breathing room on top
 *  of that. */
const BUBBLE_GAP_ABOVE_ANCHOR = 16;
const BUBBLE_TAIL_HALF_WIDTH = 6;
const BUBBLE_TAIL_HEIGHT = 8;
const BUBBLE_BG_COLOR = '#f4ecd8';
const BUBBLE_BORDER_COLOR = '#241a0e';
const BUBBLE_TEXT_COLOR = '#241a0e';

/** Clamps a corner radius so `roundRect` never receives a radius bigger than
 *  half the shape's own width/height — exceeding that throws a RangeError in
 *  real browsers. The bubble's box/tail height shrinks toward 0 during the
 *  grow/shrink animation, so this matters at low `growth`, not just as a
 *  theoretical edge case. */
function clampedCornerRadius(width: number, height: number, radius: number): number {
  return Math.max(0, Math.min(radius, width / 2, height / 2));
}

/**
 * Draws a comic-style speech bubble with `text` — a cream box, a dark
 * border, and a small tail pointing down at (`anchorX`, `anchorBottomY`),
 * already origin-shifted screen-space coordinates (same convention as
 * drawPlayer's own position). Uses a bigger dark rect/triangle behind a
 * smaller inset cream one for both the box and the tail, instead of
 * `ctx.strokeRect`/`ctx.stroke` — reads as a BUBBLE_BORDER_WIDTH-thick
 * outline with only fill-based primitives.
 *
 * `growth` (default 1) scales the box's and tail's HEIGHT from 0 to their
 * full size — reading as the bubble rising out of the sign like it's
 * starting to talk — while keeping the box's BOTTOM edge
 * fixed (where the tail meets it) — the caller passes
 * `speechBubbleGrowthAndOpacity`'s `growth` straight through. `growth <= 0`
 * draws nothing at all. `opacity` (default 1) is applied via
 * `ctx.globalAlpha`.
 */
export function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchorX: number,
  anchorBottomY: number,
  growth = 1,
  opacity = 1,
): void {
  if (growth <= 0) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.font = `${BUBBLE_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Lines are `\n`-separated (a hint can be authored as a multi-line i18n
  // string) — box width fits the WIDEST line, box height grows with every
  // extra line. A single-line text (the common case) reduces to exactly the
  // old single-line formula: `lines.length - 1` is 0, so no extra spacing.
  const lines = text.split('\n');
  const boxWidth = Math.max(...lines.map((line) => ctx.measureText(line).width)) + BUBBLE_PADDING_X * 2;
  const fullBoxHeight =
    lines.length * BUBBLE_FONT_SIZE + BUBBLE_PADDING_Y * 2 + (lines.length - 1) * BUBBLE_LINE_SPACING;
  const boxHeight = fullBoxHeight * growth;
  const tailHeight = BUBBLE_TAIL_HEIGHT * growth;
  // Tail WIDTH is not scaled by growth — per the plan's explicit constraint,
  // the bubble reveals at its full width immediately and only its height
  // (box height + tail height) animates. Using the constant here (rather
  // than `BUBBLE_TAIL_HALF_WIDTH * growth`) keeps the tail from narrowing
  // to a sliver mid-grow.
  const tailHalfWidth = BUBBLE_TAIL_HALF_WIDTH;

  // Anchored at the box's fixed BOTTOM edge (independent of growth) — the
  // box grows UPWARD from there, and the tail grows DOWNWARD from there
  // toward anchorBottomY, so the whole bubble reads as rising out of that
  // fixed point rather than scaling in place. (Computing boxBottom from a
  // growth-scaled tailHeight instead would make the box's own bottom edge
  // drift as growth changes — the opposite of what "fixed bottom edge"
  // means; boxBottom must depend only on the CONSTANT BUBBLE_TAIL_HEIGHT.)
  const boxBottom = anchorBottomY - BUBBLE_GAP_ABOVE_ANCHOR - BUBBLE_TAIL_HEIGHT;
  const boxTop = boxBottom - boxHeight;
  const tailTipY = boxBottom + tailHeight;
  const boxLeft = anchorX - boxWidth / 2;

  const outerWidth = boxWidth + BUBBLE_BORDER_WIDTH * 2;
  const outerHeight = boxHeight + BUBBLE_BORDER_WIDTH * 2;

  ctx.fillStyle = BUBBLE_BORDER_COLOR;
  ctx.beginPath();
  ctx.roundRect(
    boxLeft - BUBBLE_BORDER_WIDTH,
    boxTop - BUBBLE_BORDER_WIDTH,
    outerWidth,
    outerHeight,
    clampedCornerRadius(outerWidth, outerHeight, BUBBLE_CORNER_RADIUS + BUBBLE_BORDER_WIDTH),
  );
  ctx.fill();
  ctx.fillStyle = BUBBLE_BG_COLOR;
  ctx.beginPath();
  ctx.roundRect(boxLeft, boxTop, boxWidth, boxHeight, clampedCornerRadius(boxWidth, boxHeight, BUBBLE_CORNER_RADIUS));
  ctx.fill();

  ctx.fillStyle = BUBBLE_BORDER_COLOR;
  ctx.beginPath();
  ctx.moveTo(anchorX - tailHalfWidth - BUBBLE_BORDER_WIDTH, boxBottom);
  ctx.lineTo(anchorX, tailTipY + BUBBLE_BORDER_WIDTH);
  ctx.lineTo(anchorX + tailHalfWidth + BUBBLE_BORDER_WIDTH, boxBottom);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = BUBBLE_BG_COLOR;
  ctx.beginPath();
  ctx.moveTo(anchorX - tailHalfWidth, boxBottom);
  ctx.lineTo(anchorX, tailTipY);
  ctx.lineTo(anchorX + tailHalfWidth, boxBottom);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = BUBBLE_TEXT_COLOR;
  // Lines are stacked evenly around the box's vertical center, scaling their
  // spacing by `growth` too (so they compress toward the center as the box
  // shrinks, rather than overflowing it) — reduces to a single fillText at
  // dead-center-plus-nudge when there's only one line.
  const lineStep = (BUBBLE_FONT_SIZE + BUBBLE_LINE_SPACING) * growth;
  const centerY = boxTop + boxHeight / 2 + BUBBLE_TEXT_VERTICAL_NUDGE * growth;
  const firstLineY = centerY - ((lines.length - 1) * lineStep) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, anchorX, firstLineY + i * lineStep);
  });
  ctx.restore();
}

/** The `speechBubble` kind's registered draw: reads the bubble's own stored
 *  text and anchors at the render context's live player position — never a
 *  render-context text lookup (FR-004/FR-005). */
export function drawSpeechBubbleEffect(
  effect: TransientEffect<SpeechBubbleState>,
  rc: EffectRenderContext,
): void {
  const { growth, opacity } = speechBubbleGrowthAndOpacity(effect);
  drawSpeechBubble(rc.ctx, effect.state.text, rc.playerAnchor.centerX, rc.playerAnchor.headBottomY, growth, opacity);
}
