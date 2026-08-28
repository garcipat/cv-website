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
  /** When it flips to `true` while open, starts the reverse-close animation
   * (same as clicking the in-book × button) — lets external triggers (the
   * top-left icon button, the `J` key) close the journal the same graceful
   * way instead of unmounting it instantly. */
  closeRequested: boolean;
}

/**
 * Notebook journal overlay (roadmap step 14). Plays the book-opening sprite
 * sequence on mount, and in reverse on close (before actually calling
 * `onClose`), then overlays the active section's collected facts (Simple
 * List style, FR-017) or a per-section empty-state message on top of the
 * open pages. Bookmark tabs (pulled forward from step 15, per discussion)
 * switch which section is shown. The `personality` ("About Me") section is
 * shown directly from CV data rather than `collectedFacts`, since it has no
 * collectible source until step 22's flagpole lands — a provisional
 * forward-pull per user request. Per-section counters, pagination, and the
 * Reset Game button are step 15's job, not built here.
 *
 * Animation state is just `frame` (1..COUNT) plus whether we're `closing` —
 * "fully open" and "fully closed" are *derived* from those two rather than
 * stored as their own phase, so reaching them needs no direct `setState`
 * call in an effect body (only the `setTimeout` callbacks that advance
 * `frame` call `setState`, which `react-hooks/set-state-in-effect` doesn't
 * flag). `closing` is `closeRequested || closeClicked` — combining the
 * external prop (icon button / `J` key, via `PlatformerPage`) and the
 * in-book × button's own click into one flag means a close from either
 * source, from any frame (even mid-opening), just reverses from wherever
 * `frame` currently is.
 */
export const Journal = ({ onClose, closeRequested }: JournalProps) => {
  useSignals();
  const facts = collectedFacts.value;
  const cv = currentCV.value;
  const sections = nonEmptySections(cv);

  const [frame, setFrame] = useState(1);
  const [closeClicked, setCloseClicked] = useState(false);
  const closing = closeRequested || closeClicked;

  useEffect(() => {
    if (closing) {
      if (frame <= 1) {
        onClose();
        return;
      }
      const id = setTimeout(() => setFrame((prev) => prev - 1), JOURNAL_OPEN_FRAME_INTERVAL_MS);
      return () => clearTimeout(id);
    }
    if (frame < JOURNAL_OPEN_FRAME_COUNT) {
      const id = setTimeout(() => setFrame((prev) => prev + 1), JOURNAL_OPEN_FRAME_INTERVAL_MS);
      return () => clearTimeout(id);
    }
  }, [closing, frame, onClose]);

  const handleClose = () => setCloseClicked(true);

  const defaultSection: SectionId | undefined = facts[0]?.sectionId ?? sections[0];
  const [activeSection, setActiveSection] = useState<SectionId | undefined>(defaultSection);
  const effectiveSection = activeSection ?? defaultSection;

  const contentVisible = frame >= JOURNAL_OPEN_FRAME_COUNT && !closing;
  // Bookmark tabs appear only in the last two frames of the opening
  // animation (and, symmetrically, disappear at the same point on close) —
  // showing them from frame 1 looked wrong hanging off a still-closed cover.
  const bookmarksVisible = frame >= JOURNAL_OPEN_FRAME_COUNT - 1 && !closing;
  const sectionFacts = effectiveSection
    ? facts.filter((fact) => fact.sectionId === effectiveSection)
    : [];

  return (
    <div
      data-testid="platformer-journal"
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
    >
      <div
        className="pointer-events-auto relative w-[min(900px,90vw)] drop-shadow-2xl"
        style={{ aspectRatio: '900 / 439' }}
      >
        <img
          data-testid="journal-book"
          src={journalOpenFrameSrc(frame)}
          alt=""
          className="absolute inset-0 h-full w-full"
          style={{ imageRendering: 'pixelated' }}
        />
        {contentVisible && (
          <>
            <button
              type="button"
              onClick={handleClose}
              data-testid="journal-close-button"
              aria-label="Close journal"
              className="absolute top-[2%] left-[4%] z-10 flex h-6 w-6 items-center justify-center rounded-full bg-gray-800/80 text-sm leading-none text-white"
            >
              ×
            </button>
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
              {effectiveSection === 'personality' ? (
                <div className="font-caveat text-lg text-gray-700">
                  <p className="text-xl font-semibold">{cv.personality.name}</p>
                  <p className="text-gray-500 italic">{cv.personality.tagline}</p>
                  <p className="mt-2 whitespace-pre-line">{cv.personality.summary}</p>
                </div>
              ) : sectionFacts.length === 0 ? (
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
          </>
        )}
        {bookmarksVisible && (
          <BookmarkTabs
            sections={JOURNAL_SECTION_ORDER.filter((s) => sections.includes(s))}
            activeSection={effectiveSection ?? JOURNAL_SECTION_ORDER[0]}
            onSelect={setActiveSection}
          />
        )}
      </div>
    </div>
  );
};
