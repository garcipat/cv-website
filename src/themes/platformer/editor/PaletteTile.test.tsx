import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaletteTile } from './PaletteTile';
import { PALETTE_TILE_SPRITES, type TileSpriteSpec } from './paletteTiles';

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

  it('sets a hover tooltip combining the tile name and what it does', () => {
    render(
      <PaletteTile
        label="Patrol Boundary"
        description="Invisible in game; turns patrolling enemies around"
        sprite={null}
        selected={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Patrol Boundary' })).toHaveAttribute(
      'title',
      'Patrol Boundary — Invisible in game; turns patrolling enemies around',
    );
  });

  it('falls back to the bare name when a tile has no description', () => {
    render(<PaletteTile label="Coin" sprite={SPRITE} selected={false} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Coin' })).toHaveAttribute('title', 'Coin');
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

  it('overlayWithShorterFrameHeight-clipsItsOwnWrapperAndAnchorsItToTheBottom', () => {
    const sprite: TileSpriteSpec = {
      sheet: '/sprites/spikes.png',
      sheetWidth: 48,
      sheetHeight: 20,
      sx: 0,
      sy: 0,
      frameWidth: 16,
      frameHeight: 20,
      overlay: { sx: 32, sy: 10, frameHeight: 10 },
    };

    const { container } = render(
      <PaletteTile label="Floor Spike" sprite={sprite} selected={false} onClick={() => {}} />,
    );

    // scale = (40 - 10) / max(16, 20) = 1.5
    const scale = 1.5;
    const wrapper = container.querySelector('img[alt=""]')!.parentElement!;
    expect(wrapper.style.height).toBe(`${10 * scale}px`);
    // Bottom-anchored: (base frameHeight 20 - overlay frameHeight 10) * scale.
    expect(wrapper.style.top).toBe(`${(20 - 10) * scale}px`);
  });

  it('overlayWithNoFrameHeight-fillsTheFullBaseFootprintFromTheTop', () => {
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

    const wrapper = container.querySelector('img[alt=""]')!.parentElement!;
    expect(wrapper.style.top).toBe('0px');
  });

  it('overlayWithTopAnchor-positionsFlushWithTheBaseSpritesOwnTop', () => {
    const sprite: TileSpriteSpec = {
      sheet: '/sprites/crumble_floor.png',
      sheetWidth: 16,
      sheetHeight: 16,
      sx: 0,
      sy: 0,
      frameWidth: 16,
      frameHeight: 16,
      overlay: { sx: 0, sy: 0, frameHeight: 8, anchor: 'top' },
    };

    const { container } = render(
      <PaletteTile label="Crumbling Floor" sprite={sprite} selected={false} onClick={() => {}} />,
    );

    const wrapper = container.querySelector('img[alt=""]')!.parentElement!;
    // Top-anchored: flush with the base sprite's own top (0), unlike the
    // bottom-anchored floor spike case above, even though this overlay's
    // frameHeight (8) is shorter than the base's (16).
    expect(wrapper.style.top).toBe('0px');
  });

  it('crumblingFloorPaletteEntry-topAnchorsItsCrackOverlay', () => {
    // Regression coverage for the real `g` (Crumbling Floor) spec, not just
    // a synthetic anchor:'top' case: crumble_floor.png's visible ledge art
    // is top-aligned in its 16x16 cell, so its crack overlay must render
    // over that visible top half rather than the transparent bottom half.
    const sprite = PALETTE_TILE_SPRITES.g;
    expect(sprite?.overlay?.anchor).toBe('top');

    const { container } = render(
      <PaletteTile label="Crumbling Floor" sprite={sprite} selected={false} onClick={() => {}} />,
    );

    const wrapper = container.querySelector('img[alt=""]')!.parentElement!;
    // Follows the base sprite's own topOffset (4 source px) nudge, scaled
    // the same as everything else in the icon (scale = (40 - 10) / 16 =
    // 1.875) — not flush at 0 the way a sprite with no topOffset would be
    // (see the synthetic case above).
    expect(wrapper.style.top).toBe('7.5px');
  });

  it('spriteWithTint-rendersATranslucentOverlay', () => {
    const sprite: TileSpriteSpec = { ...SPRITE, tint: 'rgba(220, 38, 38, 0.45)' };

    render(<PaletteTile label="Falling Stalactite" sprite={sprite} selected={false} onClick={() => {}} />);

    const tint = screen.getByTestId('palette-tile-tint');
    expect(tint.style.backgroundColor).toBe('rgba(220, 38, 38, 0.45)');
  });

  it('spriteWithoutTint-rendersNoOverlay', () => {
    render(<PaletteTile label="Coin" sprite={SPRITE} selected={false} onClick={() => {}} />);

    expect(screen.queryByTestId('palette-tile-tint')).not.toBeInTheDocument();
  });

  it('spriteWithTint-masksTheWashToTheSpritesOwnOpaquePixels', () => {
    // Regression (O-027): an unmasked `inset: 0` wash tints the whole icon
    // box — including the transparent background around the stone — instead
    // of only the stalactite art. The wash must be masked by the sprite's own
    // sheet/crop so its alpha decides what gets tinted.
    const sprite: TileSpriteSpec = { ...SPRITE, tint: 'rgba(220, 38, 38, 0.45)' };

    render(<PaletteTile label="Falling Stalactite" sprite={sprite} selected={false} onClick={() => {}} />);

    const tint = screen.getByTestId('palette-tile-tint');
    expect(tint.style.maskImage).toContain('/sprites/coin.png');
  });

  it('realFallingStalactitePaletteEntry-carriesAReddishTint', () => {
    const sprite = PALETTE_TILE_SPRITES['T'];
    expect(sprite?.tint).toBeTruthy();

    render(<PaletteTile label="Falling Stalactite" sprite={sprite} selected={false} onClick={() => {}} />);

    expect(screen.getByTestId('palette-tile-tint')).toBeInTheDocument();
  });
});
