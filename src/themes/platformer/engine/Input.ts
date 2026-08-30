/**
 * Keys the game reads. Their default browser behavior (e.g. page scroll on
 * arrow keys) is suppressed so gameplay isn't fighting the page — FR-007
 * reserves Arrow Left/Right/Up/Down and Space exclusively for the game.
 * ArrowDown/KeyS trigger bridge drop-through (roadmap step 7); they have no
 * other purpose today.
 */
const GAME_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
  'KeyA',
  'KeyD',
  'KeyS',
  'KeyW',
]);

export interface KeyboardInput {
  /** Whether `code` (a `KeyboardEvent.code` value, e.g. `'ArrowLeft'`) is currently held. */
  isHeld(code: string): boolean;
  /**
   * Edge-triggered: `true` exactly once per physical keydown (OS auto-repeat
   * keydowns while a key is held don't retrigger it), consuming the pending
   * press so a second call in the same tick returns `false` until the key is
   * released and pressed again. Used for actions that must fire once per
   * press rather than continuously (e.g. jump).
   */
  consumePress(code: string): boolean;
  /**
   * Discards all pending edge-triggered presses without touching which keys
   * are currently held. Used to drop input that accumulates while the game
   * loop isn't calling `consumePress` (e.g. while paused for the journal) so
   * it can't leak through and fire on the very next tick after resuming.
   */
  clearPending(): void;
  /** Removes the window listeners and clears all held-key/pending-press state. */
  destroy(): void;
}

/**
 * Tracks which keys are currently held, polled per-frame by the game loop
 * (FR-007: input is read every tick so held keys produce continuous
 * movement) instead of reacting to individual keystrokes.
 */
export function createKeyboardInput(): KeyboardInput {
  const held = new Set<string>();
  const justPressed = new Set<string>();

  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) justPressed.add(e.code);
    held.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    held.delete(e.code);
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    isHeld: (code: string) => held.has(code),
    consumePress(code: string) {
      const wasPressed = justPressed.has(code);
      justPressed.delete(code);
      return wasPressed;
    },
    clearPending() {
      justPressed.clear();
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      held.clear();
      justPressed.clear();
    },
  };
}
