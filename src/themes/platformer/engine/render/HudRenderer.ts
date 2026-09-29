import {
  MAX_HEARTS,
  HEART_FRAME_SIZE,
  HEART_RENDERED_SIZE,
  heartRemaining,
  heartFrameIndex,
} from '../../entities/Health';
import { pulse } from '../../shared/math';
import { fillTextWithOutline, RESTART_PROMPT_FONT_FAMILY } from '../textDraw';
import { formatHudCounterText, HUD_MARGIN, HEART_SPACING } from './HudLayout';
import type { HudCounterDescriptor } from './HudLayout';

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
 * drawn on top of a fully-closed drawIrisOverlay (radius 0), so no
 * background/contrast handling is needed here. Falls back to the
 * sans-serif stack if RESTART_PROMPT_FONT_FAMILY hasn't finished loading
 * (or failed to) by the time this is drawn. */
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
 * size, not scaled to canvas width/height (same convention as the fixed-size
 * heart/journal HUD icons). */
export const LOW_HEALTH_GLOW_WIDTH_PX = 18;
/** Full breathe-in/breathe-out cycle length for the pulse. */
export const LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS = 1.4;
const LOW_HEALTH_GLOW_BASE_ALPHA = 0.25;
const LOW_HEALTH_GLOW_PULSE_ALPHA = 0.45;
const LOW_HEALTH_GLOW_COLOR = '#ff1f1f';

/** 0..1 sine breathing curve mapped to [BASE, BASE+PULSE] alpha, driven by a
 * plain elapsed-seconds counter (not tied to any one effect's lifetime â€”
 * the glow is ambient and open-ended for as long as health stays critical,
 * see PlatformerPage.tsx's `worldAnimElapsed`). */
export function lowHealthGlowAlpha(elapsedSeconds: number): number {
  const wave = (pulse(elapsedSeconds / LOW_HEALTH_GLOW_PULSE_PERIOD_SECONDS) + 1) / 2;
  return LOW_HEALTH_GLOW_BASE_ALPHA + wave * LOW_HEALTH_GLOW_PULSE_ALPHA;
}

/** Draws a soft red glow pulsing inward from all four canvas edges â€” the
 * low-health warning. The caller gates WHETHER
 * this is called at all (critical health, live gameplay only); this
 * function only draws, unconditionally, whenever it's invoked. */
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
