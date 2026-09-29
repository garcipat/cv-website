import { useCallback, useEffect, useRef, useState } from 'react';
import { FloatingControls } from '@/components/FloatingControls';
import { createPlatformerSession } from './PlatformerSession';
import type { PhaseGates, PlatformerSession } from './PlatformerSession';
import {
  drawTerrain,
  drawPlayer,
  drawPickups,
  drawEnemies,
  drawBlocks,
  drawSigns,
  drawHazards,
  drawWaterForeground,
  drawBackgroundTiles,
  drawCheckpoints,
  drawDarkness,
  drawFog,
  drawEnemyEyes,
  drawHeldTorch,
  drawDeployableItems,
  drawCrumblingFloors,
} from './engine/render/SceneRenderer';
import { drawIrisOverlay, drawRestartPrompt, drawLowHealthGlow } from './engine/render/HudRenderer';
import { drawHud, layoutHud } from './engine/render/HudLayout';
import { buildHudModel } from './state/hudModel';
import type { CounterPopupLabelKey } from './contracts/counters';
import { drawBackgroundLayers } from './engine/BackgroundLayers';
import { createCloudField, drawAmbientClouds } from './engine/AmbientClouds';
import type { CloudField } from './engine/AmbientClouds';
import type { DrawContext } from './contracts/DrawContext';
import type { HitEffect } from './contracts/HitEffect';
import { drawDebugOverlay, drawCameraDeadZoneOverlay } from './engine/DebugOverlay';
import {
  stepPlayerPhysics,
  checkPitFall,
  resolvePitFall,
  playerOnMushroomCap,
} from './engine/Physics';
import { startMushroomSquash, MUSHROOM_BOUNCE_VY } from './tiles/bouncyMushroom';
import { resolveBlasts } from './engine/BombSystem';
import { resolveHitEffects } from './engine/HitResolver';
import type { BlockHitResult } from './engine/HitResolver';
import { DEFAULT_HIT_KNOCKBACK } from './shared/knockback';
import { stepEnemyHitReaction } from './entities/enemies/hitReaction';
import { updateCamera, updateCameraY } from './engine/Camera';
import { currentIrisRadius, maxIrisRadius } from './engine/GameLifecycle';
import { currentLevel, currentLayout, currentBackgroundLayout } from './state/levelSession';
import { findLevel } from './level/levelRegistry';
import {
  checkPickupCollisions,
  resolveEnemyContacts,
  checkSignOverlap,
  resolveHazardContacts,
  checkHazardArmTriggers,
  checkCrumblingFloorTriggers,
} from './engine/Collision';
import type { PickupHit } from './engine/Collision';
import type { PickupContext } from './contracts/Pickup';
import type { PickupKind } from './contracts/PickupKind';
import { bombDeployableItem } from './entities/deployableItems/Bomb';
import { proposeDeployableItemInteraction } from './entities/deployableItems';
import { resolveCheckpointContacts } from './engine/CheckpointLogic';
import { allChestsOpen } from './entities/chests';
import { stepBlockAnimation } from './engine/BlockAI';
import { isBlockUsedUp, isBlockRemoved, blockEffectAnchor } from './entities/Block';
import type { BlockState } from './entities/Block';
import { computePotRenderPlan } from './entities/blocks/potRenderPlan';
import type { PotRenderPlan } from './entities/blocks/potTypes';
import { tickFruit } from './entities/pickups/Fruit';
import type { BlockHitOutcome } from './entities/blocks/BlockType';
import {
  activeSpeechBubble,
  advanceEffects,
  beginSpeechBubbleEnter,
  beginSpeechBubbleExit,
  clearEffectsOfKind,
  drawEffects,
  effectCount,
  startFlyingText,
  createSlotAllocator,
  startCounterPopup,
  startPuffEffect,
  startHealAuraEffect,
  startPlayerHitSplatter,
  startEnemyHitSplatter,
  startSpearBloodSplatter,
  startFadeOutTextEffect,
  startExplosionEffect,
  startDebrisEffect,
  startSpeechBubble,
  crumbleDebrisLayers,
} from './engine/effects';
import type { EffectRenderContext } from './engine/effects';
import {
  fallingStalactiteLandingRow,
  fallingStalactiteOffsetYAt,
  fallingStalactiteRestOffsetY,
  fallingStalactiteShatter,
} from './entities/hazards/FallingStalactite';
import { typeOf as hazardTypeOf } from './entities/hazards';
import type { HazardTickContext } from './entities/hazards/HazardType';
import { crumblingFloorPhaseFor, CRUMBLING_FLOOR_CRACK_SECONDS } from './tiles/crumblingFloor';
import { createRewardReveal } from './state/rewards';
import { applyEnemyDefeats } from './state/enemyRewards';
import { RENDERED_TILE_SIZE, tileToPixel } from './level/Terrain';
import {
  advancePlayerAnimation,
  updatePlayerAnimState,
  advancePlayerHitTimer,
  isPlayerBlinkVisible,
  PLAYER_HIT_REACTION_SECONDS,
  PLAYER_RENDERED_SIZE,
  PLAYER_VISUAL_CENTER_Y_OFFSET,
  PLAYER_HEAD_PADDING,
  PLAYER_FOOT_PADDING,
  playerEffectAnchor,
} from './entities/Player';
import type { BlockContact } from './entities/Player';
import { playerLightSource } from './entities/Player';
import { torchLightSource } from './tiles/torch';
import type { LightSource } from './contracts/lighting';
import { strongerBounce } from './contracts/Outcome';
import { isInvulnerable } from './contracts/capabilities';
import { advanceEnemyAnimation, enemyEffectAnchor } from './entities/Enemy';
import {
  GROUND_ATLAS_SHEET,
  BACKGROUND_TILES_SHEET,
  STATIC_OBJECTS_SHEET,
  BACKGROUND_LAYERS_SHEET,
  BACKGROUND_LAYER_GRASS_SHEET,
  BACKGROUND_LAYER_RIVER_SHEET,
  AMBIENT_CLOUDS_SHEET,
  DECORATIONS_SHEET,
  TORCH_SHEET,
  MUSHROOM_SHEET,
  WORLD_TILESET_SHEET,
} from './entities/sprites/sheets';
import type { SpriteLookup } from './contracts/SpriteLookup';
import { typeOf } from './entities/enemies';
import type { MovementContext } from './entities/enemies/movement/MovementStrategy';
import type { EnemyTypeKey } from './entities/enemies';
import { PICKUP_TYPES } from './entities/pickups';
import { BLOCK_TYPES } from './entities/blocks';
import { CHECKPOINT_FLAG_SHEET, checkpointEffectAnchor } from './entities/Checkpoint';
import type { EnemyState } from './entities/Enemy';
import { healDamage, PIT_FALL_DAMAGE, isHealthCritical } from './entities/Health';
import {
  playerState,
  cameraPositionX,
  cameraPositionY,
  lifecycleState,
  resetGame,
  resetGameProgress,
  controlsOverlayDismissed,
  skillFactPool,
  pickupStores,
  pickupGroups,
  enemyStates,
  blockStates,
  cratesDestroyed,
  fruitStates,
  activeEffects,
  spawnEffect,
  refreshSpeechBubbleText,
  chestStates,
  endingScreenShown,
  endingScreenOpen,
  signPlacements,
  hazardPlacements,
  collectedKeys,
  MAX_BOMBS,
  carriedBombs,
  levelTotals,
  checkpointPlacements,
  checkpointStates,
  activeCheckpointId,
  respawnCenter,
  darknessLevel,
  tickDarkness,
  fogLevel,
  tickFog,
  torchPositions,
  deployableItems,
  activeLevel,
  tickDeployableItems,
  applyDeployableItemConsequences,
  mushroomSquashStates,
  tickMushroomSquashes,
  floorSpikeTimerStates,
  tickFloorSpikes,
  hazardPlacementsForTick,
  crumblingFloorTimerStates,
  armCrumblingFloorTrigger,
  tickCrumblingFloors,
  fallingStalactiteTimerStates,
  armHazardTrigger,
  tickFallingStalactites,
} from './PlatformerState';
import { useSignals } from '@preact/signals-react/runtime';
import { Journal } from './components/Journal';
import { ThankYouScreen } from './components/ThankYouScreen';
import { ControlsOverlay } from './components/ControlsOverlay';
import { navigateTo } from '@/state/navigation';
import { currentUI } from '@/state/locale';
import { hintText } from './state/hintText';
import type { CollectedFact } from './types';

