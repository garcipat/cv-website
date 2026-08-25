import { useSignals } from '@preact/signals-react/runtime';
import { ThemeSelect } from '@/components/ThemeSelect';
import { LanguageSelect } from '@/components/LanguageSelect';
import { cn } from '@/lib/utils';

export const FloatingControls = () => {
  useSignals();

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50',
        'flex items-center gap-2',
        'bg-[var(--card)]/70 backdrop-blur-md',
        'border border-[var(--border)]',
        'rounded-lg px-3 py-2',
        'shadow-lg shadow-black/20',
      )}
    >
      <ThemeSelect />
      <LanguageSelect />
    </div>
  );
};
