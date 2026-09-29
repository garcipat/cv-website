import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HitEffect } from './HitEffect';

const HERE = path.dirname(fileURLToPath(import.meta.url));

describe('HitEffect vocabulary', () => {
  it('exposesTheThreePrimitives', () => {
    // Arrange — one value per primitive; this compiles only if all three exist.
    const damage: HitEffect = { type: 'damage', amount: 1 };
    const velocity: HitEffect = {
      type: 'velocity',
      x: 10,
      y: -5,
      duration: 0.25,
      preserveJump: true,
    };
    const reaction: HitEffect = { type: 'reaction', blinkOnly: true };

    // Assert
    expect(damage.type).toBe('damage');
    expect(velocity.type).toBe('velocity');
    expect(reaction.type).toBe('reaction');
  });

  it('theModule-importsNothingSoItStaysALeaf', () => {
    const source = fs.readFileSync(path.join(HERE, 'HitEffect.ts'), 'utf8');
    const imports = [...source.matchAll(/(?:from\s*|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports).toEqual([]);
  });

  it('declaresOnlyTheThreePrimitiveTypes', () => {
    const source = fs.readFileSync(path.join(HERE, 'HitEffect.ts'), 'utf8');
    const literals = [...source.matchAll(/type: '([a-z]+)'/g)].map((m) => m[1]).sort();
    expect(literals).toEqual(['damage', 'reaction', 'velocity']);
  });
});
