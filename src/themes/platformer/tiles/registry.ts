/**
 * The tile module registry (R-015): the single source of tile-kind membership
 * and the single dispatch point for every tile rule and draw.
 *
 * `TILE_MODULES` is one literal key per shipped kind. `level/LevelData.ts`
 * derives `TileType = keyof typeof TILE_MODULES` from it, and the char/fog
 * tables are derived here from each module's declared values. Adding a tile is
 * one module plus one line here — nothing else changes.
 *
 * ## Why the registry is lazy
 *
 * `level/` and `tiles/` form an accepted mutual edge: tile modules import the
 * pure grid readers from `level/Terrain.ts`, and `level/Terrain.ts` imports the
 * registry's dispatch helpers back. That makes `tile → Terrain → registry → tile`
 * a genuine import cycle, so a tile module can be part-way through evaluating
 * when the registry's own body runs. Reading a module's binding at that point is
 * a temporal-dead-zone error, so `TILE_MODULES` (and the char/fog tables derived
 * from it) read the module objects lazily — on first property access, by which
 * time every module is initialised. `keyof typeof TILE_MODULES` is unaffected:
 * the proxy's type is the literal key map.
 */

import type { LevelDef, TileType } from '../level/LevelData';
import { RENDERED_TILE_SIZE, tileAt } from '../level/Terrain';
import type {
  TileDrawBand,
  TileDrawContext,
  TileModule,
  TileRuleContext,
  TileSolidRegion,
} from './TileModule';
import { groundGrassModule } from './groundGrass';
import { groundRockModule } from './groundRock';
import { wallModule } from './wall';
import { bridgeModule } from './bridge';
import { ladderModule } from './ladder';
import { chainModule } from './chain';
import { bushModule } from './bush';
import { fenceModule } from './fence';
import { cobwebModule } from './cobweb';
import { crystalClusterModule } from './crystalCluster';
import { stalactiteModule } from './stalactite';
import { stalagmiteModule } from './stalagmite';
import { torchModule } from './torch';
import { ladderBundleModule } from './ladderBundle';
import { ropeLadderModule } from './ropeLadder';
import { bouncyMushroomModule } from './bouncyMushroom';
import { decorativeMushroomModule } from './decorativeMushroom';
import { crumblingFloorModule } from './crumblingFloor';
import { emptyModule } from './empty';

/** The registry's literal key map — the type `TileType` derives from. */
type TileModuleMap = {
  groundGrass: typeof groundGrassModule;
  groundRock: typeof groundRockModule;
  wall: typeof wallModule;
  bridge: typeof bridgeModule;
  ladder: typeof ladderModule;
  chain: typeof chainModule;
  bush: typeof bushModule;
  fence: typeof fenceModule;
  cobweb: typeof cobwebModule;
  crystalCluster: typeof crystalClusterModule;
  stalactite: typeof stalactiteModule;
  stalagmite: typeof stalagmiteModule;
  torch: typeof torchModule;
  ladderBundle: typeof ladderBundleModule;
  ropeLadder: typeof ropeLadderModule;
  bouncyMushroom: typeof bouncyMushroomModule;
  decorativeMushroom: typeof decorativeMushroomModule;
  crumblingFloor: typeof crumblingFloorModule;
  empty: typeof emptyModule;
};

