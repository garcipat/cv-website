/**
 * The "(icon) collected / total" counter-popup family (R-004 US1/US5): a keyed
 * slot (at most one per `labelKey`, refreshed in place) whose `tick` returns
 * the `null` drop sentinel at its duration. The row is assembled per effect
 * from the live collection so the fixed `coins`/`fruits`/`enemies`/`crates`
 * layout is preserved exactly.
 */
import type { CounterPopupLabelKey } from '../../contracts/counters';
import { fillTextWithOutline, RESTART_PROMPT_FONT_FAMILY } from '../textDraw';
import { COLLECTION_TEXT_STACK_ROW_HEIGHT } from './flight';
import type { EffectRenderContext, TransientEffect } from './transientEffect';

/** Seconds the popup stays fully visible before fading, and the total seconds
 *  until it is gone (sized to slightly exceed the flight text's own 2.0s). */
export const COUNTER_POPUP_HOLD_SECONDS = 1.7;
export const COUNTER_POPUP_FADE_SECONDS = 0.4;
export const COUNTER_POPUP_DURATION_SECONDS =
  COUNTER_POPUP_HOLD_SECONDS + COUNTER_POPUP_FADE_SECONDS;

/** One popup's payload: the collectible label, the running count, and the
 *  total for that type. */
export interface CounterPopupState {
  labelKey: CounterPopupLabelKey;
  collected: number;
  total: number;
}

/** The fixed left-to-right layout order, matching the journal summary's own
 *  coins/fruits/enemies/crates ordering. */
const COUNTER_POPUP_ORDER: readonly CounterPopupLabelKey[] = ['coins', 'fruits', 'enemies', 'crates'];

const COUNTER_POPUP_ICON_SIZE = 28;
const COUNTER_POPUP_FONT_SIZE = 24;
const COUNTER_POPUP_TEXT_GAP = 6;
/** Horizontal gap between two side-by-side popups. */
const COUNTER_POPUP_ITEM_GAP = 20;

export function startCounterPopup(
  labelKey: CounterPopupLabelKey,
  collected: number,
  total: number,
): TransientEffect<CounterPopupState> {
  return {
    kind: 'counterPopup',
    id: `counterPopup:${labelKey}`,
    duration: COUNTER_POPUP_DURATION_SECONDS,
    elapsed: 0,
    state: { labelKey, collected, total },
    tick: tickCounterPopup,
    draw: drawCounterPopup,
    expired: (effect) => effect.elapsed > effect.duration,
  };
}

/** Advances the popup by `dt`; returns `null` once its total duration has
 *  elapsed (the collection drops it at that point). */
export function tickCounterPopup(
  effect: TransientEffect<CounterPopupState>,
  dt: number,
): TransientEffect<CounterPopupState> | null {
  const elapsed = effect.elapsed + dt;
  if (elapsed >= COUNTER_POPUP_DURATION_SECONDS) return null;
  return { ...effect, elapsed };
}

/** 1 while held, then linearly fades to 0 over the final fade window. */
export function counterPopupOpacity(effect: TransientEffect<CounterPopupState>): number {
  if (effect.elapsed < COUNTER_POPUP_HOLD_SECONDS) return 1;
  return Math.max(
    0,
    1 - (effect.elapsed - COUNTER_POPUP_HOLD_SECONDS) / COUNTER_POPUP_FADE_SECONDS,
  );
}

/**
 * Draws this one popup at its slot in the shared row — the row is laid out
 * from the live counter-popup effects in the fixed key order, so drawing each
 * effect once assembles the same row the pre-refactor single pass drew.
 */
export function drawCounterPopup(
  effect: TransientEffect<CounterPopupState>,
  rc: EffectRenderContext,
): void {
  const popups = rc.effects.filter(
    (candidate): candidate is TransientEffect<CounterPopupState> => candidate.kind === 'counterPopup',
  );

  const items = COUNTER_POPUP_ORDER.flatMap((labelKey) => {
    const popup = popups.find((candidate) => candidate.state.labelKey === labelKey);
    if (!popup) return [];
    const icon = rc.popupIcons[labelKey];
    if (!icon) return [];
    return [
      {
        id: popup.id,
        icon: icon.icon,
        iconFrame: icon.iconFrame,
        iconYOffset: icon.iconYOffset ?? 0,
        collected: popup.state.collected,
        total: popup.state.total,
        opacity: counterPopupOpacity(popup),
      },
    ];
  });
  const visible = items.filter((item) => item.opacity > 0);
  if (visible.length === 0) return;

  const ctx = rc.ctx;
  ctx.font = `${COUNTER_POPUP_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
  const itemWidths = visible.map(
    (item) =>
      COUNTER_POPUP_ICON_SIZE +
      COUNTER_POPUP_TEXT_GAP +
      ctx.measureText(`${item.collected} / ${item.total}`).width,
  );
  const totalWidth =
    itemWidths.reduce((sum, width) => sum + width, 0) +
    COUNTER_POPUP_ITEM_GAP * (visible.length - 1);

  const centerX = rc.canvasWidth / 2;
  const y = rc.canvasHeight * 0.3 - COLLECTION_TEXT_STACK_ROW_HEIGHT;

  let cursorX = centerX - totalWidth / 2;
  for (let i = 0; i < visible.length; i += 1) {
    const item = visible[i];
    if (item.id === effect.id) {
      const text = `${item.collected} / ${item.total}`;
      ctx.save();
      ctx.globalAlpha = item.opacity;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        item.icon,
        item.iconFrame.sx,
        item.iconFrame.sy,
        item.iconFrame.size,
        item.iconFrame.size,
        cursorX,
        y - COUNTER_POPUP_ICON_SIZE / 2 + item.iconYOffset,
        COUNTER_POPUP_ICON_SIZE,
        COUNTER_POPUP_ICON_SIZE,
      );
      ctx.fillStyle = '#fff';
      ctx.font = `${COUNTER_POPUP_FONT_SIZE}px "${RESTART_PROMPT_FONT_FAMILY}", monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fillTextWithOutline(
        ctx,
        text,
        cursorX + COUNTER_POPUP_ICON_SIZE + COUNTER_POPUP_TEXT_GAP,
        y,
      );
      ctx.restore();
      return;
    }
    cursorX += itemWidths[i] + COUNTER_POPUP_ITEM_GAP;
  }
}
