# Blueprint Rooms — Step 44c **Part 1** (Real Persistence, Registry, Dev-Environment Gate) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **This plan is PART 1 OF TWO.** Step 44c as written in the design doc is two independent
> deliverables bolted together: (a) replacing step 44a's `localStorage` blueprint stash with
> real files, a build-time registry and a dev-server write endpoint, and (b) placing a saved
> blueprint into a level with a blue/red validated preview. Each is the size of the whole of
> step 44a. Trying to write them as one plan produces something no implementer can hold in
> their head and no reviewer can check, so they are split at the seam the design itself
> already has (its two separate "Step 44c —" headings):
>
> - **Part 1 (this plan)** — `saveBlueprintFile.ts`, `saveBlueprintEndpoint.ts`, the
>   `vite/` write plugin, `blueprintRegistry.ts`, `/__dev-environment` +
>   `isDevEnvironmentSignal`, and the migration of `BlueprintSelect`/`LevelEditorPage` off
>   the stash. Ends with a working "save a blueprint to a real file, reopen it from the
>   dropdown after a reload, and see no Save buttons at all on a built site".
> - **Part 2 (`2026-09-06-blueprint-rooms-step44c-part2-plan.md`, to be written next)** —
>   the Palette's Blueprints section, arming a blueprint for placement, the preview overlay
>   with its blue/red border, the fit rule, and the two-click commit. Part 2 depends on Part
>   1's `BLUEPRINTS` registry existing; nothing in Part 1 depends on Part 2.
>
> **Appendix A at the end of this plan is Part 2's design contract** — the arming mechanism
> and the full fit/commit algorithm, with hand-verified coordinate arithmetic and the
> settled overlap-only fit rule (no open questions remain — the one the appendix's first
> draft raised was resolved with the project owner and the design doc updated accordingly).
> It is written here, now, because those decisions constrain what Part 1
> exports (`BLUEPRINTS`, `Blueprint`), and because they are the part of step 44c most likely
> to drift if left unwritten. **Do not implement Appendix A in this plan.**

**Goal:** A blueprint saved in the Level Editor becomes a real JSON file in
`src/themes/platformer/level/blueprints/`, written straight there by the dev server exactly
the way a saved level already is, and is discovered at build time by a
`blueprintRegistry.ts` that mirrors `levelRegistry.ts`. The step-44a `localStorage` stash is
deleted. A new `/__dev-environment` route, answered only by the dev server, tells the editor
whether it is running behind `npm run dev`; both the existing **Save** control and the new
**Save Blueprint** control disappear entirely on a built or statically-served site instead of
silently falling back to a browser download.

**Architecture:** Two mirrors and one new gate. The save path is a straight mirror of the
level save path — `saveBlueprintEndpoint.ts` (constants shared with Node),
`saveBlueprintFile.ts` (`blueprintFileName`/`blueprintFileJson`/`saveBlueprint`/
`downloadBlueprintFile`), `vite/writeBlueprintFile.ts` and `vite/blueprintWritePlugin.ts`
(`apply: 'serve'`) — with one deliberate refactor: the *validation and filesystem write*
half of `writeLevelFile.ts` is extracted into a shared `vite/writeLayoutJsonFile.ts` that
both writers delegate to, since that is the half with real security consequences
(path-traversal, filename shape) and duplicating it would mean two places to get it right
forever. The read path is a mirror of `levelRegistry.ts`: `blueprintRegistry.ts` globs
`./blueprints/*.json` eagerly and validates each module through the `isBlueprint` guard step
44a already wrote, so no validator is duplicated at all. The dev gate is a signal
(`isDevEnvironmentSignal`) that starts `false` and is only ever written `true`, by a
one-shot `probeDevEnvironment()` ping on the editor page's mount.

**Tech Stack:** React 19 + TypeScript strict, Vitest + React Testing Library, Vite 6 plugins
(Node side), `@preact/signals-react` for reactive editor state.

**Spec:** `specs/S-006-platformer-theme/plans/2026-09-06-blueprint-rooms-design.md` — its
"Step 44c — Saving and the palette library" section including "Hiding dev-only actions when
there's no dev server". Its "Step 44c — Placement" section and the `Palette.tsx` Blueprints
section are explicitly **NOT** in this plan (see Appendix A / Part 2).
`specs/S-006-platformer-theme/roadmap.md` step 44c is the one-line pointer; note that entry
covers both parts, so it stays unticked until Part 2 lands.

## Global Constraints

- TypeScript `strict: true`, no `any`, no `@ts-ignore` (constitution Principle I / III).
- Tests first (constitution Principle II — TDD, NON-NEGOTIABLE). New test names follow
  `{method}-{Condition}-{ExpectedResult}`, matching each target file's own house style.
  `vite/writeLevelFile.test.ts` and `vite/levelWritePlugin.test.ts` are the models for the
  Node-side tests; `saveLevelFile.test.ts` and `levelRegistry.test.ts` for the browser-side
  ones. All four import `describe`/`it`/`expect` explicitly — keep doing so in their new
  counterparts.
- Named arrow function exports for components with the props interface in the same file, no
  default exports (constitution Principle III). Pure helpers are plain
  `export const`/`export function`, matching `saveLevelFile.ts`.
- Relative imports (`./`, `../`) within `src/themes/platformer/`; `@/` for `src/lib`,
  `src/components`. `vite/` modules reach into `src/` with a relative path
  (`../src/themes/platformer/editor/...`), exactly as `writeLevelFile.ts` already does — the
  `@` alias is a Vite `resolve.alias`, not available to config-time Node code.
- No new dependencies. No new shadcn/ui components.
- **Anything under `vite/` runs in Node inside `vite.config.ts`.** It may import only
  import-free constant modules from `src/` (`saveBlueprintEndpoint.ts`,
  `devEnvironmentEndpoint.ts`) — never a module that pulls in React, signals, or a `.tsx`
  file. `saveLevelEndpoint.ts`'s doc comment already states this rule; the two new constant
  modules repeat it.
- **`EditorCanvas.tsx`, `Palette.tsx`, `paintCell.ts`, `growGrid.ts`, `importLayout.ts`,
  `exportLayout.ts`, `cropLevelForExport.ts`, `LevelParser.ts`, `LevelData.ts`,
  `Terrain.ts`, `editorLevelState.ts` are NOT modified by this plan.** Every one of them is
  a Part 2 concern or untouched by either part. If a task appears to need one of them, stop
  — something has drifted from this design.
- **`blueprintStash.ts` and `blueprintStash.test.ts` are DELETED** by Task 9. Until then
  they stay, and the suite stays green at every commit.
- Vitest runs with `globals: true` (confirmed in `vitest.config.ts`), but every file this
  plan creates or edits already imports its test helpers explicitly — match that.
- **Known pre-existing failures, out of scope.** This branch's base already has 9
  `npx tsc -b --noEmit` errors, all of them the same `BlockKind`/`potionPot` desync
  (`editor/gridRenderState.ts`, `entities/blocks/PotionPot.test.ts`,
  `level/BlockMapper.ts`, `PlatformerPage.test.tsx`, `PlatformerState.test.ts` ×2,
  `PlatformerState.ts` ×2), and one `npm run lint` error —
  `react-hooks/set-state-in-effect` at
  `src/themes/platformer/components/ControlsOverlay.tsx:125` (note the `components/`
  segment). They are unrelated to
  blueprint rooms, they were there before this plan started, and **fixing them is not part
  of this work**. Record the exact baseline output of both commands before Task 1 and
  compare against it at Task 11 — the bar is "no NEW error", not "zero errors". Do not
  spend time on the pre-existing ones and do not let them block a task.

---

## File Structure

- **Create** `src/themes/platformer/editor/saveBlueprintEndpoint.ts` — `BLUEPRINTS_FOLDER`,
  `SAVE_BLUEPRINT_ENDPOINT`.
- **Create** `src/themes/platformer/editor/saveBlueprintFile.ts`
- **Create** `src/themes/platformer/editor/saveBlueprintFile.test.ts`
- **Create** `vite/writeLayoutJsonFile.ts` — the shared validate-and-write half.
- **Create** `vite/writeLayoutJsonFile.test.ts`
- **Modify** `vite/writeLevelFile.ts` — delegates to the shared writer.
- **Create** `vite/writeBlueprintFile.ts`
- **Create** `vite/writeBlueprintFile.test.ts`
- **Create** `vite/blueprintWritePlugin.ts`
- **Create** `vite/blueprintWritePlugin.test.ts`
- **Create** `src/themes/platformer/level/blueprintRegistry.ts`
- **Create** `src/themes/platformer/level/blueprintRegistry.test.ts`
- **Create** `src/themes/platformer/level/blueprints/.gitkeep`
- **Create** `src/themes/platformer/editor/devEnvironmentEndpoint.ts`
- **Create** `src/themes/platformer/editor/devEnvironment.ts` — `isDevEnvironmentSignal`,
  `probeDevEnvironment`.
- **Create** `src/themes/platformer/editor/devEnvironment.test.ts`
- **Create** `vite/devEnvironmentPlugin.ts`
- **Create** `vite/devEnvironmentPlugin.test.ts`
- **Modify** `vite.config.ts` — registers the two new plugins.
- **Modify** `src/themes/platformer/editor/BlueprintSelect.tsx` — reads the registry.
- **Modify** `src/themes/platformer/editor/BlueprintSelect.test.tsx`
- **Modify** `src/themes/platformer/editor/LevelEditorPage.tsx` — real blueprint save, and
  the dev-environment gate on both Save controls.
- **Modify** `src/themes/platformer/editor/LevelEditorPage.test.tsx`
- **Delete** `src/themes/platformer/editor/blueprintStash.ts`
- **Delete** `src/themes/platformer/editor/blueprintStash.test.ts`

Not modified: `EditorCanvas.tsx`, `Palette.tsx`, `paletteTiles.ts`, `editorLevelState.ts`,
`paintCell.ts`, `growGrid.ts`, `importLayout.ts`, `exportLayout.ts`,
`cropLevelForExport.ts`, `BlueprintData.ts`, `levelRegistry.ts`, `LevelSelect.tsx`,
`saveLevelFile.ts`, `saveLevelEndpoint.ts`, `levelWritePlugin.ts`, `LevelParser.ts`,
`LevelData.ts`, `Terrain.ts`.

- [ ] **Step 0: Record the pre-existing failure baseline**

```bash
npx tsc -b --noEmit ; npm run lint
```

Save both outputs somewhere you can diff against at Task 11. Expected today: 9
`BlockKind`/`potionPot` type errors and one lint error in
`src/themes/platformer/components/ControlsOverlay.tsx`. Those are
the baseline, not your problem (see Global Constraints).

---

### Task 1: `saveBlueprintFile` — the browser side of saving a blueprint

**Files:**
- Create: `src/themes/platformer/editor/saveBlueprintEndpoint.ts`
- Create: `src/themes/platformer/editor/saveBlueprintFile.ts`
- Create: `src/themes/platformer/editor/saveBlueprintFile.test.ts`

**Interfaces:**
- Consumes: `BLANK_BLUEPRINT` (`../level/BlueprintData`), `BackgroundPlacement`
  (`../level/LevelData`).
- Produces: `BLUEPRINTS_FOLDER`, `SAVE_BLUEPRINT_ENDPOINT`, `blueprintId(name)`,
  `blueprintFileName(name)`, `blueprintFileJson(name, layout, background)`,
  `SaveBlueprintResult`, `saveBlueprint(name, layout, background)`,
  `downloadBlueprintFile(name, layout, background)`.
- Consumed by: Task 3 and Task 4 (the folder/endpoint constants, from Node), Task 9
  (`LevelEditorPage`).

**Why `blueprintId` survives the stash's deletion.** It is the one piece of
`blueprintStash.ts` that is not a placeholder: it carries the `'new'` collision guard step
44a discovered. `BLANK_BLUEPRINT.id` is `'new'`, and the save dialog pre-fills the name field
with the currently-loaded blueprint's name — which starts out as `'new'`. Slugging that
straight through would produce `new.json`, whose registry id (`'new'`, the filename stem)
collides with the dropdown's built-in blank entry: `Array.prototype.find` would always
resolve to the blank one, and two `<SelectItem>`s would share a key. That hazard is *worse*
with real files than it was with the stash, because the file persists. So the rule moves
here verbatim, and `blueprintFileName` is defined in terms of it, so a file's stem and its
registry id can never disagree.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/themes/platformer/editor/saveBlueprintFile.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  blueprintId,
  blueprintFileName,
  blueprintFileJson,
  downloadBlueprintFile,
  saveBlueprint,
} from './saveBlueprintFile';
import { SAVE_BLUEPRINT_ENDPOINT } from './saveBlueprintEndpoint';

const LAYOUT = ['#G#'];

describe('blueprintId', () => {
  it('nameWithSpacesAndCaps-slugsToLowercaseHyphens', () => {
    expect(blueprintId('Cave Room Two')).toBe('cave-room-two');
  });

  it('nameWithNothingSlugWorthy-fallsBackToBlueprint', () => {
    expect(blueprintId('!!!')).toBe('blueprint');
  });

  it('nameThatSlugsToTheBlankEntrysId-isDisambiguated', () => {
    // BLANK_BLUEPRINT.id is 'new' and the save dialog pre-fills that name, so
    // an un-renamed save would otherwise write new.json and shadow the
    // dropdown's own blank entry forever.
    expect(blueprintId('new')).toBe('new-1');
    expect(blueprintId('New')).toBe('new-1');
  });
});

describe('blueprintFileName', () => {
  it('plainName-getsAJsonExtension', () => {
    expect(blueprintFileName('cave')).toBe('cave.json');
  });

  it('mixedCaseNameWithSpaces-isLowercasedAndHyphenated', () => {
    expect(blueprintFileName('Cave Room Two')).toBe('cave-room-two.json');
  });

  it('punctuationAndRunsOfSeparators-collapseToSingleHyphens', () => {
    expect(blueprintFileName('Cave!! __ Room??  Two')).toBe('cave-room-two.json');
  });

  it('leadingAndTrailingSeparators-areTrimmed', () => {
    expect(blueprintFileName('  -- cave room -- ')).toBe('cave-room.json');
  });

  it('emptyName-fallsBackToBlueprint', () => {
    expect(blueprintFileName('')).toBe('blueprint.json');
  });

  it('isAlwaysItsOwnRegistryIdPlusJson', () => {
    // The registry derives an id from the filename stem, so these two can
    // never be allowed to drift apart.
    expect(blueprintFileName('Cave Room')).toBe(`${blueprintId('Cave Room')}.json`);
  });
});

