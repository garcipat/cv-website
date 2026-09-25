import { signal, computed } from '@preact/signals-react';
import { tileToPixel, RENDERED_TILE_SIZE, markerAt } from './level/Terrain';
import { DEFAULT_TORCH_STRENGTH, type TorchLight } from './entities/Torch';
import {
  createDeployableLadderState,
  advanceDeployableLadder,
  applyDeployedLadders,
} from './engine/DeployableLadder';
import type { DeployableLadderState } from './engine/DeployableLadder';
import { advanceMushroomSquashes } from './entities/blocks/Mushroom';
import type { MushroomSquashState } from './entities/blocks/Mushroom';
import {
  armFloorSpike,
  advanceFloorSpikes,
  type FloorSpikeTimerState,
} from './entities/hazards/FloorSpike';
import { armCrumblingFloor, advanceCrumblingFloors } from './engine/CrumblingFloor';
import type { CrumblingFloorTimerState } from './engine/CrumblingFloor';
import {
  armFallingStalactite,
  advanceFallingStalactites,
  type FallingStalactiteTimerState,
} from './entities/hazards/FallingStalactite';
import { typeOf as hazardTypeOf } from './entities/hazards';
import type { HazardKind } from './entities/hazards';
import type { HazardTickContext } from './entities/hazards/HazardType';
import type { LevelDef } from './level/LevelData';
import {
  SPAWN_TILE,
  ENEMY_TILES_GREEN,
  ENEMY_TILES_PURPLE,
  BEE_TILES,
  COIN_TILES,
  CRATE_TILES,
  QUESTIONMARK_TILES,
  FRAGILE_ROCK_TILES,
  COIN_POT_TILES,
  POTION_POT_TILES,
  BOMB_POT_TILES,
  CHEST_TILES,
  CHECKPOINT_TILES,
  SIGN_TILES,
  HAZARD_TILES,
  currentLevel,
  TORCH_TILES,
  LADDER_BUNDLE_TILES,
} from './state/levelSession';
import {
  MAX_DARKNESS,
  DARKNESS_FADE_SECONDS,
  nextDarknessLevel,
  isCellDarkening,
  playerOccupiedCell,
} from './engine/Lighting';
import {
  PLAYER_RENDERED_SIZE,
  PLAYER_FOOT_PADDING,
  PLAYER_VISUAL_CENTER_Y_OFFSET,
  PLAYER_HIT_REACTION_SECONDS,
} from './entities/Player';
import { MAX_HALF_HEARTS } from './entities/Health';
import { toEnemyState, reviveEnemy } from './entities/Enemy';
import type { EnemyState } from './entities/Enemy';
import { toBlockState, isBlockUsedUp, restoredOnRespawnForBlock } from './entities/Block';
import type { BlockState } from './entities/Block';
import { toChestState } from './entities/Chest';
import type { ChestState } from './entities/Chest';
import { toCheckpointState } from './entities/Checkpoint';
import type { CheckpointState } from './entities/Checkpoint';
import type { FruitState } from './entities/pickups/Fruit';
import type { KeyPickupState } from './entities/pickups/Key';
import type { HeartPickupState } from './entities/pickups/Heart';
import type { BombPickupState } from './entities/pickups/Bomb';
import type { PlacedBombState } from './engine/PlacedBomb';
import { introState } from './engine/GameLifecycle';
import { currentCV } from '@/state/locale';
import { mapCVDataToSkillFactPool, placeCollectibles } from './level/CollectibleMapper';
import { mapCVDataToEnemies, placeEnemies } from './level/EnemyMapper';
import { mapCVDataToBlocks, placeBlocks } from './level/BlockMapper';
import { mapCVDataToChests, placeChests } from './level/ChestMapper';
import type { ChestPlacement } from './level/ChestMapper';
import { placeCheckpoints } from './level/CheckpointMapper';
import type { CheckpointPlacement } from './level/CheckpointMapper';
import { placeSigns } from './level/SignMapper';
import type { SignPlacement } from './level/SignMapper';
import { placeHazards } from './level/HazardMapper';
import type { HazardPlacement } from './level/HazardMapper';
import type { PlayerState } from './entities/Player';
import type { LifecycleState } from './engine/GameLifecycle';
import type { CollectedFact, SectionId } from './types';
import type { CollectiblePlacement } from './level/CollectibleMapper';
import type { Pickup, PickupGroups } from './contracts/Pickup';
import type { PickupKind } from './contracts/PickupKind';
import type { EnemyPlacement } from './level/EnemyMapper';
import type { BlockPlacement } from './level/BlockMapper';
import type { TransientEffect } from './engine/effects';
import {
  activeSpeechBubble,
  clearEffectsByResetScope,
  effectKeyOf,
  upsertEffect,
  withSpeechBubbleText,
} from './engine/effects';
import type { LevelTotals } from './entities/CollectiblesSummary';
import { hintText } from './state/hintText';

/**
 * The player's state at the level's spawn point — full health's worth of
 * idle standing on the ground. Exported (not just used once for the initial
 * signal value) because restart logic (PlatformerPage.tsx) calls this again
 * to reset `playerState` back to spawn after a death.
 */
/**
 * The player's state standing in an arbitrary level cell — full health,
 * motion cleared, `lastGroundedX/Y` seeded to the position, and `hitTimer` at
 * the end of the refractory window (immediately vulnerable, FR-014). The cell
 * is treated exactly as `spawnPlayerState` treats the spawn cell: the
 * character is horizontally centred over it and its feet land on the cell's
 * bottom edge (the ground surface FR-004 guarantees for a checkpoint). Pure
 * and not reactive on its own; `respawnPlayerState` below composes it with
 * the active checkpoint.
 */
