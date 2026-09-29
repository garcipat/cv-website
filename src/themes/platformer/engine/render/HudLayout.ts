import { MAX_HEARTS, HEART_RENDERED_SIZE } from '../../entities/Health';
import { RESTART_PROMPT_FONT_FAMILY } from '../textDraw';
import { drawHearts, drawHudCounter } from './HudRenderer';
import type { PopupIconLookup } from '../effects/transientEffect';

/**
 * The HUD's top margin and the gap between hearts. Declared here (not in
 * `HudRenderer`) because the layout's own constants derive from them at module
 * init: `HudRenderer` imports both back for `drawHearts`, which keeps the
 * module cycle call-time-only rather than reading a partially-initialised
 * module during evaluation.
 */
export const HUD_MARGIN = 16;
export const HEART_SPACING = 4;

/**
 * Which permanent HUD counter a slot is — identity only. The drawer and the
 * layout never branch on it; the layout uses it to pick the row's Y and to
 * report each placement, and tests/debug read it.
 */
export type HudCounterKey = 'chests' | 'keys' | 'bombs';

/** A cropped frame of a shared sprite sheet, drawn into the HUD icon slot. */
export interface HudCounterSheetFrameIcon {
  kind: 'sheetFrame';
  sx: number;
  sy: number;
  frameSize: number;
  /** The square source frame is frameSize × frameSize, drawn at displaySize. */
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
 * Declarative description of one persistent HUD counter — the single data
 * shape the generic `drawHudCounter`/`hudCounterWidth` consume. The drawer
 * branches only on `icon.kind` (geometry) and `image === null`; it never
 * branches on a counter name.
 */
export interface HudCounterDescriptor {
  /** null = measurement-only descriptor (draws nothing). */
  image: CanvasImageSource | null;
  icon: HudCounterIcon;
  /** Explicit layout slot: the text starts after it and the measurer uses it. */
  advanceWidth: number;
  count: number;
  /** Present ⇒ "count / total"; absent ⇒ "count". */
  total?: number;
  /** Gap from the icon advance slot to the text. */
  textGap: number;
}

/**
 * One counter slot of the HUD model — the per-frame data the state layer
 * builds and the layout positions. Data only: no draw callback, no
 * game-state read (FR-013).
 */
export interface HudCounterSlot {
  /** Identity only — never branched on. */
  readonly key: HudCounterKey;
  /** null ⇒ the asset is absent (still loading, or failed). */
  readonly image: CanvasImageSource | null;
  readonly icon: HudCounterIcon;
  readonly count: number;
  readonly total?: number;
  readonly textGap: number;
  readonly visible: boolean;
  /** Whether a hidden group still advances the next group's X (FR-014). */
  readonly advancesWhenHidden: boolean;
}

/** The whole HUD as data: the hearts row, the counter row and the popup icons. */
export interface HudModel {
  readonly hearts: { readonly hitPoints: number; readonly sprite: CanvasImageSource | null } | null;
  /** Frozen order: chest, key, bomb. */
  readonly counters: readonly HudCounterSlot[];
  readonly popupIcons: PopupIconLookup;
}

/** One counter after layout: where it goes and whether it is drawn. */
export interface PlacedCounter {
  readonly key: HudCounterKey;
  readonly descriptor: HudCounterDescriptor;
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

/** The laid-out HUD: the hearts row and each counter's position. */
export interface HudLayoutResult {
  readonly hearts: { readonly x: number; readonly sprite: CanvasImageSource | null } | null;
  readonly counters: readonly PlacedCounter[];
}

// Matches HEART_RENDERED_SIZE so the coin/fruit counter icons read as the
// same HUD "row height" as the hearts, not a smaller secondary element.
const COUNTER_ICON_SIZE = HEART_RENDERED_SIZE;

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
 * Horizontal screen position for the counter that follows `previous` —
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
 * the chest counter just past it in the same HUD row. */
const HEARTS_ROW_WIDTH = MAX_HEARTS * HEART_RENDERED_SIZE + (MAX_HEARTS - 1) * HEART_SPACING;

/** Shared horizontal gap between HUD groups (hearts→chest, chest→key) — one
 * constant reused for every gap on this row, rather than separately
 * hand-tuned numbers, so the rhythm between groups is equal by
 * construction instead of by coincidence. */
export const HUD_GROUP_GAP = 24;

/**
 * Reserves room at the HUD's top-left for the journal icon button (a DOM
 * `<img>`/`<button>`, not canvas-drawn — see `PlatformerPage.tsx`) so the
 * heart HUD doesn't render underneath it. 40 is the icon button's size
 * (`size-10` in Tailwind), 8 is the gap between it and the first heart —
 * both must stay in sync with `PlatformerPage.tsx`'s icon button sizing if
 * either changes.
 */
export const HEARTS_START_X = HUD_MARGIN + 40 + 8;

/** Horizontal screen position for the persistent chest counter — placed
 * just to the right of the heart row, same HUD row as the hearts (not a
 * second row below them). */
export const CHEST_COUNTER_X = HEARTS_START_X + HEARTS_ROW_WIDTH + HUD_GROUP_GAP;

/** Vertical screen position for the persistent chest counter — vertically
 * centered on the same row the hearts occupy (drawHearts draws hearts with
 * their top edge at HUD_MARGIN; the counters treat y as a vertical CENTER,
 * so this is offset by half a heart's height to align). */
export const CHEST_COUNTER_Y = HUD_MARGIN + HEART_RENDERED_SIZE / 2;

/** Chest icon height: chest art is edge-to-edge with no transparent padding
 * (unlike hearts), so it reads oversized at HEART_RENDERED_SIZE — shrunk
 * down from that, but not all the way to 20 (read as too small next to the
 * other HUD icons). */
export const CHEST_COUNTER_ICON_HEIGHT = 26;

/** Wider gap than the collectible counter's shared 6px between the chest icon
 * and its "N / M" text — a dedicated constant so this counter's spacing can
 * be tuned independently. Exported so tests can pin the exact text x. */
export const CHEST_COUNTER_TEXT_GAP = 12;

export const KEY_COUNTER_Y = CHEST_COUNTER_Y;

/** Between CHEST_COUNTER_ICON_HEIGHT (26) and HEART_RENDERED_SIZE (32) — the
 * current key.png is a bold, chunky shape (unlike an earlier thin 14x28
 * version, which needed the full heart height to avoid looking shrunk), so
 * a smaller HUD icon than the world sprite reads fine without looking
 * undersized next to the hearts/chest icons on the same row. */
export const KEY_COUNTER_ICON_HEIGHT = 24;

/** Between CHEST_COUNTER_ICON_HEIGHT (26) and HEART_RENDERED_SIZE (32) —
 * matches the key counter's own icon height so the two HUD groups read at
 * the same scale. */
export const BOMB_COUNTER_ICON_HEIGHT = 24;

/** The icon's advance slot — the same default the descriptor builders use, so
 * a model slot and a hand-built descriptor measure identically. */
function iconAdvanceWidth(icon: HudCounterIcon): number {
  return icon.kind === 'sheetFrame'
    ? COUNTER_ICON_SIZE
    : (icon.sourceWidth / icon.sourceHeight) * icon.height;
}

function descriptorFor(slot: HudCounterSlot): HudCounterDescriptor {
  return {
    image: slot.image,
    icon: slot.icon,
    advanceWidth: iconAdvanceWidth(slot.icon),
    count: slot.count,
    total: slot.total,
    textGap: slot.textGap,
  };
}

/**
 * Positions the whole HUD from the model alone (FR-014).
 *
 * The frozen X-chain: the counter row starts at `CHEST_COUNTER_X`; each slot
 * advances the running `x` by its measured width + `HUD_GROUP_GAP` when it is
 * visible, and when it is hidden only if its own `advancesWhenHidden` says so
 * (today the chest advances even while hidden, the key and bomb do not). Hearts
 * sit at `HEARTS_START_X` and are laid out only when their sprite is present.
 */
export function layoutHud(ctx: CanvasRenderingContext2D, model: HudModel): HudLayoutResult {
  const hearts =
    model.hearts && model.hearts.sprite !== null
      ? { x: HEARTS_START_X, sprite: model.hearts.sprite }
      : null;

  const counters: PlacedCounter[] = [];
  let x = CHEST_COUNTER_X;
  for (const slot of model.counters) {
    const descriptor = descriptorFor(slot);
    const y = slot.key === 'chests' ? CHEST_COUNTER_Y : KEY_COUNTER_Y;
    counters.push({ key: slot.key, descriptor, x, y, visible: slot.visible });
    if (slot.visible || slot.advancesWhenHidden) {
      x = hudCounterX(ctx, descriptor, x);
    }
  }

  return { hearts, counters };
}

/**
 * The HUD's one composition entry point: lay the model out, then draw it —
 * hearts through `drawHearts`, each visible counter through the one generic
 * `drawHudCounter`. A hidden or still-loading slot draws nothing (the generic
 * drawer already no-ops on a null image) while still having chained per rule 2.
 *
 * The `HudRenderer` import is the renderer's own drawing primitives, so the
 * runtime edge is composition → primitives (call-time only, never at module
 * init), and `HudRenderer` keeps its public drawer surface unchanged.
 */
export function drawHud(ctx: CanvasRenderingContext2D, model: HudModel): void {
  const layout = layoutHud(ctx, model);
  if (layout.hearts && model.hearts) {
    // The model's sprite is the loaded image the lookup holds — the loader
    // only ever stores HTMLImageElements, so this narrowing is exact.
    drawHearts(
      ctx,
      model.hearts.hitPoints,
      layout.hearts.sprite as HTMLImageElement,
      layout.hearts.x,
    );
  }
  for (const placed of layout.counters) {
    if (!placed.visible) continue;
    drawHudCounter(ctx, placed.descriptor, placed.x, placed.y);
  }
}
