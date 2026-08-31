import { useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentUI } from '@/state/locale';
import { lifecycleState, controlsOverlayDismissed } from '../PlatformerState';

// How long the overlay stays up before auto-dismissing if the visitor
// hasn't moved or jumped yet (spec.md FR-036's "short timeout") — long
// enough to read three short caption lines, short enough not to linger
// over gameplay indefinitely.
const AUTO_DISMISS_TIMEOUT_MS = 6000;

// Only movement and jump input dismiss the overlay (FR-036) — matches the
// exact key codes PlatformerPage.tsx's game loop reads for horizontal
// movement (ArrowLeft/ArrowRight/KeyA/KeyD) and jump (Space). The journal
// toggle key (KeyJ) is listed IN the overlay's content but is deliberately
// NOT a dismiss trigger.
const DISMISS_KEY_CODES = new Set(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space']);

/**
 * Universal controls overlay (roadmap step 25, spec.md FR-036) — shown once
 * gameplay first enters the `playing` phase, listing the game's universal
 * controls via the real keycap sprite (`controls_overlay_keys.png`: the
 * arrow-key cluster, Space, and J) plus short translated captions.
 * Auto-dismisses on the player's first movement/jump input or a short
 * timeout, and (via `controlsOverlayDismissed`, a module-level one-shot
 * latch — see PlatformerState.ts) never reappears for the rest of the
 * session, including across a Reset Game or a death/respawn.
 *
 * Deliberately does NOT pause the game loop or touch `GameLifecycle.ts` —
 * unlike the Journal/Thank You screen, FR-036 doesn't require pausing, and
 * the overlay is purely advisory over already-running gameplay.
 */
export const ControlsOverlay = () => {
  useSignals();
  const ui = currentUI.value;
  const visible = lifecycleState.value.phase === 'playing' && !controlsOverlayDismissed.value;

  useEffect(() => {
    if (!visible) return;

    const dismiss = () => {
      controlsOverlayDismissed.value = true;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (DISMISS_KEY_CODES.has(e.code)) dismiss();
    };

    window.addEventListener('keydown', onKeyDown);
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_TIMEOUT_MS);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(timer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      data-testid="platformer-controls-overlay"
      className="pointer-events-none fixed inset-x-0 bottom-8 z-40 flex justify-center"
    >
      <div className="flex flex-col items-center gap-2 rounded-lg bg-black/50 px-6 py-3 text-white">
        <img
          src="/sprites/controls_overlay_keys.png"
          alt=""
          className="h-14 w-auto"
          style={{ imageRendering: 'pixelated' }}
        />
        <div className="font-caveat flex gap-6 text-lg">
          <span>{ui.platformer.controlsOverlay.move}</span>
          <span>{ui.platformer.controlsOverlay.jump}</span>
          <span>{ui.platformer.controlsOverlay.journal}</span>
        </div>
      </div>
    </div>
  );
};
