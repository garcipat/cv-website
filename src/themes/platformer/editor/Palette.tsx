import { TERRAIN_CHARS, ENTITY_CHARS, SIGN_CHARS, HAZARD_CHARS } from '../level/LevelParser';
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
  /** Which canvas the palette is arming tools for. Optional and defaulting to
   *  `'level'` so every existing render site is unaffected; `'blueprint'`
   *  drops the Spawn tool (roadmap step 44a) and adds the Connection Point tool
   *  (step 44b). */
  canvasMode?: 'level' | 'blueprint';
}

const EMPTY_CHAR: TileChar = '.';
const PATROL_CHAR: TileChar = 'P';
const SPAWN_CHAR: TileChar = 'S';
const CONNECTION_POINT_CHAR: TileChar = '+';
const BACKGROUND_PIECE_IDS = Object.keys(BACKGROUND_CATALOG) as BackgroundPieceId[];
const DECORATION_CHARS: TileChar[] = ['n', 'N'];

export const Palette = ({
  selectedTool,
  onSelectTool,
  activeLayer,
  selectedBackgroundPiece,
  onSelectBackgroundPiece,
  canvasMode = 'level',
}: PaletteProps) => {
  const allTerrainKeys = (Object.keys(TERRAIN_CHARS) as TileChar[]).filter((key) => key !== EMPTY_CHAR);
  const terrainKeys = allTerrainKeys.filter(
    (key) =>
      !DECORATION_CHARS.includes(key) && key !== PATROL_CHAR && key !== CONNECTION_POINT_CHAR,
  );
  const decorationKeys = allTerrainKeys.filter((key) => DECORATION_CHARS.includes(key));
  // Spawn is dropped on the blueprint canvas: a blueprint has no spawn point
  // (roadmap step 44a), and offering the button would just invite a marker
  // nothing downstream expects to find outside a real level's layout.
  const entityKeys = (Object.keys(ENTITY_CHARS) as TileChar[]).filter(
    (key) => canvasMode === 'level' || key !== SPAWN_CHAR,
  );
  // Only the FIRST registered sign character becomes a palette tile — clicking
  // it repeatedly on the canvas cycles through every other registered hint
  // (Task 7's paintCell.ts), so the palette itself never needs to grow past one
  // "Sign" entry no matter how many distinct hints get registered later.
  const [firstSignKey] = Object.keys(SIGN_CHARS) as TileChar[];
  // Same one-button convention as signs: only the FIRST registered hazard
  // character becomes a palette tile. Clicking the canvas auto-detects a
  // facing from the surrounding terrain, and clicking an already-placed
  // hazard again cycles to the next neighbor-backed facing (paintCell.ts's
  // nextHazardChar) — the palette itself never needs a button per facing.
  const [firstHazardKey] = Object.keys(HAZARD_CHARS) as TileChar[];
  // Patrol lives here rather than in "Terrain": it's an invisible marker, not
  // physical ground, so it reads more like a level-authoring tool (same
  // category as the Eraser and Sign) than like grass/rock/wall. The blueprint
  // connection point is the same kind of marker and joins it — but only while
  // the blueprint canvas is active (roadmap step 44b), the mirror image of the
  // Spawn filter on `entityKeys` above: a connection point marks a spot on a
  // ROOM's border, so on a level it would be an inert character nothing reads.
  // It stays ahead of the Eraser so the Eraser is last in the group either way.
  const toolKeys: TileChar[] = [
    ...(firstSignKey ? [firstSignKey] : []),
    PATROL_CHAR,
    ...(canvasMode === 'blueprint' ? [CONNECTION_POINT_CHAR] : []),
    EMPTY_CHAR,
  ];

  const renderGroup = (title: string, keys: TileChar[]) => (
    <section key={title} aria-label={title}>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="grid grid-cols-[repeat(3,max-content)] gap-2">
        {keys.map((key) => (
          <PaletteTile
            key={key}
            label={PALETTE_TILE_LABELS[key]}
            description={PALETTE_TILE_DESCRIPTIONS[key]}
            sprite={PALETTE_TILE_SPRITES[key]}
            glyph={PALETTE_TILE_GLYPHS[key]}
            selected={selectedTool === key}
            onClick={() => onSelectTool(key)}
          />
        ))}
      </div>
    </section>
  );

  return (
    <Card role="toolbar" aria-label="Palette" className="w-fit self-start">
      <CardHeader>
        <CardTitle>Palette</CardTitle>
      </CardHeader>
      <CardContent>
        {activeLayer === 'foreground' ? (
          <div className="flex flex-col gap-3">
            {renderGroup('Terrain', terrainKeys)}
            {renderGroup('Decoration', decorationKeys)}
            {renderGroup('Entities', entityKeys)}
            {renderGroup('Hazards', firstHazardKey ? [firstHazardKey] : [])}
            {renderGroup('Tools', toolKeys)}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(3,max-content)] gap-2">
            {BACKGROUND_PIECE_IDS.map((pieceId) => (
              <PaletteTile
                key={pieceId}
                label={BACKGROUND_PALETTE_LABELS[pieceId]}
                sprite={BACKGROUND_PALETTE_SPRITES[pieceId]}
                selected={selectedBackgroundPiece === pieceId}
                onClick={() => onSelectBackgroundPiece(pieceId)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
