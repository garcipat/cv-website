import type { BlockType, BlockHitOutcome } from './BlockType';
import type { BlockState } from '../Block';
import type { DrawContext } from '../../engine/DrawContext';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { PickupKind } from '../pickups';
import type { DropPolicy, PotKind } from './potTypes';
import { PHYSICS_CONFIG } from '../../engine/PhysicsConfig';
import { drawClayPotAt } from './clayVariants';

/**
 * The declaration a pot kind's module writes; `createPotType` consumes it and
 * produces the full `BlockType`. This is the feature's extension point: a
 * kind contributes only its registry key, sprite, the pickup it drops, how
 * often it drops it, whether it is restored on respawn, and how it draws
 * itself alone — every shared behavior comes from the factory (FR-002).
 */
export interface PotTypeConfig {
  /** Marker letter / `BLOCK_TYPES` slot; must equal the kind's registry key. */
  key: string;
  /** The kind's sheet (clay pots → `STATIC_OBJECTS_SHEET`, bottle →
   *  `WORLD_TILESET_SHEET`). */
  sprite: SpriteDescriptor;
  /** The pickup a break leaves: `'coin'` (coin pot), `'heart'` (potion pot). */
  drop: PickupKind;
  /** How often `drop` is spawned — see `DropPolicy`. */
  dropPolicy: DropPolicy;
  /** Whether a death/respawn rebuilds this kind intact. */
  restoredOnRespawn: boolean;
  /** Draws this kind alone at its tile, applying its own bump offset. Must
   *  not read `dc.potPlan` or draw neighbours — `drawPotBunch` owns run
   *  iteration. */
  drawPot(block: BlockState, dc: DrawContext): void;
  /** Palette/journal fallback frame for callers outside `draw`; defaults to
   *  a constant 0. */
  frameIndex?(hitsTaken: number): number;
  /** Rendered px to shrink the solid hitbox by on each side, for art
   *  narrower than its tile (see `BlockType.hitboxInsetX`). */
  hitboxInsetX?: number;
}

/**
 * Draws a pot's whole bunch from one owner call. Only a run's leftmost block
 * (its owner) draws: it renders every member through that member's OWN
 * `drawPot` — so a coin-pot owner draws a neighbouring bottle and vice versa,
 * with no `blockKind` literal branch anywhere — then every clay filler.
 *
 * A block absent from the plan (no plan supplied, or a used-up instance
 * mid-bump that the plan already dropped) falls back to drawing itself alone,
 * which keeps a kind's own draw correct in isolation (research D4).
 */
export function drawPotBunch(ownKind: PotKind, block: BlockState, dc: DrawContext): void {
  const plan = dc.potPlan;
  const ownerId = plan?.ownerBlockId.get(block.id);
  if (!plan || ownerId === undefined) {
    ownKind.drawPot(block, dc);
    return;
  }
  if (ownerId !== block.id) return;
  const run = plan.runsByOwnerId.get(block.id);
  if (!run) {
    ownKind.drawPot(block, dc);
    return;
  }
  for (const member of run.blocks) member.kind.drawPot(member.block, dc);
  for (const filler of run.fillers) drawClayPotAt(dc, filler.x, filler.y, filler.variantIndex);
}

/**
 * Builds a pot `BlockType` from its kind-specific declaration. The factory
 * fixes every shared behavior so no kind can vary it: one hit, removal when
 * used up, a land-on-top trigger, the shared upward bounce, the shared
 * destruction puff (the existing `BlockType`/`BlockState` machinery), the
 * `drawPotBunch` renderer, and the `PotKind` descriptor the render plan
 * reads.
 *
 * The derived `onHit` always returns `PHYSICS_CONFIG.potBounceVelocity`, and
 * includes `spawnPickup` only when the kind's `dropPolicy` allows a drop: an
 * `'everyBreak'` pot always drops, a `'once'` pot only while the instance's
 * `rewardGiven` flag is still `false` (FR-017).
 */
export function createPotType(config: PotTypeConfig): BlockType {
  const pot: PotKind = {
    drop: config.drop,
    dropPolicy: config.dropPolicy,
    restoredOnRespawn: config.restoredOnRespawn,
    drawPot: config.drawPot,
  };

  return {
    key: config.key,
    sprite: config.sprite,
    maxHits: 1,
    removeWhenUsedUp: true,
    hitboxInsetX: config.hitboxInsetX,
    triggerSides: ['top'],
    onHit: (block: BlockState): BlockHitOutcome => {
      const outcome: BlockHitOutcome = { bounceVelocity: PHYSICS_CONFIG.potBounceVelocity };
      if (config.dropPolicy === 'everyBreak' || !block.rewardGiven) {
        outcome.spawnPickup = config.drop;
      }
      return outcome;
    },
    frameIndex: config.frameIndex ?? (() => 0),
    draw: (block: BlockState, dc: DrawContext) => drawPotBunch(pot, block, dc),
    pot,
  };
}
