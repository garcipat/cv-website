/** Total frames in the book-opening sequence (`journal_open_1.png` …
 * `journal_open_9.png` in `public/sprites/`) — frame 1 is the closed cover,
 * frame `JOURNAL_OPEN_FRAME_COUNT` is the fully spread-open blank pages the
 * journal's actual content renders on top of. */
export const JOURNAL_OPEN_FRAME_COUNT = 9;

/** Milliseconds each frame is held before advancing to the next — 9 frames
 * at this interval gives a ~810ms open animation, played whenever the
 * journal mounts, and in reverse whenever it closes. 150ms/frame (the
 * initial slowdown from an original, too-fast 50ms) turned out too slow —
 * with only 9 discrete frames, a slower hold makes the missing in-between
 * frames read as choppy rather than smooth. */
export const JOURNAL_OPEN_FRAME_INTERVAL_MS = 90;

/** Sprite path for a given 1-indexed frame, clamped to the valid range so an
 * out-of-range frame (e.g. a stray extra interval tick) never 404s. */
export function journalOpenFrameSrc(frame: number): string {
  const clamped = Math.max(1, Math.min(JOURNAL_OPEN_FRAME_COUNT, frame));
  return `/sprites/journal_open_${clamped}.png`;
}
