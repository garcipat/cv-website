// ---------------------------------------------------------------------------
// Terminal-specific Preact Signals
//
// Follows the same pattern as src/state/ide.ts for theme-specific state.
// All signal access in components uses useSignals() from @preact/signals-react/runtime.
// ---------------------------------------------------------------------------

import { signal, type Signal } from '@preact/signals-react';
import { executeCommand as _executeCommand } from '@/themes/terminal/terminal-commands';

export type { CommandResult, SectionId } from '@/themes/terminal/terminal-commands';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single line or block to render in the terminal output area. */
export type TerminalOutputLine =
  | { type: 'command-echo'; command: string }
  | { type: 'section-header'; sectionId: string; label: string }
  | { type: 'separator' }
  | { type: 'content'; text: string; variant?: ContentVariant }
  | { type: 'content-segments'; segments: ContentSegment[] }
  | { type: 'bullet'; text: string }
  | { type: 'skills-bar'; name: string; level: number }
  | { type: 'skills-category'; name: string }
  | { type: 'tags'; tags: string[] }
  | { type: 'link'; text: string; url: string }
  | { type: 'error'; message: string }
  | { type: 'help-group'; title: string }
  | { type: 'help-command'; name: string; description: string; variant?: 'primary' | 'accent' }
  | { type: 'help-footer'; text: string }
  | { type: 'ack-line'; text: string };

export type ContentVariant = 'default' | 'dim' | 'bright' | 'amber';

/** A text segment with its own color variant for inline multi-color lines. */
export interface ContentSegment {
  text: string;
  variant?: ContentVariant;
}

// ---------------------------------------------------------------------------
// Signals
// ---------------------------------------------------------------------------

/** Ordered list of previously executed commands (newest appended last). Session-only. */
export const commandHistory: Signal<string[]> = signal<string[]>([]);

/** Text currently displayed in the command input field. */
export const currentInput: Signal<string> = signal<string>('');

/** Whether the blinking cursor element is visible (controlled by focus/blur). */
export const cursorVisible: Signal<boolean> = signal<boolean>(true);

/** Ordered list of output lines currently displayed in the terminal output area. */
export const terminalOutput: Signal<TerminalOutputLine[]> = signal<TerminalOutputLine[]>([]);

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Parses and executes a command string.
 * Delegates to terminal-commands.ts for pure logic.
 * Returns a structured result indicating what action TerminalPage should take.
 */
export { _executeCommand as executeCommand };

/**
 * Scrolls terminal output to the adjacent CV section block.
 * Handles boundary cases (first section → scroll to top, last section → scroll to bottom).
 */
export function navigateSection(direction: 'up' | 'down'): void {
  const sections = document.querySelectorAll('[data-section]');
  if (sections.length === 0) return;

  const viewport = document.querySelector('.terminal-output-viewport');
  if (!viewport) return;

  const visibleSectionIndex = findTopmostVisibleSection(sections, viewport);

  if (direction === 'up') {
    if (visibleSectionIndex <= 0) {
      // At first section or none visible → scroll to top
      viewport.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      sections[visibleSectionIndex - 1].scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  } else {
    // direction === 'down'
    if (visibleSectionIndex === -1) {
      // No section visible → scroll to first
      sections[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (visibleSectionIndex >= sections.length - 1) {
      // At last section → scroll to bottom of output
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    } else {
      sections[visibleSectionIndex + 1].scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }
}

/**
 * Finds the index of the topmost section currently visible in the viewport.
 * Returns -1 if no section is visible.
 */
function findTopmostVisibleSection(
  sections: NodeListOf<Element>,
  viewport: Element,
): number {
  const viewportRect = viewport.getBoundingClientRect();
  const viewportTop = viewportRect.top;
  const viewportBottom = viewportRect.bottom;

  let closestIndex = -1;
  let closestDistance = Infinity;

  sections.forEach((section, index) => {
    const rect = section.getBoundingClientRect();
    // Check if the section is at least partially visible
    if (rect.bottom < viewportTop || rect.top > viewportBottom) {
      return; // not visible
    }

    // Calculate how far the section top is from the viewport top
    const distance = Math.abs(rect.top - viewportTop);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  return closestIndex;
}
