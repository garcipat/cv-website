import type { BlockState } from '../Block';
import type { DrawContext } from '../../contracts/DrawContext';
import type { PickupKind } from '../../contracts/PickupKind';

/** How often a pot kind's configured pickup is spawned when the pot is
 *  destroyed: `'once'` spawns it only while the instance's `rewardGiven`
 *  flag is still `false` (the coin pot), `'everyBreak'` spawns it on every
 *  destruction including after a respawn (the potion pot). Modeled per kind
 *  so a future restored pot can pick either without touching shared
 *  behavior — see `createPotType` in `pot.ts`. */
export type DropPolicy = 'once' | 'everyBreak';

/**
 * The shared pot descriptor carried by every pot `BlockType` (see
 * `BlockType.pot?`). Holds only what a pot kind is allowed to own beyond its
 * marker/sprite: the pickup it drops, how often it drops it, whether it is
 * restored on respawn, and how it draws itself alone. Everything else about
 * a pot — collision, one-hit removal, the land-on-top trigger, the shared
 * bounce, the puff — is fixed by `createPotType` and never restated per kind.
 */
export interface PotKind {
  /** The pickup a break leaves: `'coin'` (coin pot), `'heart'` (potion pot). */
  drop: PickupKind;
  /** How often `drop` is spawned — see `DropPolicy`. */
  dropPolicy: DropPolicy;
  /** Whether a death/respawn rebuilds this kind intact. True only for the
   *  potion pot today (read via `restoredOnRespawnForBlock`). */
  restoredOnRespawn: boolean;
  /** Draws this kind alone at its tile with its own bump offset. Never draws
   *  a run or reads `dc.potPlan` — the shared `drawPotBunch` owns run
   *  iteration, so a kind's own draw is correct both in isolation and in a
   *  bunch. */
  drawPot(block: BlockState, dc: DrawContext<PotRenderPlan>): void;
}

/** One live pot in a `PotRun`, carrying its own `PotKind` so a run's owner
 *  can draw a member without looking the kind up in the registry (research
 *  D4). */
export interface PotRunMember {
  block: BlockState;
  kind: PotKind;
}

/** One clay filler centred on the shared boundary between two adjacent run
 *  members — `x = left.x + RENDERED_TILE_SIZE / 2`, `y = left.y`. */
export interface PotFiller {
  x: number;
  y: number;
  variantIndex: number;
}

/** A maximal left-to-right run of adjacent live pot tiles in one row, of any
 *  kinds. `fillers.length === blocks.length - 1`. */
export interface PotRun {
  blocks: PotRunMember[];
  fillers: PotFiller[];
}

/** This frame's pot bunch-rendering plan, computed fresh from the live block
 *  list by `computePotRenderPlan` and thrown away after the frame. */
export interface PotRenderPlan {
  /** Every live pot member's run-owner id (a run's leftmost block's own id,
   *  for every member including the owner itself). */
  ownerBlockId: Map<string, string>;
  /** Each run, keyed by its owner's block id. */
  runsByOwnerId: Map<string, PotRun>;
}
