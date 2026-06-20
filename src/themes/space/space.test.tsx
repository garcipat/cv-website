import { describe, it, expect } from 'vitest';

describe('Space theme effects', () => {
  it('space theme CSS file defines 3D effect variables and styles', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const currentDir = resolve(fileURLToPath(import.meta.url), '..');
    const spaceCss = readFileSync(
      resolve(currentDir, '../../../src/styles/themes/space.css'),
      'utf-8',
    );

    // Verify 3D token variables
    expect(spaceCss).toContain('--perspective-depth');
    expect(spaceCss).toContain('--float-duration');

    // Verify 3D perspective on body
    expect(spaceCss).toContain('perspective: var(--perspective-depth');

    // Verify preserve-3d on sections
    expect(spaceCss).toContain('transform-style: preserve-3d');

    // Verify floating animation
    expect(spaceCss).toContain('space-float');
    expect(spaceCss).toContain('float-panel');

    // Verify parallax layer classes
    expect(spaceCss).toContain('parallax-layer');
    expect(spaceCss).toContain('translateZ');

    // Verify font variables
    expect(spaceCss).toContain('--font-sans');
    expect(spaceCss).toContain('--font-heading');
  });
});
