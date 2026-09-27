import type { MarkerPlacement } from '../../level/LevelData';

/**
 * Whether a background `string[]` layout holds at least one painted cell — a
 * layout cropped alongside an all-empty foreground still has rows (of all-`.`
 * characters), so this checks row content rather than just `.length`.
 */
const hasBackgroundContent = (background: readonly string[]): boolean =>
  background.some((row) => [...row].some((char) => char !== '.'));

/**
 * The one level/blueprint JSON serializer (FR-011, D9): the file's name plus
 * its already-cropped layout, pretty-printed and newline-terminated so the
 * file reads like the rest of the repo's JSON rather than one long line. The
 * background layer is included only when it holds at least one painted cell,
 * and `markers` only when non-empty — so a file without them keeps the same
 * shape it had before those layers existed. Output is byte-identical to the
 * old `levelFileJson`/`blueprintFileJson`.
 *
 * Takes the cropped `layout` (and `background`, already cropped to the same
 * origin) rather than a raw grid and re-cropping here itself — see
 * `ops/cropLevelForExport.ts`.
 */
export function layoutFileJson(
  name: string,
  layout: readonly string[],
  background: readonly string[],
  markers: readonly MarkerPlacement[] = [],
): string {
  return `${JSON.stringify(
    {
      name,
      layout,
      ...(hasBackgroundContent(background) ? { background } : {}),
      ...(markers.length > 0 ? { markers } : {}),
    },
    null,
    2,
  )}\n`;
}
