/**
 * A group of frames sharing one image. One sheet backs however many things
 * draw from it — `world_tileset.png` serves terrain, crates, question-mark
 * blocks and fragile rocks at once — so a sheet is the unit of loading, not the
 * entity that happens to use it.
 *
 * A standalone single image is a one-frame sheet (`columns: 1`, frame size =
 * image size), which is why chests and dropped keys need no separate drawing
 * path.
 */
export interface SpriteSheet {
  src: string;
  frameWidth: number;
  frameHeight: number;
  /** Frames are addressed by index, read left-to-right then top-to-bottom;
   *  `columns` is what turns an index into a source rect. */
  columns: number;
}

/**
 * Which sheet a type draws from, at what scale, and which frames make up each
 * of its animations. Frames are INDICES into the sheet rather than sx/sy pairs,
 * so an animation spanning a row boundary — the enemy walk loop does — is just
 * a contiguous range.
 */
export interface SpriteDescriptor {
  sheet: SpriteSheet;
  /** Multiplier on the frame's rendered size, on top of RENDER_SCALE. */
  renderScale: number;
  animations: Record<string, { frames: number[]; frameDuration: number }>;
}

/** Loaded images keyed by `SpriteSheet.src`. A key present with a `null` value
 *  means the asset has not finished loading; callers skip drawing rather than
 *  waiting. */
export type SpriteLookup = Record<string, HTMLImageElement | null>;

/** Source rect of one frame. */
export function frameSource(sheet: SpriteSheet, index: number): { sx: number; sy: number } {
  return {
    sx: (index % sheet.columns) * sheet.frameWidth,
    sy: Math.floor(index / sheet.columns) * sheet.frameHeight,
  };
}

/**
 * The distinct image sources a set of descriptors needs, each listed once.
 * The loader (PlatformerPage.tsx) walks the type registries — ENEMY_TYPES,
 * PICKUP_TYPES, BLOCK_TYPES, CHEST_TYPE — and calls this, so adding a type
 * needs no loader edit as long as it draws from an already-registered sheet
 * or a new sheet that's its own primary `sprite.sheet`. A secondary sheet
 * that isn't any type's primary descriptor (`crack_overlay.png`, the crate's
 * overlay) can't be discovered that way and stays hand-listed in the loader
 * instead. Either way, a shared sheet is fetched only once no matter how many
 * types point at it.
 */
export function collectSheetSources(descriptors: readonly SpriteDescriptor[]): string[] {
  return [...new Set(descriptors.map((d) => d.sheet.src))];
}