function buildTileModules(): TileModuleMap {
  return {
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
}

/** One proxy handler that forward-field-forwards a lazily-built, memoized plain object. */
function lazyObject<T extends object>(build: () => T): T {
  let cache: T | undefined;
  const value = (): T => (cache ??= build());
  return new Proxy({} as T, {
    ownKeys: () => Reflect.ownKeys(value()),
    getOwnPropertyDescriptor: (_target, prop) => Reflect.getOwnPropertyDescriptor(value(), prop),
    get: (_target, prop) => Reflect.get(value(), prop),
    has: (_target, prop) => prop in value(),
  });
}

/**
 * Every shipped tile kind. The values are module objects, read lazily (see the
 * module doc comment); `TileType` derives from the key set.
 */
export const TILE_MODULES: TileModuleMap = lazyObject(buildTileModules);

// --- Derived membership ---------------------------------------------------

type ModuleChar<T> = T extends { readonly char: infer C extends string } ? C : never;

/** Every author-placeable terrain character, extracted from the modules' `char` literals. */
export type TerrainChar = ModuleChar<(typeof TILE_MODULES)[keyof typeof TILE_MODULES]>;

/**
 * Maps each author-placeable character to its tile kind, derived from every
 * module's declared `char`. Registry-only kinds (`ropeLadder`) declare none and
 * so never appear.
 */
export const TERRAIN_CHARS: Readonly<Record<string, TileType | undefined>> = lazyObject(() =>
  Object.fromEntries(
    (Object.entries(TILE_MODULES) as [TileType, TileModule][])
      .filter(([, module]) => module.char !== undefined)
      .map(([kind, module]) => [module.char as string, kind]),
  ),
);

/** Whether cave fog leaves `tile` visible, derived from each module's `fogExempt`. */
export const TILE_FOG_EXEMPT: Record<TileType, boolean> = lazyObject(() =>
  Object.fromEntries(
    (Object.entries(TILE_MODULES) as [TileType, TileModule][]).map(([kind, module]) => [
      kind,
      module.fogExempt,
    ]),
  ) as Record<TileType, boolean>,
);

/** The module owning `tile`, widened to the contract type so optional fields read cleanly. */
function moduleOf(tile: TileType): TileModule {
  return TILE_MODULES[tile];
}

/** Whether `tile` should be skipped by cave fog — see `TILE_FOG_EXEMPT`. */
export function isFogExempt(tile: TileType): boolean {
  return moduleOf(tile).fogExempt;
}

// --- Rule dispatch --------------------------------------------------------

/** Plain "blocks movement" — relocated `isSolid`, dispatch-only. */
export function isSolidTile(tile: TileType): boolean {
  return moduleOf(tile).solid === true;
}

/**
 * Whether a tile counts as solid for the two "one-way is special" collision
 * cases — relocated `isSolidExcludingBridge`. Identical to `isSolidTile` for
 * every tile except `bridge`.
 */
export function isSolidExcludingOneWay(tile: TileType): boolean {
  const module = moduleOf(tile);
  return module.solid === true && module.oneWay !== true;
}

/** Whether the player can climb `tile` (ladder / chain / ropeLadder). */
export function isClimbableTile(tile: TileType): boolean {
  return moduleOf(tile).climbable === true;
}

/**
 * The cell's solid region, in rendered px relative to its own top edge. A
 * module's `solidRegionAt` owns the phase/inset-aware answer; otherwise a plain
 * `solid` module resolves to the full cell, or to `null` when the query excludes
 * one-way tiles and this kind is one-way.
 */
export function tileSolidRegionAt(
  level: LevelDef,
  col: number,
  row: number,
  ctx: TileRuleContext,
): TileSolidRegion | null {
  const module = moduleOf(tileAt(level, col, row));
  if (module.solidRegionAt) return module.solidRegionAt(level, col, row, ctx);
  if (module.solid !== true) return null;
  if (ctx.excludeOneWay === true && module.oneWay === true) return null;
  return { top: 0, bottom: RENDERED_TILE_SIZE };
}

/** Whether the cell is a one-way ground term (ladder shaft top, bundle top, mushroom cap). */
export function isStandableTileAt(
  level: LevelDef,
  col: number,
  row: number,
  ctx: TileRuleContext,
): boolean {
  return moduleOf(tileAt(level, col, row)).standableAt?.(level, col, row, ctx) ?? false;
}

/** Whether the cell claims a Down press while stood on, to drop through (bridge). */
export function claimsDropThrough(level: LevelDef, col: number, row: number): boolean {
  return moduleOf(tileAt(level, col, row)).dropThrough === true;
}

// --- Appearance dispatch --------------------------------------------------

/**
 * Draws the cell through its module's `draw`, but only when the cell's kind
 * belongs to `band`. Defaults to the terrain band so the common `drawTileAt(rc)`
 * call site needs no band argument.
 */
export function drawTileAt(rc: TileDrawContext, band: TileDrawBand = 'terrain'): void {
  const module = moduleOf(tileAt(rc.level, rc.col, rc.row));
  if (module.drawBand === band) module.draw?.(rc);
}
