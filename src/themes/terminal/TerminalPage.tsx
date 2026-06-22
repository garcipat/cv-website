import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useCallback, useRef } from 'react';
import { currentTheme } from '@/state/theme';
import { currentLocale, changeLocale, currentCV, currentUI } from '@/state/locale';
import {
  terminalOutput,
  commandHistory,
  executeCommand,
  type TerminalOutputLine,
} from '@/state/terminal';
import type { CommandResult, SectionId } from '@/themes/terminal/terminal-commands';
import {
  buildIntroLines,
  buildSectionLines,
  buildHelpLines,
  SECTION_COMMANDS,
} from '@/themes/terminal/terminal-commands';
import { TerminalOutput } from '@/themes/terminal/components/TerminalOutput';
import { CommandInput } from '@/themes/terminal/components/CommandInput';
import { StatusLine } from '@/themes/terminal/components/StatusLine';
import type { Locale } from '@/state/locale';

/**
 * Root layout for the Terminal theme.
 * Assembles terminal output area, command input, and status bar.
 */
export const TerminalPage = () => {
  useSignals();
  const initializedRef = useRef(false);
  const viewRef = useRef<'intro' | 'help' | 'clear' | SectionId>('intro');

  const cv = currentCV.value;
  const ui = currentUI.value;
  const theme = currentTheme.value;
  const locale = currentLocale.value;

  // Initialize terminal with intro screen on mount (runs once)
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      terminalOutput.value = buildIntroLines(cv, ui);
      commandHistory.value = [];
    }
  }, []);

  // Rebuild output when locale changes (to translate current content)
  useEffect(() => {
    if (!initializedRef.current) return;

    switch (viewRef.current) {
      case 'intro':
        terminalOutput.value = buildIntroLines(cv, ui);
        break;
      case 'help':
        terminalOutput.value = [
          { type: 'command-echo', command: ':help' },
          { type: 'separator' },
          ...buildHelpLines(ui),
        ];
        break;
      case 'clear':
        terminalOutput.value = [];
        break;
      default: {
        // A specific section is open — rebuild just that section from scratch
        const sectionId = viewRef.current;
        const command = Object.entries(SECTION_COMMANDS).find(([, v]) => v === sectionId)?.[0] ?? `:${sectionId}`;
        terminalOutput.value = [
          { type: 'command-echo', command },
          { type: 'separator' },
          ...buildSectionLines(sectionId, cv, ui),
        ];
        break;
      }
    }
  }, [locale]);

  /** Scrolls viewport so the given section element is in view. */
  const scrollToSection = useCallback((sectionId: string) => {
    setTimeout(() => {
      const section = document.querySelector(`[data-section="${sectionId}"]`);
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        const viewport = document.querySelector('.terminal-output-viewport');
        viewport?.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 50);
  }, []);

  /** Scrolls viewport to the top (shows latest command output). */
  const scrollTop = useCallback(() => {
    setTimeout(() => {
      const viewport = document.querySelector('.terminal-output-viewport');
      viewport?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }, []);

  const handleExecute = useCallback(
    (input: string) => {
      // Record command in history, then check if this is the first command
      commandHistory.value = [...commandHistory.value, input];
      const isFirstCommand = commandHistory.value.length === 1;

      // Execute command
      const result: CommandResult = executeCommand(input);

      // Build the output lines to add (echo + separator + action content)
      const newLines: TerminalOutputLine[] = [];

      switch (result.type) {
        case 'navigate': {
          viewRef.current = result.target;
          newLines.push({ type: 'command-echo', command: input });
          if (!isFirstCommand) {
            newLines.push({
              type: 'ack-line',
              text: `Showing ${result.target}...`,
            });
          }
          newLines.push({ type: 'separator' });
          const sectionLines = buildSectionLines(result.target, cv, ui);
          newLines.push(...sectionLines);

          if (isFirstCommand) {
            terminalOutput.value = newLines;
          } else {
            terminalOutput.value = [
              ...terminalOutput.value,
              ...newLines,
            ];
          }
          scrollToSection(result.target);
          return;
        }

        case 'help': {
          viewRef.current = 'help';
          newLines.push({ type: 'command-echo', command: input });
          newLines.push({ type: 'separator' });
          const helpLines = buildHelpLines(ui);
          newLines.push(...helpLines);

          if (isFirstCommand) {
            terminalOutput.value = newLines;
          } else {
            terminalOutput.value = [
              ...terminalOutput.value,
              ...newLines,
            ];
          }
          scrollTop();
          return;
        }

        case 'theme': {
          if (result.themeId === 'terminal') {
            viewRef.current = 'intro';
            terminalOutput.value = buildIntroLines(cv, ui);
            commandHistory.value = [];
            return;
          }
          currentTheme.value = result.themeId;
          return;
        }

        case 'lang': {
          changeLocale(result.locale as Locale);
          return;
        }

        case 'clear': {
          viewRef.current = 'clear';
          terminalOutput.value = [];
          return;
        }

        case 'reset': {
          viewRef.current = 'intro';
          terminalOutput.value = buildIntroLines(cv, ui);
          commandHistory.value = [];
          return;
        }

        case 'error': {
          newLines.push({ type: 'command-echo', command: input });
          newLines.push({ type: 'error', message: result.message });

          if (isFirstCommand) {
            terminalOutput.value = newLines;
          } else {
            terminalOutput.value = [
              ...terminalOutput.value,
              ...newLines,
            ];
          }
          scrollTop();
          return;
        }

        case 'none': {
          // Empty input — undo history append (don't record it)
          commandHistory.value = commandHistory.value.slice(0, -1);
          return;
        }
      }
    },
    [cv, ui, scrollToSection, scrollTop],
  );

  return (
    <div
      className="flex flex-col h-screen bg-[var(--background)] text-[var(--foreground)] font-mono"
      onClick={() => {
        const input = document.querySelector('.terminal-input') as HTMLInputElement | null;
        if (input) input.focus();
        else {
          const hidden = document.querySelector('[aria-label="Terminal command input"]') as HTMLInputElement | null;
          hidden?.focus();
        }
      }}
    >
      {/* Terminal Output Area */}
      <TerminalOutput lines={terminalOutput.value} />

      {/* Command Input */}
      <CommandInput onExecute={handleExecute} />

      {/* Status Bar */}
      <StatusLine themeId={theme} locale={locale} />
    </div>
  );
};
