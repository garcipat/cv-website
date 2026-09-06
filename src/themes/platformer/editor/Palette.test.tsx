import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Palette } from './Palette';
import { TERRAIN_CHARS, ENTITY_CHARS } from '../level/LevelParser';
import { BACKGROUND_CATALOG } from '../engine/BackgroundCatalog';
import { BACKGROUND_PALETTE_LABELS } from './backgroundPaletteTiles';
import type { BackgroundPieceId } from '../level/LevelData';

const defaultProps = {
  selectedTool: 'G' as const,
  onSelectTool: vi.fn(),
  activeLayer: 'foreground' as const,
  selectedBackgroundPiece: null,
  onSelectBackgroundPiece: vi.fn(),
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
    expect(screen.getAllByRole('button')).toHaveLength(terrainCount + entityCount + 1 + 1 + 1);
  });

  it('renders a "Palette" title', () => {
    render(<Palette {...defaultProps} />);
    expect(screen.getByText('Palette')).toBeInTheDocument();
  });

  it('renders a distinct Eraser tile', () => {
    render(<Palette {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Eraser' })).toBeInTheDocument();
  });

  it('renders tiles labeled by human-readable name, not raw character', () => {
    render(<Palette {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'Ground Rock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coin' })).toBeInTheDocument();
  });

  it('calls onSelectTool with the clicked terrain char', async () => {
    const onSelectTool = vi.fn();
    render(<Palette {...defaultProps} onSelectTool={onSelectTool} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ground Rock' }));
    expect(onSelectTool).toHaveBeenCalledWith('R');
  });

  it('calls onSelectTool with "." when the Eraser tile is clicked', async () => {
    const onSelectTool = vi.fn();
    render(<Palette {...defaultProps} onSelectTool={onSelectTool} />);
    await userEvent.click(screen.getByRole('button', { name: 'Eraser' }));
    expect(onSelectTool).toHaveBeenCalledWith('.');
  });

  it('marks the currently selected tool as pressed', () => {
    render(<Palette {...defaultProps} selectedTool="R" />);
    expect(screen.getByRole('button', { name: 'Ground Rock' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Ground Grass' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('Palette — layer tab', () => {
  it('foregroundLayerActive-showsTheExistingTerrainAndEntityButtonsOnly', () => {
    render(<Palette {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /Dirt Block/ })).not.toBeInTheDocument();
  });

  it('backgroundLayerActive-showsOneButtonPerCatalogPiece', () => {
    render(<Palette {...defaultProps} activeLayer="background" />);
    for (const pieceId of Object.keys(BACKGROUND_CATALOG) as BackgroundPieceId[]) {
      expect(
        screen.getByRole('button', { name: BACKGROUND_PALETTE_LABELS[pieceId] }),
      ).toBeInTheDocument();
    }
  });

  it('clickingABackgroundPieceButton-callsOnSelectBackgroundPieceWithItsId', () => {
    const onSelectBackgroundPiece = vi.fn();
    render(
      <Palette
        {...defaultProps}
        activeLayer="background"
        onSelectBackgroundPiece={onSelectBackgroundPiece}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Dirt Column Top/ }));
    expect(onSelectBackgroundPiece).toHaveBeenCalledWith('dirtColumnTop1x1');
  });
});

describe('Palette — subtitle groups', () => {
  it('foregroundLayer-rendersFiveGroupHeadings', () => {
    render(<Palette {...defaultProps} />);
    expect(screen.getByText('Terrain')).toBeInTheDocument();
    expect(screen.getByText('Decoration')).toBeInTheDocument();
    expect(screen.getByText('Entities')).toBeInTheDocument();
    expect(screen.getByText('Hazards')).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
  });

  it('decorationGroup-containsBushAndFenceButNoOtherTerrainChar', () => {
    render(<Palette {...defaultProps} />);
    const decorationHeading = screen.getByText('Decoration');
    const decorationGroup = decorationHeading.closest('section') ?? decorationHeading.parentElement!;
    expect(within(decorationGroup).getByRole('button', { name: /Bush/ })).toBeInTheDocument();
    expect(within(decorationGroup).getByRole('button', { name: /Fence/ })).toBeInTheDocument();
    expect(within(decorationGroup).queryByRole('button', { name: 'Wall' })).not.toBeInTheDocument();
  });

  it('hazardsGroup-containsExactlyOneRepresentativeSpikeTile', () => {
    // Same one-button convention as signs: clicking the canvas auto-detects
    // a facing from the surrounding terrain, and clicking an already-placed
    // spike again cycles to the next valid facing (paintCell.ts) — so the
    // palette never needs a button per facing.
    render(<Palette {...defaultProps} />);
    const hazardsHeading = screen.getByText('Hazards');
    const hazardsGroup = hazardsHeading.closest('section') ?? hazardsHeading.parentElement!;
    expect(within(hazardsGroup).getByRole('button', { name: 'Spike' })).toBeInTheDocument();
    expect(within(hazardsGroup).getAllByRole('button')).toHaveLength(1);
  });
});

describe('Palette — blueprint canvas mode', () => {
  it('levelCanvasMode-stillOffersTheSpawnTool', () => {
    render(<Palette {...defaultProps} canvasMode="level" />);

    expect(screen.getByRole('button', { name: 'Spawn' })).toBeInTheDocument();
  });

  it('blueprintCanvasMode-dropsTheSpawnToolOnly', () => {
    // A blueprint has no spawn point, and offering the button would invite a
    // marker nothing downstream expects outside a real level's layout. Every
    // other entity tool stays.
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    expect(screen.queryByRole('button', { name: 'Spawn' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enemy Green' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coin' })).toBeInTheDocument();
  });

  it('omittedCanvasMode-behavesLikeLevelMode', () => {
    render(<Palette {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Spawn' })).toBeInTheDocument();
  });
});

describe('Palette — blueprint connection point tool', () => {
  const toolsGroup = () => {
    const heading = screen.getByText('Tools');
    return heading.closest('section') ?? heading.parentElement!;
  };

  it('blueprintCanvasMode-offersTheConnectionPointToolInTheToolsGroup', () => {
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    expect(
      within(toolsGroup()).getByRole('button', { name: 'Connection Point' }),
    ).toBeInTheDocument();
  });

  it('levelCanvasMode-doesNotOfferTheConnectionPointToolAtAll', () => {
    // A connection point only means something on a blueprint's border — on a
    // level it would be an inert marker nothing downstream reads (step 44b).
    render(<Palette {...defaultProps} canvasMode="level" />);

    expect(screen.queryByRole('button', { name: 'Connection Point' })).not.toBeInTheDocument();
  });

  // Deliberately NOT named `omittedCanvasMode-behavesLikeLevelMode`: that exact
  // name is already taken by step 44a's Spawn test in the
  // `Palette — blueprint canvas mode` describe above, and a duplicate would
  // make `vitest -t` ambiguous and the two indistinguishable in the reporter.
  it('omittedCanvasMode-offersNoConnectionPointToolEither', () => {
    render(<Palette {...defaultProps} />);

    expect(screen.queryByRole('button', { name: 'Connection Point' })).not.toBeInTheDocument();
  });

  it('blueprintCanvasMode-keepsTheConnectionPointOutOfTheTerrainGroup', () => {
    // It is an invisible marker, not physical ground — same reason the
    // patrol boundary lives in Tools rather than Terrain.
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    const terrainHeading = screen.getByText('Terrain');
    const terrainGroup = terrainHeading.closest('section') ?? terrainHeading.parentElement!;
    expect(
      within(terrainGroup).queryByRole('button', { name: 'Connection Point' }),
    ).not.toBeInTheDocument();
  });

  it('blueprintCanvasMode-clickingTheConnectionPointTool-armsItsCharacter', async () => {
    const onSelectTool = vi.fn();
    render(<Palette {...defaultProps} canvasMode="blueprint" onSelectTool={onSelectTool} />);

    await userEvent.click(screen.getByRole('button', { name: 'Connection Point' }));

    expect(onSelectTool).toHaveBeenCalledWith('+');
  });

  it('blueprintCanvasMode-theEraserStaysTheLastToolInTheGroup', () => {
    render(<Palette {...defaultProps} canvasMode="blueprint" />);

    const buttons = within(toolsGroup()).getAllByRole('button');
    expect(buttons.at(-1)).toHaveAccessibleName('Eraser');
  });
});