export function playerStateAtTile(col: number, row: number): PlayerState {
  const cell = tileToPixel(col, row);
  const groundSurfaceY = cell.y + RENDERED_TILE_SIZE;
  const x = cell.x - (PLAYER_RENDERED_SIZE - RENDERED_TILE_SIZE) / 2;
  const y = groundSurfaceY - PLAYER_RENDERED_SIZE + PLAYER_FOOT_PADDING;
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    direction: 'right',
    grounded: false,
    climbing: false,
    crouching: false,
    isDroppingThroughBridge: false,
    lastGroundedX: x,
    lastGroundedY: y,
    // Seeded to the state's own feet, so a spawn/checkpoint respawn never
    // carries a stale pre-death feet line into the spear's swept test.
    prevFeetY: y + PLAYER_RENDERED_SIZE - PLAYER_FOOT_PADDING,
    animState: 'idle',
    animFrame: 0,
    animTimer: 0,
    knockbackTimer: 0,
    bounceAscending: false,
    blockContacts: [],
    hitPoints: MAX_HALF_HEARTS,
    alive: true,
    // `hitTimer` counts UP from a hit, so "no hit recently" is a value at or
    // past the reaction duration, not 0. Seeding 0 would hand the player a
    // free 0.8 s of invulnerability after every respawn.
    hitTimer: PLAYER_HIT_REACTION_SECONDS,
  };
}

/**
 * The player's state at the level's spawn point — full health's worth of
 * idle standing on the ground. Delegates to `playerStateAtTile` so the spawn
 * and a checkpoint respawn share one set of placement maths.
 */
