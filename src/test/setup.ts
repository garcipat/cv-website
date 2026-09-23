import '@testing-library/jest-dom/vitest';

// jsdom does not implement canvas rendering (no `canvas` npm package
// installed). Without a stub, calling `HTMLCanvasElement.prototype.getContext`
// logs a "Not implemented" error with a full stack trace to the virtual
// console on every call, polluting test output. Stub the 2d context with a
// minimal mock covering the methods/properties the app actually uses, and
// return null for any other context type to preserve jsdom's existing
// (unimplemented) behavior there.
//
// A real canvas returns the SAME context object on every getContext('2d')
// call for a given canvas — cache one mock context per canvas element so
// tests can retrieve the exact object the component under test drew to.
const mockContexts = new WeakMap<HTMLCanvasElement, unknown>();

// Shared by every mock context's createRadialGradient/createLinearGradient
// (below) rather than allocating a fresh `{ addColorStop: vi.fn() }` per
// call. A gradient-per-cell render pass (e.g. the platformer's cave fog,
// O-028) can call createRadialGradient thousands of times within a single
// long-running test — allocating a brand-new mock object (with its own
// vi.fn()) on every one of those calls is what was exhausting worker memory
// and crashing PlatformerPage.test.tsx outright, not a normal assertion
// failure. Nothing in this file's tests inspects a specific gradient's own
// addColorStop calls (Renderer.test.ts's fine-grained gradient assertions
// use their own local, per-test mock instead), so one shared stub is safe.
const sharedGradientStub = { addColorStop: vi.fn() };

HTMLCanvasElement.prototype.getContext = function (
  this: HTMLCanvasElement,
  contextId: string,
) {
  if (contextId !== '2d') return null;

  if (!mockContexts.has(this)) {
    mockContexts.set(this, {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      imageSmoothingEnabled: true,
      lineJoin: 'miter',
      fillRect: vi.fn(),
      fillText: vi.fn(),
      // The cave-lighting pass (Renderer.ts's drawDarkness) clears its
      // reusable offscreen layer before compositing the overlay. Without this
      // the render loop would throw the moment a test's player stands in a
      // cave and darkness becomes active.
      clearRect: vi.fn(),
      globalCompositeOperation: 'source-over',
      // Text drawn as a dark core inside a light halo (the Level Editor's
      // patrol markers) strokes before it fills, so both halves have to
      // exist here or any level holding such a tile throws mid-render.
      strokeText: vi.fn(),
      // Returns a fixed, non-zero width — real glyph metrics don't matter
      // for any test (nothing asserts on measured text width), only that
      // callers relying on it (e.g. Renderer.ts's icon-positioning next to
      // collection-effect text) don't crash on a missing mock method.
      measureText: vi.fn(() => ({ width: 10 })),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      // Terrain's autotiler rotates a ground cell to reuse one piece of art on
      // several edges (see engine/GroundAtlas.ts), so the draw path calls this
      // for any level holding such a tile — without it the render loop throws.
      rotate: vi.fn(),
      scale: vi.fn(),
      strokeRect: vi.fn(),
      // The Level Editor's deployable-ladder landing marker (O-011) draws a
      // dashed outline, so the mock needs setLineDash or the editor render
      // throws for any grid holding a `@` bundle.
      setLineDash: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      rect: vi.fn(),
      roundRect: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      // Returns an opaque-white buffer of the requested size by default —
      // real pixel content doesn't matter for most tests (nothing reads the
      // tileset's actual pixels), only that a caller doing a
      // getImageData/mutate/putImageData round trip (e.g. Renderer.ts's
      // cloud-tile recoloring) doesn't crash on a missing mock method. Tests
      // that DO care about specific pixel values override this per-call via
      // `mockReturnValueOnce`/`mockImplementationOnce`.
      getImageData: vi.fn((_sx: number, _sy: number, sw: number, sh: number) => ({
        data: new Uint8ClampedArray(sw * sh * 4).fill(255),
      })),
      putImageData: vi.fn(),
      // The heal aura's glow/rays (Renderer.ts's drawHealAuraEffects) paint
      // via canvas gradients — a bare fillStyle assignment doesn't cover it.
      createRadialGradient: vi.fn(() => sharedGradientStub),
      createLinearGradient: vi.fn(() => sharedGradientStub),
    });
  }

  return mockContexts.get(this);
} as typeof HTMLCanvasElement.prototype.getContext;

// jsdom does not implement the CSS Font Loading API (no `FontFace` global,
// no `document.fonts`). Without a stub, PlatformerPage.tsx's font-loading
// effect (see engine/FontLoader.ts) throws a ReferenceError on mount in
// every test that renders it. A resolved-immediately mock is enough here —
// individual tests that care about load success/failure (FontLoader.test.ts)
// override these globals themselves via vi.stubGlobal.
if (typeof FontFace === 'undefined') {
  class MockFontFace {
    family: string;
    source: string;
    constructor(family: string, source: string) {
      this.family = family;
      this.source = source;
    }
    load() {
      return Promise.resolve(this as unknown as FontFace);
    }
  }
  // @ts-expect-error jsdom doesn't implement the CSS Font Loading API
  globalThis.FontFace = MockFontFace;
}

if (!document.fonts) {
  Object.defineProperty(document, 'fonts', {
    value: { add: () => {} },
    configurable: true,
  });
}

// jsdom does not implement `window.matchMedia`. The animated themes read it
// once on mount (e.g. PlatformerPage's `prefers-reduced-motion` check), so
// without a stub every mount test would throw. This returns `matches: false`
// (motion allowed) by default; tests that care about the preference assign
// their own `window.matchMedia` (see space.test.tsx).
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}
