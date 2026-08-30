import { useEffect } from 'react';
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
 */
export const ThankYouScreen = ({ onDismiss }: ThankYouScreenProps) => {
  useSignals();
  const cv = currentCV.value;
  const ui = currentUI.value;
  const contact = cv.contact;

  useEffect(() => {
    const handleKeyDown = () => onDismiss();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      data-testid="platformer-thank-you-screen"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80"
      onClick={onDismiss}
    >
      <div className="font-caveat max-w-md rounded-lg bg-white/95 p-8 text-center text-gray-800 shadow-2xl">
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
        <p className="mt-6 text-sm text-gray-500">{ui.platformer.endingScreen.continue}</p>
      </div>
    </div>
  );
};
