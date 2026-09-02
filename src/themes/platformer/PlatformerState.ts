import { signal, computed } from '@preact/signals-react';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import {
  SPAWN_TILE,
  ENEMY_TILES_GREEN,
  ENEMY_TILES_PURPLE,
  COIN_TILES,
  CRATE_TILES,
  QUESTIONMARK_TILES,
  FRAGILE_ROCK_TILES,
  CHEST_TILES,
  SIGN_TILES,
} from './level/level';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_VISUAL_CENTER_Y_OFFSET,
  PLAYER_HIT_REACTION_SECONDS,
} from './entities/Player';
import { MAX_HALF_HEARTS } from './entities/Health';
import { toEnemyState, reviveEnemy } from './entities/Enemy';
import type { EnemyState } from './entities/Enemy';
import { toBlockState } from './entities/Block';
import type { BlockState } from './entities/Block';
import { toChestState } from './entities/Chest';
import type { ChestState } from './entities/Chest';
import type { BonusFruitState } from './entities/BonusFruit';
import type { KeyPickupState } from './entities/KeyPickup';
import { introState } from './engine/GameLifecycle';
import { currentCV } from '@/state/locale';
import { mapCVDataToCollectibles, placeCollectibles } from './level/CollectibleMapper';
import { mapCVDataToEnemies, placeEnemies } from './level/EnemyMapper';
import { mapCVDataToBlocks, placeBlocks } from './level/BlockMapper';
import { mapCVDataToChests, placeChests } from './level/ChestMapper';
import type { ChestPlacement } from './level/ChestMapper';
import { placeSigns } from './level/SignMapper';
import type { SignPlacement } from './level/SignMapper';
import type { PlayerState } from './entities/Player';
import type { LifecycleState } from './engine/GameLifecycle';
import type { CollectedFact, SectionId } from './types';
import type { CollectiblePlacement } from './level/CollectibleMapper';
import type { EnemyPlacement } from './level/EnemyMapper';
import type { BlockPlacement } from './level/BlockMapper';
import type { FlightEffect, CounterPopupEffect, CounterPopupLabelKey } from './engine/CollectionEffects';
import type { HintTooltipState } from './engine/HintTooltip';

/**
 * The player's state at the level's spawn point — full health's worth of
 * idle standing on the ground. Exported (not just used once for the initial
 * signal value) because restart logic (PlatformerPage.tsx) calls this again
 * to reset `playerState` back to spawn after a death.
 */
export function spawnPlayerState(): PlayerState {
  // SPAWN_TILE is the empty cell the character stands in (see level.ts's
  // `S` marker) — the ground surface is that cell's bottom edge.
  const spawnCell = tileToPixel(SPAWN_TILE.value.col, SPAWN_TILE.value.row);
  const groundSurfaceY = spawnCell.y + RENDERED_TILE_SIZE;
  const x = spawnCell.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
  const y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: false,
    climbing: false,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    hitBlockIds: [],
    hitPoints: MAX_HALF_HEARTS,
    alive: true,
    // `hitTimer` counts UP from a hit, so "no hit recently" is a value at or
    // past the reaction duration, not 0. Seeding 0 would hand the player a
    // free 1.2 s of invulnerability after every respawn.
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
  };
}

/** Player position/animation state — mutated by the game loop. */
export const playerState = signal<PlayerState>(spawnPlayerState());

/**
 * Camera's horizontal scroll offset in rendered pixels — the world-space x
 * of the viewport's left edge. 0 at level start, increases rightward.
 * Updated once per game-loop tick (see PlatformerPage.tsx) via
 * Camera.ts's updateCamera; kept separate from playerState so renderer
 * code doesn't need to re-derive it from player position every frame.
 */
export const cameraPositionX = signal(0);

/**
 * Camera's vertical scroll offset — an additive amount on top of the
 * existing bottom-anchor baseline computed in `PlatformerPage.tsx`
 * (`canvas.height - levelPixelHeight`), not a replacement for it. See
 * `engine/Camera.ts`'s `updateCameraY` doc comment. Stays 0 whenever a
 * level's height fits the viewport — a verified no-op, not just an
 * assumption.
 */
