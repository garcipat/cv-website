import {
  MAX_HEARTS,
  HEART_FRAME_SIZE,
  HEART_RENDERED_SIZE,
  heartRemaining,
  heartFrameIndex,
} from '../../entities/Health';
import { pulse } from '../../shared/math';
import { fillTextWithOutline, RESTART_PROMPT_FONT_FAMILY } from '../textDraw';

const HUD_MARGIN = 16;
const HEART_SPACING = 4;

/**
 * Reserves room at the HUD's top-left for the journal icon button (a DOM
 * `<img>`/`<button>`, not canvas-drawn â€” see `PlatformerPage.tsx`) so the
 * heart HUD doesn't render underneath it. 40 is the icon button's size
 * (`size-10` in Tailwind), 8 is the gap between it and the first heart â€”
 * both must stay in sync with `PlatformerPage.tsx`'s icon button sizing if
 * either changes.
 */
export const HEARTS_START_X = HUD_MARGIN + 40 + 8;

/**
 * Draws the heart HUD at a fixed screen position (top-left by default),
 * unlike `drawTerrain`/`drawPlayer` which take camera-scroll
 * `originX`/`originY` â€” the HUD must stay put on screen regardless of how
 * far the camera has scrolled into the level. `startX` defaults to
 * `HUD_MARGIN` (the original, unshifted position) so existing callers are
 * unaffected; `PlatformerPage.tsx` passes `HEARTS_START_X` explicitly to
 * make room for the journal icon button.
 */
export function drawHearts(
  ctx: CanvasRenderingContext2D,
  halfHearts: number,
  heartsSheet: HTMLImageElement,
  startX: number = HUD_MARGIN,
): void {
  ctx.imageSmoothingEnabled = false;

  for (let i = 0; i < MAX_HEARTS; i++) {
    const remaining = heartRemaining(halfHearts, i);
    const sx = heartFrameIndex(remaining) * HEART_FRAME_SIZE;
    const x = startX + i * (HEART_RENDERED_SIZE + HEART_SPACING);
    ctx.drawImage(
      heartsSheet,
      sx,
      0,
      HEART_FRAME_SIZE,
      HEART_FRAME_SIZE,
      x,
      HUD_MARGIN,
      HEART_RENDERED_SIZE,
      HEART_RENDERED_SIZE,
    );
  }
}

/**
 * Paints solid black over the whole canvas except a circular hole of
 * `radius` centered on (centerX, centerY), using the canvas 2D API's
 * even-odd fill rule on two subpaths (the full-canvas rect, then the
 * circle) instead of an offscreen buffer + composite-operation punch â€”
 * simpler and avoids an extra canvas. `centerX`/`centerY` are screen-space
 * (caller adds the camera originX/originY, matching drawTerrain/drawPlayer's
 * convention). `radius <= 0` draws solid black with no hole at all â€” the
 * `awaitingRestart` phase and the very start of a death both rely on this.
 */
export function drawIrisOverlay(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.rect(0, 0, canvasWidth, canvasHeight);
  if (radius > 0) {
    ctx.moveTo(centerX + radius, centerY);
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
  }
  ctx.fill('evenodd');
  ctx.restore();
}

const RESTART_PROMPT_TEXT = 'Press any button to restart';

/** Public path to the font file loaded for RESTART_PROMPT_FONT_FAMILY. */
export const RESTART_PROMPT_FONT_URL = '/fonts/bytebounce.medium.ttf';

/** Draws the death-screen restart prompt, centered on the canvas. Only ever
 *  drawn on top of a fully-closed drawIrisOverlay (radius 0), so no
 *  background/contrast handling is needed here. Falls back to the
 *  sans-serif stack if RESTART_PROMPT_FONT_FAMILY hasn't finished loading
 *  (or failed to) by the time this is drawn. */
