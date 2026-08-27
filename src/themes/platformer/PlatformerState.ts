import { signal } from '@preact/signals-react';
import { tileToPixel, RENDERED_TILE_SIZE } from './level/Terrain';
import { SPAWN_TILE } from './level/level1';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_VISUAL_CENTER_Y_OFFSET,
} from './entities/Player';
import { MAX_HALF_HEARTS } from './entities/Health';
import { introState } from './engine/GameLifecycle';
import type { PlayerState } from './entities/Player';
import type { LifecycleState } from './engine/GameLifecycle';
import type { CollectedFact } from './types';

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
 * TEMPORARY seed data — steps 11/12 (coin render + collection) don't exist
 * yet, so nothing populates `collectedFacts` for real. These two entries only
 * exist so step 13's "see the collected fact listed" verification has
 * something to show. Delete this constant and switch `collectedFacts`'s
 * initial value to `[]` once step 12 lands.
 */
const SEED_COLLECTED_FACTS: CollectedFact[] = [
  {
    id: 'seed-skill-typescript',
    sectionId: 'skills',
    sectionLabel: 'Skills',
    data: { name: 'TypeScript', level: 90 },
    sourceType: 'coin',
  },
  {
    id: 'seed-language-german',
    sectionId: 'languages',
    sectionLabel: 'Languages',
    data: { name: 'German', flag: '\u{1F1E9}\u{1F1EA}', level: 100 },
    sourceType: 'coin',
  },
];

/**
 * Facts discovered so far this session (see spec.md FR-032). Populated for
 * real starting in step 12 — see the seed-data comment above.
 */
export const collectedFacts = signal<CollectedFact[]>(SEED_COLLECTED_FACTS);

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
 * `lifecycleState` — callers (Task 5's restart-on-input and debug Respawn
 * button, both wired to the `intro` iris-in) decide the lifecycle transition
 * themselves, since not every future caller of a "reset" necessarily wants
 * the iris animation (e.g. step 15's "Reset Game" button might not).
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
}
