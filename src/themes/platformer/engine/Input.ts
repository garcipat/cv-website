/**
 * Keys the game reads. Their default browser behavior (e.g. page scroll on
 * arrow keys) is suppressed so gameplay isn't fighting the page — FR-007
 * reserves Arrow Left/Right/Up and Space exclusively for the game.
 */
const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space']);

export interface KeyboardInput {
  /** Whether `code` (a `KeyboardEvent.code` value, e.g. `'ArrowLeft'`) is currently held. */
  isHeld(code: string): boolean;
  /** Removes the window listeners and clears all held-key state. */
  destroy(): void;
}

/**
 * Tracks which keys are currently held, polled per-frame by the game loop
 * (FR-007: input is read every tick so held keys produce continuous
 * movement) instead of reacting to individual keystrokes.
 */
export function createKeyboardInput(): KeyboardInput {
  const held = new Set<string>();

  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    held.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    held.delete(e.code);
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    isHeld: (code: string) => held.has(code),
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      held.clear();
    },
  };
}
