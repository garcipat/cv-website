import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { PlatformerPage } from './PlatformerPage';
import { PLAYER_RENDERED_SIZE } from './entities/Player';
import { playerState, cameraPositionX } from './PlatformerState';

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

// `playerState` is a module-level singleton (see PlatformerState.ts), so
// without a reset a jump left mid-air by one test (a real jump arc takes
// ~300ms+ to complete, far more than the couple of 16ms ticks a test
// advances) would bleed into the next test's "lands on the ground" or
// "starts idle" assumptions.
const initialPlayerState = playerState.value;
const originalLocation = window.location;

describe('PlatformerPage', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    playerState.value = initialPlayerState;
    cameraPositionX.value = 0;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
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

  it('debugHitboxesQueryParam-present-drawsDebugOverlayHitboxes', async () => {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?debug=hitboxes'),
      writable: true,
      configurable: true,
    });
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      strokeRect: ReturnType<typeof vi.fn>;
    };

    await waitFor(() => expect(ctx.drawImage).toHaveBeenCalled());

    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it('debugHitboxesQueryParam-absent-doesNotDrawDebugOverlay', async () => {
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
      strokeRect: ReturnType<typeof vi.fn>;
    };

    await waitFor(() => expect(ctx.drawImage).toHaveBeenCalled());

    expect(ctx.strokeRect).not.toHaveBeenCalled();
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

  it('arrowRightHeld-gameLoopTicks-movesPlayerRightAndFacesRightAndWalks', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    const startX = playerState.value.x;

    fireEvent.keyDown(window, { code: 'ArrowRight' });
    frameCallback!(0);
    frameCallback!(16);

    expect(playerState.value.x).toBeGreaterThan(startX);
    expect(playerState.value.facing).toBe('right');
    expect(playerState.value.animState).toBe('walk');
  });

  it('arrowKeyReleased-nextTick-returnsToIdleAndStopsMoving', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);

    fireEvent.keyDown(window, { code: 'ArrowRight' });
    frameCallback!(0);
    frameCallback!(16);
    const xAfterMoving = playerState.value.x;

    fireEvent.keyUp(window, { code: 'ArrowRight' });
    frameCallback!(32);

    expect(playerState.value.x).toBe(xAfterMoving);
    expect(playerState.value.animState).toBe('idle');
  });

  it('unmount-afterMount-removesKeyboardEventListeners', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<PlatformerPage />);
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('mount-onRender-focusesTheCanvasSoArrowKeysWorkImmediately', () => {
    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    expect(canvas).toHaveFocus();
  });

  it('keyDHeld-gameLoopTicks-movesPlayerRightSameAsArrowRight', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    const startX = playerState.value.x;

    fireEvent.keyDown(window, { code: 'KeyD' });
    frameCallback!(0);
    frameCallback!(16);

    expect(playerState.value.x).toBeGreaterThan(startX);
    expect(playerState.value.facing).toBe('right');
    expect(playerState.value.animState).toBe('walk');
  });

  it('keyAHeld-gameLoopTicks-movesPlayerLeftSameAsArrowLeft', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    const startX = playerState.value.x;

    fireEvent.keyDown(window, { code: 'KeyA' });
    frameCallback!(0);
    frameCallback!(16);

    expect(playerState.value.x).toBeLessThan(startX);
    expect(playerState.value.facing).toBe('left');
    expect(playerState.value.animState).toBe('walk');
  });

  it('spacePressed-whileGrounded-triggersJumpNextTick', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    frameCallback!(16); // lands the spawned player on the ground first
    expect(playerState.value.grounded).toBe(true);

    fireEvent.keyDown(window, { code: 'Space' });
    frameCallback!(32);

    expect(playerState.value.grounded).toBe(false);
    expect(playerState.value.vy).toBeLessThan(0);
    expect(playerState.value.animState).toBe('jump');
  });

  it('arrowUpPressed-whileGrounded-alsoTriggersJump', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    frameCallback!(16);
    expect(playerState.value.grounded).toBe(true);

    fireEvent.keyDown(window, { code: 'ArrowUp' });
    frameCallback!(32);

    expect(playerState.value.grounded).toBe(false);
    expect(playerState.value.vy).toBeLessThan(0);
  });

  it('spaceReleasedEarly-whileAscending-resultsInLowerVelocityThanHeldJump', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    frameCallback!(16);

    fireEvent.keyDown(window, { code: 'Space' });
    frameCallback!(32); // jump triggers this tick
    const vyRightAfterJump = playerState.value.vy;

    fireEvent.keyUp(window, { code: 'Space' });
    frameCallback!(48); // released before reaching the apex

    expect(playerState.value.vy).toBeGreaterThan(vyRightAfterJump);
  });

  it('arrowDownHeld-whileRestingOnGroundLevelBridge-fallsThroughIt', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    // Place the character resting on level1's ground-level bridge (row 10,
    // columns 2-3 — see level1.ts) directly, rather than navigating there by
    // walking, since only the drop-through wiring is under test here (the
    // underlying physics is covered by Physics.test.ts).
    playerState.value = {
      ...playerState.value,
      x: 64,
      y: 264,
      vx: 0,
      vy: 0,
      grounded: true,
      isDroppingThroughBridge: false,
    };

    fireEvent.keyDown(window, { code: 'ArrowDown' });
    frameCallback!(16);

    expect(playerState.value.grounded).toBe(false);
    expect(playerState.value.isDroppingThroughBridge).toBe(true);
  });

  it('playerWalksPastDeadZone-gameLoopTicks-cameraScrollsRight', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    fireEvent.keyDown(window, { code: 'ArrowRight' });

    // walkSpeed is 200px/s; the player starts near the level's left edge and
    // needs to cross the dead zone (roughly the viewport's center ±96px)
    // before the camera reacts — tick well past that at 16ms/frame.
    let t = 0;
    frameCallback!(t);
    for (let i = 0; i < 200; i++) {
      t += 16;
      frameCallback!(t);
    }

    expect(cameraPositionX.value).toBeGreaterThan(0);
  });

  it('cameraPositionX-nonZero-shiftsTerrainDrawCallsHorizontally', async () => {
    vi.stubGlobal('Image', MockTilesetImage);
    cameraPositionX.value = 50;

    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as { drawImage: ReturnType<typeof vi.fn> };

    await waitFor(() => expect(ctx.drawImage).toHaveBeenCalled());

    // Every terrain/player draw call's dx (5th positional drawImage arg,
    // index 5) should be shifted left by exactly the camera offset relative
    // to what it'd be at cameraPositionX = 0 — cheapest check: originX is
    // -cameraPositionX, so no draw call should use a dx that's uncorrected
    // for a nonzero camera. Spot-check the first terrain tile (level1's
    // top-left column is 'empty' until the platform/ground rows — assert on
    // any call instead of a fixed index to stay robust to level1's layout).
    const anyShiftedCall = ctx.drawImage.mock.calls.some((call: unknown[]) => call[5] === -50);
    expect(anyShiftedCall).toBe(true);
  });
});
