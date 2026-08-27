import { useSignals } from '@preact/signals-react/runtime';
import { collectedFacts } from '../PlatformerState';
import type { CollectedFact } from '../types';

interface JournalProps {
  onClose: () => void;
}

/**
 * Best-effort single-line label for a fact's underlying CV item — every
 * `CVItemData` variant has a `name` or `title` field except `Experience`
 * (`company`) and `Personality` (also `name`, already covered).
 */
const factItemLabel = (fact: CollectedFact): string => {
  const data = fact.data as Record<string, unknown>;
  if (typeof data.name === 'string') return data.name;
  if (typeof data.title === 'string') return data.title;
  if (typeof data.company === 'string') return data.company;
  return fact.sectionLabel;
};

/**
 * Unstyled journal skeleton (roadmap step 13) — a fullscreen overlay listing
 * collected facts, no notebook/bookmark/pagination styling yet (step 14/15).
 */
export const Journal = ({ onClose }: JournalProps) => {
  useSignals();
  const facts = collectedFacts.value;

  return (
    <div
      data-testid="platformer-journal"
      className="fixed inset-0 z-[60] flex flex-col items-center gap-4 overflow-y-auto bg-black/90 p-8 text-white"
    >
      <button
        type="button"
        onClick={onClose}
        data-testid="journal-close-button"
        className="fixed top-4 right-4 rounded bg-gray-700 px-3 py-1 text-sm"
      >
        Close
      </button>
      <h2 className="text-2xl font-bold">Journal</h2>
      {facts.length === 0 ? (
        <p data-testid="journal-empty-state">No facts collected yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {facts.map((fact) => (
            <li key={fact.id} data-testid="journal-fact-item">
              {fact.sectionLabel}: {factItemLabel(fact)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
