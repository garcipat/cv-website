/**
 * Loads a font via the CSS Font Loading API and registers it in
 * `document.fonts` so subsequent canvas `fillText` calls using `family` pick
 * it up. Mirrors SpriteLoader.ts's promise-based pattern for image assets.
 */
export function loadFont(family: string, url: string): Promise<FontFace> {
  const font = new FontFace(family, `url(${url})`);
  return font.load().then((loaded) => {
    document.fonts.add(loaded);
    return loaded;
  });
}
