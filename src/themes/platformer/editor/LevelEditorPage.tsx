import { useEffect, useState } from 'react';
import { importLayout } from './importLayout';
import { exportLayout } from './exportLayout';
import { Palette } from './Palette';
import { EditorCanvas, type EditorImages } from './EditorCanvas';
import { updatePanOffset, type PanOffset } from './EditorPan';
import type { TileChar } from '../level/LevelParser';
import { LEVEL_1_LAYOUT, currentLayout } from '../level/level';
import { editorLevelSignal } from './editorLevelState';
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
  player: null,
  coin: null,
  fruit: null,
  slimeGreen: null,
  slimePurple: null,
  crackOverlay: null,
  chestClosed: null,
};

const IMAGE_SOURCES: { key: keyof EditorImages; src: string }[] = [
  { key: 'tileset', src: '/sprites/world_tileset.png' },
  { key: 'player', src: '/sprites/knight.png' },
  { key: 'coin', src: '/sprites/coin.png' },
  { key: 'fruit', src: '/sprites/fruit.png' },
  { key: 'slimeGreen', src: '/sprites/slime_green.png' },
  { key: 'slimePurple', src: '/sprites/slime_purple.png' },
  { key: 'crackOverlay', src: '/sprites/crack_overlay.png' },
  { key: 'chestClosed', src: '/sprites/chest_closed.png' },
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
  const [selectedTool, setSelectedTool] = useState<TileChar>('G');
  const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const [images, setImages] = useState<EditorImages>(EMPTY_IMAGES);
  // In-app confirmation dialog for Reset — replaces a native `window.confirm()`,
  // which doesn't fire reliably in every browser/embedded context (e.g. some
  // automated/sandboxed viewers suppress it outright and it silently no-ops).
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

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

  const exportedText = exportLayout(grid)
    .map((row) => `  '${row}',`)
    .join('\n');

  // Called only once the in-app confirmation dialog is actually accepted
  // (see resetDialogOpen above) — no browser-native confirm() involved.
  const resetToDefaultLayout = () => {
    const defaultGrid = importLayout(LEVEL_1_LAYOUT);
    setGrid(defaultGrid);
    setPanOffset({ x: 0, y: 0 });
    // Resets the persisted (localStorage-backed) copy too, not just local
    // state — otherwise the debounced sync effect above would shortly
    // overwrite this reset back with the (still-pending) pre-reset grid, or
    // reopening the editor after a reload would silently restore the
    // discarded edits from storage.
    editorLevelSignal.value = defaultGrid;
    setResetDialogOpen(false);
  };

  /**
   * Try (roadmap: editor/game round-trip): exports the current grid, sets it
   * as the in-memory layout the GAME reads (`level.ts`'s `currentLayout` —
   * deliberately NOT this editor's own localStorage-backed signal, see its
   * doc comment), switches the active theme to Platformer, and navigates
   * client-side (no real reload — a reload would discard `currentLayout`
   * back to the hardcoded default before the game ever saw it) straight into
   * the game with its debug panel visible (`?debug=1` — matches
   * PlatformerPage.tsx's `debugControls` gate, any `debug` param shows it) so
   * Kill/Respawn/Hitboxes are immediately available for testing the layout.
   */
  const tryLayout = () => {
    currentLayout.value = exportLayout(grid);
    currentTheme.value = 'platformer';
    navigateTo('/?debug=1');
  };

  return (
    <div className="flex h-screen flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Platformer Level Editor</h1>
      <div className="flex min-h-0 flex-1 flex-row items-stretch gap-4">
        <div className="flex flex-col gap-2">
          <Palette selectedTool={selectedTool} onSelectTool={setSelectedTool} />
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
          <Button type="button" variant="outline" onClick={() => setResetDialogOpen(true)}>
            Reset
          </Button>
          <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset the level?</DialogTitle>
                <DialogDescription>
                  This reloads the default layout and discards all unsaved edits.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                <Button type="button" variant="destructive" onClick={resetToDefaultLayout}>
                  Reset level
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button type="button" onClick={tryLayout}>
            Try
          </Button>
        </div>
        <EditorCanvas
          grid={grid}
          selectedTool={selectedTool}
          panOffset={panOffset}
          images={images}
          onPaint={({ grid: nextGrid, colShift, rowShift }) => {
            setGrid(nextGrid);
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