export function drawRestartPrompt(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): void {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `24px "${RESTART_PROMPT_FONT_FAMILY}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(RESTART_PROMPT_TEXT, canvasWidth / 2, canvasHeight / 2);
  ctx.restore();
}

/** Border thickness of the low-health glow, in canvas px â€” a fixed HUD-style
 *  size, not scaled to canvas width/height (same convention as the fixed-size
 *  heart/journal HUD icons). */
export const LOW_HEALTH_GLOW_WIDTH_PX = 18;
/** Full breathe-in/breathe-out cycle length for the pulse. */
export const LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS = 1.4;
const LOW_HEALTH_GLOW_BASE_ALPHA = 0.25;
const LOW_HEALTH_GLOW_PULSE_ALPHA = 0.45;
const LOW_HEALTH_GLOW_COLOR = '#ff1f1f';

/** 0..1 sine breathing curve mapped to [BASE, BASE+PULSE] alpha, driven by a
 *  plain elapsed-seconds counter (not tied to any one effect's lifetime â€”
 *  the glow is ambient and open-ended for as long as health stays critical,
 *  see PlatformerPage.tsx's `worldAnimElapsed`). */
export function lowHealthGlowAlpha(elapsedSeconds: number): number {
  const wave = (pulse(elapsedSeconds / LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS) + 1) / 2;
  return LOW_HEALTH_GLOW_BASE_ALPHA + wave * LOW_HEALTH_GLOW_PULSE_ALPHA;
}

/** Draws a soft red glow pulsing inward from all four canvas edges â€” the
 *  low-health warning (spec.md FR-007/FR-008). The caller gates WHETHER
 *  this is called at all (critical health, live gameplay only); this
 *  function only draws, unconditionally, whenever it's invoked. */
export function drawLowHealthGlow(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  elapsedSeconds: number,
): void {
  const alpha = lowHealthGlowAlpha(elapsedSeconds);
  const w = LOW_HEALTH_GLOW_WIDTH_PX;
  ctx.save();
  ctx.globalAlpha = alpha;

  const left = ctx.createLinearGradient(0, 0, w, 0);
  left.addColorStop(0, LOW_HEALTH_GLOW_COLOR);
  left.addColorStop(1, 'rgba(255,31,31,0)');
  ctx.fillStyle = left;
  ctx.fillRect(0, 0, w, canvasHeight);

  const right = ctx.createLinearGradient(canvasWidth, 0, canvasWidth - w, 0);
  right.addColorStop(0, LOW_HEALTH_GLOW_COLOR);
  right.addColorStop(1, 'rgba(255,31,31,0)');
  ctx.fillStyle = right;
  ctx.fillRect(canvasWidth - w, 0, w, canvasHeight);

  const top = ctx.createLinearGradient(0, 0, 0, w);
  top.addColorStop(0, LOW_HEALTH_GLOW_COLOR);
  top.addColorStop(1, 'rgba(255,31,31,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, canvasWidth, w);

  const bottom = ctx.createLinearGradient(0, canvasHeight, 0, canvasHeight - w);
  bottom.addColorStop(0, LOW_HEALTH_GLOW_COLOR);
  bottom.addColorStop(1, 'rgba(255,31,31,0)');
  ctx.fillStyle = bottom;
  ctx.fillRect(0, canvasHeight - w, canvasWidth, w);

  ctx.restore();
}

// Matches HEART_RENDERED_SIZE so the coin/fruit counter icons read as the
// same HUD "row height" as the hearts, not a smaller secondary element.
const COUNTER_ICON_SIZE = HEART_RENDERED_SIZE;

/** A cropped frame of a shared sprite sheet, drawn into the HUD icon slot. */
export interface HudCounterSheetFrameIcon {
  kind: 'sheetFrame';
  sx: number;
  sy: number;
  frameSize: number;
  /** The square source frame is frameSize Ã— frameSize, drawn at displaySize. */
  displaySize: number;
  /** Icon-only vertical nudge from the counter's centered y (0 = none). */
  yOffset: number;
}

/** A standalone image scaled to a target height at its intrinsic aspect ratio. */
export interface HudCounterScaledImageIcon {
  kind: 'scaledImage';
  sourceWidth: number;
  sourceHeight: number;
  /** Target drawn height; drawn width = (sourceWidth / sourceHeight) * height. */
  height: number;
}

export type HudCounterIcon = HudCounterSheetFrameIcon | HudCounterScaledImageIcon;

/**
 * Declarative description of one persistent HUD counter â€” the single data
 * shape the generic `drawHudCounter`/`hudCounterWidth` consume. The drawer
 * branches only on `icon.kind` (geometry) and `image === null`; it never
 * branches on a counter name (FR-005/FR-014).
 */
export interface HudCounterDescriptor {
  /** null = measurement-only descriptor (draws nothing). */
  image: CanvasImageSource | null;
  icon: HudCounterIcon;
  /** Explicit layout slot: the text starts after it and the measurer uses it. */
  advanceWidth: number;
  count: number;
  /** Present â‡’ "count / total"; absent â‡’ "count". */
  total?: number;
  /** Gap from the icon advance slot to the text. */
  textGap: number;
}

/** Renders a counter's text: "N / M" with a total, bare "N" without. */
export function formatHudCounterText(count: number, total?: number): string {
  return total === undefined ? `${count}` : `${count} / ${total}`;
}

/** Builds a descriptor for a square frame cropped out of a shared sprite sheet. */
export function sheetFrameCounter(init: {
  image: CanvasImageSource | null;
  sx: number;
  sy: number;
  frameSize: number;
  displaySize?: number;
  yOffset?: number;
  count: number;
  total?: number;
  textGap: number;
  advanceWidth?: number;
}): HudCounterDescriptor {
  return {
    image: init.image,
    icon: {
      kind: 'sheetFrame',
      sx: init.sx,
      sy: init.sy,
      frameSize: init.frameSize,
      displaySize: init.displaySize ?? COUNTER_ICON_SIZE,
      yOffset: init.yOffset ?? 0,
    },
    advanceWidth: init.advanceWidth ?? COUNTER_ICON_SIZE,
    count: init.count,
    total: init.total,
    textGap: init.textGap,
  };
}

/** Builds a descriptor for a standalone image scaled to a target height. */
export function scaledImageCounter(init: {
  image: CanvasImageSource | null;
  sourceWidth: number;
  sourceHeight: number;
  height: number;
  count: number;
  total?: number;
  textGap: number;
  advanceWidth?: number;
}): HudCounterDescriptor {
  return {
    image: init.image,
    icon: {
      kind: 'scaledImage',
      sourceWidth: init.sourceWidth,
      sourceHeight: init.sourceHeight,
      height: init.height,
    },
    advanceWidth: init.advanceWidth ?? (init.sourceWidth / init.sourceHeight) * init.height,
    count: init.count,
    total: init.total,
    textGap: init.textGap,
  };
}

/**
 * THE one generic persistent-HUD counter drawer. Draws the descriptor's icon
 * into its advance slot (crisp, `imageSmoothingEnabled = false`) and its text
 * after it, exactly as the four per-kind drawers it replaces did.
 */
export function drawHudCounter(
  ctx: CanvasRenderingContext2D,
  descriptor: HudCounterDescriptor,
  x: number,
  y: number,
): void {
  if (descriptor.image === null) return;

  ctx.imageSmoothingEnabled = false;

  const { icon } = descriptor;
  const drawWidth =
    icon.kind === 'sheetFrame'
      ? icon.displaySize
      : (icon.sourceWidth / icon.sourceHeight) * icon.height;
  const drawHeight = icon.kind === 'sheetFrame' ? icon.displaySize : icon.height;

  const iconX = x + (descriptor.advanceWidth - drawWidth) / 2;
  const iconY = y - drawHeight / 2 + (icon.kind === 'sheetFrame' ? icon.yOffset : 0);
  if (icon.kind === 'sheetFrame') {
    ctx.drawImage(
      descriptor.image,
      icon.sx,
      icon.sy,
      icon.frameSize,
      icon.frameSize,
      iconX,
      iconY,
      drawWidth,
      drawHeight,
    );
  } else {
    ctx.drawImage(
      descriptor.image,
      0,
      0,
      icon.sourceWidth,
      icon.sourceHeight,
      iconX,
      iconY,
      drawWidth,
      drawHeight,
    );
  }

  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.font = `22px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  fillTextWithOutline(
    ctx,
    formatHudCounterText(descriptor.count, descriptor.total),
    x + descriptor.advanceWidth + descriptor.textGap,
    y,
  );
  ctx.restore();
}

