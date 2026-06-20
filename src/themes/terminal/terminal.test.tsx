import { describe, it, expect } from 'vitest';

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
