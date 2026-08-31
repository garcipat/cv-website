import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi } from 'vitest';
import { PlatformerPage } from './PlatformerPage';
import { platformerPage } from './PlatformerPage.page';
import { PLAYER_RENDERED_SIZE, PLAYER_VISUAL_CENTER_Y_OFFSET } from './entities/Player';
import { ENEMY_RENDERED_SIZE, toEnemyState } from './entities/Enemy';
import {
  playerState,
  cameraPositionX,
  cameraPositionY,
  healthState,
  lifecycleState,
  collectedFacts,
  activeJournalSection,
  collectiblePlacements,
  collectedCollectibleIds,
  activeEffects,
  enemyPlacements,
  enemyStates,
  blockPlacements,
  chestPlacements,
  chestStates,
  endingScreenShown,
  endingScreenOpen,
  controlsOverlayDismissed,
  signPlacements,
  hintTooltipState,
} from './PlatformerState';
import { toChestState } from './entities/Chest';
import {
  MAX_HALF_HEARTS,
  PIT_FALL_DAMAGE,
  SIDE_HIT_DAMAGE,
  HEART_RENDERED_SIZE,
} from './entities/Health';
import { HEARTS_START_X } from './engine/Renderer';
import { PHYSICS_CONFIG } from './engine/PhysicsConfig';
import { tileToPixel } from './level/Terrain';
import {
  JOURNAL_OPEN_FRAME_COUNT,
  JOURNAL_OPEN_FRAME_INTERVAL_MS,
} from './entities/JournalAnimation';

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
    cameraPositionY.value = 0;
    healthState.value = MAX_HALF_HEARTS;
    lifecycleState.value = initialLifecycleState;
    collectedFacts.value = initialCollectedFacts;
    // Module-level signal (see PlatformerState.ts) — must be reset the same
    // way collectedFacts is, or a bookmark tab selection made by one test
    // (via the rendered Journal) would leak into the next test's default.
    activeJournalSection.value = undefined;
    collectedCollectibleIds.value = new Set();
    // Not one of the two signals the brief called out explicitly, but a
    // module-level signal like the others — without a reset, a flight effect
    // started by one test (e.g. a collection) lingers into the next test's
    // render() since it's independent of collectedFacts/collectedCollectibleIds
    // and only clears itself via tickFlightEffect, which no render-only test
    // ever calls.
    activeEffects.value = [];
    // Module-level signal like the others above — a stomp/defeat mutation
    // from one test must not leak into the next test's enemy positions.
    enemyStates.value = enemyPlacements.value.map((p, i) => toEnemyState(p, i));
    // Module-level signal like the others above — an open-chest mutation
    // from one test must not leak into the next test's assumption that
    // every chest starts closed.
    chestStates.value = chestPlacements.value.map(toChestState);
    // Module-level one-shot latch (see PlatformerState.ts's doc comment) —
    // must be reset too, or a test that triggers the ending screen would
    // leave later tests unable to ever see it triggered again.
    endingScreenShown.value = false;
    // Module-level signal (see PlatformerState.ts's doc comment, final
    // review Important 4) — same reasoning as endingScreenShown above, so a
    // mounted-ThankYouScreen assumption doesn't leak between tests.
    endingScreenOpen.value = false;
    // Module-level one-shot latch (see PlatformerState.ts's doc comment) —
    // must be reset like endingScreenShown/endingScreenOpen above, or a
    // dismissal from one test would leak into the next test's assumption
    // that the overlay is still showable.
    controlsOverlayDismissed.value = false;
    // Module-level signal (see PlatformerState.ts) — must be reset
    // like the other module-level signals above, or a tooltip left mid-
    // animation by one test would leak into the next test's assumption that
    // no sign is currently revealed.
    hintTooltipState.value = null;
  });

  afterEach(() => {
    vi.useRealTimers();
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

    const canvas = platformerPage.canvas;
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

    const canvas = platformerPage.canvas;
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
    const ctx = platformerPage.context;

    await waitFor(() => expect(ctx.drawImage).toHaveBeenCalled());
  });

  it('render-afterTilesetLoads-drawsBlockPlacements', async () => {
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const ctx = platformerPage.context;

    await waitFor(() => {
      expect(blockPlacements.value.length).toBeGreaterThan(0);
      // The crate tile's known source coords (world_tileset.png at
      // 112,48 — see entities/Block.ts's blockFrameSource), drawn at the
      // block-sized 32x32 render size.
      expect(
        ctx.drawImage.mock.calls.some(
          (call: unknown[]) => call[1] === 112 && call[2] === 48 && call[7] === 32 && call[8] === 32,
        ),
      ).toBe(true);
    });
  });

  it('render-tallViewport-anchorsLevelBottomToCanvasBottom', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const ctx = platformerPage.context;

    await waitFor(() => expect(ctx.drawImage).toHaveBeenCalled());

    const bottomEdges = ctx.drawImage.mock.calls.map(
      (call: unknown[]) => (call[6] as number) + (call[8] as number), // dy + dh
    );
    expect(Math.max(...bottomEdges)).toBe(768);
  });

  it('render-afterPlayerSpriteLoads-drawsPlayerAtIdleSize', async () => {
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const ctx = platformerPage.context;

    await waitFor(() =>
      expect(
        ctx.drawImage.mock.calls.some((call: unknown[]) => call[7] === PLAYER_RENDERED_SIZE),
      ).toBe(true),
    );
  });

  it('render-afterHeartsSpriteLoads-drawsHeartHud', async () => {
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const ctx = platformerPage.context;

    // dx===HEARTS_START_X (call[5]) alone isn't enough to distinguish this
    // from the player's draw call: at this test's default spawn position
    // (SPAWN_TILE col 1, camera at 0, facing right) the player's dest-x
    // could coincidentally match too. dy===16 (call[6]) is what actually
    // discriminates: drawHearts always draws at dy=HUD_MARGIN=16
    // (Renderer.ts), while the player's dy is its scrolled world y-position
    // (648 by default here), never 16.
    await waitFor(() =>
      expect(
        ctx.drawImage.mock.calls.some(
          (call: unknown[]) =>
            call[7] === HEART_RENDERED_SIZE && call[5] === HEARTS_START_X && call[6] === 16,
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
    const ctx = platformerPage.context;

    await waitFor(() => expect(ctx.drawImage).toHaveBeenCalled());

    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it('debugHitboxesQueryParam-absent-doesNotDrawDebugOverlay', async () => {
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const ctx = platformerPage.context;

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
    const canvas = platformerPage.canvas;
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

  it('arrowUpPressed-whileGrounded-doesNotTriggerJump', () => {
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

    expect(playerState.value.grounded).toBe(true);
    expect(playerState.value.vy).toBe(0);
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

    // Place the character resting on currentLevel's ground-level bridge (row 6,
    // columns 2-3 — see level.ts; the ladder shaft at the top of the layout
    // shifts this down 2 rows) directly, rather than navigating there by
    // walking, since only the drop-through wiring is under test here (the
    // underlying physics is covered by Physics.test.ts).
    playerState.value = {
      ...playerState.value,
      x: 64,
      y: 136,
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
    const ctx = platformerPage.context;

    await waitFor(() => expect(ctx.drawImage).toHaveBeenCalled());

    // Every terrain/player draw call's dx (5th positional drawImage arg,
    // index 5) should be shifted left by exactly the camera offset relative
    // to what it'd be at cameraPositionX = 0 — cheapest check: originX is
    // -cameraPositionX, so no draw call should use a dx that's uncorrected
    // for a nonzero camera. Spot-check the first terrain tile (currentLevel's
    // top-left column is 'empty' until the platform/ground rows — assert on
    // any call instead of a fixed index to stay robust to currentLevel's layout).
    const anyShiftedCall = ctx.drawImage.mock.calls.some((call: unknown[]) => call[5] === -50);
    expect(anyShiftedCall).toBe(true);
  });

  it('playerFallsOntoGreenEnemy-tick-showsEnemyCounterPopupAtOne', async () => {
    // This trial per-collection counter popup (see activeCounterPopup's doc
    // comment in PlatformerState.ts) only exists once something's actually
    // been collected (nothing to assert "at zero" before that), so this test
    // goes straight to defeating an enemy and checking the popup shows
    // "1 / N".
    vi.stubGlobal('Image', MockTilesetImage);
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const ctx = platformerPage.context;
    const enemyTotal = enemyPlacements.value.length;

    // The popup's icon needs its sprite ref loaded (same reasoning the old
    // "showsCoinCounterAtZero" test's comment gave for drawCollectibleCounter)
    // — wait for sprites to finish loading (any drawImage call) before
    // defeating the enemy, or the popup would silently skip drawing (no
    // icon yet) regardless of whether the count logic itself is correct.
    await waitFor(() => expect(ctx.drawImage).toHaveBeenCalled());

    const target = enemyStates.value.find((e) => e.spriteType === 'slimeGreen')!;
    playerState.value = {
      ...playerState.value,
      x: target.x,
      y: target.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };

    // Green has 1 hit point — one full hit-reaction cycle (400ms) after the
    // stomp defeats it. GameLoop caps any single tick's dt at MAX_DT (1/30s),
    // so the 400ms reaction has to be paid off over enough real 16ms-spaced
    // frames, not one big jump (see the stomp-defeat tests above).
    let t = 16;
    frameCallback!(t);
    for (let i = 0; i < 30; i++) {
      t += 16;
      frameCallback!(t);
    }

    expect(ctx.fillText).toHaveBeenCalledWith(`1 / ${enemyTotal}`, expect.any(Number), expect.any(Number));
  });

  it('resetGame-afterDefeatingAnEnemy-collectedFactStaysBanked', async () => {
    // Facts persist across a respawn (FR-020c) even though the enemy itself
    // respawns alive. The counter popup is transient and will long since
    // have faded by the time a reset happens, so this asserts the underlying
    // data directly instead of the popup's visible count.
    vi.stubGlobal('Image', MockTilesetImage);
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = enemyStates.value.find((e) => e.spriteType === 'slimeGreen')!;
    playerState.value = {
      ...playerState.value,
      x: target.x,
      y: target.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };

    // Same 400ms-over-many-16ms-ticks pattern as the test above — green's
    // one hit point needs a full hit-reaction cycle to actually defeat it.
    let t = 16;
    frameCallback!(t);
    for (let i = 0; i < 30; i++) {
      t += 16;
      frameCallback!(t);
    }
    const defeatedEnemyFactCount = collectedFacts.value.filter((f) => f.sourceType === 'enemy').length;
    expect(defeatedEnemyFactCount).toBe(1);

    healthState.value = 0;
    t += 16;
    frameCallback!(t); // enters 'dying'
    for (let i = 0; i < 200; i++) {
      t += 16;
      frameCallback!(t);
    }
    fireEvent.keyDown(window, { code: 'Enter' });
    t += 16;
    frameCallback!(t);

    expect(collectedFacts.value.filter((f) => f.sourceType === 'enemy').length).toBe(1);
  });

  it('render-afterEnemySpritesLoad-drawsEnemiesAtEnemyRenderedSize', async () => {
    vi.stubGlobal('Image', MockTilesetImage);

    render(<PlatformerPage />);
    const canvas = screen.getByTestId('platformer-canvas');
    const ctx = (canvas as HTMLCanvasElement).getContext('2d') as unknown as {
      drawImage: ReturnType<typeof vi.fn>;
    };

    await waitFor(() =>
      expect(
        ctx.drawImage.mock.calls.some((call: unknown[]) => call[7] === ENEMY_RENDERED_SIZE),
      ).toBe(true),
    );
  });

  it('playerOverlapsACollectible-tick-marksItCollectedAndAddsFact', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = collectiblePlacements.value[0];
    playerState.value = { ...playerState.value, x: target.x, y: target.y };

    frameCallback!(16);

    expect(collectedCollectibleIds.value.has(target.id)).toBe(true);
    expect(collectedFacts.value.some((f) => f.id === target.id)).toBe(true);
  });

  it('playerOverlapsACollectible-tick-flightEffectCarriesAnIconSeparateFromText', () => {
    // The icon (a language's flag, or the section's generic symbol — 💡 for
    // skills) is drawn separately from the effect's text (see Renderer.ts:
    // the pixel font `text` uses has no emoji glyphs), so it must actually
    // reach the effect as its own field, not be missing or baked into
    // `text`.
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = collectiblePlacements.value.find((p) => p.spriteType === 'coin')!;
    playerState.value = { ...playerState.value, x: target.x, y: target.y };

    frameCallback!(16);

    const effect = activeEffects.value.find((e) => e.id === target.id);
    expect(effect?.icon).toBe('💡');
    expect(effect?.text).not.toContain('💡');
  });

  it('alreadyCollected-touchedAgainAfterRespawn-doesNotDuplicateFact', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);
    const target = collectiblePlacements.value[0];
    playerState.value = { ...playerState.value, x: target.x, y: target.y };
    frameCallback!(16);
    expect(collectedFacts.value).toHaveLength(1);

    // Simulate a respawn (per FR-020c, collected state survives it) and
    // touch the same spot again.
    healthState.value = 0;
    frameCallback!(32); // enters 'dying'
    // Fast-forward through dying+awaitingRestart, then restart.
    let t = 32;
    for (let i = 0; i < 200; i++) {
      t += 16;
      frameCallback!(t);
    }
    fireEvent.keyDown(window, { code: 'Enter' });
    playerState.value = { ...playerState.value, x: target.x, y: target.y };
    frameCallback!(t + 16);

    expect(collectedFacts.value).toHaveLength(1); // still just the one — no duplicate
  });

  it('playerFallsOntoGreenEnemy-tick-defeatsItImmediatelyAndAddsFact', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = enemyStates.value.find((e) => e.spriteType === 'slimeGreen')!;
    playerState.value = {
      ...playerState.value,
      x: target.x,
      y: target.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };

    // Green has 1 hit point — one full hit-reaction cycle (400ms) after the
    // stomp defeats it outright. GameLoop caps any single tick's dt at
    // MAX_DT (1/30s, ~33ms — see GameLoop.ts), so the 400ms reaction has to
    // be paid off over enough real 16ms-spaced frames, not one big jump.
    let t = 16;
    frameCallback!(t);
    for (let i = 0; i < 30; i++) {
      t += 16;
      frameCallback!(t);
    }

    expect(enemyStates.value.some((e) => e.id === target.id)).toBe(false);
    expect(collectedFacts.value.some((f) => f.id === target.id)).toBe(true);
  });

  it('playerFallsOntoAPlainEnemyWithNoFact-tick-defeatsItButAwardsNoFact', () => {
    // A "plain" enemy (EnemyMapper.ts's excess-marker case — enemies are not
    // capped at CVData's length) has no `fact` — stomping it must still
    // remove it like any other enemy, just without banking a fact or
    // bumping the enemy counter popup.
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const real = enemyStates.value.find((e) => e.spriteType === 'slimeGreen')!;
    // Offset well clear of `real`'s position — otherwise both enemies sit
    // exactly on top of each other and a single stomp defeats both,
    // muddying what this test is actually checking.
    const plain = toEnemyState(
      { ...real, id: 'enemy-plain-slimeGreen-test', x: real.x + 500, fact: undefined },
      0,
    );
    enemyStates.value = [...enemyStates.value, plain];
    const factsBefore = collectedFacts.value.length;

    playerState.value = {
      ...playerState.value,
      x: plain.x,
      y: plain.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };

    let t = 16;
    frameCallback!(t);
    for (let i = 0; i < 30; i++) {
      t += 16;
      frameCallback!(t);
    }

    expect(enemyStates.value.some((e) => e.id === plain.id)).toBe(false);
    expect(collectedFacts.value).toHaveLength(factsBefore);
  });

  it('playerFallsOntoGreenEnemy-tick-bouncesPlayerUpward', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = enemyStates.value.find((e) => e.spriteType === 'slimeGreen')!;
    playerState.value = {
      ...playerState.value,
      x: target.x,
      y: target.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };

    let t = 16;
    frameCallback!(t);

    // Not just "still ascending" (that passes even if the jump-cut
    // multiplier — 0.45 — has already chewed the bounce impulse down to
    // roughly 45% of its magnitude, which is what happens on this exact
    // frame if the jump key isn't held) — assert it's still close to its
    // full magnitude, whatever PHYSICS_CONFIG.stompBounceVelocity currently is.
    expect(playerState.value.vy).toBeLessThan(0);
    expect(playerState.value.vy).toBeLessThan(PHYSICS_CONFIG.stompBounceVelocity * 0.9);

    // The jump-cut multiplier must not re-apply EVERY tick the jump key
    // isn't held, only once — a single-tick-only suppression already passes
    // the assertion above but a repeated cut would still let the bounce
    // collapse almost immediately afterward. Tick several more frames
    // (still well within the ascent) and confirm `vy` is still decaying
    // smoothly under gravity alone, not additionally getting cut down each
    // frame.
    for (let i = 0; i < 5; i++) {
      t += 16;
      frameCallback!(t);
    }
    expect(playerState.value.vy).toBeLessThan(PHYSICS_CONFIG.stompBounceVelocity * 0.5);
  });

  it('alreadyDefeated-stompedAgainAfterRespawn-doesNotDuplicateFact', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = enemyStates.value.find((e) => e.spriteType === 'slimeGreen')!;
    const factId = target.id;
    playerState.value = {
      ...playerState.value,
      x: target.x,
      y: target.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };

    // Same defeat sequence as
    // playerFallsOntoGreenEnemy-tick-defeatsItImmediatelyAndAddsFact above:
    // green has 1 hit point, so one full 400ms hit-reaction cycle after the
    // stomp defeats it and banks its fact.
    let t = 16;
    frameCallback!(t);
    for (let i = 0; i < 30; i++) {
      t += 16;
      frameCallback!(t);
    }

    expect(collectedFacts.value.filter((f) => f.id === factId)).toHaveLength(1);

    // Simulate a death + respawn (per FR-020c, collected facts survive it,
    // but resetGame() revives all enemies from scratch, alive again) — same
    // sequence as alreadyCollected-touchedAgainAfterRespawn-doesNotDuplicateFact
    // above, but for an enemy stomp instead of a collectible touch.
    healthState.value = 0;
    t += 16;
    frameCallback!(t); // enters 'dying'
    for (let i = 0; i < 200; i++) {
      t += 16;
      frameCallback!(t);
    }
    fireEvent.keyDown(window, { code: 'Enter' });

    // Stomp the SAME (now-revived) enemy again.
    const revived = enemyStates.value.find((e) => e.id === factId)!;
    playerState.value = {
      ...playerState.value,
      x: revived.x,
      y: revived.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };
    t += 16;
    frameCallback!(t);
    for (let i = 0; i < 30; i++) {
      t += 16;
      frameCallback!(t);
    }

    expect(collectedFacts.value.filter((f) => f.id === factId)).toHaveLength(1);
  });

  it('playerFallsOntoPurpleEnemyTwice-firstStompSurvives-secondStompDefeatsIt', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = enemyStates.value.find((e) => e.spriteType === 'slimePurple')!;
    playerState.value = {
      ...playerState.value,
      x: target.x,
      y: target.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };

    // First stomp: plays out its full hit reaction, still alive afterward.
    let t = 16;
    frameCallback!(t);
    for (let i = 0; i < 30; i++) {
      t += 16;
      frameCallback!(t);
    }
    expect(enemyStates.value.some((e) => e.id === target.id)).toBe(true);
    expect(collectedFacts.value.some((f) => f.id === target.id)).toBe(false);

    // Re-position for a second stomp (the enemy patrolled away during the
    // reaction window above — put the player back on top of its current
    // spot). Registers as a genuine second stomp since it still has 1 hit
    // point left: `checkEnemyStompCollisions` only excludes an enemy once
    // `hitPoints` reaches 0 — no cooldown/landing tracking needed, since
    // this engine has no double-jump.
    const stillAlive = enemyStates.value.find((e) => e.id === target.id)!;
    playerState.value = {
      ...playerState.value,
      x: stillAlive.x,
      y: stillAlive.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };
    t += 16;
    frameCallback!(t);
    for (let i = 0; i < 30; i++) {
      t += 16;
      frameCallback!(t);
    }

    expect(enemyStates.value.some((e) => e.id === target.id)).toBe(false);
    expect(collectedFacts.value.some((f) => f.id === target.id)).toBe(true);
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

    const canvas = platformerPage.canvas;
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

    expect(platformerPage.journal.root).toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('paused');

    const xBeforeTick = playerState.value.x;
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    frameCallback!(16);
    expect(playerState.value.x).toBe(xBeforeTick);
  });

  it('jKeyPressed-whileJournalOpen-closesJournalAndResumesLoop', () => {
    vi.useFakeTimers();
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

    // A second `J` press (fired immediately, before the opening animation
    // has even finished) requests a close — Journal.tsx only starts its
    // reverse-close once it actually reaches the fully-open frame, then
    // plays all the way back down before unmounting. Advance enough
    // intervals to cover both the remaining open animation and the full
    // close animation.
    for (let i = 0; i < JOURNAL_OPEN_FRAME_COUNT * 2; i++) {
      act(() => {
        vi.advanceTimersByTime(JOURNAL_OPEN_FRAME_INTERVAL_MS);
      });
    }

    expect(platformerPage.journal.root).not.toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('playing');

    vi.useRealTimers();
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

    expect(platformerPage.journal.root).toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('paused');
  });

  it('journalCloseButtonClicked-whileOpen-closesJournal', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    fireEvent.keyDown(window, { code: 'KeyJ' });

    // Journal.tsx plays its book-opening animation before the close button
    // renders, and its reverse-close animation before actually closing —
    // both are one setTimeout per frame (re-scheduled by an effect each
    // time the frame advances), so the clock must be advanced one interval
    // at a time rather than in one bulk jump.
    for (let i = 0; i < JOURNAL_OPEN_FRAME_COUNT; i++) {
      act(() => {
        vi.advanceTimersByTime(JOURNAL_OPEN_FRAME_INTERVAL_MS);
      });
    }

    fireEvent.click(platformerPage.journal.closeButton);

    for (let i = 0; i < JOURNAL_OPEN_FRAME_COUNT; i++) {
      act(() => {
        vi.advanceTimersByTime(JOURNAL_OPEN_FRAME_INTERVAL_MS);
      });
    }

    expect(platformerPage.journal.root).not.toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('playing');

    vi.useRealTimers();
  });

  it('journalResetGameButtonClicked-whileOpen-clearsProgressClosesJournalImmediatelyAndEntersIntro', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    fireEvent.keyDown(window, { code: 'KeyJ' });

    // The Reset Game button only renders once the book-opening animation
    // finishes — get there first, same as every other journal-content test.
    for (let i = 0; i < JOURNAL_OPEN_FRAME_COUNT; i++) {
      act(() => {
        vi.advanceTimersByTime(JOURNAL_OPEN_FRAME_INTERVAL_MS);
      });
    }

    collectedFacts.value = [
      {
        id: 'coin-frontend',
        sectionId: 'skills',
        sectionLabel: 'Skills',
        data: { category: 'Frontend', skills: [{ name: 'React', level: 80 }] },
        sourceType: 'coin',
      },
    ];
    collectedCollectibleIds.value = new Set(['coin-frontend']);
    playerState.value = { ...playerState.value, x: 999, y: 999 };
    healthState.value = 0;
    cameraPositionX.value = 300;

    fireEvent.click(platformerPage.journal.resetButton);

    expect(platformerPage.journal.root).not.toBeInTheDocument();
    expect(collectedFacts.value).toEqual([]);
    expect(collectedCollectibleIds.value.size).toBe(0);
    expect(healthState.value).toBe(MAX_HALF_HEARTS);
    expect(lifecycleState.value.phase).toBe('intro');
    expect(playerState.value.x).toBe(initialPlayerState.x);
    expect(playerState.value.y).toBe(initialPlayerState.y);
    expect(cameraPositionX.value).toBe(0);

    vi.useRealTimers();
  });

  it('jKeyPressed-whileDying-isIgnored', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'dying' };

    fireEvent.keyDown(window, { code: 'KeyJ' });

    expect(platformerPage.journal.root).not.toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('dying');
  });

  it('render-default-showsRealJournalIconAtTopLeft', () => {
    render(<PlatformerPage />);

    const icon = platformerPage.journalOpenButton;
    expect(icon.tagName).toBe('IMG');
    expect(icon).toHaveAttribute('src', '/sprites/journal.png');
  });

  it('journalOpenButtonClicked-whilePlaying-opensJournalAndPausesLoop', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };

    fireEvent.click(platformerPage.journalOpenButton);

    expect(platformerPage.journal.root).toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('paused');
  });

  it('journalOpenButtonClicked-whileJournalOpen-closesJournalAndResumesLoop', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    fireEvent.click(platformerPage.journalOpenButton);
    expect(lifecycleState.value.phase).toBe('paused');

    fireEvent.click(platformerPage.journalOpenButton);

    // Same reverse-close animation as the in-book × button — advance
    // enough intervals to cover both the remaining open animation and the
    // full close animation (the second click can land before the opening
    // animation has finished).
    for (let i = 0; i < JOURNAL_OPEN_FRAME_COUNT * 2; i++) {
      act(() => {
        vi.advanceTimersByTime(JOURNAL_OPEN_FRAME_INTERVAL_MS);
      });
    }

    expect(platformerPage.journal.root).not.toBeInTheDocument();
    expect(lifecycleState.value.phase).toBe('playing');

    vi.useRealTimers();
  });

  it('deathThenRestart-journalOpened-stillShowsFactsCollectedBeforeTheDeath', () => {
    vi.useFakeTimers();
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    // Collect a real fact (per FR-020c, collected state survives a death) so
    // there's something in the journal to persist across the restart below —
    // collectedFacts starts empty; only real coin/fruit collection populates
    // it.
    const target = collectiblePlacements.value[0];
    playerState.value = { ...playerState.value, x: target.x, y: target.y };
    frameCallback!(16);
    const factsBeforeDeath = collectedFacts.value;
    expect(factsBeforeDeath.length).toBeGreaterThan(0);

    // Force a fatal pit fall (same setup as the existing
    // healthReachesZero-... test above), then let the death/restart timeline
    // fully play out.
    healthState.value = PIT_FALL_DAMAGE;
    playerState.value = { ...playerState.value, x: 500, y: 5000, vy: 900, grounded: false };
    frameCallback!(32);
    expect(lifecycleState.value.phase).toBe('dying');

    let t = 32;
    for (let i = 0; i < 250; i++) {
      t += 16;
      frameCallback!(t);
    }
    expect(lifecycleState.value.phase).toBe('awaitingRestart');

    fireEvent.keyDown(window, { code: 'Enter' });
    expect(collectedFacts.value).toBe(factsBeforeDeath);

    lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    fireEvent.keyDown(window, { code: 'KeyJ' });

    // The journal plays its book-opening animation before showing content —
    // advance past it before asserting on fact items. Journal.tsx schedules
    // one setTimeout per frame (re-created by an
    // effect each time the frame advances), so the clock must be advanced
    // one interval at a time (each in its own act()) rather than in one
    // bulk jump — otherwise later timeouts haven't been scheduled yet by
    // the time the fake clock reaches them.
    for (let i = 0; i < JOURNAL_OPEN_FRAME_COUNT; i++) {
      act(() => {
        vi.advanceTimersByTime(JOURNAL_OPEN_FRAME_INTERVAL_MS);
      });
    }

    // The journal shows one section at a time, defaulting to 'personality'
    // regardless of what's collected — switch to the first collected fact's
    // own section bookmark before comparing against that section's facts,
    // rather than the full flat list.
    const defaultSectionFacts = factsBeforeDeath.filter(
      (fact) => fact.sectionId === factsBeforeDeath[0].sectionId,
    );
    fireEvent.click(
      screen.getByTestId(`bookmark-tab-${factsBeforeDeath[0].sectionId}`),
    );
    expect(platformerPage.journal.emptyState).not.toBeInTheDocument();
    expect(platformerPage.journal.factItems).toHaveLength(defaultSectionFacts.length);

    vi.useRealTimers();
  });

  it('spacePressedWhileJournalOpen-afterResume-doesNotTriggerJumpOnResumingTick', () => {
    vi.useFakeTimers();
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

    fireEvent.keyDown(window, { code: 'KeyJ' }); // requests the journal close

    // Journal.tsx plays its reverse-close animation before actually
    // resuming the game — advance past it (covers both the remaining open
    // animation and the full close animation).
    for (let i = 0; i < JOURNAL_OPEN_FRAME_COUNT * 2; i++) {
      act(() => {
        vi.advanceTimersByTime(JOURNAL_OPEN_FRAME_INTERVAL_MS);
      });
    }
    expect(lifecycleState.value.phase).toBe('playing');

    frameCallback!(48); // the resuming tick

    expect(playerState.value.grounded).toBe(true);
    expect(playerState.value.vy).toBe(0);
    expect(playerState.value.animState).not.toBe('jump');

    vi.useRealTimers();
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

    expect(platformerPage.queryDebugKillButton).not.toBeInTheDocument();
    expect(platformerPage.queryDebugRespawnButton).not.toBeInTheDocument();
  });

  it('debugQueryParamPresent-render-showsKillAndRespawnButtons', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?debug=hitboxes'),
      writable: true,
      configurable: true,
    });

    render(<PlatformerPage />);

    expect(platformerPage.debugKillButton).toBeInTheDocument();
    expect(platformerPage.debugRespawnButton).toBeInTheDocument();
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

    fireEvent.click(platformerPage.debugKillButton);

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

    fireEvent.click(platformerPage.debugRespawnButton);

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

    expect(platformerPage.debugHitboxesToggle).toBeInTheDocument();
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
    const ctx = platformerPage.context;
    await waitFor(() => expect(ctx.strokeRect).toHaveBeenCalled());

    fireEvent.click(platformerPage.debugHitboxesToggle);
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
    const ctx = platformerPage.context;
    frameCallback!(0);
    expect(ctx.strokeRect).not.toHaveBeenCalled();

    fireEvent.click(platformerPage.debugHitboxesToggle);
    frameCallback!(16);

    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it('playerTouchesEnemyFromTheSide-tick-losesAHalfHeartAndGetsKnockedBack', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = enemyStates.value.find((e) => e.spriteType === 'slimeGreen')!;
    const startingHealth = healthState.value;
    playerState.value = {
      ...playerState.value,
      x: target.x,
      y: target.y,
      vx: 0,
      vy: 0,
    };

    frameCallback!(16);

    expect(healthState.value).toBe(startingHealth - SIDE_HIT_DAMAGE);
    expect(playerState.value.vx).not.toBe(0);
    expect(playerState.value.invincibleTimer).toBeGreaterThan(0);
  });

  it('playerTouchesEnemyFromTheSide-tick-knockbackPushesAwayFromTheEnemy', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = enemyStates.value.find((e) => e.spriteType === 'slimeGreen')!;
    // Positioned at the SAME x as the enemy (a tie) so the direction is
    // deterministic per the game loop's `<=` tie-break (push left) — see
    // the implementation step below.
    playerState.value = {
      ...playerState.value,
      x: target.x,
      y: target.y,
      vx: 0,
      vy: 0,
    };

    frameCallback!(16);

    expect(playerState.value.vx).toBeLessThan(0);
  });

  it('playerInvincible-touchesAnotherEnemy-noSecondHitRegistered', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = enemyStates.value.find((e) => e.spriteType === 'slimeGreen')!;
    playerState.value = { ...playerState.value, x: target.x, y: target.y, vx: 0, vy: 0 };
    frameCallback!(16);
    const healthAfterFirstHit = healthState.value;
    expect(playerState.value.invincibleTimer).toBeGreaterThan(0);

    // Still overlapping the same enemy on the very next tick — must not hit again.
    frameCallback!(32);

    expect(healthState.value).toBe(healthAfterFirstHit);
  });

  it('playerFallsOntoEnemyFromAbove-tick-noSideHitDamageOnlyAStomp', () => {
    // Regression guard: a stomp must never also register as a side hit on
    // the same tick (the two collision checks are meant to be mutually
    // exclusive for the same overlap).
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = enemyStates.value.find((e) => e.spriteType === 'slimeGreen')!;
    const startingHealth = healthState.value;
    playerState.value = {
      ...playerState.value,
      x: target.x,
      y: target.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };

    frameCallback!(16);

    expect(healthState.value).toBe(startingHealth);
    expect(playerState.value.invincibleTimer).toBe(0);
  });

  it('playerStompsEnemy-ticksThroughTheWholeBounceArc-neverTakesSideHitDamage', () => {
    // The same-tick stompedIds filter (see the test above) only protects the
    // exact tick a stomp registers. On every LATER tick, while the player is
    // still rising off the bounce (vy < 0) and still overlapping the
    // now-frozen, mid-'hit' enemy, checkEnemySideCollisions must not register
    // a fresh, unwanted side-hit against the very enemy just stomped — any
    // `animState === 'hit'` enemy is excluded from side-hit detection
    // entirely (matching stomp detection's own exclusion) rather than
    // relying on velocity/geometry alone. This ticks through several frames
    // of the bounce arc (well past the single tick the older test covered)
    // and asserts health never drops and invincibility is never granted from
    // this encounter.
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = enemyStates.value.find((e) => e.spriteType === 'slimeGreen')!;
    const startingHealth = healthState.value;
    playerState.value = {
      ...playerState.value,
      x: target.x,
      y: target.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };

    let t = 16;
    frameCallback!(t);
    for (let i = 0; i < 20; i++) {
      t += 16;
      frameCallback!(t);
      expect(healthState.value).toBe(startingHealth);
      expect(playerState.value.invincibleTimer).toBe(0);
    }
  });

  it('playerLandsAndRestompsPurpleEnemyWhileStillMidReaction-registersAsAGenuineSecondStomp', () => {
    // Chain-stomping: a second stomp against the SAME enemy only needs it to
    // still have hit points left — no cooldown, no landing, no waiting for
    // the ~0.4s hit reaction to finish, so a player who bounces upward off a
    // stomp and falls back onto the same enemy can stomp it again on the way
    // down. Re-stomps almost
    // immediately (well before the first reaction would have ended),
    // entirely airborne (this engine has no double-jump, so re-landing on
    // the same enemy while still airborne can only mean the same bounce's
    // own descent — and that's exactly the desired chain-stomp), and still
    // expects the enemy defeated.
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = enemyStates.value.find((e) => e.spriteType === 'slimePurple')!;
    playerState.value = {
      ...playerState.value,
      x: target.x,
      y: target.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };

    let t = 16;
    frameCallback!(t); // first stomp: hitPoints 3 -> 2, animState 'hit'

    const midReaction = enemyStates.value.find((e) => e.id === target.id)!;
    expect(midReaction.animState).toBe('hit');
    expect(midReaction.hitPoints).toBe(2);

    // Land on it again immediately — still well within the ~0.4s reaction
    // window (this same tick), entirely airborne, no landing/separation of
    // any kind in between.
    playerState.value = {
      ...playerState.value,
      x: midReaction.x,
      y: midReaction.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };
    t += 16;
    frameCallback!(t); // second stomp lands mid-reaction: hitPoints 2 -> 1

    const afterSecondStomp = enemyStates.value.find((e) => e.id === target.id)!;
    expect(afterSecondStomp.animState).toBe('hit');
    expect(afterSecondStomp.hitPoints).toBe(1);

    // Land on it a third time — to finally defeat the purple slime
    playerState.value = {
      ...playerState.value,
      x: afterSecondStomp.x,
      y: afterSecondStomp.y - PLAYER_RENDERED_SIZE / 2,
      vy: 300,
    };
    t += 16;
    frameCallback!(t); // third stomp lands mid-reaction: hitPoints 1 -> 0

    const stillMidReaction = enemyStates.value.find((e) => e.id === target.id)!;
    expect(stillMidReaction.animState).toBe('hit'); // reaction hasn't finished yet

    for (let i = 0; i < 30; i++) {
      t += 16;
      frameCallback!(t);
    }

    expect(enemyStates.value.some((e) => e.id === target.id)).toBe(false);
    expect(collectedFacts.value.some((f) => f.id === target.id)).toBe(true);
  });

  it('playerFallsIntoPit-tick-losesHalfHeartAndBecomesInvincible', () => {
    // A pit fall ALSO grants invincibility — invincibility is a property of
    // taking damage generally, not just of enemy contact — while still
    // costing the same half-heart as any other pit fall (PIT_FALL_DAMAGE).
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const startingHealth = healthState.value;
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

    expect(healthState.value).toBe(startingHealth - PIT_FALL_DAMAGE);
    expect(playerState.value.invincibleTimer).toBeGreaterThan(0);
  });

  it('playerAlreadyInvincibleFromASideHit-fallsIntoPit-noAdditionalDamageButStillRepositioned', () => {
    // The position-recovery half of a pit fall (resolvePitFall) must still
    // happen even while invincible — only the heart loss is skipped. A
    // player stuck mid-air with invincibleTimer > 0 must not keep falling
    // forever just because a hit protected them a moment ago.
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = enemyStates.value.find((e) => e.spriteType === 'slimeGreen')!;
    playerState.value = { ...playerState.value, x: target.x, y: target.y, vx: 0, vy: 0 };
    frameCallback!(16); // side-hit: now invincible
    const healthAfterSideHit = healthState.value;
    expect(playerState.value.invincibleTimer).toBeGreaterThan(0);

    playerState.value = {
      ...playerState.value,
      x: 500,
      y: 5000,
      vy: 900,
      grounded: false,
      lastGroundedX: 500,
      lastGroundedY: 200,
    };
    frameCallback!(32);

    expect(healthState.value).toBe(healthAfterSideHit); // no additional damage
    expect(playerState.value.y).toBeLessThan(5000); // still repositioned to safety
  });

  it('arrowUpPressed-whileStandingOnClosedChest-opensItAndRevealsExperienceFact', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = chestPlacements.value[0];
    playerState.value = { ...playerState.value, x: target.x, y: target.y };
    fireEvent.keyDown(window, { code: 'ArrowUp' });
    frameCallback!(16);

    expect(chestStates.value.find((c) => c.id === target.id)?.state).toBe('open');
    expect(collectedFacts.value.some((f) => f.id === target.id)).toBe(true);
  });

  it('keyWPressed-whileStandingOnClosedChest-opensItAndRevealsExperienceFact', () => {
    // KeyW is an accepted alternate for ArrowUp's interact action, same
    // convention as A/D being alternates for Left/Right (see FR-007), so
    // opening a chest must work with it too.
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = chestPlacements.value[0];
    playerState.value = { ...playerState.value, x: target.x, y: target.y };
    fireEvent.keyDown(window, { code: 'KeyW' });
    frameCallback!(16);

    expect(chestStates.value.find((c) => c.id === target.id)?.state).toBe('open');
    expect(collectedFacts.value.some((f) => f.id === target.id)).toBe(true);
  });

  it('walkingOverClosedChest-withoutPressingArrowUp-leavesItClosed', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    const target = chestPlacements.value[0];
    playerState.value = { ...playerState.value, x: target.x, y: target.y };
    frameCallback!(16);

    expect(chestStates.value.find((c) => c.id === target.id)?.state).toBe('closed');
    expect(collectedFacts.value).toHaveLength(0);
  });

  it('openingEveryChest-showsThankYouScreen-pausingTheGame', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    for (const target of chestPlacements.value) {
      playerState.value = { ...playerState.value, x: target.x, y: target.y };
      fireEvent.keyDown(window, { code: 'ArrowUp' });
      // Opening the last chest flips React state (setEndingScreenOpen),
      // unlike every other per-tick signal-only assertion elsewhere in this
      // file — wrapped in act() (same convention the journal-animation
      // tests above already use) so that DOM update is flushed before the
      // getByTestId assertion below runs.
      act(() => frameCallback!(16));
      fireEvent.keyUp(window, { code: 'ArrowUp' });
    }

    expect(lifecycleState.value.phase).toBe('ending-screen');
    expect(screen.getByTestId('platformer-thank-you-screen')).toBeInTheDocument();
  });

  it('dismissingThankYouScreen-resumesPlayingFromSamePosition', () => {
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    for (const target of chestPlacements.value) {
      playerState.value = { ...playerState.value, x: target.x, y: target.y };
      fireEvent.keyDown(window, { code: 'ArrowUp' });
      // Opening the last chest flips React state (setEndingScreenOpen),
      // unlike every other per-tick signal-only assertion elsewhere in this
      // file — wrapped in act() (same convention the journal-animation
      // tests above already use) so that DOM update is flushed before the
      // getByTestId assertion below runs.
      act(() => frameCallback!(16));
      fireEvent.keyUp(window, { code: 'ArrowUp' });
    }
    const positionBeforeDismiss = { x: playerState.value.x, y: playerState.value.y };

    fireEvent.keyDown(window, { code: 'Space' });

    expect(lifecycleState.value.phase).toBe('playing');
    expect(screen.queryByTestId('platformer-thank-you-screen')).not.toBeInTheDocument();
    expect(playerState.value.x).toBe(positionBeforeDismiss.x);
    expect(playerState.value.y).toBe(positionBeforeDismiss.y);

    // Regression coverage: every chest is still open at this point (opening
    // is permanent — see entities/Chest.ts's openChest), so without a
    // one-shot latch the very next tick's "all chests open" check would
    // immediately re-trigger showEndingScreen/setEndingScreenOpen(true),
    // reopening the screen the instant it's dismissed and permanently
    // locking the player out. Ticking again and re-asserting both the phase
    // and the screen's continued absence is what actually proves dismissal
    // sticks, rather than merely proving it took effect once.
    act(() => frameCallback!(32));

    expect(lifecycleState.value.phase).toBe('playing');
    expect(screen.queryByTestId('platformer-thank-you-screen')).not.toBeInTheDocument();
  });

  it('dismissingThankYouScreenViaSpace-doesNotTriggerJumpOnNextTick', () => {
    // Regression coverage: the same physical Space keydown that dismisses
    // the screen is ALSO seen by createKeyboardInput's own listener and
    // buffered as a pending press. handleDismissEndingScreen flips gamePhase
    // to 'playing' synchronously, so without draining that buffered press
    // (see PlatformerPage.tsx's handleDismissEndingScreen, which now calls
    // inputRef.current?.clearPending()), the very next tick would already
    // skip the 'ending-screen' phase's own input.clearPending() early-return
    // and consume the buffered Space as a real jump.
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    render(<PlatformerPage />);
    frameCallback!(0);

    for (const target of chestPlacements.value) {
      playerState.value = { ...playerState.value, x: target.x, y: target.y };
      fireEvent.keyDown(window, { code: 'ArrowUp' });
      act(() => frameCallback!(16));
      fireEvent.keyUp(window, { code: 'ArrowUp' });
    }

    // Force grounded (with zero vy) right before dismissal so a jump WOULD
    // fire on the very next tick if the buffered Space leaks through.
    playerState.value = { ...playerState.value, grounded: true, vy: 0 };

    fireEvent.keyDown(window, { code: 'Space' });
    act(() => frameCallback!(16));

    expect(playerState.value.vy).not.toBe(PHYSICS_CONFIG.jumpVelocity);
    expect(playerState.value.vy).toBeGreaterThanOrEqual(0);
  });

  it('unmountingAndRemountingWhileEndingScreenShowing-stillShowsItAndStaysRecoverable', () => {
    // Simulates switching away from the Platformer theme (unmounting this
    // component) and back (remounting it) while the Thank You screen is
    // showing — theme-switch reset isn't implemented yet, so every
    // module-level signal (lifecycleState, chestStates, endingScreenShown,
    // endingScreenOpen) must survive that round-trip unchanged.
    // `endingScreenOpen` is module-level, not component-local useState, for
    // exactly this reason: a component-local flag would reset to false on
    // remount even though lifecycleState stayed 'ending-screen' —
    // <ThankYouScreen> would never render, with no way to dismiss and no way
    // for the "all chests open" check to ever re-fire either (blocked by the
    // still-true endingScreenShown latch), permanently freezing the game. A
    // remount must still show the screen, and dismissing it must still
    // resume play.
    let frameCallback: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frameCallback = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { unmount } = render(<PlatformerPage />);
    frameCallback!(0);

    for (const target of chestPlacements.value) {
      playerState.value = { ...playerState.value, x: target.x, y: target.y };
      fireEvent.keyDown(window, { code: 'ArrowUp' });
      act(() => frameCallback!(16));
      fireEvent.keyUp(window, { code: 'ArrowUp' });
    }

    expect(lifecycleState.value.phase).toBe('ending-screen');
    expect(endingScreenOpen.value).toBe(true);

    // Simulate a theme switch away and back: unmount, then mount a fresh
    // instance (a brand-new component tree, same module-level signals).
    unmount();
    frameCallback = null;
    render(<PlatformerPage />);
    frameCallback!(0);

    // The screen must still be showing immediately after remount — no
    // player action re-triggered it, the module-level state simply
    // persisted through the unmount/remount.
    expect(lifecycleState.value.phase).toBe('ending-screen');
    expect(screen.getByTestId('platformer-thank-you-screen')).toBeInTheDocument();

    // And it must still be genuinely dismissible/recoverable — not frozen.
    fireEvent.keyDown(window, { code: 'Space' });
    act(() => frameCallback!(16));

    expect(lifecycleState.value.phase).toBe('playing');
    expect(screen.queryByTestId('platformer-thank-you-screen')).not.toBeInTheDocument();
  });

  it('render-lifecyclePlaying-showsControlsOverlay', () => {
    render(<PlatformerPage />);
    act(() => {
      lifecycleState.value = { ...lifecycleState.value, phase: 'playing' };
    });

    expect(platformerPage.controlsOverlay).toBeInTheDocument();
  });

  describe('PlatformerPage — ladder climbing', () => {
    it('playerOnLadderColumn-arrowUpHeld-startsClimbingAndStopsFalling', () => {
      let frameCallback: FrameRequestCallback | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        frameCallback = cb;
        return 1;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      render(<PlatformerPage />);

      // Position the character directly on the new ladder shaft (col 15,
      // in the shaft's middle — see level.ts).
      const ladderCol = 15;
      const ladderRow = 1;
      const { x, y } = tileToPixel(ladderCol, ladderRow);
      playerState.value = { ...playerState.value, x, y, vy: 50, grounded: false, climbing: false };

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' }));
      frameCallback!(0);
      frameCallback!(16);

      expect(playerState.value.climbing).toBe(true);
      expect(playerState.value.vy).toBeLessThan(0); // moving upward, not falling
    });
  });

  describe('PlatformerPage — hint signs', () => {
    it('render-tilesetLoaded-drawsSignpostAtItsPosition', async () => {
      // jsdom's real Image never fires onload, so tilesetRef.current would
      // otherwise stay null forever — same stub every other "waits for the
      // tileset to actually load" test above already uses.
      vi.stubGlobal('Image', MockTilesetImage);

      render(<PlatformerPage />);

      const ctx = platformerPage.context;
      const sign = signPlacements.value[0];
      await waitFor(() =>
        expect(ctx.drawImage).toHaveBeenCalledWith(
          expect.anything(),
          128,
          48,
          16,
          16,
          expect.any(Number),
          expect.any(Number),
          32,
          32,
        ),
      );
      // Sanity: the level actually has the one bridge sign this test expects.
      expect(sign.hintId).toBe('bridgeDropThrough');
    });

    it('overlappingSignWithoutPressingUp-neverStartsTheTooltip', () => {
      let frameCallback: FrameRequestCallback | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        frameCallback = cb;
        return 1;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      render(<PlatformerPage />);
      const sign = signPlacements.value[0];
      playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
      frameCallback!(0);
      frameCallback!(16);

      expect(hintTooltipState.value).toBeNull();
    });

    it('arrowUpPressed-whileOverlappingSign-startsEnteringAndEventuallyDrawsBubbleText', () => {
      let frameCallback: FrameRequestCallback | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        frameCallback = cb;
        return 1;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      render(<PlatformerPage />);
      const sign = signPlacements.value[0];
      playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
      fireEvent.keyDown(window, { code: 'ArrowUp' });
      frameCallback!(0);
      frameCallback!(16); // one ~16ms tick: starts 'entering'

      expect(hintTooltipState.value?.hintId).toBe('bridgeDropThrough');
      expect(hintTooltipState.value?.phase).toBe('entering');

      // Advance well past HINT_TOOLTIP_FADE_IN_SECONDS (0.2s) — several more
      // 16ms ticks — so it settles into 'shown' and the text actually paints.
      for (let t = 32; t <= 320; t += 16) frameCallback!(t);

      expect(hintTooltipState.value?.phase).toBe('shown');
      const ctx = platformerPage.context;
      expect(ctx.fillText).toHaveBeenCalledWith(
        'Hold Down to drop through a bridge.',
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('keyWPressed-whileOverlappingSign-alsoRevealsTheBubble', () => {
      // KeyW is an accepted alternate for ArrowUp's interact action (same
      // convention chest-opening already uses).
      let frameCallback: FrameRequestCallback | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        frameCallback = cb;
        return 1;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      render(<PlatformerPage />);
      const sign = signPlacements.value[0];
      playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
      fireEvent.keyDown(window, { code: 'KeyW' });
      frameCallback!(0);
      frameCallback!(16);

      expect(hintTooltipState.value?.hintId).toBe('bridgeDropThrough');
    });

    it('playerWalksAwayAfterRevealing-gameLoopTicks-entersExitingThenClearsToNull', () => {
      let frameCallback: FrameRequestCallback | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        frameCallback = cb;
        return 1;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      render(<PlatformerPage />);
      const sign = signPlacements.value[0];
      playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
      fireEvent.keyDown(window, { code: 'ArrowUp' });
      let t = 0;
      frameCallback!(t);
      for (let i = 0; i < 20; i++) {
        t += 16;
        frameCallback!(t);
      }
      expect(hintTooltipState.value?.phase).toBe('shown');

      playerState.value = { ...playerState.value, x: sign.x + 2000, y: sign.y };
      t += 16;
      frameCallback!(t);
      expect(hintTooltipState.value?.phase).toBe('exiting');

      // Advance well past HINT_TOOLTIP_FADE_OUT_SECONDS (0.25s).
      for (let i = 0; i < 20; i++) {
        t += 16;
        frameCallback!(t);
      }

      expect(hintTooltipState.value).toBeNull();
    });

    it('arrowUpPressedAgainWhileMidExit-restartsTheEntranceInsteadOfStayingStuckExiting', () => {
      let frameCallback: FrameRequestCallback | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        frameCallback = cb;
        return 1;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      render(<PlatformerPage />);
      const sign = signPlacements.value[0];
      playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
      fireEvent.keyDown(window, { code: 'ArrowUp' });
      let t = 0;
      frameCallback!(t);
      for (let i = 0; i < 20; i++) {
        t += 16;
        frameCallback!(t);
      }
      expect(hintTooltipState.value?.phase).toBe('shown');

      // Walk away and tick exactly once — just enough to enter 'exiting',
      // deliberately NOT enough to let it finish (HINT_TOOLTIP_FADE_OUT_SECONDS
      // is 0.25s, far more than one 16ms tick), so it's caught mid-exit.
      playerState.value = { ...playerState.value, x: sign.x + 2000, y: sign.y };
      t += 16;
      frameCallback!(t);
      expect(hintTooltipState.value?.phase).toBe('exiting');

      // Walk back onto the sign and press Up again before the exit finishes.
      playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
      fireEvent.keyDown(window, { code: 'ArrowUp' });
      t += 16;
      frameCallback!(t);

      expect(hintTooltipState.value?.hintId).toBe('bridgeDropThrough');
      expect(hintTooltipState.value?.phase).toBe('entering');
    });

    it('playerWalksAwayWithoutEverPressingUp-staysNull', () => {
      let frameCallback: FrameRequestCallback | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        frameCallback = cb;
        return 1;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      render(<PlatformerPage />);
      const sign = signPlacements.value[0];
      playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
      frameCallback!(0);
      frameCallback!(16);
      expect(hintTooltipState.value).toBeNull();

      playerState.value = { ...playerState.value, x: sign.x + 2000, y: sign.y };
      frameCallback!(32);

      expect(hintTooltipState.value).toBeNull();
    });

    it('playerDiesWhileTooltipShown-clearsImmediatelyInsteadOfFreezingThroughDeath', () => {
      // Regression test for the startDeath() call-site clears (distinct from
      // PlatformerState.test.ts's resetGame() clear test): without them, a
      // revealed bubble stayed frozen on screen through the entire 'dying'
      // animation and the 'awaitingRestart' wait, since the game loop's
      // early-return for those phases never reaches the hint tick/transition
      // block that would otherwise fade it out.
      let frameCallback: FrameRequestCallback | null = null;
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        frameCallback = cb;
        return 1;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      render(<PlatformerPage />);
      const sign = signPlacements.value[0];
      playerState.value = { ...playerState.value, x: sign.x, y: sign.y };
      fireEvent.keyDown(window, { code: 'ArrowUp' });
      let t = 0;
      frameCallback!(t);
      for (let i = 0; i < 20; i++) {
        t += 16;
        frameCallback!(t);
      }
      expect(hintTooltipState.value?.phase).toBe('shown');

      healthState.value = 0;
      t += 16;
      frameCallback!(t); // enters 'dying'

      expect(lifecycleState.value.phase).toBe('dying');
      expect(hintTooltipState.value).toBeNull();
    });
  });
});
