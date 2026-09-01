import { useCallback, useEffect, useRef, useState } from 'react';
import { FloatingControls } from './components/FloatingControls';
import { loadImage } from './engine/SpriteLoader';
import { loadFont } from './engine/FontLoader';
import {
  drawTerrain,
  drawPlayer,
  drawHearts,
  drawCollectibles,
  drawEnemies,
  drawBlocks,
  drawBonusFruits,
  drawCollectionEffects,
  drawCounterPopups,
  drawChests,
  drawChestCounter,
  drawIrisOverlay,
  drawRestartPrompt,
  RESTART_PROMPT_FONT_FAMILY,
  RESTART_PROMPT_FONT_URL,
  HEARTS_START_X,
  CHEST_COUNTER_X,
  CHEST_COUNTER_Y,
  drawSigns,
  drawSignBubble,
  drawKeyPickups,
  drawKeyCounter,
  keyCounterX,
  KEY_COUNTER_Y,
  drawEnemySpikes,
} from './engine/Renderer';
import { drawDebugOverlay } from './engine/DebugOverlay';
import { createGameLoop } from './engine/GameLoop';
import { stepPlayerPhysics, checkPitFall, resolvePitFall } from './engine/Physics';
import { PHYSICS_CONFIG } from './engine/PhysicsConfig';
import { stepEnemyPatrol, stepEnemyHitReaction, stepEnemySpikeCooldown } from './engine/EnemyAI';
import { updateCamera, updateCameraY } from './engine/Camera';
import { createKeyboardInput } from './engine/Input';
import type { KeyboardInput } from './engine/Input';
import {
  tickLifecycle,
  startDeath,
  introState,
  currentIrisRadius,
  pauseForJournal,
  resumeFromJournal,
  showEndingScreen,
  dismissEndingScreen,
} from './engine/GameLifecycle';
import { maxIrisRadius } from './engine/IrisTransition';
import { currentLevel } from './level/level';
import {
  checkCollectibleCollisions,
  checkEnemyStompCollisions,
  checkEnemySideCollisions,
  checkBonusFruitCollisions,
  chestPlayerIsStandingOn,
  checkSignOverlap,
  checkKeyPickupCollisions,
  playerHitbox,
  enemyHitbox,
  isSpikedTopLanding,
} from './engine/Collision';
import { openChest, allChestsOpen, isChestOpen, CHEST_CLOSED_OFFSET_X } from './entities/Chest';
import { stepBlockAnimation } from './engine/BlockAI';
import { applyBlockHit, isBlockUsedUp, isBlockRemoved, blockFrameSource, BLOCK_FRAME_SIZE } from './entities/Block';
import { spawnBonusFruit, tickBonusFruit, bonusFruitY } from './entities/BonusFruit';
import { spawnKeyPickup, KEY_TILE_OFFSET_X, KEY_TILE_OFFSET_Y } from './entities/KeyPickup';
import {
  startFlightEffect,
  tickFlightEffect,
  COLLECTION_TEXT_SLOT_COUNT,
  startCounterPopup,
  tickCounterPopup,
  counterPopupOpacity,
} from './engine/CollectionEffects';
import { coinFrameSource, COIN_FRAME_SIZE } from './entities/Coin';
import { fruitFrameSource, FRUIT_FRAME_SIZE } from './entities/Fruit';
import { formatJournalEntry } from './entities/JournalEntry';
import { RENDERED_TILE_SIZE } from './level/Terrain';
import {
  advancePlayerAnimation,
  updatePlayerAnimState,
  applyKnockback,
  tickInvincibility,
  grantInvincibility,
  PLAYER_RENDERED_SIZE,
  PLAYER_VISUAL_CENTER_Y_OFFSET,
  PLAYER_HEAD_PADDING,
} from './entities/Player';
import { advanceEnemyAnimation, applyStomp, ENEMY_FRAME_SIZE } from './entities/Enemy';
import { takeDamage, PIT_FALL_DAMAGE, SIDE_HIT_DAMAGE, INVINCIBILITY_DURATION_SECONDS } from './entities/Health';
import {
  playerState,
  cameraPositionX,
  cameraPositionY,
  healthState,
  lifecycleState,
  spawnCenter,
  resetGame,
  resetGameProgress,
  collectiblePlacements,
  enemyPlacements,
  enemyStates,
  blockPlacements,
  blockStates,
  bonusFruitStates,
  collectedCollectibleIds,
  activeEffects,
  activeCounterPopups,
  collectedFacts,
  chestPlacements,
  chestStates,
  endingScreenShown,
  endingScreenOpen,
  signPlacements,
  hintTooltipState,
  keyPickupStates,
  collectedKeys,
} from './PlatformerState';
import { useSignals } from '@preact/signals-react/runtime';
import { Journal } from './components/Journal';
import { ThankYouScreen } from './components/ThankYouScreen';
import { ControlsOverlay } from './components/ControlsOverlay';
import { navigateTo } from '@/state/navigation';
import { currentUI } from '@/state/locale';
import {
  startHintTooltip,
  beginHintTooltipExit,
  tickHintTooltip,
  hintTooltipGrowthAndOpacity,
} from './engine/HintTooltip';
import type { HintId } from './types';

// Vertical spacing between stacked fact-flight rows when several pickups are
// collected close together — a bit more than the 28px collection-effect
// font size (Renderer.ts's COLLECTION_EFFECT_FONT_SIZE) so stacked lines
// don't touch.
const COLLECTION_TEXT_STACK_ROW_HEIGHT = 34;
// How often the player's sprite toggles visible/invisible while invincible —
// short enough to read clearly as "blinking", not a slow pulse.
const INVINCIBILITY_BLINK_INTERVAL_SECONDS = 0.1;

