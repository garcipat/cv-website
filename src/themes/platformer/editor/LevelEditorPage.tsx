import { useEffect, useState } from 'react';
import { importLayout } from './importLayout';
import { exportLayout } from './exportLayout';
import { Palette } from './Palette';
import { EditorCanvas, type EditorImages } from './EditorCanvas';
import { updatePanOffset, type PanOffset } from './EditorPan';
import type { TileChar } from '../level/LevelParser';
import { currentLayout, currentBackground } from '../level/level';
import type { LevelEntry } from '../level/levelRegistry';
import { LevelSelect } from './LevelSelect';
import { saveLevel, LEVELS_FOLDER, type SaveLevelResult } from './saveLevelFile';
import type { BackgroundPlacement, BackgroundPieceId } from '../level/LevelData';
import {
  editorLevelSignal,
  editorSelectedToolSignal,
  editorLoadedLevelNameSignal,
  editorDirtySignal,
  editorBackgroundSignal,
  editorActiveLayerSignal,
  editorSelectedBackgroundPieceSignal,
} from './editorLevelState';
import { resetGameProgress } from '../PlatformerState';
import { loadImage } from '../engine/SpriteLoader';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { Button } from '@/components/ui/button';
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
  { key: 'backgroundAtlas', src: '/sprites/terrain_.png' },
];

// How long to wait after the last paint stroke before syncing `grid` into
// `editorLevelSignal` (and, from there, localStorage) — long enough that a
// rapid drag-paint session writes once at the end instead of on every single
// cell, short enough that closing the tab moments after the last stroke
// still persists it.
const EDITOR_LEVEL_SYNC_DEBOUNCE_MS = 400;

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
  const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  // Bumped to ask EditorCanvas to center the view on the spawn tile; it
  // starts at 1 rather than 0 so opening the editor is itself a request, and
  // the view lands on the player instead of on the grid's top-left corner.
  const [centerRequestId, setCenterRequestId] = useState(1);
  const requestCenterOnSpawn = () => setCenterRequestId((id) => id + 1);
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
   */
  const loadLevel = (level: LevelEntry) => {
    const levelGrid = importLayout(level.layout);
    setGrid(levelGrid);
    requestCenterOnSpawn();
    editorLevelSignal.value = levelGrid;
    const levelBackground = level.background ? [...level.background] : [];
    setBackgroundPlacements(levelBackground);
    editorBackgroundSignal.value = levelBackground;
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
    const result = await saveLevel(saveName, grid, backgroundPlacements);
    setSaveResult(result);
    setLoadedLevelName(saveName);
    setDirty(false);
    if (result.written) setSaveDialogOpen(false);
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
   * before the game ever saw it) straight into the game with its debug panel
   * visible (`?debug=1` — matches PlatformerPage.tsx's `debugControls` gate,
   * any `debug` param shows it) so Kill/Respawn/Hitboxes are immediately
   * available for testing the layout.
   */
  const tryLayout = () => {
    currentLayout.value = exportLayout(grid);
    currentBackground.value = backgroundPlacements;
    resetGameProgress();
    currentTheme.value = 'platformer';
    navigateTo('/?debug=1');
  };

  return (
    <div className="flex h-screen flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Platformer Level Editor</h1>
      <div className="flex min-h-0 flex-1 flex-row items-stretch gap-4">
        <div className="flex flex-col gap-2">
          <Palette
            selectedTool={selectedTool}
            onSelectTool={setSelectedTool}
            activeLayer={activeLayer}
            onSelectLayer={setActiveLayer}
            selectedBackgroundPiece={selectedBackgroundPiece}
            onSelectBackgroundPiece={setSelectedBackgroundPiece}
          />
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
          <Button type="button" onClick={tryLayout}>
            Try
          </Button>
          {saveResult?.written === true && (
            <p className="max-w-40 text-xs break-all text-muted-foreground" role="status">
              Saved to <code>{saveResult.path}</code> — reload to see it in the level list.
            </p>
          )}
        </div>
        <EditorCanvas
          grid={grid}
          selectedTool={selectedTool}
          panOffset={panOffset}
          images={images}
          centerRequestId={centerRequestId}
          backgroundPlacements={backgroundPlacements}
          activeLayer={activeLayer}
          selectedBackgroundPiece={selectedBackgroundPiece}
          onPaintBackground={(next) => {
            setBackgroundPlacements(next);
            // Same dirty-flag bookkeeping as the foreground onPaint below —
            // painting the background layer also leaves the loaded level
            // behind, so switching levels afterward must still ask before
            // discarding it (see LevelSelect's isDirty prop).
            if (!isDirty) setDirty(true);
            if (saveResult !== null) setSaveResult(null);
          }}
          onPaint={({ grid: nextGrid, colShift, rowShift }) => {
            setGrid(nextGrid);
            // Every paint and erase goes through here, so this is the one
            // place the grid can start differing from the loaded level. The
            // "saved to ..." line goes with it: the file on disk no longer
            // matches what is on screen.
            if (!isDirty) setDirty(true);
            if (saveResult !== null) setSaveResult(null);
            if (colShift !== 0 || rowShift !== 0) {
              // A cell at index i draws at i * RENDERED_TILE_SIZE + panOffset.x.
              // Growth increases every existing cell's index by colShift/rowShift,
              // so panOffset must move by the negative of that to cancel it out —
              // otherwise already-painted content jumps on screen (spec FR-020/SC-006).
              setPanOffset((prev) =>
                updatePanOffset(
                  prev,
                  -colShift * RENDERED_TILE_SIZE,
                  -rowShift * RENDERED_TILE_SIZE,
                ),
              );
            }
          }}
          onPan={setPanOffset}
        />
      </div>
    </div>
  );
};