export const PlatformerPage = () => {
  // Subscribes this component's render to any signal `.value` read during
  // it — needed for `endingScreenOpen.value` in the JSX below to actually
  // trigger a re-render when the game loop flips it (see PlatformerState.ts's
  // doc comment on `endingScreenOpen`). Same convention ThankYouScreen.tsx
  // already uses.
  useSignals();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Mirrors of the two scratch canvases the session owns and sizes (the
  // darkness/torch overlay layer and the 64×64 crouched-hit tint layer),
  // refreshed at the top of every frame so the draw pipeline reads them
  // directly.
  const darknessLayerRef = useRef<HTMLCanvasElement | null>(null);
  const hitTintLayerRef = useRef<HTMLCanvasElement | null>(null);
  // THE single sprite lookup: the live, path-keyed map the `AssetLoader` fills
  // from `SPRITE_MANIFEST`. Every image consumer — the render path through
  // `DrawContext.sprites` and the directly-read consumers below — indexes it by
  // source path; a key absent (not yet resolved, or failed) simply draws
  // nothing.
  const spritesRef = useRef<SpriteLookup>({});
  // THE one lifecycle controller. Created by the mount effect; the React
  // handlers below ask it for phase preconditions and transitions rather than
  // reading `lifecycleState` inline.
  const sessionRef = useRef<PlatformerSession | null>(null);
  const journalButtonRef = useRef<HTMLButtonElement>(null);
  // `?debug`/`?level` are dev-only conveniences and only take effect when
  // this page is reached via the dedicated `/platformer` route — not e.g.
  // `/` with the Platformer theme merely selected — so a stray `?debug=1` or
  // `?level=...` left on a shared homepage link never flips on dev tooling
  // for a regular visitor.
  const onPlatformerRoute = window.location.pathname === '/platformer';
  const debugParams = new URLSearchParams(window.location.search);
  // Any `debug` param (not just `hitboxes`) shows the debug panel (Kill/
  // Respawn/Hitboxes toggle below) — a dev convenience for exercising the
  // death/respawn iris transition and collision geometry without navigating
  // pits repeatedly, not a feature end users should see.
  const debugControls = onPlatformerRoute && debugParams.has('debug');
  // `?level=<id>` loads any level the Level Editor's own dropdown offers
  // i.e. anything in `levelRegistry.ts`'s `LEVELS` (built-ins plus saved
  // `levels/*.json` files). An id that isn't a real, selectable level (typo,
  // stale link, renamed/deleted file) is silently skipped and the game keeps
  // its shipped default — not a feature end users should see or rely on.
  const testLevelParam = onPlatformerRoute ? debugParams.get('level') : null;
  // `?debug=hitboxes` still seeds the initial toggle state (so the existing
  // "open at ?debug=hitboxes" manual-testing habit keeps working), but it's
  // now a runtime toggle via the panel button rather than fixed for the
  // session. Mirrored into a ref so the game loop's render() closure (set up
  // once in the mount effect below) reads the latest value without needing
  // to restart the effect on every toggle.
  const [debugHitboxesOn, setDebugHitboxesOn] = useState(
    () => onPlatformerRoute && debugParams.get('debug') === 'hitboxes',
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
   * Theme-switch reset (spec.md ): `App.tsx` mounts/unmounts
   * `PlatformerPage` whenever `currentTheme` changes, so a mount-only effect
   * fires exactly when a visitor switches into (or back into) the Platformer
   * theme. Every piece of game state this resets is module-level (see
   * PlatformerState.ts), so it would otherwise survive an unmount/remount
   * round-trip unchanged — the same durability that makes `resetGameProgress`
   * safe to call here, mirroring `handleResetGameRequested`'s full reset.
   * `controlsOverlayDismissed` is reset too, unlike Reset Game's deliberate
   * choice to leave it alone (the "session" is the same session for
   * Reset Game, but a genuinely new one for a theme switch).
   */
  useEffect(() => {
    const testLevel = testLevelParam ? findLevel(testLevelParam) : undefined;
    if (testLevel) {
      currentLayout.value = testLevel.layout;
      currentBackgroundLayout.value = testLevel.background ? [...testLevel.background] : [];
    }
    resetGameProgress();
    controlsOverlayDismissed.value = false;
    // The 'intro' phase is seeded by the session when it starts (FR-016):
    // `lifecycleState` is the session's to write, so this effect only prepares
    // state and leaves the phase to `PlatformerSession.start()`.
    // mount-only by design (see the doc comment above); testLevelParam is
    // read once here, not tracked across future renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Toggles the journal. Opening is only allowed from 'playing' (not
   * mid-death/intro/restart) and happens immediately. Closing is only
   * requested from here — the actual close (resuming the game, unmounting
   * Journal) happens in `handleJournalReallyClosed`, called by `Journal`
   * once its reverse-close animation finishes, so every trigger (icon,
   * `J`, and Journal's own in-book × button) closes the same animated way.
   */
  const handleJournalToggle = () => {
    const session = sessionRef.current;
    if (!session) return;
    if (!journalOpenRef.current) {
      if (!session.canPause()) return;
      session.pauseForJournal();
      setJournalOpen(true);
    } else {
      if (!session.canResume()) return;
      setJournalClosing(true);
    }
  };

  // Wrapped in useCallback (empty deps: it only reads/writes signals and
  // setState, nothing closed-over) so its identity is stable across renders
  // — Journal's frame-advancing effect depends on it, and a recreated
  // callback there would clear and reschedule the animation timer on every
  // render.
  const handleJournalReallyClosed = useCallback(() => {
    sessionRef.current?.resumeFromJournal();
    setJournalOpen(false);
    setJournalClosing(false);
  }, []);

  /**
   * Pauses/resumes the game loop while the floating theme/locale controls
   * (top-right, rendered below) are open — mirrors handleJournalToggle's
   * phase guards. Only pauses from 'playing' (so it's a no-op while the
   * journal or ending screen already own the pause), and only resumes if
   * nothing else is still the reason the game is paused.
   */
  const handleFloatingControlsOpenChange = (open: boolean) => {
    const session = sessionRef.current;
    if (!session) return;
    if (open) {
      if (!session.canPause()) return;
      session.pauseForJournal();
    } else {
      if (!session.canResume() || journalOpenRef.current || endingScreenOpen.value) return;
      session.resumeFromJournal();
    }
  };

  // Wrapped in useCallback (empty deps, same reasoning as
  // handleJournalReallyClosed above) since ThankYouScreen depends on it for
  // its own keydown-listener effect.
  //
  // Also drains the session's KeyboardInput here (`clearPendingInput()`): the
  // same physical keydown that dismisses this screen (e.g. Space) is also
  // seen by the session's own input listener and buffered as a pending
  // press. Flipping `gamePhase` to 'playing' happens synchronously above, so
  // the very next game-loop tick already skips the 'ending-screen' phase's
  // own `input.clearPending()` early-return — without this call, that
  // buffered Space would fire as a real jump on the next tick. This is the
  // same class of bug the 'paused' phase's `input.clearPending()` guards
  // against, just reappearing through this exit path.
  const handleDismissEndingScreen = useCallback(() => {
    const session = sessionRef.current;
    session?.dismissEndingScreen();
    endingScreenOpen.value = false;
    session?.clearPendingInput();
  }, []);

  /**
   * Reset Game (journal button): clears collected progress and
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
    const session = sessionRef.current;
    session?.snapCameraToRespawn();
    if (session) session.beginIntro(respawnCenter.value);
  };

  const handleDebugKill = () => {
    playerState.value = {
      ...playerState.value,
      hitPoints: 0,
      alive: false,
      animState: 'death',
      animFrame: 0,
      animTimer: 0,
    };
    const p = playerState.value;
    sessionRef.current?.beginDeath({
      x: p.x + PLAYER_RENDERED_SIZE / 2,
      y: p.y + PLAYER_VISUAL_CENTER_Y_OFFSET,
    });
    // Death immediately halts the effect-advance block in the frame, so
    // without this a bubble revealed just before dying would otherwise freeze
    // on screen through the whole death animation and the restart-prompt wait.
    activeEffects.value = clearEffectsOfKind(activeEffects.value, 'speechBubble');
  };

  const handleDebugRespawn = () => {
    resetGame();
    const session = sessionRef.current;
    session?.snapCameraToRespawn();
    if (session) session.beginIntro(respawnCenter.value);
  };

  /**
   * Debug-only shortcut into the Level Editor (dev convenience, same gating
   * as the Kill/Respawn/Hitboxes buttons above — see `debugControls`).
   * Deliberately does NOT touch `currentLayout`: the editor's own grid is
   * independent, localStorage-backed state (`editor/editorState.ts`)
   * that already restores itself on mount, regardless of whatever the game
   * is currently showing.
   */
  const handleOpenEditor = () => {
    navigateTo('/platformer/editor');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Read-only mirrors of the session's loop-owned values, refreshed at the
    // top of every frame so the draw pipeline below reads plain locals.
    let backgroundColor = '#000';
    let worldAnimElapsed = 0;
    let cloudField: CloudField = createCloudField(0, 0, 0);

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Re-resolve the active speech bubble's stored text before assembling the
      // effect render context, so a language switch updates a live bubble in
      // the same frame; a no-op in the steady state.
      refreshSpeechBubbleText();

      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Anchor the level to the bottom of the canvas so a taller viewport
      // shows more sky above the ground instead of empty space below it.
      const levelPixelHeight = currentLevel.value.height * RENDERED_TILE_SIZE;
      const originY = canvas.height - levelPixelHeight + cameraPositionY.value;
      const originX = -cameraPositionX.value;

      const backdropLayers = spritesRef.current[BACKGROUND_LAYERS_SHEET.src];
      const backdropGrass = spritesRef.current[BACKGROUND_LAYER_GRASS_SHEET.src];
      const backdropRiver = spritesRef.current[BACKGROUND_LAYER_RIVER_SHEET.src];
      if (backdropLayers && backdropGrass && backdropRiver) {
        drawBackgroundLayers(
          ctx,
          {
            layers: backdropLayers,
            grass: backdropGrass,
            river: backdropRiver,
          },
          canvas.width,
          canvas.height,
          cameraPositionX.value,
          worldAnimElapsed,
        );
      }

      // The ambient cloud layer: its own right-to-left drift plus a
      // small camera-linked parallax shift at the painted clouds/hills band's
      // factor, drawn immediately above the backdrop and behind everything
      // else.
      drawAmbientClouds(
        ctx,
        spritesRef.current[AMBIENT_CLOUDS_SHEET.src],
        cloudField,
        cameraPositionX.value,
      );

      // Built before the 'terrain' band (it used to be built after the ladder
      // draw): the deployable-item draw dispatch needs it at every band, and
      // the pot plan computation is order-independent.
      const drawContext: DrawContext<PotRenderPlan> = {
        ctx,
        sprites: spritesRef.current,
        originX,
        originY,
        worldElapsed: worldAnimElapsed,
        potPlan: computePotRenderPlan(blockStates.value),
      };

      const tileset = spritesRef.current[WORLD_TILESET_SHEET.src];
      const groundAtlas = spritesRef.current[GROUND_ATLAS_SHEET.src];
      const backgroundTiles = spritesRef.current[BACKGROUND_TILES_SHEET.src];
      const staticObjects = spritesRef.current[STATIC_OBJECTS_SHEET.src];
      const decorations = spritesRef.current[DECORATIONS_SHEET.src];
      const torchSheet = spritesRef.current[TORCH_SHEET.src];
      const mushroomSheet = spritesRef.current[MUSHROOM_SHEET.src];

      if (tileset) {
        if (backgroundTiles) {
          drawBackgroundTiles(
            ctx,
            currentLevel.value,
            backgroundTiles,
            originX,
            originY,
            decorations,
          );
        }
        if (groundAtlas) {
          drawTerrain(
            ctx,
            currentLevel.value,
            tileset,
            groundAtlas,
            originX,
            originY,
            staticObjects,
            decorations,
            torchSheet,
            worldAnimElapsed,
            mushroomSheet,
            mushroomSquashStates.value,
          );
        }
        // Terrain-level band: the rope ladder's rolled bundle and deployed
        // shaft, drawn over the terrain it was placed on.
        drawDeployableItems(ctx, deployableItems.value, drawContext, 'terrain');
        drawSigns(ctx, signPlacements.value, tileset, originX, originY);
      }

      // Read once per frame: the page never names a pickup kind, it just
      // hands the same kind→array groups to `drawPickups` at each band.
      const pickupGroupValues = pickupGroups.value;

      // One render context per frame, shared by the four `drawEffects` layer
      // invocations below. The whole HUD is built once here as data (FR-013);
      // the counter popups read its resolved `popupIcons` and the same model
      // is drawn as the HUD row at the end of the frame.
      const hudModel = buildHudModel(spritesRef.current);
      const effectRenderContext: EffectRenderContext = {
        ctx,
        dc: drawContext,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        playerAnchor: {
          centerX: playerState.value.x + PLAYER_RENDERED_SIZE / 2 + originX,
          centerY: playerState.value.y + PLAYER_VISUAL_CENTER_Y_OFFSET + originY,
          width: PLAYER_RENDERED_SIZE,
          // The player's actual visible head (render-slot top plus
          // PLAYER_HEAD_PADDING) — the speech bubble's tail anchor. The slot has
          // transparent padding above the head, so using it directly would float
          // the bubble noticeably higher than the character.
          headBottomY: playerState.value.y + PLAYER_HEAD_PADDING + originY,
        },
        popupIcons: hudModel.popupIcons,
        effects: activeEffects.value,
      };

      // Drawn BEFORE blocks: a bonus fruit spawns at its source block's own
      // position and rises through it — drawing it first lets the block's
      // own tile occlude the still-rising fruit until it clears the block's
      // top edge, reading as "popping out from behind the block" instead of
      // floating on top of it.
      drawPickups(ctx, pickupGroupValues, drawContext, 'belowBlocks');

      drawBlocks(ctx, blockStates.value, drawContext);

      // After-blocks band: the placed bomb's lit fuse frames.
      drawDeployableItems(ctx, deployableItems.value, drawContext, 'afterBlocks');

      drawHazards(ctx, hazardPlacementsForTick(), drawContext);

      drawCrumblingFloors(ctx, currentLevel.value, crumblingFloorTimerStates.value, drawContext);

      // After-crumbling-floors band: the chest, at its own depth.
      drawDeployableItems(ctx, deployableItems.value, drawContext, 'afterCrumblingFloors');

      drawCheckpoints(
        ctx,
        checkpointStates.value,
        spritesRef.current[CHECKPOINT_FLAG_SHEET.src],
        activeCheckpointId.value,
        drawContext,
      );

      const playerSprite = spritesRef.current['/sprites/knight.png'];
      if (playerSprite) {
        // A directional hit (enemy/hazard, both knock the player back) is
        // always visible — its `hit` animState (3rd frame red-tinted) IS the
        // "just got hurt" signal. `death` is likewise always visible — it's
        // its own dedicated animation, not a blink cue, regardless of
        // whatever `hitTimer` the killing hit happened to leave behind. A
        // pit fall has no attacker to react to, so it's the only case left
        // that stays on the old invulnerability blink (see Player.ts's
        // beginPitFallReaction/applyHitReaction doc comments for why these
        // diverge).
        const playerVisible =
          playerState.value.animState === 'hit' ||
          playerState.value.animState === 'death' ||
          !isInvulnerable(playerState.value, PLAYER_HIT_REACTION_SECONDS) ||
          isPlayerBlinkVisible(playerState.value.hitTimer);
        drawPlayer(
          ctx,
          playerState.value,
          playerSprite,
          originX,
          originY,
          spritesRef.current['/sprites/knight2.png'],
          playerVisible,
          hitTintLayerRef.current,
        );
        // The very small torch the player carries, only while walking — drawn
        // with the player so the player's own light reveals it.
        if (playerVisible) {
          drawHeldTorch(
            ctx,
            playerState.value,
            torchSheet,
            darknessLevel.value,
            originX,
            originY,
            worldAnimElapsed,
          );
        }
      }

      // Mid-world layer: the heal aura sits over the player, under collectibles.
      drawEffects(effectRenderContext, 'midWorld', activeEffects.value);

      drawPickups(ctx, pickupGroupValues, drawContext, 'beforeEnemies');

      drawEnemies(ctx, enemyStates.value, drawContext);

      drawPickups(ctx, pickupGroupValues, drawContext, 'afterEnemies');

      // Very-foreground water band, anchored to the LEVEL's bottom edge (not
      // the viewport) — drawn after every world entity so it sits in front
      // of the player/enemies, same camera-scroll originX/originY as
      // drawTerrain so it stays attached to the level rather than the screen.
      if (tileset) {
        drawWaterForeground(
          ctx,
          currentLevel.value,
          tileset,
          canvas.width,
          canvas.height,
          originX,
          originY,
        );
      }

      // Outside-a-cave fog: drawn over the whole world (background, terrain,
      // player, enemies, pickups, water) but before every HUD/UI pass below,
      // same placement as the darkness overlay it is mutually exclusive with
      //.
      drawFog(ctx, currentLevel.value, fogLevel.value, originX, originY, worldAnimElapsed, {
        x: playerState.value.x + PLAYER_RENDERED_SIZE / 2,
        y: playerState.value.y + PLAYER_VISUAL_CENTER_Y_OFFSET,
      });

      // Cave-darkness overlay: drawn over the whole world (background,
      // terrain, player, enemies, pickups, water) but before every HUD/UI
      // pass below, so hearts, counters, hint bubbles and popups stay fully
      // readable. Each torch punches a warm, mildly pulsing pool
      // back through it, anchored to the torch's world position.
      //
      // The single `LightSource[]` is assembled per frame — only when dark
      // by adapting each torch with the frame's `worldElapsed` and appending
      // the player's carried light. No resolved radius enters a signal
      //; at `darknessLevel <= 0` no list is built and neither light
      // pass runs.
      if (darknessLevel.value > 0) {
        const lights: LightSource[] = [
          ...torchPositions.value.map((torch) => torchLightSource(torch, worldAnimElapsed)),
          playerLightSource(playerState.value),
        ];

        if (darknessLayerRef.current) {
          drawDarkness(
            ctx,
            darknessLayerRef.current,
            canvas.width,
            canvas.height,
            darknessLevel.value,
            lights,
            originX,
            originY,
          );
        }

        // Enemy eye markers are drawn AFTER the darkness overlay so they stay
        // visible through it, but before the speech bubble/UI below.
        drawEnemyEyes(
          ctx,
          enemyStates.value,
          darknessLevel.value,
          lights,
          worldAnimElapsed,
          originX,
          originY,
        );
      }

      // World-effects layer: registry declaration order fixes the intra-layer
      // sequence speechBubble → flyingText → puff → debris → hitSplatter →
      // fadeOutText, so the speech bubble keeps its depth after the
      // darkness/enemy-eye overlay and before the other world effects.
      drawEffects(effectRenderContext, 'worldEffects', activeEffects.value);

      // Explosions sit above the world effects and below the HUD — a bright,
      // short-lived burst that reads over the terrain but never over the
      // counters.
      drawEffects(effectRenderContext, 'aboveWorld', activeEffects.value);

      // Counter popups are drawn last, after the enemy-eye/hint/UI work. The
      // row's fixed coins/fruits/enemies/crates layout lives in the effect
      // module (see counterPopup.ts).
      drawEffects(effectRenderContext, 'hudLast', activeEffects.value);

      if (debugHitboxesRef.current) {
        drawDebugOverlay(
          ctx,
          playerState.value,
          currentLevel.value,
          originX,
          originY,
          enemyStates.value,
          hazardPlacements.value,
        );
        drawCameraDeadZoneOverlay(ctx, canvas.width, canvas.height);
      }

      // The HUD is one model + one layout + one drawer (FR-013/SC-003): the
      // page names no sprite frame, chains no counter X and reads no
      // per-kind counter state here.
      drawHud(ctx, hudModel);

      if (
        session.phase() === 'playing' &&
        isHealthCritical(playerState.value.hitPoints)
      ) {
        drawLowHealthGlow(ctx, canvas.width, canvas.height, worldAnimElapsed);
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
      if (
        lifecycle.phase !== 'playing' &&
        lifecycle.phase !== 'paused' &&
        lifecycle.phase !== 'ending-screen'
      ) {
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

    /**
     * The page's per-frame composition, injected into the controller. The
     * session decides *what* a frame may do (its gates); the page owns the
     * world step and the draw pipeline (see research D13/SC-005).
     */
    const runFrame = (dt: number, gates: PhaseGates) => {
      // The session owns these; mirror them so the pipeline reads plain locals.
      const runtime = session.runtime();
      backgroundColor = runtime.backgroundColor;
      cloudField = runtime.cloudField;
      worldAnimElapsed = runtime.worldElapsed;
      darknessLayerRef.current = runtime.darknessLayer;
      hitTintLayerRef.current = runtime.hitTintLayer;

      if (gates.advanceEffectKinds !== 'all') {
        // 'dying' / 'awaitingRestart' / 'paused' / 'ending-screen': no world
        // step, just the phase's own advance (if any) and a repaint.
        if (gates.advanceLifecycle) {
          session.advanceLifecycle(dt);
        }
        if (gates.advancePlayerAnimation) {
          // The player's 'death' animState plays out once during the lead-in
          // before the iris starts closing (see GameLifecycle.ts's
          // DEATH_ANIM_SECONDS); once it ends this stops advancing, holding
          // the last (collapsed) frame for the remainder of the phase.
          playerState.value = advancePlayerAnimation(playerState.value, dt);
        }
        if (gates.advanceEffectKinds !== 'none') {
          // The spear's blood burst is spawned on the kill tick and must keep
          // spraying through the death lead-in; every other effect's elapsed
          // stays exactly as it was.
          activeEffects.value = advanceEffects(activeEffects.value, dt, {
            kinds: gates.advanceEffectKinds,
          });
        }
        render();
        return;
      }

      // The world step is the only reader of input, and only once the session
      // has created it (i.e. after start()).
      const input = session.keyboard();
      if (!input) {
        render();
        return;
      }

      // Darkness is eased here, in the `playing` branch only, so it freezes
      // with the rest of the world during pause/death.
      tickDarkness(dt);

      // Fog is eased here too, in the `playing` branch only, so it freezes
      // with the rest of the world during pause/death, same as darkness
      //.
      tickFog(dt);

      // In-progress rope-ladder unrolls advance here too, so they freeze with
      // the world on pause/death.
      tickDeployableItems(dt);

      // In-progress bouncy-mushroom cap dips advance here too, freezing with
      // the world on pause/death.
      tickMushroomSquashes(dt);

      // In-progress floor spike cycles advance here too, freezing with the
      // world on pause/death.
      tickFloorSpikes(dt);

      // In-progress crumbling floor cycles advance here too, freezing with
      // the world on pause/death.
      tickCrumblingFloors(dt);

      // Falling stalactites advance here too, so their shake/fall
      // timelines freeze with the world on pause/death.
      tickFallingStalactites(dt);

      // Computed once per tick and shared by every reveal site below — these
      // same two expressions used to be duplicated in the enemy-defeat block
      // and the collectible block. `originX`/`originY` convert a world-space
      // entity position into the screen-space coordinates FlyingTextEffect
      // requires (see engine/effects/flyingText.ts's doc comment); the level is
      // anchored to the bottom of the canvas, same as render()'s own copy.
      const levelPixelHeight = currentLevel.value.height * RENDERED_TILE_SIZE;
      const originX = -cameraPositionX.value;
      const originY = canvas.height - levelPixelHeight + cameraPositionY.value;
      // ONE slot allocator for the whole tick, shared by the reveal trigger
      // and the key pickup below — two flying texts appearing in the same tick
      // must never land on the same vertical row, which takes a single counter
      // across every flying-text site (see createSlotAllocator's doc comment).
      // Seeded from the number of fact-flying-text effects still in the air from
      // previous ticks (already filtered for 'done' ones at the end of the
      // previous tick — see the activeEffects tick/filter below).
      const allocateSlotOffset = createSlotAllocator(
        effectCount(activeEffects.value, 'flyingText'),
      );
      // The one fact-reveal trigger every reveal site below goes through.
      const journalButtonRect = journalButtonRef.current?.getBoundingClientRect() ?? null;
      // journalButtonRect is viewport-relative (getBoundingClientRect), but
      // every other coordinate the flying-text effect uses (originX/originY,
      // canvasWidth/canvasHeight) is canvas-local. That was harmless while
      // the canvas filled the viewport from (0,0), but now that a short
      // level leaves the canvas vertically centered within a taller
      // viewport (see the wrapper's comment near the canvas JSX below), the
      // viewport offset must be subtracted out or the flying text lands wherever
      // the button would be if the canvas started at the viewport's origin.
      const canvasRect = canvas.getBoundingClientRect();
      const journalRect = journalButtonRect
        ? new DOMRect(
            journalButtonRect.left - canvasRect.left,
            journalButtonRect.top - canvasRect.top,
            journalButtonRect.width,
            journalButtonRect.height,
          )
        : null;
      const revealFact = createRewardReveal({
        originX,
        originY,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        journalRect,
        allocateSlotOffset,
      });

      // Enemies currently reacting to a stomp (animState 'hit') run their
      // reaction timer instead of moving — stepEnemyHitReaction either
      // holds them frozen, reverts them to their kind's own default state, or
      // flags them `alive: false` once the reaction finishes (a type module's
      // own `onPlayerCollide` is what put
      // them into 'hit' in the first place, below). A dead enemy (`!alive`)
      // is skipped entirely — it stays in the array but is neither moved
      // nor animated.
      //
      // The movement step also needs to know about currently-live blocks
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
      // One context per tick, shared by every enemy that tick. The player box
      // feeds proximity strategies (chase); `elapsed` is the existing shared
      // world clock the fly bob's phase reads, so the bob freezes with the
      // world on pause/death and resumes on the same phase.
      const movementCtx: MovementContext = {
        level: currentLevel.value,
        blockedTiles,
        player: {
          x: playerState.value.x,
          y: playerState.value.y,
          width: PLAYER_RENDERED_SIZE,
          height: PLAYER_RENDERED_SIZE,
        },
        elapsed: worldAnimElapsed,
        crumblingFloorStates: crumblingFloorTimerStates.value,
      };
      const stepEnemy = (enemy: EnemyState): EnemyState => {
        const next =
          enemy.animState === 'hit'
            ? stepEnemyHitReaction(enemy, dt)
            : typeOf(enemy).movement.step(enemy, movementCtx, dt);
        return advanceEnemyAnimation(typeOf(next).onTick?.(next, dt) ?? next, dt);
      };
      enemyStates.value = enemyStates.value.map((enemy) =>
        enemy.alive ? stepEnemy(enemy) : enemy,
      );

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
      fruitStates.value = fruitStates.value.map((fruit) => tickFruit(fruit, dt));

      // Enemies whose hit reaction just finished with no hit points left
      // (`!alive`): the shared reward applier (`state/enemyRewards.ts`) fires
      // each kind's own `DefeatApi`-driven `onDefeat` hook (a pickup spawn, a
      // per-fact reveal, a per-defeat counter bump) and owns the
      // unconditional per-death puff plus the `rewardGiven`/`deathEffectGiven`
      // gating. The page names no enemy or drop kind.
      //
      // `alive` goes false on the finishing stomp; `deathEffectGiven` is set
      // the same tick (by the applier) and resets on revive, so a revived
      // enemy stomped again in a later life IS selected here again — its new
      // death still deserves its own puff. `rewardGiven` is separate and
      // permanent: it gates whether anything is actually paid out, not
      // whether the enemy is selected. See .
      const justDefeated = enemyStates.value.filter((e) => !e.alive && !e.deathEffectGiven);
      if (justDefeated.length > 0) {
        applyEnemyDefeats(justDefeated, { revealFact, originX, originY });
      }

      // ONE advance replaces the six byte-identical per-kind tick bodies plus
      // the flying-text phase and counter-popup plumbing. Each effect's registered
      // tick/expiry reproduces its exact boundary.
      activeEffects.value = advanceEffects(activeEffects.value, dt);

      // ONE generic collect path. The shared collision entry point returns
      // every eligible hit keyed by kind; the applier flags each kind's hits
      // `collected` (the ONE collect-once action) and applies that kind's
      // declared consequences uniformly. The page names no kind.
      const pickupHits = checkPickupCollisions(playerState.value, pickupGroups.value, {
        playerHitPoints: playerState.value.hitPoints,
        capacity: Math.max(0, MAX_BOMBS - carriedBombs.value),
      });
      if (pickupHits.length > 0) {
        // Group the hits by kind, preserving the collision path's order.
        const hitsByKind = new Map<PickupKind, PickupHit[]>();
        for (const hit of pickupHits) {
          const bucket = hitsByKind.get(hit.kind);
          if (bucket) bucket.push(hit);
          else hitsByKind.set(hit.kind, [hit]);
        }

        for (const [kind, hits] of hitsByKind) {
          const pickupType = PICKUP_TYPES[kind];
          const ids = new Set(hits.map((hit) => hit.state.id));
          // Seed the pre-tick already-collected count and advance it per
          // processed hit, so several same-tick coins reveal successive fact
          // windows exactly as the old coinsCollectedSoFar loop did.
          let collectedBefore = pickupStores[kind].items.filter((item) => item.collected).length;
          const outcomes = hits.map((hit) => {
            const context: PickupContext = {
              pool: skillFactPool.value,
              total: levelTotals.value.coins,
              collectedBefore,
            };
            const outcome = pickupType.onPickup(hit.state, context);
            collectedBefore += 1;
            return { hit, outcome };
          });

          // The ONE collect-once action: flag every hit, retaining it.
          pickupStores[kind].markCollected(ids);

          let counterKeyToBump: CounterPopupLabelKey | undefined;
          let healedAmount: number | undefined;
          for (const { hit, outcome } of outcomes) {
            const hitState = hit.state;
            if (outcome.facts) {
              for (const reveal of outcome.facts) {
                revealFact(reveal.fact, {
                  x: hitState.x,
                  y: hitState.y,
                  effectId: reveal.effectId,
                  counterKey: reveal.counterKey,
                });
              }
            }
            // The counter popup is bumped once per tick with the tick-final
            // count, not once per reveal (a coin's reward is resolved
            // dynamically and most coins reveal no fact).
            if (outcome.counterKey) counterKeyToBump = outcome.counterKey;
            if (outcome.heal !== undefined) healedAmount = outcome.heal;
            if (outcome.bombs) carriedBombs.value += outcome.bombs;
            if (outcome.bankKey) collectedKeys.value += 1;
            if (outcome.flyingText) {
              const text = outcome.flyingText;
              // The key pickup's flying text takes its slot from the SAME
              // per-tick allocator the reveal trigger uses, so a key collected
              // alongside a fact reveal can't land on that fact's row.
              const stackOffsetY = allocateSlotOffset();
              const midX = canvas.width / 2;
              const midY = canvas.height * 0.3;
              let targetX = canvas.width - 32;
              let targetY = canvas.height - 32;
              if (text.target === 'keyCounter') {
                const hudCtx = canvas.getContext('2d');
                // The key counter's own laid-out position, from the same
                // model+layout the HUD row is drawn with — the page names no
                // counter X and chains none (SC-003).
                const placedKey = hudCtx
                  ? layoutHud(hudCtx, buildHudModel(spritesRef.current)).counters.find(
                      (placed) => placed.key === 'keys',
                    )
                  : undefined;
                if (placedKey) {
                  targetX = placedKey.x;
                  targetY = placedKey.y;
                }
              }
              spawnEffect(
                startFlyingText(
                  text.effectId,
                  text.label,
                  text.x + originX,
                  text.y + originY + stackOffsetY,
                  midX,
                  midY + stackOffsetY,
                  targetX,
                  targetY,
                ),
              );
            }
          }

          if (healedAmount !== undefined) {
            // Heal once per kind per tick (matching the former single heal),
            // but spawn one aura per healing hit.
            playerState.value = {
              ...playerState.value,
              hitPoints: healDamage(playerState.value.hitPoints, healedAmount),
            };
            for (const { hit, outcome } of outcomes) {
              if (outcome.heal !== undefined) spawnEffect(startHealAuraEffect(hit.state.id));
            }
          }

          if (counterKeyToBump) {
            spawnEffect(
              startCounterPopup(
                counterKeyToBump,
                collectedBefore,
                levelTotals.value[counterKeyToBump],
              ),
            );
          }
        }
      }

      // Chests don't open on touch like every other collectible — spec.md
      // requires an explicit Arrow Up press
      // while standing on one (KeyW also works, mirroring the A/D-as-
      // Left/Right convention — see ). `originX`/`originY` are already
      // in scope from this tick's earlier collision blocks above.
      //
      // Both must be evaluated (not short-circuited) since consumePress has
      // the side effect of clearing the pending press it finds — an `||`
      // between the two calls directly would skip consuming the second
      // key's pending press whenever the first already returned true.
      const arrowUpPressed = input.consumePress('ArrowUp');
      const wPressed = input.consumePress('KeyW');
      const interactPressed = arrowUpPressed || wPressed;

      // The one shared interaction dispatch, run every tick (not just inside
      // `if (interactPressed)`) so the "standing on a closed chest with no key"
      // hint below keeps working and its exit condition is evaluated. It offers
      // an activation to the single best-`interactionPriority` entry (the
      // rope-ladder bundle's 0 outranks the chest's 1, so one Up press deploys
      // at most one bundle and never also opens a chest) and returns
      // declarative data — the page names no deployable-item kind.
      const interaction = proposeDeployableItemInteraction(deployableItems.value, {
        level: currentLevel.value,
        player: playerState.value,
        keys: collectedKeys.value,
      });
      if (interactPressed && interaction.activate) {
        const { id, next, keyCost, reveal } = interaction.activate;
        deployableItems.value = deployableItems.value.map((item) =>
          item.id === id ? (next as typeof item) : item,
        );
        if (keyCost > 0) collectedKeys.value -= keyCost;
        if (reveal) {
          revealFact(reveal.fact, {
            x: reveal.x,
            y: reveal.y,
            effectId: reveal.effectId,
            counterKey: reveal.counterKey,
          });
        }
      }
      const bundleDeployedThisTick = interactPressed && interaction.activate !== undefined;

      // : revealed like a chest — stand on a sign (or, per the same
      // convention, a locked chest with zero keys) and press Up/W
      // (interactPressed, consumed above for the shared dispatch) — but
      // reusable (not dedup-tracked) and hidden again automatically the
      // instant the player leaves overlap, with no keypress needed to dismiss
      // it. The bubble is advanced by the single `advanceEffects` above, like
      // every other effect; this block only drives its trigger transitions.
      const overlappingSignHintId = checkSignOverlap(playerState.value, signPlacements.value);
      // A `blocked` interaction outcome is the chest's own `noKeyForChest`
      // hint text (spec.md's i18n `platformer.hints`) — distinct from
      // `chestNeedsKey` (a hint-SIGN's informational rule text) even though
      // both used to share one key before this was split: a bubble anchored
      // above the player's own head reads as the character SPEAKING ("I need a
      // key."), not as a sign's third-person rule, and the two must stay
      // independently translatable. Signs take priority in the vanishingly
      // unlikely case a chest and a sign tile overlap. A chest just
      // successfully opened this same tick no longer returns the blocked hint
      // (the dispatch only blocks a closed chest with no key), so no bubble
      // shows for that case.
      const overlappingHintId = overlappingSignHintId ?? interaction.hint;
      const currentBubble = activeSpeechBubble(activeEffects.value);
      if (overlappingHintId && interactPressed && !bundleDeployedThisTick) {
        if (!currentBubble || currentBubble.state.messageId !== overlappingHintId) {
          spawnEffect(startSpeechBubble(overlappingHintId, hintText.value[overlappingHintId]));
        } else if (currentBubble.state.phase === 'exiting') {
          // Pressed Up again before the previous reveal finished leaving
          // restart the entrance rather than leaving it stuck exiting.
          spawnEffect(beginSpeechBubbleEnter(currentBubble));
        }
        // Already 'entering'/'shown' for this exact sign/chest: a repeat
        // press while it's already up is a harmless no-op.
      } else if (!overlappingHintId && currentBubble && currentBubble.state.phase !== 'exiting') {
        spawnEffect(beginSpeechBubbleExit(currentBubble));
      }

      // Arm any at-rest floor spike the player just stepped onto, or hanging
      // falling stalactite whose detection zone the player just entered
      // — before resolving hazard contacts below, so a hazard armed
      // this same tick is still correctly non-hazardous (a floor spike's phase
      // right after arming is 'delay', never 'fullExtend'; a stalactite's is
      // 'shaking', never 'falling'). Each kind's own `armTriggerRects` supplies
      // the eligible hazard's trigger rects; the generic `armHazardTrigger`
      // dispatches the arming action by hazard kind.
      const hazardTickContext: HazardTickContext = {
        floorSpikeTimers: floorSpikeTimerStates.value,
        fallingStalactiteTimers: fallingStalactiteTimerStates.value,
        activeLevel: activeLevel.value,
        blockStates: blockStates.value,
        crumblingFloorTimers: crumblingFloorTimerStates.value,
      };
      for (const id of checkHazardArmTriggers(
        playerState.value,
        hazardPlacements.value,
        hazardTickContext,
      )) {
        armHazardTrigger(id);
      }

      // Arm any at-rest crumbling floor tile the player just stepped onto
      // — keyed by grid cell rather than hazard id.
      for (const { col, row } of checkCrumblingFloorTriggers(
        playerState.value,
        activeLevel.value,
        crumblingFloorTimerStates.value,
      )) {
        armCrumblingFloorTrigger(col, row);
      }

      // Spawn the falling-debris effect exactly once, on the tick a tile's
      // phase actually becomes 'broken'. `tickCrumblingFloors(dt)` already
      // ran above this same tick, so `state.elapsed` here is the
      // POST-advance elapsed time; `state.elapsed - dt` recovers what
      // elapsed was immediately before this tick's advance (the two calls
      // share the same `dt`). A tile is caught here exactly once because
      // elapsed strictly increases every tick a cycle is running: the
      // pre-tick value is below CRUMBLING_FLOOR_CRACK_SECONDS on (and only
      // on) the single tick that crosses the crack->broken boundary — every
      // later tick while still broken has a pre-tick elapsed already past
      // that threshold, so the check is false and nothing spawns again.
      for (const state of crumblingFloorTimerStates.value) {
        if (
          crumblingFloorPhaseFor(crumblingFloorTimerStates.value, state.col, state.row) !== 'broken'
        )
          continue;
        const justBroken = state.elapsed - dt < CRUMBLING_FLOOR_CRACK_SECONDS;
        if (!justBroken) continue;
        const { x, y } = tileToPixel(state.col, state.row);
        const debrisId = `crumble-${state.col}-${state.row}-${state.elapsed}`;
        // World-space position, not screen-space — the debris draw adds
        // dc.originX/originY itself at draw time (same convention puffs use),
        // so adding it again here would double-offset.
        spawnEffect(startDebrisEffect(debrisId, x, y, crumbleDebrisLayers()));
      }

      // Spawn the falling stalactite's shatter debris exactly once, on the
      // tick its fall first reaches its landing row. Same
      // `elapsed - dt` just-crossed guard as the crumbling floor above, so
      // the effect can never spawn twice; a hazard with no landing below it
      // despawns off the bottom with no debris. The landing row is
      // re-resolved here from the live block/crumbling state, so a floor that
      // broke mid-fall is respected.
      for (const state of fallingStalactiteTimerStates.value) {
        const hazard = hazardPlacements.value.find((h) => h.id === state.id);
        if (!hazard) continue;
        const landingRow = fallingStalactiteLandingRow(
          activeLevel.value,
          blockStates.value,
          crumblingFloorTimerStates.value,
          hazard.col,
          hazard.row,
        );
        if (landingRow === null) continue;
        // The offset at which the sprite's bottom meets the landing solid
        // one sprite-height above the landing row's top, so the shatter fires
        // as it comes to rest rather than after it has sunk into the floor.
        const restOffset = fallingStalactiteRestOffsetY(hazard, landingRow);
        if (restOffset === null) continue;
        const justLanded =
          fallingStalactiteOffsetYAt(state.elapsed - dt) < restOffset &&
          fallingStalactiteOffsetYAt(state.elapsed) >= restOffset;
        if (!justLanded) continue;
        const shatter = fallingStalactiteShatter(hazard, landingRow);
        spawnEffect(
          startDebrisEffect(
            `stalactite-${hazard.id}-${state.elapsed}`,
            shatter.x,
            shatter.y,
            shatter.layers,
          ),
        );
      }

      // Hazard contacts are resolved BEFORE enemy contacts, so a lethal floor
      // spear can win the tick. A lethal tip landing drops health
      // straight to zero with no `takeDamage`, no knockback, no hit animation
      // and no splatter; the flags below then suppress the
      // enemy-damage and ordinary-hazard-damage blocks for this tick, while
      // enemy contact resolution still runs so a same-tick stomp still merges
      // its enemy state. `hazardPlacementsForTick()` merges each floor
      // spike's live cycle phase in (just-armed included) so its `isContact`
      // sees the right phase this same tick.
      const hazardContacts = resolveHazardContacts(playerState.value, hazardPlacementsForTick());
      const spearKilled = hazardContacts.lethal !== undefined;
      if (spearKilled) {
        // The spear deals the player's whole current health, at a site that
        // skips the invulnerability guard.
        playerState.value = resolveHitEffects(playerState.value, [
          { type: 'damage', amount: playerState.value.hitPoints },
        ]).player;
        const spearAnchor = playerEffectAnchor(playerState.value, originX, originY, 'feet');
        spawnEffect(
          startSpearBloodSplatter(
            `spear-${effectCount(activeEffects.value, 'hitSplatter')}`,
            spearAnchor.x,
            spearAnchor.y,
          ),
        );
      }

      // One pass over the enemies: the engine computes each overlap's
      // geometry, each enemy's own type decides what that overlap means, and
      // the aggregated result lands here. Invulnerability is the engine's rule,
      // not any enemy's — no type ever knows it exists.
      const contacts = resolveEnemyContacts(playerState.value, enemyStates.value);
      enemyStates.value = contacts.enemies;

      if (contacts.damagedEnemyIds.length > 0) {
        for (const id of contacts.damagedEnemyIds) {
          const enemy = contacts.enemies.find((e) => e.id === id);
          if (!enemy) continue;
          const anchor = enemyEffectAnchor(enemy);
          const topY = typeOf(enemy).box(enemy).y + originY;
          spawnEffect(
            startEnemyHitSplatter(
              `${id}-${effectCount(activeEffects.value, 'hitSplatter')}`,
              anchor.x + originX,
              topY,
              enemy.type as EnemyTypeKey,
            ),
          );
        }
      }

      if (contacts.bounceEffects.length > 0) {
        // Unguarded: a stomp still bounces the player mid-invulnerability.
        playerState.value = resolveHitEffects(playerState.value, contacts.bounceEffects).player;
      }

      // Dropped while inside the refractory window, so one persisting overlap
      // can't register a fresh hit every tick; also skipped when the spear
      // already killed this tick.
      if (
        contacts.hitEffects.length > 0 &&
        !spearKilled &&
        !isInvulnerable(playerState.value, PLAYER_HIT_REACTION_SECONDS)
      ) {
        // A crouched hit keeps the damage and red reaction but drops the
        // velocity, so the one-tile box can never be displaced into a ceiling.
        const effects: HitEffect[] = playerState.value.crouching
          ? contacts.hitEffects.filter((effect) => effect.type !== 'velocity')
          : [...contacts.hitEffects];

        // No splatter on the killing blow — the death iris-out is centred on
        // the character, so a debris burst there would read as covering it up.
        const applied = resolveHitEffects(playerState.value, effects);
        playerState.value = applied.player;
        if (applied.player.alive) {
          const anchor = playerEffectAnchor(applied.player, originX, originY, 'center');
          spawnEffect(
            startPlayerHitSplatter(
              `player-${effectCount(activeEffects.value, 'hitSplatter')}`,
              anchor.x,
              anchor.y,
              -contacts.knockbackDirection as -1 | 1,
            ),
          );
        }
      }

      // Ordinary (non-lethal) hazards: an independent damage source, sequenced
      // after the enemy block so an enemy hit this tick opens the refractory
      // window and this block's own `isInvulnerable` check skips — "at most one
      // hit per tick" for free. Also skipped when the spear killed this tick.
      if (
        hazardContacts.hazard !== undefined &&
        !spearKilled &&
        !isInvulnerable(playerState.value, PLAYER_HIT_REACTION_SECONDS)
      ) {
        const hazard = hazardContacts.hazard;
        const damage = hazardContacts.damage;
        // Pushed away from the hazard's own tile: without this, standing still
        // against a spike re-lands a fresh hit the instant the refractory
        // window lapses, since nothing moves the player out of contact.
        const contactSide: -1 | 1 = hazard.x >= playerState.value.x ? 1 : -1;
        const effects: HitEffect[] = [{ type: 'damage', amount: damage }, { type: 'reaction' }];
        // The knockback is the hazard kind's own `knocksBack` flag (false for
        // the floor spike and falling stalactite), and a crouched hit never
        // knocks back. The red reaction also opens the refractory window, or
        // the player would take repeated damage each tick they remain on the
        // tile; only a pit fall keeps the transparent blink.
        if (hazardTypeOf(hazard).knocksBack && !playerState.value.crouching) {
          const direction: -1 | 1 = contactSide === 1 ? -1 : 1;
          effects.push({
            type: 'velocity',
            x: direction * DEFAULT_HIT_KNOCKBACK.vx,
            duration: DEFAULT_HIT_KNOCKBACK.duration,
          });
        }

        // No splatter on the killing blow.
        const applied = resolveHitEffects(playerState.value, effects);
        playerState.value = applied.player;
        if (applied.player.alive) {
          const anchor = playerEffectAnchor(applied.player, originX, originY, 'center');
          spawnEffect(
            startPlayerHitSplatter(
              `player-${effectCount(activeEffects.value, 'hitSplatter')}`,
              anchor.x,
              anchor.y,
              contactSide,
            ),
          );
        }
      }

      // A/D accepted as an alternate to Arrow Left/Right ( only
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
        activeLevel.value,
        dt,
        {
          ...horizontal,
          jumpPressed,
          jumpHeld,
          dropThroughHeld,
          climbUpHeld,
          suppressJumpCut: contacts.bounceEffects.length > 0,
        },
        blockStates.value,
        crumblingFloorTimerStates.value,
      );

      // Place-bomb input (`B`, //): read once per tick as an
      // edge-triggered press. The bomb goes in the tile the character occupies
      // — the column containing the player's horizontal centre and the row
      // containing its feet (the same `- 1` foot-row `Physics.ts` uses for the
      // tile the character's feet are in). Placing with no bombs shows the
      // transient "no bombs" bubble; placing on an occupied tile is a silent
      // no-op; otherwise one bomb is placed and exactly one consumed.
      const placeBombPressed = input.consumePress('KeyB');
      if (placeBombPressed) {
        const bombCol = Math.floor((next.x + PLAYER_RENDERED_SIZE / 2) / RENDERED_TILE_SIZE);
        const bombRow = Math.floor(
          (next.y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING - 1) / RENDERED_TILE_SIZE,
        );
        const tileOccupied = deployableItems.value.some(
          (item) =>
            item.kind === bombDeployableItem.key && item.col === bombCol && item.row === bombRow,
        );
        if (carriedBombs.value <= 0) {
          spawnEffect(startSpeechBubble('noBombs', hintText.value.noBombs, { transient: true }));
        } else if (!tileOccupied) {
          // The placed face's own `spawn` entry point creates the bomb; the
          // sequence keeps counting live bombs (not the whole collection) so
          // the id convention stays byte-identical.
          const bombSeq = deployableItems.value.filter(
            (item) => item.kind === bombDeployableItem.key,
          ).length;
          deployableItems.value = [
            ...deployableItems.value,
            bombDeployableItem.spawn({
              id: `bomb-${bombCol}-${bombRow}-${bombSeq}`,
              col: bombCol,
              row: bombRow,
              x: bombCol * RENDERED_TILE_SIZE,
              y: bombRow * RENDERED_TILE_SIZE,
              level: currentLevel.value,
              blocks: blockStates.value,
              crumblingFloorStates: crumblingFloorTimerStates.value,
            }),
          ];
          carriedBombs.value -= 1;
        }
      }

      // Block hit mechanics: `next.blockContacts` (set by Physics.ts's
      // collision checks, same call above) reports every side-tagged block
      // contact from this tick — but a contact only registers as a hit if the
      // block's kind actually reacts to that side, and the block ISN'T
      // already used up (a question-mark that already popped its fruit, or a
      // still-mid-bump crate/fragileRock about to be filtered out, must not
      // register a second hit just because the player's head is still under
      // it this frame).
      // `originX`/`originY` (this tick's world-to-screen origin) are already
      // in scope from the top of this tick — reused here (not redeclared) for
      // `firePuffIfJustUsedUp`'s puff-position math.

      // A block's terminal hit — any kind that's removed once used up
      // (crate, fragileRock, coinPot; not questionMark, which never breaks)
      // — gets a visual "puff": a standalone world-event burst
      // (engine/effects/puff.ts's PuffEffect / its registered draw),
      // independent of whether a reward is also awarded
      // alongside it.
      const firePuffIfJustUsedUp = (block: BlockState): void => {
        if (!BLOCK_TYPES[block.blockKind].removeWhenUsedUp || !isBlockUsedUp(block)) return;
        const anchor = blockEffectAnchor(block);
        spawnEffect(
          startPuffEffect(block.id, anchor.x + originX, anchor.y + originY, anchor.scale),
        );
      };

      // Whether any crate reached its terminal hit this tick — gates the
      // crates popup bump below, computed from the raw destroyed-crate count
      // rather than facts revealed (see that bump's own comment). Declared
      // here so BOTH the contact-hit loop and a blast can set it.
      let crateDestroyedThisTick = false;

      /**
       * The one shared terminal-outcome applier for a block that has just taken
       * its registering hit: puff, pickup spawn, fact reveal and the permanent
       * `rewardGiven` marking. Reused by the contact-hit loop and by a bomb's
       * blast, so a blast destruction is identical to a normal one. Bounce is
       * deliberately NOT here — only a landed-on pot bounces the player.
       */
      const resolveBlockTerminalOutcome = (block: BlockState, outcome: BlockHitOutcome): void => {
        firePuffIfJustUsedUp(block);

        // Mark a block that handed out its pickup as permanently paid out
        // (surviving death/respawn; cleared only by Reset Game), exactly as
        // every defeated enemy is marked. A 'once' pot never drops again.
        if (outcome.spawnPickup !== undefined) {
          blockStates.value = blockStates.value.map((b) =>
            b.id === block.id ? { ...b, rewardGiven: true } : b,
          );
        }

        // One generic spawn path keyed by the outcome's declared kind — the
        // page names no pickup kind. Each kind's module owns its id/position
        // convention (and the fruit's lazy icon cycle); `pickupStores` routes
        // the new state to that kind's live array (a coin-pot's coin to
        // `spawnedCoinPlacements`). Adding a block-drop kind needs no page edit.
        if (outcome.spawnPickup !== undefined) {
          const kind = outcome.spawnPickup;
          pickupStores[kind].append(
            PICKUP_TYPES[kind].spawn({
              id: block.id,
              x: block.x,
              y: block.y,
              fact: block.fact,
              iconIndex: () => session.takeNextFruitIcon(),
            }),
          );
        }

        if (outcome.counterKey === 'crates') {
          crateDestroyedThisTick = true;
          // A crate's fact(s) were fixed at placement time (see
          // BlockMapper.ts's placeCrates doc comment) — reveal its own
          // `fact` plus any `extraFacts` (when this level has fewer crates
          // than crate-pool facts, one crate can own more than one). No
          // counterKey here: the crates popup is bumped below instead, for
          // every destroyed crate rather than only ones that happen to reveal
          // a fact.
          const facts = [block.fact, ...(block.extraFacts ?? [])].filter(
            (fact): fact is CollectedFact => fact !== undefined,
          );
          facts.forEach((fact, index) => {
            revealFact(fact, {
              x: block.x,
              y: block.y,
              // Unique per revealed fact, not just per crate.
              effectId: `${block.id}-${index}`,
            });
          });
        } else if (outcome.revealFact) {
          revealFact(outcome.revealFact, {
            x: block.x,
            y: block.y,
            effectId: block.id,
            // Supplied by the block's own outcome, not assumed here: which
            // counter a reveal feeds is per-kind knowledge and belongs to
            // the kind.
            counterKey: outcome.counterKey,
          });
        }
      };

      // Every block whose contact side this kind actually reacts to (see
      // BlockType.triggerSides) and that isn't already used up. This replaces
      // two near-duplicate loops — one for 'bottom' contacts that excluded
      // coinPot by name, one for 'top' contacts that admitted only coinPot
      // whose only real difference was per-kind knowledge that now lives in
      // the registry.
      const hitBlocks = next.blockContacts
        .map((contact) => ({ contact, block: blockStates.value.find((b) => b.id === contact.id) }))
        .filter(
          (entry): entry is { contact: BlockContact; block: BlockState } =>
            entry.block !== undefined &&
            !isBlockUsedUp(entry.block) &&
            BLOCK_TYPES[entry.block.blockKind].triggerSides.includes(entry.contact.side),
        );

      // Most negative wins, so several blocks bouncing the player in one tick
      // is deterministic regardless of iteration order. Hoisted out of the
      // block loop so a same-tick mushroom landing can join the aggregation
      // before the single impulse is applied.
      let bounceVelocity: number | undefined;

      if (hitBlocks.length > 0) {
        const hitIds = new Set(hitBlocks.map((entry) => entry.block.id));
        const resolvedHits = new Map<string, BlockHitResult>();

        // One hit per block; the adapter's `onHit` sees the incremented
        // `hitsTaken`, which is how a kind knows this hit was its terminal one.
        blockStates.value = blockStates.value.map((block) => {
          if (!hitIds.has(block.id)) return block;
          const hit = resolveHitEffects(block, [{ type: 'damage', amount: 1 }]);
          resolvedHits.set(block.id, hit);
          return hit.block;
        });

        for (const id of hitIds) {
          const hit = resolvedHits.get(id);
          if (!hit) continue;
          resolveBlockTerminalOutcome(hit.block, hit.outcome);
          const bounce = hit.outcome.effects?.find(
            (effect): effect is Extract<HitEffect, { type: 'velocity' }> =>
              effect.type === 'velocity' && effect.y !== undefined,
          );
          if (bounce?.y !== undefined) bounceVelocity = strongerBounce(bounceVelocity, bounce.y);
        }
      }

      // A downward landing on a bouncy mushroom's cap launches the player with
      // the dedicated super-jump, folded into the same aggregation as a pot
      // landing so the two never sum. `cap` is non-null only on the contact
      // tick, so the squash always reacts to a real landing.
      const cap = playerOnMushroomCap(activeLevel.value, next);
      if (cap) {
        bounceVelocity = strongerBounce(bounceVelocity, MUSHROOM_BOUNCE_VY);
      }
      if (bounceVelocity !== undefined) {
        // Applies to `next`, not `playerState.value`: `next` is what gets
        // persisted later this tick, so a `playerState.value` write here would
        // be clobbered. The strongest block/mushroom bounce becomes one
        // protected `velocity`.
        next = resolveHitEffects(next, [
          { type: 'velocity', y: bounceVelocity, preserveJump: true },
        ]).player;
      }
      if (cap) {
        mushroomSquashStates.value = startMushroomSquash(
          mushroomSquashStates.value,
          cap.col,
          cap.row,
        );
      }

      // The one shared late (post-physics, pre-persist) consequence pass: each
      // kind returns a declarative outcome (a placed bomb detonates or falls
      // out; the ladder/chest ask for nothing), the pass drops the removed
      // entries and returns the blasts to resolve here. A placed bomb is never
      // in `blockPlacements`, so it never blocks the player.
      if (deployableItems.value.length > 0) {
        const blasts = applyDeployableItemConsequences();
        if (blasts.length > 0) {
          const delta = resolveBlasts(blasts, {
            level: currentLevel.value,
            player: next,
            blocks: blockStates.value,
            enemies: enemyStates.value,
          });

          // The blast drove each destructible block to its terminal hit; run
          // the shared terminal applier. A question-mark is never in this set.
          blockStates.value = [...delta.blocks];
          for (const id of delta.terminalBlockIds) {
            const block = blockStates.value.find((b) => b.id === id);
            if (!block) continue;
            resolveBlockTerminalOutcome(block, BLOCK_TYPES[block.blockKind].onHit?.(block) ?? {});
          }

          // `justDefeated` pays any enemy's reward/drop/puff once its reaction
          // finishes, so a blast kill needs nothing extra here.
          enemyStates.value = [...delta.enemies];

          // `BombSystem` already decided the player's hit (invulnerability,
          // crouch, one blast per tick) against this same `next`, so no guard
          // belongs here.
          if (delta.playerEffects) {
            next = resolveHitEffects(next, delta.playerEffects).player;
          }
          if (delta.playerSplatter) {
            const anchor = playerEffectAnchor(next, originX, originY, 'center');
            spawnEffect(
              startPlayerHitSplatter(
                delta.playerSplatter.id,
                anchor.x,
                anchor.y,
                delta.playerSplatter.side,
              ),
            );
          }

          // Cosmetic, centred on where the bomb was when the fuse expired.
          for (const explosion of delta.explosions) {
            spawnEffect(startExplosionEffect(explosion.id, explosion.x, explosion.y));
          }
        }
      }

      // The crates popup bumped here rather than by the reveal trigger,
      // mirroring the coins loop above: a crate's fact(s) are a fixed pool
      // slice (see BlockMapper.ts's placeCrates), so most crates can reveal
      // zero facts whenever there are more crates than crate-pool facts
      // gating this on a reveal would leave those destructions with no
      // "crates destroyed / total" feedback, and could even show more facts
      // revealed than crates exist. Uses `cratesDestroyed` (PlatformerState.ts),
      // not `countCollectedFor`, for the same reason `coinsCollectedSoFar`
      // does above — and NOT a plain `blockStates` filter, since a destroyed
      // crate is eventually spliced out of that array (see `cratesDestroyed`'s
      // own doc comment for why that would undercount). Set by BOTH the
      // contact-hit loop and a blast above.
      if (crateDestroyedThisTick) {
        spawnEffect(startCounterPopup('crates', cratesDestroyed.value, levelTotals.value.crates));
      }

      if (checkPitFall(next, currentLevel.value)) {
        // The refractory window is a property of taking damage generally,
        // not just of enemy contact — a pit fall opens and respects it
        // exactly like a side-hit does. The position recovery below is NOT
        // gated by it, though: `resolvePitFall` must always run or the
        // character would keep falling forever while merely invulnerable
        // from an earlier, unrelated hit.
        if (!isInvulnerable(next, PLAYER_HIT_REACTION_SECONDS)) {
          // No debris burst — unlike an enemy/hazard touch, nothing visibly
          // struck the character, so a blood splatter doesn't read right
          // here (only the blink applies; see `beginPitFallReaction`).
          next = resolveHitEffects(next, [
            { type: 'damage', amount: PIT_FALL_DAMAGE },
            { type: 'reaction', blinkOnly: true },
          ]).player;
        }
        next = resolvePitFall(next);
      }

      // Runs after the pit-fall check so `animState` is always derived from
      // the frame's FINAL `grounded` value — otherwise a pit-fall recovery
      // would render one frame of a stale fall/jump animation at the
      // recovered position before the next tick corrected it.
      next = updatePlayerAnimState(next);
      next = advancePlayerAnimation(next, dt);
      next = advancePlayerHitTimer(next, dt);

      playerState.value = next;

      // Checkpoints: resolved against the frame's final player position, and
      // only when the interaction key was pressed this tick (Up/W, the same
      // explicit gesture chests use) — walking over a checkpoint is inert.
      // `worldAnimElapsed` is the shared world clock, so a raise freezes with
      // the rest of the world during death/pause and derives its frame at draw
      // time (no per-frame state write). One pixel-art puff and one label per
      // dormant winner; the flag raise itself needs no start call.
      const checkpointResolution = resolveCheckpointContacts(
        playerState.value,
        checkpointPlacements.value,
        checkpointStates.value,
        currentLevel.value,
        activeCheckpointId.value,
        worldAnimElapsed,
        interactPressed,
      );
      checkpointStates.value = checkpointResolution.states;
      activeCheckpointId.value = checkpointResolution.activeId;
      if (checkpointResolution.activatedIds.length > 0) {
        for (const id of checkpointResolution.activatedIds) {
          const state = checkpointResolution.states.find((s) => s.id === id);
          if (!state) continue;
          const anchor = checkpointEffectAnchor(state);
          spawnEffect(
            startPuffEffect(id, anchor.x + originX, anchor.y + originY, anchor.scale, true),
          );
          spawnEffect(
            startFadeOutTextEffect(
              id,
              anchor.x,
              anchor.y,
              currentUI.value.platformer.checkpoint.label,
            ),
          );
        }
      }

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
      // falls), `alive` going false starts the death iris centered on
      // wherever the player ended up this frame — the same `Damageable`
      // flag an enemy dies by. Otherwise, keep advancing 'intro' (a no-op
      // once already 'playing' — see GameLifecycle.ts's tickLifecycle).
      if (!next.alive) {
        playerState.value = { ...next, animState: 'death', animFrame: 0, animTimer: 0 };
        session.beginDeath({
          x: next.x + PLAYER_RENDERED_SIZE / 2,
          y: next.y + PLAYER_VISUAL_CENTER_Y_OFFSET,
        });
        // See handleDebugKill's identical assignment above: without this the
        // bubble would freeze on screen through the death animation and the
        // awaitingRestart wait, since the game loop's early-returns for those
        // phases never reach the effect-advance block that would otherwise
        // fade it out.
        activeEffects.value = clearEffectsOfKind(activeEffects.value, 'speechBubble');
      } else {
        session.advanceLifecycle(dt);
      }

      // Deliberately allows 'intro' here too, not just 'playing': per
      // GameLifecycle.ts's doc comment, 'intro' is a purely visual overlay
      // on top of already-running gameplay (a pit near spawn is still live
      // during it), and physics/collisions — including chest-opening
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
        (session.phase() === 'playing' || session.phase() === 'intro') &&
        allChestsOpen(chestStates.value)
      ) {
        sessionRef.current?.showEndingScreen();
        endingScreenOpen.value = true;
        endingScreenShown.value = true;
      }

      render();
    };

    const onJournalKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'KeyJ') handleJournalToggle();
    };
    window.addEventListener('keydown', onJournalKey);

    const session = createPlatformerSession({ canvas, onFrame: runFrame });
    sessionRef.current = session;
    // The session publishes its own live lookup before start() so the very
    // first repaint already reads through it.
    spritesRef.current = session.lookup;
    session.start();

    return () => {
      session.dispose();
      sessionRef.current = null;
      window.removeEventListener('keydown', onJournalKey);
    };
  }, []);

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-black">
      {/* Sized to exactly wrap the canvas (a plain div with no explicit
          size shrinks to its child's rendered dimensions), so the journal
          button below can anchor to the CANVAS's own corner via `absolute`
          instead of the page's corner — the canvas is vertically centered
          within the taller page now (see PLAY_CANVAS_ROWS), so a
          page-anchored `fixed` position no longer lines up with it. */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          data-testid="platformer-canvas"
          className="block border border-border outline-none select-none"
          tabIndex={-1}
        />
        {/* Sits top-left, left of the hearts HUD, which HEARTS_START_X shifts
            right to make room — top-left keeps it easy to spot against the
            terrain. size-10 (40px) must match the 40 baked into
            HEARTS_START_X's computation in HudLayout.ts. */}
        <button
          ref={journalButtonRef}
          type="button"
          onClick={handleJournalToggle}
          aria-label="Toggle journal"
          className="absolute top-4 left-4 z-50 size-10 overflow-hidden rounded"
        >
          <img
            src="/sprites/journal.png"
            alt=""
            data-testid="journal-open-button"
            className="h-full w-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        </button>
      </div>
      <FloatingControls onOpenChange={handleFloatingControlsOpenChange} />
      <ControlsOverlay />
      {journalOpen && (
        <Journal
          onClose={handleJournalReallyClosed}
          closeRequested={journalClosing}
          onResetGame={handleResetGameRequested}
        />
      )}
      {endingScreenOpen.value && <ThankYouScreen onDismiss={handleDismissEndingScreen} />}
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
