import { useEffect, useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentCV } from '@/state/locale';
import { collectedFacts, activeJournalSection, resetGameProgress } from '../PlatformerState';
import { formatJournalEntry } from '../entities/JournalEntry';
import {
  JOURNAL_SECTION_ORDER,
  nonEmptySections,
  sectionLabel,
  sectionTotal,
  isPaginatedSection,
} from '../entities/JournalSections';
import { collectiblesSummary } from '../entities/CollectiblesSummary';
import {
  journalOpenFrameSrc,
  JOURNAL_OPEN_FRAME_COUNT,
  JOURNAL_OPEN_FRAME_INTERVAL_MS,
} from '../entities/JournalAnimation';
import { BookmarkTabs } from './BookmarkTabs';
import type { CollectedFact, SectionId } from '../types';

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
 * Reset Game button are step 15's job, not built here. Per-fact display
 * formatting (including step 12's `SkillCategoryFact` — a whole skill
 * category collected as one unit) lives in `formatJournalEntry`
 * (`entities/JournalEntry.ts`), not here — this component stays
 * presentational.
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

  // Which fact is shown within a paginated section (roadmap step 15) — only
  // meaningful for sections `isPaginatedSection` returns true for. Reset to
  // the first page whenever the active section changes, below.
  const [page, setPage] = useState(0);

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
  // Read from the shared signal (not local state) so the selected section
  // survives Journal fully unmounting on close and remounting on reopen —
  // per user request, the choice should be "memorized". Guarded against a
  // persisted section that isn't among the CV's currently non-empty
  // sections (e.g. stale data from a previous CV/locale) — falls back to
  // `defaultSection` instead of pointing at a bookmark that doesn't exist.
  const effectiveSection: SectionId | undefined =
    activeJournalSection.value && sections.includes(activeJournalSection.value)
      ? activeJournalSection.value
      : defaultSection;
  const setActiveSection = (section: SectionId) => {
    activeJournalSection.value = section;
  };

  const contentVisible = frame >= JOURNAL_OPEN_FRAME_COUNT && !closing;
  // Bookmark tabs appear only in the last two frames of the opening
  // animation (and, symmetrically, disappear at the same point on close) —
  // showing them from frame 1 looked wrong hanging off a still-closed cover.
  const bookmarksVisible = frame >= JOURNAL_OPEN_FRAME_COUNT - 1 && !closing;
  const sectionFacts = effectiveSection
    ? facts.filter((fact) => fact.sectionId === effectiveSection)
    : [];
  const sectionCounterTotal =
    effectiveSection && effectiveSection !== 'personality' ? sectionTotal(cv, effectiveSection) : undefined;
  const paginated = effectiveSection ? isPaginatedSection(effectiveSection) : false;
  // Clamped rather than reset via a dedicated effect for every state change
  // that can shrink `sectionFacts` (switching section, Reset Game) — the
  // `effectiveSection` effect below still resets `page` to 0 on section
  // switches so the *first* page is shown, not just a valid one.
  const currentPage = Math.min(page, Math.max(0, sectionFacts.length - 1));

  useEffect(() => {
    setPage(0);
  }, [effectiveSection]);

  const handleResetGame = () => {
    resetGameProgress();
    setPage(0);
  };

  const renderFactRow = (fact: CollectedFact) => {
    const entry = formatJournalEntry(fact);
    return (
      <li key={fact.id} data-testid="journal-fact-item">
        <span>
          {entry.icon} {entry.title}
        </span>
        {entry.subtitle && <span className="ml-6 block text-sm text-gray-500">{entry.subtitle}</span>}
      </li>
    );
  };

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
              className="absolute inset-[6%_10%] flex flex-col text-gray-800"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(transparent, transparent 27px, rgba(90,120,190,0.25) 27px, rgba(90,120,190,0.25) 28px)',
              }}
            >
              {effectiveSection && (
                <h2 className="font-caveat mb-2 flex items-baseline gap-3 text-3xl font-bold">
                  {sectionLabel(effectiveSection)}
                  {sectionCounterTotal !== undefined && (
                    <span
                      data-testid="journal-section-counter"
                      className="text-base font-normal text-gray-400"
                    >
                      {sectionFacts.length} / {sectionCounterTotal}
                    </span>
                  )}
                </h2>
              )}
              {/* The book is drawn as two physical pages with a spine down
                  the middle (see journal_open_9.png). Grouped sections
                  (Skills/Languages) use `columns-2` to flow their compact
                  list across both halves like a real book page; personality
                  and paginated sections (Experience/Projects/etc., roadmap
                  step 15) use the full spread as one canvas instead — a
                  single long entry, or the bio + collectibles summary,
                  doesn't read well split mid-sentence across a column
                  break. */}
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {effectiveSection === 'personality' ? (
                  <div className="grid flex-1 grid-cols-2 gap-[9%]">
                    <div className="font-caveat text-lg text-gray-700">
                      <p className="text-xl font-semibold">{cv.personality.name}</p>
                      <p className="text-gray-500 italic">{cv.personality.tagline}</p>
                      <p className="mt-2 whitespace-pre-line">{cv.personality.summary}</p>
                    </div>
                    <div
                      data-testid="journal-collectibles-summary"
                      className="font-caveat text-lg text-gray-700"
                    >
                      <p className="text-xl font-semibold">Collectibles</p>
                      <ul className="mt-2 space-y-1">
                        {collectiblesSummary(cv, facts).map((row) => (
                          <li key={row.label}>
                            {row.icon} {row.label} {row.collected} / {row.total}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : sectionFacts.length === 0 ? (
                  <p data-testid="journal-empty-state" className="font-caveat text-lg text-gray-500">
                    No facts discovered yet — keep exploring!
                  </p>
                ) : paginated ? (
                  <>
                    <ul className="font-caveat flex-1 space-y-1 text-lg">
                      {renderFactRow(sectionFacts[currentPage])}
                    </ul>
                    <div className="flex items-center justify-center gap-4 pt-2 text-sm text-gray-500">
                      <button
                        type="button"
                        data-testid="journal-page-prev"
                        aria-label="Previous fact"
                        disabled={currentPage === 0}
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        className="rounded px-2 py-1 text-lg disabled:opacity-30"
                      >
                        ‹
                      </button>
                      <span data-testid="journal-page-counter">
                        {currentPage + 1} / {sectionFacts.length}
                      </span>
                      <button
                        type="button"
                        data-testid="journal-page-next"
                        aria-label="Next fact"
                        disabled={currentPage >= sectionFacts.length - 1}
                        onClick={() => setPage((p) => Math.min(sectionFacts.length - 1, p + 1))}
                        className="rounded px-2 py-1 text-lg disabled:opacity-30"
                      >
                        ›
                      </button>
                    </div>
                  </>
                ) : (
                  <ul className="font-caveat columns-2 gap-[9%] space-y-1 text-lg">
                    {sectionFacts.map(renderFactRow)}
                  </ul>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetGame}
              data-testid="journal-reset-button"
              className="absolute right-[4%] bottom-[3%] z-10 rounded bg-red-100/80 px-2 py-1 text-xs text-red-700"
            >
              Reset Game
            </button>
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
