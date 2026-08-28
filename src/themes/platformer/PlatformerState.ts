import { signal } from '@preact/signals-react';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import {
  SPAWN_TILE,
  ENEMY_TILES_GREEN,
  ENEMY_TILES_PURPLE,
  COIN_TILES,
  FRUIT_TILES,
} from './level/level1';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_VISUAL_CENTER_Y_OFFSET,
} from './entities/Player';
import { MAX_HALF_HEARTS } from './entities/Health';
import { toEnemyState } from './entities/Enemy';
import type { EnemyState } from './entities/Enemy';
import { introState } from './engine/GameLifecycle';
import { currentCV } from '@/state/locale';
import { mapCVDataToCollectibles, placeCollectibles } from './level/CollectibleMapper';
import { mapCVDataToEnemies, placeEnemies } from './level/EnemyMapper';
import type { PlayerState } from './entities/Player';
import type { LifecycleState } from './engine/GameLifecycle';
import type { CollectedFact, SectionId } from './types';
import type { CollectiblePlacement } from './level/CollectibleMapper';
import type { EnemyPlacement } from './level/EnemyMapper';
import type { FlightEffect } from './engine/CollectionEffects';

/**
 * The player's state at the level's spawn point — full health's worth of
 * idle standing on the ground. Exported (not just used once for the initial
 * signal value) because restart logic (PlatformerPage.tsx, wired in a later
 * task) calls this again to reset `playerState` back to spawn after a death.
 */
export function spawnPlayerState(): PlayerState {
  // SPAWN_TILE is the empty cell the character stands in (see level1.ts's
  // `S` marker) — the ground surface is that cell's bottom edge.
  const spawnCell = tileToPixel(SPAWN_TILE.col, SPAWN_TILE.row);
  const groundSurfaceY = spawnCell.y + RENDERED_TILE_SIZE;
  const x = spawnCell.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
  const y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 'right',
    grounded: false,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
  };
}

/** Player position/animation state — mutated by the game loop (added in later steps). */
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
 * Current health in half-heart units (0-MAX_HALF_HEARTS). Kept separate from
 * `playerState` since damage sources (pit falls, and later enemy hits) are a
 * distinct concern from position/animation, and step 10's full-heal-on-death
 * only needs to touch this signal, not reconstruct player position/state.
 */
export const healthState = signal(MAX_HALF_HEARTS);

/**
 * Every collectible in the level, placed once at module load from the
 * current locale's CVData (see `@/state/locale`'s `currentCV`) — a plain
 * constant, not a signal, matching `level1`: neither is locale-reactive yet
 * (switching EN/DE mid-session doesn't re-place collectibles or change
 * which are already collected; that's roadmap step 26's theme-switch-reset
 * job, not this step's). Every position comes from level1's hand-placed
 * `C`/`F` markers (see COIN_TILES/FRUIT_TILES) — placeCollectibles has no
 * auto-placement, same as placeEnemies below.
 */
export const collectiblePlacements: CollectiblePlacement[] = placeCollectibles(
  mapCVDataToCollectibles(currentCV.value),
  { coin: COIN_TILES, fruit: FRUIT_TILES },
);

/**
 * Every enemy in the level, placed once at module load — same non-reactive
 * convention as collectiblePlacements above (see its comment): no movement,
 * defeat, or locale-reactivity yet (roadmap steps 17/18/26). Every position
 * comes from level1's hand-placed `E`/`M` markers (see ENEMY_TILES_GREEN/
 * ENEMY_TILES_PURPLE) — placeEnemies has no auto-placement. A marker is a
 * slot on the map; each slot draws the next fact from CVData as its reward.
 * level1 currently has one `E` and one `M`, so only the first certificate
 * and first project actually have an enemy — the rest of CVData's
 * certificates/projects simply aren't on the map yet, which is expected for
 * this mechanics-test level, not a bug (see level1.ts's doc comment).
 */
export const enemyPlacements: EnemyPlacement[] = placeEnemies(mapCVDataToEnemies(currentCV.value), {
  slimeGreen: ENEMY_TILES_GREEN,
  slimePurple: ENEMY_TILES_PURPLE,
});

/**
 * Live, per-frame patrol state for every enemy — position/velocity/
 * direction/animation, updated by the game loop's `stepEnemyPatrol` (see
 * PlatformerPage.tsx). Seeded from `enemyPlacements` (module load) and reset
 * back to that seed in `resetGame()`, same convention as `playerState`.
 */
export const enemyStates = signal<EnemyState[]>(
  enemyPlacements.map((placement, index) => toEnemyState(placement, index)),
);

/**
 * Facts discovered so far this session (see spec.md FR-032). Starts empty —
 * step 12 (this step) is what actually populates it via real coin/fruit
 * collection; the temporary two-item seed data step 13 relied on to verify
 * the journal skeleton is gone.
 */
export const collectedFacts = signal<CollectedFact[]>([]);

/**
 * Ids of every collected-and-removed collectible this session (dedup key,
 * FR-020c) — kept separate from `collectedFacts` since a collectible's
 * removal-from-the-world state and its fact-content-in-the-journal state,
 * while always updated together (see PlatformerPage.tsx's collection
 * handler, Task 8), are conceptually different concerns, matching how
 * `healthState`/`playerState` are already kept separate.
 */
export const collectedCollectibleIds = signal<Set<string>>(new Set());

/** Currently animating fact-flight/sparkle effects (see engine/CollectionEffects.ts). */
export const activeEffects = signal<FlightEffect[]>([]);

/**
 * The journal's last manually-selected bookmark section, remembered across
 * closing and reopening the journal (per user request) — `Journal.tsx`
 * itself fully unmounts on close, so this can't live in its local
 * `useState`. `undefined` until the user clicks a bookmark tab for the
 * first time, in which case `Journal.tsx` falls back to defaulting from
 * the first collected fact's section this session (`facts[0]`, not the most
 * recently collected one).
 */
export const activeJournalSection = signal<SectionId | undefined>(undefined);

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
 * full health, camera scrolled back to the level start. Does NOT touch
 * `lifecycleState`, `collectedFacts`, or `collectedCollectibleIds` — per
 * FR-020c, a death/respawn preserves everything already discovered; only a
 * future "Reset Game" button (roadmap step 15) clears those. Callers
 * (Task 5's restart-on-input and debug Respawn button, both wired to the
 * `intro` iris-in) decide the lifecycle transition themselves, since not
 * every future caller of a "reset" necessarily wants the iris animation.
 *
 * This is the single reset seam other roadmap steps extend: step 15's
 * "Reset Game" button will additionally need to clear collected facts and
 * respawn enemies/coins/blocks once those exist — this task doesn't build
 * any of that, it only resets what already exists (position, health,
 * camera).
 */
export function resetGame(): void {
  playerState.value = spawnPlayerState();
  healthState.value = MAX_HALF_HEARTS;
  cameraPositionX.value = 0;
  enemyStates.value = enemyPlacements.map((placement, index) => toEnemyState(placement, index));
}

/**
 * The "Reset Game" button's full reset (roadmap step 15, FR-018b) — unlike
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
}
