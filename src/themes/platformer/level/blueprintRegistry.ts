import { isBlueprint, type Blueprint } from './BlueprintData';

/** `'./blueprints/cave-room.json'` → `'cave-room'`. */
const idFromPath = (path: string): string =>
  path.split('/').pop()?.replace(/\.json$/, '') ?? path;

/**
 * Turns an `import.meta.glob` result into blueprint entries, skipping anything
 * malformed — same rule `levelRegistry.ts`'s `parseLevelModules` applies to
 * level JSON: a hand-edited or half-written file in `blueprints/` must not take
 * the editor down with it, it simply doesn't appear in the dropdown.
 *
 * Validation goes through step 44a's `isBlueprint` rather than a second set of
 * private checks, which is also why nothing here needs a cast: the guard
 * narrows the candidate object from `unknown` to `Blueprint`. A malformed
 * `background` costs only that field (the same forgiving behavior levels have),
 * because a decorative layer is never worth losing a whole room over.
 *
 * Kept separate from `BLUEPRINTS` below (which passes it the real glob) so the
 * validation is testable without writing fixture files into `blueprints/`.
 * Accepts both `{ default: {...} }` (how Vite hands over an eagerly-imported
 * JSON module) and a bare object, so tests can pass either.
 */
export const parseBlueprintModules = (modules: Record<string, unknown>): Blueprint[] =>
  Object.entries(modules)
    .map(([path, module]): Blueprint | null => {
      const raw =
        module !== null && typeof module === 'object' && 'default' in module
          ? (module as { default: unknown }).default
          : module;
      if (raw === null || typeof raw !== 'object') return null;

      const { name, layout, background } = raw as {
        name?: unknown;
        layout?: unknown;
        background?: unknown;
      };
      const id = idFromPath(path);
      const base: unknown = {
        id,
        name: typeof name === 'string' && name !== '' ? name : id,
        layout,
      };
      if (!isBlueprint(base)) return null;
      if (background === undefined) return base;

      const withBackground: unknown = { ...base, background };
      return isBlueprint(withBackground) ? withBackground : base;
    })
    .filter((entry): entry is Blueprint => entry !== null)
    .sort((a, b) => a.id.localeCompare(b.id));

/**
 * Every blueprint the editor offers, discovered from the folder the dev-server
 * write endpoint saves into. The glob is resolved at build time, so a file
 * dropped into `blueprints/` shows up once the dev server picks the new module
 * up — which is exactly what the Save Blueprint dialog tells the developer.
 *
 * Unlike `LEVELS` there are no built-in entries: nothing ships as a blueprint,
 * and the dropdown's blank `new` option comes from `BLANK_BLUEPRINT`.
 */
export const BLUEPRINTS: readonly Blueprint[] = parseBlueprintModules(
  import.meta.glob('./blueprints/*.json', { eager: true }),
);

export const findBlueprint = (id: string): Blueprint | undefined =>
  BLUEPRINTS.find((entry) => entry.id === id);
