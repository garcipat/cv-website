import type { PanOffset } from './EditorPan';

/**
 * The editor's three supported zoom levels, in ascending order. 1 (100%) is
 * both the default and the ceiling — this feature only zooms OUT for
 * overview (O-019 spec, "Zoom is out-only"). Kept as a single ordered tuple
 * so `stepZoom` can move through it by index rather than by name.
 */
export const ZOOM_LEVELS = [0.5, 0.75, 1] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];
export const DEFAULT_ZOOM: ZoomLevel = 1;

/**
 * The next zoom level in `direction` (1 = zoom in / larger, -1 = zoom out /
 * smaller) from `current`, clamped at the ceiling and floor rather than
 * wrapping (spec FR-001's "scrolling past the ceiling/floor simply holds").
 */
export function stepZoom(current: ZoomLevel, direction: 1 | -1): ZoomLevel {
  const index = ZOOM_LEVELS.indexOf(current);
  const nextIndex = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, index + direction));
  return ZOOM_LEVELS[nextIndex];
}

/**
 * The zoom-level index carried by a slider change. The slider primitive hands
 * a single-thumb callback a plain number for a pointer interaction but an
 * array for a multi-value one, and reading it as only one of those shapes
 * throws mid-handler — which silently left click and drag doing nothing while
 * the wheel and keyboard still worked. Normalising both shapes in one pure
 * place keeps that failure mode testable without a real pointer.
 */
export function sliderZoomIndex(value: number | readonly number[]): number {
  return Array.isArray(value) ? value[0] : (value as number);
}

/**
 * The new pan offset that keeps the world content under a screen-space
 * `anchor` point fixed across a zoom change from `fromZoom` to `toZoom`
 * (design.md "Anchored zoom is one small formula"). `anchor` is a
 * canvas-relative screen position: the pointer for wheel-zoom, or the
 * canvas's own center for slider-zoom — this function does not care which.
 *
 * Derivation: a screen point maps to world space as
 * `world = (screen - pan) / zoom`. Solving for the pan that keeps the same
 * world point under the same screen anchor after the zoom changes gives
 * `newPan = anchor - (toZoom / fromZoom) * (anchor - pan)`.
 */
export function anchoredPan(
  pan: PanOffset,
  anchor: PanOffset,
  fromZoom: ZoomLevel,
  toZoom: ZoomLevel,
): PanOffset {
  const scale = toZoom / fromZoom;
  return {
    x: anchor.x - scale * (anchor.x - pan.x),
    y: anchor.y - scale * (anchor.y - pan.y),
  };
}