describe('blueprintFileJson', () => {
  it('holdsTheGivenNameAndLayout', () => {
    expect(JSON.parse(blueprintFileJson('Cave Room', LAYOUT, []))).toEqual({
      name: 'Cave Room',
      layout: LAYOUT,
    });
  });

  it('isPrettyPrintedSoTheFileIsReadableInTheRepo', () => {
    expect(blueprintFileJson('Cave Room', LAYOUT, [])).toContain('\n  "name"');
  });

  it('endsWithANewline', () => {
    expect(blueprintFileJson('Cave Room', LAYOUT, []).endsWith('\n')).toBe(true);
  });

  it('nonEmptyBackground-isIncludedInTheSerializedJson', () => {
    const json = blueprintFileJson('Cave Room', LAYOUT, [
      { pieceId: 'dirtColumnTop1x1', col: 0, row: 0 },
    ]);

    expect(JSON.parse(json)).toEqual({
      name: 'Cave Room',
      layout: LAYOUT,
      background: [{ pieceId: 'dirtColumnTop1x1', col: 0, row: 0 }],
    });
  });

  it('emptyBackground-isOmittedFromTheSerializedJson', () => {
    expect(JSON.parse(blueprintFileJson('Plain', LAYOUT, []))).toEqual({
      name: 'Plain',
      layout: LAYOUT,
    });
  });

  it('connectionPointCharacters-surviveSerializationUntouched', () => {
    // Step 44b's '+' is an ordinary layout character; the file format has to
    // carry it, since Part 2 reads connection points back out of `layout`.
    expect(JSON.parse(blueprintFileJson('Room', ['#+#'], [])).layout).toEqual(['#+#']);
  });
});

describe('downloadBlueprintFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const setUpObjectUrl = () => {
    const createObjectURL = vi.fn(() => 'blob:blueprint');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    return { createObjectURL, revokeObjectURL };
  };

  it('clicksAnAnchorCarryingTheSlugifiedFilename', () => {
    setUpObjectUrl();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlueprintFile('Cave Room', LAYOUT, []);

    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('cave-room.json');
    expect(anchor.href).toContain('blob:blueprint');
  });

  it('revokesTheObjectUrlItCreated', () => {
    const { createObjectURL, revokeObjectURL } = setUpObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlueprintFile('Cave Room', LAYOUT, []);

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:blueprint');
  });

  it('leavesNoAnchorBehindInTheDocument', () => {
    setUpObjectUrl();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadBlueprintFile('Cave Room', LAYOUT, []);

    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });
});

describe('saveBlueprint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const stubDownload = () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:blueprint'),
      revokeObjectURL: vi.fn(),
    });
    return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  };

  const stubFetch = (response: Partial<Response> | Error) => {
    const fetchMock = vi.fn(() =>
      response instanceof Error ? Promise.reject(response) : Promise.resolve(response as Response),
    );
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  const okResponse = (path: string): Partial<Response> => ({
    ok: true,
    json: () => Promise.resolve({ path }),
  });

  it('devServerAccepts-postsTheSlugifiedFileNameAndContentsToTheWriteEndpoint', async () => {
    const fetchMock = stubFetch(
      okResponse('src/themes/platformer/level/blueprints/cave-room.json'),
    );

    await saveBlueprint('Cave Room', LAYOUT, []);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SAVE_BLUEPRINT_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      fileName: 'cave-room.json',
      contents: blueprintFileJson('Cave Room', LAYOUT, []),
    });
  });

  it('devServerAccepts-reportsTheWrittenPathAndDoesNotDownloadAnything', async () => {
    stubFetch(okResponse('src/themes/platformer/level/blueprints/cave-room.json'));
    const click = stubDownload();

    const result = await saveBlueprint('Cave Room', LAYOUT, []);

    expect(result).toEqual({
      written: true,
      path: 'src/themes/platformer/level/blueprints/cave-room.json',
    });
    expect(click).not.toHaveBeenCalled();
  });

  it('endpointMissing-fallsBackToDownloadingTheFile', async () => {
    stubFetch({ ok: false, status: 404, json: () => Promise.resolve({}) });
    const click = stubDownload();

    const result = await saveBlueprint('Cave Room', LAYOUT, []);

    expect(result.written).toBe(false);
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe('cave-room.json');
  });

  it('fetchThrows-fallsBackToDownloadingTheFile', async () => {
    stubFetch(new Error('offline'));
    const click = stubDownload();

    const result = await saveBlueprint('Cave Room', LAYOUT, []);

    expect(result.written).toBe(false);
    expect(click).toHaveBeenCalledOnce();
  });

  it('endpointRejectsTheBlueprint-reportsTheServersReasonAndStillDownloads', async () => {
    stubFetch({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'fileName must be a slugified name ending in .json' }),
    });
    const click = stubDownload();

    const result = await saveBlueprint('Cave Room', LAYOUT, []);

    expect(result).toEqual({
      written: false,
      error: 'fileName must be a slugified name ending in .json',
    });
    expect(click).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/saveBlueprintFile.test.ts`
Expected: FAIL — `Cannot find module './saveBlueprintFile'`. Do not continue until you have
seen that failure output.

- [ ] **Step 3: Write the endpoint constants**

```typescript
// src/themes/platformer/editor/saveBlueprintEndpoint.ts
/**
 * Constants shared by the browser-side editor and the dev-server plugin that
 * writes its saved blueprints to disk (`vite/writeBlueprintFile.ts`).
 * Deliberately free of imports: the plugin runs in Node inside
 * `vite.config.ts`, so anything reachable from here must be safe for both
 * runtimes. Exact counterpart of `saveLevelEndpoint.ts`.
 */

/** Where saved blueprint files live, relative to the repository root. */
export const BLUEPRINTS_FOLDER = 'src/themes/platformer/level/blueprints/';

/**
 * Dev-server route the editor POSTs a saved blueprint to. Double-underscored
 * to mark it as tooling rather than anything the real site serves — it exists
 * only while `npm run dev` is running (the plugin is `apply: 'serve'`).
 */
export const SAVE_BLUEPRINT_ENDPOINT = '/__save-blueprint';
```

- [ ] **Step 4: Write the save module**

```typescript
// src/themes/platformer/editor/saveBlueprintFile.ts
import { BLUEPRINTS_FOLDER, SAVE_BLUEPRINT_ENDPOINT } from './saveBlueprintEndpoint';
import { BLANK_BLUEPRINT } from '../level/BlueprintData';
import type { BackgroundPlacement } from '../level/LevelData';

export { BLUEPRINTS_FOLDER };

/**
 * `'Cave Room Two'` → `'cave-room-two'`. The same slug rule
 * `saveLevelFile.ts`'s `levelFileName` uses, minus the extension, since a
 * blueprint's registry id is its filename stem (see `blueprintRegistry.ts`).
 * A name with nothing slug-worthy in it still has to produce a writable file,
 * hence the `blueprint` fallback.
 *
 * The extra `'new'` guard is not cosmetic: `BLANK_BLUEPRINT.id` is `'new'` and
 * the Save dialog pre-fills the name field with the loaded blueprint's name,
 * which starts out as `'new'` too. Accepting that default would write
 * `new.json`, whose id shadows the dropdown's own built-in blank entry —
 * `find` would always resolve to the blank one and two `<SelectItem>`s would
 * share a key. Suffixing keeps the two apart permanently.
 */
export const blueprintId = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const stem = slug === '' ? 'blueprint' : slug;
  return stem === BLANK_BLUEPRINT.id ? `${stem}-1` : stem;
};

/** The blueprint's filename — always exactly its registry id plus `.json`, so
 *  the file's stem and the id derived back out of it cannot drift apart. */
export const blueprintFileName = (name: string): string => `${blueprintId(name)}.json`;

/**
 * The file's contents: the blueprint's name plus its already-cropped layout,
 * pretty-printed and newline-terminated so the file reads like the rest of the
 * repo's JSON. `background` is only included when it holds placements,
 * matching `levelFileJson` exactly — a `Blueprint` is deliberately the same
 * `{ name, layout, background? }` shape a saved level file is.
 *
 * Takes the cropped `layout` (and `background`, already rebased against the
 * same origin) rather than a raw grid, for the same reason `levelFileJson`
 * does: re-cropping here with the foreground-only `exportLayout` would
 * silently undo the caller's `cropLevelForExport` union crop.
 */
export const blueprintFileJson = (
  name: string,
  layout: readonly string[],
  background: BackgroundPlacement[],
): string =>
  `${JSON.stringify(
    { name, layout, ...(background.length > 0 ? { background } : {}) },
    null,
    2,
  )}\n`;

export interface SaveBlueprintResult {
  /** True when the dev server wrote the file into `BLUEPRINTS_FOLDER` itself. */
  written: boolean;
  /** Repository-relative path of the written file, when it was written. */
  path?: string;
  /** Why the dev server refused, when it answered but declined to write. */
  error?: string;
}

/**
 * Saves the blueprint the way the developer actually wants it saved: POSTed to
 * the dev server, which writes it straight into `BLUEPRINTS_FOLDER` — the
 * folder `blueprintRegistry.ts` globs — so it needs no moving afterwards.
 *
 * The endpoint only exists while `npm run dev` is running (its plugin is
 * `apply: 'serve'`), so anything else falls back to a plain download. That
 * fallback is kept even though the Save control itself is now hidden off the
 * dev server (`isDevEnvironmentSignal`, see `devEnvironment.ts`): the gate is
 * a UI affordance, not a guarantee, and a dev server whose plugin failed to
 * register would otherwise lose the author's work outright.
 */
export const saveBlueprint = async (
  name: string,
  layout: readonly string[],
  background: BackgroundPlacement[],
): Promise<SaveBlueprintResult> => {
  try {
    const response = await fetch(SAVE_BLUEPRINT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: blueprintFileName(name),
        contents: blueprintFileJson(name, layout, background),
      }),
    });
    const body = (await response.json()) as { path?: string; error?: string };

    if (response.ok && typeof body.path === 'string') {
      return { written: true, path: body.path };
    }

    downloadBlueprintFile(name, layout, background);
    return body.error === undefined ? { written: false } : { written: false, error: body.error };
  } catch {
    // No dev server behind this page at all (built site, or served statically).
    downloadBlueprintFile(name, layout, background);
    return { written: false };
  }
};