export const PlatformerPage = () => {
  // Subscribes this component's render to any signal `.value` read during
  // it — needed for `endingScreenOpen.value` in the JSX below to actually
  // trigger a re-render when the game loop flips it (see PlatformerState.ts's
  // doc comment on `endingScreenOpen`). Same convention ThankYouScreen.tsx
  // already uses.
  useSignals();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tilesetRef = useRef<HTMLImageElement | null>(null);
  const playerSpriteRef = useRef<HTMLImageElement | null>(null);
  const playerJumpSpriteRef = useRef<HTMLImageElement | null>(null);
  const heartsSpriteRef = useRef<HTMLImageElement | null>(null);
  const coinSpriteRef = useRef<HTMLImageElement | null>(null);
  const fruitSpriteRef = useRef<HTMLImageElement | null>(null);
  const slimeGreenSpriteRef = useRef<HTMLImageElement | null>(null);
  const slimePurpleSpriteRef = useRef<HTMLImageElement | null>(null);
  const crackOverlaySpriteRef = useRef<HTMLImageElement | null>(null);
  const chestClosedSpriteRef = useRef<HTMLImageElement | null>(null);
  const chestOpenSpriteRef = useRef<HTMLImageElement | null>(null);
  const keySpriteRef = useRef<HTMLImageElement | null>(null);
  // Ref to the game loop's KeyboardInput, set once inside the mount effect
  // below right after createKeyboardInput() runs. Needed by
  // handleDismissEndingScreen (defined outside that effect) so it can drain
  // the dismiss keypress itself — see that handler's doc comment.
  const inputRef = useRef<KeyboardInput | null>(null);
  const journalButtonRef = useRef<HTMLButtonElement>(null);
  const debugParams = new URLSearchParams(window.location.search);
  // Any `debug` param (not just `hitboxes`) shows the debug panel (Kill/
  // Respawn/Hitboxes toggle below) — a dev convenience for exercising the
  // death/respawn iris transition and collision geometry without navigating
  // pits repeatedly, not a feature end users should see.
  const debugControls = debugParams.has('debug');
  // `?debug=hitboxes` still seeds the initial toggle state (so the existing
  // "open at ?debug=hitboxes" manual-testing habit keeps working), but it's
  // now a runtime toggle via the panel button rather than fixed for the
  // session. Mirrored into a ref so the game loop's render() closure (set up
  // once in the mount effect below) reads the latest value without needing
  // to restart the effect on every toggle.
  const [debugHitboxesOn, setDebugHitboxesOn] = useState(
    () => debugParams.get('debug') === 'hitboxes',
  );
  const debugHitboxesRef = useRef(debugHitboxesOn);

  const handleToggleHitboxes = () => setDebugHitboxesOn((prev) => !prev);

  // Mirrored into a ref (same pattern as debugHitboxesOn/debugHitboxesRef
  // above) so the keydown listener registered once in the mount effect below
  // always reads the latest open/closed value instead of closing over a
  // stale one.
  const [journalOpen, setJournalOpen] = useState(false);
  const journalOpenRef = useRef(journalOpen);
  // When true, Journal.tsx plays its own reverse-close animation and only
  // then calls handleJournalReallyClosed — this lets the icon button/`J`
  // key trigger the same graceful close as clicking the in-book × button,
  // instead of unmounting the journal instantly.
  const [journalClosing, setJournalClosing] = useState(false);
  // `endingScreenOpen` (mirrors the ending-screen phase: true while the
  // Thank You screen is mounted) is imported above as a module-level signal,
  // not local useState — see its doc comment in PlatformerState.ts for why.

  // Keeps both refs in sync with their corresponding state on every render
  // (no dependency array) — assigning `.current` directly in the render body
  // trips the `react-hooks/refs` lint rule ("Cannot update ref during
  // render"), so the sync is done here instead, after commit, while still
  // always reflecting the latest value by the next read.
  useEffect(() => {
    debugHitboxesRef.current = debugHitboxesOn;
    journalOpenRef.current = journalOpen;
  });

  /**
   * Toggles the journal. Opening is only allowed from 'playing' (not
   * mid-death/intro/restart) and happens immediately. Closing is only
   * requested from here — the actual close (resuming the game, unmounting
   * Journal) happens in `handleJournalReallyClosed`, called by `Journal`
   * once its reverse-close animation finishes, so every trigger (icon,
   * `J`, and Journal's own in-book × button) closes the same animated way.
   */
  const handleJournalToggle = () => {
    const phase = lifecycleState.value.phase;
    if (!journalOpenRef.current) {
      if (phase !== 'playing') return;
      lifecycleState.value = pauseForJournal(lifecycleState.value);
      setJournalOpen(true);
    } else {
      if (phase !== 'paused') return;
      setJournalClosing(true);
    }
  };

  // Wrapped in useCallback (empty deps: it only reads/writes signals and
  // setState, nothing closed-over) so its identity is stable across renders
  // — Journal's frame-advancing effect depends on it, and a recreated
  // callback there would clear and reschedule the animation timer on every
  // render.
  const handleJournalReallyClosed = useCallback(() => {
    lifecycleState.value = resumeFromJournal(lifecycleState.value);
    setJournalOpen(false);
    setJournalClosing(false);
  }, []);

  // Wrapped in useCallback (empty deps, same reasoning as
  // handleJournalReallyClosed above) since ThankYouScreen depends on it for
  // its own keydown-listener effect.
  //
  // Also drains the game loop's KeyboardInput (`inputRef.current`) here: the
  // same physical keydown that dismisses this screen (e.g. Space) is also
  // seen by `createKeyboardInput`'s own listener and buffered as a pending
  // press. Flipping `gamePhase` to 'playing' happens synchronously above, so
  // the very next game-loop tick already skips the 'ending-screen' phase's
  // own `input.clearPending()` early-return — without this call, that
  // buffered Space would fire as a real jump on the next tick. This is the
  // same class of bug the 'paused' phase's `input.clearPending()` guards
  // against, just reappearing through this exit path.
  const handleDismissEndingScreen = useCallback(() => {
    lifecycleState.value = dismissEndingScreen(lifecycleState.value);
    endingScreenOpen.value = false;
    inputRef.current?.clearPending();
  }, []);

  /**
   * Reset Game (journal button, FR-018b): clears collected progress and
   * closes the journal immediately (no reverse-close animation — per user
   * request, just an instant close), then starts the same iris-in
   * transition as a death respawn/debug respawn, centered on the
   * freshly-spawned player, so the whole thing reads as "starting again"
   * rather than "closing back into a paused game".
   */
  const handleResetGameRequested = () => {
    resetGameProgress();
    setJournalOpen(false);
    // resetGameProgress() already clears the one-shot ending-screen latch AND
    // endingScreenOpen (see PlatformerState.ts's doc comments) — it also
    // reopens every chest, so a visitor who re-opens all of them after
    // resetting must be able to see the Thank You screen again. This extra
    // assignment is defensive (the Reset Game button isn't actually
    // reachable while the ending screen is showing today, but costs nothing
    // to keep in sync regardless).
    endingScreenOpen.value = false;
    const center = spawnCenter();
    lifecycleState.value = introState(center.x, center.y);
  };

  const handleDebugKill = () => {
    healthState.value = 0;
    const p = playerState.value;
    lifecycleState.value = startDeath(p.x + PLAYER_RENDERED_SIZE / 2, p.y + PLAYER_VISUAL_CENTER_Y_OFFSET);
    // Death immediately halts the hint-tick block below (the game loop skips
    // it entirely for the 'dying'/'awaitingRestart' phases), so without this
    // a bubble revealed just before dying would otherwise freeze on screen
    // through the whole death animation and the restart-prompt wait — see
    // this same comment at the other `startDeath()` call site below.
    hintTooltipState.value = null;
  };

  const handleDebugRespawn = () => {
    resetGame();
    const center = spawnCenter();
    lifecycleState.value = introState(center.x, center.y);
  };

  /**
   * Debug-only shortcut into the Level Editor (dev convenience, same gating
   * as the Kill/Respawn/Hitboxes buttons above — see `debugControls`).
   * Deliberately does NOT touch `currentLayout`: the editor's own grid is
   * independent, localStorage-backed state (`editor/editorLevelState.ts`)
   * that already restores itself on mount, regardless of whatever the game
   * is currently showing.
   */
  const handleOpenEditor = () => {
    navigateTo('/platformer/editor');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cached across frames: only recomputed on mount and on actual window
    // resize, since neither the canvas dimensions nor the CSS custom
    // property change on any other frame.
    let backgroundColor = '#000';

    // Shared spin/idle-loop timer for coins (see Coin.ts's coinFrameIndex) —
    // a plain variable, not a signal, since nothing outside this render loop
    // needs to read or react to it. Enemies track their own animation timers
    // independently.
    let worldAnimElapsed = 0;

    // Which vertical slot the next collection's fact text lands in — reseeded
    // every tick from how many fact-flight effects are actually still in
    // flight (see below), NOT a plain ever-incrementing counter: a plain
    // ever-incrementing counter would let a single item collected in
    // isolation land on slot 1 or 2 (visibly offset below the primary spot)
    // purely because of how many items were collected earlier in the
    // session, even minutes apart with nothing overlapping. Reseeding from
    // the live in-flight count instead means an isolated pickup always lands
    // on slot 0, and only pickups that are actually concurrent (their
    // effects still mid-animation) spread across further slots.
    let nextTextSlot = 0;

    // Cycles through fruit.png's icon frames (see Fruit.ts's
    // FRUIT_ICON_COUNT) so successive question-mark bonus fruits look
    // visibly different from each other — same "just keep incrementing, let
    // spawnBonusFruit wrap it" convention as nextTextSlot above.
    let nextBonusFruitIcon = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      backgroundColor =
        getComputedStyle(document.documentElement).getPropertyValue('--background').trim() ||
        '#000';
    };

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Anchor the level to the bottom of the canvas so a taller viewport
      // shows more sky above the ground instead of empty space below it.
      const levelPixelHeight = currentLevel.value.height * RENDERED_TILE_SIZE;
      const originY = canvas.height - levelPixelHeight + cameraPositionY.value;
      const originX = -cameraPositionX.value;

      if (tilesetRef.current) {
        drawTerrain(ctx, currentLevel.value, tilesetRef.current, originX, originY);
        drawSigns(ctx, signPlacements.value, tilesetRef.current, originX, originY);
      }

      // Drawn BEFORE blocks: a bonus fruit spawns at its source block's own
      // position and rises through it — drawing it first lets the block's
      // own tile occlude the still-rising fruit until it clears the block's
      // top edge, reading as "popping out from behind the block" instead of
      // floating on top of it.
      if (fruitSpriteRef.current) {
        drawBonusFruits(ctx, bonusFruitStates.value, fruitSpriteRef.current, originX, originY);
      }

      if (tilesetRef.current) {
        drawBlocks(ctx, blockStates.value, tilesetRef.current, crackOverlaySpriteRef.current, originX, originY);
      }

      if (chestClosedSpriteRef.current || chestOpenSpriteRef.current) {
        drawChests(
          ctx,
          chestStates.value,
          chestClosedSpriteRef.current,
          chestOpenSpriteRef.current,
          originX,
          originY,
        );
      }

      if (playerSpriteRef.current) {
        const isInvincible = playerState.value.invincibleTimer > 0;
        const playerVisible =
          !isInvincible ||
          Math.floor(playerState.value.invincibleTimer / INVINCIBILITY_BLINK_INTERVAL_SECONDS) % 2 === 0;
        drawPlayer(
          ctx,
          playerState.value,
          playerSpriteRef.current,
          originX,
          originY,
          playerJumpSpriteRef.current,
          playerVisible,
        );
      }

      if (coinSpriteRef.current || fruitSpriteRef.current) {
        drawCollectibles(
          ctx,
          collectiblePlacements.value,
          coinSpriteRef.current,
          fruitSpriteRef.current,
          collectedCollectibleIds.value,
          worldAnimElapsed,
          originX,
          originY,
        );
      }

      if (slimeGreenSpriteRef.current || slimePurpleSpriteRef.current) {
        drawEnemies(
          ctx,
          enemyStates.value,
          slimeGreenSpriteRef.current,
          slimePurpleSpriteRef.current,
          originX,
          originY,
        );
      }
      drawEnemySpikes(ctx, enemyStates.value, originX, originY);

      drawKeyPickups(ctx, keyPickupStates.value, keySpriteRef.current, worldAnimElapsed, originX, originY);

      const tooltip = hintTooltipState.value;
      if (tooltip) {
        const hintText = currentUI.value.platformer.hints[tooltip.hintId];
        const anchorX = playerState.value.x + PLAYER_RENDERED_SIZE / 2 + originX;
        // Anchored at the player's actual visible head (render-slot top plus
        // PLAYER_HEAD_PADDING), not the render slot's own top — the slot has
        // transparent padding above the head, so using it directly floated
        // the bubble noticeably higher than the character.
        const anchorBottomY = playerState.value.y + PLAYER_HEAD_PADDING + originY;
        const { growth, opacity } = hintTooltipGrowthAndOpacity(tooltip);
        drawSignBubble(ctx, hintText, anchorX, anchorBottomY, growth, opacity);
      }

      drawCollectionEffects(ctx, activeEffects.value);

      // Trial counter popups (see activeCounterPopups's doc comment in
      // PlatformerState.ts): drawn above
      // the fact-flight text's stacked slots (canvas.height * 0.3, minus one
      // row height, matches the vertical gap COLLECTION_TEXT_STACK_ROW_HEIGHT
      // already uses between stacked slots), the whole row horizontally
      // centered like the fact-flight text's own hold position. Built as an
      // array in a fixed type order (matching the journal summary's own
      // coins/fruits/enemies/crates ordering) so simultaneous popups always
      // lay out the same way regardless of collection order.
      const popupOrder: Array<{
        labelKey: 'coins' | 'fruits' | 'enemies' | 'crates';
        icon: HTMLImageElement | null;
        iconFrame: { sx: number; sy: number; size: number };
        iconYOffset?: number;
      }> = [
        { labelKey: 'coins', icon: coinSpriteRef.current, iconFrame: { ...coinFrameSource(0), size: COIN_FRAME_SIZE } },
        {
          labelKey: 'fruits',
          icon: fruitSpriteRef.current,
          iconFrame: { ...fruitFrameSource(0), size: FRUIT_FRAME_SIZE },
        },
        {
          labelKey: 'enemies',
          icon: slimeGreenSpriteRef.current,
          iconFrame: { sx: 2 * ENEMY_FRAME_SIZE, sy: 0, size: ENEMY_FRAME_SIZE },
          iconYOffset: -6,
        },
        {
          labelKey: 'crates',
          icon: tilesetRef.current,
          iconFrame: { ...blockFrameSource('crate'), size: BLOCK_FRAME_SIZE },
        },
      ];
      const popupItems = popupOrder.flatMap(({ labelKey, icon, iconFrame, iconYOffset }) => {
        const popup = activeCounterPopups.value[labelKey];
        if (!popup || !icon) return [];
        return [
          {
            icon,
            iconFrame,
            collected: popup.collected,
            total: popup.total,
            opacity: counterPopupOpacity(popup),
            iconYOffset,
          },
        ];
      });
      drawCounterPopups(
        ctx,
        popupItems,
        canvas.width / 2,
        canvas.height * 0.3 - COLLECTION_TEXT_STACK_ROW_HEIGHT,
      );

      if (debugHitboxesRef.current)
        drawDebugOverlay(ctx, playerState.value, currentLevel.value, originX, originY, enemyStates.value);

      if (heartsSpriteRef.current) {
        drawHearts(ctx, healthState.value, heartsSpriteRef.current, HEARTS_START_X);
      }

      if (chestClosedSpriteRef.current && chestPlacements.value.length > 0) {
        drawChestCounter(
          ctx,
          chestClosedSpriteRef.current,
          chestStates.value.filter(isChestOpen).length,
          chestPlacements.value.length,
          CHEST_COUNTER_X,
          CHEST_COUNTER_Y,
        );
      }

      if (keySpriteRef.current && collectedKeys.value > 0) {
        const keyX = keyCounterX(
          ctx,
          chestStates.value.filter(isChestOpen).length,
          chestPlacements.value.length,
        );
        drawKeyCounter(ctx, keySpriteRef.current, collectedKeys.value, keyX, KEY_COUNTER_Y);
      }

      // Iris overlay: drawn on top of everything else whenever the current
      // phase isn't 'playing'. centerX/centerY are stored world-space (see
      // GameLifecycle.ts) so they're converted to screen-space here with the
      // same originX/originY already used for terrain/player, keeping them
      // aligned even if the canvas resizes mid-pause. Also excludes
      // 'ending-screen' (same as 'paused') — without this, `currentIrisRadius`
      // returns `null` for that phase (see its own doc comment), which the
      // `?? 0` below coerces to a fully-closed, opaque black circle every
      // frame, painting solid black behind ThankYouScreen's translucent
      // bg-black/80 overlay instead of leaving the paused game dimly visible
      // through it.
      const lifecycle = lifecycleState.value;
      if (lifecycle.phase !== 'playing' && lifecycle.phase !== 'paused' && lifecycle.phase !== 'ending-screen') {
        const centerX = lifecycle.centerX + originX;
        const centerY = lifecycle.centerY + originY;
        const maxRadius = maxIrisRadius(canvas.width, canvas.height, centerX, centerY);
        const radius = currentIrisRadius(lifecycle, maxRadius) ?? 0;
        drawIrisOverlay(ctx, canvas.width, canvas.height, centerX, centerY, radius);
        if (lifecycle.phase === 'awaitingRestart') {
          drawRestartPrompt(ctx, canvas.width, canvas.height);
        }
      }
    };

    resize();
    render();
    canvas.focus();

    const onResize = () => {
      resize();
      render();
    };
    window.addEventListener('resize', onResize);

    const input = createKeyboardInput();
    inputRef.current = input;

    /**
     * Any key or a canvas click restarts the game while 'awaitingRestart' —
     * full health, spawn position, back to the 'intro' iris-in. No-op in
     * every other phase (checked first) so this can't fire mid-gameplay.
     */
    const restartIfAwaiting = () => {
      if (lifecycleState.value.phase !== 'awaitingRestart') return;
      resetGame();
      const center = spawnCenter();
      lifecycleState.value = introState(center.x, center.y);
      render();
    };
    window.addEventListener('keydown', restartIfAwaiting);
    canvas.addEventListener('click', restartIfAwaiting);

    const onJournalKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyJ') handleJournalToggle();
    };
    window.addEventListener('keydown', onJournalKey);

    const loop = createGameLoop((dt) => {
      // 'dying' and 'awaitingRestart' pause the game loop entirely — no
      // physics/input processing, just advancing (dying) or holding
      // (awaitingRestart) the iris animation and re-rendering.
      if (lifecycleState.value.phase === 'dying') {
        lifecycleState.value = tickLifecycle(lifecycleState.value, dt);
        render();
        return;
      }
      if (lifecycleState.value.phase === 'awaitingRestart') {
        render();
        return;
      }
      if (lifecycleState.value.phase === 'paused') {
        // Drains any edge-triggered presses (e.g. Space) that land while the
        // journal is open every tick, not just once — otherwise a press made
        // while paused sits in `justPressed` and fires as a jump on the very
        // next tick after resuming, even though the player never intended to
        // jump while looking at the overlay.
        input.clearPending();
        render();
        return;
      }
      if (lifecycleState.value.phase === 'ending-screen') {
        input.clearPending();
        render();
        return;
      }

      // Coins/enemies only animate while the game is actually live — frozen
      // during death/restart/journal-pause, same as physics below, rather
      // than ticking on a wall-clock independent of the paused state.
      worldAnimElapsed += dt;

      // Reseeded every tick from the number of fact-flight effects still
      // in flight from previous ticks (already filtered for 'done' ones at
      // the end of the previous tick — see the activeEffects tick/filter
      // below) — see nextTextSlot's doc comment above for why this isn't a
      // plain ever-incrementing counter.
      nextTextSlot = activeEffects.value.length % COLLECTION_TEXT_SLOT_COUNT;

      // Enemies currently reacting to a stomp (animState 'hit') run their
      // reaction timer instead of patrolling — stepEnemyHitReaction either
      // holds them frozen, reverts them to 'walk', or flags them `defeated`
      // once the reaction finishes (Enemy.ts's applyStomp is what put them
      // into 'hit' in the first place, below).
      //
      // stepEnemyPatrol also needs to know about currently-live blocks
      // (crate/questionMark/fragileRock) — LevelParser.ts resolves their
      // level-layout markers to 'empty' terrain, so the static grid alone
      // can't tell an enemy it's standing on/beside one. Derive the live
      // set from blockStates.value (excluding any already-removed block,
      // same isBlockRemoved convention as the block-animation step below)
      // and convert each block's pixel position to a tile col/row.
      const blockedTiles = blockStates.value
        .filter((block) => !isBlockRemoved(block))
        .map((block) => ({
          col: Math.round(block.x / RENDERED_TILE_SIZE),
          row: Math.round(block.y / RENDERED_TILE_SIZE),
        }));
      enemyStates.value = enemyStates.value.map((enemy) => {
        const next =
          enemy.animState === 'hit'
            ? stepEnemyHitReaction(enemy, dt)
            : stepEnemyPatrol(enemy, currentLevel.value, dt, blockedTiles);
        return advanceEnemyAnimation(stepEnemySpikeCooldown(next, dt), dt);
      });

      // Blocks currently playing their shared bump/shatter reaction advance
      // it here every tick, same convention as the enemy hit-reaction step
      // just above — a used-up crate/fragileRock is filtered out of the live array
      // once its animation settles back to 'idle' (Block.ts's
      // isBlockRemoved); a used-up question-mark is NEVER filtered (it stays
      // solid forever, permanently showing its `!` tile — see Block.ts's
      // doc comment).
      blockStates.value = blockStates.value
        .map((block) => stepBlockAnimation(block, dt))
        .filter((block) => !isBlockRemoved(block));

      // Bonus fruits rise on their own fixed timer, independent of anything
      // else this tick.
      bonusFruitStates.value = bonusFruitStates.value.map((fruit) => tickBonusFruit(fruit, dt));

      // Enemies whose hit reaction just finished with no hit points left:
      // reward + remove, reusing the exact fact-flight mechanism coins use
      // (see the collectible-collision block below) rather than a duplicate
      // implementation. Checked before the collectible block so both effects
      // can coexist in `newEffects` without one clobbering the other within
      // the same tick — each block builds off `activeEffects.value` as it
      // stands when it runs, same convention the collectible block already
      // uses.
      const justDefeated = enemyStates.value.filter((e) => e.defeated);
      if (justDefeated.length > 0) {
        const newFacts = [...collectedFacts.value];
        const newEffects = [...activeEffects.value];
        const journalRect = journalButtonRef.current?.getBoundingClientRect();
        const targetX = journalRect ? journalRect.left + journalRect.width / 2 : canvas.width - 32;
        const targetY = journalRect ? journalRect.top + journalRect.height / 2 : canvas.height - 32;
        const midX = canvas.width / 2;
        const midY = canvas.height * 0.3;
        const originX = -cameraPositionX.value;
        const levelPixelHeight = currentLevel.value.height * RENDERED_TILE_SIZE;
        const originY = canvas.height - levelPixelHeight + cameraPositionY.value;

        let anyEnemyRewarded = false;
        for (const enemy of justDefeated) {
          // A defeated purple slime carries no fact at all — it drops a key
          // pickup instead (spec.md User Story 4). Keys, like facts, persist
          // across respawns (FR-020c-style dedup: `resetGame()` revives
          // enemies but deliberately never clears `keyPickupStates`), so a
          // revived purple slime stomped again in a later life must not drop
          // a second key for the same source enemy id.
          if (enemy.spriteType === 'slimePurple') {
            const alreadyDropped = keyPickupStates.value.some((k) => k.id === enemy.id);
            if (!alreadyDropped) {
              keyPickupStates.value = [...keyPickupStates.value, spawnKeyPickup(enemy.id, enemy.x, enemy.y)];
            }
            continue;
          }
          // A "plain" enemy (a marker beyond its color's CVData course
          // count, see EnemyMapper.ts) carries no fact at all — it's still
          // removed via the `filter` below, just with no reward. Facts also
          // persist across respawns (FR-020c: `resetGame()` revives enemies
          // but deliberately never clears `collectedFacts`), so a revived
          // enemy stomped again in a later life must not re-bank the same
          // fact — that would duplicate its journal page.
          const fact = enemy.fact;
          if (!fact || newFacts.some((f) => f.id === fact.id)) continue;
          anyEnemyRewarded = true;
          newFacts.push(fact);
          // Reuses the journal's own title/icon derivation — formatJournalEntry
          // gets every section's display title right (Course's `title` field,
          // Experience's `role`/`company`, Education's `degree`, etc.), unlike
          // an ad-hoc `'name' in data` check would.
          const { icon, title: label } = formatJournalEntry(fact);
          const slot = nextTextSlot;
          nextTextSlot = (nextTextSlot + 1) % COLLECTION_TEXT_SLOT_COUNT;
          const stackOffsetY = slot * COLLECTION_TEXT_STACK_ROW_HEIGHT;
          newEffects.push(
            startFlightEffect(
              enemy.id,
              label,
              enemy.x + originX,
              enemy.y + originY + stackOffsetY,
              midX,
              midY + stackOffsetY,
              targetX,
              targetY,
              icon,
            ),
          );
        }

        collectedFacts.value = newFacts;
        activeEffects.value = newEffects;
        enemyStates.value = enemyStates.value.filter((e) => !e.defeated);
        if (anyEnemyRewarded) {
          const enemyDefeated = newFacts.filter((f) => f.sourceType === 'enemy').length;
          // Denominator counts only fact-bearing placements — a "plain"
          // enemy (EnemyMapper.ts's excess-marker case) never contributes a
          // fact, so counting it here would make the ratio unreachable.
          const enemyTotal = enemyPlacements.value.filter((p) => p.fact).length;
          activeCounterPopups.value = {
            ...activeCounterPopups.value,
            enemies: startCounterPopup('enemies', enemyDefeated, enemyTotal),
          };
        }
      }

      activeEffects.value = activeEffects.value
        .map((effect) => tickFlightEffect(effect, dt))
        .filter((effect) => effect.phase !== 'done');

      const tickedPopups = { ...activeCounterPopups.value };
      let popupsChanged = false;
      for (const key of Object.keys(tickedPopups) as Array<keyof typeof tickedPopups>) {
        const ticked = tickCounterPopup(tickedPopups[key]!, dt);
        popupsChanged = true;
        if (ticked) {
          tickedPopups[key] = ticked;
        } else {
          delete tickedPopups[key];
        }
      }
      if (popupsChanged) activeCounterPopups.value = tickedPopups;

      // Same origin math as render()'s local originX/originY (that scope
      // isn't reachable from here) — needed to convert a just-collected
      // placement's world-space position into the screen-space coordinates
      // FlightEffect requires (see CollectionEffects.ts's doc comment).
      const levelPixelHeight = currentLevel.value.height * RENDERED_TILE_SIZE;
      const originY = canvas.height - levelPixelHeight + cameraPositionY.value;
      const originX = -cameraPositionX.value;

      const touchedIds = checkCollectibleCollisions(
        playerState.value,
        collectiblePlacements.value,
        collectedCollectibleIds.value,
      );
      if (touchedIds.length > 0) {
        const nextCollected = new Set(collectedCollectibleIds.value);
        const newFacts = [...collectedFacts.value];
        const newEffects = [...activeEffects.value];
        const journalRect = journalButtonRef.current?.getBoundingClientRect();
        const targetX = journalRect ? journalRect.left + journalRect.width / 2 : canvas.width - 32;
        const targetY = journalRect ? journalRect.top + journalRect.height / 2 : canvas.height - 32;
        // Fact text rises toward the upper-middle of the screen and holds
        // there before flying on to the journal icon, so it's actually
        // readable rather than flying past in one motion. Deliberately above
        // dead-center (0.5) — vertical-center read as "too low" in review,
        // since gameplay (terrain/player) sits in the lower half of the
        // screen and a dead-center pause competes with it.
        const midX = canvas.width / 2;
        const midY = canvas.height * 0.3;

        for (const id of touchedIds) {
          const placement = collectiblePlacements.value.find((p) => p.id === id);
          if (!placement) continue;
          nextCollected.add(id);
          newFacts.push(placement.fact);

          // Reuses the journal's own title/icon derivation — see the
          // enemy-defeat block above for why an ad-hoc `'name' in data`
          // check would be wrong for several sections.
          // `icon` is passed to `startFlightEffect` separately, NOT
          // concatenated into `label`: Renderer.ts draws it in a different
          // font (the pixel font `label` uses has no emoji glyphs).
          const { icon, title: label } = formatJournalEntry(placement.fact);
          // Fast/simultaneous pickups cycle through a fixed set of vertical
          // slots (1, 2, 3, 1, 2, 3, ...) instead of every fact text landing
          // on the same spot. The offset applies to BOTH the rise's start
          // and its mid hold point (not just mid) — offsetting mid alone
          // still let two effects starting near the same world position
          // overlap through most of the rise, only separating at the end.
          const slot = nextTextSlot;
          nextTextSlot = (nextTextSlot + 1) % COLLECTION_TEXT_SLOT_COUNT;
          const stackOffsetY = slot * COLLECTION_TEXT_STACK_ROW_HEIGHT;
          newEffects.push(
            startFlightEffect(
              id,
              label,
              placement.x + originX,
              placement.y + originY + stackOffsetY,
              midX,
              midY + stackOffsetY,
              targetX,
              targetY,
              icon,
            ),
          );
        }

        collectedCollectibleIds.value = nextCollected;
        collectedFacts.value = newFacts;
        activeEffects.value = newEffects;

        if (touchedIds.some((id) => collectiblePlacements.value.find((p) => p.id === id)?.spriteType === 'coin')) {
          const coinTotal = collectiblePlacements.value.filter((p) => p.spriteType === 'coin').length;
          const coinCollected = collectiblePlacements.value.filter(
            (p) => p.spriteType === 'coin' && nextCollected.has(p.id),
          ).length;
          activeCounterPopups.value = {
            ...activeCounterPopups.value,
            coins: startCounterPopup('coins', coinCollected, coinTotal),
          };
        }
      }

      // Bonus fruits: a question-mark's spawned fruit carries a CV fact
      // (Certificates/Projects — see BlockMapper.ts's
      // certificateToBlock/projectToBlock) and reveals it exactly like any
      // other collectible on touch. A fruit
      // spawned from a question-mark marker beyond the available data
      // (`fruit.fact === undefined`) still removes silently, same as before.
      const touchedBonusFruitIds = checkBonusFruitCollisions(playerState.value, bonusFruitStates.value);
      if (touchedBonusFruitIds.length > 0) {
        const newFacts = [...collectedFacts.value];
        const newEffects = [...activeEffects.value];
        const journalRect = journalButtonRef.current?.getBoundingClientRect();
        const targetX = journalRect ? journalRect.left + journalRect.width / 2 : canvas.width - 32;
        const targetY = journalRect ? journalRect.top + journalRect.height / 2 : canvas.height - 32;
        const midX = canvas.width / 2;
        const midY = canvas.height * 0.3;

        let anyBonusFruitRewarded = false;
        for (const id of touchedBonusFruitIds) {
          const fruit = bonusFruitStates.value.find((f) => f.id === id);
          if (!fruit || !fruit.fact) continue;
          if (newFacts.some((f) => f.id === fruit.fact!.id)) continue;

          anyBonusFruitRewarded = true;
          newFacts.push(fruit.fact);
          // Reuses the journal's own title/icon derivation — see the
          // enemy-defeat block above.
          const { icon, title: label } = formatJournalEntry(fruit.fact);
          const slot = nextTextSlot;
          nextTextSlot = (nextTextSlot + 1) % COLLECTION_TEXT_SLOT_COUNT;
          const stackOffsetY = slot * COLLECTION_TEXT_STACK_ROW_HEIGHT;
          newEffects.push(
            startFlightEffect(
              id,
              label,
              fruit.x + originX,
              bonusFruitY(fruit) + originY + stackOffsetY,
              midX,
              midY + stackOffsetY,
              targetX,
              targetY,
              icon,
            ),
          );
        }

        collectedFacts.value = newFacts;
        activeEffects.value = newEffects;
        bonusFruitStates.value = bonusFruitStates.value.filter(
          (fruit) => !touchedBonusFruitIds.includes(fruit.id),
        );
        if (anyBonusFruitRewarded) {
          const bonusFruitTotal = blockPlacements.value.filter(
            (b) => b.blockKind === 'questionMark' && b.fact,
          ).length;
          const bonusFruitCollected = newFacts.filter(
            (f) => f.sectionId === 'certificates' || f.sectionId === 'projects',
          ).length;
          activeCounterPopups.value = {
            ...activeCounterPopups.value,
            fruits: startCounterPopup('fruits', bonusFruitCollected, bonusFruitTotal),
          };
        }
      }

      // Key pickups: dropped by defeated purple slimes (see the justDefeated
      // block above), collected on touch like a coin, but banked as a count
      // rather than a per-item fact — flagged `collected: true` in place
      // (not removed from the array) so drawKeyPickups's own skip-if-collected
      // check keeps the pickup out of the render list without needing a
      // separate "already gone" list. Unlike every other pickup here, the
      // flight target isn't the journal icon — it's the canvas-drawn HUD key
      // counter's screen position (keyCounterX/KEY_COUNTER_Y), used directly
      // with no origin/camera offset since the HUD is screen-fixed. keyCounterX
      // needs a 2D context to measure the chest counter's current text width
      // (same real position render() draws the key counter at) — canvas
      // already has one from this component's setup, reused here rather than
      // recreating it. There's no per-key fact/label the way other pickups
      // have one, so the flight text is just a static "Key" caption.
      const touchedKeyIds = checkKeyPickupCollisions(playerState.value, keyPickupStates.value);
      if (touchedKeyIds.length > 0) {
        const newEffects = [...activeEffects.value];
        const midX = canvas.width / 2;
        const midY = canvas.height * 0.3;
        const hudCtx = canvas.getContext('2d');
        const keyX = hudCtx
          ? keyCounterX(hudCtx, chestStates.value.filter(isChestOpen).length, chestPlacements.value.length)
          : CHEST_COUNTER_X;
        for (const pickup of keyPickupStates.value) {
          if (!touchedKeyIds.includes(pickup.id)) continue;
          const slot = nextTextSlot;
          nextTextSlot = (nextTextSlot + 1) % COLLECTION_TEXT_SLOT_COUNT;
          const stackOffsetY = slot * COLLECTION_TEXT_STACK_ROW_HEIGHT;
          newEffects.push(
            startFlightEffect(
              pickup.id,
              'Key',
              pickup.x + KEY_TILE_OFFSET_X + originX,
              pickup.y + KEY_TILE_OFFSET_Y + originY + stackOffsetY,
              midX,
              midY + stackOffsetY,
              keyX,
              KEY_COUNTER_Y,
            ),
          );
        }
        activeEffects.value = newEffects;
        keyPickupStates.value = keyPickupStates.value.map((k) =>
          touchedKeyIds.includes(k.id) ? { ...k, collected: true } : k,
        );
        collectedKeys.value += touchedKeyIds.length;
      }

      // Chests don't open on touch like every other collectible — spec.md
      // FR-023 requires an explicit Arrow Up press
      // while standing on one (KeyW also works, mirroring the A/D-as-
      // Left/Right convention — see FR-007). `originX`/`originY` are already
      // in scope from this tick's earlier collision blocks above.
      //
      // Both must be evaluated (not short-circuited) since consumePress has
      // the side effect of clearing the pending press it finds — an `||`
      // between the two calls directly would skip consuming the second
      // key's pending press whenever the first already returned true.
      const arrowUpPressed = input.consumePress('ArrowUp');
      const wPressed = input.consumePress('KeyW');
      const interactPressed = arrowUpPressed || wPressed;
      // Computed unconditionally (not just inside `if (interactPressed)`) so
      // the "no key" hint bubble below can also read it — standing on a
      // closed chest with zero keys is itself the trigger condition for that
      // bubble, independent of whether Up was actually pressed this tick.
      const standingChestId = chestPlayerIsStandingOn(playerState.value, chestStates.value);
      if (interactPressed) {
        if (standingChestId && collectedKeys.value > 0) {
          const chest = chestStates.value.find((c) => c.id === standingChestId)!;
          chestStates.value = chestStates.value.map((c) =>
            c.id === standingChestId ? openChest(c) : c,
          );
          collectedKeys.value -= 1;
          if (!collectedFacts.value.some((f) => f.id === chest.fact.id)) {
            const journalRect = journalButtonRef.current?.getBoundingClientRect();
            const targetX = journalRect ? journalRect.left + journalRect.width / 2 : canvas.width - 32;
            const targetY = journalRect ? journalRect.top + journalRect.height / 2 : canvas.height - 32;
            const midX = canvas.width / 2;
            const midY = canvas.height * 0.3;
            const { icon, title: label } = formatJournalEntry(chest.fact);
            const slot = nextTextSlot;
            nextTextSlot = (nextTextSlot + 1) % COLLECTION_TEXT_SLOT_COUNT;
            const stackOffsetY = slot * COLLECTION_TEXT_STACK_ROW_HEIGHT;
            collectedFacts.value = [...collectedFacts.value, chest.fact];
            activeEffects.value = [
              ...activeEffects.value,
              startFlightEffect(
                chest.id,
                label,
                // Shifted by CHEST_CLOSED_OFFSET_X (see entities/Chest.ts) to
                // start from the chest's actual centered-on-tile left edge —
                // only the closed offset applies here, since this only fires
                // the instant a closed chest is opened.
                chest.x + originX + CHEST_CLOSED_OFFSET_X,
                chest.y + originY + stackOffsetY,
                midX,
                midY + stackOffsetY,
                targetX,
                targetY,
                icon,
              ),
            ];
          }
        }
      }

      // FR-038: revealed like a chest — stand on a sign (or, per the same
      // convention, a locked chest with zero keys) and press Up/W
      // (interactPressed, computed above for chest-opening) — but reusable
      // (not dedup-tracked) and hidden again
      // automatically the instant the player leaves overlap, with no
      // keypress needed to dismiss it.
      if (hintTooltipState.value) {
        hintTooltipState.value = tickHintTooltip(hintTooltipState.value, dt);
      }
      const overlappingSignHintId = checkSignOverlap(playerState.value, signPlacements.value);
      // A closed chest the player is standing on, while holding zero keys,
      // is itself an "overlapping something with a hint" case — reuses the
      // existing chestNeedsKey hint text (spec.md's i18n `platformer.hints`)
      // that already existed for this purpose but was previously only
      // reachable via an unplaced hint-sign marker. Signs take priority in
      // the vanishingly unlikely case a chest and a sign tile overlap.
      // Re-checked against the CURRENT chestStates (not the `standingChestId`
      // captured above, before the chest-open block ran) — a chest just
      // successfully opened this same tick is no longer "closed and stood
      // on", so `chestPlayerIsStandingOn` correctly stops returning its id
      // (it skips open chests), and no bubble should show for that case.
      const standingClosedChestId = chestPlayerIsStandingOn(playerState.value, chestStates.value);
      const lockedChestHintId: HintId | undefined =
        !overlappingSignHintId && standingClosedChestId && collectedKeys.value <= 0 ? 'chestNeedsKey' : undefined;
      const overlappingHintId = overlappingSignHintId ?? lockedChestHintId;
      const currentTooltip = hintTooltipState.value;
      if (overlappingHintId && interactPressed) {
        if (!currentTooltip || currentTooltip.hintId !== overlappingHintId) {
          hintTooltipState.value = startHintTooltip(overlappingHintId);
        } else if (currentTooltip.phase === 'exiting') {
          // Pressed Up again before the previous reveal finished leaving —
          // restart the entrance rather than leaving it stuck exiting.
          hintTooltipState.value = { ...currentTooltip, phase: 'entering', elapsed: 0 };
        }
        // Already 'entering'/'shown' for this exact sign/chest: a repeat
        // press while it's already up is a harmless no-op.
      } else if (!overlappingHintId && currentTooltip && currentTooltip.phase !== 'exiting') {
        hintTooltipState.value = beginHintTooltipExit(currentTooltip);
      }

      const stompedIds = checkEnemyStompCollisions(playerState.value, enemyStates.value);
      const stompBounceThisTick = stompedIds.length > 0;
      if (stompBounceThisTick) {
        enemyStates.value = enemyStates.value.map((enemy) =>
          stompedIds.includes(enemy.id) ? applyStomp(enemy) : enemy,
        );
        playerState.value = {
          ...playerState.value,
          vy: PHYSICS_CONFIG.stompBounceVelocity,
          bounceAscending: true,
        };
      }

      // Side/below damage — only checked while not already invincible, so
      // one overlap can't register repeated hits every tick it persists. A
      // `hit`-reacting enemy IS excluded here (unlike stomp detection, which
      // only excludes an enemy once its `hitPoints` reach 0 — see
      // Collision.ts's checkEnemyStompCollisions): a hit-reacting enemy must
      // stay harmless to side-touch for its whole reaction, or bouncing off
      // a stomp while still overlapping it would register as a spurious
      // side-hit.
      //
      // Excludes any id already in `stompedIds`: the stomp block above just
      // reassigned `playerState.value.vy` to the (negative, upward)
      // `stompBounceVelocity`, which would otherwise make
      // `checkEnemySideCollisions` see `vy <= 0` for the very enemy just
      // landed on and misread the landing as a non-stomp touch — the two
      // checks are meant to be mutually exclusive for the same overlap.
      if (playerState.value.invincibleTimer <= 0) {
        const sideHitIds = checkEnemySideCollisions(playerState.value, enemyStates.value).filter(
          (id) => !stompedIds.includes(id),
        );
        if (sideHitIds.length > 0) {
          const hitEnemy = enemyStates.value.find((e) => e.id === sideHitIds[0])!;
          healthState.value = takeDamage(healthState.value, SIDE_HIT_DAMAGE);
          // Compare actual hitbox centers, not raw x (each entity's x is its
          // own top-left placement coordinate, not its visual center — a
          // purple slime's much wider render slot made this comparison
          // biased toward one direction almost regardless of which side the
          // player actually touched it from). Pushes the player back toward
          // whichever side of the enemy their own hitbox center is already
          // on, i.e. away from the enemy and back the way they came.
          const playerBox = playerHitbox(playerState.value);
          const enemyBox = enemyHitbox(hitEnemy);
          const playerCenterX = playerBox.x + playerBox.width / 2;
          const enemyCenterX = enemyBox.x + enemyBox.width / 2;
          const knockbackDirection = playerCenterX <= enemyCenterX ? -1 : 1;
          // A failed stomp attempt against spikes (the player was falling
          // onto the enemy's top half, same shape a real stomp would need,
          // but the enemy's spikes redirected it to damage) gets a bit of
          // upward push added on top of the usual horizontal knockback, so
          // it reads as "bounced off the spikes" rather than identical to a
          // plain side/below touch. Checked against the pre-knockback state
          // — applyKnockback below never touches position or vy, only
          // vx/facing/timers, so this reads the same geometry either way.
          const isTopLandingOnSpikes = isSpikedTopLanding(playerState.value, hitEnemy);
          playerState.value = applyKnockback(
            playerState.value,
            knockbackDirection,
            PHYSICS_CONFIG.sideHitKnockbackVx,
            PHYSICS_CONFIG.sideHitKnockbackDuration,
            INVINCIBILITY_DURATION_SECONDS,
          );
          if (isTopLandingOnSpikes) {
            // Without `bounceAscending: true` (same mechanism the stomp
            // bounce above relies on), `stepPlayerPhysics`'s variable-jump-
            // height cut would shear this upward velocity to ~45% of its
            // configured magnitude on this very tick, and again every tick
            // after while the jump key isn't held — this isn't a jump the
            // player is "holding", so it must play out at its full
            // configured magnitude regardless of jump-key state.
            playerState.value = {
              ...playerState.value,
              vy: PHYSICS_CONFIG.spikeTopHitKnockbackVy,
              bounceAscending: true,
            };
          }
        }
      }

      // A/D accepted as an alternate to Arrow Left/Right (FR-007 only
      // requires arrows; this is an additive convenience, not a replacement).
      const horizontal = {
        left: input.isHeld('ArrowLeft') || input.isHeld('KeyA'),
        right: input.isHeld('ArrowRight') || input.isHeld('KeyD'),
      };
      const jumpPressed = input.consumePress('Space');
      const jumpHeld = input.isHeld('Space');
      const dropThroughHeld = input.isHeld('ArrowDown') || input.isHeld('KeyS');
      // Held (not edge-triggered) — climbing is continuous like movement,
      // unlike the edge-triggered ArrowUp/KeyW read further below for chest
      // interaction (the two never conflict in practice, since a tile is
      // either a chest marker or a ladder tile, never both).
      const climbUpHeld = input.isHeld('ArrowUp') || input.isHeld('KeyW');

      let next = stepPlayerPhysics(
        playerState.value,
        currentLevel.value,
        dt,
        {
          ...horizontal,
          jumpPressed,
          jumpHeld,
          dropThroughHeld,
          climbUpHeld,
          suppressJumpCut: stompBounceThisTick,
        },
        blockStates.value,
      );

      // Block hit mechanics: `next.hitBlockIds` (set by
      // Physics.ts's ceiling-collision check, same call above) reports every
      // block whose underside the player's head just hit this tick — but
      // only a block that ISN'T already used up actually reacts (a
      // question-mark that already popped its fruit, or a still-mid-bump
      // crate/fragileRock about to be filtered out, must not register a second hit
      // just because the player's head is still under it this frame).
      const hittableBlockIds = next.hitBlockIds.filter((id) => {
        const block = blockStates.value.find((b) => b.id === id);
        return block !== undefined && !isBlockUsedUp(block);
      });
      if (hittableBlockIds.length > 0) {
        blockStates.value = blockStates.value.map((block) =>
          hittableBlockIds.includes(block.id) ? applyBlockHit(block) : block,
        );

        const originX = -cameraPositionX.value;
        const levelPixelHeight = currentLevel.value.height * RENDERED_TILE_SIZE;
        const originY = canvas.height - levelPixelHeight + cameraPositionY.value;
        const journalRect = journalButtonRef.current?.getBoundingClientRect();
        const targetX = journalRect ? journalRect.left + journalRect.width / 2 : canvas.width - 32;
        const targetY = journalRect ? journalRect.top + journalRect.height / 2 : canvas.height - 32;
        const midX = canvas.width / 2;
        const midY = canvas.height * 0.3;

        for (const id of hittableBlockIds) {
          const block = blockStates.value.find((b) => b.id === id);
          if (!block) continue;

          if (block.blockKind === 'questionMark') {
            bonusFruitStates.value = [
              ...bonusFruitStates.value,
              spawnBonusFruit(block.id, block.x, block.y, block.fact, nextBonusFruitIcon++),
            ];
          }

          // FragileRock's terminal hit (breaks to empty space, no fact, no
          // reward — FR-022c) still gets a visual "puff": the same
          // sparkle-burst mechanism every other reward pickup already plays
          // (drawCollectionEffects reads
          // `effect.startX/startY`, independent of `effect.text`), with an
          // empty label and no target-flight destination that matters since
          // nothing is actually flying anywhere — the sparkle at the
          // collection point is the only visible part.
          if (block.blockKind === 'fragileRock') {
            // Centered on the fragileRock's own tile, not its top-left
            // corner. The burst's size itself (SPARKLE_RADIUS_PX/
            // SPARKLE_MAX_RADIUS in CollectionEffects.ts/Renderer.ts) is a
            // shared constant every collection effect uses, not
            // parameterized per-effect — scaling it up just for rocks would
            // mean threading a size override through
            // FlightEffect/sparkleParticles/drawCollectionEffects, affecting
            // every other effect's call sites too, so it stays at the shared
            // default.
            const puffX = block.x + originX + RENDERED_TILE_SIZE / 2;
            const puffY = block.y + originY + RENDERED_TILE_SIZE / 2;
            activeEffects.value = [
              ...activeEffects.value,
              startFlightEffect(block.id, '', puffX, puffY, puffX, puffY, puffX, puffY),
            ];
          }

          if (block.blockKind === 'crate' && block.hitsTaken >= 2 && block.fact) {
            // Dedup by fact id, same defensive guard the enemy-defeat reward
            // already uses (FR-020c) — not actually reachable for crates
            // today (they never reset mid-session), but keeps the two reward
            // paths consistent.
            if (!collectedFacts.value.some((f) => f.id === block.fact!.id)) {
              // Reuses the journal's own title/icon derivation — see the
              // enemy-defeat block above. Uses the role/degree rather than
              // the generic "Experience"/"Education" section label.
              const { icon, title: label } = formatJournalEntry(block.fact);
              const slot = nextTextSlot;
              nextTextSlot = (nextTextSlot + 1) % COLLECTION_TEXT_SLOT_COUNT;
              const stackOffsetY = slot * COLLECTION_TEXT_STACK_ROW_HEIGHT;
              collectedFacts.value = [...collectedFacts.value, block.fact];
              const crateTotal = blockPlacements.value.filter((b) => b.blockKind === 'crate').length;
              const crateCollected = collectedFacts.value.filter(
                (f) => f.sectionId === 'experience' || f.sectionId === 'education',
              ).length;
              activeCounterPopups.value = {
                ...activeCounterPopups.value,
                crates: startCounterPopup('crates', crateCollected, crateTotal),
              };
              activeEffects.value = [
                ...activeEffects.value,
                startFlightEffect(
                  block.id,
                  label,
                  block.x + originX,
                  block.y + originY + stackOffsetY,
                  midX,
                  midY + stackOffsetY,
                  targetX,
                  targetY,
                  icon,
                ),
              ];
            }
          }
        }
      }

      if (checkPitFall(next, currentLevel.value)) {
        // Invincibility is a property of taking damage generally, not just
        // of enemy contact — a pit fall grants and
        // respects it exactly like a side-hit does. The position recovery
        // below is NOT gated by it, though: `resolvePitFall` must always run
        // or the character would keep falling forever while merely
        // invincible from an earlier, unrelated hit.
        if (next.invincibleTimer <= 0) {
          healthState.value = takeDamage(healthState.value, PIT_FALL_DAMAGE);
          next = grantInvincibility(next, INVINCIBILITY_DURATION_SECONDS);
        }
        next = resolvePitFall(next);
      }

      // Runs after the pit-fall check so `animState` is always derived from
      // the frame's FINAL `grounded` value — otherwise a pit-fall recovery
      // would render one frame of a stale fall/jump animation at the
      // recovered position before the next tick corrected it.
      next = updatePlayerAnimState(next);
      next = advancePlayerAnimation(next, dt);
      next = tickInvincibility(next, dt);

      playerState.value = next;

      const levelPixelWidth = currentLevel.value.width * RENDERED_TILE_SIZE;
      cameraPositionX.value = updateCamera(
        cameraPositionX.value,
        next.x,
        PLAYER_RENDERED_SIZE,
        canvas.width,
        levelPixelWidth,
      );

      const levelPixelHeightForCamera = currentLevel.value.height * RENDERED_TILE_SIZE;
      cameraPositionY.value = updateCameraY(
        cameraPositionY.value,
        next.y,
        PLAYER_RENDERED_SIZE,
        canvas.height,
        levelPixelHeightForCamera,
      );

      // Death check: whatever the damage source (today, only repeated pit
      // falls), 0 health starts the death iris centered on wherever the
      // player ended up this frame. Otherwise, keep advancing 'intro' (a
      // no-op once already 'playing' — see GameLifecycle.ts's tickLifecycle).
      if (healthState.value === 0) {
        lifecycleState.value = startDeath(
          next.x + PLAYER_RENDERED_SIZE / 2,
          next.y + PLAYER_VISUAL_CENTER_Y_OFFSET,
        );
        // See handleDebugKill's identical assignment above: without this the
        // hint bubble would freeze on screen through the death animation and
        // the awaitingRestart wait, since the game loop's early-returns for
        // those phases never reach the hint tick/transition block that would
        // otherwise fade it out.
        hintTooltipState.value = null;
      } else {
        lifecycleState.value = tickLifecycle(lifecycleState.value, dt);
      }

      // Deliberately allows 'intro' here too, not just 'playing': per
      // GameLifecycle.ts's doc comment, 'intro' is a purely visual overlay
      // on top of already-running gameplay (a pit near spawn is still live
      // during it), and physics/collisions — including chest-opening —
      // already run during 'intro' the same as any other tick. Explicitly
      // listing the two live phases (rather than e.g. `!== 'dying'`) is
      // required, not just tidier: this check runs every tick regardless of
      // phase, so a broader exclusion-based condition would also fire while
      // 'paused' (flipping a journal-open visitor straight to
      // 'ending-screen' the instant they'd already opened every chest,
      // clobbering the journal) or 'awaitingRestart', and would redundantly
      // re-fire every tick while already 'ending-screen'.
      //
      // Also gated on `!endingScreenShown.value` (see that signal's doc
      // comment in PlatformerState.ts) — without it, since opening a chest is
      // permanent, `allChestsOpen` stays true on every subsequent tick after
      // the last chest opens, so dismissing the screen (which only sets
      // phase back to 'playing', not any per-chest state) would otherwise
      // cause this exact check to immediately re-trigger on the very next
      // tick, permanently re-opening the screen the instant it's dismissed.
      if (
        !endingScreenShown.value &&
        (lifecycleState.value.phase === 'playing' || lifecycleState.value.phase === 'intro') &&
        allChestsOpen(chestStates.value)
      ) {
        lifecycleState.value = showEndingScreen(lifecycleState.value);
        endingScreenOpen.value = true;
        endingScreenShown.value = true;
      }

      render();
    });
    loop.start();

    let cancelled = false;
    loadImage('/sprites/world_tileset.png')
      .then((img) => {
        if (cancelled) return;
        tilesetRef.current = img;
        render();
      })
      .catch(() => {
        // Terrain simply won't render if the tileset fails to load; the
        // background fill still shows so the page isn't blank.
      });
    loadImage('/sprites/knight.png')
      .then((img) => {
        if (cancelled) return;
        playerSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Player simply won't render if the sprite fails to load; the
        // terrain still shows.
      });
    loadImage('/sprites/knight2.png')
      .then((img) => {
        if (cancelled) return;
        playerJumpSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Jump falls back to the primary sheet's current frame if this one
        // fails to load (see Renderer.ts's drawPlayer).
      });
    loadImage('/sprites/hearts.png')
      .then((img) => {
        if (cancelled) return;
        heartsSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // The heart HUD simply won't render if the sprite fails to load; the
        // rest of the game still shows.
      });
    loadImage('/sprites/coin.png')
      .then((img) => {
        if (cancelled) return;
        coinSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Coins simply won't render if the sprite fails to load; the rest of
        // the game still shows.
      });
    loadImage('/sprites/fruit.png')
      .then((img) => {
        if (cancelled) return;
        fruitSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Fruits simply won't render if the sprite fails to load; coins and
        // the rest of the game still show.
      });
    loadImage('/sprites/slime_green.png')
      .then((img) => {
        if (cancelled) return;
        slimeGreenSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Green (Certificates) enemies simply won't render if the sprite
        // fails to load; the rest of the game still shows.
      });
    loadImage('/sprites/slime_purple.png')
      .then((img) => {
        if (cancelled) return;
        slimePurpleSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Purple (Projects) enemies simply won't render if the sprite fails
        // to load; the rest of the game still shows.
      });
    loadImage('/sprites/crack_overlay.png')
      .then((img) => {
        if (cancelled) return;
        crackOverlaySpriteRef.current = img;
        render();
      })
      .catch(() => {
        // A cracked crate simply won't show its overlay if this fails to
        // load; the base crate tile and every other mechanic still work.
      });
    loadImage('/sprites/chest_closed.png')
      .then((img) => {
        if (cancelled) return;
        chestClosedSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Chests simply won't render if the sprite fails to load; the rest
        // of the game still shows.
      });
    loadImage('/sprites/chest_open.png')
      .then((img) => {
        if (cancelled) return;
        chestOpenSpriteRef.current = img;
        render();
      })
      .catch(() => {
        // An opened chest falls back to invisible if this fails to load;
        // the closed sprite (and the rest of the game) still works.
      });
    loadImage('/sprites/key.png')
      .then((img) => {
        if (cancelled) return;
        keySpriteRef.current = img;
        render();
      })
      .catch(() => {
        // Key pickups simply won't render if the sprite fails to load; the
        // rest of the game still works (collision doesn't depend on the
        // sprite being loaded).
      });
    loadFont(RESTART_PROMPT_FONT_FAMILY, RESTART_PROMPT_FONT_URL)
      .then(() => {
        if (cancelled) return;
        render();
      })
      .catch(() => {
        // drawRestartPrompt/drawCounterPopups fall back to their
        // sans-serif/monospace stacks if the custom font fails to load.
      });

    return () => {
      cancelled = true;
      loop.stop();
      input.destroy();
      inputRef.current = null;
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', restartIfAwaiting);
      window.removeEventListener('keydown', onJournalKey);
      canvas.removeEventListener('click', restartIfAwaiting);
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <canvas ref={canvasRef} data-testid="platformer-canvas" className="block" tabIndex={-1} />
      <FloatingControls />
      <ControlsOverlay />
      {journalOpen && (
        <Journal
          onClose={handleJournalReallyClosed}
          closeRequested={journalClosing}
          onResetGame={handleResetGameRequested}
        />
      )}
      {endingScreenOpen.value && <ThankYouScreen onDismiss={handleDismissEndingScreen} />}
      {/* Sits top-left, left of the hearts HUD, which HEARTS_START_X shifts
          right to make room — top-left keeps it easy to spot against the
          terrain. size-10 (40px) must match the 40 baked into
          HEARTS_START_X's computation in Renderer.ts. */}
      <button
        ref={journalButtonRef}
        type="button"
        onClick={handleJournalToggle}
        aria-label="Toggle journal"
        className="fixed top-4 left-4 z-50 size-10 overflow-hidden rounded"
      >
        <img
          src="/sprites/journal.png"
          alt=""
          data-testid="journal-open-button"
          className="h-full w-full object-contain"
          style={{ imageRendering: 'pixelated' }}
        />
      </button>
      {debugControls && (
        // Stacked below FloatingControls' top-right theme/locale selectors
        // (which sit at top-4, ~36-40px tall) rather than bottom-left, so
        // future debug affordances can grow downward in the same column
        // instead of needing their own spot on screen.
        <div className="fixed top-16 right-4 z-40 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleDebugKill}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white"
            data-testid="debug-kill-button"
          >
            Kill
          </button>
          <button
            type="button"
            onClick={handleDebugRespawn}
            className="rounded bg-green-600 px-3 py-1 text-sm text-white"
            data-testid="debug-respawn-button"
          >
            Respawn
          </button>
          <button
            type="button"
            onClick={handleToggleHitboxes}
            className={`rounded px-3 py-1 text-sm text-white ${debugHitboxesOn ? 'bg-amber-600' : 'bg-gray-600'}`}
            data-testid="debug-hitboxes-toggle"
          >
            Hitboxes: {debugHitboxesOn ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            onClick={handleOpenEditor}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            data-testid="debug-editor-button"
          >
            Editor
          </button>
        </div>
      )}
    </div>
  );
};
