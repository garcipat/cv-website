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
  drawCollectionEffects,
  drawCollectibleCounter,
  drawIrisOverlay,
  drawRestartPrompt,
  RESTART_PROMPT_FONT_FAMILY,
  RESTART_PROMPT_FONT_URL,
  HEARTS_START_X,
} from './engine/Renderer';
import { drawDebugOverlay } from './engine/DebugOverlay';
import { createGameLoop } from './engine/GameLoop';
import { stepPlayerPhysics, checkPitFall, resolvePitFall } from './engine/Physics';
import { PHYSICS_CONFIG } from './engine/PhysicsConfig';
import { stepEnemyPatrol, stepEnemyHitReaction } from './engine/EnemyAI';
import { updateCamera } from './engine/Camera';
import { createKeyboardInput } from './engine/Input';
import {
  tickLifecycle,
  startDeath,
  introState,
  currentIrisRadius,
  pauseForJournal,
  resumeFromJournal,
} from './engine/GameLifecycle';
import { maxIrisRadius } from './engine/IrisTransition';
import { level1 } from './level/level1';
import {
  checkCollectibleCollisions,
  checkEnemyStompCollisions,
  checkEnemySideCollisions,
} from './engine/Collision';
import { startFlightEffect, tickFlightEffect, COLLECTION_TEXT_SLOT_COUNT } from './engine/CollectionEffects';
import { coinFrameSource, COIN_FRAME_SIZE } from './entities/Coin';
import { fruitFrameSource, FRUIT_FRAME_SIZE } from './entities/Fruit';
import { isSkillCategoryFact } from './types';
import { SECTION_ICON } from './entities/JournalEntry';
import { RENDERED_TILE_SIZE } from './level/Terrain';
import {
  advancePlayerAnimation,
  updatePlayerAnimState,
  applyKnockback,
  tickInvincibility,
  grantInvincibility,
  PLAYER_RENDERED_SIZE,
  PLAYER_VISUAL_CENTER_Y_OFFSET,
} from './entities/Player';
import { advanceEnemyAnimation, applyStomp, ENEMY_FRAME_SIZE } from './entities/Enemy';
import { takeDamage, PIT_FALL_DAMAGE, SIDE_HIT_DAMAGE, INVINCIBILITY_DURATION_SECONDS } from './entities/Health';
import {
  playerState,
  cameraPositionX,
  healthState,
  lifecycleState,
  spawnCenter,
  resetGame,
  resetGameProgress,
  collectiblePlacements,
  enemyPlacements,
  enemyStates,
  blockPlacements,
  collectedCollectibleIds,
  activeEffects,
  collectedFacts,
} from './PlatformerState';
import { Journal } from './components/Journal';

// Horizontal HUD layout: hearts start at HEARTS_START_X (shifted right of
// the journal icon button, see Renderer.ts) and occupy roughly 130px from
// there (3 hearts x 32px + spacing, per drawHearts's own HEART_SPACING in
// Renderer.ts) — these two constants position the coin, fruit, and
// enemy-defeated counters after that, side by side, without duplicating
// Renderer.ts's private layout constants here.
const MAX_HEARTS_COUNTER_WIDTH = 130;
// Wide enough for a 32px icon (now matching HEART_RENDERED_SIZE, not the
// smaller 20px it used to be) plus its "collected / max" text before the
// next counter starts.
const COLLECTIBLE_COUNTER_SPACING = 110;
// Vertical spacing between stacked fact-flight rows when several pickups are
// collected close together — a bit more than the 28px collection-effect
// font size (Renderer.ts's COLLECTION_EFFECT_FONT_SIZE) so stacked lines
// don't touch.
const COLLECTION_TEXT_STACK_ROW_HEIGHT = 34;
// How often the player's sprite toggles visible/invisible while invincible
// (roadmap step 19) — short enough to read clearly as "blinking", not a slow
// pulse.
const INVINCIBILITY_BLINK_INTERVAL_SECONDS = 0.1;