/**
 * The descriptor's actual on-screen content width (advance slot + text gap +
 * the real measured text), measured with the same font the drawer uses so the
 * drawn and measured strings cannot drift.
 */
export function hudCounterWidth(
  ctx: CanvasRenderingContext2D,
  descriptor: HudCounterDescriptor,
): number {
  ctx.font = `22px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  const textWidth = ctx.measureText(formatHudCounterText(descriptor.count, descriptor.total)).width;
  return descriptor.advanceWidth + descriptor.textGap + textWidth;
}

/**
 * Horizontal screen position for the counter that follows `previous` â€”
 * placed just past its measured width, separated by the shared `HUD_GROUP_GAP`.
 * The caller applies the group-hiding rule (a hidden group does not advance the
 * next X) by reusing the previous counter's X.
 */
export function hudCounterX(
  ctx: CanvasRenderingContext2D,
  previous: HudCounterDescriptor,
  previousX: number,
): number {
  return previousX + hudCounterWidth(ctx, previous) + HUD_GROUP_GAP;
}

/** Total on-screen width of the 3-heart row (drawHearts), used to position
 *  the chest counter just past it in the same HUD row. */
const HEARTS_ROW_WIDTH = MAX_HEARTS * HEART_RENDERED_SIZE + (MAX_HEARTS - 1) * HEART_SPACING;

/** Shared horizontal gap between HUD groups (heartsâ†’chest, chestâ†’key) â€” one
 *  constant reused for every gap on this row, rather than separately
 *  hand-tuned numbers, so the rhythm between groups is equal by
 *  construction instead of by coincidence. */
export const HUD_GROUP_GAP = 24;

/** Horizontal screen position for the persistent chest counter â€” placed
 *  just to the right of the heart row, same HUD row as the hearts (not a
 *  second row below them). */
export const CHEST_COUNTER_X = HEARTS_START_X + HEARTS_ROW_WIDTH + HUD_GROUP_GAP;

/** Vertical screen position for the persistent chest counter â€” vertically
 *  centered on the same row the hearts occupy (drawHearts draws hearts with
 *  their top edge at HUD_MARGIN; the counters treat y as a vertical CENTER,
 *  so this is offset by half a heart's height to align). */
export const CHEST_COUNTER_Y = HUD_MARGIN + HEART_RENDERED_SIZE / 2;

/** Chest icon height: chest art is edge-to-edge with no transparent padding
 *  (unlike hearts), so it reads oversized at HEART_RENDERED_SIZE â€” shrunk
 *  down from that, but not all the way to 20 (read as too small next to the
 *  other HUD icons). */
export const CHEST_COUNTER_ICON_HEIGHT = 26;

/** Wider gap than the collectible counter's shared 6px between the chest icon
 *  and its "N / M" text â€” a dedicated constant so this counter's spacing can
 *  be tuned independently. Exported so tests can pin the exact text x. */
export const CHEST_COUNTER_TEXT_GAP = 12;

export const KEY_COUNTER_Y = CHEST_COUNTER_Y;

/** Between CHEST_COUNTER_ICON_HEIGHT (26) and HEART_RENDERED_SIZE (32) â€” the
 *  current key.png is a bold, chunky shape (unlike an earlier thin 14x28
 *  version, which needed the full heart height to avoid looking shrunk), so
 *  a smaller HUD icon than the world sprite reads fine without looking
 *  undersized next to the hearts/chest icons on the same row. Exported so the
 *  page's key descriptor can pass it. */
export const KEY_COUNTER_ICON_HEIGHT = 24;

/** Between CHEST_COUNTER_ICON_HEIGHT (26) and HEART_RENDERED_SIZE (32) â€”
 *  matches the key counter's own icon height so the two HUD groups read at
 *  the same scale. Exported so the page's bomb descriptor can pass it. */
export const BOMB_COUNTER_ICON_HEIGHT = 24;
