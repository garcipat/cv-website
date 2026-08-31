import { useEffect, useRef, useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentUI } from '@/state/locale';
import { lifecycleState, controlsOverlayDismissed, playerState } from '../PlatformerState';
import { RESTART_PROMPT_FONT_FAMILY } from '../engine/Renderer';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { PHYSICS_CONFIG } from '../engine/PhysicsConfig';

// The overlay dismisses once the player has actually traveled this far from
// where they stood when it appeared (about two tiles) — a deliberately
// bigger bar than "any single keypress", so a visitor who taps a key once
// while still reading isn't cut off before they've actually started moving.
const DISMISS_TRAVEL_DISTANCE_PX = RENDERED_TILE_SIZE * 2;

// How long the opacity transition below takes — the dismiss latch flips
// only after this fully elapses, so the fade is never cut short.
const FADE_OUT_DURATION_MS = 600;

// How long the fade-IN transition takes (eases in from invisible, rather
// than popping straight to its baseline opacity).
const FADE_IN_DURATION_MS = 400;

// The overlay slides in from the left and, on dismiss, slides out to the
// right — reading as if it's moving the same way the player walks. The
// slide distance is derived from the player's own walkSpeed (px/s, see
// PhysicsConfig.ts) times each transition's duration, so the motion reads
// at the same velocity as the character actually walking, not an arbitrary
// distance that happens to look similar.
const SLIDE_IN_DISTANCE_PX = PHYSICS_CONFIG.walkSpeed * (FADE_IN_DURATION_MS / 1000);
const SLIDE_OUT_DISTANCE_PX = PHYSICS_CONFIG.walkSpeed * (FADE_OUT_DURATION_MS / 1000);

// Horizontal center of each key group within controls_overlay_keys.png
// (560×183px), as a percentage of the image's own width — measured from the
// sprite's actual non-transparent pixel bounds (arrow cluster: cols 1-265,
// space bar: cols 283-449, J key: cols 472-558), not eyeballed. Used to
// position each caption directly under its matching key group below,
// regardless of the image's rendered size.
const MOVE_LABEL_CENTER_PERCENT = 23.75;
const JUMP_LABEL_CENTER_PERCENT = 65.36;
const JOURNAL_LABEL_CENTER_PERCENT = 91.96;

/**
 * Universal controls overlay (roadmap step 25, spec.md FR-036) — shown once
 * gameplay reaches the `playing` phase, listing the game's universal
 * controls via the real keycap sprite (`controls_overlay_keys.png`: the
 * arrow-key cluster, Space, and J) plus short translated captions, centered
 * where collected-fact text already lands (roughly 30% down the viewport —
 * see Renderer.ts's/PlatformerPage.tsx's own `midY` convention) rather than
 * in a background panel. Eases in over `FADE_IN_DURATION_MS` instead of
 * popping straight to its baseline opacity.
 *
 * Stays up until the player has actually traveled `DISMISS_TRAVEL_DISTANCE_PX`
 * from where they stood when it appeared (left or right — the distance is
 * unsigned) — no timeout fallback; a visitor who never moves keeps seeing it
 * indefinitely, by design. Then fades out over `FADE_OUT_DURATION_MS` before
 * (via `controlsOverlayDismissed`, a
 * module-level one-shot latch — see PlatformerState.ts) never reappearing for
 * the rest of the session, including across a Reset Game or a death/respawn.
 *
 * Deliberately does NOT pause the game loop or touch `GameLifecycle.ts` —
 * unlike the Journal/Thank You screen, FR-036 doesn't require pausing, and
 * the overlay is purely advisory over already-running gameplay.
 */
