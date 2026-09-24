import type { Blueprint } from './BlueprintData';
import { parseBlueprintModules } from './layoutFile';

/**
 * Every blueprint the editor offers, discovered from the folder the dev-server
 * write endpoint saves into. Parsing/validation lives in `layoutFile.ts` (the
 * single home for raw-file validation), so this module is just the glob +
 * lookup. The glob is resolved at build time, so a file dropped into
 * `blueprints/` shows up once the dev server picks the new module up — which is
 * exactly what the Save Blueprint dialog tells the developer.
 *
 * Unlike `LEVELS` there are no built-in entries: nothing ships as a blueprint,
 * and the dropdown's blank `new` option comes from `BLANK_BLUEPRINT`.
 */
export const BLUEPRINTS: readonly Blueprint[] = parseBlueprintModules(
  import.meta.glob('./blueprints/*.json', { eager: true }),
);

export const findBlueprint = (id: string): Blueprint | undefined =>
  BLUEPRINTS.find((entry) => entry.id === id);
