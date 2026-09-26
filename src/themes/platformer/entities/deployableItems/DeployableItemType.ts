import type { Rect } from '../../contracts/geometry';
import type { WorldType } from '../../contracts/WorldType';
import type { DrawContext } from '../../contracts/DrawContext';
import type { CounterPopupLabelKey } from '../../contracts/counters';
import type { SpriteDescriptor } from '../sprites/SpriteSheet';
import type { DeployableItemKind } from '../../contracts/DeployableItemKind';
import type { LevelDef, TileType } from '../../level/LevelData';
import type { BlockPlacement } from '../../level/BlockMapper';
import type { CrumblingFloorTimerState } from '../../tiles/crumblingFloor';
import type { PlayerState } from '../Player';
import type { CollectedFact } from '../../types';
import type { BubbleMessageId } from '../../level/HintCatalog';

/** Which band `drawDeployableItems` draws this kind in (see Renderer.ts). */
export type DeployableItemDrawLayer = 'terrain' | 'afterBlocks' | 'afterCrumblingFloors';

/** One cell an item writes into the effective terrain grid. */
export interface TerrainCellWrite {
  col: number;
  row: number;
  tile: TileType;
}

/**
 * The shared state base every deployable-item state composes — the level's
 * player-affected objects (a placed bomb, a live rope ladder, a chest) all
 * carry a placement identity, a world position and a `kind` discriminator
 * whose value MUST equal the state's slot in `DEPLOYABLE_ITEM_TYPES`.
 */
export interface DeployableItemState {
  /** Per-placement id (e.g. `bomb-<col>-<row>-<seq>`, `ladder-bundle-<col>-<row>`). */
  id: string;
  /** Placement tile column. */
  col: number;
  /** Placement tile row. */
  row: number;
  /** World px, tile top-left. */
  x: number;
  /** World px, current (a falling bomb advances it). */
  y: number;
  /** Discriminator; MUST equal the state's registry slot. */
  kind: DeployableItemKind;
}

/**
 * A blast the shared late pass must resolve, at the item's current position.
 * Carries both effect ids so the page names no kind literal and the current
 * cosmetic/hit ids stay byte-identical to the shipped bomb blast.
 */
export interface BlastRequest {
  /** Blast damage grid tile: `round(x / RENDERED_TILE_SIZE)`. */
  col: number;
  /** Blast damage grid tile: `round(y / RENDERED_TILE_SIZE)`. */
  row: number;
  /** The item's current world position (explosion centre). */
  x: number;
  y: number;
  /** This blast's cosmetic explosion (the item's own id). */
  effectId: string;
  /** The player-hit splatter this blast may spawn. */
  hitEffectId: string;
}

/**
 * What a kind's late-phase hook asks the one shared applier to do. Returned as
 * data (mirroring `PickupOutcome`) so the hook stays pure and the page remains
 * the only writer of game state (`contracts/Outcome.ts`'s house rule).
 */
export interface DeployableItemOutcome {
  disposition: 'keep' | 'remove';
  blasts?: readonly BlastRequest[];
}

/** The only context a late-phase hook reads — generic, never kind-specific. */
export interface DeployableItemTickContext {
  readonly level: LevelDef;
}

/** One CV fact a player activation asks the shared applier to reveal, plus
 *  its flying-text anchor/effect id and optional counter popup. Mirrors
 *  `RevealOptions`. */
export interface DeployableItemReveal {
  fact: CollectedFact;
  effectId: string;
  x: number;
  y: number;
  counterKey?: CounterPopupLabelKey;
}

/** A kind's activation result: a new state to apply (plus any key cost/fact
 *  reveal), or a blocked hint to show. Declarative, like `PickupOutcome`. */
export type DeployableItemInteractionOutcome<
  S extends DeployableItemState = DeployableItemState,
> =
  | { kind: 'activate'; state: S; keyCost?: number; reveal?: DeployableItemReveal }
  | { kind: 'blocked'; hint: BubbleMessageId };

