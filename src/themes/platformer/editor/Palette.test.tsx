import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Palette } from './Palette';
import { TERRAIN_CHARS, ENTITY_CHARS } from '../level/LevelParser';
import { BACKGROUND_MATERIAL_FAMILY } from '../level/LevelData';
import { BACKGROUND_PALETTE_LABELS } from './backgroundPaletteTiles';
import type { BackgroundMaterialId } from '../level/LevelData';
import type { Blueprint } from '../level/BlueprintData';
import { levelEditorPage } from './LevelEditorPage.page';

const palette = levelEditorPage.palette;

// The registry is a build-time glob of `level/blueprints/*.json`, and that
// folder can hold an untracked file left over from manual testing — so every
// test in this file, including the pre-existing button-count one, would
// otherwise pass or fail depending on the machine. A stable array the tests
// mutate is the same approach `BlueprintSelect.test.tsx` takes, and for the
// same reason: the component reads the module binding at render time.
const { registryEntries } = vi.hoisted(() => ({ registryEntries: [] as Blueprint[] }));

vi.mock('../level/blueprintRegistry', () => ({
  BLUEPRINTS: registryEntries,
  findBlueprint: (id: string) => registryEntries.find((entry) => entry.id === id),
}));

beforeEach(() => {
  registryEntries.length = 0;
});

const defaultProps = {
  selectedTool: 'G' as const,
  onSelectTool: vi.fn(),
  activeLayer: 'foreground' as const,
  selectedBackgroundMaterial: null,
  onSelectBackgroundMaterial: vi.fn(),
};

