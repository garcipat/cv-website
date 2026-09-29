/**
 * The per-kind tile contract: a {@link TileModule} declares one shipped
 * tile kind's authoring character, its capability flags, its context-dependent
 * behaviour rules, its appearance, and — for the stateful kinds — its transient
 * state descriptor.
 *
 * Types only: no runtime code lives here. Every runtime value a module carries
 * relocates byte-for-byte from the shipped predicates/tables it replaces.
 *
 * Layer note: this file imports `contracts/`/`shared/`/`level/` only, never
 * `entities/` or `engine/`.
 */

import type { LevelDef } from '../level/LevelData';

/** A cell's solid region in rendered px, relative to the cell's own top edge. */
export interface TileSolidRegion {
  top: number;
  bottom: number;
}

/** Rule-time context: the live transient state a rule may read, plus the query's direction. */
export interface TileRuleContext {
  /** The declared transient state of the stateful tile kinds ( owns its lifecycle). */
  readonly transient: TileTransientState;
  /** Rising-from-below / active-drop-through query: one-way tiles resolve as passable. */
  readonly excludeOneWay?: boolean;
}

/** The neutral grid-timer shape shared with `shared/timedTile.ts` (`{ col, row, elapsed }`). */
export interface GridTimerState {
  readonly col: number;
  readonly row: number;
  readonly elapsed: number;
}

/**
 * The transient state bundle the rules/draw may read. Declared structurally (not
 * by importing the stateful kinds) so this contract type-checks before those
 * modules exist; the concrete modules' state arrays satisfy this shape. Never
 * written here.
 */
export interface TileTransientState {
  readonly crumblingFloorTimers: readonly GridTimerState[];
  readonly mushroomSquashes: readonly GridTimerState[];
}

/**
 * Declares a stateful kind's transient state. Mirrors `shared/timedTile.ts`'s
 * `TimedTileConfig`: the kind supplies these values, owns the lifecycle.
 */
export interface TileStateDescriptor {
  readonly keyOf: (state: GridTimerState) => { readonly col: number; readonly row: number };
  readonly duration: number;
  readonly prune: boolean;
  readonly rearm: 'replace' | 'noop';
  /** Kind-specific phase/offset mapping (e.g. `mushroomSquashDip`, `crumblingFloorPhaseAt`). */
  readonly phaseOf?: (elapsed: number) => number | string;
}

/** The resolved images the terrain/crumbling passes already hold, keyed by role. */
export interface TerrainImages {
  readonly tileset: HTMLImageElement;
  readonly groundAtlas: HTMLImageElement;
  readonly staticObjects: HTMLImageElement | null;
  readonly decorations: HTMLImageElement | null;
  readonly torch: HTMLImageElement | null;
  readonly mushroom: HTMLImageElement | null;
  readonly crumblingLedge: HTMLImageElement | null;
  readonly crumblingCracks: HTMLImageElement | null;
}

/** Draw-time context. Carries no sheet descriptors, so a tile module imports no entities/. */
export interface TileDrawContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly level: LevelDef;
  readonly col: number;
  readonly row: number;
  readonly destX: number; // tileToPixel(col,row).x + originX
  readonly destY: number; // tileToPixel(col,row).y + originY
  readonly originX: number;
  readonly originY: number;
  readonly worldElapsed: number;
  readonly images: TerrainImages;
  readonly transient: TileTransientState;
}

/** Which pipeline band draws a kind. Preserves today's depth without a per-kind branch. */
export type TileDrawBand = 'terrain' | 'afterHazards' | 'deployable';

/** One self-contained tile kind. */
export interface TileModule {
  /** The author-placeable level character, or absent for registry-only kinds. */
  readonly char?: string;
  /** Whether cave fog leaves this kind visible (relocated `TILE_FOG_EXEMPT`). */
  readonly fogExempt: boolean;
  /** Plain "blocks movement" (relocated `isSolid`). */
  readonly solid?: boolean;
  /** One-way solid: passable from below and while dropping through (bridge). */
  readonly oneWay?: boolean;
  /** Climbable (ladder / chain / ropeLadder). */
  readonly climbable?: boolean;
  /** Claims Down while stood on, to drop through (bridge). */
  readonly dropThrough?: boolean;
  /** Which band draws this kind. */
  readonly drawBand: TileDrawBand;

  /** Phase/inset-aware solidity. Absent ⇒ the `solid` flag resolves to a full cell. */
  solidRegionAt?(
    level: LevelDef,
    col: number,
    row: number,
    ctx: TileRuleContext,
  ): TileSolidRegion | null;
  /** One-way ground term (ladder shaft top, rolled bundle top, mushroom cap). */
  standableAt?(level: LevelDef, col: number, row: number, ctx: TileRuleContext): boolean;
  /** Appearance for this cell (or the whole run from its top cell). */
  draw?(rc: TileDrawContext): void;
  /** Declared transient state (stateful kinds only); the lifecycle stays 's. */
  readonly state?: TileStateDescriptor;
}
