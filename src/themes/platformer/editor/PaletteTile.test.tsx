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

  it('renders the glyph inside the empty square when a sprite-less tile has one', () => {
    render(
      <PaletteTile
        label="Patrol Boundary"
        sprite={null}
        glyph="⇄"
        selected={false}
        onClick={() => {}}
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Patrol Boundary' })).toHaveTextContent('⇄');
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

  it('scales a square sprite to fit within the button content box, not just the box size', () => {
    // The button is 40px with a 2px border and 2px padding on every side
    // (border-2 + p-0.5), so its content box is 40 - 2*(2+2) = 32px. A
    // scaled sprite frame bigger than that gets visually clipped by the
    // button's own border/padding even though it fits the raw 40px box.
    render(<PaletteTile label="Coin" sprite={SPRITE} selected={false} onClick={() => {}} />);
    const img = screen.getByRole('img', { name: 'Coin' });
    const wrapper = img.parentElement as HTMLElement;
    const width = parseFloat(wrapper.style.width);
    const height = parseFloat(wrapper.style.height);
    expect(Math.max(width, height)).toBeLessThanOrEqual(32);
  });

  it('spriteWithOverlay-rendersBothLayersFromTheSameSheet', () => {
    const sprite: TileSpriteSpec = {
      sheet: '/sprites/tile_atlas.png',
      sheetWidth: 130,
      sheetHeight: 54,
      sx: 114,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
      overlay: { sx: 76, sy: 38 },
    };

    const { container } = render(
      <PaletteTile label="Ground" sprite={sprite} selected={false} onClick={() => {}} />,
    );

    // The overlay layer is `alt=""` (decorative, so AT doesn't announce it
    // twice), which computes to ARIA role "presentation" rather than "img" —
    // so both layers are queried by tag here rather than by role.
    const layers = container.querySelectorAll('img');
    expect(layers).toHaveLength(2);
    expect(Array.from(layers).every((img) => img.getAttribute('src') === '/sprites/tile_atlas.png')).toBe(
      true,
    );
  });

  it('spriteWithOverlay-positionsTheOverlayByItsOwnOffset', () => {
    const sprite: TileSpriteSpec = {
      sheet: '/sprites/tile_atlas.png',
      sheetWidth: 130,
      sheetHeight: 54,
      sx: 114,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
      overlay: { sx: 76, sy: 38 },
    };

    const { container } = render(
      <PaletteTile label="Ground" sprite={sprite} selected={false} onClick={() => {}} />,
    );

    // Both layers are scaled the same way; the overlay is offset by its own
    // cell, not the base's, or the tuft would come from the wrong sheet cell.
    const [base, overlay] = Array.from(container.querySelectorAll('img'));
    expect(base.style.left).not.toBe(overlay.style.left);
    expect(overlay.style.top).not.toBe('0px');
  });

  it('spriteWithoutOverlay-rendersOneLayer', () => {
    const sprite: TileSpriteSpec = {
      sheet: '/sprites/world_tileset.png',
      sheetWidth: 256,
      sheetHeight: 256,
      sx: 16,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
    };

    render(<PaletteTile label="Rock" sprite={sprite} selected={false} onClick={() => {}} />);

    expect(screen.getAllByRole('img')).toHaveLength(1);
  });
});
