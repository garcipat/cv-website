import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { PlatformerPage } from './PlatformerPage';
import { PLAYER_RENDERED_SIZE, PLAYER_VISUAL_CENTER_Y_OFFSET } from './entities/Player';
import {
  playerState,
  cameraPositionX,
  healthState,
  lifecycleState,
  collectedFacts,
} from './PlatformerState';
import { MAX_HALF_HEARTS, PIT_FALL_DAMAGE, HEART_RENDERED_SIZE } from './entities/Health';
import { level1Coins } from './level/level1Coins';
import { COIN_RENDERED_SIZE } from './entities/Coin';

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
const initialLifecycleState = lifecycleState.value;
const initialCollectedFacts = collectedFacts.value;
const originalLocation = window.location;

describe('PlatformerPage', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    playerState.value = initialPlayerState;
    cameraPositionX.value = 0;
    healthState.value = MAX_HALF_HEARTS;
    lifecycleState.value = initialLifecycleState;
    collectedFacts.value = initialCollectedFacts;
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

  it('render-afterHeartsSpriteLoads-drawsHeartHud', async () => {
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as { drawImage: ReturnType<typeof vi.fn> };

    // dx===16 (call[5]) alone isn't enough to distinguish this from the
    // player's draw call: at this test's default spawn position (SPAWN_TILE
    // col 1, camera at 0, facing right) the player's dest-x also happens to
    // be 16 (see PlatformerState.ts's initialPlayerState math), coinciding
    // with the heart HUD's fixed HUD_MARGIN dx. dy===16 (call[6]) is what
    // actually discriminates: drawHearts always draws at dy=HUD_MARGIN=16
    // (Renderer.ts), while the player's dy is its scrolled world y-position
    // (648 by default here), never 16.
    await waitFor(() =>
      expect(
        ctx.drawImage.mock.calls.some(
          (call: unknown[]) =>
            call[7] === HEART_RENDERED_SIZE && call[5] === 16 && call[6] === 16,
        ),
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

  it('playerFallsPastLevelBottom-gameLoopTicks-losesHalfHeartAndRepositionsToLastGround', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    // Simulate having fallen into a pit: feet far below the level's bottom
    // row, with a known "last grounded" position recorded earlier.
    playerState.value = {
      ...playerState.value,
      x: 500,
      y: 5000,
      vx: 0,
      vy: 900,
      grounded: false,
      lastGroundedX: 500,
      lastGroundedY: 200,
    };

    frameCallback!(16);

    expect(healthState.value).toBe(MAX_HALF_HEARTS - PIT_FALL_DAMAGE);
    expect(playerState.value.x).toBe(500);
    expect(playerState.value.y).toBe(200);
    expect(playerState.value.grounded).toBe(true);
  });

  it('playerNeverFallsPastLevelBottom-gameLoopTicks-healthUnchanged', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    frameCallback!(16);

    expect(healthState.value).toBe(MAX_HALF_HEARTS);
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

  it('render-default-showsCoinCounterPlaceholder', () => {
    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as { fillText: ReturnType<typeof vi.fn> };

    expect(ctx.fillText).toHaveBeenCalledWith(
      `0 / ${level1Coins.length}`,
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('render-afterCoinSpriteLoads-drawsEveryTestCoinAtRenderedSize', async () => {
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as { drawImage: ReturnType<typeof vi.fn> };

    await waitFor(() =>
      expect(
        ctx.drawImage.mock.calls.some(
          (call: unknown[]) => (call[0] as MockTilesetImage).src === '/sprites/coin.png',
        ),
      ).toBe(true),
    );

    const coinCalls = ctx.drawImage.mock.calls.filter(
      (call: unknown[]) => (call[0] as MockTilesetImage).src === '/sprites/coin.png',
    );
    // Every render() pass draws exactly level1Coins.length coin calls, but
    // how many passes have fired by the time waitFor's condition is met
    // depends on how many other async sprite/font loads have also resolved
    // (each triggers its own render()) — not just the coin sprite's. Assert
    // a whole number of complete passes rather than one fixed pass count, so
    // this doesn't break every time another asset load is added elsewhere.
    expect(coinCalls.length).toBeGreaterThan(0);
    expect(coinCalls.length % level1Coins.length).toBe(0);
    expect(coinCalls.every((call: unknown[]) => call[7] === COIN_RENDERED_SIZE)).toBe(true);
  });

  it('healthReachesZero-gameLoopTicks-entersDyingPhaseCenteredOnPlayerAndPausesPhysics', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    // One half-heart of health left; a pit fall (PIT_FALL_DAMAGE = 1) is
    // exactly fatal this tick.
    healthState.value = PIT_FALL_DAMAGE;
    playerState.value = {
      ...playerState.value,
      x: 500,
      y: 5000,
      vx: 0,
      vy: 900,
      grounded: false,
      lastGroundedX: 500,
      lastGroundedY: 200,
    };

    frameCallback!(16);

    expect(healthState.value).toBe(0);
    expect(lifecycleState.value.phase).toBe('dying');
    expect(lifecycleState.value.centerX).toBe(playerState.value.x + PLAYER_RENDERED_SIZE / 2);
    expect(lifecycleState.value.centerY).toBe(playerState.value.y + PLAYER_VISUAL_CENTER_Y_OFFSET);

    const frozenX = playerState.value.x;
    const frozenY = playerState.value.y;
    frameCallback!(32); // physics must stay paused while dying
    expect(playerState.value.x).toBe(frozenX);
    expect(playerState.value.y).toBe(frozenY);
  });

  it('dyingPhase-durationElapses-transitionsToAwaitingRestart', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    healthState.value = PIT_FALL_DAMAGE;
    playerState.value = {
      ...playerState.value,
      x: 500,
      y: 5000,
      vy: 900,
      grounded: false,
      lastGroundedX: 500,
      lastGroundedY: 200,
    };
    frameCallback!(16);
    expect(lifecycleState.value.phase).toBe('dying');

    let t = 16;
    for (let i = 0; i < 250; i++) {
      t += 16;
      frameCallback!(t);
    }

    expect(lifecycleState.value.phase).toBe('awaitingRestart');
  });

  it('awaitingRestartPhase-anyKeyPressed-resetsHealthAndPositionAndReturnsToIntroAtSpawn', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    healthState.value = PIT_FALL_DAMAGE;
    playerState.value = {
      ...playerState.value,
      x: 500,
      y: 5000,
      vy: 900,
      grounded: false,
      lastGroundedX: 500,
      lastGroundedY: 200,
    };
    frameCallback!(16);
    let t = 16;
    for (let i = 0; i < 250; i++) {
      t += 16;
      frameCallback!(t);
    }
    expect(lifecycleState.value.phase).toBe('awaitingRestart');

    fireEvent.keyDown(window, { code: 'Enter' });

    expect(healthState.value).toBe(MAX_HALF_HEARTS);
    expect(lifecycleState.value.phase).toBe('intro');
    expect(playerState.value.x).toBe(initialPlayerState.x);
    expect(playerState.value.y).toBe(initialPlayerState.y);
    expect(cameraPositionX.value).toBe(0);
  });

  it('awaitingRestartPhase-canvasClicked-alsoTriggersRestart', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    healthState.value = PIT_FALL_DAMAGE;
    playerState.value = {
      ...playerState.value,
      x: 500,
      y: 5000,
      vy: 900,
      grounded: false,
      lastGroundedX: 500,
      lastGroundedY: 200,
    };
    frameCallback!(16);
    let t = 16;
    for (let i = 0; i < 250; i++) {
      t += 16;
      frameCallback!(t);
    }
    expect(lifecycleState.value.phase).toBe('awaitingRestart');

    const canvas = screen.getByTestId('platformer-canvas');
    fireEvent.click(canvas);

    expect(lifecycleState.value.phase).toBe('intro');
    expect(healthState.value).toBe(MAX_HALF_HEARTS);
  });

  it('jKeyPressed-whilePlaying-opensJournalAndPausesLoop', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };

    fireEvent.keyDown(window, { code: 'KeyJ' });

    expect(screen.getByTestId('platformer-journal')).toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('paused');

    const xBeforeTick = playerState.value.x;
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    frameCallback!(16);
    expect(playerState.value.x).toBe(xBeforeTick);
  });

  it('jKeyPressed-whileJournalOpen-closesJournalAndResumesLoop', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    fireEvent.keyDown(window, { code: 'KeyJ' });
    expect(lifecycleState.value.phase).toBe('paused');

    fireEvent.keyDown(window, { code: 'KeyJ' });

    expect(screen.queryByTestId('platformer-journal')).not.toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('playing');
  });

  it('jKeyHeld-osAutoRepeat-doesNotToggleJournalAgain', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };

    fireEvent.keyDown(window, { code: 'KeyJ' });
    expect(lifecycleState.value.phase).toBe('paused');

    // Simulates the OS auto-repeat keydowns fired while the key is held.
    fireEvent.keyDown(window, { code: 'KeyJ', repeat: true });

    expect(screen.getByTestId('platformer-journal')).toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('paused');
  });

  it('journalCloseButtonClicked-whileOpen-closesJournal', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    fireEvent.keyDown(window, { code: 'KeyJ' });

    fireEvent.click(screen.getByTestId('journal-close-button'));

    expect(screen.queryByTestId('platformer-journal')).not.toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('playing');
  });

  it('jKeyPressed-whileDying-isIgnored', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'dying' };

    fireEvent.keyDown(window, { code: 'KeyJ' });

    expect(screen.queryByTestId('platformer-journal')).not.toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('dying');
  });

  it('journalOpenButtonClicked-whilePlaying-opensJournalAndPausesLoop', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };

    fireEvent.click(screen.getByTestId('journal-open-button'));

    expect(screen.getByTestId('platformer-journal')).toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('paused');
  });

  it('journalOpenButtonClicked-whileJournalOpen-closesJournalAndResumesLoop', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    fireEvent.click(screen.getByTestId('journal-open-button'));
    expect(lifecycleState.value.phase).toBe('paused');

    fireEvent.click(screen.getByTestId('journal-open-button'));

    expect(screen.queryByTestId('platformer-journal')).not.toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('playing');
  });

  it('deathThenRestart-journalOpened-stillShowsSeedFactsFromBeforeTheDeath', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    const factsBeforeDeath = collectedFacts.value;
    expect(factsBeforeDeath.length).toBeGreaterThan(0);

    // Force a fatal pit fall (same setup as the existing
    // healthReachesZero-... test above), then let the death/restart timeline
    // fully play out.
    healthState.value = PIT_FALL_DAMAGE;
    playerState.value = { ...playerState.value, x: 500, y: 5000, vy: 900, grounded: false };
    frameCallback!(16);
    expect(lifecycleState.value.phase).toBe('dying');

    let t = 16;
    for (let i = 0; i < 250; i++) {
      t += 16;
      frameCallback!(t);
    }
    expect(lifecycleState.value.phase).toBe('awaitingRestart');

    fireEvent.keyDown(window, { code: 'Enter' });
    expect(collectedFacts.value).toBe(factsBeforeDeath);

    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    fireEvent.keyDown(window, { code: 'KeyJ' });

    expect(screen.queryByTestId('journal-empty-state')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('journal-fact-item')).toHaveLength(factsBeforeDeath.length);
  });

  it('spacePressedWhileJournalOpen-afterResume-doesNotTriggerJumpOnResumingTick', () => {
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

    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    fireEvent.keyDown(window, { code: 'KeyJ' }); // opens the journal, pauses the loop
    expect(lifecycleState.value.phase).toBe('paused');

    // A press that lands while the journal is open — this must not survive
    // to the tick after the journal closes.
    fireEvent.keyDown(window, { code: 'Space' });
    frameCallback!(32); // a paused tick, exercising the drain

    fireEvent.keyDown(window, { code: 'KeyJ' }); // closes the journal, resumes the loop
    expect(lifecycleState.value.phase).toBe('playing');

    frameCallback!(48); // the resuming tick

    expect(playerState.value.grounded).toBe(true);
    expect(playerState.value.vy).toBe(0);
    expect(playerState.value.animState).not.toBe('jump');
  });

  it('keyPressedWhilePlaying-doesNotTriggerRestart', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    frameCallback!(16);
    expect(lifecycleState.value.phase).not.toBe('awaitingRestart');

    fireEvent.keyDown(window, { code: 'Enter' });

    expect(healthState.value).toBe(MAX_HALF_HEARTS); // unchanged, no restart happened
  });

  it('debugQueryParamAbsent-render-doesNotShowKillOrRespawnButtons', () => {
    render(<PlatformerPage />);

    expect(screen.queryByRole('button', { name: 'Kill' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Respawn' })).not.toBeInTheDocument();
  });

  it('debugQueryParamPresent-render-showsKillAndRespawnButtons', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?debug=hitboxes'),
      writable: true,
      configurable: true,
    });

    render(<PlatformerPage />);

    expect(screen.getByRole('button', { name: 'Kill' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Respawn' })).toBeInTheDocument();
  });

  it('killButtonClicked-whilePlaying-setsHealthZeroAndEntersDyingPhase', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?debug=hitboxes'),
      writable: true,
      configurable: true,
    });
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    frameCallback!(16);

    fireEvent.click(screen.getByRole('button', { name: 'Kill' }));

    expect(healthState.value).toBe(0);
    expect(lifecycleState.value.phase).toBe('dying');
    expect(lifecycleState.value.centerX).toBe(playerState.value.x + PLAYER_RENDERED_SIZE / 2);
    expect(lifecycleState.value.centerY).toBe(playerState.value.y + PLAYER_VISUAL_CENTER_Y_OFFSET);
  });

  it('respawnButtonClicked-anyPhase-resetsHealthPositionAndEntersIntroAtSpawn', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?debug=hitboxes'),
      writable: true,
      configurable: true,
    });
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    frameCallback!(16);
    playerState.value = { ...playerState.value, x: 999, y: 999 };
    healthState.value = 0;

    fireEvent.click(screen.getByRole('button', { name: 'Respawn' }));

    expect(healthState.value).toBe(MAX_HALF_HEARTS);
    expect(lifecycleState.value.phase).toBe('intro');
    expect(playerState.value.x).toBe(initialPlayerState.x);
    expect(playerState.value.y).toBe(initialPlayerState.y);
    expect(cameraPositionX.value).toBe(0);
  });

  it('debugQueryParamPresent-render-showsHitboxesToggleButton', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?debug=hitboxes'),
      writable: true,
      configurable: true,
    });

    render(<PlatformerPage />);

    expect(screen.getByRole('button', { name: /Hitboxes/ })).toBeInTheDocument();
  });

  it('hitboxesToggleClicked-startingOnFromQueryParam-turnsOffAndStopsDrawingOverlay', async () => {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?debug=hitboxes'),
      writable: true,
      configurable: true,
    });
    vi.stubGlobal('Image', MockTilesetImage);
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as { strokeRect: ReturnType<typeof vi.fn> };
    await waitFor(() => expect(ctx.strokeRect).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Hitboxes/ }));
    ctx.strokeRect.mockClear();
    frameCallback!(16);

    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });

  it('hitboxesToggleClicked-startingOffWithOtherDebugParam-turnsOnAndDrawsOverlay', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?debug=1'),
      writable: true,
      configurable: true,
    });
    vi.stubGlobal('Image', MockTilesetImage);
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = canvas.getContext('2d') as unknown as { strokeRect: ReturnType<typeof vi.fn> };
    frameCallback!(0);
    expect(ctx.strokeRect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Hitboxes/ }));
    frameCallback!(16);

    expect(ctx.strokeRect).toHaveBeenCalled();
  });
});
