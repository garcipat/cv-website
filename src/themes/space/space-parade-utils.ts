// ---------------------------------------------------------------------------
// Space Theme — Pure utility functions for the space parade
//
// No React dependency — importable by tests without jsdom.
// All functions are pure: same input → same output, no side effects.
// ---------------------------------------------------------------------------

import type {
  MotionConfig,
  ElementConfig,
  ElementTransform,
} from './components/space-elements/types';

// ---------------------------------------------------------------------------
// Easing functions
// ---------------------------------------------------------------------------

/** Quadratic ease-in-out: smooth acceleration and deceleration. */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Sine ease-in-out: organic feel, zero velocity at start and end. */
export function easeInOutSine(t: number): number {
  return (1 - Math.cos(Math.PI * t)) / 2;
}

/** Steep exponential ease-in for fast entry. */
export function easeInExpo(t: number): number {
  return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
}

/** Exponential ease-out: slow deceleration at end. */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** Cubic ease-out for smooth deceleration. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Linear: no easing. */
export function linear(t: number): number {
  return t;
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/**
 * Linear interpolation between a and b.
 * t = 0 → a, t = 1 → b.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp value to [min, max] range.
 */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// ---------------------------------------------------------------------------
// Opacity helper
// ---------------------------------------------------------------------------

/**
 * 3-phase opacity model mirroring the existing computeCircleTransform fade.
 *
 * Phase 1 (t ∈ [0, ENTRY_RAMP]):   ease-out fade-in from 0 → 1
 * Phase 2 (t ∈ [ENTRY_RAMP, EXIT_START]): full opacity at 1
 * Phase 3 (t ∈ [EXIT_START, 1]):    ease-in fade-out from 1 → 0
 */
export function edgeFade(t: number): number {
  const ENTRY_RAMP = 0.12;
  const EXIT_START = 0.88;

  if (t <= ENTRY_RAMP) {
    // Ease-out fade-in
    const pt = t / ENTRY_RAMP;
    return easeOutCubic(pt);
  }

  if (t >= EXIT_START) {
    // Ease-in fade-out
    const pt = (t - EXIT_START) / (1 - EXIT_START);
    return 1 - easeInExpo(pt);
  }

  // Full opacity in the middle display zone
  return 1;
}

// ---------------------------------------------------------------------------
// Position computation
// ---------------------------------------------------------------------------

/**
 * Compute the visual state (position, scale, rotation, opacity) for a
 * scroll-driven element at a given scroll offset.
 *
 * Mirroring the computeCircleTransform pattern:
 *   1. Compute normalized progress t ∈ [0, 1] within the element's range
 *   2. Apply easing
 *   3. Compute all output properties via lerp, sine waves, and edgeFade
 *
 * All output properties use CSS `transform` and `opacity` for GPU compositing.
 *
 * @param config    The element's motion profile (with entry/exit in vh units).
 * @param scrollOffset  Current scroll position in vh units.
 * @returns         Computed transform to apply as inline CSS.
 */
export function computeElementPosition(
  config: MotionConfig,
  scrollOffset: number,
): ElementTransform {
  const { entryOffset, exitOffset, startX, endX, baseY, verticalWaves, verticalAmplitude, scaleProfile, rotationStart, rotationEnd, easing } = config;

  // Guard: zero or negative range
  const range = exitOffset - entryOffset;
  if (range <= 0) {
    return { x: startX, y: baseY, scale: scaleProfile(0), rotation: rotationStart, opacity: 0 };
  }

  // Normalized progress, clamped to [0, 1]
  const t = clamp((scrollOffset - entryOffset) / range, 0, 1);
  const easedT = easing(t);

  // Horizontal position
  const x = lerp(startX, endX, easedT);

  // Vertical position with sine-wave bobbing
  const y = baseY + Math.sin(easedT * Math.PI * verticalWaves) * verticalAmplitude;

  // Scale from the config's profile function
  const scale = scaleProfile(easedT);

  // Rotation
  const rotation = lerp(rotationStart, rotationEnd, easedT);

  // Opacity via 3-phase edge fade
  const opacity = edgeFade(t);

  return { x, y, scale, rotation, opacity };
}

// ---------------------------------------------------------------------------
// Config scaling
// ---------------------------------------------------------------------------

/**
 * Scale a list of element configs so that their entry/exit offsets
 * (expressed as 0..1 fractions of totalSpan) become actual vh units.
 *
 * Each config is shallow-copied; entryOffset and exitOffset are multiplied
 * by totalSpan and clamped to a minimum of 5.0 vh — the minimum span clamp
 * ensures elements are not unviewable with very short CVs.
 */
export function scaleConfigsToSpan(
  configs: ElementConfig[],
  totalSpan: number,
): ElementConfig[] {
  const span = Math.max(totalSpan, 5.0);
  return configs.map((c) => ({
    ...c,
    entryOffset: c.entryOffset * span,
    exitOffset: c.exitOffset * span,
  }));
}

// ---------------------------------------------------------------------------
// Hardcoded element configurations
// ---------------------------------------------------------------------------

/**
 * Master list of scroll-driven space elements.
 *
 * Entry/exit offsets are expressed as fractions of totalSpan (0..1 range).
 * They are scaled to actual vh units at render time via scaleConfigsToSpan().
 *
 * Design principles:
 *  - Planet spans most of the scroll (92%) as the anchor element.
 *  - Spaceship and satellite overlap the planet at different regions.
 *  - Shooting stars (×6) and asteroids (×3) are scattered across the span
 *    for episodic visual interest.
 *  - At most ~4 elements are visible simultaneously at any scroll position.
 *  - Natural gaps prevent elements from clustering awkwardly.
 */
export const SPACE_PARADE_CONFIGS: ElementConfig[] = [
  // ── Ringed Planet — anchor element, spans almost the full scroll ──
  {
    id: 'planet-1',
    type: 'planet',
    entryOffset: 0.01,
    exitOffset: 0.93,
    startX: -15,
    endX: 90,
    baseY: 42,
    verticalWaves: 0.5,
    verticalAmplitude: 4,
    scaleProfile: (t: number) => {
      // 0.3 → 0.9 → 0.4 (grows to prominence, then recedes)
      if (t < 0.35) return 0.3 + (0.6 / 0.35) * t;
      if (t < 0.7) return 0.9 - ((0.5) / 0.35) * (t - 0.35);
      return 0.4;
    },
    rotationStart: 0,
    rotationEnd: -25,
    easing: easeInOutSine,
  },

  // ── Rocket (Futurama Planet Express) — sweeps across with vertical bobbing ──
  {
    id: 'rocket-1',
    type: 'rocket',
    entryOffset: 0.03,
    exitOffset: 0.48,
    startX: 110,
    endX: -15,
    baseY: 30,
    verticalWaves: 2,
    verticalAmplitude: 10,
    scaleProfile: (t: number) => 0.55 + 0.15 * Math.sin(t * Math.PI),
    rotationStart: -5,
    rotationEnd: 5,
    easing: easeInOutQuad,
  },

  // ── UFO — hovers in from right, drifts to center ──
  {
    id: 'ufo-1',
    type: 'ufo',
    entryOffset: 0.50,
    exitOffset: 0.95,
    startX: 100,
    endX: 35,
    baseY: 48,
    verticalWaves: 0.3,
    verticalAmplitude: 6,
    scaleProfile: (t: number) => 0.65 + 0.1 * Math.sin(t * Math.PI),
    rotationStart: 0,
    rotationEnd: 3,
    easing: easeInOutSine,
  },

  // ── Satellite — linear cross with full spin ──
  {
    id: 'satellite-1',
    type: 'satellite',
    entryOffset: 0.45,
    exitOffset: 0.87,
    startX: -10,
    endX: 105,
    baseY: 65,
    verticalWaves: 1,
    verticalAmplitude: 6,
    scaleProfile: () => 0.38,
    rotationStart: 0,
    rotationEnd: 720,
    easing: linear,
  },

  // ── Shooting Stars ×6 ──
  {
    id: 'ss-1',
    type: 'shooting-star',
    entryOffset: 0.07,
    exitOffset: 0.13,
    startX: 85,
    endX: -10,
    baseY: 15,
    verticalWaves: 0,
    verticalAmplitude: 0,
    scaleProfile: () => 0.55,
    rotationStart: -45,
    rotationEnd: -45,
    easing: easeInExpo,
  },
  {
    id: 'ss-2',
    type: 'shooting-star',
    entryOffset: 0.22,
    exitOffset: 0.28,
    startX: 95,
    endX: -5,
    baseY: 25,
    verticalWaves: 0,
    verticalAmplitude: 0,
    scaleProfile: () => 0.5,
    rotationStart: -45,
    rotationEnd: -45,
    easing: easeInExpo,
  },
  {
    id: 'ss-3',
    type: 'shooting-star',
    entryOffset: 0.37,
    exitOffset: 0.43,
    startX: 80,
    endX: -15,
    baseY: 55,
    verticalWaves: 0,
    verticalAmplitude: 0,
    scaleProfile: () => 0.6,
    rotationStart: -45,
    rotationEnd: -45,
    easing: easeInExpo,
  },
  {
    id: 'ss-4',
    type: 'shooting-star',
    entryOffset: 0.52,
    exitOffset: 0.58,
    startX: 90,
    endX: -10,
    baseY: 18,
    verticalWaves: 0,
    verticalAmplitude: 0,
    scaleProfile: () => 0.45,
    rotationStart: -45,
    rotationEnd: -45,
    easing: easeInExpo,
  },
  {
    id: 'ss-5',
    type: 'shooting-star',
    entryOffset: 0.67,
    exitOffset: 0.73,
    startX: 85,
    endX: -5,
    baseY: 70,
    verticalWaves: 0,
    verticalAmplitude: 0,
    scaleProfile: () => 0.55,
    rotationStart: -45,
    rotationEnd: -45,
    easing: easeInExpo,
  },
  {
    id: 'ss-6',
    type: 'shooting-star',
    entryOffset: 0.82,
    exitOffset: 0.88,
    startX: 95,
    endX: -15,
    baseY: 40,
    verticalWaves: 0,
    verticalAmplitude: 0,
    scaleProfile: () => 0.5,
    rotationStart: -45,
    rotationEnd: -45,
    easing: easeInExpo,
  },

  // ── Asteroids ×3 ──
  {
    id: 'asteroid-1',
    type: 'asteroid',
    entryOffset: 0.14,
    exitOffset: 0.28,
    startX: -12,
    endX: 100,
    baseY: 22,
    verticalWaves: 0.5,
    verticalAmplitude: 3,
    scaleProfile: (t: number) => 0.25 + 0.1 * Math.sin(t * Math.PI),
    rotationStart: 0,
    rotationEnd: 360,
    easing: easeInOutSine,
  },
  {
    id: 'asteroid-2',
    type: 'asteroid',
    entryOffset: 0.56,
    exitOffset: 0.70,
    startX: 105,
    endX: -10,
    baseY: 58,
    verticalWaves: 0.7,
    verticalAmplitude: 4,
    scaleProfile: (t: number) => 0.3 + 0.1 * Math.sin(t * Math.PI),
    rotationStart: 45,
    rotationEnd: 405,
    easing: easeOutCubic,
  },
  {
    id: 'asteroid-3',
    type: 'asteroid',
    entryOffset: 0.30,
    exitOffset: 0.44,
    startX: -8,
    endX: 95,
    baseY: 78,
    verticalWaves: 0.3,
    verticalAmplitude: 2,
    scaleProfile: (t: number) => 0.28 + 0.08 * Math.sin(t * Math.PI),
    rotationStart: 180,
    rotationEnd: 540,
    easing: easeInOutQuad,
  },
];
