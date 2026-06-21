import { cn } from '@/lib/utils';

interface StatusLineProps {
  /** Current theme id for display (e.g., "terminal" → "terminal"). */
  themeId: string;
  /** Current locale for display (e.g., "en" → "EN"). */
  locale: string;
}

/**
 * Decorative status bar at the bottom of the terminal viewport.
 * Shows static text on the left and theme/locale on the right.
 */
export const StatusLine = ({ themeId, locale }: StatusLineProps) => {
  return (
    <div
      className={cn(
        'flex items-center justify-between',
        'px-7 py-1.5',
        'text-[11px] leading-none',
        'border-t border-[var(--border)]',
        'text-[var(--muted-foreground)]',
        'opacity-65',
        'font-mono',
      )}
    >
      <span>screen 80x24 · 9600 baud · vt100</span>
      <span>{themeId} · {locale.toUpperCase()}</span>
    </div>
  );
};
