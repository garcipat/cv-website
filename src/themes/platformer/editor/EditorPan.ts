/**
 * Editor-only 2D pan state, driven by right-mouse-button drag. Unrelated to
 * the game's `engine/Camera.ts` (a 1D auto-follow-the-player behavior) —
 * kept in its own module so the two are never confused or coupled.
 */
export interface PanOffset {
  x: number;
  y: number;
}

export function updatePanOffset(current: PanOffset, dx: number, dy: number): PanOffset {
  return { x: current.x + dx, y: current.y + dy };
}
