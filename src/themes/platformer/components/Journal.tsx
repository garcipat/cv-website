import { useEffect, useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentCV } from '@/state/locale';
import { collectedFacts } from '../PlatformerState';
import { formatJournalEntry } from '../entities/JournalEntry';
import { JOURNAL_SECTION_ORDER, nonEmptySections, sectionLabel } from '../entities/JournalSections';
import {
  journalOpenFrameSrc,
  JOURNAL_OPEN_FRAME_COUNT,
  JOURNAL_OPEN_FRAME_INTERVAL_MS,
} from '../entities/JournalAnimation';
import { BookmarkTabs } from './BookmarkTabs';
import type { SectionId } from '../types';

interface JournalProps {
  onClose: () => void;
}

/**
 * Notebook journal overlay (roadmap step 14). Plays the book-opening sprite
 * sequence once on mount, then overlays the active section's collected
 * facts (Simple List style, FR-017) or a per-section empty-state message on
 * top of the open pages. Bookmark tabs (pulled forward from step 15, per
 * discussion) switch which section is shown. Per-section counters,
 * pagination, and the Reset Game button are step 15's job, not built here.
 */
export const Journal = ({ onClose }: JournalProps) => {
  useSignals();
  const facts = collectedFacts.value;
  const sections = nonEmptySections(currentCV.value);

  const [frame, setFrame] = useState(1);
  useEffect(() => {
    if (frame >= JOURNAL_OPEN_FRAME_COUNT) return;
    const id = setInterval(() => {
      setFrame((prev) => Math.min(prev + 1, JOURNAL_OPEN_FRAME_COUNT));
    }, JOURNAL_OPEN_FRAME_INTERVAL_MS);
    return () => clearInterval(id);
  }, [frame]);

  const defaultSection: SectionId | undefined = facts[0]?.sectionId ?? sections[0];
  const [activeSection, setActiveSection] = useState<SectionId | undefined>(defaultSection);
  const effectiveSection = activeSection ?? defaultSection;

  const animationDone = frame >= JOURNAL_OPEN_FRAME_COUNT;
  const sectionFacts = effectiveSection
    ? facts.filter((fact) => fact.sectionId === effectiveSection)
    : [];

  return (
    <div
      data-testid="platformer-journal"
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
    >
      <div className="pointer-events-auto flex items-stretch drop-shadow-2xl">
        <div className="relative w-[min(900px,90vw)]" style={{ aspectRatio: '900 / 439' }}>
          <img
            data-testid="journal-book"
            src={journalOpenFrameSrc(frame)}
            alt=""
            className="absolute inset-0 h-full w-full"
            style={{ imageRendering: 'pixelated' }}
          />
          {animationDone && (
            <div
              className="absolute inset-[6%_10%] overflow-y-auto text-gray-800"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(transparent, transparent 27px, rgba(90,120,190,0.25) 27px, rgba(90,120,190,0.25) 28px)',
              }}
            >
              {effectiveSection && (
                <h2 className="font-caveat mb-2 text-3xl font-bold">{sectionLabel(effectiveSection)}</h2>
              )}
              {sectionFacts.length === 0 ? (
                <p data-testid="journal-empty-state" className="font-caveat text-lg text-gray-500">
                  No facts collected yet.
                </p>
              ) : (
                <ul className="font-caveat flex flex-col gap-1 text-lg">
                  {sectionFacts.map((fact) => {
                    const entry = formatJournalEntry(fact);
                    return (
                      <li key={fact.id} data-testid="journal-fact-item">
                        <span>
                          {entry.icon} {entry.title}
                        </span>
                        {entry.subtitle && (
                          <span className="ml-6 block text-sm text-gray-500">{entry.subtitle}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
        <BookmarkTabs
          sections={JOURNAL_SECTION_ORDER.filter((s) => sections.includes(s))}
          activeSection={effectiveSection ?? JOURNAL_SECTION_ORDER[0]}
          onSelect={setActiveSection}
        />
      </div>
      <button
        type="button"
        onClick={onClose}
        data-testid="journal-close-button"
        className="pointer-events-auto fixed top-4 right-4 rounded bg-gray-700 px-3 py-1 text-sm text-white"
      >
        Close
      </button>
    </div>
  );
};
