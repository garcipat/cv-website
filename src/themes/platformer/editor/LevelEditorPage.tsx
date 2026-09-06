import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { importLayout } from './importLayout';
import { exportLayout } from './exportLayout';
import { cropLevelForExport } from './cropLevelForExport';
import { Palette } from './Palette';
import { EditorCanvas, type EditorImages } from './EditorCanvas';
import { updatePanOffset, type PanOffset } from './EditorPan';
import type { TileChar } from '../level/LevelParser';
import { currentLayout, currentBackground } from '../level/level';
import type { LevelEntry } from '../level/levelRegistry';
import { LevelSelect } from './LevelSelect';
import { BlueprintSelect } from './BlueprintSelect';
import { saveLevel, LEVELS_FOLDER, type SaveLevelResult } from './saveLevelFile';
import { saveBlueprintToStash } from './blueprintStash';
import type { Blueprint } from '../level/BlueprintData';
import type { BackgroundPlacement, BackgroundPieceId } from '../level/LevelData';
import { backgroundCatalogEntry } from '../engine/BackgroundCatalog';
import {
  editorLevelSignal,
  editorSelectedToolSignal,
  editorLoadedLevelNameSignal,
  editorDirtySignal,
  editorBackgroundSignal,
  editorActiveLayerSignal,
  editorSelectedBackgroundPieceSignal,
  editorCanvasModeSignal,
  editorBlueprintSignal,
  editorBlueprintBackgroundSignal,
  editorLoadedBlueprintNameSignal,
} from './editorLevelState';
import { resetGameProgress } from '../PlatformerState';
import { loadImage } from '../engine/SpriteLoader';
import { TERRAIN_BACKGROUND_SHEET, STATIC_OBJECTS_SHEET, DECORATIONS_SHEET } from '../entities/sprites/sheets';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { currentTheme } from '@/state/theme';
import { navigateTo } from '@/state/navigation';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';

const EMPTY_IMAGES: EditorImages = {
  tileset: null,
  groundAtlas: null,
  player: null,
  coin: null,
  fruit: null,
  slimeGreen: null,
  slimePurple: null,
  crackOverlay: null,
  chestClosed: null,
  backgroundAtlas: null,
  staticObjects: null,
  decorations: null,
};

const IMAGE_SOURCES: { key: keyof EditorImages; src: string }[] = [
  { key: 'tileset', src: '/sprites/world_tileset.png' },
  { key: 'groundAtlas', src: '/sprites/tile_atlas.png' },
  { key: 'player', src: '/sprites/knight.png' },
  { key: 'coin', src: '/sprites/coin.png' },
  { key: 'fruit', src: '/sprites/fruit.png' },
  { key: 'slimeGreen', src: '/sprites/slime_green.png' },
  { key: 'slimePurple', src: '/sprites/slime_purple.png' },
  { key: 'crackOverlay', src: '/sprites/crack_overlay.png' },
  { key: 'chestClosed', src: '/sprites/chest_closed.png' },
  { key: 'backgroundAtlas', src: TERRAIN_BACKGROUND_SHEET.src },
  { key: 'staticObjects', src: STATIC_OBJECTS_SHEET.src },
  { key: 'decorations', src: DECORATIONS_SHEET.src },
];

// How long to wait after the last paint stroke before syncing `grid` into
// `editorLevelSignal` (and, from there, localStorage) — long enough that a
// rapid drag-paint session writes once at the end instead of on every single
// cell, short enough that closing the tab moments after the last stroke
// still persists it.
const EDITOR_LEVEL_SYNC_DEBOUNCE_MS = 400;

// Blueprint mode has no Spawn tool and level mode has no Connection Point
// tool (Palette.tsx), so an already-armed one of either is swapped for this
// when the canvas it does not belong to becomes active.
const SPAWN_CHAR: TileChar = 'S';
const CONNECTION_POINT_CHAR: TileChar = '+';
const FALLBACK_TOOL: TileChar = 'G';

