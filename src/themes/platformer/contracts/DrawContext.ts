import type { SpriteLookup } from './SpriteLookup';

/**
 * Everything a type's `draw` needs in order to render itself, so drawing logic
 * can live in the type's own module without each module reaching for the
 * camera or the sprite refs.
 *
 * Renderer.ts remains the only module that knows how the camera maps world
 * coordinates to canvas coordinates; a type only ever adds originX/originY to
 * its own world position.
 *
 * Generic over the pot plan so this contract stays a strict leaf: the concrete
 * `PotRenderPlan` is a block-layer detail (it transitively pulls in
 * `BlockState` and `PotKind`), carried through opaquely here. The block layer
 * specializes to `DrawContext<PotRenderPlan>`; every other family uses the
 * default.
 */
export interface DrawContext<TPotPlan = unknown> {
  ctx: CanvasRenderingContext2D;
  /** Loaded images keyed by `SpriteSheet.src`. */
  sprites: SpriteLookup;
  /** World-to-canvas offset. */
  originX: number;
  originY: number;
  /** Seconds since the world started animating — drives bob and pulse. */
  worldElapsed: number;
  /** This frame's pot bunch-render plan (see
   *  entities/blocks/potRenderPlan.ts). Computed once per frame by
   *  PlatformerPage.tsx / EditorCanvas.tsx from the live block list and
   *  attached here — every block kind's `draw` receives it, but only a pot
   *  kind's `drawPotBunch` reads it; every other kind ignores it entirely.
   *  Undefined for any draw call built without it (e.g. a test constructing
   *  a bare DrawContext for an unrelated kind). */
  potPlan?: TPotPlan;
}