describe('Palette', () => {
  it('renders one tile for every terrain char (excluding "."), every entity char, one representative Sign tile, one representative Hazard tile, and the Eraser', () => {
    render(<Palette {...defaultProps} />);
    // '.' is the Eraser, counted separately below; '+' is the blueprint
    // connection point, offered only on the blueprint canvas (step 44b) and
    // never from the Terrain group in either mode.
    const terrainCount = Object.keys(TERRAIN_CHARS).filter((k) => k !== '.' && k !== '+').length;
    const entityCount = Object.keys(ENTITY_CHARS).length;
    // +1 for the single representative Sign tile, +1 for the single
    // representative Hazard tile, +1 for the Eraser tile.
    // +5 for the collapsible group triggers (Terrain, Decoration, Entities,
    // Hazards, Tools) — no Blueprints group with an empty registry.
    expect(screen.getAllByRole('button')).toHaveLength(terrainCount + entityCount + 1 + 1 + 1 + 5);
  });

  it('renders a "Palette" title', () => {
    render(<Palette {...defaultProps} />);
    expect(palette.root).toHaveTextContent('Palette');
  });

  it('renders a distinct Eraser tile', () => {
    render(<Palette {...defaultProps} />);
    expect(palette.tile('.')).toBeInTheDocument();
  });

  it('renders tiles labeled by human-readable name, not raw character', () => {
    render(<Palette {...defaultProps} />);
    expect(palette.tile('R')).toHaveAccessibleName('Ground Rock');
    expect(palette.tile('o')).toHaveAccessibleName('Coin');
  });

  it('calls onSelectTool with the clicked terrain char', async () => {
    const onSelectTool = vi.fn();
    render(<Palette {...defaultProps} onSelectTool={onSelectTool} />);
    await userEvent.click(palette.tile('R'));
    expect(onSelectTool).toHaveBeenCalledWith('R');
  });

  it('calls onSelectTool with "." when the Eraser tile is clicked', async () => {
    const onSelectTool = vi.fn();
    render(<Palette {...defaultProps} onSelectTool={onSelectTool} />);
    await userEvent.click(palette.tile('.'));
    expect(onSelectTool).toHaveBeenCalledWith('.');
  });

  it('marks the currently selected tool as pressed', () => {
    render(<Palette {...defaultProps} selectedTool="R" />);
    expect(palette.tile('R')).toHaveAttribute('aria-pressed', 'true');
    expect(palette.tile('G')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Palette — layer tab', () => {
  it('foregroundLayerActive-showsTheExistingTerrainAndEntityButtonsOnly', () => {
    render(<Palette {...defaultProps} />);
    expect(palette.queryBackgroundTile('dirt')).not.toBeInTheDocument();
  });

  it('backgroundLayerActive-showsOneButtonPerMaterial', () => {
    render(<Palette {...defaultProps} activeLayer="background" />);
    for (const material of Object.keys(BACKGROUND_MATERIAL_FAMILY) as BackgroundMaterialId[]) {
      expect(palette.backgroundTile(material)).toHaveAccessibleName(
        BACKGROUND_PALETTE_LABELS[material],
      );
    }
  });

  it('clickingABackgroundMaterialButton-callsOnSelectBackgroundMaterialWithItsChar', () => {
    const onSelectBackgroundMaterial = vi.fn();
    render(
      <Palette
        {...defaultProps}
        activeLayer="background"
        onSelectBackgroundMaterial={onSelectBackgroundMaterial}
      />,
    );
    fireEvent.click(palette.backgroundTile('dirt'));
    expect(onSelectBackgroundMaterial).toHaveBeenCalledWith('d');
  });
});

describe('Palette — subtitle groups', () => {
  it('foregroundLayer-rendersFiveGroupHeadings', () => {
    render(<Palette {...defaultProps} />);
    expect(palette.group('terrain')).toHaveTextContent('Terrain');
    expect(palette.group('decoration')).toHaveTextContent('Decoration');
    expect(palette.group('entities')).toHaveTextContent('Entities');
    expect(palette.group('hazards')).toHaveTextContent('Hazards');
    expect(palette.group('tools')).toHaveTextContent('Tools');
  });

  it('decorationGroup-containsBushAndFenceButNoOtherTerrainChar', () => {
    render(<Palette {...defaultProps} />);
    const decorationGroup = palette.group('decoration');
    expect(within(decorationGroup).getByTestId('editor-palette-tile-n')).toBeInTheDocument();
    expect(within(decorationGroup).getByTestId('editor-palette-tile-N')).toBeInTheDocument();
    expect(within(decorationGroup).queryByTestId('editor-palette-tile-#')).not.toBeInTheDocument();
  });

  it('decorationGroup-containsTheTorchTile', () => {
    // The torch is decorative cave dressing, so it joins the Decoration group
    // rather than Terrain (see Palette.tsx's DECORATION_CHARS).
    render(<Palette {...defaultProps} />);
    expect(
      within(palette.group('decoration')).getByTestId('editor-palette-tile-¥'),
    ).toBeInTheDocument();
  });

  it('hazardsGroup-containsExactlyOneRepresentativeSpikeTile', () => {
    // Same one-button convention as signs: clicking the canvas auto-detects
    // a facing from the surrounding terrain, and clicking an already-placed
    // spike again cycles to the next valid facing (paintCell.ts) — so the
    // palette never needs a button per facing.
    render(<Palette {...defaultProps} />);
    const hazardsGroup = palette.group('hazards');
    expect(within(hazardsGroup).getByTestId('editor-palette-tile-^')).toBeInTheDocument();
    // The Spike tile plus the group's own collapsible trigger.
    expect(within(hazardsGroup).getAllByRole('button')).toHaveLength(2);
  });
});

describe('Palette — blueprint canvas mode', () => {
  it('levelCanvasMode-stillOffersTheSpawnTool', () => {
    render(<Palette {...defaultProps} canvasMode="level" />);

    expect(palette.tile('S')).toBeInTheDocument();
  });

  it('blueprintCanvasMode-dropsTheSpawnToolOnly', () => {
    // A blueprint has no spawn point, and offering the button would invite a
    // marker nothing downstream expects outside a real level's layout. Every
    // other entity tool stays.
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    expect(palette.queryTile('S')).not.toBeInTheDocument();
    expect(palette.tile('M')).toBeInTheDocument();
    expect(palette.tile('o')).toBeInTheDocument();
  });

  it('omittedCanvasMode-behavesLikeLevelMode', () => {
    render(<Palette {...defaultProps} />);

    expect(palette.tile('S')).toBeInTheDocument();
  });
});

describe('Palette — blueprint connection point tool', () => {
  const toolsGroup = () => palette.group('tools');

  it('blueprintCanvasMode-offersTheConnectionPointToolInTheToolsGroup', () => {
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    expect(within(toolsGroup()).getByTestId('editor-palette-tile-+')).toBeInTheDocument();
  });

  it('levelCanvasMode-doesNotOfferTheConnectionPointToolAtAll', () => {
    // A connection point only means something on a blueprint's border — on a
    // level it would be an inert marker nothing downstream reads (step 44b).
    render(<Palette {...defaultProps} canvasMode="level" />);

    expect(palette.queryTile('+')).not.toBeInTheDocument();
  });

  // Deliberately NOT named `omittedCanvasMode-behavesLikeLevelMode`: that exact
  // name is already taken by step 44a's Spawn test in the
  // `Palette — blueprint canvas mode` describe above, and a duplicate would
  // make `vitest -t` ambiguous and the two indistinguishable in the reporter.
  it('omittedCanvasMode-offersNoConnectionPointToolEither', () => {
    render(<Palette {...defaultProps} />);

    expect(palette.queryTile('+')).not.toBeInTheDocument();
  });

  it('blueprintCanvasMode-keepsTheConnectionPointOutOfTheTerrainGroup', () => {
    // It is an invisible marker, not physical ground — same reason the
    // patrol boundary lives in Tools rather than Terrain.
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    expect(
      within(palette.group('terrain')).queryByTestId('editor-palette-tile-+'),
    ).not.toBeInTheDocument();
  });

  it('blueprintCanvasMode-clickingTheConnectionPointTool-armsItsCharacter', async () => {
    const onSelectTool = vi.fn();
    render(<Palette {...defaultProps} canvasMode="blueprint" onSelectTool={onSelectTool} />);

    await userEvent.click(palette.tile('+'));

    expect(onSelectTool).toHaveBeenCalledWith('+');
  });

  it('blueprintCanvasMode-theEraserStaysTheLastToolInTheGroup', () => {
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    const tiles = within(toolsGroup()).getAllByTestId(/^editor-palette-tile-/);
    expect(tiles.at(-1)).toHaveAccessibleName('Eraser');
  });
});

describe('Palette — blueprints section (step 44c placement)', () => {
  const CAVE: Blueprint = { id: 'cave-room', name: 'Cave Room', layout: ['##'] };

  it('levelCanvasModeWithSavedBlueprints-listsOneTilePerRegistryEntry', () => {
    registryEntries.push(CAVE);
    render(<Palette {...defaultProps} canvasMode="level" />);

    expect(palette.blueprintTile('cave-room')).toBeInTheDocument();
  });

  it('noSavedBlueprints-rendersNoBlueprintsSectionAtAll', () => {
    render(<Palette {...defaultProps} canvasMode="level" />);

    expect(palette.queryGroup('blueprints')).not.toBeInTheDocument();
  });

  it('blueprintCanvasMode-offersNoBlueprintsSection', () => {
    // Placing a blueprint while editing another blueprint's canvas (nesting) is
    // explicitly out of scope; hiding the section is what enforces it.
    registryEntries.push(CAVE);
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    expect(palette.queryGroup('blueprints')).not.toBeInTheDocument();
  });

  it('backgroundLayerActive-offersNoBlueprintsSection', () => {
    // Placement writes the foreground grid; the background layer's palette is a
    // different catalog entirely.
    registryEntries.push(CAVE);
    render(<Palette {...defaultProps} canvasMode="level" activeLayer="background" />);

    expect(palette.queryGroup('blueprints')).not.toBeInTheDocument();
  });

  it('clickingABlueprintTile-callsOnArmBlueprintWithItsId', async () => {
    registryEntries.push(CAVE);
    const onArmBlueprint = vi.fn();
    render(<Palette {...defaultProps} canvasMode="level" onArmBlueprint={onArmBlueprint} />);

    await userEvent.click(palette.blueprintTile('cave-room'));

    expect(onArmBlueprint).toHaveBeenCalledWith('cave-room');
  });

  it('theArmedBlueprint-isTheOnlyOneMarkedPressed', () => {
    registryEntries.push(CAVE, { id: 'hall', name: 'Hall', layout: ['##'] });
    render(<Palette {...defaultProps} canvasMode="level" armedBlueprintId="cave-room" />);

    expect(palette.blueprintTile('cave-room')).toHaveAttribute('aria-pressed', 'true');
    expect(palette.blueprintTile('hall')).toHaveAttribute('aria-pressed', 'false');
  });

  it('omittedArmedBlueprintId-marksNoBlueprintPressed', () => {
    registryEntries.push(CAVE);
    render(<Palette {...defaultProps} canvasMode="level" />);

    expect(palette.blueprintTile('cave-room')).toHaveAttribute('aria-pressed', 'false');
  });

  it('blueprintTiles-stayOutOfTheTerrainAndToolsGroups', () => {
    registryEntries.push(CAVE);
    render(<Palette {...defaultProps} canvasMode="level" />);

    expect(
      within(palette.group('terrain')).queryByTestId('editor-palette-tile-blueprint-cave-room'),
    ).not.toBeInTheDocument();
    expect(
      within(palette.group('tools')).queryByTestId('editor-palette-tile-blueprint-cave-room'),
    ).not.toBeInTheDocument();
  });
});

describe('Palette — background layer sections', () => {
  it('backgroundLayer-rendersSurfaceAndCaveHeadings', () => {
    render(<Palette {...defaultProps} activeLayer="background" />);

    expect(palette.group('surface')).toHaveTextContent('Surface');
    expect(palette.group('cave')).toHaveTextContent('Cave');
  });

  it('backgroundLayer-everyMaterialSitsInTheSectionMatchingItsFamily', () => {
    render(<Palette {...defaultProps} activeLayer="background" />);
    const surface = palette.group('surface');
    const cave = palette.group('cave');

    for (const material of Object.keys(BACKGROUND_MATERIAL_FAMILY) as BackgroundMaterialId[]) {
      const section = BACKGROUND_MATERIAL_FAMILY[material] === 'surface' ? surface : cave;
      expect(within(section).getByTestId(`editor-palette-tile-${material}`)).toBeInTheDocument();
    }
  });

  it('clickingAMaterialInEitherSection-callsOnSelectBackgroundMaterialWithItsChar', () => {
    const onSelectBackgroundMaterial = vi.fn();
    render(
      <Palette
        {...defaultProps}
        activeLayer="background"
        onSelectBackgroundMaterial={onSelectBackgroundMaterial}
      />,
    );

    fireEvent.click(palette.backgroundTile('dirt'));
    fireEvent.click(palette.backgroundTile('charcoal'));

    expect(onSelectBackgroundMaterial).toHaveBeenCalledWith('d');
    expect(onSelectBackgroundMaterial).toHaveBeenCalledWith('c');
  });

  it('foregroundDecorationGroup-stillContainsTheTorchTile', () => {
    render(<Palette {...defaultProps} />);

    expect(
      within(palette.group('decoration')).getByTestId('editor-palette-tile-¥'),
    ).toBeInTheDocument();
  });
});
