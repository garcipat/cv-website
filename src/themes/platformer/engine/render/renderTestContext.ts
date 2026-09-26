import { vi } from 'vitest';
import type { CollectiblePlacement } from '../../level/CollectibleMapper';
import type { BlockPlacement } from '../../level/BlockMapper';
import type { ChestPlacement } from '../../level/ChestMapper';

/**
 * Shared non-test helpers for the mirrored renderer suites
 * (`SceneRenderer.test.ts` / `HudRenderer.test.ts`), extracted from the former
 * combined renderer test suite. Mirrors `engine/effects/testContext.ts`.
 */
export function makeMockContext(): CanvasRenderingContext2D {
  return {
    imageSmoothingEnabled: true,
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    drawImage: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    fillRect: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D;
}

export function makeCoinPlacement(id = 'coin-1', x = 100, y = 100): CollectiblePlacement {
  return { id, kind: 'coin', x, y, collected: false };
}

export function makeBlockPlacement(
  id: string,
  blockKind: 'crate' | 'questionMark' | 'fragileRock' | 'coinPot' | 'potionPot' | 'bombPot',
  x: number,
  y: number,
): BlockPlacement {
  return { id, blockKind, x, y };
}

export function makeChestPlacement(id = 'c1', x = 10, y = 20, col = 0, row = 0): ChestPlacement {
  return {
    id,
    col,
    row,
    x,
    y,
    fact: {
      id,
      sectionId: 'experience',
      sectionLabel: 'Experience',
      data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
      sourceType: 'chest',
    },
  };
}
