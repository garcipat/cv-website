import '@testing-library/jest-dom/vitest';

// jsdom does not implement canvas rendering (no `canvas` npm package
// installed). Without a stub, calling `HTMLCanvasElement.prototype.getContext`
// logs a "Not implemented" error with a full stack trace to the virtual
// console on every call, polluting test output. Stub the 2d context with a
// minimal mock covering the methods/properties the app actually uses, and
// return null for any other context type to preserve jsdom's existing
// (unimplemented) behavior there.
HTMLCanvasElement.prototype.getContext = ((contextId: string) => {
  if (contextId === '2d') {
    return {
      fillStyle: '',
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  }

  return null;
}) as typeof HTMLCanvasElement.prototype.getContext;
