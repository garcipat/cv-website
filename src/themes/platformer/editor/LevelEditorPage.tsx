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

  const exportedText = exportLayout(grid).join('\n');

  return (
    <div>
      <Palette selectedTool={selectedTool} onSelectTool={setSelectedTool} />
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
              updatePanOffset(prev, -colShift * RENDERED_TILE_SIZE, -rowShift * RENDERED_TILE_SIZE),
            );
          }
        }}
        onPan={setPanOffset}
      />
      <textarea readOnly data-testid="export-output" value={exportedText} />
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(exportedText).catch(() => {});
        }}
      >
        Copy Layout
      </button>
    </div>
  );
};
