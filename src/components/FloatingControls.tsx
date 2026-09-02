import { useState } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { ThemeSelect } from './ThemeSelect';
import { LanguageSelect } from './LanguageSelect';
import { cn } from '@/lib/utils';

export interface FloatingControlsProps {
  /** 'glass' adds the translucent card styling the space theme wants;
   *  'plain' (default) is a bare positioned wrapper, matching the platformer
   *  theme's flat look over its canvas. */
  variant?: 'glass' | 'plain';
  /** Fires true the moment either the theme or language dropdown opens, and
   *  false once both are closed. Used by the Platformer theme to pause its
   *  game loop while either is open; other themes simply don't pass it. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Floating theme/language selectors, fixed at the top-right corner (FR-020,
 * FR-021), shared by every theme.
 */
export const FloatingControls = ({ variant = 'plain', onOpenChange }: FloatingControlsProps) => {
  useSignals();
  const [themeOpen, setThemeOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);

  const handleThemeOpenChange = (open: boolean) => {
    setThemeOpen(open);
    onOpenChange?.(open || languageOpen);
  };

  const handleLanguageOpenChange = (open: boolean) => {
    setLanguageOpen(open);
    onOpenChange?.(open || themeOpen);
  };

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50 flex items-center gap-2',
        variant === 'glass' && [
          'bg-[var(--card)]/70 backdrop-blur-md',
          'border border-[var(--border)]',
          'rounded-lg px-3 py-2',
          'shadow-lg shadow-black/20',
        ],
      )}
      data-testid="floating-controls"
    >
      <ThemeSelect onOpenChange={handleThemeOpenChange} />
      <LanguageSelect onOpenChange={handleLanguageOpenChange} />
    </div>
  );
};