export const downloadBlueprintFile = (
  name: string,
  layout: readonly string[],
  background: BackgroundPlacement[],
): void => {
  const blob = new Blob([blueprintFileJson(name, layout, background)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = blueprintFileName(name);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/saveBlueprintFile.test.ts`
Expected: PASS (23 tests — 3 `blueprintId`, 6 `blueprintFileName`, 6 `blueprintFileJson`,
3 `downloadBlueprintFile`, 5 `saveBlueprint`).

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/editor/saveBlueprintEndpoint.ts src/themes/platformer/editor/saveBlueprintFile.ts src/themes/platformer/editor/saveBlueprintFile.test.ts
git commit -m "feat(platformer): add the browser-side blueprint file save path"
```

---

### Task 2: Extract the shared dev-server file writer

**Files:**
- Create: `vite/writeLayoutJsonFile.ts`
- Create: `vite/writeLayoutJsonFile.test.ts`
- Modify: `vite/writeLevelFile.ts`

**Interfaces:**
- Produces: `LayoutWriteRequest`, `LayoutWriteResult`,
  `writeLayoutJsonFile(root, folder, request)`.
- Consumed by: `writeLevelFile.ts` (this task) and Task 3's `writeBlueprintFile.ts`.

**Why extract rather than mirror.** Everything else in step 44c is a deliberate mirror, but
this one function is different in kind: it is the only place in the repository where a
request body decides a filesystem path. Its three defenses — the slug-only filename pattern,
the `resolve`-vs-`join` escape check, and the "is this JSON the registry would accept" check
— have to be right in every copy, forever. One shared function with one set of tests is the
honest shape; the *plugin* wrappers around it stay separate mirrors, because those are Vite
middleware boilerplate whose only variable parts are a name, an endpoint and a writer.

**Verified safe against the existing suite before writing a line:** `writeLevelFile.test.ts`
asserts only `result.status`, `result.body.path`, `expect(result.body.error).toBeTruthy()`
and the file's contents — it never asserts the *text* of an error message, so generalizing
`'resolved path is outside the levels folder'` to `'…outside the target folder'` breaks
nothing. `levelWritePlugin.test.ts` likewise asserts only status codes, the JSON envelope's
`path`, and `error` being truthy.

- [ ] **Step 1: Write the failing tests**

```typescript
// vite/writeLayoutJsonFile.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeLayoutJsonFile } from './writeLayoutJsonFile';

const FOLDER = 'some/nested/folder/';
const VALID_CONTENTS = `${JSON.stringify({ name: 'Room', layout: ['#G#'] }, null, 2)}\n`;

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'layout-write-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const targetPath = (fileName: string) => join(root, FOLDER, fileName);

describe('writeLayoutJsonFile', () => {
  it('validRequest-writesTheFileIntoTheGivenFolder', () => {
    const result = writeLayoutJsonFile(root, FOLDER, {
      fileName: 'room.json',
      contents: VALID_CONTENTS,
    });

    expect(result.status).toBe(200);
    expect(readFileSync(targetPath('room.json'), 'utf8')).toBe(VALID_CONTENTS);
  });

  it('validRequest-reportsThePathItWroteRelativeToTheRepositoryRoot', () => {
    const result = writeLayoutJsonFile(root, FOLDER, {
      fileName: 'room.json',
      contents: VALID_CONTENTS,
    });

    expect(result.body.path).toBe(`${FOLDER}room.json`);
  });

  it('missingFolder-isCreatedRatherThanFailing', () => {
    expect(existsSync(join(root, FOLDER))).toBe(false);

    writeLayoutJsonFile(root, FOLDER, { fileName: 'room.json', contents: VALID_CONTENTS });

    expect(existsSync(targetPath('room.json'))).toBe(true);
  });

  it('existingFileOfTheSameName-isOverwritten', () => {
    mkdirSync(join(root, FOLDER), { recursive: true });
    writeFileSync(targetPath('room.json'), 'stale', 'utf8');

    writeLayoutJsonFile(root, FOLDER, { fileName: 'room.json', contents: VALID_CONTENTS });

    expect(readFileSync(targetPath('room.json'), 'utf8')).toBe(VALID_CONTENTS);
  });

  it('fileNameThatEscapesTheFolder-isRejectedWithoutWritingAnything', () => {
    const result = writeLayoutJsonFile(root, FOLDER, {
      fileName: '../../evil.json',
      contents: VALID_CONTENTS,
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBeTruthy();
    expect(existsSync(join(root, FOLDER))).toBe(false);
  });

  it('contentsWithoutAUsableLayout-isRejectedWithoutWritingAnything', () => {
    const result = writeLayoutJsonFile(root, FOLDER, {
      fileName: 'room.json',
      contents: '{ "name": "Room" }',
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBeTruthy();
    expect(existsSync(targetPath('room.json'))).toBe(false);
  });
});
```

The exhaustive rejection tables (10 filename shapes, 7 content shapes) stay where they are,
in `vite/writeLevelFile.test.ts` — after this task they exercise this shared function through
the delegate, which is exactly the coverage that matters.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run vite/writeLayoutJsonFile.test.ts`
Expected: FAIL — `Cannot find module './writeLayoutJsonFile'`. Do not continue until you
have seen that failure output.

- [ ] **Step 3: Write the shared writer**

```typescript
// vite/writeLayoutJsonFile.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface LayoutWriteRequest {
  fileName: unknown;
  contents: unknown;
}

export interface LayoutWriteResult {
  status: number;
  body: { path?: string; error?: string };
}

/**
 * A slugified filename and nothing else — the same shape `levelFileName` and
 * `blueprintFileName` produce (lowercase, hyphen-separated, `.json`). Anything
 * with a path separator, a `..`, a drive letter, or another extension fails
 * this, which is the first half of keeping the write inside the target folder.
 */
const FILE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*\.json$/;

const isLayoutJson = (contents: string): boolean => {
  try {
    const parsed: unknown = JSON.parse(contents);
    if (parsed === null || typeof parsed !== 'object') return false;
    const { layout } = parsed as { layout?: unknown };
    return (
      Array.isArray(layout) && layout.length > 0 && layout.every((row) => typeof row === 'string')
    );
  } catch {
    return false;
  }
};

const reject = (error: string): LayoutWriteResult => ({ status: 400, body: { error } });

/**
 * Writes one saved layout file (a level or a blueprint — they are the same
 * `{ name, layout, background? }` JSON shape) into `<root>/<folder>`, the
 * folder its registry globs, so a file saved in the editor lands where it will
 * be loaded from instead of in the browser's downloads (spec FR-032).
 *
 * Shared by `writeLevelFile.ts` and `writeBlueprintFile.ts` rather than
 * duplicated: this only ever runs in the dev server, but it is still a
 * filesystem write driven by a request body, and its three defenses — bare
 * slug filename, resolved path inside the folder, contents the registry would
 * actually accept — must hold identically for both. A request failing any of
 * them writes nothing at all.
 */
export const writeLayoutJsonFile = (
  root: string,
  folder: string,
  request: LayoutWriteRequest,
): LayoutWriteResult => {
  const { fileName, contents } = request;

  if (typeof fileName !== 'string' || !FILE_NAME_PATTERN.test(fileName)) {
    return reject('fileName must be a slugified name ending in .json');
  }
  if (typeof contents !== 'string' || contents === '') {
    return reject('contents must be a non-empty string');
  }
  if (!isLayoutJson(contents)) {
    return reject('contents must be JSON with a non-empty layout array of strings');
  }

  const targetDir = resolve(root, folder);
  const target = resolve(targetDir, fileName);
  // Belt-and-braces against the pattern above ever being loosened: a target
  // that escaped the folder is refused rather than written.
  if (target !== join(targetDir, fileName)) {
    return reject('resolved path is outside the target folder');
  }

  try {
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(target, contents, 'utf8');
  } catch (error) {
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : 'write failed' },
    };
  }

  return { status: 200, body: { path: `${folder}${fileName}` } };
};
```

- [ ] **Step 4: Point `writeLevelFile` at it**

Replace the whole body of `vite/writeLevelFile.ts` with:

```typescript
// vite/writeLevelFile.ts
import { LEVELS_FOLDER } from '../src/themes/platformer/editor/saveLevelEndpoint';
import {
  writeLayoutJsonFile,
  type LayoutWriteRequest,
  type LayoutWriteResult,
} from './writeLayoutJsonFile';

export type LevelWriteRequest = LayoutWriteRequest;
export type LevelWriteResult = LayoutWriteResult;

/**
 * Writes one saved level into `<root>/<LEVELS_FOLDER>`, the folder the level
 * registry globs — so a level saved in the editor lands where it will be
 * loaded from, instead of in the browser's downloads (spec FR-032).
 *
 * All validation (slug-only filename, no path escape, JSON the registry would
 * accept) lives in `writeLayoutJsonFile`, shared with the blueprint writer
 * next to it: the two differ only in which folder they target.
 */
export const writeLevelFile = (root: string, request: LevelWriteRequest): LevelWriteResult =>
  writeLayoutJsonFile(root, LEVELS_FOLDER, request);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run vite/`
Expected: PASS — the 6 new tests plus every pre-existing test in
`writeLevelFile.test.ts` (21 — 4 top-level, plus the 10-shape filename table and the
7-shape contents table) and `levelWritePlugin.test.ts` (9), **all unedited**. Those two
files passing untouched is the whole proof that the extraction was behavior-preserving; if
one fails, fix `writeLayoutJsonFile`, never the test.

- [ ] **Step 6: Commit**

```bash
git add vite/writeLayoutJsonFile.ts vite/writeLayoutJsonFile.test.ts vite/writeLevelFile.ts
git commit -m "refactor(vite): share the dev-server layout-file writer between save endpoints"
```

---

### Task 3: `writeBlueprintFile` — the Node side of the blueprint write

**Files:**
- Create: `vite/writeBlueprintFile.ts`
- Create: `vite/writeBlueprintFile.test.ts`

**Interfaces:**
- Consumes: `writeLayoutJsonFile` (Task 2), `BLUEPRINTS_FOLDER`
  (`../src/themes/platformer/editor/saveBlueprintEndpoint`).
- Produces: `BlueprintWriteRequest`, `BlueprintWriteResult`,
  `writeBlueprintFile(root, request)`.
- Consumed by: Task 4's plugin.

- [ ] **Step 1: Write the failing tests**

```typescript
// vite/writeBlueprintFile.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeBlueprintFile } from './writeBlueprintFile';
import { BLUEPRINTS_FOLDER } from '../src/themes/platformer/editor/saveBlueprintEndpoint';

const VALID_CONTENTS = `${JSON.stringify({ name: 'Cave Room', layout: ['#+#', '#.#'] }, null, 2)}\n`;

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'blueprint-write-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const blueprintsPath = (fileName: string) => join(root, BLUEPRINTS_FOLDER, fileName);