export const cameraPositionY = signal(0);

/**
 * Every collectible in the level, placed once at module load from the
 * current locale's CVData (see `@/state/locale`'s `currentCV`) — a plain
 * constant, not a signal, matching `currentLevel`: neither is locale-reactive
 * (switching EN/DE mid-session doesn't re-place collectibles or change which
 * are already collected — that's a theme-switch-reset concern this doesn't
 * cover). Every position comes from currentLevel's hand-placed `C` markers
 * (see COIN_TILES) — placeCollectibles has no auto-placement, same as
 * placeEnemies below. `fruit` is passed an empty array (see level.ts's doc
 * comment) since `CollectibleMarkerPositions` still legitimately has that
 * field for future use.
 */
export const collectiblePlacements = computed<CollectiblePlacement[]>(() =>
  placeCollectibles(mapCVDataToCollectibles(currentCV.value), { coin: COIN_TILES.value, fruit: [] }),
);

/**
 * Every enemy in the level, placed once at module load — same non-reactive
 * convention as collectiblePlacements above (see its comment): no
 * locale-reactivity. Every position comes from currentLevel's hand-placed
 * `E`/`M` markers (see ENEMY_TILES_GREEN/
 * ENEMY_TILES_PURPLE) — placeEnemies has no auto-placement. A marker is a
 * slot on the map; each slot draws the next fact from CVData as its reward.
 * currentLevel currently has one `E` and one `M`, so only the first course
 * and first certificate actually have an enemy — the rest of CVData's
 * certificates/projects/courses simply aren't on the map yet, which is expected for
 * this mechanics-test level, not a bug (see level.ts's doc comment).
 */
export const enemyPlacements = computed<EnemyPlacement[]>(() =>
  placeEnemies(mapCVDataToEnemies(currentCV.value), {
    slimeGreen: ENEMY_TILES_GREEN.value,
    slimePurple: ENEMY_TILES_PURPLE.value,
  }),
);

/**
 * Every block in the level, placed once at module load — same
 * non-reactive, marker-driven convention as collectiblePlacements/
 * enemyPlacements above. Crates come from
 * `mapCVDataToBlocks` zipped against currentLevel's `X` markers; question-mark
 * and fragileRock blocks have no CVData mapping and are placed directly from
 * their `Q`/`F` markers (see BlockMapper.ts's placeBlocks). This placement
 * carries no live per-instance state (no hitsTaken/broken) — that lives in
 * `blockStates` below, once blocks respond to hits.
 */
export const blockPlacements = computed<BlockPlacement[]>(() =>
  placeBlocks(mapCVDataToBlocks(currentCV.value), {
    crate: CRATE_TILES.value,
    questionMark: QUESTIONMARK_TILES.value,
    fragileRock: FRAGILE_ROCK_TILES.value,
  }),
);

/**
 * Every chest in the level, placed once at module load — same non-reactive,
 * marker-driven convention as blockPlacements above. One chest per real
 * Experience entry, zipped against currentLevel's `T` markers (see
 * ChestMapper.ts's placeChests).
 */
export const chestPlacements = computed<ChestPlacement[]>(() =>
  placeChests(mapCVDataToChests(currentCV.value), CHEST_TILES.value),
);

/**
 * Every hint sign in the level, placed once at module load — same
 * non-reactive-to-CVData-but-reactive-to-`currentLayout` convention as
 * chestPlacements/blockPlacements above. Unlike those, there's no CVData to
 * zip against: a marker's character alone determines its hintId (see
 * SignMapper.ts's placeSigns).
 */
export const signPlacements = computed<SignPlacement[]>(() => placeSigns(SIGN_TILES.value));

/**
 * Live, per-frame patrol state for every enemy — position/velocity/
 * direction/animation, updated by the game loop's `stepEnemyPatrol` (see
 * PlatformerPage.tsx). Seeded from `enemyPlacements` (module load) and reset
 * back to that seed in `resetGame()`, same convention as `playerState`.
 */
export const enemyStates = signal<EnemyState[]>(
  enemyPlacements.value.map((placement, index) => toEnemyState(placement, index)),
);

