import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Palette } from './Palette';
import { TERRAIN_CHARS, ENTITY_CHARS } from '../level/LevelParser';

describe('Palette', () => {
  it('renders one button for every terrain char (excluding the "." empty char) and every entity char', () => {
    render(<Palette selectedTool="G" onSelectTool={() => {}} />);
    const terrainCount = Object.keys(TERRAIN_CHARS).filter((k) => k !== '.').length;
    const entityCount = Object.keys(ENTITY_CHARS).length;
    // +1 for the explicit Eraser button.
    expect(screen.getAllByRole('button')).toHaveLength(terrainCount + entityCount + 1);
  });

  it('renders a distinct Eraser button', () => {
    render(<Palette selectedTool="G" onSelectTool={() => {}} />);
    expect(screen.getByRole('button', { name: 'Eraser' })).toBeInTheDocument();
  });

  it('calls onSelectTool with the clicked terrain char', async () => {
    const onSelectTool = vi.fn();
    render(<Palette selectedTool="G" onSelectTool={onSelectTool} />);
    await userEvent.click(screen.getByRole('button', { name: 'R' }));
    expect(onSelectTool).toHaveBeenCalledWith('R');
  });

  it('calls onSelectTool with "." when the Eraser button is clicked', async () => {
    const onSelectTool = vi.fn();
    render(<Palette selectedTool="G" onSelectTool={onSelectTool} />);
    await userEvent.click(screen.getByRole('button', { name: 'Eraser' }));
    expect(onSelectTool).toHaveBeenCalledWith('.');
  });

  it('marks the currently selected tool as pressed', () => {
    render(<Palette selectedTool="R" onSelectTool={() => {}} />);
    expect(screen.getByRole('button', { name: 'R' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'G' })).toHaveAttribute('aria-pressed', 'false');
  });
});
