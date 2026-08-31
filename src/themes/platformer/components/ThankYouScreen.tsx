import { useEffect, useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentCV, currentUI } from '@/state/locale';
import { RESTART_PROMPT_FONT_FAMILY } from '../engine/Renderer';

export interface ThankYouScreenProps {
  onDismiss: () => void;
}

/**
 * The Thank You screen (spec.md FR-024) — shown once every chest in the
 * level is opened. Pauses the game (PlatformerPage.tsx transitions
 * `gamePhase` to `'ending-screen'` before mounting this) and reveals
 * Contact, which is otherwise never placed as a collectible or added to the
 * journal (per spec.md FR-013). Dismissed by any key press or click —
 * deliberately non-blocking, per spec, so a visitor who hasn't finished
 * every coin/crate isn't locked out.
 *
 * Solid black background with white text (no card), and a "curtain
 * falling" entrance — the background starts translated fully off-screen
 * upward and slides down into place on mount, like a stage curtain
 * dropping. `revealed` starts `false` so the un-revealed (off-screen)
 * position actually paints first; flipping it to `true` right after lets
 * the `transition-transform` below animate the change. Dismissal stays
 * instant (no reverse "curtain rising" animation) — per spec, dismissing
 * must stay non-blocking and simple.
 *
 * Flipping `revealed` is scheduled via a DOUBLY-nested
 * `requestAnimationFrame`, not a single rAF or `setTimeout(0)` — a
 * same-tick flip never animates, but even a single rAF isn't safe: the
 * callback can still run before the browser's next paint, meaning the
 * first (off-screen) frame is never actually shown and the curtain snaps
 * into place instead of sliding. The first rAF's callback is guaranteed to
 * run before that paint; scheduling the SECOND rAF from inside it
 * guarantees the flip happens only after that first paint has already
 * occurred, which is what the transition needs to have something to
 * animate from.
 *
 * The `contact.website` line is intentionally omitted (email/GitHub/
 * LinkedIn already cover it); LinkedIn and GitHub are real `target="_blank"`
 * links (with the required `rel="noopener noreferrer"`) rather than plain
 * text, since they're URLs meant to be followed — email/phone/location stay
 * plain text. The "press any button to continue" line uses
 * `RESTART_PROMPT_FONT_FAMILY` (the same pixel font, 'ByteBounce', the
 * death-screen restart prompt draws on canvas via `Renderer.ts`'s
 * `drawRestartPrompt`), for stylistic consistency with the rest of the
 * game's on-screen text — that font file is loaded via `document.fonts`
 * (`PlatformerPage.tsx`'s `loadFont` call), so it's just as usable in
 * DOM/CSS text as in canvas text; the inline style's `sans-serif` fallback
 * covers the case where this screen mounts before the font finishes
 * loading. The heading uses the same pixel font too, kept in sync rather
 * than mixing one pixel-font line with one system-font line.
 */
export const ThankYouScreen = ({ onDismiss }: ThankYouScreenProps) => {
  useSignals();
  const cv = currentCV.value;
  const ui = currentUI.value;
  const contact = cv.contact;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setRevealed(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = () => onDismiss();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      data-testid="platformer-thank-you-screen"
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black transition-transform duration-700 ease-in-out ${
        revealed ? 'translate-y-0' : '-translate-y-full'
      }`}
      onClick={onDismiss}
    >
      <div className="font-caveat max-w-md p-8 text-center text-white">
        <p
          className="text-3xl font-semibold"
          style={{ fontFamily: `"${RESTART_PROMPT_FONT_FAMILY}", sans-serif` }}
        >
          {ui.platformer.endingScreen.thankYou}
        </p>
        {contact && (
          <div className="mt-4 space-y-1 text-lg">
            {contact.email && <p>{contact.email}</p>}
            {contact.phone && <p>{contact.phone}</p>}
            {contact.location && <p>{contact.location}</p>}
            {contact.linkedin && (
              <p>
                <a
                  href={contact.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-300"
                >
                  {contact.linkedin}
                </a>
              </p>
            )}
            {contact.github && (
              <p>
                <a
                  href={contact.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-gray-300"
                >
                  {contact.github}
                </a>
              </p>
            )}
          </div>
        )}
        <p
          className="mt-6 text-2xl text-gray-300"
          style={{ fontFamily: `"${RESTART_PROMPT_FONT_FAMILY}", sans-serif` }}
        >
          {ui.platformer.endingScreen.continue}
        </p>
      </div>
    </div>
  );
};
