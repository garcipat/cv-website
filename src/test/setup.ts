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
