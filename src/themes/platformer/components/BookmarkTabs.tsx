import { useSignals } from '@preact/signals-react/runtime';
import { cn } from '@/lib/utils';
import { SECTION_BOOKMARK_COLOR, sectionLabel, type BookmarkColor } from '../entities/JournalSections';
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
 * Colored bookmark tabs along the journal's right edge — one per non-empty
 * CV section (per FR-013/FR-016). Inactive tabs are a thin 12px sliver of
 * their sprite; the active tab widens to 48px and shows its vertical label.
 * Per-section counters and pagination are step 15, not built here.
 */
export const BookmarkTabs = ({ sections, activeSection, onSelect }: BookmarkTabsProps) => {
  useSignals();

  return (
    <div className="flex flex-col justify-between" data-testid="bookmark-tabs">
      {sections.map((section) => {
        const isActive = section === activeSection;
        const label = sectionLabel(section);
        return (
          <button
            key={section}
            type="button"
            onClick={() => onSelect(section)}
            data-testid={`bookmark-tab-${section}`}
            aria-label={label}
            className={cn(
              'flex items-center justify-center overflow-hidden bg-cover bg-left transition-all duration-150',
              isActive ? 'h-20 w-12' : 'h-16 w-3',
            )}
            style={{ backgroundImage: `url(${BOOKMARK_SPRITE[SECTION_BOOKMARK_COLOR[section]]})` }}
          >
            {isActive && (
              <span
                className="font-caveat text-sm font-bold text-white"
                style={{ writingMode: 'vertical-rl' }}
              >
                {label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