export function spawnPlayerState(): PlayerState {
  return playerStateAtTile(SPAWN_TILE.value.col, SPAWN_TILE.value.row);
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
 * How dark the view currently is — `0` (fully bright) to `MAX_DARKNESS`
 * (FR-005). The only new stored value this feature adds: it is eased every
 * `playing` tick from the cell under the player's feet toward either
 * `MAX_DARKNESS` (that cell is covered by a cave-family background piece) or
 * `0` (it is not), so entering/leaving a cave fades rather than snapping
 * (FR-002/FR-003). Because the tick only runs in the `playing` phase, the
 * value freezes with the world during pause/death (research D2/D8).
 */
export const darknessLevel = signal(0);

/**
 * One game-loop tick of the darkness value. Reads the single cell under the
 * player's feet (bottom-centre, `playerOccupiedCell`) and eases the current
 * value toward `MAX_DARKNESS` or `0` over `DARKNESS_FADE_SECONDS`. Pure inputs
 * in, one signal write out; `resetGame()` returns it to `0` on respawn.
 */
export function tickDarkness(dt: number): void {
  const cell = playerOccupiedCell(playerState.value);
  const target = isCellDarkening(currentLevel.value, cell.col, cell.row) ? MAX_DARKNESS : 0;
  darknessLevel.value = nextDarknessLevel(darknessLevel.value, target, dt, DARKNESS_FADE_SECONDS);
}

/**
 * How present the outside-a-cave fog currently is — `0` (none) to
 * `MAX_DARKNESS` (reuses darkness's own cap: 0.97 already reads as opaque,
 * and sharing the constant with `darknessLevel` keeps the two effects'
 * endpoints from drifting apart over time — design.md notes fog *could*
 * safely go all the way to full opacity, since a fogged cell is never the
 * player's own, but there's no visual reason to). Eased every `playing` tick
 * from the same cell
 * `darknessLevel` reads, toward `MAX_DARKNESS` when that cell is NOT
 * cave-family or `0` when it is — the inverse of `darknessLevel`'s target,
 * which is what keeps the two mutually exclusive (O-028 FR-003). Because the
 * tick only runs in the `playing` phase, the value freezes with the world
 * during pause/death, matching `darknessLevel`.
 */
export const fogLevel = signal(0);

/**
 * One game-loop tick of the fog value — the mirror of `tickDarkness` with
 * the target inverted (O-028 FR-003/FR-004). Reads the same cell under the
 * player's feet and eases the current value toward `MAX_DARKNESS` (outside a
 * cave) or `0` (inside one) over the same `DARKNESS_FADE_SECONDS`, so the
 * two transitions read as one continuous effect. `resetGame()` returns it to
 * `0` on respawn.
 */
export function tickFog(dt: number): void {
  const cell = playerOccupiedCell(playerState.value);
  const target = isCellDarkening(currentLevel.value, cell.col, cell.row) ? 0 : MAX_DARKNESS;
  fogLevel.value = nextDarknessLevel(fogLevel.value, target, dt, DARKNESS_FADE_SECONDS);
}

/**
 * Every torch tile's world-space centre (`tileToPixel` plus half a rendered
 * tile) and its light strength, derived from `TORCH_TILES` so the Level Editor's
 * Try button updates it reactively like every other placement list. A torch's
 * strength is its `torch` marker's value, or `DEFAULT_TORCH_STRENGTH` when it
 * carries none. This is the light-source list the render pass reads for both
 * the darkness overlay's holes and the enemy-eye pass's local-darkness check
 * (research D4).
 */
export const torchPositions = computed<TorchLight[]>(() =>
  TORCH_TILES.value.map(({ col, row }) => {
    const { x, y } = tileToPixel(col, row);
    const marker = markerAt(currentLevel.value, col, row);
    return {
      col,
      row,
      x: x + RENDERED_TILE_SIZE / 2,
      y: y + RENDERED_TILE_SIZE / 2,
      strength: marker?.kind === 'torch' ? marker.strength : DEFAULT_TORCH_STRENGTH,
    };
  }),
);

/**
 * Every collectible in the level — purely positional now (see
 * `CollectibleMapper.ts`'s `mapCVDataToSkillFactPool` doc comment for why a
 * coin carries no CVData binding of its own), so this needs only the level's
 * hand-placed `o` markers (see COIN_TILES), not `currentCV` at all.
 * placeCollectibles has no auto-placement, same as placeEnemies below.
 */
export const collectiblePlacements = computed<CollectiblePlacement[]>(() =>
  placeCollectibles(COIN_TILES.value),
);

/**
 * The mutable, flag-carrying base coins — the `collected: true` entries the
 * pure `collectiblePlacements` cannot hold because it is level-derived.
 * Initialised from `collectiblePlacements` (each entry normalised to
 * `collected: false`) and re-derived uncollected only by
 * `resetGameProgress()` (the Level Editor's Try button and the Reset Game
 * button both route through it) — so a placed coin's flag survives
 * death/respawn, and a level change clears it. There is no signals effect;
 * the re-derivation seam is explicit. Reset Game / level change only, never
 * `resetGame()` (death/respawn).
 *
 * `collectiblePlacements` stays the pure source for `levelTotals`'s coin
 * count, which is deliberately not invalidated by a collect or a pot drop.
 */
export const baseCoinPlacements = signal<CollectiblePlacement[]>(
  collectiblePlacements.value.map((placement) => ({ ...placement, collected: false })),
);

/**
 * The ordered pool of skill-category facts a coin pickup can reveal — see
 * `CollectibleMapper.ts`'s `mapCVDataToSkillFactPool` doc comment.
 * `PlatformerPage.tsx` resolves how many of this pool's entries have been
 * revealed so far (and therefore which one a given pickup reveals) from
 * this via `level/SkillFactPacing.ts`'s `revealedFactCountFor` — proportional
 * across every coin the level has, not "the next entry in order" — for both
 * a walk-over coin and a coin dropped by a broken coin-pot.
 */
export const skillFactPool = computed<CollectedFact[]>(() => mapCVDataToSkillFactPool(currentCV.value));

/**
 * Coins dropped by a destroyed coin-pot this session — starts empty. Unlike
 * every other collectible (placed once at load time via
 * `collectiblePlacements`), a coin-pot's reward coin doesn't exist — and
 * isn't reachable/collectible — until its block is destroyed;
 * `PlatformerPage.tsx` appends to this the instant that happens. Reset to
 * `[]` by `resetGameProgress()` alongside `blockStates`, so a full "Reset
 * Game" also re-hides these behind their (now-restored) pots.
 */
export const spawnedCoinPlacements = signal<CollectiblePlacement[]>([]);

/**
 * Every currently-collectible coin: the mutable, flag-carrying
 * `baseCoinPlacements` plus any coin-pot drops so far this session. Every
 * player-facing read (collision, rendering, totals) that used to read
 * `collectiblePlacements` directly now reads this instead, so a dropped coin
 * behaves exactly like any other one.
 */
export const allCollectiblePlacements = computed<CollectiblePlacement[]>(() => [
  ...baseCoinPlacements.value,
  ...spawnedCoinPlacements.value,
]);

/**
 * Every enemy in the level, placed once at module load — same non-reactive
 * convention as collectiblePlacements above (see its comment): no
 * locale-reactivity. Every position comes from currentLevel's hand-placed
 * `M`/`m` markers (see ENEMY_TILES_GREEN/
 * ENEMY_TILES_PURPLE) — placeEnemies has no auto-placement. A marker is a
 * slot on the map; each slot draws the next fact from CVData as its reward.
 * currentLevel currently has one `M` and one `m`, so only the first course
 * and first certificate actually have an enemy — the rest of CVData's
 * certificates/projects/courses simply aren't on the map yet, which is expected for
 * this mechanics-test level, not a bug (see level.ts's doc comment).
 */
export const enemyPlacements = computed<EnemyPlacement[]>(() =>
  placeEnemies(mapCVDataToEnemies(currentCV.value), {
    slimeGreen: ENEMY_TILES_GREEN.value,
    slimePurple: ENEMY_TILES_PURPLE.value,
    bee: BEE_TILES.value,
  }),
);

/**
 * Every block in the level, placed once at module load — same
 * non-reactive, marker-driven convention as collectiblePlacements/
 * enemyPlacements above. Crates come from
 * `mapCVDataToBlocks` zipped against currentLevel's `X` markers; question-mark,
 * fragileRock, and coinPot blocks have no CVData mapping and are placed
 * directly from their `Q`/`F`/`u` markers (see BlockMapper.ts's placeBlocks)
 * — a coin-pot's eventual reward comes from the coin it drops, resolved
 * dynamically at pickup time, not from anything bound to the block. This
 * placement carries no live per-instance state (no hitsTaken/broken) — that
 * lives in `blockStates` below, once blocks respond to hits.
 */
export const blockPlacements = computed<BlockPlacement[]>(() =>
  placeBlocks(mapCVDataToBlocks(currentCV.value), {
    crate: CRATE_TILES.value,
    questionMark: QUESTIONMARK_TILES.value,
    fragileRock: FRAGILE_ROCK_TILES.value,
    coinPot: COIN_POT_TILES.value,
    potionPot: POTION_POT_TILES.value,
    bombPot: BOMB_POT_TILES.value,
  }),
);

/**
 * Every chest in the level, placed once at module load — same non-reactive,
 * marker-driven convention as blockPlacements above. One chest per real
 * Experience entry, zipped against currentLevel's `$` markers (see
 * ChestMapper.ts's placeChests).
 */
export const chestPlacements = computed<ChestPlacement[]>(() =>
  placeChests(mapCVDataToChests(currentCV.value), CHEST_TILES.value),
);

/**
 * Every placed-in-level count, computed once. Read by `PlatformerPage.tsx`'s
 * counter popups and `Journal.tsx`'s `collectiblesSummary` call — this used to
 * be seven separate `.filter(...).length` expressions across those two files,
 * with the coin total spelled two different ways.
 *
 * Two constraints that must survive later edits:
 *
 * 1. It reads base `collectiblePlacements`, NOT `allCollectiblePlacements`.
 *    Every coin-pot WILL drop a coin eventually, so counting placed coins plus
 *    every pot up front makes the coin total a fixed session constant by
 *    construction — and keeps this computed invalidated only by
 *    `currentLayout`/`currentCV` changes. Reading `allCollectiblePlacements`
 *    would invalidate it on every pot drop, mid-play.
 * 2. ONE combined computed, not five. Every input derives from `currentLayout`
 *    + `currentCV`, so no event invalidates one total without invalidating all
 *    of them; splitting per field would skip zero work and re-scatter the
 *    single source of truth this exists to create.
 *
 * `skillFactPool` deliberately stays separate: every total here is
 * level-dependent by construction (COIN_TILES/CRATE_TILES/etc. are all
 * `computed(() => findXTiles(currentLayout.value))`, which is what makes the
 * Level Editor's "Try" button update every downstream total reactively),
 * whereas the pool is CVData-derived and level-independent. Do not collapse
 * the two.
 */
export const levelTotals = computed<LevelTotals>(() => ({
  coins:
    collectiblePlacements.value.filter((p) => p.kind === 'coin').length +
    blockPlacements.value.filter((b) => b.blockKind === 'coinPot').length,
  fruits: blockPlacements.value.filter((b) => b.blockKind === 'questionMark' && b.fact).length,
  // Every green slime placed, not just the ones that happen to have a fact —
  // a green slime's fact(s) are now assigned proportionally by position
  // among every green marker (see EnemyMapper.ts's placeGreenSlimes), so the
  // denominator must be every instance of the type, not a fixed
  // 1:1-bound subset.
  enemies: enemyPlacements.value.filter((p) => p.type === 'slimeGreen').length,
  crates: blockPlacements.value.filter((b) => b.blockKind === 'crate').length,
  chests: chestPlacements.value.length,
}));

/**
 * Every hint sign in the level, placed once at module load — same
 * non-reactive-to-CVData-but-reactive-to-`currentLayout` convention as
 * chestPlacements/blockPlacements above. Unlike those, there's no CVData to
 * zip against: a marker's character alone determines its hintId (see
 * SignMapper.ts's placeSigns).
 */
export const signPlacements = computed<SignPlacement[]>(() => placeSigns(SIGN_TILES.value));

/**
 * Every spike hazard in the level, placed once at module load — same
 * non-reactive-to-CVData-but-reactive-to-`currentLayout` convention as
 * signPlacements above (a marker's character alone determines its
 * hazardType/facing, see HazardMapper.ts's placeHazards).
 */
export const hazardPlacements = computed<HazardPlacement[]>(() => placeHazards(HAZARD_TILES.value));

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
 * How many crates have been destroyed this session — read by
 * `PlatformerPage.tsx`'s crates counter popup and `Journal.tsx`'s summary
 * row, so the two can never disagree.
 *
 * Checks each of `blockPlacements`'s real crates by id rather than filtering
 * `blockStates` directly, for two reasons: (1) a destroyed crate is spliced
 * out of `blockStates` entirely once its shatter animation finishes (see
 * `isBlockRemoved`, applied in `PlatformerPage.tsx`'s per-tick block-state
 * update) — a placement whose id is no longer found there is destroyed just
 * as much as one still present with `isBlockUsedUp` true (mid-shatter), so
 * both must count immediately, not just the latter; and (2) `blockStates`
 * can carry EXTRA crate-kind entries beyond the level's real placements
 * (test helpers inject synthetic ones, id-distinct from any real crate) —
 * counting by placement id ignores those rather than corrupting the total.
 */
export const cratesDestroyed = computed<number>(
  () =>
    blockPlacements.value.filter((placement) => {
      if (placement.blockKind !== 'crate') return false;
      const live = blockStates.value.find((b) => b.id === placement.id);
      return !live || isBlockUsedUp(live);
    }).length,
);

/**
 * How many green slimes have been defeated this session — read by
 * `PlatformerPage.tsx`'s enemies counter popup and `Journal.tsx`'s summary
 * row, so the two can never disagree. Unlike `cratesDestroyed` above, a
 * defeated enemy is never removed from `enemyStates` (it stays, revivable —
 * see `Enemy.ts`'s `reviveEnemy`), so filtering by the permanent
 * `rewardGiven` flag is exact with no analogous undercount risk.
 */
export const enemiesDefeated = computed<number>(
  () => enemyStates.value.filter((e) => e.type === 'slimeGreen' && e.rewardGiven).length,
);

/**
 * Live open/closed state for every chest — mirrors blockStates above.
 * Seeded from chestPlacements (module load) and reset back to that seed only
 * by resetGameProgress() (the Reset Game button), NOT by resetGame()
 * (death/respawn) — a chest, like a block, is progress that persists across
 * a death (spec.md FR-023's "never re-closes except via Reset Game").
 */
export const chestStates = signal<ChestState[]>(chestPlacements.value.map(toChestState));

/**
 * Every checkpoint in the level, placed from `currentLayout`'s `C` markers
 * (see CHECKPOINT_TILES) — purely positional, no CVData binding. A `computed`
 * so the Level Editor's "Try" button updates it reactively like every other
 * placement list. The shipped level has none (checkpoints are authorable,
 * not shipped).
 */
export const checkpointPlacements = computed<CheckpointPlacement[]>(() =>
  placeCheckpoints(CHECKPOINT_TILES.value),
);

/**
 * Live per-instance checkpoint state — seeded dormant from
 * `checkpointPlacements`. Unlike blocks/chests, a raised flag survives a
 * death/respawn (`resetGame()` leaves this untouched, FR-015); only Reset
 * Game (`resetGameProgress()`) rebuilds it dormant.
 */
export const checkpointStates = signal<CheckpointState[]>(
  checkpointPlacements.value.map(toCheckpointState),
);

/**
 * The id of the checkpoint a death currently respawns at, or `null` when the
 * level's own spawn point is used. At most one id: set by the tick resolver
 * (engine/CheckpointLogic.ts) to the winning checkpoint — the first dormant
 * one entered this tick, else the first already-raised one entered
 * (FR-007/FR-009). Persists across death/respawn; cleared only by
 * `resetGameProgress()` (FR-015/FR-016).
 */
export const activeCheckpointId = signal<string | null>(null);

/**
 * The active checkpoint's static placement, or `null` when the level spawn is
 * the respawn point. Derived (not stored) so it reacts to
 * `activeCheckpointId`/`checkpointStates` like every other derived value.
 */
export const activeRespawnPlacement = computed<CheckpointPlacement | null>(() => {
  const id = activeCheckpointId.value;
  if (id === null) return null;
  const state = checkpointStates.value.find((checkpoint) => checkpoint.id === id);
  if (!state) return null;
  return { id: state.id, col: state.col, row: state.row, x: state.x, y: state.y };
});

/**
 * Where a death restarts the character: the active checkpoint's tile, or the
 * level's own spawn point when there is none (FR-010/SC-003). A `computed` so
 * `resetGame()` and the camera snap always see the current target.
 */
export const respawnPlayerState = computed<PlayerState>(() => {
  const placement = activeRespawnPlacement.value;
  return placement ? playerStateAtTile(placement.col, placement.row) : spawnPlayerState();
});

/** World-space visual centre of `respawnPlayerState` — what the restart/debug/
 *  Reset Game iris is centered on (FR-012). */
export const respawnCenter = computed<{ x: number; y: number }>(() => {
  const state = respawnPlayerState.value;
  return {
    x: state.x + PLAYER_RENDERED_SIZE / 2,
    y: state.y + PLAYER_VISUAL_CENTER_Y_OFFSET,
  };
});

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
 * Question-mark blocks' spawned fruits — starts empty; `PlatformerPage.tsx`
 * appends one each time a question-mark block is hit. Persists across a
 * death/respawn (same reasoning as `blockStates` above); cleared only by
 * `resetGameProgress()`.
 */
export const fruitStates = signal<FruitState[]>([]);

/**
 * Hearts dropped by destroyed potion-pots this session — starts empty, same
 * lifecycle as `fruitStates` above: `PlatformerPage.tsx` appends one each time
 * a potion-pot block is hit. A touched heart is retained and flagged
 * `collected` (skipped on draw/collision, never removed), and the array is
 * cleared by `resetGame()` (a dropped heart is tied to its now-restored pot).
 */
export const heartPickupStates = signal<HeartPickupState[]>([]);

/**
 * Dropped-key pickups (one per purple-slime finishing stomp) — starts empty.
 * Collected entries stay in this array flagged `collected: true` rather than
 * being removed, so the shared skip-if-collected logic (see
 * entities/pickups/Key.ts) keeps working across a death/respawn. The
 * guarantee that a defeated purple slime can never drop a second key lives
 * elsewhere now: on the source enemy's own `rewardGiven` flag (Enemy.ts), not
 * on anything read from this array. Persists across a death/respawn
 * (resetGame()), same as blockStates/fruitStates — cleared only by
 * resetGameProgress().
 */
export const keyPickupStates = signal<KeyPickupState[]>([]);

/**
 * Count of keys currently held, spent one at a time to open a chest
 * (spec.md FR-020e/FR-023). Persists across a death/respawn, same as
 * keyPickupStates above — cleared only by resetGameProgress().
 */
export const collectedKeys = signal<number>(0);

/** The maximum number of bombs the character can carry (FR-008). */
export const MAX_BOMBS = 5;

/**
 * How many bombs the character is carrying — always an integer in
 * `[0, MAX_BOMBS]`. Collecting a bomb pickup increments this by one while
 * below the cap (FR-007); placing consumes exactly one (FR-013). A `signal`
 * like `collectedKeys`.
 */
export const carriedBombs = signal<number>(0);

/**
 * Bombs dropped by destroyed bomb-pots this session — starts empty, same
 * lifecycle as `heartPickupStates`: appended when a bomb-pot breaks, retained
 * and flagged `collected` when collected, and cleared by `resetGame()` (a
 * dropped bomb is tied to its now-restored pot). A pickup at the cap is left
 * in the world, still bobbing, until the count drops below the cap (FR-009) —
 * the bomb kind's `maxPerTick` yields nothing at the cap.
 */
export const bombPickupStates = signal<BombPickupState[]>([]);

/** One kind's live array adapter — the kind→store seam the generic applier
 *  and spawn path use without naming a kind. `items` is the live read view. */
export interface PickupStore {
  readonly items: readonly Pickup[];
  /** Appends a freshly spawned pickup to this kind's live array. */
  append(item: Pickup): void;
  /** The shared applier's ONE collect-once action: flags every id `collected`,
   *  retaining the entry. */
  markCollected(ids: ReadonlySet<string>): void;
}

function markCollectedIn<S extends Pickup>(items: S[], ids: ReadonlySet<string>): S[] {
  return items.map((item) => (ids.has(item.id) ? { ...item, collected: true } : item));
}

const coinStore: PickupStore = {
  get items() {
    return allCollectiblePlacements.value;
  },
  append(item) {
    spawnedCoinPlacements.value = [...spawnedCoinPlacements.value, item as CollectiblePlacement];
  },
  markCollected(ids) {
    // A coin id may live in the base set or in this session's pot drops —
    // flag both so `allCollectiblePlacements` (their union) sees it.
    baseCoinPlacements.value = markCollectedIn(baseCoinPlacements.value, ids);
    spawnedCoinPlacements.value = markCollectedIn(spawnedCoinPlacements.value, ids);
  },
};

const fruitStore: PickupStore = {
  get items() {
    return fruitStates.value;
  },
  append(item) {
    fruitStates.value = [...fruitStates.value, item as FruitState];
  },
  markCollected(ids) {
    fruitStates.value = markCollectedIn(fruitStates.value, ids);
  },
};

const keyStore: PickupStore = {
  get items() {
    return keyPickupStates.value;
  },
  append(item) {
    keyPickupStates.value = [...keyPickupStates.value, item as KeyPickupState];
  },
  markCollected(ids) {
    keyPickupStates.value = markCollectedIn(keyPickupStates.value, ids);
  },
};

const heartStore: PickupStore = {
  get items() {
    return heartPickupStates.value;
  },
  append(item) {
    heartPickupStates.value = [...heartPickupStates.value, item as HeartPickupState];
  },
  markCollected(ids) {
    heartPickupStates.value = markCollectedIn(heartPickupStates.value, ids);
  },
};

const bombStore: PickupStore = {
  get items() {
    return bombPickupStates.value;
  },
  append(item) {
    bombPickupStates.value = [...bombPickupStates.value, item as BombPickupState];
  },
  markCollected(ids) {
    bombPickupStates.value = markCollectedIn(bombPickupStates.value, ids);
  },
};

/**
 * Kind→array adapter for the generic collect applier and spawn path — the
 * per-kind arrays stay separate (each with its own reset scope), but the page
 * reaches them by kind instead of naming them.
 */
export const pickupStores: Record<PickupKind, PickupStore> = {
  coin: coinStore,
  fruit: fruitStore,
  key: keyStore,
  heart: heartStore,
  bomb: bombStore,
};

/** The single per-kind groups value the page passes to both
 *  `checkPickupCollisions` and `drawPickups`. */
export const pickupGroups = computed<PickupGroups>(() => ({
  coin: allCollectiblePlacements.value,
  fruit: fruitStates.value,
  key: keyPickupStates.value,
  heart: heartPickupStates.value,
  bomb: bombPickupStates.value,
}));

/**
 * Live placed bombs — each one a ticking fuse that falls under gravity and
 * detonates after `BOMB_FUSE_SECONDS` (FR-015/FR-016). Never part of
 * `blockPlacements` (a placed bomb is non-solid) and never a blast target
 * (FR-025/FR-026). Cleared by `resetGame()` (FR-027).
 */
export const placedBombs = signal<PlacedBombState[]>([]);

/**
 * Facts discovered so far this session (see spec.md FR-032). Starts empty;
 * populated via real coin/fruit collection, enemy defeat, block hits, and
 * chest opens.
 */
export const collectedFacts = signal<CollectedFact[]>([]);

/**
 * THE one collection of live transient effects (R-004 FR-003). Every effect
 * family — flying text, counter popups, puffs, heal auras, hit splatters,
 * fade-out labels, explosions, debris — lives here; no family keeps a parallel
 * store. Effects are appended by `spawnEffect` below, advanced by the single
 * `advanceEffects` in the game tick, and drawn by the single `drawEffects`
 * dispatch at its pipeline layer. The four timed-tile timer signals elsewhere
 * in this module remain separate: they are keyed timers, not effect instances.
 */
export const activeEffects = signal<TransientEffect<unknown>[]>([]);

/**
 * Appends a transient effect to `activeEffects`, replacing in place when the
 * kind declares a keyed slot (`counterPopup`, keyed by `labelKey`) so a fresh
 * collect of the same type refreshes that slot rather than queuing a second
 * popup (FR-016). State-owned, so `engine/effects` keeps no `engine/ → state/`
 * import.
 */
export function spawnEffect(effect: TransientEffect<unknown>): void {
  activeEffects.value = upsertEffect(activeEffects.value, effect, effectKeyOf);
}

/**
 * Re-resolves the active speech bubble's stored localized text from the
 * derived `hintText` signal and rewrites that one effect only when the text
 * differs (the pure `withSpeechBubbleText` identity check). Called by the
 * render loop each frame, so a live bubble follows a language switch in the
 * same frame while a steady-state frame performs no collection write
 * (FR-005/FR-020). State-owned, like `spawnEffect`, so `engine/effects` keeps
 * no `engine/ → state/` import.
 */
export function refreshSpeechBubbleText(): void {
  const bubble = activeSpeechBubble(activeEffects.value);
  if (!bubble) return;
  const resolved = hintText.value[bubble.state.messageId];
  if (resolved === bubble.state.text) return;
  activeEffects.value = activeEffects.value.map((effect) =>
    effect === bubble ? withSpeechBubbleText(bubble, resolved) : effect,
  );
}

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
 * Every deployable rope-ladder bundle in the level, from `currentLayout`'s `@`
 * markers (see `LADDER_BUNDLE_TILES`). A `computed`, so the Level Editor's
 * "Try" button updates it reactively like every other placement list.
 */
export const deployableLadderPlacements = computed<DeployableLadderState[]>(() =>
  LADDER_BUNDLE_TILES.value.map(({ col, row }) =>
    createDeployableLadderState(currentLevel.value, col, row),
  ),
);

/**
 * Live per-bundle deployment state — seeded `rolled` from
 * `deployableLadderPlacements` (module load) and rebuilt from it only by
 * `resetGameProgress()` (Reset Game / the editor's Try / the theme-switch
 * remount), NOT by `resetGame()` (death/respawn). Same lifetime as blocks and
 * chests: a deployed ladder survives a death but is rolled back on a full
 * reset (FR-013).
 */
export const deployableLadderStates = signal<DeployableLadderState[]>(
  deployableLadderPlacements.value.map((state) => ({ ...state })),
);

/**
 * The effective terrain grid the physics simulation reads: the raw level with
 * every completed bundle's cells written as `ropeLadder`. Identical (same
 * object) to `currentLevel.value` when nothing is deployed, so the common case
 * allocates nothing. Rendering and every other subsystem keep reading the raw
 * `currentLevel` — only `stepPlayerPhysics` consumes this (O-011 research D2).
 */
export const activeLevel = computed<LevelDef>(() =>
  applyDeployedLadders(currentLevel.value, deployableLadderStates.value),
);

/**
 * Advances every in-progress unroll by `dt` seconds — called once per
 * game-loop tick in the `playing` phase (so it freezes with the world during
 * pause/death). Completed bundles are unchanged. O(bundles), not O(level).
 */
export function tickDeployableLadders(dt: number): void {
  deployableLadderStates.value = deployableLadderStates.value.map((state) =>
    advanceDeployableLadder(state, dt),
  );
}

/**
 * The transient cosmetic dips of recently-bounced bouncy-mushroom caps — one
 * entry per cap cell, each carrying how long ago it was hit. The only mutable
 * state the mushroom feature introduces; purely visual, never consulted by
 * collision or standability (FR-011/FR-015). Advanced/pruned by
 * `tickMushroomSquashes` and cleared by `resetGame()`.
 */
export const mushroomSquashStates = signal<MushroomSquashState[]>([]);

/**
 * Advances every in-progress cap dip by `dt` and drops expired ones — called
 * once per game-loop tick in the `playing` phase (so it freezes with the world
 * during pause/death, alongside `tickDarkness`/`tickDeployableLadders`).
 */
export function tickMushroomSquashes(dt: number): void {
  mushroomSquashStates.value = advanceMushroomSquashes(mushroomSquashStates.value, dt);
}

/**
 * Live per-instance cycle timers for floor spikes — one entry per tile that
 * has been triggered at least once, pruned back out once its cycle
 * completes (spec FR-009). Same "presence means in progress" convention as
 * `mushroomSquashStates`/`placedBombs`. Advanced by `tickFloorSpikes` and
 * cleared by `resetGame()`.
 */
export const floorSpikeTimerStates = signal<FloorSpikeTimerState[]>([]);

/** One kind's arming action — writes that kind's own timer signal. */
interface HazardTimerStore {
  arm(id: string): void;
}

/**
 * Kind→arming-action registry (R-007 D3). A brand-new armed-then-cycle hazard
 * kind declares its timer signal and one entry here (where signals live) — the
 * detection (`Collision.ts`), the per-tick merge (`hazardPlacementsForTick`),
 * and the page's damage/knockback block need no edit, exactly as R-006 records
 * for a new pickup family.
 */
const hazardTimerStores: Partial<Record<HazardKind, HazardTimerStore>> = {
  floorSpike: {
    arm: (id) => {
      floorSpikeTimerStates.value = armFloorSpike(floorSpikeTimerStates.value, id);
    },
  },
  fallingStalactite: {
    arm: (id) => {
      fallingStalactiteTimerStates.value = armFallingStalactite(
        fallingStalactiteTimerStates.value,
        id,
      );
    },
  },
};

/** Arms the hazard `id`'s cycle if it isn't already running (spec FR-003) —
 *  the caller (PlatformerPage.tsx) calls this once per tick for every id
 *  `checkHazardArmTriggers` returns; the dispatched store's own presence check
 *  makes a repeat call during an already-running cycle a no-op. */
export function armHazardTrigger(id: string): void {
  const hazard = hazardPlacements.value.find((h) => h.id === id);
  if (!hazard) return;
  hazardTimerStores[hazard.hazardType]?.arm(id);
}

/** Advances every running floor spike cycle by `dt` — called once per
 *  game-loop tick in the `playing` phase, alongside `tickMushroomSquashes`,
 *  so cycles freeze with the rest of the world during pause/death. */
export function tickFloorSpikes(dt: number): void {
  floorSpikeTimerStates.value = advanceFloorSpikes(floorSpikeTimerStates.value, dt);
}

/**
 * Live per-instance cycle timers for crumbling floor tiles — one entry per
 * cell that has been stepped on at least once, pruned back out once its
 * full cycle completes (spec FR-010). Keyed by grid position, unlike
 * `floorSpikeTimerStates`' placement ids, since a crumbling floor tile has
 * no separate placement list (O-023). Advanced by `tickCrumblingFloors` and
 * cleared by `resetGame()`.
 */
export const crumblingFloorTimerStates = signal<CrumblingFloorTimerState[]>([]);

/** Arms `(col, row)`'s cycle if it isn't already running (spec FR-003/FR-007)
 *  — called once per tick for every cell `checkCrumblingFloorTriggers`
 *  returns. */
export function armCrumblingFloorTrigger(col: number, row: number): void {
  crumblingFloorTimerStates.value = armCrumblingFloor(crumblingFloorTimerStates.value, col, row);
}

/** Advances every running crumbling floor cycle by `dt` — called once per
 *  game-loop tick in the `playing` phase, alongside `tickFloorSpikes`, so
 *  cycles freeze with the rest of the world during pause/death. */
export function tickCrumblingFloors(dt: number): void {
  crumblingFloorTimerStates.value = advanceCrumblingFloors(crumblingFloorTimerStates.value, dt);
}

/**
 * Live per-instance timer states for falling stalactites — one entry per
 * hazard that has been armed at least once. Unlike the floor spike's cycle,
 * entries are NEVER pruned: a `gone` (shattered) stalactite must stay gone for
 * the rest of the attempt (FR-013), so its entry persists until `resetGame()`
 * clears the whole array (FR-014).
 */
export const fallingStalactiteTimerStates = signal<FallingStalactiteTimerState[]>([]);

/** Advances every running falling-stalactite timer by `dt` — called once per
 *  game-loop tick in the `playing` phase, so timers freeze with the rest of
 *  the world during pause/death. Never prunes (FR-013). */
export function tickFallingStalactites(dt: number): void {
  fallingStalactiteTimerStates.value = advanceFallingStalactites(fallingStalactiteTimerStates.value, dt);
}

/**
 * `hazardPlacements` with each kind's live per-tick state merged in — the
 * merge itself is the hazard kind's own `withTickState` hook (floor spikes get
 * their cycle phase/extension, falling stalactites their phase and fall/shake
 * offsets; every other kind passes through unchanged by omitting the hook).
 * This is what `PlatformerPage.tsx` hands to `drawHazards`/`resolveHazardContacts`
 * instead of the raw (phase-unaware) `hazardPlacements` computed. Recomputed
 * fresh each call (not a `computed`) since it depends on signals that change
 * every tick during an active cycle. The state layer still assembles the
 * timer/context bundle; the hook reads only that parameter (no new
 * `entities/ → state/` edge).
 */
export function hazardPlacementsForTick(): HazardPlacement[] {
  const ctx: HazardTickContext = {
    floorSpikeTimers: floorSpikeTimerStates.value,
    fallingStalactiteTimers: fallingStalactiteTimerStates.value,
    activeLevel: activeLevel.value,
    blockStates: blockStates.value,
    crumblingFloorTimers: crumblingFloorTimerStates.value,
  };
  return hazardPlacements.value.map(
    (hazard) => hazardTypeOf(hazard).withTickState?.(hazard, ctx) ?? hazard,
  );
}

/**
 * Resets the game world to its respawn state: player back at the active
 * checkpoint (or the level's spawn point when none is active), full health,
 * enemies revived in place at their spawn placements, camera scrolled back to
 * the level start. Does NOT touch `lifecycleState`, `collectedFacts`, the
 * collected pickup flags (the coin/fruit/key arrays, including
 * `baseCoinPlacements`, are kept — permanence is reset scope alone), or
 * checkpoint memory (`checkpointStates`/`activeCheckpointId`) — a death/respawn
 * preserves every raised flag and the active target; only the "Reset Game"
 * button clears those (see `resetGameProgress()` below). Callers
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
 *
 * Blocks whose kind declares `restoredOnRespawn` (today only the potion pot)
 * are the one exception to "blocks persist across a death/respawn": every
 * such placement is rebuilt back to intact here — carrying over its
 * `rewardGiven` flag from the prior instance with the same id — and
 * `heartPickupStates` is cleared, since a dropped-but-uncollected heart is
 * tied to its now-restored pot, and leaving it in the world would let a
 * player collect a heal the pot itself is about to offer again. Every other
 * block kind (crate/questionMark/fragileRock/coinPot) is left untouched, same
 * as before. The flag is read from the registry (`restoredOnRespawnForBlock`)
 * so a future restored kind needs no edit here (FR-002/FR-014).
 */
export function resetGame(): void {
  playerState.value = respawnPlayerState.value;
  cameraPositionX.value = 0;
  cameraPositionY.value = 0;
  darknessLevel.value = 0;
  fogLevel.value = 0;
  // An in-progress cap dip must not survive a death/respawn (FR-015).
  mushroomSquashStates.value = [];
  // An in-progress floor spike cycle must not survive a death/respawn
  // (FR-014), same convention as the mushroom cap squash above it.
  floorSpikeTimerStates.value = [];
  // An in-progress crumbling floor cycle must not survive a death/respawn
  // (FR-013 — the spec's death/respawn reset requirement), same convention
  // as the floor spike cycle above it.
  crumblingFloorTimerStates.value = [];
  // Every shattered falling stalactite returns to hanging on death/respawn
  // (FR-014) — same convention as the floor spike/crumbling floor cycles
  // above. Transient effects are deliberately NOT all cleared here: only the
  // `'death'`-scoped kinds (the fade-out labels) are, so puffs, heal auras,
  // hit splatters, debris, explosions, flying text and counter popups — which
  // survive a death today — keep fading on their own duration (FR-006).
  fallingStalactiteTimerStates.value = [];
  enemyStates.value = enemyStates.value.map(reviveEnemy);
  // A label fading when the death/respawn happened must not survive it — it
  // would otherwise freeze on screen through the death animation and then
  // flash at the new respawn point.
  activeEffects.value = clearEffectsByResetScope(activeEffects.value, 'death');
  blockStates.value = [
    ...blockStates.value.filter((b) => !restoredOnRespawnForBlock(b.blockKind)),
    ...blockPlacements.value
      .filter((p) => restoredOnRespawnForBlock(p.blockKind))
      .map((p) => {
        const restored = toBlockState(p);
        // Carry the drop-once flag over from the prior instance with the same
        // id — the block analog of `reviveEnemy` preserving `rewardGiven` —
        // so a restored 'once' pot never drops a second pickup (FR-017).
        const prior = blockStates.value.find((b) => b.id === p.id);
        return prior ? { ...restored, rewardGiven: prior.rewardGiven } : restored;
      }),
  ];
  heartPickupStates.value = [];
  // O-012: a death/respawn removes every live placed bomb (never exploding
  // it), resets the carried count to zero, and clears dropped bomb pickups —
  // a dropped bomb is tied to its now-restored pot, exactly like a heart
  // (FR-027/FR-028). The `bombPot` restoration itself flows through the
  // `restoredOnRespawnForBlock` path above.
  placedBombs.value = [];
  carriedBombs.value = 0;
  bombPickupStates.value = [];
}

/**
 * The "Reset Game" button's full reset (FR-018b) — unlike
 * `resetGame()`, this is a deliberate action the visitor takes, not a
 * death/respawn, so it also clears everything `resetGame()` leaves alone:
 * collected facts, the collected pickup flags (re-deriving the base coins
 * uncollected and clearing the spawned/dropped arrays is what makes
 * already-collected coins/fruits reappear in the level, since the
 * render/collision loop reads them live), the remembered active journal
 * bookmark (falls back to Journal.tsx's default section afterward), and any
 * in-flight flying-text animation (`activeEffects`) so a pickup
 * triggered just before Reset Game is clicked doesn't keep animating after
 * the journal closes. This is also the level-change seam the editor's Try
 * routes through, so the mutable base coins follow a `currentLayout` change.
 * `lifecycleState` is deliberately left untouched: the
 * journal can only be opened from the `'playing'` phase
 * (`PlatformerPage.tsx`'s `handleJournalToggle`), so the phase is always
 * `'paused'` while Reset Game is clickable, and `resumeFromJournal` (already
 * called when the journal closes) correctly returns to `'playing'` — no
 * lifecycle transition is needed here, unlike `resetGame()`'s other callers
 * (death/respawn) which explicitly transition through `introState(...)`.
 */
export function resetGameProgress(): void {
  // Clear checkpoint memory FIRST, so the `resetGame()` below sees no active
  // checkpoint and returns the character to the level spawn (FR-016).
  activeCheckpointId.value = null;
  checkpointStates.value = checkpointPlacements.value.map(toCheckpointState);
  resetGame();
  // A full Reset Game empties the whole unified effect collection, whatever
  // each kind's reset scope (FR-006) — only a death/respawn preserves the
  // non-`'death'`-scoped kinds.
  activeEffects.value = [];
  collectedFacts.value = [];
  activeJournalSection.value = undefined;
  blockStates.value = blockPlacements.value.map(toBlockState);
  // Re-derive the mutable base coins uncollected (the pure
  // `collectiblePlacements` is the level-derived source) and clear this
  // session's pot drops — a full Reset Game makes every placed coin
  // reappear, exactly as clearing the old id set did.
  baseCoinPlacements.value = collectiblePlacements.value.map((placement) => ({
    ...placement,
    collected: false,
  }));
  spawnedCoinPlacements.value = [];
  chestStates.value = chestPlacements.value.map(toChestState);
  endingScreenShown.value = false;
  endingScreenOpen.value = false;
  fruitStates.value = [];
  heartPickupStates.value = [];
  keyPickupStates.value = [];
  collectedKeys.value = 0;
  deployableLadderStates.value = deployableLadderPlacements.value.map((state) => ({ ...state }));
  enemyStates.value = enemyPlacements.value.map((placement, index) => toEnemyState(placement, index));
}
