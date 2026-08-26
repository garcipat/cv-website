import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { PlatformerPage } from './PlatformerPage';
import { PLAYER_RENDERED_SIZE } from './entities/Player';
import { playerState } from './PlatformerState';

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
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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
  });

  it('render-tallViewport-anchorsLevelBottomToCanvasBottom', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
    };

    await waitFor(() => expect(ctx.drawImage).toHaveBeenCalled());

    const bottomEdges = ctx.drawImage.mock.calls.map(
      (call: unknown[]) => (call[6] as number) + (call[8] as number), // dy + dh
    );
    expect(Math.max(...bottomEdges)).toBe(768);
  });

  it('render-afterPlayerSpriteLoads-drawsPlayerAtIdleSize', async () => {
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as { drawImage: ReturnType<typeof vi.fn> };

    await waitFor(() =>
      expect(
        ctx.drawImage.mock.calls.some((call: unknown[]) => call[7] === PLAYER_RENDERED_SIZE),
      ).toBe(true),
    );
  });

  it('mount-onRender-startsTheGameLoop', () => {
    const rafSpy = vi.fn(() => 1);
    vi.stubGlobal('requestAnimationFrame', rafSpy);

    render(<PlatformerPage />);

    expect(rafSpy).toHaveBeenCalled();
  });

  it('unmount-afterMount-stopsTheGameLoop', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    const cafSpy = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cafSpy);

    const { unmount } = render(<PlatformerPage />);
    unmount();

    expect(cafSpy).toHaveBeenCalled();
  });

  it('gameLoopFrames-run-updatePlayerPhysicsAndGroundTheSpawnedPlayer', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    expect(playerState.value.grounded).toBe(false);

    frameCallback!(0); // establishes the loop's reference time, no physics step yet
    frameCallback!(16); // ~16ms later: one physics + animation step runs

    expect(playerState.value.grounded).toBe(true);
    expect(playerState.value.vy).toBe(0);
  });
});
