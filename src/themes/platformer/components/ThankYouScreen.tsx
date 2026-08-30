import { useEffect, useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentCV, currentUI } from '@/state/locale';

export interface ThankYouScreenProps {
  onDismiss: () => void;
}

/**
 * The Thank You screen (spec.md FR-024, roadmap step 22) — shown once every
 * chest in the level is opened. Pauses the game (PlatformerPage.tsx
 * transitions `gamePhase` to `'ending-screen'` before mounting this) and
 * reveals Contact, which is otherwise never placed as a collectible or added
 * to the journal (spec.md FR-013's 2026-08-30 amendment). Dismissed by any
 * key press or click — deliberately non-blocking, per spec, so a visitor who
 * hasn't finished every coin/crate isn't locked out.
 *
 * **Redesigned 2026-08-30** (live user feedback): solid black background with
 * white text (no card), and a "curtain falling" entrance — the background
 * starts translated fully off-screen upward and slides down into place on
 * mount, like a stage curtain dropping. `revealed` starts `false` so the
 * un-revealed (off-screen) position actually paints first; a `setTimeout`
 * (not a same-tick state flip, which wouldn't animate) flips it to `true`
 * right after, letting the `transition-transform` below animate the change.
 * Dismissal stays instant (no reverse "curtain rising" animation) — per
 * spec, dismissing must stay non-blocking and simple.
 */
export const ThankYouScreen = ({ onDismiss }: ThankYouScreenProps) => {
  useSignals();
  const cv = currentCV.value;
  const ui = currentUI.value;
  const contact = cv.contact;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), 0);
    return () => clearTimeout(id);
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
        <p className="text-3xl font-semibold">{ui.platformer.endingScreen.thankYou}</p>
        {contact && (
          <div className="mt-4 space-y-1 text-lg">
            {contact.email && <p>{contact.email}</p>}
            {contact.phone && <p>{contact.phone}</p>}
            {contact.location && <p>{contact.location}</p>}
            {contact.website && <p>{contact.website}</p>}
            {contact.linkedin && <p>{contact.linkedin}</p>}
            {contact.github && <p>{contact.github}</p>}
          </div>
        )}
        <p className="mt-6 text-sm text-gray-300">{ui.platformer.endingScreen.continue}</p>
      </div>
    </div>
  );
};
