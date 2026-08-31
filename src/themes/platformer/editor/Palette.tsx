import { TERRAIN_CHARS, ENTITY_CHARS } from '../level/LevelParser';
import type { TileChar } from '../level/LevelParser';
import { cn } from '@/lib/utils';

interface PaletteProps {
  selectedTool: TileChar;
  onSelectTool: (tool: TileChar) => void;
}

const EMPTY_CHAR: TileChar = '.';

export const Palette = ({ selectedTool, onSelectTool }: PaletteProps) => {
  const terrainKeys = (Object.keys(TERRAIN_CHARS) as TileChar[]).filter(
    (key) => key !== EMPTY_CHAR,
  );
  const entityKeys = Object.keys(ENTITY_CHARS) as TileChar[];

  return (
    <div role="toolbar">
      {[...terrainKeys, ...entityKeys].map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={selectedTool === key}
          className={cn(selectedTool === key && 'bg-blue-600 text-white ring-2 ring-blue-400')}
          onClick={() => onSelectTool(key)}
        >
          {key}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={selectedTool === EMPTY_CHAR}
        className={cn(selectedTool === EMPTY_CHAR && 'bg-blue-600 text-white ring-2 ring-blue-400')}
        onClick={() => onSelectTool(EMPTY_CHAR)}
      >
        Eraser
      </button>
    </div>
  );
};
