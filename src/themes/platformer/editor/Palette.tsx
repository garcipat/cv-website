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
// 'platform' renders with the exact same sprite as an exposed 'groundGrass'
// tile (see Renderer.ts's tileSource — both are { sx: 0, sy: 0 }), so
// offering it as a separate palette tile is visually indistinguishable
// from Ground Grass and reads as a confusing duplicate. Still fully
// paintable via a raw layout edit — this only removes it from the palette
// UI, not from TERRAIN_CHARS/the engine.
const HIDDEN_TERRAIN_KEYS: readonly TileChar[] = ['P'];

export const Palette = ({ selectedTool, onSelectTool }: PaletteProps) => {
  const terrainKeys = (Object.keys(TERRAIN_CHARS) as TileChar[]).filter(
    (key) => key !== EMPTY_CHAR && !HIDDEN_TERRAIN_KEYS.includes(key),
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