/** What a player-interaction hook reads. */
export interface DeployableItemInteractContext {
  readonly level: LevelDef;
  readonly player: PlayerState;
  readonly keys: number;
}

/** What a runtime-spawned kind's creation entry point receives. */
export interface DeployableSpawnContext {
  id: string;
  col: number;
  row: number;
  x: number;
  y: number;
  level: LevelDef;
  blocks: readonly BlockPlacement[];
  crumblingFloorStates: readonly CrumblingFloorTimerState[];
}

/**
 * Everything a player-affected low-count object's lifecycle, appearance,
 * player interaction, self-owned consequences and reset scope needs, owned
 * entirely by that kind's own module. A new kind is one module plus one
 * registry line; nothing in `Renderer.ts`, `Collision.ts` or the page's
 * tick/draw/interaction dispatch needs to change (R-008 FR-001).
 *
 * Composition is `WorldType<S>`, NOT `Boxed<S>`: a non-solid placed bomb and
 * a terrain ladder have no rectangle consumer, so `box` stays optional and
 * the chest supplies its trigger rect through the same optional member.
 *
 * Members use METHOD syntax (not function-typed properties) so a concrete
 * `DeployableItemType<PlacedBombState>` stays assignable to the widened
 * `DeployableItemType<DeployableItemState>` used by the generic dispatch under
 * `strictFunctionTypes`, with no `any` — the same convention
 * `entities/pickups/PickupType.ts` records.
 */
export interface DeployableItemType<
  S extends DeployableItemState = DeployableItemState,
> extends WorldType<S> {
  /** Must equal this module's slot in `DEPLOYABLE_ITEM_TYPES`. */
  key: DeployableItemKind;
  /** Primary sheet — discovered by the page's `collectSheetSources` walk. */
  sprite: SpriteDescriptor;
  /** Which band `drawDeployableItems` draws this kind in. */
  drawLayer: DeployableItemDrawLayer;
  /** Which reset clears this kind's entries: `death` (a placed bomb) or
   *  `progress` (an authored ladder/chest). */
  resetScope: 'death' | 'progress';
  /** OPTIONAL lifecycle advance, run by `tickDeployableItems` (early site). */
  step?(state: S, dt: number): S;
  /** OPTIONAL — the bomb/ladder have no collision-rectangle consumer; the
   *  chest supplies its trigger rect. */
  box?(state: S): Rect;
  /** OPTIONAL late-phase consequence hook (see `applyDeployableItemConsequences`). */
  onTick?(state: S, ctx: DeployableItemTickContext): DeployableItemOutcome;
  /** OPTIONAL player-initiated activation. Returns the new state, or `null`
   *  when this item is not the interaction target. */
  onPlayerInteract?(
    state: S,
    ctx: DeployableItemInteractContext,
  ): DeployableItemInteractionOutcome<S> | null;
  /** Lower runs first when several interactables match one press. Default 0. */
  interactionPriority?: number;
  /** OPTIONAL effective-terrain contribution while in a given state. */
  effectiveTerrainCells?(state: S): readonly TerrainCellWrite[] | null;
  draw(state: S, dc: DrawContext): void;
}

/** The player spawns it at runtime — requires a creation entry point and a
 *  lifecycle advance (today the placed bomb, created by the `B` key). */
export interface SpawnedType<S extends DeployableItemState = DeployableItemState>
  extends DeployableItemType<S> {
  spawn(ctx: DeployableSpawnContext): S;
  step(state: S, dt: number): S;
}

/** Placed in the level and activated by the player — requires the activation
 *  hook and its precedence (today the rope ladder and the chest). */
export interface WorldInteractableType<
  S extends DeployableItemState = DeployableItemState,
> extends DeployableItemType<S> {
  onPlayerInteract(
    state: S,
    ctx: DeployableItemInteractContext,
  ): DeployableItemInteractionOutcome<S> | null;
  interactionPriority: number;
  /** Still optional: the ladder unrolls, the chest is one-shot. */
  step?(state: S, dt: number): S;
}
