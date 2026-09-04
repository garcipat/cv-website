import type { SpriteLookup } from '../entities/sprites/SpriteSheet';
import type { CoinPotRenderPlan } from '../entities/blocks/coinPotRenderPlan';

/**
 * Everything a type's `draw` needs in order to render itself, so drawing logic
 * can live in the type's own module without each module reaching for the
 * camera or the sprite refs.
 *
 * Renderer.ts remains the only module that knows how the camera maps world
 * coordinates to canvas coordinates; a type only ever adds originX/originY to
 * its own world position.
 */
export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  /** Loaded images keyed by `SpriteSheet.src`. */
  sprites: SpriteLookup;
  /** World-to-canvas offset. */
  originX: number;
  originY: number;
  /** Seconds since the world started animating — drives bob and pulse. */
  worldElapsed: number;
  /** This frame's coin-pot adjacency/variant render plan (see
   *  entities/blocks/coinPotRenderPlan.ts). Computed once per frame by
   *  PlatformerPage.tsx from the live block list and attached here — every
   *  block kind's `draw` receives it, but only CoinPot.ts's own `draw`
   *  reads it; every other kind ignores it entirely. Undefined for any
   *  draw call built without it (e.g. a test constructing a bare
   *  DrawContext for an unrelated kind). */
  coinPotPlan?: CoinPotRenderPlan;
}
