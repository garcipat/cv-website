import { useSignals } from '@preact/signals-react/runtime';
import { cn } from '@/lib/utils';
import { SECTION_BOOKMARK_COLOR, sectionLabel, type BookmarkColor } from '../entities/JournalSections';
import { SECTION_ICON } from '../entities/JournalEntry';
import type { SectionId } from '../types';

interface BookmarkTabsProps {
  sections: SectionId[];
  activeSection: SectionId;
  onSelect: (section: SectionId) => void;
}

const BOOKMARK_SPRITE: Record<BookmarkColor, string> = {
  blue: '/sprites/bookmark_blue.png',
  green: '/sprites/bookmark_green.png',
  orange: '/sprites/bookmark_orange.png',
  purple: '/sprites/bookmark_purple.png',
  red: '/sprites/bookmark_red.png',
  yellow: '/sprites/bookmark_yellow.png',
};

/**
 * Colored bookmark tabs hanging from the journal's top edge, on the right
 * side of the book — one per non-empty CV section (per FR-013/FR-016).
 * Originally along the right edge (vertically), then spread across the
 * whole top edge; narrowed to just the top-right per user feedback. The
 * `bookmark_*.png` sprites are cropped from the top (`bg-bottom` keeps the
 * bottom — the ribbon's pointed tip — visible, cropping the plain
 * attachment part off the top) so shorter/inactive tabs still show the
 * ribbon's distinctive shape rather than its flat top edge. Each tab shows
 * the section's icon (from `JournalEntry`'s `SECTION_ICON`) rather than a
 * text label — a rotated label on a narrow tab was hard to read. Per-section
 * counters and pagination are step 15, not built here.
 */
export const BookmarkTabs = ({ sections, activeSection, onSelect }: BookmarkTabsProps) => {
  useSignals();

  return (
    <div className="absolute top-[3%] right-[8%] z-20 flex" data-testid="bookmark-tabs">
      {sections.map((section) => {
        const isActive = section === activeSection;
        const label = sectionLabel(section);
        // `SECTION_BOOKMARK_COLOR` only covers the 8 sections that actually
        // get bookmarks (`activities` is excluded, see JournalSections.ts);
        // `section` here is typed as the wider `SectionId` via this
        // component's props, so look it up defensively rather than indexing
        // directly (which TypeScript correctly flags as unsound).
        const bookmarkColor =
          (SECTION_BOOKMARK_COLOR as Partial<Record<SectionId, BookmarkColor>>)[section] ?? 'blue';
        return (
          <button
            key={section}
            type="button"
            onClick={() => onSelect(section)}
            data-testid={`bookmark-tab-${section}`}
            aria-label={label}
            aria-current={isActive ? 'true' : undefined}
            className={cn(
              'flex w-9 items-start justify-center overflow-hidden bg-cover bg-bottom text-lg transition-all duration-150',
              isActive ? 'h-20 pt-1' : 'h-10',
            )}
            style={{ backgroundImage: `url(${BOOKMARK_SPRITE[bookmarkColor]})` }}
          >
            {SECTION_ICON[section]}
          </button>
        );
      })}
    </div>
  );
};
