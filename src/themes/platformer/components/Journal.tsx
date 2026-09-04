import { useEffect, useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { currentCV, currentUI } from '@/state/locale';
import {
  collectedFacts,
  activeJournalSection,
  allCollectiblePlacements,
  collectedCollectibleIds,
  levelTotals,
} from '../PlatformerState';
import { formatJournalEntry } from '../entities/JournalEntry';
import {
  JOURNAL_SECTION_ORDER,
  nonEmptySections,
  sectionLabel,
  sectionTotal,
  buildJournalPages,
} from '../entities/JournalSections';
import { collectiblesSummary } from '../entities/CollectiblesSummary';
import { COIN_FRAME_SIZE, COIN_FRAME_COUNT } from '../entities/Coin';
import { FRUIT_FRAME_SIZE } from '../entities/Fruit';
import { SLIME_GREEN_SHEET } from '../entities/sprites/sheets';
import { frameSource } from '../entities/sprites/SpriteSheet';
import { blockFrameSource, BLOCK_FRAME_SIZE } from '../entities/Block';
import {
  journalOpenFrameSrc,
  journalOpenFrameWidthPercent,
  journalOpenFrameCenteringShiftPercent,
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
 * Notebook journal overlay. Plays the book-opening sprite
 * sequence on mount, and in reverse on close (before actually calling
 * `onClose`), then overlays the active section's collected facts (Simple
 * List style, FR-017) or a per-section empty-state message on top of the
 * open pages. Bookmark tabs switch which section is shown. The
 * `personality` ("About Me") section is shown directly from CV data rather
 * than `collectedFacts`, since it has no collectible source of its own.
 * Per-fact display formatting (including `SkillCategoryFact` — a whole
 * skill category collected as one unit) lives in `formatJournalEntry`
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

  // Drives the hover-reveal page-flip arrows' opacity (see the render
  // below for why this is plain state + inline style rather than a
  // Tailwind `hover:` class).
  const [prevHovered, setPrevHovered] = useState(false);
  const [nextHovered, setNextHovered] = useState(false);

  // The book as one continuous sequence of physical pages, per user
  // framing: sections insert pages into it — Skills one per category,
  // Experience one per collected item, Languages a single page listing all
  // of them, Personality a single page. `buildJournalPages` resolves each
  // page's actual content up front (a discriminated union — see
  // `JournalPageContent`) so this component just switches on
  // `content.kind` below instead of re-deriving "which fact / is this
  // empty / is this personality" from a section+index every render.
  // Recomputed each render but cheap (a few dozen pages at most) and
  // stable for the component's lifetime — `facts`/`cv` can't change while
  // the journal is open (the game is paused, so no new collections land).
  const flatPages = buildJournalPages(sections, facts);

  // Defaults to 'personality' ("About Me") rather than falling back to the
  // first collected fact's section — that fallback would mean the journal
  // rarely opens on its own first page (e.g. 'skills' after picking up any
  // coin). 'personality' is always present (CVData.personality is a
  // required field — see nonEmptySections's comment), so this fallback
  // never needs `sections[0]` as a further backup.
  const initialSection: SectionId | undefined =
    activeJournalSection.value && sections.includes(activeJournalSection.value)
      ? activeJournalSection.value
      : 'personality';

  // Position within `flatPages` — a plain index, not a per-section page
  // number, since Prev/Next walk the whole book regardless of section
  // boundaries. Lazy initializer runs once at mount, landing on the
  // remembered/default section's first page (find the first flatPages
  // entry for that section).
  const [flatIndex, setFlatIndex] = useState(() => {
    const idx = flatPages.findIndex((p) => p.section === initialSection);
    return idx >= 0 ? idx : 0;
  });

  // Moves to an arbitrary page index and keeps `activeJournalSection` (the
  // persisted-across-reopen signal, also what highlights the active
  // bookmark) in sync with wherever paging actually lands — so paging past
  // a section boundary updates the highlighted bookmark too, not just the
  // content.
  const goToPage = (index: number) => {
    setFlatIndex(index);
    const section = flatPages[index]?.section;
    if (section) activeJournalSection.value = section;
  };
  const handlePrevPage = () => {
    if (flatPages.length === 0) return;
    goToPage((flatIndex - 1 + flatPages.length) % flatPages.length);
  };
  const handleNextPage = () => {
    if (flatPages.length === 0) return;
    goToPage((flatIndex + 1) % flatPages.length);
  };

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

  // Read from `flatPages`/`flatIndex` (see above) rather than re-deriving a
  // "default section" here — the current page's own section is always the
  // source of truth for which bookmark is active and what the header shows.
  const currentPageEntry = flatPages[flatIndex];
  const effectiveSection: SectionId | undefined = currentPageEntry?.section;
  const setActiveSection = (section: SectionId) => {
    const idx = flatPages.findIndex((p) => p.section === section);
    if (idx >= 0) goToPage(idx);
  };

  const contentVisible = frame >= JOURNAL_OPEN_FRAME_COUNT && !closing;
  // Bookmark tabs appear only in the last two frames of the opening
  // animation (and, symmetrically, disappear at the same point on close) —
  // showing them from frame 1 looked wrong hanging off a still-closed cover.
  const bookmarksVisible = frame >= JOURNAL_OPEN_FRAME_COUNT - 1 && !closing;
  // Section-level aggregate for the header counter (e.g. "Experience 3/5")
  // — independent of which single page is currently showing.
  const sectionFactCount = effectiveSection
    ? facts.filter((fact) => fact.sectionId === effectiveSection).length
    : 0;
  const sectionCounterTotal =
    effectiveSection && effectiveSection !== 'personality' ? sectionTotal(cv, effectiveSection) : undefined;

  // Resetting is entirely the parent's job — clearing progress, closing the
  // journal immediately (no reverse-close animation, per user request), and
  // starting the iris-in restart transition all live in
  // PlatformerPage.tsx's handleResetGameRequested. This component just
  // forwards the click.
  const handleResetGame = () => onResetGame();

  // Renders the same coin.png/fruit.png sprites used in the level/HUD (not
  // emoji) for the personality page's collectibles summary, per user
  // feedback — cropped to each sheet's first frame (matching the HUD
  // counter's static icon, `coinFrameSource(0)`/`fruitFrameSource(0)` in
  // PlatformerPage.tsx, passed into Renderer.ts's drawCollectibleCounter as
  // its `iconFrame`) at a small fixed display size, scaling the whole
  // sheet's `background-size` up so that one frame lands exactly on the crop.
  const COLLECTIBLE_ICON_DISPLAY_SIZE = 32;
  // Crates are drawn from world_tileset.png's edge-to-edge terrain art (no
  // transparent padding the way coin.png/fruit.png's centered icons have),
  // which reads as noticeably bigger than the other icons at the same
  // display size — shown smaller to compensate; the same adjustment applies
  // to the HUD counter (PlatformerPage.tsx's CRATE_COUNTER_ICON_SIZE).
  const CRATE_ICON_DISPLAY_SIZE = 22;
  // coin.png is a 1-row strip (COIN_FRAME_COUNT columns); fruit.png and
  // slime_green.png are both 4-column grids (4x4 and 4x3 respectively);
  // world_tileset.png is a 16x16 grid of 16px tiles — every sheet's
  // width/height-in-frames must be scaled independently or frame 0's crop
  // distorts (e.g. fruit.png's 4 rows squashed into 1). The 'enemies' row
  // reuses the same raw sheet frame 3 (row 0, col 2) as the HUD's own
  // enemy-defeated counter (see PlatformerPage.tsx), so both places show
  // the same icon for "enemy". 'crates' reuses the same crate tile
  // coordinates as `blockFrameSource('crate')`. 'chests' renders a
  // standalone image (chest_closed.png, 28×20, not a frame in a sprite
  // sheet) via an early return, avoiding the sheet-cropping logic used for
  // the others.
  const renderCollectibleIcon = (labelKey: 'coins' | 'fruits' | 'enemies' | 'crates' | 'chests') => {
    if (labelKey === 'chests') {
      return (
        <img
          src="/sprites/chest_closed.png"
          alt=""
          className="mr-2 inline-block h-5 w-auto"
          style={{ imageRendering: 'pixelated' }}
        />
      );
    }
    const sheetSrc =
      labelKey === 'coins'
        ? '/sprites/coin.png'
        : labelKey === 'fruits'
          ? '/sprites/fruit.png'
          : labelKey === 'crates'
            ? '/sprites/world_tileset.png'
            : '/sprites/slime_green.png';
    const frameSize =
      labelKey === 'coins'
        ? COIN_FRAME_SIZE
        : labelKey === 'fruits'
          ? FRUIT_FRAME_SIZE
          : labelKey === 'crates'
            ? BLOCK_FRAME_SIZE
            : SLIME_GREEN_SHEET.frameWidth;
    const sheetCols = labelKey === 'coins' ? COIN_FRAME_COUNT : labelKey === 'crates' ? 16 : 4;
    const sheetRows = labelKey === 'coins' ? 1 : labelKey === 'fruits' ? 4 : labelKey === 'crates' ? 16 : 3;
    const displaySize = labelKey === 'crates' ? CRATE_ICON_DISPLAY_SIZE : COLLECTIBLE_ICON_DISPLAY_SIZE;
    const scale = displaySize / frameSize;
    const { sx, sy } =
      labelKey === 'enemies'
        ? frameSource(SLIME_GREEN_SHEET, 2)
        : labelKey === 'crates'
          ? blockFrameSource('crate')
          : { sx: 0, sy: 0 };
    return (
      <span
        aria-hidden="true"
        className="mr-1 inline-flex items-center justify-center align-middle"
        style={{
          width: COLLECTIBLE_ICON_DISPLAY_SIZE,
          height: COLLECTIBLE_ICON_DISPLAY_SIZE,
        }}
      >
        <span
          style={{
            width: displaySize,
            height: displaySize,
            display: 'block',
            backgroundImage: `url(${sheetSrc})`,
            backgroundPosition: `-${sx * scale}px -${sy * scale}px`,
            backgroundSize: `${sheetCols * frameSize * scale}px ${sheetRows * frameSize * scale}px`,
            imageRendering: 'pixelated',
            // A slime's sprite frames (entities/sprites/sheets.ts) are
            // bottom-anchored within their native cell (no transparent padding below the feet, so any
            // empty space sits above instead) — unlike coin.png/fruit.png's
            // centered artwork, this reads as sitting too low next to the
            // row's text once cropped into a fixed-size icon box. Nudged up
            // to match; same fix as the HUD counter's `iconYOffset`
            // (PlatformerPage.tsx).
            transform: labelKey === 'enemies' ? 'translateY(-6px)' : undefined,
          }}
        />
      </span>
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
        style={{
          aspectRatio: '900 / 439',
          // The book image anchors to this container's right edge (see
          // below) so its hinge stays fixed once fully open — but every
          // earlier, narrower frame then sits scrunched against the right
          // edge with empty space to its left, reading as the book sliding
          // in from the right rather than opening in place.
          // journalOpenFrameCenteringShiftPercent counteracts that per
          // frame — centering that frame's (content-free) book icon on
          // screen — and resolves to exactly 0 at the final frame, so the
          // one frame that carries real page content (laid out via fixed
          // inset-% positions assuming this container sits centered) is
          // never displaced.
          transform: `translateX(${journalOpenFrameCenteringShiftPercent(frame)}%)`,
          transition: `transform ${JOURNAL_OPEN_FRAME_INTERVAL_MS}ms linear`,
        }}
      >
        <img
          data-testid="journal-book"
          src={journalOpenFrameSrc(frame)}
          alt=""
          className="absolute right-0 bottom-0 h-full"
          style={{
            width: `${journalOpenFrameWidthPercent(frame)}%`,
            transition: `width ${JOURNAL_OPEN_FRAME_INTERVAL_MS}ms linear`,
            imageRendering: 'pixelated',
          }}
        />
        {contentVisible && (
          <>
            <button
              type="button"
              onClick={handleClose}
              data-testid="journal-close-button"
              aria-label="Close journal"
              className="absolute top-[2%] left-[4%] z-20 h-8 w-auto"
            >
              <img
                src="/sprites/journal-close.png"
                alt=""
                className="h-full w-auto object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
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
                      {sectionFactCount} / {sectionCounterTotal}
                    </span>
                  )}
                </h2>
              )}
              {/* The book is drawn as two physical pages with a spine down
                  the middle (see journal_open_9.png). Every list-shaped page
                  (a groupedList, or a paginated section's single visible
                  fact) flows via `columns-2` + `column-fill: auto` — short
                  content stays entirely on the left page; long content (a
                  big skill category, a long Experience entry) spills onto
                  the right page instead of needing an internal scrollbar,
                  per user feedback. `overflow-y-auto` stays as a
                  last-resort fallback for content too long even for both
                  pages. Personality is the one exception (a fixed
                  bio-left/summary-right split via CSS grid, not flowing
                  columns — the two halves are different content, not one
                  list). */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {!currentPageEntry ? null : currentPageEntry.content.kind === 'personality' ? (
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
                        {collectiblesSummary(facts, {
                          ...levelTotals.value,
                          // Explicit override, not derived from `facts` — under
                          // proportional fact pacing a coin carries no fixed
                          // fact of its own (see CollectibleMapper.ts's
                          // mapCVDataToSkillFactPool doc comment), so "skill
                          // facts revealed" and "coins collected" are different
                          // numbers. This counts actual collected coin
                          // placements, the same quantity the in-game HUD popup
                          // shows, so the two never disagree.
                          coinsCollected: allCollectiblePlacements.value.filter(
                            (p) => p.spriteType === 'coin' && collectedCollectibleIds.value.has(p.id),
                          ).length,
                        }).map((row) => (
                          <li key={row.labelKey} className="flex items-center">
                            {renderCollectibleIcon(row.labelKey)}
                            {ui.platformer.journal[row.labelKey]} {row.collected} / {row.total}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : currentPageEntry.content.kind === 'emptyState' ? (
                  <p data-testid="journal-empty-state" className="font-caveat text-sm text-gray-500">
                    {ui.platformer.journal.emptyState}
                  </p>
                ) : currentPageEntry.content.kind === 'fact' ? (
                  <ul
                    className="font-caveat h-full columns-2 gap-[9%] space-y-1 text-sm"
                    style={{ columnFill: 'auto' }}
                  >
                    {renderFactRow(currentPageEntry.content.fact)}
                  </ul>
                ) : (
                  <ul className="font-caveat columns-2 gap-[9%] space-y-1 text-sm">
                    {currentPageEntry.content.facts.map(renderFactRow)}
                  </ul>
                )}
              </div>
            </div>
            {flatPages.length > 1 && (
              <>
                {/* Hover-reveal page-flip arrows spanning each physical
                    half of the book (split at the spine), per user
                    request — hovering anywhere on the left page reveals
                    the left arrow, anywhere on the right page reveals the
                    right, not just a thin strip near the outer edge. Real
                    controls that happen to sit inside a half (the close
                    button, Reset Game, the bookmark tabs) are all bumped
                    to z-20 (these zones are z-10) so they stay
                    independently hoverable/clickable rather than being
                    shadowed by the full-half zone underneath them.
                    Opacity is toggled via inline style + onMouseEnter/Leave,
                    NOT a Tailwind `hover:opacity-*` class: that class
                    reliably failed to generate any CSS at all in this build
                    (verified: `opacity-90` never appeared in the compiled
                    stylesheet even after a full dev-server restart, despite
                    `hover:` working fine elsewhere in the codebase) — root
                    cause not found, so this routes around it entirely with
                    plain React state instead of fighting the build. No
                    disabled state and no visible page count: Prev/Next now
                    walk the whole book (every section's pages flattened,
                    see `buildJournalPages`) and wrap around at both ends, so
                    there's no "first"/"last" page to disable against. */}
                <button
                  type="button"
                  onClick={handlePrevPage}
                  onMouseEnter={() => setPrevHovered(true)}
                  onMouseLeave={() => setPrevHovered(false)}
                  data-testid="journal-page-prev"
                  aria-label="Previous page"
                  className="absolute inset-y-0 left-0 z-10 flex w-1/2 items-center justify-start pl-[2%]"
                >
                  <img
                    src="/sprites/journal-chevron-left.png"
                    alt=""
                    className="h-10 w-auto object-contain transition-opacity duration-150"
                    style={{ imageRendering: 'pixelated', opacity: prevHovered ? 0.9 : 0 }}
                  />
                </button>
                <button
                  type="button"
                  onClick={handleNextPage}
                  onMouseEnter={() => setNextHovered(true)}
                  onMouseLeave={() => setNextHovered(false)}
                  data-testid="journal-page-next"
                  aria-label="Next page"
                  className="absolute inset-y-0 right-0 z-10 flex w-1/2 items-center justify-end pr-[2%]"
                >
                  <img
                    src="/sprites/journal-chevron-right.png"
                    alt=""
                    className="h-10 w-auto object-contain transition-opacity duration-150"
                    style={{ imageRendering: 'pixelated', opacity: nextHovered ? 0.9 : 0 }}
                  />
                </button>
              </>
            )}
            {/* Sits at the bottom of the right page itself (inside the
                content inset, like a wax seal stamped on the page) rather
                than out in the book's outer corner — per user feedback,
                the corner placement read as disconnected/hidden. Sized/
                positioned up from an earlier too-big/too-far-left/
                too-far-down pass, also per user feedback — and its vertical
                span no longer overlaps the Next chevron's hover zone above
                (that overlap was why the arrow felt like it appeared
                "randomly": hovering near Reset was also hovering the
                chevron's invisible strip). */}
            <button
              type="button"
              onClick={handleResetGame}
              data-testid="journal-reset-button"
              aria-label={ui.platformer.journal.resetGame}
              className="absolute right-[6%] bottom-[10%] z-20 h-8 w-auto"
            >
              <img
                src="/sprites/journal-reset.png"
                alt=""
                className="h-full w-auto object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
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
