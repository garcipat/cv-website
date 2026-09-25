import { vi } from 'vitest';
import type { EffectRenderContext, PopupIconLookup, TransientEffect } from './transientEffect';

/** A DOM-free Canvas 2D mock, mirroring Renderer.test.ts's own mock shape. */
export function makeMockContext(): CanvasRenderingContext2D {
  return {
    imageSmoothingEnabled: true,
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    fillRect: vi.fn(),
    globalAlpha: 1,
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as unknown as CanvasRenderingContext2D;
}

/** A render context around a mock canvas, with optional per-test overrides. */
export function renderContext(
  ctx: CanvasRenderingContext2D,
  effects: readonly TransientEffect<unknown>[],
  overrides: Partial<EffectRenderContext> = {},
): EffectRenderContext {
  return {
    ctx,
    dc: { ctx, sprites: {}, originX: 0, originY: 0, worldElapsed: 0 },
    canvasWidth: 800,
    canvasHeight: 600,
    playerAnchor: { centerX: 0, centerY: 0, headBottomY: 0, width: 64 },
    popupIcons: {} as PopupIconLookup,
    effects,
    ...overrides,
  };
}
