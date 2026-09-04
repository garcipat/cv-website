import { TERRAIN_CHARS, ENTITY_CHARS, SIGN_CHARS } from '../level/LevelParser';
import type { TileChar } from '../level/LevelParser';
import {
  PALETTE_TILE_SPRITES,
  PALETTE_TILE_LABELS,
  PALETTE_TILE_GLYPHS,
  PALETTE_TILE_DESCRIPTIONS,
} from './paletteTiles';
import { BACKGROUND_PALETTE_SPRITES, BACKGROUND_PALETTE_LABELS } from './backgroundPaletteTiles';
import { BACKGROUND_CATALOG } from '../engine/BackgroundCatalog';
import type { BackgroundPieceId } from '../level/LevelData';
import { PaletteTile } from './PaletteTile';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface PaletteProps {
  selectedTool: TileChar;
  onSelectTool: (tool: TileChar) => void;
  activeLayer: 'foreground' | 'background';
  selectedBackgroundPiece: BackgroundPieceId | null;
  onSelectBackgroundPiece: (pieceId: BackgroundPieceId) => void;
}

const EMPTY_CHAR: TileChar = '.';
const BACKGROUND_PIECE_IDS = Object.keys(BACKGROUND_CATALOG) as BackgroundPieceId[];

export const Palette = ({
  selectedTool,
  onSelectTool,
  activeLayer,
  selectedBackgroundPiece,
  onSelectBackgroundPiece,
}: PaletteProps) => {
  const terrainKeys = (Object.keys(TERRAIN_CHARS) as TileChar[]).filter((key) => key !== EMPTY_CHAR);
  const entityKeys = Object.keys(ENTITY_CHARS) as TileChar[];
  // Only the FIRST registered sign character becomes a palette tile — clicking
  // it repeatedly on the canvas cycles through every other registered hint
  // (Task 7's paintCell.ts), so the palette itself never needs to grow past one
  // "Sign" entry no matter how many distinct hints get registered later.
  const [firstSignKey] = Object.keys(SIGN_CHARS) as TileChar[];
  const signKeys: TileChar[] = firstSignKey ? [firstSignKey] : [];
  const tileKeys = [...terrainKeys, ...entityKeys, ...signKeys, EMPTY_CHAR];

  return (
    <Card role="toolbar" aria-label="Palette">
      <CardHeader>
        <CardTitle>Palette</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {activeLayer === 'foreground'
          ? tileKeys.map((key) => (
              <PaletteTile
                key={key}
                label={PALETTE_TILE_LABELS[key]}
                description={PALETTE_TILE_DESCRIPTIONS[key]}
                sprite={PALETTE_TILE_SPRITES[key]}
                glyph={PALETTE_TILE_GLYPHS[key]}
                selected={selectedTool === key}
                onClick={() => onSelectTool(key)}
              />
            ))
          : BACKGROUND_PIECE_IDS.map((pieceId) => (
              <PaletteTile
                key={pieceId}
                label={BACKGROUND_PALETTE_LABELS[pieceId]}
                sprite={BACKGROUND_PALETTE_SPRITES[pieceId]}
                selected={selectedBackgroundPiece === pieceId}
                onClick={() => onSelectBackgroundPiece(pieceId)}
              />
            ))}
      </CardContent>
    </Card>
  );
};
