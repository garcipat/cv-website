// ---------------------------------------------------------------------------
// Space Parade — TypeScript types for space element motion and configuration
//
// All types are pure data — no React dependency.
// ---------------------------------------------------------------------------

/**
 * Motion profile for a scroll-driven element.
 * Defines the element's trajectory, scaling, rotation, and easing over its
 * scroll range.
 */
export interface MotionConfig {
  /** Scroll offset (vh units) where element enters the visible zone. */
  entryOffset: number;
  /** Scroll offset (vh units) where element exits the visible zone. */
  exitOffset: number;
  /** Starting horizontal position (vw units). */
  startX: number;
  /** Ending horizontal position (vw units). */
  endX: number;
  /** Base vertical position (vh units) before sine wave. */
  baseY: number;
  /** Number of sine-wave oscillations across the path. */
  verticalWaves: number;
  /** Sine-wave amplitude (vh units). */
  verticalAmplitude: number;
  /** Scale function over normalized position [0..1]. */
  scaleProfile: (t: number) => number;
  /** Starting rotation (degrees). */
  rotationStart: number;
  /** Ending rotation (degrees). */
  rotationEnd: number;
  /** Easing function — must satisfy easing(0) === 0 and easing(1) === 1. */
  easing: (t: number) => number;
}

/**
 * Complete scroll-driven element definition with identity and type tag.
 */
export interface ElementConfig extends MotionConfig {
  /** Unique identifier (e.g., "planet-1"). */
  id: string;
  /** Element type (maps to component). */
  type: 'planet' | 'rocket' | 'ufo' | 'shooting-star' | 'asteroid' | 'satellite';
}

/**
 * Computed visual state for a scroll-driven element at a given scroll offset.
 * All values applied as inline CSS styles.
 */
export interface ElementTransform {
  /** Horizontal position (vw units). */
  x: number;
  /** Vertical position (vh units). */
  y: number;
  /** Uniform scale factor. */
  scale: number;
  /** Rotation angle (degrees). */
  rotation: number;
  /** Opacity [0..1], computed by edgeFade. */
  opacity: number;
}
