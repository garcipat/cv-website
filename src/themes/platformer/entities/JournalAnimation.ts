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

/** Each `journal_open_N.png` is trimmed tightly to its own painted content,
 * not to one shared canvas — the closed cover (frame 1) is a tall, narrow
 * ~720x900 canvas; the fully open spread (the final frame) is a short, wide
 * 900x439 canvas. Measured directly from each PNG's IHDR dimensions (index 0
 * is frame 1). */
const JOURNAL_OPEN_FRAME_DIMENSIONS_PX: ReadonlyArray<{ width: number; height: number }> = [
  { width: 720, height: 900 },
  { width: 678, height: 900 },
  { width: 738, height: 900 },
  { width: 731, height: 900 },
  { width: 897, height: 900 },
  { width: 900, height: 745 },
  { width: 900, height: 654 },
  { width: 899, height: 488 },
  { width: 900, height: 439 },
];

const JOURNAL_OPEN_FINAL_FRAME_DIMENSIONS_PX =
  JOURNAL_OPEN_FRAME_DIMENSIONS_PX[JOURNAL_OPEN_FRAME_DIMENSIONS_PX.length - 1];

/** What percentage of the book container's own WIDTH this frame should
 * render at, so the book can be displayed at a constant HEIGHT (matching the
 * final open frame) with only its width changing frame to frame — anchoring
 * on height instead of stretching every frame into the final frame's wide
 * aspect ratio (which squashed the taller closed/mid-opening frames; live
 * user feedback, 2026-08-30: "the closed book looks stretched") and instead
 * of letting each frame render at its own native size (which made the
 * closed cover look bigger than the open spread and shrink as it opened —
 * also flagged as wrong, since the closed cover's canvas has more raw pixel
 * area than the flattened-open spread's).
 *
 * Expressed as a percentage of the *container's width* (not a pixel value,
 * and not a percentage of the container's height, which CSS has no unit
 * for) so it stays correct at any responsive container size: the
 * container's height is always `containerWidth * (finalHeight/finalWidth)`
 * (the fixed aspect-ratio box `Journal.tsx` sizes itself with), so a frame
 * whose own aspect ratio is `width/height` needs
 * `containerHeight * (width/height)` pixels of width, which as a fraction of
 * `containerWidth` is `(finalHeight/finalWidth) * (width/height)`.
 *
 * Being an explicit percentage (rather than `width: auto`, which browsers
 * cannot animate) lets `Journal.tsx` apply a CSS transition across frame
 * changes — needed because the source frames' widths don't grow evenly frame
 * to frame (frames 1-7 stay within a ~37-67% range, then frames 8-9 jump to
 * ~90-100%), which without smoothing reads as a sudden late jump rather than
 * a fluid opening motion (live user feedback, 2026-08-30).
 */
export function journalOpenFrameWidthPercent(frame: number): number {
  const clamped = Math.max(1, Math.min(JOURNAL_OPEN_FRAME_COUNT, frame));
  const { width, height } = JOURNAL_OPEN_FRAME_DIMENSIONS_PX[clamped - 1];
  const { width: finalWidth, height: finalHeight } = JOURNAL_OPEN_FINAL_FRAME_DIMENSIONS_PX;
  return ((width / height) * (finalHeight / finalWidth)) * 100;
}

/** How far to translate the whole book container left (as a percentage of
 * its own width — negative moves left), so the book looks like it's growing
 * outward from screen-center rather than sliding in from the right.
 *
 * The book image itself anchors to the container's right edge (its hinge
 * stays fixed there while pages fan open to the left). That's correct for
 * the final open frame, whose content — the actual journal pages, laid out
 * with `inset-[...]` percentages — must sit exactly where that fixed-right
 * anchor puts it. But it means every earlier, narrower frame (as low as
 * ~37% of the container's width) sits scrunched against the right edge with
 * a lot of empty space to its left, which reads as the book sliding in from
 * the right rather than opening in place (live user feedback, 2026-08-30).
 *
 * This shifts the container left by exactly half of the *missing* width
 * (`100 - journalOpenFrameWidthPercent(frame)`) at every frame — which
 * re-centers that frame's book icon on screen — and resolves to exactly 0
 * at the final frame (where `journalOpenFrameWidthPercent` is 100), so the
 * one frame that carries real page content is never displaced. The book's
 * hinge does drift right over the course of the animation as a result
 * (trading strict hinge-fixedness for not looking like it's sliding), but
 * only during the brief, content-free opening/closing motion — it lands
 * exactly on the fixed anchor the instant content appears, so there's no
 * visible snap.
 */
export function journalOpenFrameCenteringShiftPercent(frame: number): number {
  return -(100 - journalOpenFrameWidthPercent(frame)) / 2;
}
