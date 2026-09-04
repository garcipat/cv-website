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
  it('renders one tile for every terrain char (excluding "."), every entity char, one representative Sign tile, and the Eraser', () => {
    render(<Palette {...defaultProps} />);
    const terrainCount = Object.keys(TERRAIN_CHARS).filter((k) => k !== '.').length;
    const entityCount = Object.keys(ENTITY_CHARS).length;
    // +1 for the single representative Sign tile, +1 for the Eraser tile.
    expect(screen.getAllByRole('button')).toHaveLength(terrainCount + entityCount + 1 + 1);
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
  it('foregroundLayer-rendersFourGroupHeadings', () => {
    render(<Palette {...defaultProps} />);
    expect(screen.getByText('Terrain')).toBeInTheDocument();
    expect(screen.getByText('Decoration')).toBeInTheDocument();
    expect(screen.getByText('Entities')).toBeInTheDocument();
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
});