export const LevelEditorPage = () => {
  // Seeded from editorLevelSignal.value (localStorage-backed, see
  // editorLevelState.ts), not always the hardcoded default — this is what
  // makes edits from a previous visit still be there on reopening the
  // editor. `grid` itself stays local useState (not the signal directly) so
  // the painting hot path (EditorCanvas's onPaint below, firing on every
  // dragged cell) stays snappy; the effect further down is what pushes it
  // back into the signal, debounced.
  const [grid, setGrid] = useState<TileChar[][]>(() => editorLevelSignal.value);
  // Seeded from editorSelectedToolSignal.value (localStorage-backed) the
  // same way `grid` is seeded from editorLevelSignal above — a tool
  // selection is a discrete click, not a hot drag path, so it's written
  // straight through on every change rather than debounced.
  const [selectedTool, setSelectedToolState] = useState<TileChar>(() => editorSelectedToolSignal.value);
  const setSelectedTool = (tool: TileChar) => {
    setSelectedToolState(tool);
    editorSelectedToolSignal.value = tool;
  };
  // Background-layer counterparts of `grid`/`selectedTool` above, following
  // exactly the same pattern: local state seeded from the persisted signal,
  // synced back debounced (placements) or straight through (the active layer
  // and the selected piece — discrete clicks, not a hot drag path).
  const [backgroundPlacements, setBackgroundPlacements] = useState<BackgroundPlacement[]>(
    () => editorBackgroundSignal.value,
  );
  const [activeLayer, setActiveLayerState] = useState<'foreground' | 'background'>(
    () => editorActiveLayerSignal.value,
  );
  const setActiveLayer = (layer: 'foreground' | 'background') => {
    setActiveLayerState(layer);
    editorActiveLayerSignal.value = layer;
  };
  const [selectedBackgroundPiece, setSelectedBackgroundPieceState] = useState<BackgroundPieceId | null>(
    () => editorSelectedBackgroundPieceSignal.value,
  );
  const setSelectedBackgroundPiece = (pieceId: BackgroundPieceId) => {
    setSelectedBackgroundPieceState(pieceId);
    editorSelectedBackgroundPieceSignal.value = pieceId;
  };
  // Which canvas is being edited (roadmap step 44a). Orthogonal to
  // `activeLayer` above: that one picks foreground/background WITHIN
  // whichever canvas this one selects, and both toggles stay visible and
  // keep working together.
  const [canvasMode, setCanvasModeState] = useState<'level' | 'blueprint'>(
    () => editorCanvasModeSignal.value,
  );
  // Whether the level canvas still owes itself a spawn-centering. Mounting
  // already in blueprint mode lets that canvas consume EditorCanvas's
  // one-shot centering request (a no-op on a spawn-less grid), so the debt
  // is tracked here and spent on the FIRST switch back to Level — never on
  // later ones, which would yank a hand-panned view back to the spawn
  // (design note 5).
  const levelCenterPendingRef = useRef(editorCanvasModeSignal.value === 'blueprint');
  // Bumped to ask EditorCanvas to center the view on the spawn tile; it
  // starts at 1 rather than 0 so opening the editor is itself a request, and
  // the view lands on the player instead of on the grid's top-left corner.
  // Declared here (rather than alongside `panOffset` below) so
  // `setCanvasMode` just below can call it directly instead of forward
  // -referencing it — a forward reference is what the project's
  // react-hooks/immutability lint rule flags as an unsafe mutation.
  const [centerRequestId, setCenterRequestId] = useState(1);
  const requestCenterOnSpawn = () => setCenterRequestId((id) => id + 1);
  const setCanvasMode = (mode: 'level' | 'blueprint') => {
    setCanvasModeState(mode);
    editorCanvasModeSignal.value = mode;
    if (mode === 'blueprint' && selectedTool === SPAWN_CHAR) {
      setSelectedTool(FALLBACK_TOOL);
    }
    if (mode === 'level' && selectedTool === CONNECTION_POINT_CHAR) {
      setSelectedTool(FALLBACK_TOOL);
    }
    if (mode === 'level' && levelCenterPendingRef.current) {
      levelCenterPendingRef.current = false;
      requestCenterOnSpawn();
    }
  };
  const isBlueprintMode = canvasMode === 'blueprint';
  // The blueprint canvas's own grid/background/name — a second, fully
  // independent canvas, not a region of the level. Same
  // seeded-from-a-persisted-signal, debounce-synced-back pattern as `grid`
  // and `backgroundPlacements` above.
  const [blueprintGrid, setBlueprintGrid] = useState<TileChar[][]>(
    () => editorBlueprintSignal.value,
  );
  const [blueprintBackgroundPlacements, setBlueprintBackgroundPlacements] = useState<
    BackgroundPlacement[]
  >(() => editorBlueprintBackgroundSignal.value);
  const [loadedBlueprintName, setLoadedBlueprintNameState] = useState(
    () => editorLoadedBlueprintNameSignal.value,
  );
  const setLoadedBlueprintName = (name: string) => {
    setLoadedBlueprintNameState(name);
    editorLoadedBlueprintNameSignal.value = name;
  };
  // Deliberately separate from the level's `isDirty`: painting a room must
  // not make the LEVEL dropdown warn about discarding work, and editing the
  // level must not make the blueprint dropdown warn either. Not persisted —
  // unlike the level's flag it guards nothing across reloads, since a
  // freshly reopened blueprint canvas is whatever was last painted on it.
  const [blueprintDirty, setBlueprintDirty] = useState(false);
  const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  // Each canvas keeps its own view. The level's pan is spawn-centered and
  // typically thousands of pixels from the origin; reusing it for a
  // one-cell blueprint would park that cell far outside the viewport and
  // make blueprint mode look broken.
  const [blueprintPanOffset, setBlueprintPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const activePanOffset = isBlueprintMode ? blueprintPanOffset : panOffset;
  const setActivePanOffset = isBlueprintMode ? setBlueprintPanOffset : setPanOffset;
  const [images, setImages] = useState<EditorImages>(EMPTY_IMAGES);
  // Which level the grid came from, and whether it has been touched since —
  // both persisted (see editorLevelState.ts) so reopening the editor still
  // knows what is open and whether there is anything to lose. The dirty flag
  // is what makes the level dropdown ask before it discards work.
  const [loadedLevelName, setLoadedLevelNameState] = useState(
    () => editorLoadedLevelNameSignal.value,
  );
  const [isDirty, setIsDirtyState] = useState(() => editorDirtySignal.value);
  const setLoadedLevelName = (name: string) => {
    setLoadedLevelNameState(name);
    editorLoadedLevelNameSignal.value = name;
  };
  const setDirty = (dirty: boolean) => {
    setIsDirtyState(dirty);
    editorDirtySignal.value = dirty;
  };
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState(loadedLevelName);
  const [blueprintSaveDialogOpen, setBlueprintSaveDialogOpen] = useState(false);
  const [blueprintSaveName, setBlueprintSaveName] = useState(loadedBlueprintName);
  // What the last save actually did — the dev server wrote the file, or the
  // browser downloaded it instead. Reported rather than assumed, since the two
  // leave the file in very different places: a successful write closes the
  // dialog and says where it went in the sidebar, while a fallback download
  // keeps the dialog open, because then there is something left to do.
  const [saveResult, setSaveResult] = useState<SaveLevelResult | null>(null);

  useEffect(() => {
    IMAGE_SOURCES.forEach(({ key, src }) => {
      loadImage(src)
        .then((img) => setImages((prev) => ({ ...prev, [key]: img })))
        .catch(() => {});
    });
  }, []);

  // Debounced localStorage persistence: every `grid` change (re)starts a
  // timer, and only the LAST one in a burst actually fires and writes to
  // `editorLevelSignal` — matching EDITOR_LEVEL_SYNC_DEBOUNCE_MS's doc
  // comment above. The cleanup clears the pending timer on every re-run
  // (including unmount), which is exactly what makes this "debounced"
  // rather than "fires once per change".
  useEffect(() => {
    const timer = window.setTimeout(() => {
      editorLevelSignal.value = grid;
    }, EDITOR_LEVEL_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [grid]);

  // Same debounced sync as `grid` above, for the background layer's
  // placements — a rapid drag-paint stroke over the background writes once at
  // the end instead of on every cell.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      editorBackgroundSignal.value = backgroundPlacements;
    }, EDITOR_LEVEL_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [backgroundPlacements]);

  // Mount-time counterpart of setCanvasMode's two disarms: the mode and the
  // tool are both persisted, so the editor can come back up on either canvas
  // with the other canvas's exclusive tool still armed, without any toggle
  // click ever happening. Deliberately mount-only — a later mode switch is
  // the other handler's job.
  useEffect(() => {
    // Deliberate one-shot mount-time correction of persisted state (see
    // comment above), not a render derived from a prop/state change.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isBlueprintMode && selectedTool === SPAWN_CHAR) setSelectedTool(FALLBACK_TOOL);
    if (!isBlueprintMode && selectedTool === CONNECTION_POINT_CHAR) setSelectedTool(FALLBACK_TOOL);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same debounced localStorage sync the level's own grid/background get
  // above — the blueprint canvas is persisted for exactly the same reason: a
  // half-painted room must still be there after a reload.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      editorBlueprintSignal.value = blueprintGrid;
    }, EDITOR_LEVEL_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [blueprintGrid]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      editorBlueprintBackgroundSignal.value = blueprintBackgroundPlacements;
    }, EDITOR_LEVEL_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [blueprintBackgroundPlacements]);

  const exportedText = exportLayout(grid)
    .map((row) => `  '${row}',`)
    .join('\n');

  /**
   * Loads a level picked from the dropdown, which is also how the editor's
   * former Reset and Scratch buttons are now spelled: `main` puts back what
   * ships, `empty` gives a bare starting grid (see `LevelSelect`, which has
   * already confirmed the discard if there was anything to lose).
   *
   * The persisted (localStorage-backed) copy is written too, not just local
   * state — otherwise the debounced sync effect above would shortly overwrite
   * the freshly loaded grid with the still-pending previous one, and
   * reopening the editor would silently restore the discarded edits.
   *
   * `level.background` is filtered against the current catalog before it
   * goes anywhere: a placement whose `pieceId` no longer resolves (left over
   * from a since-trimmed catalog, e.g. in a stale `localStorage` copy or an
   * old saved level JSON) renders as nothing (Task 19) and, because
   * `paintBackgroundCell.ts`'s empty-footprint fallback means right-click can
   * never find it, would otherwise stay invisible AND permanently
   * un-erasable in the editor while round-tripping through every subsequent
   * save forever. Dropping it here, once, at load time closes that gap.
   */
  const loadLevel = (level: LevelEntry) => {
    const levelGrid = importLayout(level.layout);
    setGrid(levelGrid);
    // As of this task, LevelSelect (and thus this function) is only ever
    // reachable with isBlueprintMode === false — it's unconditionally hidden
    // while the blueprint canvas is on screen (see the `{!isBlueprintMode &&
    // (...)}` wrapper around LevelSelect below). So the `if` branch here is
    // currently dead code, kept rather than deleted because a future step
    // (44c) may end up letting a level be loaded while the blueprint canvas
    // is the one on screen, at which point it becomes reachable again and
    // this guard is what's needed: firing the centering request
    // unconditionally would let the CURRENTLY ACTIVE canvas — the
    // blueprint's — consume it (EditorCanvas's centering effect targets
    // whichever grid is active right now, regardless of which grid just
    // changed), silently resetting a hand-panned blueprint view AND leaving
    // the level never centered once the user switches back to it. So this
    // arms the same debt `setCanvasMode` already pays back on the first
    // switch to Level, instead of spending the one-shot request immediately.
    if (isBlueprintMode) {
      levelCenterPendingRef.current = true;
    } else {
      requestCenterOnSpawn();
    }
    editorLevelSignal.value = levelGrid;
    const validBackground = (level.background ?? []).filter(
      (placement) => backgroundCatalogEntry(placement.pieceId) !== undefined,
    );
    setBackgroundPlacements(validBackground);
    editorBackgroundSignal.value = validBackground;
    setLoadedLevelName(level.name);
    setDirty(false);
    setSaveResult(null);
  };

  /**
   * Saving asks the dev server to write the level into `LEVELS_FOLDER` — the
   * folder the level registry reads — and falls back to a plain download when
   * there is no dev server behind the page (see `saveLevel` in
   * `saveLevelFile.ts`). Either way the saved name becomes the open level's
   * name and the dirty flag clears: the work is out of the editor now, so
   * loading something else has nothing left to warn about.
   *
   * A write that succeeded closes the dialog — there is nothing left to do
   * with it — and leaves the path in the sidebar. A fallback download keeps
   * the dialog open instead, because the file then still has to be moved and
   * that is worth saying before it is dismissed.
   */
  const saveCurrentLevel = async () => {
    const cropped = cropLevelForExport(grid, backgroundPlacements);
    const result = await saveLevel(saveName, cropped.layout, cropped.background);
    setSaveResult(result);
    setLoadedLevelName(saveName);
    setDirty(false);
    if (result.written) setSaveDialogOpen(false);
  };

  /**
   * Loads a blueprint picked from the dropdown onto the blueprint canvas —
   * the blueprint counterpart of `loadLevel` above, including its reason for
   * writing the persisted signals directly and not only local state: without
   * that, the debounced sync effect would shortly overwrite the freshly
   * loaded canvas with the still-pending previous one. `BlueprintSelect` has
   * already confirmed the discard if there was anything to lose.
   */
  const loadBlueprint = (blueprint: Blueprint) => {
    const grid = importLayout(blueprint.layout);
    setBlueprintGrid(grid);
    editorBlueprintSignal.value = grid;
    const background = [...(blueprint.background ?? [])];
    setBlueprintBackgroundPlacements(background);
    editorBlueprintBackgroundSignal.value = background;
    setLoadedBlueprintName(blueprint.name);
    setBlueprintDirty(false);
  };

  /**
   * Saves the blueprint canvas under a name, cropped through the very same
   * `cropLevelForExport` a level save uses (tightest non-`.` bounding box,
   * background placements rebased onto that same origin) — a `Blueprint` is
   * deliberately the same `{ name, layout, background? }` shape a saved level
   * file is. Step 44a stores it in a `localStorage` stash; step 44c replaces
   * that with a real file written next to the levels, at which point only
   * `blueprintStash.ts` changes, not this call site.
   */
  const saveCurrentBlueprint = () => {
    const cropped = cropLevelForExport(blueprintGrid, blueprintBackgroundPlacements);
    saveBlueprintToStash(blueprintSaveName, cropped.layout, cropped.background);
    setLoadedBlueprintName(blueprintSaveName);
    setBlueprintDirty(false);
    setBlueprintSaveDialogOpen(false);
  };

  /**
   * What both canvases do when a paint grew their grid: a cell at index i
   * draws at i * RENDERED_TILE_SIZE + pan, and growth increases every
   * existing index by colShift/rowShift, so the active pan moves by the
   * negative of that to cancel it out (spec FR-020/SC-006) and every
   * background placement shifts with it, since `growGrid` never touches that
   * separate list (Task 20 gap #1).
   */
  const applyGrowthShift = (
    colShift: number,
    rowShift: number,
    setPlacements: Dispatch<SetStateAction<BackgroundPlacement[]>>,
  ) => {
    if (colShift === 0 && rowShift === 0) return;
    setActivePanOffset((prev) =>
      updatePanOffset(prev, -colShift * RENDERED_TILE_SIZE, -rowShift * RENDERED_TILE_SIZE),
    );
    setPlacements((prev) =>
      prev.map((placement) => ({
        ...placement,
        col: placement.col + colShift,
        row: placement.row + rowShift,
      })),
    );
  };

  /**
   * Try (roadmap: editor/game round-trip): exports the current grid, sets it
   * as the in-memory layout the GAME reads (`level.ts`'s `currentLayout` —
   * deliberately NOT this editor's own localStorage-backed signal, see its
   * doc comment), then calls `resetGameProgress()` — REQUIRED, not optional:
   * `enemyStates`/`blockStates`/`chestStates`/`bonusFruitStates` are plain
   * signals seeded once at module load, not `computed()` signals reactive to
   * `currentLayout`, so without this they'd keep pointing at whichever
   * layout was active before, and a marker just added in the editor (e.g. a
   * new enemy) would silently never appear when tried. This also clears any
   * collected facts/coins from a previous Try session, so trying a layout is
   * always a clean slate, not tainted by prior progress. Then switches the
   * active theme to Platformer and navigates client-side (no real reload — a
   * reload would discard `currentLayout` back to the hardcoded default
   * before the game ever saw it) straight into the game via its dedicated
   * `/platformer` route, with the debug panel visible (`?debug=1` — matches
   * PlatformerPage.tsx's `debugControls` gate, any `debug` param shows it,
   * only recognized on that route) so Kill/Respawn/Hitboxes are immediately
   * available for testing the layout.
   */
  const tryLayout = () => {
    const cropped = cropLevelForExport(grid, backgroundPlacements);
    currentLayout.value = cropped.layout;
    currentBackground.value = cropped.background;
    resetGameProgress();
    currentTheme.value = 'platformer';
    navigateTo('/platformer?debug=1');
  };

  return (
    <div className="flex h-screen flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Platformer Level Editor</h1>
      <div className="flex min-h-0 flex-1 flex-row items-stretch gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2" role="group" aria-label="Layer">
            <button
              type="button"
              aria-pressed={activeLayer === 'foreground'}
              className={cn('rounded px-1.5 py-0.5 text-xs', activeLayer === 'foreground' && 'bg-muted font-medium')}
              onClick={() => setActiveLayer('foreground')}
            >
              Foreground
            </button>
            <button
              type="button"
              aria-pressed={activeLayer === 'background'}
              className={cn('rounded px-1.5 py-0.5 text-xs', activeLayer === 'background' && 'bg-muted font-medium')}
              onClick={() => setActiveLayer('background')}
            >
              Background
            </button>
          </div>
          <div className="flex gap-2" role="group" aria-label="Canvas">
            <button
              type="button"
              aria-pressed={!isBlueprintMode}
              className={cn('rounded px-1.5 py-0.5 text-xs', !isBlueprintMode && 'bg-muted font-medium')}
              onClick={() => setCanvasMode('level')}
            >
              Level
            </button>
            <button
              type="button"
              aria-pressed={isBlueprintMode}
              className={cn('rounded px-1.5 py-0.5 text-xs', isBlueprintMode && 'bg-muted font-medium')}
              onClick={() => setCanvasMode('blueprint')}
            >
              Blueprint
            </button>
          </div>
          <Palette
            selectedTool={selectedTool}
            onSelectTool={setSelectedTool}
            activeLayer={activeLayer}
            selectedBackgroundPiece={selectedBackgroundPiece}
            onSelectBackgroundPiece={setSelectedBackgroundPiece}
            canvasMode={canvasMode}
          />
          {!isBlueprintMode && (
            <>
              <LevelSelect
                loadedLevelName={loadedLevelName}
                isDirty={isDirty}
                onLoadLevel={loadLevel}
              />
              <Dialog>
                <DialogTrigger render={<Button type="button" variant="outline">Export</Button>} />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Export Layout</DialogTitle>
                  </DialogHeader>
                  <textarea
                    readOnly
                    data-testid="export-output"
                    value={exportedText}
                    className="h-64 w-full resize-none font-mono text-xs"
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(exportedText).catch(() => {});
                      }}
                    >
                      Copy Layout
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSaveName(loadedLevelName);
                  setSaveResult(null);
                  setSaveDialogOpen(true);
                }}
              >
                Save
              </Button>
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save this level</DialogTitle>
                    <DialogDescription>
                      Writes the level as a JSON file into <code>{LEVELS_FOLDER}</code>, where the level
                      list reads it from. Reload the editor afterwards to see it there.
                    </DialogDescription>
                  </DialogHeader>
                  <label className="flex flex-col gap-1 text-sm" htmlFor="save-level-name">
                    Level name
                    <input
                      id="save-level-name"
                      value={saveName}
                      onChange={(event) => setSaveName(event.target.value)}
                      className="rounded border px-2 py-1 font-mono text-xs"
                    />
                  </label>
                  {saveResult !== null && !saveResult.written && (
                    <p className="text-sm" role="status">
                      No dev server to write it
                      {saveResult.error === undefined ? '' : ` (${saveResult.error})`}, so it went to
                      your downloads instead. Move it into <code>{LEVELS_FOLDER}</code> yourself.
                    </p>
                  )}
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>
                      {saveResult === null ? 'Cancel' : 'Done'}
                    </DialogClose>
                    <Button type="button" onClick={saveCurrentLevel}>
                      Save level file
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          {isBlueprintMode && (
            <>
              <BlueprintSelect
                loadedBlueprintName={loadedBlueprintName}
                isDirty={blueprintDirty}
                onLoadBlueprint={loadBlueprint}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBlueprintSaveName(loadedBlueprintName);
                  setBlueprintSaveDialogOpen(true);
                }}
              >
                Save Blueprint
              </Button>
              <Dialog open={blueprintSaveDialogOpen} onOpenChange={setBlueprintSaveDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save this blueprint</DialogTitle>
                    <DialogDescription>
                      Stores the blueprint canvas in this browser, cropped to the cells you
                      painted. Step 44c replaces this with a real file written next to the
                      levels.
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
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>
                      Cancel
                    </DialogClose>
                    <Button type="button" onClick={saveCurrentBlueprint}>
                      Save blueprint
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
          {!isBlueprintMode && (
            <>
              <Button type="button" onClick={tryLayout}>
                Try
              </Button>
              {saveResult?.written === true && (
                <p className="max-w-40 text-xs break-all text-muted-foreground" role="status">
                  Saved to <code>{saveResult.path}</code> — reload to see it in the level list.
                </p>
              )}
            </>
          )}
        </div>
        <EditorCanvas
          grid={isBlueprintMode ? blueprintGrid : grid}
          selectedTool={selectedTool}
          panOffset={activePanOffset}
          images={images}
          centerRequestId={centerRequestId}
          backgroundPlacements={isBlueprintMode ? blueprintBackgroundPlacements : backgroundPlacements}
          activeLayer={activeLayer}
          selectedBackgroundPiece={selectedBackgroundPiece}
          onPaintBackground={(next) => {
            if (isBlueprintMode) {
              setBlueprintBackgroundPlacements(next);
              setBlueprintDirty(true);
              return;
            }
            setBackgroundPlacements(next);
            // Same dirty-flag bookkeeping as the foreground onPaint below —
            // painting the background layer also leaves the loaded level
            // behind, so switching levels afterward must still ask before
            // discarding it (see LevelSelect's isDirty prop).
            if (!isDirty) setDirty(true);
            if (saveResult !== null) setSaveResult(null);
          }}
          onPaint={({ grid: nextGrid, colShift, rowShift }) => {
            // The blueprint canvas paints through the exact same
            // paintCell/growGrid path — only the state it lands in differs.
            if (isBlueprintMode) {
              setBlueprintGrid(nextGrid);
              setBlueprintDirty(true);
              applyGrowthShift(colShift, rowShift, setBlueprintBackgroundPlacements);
              return;
            }
            setGrid(nextGrid);
            // Every paint and erase goes through here, so this is the one
            // place the grid can start differing from the loaded level. The
            // "saved to ..." line goes with it: the file on disk no longer
            // matches what is on screen.
            if (!isDirty) setDirty(true);
            if (saveResult !== null) setSaveResult(null);
            applyGrowthShift(colShift, rowShift, setBackgroundPlacements);
          }}
          onPan={setActivePanOffset}
        />
      </div>
    </div>
  );
};
