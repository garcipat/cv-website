import { useSignals } from '@preact/signals-react/runtime';
import { activeCircleIndex } from '../SpaceState';
import { currentUI } from '@/state/locale';
import { cn } from '@/lib/utils';
import { getActiveSectionIndex, type SectionInfo } from '../parade-utils';

export interface AnchorDotsProps {
  sections: SectionInfo[];
  onDotClick: (circleIndex: number) => void;
}

function sectionLabel(sectionId: string): string {
  const ui = currentUI.value;
  switch (sectionId) {
    case 'about':
      return 'About';
    case 'experience':
      return ui.nav.experience;
    case 'projects':
      return ui.nav.projects;
    case 'skills':
      return ui.nav.skills;
    case 'education':
      return ui.nav.education;
    case 'courses':
      return ui.nav.courses;
    case 'certificates':
      return ui.nav.certificates;
    case 'contact':
      return 'Contact';
    default:
      return sectionId;
  }
}

export const AnchorDots = ({ sections, onDotClick }: AnchorDotsProps) => {
  useSignals();

  if (sections.length <= 1) return null;

  const activeSectionIdx = getActiveSectionIndex(sections, activeCircleIndex.value);

  return (
    <nav
      className={cn(
        'fixed right-5 top-1/2 -translate-y-1/2 z-40',
        'flex flex-col gap-3.5',
      )}
      aria-label="Section navigation"
    >
      {sections.map((section, i) => {
        const isActive = i === activeSectionIdx;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onDotClick(section.firstCircleIndex)}
            className={cn(
              'group relative flex items-center justify-end h-5',
              'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-full',
            )}
            aria-label={`Scroll to ${sectionLabel(section.id)}`}
            aria-current={isActive ? 'true' : undefined}
          >
            <span
              className={cn(
                'absolute right-full mr-3 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap',
                'transition-all duration-200',
                isActive
                  ? 'text-[var(--primary)] opacity-100 translate-x-0'
                  : cn(
                      'text-[var(--muted-foreground)] opacity-0 translate-x-1.5',
                      'group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[var(--muted-foreground)]',
                    ),
              )}
            >
              {sectionLabel(section.id)}
            </span>
            <span
              className={cn(
                'block w-2.5 h-2.5 rounded-full border shrink-0',
                'transition-all duration-300',
                isActive
                  ? 'bg-[var(--primary)] border-[var(--primary)] scale-[1.4] shadow-[0_0_10px_var(--primary)]'
                  : 'bg-transparent border-[var(--muted-foreground)]',
              )}
            />
          </button>
        );
      })}
    </nav>
  );
};
