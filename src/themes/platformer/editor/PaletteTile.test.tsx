import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaletteTile } from './PaletteTile';
import type { TileSpriteSpec } from './paletteTiles';

const SPRITE: TileSpriteSpec = {
  sheet: '/sprites/coin.png',
  sheetWidth: 192,
  sheetHeight: 16,
  sx: 0,
  sy: 0,
  frameWidth: 16,
  frameHeight: 16,
};

describe('PaletteTile', () => {
  it('renders a cropped sprite image when given a sprite spec', () => {
    render(<PaletteTile label="Coin" sprite={SPRITE} selected={false} onClick={() => {}} />);
    const img = screen.getByRole('img', { name: 'Coin' });
    expect(img).toHaveAttribute('src', '/sprites/coin.png');
  });

  it('renders a bordered empty square (no image) when sprite is null', () => {
    render(<PaletteTile label="Eraser" sprite={null} selected={false} onClick={() => {}} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eraser' })).toBeInTheDocument();
  });

  it('marks the button as pressed when selected', () => {
    render(<PaletteTile label="Coin" sprite={SPRITE} selected={true} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Coin' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<PaletteTile label="Coin" sprite={SPRITE} selected={false} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Coin' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
