import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Palette } from './Palette';
import { TERRAIN_CHARS, ENTITY_CHARS } from '../level/LevelParser';

describe('Palette', () => {
  it('renders one tile for every terrain char (excluding "." and the hidden Platform, which looks identical to Ground Grass), every entity char, and the Eraser', () => {
    render(<Palette selectedTool="G" onSelectTool={() => {}} />);
    // -1 for Platform ('P'), hidden because it renders with the exact same
    // sprite as Ground Grass and reads as a confusing duplicate tile.
    const terrainCount = Object.keys(TERRAIN_CHARS).filter((k) => k !== '.' && k !== 'P').length;
    const entityCount = Object.keys(ENTITY_CHARS).length;
    // +1 for the Eraser tile.
    expect(screen.getAllByRole('button')).toHaveLength(terrainCount + entityCount + 1);
  });

  it('does not render a separate Platform tile', () => {
    render(<Palette selectedTool="G" onSelectTool={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Platform' })).not.toBeInTheDocument();
  });

  it('renders a "Palette" title', () => {
    render(<Palette selectedTool="G" onSelectTool={() => {}} />);
    expect(screen.getByText('Palette')).toBeInTheDocument();
  });

  it('renders a distinct Eraser tile', () => {
    render(<Palette selectedTool="G" onSelectTool={() => {}} />);
    expect(screen.getByRole('button', { name: 'Eraser' })).toBeInTheDocument();
  });

  it('renders tiles labeled by human-readable name, not raw character', () => {
    render(<Palette selectedTool="G" onSelectTool={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ground Rock' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coin' })).toBeInTheDocument();
  });

  it('calls onSelectTool with the clicked terrain char', async () => {
    const onSelectTool = vi.fn();
    render(<Palette selectedTool="G" onSelectTool={onSelectTool} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ground Rock' }));
    expect(onSelectTool).toHaveBeenCalledWith('R');
  });

  it('calls onSelectTool with "." when the Eraser tile is clicked', async () => {
    const onSelectTool = vi.fn();
    render(<Palette selectedTool="G" onSelectTool={onSelectTool} />);
    await userEvent.click(screen.getByRole('button', { name: 'Eraser' }));
    expect(onSelectTool).toHaveBeenCalledWith('.');
  });

  it('marks the currently selected tool as pressed', () => {
    render(<Palette selectedTool="R" onSelectTool={() => {}} />);
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
