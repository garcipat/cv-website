import { useSignals } from '@preact/signals-react/runtime';
import { cn } from '@/lib/utils';
import type { TerminalOutputLine } from '@/state/terminal';

interface TerminalOutputProps {
  /** Accumulated output lines to render top-to-bottom. */
  lines: TerminalOutputLine[];
}

/**
 * Renders an array of TerminalOutputLine items top-to-bottom
 * in a scrollable output area.
 */
export const TerminalOutput = ({ lines }: TerminalOutputProps) => {
  useSignals();

  return (
    <div className="terminal-output-viewport flex-1 overflow-y-auto">
      <div className="flex flex-col gap-0 py-4 min-h-full">
        {lines.length === 0 && (
          <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">
            <span className="animate-pulse">_</span>
          </div>
        )}
        {lines.map((line, index) => (
          <OutputLine key={`line-${index}`} line={line} />
        ))}
      </div>
    </div>
  );
};

/** Renders a single TerminalOutputLine based on its type. */
const OutputLine = ({ line }: { line: TerminalOutputLine }) => {
  switch (line.type) {
    case 'command-echo':
      return (
        <div className={cn('px-7 py-0.5', 'cmd-echo')}>
          <span className="text-[var(--primary)]">$ </span>
          <span className="text-[var(--foreground)]">{line.command}</span>
        </div>
      );

    case 'section-header':
      return (
        <div
          data-section={line.sectionId}
          className={cn(
            'px-7 py-0.5 mt-3 mb-1',
            'section-header',
            'text-[var(--primary)] font-bold',
          )}
        >
          <span className="opacity-70">&gt;</span>{' '}
          <span>{line.label}</span>
        </div>
      );

    case 'separator':
      return (
        <div className={cn('px-7 py-0.5', 'separator-line')}>
          <span className="text-[var(--muted-foreground)] tracking-wider opacity-50 select-none">
            ══════════════════════════════════════════
          </span>
        </div>
      );

    case 'content':
      return (
        <div className={cn('px-7 py-0.5', getContentVariantClass(line.variant))}>
          {line.text}
        </div>
      );

    case 'bullet':
      return (
        <div className="px-7 pl-10 py-0.5 text-[var(--foreground)]">
          <span className="mr-2 opacity-60">*</span>
          {line.text}
        </div>
      );

    case 'skills-bar':
      return (
        <div className="px-7 py-0.5 text-[var(--foreground)] font-mono">
          <span className="text-[var(--primary)]">{line.name.padEnd(12)}</span>
          <span className="text-[var(--primary)] tracking-wider">
            {renderSkillBar(line.level)}
          </span>
          <span className="text-[var(--muted-foreground)] ml-1">
            {line.level}%
          </span>
        </div>
      );

    case 'skills-category':
      return (
        <div className="px-7 py-0.5 mt-2">
          <span className="text-[var(--primary)] font-bold">{line.name}</span>
        </div>
      );

    case 'tags':
      return (
        <div className="px-7 py-0.5">
          {line.tags.map((tag, i) => (
            <span key={i} className="tag-bracket text-[var(--muted-foreground)]">
              <span className="opacity-50">[</span>
              <span className="text-[var(--accent)]">{tag}</span>
              <span className="opacity-50">]</span>{' '}
            </span>
          ))}
        </div>
      );

    case 'link':
      return (
        <div className="px-7 py-0.5">
          <a
            href={line.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline hover:opacity-80"
          >
            {line.text}
          </a>
        </div>
      );

    case 'error':
      return (
        <div className="px-7 py-0.5 error-text text-[var(--accent)]">
          {line.message}
        </div>
      );

    case 'help-group':
      return (
        <div className="px-7 py-0.5 mt-3 mb-1">
          <span className="help-group-title text-[var(--accent)] font-bold">
            {line.title}
          </span>
        </div>
      );

    case 'help-command':
      return (
        <div className="px-7 pl-10 py-0.5 flex gap-3 items-baseline">
          <span
            className={cn(
              'help-command-name font-bold min-w-[16ch]',
              line.variant === 'accent'
                ? 'text-[var(--accent)] drop-shadow-[0_0_6px_rgba(255,176,0,0.4)]'
                : 'text-[var(--primary)]',
            )}
          >
            {line.name}
          </span>
          <span className="help-command-desc text-[var(--foreground)] opacity-80">
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

    case 'ack-line':
      return (
        <div className="px-7 py-0.5 ack-line text-[var(--muted-foreground)] italic">
          # {line.text}
        </div>
      );

    default:
      return null;
  }
};

/** Returns Tailwind class for the content variant. */
function getContentVariantClass(variant?: string): string {
  switch (variant) {
    case 'dim':
      return 'text-[var(--muted-foreground)]';
    case 'bright':
      return 'text-[var(--primary)]';
    case 'amber':
      return 'text-[var(--accent)]';
    default:
      return 'text-[var(--foreground)]';
  }
}

/** Renders an ASCII-style proficiency bar: filled █ blocks vs empty ░ blocks. */
function renderSkillBar(level: number): string {
  const filledCount = Math.round(level / 10);
  const emptyCount = 10 - filledCount;
  return '█'.repeat(filledCount) + '░'.repeat(emptyCount);
}
