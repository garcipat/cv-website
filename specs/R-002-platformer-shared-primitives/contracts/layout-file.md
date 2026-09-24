# Contract — `level/layoutFile.ts`

The single home for raw level/blueprint file validation and parsing (spec FR-012). Replaces the
copies in `levelRegistry.ts`, `BlueprintData.ts`, and `blueprintRegistry.ts`, and the weaker marker
validator in `editorState.ts`.

## Exports

```ts
export function idFromPath(path: string): string;                            // './levels/x.json' → 'x'
export function isLayout(value: unknown): value is string[];                 // non-empty array of strings
export function isBackground(value: unknown): value is string[];             // array of strings (may be empty)
export function isMarkers(value: unknown): value is MarkerPlacement[];       // entries have numeric col/row + marker.kind string
export function parseLevelModules(modules: Record<string, unknown>): LevelEntry[];
export function parseBlueprintModules(modules: Record<string, unknown>): Blueprint[];
```

## Consumer contract (FR-013)

| Consumer | Imports | Stops holding |
| --- | --- | --- |
| `level/levelRegistry.ts` | `idFromPath`, `isLayout`, `isBackground`, `isMarkers`, `parseLevelModules` | its own copies |
| `level/BlueprintData.ts` | `isLayout`, `isBackground`, `isMarkers` | its own copies |
| `level/blueprintRegistry.ts` | `idFromPath`, `parseBlueprintModules` | its own copies |
| `editor/editorState.ts` | `normalizeMarkerEntry` (from `level/LevelParser.ts`, made public) | its own weaker `isMarkerEntry` |

## Marker-kind validator (FR-014)

`LevelParser.normalizeMarkerEntry` is the complete validator (handles `patrolBoundary`,
`connectionPoint`, `fallingStalactite`, `sign` with `hintId` fallback, and `torch` with `strength`
fallback). It MUST be exported and used by the editor's marker guard so the `torch` kind round-trips:

```ts
const isMarkerEntry = (value: unknown): value is MarkerEntry => normalizeMarkerEntry(value) !== null;
```

**Bug fixed (SC-004):** a level saved with a torch marker retains it after reload, because the editor
no longer drops `{kind:'torch', strength}` entries.

## Invariants

1. **Forgiving, field-scoped** — a malformed `background`/`markers` costs only that field, never the
   whole level/blueprint (preserve the existing `isLayout` non-empty vs `isBackground` may-be-empty
   asymmetry).
2. **No `engine/` import** — `layoutFile.ts` is `level/` vocabulary; it must not import `engine/`.
3. **Exactly one home** — no consumer keeps a copy (FR-023).
