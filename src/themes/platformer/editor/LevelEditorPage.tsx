import { useEffect, useState } from 'react';
import { importLayout } from './importLayout';
import { exportLayout } from './exportLayout';
import { Palette } from './Palette';
import { EditorCanvas, type EditorImages } from './EditorCanvas';
import { updatePanOffset, type PanOffset } from './EditorPan';
import type { TileChar } from '../level/LevelParser';
import { LEVEL_1_LAYOUT } from '../level/level1';
import { loadImage } from '../engine/SpriteLoader';
import { RENDERED_TILE_SIZE } from '../level/Terrain';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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

export const LevelEditorPage = () => {
  const [grid, setGrid] = useState<TileChar[][]>(() => importLayout(LEVEL_1_LAYOUT));
  const [selectedTool, setSelectedTool] = useState<TileChar>('G');
  const [panOffset, setPanOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const [images, setImages] = useState<EditorImages>(EMPTY_IMAGES);

  useEffect(() => {
    IMAGE_SOURCES.forEach(({ key, src }) => {
      loadImage(src)
        .then((img) => setImages((prev) => ({ ...prev, [key]: img })))
        .catch(() => {});
    });
  }, []);

  const exportedText = exportLayout(grid)
    .map((row) => `  '${row}',`)
    .join('\n');

  return (
    <div className="flex h-screen flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Platformer Level Editor</h1>
      <div className="flex min-h-0 flex-1 flex-row items-stretch gap-4">
        <div className="flex flex-col gap-2">
          <Palette selectedTool={selectedTool} onSelectTool={setSelectedTool} />
          <Dialog>
            <DialogTrigger render={<Button type="button">Export</Button>} />
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
