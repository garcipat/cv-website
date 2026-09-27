# Contract — Generic Save Module & `LayoutFile`

**Feature**: `R-010-platformer-mapper-editor-unification`
**Requirements**: FR-011, FR-013; SC-004, SC-005
**Consumers**: `editor/dev/saveFile.ts`, `editor/dev/saveLevelFile.ts`,
`editor/dev/saveBlueprintFile.ts`, `editor/dev/layoutFileJson.ts`, `editor/editorActions.ts`,
`level/levelRegistry.ts`, `level/BlueprintData.ts`, `level/layoutFile.ts`

---

## 1. Generic save module (FR-011)

```ts
export interface SaveResult { written: boolean; path?: string; error?: string }

export function saveFile(opts: {
  endpoint: string;
  fileName: string;
  contents: string;
}): Promise<SaveResult>;

export function downloadFile(fileName: string, contents: string): void;
```

Rules:

- `saveFile` performs the exact current sequence: `POST` `{ fileName, contents }` as JSON to
  `endpoint`; on `response.ok` **and** a string `body.path`, resolve `{ written: true, path }`;
  otherwise `downloadFile(fileName, contents)` and resolve `{ written: false }` (plus `body.error`
  when present); on a thrown fetch, download and resolve `{ written: false }`.
- `downloadFile` creates, clicks and removes the anchor and revokes the object URL, exactly as
  today. It MUST be defined once.
- `saveLevel`/`saveBlueprint` are thin parameterisations:
  - level: `saveFile({ endpoint: SAVE_LEVEL_ENDPOINT, fileName: levelFileName(name), contents: layoutFileJson(name, layout, background, markers) })`
  - blueprint: `saveFile({ endpoint: SAVE_BLUEPRINT_ENDPOINT, fileName: blueprintFileName(name), contents: layoutFileJson(name, layout, background, markers) })`
- `levelFileName`/`blueprintFileName`/`blueprintId` keep their exact slug rules and fallbacks
  (`level`, `blueprint`, and the blueprint's `'new'` → `'new-1'` guard).
- `SAVE_LEVEL_ENDPOINT`, `SAVE_BLUEPRINT_ENDPOINT`, `DEV_ENVIRONMENT_ENDPOINT`, `LEVELS_FOLDER`,
  `BLUEPRINTS_FOLDER` remain the only target-specific values (and stay import-safe for the Node
  vite plugins).
- `layoutFileJson(name, layout, background, markers)` is the one serializer:
  `JSON.stringify({ name, layout, ...(hasBackgroundContent(background) ? { background } : {}), ...(markers.length > 0 ? { markers } : {}) }, null, 2) + '\n'`,
  where `hasBackgroundContent` is the single row-content check. Output is byte-identical to
  `levelFileJson`/`blueprintFileJson` today.

## 2. One `LayoutFile` raw shape (FR-013)

```ts
// level/rawLayoutFile.ts
export interface LayoutFile {
  readonly name?: string;
  readonly layout: readonly string[];
  readonly background?: readonly string[];
  readonly markers?: readonly MarkerPlacement[];
}
```

Rules:

- The sibling filename is deliberate: `level/LayoutFile.ts` would collide with the existing
  `level/layoutFile.ts` on the case-insensitive Windows filesystem (and under TypeScript's default
  `forceConsistentCasingInFileNames`).

- `LevelEntry` and `Blueprint` each `extend LayoutFile { id: string; name: string }` and MUST NOT
  redeclare `layout`/`background`/`markers`.
- `level/layoutFile.ts` remains the single validation home (`isLayout`/`isBackground`/`isMarkers`/
  `idFromPath`/`parseLevelModules`/`parseBlueprintModules`); the type move does not change any
  validation behaviour (M4 preserved).
- `LevelDef` is **not** an alias of `LayoutFile`; the parsed runtime artifact keeps its own shape.
- `isBlueprint` validation still routes through the shared validators unchanged.
