import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlatformerPage } from './PlatformerPage';

class MockTilesetImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => this.onload?.());
  }
}

describe('PlatformerPage', () => {
  it('render-default-showsFullViewportCanvas', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });

    render(<PlatformerPage />);

    const canvas = screen.getByTestId('platformer-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('width', '1024');
    expect(canvas).toHaveAttribute('height', '768');
  });

  it('windowResize-afterMount-updatesCanvasDimensions', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });

    render(<PlatformerPage />);

    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 800 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 600 });
    fireEvent(window, new Event('resize'));

    const canvas = screen.getByTestId('platformer-canvas');
    expect(canvas).toHaveAttribute('width', '800');
    expect(canvas).toHaveAttribute('height', '600');
  });

  it('render-default-showsFloatingControlsOverCanvas', () => {
    render(<PlatformerPage />);
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('render-afterTilesetLoads-drawsTerrainTiles', async () => {
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as { drawImage: ReturnType<typeof vi.fn> };

    await waitFor(() => expect(ctx.drawImage).toHaveBeenCalled());

    vi.unstubAllGlobals();
  });
});
