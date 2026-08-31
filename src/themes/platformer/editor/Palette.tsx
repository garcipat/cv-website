import { TERRAIN_CHARS, ENTITY_CHARS } from '../level/LevelParser';
import type { TileChar } from '../level/LevelParser';
import { PALETTE_TILE_SPRITES, PALETTE_TILE_LABELS } from './paletteTiles';
import { PaletteTile } from './PaletteTile';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

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
  const tileKeys = [...terrainKeys, ...entityKeys, EMPTY_CHAR];

  return (
    <Card role="toolbar" aria-label="Palette">
      <CardHeader>
        <CardTitle>Palette</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {tileKeys.map((key) => (
          <PaletteTile
            key={key}
            label={PALETTE_TILE_LABELS[key]}
            sprite={PALETTE_TILE_SPRITES[key]}
            selected={selectedTool === key}
            onClick={() => onSelectTool(key)}
          />
        ))}
      </CardContent>
    </Card>
  );
};
