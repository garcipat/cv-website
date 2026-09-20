import { useState } from 'react';
import type { ReactNode } from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import { ChevronDownIcon } from 'lucide-react';
import { TERRAIN_CHARS, ENTITY_CHARS, SIGN_CHARS, HAZARD_CHARS } from '../level/LevelParser';
import type { TileChar } from '../level/LevelParser';
import {
  PALETTE_TILE_SPRITES,
  PALETTE_TILE_LABELS,
  PALETTE_TILE_GLYPHS,
  PALETTE_TILE_DESCRIPTIONS,
  BLUEPRINT_GLYPH,
} from './paletteTiles';
import {
  BACKGROUND_PALETTE_SPRITES,
  BACKGROUND_PALETTE_LABELS,
  BACKGROUND_PALETTE_SECTIONS,
  BACKGROUND_MATERIAL_CHAR,
} from './backgroundPaletteTiles';
import type { BackgroundChar } from '../level/LevelParser';
import { BLUEPRINTS } from '../level/blueprintRegistry';
import { PaletteTile } from './PaletteTile';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PaletteProps {
  selectedTool: TileChar;
  onSelectTool: (tool: TileChar) => void;
  activeLayer: 'foreground' | 'background';
  selectedBackgroundMaterial: BackgroundChar | null;
  onSelectBackgroundMaterial: (material: BackgroundChar) => void;
  /** Which canvas the palette is arming tools for. Optional and defaulting to
   *  `'level'` so every existing render site is unaffected; `'blueprint'`
   *  drops the Spawn tool (roadmap step 44a) and adds the Connection Point tool
   *  (step 44b). */
  canvasMode?: 'level' | 'blueprint';
  /** Id of the blueprint currently armed for placement, or `null`/omitted when
   *  none is (roadmap step 44c). A second axis alongside `selectedTool`, not a
   *  value inside it — see `editorArmedBlueprintIdSignal`. */
  armedBlueprintId?: string | null;
  /** Arms (or, when it is already armed, disarms) a blueprint for placement.
   *  Optional so every existing render site is unaffected. */
  onArmBlueprint?: (id: string) => void;
}

const EMPTY_CHAR: TileChar = '.';
const PATROL_CHAR: TileChar = 'P';
const SPAWN_CHAR: TileChar = 'S';
const CONNECTION_POINT_CHAR: TileChar = '+';
const DECORATION_CHARS: TileChar[] = ['n', 'N', 'X', 'c', '⊤', '⊥', '¥', 's'];

/**
 * One collapsible palette group. The trigger REPLACES the group's old plain
 * `<p>` title (same `text-xs` line, now clickable with an inline chevron), so
 * it costs no extra vertical space — collapsing the tiles below is what
 * reclaims height as the catalog grows. Uncontrolled and open by default, so
 * nothing is hidden until the author chooses to collapse it.
 */
const PaletteGroup = ({
  title,
  slug,
  children,
}: {
  title: string;
  slug: string;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      data-testid={`editor-palette-group-${slug}`}
      render={<section aria-label={title} />}
    >
      <Collapsible.Trigger className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ChevronDownIcon
          className={cn('size-3 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
        {title}
      </Collapsible.Trigger>
      <Collapsible.Panel>{children}</Collapsible.Panel>
    </Collapsible.Root>
  );
};

export const Palette = ({
  selectedTool,
  onSelectTool,
  activeLayer,
  selectedBackgroundMaterial,
  onSelectBackgroundMaterial,
  canvasMode = 'level',
  armedBlueprintId = null,
  onArmBlueprint,
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

  // Placement targets the level's own grid, so the section is hidden on the
  // blueprint canvas — which is what keeps nesting (a blueprint containing a
  // blueprint) out of scope for free. Nothing renders at all when no blueprint
  // has been saved yet, rather than an empty headed section.
  const showBlueprints = canvasMode === 'level' && BLUEPRINTS.length > 0;

  const renderGroup = (title: string, slug: string, keys: TileChar[]) => (
    <PaletteGroup key={title} title={title} slug={slug}>
      <div className="grid grid-cols-[repeat(3,max-content)] gap-2">
        {keys.map((key) => (
          <PaletteTile
            key={key}
            label={PALETTE_TILE_LABELS[key]}
            testId={`editor-palette-tile-${key}`}
            description={PALETTE_TILE_DESCRIPTIONS[key]}
            sprite={PALETTE_TILE_SPRITES[key]}
            glyph={PALETTE_TILE_GLYPHS[key]}
            selected={selectedTool === key}
            onClick={() => onSelectTool(key)}
          />
        ))}
      </div>
    </PaletteGroup>
  );

  return (
    <Card
      role="toolbar"
      aria-label="Palette"
      data-testid="editor-palette"
      className="w-fit self-start border border-border ring-0"
    >
      <CardHeader>
        <CardTitle>Palette</CardTitle>
      </CardHeader>
      <CardContent>
        {activeLayer === 'foreground' ? (
          <div className="flex flex-col gap-3">
            {renderGroup('Terrain', 'terrain', terrainKeys)}
            {renderGroup('Decoration', 'decoration', decorationKeys)}
            {renderGroup('Entities', 'entities', entityKeys)}
            {renderGroup('Hazards', 'hazards', firstHazardKey ? [firstHazardKey] : [])}
            {renderGroup('Tools', 'tools', toolKeys)}
            {showBlueprints && (
              <PaletteGroup title="Blueprints" slug="blueprints">
                <div className="grid grid-cols-[repeat(3,max-content)] gap-2">
                  {BLUEPRINTS.map((blueprint) => (
                    <PaletteTile
                      key={blueprint.id}
                      label={blueprint.name}
                      testId={`editor-palette-tile-blueprint-${blueprint.id}`}
                      description="Click the canvas to preview this room here, then click the same cell again to place it"
                      sprite={null}
                      glyph={BLUEPRINT_GLYPH}
                      selected={armedBlueprintId === blueprint.id}
                      onClick={() => onArmBlueprint?.(blueprint.id)}
                    />
                  ))}
                </div>
              </PaletteGroup>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {BACKGROUND_PALETTE_SECTIONS.map((section) => (
              <PaletteGroup
                key={section.title}
                title={section.title}
                slug={section.title.toLowerCase()}
              >
                <div className="grid grid-cols-[repeat(3,max-content)] gap-2">
                  {section.materialIds.map((material) => (
                    <PaletteTile
                      key={material}
                      label={BACKGROUND_PALETTE_LABELS[material]}
                      testId={`editor-palette-tile-${material}`}
                      sprite={BACKGROUND_PALETTE_SPRITES[material]}
                      selected={selectedBackgroundMaterial === BACKGROUND_MATERIAL_CHAR[material]}
                      onClick={() => onSelectBackgroundMaterial(BACKGROUND_MATERIAL_CHAR[material])}
                    />
                  ))}
                </div>
              </PaletteGroup>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
