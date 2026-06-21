import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { signal } from '@preact/signals-react';

// Mock signal state for testing
const mockTerminalOutput = signal<any[]>([]);
const mockCommandHistory = signal<string[]>([]);
const mockCurrentInput = signal<string>('');
const mockCursorVisible = signal<boolean>(true);

vi.mock('@/state/terminal', () => ({
  get terminalOutput() { return mockTerminalOutput; },
  get commandHistory() { return mockCommandHistory; },
  get currentInput() { return mockCurrentInput; },
  get cursorVisible() { return mockCursorVisible; },
  navigateSection: vi.fn(),
  executeCommand: vi.fn(),
}));

vi.mock('@/state/theme', () => ({
  currentTheme: { value: 'terminal' },
}));

vi.mock('@/state/locale', () => ({
  currentLocale: { value: 'en' },
  currentCV: { value: { personality: { name: 'Test', tagline: 'Dev' }, contact: {}, experience: [], skills: [], courses: [], education: [], certificates: [], projects: [] } },
  currentUI: { value: { terminal: { sections: { personality: 'PERSONALITY' } } } },
  changeLocale: vi.fn(),
}));

beforeEach(() => {
  cleanup();
  mockTerminalOutput.value = [];
  mockCommandHistory.value = [];
  mockCurrentInput.value = '';
  mockCursorVisible.value = true;
});

describe('Terminal theme effects', () => {
  it('terminal theme CSS file defines CRT effect variables and styles', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const currentDir = resolve(fileURLToPath(import.meta.url), '..');
    const terminalCss = readFileSync(
      resolve(currentDir, '../../../src/styles/themes/terminal.css'),
      'utf-8',
    );

    // Verify CRT token variables
    expect(terminalCss).toContain('--scanline-opacity');
    expect(terminalCss).toContain('--glow-color');
    expect(terminalCss).toContain('--crt-curve');

    // Verify scanline overlay styles
    expect(terminalCss).toContain('::after');
    expect(terminalCss).toContain('repeating-linear-gradient');
    expect(terminalCss).toContain('terminal-scanline');

    // Verify CRT glow on headings
    expect(terminalCss).toContain('text-shadow');

    // Verify CRT curve on root
    expect(terminalCss).toContain('border-radius: var(--crt-curve');

    // Verify font variables
    expect(terminalCss).toContain('--font-sans');
    expect(terminalCss).toContain('--font-heading');
  });
});