describe('writeBlueprintFile', () => {
  it('validRequest-writesTheFileIntoTheBlueprintsFolderNotTheLevelsFolder', () => {
    const result = writeBlueprintFile(root, {
      fileName: 'cave-room.json',
      contents: VALID_CONTENTS,
    });

    expect(result.status).toBe(200);
    expect(readFileSync(blueprintsPath('cave-room.json'), 'utf8')).toBe(VALID_CONTENTS);
    expect(existsSync(join(root, 'src/themes/platformer/level/levels/cave-room.json'))).toBe(false);
  });

  it('validRequest-reportsThePathItWroteRelativeToTheRepositoryRoot', () => {
    const result = writeBlueprintFile(root, {
      fileName: 'cave-room.json',
      contents: VALID_CONTENTS,
    });

    expect(result.body.path).toBe(`${BLUEPRINTS_FOLDER}cave-room.json`);
  });

  it('missingBlueprintsFolder-isCreatedRatherThanFailing', () => {
    expect(existsSync(join(root, BLUEPRINTS_FOLDER))).toBe(false);

    writeBlueprintFile(root, { fileName: 'cave-room.json', contents: VALID_CONTENTS });

    expect(existsSync(blueprintsPath('cave-room.json'))).toBe(true);
  });

  it('fileNameThatEscapesTheBlueprintsFolder-isRejectedWithoutWriting', () => {
    const result = writeBlueprintFile(root, {
      fileName: '../../evil.json',
      contents: VALID_CONTENTS,
    });

    expect(result.status).toBe(400);
    expect(existsSync(join(root, 'evil.json'))).toBe(false);
  });

  it('contentsTheRegistryWouldNotAccept-isRejectedWithoutWriting', () => {
    const result = writeBlueprintFile(root, {
      fileName: 'cave-room.json',
      contents: '{ "layout": [] }',
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBeTruthy();
    expect(existsSync(blueprintsPath('cave-room.json'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run vite/writeBlueprintFile.test.ts`
Expected: FAIL — `Cannot find module './writeBlueprintFile'`. Do not continue until you have
seen that failure output.

- [ ] **Step 3: Write the implementation**

```typescript
// vite/writeBlueprintFile.ts
import { BLUEPRINTS_FOLDER } from '../src/themes/platformer/editor/saveBlueprintEndpoint';
import {
  writeLayoutJsonFile,
  type LayoutWriteRequest,
  type LayoutWriteResult,
} from './writeLayoutJsonFile';

export type BlueprintWriteRequest = LayoutWriteRequest;
export type BlueprintWriteResult = LayoutWriteResult;

/**
 * Writes one saved blueprint into `<root>/<BLUEPRINTS_FOLDER>`, the folder
 * `blueprintRegistry.ts` globs — the blueprint counterpart of
 * `writeLevelFile.ts`, differing from it in nothing but the target folder,
 * which is exactly why both delegate to the same validated writer.
 */
export const writeBlueprintFile = (
  root: string,
  request: BlueprintWriteRequest,
): BlueprintWriteResult => writeLayoutJsonFile(root, BLUEPRINTS_FOLDER, request);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run vite/writeBlueprintFile.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add vite/writeBlueprintFile.ts vite/writeBlueprintFile.test.ts
git commit -m "feat(vite): write saved blueprints into the blueprints folder"
```

---

### Task 4: The `/__save-blueprint` dev-server plugin

**Files:**
- Create: `vite/blueprintWritePlugin.ts`
- Create: `vite/blueprintWritePlugin.test.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `writeBlueprintFile` (Task 3), `SAVE_BLUEPRINT_ENDPOINT`
  (`../src/themes/platformer/editor/saveBlueprintEndpoint`).
- Produces: `blueprintWritePlugin(): Plugin`.

- [ ] **Step 1: Write the failing tests**

```typescript
// vite/blueprintWritePlugin.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { blueprintWritePlugin } from './blueprintWritePlugin';
import {
  BLUEPRINTS_FOLDER,
  SAVE_BLUEPRINT_ENDPOINT,
} from '../src/themes/platformer/editor/saveBlueprintEndpoint';

const VALID_CONTENTS = `${JSON.stringify({ name: 'Cave Room', layout: ['#+#'] }, null, 2)}\n`;

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => void,
) => void | Promise<void>;

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'blueprint-plugin-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Mounts the plugin against a stub dev server and hands back its handler. */
const mountPlugin = () => {
  const mounted: { path?: string; handler?: Handler } = {};
  const server = {
    config: { root },
    middlewares: {
      use: (path: string, handler: Handler) => {
        mounted.path = path;
        mounted.handler = handler;
      },
    },
  };

  const plugin = blueprintWritePlugin();
  (plugin.configureServer as (s: typeof server) => void)(server);

  return mounted;
};

const fakeResponse = () => {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 0,
    body: '',
    setHeader: (key: string, value: string) => {
      headers[key] = value;
    },
    end: (text?: string) => {
      res.body = text ?? '';
    },
    headers,
  };
  return res;
};

const request = (method: string, body?: string) => {
  const req = Readable.from(body === undefined ? [] : [body]) as unknown as IncomingMessage;
  req.method = method;
  req.url = '/';
  return req;
};

const send = async (method: string, body?: string) => {
  const { handler } = mountPlugin();
  const res = fakeResponse();
  const next = vi.fn();

  await handler!(request(method, body), res as unknown as ServerResponse, next);

  return { res, next };
};

describe('blueprintWritePlugin', () => {
  it('appliesOnlyWhileTheDevServerIsServingNotToABuild', () => {
    expect(blueprintWritePlugin().apply).toBe('serve');
  });

  it('isNamed', () => {
    expect(blueprintWritePlugin().name).toBe('platformer-blueprint-write');
  });

  it('mountsItsMiddlewareOnTheSaveBlueprintEndpoint', () => {
    expect(mountPlugin().path).toBe(SAVE_BLUEPRINT_ENDPOINT);
  });

  it('post-writesTheBlueprintIntoTheBlueprintsFolderAndReportsItsPath', async () => {
    const { res } = await send(
      'POST',
      JSON.stringify({ fileName: 'cave-room.json', contents: VALID_CONTENTS }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ path: `${BLUEPRINTS_FOLDER}cave-room.json` });
    expect(readFileSync(join(root, BLUEPRINTS_FOLDER, 'cave-room.json'), 'utf8')).toBe(
      VALID_CONTENTS,
    );
  });

  it('post-respondsAsJson', async () => {
    const { res } = await send(
      'POST',
      JSON.stringify({ fileName: 'cave-room.json', contents: VALID_CONTENTS }),
    );

    expect(res.headers['Content-Type']).toContain('application/json');
  });

  it('post-withAFileNameThatEscapesTheBlueprintsFolder-isRejectedWithoutWriting', async () => {
    const { res } = await send(
      'POST',
      JSON.stringify({ fileName: '../../evil.json', contents: VALID_CONTENTS }),
    );

    expect(res.statusCode).toBe(400);
    expect(existsSync(join(root, 'evil.json'))).toBe(false);
  });

  it('post-withAnUnparseableEnvelope-isRejected', async () => {
    const { res } = await send('POST', '{ not json');

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBeTruthy();
  });

  it('post-withNoBody-isRejected', async () => {
    const { res } = await send('POST');

    expect(res.statusCode).toBe(400);
  });

  it('get-isPassedOnToTheNextMiddlewareRatherThanAnswered', async () => {
    const { res, next } = await send('GET');

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run vite/blueprintWritePlugin.test.ts`
Expected: FAIL — `Cannot find module './blueprintWritePlugin'`. Do not continue until you
have seen that failure output.

- [ ] **Step 3: Write the plugin**

```typescript
// vite/blueprintWritePlugin.ts
import type { Plugin } from 'vite';
import type { IncomingMessage } from 'node:http';
import { writeBlueprintFile } from './writeBlueprintFile';
import { SAVE_BLUEPRINT_ENDPOINT } from '../src/themes/platformer/editor/saveBlueprintEndpoint';

const readBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks).toString('utf8');
};

/**
 * Lets the Level Editor's Save Blueprint button write straight into the folder
 * the blueprint registry reads (`src/themes/platformer/level/blueprints/`),
 * rather than leaving the developer to move a downloaded file there by hand —
 * the blueprint counterpart of `levelWritePlugin.ts`.
 *
 * `apply: 'serve'` keeps this out of every build: the deployed site has no such
 * route and stays a pure static bundle, which is why the editor hides its Save
 * controls there entirely (see `editor/devEnvironment.ts`) and, if one is
 * somehow reached anyway, falls back to a plain download. All validation lives
 * in `writeBlueprintFile`.
 */
export const blueprintWritePlugin = (): Plugin => ({
  name: 'platformer-blueprint-write',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(SAVE_BLUEPRINT_ENDPOINT, async (req, res, next) => {
      if (req.method !== 'POST') {
        next();
        return;
      }

      let request: unknown;
      try {
        request = JSON.parse(await readBody(req));
      } catch {
        request = null;
      }

      const result =
        request !== null && typeof request === 'object'
          ? writeBlueprintFile(
              server.config.root,
              request as { fileName: unknown; contents: unknown },
            )
          : { status: 400, body: { error: 'body must be JSON with fileName and contents' } };

      res.statusCode = result.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result.body));
    });
  },
});
```

- [ ] **Step 4: Register it in `vite.config.ts`**

```typescript
import { blueprintWritePlugin } from './vite/blueprintWritePlugin';
```

and extend the plugin list:

```typescript
  plugins: [react(), tailwindcss(), levelWritePlugin(), blueprintWritePlugin()],
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run vite/`
Expected: PASS — the 9 new tests plus every pre-existing `vite/` test.

- [ ] **Step 6: Commit**

```bash
git add vite/blueprintWritePlugin.ts vite/blueprintWritePlugin.test.ts vite.config.ts
git commit -m "feat(vite): serve the /__save-blueprint dev-server write endpoint"
```

---

### Task 5: `blueprintRegistry` — discovering saved blueprints at build time

**Files:**
- Create: `src/themes/platformer/level/blueprintRegistry.ts`
- Create: `src/themes/platformer/level/blueprintRegistry.test.ts`
- Create: `src/themes/platformer/level/blueprints/.gitkeep`

**Interfaces:**
- Consumes: `Blueprint`, `isBlueprint` (`./BlueprintData` — step 44a's guard, reused
  verbatim).
- Produces: `parseBlueprintModules(modules)`, `BLUEPRINTS: readonly Blueprint[]`,
  `findBlueprint(id)`.
- Consumed by: Task 8 (`BlueprintSelect`), and Part 2's Palette section.

**How this reuses rather than duplicates.** `levelRegistry.ts` carries three private
validators (`isLayout`, `isBackgroundPlacement`, `isBackground`) because a `LevelEntry` has
no single guard. A `Blueprint` does: step 44a's `isBlueprint` already checks exactly
`id: string`, `name: string`, a non-empty `layout` of strings, and an optional
`background` of well-formed placements. So this registry builds the candidate entry and asks
`isBlueprint` — no validator is copied, no `as` cast is needed anywhere (the guard narrows
`unknown` for us), and any future change to what counts as a well-formed blueprint lands in
one place.

The `.gitkeep` exists so the folder is present in a fresh clone. `import.meta.glob` tolerates
a missing directory, but a folder that only ever appears after someone saves is the kind of
thing that makes a "why is my glob empty?" afternoon; `*.json` never matches `.gitkeep`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/themes/platformer/level/blueprintRegistry.test.ts
import { describe, it, expect } from 'vitest';
import { parseBlueprintModules, findBlueprint, BLUEPRINTS } from './blueprintRegistry';
import { blueprintFileJson } from '../editor/saveBlueprintFile';
import type { Blueprint } from './BlueprintData';

describe('parseBlueprintModules', () => {
  it('wellFormedModule-becomesAnEntryWithItsFilenameStemAsId', () => {
    const entries = parseBlueprintModules({
      './blueprints/cave-room.json': { default: { name: 'Cave Room', layout: ['#+#', '#.#'] } },
    });

    expect(entries).toEqual<Blueprint[]>([
      { id: 'cave-room', name: 'Cave Room', layout: ['#+#', '#.#'] },
    ]);
  });

  it('moduleWithoutADefaultWrapper-isStillAccepted', () => {
    const entries = parseBlueprintModules({
      './blueprints/flat.json': { name: 'Flat', layout: ['GGG'] },
    });

    expect(entries).toEqual<Blueprint[]>([{ id: 'flat', name: 'Flat', layout: ['GGG'] }]);
  });

  it('moduleWithoutAName-fallsBackToItsFilenameStem', () => {
    const entries = parseBlueprintModules({
      './blueprints/no-name.json': { default: { layout: ['GGG'] } },
    });

    expect(entries[0].name).toBe('no-name');
  });

  it('multipleModules-areSortedByIdSoTheDropdownOrderIsStable', () => {
    const entries = parseBlueprintModules({
      './blueprints/zulu.json': { default: { layout: ['G'] } },
      './blueprints/alpha.json': { default: { layout: ['G'] } },
      './blueprints/mike.json': { default: { layout: ['G'] } },
    });

    expect(entries.map((entry) => entry.id)).toEqual(['alpha', 'mike', 'zulu']);
  });

  it('emptyGlobResult-yieldsNoEntries', () => {
    expect(parseBlueprintModules({})).toEqual([]);
  });

  it('validBackgroundArray-isCarriedOntoTheEntry', () => {
    const entries = parseBlueprintModules({
      './blueprints/cave.json': {
        name: 'Cave',
        layout: ['G'],
        background: [{ pieceId: 'dirtColumnTop1x1', col: -1, row: 2 }],
      },
    });

    expect(entries[0].background).toEqual([{ pieceId: 'dirtColumnTop1x1', col: -1, row: 2 }]);
  });

  it('malformedBackgroundField-dropsOnlyThatFieldNotTheWholeEntry', () => {
    const entries = parseBlueprintModules({
      './blueprints/broken-bg.json': { name: 'Broken', layout: ['G'], background: 'nope' },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].background).toBeUndefined();
  });

  it('savedBlueprintFileContents-roundTripBackIntoAnEntryWithTheSameLayout', () => {
    // SC-012's blueprint counterpart: a file the editor wrote has to be a file
    // this registry accepts, connection point characters included.
    const contents = JSON.parse(blueprintFileJson('Cave Room', ['#+#', '#.#'], []));
    const entries = parseBlueprintModules({ './blueprints/cave-room.json': { default: contents } });

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Cave Room');
    expect(entries[0].layout).toEqual(['#+#', '#.#']);
  });

  describe('malformed files are skipped rather than taking the editor down', () => {
    const malformed: Record<string, unknown> = {
      './blueprints/not-an-object.json': { default: 'nope' },
      './blueprints/null-module.json': null,
      './blueprints/no-layout.json': { default: { name: 'No Layout' } },
      './blueprints/layout-not-an-array.json': { default: { layout: 'GGG' } },
      './blueprints/layout-of-non-strings.json': { default: { layout: [1, 2, 3] } },
      './blueprints/empty-layout.json': { default: { layout: [] } },
    };

    Object.entries(malformed).forEach(([path, value]) => {
      it(`${path}-isSkipped`, () => {
        expect(parseBlueprintModules({ [path]: value })).toEqual([]);
      });
    });

    it('oneMalformedFile-doesNotSuppressTheWellFormedOnesAroundIt', () => {
      const entries = parseBlueprintModules({
        './blueprints/good-one.json': { default: { layout: ['G'] } },
        './blueprints/broken.json': { default: { layout: 'G' } },
        './blueprints/good-two.json': { default: { layout: ['#'] } },
      });

      expect(entries.map((entry) => entry.id)).toEqual(['good-one', 'good-two']);
    });
  });
});

describe('BLUEPRINTS', () => {
  it('everyEntry-hasANonEmptyLayout', () => {
    BLUEPRINTS.forEach((entry) => {
      expect(entry.layout.length).toBeGreaterThan(0);
    });
  });

  it('everyId-isUnique', () => {
    const ids = BLUEPRINTS.map((entry) => entry.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('hasNoBuiltInEntries-unlikeLEVELS', () => {
    // A blueprint library starts empty: there is no shipped room, and the
    // dropdown's blank `new` entry comes from BLANK_BLUEPRINT, not from here.
    expect(BLUEPRINTS.every((entry) => entry.id !== 'new')).toBe(true);
  });
});

describe('findBlueprint', () => {
  it('unknownId-returnsUndefined', () => {
    expect(findBlueprint('no-such-blueprint')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/level/blueprintRegistry.test.ts`
Expected: FAIL — `Cannot find module './blueprintRegistry'`. Do not continue until you have
seen that failure output.

- [ ] **Step 3: Write the registry**

```typescript
// src/themes/platformer/level/blueprintRegistry.ts
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
```

- [ ] **Step 4: Create the folder**

```bash
mkdir -p src/themes/platformer/level/blueprints
touch src/themes/platformer/level/blueprints/.gitkeep
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/level/blueprintRegistry.test.ts`
Expected: PASS (19 tests — 8 `parseBlueprintModules`, the nested malformed block's 6
generated + 1, 3 `BLUEPRINTS`, 1 `findBlueprint`). The three `BLUEPRINTS` tests pass
trivially while the folder is empty (`import.meta.glob` on a missing or empty directory
yields `{}` rather than erroring) — Step 4 exists so a fresh clone has the folder, not
because the tests would otherwise fail.

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/level/blueprintRegistry.ts src/themes/platformer/level/blueprintRegistry.test.ts src/themes/platformer/level/blueprints/.gitkeep
git commit -m "feat(platformer): discover saved blueprints with a build-time registry"
```

---

### Task 6: `isDevEnvironmentSignal` and the ping that sets it

**Files:**
- Create: `src/themes/platformer/editor/devEnvironmentEndpoint.ts`
- Create: `src/themes/platformer/editor/devEnvironment.ts`
- Create: `src/themes/platformer/editor/devEnvironment.test.ts`

**Interfaces:**
- Produces: `DEV_ENVIRONMENT_ENDPOINT`, `isDevEnvironmentSignal: Signal<boolean>`,
  `probeDevEnvironment(): Promise<boolean>`.
- Consumed by: Task 7's Vite plugin (the endpoint constant only) and Task 10
  (`LevelEditorPage`).

**Two decisions worth reading before writing the code.**

1. **The signal is only ever written `true`, never `false`.** The design doc's wording is
   "`false` until/unless the ping succeeds", and implementing it literally as "write the
   probe's result" would be actively harmful in tests: `LevelEditorPage.test.tsx` stubs
   `fetch` per test (a rejecting one for the download-fallback tests, a level-write one for
   the others), and every one of those stubs also answers the probe. A probe that wrote
   `false` on failure would race with each test's own setup and make the Save button flicker
   out from under assertions. Write-only-on-success gives exactly the specified semantics
   (a built site never sees `true`, since the route does not exist there) with no such
   coupling, and it is honest about what the ping can actually prove: it can prove a dev
   server is there, never that one is absent.
2. **It is a plain `signal`, not a `createLocalStorageSignal`.** Persisting it would let a
   `true` from a dev session survive into a `file://` or statically-served copy of the same
   `localStorage` origin and show Save buttons that cannot work — the precise failure the
   gate exists to prevent.

Note for the implementer: on a built site `/__dev-environment` is not a 404 — the SPA host
usually answers it with `index.html` and a `200`. That is why the probe insists on
`body.isDev === true` after parsing rather than trusting `response.ok`; the HTML body makes
`response.json()` throw, which the `catch` handles.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/themes/platformer/editor/devEnvironment.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isDevEnvironmentSignal, probeDevEnvironment } from './devEnvironment';
import { DEV_ENVIRONMENT_ENDPOINT } from './devEnvironmentEndpoint';

const stubFetch = (response: Partial<Response> | Error) => {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response as Response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

beforeEach(() => {
  isDevEnvironmentSignal.value = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
  isDevEnvironmentSignal.value = false;
});

describe('isDevEnvironmentSignal', () => {
  it('beforeAnyProbe-isFalseSoAStaticSiteNeverShowsDevOnlyControls', () => {
    expect(isDevEnvironmentSignal.value).toBe(false);
  });
});

describe('probeDevEnvironment', () => {
  it('endpointAnswersIsDevTrue-setsTheSignalAndResolvesTrue', async () => {
    const fetchMock = stubFetch({ ok: true, json: () => Promise.resolve({ isDev: true }) });

    await expect(probeDevEnvironment()).resolves.toBe(true);
    expect(isDevEnvironmentSignal.value).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(DEV_ENVIRONMENT_ENDPOINT);
  });

  it('noRouteAtAll-leavesTheSignalFalse', async () => {
    stubFetch({ ok: false, status: 404, json: () => Promise.resolve({}) });

    await expect(probeDevEnvironment()).resolves.toBe(false);
    expect(isDevEnvironmentSignal.value).toBe(false);
  });

  it('builtSiteAnsweringIndexHtml-leavesTheSignalFalse', async () => {
    // A static host answers an unknown path with the SPA shell and a 200, so
    // `ok` proves nothing — the JSON parse is what fails, and must be caught.
    stubFetch({ ok: true, json: () => Promise.reject(new SyntaxError('Unexpected token <')) });

    await expect(probeDevEnvironment()).resolves.toBe(false);
    expect(isDevEnvironmentSignal.value).toBe(false);
  });

  it('routeAnsweringSomethingElse-leavesTheSignalFalse', async () => {
    stubFetch({ ok: true, json: () => Promise.resolve({ isDev: 'yes' }) });

    await expect(probeDevEnvironment()).resolves.toBe(false);
    expect(isDevEnvironmentSignal.value).toBe(false);
  });

  it('fetchThrows-leavesTheSignalFalseRatherThanRejecting', async () => {
    stubFetch(new Error('offline'));

    await expect(probeDevEnvironment()).resolves.toBe(false);
    expect(isDevEnvironmentSignal.value).toBe(false);
  });

  it('aFailedProbe-neverClearsASignalAnEarlierSuccessfulProbeSet', async () => {
    // Write-only-on-success: the ping can prove a dev server is there, never
    // that one is absent, and a transient failure must not hide the Save
    // controls mid-session.
    isDevEnvironmentSignal.value = true;
    stubFetch(new Error('offline'));

    await probeDevEnvironment();

    expect(isDevEnvironmentSignal.value).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/devEnvironment.test.ts`
Expected: FAIL — `Cannot find module './devEnvironment'`. Do not continue until you have
seen that failure output.

- [ ] **Step 3: Write the endpoint constant**

```typescript
// src/themes/platformer/editor/devEnvironmentEndpoint.ts
/**
 * Constant shared by the editor and the dev-server plugin that answers this
 * route (`vite/devEnvironmentPlugin.ts`). Deliberately free of imports: the
 * plugin runs in Node inside `vite.config.ts`, so anything reachable from here
 * must be safe for both runtimes — same rule `saveLevelEndpoint.ts` follows.
 *
 * Double-underscored to mark it as tooling rather than anything the real site
 * serves. It exists only while `npm run dev` is running, and that absence is
 * the whole signal: a built site cannot answer it, so the editor knows not to
 * offer controls that need a dev server.
 */
export const DEV_ENVIRONMENT_ENDPOINT = '/__dev-environment';
```

- [ ] **Step 4: Write the probe**

```typescript
// src/themes/platformer/editor/devEnvironment.ts
import { signal } from '@preact/signals-react';
import { DEV_ENVIRONMENT_ENDPOINT } from './devEnvironmentEndpoint';

/**
 * Whether this page is being served by `npm run dev`, i.e. whether the editor's
 * dev-server-backed actions (Save, Save Blueprint) can actually write a file.
 * `false` until a successful ping says otherwise — see `probeDevEnvironment`.
 *
 * Deliberately NOT a `createLocalStorageSignal`: persisting it would let a
 * `true` from a dev session survive into a statically-served copy on the same
 * origin and show Save controls that cannot work, which is the exact failure
 * this gate exists to prevent.
 */
export const isDevEnvironmentSignal = signal(false);

/**
 * Pings `DEV_ENVIRONMENT_ENDPOINT` once and records a successful answer in
 * `isDevEnvironmentSignal`. Resolves with what it found; never rejects.
 *
 * Only ever writes `true`. The ping can prove a dev server is there; it cannot
 * prove one is absent (a transient network failure looks identical), so a
 * failure leaves the signal exactly as it was rather than clearing a
 * previously-confirmed dev environment.
 *
 * `response.ok` alone is not enough: a statically-served build typically
 * answers an unknown path with the SPA's `index.html` and a 200, so the check
 * is on the parsed body — and the parse throwing on that HTML is itself part of
 * the answer, handled by the catch.
 */
export const probeDevEnvironment = async (): Promise<boolean> => {
  try {
    const response = await fetch(DEV_ENVIRONMENT_ENDPOINT);
    const body = (await response.json()) as { isDev?: unknown };
    if (response.ok && body.isDev === true) {
      isDevEnvironmentSignal.value = true;
      return true;
    }
    return false;
  } catch {
    return false;
  }
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/devEnvironment.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/themes/platformer/editor/devEnvironmentEndpoint.ts src/themes/platformer/editor/devEnvironment.ts src/themes/platformer/editor/devEnvironment.test.ts
git commit -m "feat(platformer): detect the dev environment from a one-shot editor ping"
```

---

### Task 7: The `/__dev-environment` dev-server plugin

**Files:**
- Create: `vite/devEnvironmentPlugin.ts`
- Create: `vite/devEnvironmentPlugin.test.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `DEV_ENVIRONMENT_ENDPOINT`
  (`../src/themes/platformer/editor/devEnvironmentEndpoint`).
- Produces: `devEnvironmentPlugin(): Plugin`.

Unlike the two write plugins this one answers **every** method, not just POST: it is a
read-only fact about the server, a `GET` is what the probe sends, and passing anything else
down the chain would only mean a confusing 404 for a route that does exist.

- [ ] **Step 1: Write the failing tests**

```typescript
// vite/devEnvironmentPlugin.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { devEnvironmentPlugin } from './devEnvironmentPlugin';
import { DEV_ENVIRONMENT_ENDPOINT } from '../src/themes/platformer/editor/devEnvironmentEndpoint';

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => void,
) => void | Promise<void>;

const mountPlugin = () => {
  const mounted: { path?: string; handler?: Handler } = {};
  const server = {
    config: { root: '/tmp' },
    middlewares: {
      use: (path: string, handler: Handler) => {
        mounted.path = path;
        mounted.handler = handler;
      },
    },
  };

  const plugin = devEnvironmentPlugin();
  (plugin.configureServer as (s: typeof server) => void)(server);

  return mounted;
};

const fakeResponse = () => {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 0,
    body: '',
    setHeader: (key: string, value: string) => {
      headers[key] = value;
    },
    end: (text?: string) => {
      res.body = text ?? '';
    },
    headers,
  };
  return res;
};

const send = async (method: string) => {
  const { handler } = mountPlugin();
  const req = Readable.from([]) as unknown as IncomingMessage;
  req.method = method;
  req.url = '/';
  const res = fakeResponse();
  const next = vi.fn();

  await handler!(req, res as unknown as ServerResponse, next);

  return { res, next };
};

describe('devEnvironmentPlugin', () => {
  it('appliesOnlyWhileTheDevServerIsServingNotToABuild', () => {
    // The whole mechanism: a built site cannot answer this route, which is how
    // the editor knows to hide its dev-server-backed controls there.
    expect(devEnvironmentPlugin().apply).toBe('serve');
  });

  it('isNamed', () => {
    expect(devEnvironmentPlugin().name).toBe('platformer-dev-environment');
  });

  it('mountsItsMiddlewareOnTheDevEnvironmentEndpoint', () => {
    expect(mountPlugin().path).toBe(DEV_ENVIRONMENT_ENDPOINT);
  });

  it('get-answersIsDevTrueAsJson', async () => {
    const { res } = await send('GET');

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ isDev: true });
    expect(res.headers['Content-Type']).toContain('application/json');
  });

  it('anyOtherMethod-isAnsweredTooRatherThanFallingThrough', async () => {
    const { res, next } = await send('POST');

    expect(next).not.toHaveBeenCalled();
    expect(JSON.parse(res.body)).toEqual({ isDev: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run vite/devEnvironmentPlugin.test.ts`
Expected: FAIL — `Cannot find module './devEnvironmentPlugin'`. Do not continue until you
have seen that failure output.

- [ ] **Step 3: Write the plugin**

```typescript
// vite/devEnvironmentPlugin.ts
import type { Plugin } from 'vite';
import { DEV_ENVIRONMENT_ENDPOINT } from '../src/themes/platformer/editor/devEnvironmentEndpoint';

/**
 * Answers a fixed `{ isDev: true }` on `DEV_ENVIRONMENT_ENDPOINT`, so the Level
 * Editor can tell whether it is running behind `npm run dev` and hide the
 * controls that need a dev server to do anything (Save, Save Blueprint).
 *
 * `apply: 'serve'` is the entire mechanism, not an optimization: a built site
 * has no such route, so the editor's ping there fails and the controls stay
 * hidden. Nothing about the running site's behavior depends on this answer —
 * it gates editor affordances only.
 */
export const devEnvironmentPlugin = (): Plugin => ({
  name: 'platformer-dev-environment',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(DEV_ENVIRONMENT_ENDPOINT, (_req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ isDev: true }));
    });
  },
});
```

- [ ] **Step 4: Register it in `vite.config.ts`**

```typescript
import { devEnvironmentPlugin } from './vite/devEnvironmentPlugin';
```

```typescript
  plugins: [
    react(),
    tailwindcss(),
    levelWritePlugin(),
    blueprintWritePlugin(),
    devEnvironmentPlugin(),
  ],
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run vite/`
Expected: PASS — the 5 new tests plus every pre-existing `vite/` test.

- [ ] **Step 6: Commit**

```bash
git add vite/devEnvironmentPlugin.ts vite/devEnvironmentPlugin.test.ts vite.config.ts
git commit -m "feat(vite): answer /__dev-environment while the dev server is running"
```

---

### Task 8: `BlueprintSelect` lists the registry instead of the stash

**Files:**
- Modify: `src/themes/platformer/editor/BlueprintSelect.tsx`
- Modify: `src/themes/platformer/editor/BlueprintSelect.test.tsx`

**Interfaces:**
- Consumes: `BLUEPRINTS` (Task 5) in place of `readSavedBlueprints`.
- Produces: no change to `BlueprintSelectProps` — the component's public shape is
  untouched, which is exactly what step 44a's stash was designed to make true.

Two things go away with the stash: the `useSignals()` call (the entry list is now a
build-time constant, like `LevelSelect`'s `LEVELS`) and the malformed-entry test (the
registry filters those out before the component ever sees them — that coverage now lives in
`blueprintRegistry.test.ts`). The behavioral consequence is real and matches levels exactly:
a blueprint saved moments ago appears in the dropdown once Vite has picked the new file up,
not instantly. The Save dialog says so (Task 9).

- [ ] **Step 1: Write the failing tests**

Replace the top of `BlueprintSelect.test.tsx` — the imports, the mock, and the `beforeEach` —
with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlueprintSelect } from './BlueprintSelect';
import { BLANK_BLUEPRINT, type Blueprint } from '../level/BlueprintData';

// The registry is a build-time glob, so the suite swaps in a list it can
// control. It has to be a STABLE array the tests mutate rather than a fresh one
// per test: the component reads the module binding at render time, so emptying
// and refilling this same array is what makes each test's registry its own.
const { registryEntries } = vi.hoisted(() => ({ registryEntries: [] as Blueprint[] }));

vi.mock('../level/blueprintRegistry', () => ({
  BLUEPRINTS: registryEntries,
  findBlueprint: (id: string) => registryEntries.find((entry) => entry.id === id),
}));

const openDropdown = () => fireEvent.click(screen.getByRole('combobox'));

const registerBlueprint = (blueprint: Blueprint): Blueprint => {
  registryEntries.push(blueprint);
  return blueprint;
};

const TEST_ROOM: Blueprint = { id: 'test-room', name: 'Test Room', layout: ['#'] };

beforeEach(() => {
  registryEntries.length = 0;
});
```

Then, in the `describe('BlueprintSelect')` body, replace every
`saveBlueprintToStash('Test Room', ['#'], [])` call with `registerBlueprint(TEST_ROOM)` (and
every `const saved = saveBlueprintToStash(...)` with `const saved = registerBlueprint(TEST_ROOM)`),
and **delete** the final `malformedStoredEntry-isNotOfferedAsAnOption` test, replacing it
with:

```tsx
  it('registryEntries-areListedAfterTheBlankEntryInTheirRegistryOrder', () => {
    // The registry already sorted by id and dropped anything malformed
    // (blueprintRegistry.ts) — this component adds only the blank entry, at
    // the front, and never re-sorts or re-validates.
    registerBlueprint({ id: 'alpha', name: 'Alpha', layout: ['#'] });
    registerBlueprint({ id: 'zulu', name: 'Zulu', layout: ['#'] });
    render(<BlueprintSelect loadedBlueprintName="new" isDirty={false} onLoadBlueprint={vi.fn()} />);
    openDropdown();

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      BLANK_BLUEPRINT.name,
      'Alpha',
      'Zulu',
    ]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/BlueprintSelect.test.tsx`
Expected: FAIL — the component still imports `readSavedBlueprints` from the (unmocked)
stash, so every test that expects a registry entry to be listed finds only the blank one.
The three tests that touch no saved entry (`open-listsTheBlankNewEntry`,
`namesTheLoadedBlueprintOnTheTrigger…`, and the blank-entry load) pass throughout — they are
not the RED here. Do not continue until you have seen the others fail.

- [ ] **Step 3: Point the component at the registry**

In `BlueprintSelect.tsx`, delete the `useSignals` import and its call, replace the stash
import with

```typescript
import { BLUEPRINTS } from '../level/blueprintRegistry';
```

replace the entries line with

```typescript
  const entries: Blueprint[] = [BLANK_BLUEPRINT, ...BLUEPRINTS];
```

and replace the component's doc comment's last paragraph with:

```
 * Entries come from `blueprintRegistry.ts`'s build-time glob of
 * `level/blueprints/*.json`, exactly the way `LevelSelect` reads `LEVELS` — so
 * a blueprint saved moments ago appears once Vite has picked the new file up,
 * not instantly. The Save Blueprint dialog says as much, mirroring what the
 * level Save dialog already tells the developer.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/BlueprintSelect.test.tsx`
Expected: PASS (10 tests — the 9 kept and the 1 new).

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/BlueprintSelect.tsx src/themes/platformer/editor/BlueprintSelect.test.tsx
git commit -m "feat(platformer): list blueprints from the registry instead of the stash"
```

---

### Task 9: Saving a blueprint writes a real file, and the stash is deleted

**Files:**
- Modify: `src/themes/platformer/editor/LevelEditorPage.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.test.tsx`
- Delete: `src/themes/platformer/editor/blueprintStash.ts`
- Delete: `src/themes/platformer/editor/blueprintStash.test.ts`

**Interfaces:**
- Consumes: `saveBlueprint`, `BLUEPRINTS_FOLDER`, `SaveBlueprintResult` (Task 1).
- Produces: no new exports. `saveCurrentBlueprint` becomes `async`, mirroring
  `saveCurrentLevel`.

- [ ] **Step 1: Write the failing tests**

In `LevelEditorPage.test.tsx`:

(a) Replace the stash import (line 24) with the registry mock and the blueprint-file
helper. Put the `vi.hoisted`/`vi.mock` pair next to the existing `levelRegistry` mock:

```tsx
import { blueprintFileJson } from './saveBlueprintFile';
import { SAVE_BLUEPRINT_ENDPOINT } from './saveBlueprintEndpoint';
import { SAVE_LEVEL_ENDPOINT } from './saveLevelEndpoint';
import type { Blueprint } from '../level/BlueprintData';

const { blueprintEntries } = vi.hoisted(() => ({ blueprintEntries: [] as Blueprint[] }));

vi.mock('../level/blueprintRegistry', () => ({
  BLUEPRINTS: blueprintEntries,
  findBlueprint: (id: string) => blueprintEntries.find((entry) => entry.id === id),
}));
```

(b) In the suite's `beforeEach`, replace `savedBlueprintsSignal.value = [];` with

```tsx
  blueprintEntries.length = 0;
```

(c) Add a blueprint-write stub next to `stubDevServerWrite`:

```tsx
/**
 * A dev server that accepts a blueprint write, so nothing is downloaded.
 *
 * `fetchCalls` rather than the mock itself: `vi.fn(() => …)` types
 * `mock.calls` from its zero-argument factory, i.e. as `[][]`, so
 * `calls.find(([url]) => …)` is a `strict` compile error ("Tuple type '[]' of
 * length '0' has no element at index '0'"). The real calls come from `fetch`
 * with arguments, so the widened view is the honest one — the same reason
 * `saveLevelFile.test.ts` reads `mock.calls[0]` through
 * `as unknown as [string, RequestInit]`.
 */
function stubBlueprintWrite(path = 'src/themes/platformer/level/blueprints/test-room.json') {
  const fetchMock = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ path }) } as Response),
  );
  vi.stubGlobal('fetch', fetchMock);
  const anchorClick = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  const fetchCalls = (): unknown[][] => fetchMock.mock.calls as unknown as unknown[][];
  return { fetchCalls, anchorClick };
}

/** The body of the one POST that went to the blueprint write endpoint. */
function blueprintPostBody(fetchCalls: () => unknown[][]) {
  const call = fetchCalls().find(([url]) => url === SAVE_BLUEPRINT_ENDPOINT);
  expect(call).toBeDefined();
  return JSON.parse((call![1] as RequestInit).body as string) as {
    fileName: string;
    contents: string;
  };
}
```

Note: from Task 10 onward the page also pings `/__dev-environment` on mount, so this same
`fetchMock` sees that call too — which is exactly why `blueprintPostBody` *finds* the write
call by URL instead of reading `calls[0]`.

(d) Rewrite the four stash-asserting tests in
`describe('LevelEditorPage — blueprint select and save (step 44a)')`:

```tsx
  it('savingTheBlueprintCanvas-postsTheCroppedLayoutToTheBlueprintWriteEndpoint', async () => {
    const { fetchCalls } = stubBlueprintWrite();
    renderEditorInBlueprintMode();
    // One cell painted at (col 2, row 1) of an otherwise-empty canvas: the
    // crop's tightest non-'.' bounding box is that single cell, so the saved
    // layout is exactly ['G'].
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    expect(blueprintPostBody(fetchCalls)).toEqual({
      fileName: 'test-room.json',
      contents: blueprintFileJson('Test Room', ['G'], []),
    });
  });

  it('savingTheBlueprintCanvas-namesItOnTheDropdownTriggerAndClosesTheDialog', async () => {
    stubBlueprintWrite();
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    expect(screen.getByRole('combobox')).toHaveTextContent('Test Room');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('savingTheBlueprintCanvas-writesNoLevelFileAndLeavesTheLevelUntouched', async () => {
    const levelGridBefore = editorLevelSignal.value;
    const { fetchCalls } = stubBlueprintWrite();
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    // The blueprint save must never reach the LEVEL write endpoint, and must
    // not disturb the level canvas sitting behind it.
    expect(fetchCalls().every(([url]) => url !== SAVE_LEVEL_ENDPOINT)).toBe(true);
    expect(editorLevelSignal.value).toEqual(levelGridBefore);
  });

  it('savingABlueprintWithBackgroundPieces-postsThemRebasedOntoTheSameOrigin', async () => {
    const { fetchCalls } = stubBlueprintWrite();
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Background' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dirt Column Top (1×1)' }));
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    // The foreground crop's origin is (col 2, row 1) — the only painted cell —
    // so a background piece placed on that same cell rebases to (col 0, row 0).
    expect(JSON.parse(blueprintPostBody(fetchCalls).contents).background).toEqual([
      { pieceId: 'dirtColumnTop1x1', col: 0, row: 0 },
    ]);
  });
```

(e) Rewrite `reopeningASavedBlueprint-loadsItsLayoutBackOntoTheCanvas`: a real save no longer
feeds the dropdown within the same session (the registry is a build-time glob), so the test
registers the entry the way a reloaded dev server would and then reopens it:

```tsx
  it('reopeningABlueprintFromTheRegistry-loadsItsLayoutOntoTheCanvas', async () => {
    // A saved file only reaches the dropdown once Vite has picked it up, so
    // this stands in for "after the reload" — the registry entry is present
    // and the dropdown must load it onto the canvas.
    blueprintEntries.push({ id: 'test-room', name: 'Test Room', layout: ['G+'] });
    renderEditorInBlueprintMode();

    fireEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'Test Room' }));

    await waitFor(() => {
      expect(editorBlueprintSignal.value).toEqual(importLayout(['G+']));
    });
    expect(screen.getByRole('combobox')).toHaveTextContent('Test Room');
  });
```

(f) Add one new test, next to those:

```tsx
  it('noDevServer-savingABlueprint-saysSoAndKeepsTheDialogOpenWithTheDownloadedFile', async () => {
    const { anchorClick } = stubDownloads();
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);

    await saveBlueprintAs('Test Room');

    expect(anchorClick).toHaveBeenCalledOnce();
    expect((anchorClick.mock.instances[0] as HTMLAnchorElement).download).toBe('test-room.json');
    // Same convention as a level save: a fallback download leaves the dialog
    // open, because the file still has to be moved.
    expect(await screen.findByText(/move it into/i)).toBeInTheDocument();
  });
```

(g) Also update the 44b test
`savingABlueprintWithAConnectionPoint-keepsTheCharacterInTheStoredLayout`, which asserts
through `readSavedBlueprints()`:

```tsx
  it('savingABlueprintWithAConnectionPoint-keepsTheCharacterInThePostedLayout', async () => {
    // The crop/export path carries '+' like any other character — nothing in
    // saveBlueprint/cropLevelForExport knows about connection points, which is
    // exactly what Part 2's placement relies on to read them back.
    const { fetchCalls } = stubBlueprintWrite();
    renderEditorInBlueprintMode();
    paintBlueprintCell(2, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Connection Point' }));
    paintBlueprintCell(3, 1);

    await saveBlueprintAs('Test Room');

    expect(JSON.parse(blueprintPostBody(fetchCalls).contents).layout).toEqual(['G+']);
  });
```

(h) `describe('LevelEditorPage — blueprint select and save (step 44a)')` opens with its own
`afterEach(() => { vi.unstubAllGlobals(); })` whose comment explains itself as covering "the
dev-server-write test below [that] stubs `fetch` directly with a bare `vi.fn()` rather than
going through stubDownloads/stubDevServerWrite". After (d) no test in the block does that any
more — they all go through `stubBlueprintWrite`. Keep the `afterEach` (it is harmless and the
top-level one already covers it) but rewrite its comment to say so, rather than leaving a
justification that points at code that no longer exists:

```tsx
  // Belt-and-suspenders alongside the file's top-level afterEach above: every
  // test in this block stubs `fetch` (stubBlueprintWrite/stubDownloads), and
  // a leaked stub here would silently answer the next test's dev-environment
  // ping as well as its saves.
  afterEach(() => {
    vi.unstubAllGlobals();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx -t "blueprint"`
Expected: FAIL — the page still calls `saveBlueprintToStash`, so no POST is ever made and
`blueprintPostBody` finds no matching call. Do not continue until you have seen that failure
output.

- [ ] **Step 3: Write the implementation**

In `LevelEditorPage.tsx`, replace the stash import

```typescript
import { saveBlueprintToStash } from './blueprintStash';
```

with

```typescript
import { saveBlueprint, BLUEPRINTS_FOLDER, type SaveBlueprintResult } from './saveBlueprintFile';
```

add the result state next to `blueprintSaveName`:

```typescript
  const [blueprintSaveResult, setBlueprintSaveResult] = useState<SaveBlueprintResult | null>(null);
```

replace `saveCurrentBlueprint` with:

```typescript
  /**
   * Saves the blueprint canvas as a real file, cropped through the very same
   * `cropLevelForExport` a level save uses (tightest non-`.` bounding box,
   * background placements rebased onto that same origin) — a `Blueprint` is
   * deliberately the same `{ name, layout, background? }` shape a saved level
   * file is, so both go down identical paths from here: POST to the dev
   * server, falling back to a browser download when there is none.
   *
   * A write that succeeded closes the dialog; a fallback download keeps it
   * open, because the file then still has to be moved and that is worth saying
   * before it is dismissed. Same rule `saveCurrentLevel` above follows.
   */
  const saveCurrentBlueprint = async () => {
    const cropped = cropLevelForExport(blueprintGrid, blueprintBackgroundPlacements);
    const result = await saveBlueprint(blueprintSaveName, cropped.layout, cropped.background);
    setBlueprintSaveResult(result);
    setLoadedBlueprintName(blueprintSaveName);
    setBlueprintDirty(false);
    if (result.written) setBlueprintSaveDialogOpen(false);
  };
```

open the dialog with a cleared result (in the Save Blueprint button's `onClick`, next to
`setBlueprintSaveName(loadedBlueprintName)`):

```typescript
                  setBlueprintSaveResult(null);
```

and replace the dialog's `<DialogDescription>` and footer so they mirror the level dialog:

```tsx
                    <DialogDescription>
                      Writes the blueprint as a JSON file into <code>{BLUEPRINTS_FOLDER}</code>,
                      where the blueprint list reads it from. Reload the editor afterwards to see
                      it there.
                    </DialogDescription>
                  </DialogHeader>
                  <label className="flex flex-col gap-1 text-sm" htmlFor="save-blueprint-name">
                    Blueprint name
                    <input
                      id="save-blueprint-name"
                      value={blueprintSaveName}
                      onChange={(event) => setBlueprintSaveName(event.target.value)}
                      className="rounded border px-2 py-1 font-mono text-xs"
                    />
                  </label>
                  {blueprintSaveResult !== null && !blueprintSaveResult.written && (
                    <p className="text-sm" role="status">
                      No dev server to write it
                      {blueprintSaveResult.error === undefined
                        ? ''
                        : ` (${blueprintSaveResult.error})`}
                      , so it went to your downloads instead. Move it into{' '}
                      <code>{BLUEPRINTS_FOLDER}</code> yourself.
                    </p>
                  )}
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>
                      {blueprintSaveResult === null ? 'Cancel' : 'Done'}
                    </DialogClose>
                    <Button type="button" onClick={saveCurrentBlueprint}>
                      Save blueprint
                    </Button>
                  </DialogFooter>
```

- [ ] **Step 4: Delete the stash**

```bash
git rm src/themes/platformer/editor/blueprintStash.ts src/themes/platformer/editor/blueprintStash.test.ts
```

Then grep to prove nothing still reaches for it:

```bash
grep -rn "blueprintStash\|BLUEPRINT_STASH_KEY\|savedBlueprintsSignal\|saveBlueprintToStash\|readSavedBlueprints\|findSavedBlueprint" src vite
```

That is every name the module exported (`BLUEPRINT_STASH_KEY`, `savedBlueprintsSignal`,
`blueprintId`, `readSavedBlueprints`, `findSavedBlueprint`, `saveBlueprintToStash`) except
`blueprintId`, which is deliberately excluded from the grep because Task 1 re-introduced it
under the same name in `saveBlueprintFile.ts` — the `blueprintStash` path match is what
proves no *stale import* of it survives. `findSavedBlueprint` never had a consumer outside
`blueprintStash.test.ts`; `Blueprint`-by-id lookup is now `blueprintRegistry.findBlueprint`.

Expected: no hits in `src/` or `vite/` (matches inside `specs/` are historical plan text and
stay). Note that the old `localStorage` key `platformer-editor-saved-blueprints` is now
orphaned in developers' browsers; that is deliberate — the manual check in Task 11 says to
clear it by hand, and inventing a migration for a placeholder store that only ever existed
between 44a and 44c would be more code than the thing it migrates.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx`
Expected: PASS — every test in the file, including the rewritten blueprint ones and the 1
new. The 13 deleted `blueprintStash.test.ts` tests (3 `blueprintId`, 7
`saveBlueprintToStash`, 1 `readSavedBlueprints`, 2 `findSavedBlueprint`) are gone from the
suite total.

- [ ] **Step 6: Commit**

```bash
git add -A src/themes/platformer/editor
git commit -m "feat(platformer): save blueprints as real files and delete the localStorage stash"
```

---

### Task 10: Both Save controls appear only behind a dev server

**Files:**
- Modify: `src/themes/platformer/editor/LevelEditorPage.tsx`
- Modify: `src/themes/platformer/editor/LevelEditorPage.test.tsx`

**Interfaces:**
- Consumes: `isDevEnvironmentSignal`, `probeDevEnvironment` (Task 6).
- Produces: no new exports or props.

**Why a subscription rather than `useSignals()`.** Every other signal-reading component in
this repo calls `useSignals()`, but `LevelEditorPage` is the one place where that would
change existing behavior: it reads six persisted signals inside `useState` initializers, and
`useSignals()` tracks reads during render, so the page would begin re-rendering whenever any
of them is written — including the debounced grid sync that fires 400 ms after every paint
stroke. Subscribing to the one signal that matters keeps the page's render behavior exactly
as it is today. `createLocalStorageSignal` in `@/lib/utils` already uses `signal.subscribe`
the same way, so this is not a new mechanism.

- [ ] **Step 1: Write the failing tests**

In `LevelEditorPage.test.tsx`, import the signal alongside the others:

```tsx
import { isDevEnvironmentSignal } from './devEnvironment';
```

and add to the suite's `beforeEach`, right after `editorSelectedToolSignal.value = 'G';`:

```tsx
  // Every pre-existing Save/Save Blueprint test in this file assumes the
  // controls are on screen, which is now conditional. The editor is a
  // dev-only tool, so "there is a dev server" is the realistic default for
  // the suite; the gate's own tests below set it false explicitly.
  isDevEnvironmentSignal.value = true;
```

and to the file's existing `afterEach`:

```tsx
  isDevEnvironmentSignal.value = false;
```

Then append:

```tsx
describe('LevelEditorPage — dev-only Save controls (step 44c)', () => {
  it('noDevEnvironment-levelMode-offersNoSaveButtonAtAll', () => {
    // A built/statically-served site cannot write a file, so the control is
    // hidden rather than left to fall back to a download nobody asked for.
    isDevEnvironmentSignal.value = false;
    render(<LevelEditorPage />);

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('noDevEnvironment-levelMode-keepsEverythingThatNeedsNoServer', () => {
    isDevEnvironmentSignal.value = false;
    render(<LevelEditorPage />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try' })).toBeInTheDocument();
  });

  it('noDevEnvironment-blueprintMode-offersNoSaveBlueprintButtonButKeepsTheDropdown', () => {
    isDevEnvironmentSignal.value = false;
    render(<LevelEditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(screen.queryByRole('button', { name: 'Save Blueprint' })).not.toBeInTheDocument();
    // Loading an already-saved blueprint needs no server — the registry is a
    // static import — so the dropdown stays.
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('devEnvironment-showsBothSaveControlsInTheirOwnModes', () => {
    render(<LevelEditorPage />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Blueprint' }));

    expect(screen.getByRole('button', { name: 'Save Blueprint' })).toBeInTheDocument();
  });

  it('theMountPing-answeringIsDevTrue-bringsTheSaveButtonBack', async () => {
    // The realistic startup order: the page mounts with the signal still
    // false, pings, and the control appears when the answer lands.
    isDevEnvironmentSignal.value = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ isDev: true }) } as Response)),
    );

    render(<LevelEditorPage />);

    expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx -t "dev-only Save controls"`
Expected: FAIL — the three `noDevEnvironment` tests find the Save controls (nothing gates
them yet) and `theMountPing…` fails too (no ping is sent). `devEnvironment-showsBoth…`
passes from the start; it is the guard that the gate does not overreach, not a RED. Do not
continue until you have seen the four failures.

- [ ] **Step 3: Write the implementation**

In `LevelEditorPage.tsx`, add the import:

```typescript
import { isDevEnvironmentSignal, probeDevEnvironment } from './devEnvironment';
```

add the state next to `saveResult`:

```typescript
  // Whether this page is served by `npm run dev`, i.e. whether Save can
  // actually write a file. Mirrored into local state from
  // `isDevEnvironmentSignal` rather than read through `useSignals()`: this
  // component seeds six persisted signals in `useState` initializers, and
  // `useSignals()` would make every later write to any of them (including the
  // debounced grid sync) re-render the whole editor.
  const [isDevEnvironment, setIsDevEnvironment] = useState(isDevEnvironmentSignal.value);
```

and the mount effect, next to the image-loading one:

```typescript
  // One ping, on mount: the dev server answers `/__dev-environment`, a built
  // site cannot, and the Save controls follow that answer (see
  // `devEnvironment.ts`). The subscription is what applies the answer when it
  // lands, since the ping resolves after this effect has already run.
  // `signal.subscribe` also invokes its callback once immediately, with the
  // value the `useState` initializer above already seeded — so that first call
  // is a same-value setState React bails out of, not an extra render.
  useEffect(() => {
    void probeDevEnvironment();
    return isDevEnvironmentSignal.subscribe(setIsDevEnvironment);
  }, []);
```

Then wrap the two controls. In the level branch, wrap **only** the Save `<Button>` and its
`<Dialog>` (leaving `LevelSelect` and the Export dialog outside):

```tsx
              {isDevEnvironment && (
                <>
                  {/* the existing Save Button and the existing Save-level
                      Dialog move in here, unchanged */}
                </>
              )}
```

and in the blueprint branch, wrap the Save Blueprint `<Button>` and its `<Dialog>` the same
way, leaving `<BlueprintSelect>` outside it.

If `npm run lint` flags the `subscribe(setIsDevEnvironment)` line under
`react-hooks/set-state-in-effect`, add a single targeted disable with a comment saying why
(the setter is handed to a subscription, not called during the effect) — the file already
carries that pattern for its mount-time tool disarm.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/themes/platformer/editor/LevelEditorPage.test.tsx`
Expected: PASS — the 5 new tests plus every pre-existing test in the file. If a pre-existing
save test now fails with "unable to find role button name Save", the `beforeEach` line from
Step 1 is missing.

- [ ] **Step 5: Commit**

```bash
git add src/themes/platformer/editor/LevelEditorPage.tsx src/themes/platformer/editor/LevelEditorPage.test.tsx
git commit -m "feat(platformer): hide the editor's Save controls when there is no dev server"
```

---

### Task 11: Full suite, typecheck, lint, and the manual browser check

**Files:** none — this task verifies.

- [ ] **Step 1: Run the full suite, the typechecker and the linter**

```bash
npm test
npx tsc -b --noEmit
npm run lint
```

Expected: tests PASS. The total is the baseline recorded before this plan started, **minus**
the 13 tests deleted with `blueprintStash.test.ts`, **plus** the tests this plan adds:
23 (Task 1) + 6 (Task 2) + 5 (Task 3) + 9 (Task 4) + 19 (Task 5) + 7 (Task 6) + 5 (Task 7)
+ 0 (Task 8 — its one deleted malformed-entry test is replaced one-for-one by the ordering
test, so net 0) + 1 (Task 9's new download-fallback test; its other six blueprint tests are
rewritten in place, net 0) + 5 (Task 10) = **80 added, 13 removed, net +67**.
Typecheck and lint: **compare against the Step 0 baseline** — the bar is
that no new error appears, since the 9 `BlockKind`/`potionPot` type errors and the one
`components/ControlsOverlay.tsx` lint error pre-date this work and are out of scope.

- [ ] **Step 2: Manual browser check**

In devtools first, clear the retired stash so nothing stale is in play:
`localStorage.removeItem('platformer-editor-saved-blueprints')`.

Start the dev server and open `/platformer/editor`. Confirm, in order:

1. In Level mode the **Save** button is present (the dev server answered the ping); the
   Network tab shows exactly one `GET /__dev-environment` returning `{"isDev":true}`.
2. Click **Blueprint**: **Blueprint Select** and **Save Blueprint** are both there, and the
   dropdown offers only `new` (the blueprints folder is empty).
3. Paint a small room with a couple of **Connection Point** cells on its border, drop a
   background piece inside it, then **Save Blueprint** as `Cave Room`. The dialog closes; a
   new file appears at `src/themes/platformer/level/blueprints/cave-room.json`, pretty
   printed, holding `name`, `layout` (with `+` characters) and `background`.
4. The dropdown does **not** list it yet — that is expected and is what the dialog said.
   Reload the page: `Cave Room` is now in the dropdown; pick it and the room comes back on
   the canvas, connection points and background included, editable.
5. Save it again under the same name: the file is overwritten in place, no second file.
6. Leave the name field at its default `new` and save: the file is `new-1.json`, and after a
   reload the dropdown shows both the built-in blank `new` and the saved one, distinctly.
7. Hand-break a blueprint file (`"layout": "oops"`), reload: that one entry vanishes from
   the dropdown and every other one still works — the editor does not crash.
8. Stop the dev server and serve the built site: `npm run build && npx vite preview`, then
   open the editor route. **Neither** Save nor Save Blueprint renders, in either mode, while
   Level Select, Blueprint Select, Export and Try all still do — and picking a saved
   blueprint from the dropdown still loads it, since the registry is a static import.
9. Back on the dev server, confirm the level side is unregressed: save a level, see the
   written path in the sidebar, and reload to find it in the level dropdown.

- [ ] **Step 3: Update `docs/Features.md` if step 44c is tracked there**

Per `CLAUDE.md`'s Feature Completion Tracking. **Already checked against the real file:**
`docs/Features.md` has no blueprint-rooms entry of its own. Two rows touch this area and
neither should change:

- `S-006 | 2D Platformer theme | 📋 Planned` — the whole platformer theme, of which this is
  one step among many still open (and this plan is only *half* of step 44c; Part 2,
  placement, is unstarted).
- `O-002 | Platformer Level Editor | ✅ Done` — already ticked, and its bullet describes the
  level dropdown and save-to-JSON button, not blueprints. Blueprint rooms are tracked under
  S-006's roadmap (step 44c), not by widening O-002's already-complete entry.

So the correct action is to change nothing. Re-confirm those are still the only matching
entries (someone may have added one since), then say "nothing to update" rather than ticking
a feature that is not finished.

- [ ] **Step 4: Write Part 2's plan**

Appendix A below is its input. Do not start implementing placement from Appendix A directly:
it is a design contract, not a task list. It originally carried an open question about how
a placed connection point's facing could be recovered after stamping — that question has
since been resolved directly with the project owner (the design doc was updated: placement
validation dropped connection-point matching entirely in favor of overlap-only checking),
and Appendix A.3 reflects the resolved rule.

---

## Appendix A — Part 2's design contract (placement)

**Not implemented by this plan.** This appendix exists so the decisions that shape Part 2
are written down while the files they touch are fresh, and so Part 1 exports the right
things. Everything here was checked against the real `EditorCanvas.tsx`, `Palette.tsx`,
`LevelEditorPage.tsx`, `growGrid.ts` and `importLayout.ts` on this branch.

### A.1 How a blueprint gets armed — a separate axis, not a `TileChar`

The Palette's entire model is `TileChar`-driven: `selectedTool: TileChar`,
`onSelectTool(char)`, three `Record<TileChar, …>` maps the compiler forces to stay
exhaustive, and a `LevelParser.ts` module-load guard that throws if two character maps ever
share a key. A blueprint is a multi-cell object with an `id`, a `name` and a whole `layout`.
There is no character to give it, and inventing one would mean a `TileChar` that
`parseLevel` must never see in a layout — precisely the kind of "inert marker nothing
downstream expects" that steps 44a and 44b each went out of their way to prevent.

**Decision: a second, orthogonal piece of armed state.**

- `editorArmedBlueprintIdSignal: Signal<string | null>` joins the other persisted editor
  signals in `editorLevelState.ts`, defaulting to `null`.
- `Palette` gains two optional props — `armedBlueprintId?: string | null` and
  `onArmBlueprint?: (id: string | null) => void` — and renders a **Blueprints** section
  listing `BLUEPRINTS`, each entry as a `PaletteTile` with `label={entry.name}` and a shared
  glyph (no sprite: a room has no single tile to show). The section renders only while
  `canvasMode === 'level'` **and** `activeLayer === 'foreground'`, and not at all when
  `BLUEPRINTS` is empty. Hiding it on the blueprint canvas is what keeps "nesting" out of
  scope for free.
- **Mutual exclusion is enforced at the page's two setter call sites, not by a union type.**
  `setSelectedTool(char)` also clears `editorArmedBlueprintIdSignal`; arming a blueprint does
  **not** clear `selectedTool`, so disarming (clicking any tile tool, or the armed blueprint
  again) restores the author's previous tool instead of dumping them on a fallback. A union
  (`armed: { kind: 'tile'; char } | { kind: 'blueprint'; id }`) was considered and rejected:
  `selectedTool` is threaded through `Palette`, `EditorCanvas`, `paintCell` and ~30 existing
  `EditorCanvas.test.tsx` render sites, and rewriting all of that to express an invariant two
  lines can enforce is a bad trade.
- `EditorCanvas`'s `handleMouseDown` consults the armed blueprint **before** the paint path,
  so an armed blueprint suppresses painting entirely rather than painting a tile *and*
  previewing.

### A.2 Parsing a blueprint into cells

```
cells(bp) = { row, col, char } for every char !== '.' in importLayout(bp.layout)
```

`importLayout` right-pads short rows with `'.'`, so this is well defined even for the
jagged layouts `exportLayout` can produce. `'.'` cells are bounding-box padding, not cells
— they are never checked and never written (see A.3).

### A.3 The fit rule — overlap only

**Resolved after this appendix's first draft found a real flaw in the design doc's
original connection-point-matching rule** (raised to the project owner directly, not
silently decided): the rule required a placed blueprint's connection point to re-derive
which side it "opens" toward from its *source* blueprint's bounds — but once a blueprint
is stamped into a level, that information is gone; a `'+'` sitting in the level grid has
no memory of which blueprint it came from. The only two ways to recover it either degrade
to a no-op check (any empty neighbour counts as "open," which is already implied by the
overlap check and adds nothing — confirmed with a worked counter-example where a second
room could attach to the *wrong* face of an already-placed one) or require storing a
facing 44b deliberately never stores (changing the tile character's meaning and the file
format). The design doc now specifies overlap-only validation instead — see its Goal
section and "Step 44c — Placement" section (both updated). Connection points remain a
pure authoring/legibility aid with zero effect on placement validity.

With the blueprint anchored so that its layout cell `(0,0)` lands on the clicked cell
`(anchorRow, anchorCol)`, absolute position of a cell is `(anchorRow + row, anchorCol + col)`.

**Overlap.** For every parsed cell (A.2), the live grid at that absolute position must be
`'.'` or out of bounds (out of bounds is free — `growGrid` will extend the grid, exactly as
painting there would). That is the entire rule: no connection-point check, no "first room"
special case needed (there is nothing else to check), no adjacency, no facing. A
`blueprintConnectionPoint` cell participates in this check exactly like any other non-`.`
cell — it counts as "occupied" once placed — and is never treated specially beyond that.

### A.4 Commit — hand-verified arithmetic

Committing cell by cell through `paintCell` is **wrong**: each call may call `growGrid`,
and a leftward/upward growth shifts every existing index, so cells written after the first
growth would land in the wrong place. The correct shape is two grows, then a bulk write:

```
minRow/minCol/maxRow/maxCol = bounding box of the ABSOLUTE parsed cells
a = growGrid(grid, minCol, minRow)               // may prepend columns/rows
b = growGrid(a.grid, maxCol + a.colShift, maxRow + a.rowShift)
colShift = a.colShift + b.colShift ; rowShift = a.rowShift + b.rowShift
for each parsed cell: next[row + anchorRow + rowShift][col + anchorCol + colShift] = char
applyGrowthShift(colShift, rowShift, setBackgroundPlacements)   // existing page helper
background: for each bp.background placement, push { ...placement,
              col: placement.col + anchorCol + colShift,
              row: placement.row + anchorRow + rowShift }        // unconditionally, no overlap check
```

Worked example, checked by hand against the real `growGrid`:

- Live grid 3 wide × 2 high (`width = grid[0].length = 3`, `height = grid.length = 2`).
- Blueprint 2×2, anchored at `(anchorRow, anchorCol) = (-1, -1)`; absolute cells span rows
  -1..0, cols -1..0.
- `growGrid(grid, -1, -1)`: `growLeft = 1`, `growTop = 1`, `growRight = growBottom = 0` →
  4×3 grid, `colShift = 1`, `rowShift = 1`.
- Second call with `maxCol + 1 = 1`, `maxRow + 1 = 1`: both inside the new 4×3 grid, so
  `growGrid` returns it unchanged with shifts 0. Totals stay `colShift = rowShift = 1`.
- Blueprint cell (0,0) → `(-1 + 1, -1 + 1) = (0,0)`, the new grid's top-left ✓.
  Blueprint cell (1,1) → `(0 + 1, 0 + 1) = (1,1)` ✓.
- `applyGrowthShift(1, 1, …)` moves the active pan by `-RENDERED_TILE_SIZE` on each axis and
  adds 1 to every existing background placement's `col`/`row` — identical to what a single
  leftward-and-upward paint already does today, so the view does not jump.

A second worked example with no growth: grid 8×6, blueprint 3 rows × 4 cols anchored at
(2,3) → absolute rows 2..4, cols 3..6, all in bounds → both `growGrid` calls are no-ops,
`colShift = rowShift = 0`, and every cell is written at `(2 + row, 3 + col)`.

### A.5 Preview rendering, and cancelling a pending placement

`EditorCanvas` gains **one** optional prop —
`placementPreview?: { cells: readonly { row: number; col: number }[]; valid: boolean } | null`
— so its ~30 existing render sites keep compiling. It tints each preview cell and strokes a
rectangle around the preview's bounding box in blue (`valid`) or red, at `panOffset`, in the
same `tileToPixel`-plus-origin idiom `drawTileMarkers` already uses. Deliberately a
*bounding-box border* rather than per-cell colouring, so it never reads as another cell
marker next to 44b's blue connection-point tint. Two-click state
(`pendingPlacement: { row, col } | null`) lives in `LevelEditorPage` as plain `useState`: a
half-finished placement must not survive a reload.

**Cancel gesture (resolved with the project owner, design doc updated):** right-click, while
a blueprint is armed, cancels the pending placement instead of committing anywhere — it
clears `pendingPlacement` and disarms `editorArmedBlueprintIdSignal` (equivalent to
re-clicking the armed blueprint's own Palette entry). Right-click has no "erase" meaning
during a placement preview (nothing is being painted, so there's nothing to erase), so this
costs nothing and needs no round-trip back to the Palette. `EditorCanvas`'s
`handleMouseDown` must check for an armed blueprint (A.1) before its existing
`event.button === 2` erase branch, the same way it already checks the armed blueprint before
the normal paint path.

---

## Self-Review Notes

- **Why this is Part 1 of two, and where the seam is.** The design doc's step 44c is two
  headings — "Saving and the palette library" and "Placement" — and only the first sentence
  of the first heading's last bullet ("`Palette.tsx` gains a Blueprints section") crosses
  between them. Everything in Part 1 is a mirror of machinery that already exists (level
  save, level registry, dev-server plugin) and is verifiable on its own: after Task 11 a
  developer can save a room to a file, reload, reopen it, and see the Save controls vanish on
  a built site. Everything in Part 2 is new behavior with a new algorithm. Splitting there
  means neither plan contains a task whose value depends on the other plan landing. Part 1
  exports exactly what Part 2 needs (`BLUEPRINTS`, `findBlueprint`, `Blueprint`) and nothing
  speculative.
- **Spec coverage, clause by clause.** "`saveBlueprintFile.ts`: `blueprintFileJson`,
  `blueprintFileName`, `saveBlueprint` (POST, falling back to download),
  `downloadBlueprintFile` — the same four-function shape" → Task 1, all four, plus the
  `blueprintId` the slug rule needs. "`saveBlueprintEndpoint.ts`: `BLUEPRINTS_FOLDER =
  'src/themes/platformer/level/blueprints/'`, `SAVE_BLUEPRINT_ENDPOINT = '/__save-blueprint'`"
  → Task 1, both literals verbatim. "`vite/writeBlueprintFile.ts` +
  `vite/blueprintWritePlugin.ts` (`apply: 'serve'`): same validation shape as
  `writeLevelFile.ts`" → Tasks 2-4 (same validation, now literally the same code).
  "`blueprintRegistry.ts` … `import.meta.glob`s `blueprints/*.json` at build time into
  `Blueprint[]`, skipping any file that isn't a well-formed `Blueprint`" → Task 5. The
  `/__dev-environment` route, the ping, `isDevEnvironmentSignal`, and both controls hidden
  → Tasks 6, 7, 10. `Palette.tsx`'s Blueprints section and everything under "Placement" →
  Appendix A / Part 2, explicitly excluded here.
- **Deviation, deliberate — the dev-server writer is shared, not mirrored.** The design says
  "same validation shape as `writeLevelFile.ts`". Task 2 makes it the same *code* instead.
  Justification and evidence are in the task itself: this is the only request-body-driven
  filesystem write in the repo, and its error strings are asserted nowhere — I checked every
  assertion in `writeLevelFile.test.ts` (status, `body.path`, `expect(error).toBeTruthy()`,
  file contents) and `levelWritePlugin.test.ts` (status, envelope, truthy error) before
  proposing it. The plugin wrappers stay separate mirrors because their variable parts are
  a name, an endpoint and a writer, and touching `levelWritePlugin.ts` would buy nothing.
- **Deviation, deliberate — `probeDevEnvironment` only ever writes `true`.** The design says
  the signal is "`false` until/unless the ping succeeds"; write-only-on-success implements
  exactly that while avoiding a real hazard I traced through the existing suite:
  `LevelEditorPage.test.tsx` stubs `fetch` per test (`stubDownloads` rejects everything,
  `stubDevServerWrite` answers `{path}` to everything), and those same stubs answer the
  probe. A probe that wrote `false` would race each test's own arrangement and make the Save
  button disappear mid-assertion. It is also the semantically honest rule: the ping can prove
  a dev server is present, never that one is absent.
- **Deviation, deliberate — `LevelEditorPage` subscribes rather than calling `useSignals()`.**
  Every other signal-reading component here uses `useSignals()`, but this page reads six
  persisted signals inside `useState` initializers, and `useSignals()` tracks reads during
  render — so writes to `editorLevelSignal` (the 400 ms debounced grid sync, i.e. after
  every paint burst) would start re-rendering the whole editor. `signal.subscribe` is already
  the in-repo mechanism (`createLocalStorageSignal` uses it) and touches nothing else.
- **Deviation, deliberate — `BlueprintSelect` loses `useSignals()` and one test.** The 44a
  entry list was a signal; the registry is a build-time constant, so the hook has nothing to
  track, and the malformed-entry test moves to `blueprintRegistry.test.ts` where the
  filtering now happens. The user-visible consequence — a just-saved blueprint appears after
  a reload, not instantly — is the same behavior levels already have and is stated in the
  Save dialog.
- **The `'new'` collision, carried forward on purpose.** Deleting `blueprintStash.ts` would
  have silently dropped its one non-placeholder rule. `BLANK_BLUEPRINT.id === 'new'` and the
  Save dialog pre-fills the loaded name (`'new'` on a fresh canvas), so an un-renamed save
  would write `new.json`, whose registry id shadows the dropdown's blank entry. Task 1 moves
  the guard into `blueprintId` and pins it with two tests; `FILE_NAME_PATTERN`
  (`/^[a-z0-9][a-z0-9-]*\.json$/`) accepts `new-1.json`, checked by hand against the real
  regex.
- **Character check against the CURRENT parser, not a stale assumption.** I read
  `LevelParser.ts` on this branch post-merge: `TERRAIN_CHARS` is
  `. G R # B H I P + n N X c ⊤ ⊥`, `ENTITY_CHARS` is `S M m o = Q F u p $` (chest is `$`,
  crate is `=`, `X` is now cobweb terrain), `SIGN_CHARS` `1-5`, `HAZARD_CHARS` `^ v < >`.
  Nothing in this plan adds or reserves a character, so no collision is possible — but the
  test fixtures were written against that real set: layouts use `#`, `G` and `+` only, and
  the connection-point round-trip test in Task 5 uses `'+'`, which really is
  `TERRAIN_CHARS['+'] === 'blueprintConnectionPoint'` today.
- **Fixture arithmetic, hand-verified.**
  - Task 9's save tests reuse step 44a's `paintBlueprintCell(2, 1)` on a `[['.']]` canvas at
    pan `{0,0}`: `growGrid` gives `growRight = 2 - 1 + 1 = 2`, `growBottom = 1 - 1 + 1 = 1`,
    `growLeft = growTop = 0` → a 3×2 grid with both shifts 0, so `'G'` lands at
    `grid[1][2]`. `cropLevelForExport`'s tightest non-`.` box is `minRow = maxRow = 1`,
    `minCol = maxCol = 2` → `layout = ['G']`, origin `(2,1)`, so a background piece on that
    same cell rebases to `(0,0)`. Both are exactly what the rewritten assertions expect, and
    both match what 44a's and 44b's own plans verified.
  - The connection-point variant paints `(3,1)` after `(2,1)`: the second grow is again
    right-only (4×2, shifts 0), `'+'` lands at `grid[1][3]`, and the crop spans cols 2..3 →
    `layout = ['G+']`.
  - `blueprintFileName('Cave Room Two')`: lowercase → `'cave room two'`, `[^a-z0-9]+` → `-`
    gives `'cave-room-two'`, no leading/trailing hyphens to trim, `≠ 'new'` →
    `'cave-room-two.json'`. `blueprintFileName('  -- cave room -- ')`: the first replace
    collapses each *run* of non-alphanumerics to a single hyphen (not one per character),
    giving `'-cave-room-'`; the trim then gives `'cave-room'` → `'cave-room.json'`, which is
    what the test asserts (and matches `levelFileName`'s own identical test).
  - Appendix A.4's growth arithmetic is worked twice above, once with a
    prepend-both-axes case and once with a fully-in-bounds case.
- **`mock.calls` typing, confirmed by compiling it.** `vi.fn(() => …)` (Vitest 4) types
  `mock.calls` from the zero-argument factory, i.e. as `[][]`, so reading a call's elements
  directly — `calls.find(([url]) => …)`, `calls.every(([url]) => …)`, `calls[0][1]` — is a
  `strict` compile error (`TS2493: Tuple type '[]' of length '0' has no element at index
  '0'`), even though the real `fetch` calls do carry arguments. Every such read in this plan
  goes through a widened view: Task 1 copies `saveLevelFile.test.ts`'s
  `as unknown as [string, RequestInit]` cast, and Task 9's `stubBlueprintWrite` hands back a
  `fetchCalls(): unknown[][]` accessor instead of the mock. `expect(mock).toHaveBeenCalledWith(arg)`
  on the same zero-argument mock does *not* error (checked), so Task 6 uses it as written.
- **Test-runner facts confirmed against the repo.** `vitest.config.ts` sets `globals: true`,
  but `saveLevelFile.test.ts`, `levelRegistry.test.ts`, `writeLevelFile.test.ts` and
  `levelWritePlugin.test.ts` all import their helpers explicitly, so the new files copy that.
  `levelWritePlugin.test.ts`'s stub-server harness (`mountPlugin`/`fakeResponse`/`request`/
  `send`) is reproduced verbatim in Tasks 4 and 7 because the real plugin API surface it
  fakes — `server.config.root` and `server.middlewares.use(path, handler)` — is exactly what
  the new plugins use. `LevelEditorPage.test.tsx` already mocks `../engine/Renderer` and
  `../engine/SpriteLoader`, stubs `getContext`, and has a top-level
  `afterEach(vi.unstubAllGlobals)`, so the new tests need no rendering or teardown setup of
  their own; its existing `vi.mock('../level/levelRegistry', …)` is the model for the
  `blueprintRegistry` mock, and `vi.hoisted` is used the same way for the same reason (mock
  factories are hoisted above plain `const`s).
- **Type/name threading, checked end to end.** `Blueprint` (44a's type, unchanged) is
  produced by `blueprintRegistry.parseBlueprintModules`, listed by `BLUEPRINTS`, consumed by
  `BlueprintSelectProps.onLoadBlueprint` and `LevelEditorPage.loadBlueprint` — same four
  fields, never renamed, never widened. `BLUEPRINTS_FOLDER` has exactly one definition
  (`saveBlueprintEndpoint.ts`), re-exported by `saveBlueprintFile.ts` the way
  `saveLevelFile.ts` re-exports `LEVELS_FOLDER`, and is the single string used by the Node
  writer, the browser save path and the dialog copy — so the folder the file is written to
  and the folder the dialog names can never disagree. `SAVE_BLUEPRINT_ENDPOINT` and
  `DEV_ENVIRONMENT_ENDPOINT` likewise each have one definition, shared by their plugin and
  their client. `SaveBlueprintResult` mirrors `SaveLevelResult` field for field
  (`written`/`path`/`error`), so the page's two save flows read identically.
- **Import-direction check.** `level/blueprintRegistry.ts` imports only
  `level/BlueprintData` — no `editor/` module, so the `editor → level` direction that every
  other file follows is preserved (the one exception is `blueprintRegistry.test.ts`
  importing `editor/saveBlueprintFile` for the round-trip test, which is a test file and
  matches `saveLevelFile.test.ts` importing `level/levelRegistry` in the other direction).
  `vite/*` imports only the two import-free constant modules from `src/`. No cycle.
- **Every commit leaves the suite green.** Task 2's extraction keeps `writeLevelFile.test.ts`
  passing unedited (that is its proof). Tasks 1, 3-7 only add files. Task 8 changes
  `BlueprintSelect` and its own test together. Task 9 changes `LevelEditorPage` and deletes
  the stash and its test together — the stash's last consumer disappears in the same commit
  it does. Task 10 adds the gate and the `beforeEach` line the pre-existing save tests need,
  together.
- **Placeholder scan.** No TBDs and no vague prose standing in for code. Every code block is
  complete as written and was authored against the real file it mirrors or edits, each read
  in full first: `saveLevelFile.ts`, `saveLevelEndpoint.ts`, `levelRegistry.ts`,
  `levelRegistry.test.ts`, `saveLevelFile.test.ts`, `vite.config.ts`, `vite/writeLevelFile.ts`
  (+ test), `vite/levelWritePlugin.ts` (+ test), `blueprintStash.ts`, `BlueprintData.ts`,
  `BlueprintSelect.tsx` (+ test), `LevelSelect.tsx`, `LevelEditorPage.tsx` (+ the relevant
  parts of its test), `Palette.tsx`, `EditorCanvas.tsx`, `importLayout.ts`,
  `exportLayout.ts`, `cropLevelForExport.ts`, `growGrid.ts`, `paintCell.ts`,
  `LevelParser.ts`, `Terrain.ts`, and `@/lib/utils`. The only elisions are the two explicitly
  marked "the existing Save Button and Dialog move in here, unchanged" comments in Task 10,
  which move existing JSX rather than author new code.