/**
 * Live, per-frame hit/animation state for every block — mirrors
 * `enemyStates` above. Seeded from `blockPlacements` (module load) and
 * reset back to that seed only by `resetGameProgress()` (the Reset Game
 * button), NOT by `resetGame()` (death/respawn) — per this file's
 * `resetGame()` doc comment, blocks behave like collectibles (progress
 * persists across a respawn), not like enemies (which do revive on
 * respawn).
 */
export const blockStates = signal<BlockState[]>(blockPlacements.value.map(toBlockState));

/**
 * Live open/closed state for every chest — mirrors blockStates above.
 * Seeded from chestPlacements (module load) and reset back to that seed only
 * by resetGameProgress() (the Reset Game button), NOT by resetGame()
 * (death/respawn) — a chest, like a block, is progress that persists across
 * a death (spec.md FR-023's "never re-closes except via Reset Game").
 */
export const chestStates = signal<ChestState[]>(chestPlacements.value.map(toChestState));

/**
 * One-shot latch: true once the Thank You screen has been shown this
 * "session" (i.e. since the last Reset Game). Without this,
 * `allChestsOpen(chestStates.value)` stays true forever after the last chest
 * opens (opening is permanent — see entities/Chest.ts's openChest), so the
 * ending-screen check at the end of each tick would otherwise re-trigger
 * `showEndingScreen`/`setEndingScreenOpen(true)` on the very next tick after
 * dismissal, permanently locking the visitor out.
 *
 * Deliberately a module-level signal, not a component-local `useRef` in
 * PlatformerPage.tsx: `chestStates` above already survives a component
 * unmount (it's module-level), but a `useRef` does not — switching to
 * another CV-site theme and back would reset a local ref to `false` while
 * every chest is STILL open (theme-switch reset isn't implemented yet),
 * which would make the Thank You screen reappear on
 * the very first tick after switching back, with no player action. Living
 * here keeps this latch's lifetime matched to `chestStates`'s, and it's
 * reset back to `false` in `resetGameProgress()` below (alongside
 * `chestStates`'s own reset) so a visitor can see the screen again after a
 * genuine Reset Game.
 */
export const endingScreenShown = signal(false);

/**
 * Whether `<ThankYouScreen>` is currently mounted — the sibling piece of
 * ending-screen state to `endingScreenShown` above, but a distinct concern:
 * `endingScreenShown` is a permanent one-shot latch (never reset except by
 * Reset Game) while this one flips back to `false` on every dismissal so the
 * screen can be shown again after a future re-trigger.
 *
 * Deliberately module-level, not a component-local `useState` in
 * PlatformerPage.tsx: `chestStates`, `endingScreenShown`, and
 * `lifecycleState` are all module-level and survive a theme-switch
 * unmount/remount, but a local `useState` would not. If a visitor switches
 * away from the Platformer theme and back while this screen is showing,
 * `lifecycleState` still reads `'ending-screen'` (so the game loop's
 * early-return for that phase keeps firing forever — see PlatformerPage.tsx's
 * tick callback); a local `endingScreenOpen` would reset to `false` on
 * remount, meaning `<ThankYouScreen>` would never render — no visible way to
 * dismiss, and `endingScreenShown` (correctly still `true`) blocks the "all
 * chests open" check from ever re-triggering it either, permanently stuck
 * paused with nothing on screen. Being module-level (matching
 * `endingScreenShown`'s lifetime) means a remount sees the screen was open
 * and keeps showing it, same as it would without ever switching themes.
 *
 * PlatformerPage.tsx must call `useSignals()` (from
 * `@preact/signals-react/runtime`, same as ThankYouScreen.tsx already does)
 * for reading `.value` in its JSX to actually re-render on change — a plain
 * signal read outside that hook (or outside `<Component>`-wrapped access)
 * would not resubscribe the component.
 */
export const endingScreenOpen = signal(false);

