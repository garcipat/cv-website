import type { SpriteLookup } from '../entities/sprites/SpriteSheet';

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
}
