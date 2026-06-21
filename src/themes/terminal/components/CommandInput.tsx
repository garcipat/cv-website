import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { currentInput, cursorVisible, navigateSection } from '@/state/terminal';

interface CommandInputProps {
  /** Called when the user presses Enter with a non-empty command. */
  onExecute: (command: string) => void;
}

/**
 * Command prompt + text display + blinking block cursor.
 *
 * Uses a visible display area (prompt › text › cursor) with a hidden
 * overlay <input> for keystroke capture — matching a classic terminal
 * where the block cursor sits immediately after the prompt or text.
 */
export const CommandInput = ({ onExecute }: CommandInputProps) => {
  useSignals();
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = currentInput.value.trim();
      if (trimmed) {
        onExecute(trimmed);
        currentInput.value = '';
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigateSection('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigateSection('down');
    }
  };

  const handleFocus = () => {
    cursorVisible.value = true;
  };

  const handleBlur = () => {
    cursorVisible.value = false;
  };

  return (
    <div
      className={cn(
        'flex items-center',
        'px-7 py-2',
        'border-t border-[var(--border)]',
      )}
    >
      {/* Prompt symbol */}
      <span
        className={cn(
          'prompt-symbol',
          'text-[var(--primary)] mr-2',
          'drop-shadow-[0_0_6px_var(--glow-color)]',
        )}
      >
        $
      </span>

      {/* Visible display area: typed text + block cursor */}
      <div className="relative flex-1 font-mono text-sm leading-[1.6] h-[17px]">
        <span className="text-[var(--foreground)]">
          {currentInput.value}
        </span>
        {/* Blinking block cursor — always right after text */}
        <span
          className={cn(
            'inline-block w-[9px] h-[17px] ml-px',
            'align-text-bottom',
            'bg-[var(--foreground)]',
            cursorVisible.value ? 'animate-[blink_1s_step-end_infinite]' : 'opacity-100',
            'shadow-[0_0_8px_var(--glow-color)]',
          )}
        />

        {/* Invisible overlay input for keystroke capture */}
        <input
          ref={inputRef}
          type="text"
          value={currentInput.value}
          onChange={(e) => { currentInput.value = e.target.value; }}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="absolute inset-0 w-full h-full opacity-0 cursor-default"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          aria-label="Terminal command input"
        />
      </div>
    </div>
  );
};