/**
 * One-shot latch (spec.md FR-036): true once the visitor
 * has dismissed the controls overlay (i.e. walked far enough from where it
 * appeared — see ControlsOverlay.tsx) this browser session. Unlike
 * `endingScreenShown` above, this is NEVER reset by
 * `resetGame()` or `resetGameProgress()` — FR-036 requires the overlay to
 * not reappear "for the remainder of the session", and a visitor clicking
 * Reset Game is still the same session, not a new one. Module-level (not a
 * component-local `useState`) for the same reason `endingScreenShown` is:
 * it must survive a theme-switch unmount/remount of `PlatformerPage`.
 */
export const controlsOverlayDismissed = signal(false);

/**
 * Question-mark blocks' spawned bonus fruits — starts empty;
 * `PlatformerPage.tsx` appends one each time a question-mark block is hit.
 * Persists across a death/respawn (same reasoning as `blockStates` above);
 * cleared only by `resetGameProgress()`.
 */
export const bonusFruitStates = signal<BonusFruitState[]>([]);

/**
 * Dropped-key pickups (one per purple-slime finishing stomp) — starts empty.
 * Collected entries stay in this array flagged `collected: true` rather than
 * being removed so the renderer's skip-if-collected logic (see
 * entities/KeyPickup.ts's doc comment) keeps working across a death/respawn.
 * The guarantee that a defeated purple slime can never drop a second key
 * lives elsewhere now: on the source enemy's own `rewardGiven` flag
 * (Enemy.ts), not on anything read from this array. Persists across a
 * death/respawn (resetGame()), same as blockStates/bonusFruitStates —
 * cleared only by resetGameProgress().
 */
export const keyPickupStates = signal<KeyPickupState[]>([]);

/**
 * Count of keys currently held, spent one at a time to open a chest
 * (spec.md FR-020e/FR-023). Persists across a death/respawn, same as
 * keyPickupStates above — cleared only by resetGameProgress().
 */
export const collectedKeys = signal<number>(0);

/**
 * Facts discovered so far this session (see spec.md FR-032). Starts empty;
 * populated via real coin/fruit collection, enemy defeat, block hits, and
 * chest opens.
 */
export const collectedFacts = signal<CollectedFact[]>([]);

/**
 * Ids of every collected-and-removed collectible this session (dedup key,
 * FR-020c) — kept separate from `collectedFacts` since a collectible's
 * removal-from-the-world state and its fact-content-in-the-journal state,
 * while always updated together (see PlatformerPage.tsx's collection
 * handler), are conceptually different concerns.
 */
export const collectedCollectibleIds = signal<Set<string>>(new Set());

/** Currently animating fact-flight/sparkle effects (see engine/CollectionEffects.ts). */
export const activeEffects = signal<FlightEffect[]>([]);

/**
 * The currently-visible "(icon) collected / total" counter popups, one slot
 * per collectible type. A missing key means that type has nothing showing.
 * Collecting a coin while a coin popup is already up refreshes THAT slot
 * (new count, timer restarted) rather than queuing a second one; collecting
 * a coin and a fruit close together shows both at once, since they're
 * genuinely different information (see CounterPopupEffect's doc comment).
 */
export const activeCounterPopups = signal<Partial<Record<CounterPopupLabelKey, CounterPopupEffect>>>({});

/**
 * The journal's last manually-selected bookmark section, remembered across
 * closing and reopening the journal — `Journal.tsx`
 * itself fully unmounts on close, so this can't live in its local
 * `useState`. `undefined` until the user clicks a bookmark tab for the
 * first time, in which case `Journal.tsx` falls back to defaulting from
 * the first collected fact's section this session (`facts[0]`, not the most
 * recently collected one).
 */
export const activeJournalSection = signal<SectionId | undefined>(undefined);

/**
 * The hint-sign tooltip's current grow+fade animation state (see
 * engine/HintTooltip.ts), or `null` when no
 * tooltip is active/animating. Updated every game-loop tick (see
 * PlatformerPage.tsx's transition/tick logic) and read by `render()` to
 * decide whether/what/where to draw. Cleared by `resetGame()` (and so also
 * by `resetGameProgress()`, which calls it): a death/respawn or restart
 * moves the player away from wherever the tooltip was anchored, so a
 * lingering bubble would otherwise freeze on screen through the death
 * animation and the `awaitingRestart` wait, then flash once at the new
 * spawn point before the tick logic naturally clears it.
 */