export const PlatformerPage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tilesetRef = useRef<HTMLImageElement | null>(null);
  const playerSpriteRef = useRef<HTMLImageElement | null>(null);
  const playerJumpSpriteRef = useRef<HTMLImageElement | null>(null);
  const heartsSpriteRef = useRef<HTMLImageElement | null>(null);
  const coinSpriteRef = useRef<HTMLImageElement | null>(null);
  const fruitSpriteRef = useRef<HTMLImageElement | null>(null);
  const slimeGreenSpriteRef = useRef<HTMLImageElement | null>(null);
  const slimePurpleSpriteRef = useRef<HTMLImageElement | null>(null);
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
    const center = spawnCenter();
    lifecycleState.value = introState(center.x, center.y);
  };

  const handleDebugKill = () => {
    healthState.value = 0;
    const p = playerState.value;
    lifecycleState.value = startDeath(p.x + PLAYER_RENDERED_SIZE / 2, p.y + PLAYER_VISUAL_CENTER_Y_OFFSET);
  };

  const handleDebugRespawn = () => {
    resetGame();
    const center = spawnCenter();
    lifecycleState.value = introState(center.x, center.y);
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

    // Cycles 0, 1, 2, 0, 1, 2, ... across collections (not reset per-tick) so
    // fast/simultaneous pickups' fact text rotates through a fixed set of
    // vertical slots instead of landing on the same spot — see
    // CollectionEffects.ts's COLLECTION_TEXT_SLOT_COUNT.
    let nextTextSlot = 0;

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
      const levelPixelHeight = level1.height * RENDERED_TILE_SIZE;
      const originY = canvas.height - levelPixelHeight;
      const originX = -cameraPositionX.value;

      if (tilesetRef.current) {
        drawTerrain(ctx, level1, tilesetRef.current, originX, originY);
        drawBlocks(ctx, blockPlacements, tilesetRef.current, originX, originY);
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
          collectiblePlacements,
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

      drawCollectionEffects(ctx, activeEffects.value);

      if (debugHitboxesRef.current) drawDebugOverlay(ctx, playerState.value, level1, originX, originY);

      if (heartsSpriteRef.current) {
        drawHearts(ctx, healthState.value, heartsSpriteRef.current, HEARTS_START_X);
      }

      const coinFrame0 = coinFrameSource(0);
      const coinTotal = collectiblePlacements.filter((p) => p.spriteType === 'coin').length;
      const coinCollected = collectiblePlacements.filter(
        (p) => p.spriteType === 'coin' && collectedCollectibleIds.value.has(p.id),
      ).length;
      if (coinSpriteRef.current) {
        drawCollectibleCounter(
          ctx,
          coinSpriteRef.current,
          { sx: coinFrame0.sx, sy: coinFrame0.sy, size: COIN_FRAME_SIZE },
          coinCollected,
          coinTotal,
          HEARTS_START_X + MAX_HEARTS_COUNTER_WIDTH,
          32,
        );
      }

      const fruitFrame0 = fruitFrameSource(0);
      const fruitTotal = collectiblePlacements.filter((p) => p.spriteType === 'fruit').length;
      const fruitCollected = collectiblePlacements.filter(
        (p) => p.spriteType === 'fruit' && collectedCollectibleIds.value.has(p.id),
      ).length;
      if (fruitSpriteRef.current) {
        drawCollectibleCounter(
          ctx,
          fruitSpriteRef.current,
          { sx: fruitFrame0.sx, sy: fruitFrame0.sy, size: FRUIT_FRAME_SIZE },
          fruitCollected,
          fruitTotal,
          HEARTS_START_X + MAX_HEARTS_COUNTER_WIDTH + COLLECTIBLE_COUNTER_SPACING,
          32,
        );
      }

      // Enemy-defeated counter (roadmap step 18, added per live user
      // feedback after verifying stomp defeat): persistent like the coin/
      // fruit counters above — driven by `collectedFacts` (sourceType
      // 'enemy'), which survives a respawn, rather than `enemyStates`'s
      // live array length, which resets to full on every respawn (enemies,
      // unlike facts, respawn per FR-020c). The icon is raw sheet frame 3
      // (1-based, row 0 col 2) — chosen live by the user as a plain "enemy"
      // icon distinct from both the walk loop (frames 4-8) and the hit
      // reaction (frames 9-12). Not expressible via `enemyFrameSource`
      // (which only looks up frames within a named animState's own list),
      // so the sheet coordinates are computed directly here — a future
      // generic "pick sprite N" helper (flagged separately, out of scope
      // for this branch) would remove the need for this one-off.
      const enemyIconFrame = { sx: 2 * ENEMY_FRAME_SIZE, sy: 0 };
      const enemyTotal = enemyPlacements.length;
      const enemyDefeated = collectedFacts.value.filter((f) => f.sourceType === 'enemy').length;
      if (slimeGreenSpriteRef.current) {
        drawCollectibleCounter(
          ctx,
          slimeGreenSpriteRef.current,
          { sx: enemyIconFrame.sx, sy: enemyIconFrame.sy, size: ENEMY_FRAME_SIZE },
          enemyDefeated,
          enemyTotal,
          HEARTS_START_X + MAX_HEARTS_COUNTER_WIDTH + COLLECTIBLE_COUNTER_SPACING * 2,
          32,
          -6,
        );
      }

      // Iris overlay: drawn on top of everything else whenever the current
      // phase isn't 'playing'. centerX/centerY are stored world-space (see
      // GameLifecycle.ts) so they're converted to screen-space here with the
      // same originX/originY already used for terrain/player, keeping them
      // aligned even if the canvas resizes mid-pause.
      const lifecycle = lifecycleState.value;
      if (lifecycle.phase !== 'playing' && lifecycle.phase !== 'paused') {
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

      // Coins/enemies only animate while the game is actually live — frozen
      // during death/restart/journal-pause, same as physics below, rather
      // than ticking on a wall-clock independent of the paused state.
      worldAnimElapsed += dt;

      // Enemies currently reacting to a stomp (animState 'hit') run their
      // reaction timer instead of patrolling — stepEnemyHitReaction either
      // holds them frozen, reverts them to 'walk', or flags them `defeated`
      // once the reaction finishes (Enemy.ts's applyStomp is what put them
      // into 'hit' in the first place, below).
      enemyStates.value = enemyStates.value.map((enemy) => {
        const next =
          enemy.animState === 'hit' ? stepEnemyHitReaction(enemy, dt) : stepEnemyPatrol(enemy, level1, dt);
        return advanceEnemyAnimation(next, dt);
      });

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
        const levelPixelHeight = level1.height * RENDERED_TILE_SIZE;
        const originY = canvas.height - levelPixelHeight;

        for (const enemy of justDefeated) {
          // Facts persist across respawns (FR-020c: `resetGame()` revives
          // enemies but deliberately never clears `collectedFacts`), so a
          // revived enemy stomped again in a later life must not re-bank the
          // same fact — that would duplicate its journal page. The enemy is
          // still removed via the `filter` below either way; only the
          // reward (fact + flight effect) is skipped.
          if (newFacts.some((f) => f.id === enemy.fact.id)) continue;
          newFacts.push(enemy.fact);
          const label = isSkillCategoryFact(enemy.fact.data)
            ? enemy.fact.data.category
            : ('name' in enemy.fact.data ? enemy.fact.data.name : enemy.fact.sectionLabel);
          const flag = 'flag' in enemy.fact.data ? enemy.fact.data.flag : undefined;
          const icon = typeof flag === 'string' ? flag : SECTION_ICON[enemy.fact.sectionId];
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
      }

      activeEffects.value = activeEffects.value
        .map((effect) => tickFlightEffect(effect, dt))
        .filter((effect) => effect.phase !== 'done');

      // Same origin math as render()'s local originX/originY (that scope
      // isn't reachable from here) — needed to convert a just-collected
      // placement's world-space position into the screen-space coordinates
      // FlightEffect requires (see CollectionEffects.ts's doc comment).
      const levelPixelHeight = level1.height * RENDERED_TILE_SIZE;
      const originY = canvas.height - levelPixelHeight;
      const originX = -cameraPositionX.value;

      const touchedIds = checkCollectibleCollisions(
        playerState.value,
        collectiblePlacements,
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
          const placement = collectiblePlacements.find((p) => p.id === id);
          if (!placement) continue;
          nextCollected.add(id);
          newFacts.push(placement.fact);

          const label = isSkillCategoryFact(placement.fact.data)
            ? placement.fact.data.category
            : ('name' in placement.fact.data ? placement.fact.data.name : placement.fact.sectionLabel);
          // The same icon the journal uses (a language's own flag emoji if
          // it has one, per formatJournalEntry's `icon` resolution;
          // SECTION_ICON's generic symbol otherwise — 💡 for skills) — per
          // user request, to distinguish a skill pickup from a language one
          // at a glance. Passed to `startFlightEffect` separately, NOT
          // concatenated into `label`: Renderer.ts draws it in a different
          // font (the pixel font `label` uses has no emoji glyphs).
          const flag = 'flag' in placement.fact.data ? placement.fact.data.flag : undefined;
          const icon = typeof flag === 'string' ? flag : SECTION_ICON[placement.fact.sectionId];
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

      // Side/below damage (roadmap step 19) — only checked while not already
      // invincible, so one overlap can't register repeated hits every tick
      // it persists. A `hit`-reacting enemy IS excluded here (unlike stomp
      // detection, which only excludes an enemy once its `hitPoints` reach
      // 0 — see Collision.ts's checkEnemyStompCollisions) — reversed from an
      // earlier design decision after live testing showed a hit-reacting
      // enemy must stay harmless to side-touch for its whole reaction, or
      // bouncing off a stomp while still overlapping it registered as a
      // spurious side-hit.
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
          const knockbackDirection = playerState.value.x <= hitEnemy.x ? -1 : 1;
          playerState.value = applyKnockback(
            playerState.value,
            knockbackDirection,
            PHYSICS_CONFIG.sideHitKnockbackVx,
            PHYSICS_CONFIG.sideHitKnockbackDuration,
            INVINCIBILITY_DURATION_SECONDS,
          );
        }
      }

      // A/D accepted as an alternate to Arrow Left/Right (FR-007 only
      // requires arrows; this is an additive convenience, not a replacement).
      const horizontal = {
        left: input.isHeld('ArrowLeft') || input.isHeld('KeyA'),
        right: input.isHeld('ArrowRight') || input.isHeld('KeyD'),
      };
      // Both must be evaluated (not short-circuited) since consumePress has
      // the side effect of clearing the pending press it finds.
      const spacePressed = input.consumePress('Space');
      const arrowUpPressed = input.consumePress('ArrowUp');
      const jumpPressed = spacePressed || arrowUpPressed;
      const jumpHeld = input.isHeld('Space') || input.isHeld('ArrowUp');
      const dropThroughHeld = input.isHeld('ArrowDown') || input.isHeld('KeyS');

      let next = stepPlayerPhysics(playerState.value, level1, dt, {
        ...horizontal,
        jumpPressed,
        jumpHeld,
        dropThroughHeld,
        suppressJumpCut: stompBounceThisTick,
      });

      if (checkPitFall(next, level1)) {
        // Invincibility (roadmap step 19) is a property of taking damage
        // generally, not just of enemy contact — a pit fall grants and
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

      const levelPixelWidth = level1.width * RENDERED_TILE_SIZE;
      cameraPositionX.value = updateCamera(
        cameraPositionX.value,
        next.x,
        PLAYER_RENDERED_SIZE,
        canvas.width,
        levelPixelWidth,
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
      } else {
        lifecycleState.value = tickLifecycle(lifecycleState.value, dt);
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
    loadFont(RESTART_PROMPT_FONT_FAMILY, RESTART_PROMPT_FONT_URL)
      .then(() => {
        if (cancelled) return;
        render();
      })
      .catch(() => {
        // drawRestartPrompt/drawCollectibleCounter fall back to their
        // sans-serif/monospace stacks if the custom font fails to load.
      });

    return () => {
      cancelled = true;
      loop.stop();
      input.destroy();
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
      {journalOpen && (
        <Journal
          onClose={handleJournalReallyClosed}
          closeRequested={journalClosing}
          onResetGame={handleResetGameRequested}
        />
      )}
      {/* Moved from bottom-right to top-left (was hard to spot against the
          terrain) — sits left of the hearts HUD, which HEARTS_START_X
          shifts right to make room. size-10 (40px) must match the 40 baked
          into HEARTS_START_X's computation in Renderer.ts. */}
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
        </div>
      )}
    </div>
  );
};
