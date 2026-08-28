import { useEffect, useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentCV, currentUI } from '@/state/locale';
import { collectedFacts, activeJournalSection } from '../PlatformerState';
import { formatJournalEntry } from '../entities/JournalEntry';
import {
  JOURNAL_SECTION_ORDER,
  nonEmptySections,
  sectionLabel,
  sectionTotal,
  isPaginatedSection,
} from '../entities/JournalSections';
import { collectiblesSummary } from '../entities/CollectiblesSummary';
import { COIN_FRAME_SIZE, COIN_FRAME_COUNT } from '../entities/Coin';
import { FRUIT_FRAME_SIZE } from '../entities/Fruit';
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
  /** Called when the Reset Game button is clicked. Everything it does
   * (clearing collected progress, closing the journal immediately with no
   * animation, and starting the iris-in "starting again" transition) lives
   * in `PlatformerPage.tsx`'s `handleResetGameRequested` — this component
   * only forwards the click. */
  onResetGame: () => void;
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
export const Journal = ({ onClose, closeRequested, onResetGame }: JournalProps) => {
  useSignals();
  const facts = collectedFacts.value;
  const cv = currentCV.value;
  const ui = currentUI.value;
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
  // section-change check below still resets `page` to 0 on section switches
  // so the *first* page is shown, not just a valid one.
  const currentPage = Math.min(page, Math.max(0, sectionFacts.length - 1));

  // Reset `page` to 0 when `effectiveSection` changes, using React's
  // "adjust state during render" pattern (comparing against a mirrored
  // `prevSection` state) rather than a `useEffect` — calling `setState`
  // synchronously inside an effect body is flagged by
  // `react-hooks/set-state-in-effect` and, here, is also what a prior
  // debugging pass identified as adding an extra render/commit cycle that
  // interacted badly with `@preact/signals-react`'s external-store-driven
  // re-renders (see Journal.test.tsx's Reset Game section). Doing the
  // adjustment during render instead avoids that entirely.
  const [prevSection, setPrevSection] = useState(effectiveSection);
  if (effectiveSection !== prevSection) {
    setPrevSection(effectiveSection);
    setPage(0);
  }

  // Resetting is entirely the parent's job — clearing progress, closing the
  // journal immediately (no reverse-close animation, per user request), and
  // starting the iris-in restart transition all live in
  // PlatformerPage.tsx's handleResetGameRequested. This component just
  // forwards the click.
  const handleResetGame = () => onResetGame();

  // Renders the same coin.png/fruit.png sprites used in the level/HUD (not
  // emoji) for the personality page's collectibles summary, per user
  // feedback — cropped to each sheet's first frame (matching the HUD
  // counter's static icon, drawCollectibleCounter's `coinFrameSource(0)`/
  // `fruitFrameSource(0)` in Renderer.ts/PlatformerPage.tsx) at a small
  // fixed display size, scaling the whole sheet's `background-size` up so
  // that one frame lands exactly on the crop.
  const COLLECTIBLE_ICON_DISPLAY_SIZE = 32;
  // coin.png is a 1-row strip (COIN_FRAME_COUNT columns); fruit.png is a 4x4
  // grid — both sheets' width/height-in-frames must be scaled independently
  // or frame 0's crop distorts (e.g. fruit.png's 4 rows squashed into 1).
  const renderCollectibleIcon = (labelKey: 'coins' | 'fruits') => {
    const sheetSrc = labelKey === 'coins' ? '/sprites/coin.png' : '/sprites/fruit.png';
    const frameSize = labelKey === 'coins' ? COIN_FRAME_SIZE : FRUIT_FRAME_SIZE;
    const sheetCols = labelKey === 'coins' ? COIN_FRAME_COUNT : 4;
    const sheetRows = labelKey === 'coins' ? 1 : 4;
    const scale = COLLECTIBLE_ICON_DISPLAY_SIZE / frameSize;
    return (
      <span
        aria-hidden="true"
        className="mr-1 inline-block align-middle"
        style={{
          width: COLLECTIBLE_ICON_DISPLAY_SIZE,
          height: COLLECTIBLE_ICON_DISPLAY_SIZE,
          backgroundImage: `url(${sheetSrc})`,
          backgroundPosition: '0 0',
          backgroundSize: `${sheetCols * frameSize * scale}px ${sheetRows * frameSize * scale}px`,
          imageRendering: 'pixelated',
        }}
      />
    );
  };

  const renderFactRow = (fact: CollectedFact) => {
    const entry = formatJournalEntry(fact);
    return (
      <li key={fact.id} data-testid="journal-fact-item">
        <span className="break-inside-avoid-column">
          {entry.icon} {entry.title}
        </span>
        {entry.ratedItems ? (
          // One flex row per skill, name and stars pinned to opposite
          // edges — plain joined text left the stars ragged against
          // variable-length names (Caveat is not monospace), per user
          // feedback. No `break-inside-avoid` on the outer `<li>` — a long
          // category's skill list is exactly what should flow across the
          // book's column break (per user feedback); only each individual
          // skill row avoids splitting mid-row.
          <ul className="ml-6">
            {entry.ratedItems.map((item) => (
              <li
                key={item.name}
                className="flex justify-between gap-2 break-inside-avoid-column text-xs text-gray-500"
              >
                <span>{item.name}</span>
                <span>{item.stars}</span>
              </li>
            ))}
          </ul>
        ) : (
          entry.subtitle && (
            <span className="ml-6 block text-xs whitespace-pre-line text-gray-500">{entry.subtitle}</span>
          )
        )}
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
                <h2 className="font-caveat mb-2 flex items-baseline gap-3 text-2xl font-bold">
                  {sectionLabel(effectiveSection)}
                  {sectionCounterTotal !== undefined && (
                    <span
                      data-testid="journal-section-counter"
                      className="text-sm font-normal text-gray-400"
                    >
                      {sectionFacts.length} / {sectionCounterTotal}
                    </span>
                  )}
                </h2>
              )}
              {/* The book is drawn as two physical pages with a spine down
                  the middle (see journal_open_9.png). Every list-shaped
                  section (Languages, and every paginated section's single
                  visible entry) flows via `columns-2` + `column-fill: auto`
                  — short content stays entirely on the left page; long
                  content (a big skill category, a long Experience entry)
                  spills onto the right page instead of needing an internal
                  scrollbar, per user feedback. `overflow-y-auto` stays as a
                  last-resort fallback for content too long even for both
                  pages. Personality is the one exception (a fixed
                  bio-left/summary-right split via CSS grid, not flowing
                  columns — the two halves are different content, not one
                  list). The pager (when `paginated`) is a sibling BELOW this
                  scrollable area, not inside it, so it stays visible
                  regardless of how much the content above scrolls — it was
                  previously inside the scrollable region and could end up
                  scrolled out of view for a long entry. */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {effectiveSection === 'personality' ? (
                  <div className="grid h-full grid-cols-2 gap-[9%]">
                    <div className="font-caveat text-gray-700">
                      <p className="text-lg font-semibold">{cv.personality.name}</p>
                      <p className="text-sm text-gray-500 italic">{cv.personality.tagline}</p>
                      <p className="mt-2 text-base leading-snug whitespace-pre-line">{cv.personality.summary}</p>
                    </div>
                    <div
                      data-testid="journal-collectibles-summary"
                      className="font-caveat text-lg text-gray-700"
                    >
                      <p className="text-xl font-semibold">{ui.platformer.journal.collectibles}</p>
                      <ul className="mt-2 space-y-1.5">
                        {collectiblesSummary(cv, facts).map((row) => (
                          <li key={row.labelKey} className="flex items-center">
                            {renderCollectibleIcon(row.labelKey)}
                            {ui.platformer.journal[row.labelKey]} {row.collected} / {row.total}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : sectionFacts.length === 0 ? (
                  <p data-testid="journal-empty-state" className="font-caveat text-sm text-gray-500">
                    {ui.platformer.journal.emptyState}
                  </p>
                ) : paginated ? (
                  <ul
                    className="font-caveat h-full columns-2 gap-[9%] space-y-1 text-sm"
                    style={{ columnFill: 'auto' }}
                  >
                    {renderFactRow(sectionFacts[currentPage])}
                  </ul>
                ) : (
                  <ul className="font-caveat columns-2 gap-[9%] space-y-1 text-sm">
                    {sectionFacts.map(renderFactRow)}
                  </ul>
                )}
              </div>
              {paginated && sectionFacts.length > 0 && (
                <div className="flex items-center justify-center gap-4 pt-2 text-xs text-gray-500">
                  <button
                    type="button"
                    data-testid="journal-page-prev"
                    aria-label="Previous fact"
                    disabled={currentPage === 0}
                    onClick={() => setPage(Math.max(0, currentPage - 1))}
                    className="rounded px-2 py-1 text-base disabled:opacity-30"
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
                    onClick={() => setPage(Math.min(sectionFacts.length - 1, currentPage + 1))}
                    className="rounded px-2 py-1 text-base disabled:opacity-30"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleResetGame}
              data-testid="journal-reset-button"
              className="absolute right-[4%] bottom-[3%] z-10 rounded bg-red-100/80 px-2 py-1 text-xs text-red-700"
            >
              {ui.platformer.journal.resetGame}
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