export const hintTooltipState = signal<HintTooltipState | null>(null);

/**
 * World-space center point (not top-left) of the spawned player — used to
 * center the iris-in transition on the character at game start/restart,
 * matching where the death iris-out is centered (the player's actual visual
 * midpoint, not its collision box's top-left corner).
 */
export function spawnCenter(): { x: number; y: number } {
  const spawn = spawnPlayerState();
  return { x: spawn.x + PLAYER_RENDERED_SIZE / 2, y: spawn.y + PLAYER_VISUAL_CENTER_Y_OFFSET };
}

/**
 * Death/respawn/intro phase state (see engine/GameLifecycle.ts). Starts in
 * `intro` (circle growing open) centered on the spawned player, the same as
 * what a restart transitions back to.
 */
export const lifecycleState = signal<LifecycleState>(
  introState(spawnCenter().x, spawnCenter().y),
);

/**
 * Resets the game world to its spawn state: player back at the spawn point,
 * full health, enemies revived in place at their spawn placements, camera
 * scrolled back to the level start. Does NOT touch `lifecycleState`,
 * `collectedFacts`, or `collectedCollectibleIds` — per FR-020c, a
 * death/respawn preserves everything already discovered; only the "Reset
 * Game" button clears those (see `resetGameProgress()` below). Callers
 * (restart-on-input and the debug Respawn button, both wired to the `intro`
 * iris-in) decide the lifecycle transition themselves, since not every
 * caller of a "reset" necessarily wants the iris animation.
 *
 * Enemies are revived via `reviveEnemy` on the existing `enemyStates`
 * objects rather than rebuilt from `enemyPlacements` — the same enemy
 * objects survive a death/respawn cycle so per-instance session state (see
 * `EnemyState.rewardGiven`) isn't wiped out by a fresh rebuild.
 * `resetGameProgress()` below is the only place still allowed to rebuild
 * from placements, which is what actually clears that session state.
 *
 * This is the single reset seam a full "Reset Game" button extends: enemies
 * are reset here; `resetGameProgress()` additionally clears collected facts
 * and respawns coins/blocks (FR-018b).
 */
export function resetGame(): void {
  playerState.value = spawnPlayerState();
  cameraPositionX.value = 0;
  cameraPositionY.value = 0;
  enemyStates.value = enemyStates.value.map(reviveEnemy);
  hintTooltipState.value = null;
}

/**
 * The "Reset Game" button's full reset (FR-018b) — unlike
 * `resetGame()`, this is a deliberate action the visitor takes, not a
 * death/respawn, so it also clears everything `resetGame()` leaves alone:
 * collected facts, the collected-collectible dedup set (clearing it is what
 * makes already-collected coins/fruits reappear in the level, since the
 * render/collision loop reads it live), the remembered active journal
 * bookmark (falls back to Journal.tsx's default section afterward), and any
 * in-flight fact-flight/sparkle animation (`activeEffects`) so a pickup
 * triggered just before Reset Game is clicked doesn't keep animating after
 * the journal closes. `lifecycleState` is deliberately left untouched: the
 * journal can only be opened from the `'playing'` phase
 * (`PlatformerPage.tsx`'s `handleJournalToggle`), so the phase is always
 * `'paused'` while Reset Game is clickable, and `resumeFromJournal` (already
 * called when the journal closes) correctly returns to `'playing'` — no
 * lifecycle transition is needed here, unlike `resetGame()`'s other callers
 * (death/respawn) which explicitly transition through `introState(...)`.
 */
export function resetGameProgress(): void {
  resetGame();
  collectedFacts.value = [];
  collectedCollectibleIds.value = new Set();
  activeJournalSection.value = undefined;
  activeEffects.value = [];
  activeCounterPopups.value = {};
  blockStates.value = blockPlacements.value.map(toBlockState);
  chestStates.value = chestPlacements.value.map(toChestState);
  endingScreenShown.value = false;
  endingScreenOpen.value = false;
  bonusFruitStates.value = [];
  keyPickupStates.value = [];
  collectedKeys.value = 0;
  enemyStates.value = enemyPlacements.value.map((placement, index) => toEnemyState(placement, index));
}
