/** Loaded images keyed by `SpriteSheet.src`. A key present with a `null` value
 *  means the asset has not finished loading; callers skip drawing rather than
 *  waiting. */
export type SpriteLookup = Record<string, HTMLImageElement | null>;
