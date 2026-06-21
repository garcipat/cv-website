import { useSignals } from '@preact/signals-react/runtime';
import { cn } from '@/lib/utils';
import { buildHelpLines } from '@/themes/terminal/terminal-commands';
import type { Translation } from '@/i18n/translations';
import type { TerminalOutputLine } from '@/state/terminal';

interface CommandHelpProps {
  /** Locale-aware UI strings for command descriptions. */
  ui: Translation;
}

/**
 * Renders :help command output as a structured list.
 * Groups commands by category (Navigation, System).
 */
export const CommandHelp = ({ ui }: CommandHelpProps) => {
  useSignals();
  const lines = buildHelpLines(ui);

  return (
    <div className="flex flex-col">
      {lines.map((line, index) => (
        <HelpLine key={`help-${index}`} line={line} />
      ))}
    </div>
  );
};

/** Renders a single help output line. */
const HelpLine = ({ line }: { line: TerminalOutputLine }) => {
  switch (line.type) {
    case 'help-group':
      return (
        <div className={cn('px-7 py-0.5 mt-3 mb-1')}>
          <span className="text-[var(--accent)] font-bold">
            {line.title}
          </span>
        </div>
      );

    case 'help-command':
      return (
        <div className="px-7 pl-10 py-0.5 flex gap-3 items-baseline">
          <span
            className={cn(
              'font-bold min-w-[16ch]',
              line.variant === 'accent'
                ? 'text-[var(--accent)] drop-shadow-[0_0_6px_rgba(255,176,0,0.4)]'
                : 'text-[var(--primary)]',
            )}
          >
            {line.name}
          </span>
          <span className="text-[var(--foreground)] opacity-80">
            {line.description}
          </span>
        </div>
      );

    case 'help-footer':
      return (
        <div className="px-7 py-0.5 mt-3 text-[var(--muted-foreground)]">
          {line.text}
        </div>
      );

    default:
      return null;
  }
};
