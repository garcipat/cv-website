import { useState } from 'react';
import type { ReactNode } from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import { ChevronDownIcon } from 'lucide-react';
import type { EditorTool } from './editorState';
import {
  PALETTE_TOOLS,
  terrainPaletteTools,
  HAZARD_PALETTE_KEYS,
  BLUEPRINT_GLYPH,
  type PaletteGroup,
} from './ops/paletteTiles';
import {
  BACKGROUND_PALETTE_SPRITES,
  BACKGROUND_PALETTE_LABELS,
  BACKGROUND_PALETTE_SECTIONS,
  BACKGROUND_MATERIAL_CHAR,
} from './ops/backgroundPaletteTiles';
import type { BackgroundChar } from '../level/LevelParser';
import { BLUEPRINTS } from '../level/blueprintRegistry';
import { PaletteTile } from './PaletteTile';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PaletteProps {
  selectedTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  activeLayer: 'foreground' | 'background';
  selectedBackgroundMaterial: BackgroundChar | null;
  onSelectBackgroundMaterial: (material: BackgroundChar) => void;
  /** Which canvas the palette is arming tools for. Optional and defaulting to
   * `'level'` so every existing render site is unaffected; `'blueprint'`
   * drops the Spawn tool () and adds the Connection Point tool
   * (step 44b). */
  canvasMode?: 'level' | 'blueprint';
  /** Id of the blueprint currently armed for placement, or `null`/omitted when
   * none is (). A second axis alongside `selectedTool`, not a
   * value inside it — see `editorArmedBlueprintIdSignal`. */
  armedBlueprintId?: string | null;
  /** Arms (or, when it is already armed, disarms) a blueprint for placement.
   * Optional so every existing render site is unaffected. */
  onArmBlueprint?: (id: string) => void;
}

const SPAWN_CHAR: EditorTool = 'S';
const CONNECTION_POINT_TOOL: EditorTool = 'connectionPoint';

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
  // Every group is read from the one descriptor's `group`, so a tool
  // is placed, labelled, described and iconed in a single entry. Terrain uses
  // `terrainPaletteTools()` so membership comes from 's registry, not a
  // palette-local table.
  const keysInGroup = (group: PaletteGroup): EditorTool[] =>
    (Object.keys(PALETTE_TOOLS) as EditorTool[]).filter(
      (key) => PALETTE_TOOLS[key].group === group,
    );
  const terrainKeys: EditorTool[] = terrainPaletteTools().map((tool) => tool.char as EditorTool);
  const decorationKeys = keysInGroup('decoration');
  // Spawn is dropped on the blueprint canvas: a blueprint has no spawn point
  // (), and offering the button would just invite a marker
  // nothing downstream expects to find outside a real level's layout.
  const entityKeys = keysInGroup('entities').filter(
    (key) => canvasMode === 'level' || key !== SPAWN_CHAR,
  );
  // One palette button per hazard KIND, plus the falling-stalactite marker
  // tool, which lives here beside the hazards it behaves like (where the
  // pre-feature `T` lived). The descriptor also carries the spike's facing
  // variants (`v`/`<`/`>`), which are cycled on the canvas rather than shown
  // as separate buttons — hence the explicit kind list.
  const hazardKeys: EditorTool[] = [...HAZARD_PALETTE_KEYS, 'fallingStalactite'];
  // The Tools group holds the level-authoring markers plus the Eraser. The
  // connection point is blueprint-only (the mirror image of the Spawn filter
  // above). The Eraser stays last in the descriptor, so it stays last here.
  const toolKeys = keysInGroup('tools').filter(
    (key) => canvasMode === 'blueprint' || key !== CONNECTION_POINT_TOOL,
  );

  // Placement targets the level's own grid, so the section is hidden on the
  // blueprint canvas — which is what keeps nesting (a blueprint containing a
  // blueprint) out of scope for free. Nothing renders at all when no blueprint
  // has been saved yet, rather than an empty headed section.
  const showBlueprints = canvasMode === 'level' && BLUEPRINTS.length > 0;

  const renderGroup = (title: string, slug: string, keys: EditorTool[]) => (
    <PaletteGroup key={title} title={title} slug={slug}>
      <div className="grid grid-cols-[repeat(3,max-content)] gap-2">
        {keys.map((key) => (
          <PaletteTile
            key={key}
            label={PALETTE_TOOLS[key].label}
            testId={`editor-palette-tile-${key}`}
            description={PALETTE_TOOLS[key].description}
            sprite={PALETTE_TOOLS[key].sprite}
            glyph={PALETTE_TOOLS[key].glyph}
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
            {renderGroup('Hazards', 'hazards', hazardKeys)}
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
