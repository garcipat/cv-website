# Contract: Tile Module & Registry

**Feature**: `R-015-platformer-tile-module-registry`
**Consumers**: R-008 (rope-ladder art geometry), R-009 (`SceneRenderer` terrain draw dispatch),
R-010 (editor palette read model), the platformer engine/level/state layers.
**Status**: design contract for the plan; implementation lands in `src/themes/platformer/tiles/`.

This project has no network API; the "contract" is the TypeScript module interface plus the registry
dispatch semantics. All types below are project-relative and use `src/themes/platformer/` as root.

---

## 1. `tiles/TileModule.ts` — the per-kind interface

```ts
import type { LevelDef } from '../level/LevelData';

/** A cell's solid region in rendered px, relative to the cell's own top edge. */
export interface TileSolidRegion {
  top: number;
  bottom: number;
}

/** Rule-time context: the live transient state a rule may read, plus the query's direction. */
export interface TileRuleContext {
  /** The declared transient state of the stateful tile kinds (R-004 owns its lifecycle). */
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

/** The transient state bundle the rules/draw may read. Never written here. */
export interface TileTransientState {
  readonly crumblingFloorTimers: readonly GridTimerState[];
  readonly mushroomSquashes: readonly GridTimerState[];
}

/**
 * Declares a stateful kind's transient state. Mirrors `shared/timedTile.ts`'s
 * `TimedTileConfig`: the kind supplies these values, R-004 owns the lifecycle.
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
  readonly destX: number;   // tileToPixel(col,row).x + originX
  readonly destY: number;   // tileToPixel(col,row).y + originY
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
  solidRegionAt?(level: LevelDef, col: number, row: number, ctx: TileRuleContext): TileSolidRegion | null;
  /** One-way ground term (ladder shaft top, rolled bundle top, mushroom cap). */
  standableAt?(level: LevelDef, col: number, row: number, ctx: TileRuleContext): boolean;
  /** Appearance for this cell (or the whole run from its top cell). */
  draw?(rc: TileDrawContext): void;
  /** Declared transient state (stateful kinds only); the lifecycle stays R-004's. */
  readonly state?: TileStateDescriptor;
}
```

### 1.1 Contract obligations for every kind

1. Declares exactly the capabilities it has; omits the rest.
2. Declares `char` **iff** it is author-placeable in a level layout (`ropeLadder` omits it).
3. Declares `state` **iff** it carries runtime grid state; a stateful kind routes arm/advance/prune
   through `shared/timedTile.ts` and declares `keyOf`/`duration`/`prune`/`rearm` plus its
   phase/offset mapping — it never implements a second lifecycle.
4. Contains no import of `entities/` or `engine/` (see `layer-invariants.md`).
5. Its `draw` produces the exact same canvas operations as the pre-refactor path.

---

## 2. `tiles/registry.ts` — the single dispatch point

```ts
export const TILE_MODULES = {
  groundGrass: groundGrassModule,
  groundRock: groundRockModule,
  wall: wallModule,
  bridge: bridgeModule,
  ladder: ladderModule,
  chain: chainModule,
  bush: bushModule,
  fence: fenceModule,
  cobweb: cobwebModule,
  crystalCluster: crystalClusterModule,
  stalactite: stalactiteModule,
  stalagmite: stalagmiteModule,
  torch: torchModule,
  ladderBundle: ladderBundleModule,
  ropeLadder: ropeLadderModule,
  bouncyMushroom: bouncyMushroomModule,
  decorativeMushroom: decorativeMushroomModule,
  crumblingFloor: crumblingFloorModule,
  empty: emptyModule,
} satisfies Record<string, TileModule>;

export function isSolidTile(tile: TileType): boolean;
export function isSolidExcludingOneWay(tile: TileType): boolean;   // relocated isSolidExcludingBridge
export function isClimbableTile(tile: TileType): boolean;
export function tileSolidRegionAt(level, col, row, ctx): TileSolidRegion | null;
export function isStandableTileAt(level, col, row, ctx): boolean;
export function claimsDropThrough(level, col, row): boolean;

/** Derived membership. */
export const TERRAIN_CHARS: Readonly<Record<string, TileType | undefined>>;
export type TerrainChar = /* extracted from each module's `char` literal */;
export const TILE_FOG_EXEMPT: Record<TileType, boolean>;
export function isFogExempt(tile: TileType): boolean;

/** Appearance dispatch. */
export function drawTileAt(rc: TileDrawContext): void;  // only modules with the matching band
```

### 2.1 Dispatch semantics (must match today exactly)

