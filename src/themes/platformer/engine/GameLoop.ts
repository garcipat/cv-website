/** Caps the per-frame delta time (seconds) so a backgrounded/throttled tab
 * doesn't produce one huge catch-up physics step on resume. */
const MAX_DT = 1 / 30;

export interface GameLoop {
  start(): void;
  stop(): void;
}

/**
 * Wraps `requestAnimationFrame` into a start/stop-able loop that calls
 * `onTick(dt)` every frame after the first, with `dt` in seconds.
 */
export function createGameLoop(onTick: (dt: number) => void): GameLoop {
  let rafId: number | null = null;
  let lastTime: number | null = null;

  const frame = (time: number) => {
    if (lastTime !== null) {
      const dt = Math.min((time - lastTime) / 1000, MAX_DT);
      onTick(dt);
    }
    lastTime = time;
    rafId = requestAnimationFrame(frame);
  };

  return {
    start() {
      if (rafId !== null) return;
      lastTime = null;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      lastTime = null;
    },
  };
}