export const ControlsOverlay = () => {
  useSignals();
  const ui = currentUI.value;
  // Tried also showing this during 'intro' (the iris growing open at game
  // start/restart) since the iris is a canvas-drawn mask with no clipping
  // power over this DOM overlay — but in practice that means the overlay
  // renders over a screen that's still almost entirely the iris's own solid
  // black background early in the animation, reading as an unwanted black
  // backdrop behind the keys. Waiting for 'playing' avoids that; the fade-in
  // below (see FADE_IN_DURATION_MS) is what actually solves the "pop-in"
  // feel instead.
  const shouldShow = lifecycleState.value.phase === 'playing' && !controlsOverlayDismissed.value;
  // Only reads (and so only subscribes to) playerState while actually
  // shown — needed to notice the player has traveled far enough to dismiss,
  // but reading it unconditionally would subscribe this component to every
  // playerState change even while hidden, for no benefit.
  const playerX = shouldShow ? playerState.value.x : null;

  const [fadingOut, setFadingOut] = useState(false);
  // Starts false so the unrevealed (invisible) state actually paints first;
  // flipping it to true shortly after lets the opacity transition below
  // animate the change, the same double-rAF-flip pattern ThankYouScreen.tsx
  // already uses for its own entrance (see that file's doc comment for why
  // a single rAF isn't reliably enough — the callback can still land before
  // the browser's next paint).
  const [revealed, setRevealed] = useState(false);
  const spawnXRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  const beginFadeOut = () => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    setFadingOut(true);
  };

  // Captures the player's position the moment the overlay appears, and
  // schedules the fade-in reveal. The dismiss latch this feeds
  // (controlsOverlayDismissed) is permanent, so this effect's
  // cleanup-on-hide branch only ever needs to reset the refs the next
  // branch reads — it deliberately does NOT also call setFadingOut(false)
  // here: fadingOut already starts false and is never reused once
  // dismissed, and a same-value setState from a mount effect was found (in
  // PlatformerPage.test.tsx's chest/ending-screen tests) to desync React's
  // act()-driven flush timing for unrelated signal-triggered DOM updates
  // elsewhere on the page — `revealed` is left untouched for the same
  // reason (it's never shown again once dismissed, so there's nothing to
  // reset it for).
  useEffect(() => {
    if (!shouldShow) {
      spawnXRef.current = null;
      triggeredRef.current = false;
      return;
    }
    // playerX is always a number here — it's only null when !shouldShow,
    // and this branch is only reached when shouldShow is true.
    spawnXRef.current = playerX!;

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setRevealed(true));
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  // Watches the player's traveled distance every time playerX changes while
  // showing, independent of the mount-time effect above (which only runs
  // once per shouldShow flip, not on every position tick).
  useEffect(() => {
    if (!shouldShow || playerX === null || spawnXRef.current === null) return;
    if (Math.abs(playerX - spawnXRef.current) >= DISMISS_TRAVEL_DISTANCE_PX) beginFadeOut();
  }, [playerX, shouldShow]);

  // Only flips the permanent latch once the fade has actually finished
  // playing, so the transition is never cut short.
  useEffect(() => {
    if (!fadingOut) return;
    const timer = window.setTimeout(() => {
      controlsOverlayDismissed.value = true;
    }, FADE_OUT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [fadingOut]);

  if (!shouldShow) return null;

  // Three visual states: not yet revealed (invisible, offset left of its
  // resting spot), revealed (baseline translucent, resting spot), fading
  // out (invisible again, offset right of its resting spot) — see the
  // slide-distance constants' doc comment above for why the offsets differ
  // between entrance and exit.
  const translateX = fadingOut ? SLIDE_OUT_DISTANCE_PX : revealed ? 0 : -SLIDE_IN_DISTANCE_PX;
  const opacityClass = fadingOut || !revealed ? 'opacity-0' : 'opacity-80';
  const transitionDurationMs = fadingOut ? FADE_OUT_DURATION_MS : FADE_IN_DURATION_MS;

  return (
    <div
      data-testid="platformer-controls-overlay"
      className={`pointer-events-none fixed inset-x-0 top-[30vh] z-40 flex flex-col items-center gap-2 transition-[opacity,transform] ease-out ${opacityClass}`}
      style={{
        transitionDuration: `${transitionDurationMs}ms`,
        transform: `translateX(${translateX}px)`,
      }}
    >
      <div className="relative w-fit">
        <img
          src="/sprites/controls_overlay_keys.png"
          alt=""
          className="h-20 w-auto drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
          style={{ imageRendering: 'pixelated' }}
        />
        <div
          className="absolute top-full mt-1 w-full text-sm whitespace-nowrap text-white"
          style={{
            fontFamily: `"${RESTART_PROMPT_FONT_FAMILY}", sans-serif`,
            textShadow: '1px 1px 0 rgba(0,0,0,0.8), -1px -1px 0 rgba(0,0,0,0.8), 1px -1px 0 rgba(0,0,0,0.8), -1px 1px 0 rgba(0,0,0,0.8)',
          }}
        >
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${MOVE_LABEL_CENTER_PERCENT}%` }}
          >
            {ui.platformer.controlsOverlay.move}
          </span>
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${JUMP_LABEL_CENTER_PERCENT}%` }}
          >
            {ui.platformer.controlsOverlay.jump}
          </span>
          <span
            className="absolute -translate-x-1/2"
            style={{ left: `${JOURNAL_LABEL_CENTER_PERCENT}%` }}
          >
            {ui.platformer.controlsOverlay.journal}
          </span>
        </div>
      </div>
    </div>
  );
};