| Helper | Semantics |
| --- | --- |
| `isSolidTile` | `TILE_MODULES[tile].solid === true`. Unchanged answers: `groundGrass/groundRock/wall/bridge` true; `crumblingFloor` false. |
| `isSolidExcludingOneWay` | `isSolidTile(tile) && !TILE_MODULES[tile].oneWay`. Only `bridge` differs from `isSolidTile`. |
| `isClimbableTile` | `ladder`, `chain`, `ropeLadder` true. |
| `tileSolidRegionAt` | `module.solidRegionAt?.(...)`, else full-cell region when `solid` and not excluded by `oneWay`; `null` otherwise. |
| `isStandableTileAt` | `module.standableAt?.(level,col,row,ctx) ?? false`. Covers ladder-top, bundle-top and mushroom-cap one-way ground terms. |
| `claimsDropThrough` | `TILE_MODULES[tileAt(level,col,row)].dropThrough === true`. |
| `drawTileAt` | Looks up the cell's module; draws only when `module.drawBand` matches the invoking band; otherwise no-op. |

**Exhaustiveness.** `satisfies Record<string, TileModule>` type-checks every entry while
`TileType = keyof typeof TILE_MODULES` (type-only import in `level/LevelData.ts`) keeps the union and
the registry in lock-step. Because `TileType` is derived, the FR-014 guard MUST pin a **frozen list of
the 19 shipped kind names** and assert the registry key set equals it — otherwise deleting a kind would
silently shrink `TileType` and make the exhaustiveness check vacuous.

---

## 3. `level/` integration

- `level/LevelData.ts`: `export type TileType = keyof typeof TILE_MODULES;` (type-only import).
  `TILE_FOG_EXEMPT`/`isFogExempt` move to the registry; `MarkerEntry`/`MarkerGrid`/`TileMap` are
  unchanged, never enter `TILE_MODULES`, and `tileAt` never returns a marker (FR-016).
- `level/LevelParser.ts`: imports `TERRAIN_CHARS` from the registry and composes the full editor
  `TileChar` from the derived terrain chars plus the entity/sign/hazard chars it already owns.
- `level/Terrain.ts`: keeps the pure grid readers and keeps `isSolid`/`isSolidExcludingBridge`/
  `isClimbable` as **thin wrappers delegating to the registry's one implementations**
  (`isSolidTile`/`isSolidExcludingOneWay`/`isClimbableTile`) — there is a single dispatch body, in
  `tiles/registry.ts`, so there is no second rule path (FR-018). It re-exports
  `tileSolidRegionAt`/`isStandableTileAt`/`claimsDropThrough` from the registry.
  `isStandableLadderTop`/`isStandableLadderBundleTop`/`isStandableMushroomCap` are removed.

---

## 4. Engine/state integration (consumers)

- `engine/Physics.ts` uses `isClimbable`, `tileSolidRegionAt(..., { excludeOneWay })`,
  `claimsDropThrough`, `isStandableCell`; its bridge and crumbling-floor literals are gone.
- `engine/Standable.ts`'s `isStandableCell` resolves terrain ground via `tileSolidRegionAt` and the
  one-way ground terms via `isStandableTileAt`.
- `engine/Renderer.ts`'s `drawTerrain` becomes a band-filtered `drawTileAt` loop; `tileSource` and the
  per-kind branches are deleted. `drawCrumblingFloors`/`drawDeployableItems` remain the depth-specific
  invocations.
- `PlatformerState.ts` keeps its signals/ticks/reset; only import paths retarget to
  `tiles/bouncyMushroom` and `tiles/crumblingFloor`.

---

## 5. Downstream consumer contract (R-008 / R-009 / R-010)

- **R-008** imports the moved rope-ladder art geometry (`ROPE_*`, `ropeLadderShaftPieces`) from
  `tiles/ropeLadder.ts` and keeps its lifecycle draw; the ladder bundle's tile module only declares
  `standableAt`, and the deployed rung declares `climbable` + `standableAt`.
- **R-009** consumes `TILE_MODULES[tile].draw` + `TileDrawContext` as the static-tile registry half it
  deferred; `drawTerrain`'s entry signature stays stable so R-009's relocation is unchanged.
- **R-010** consumes `char`, `fogExempt`, and the module's appearance/placement metadata via
  `TILE_MODULES`; R-015 exposes the contract but changes no editor behaviour and builds no second
  palette table.

---

## 6. Non-goals (contract boundaries)

- No tile-module may declare or own a second lifecycle, signal, tick or reset list.
- No compatibility re-export may preserve `tileSource`, a per-kind predicate, or a per-kind draw entry
  point (FR-018).
- Markers, entities, blocks and deployable items are **not** tile kinds and never enter `TILE_MODULES`.
- No new tile kinds, gameplay, tuning, art, level data or editor behaviour.
