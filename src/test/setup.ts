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
      imageSmoothingEnabled: true,
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    });
  }

  return mockContexts.get(this);
} as typeof HTMLCanvasElement.prototype.getContext;
