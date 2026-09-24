# Data Model — Platformer Shared Primitives & Dedup (R-002)

Phase 1 output. This feature adds **no runtime data** — no JSON, level, marker, or localStorage
shape changes (spec Assumptions: "No data migration"). The "data model" here is the **module and type
structure** the refactor introduces or changes. It is organized by the six user stories.

Conventions (from [docs/Architecture.md](../../docs/Architecture.md) and the platformer's own docs):
named exports, `PascalCase` for type/class-like modules, `camelCase` for function/registry modules,
`contracts/` is a strict leaf, and `shared/` is a pure leaf (imports nothing).

---

## Story 1 — `shared/math.ts` (new, pure leaf)

| Export | Signature | Notes |
| --- | --- | --- |
| `clamp01` | `(x: number) => number` | clamp to [0,1] |
| `smoothstep` | `(t: number) => number` | `t*t*(3-2*t)` |
| `lerp` | `(a: number, b: number, t: number) => number` | `a + (b-a)*clamp01(t)` |
| `hash2D` | `(col: number, row: number, salt?: number) => number` | raw uint32, salted formula (salt=0 ⇒ unsalted) |
| `pulse` | `(phase: number) => number` | `sin(phase * 2π)`, range [-1,1] |
| `shakeOffsetX` | `(elapsed: number, amplitude: number) => number` | `sin(elapsed*40)*amplitude` |

**Dependencies**: none (imports nothing). **Consumers**: `engine/Lighting.ts`, `engine/CrumblingFloor.ts`,
`engine/FallingStalactite.ts`, `engine/DeployableLadder.ts`, `engine/PlacedBomb.ts`, `engine/BlockAI.ts`,
`engine/MushroomSquash.ts`, `engine/CollectionEffects.ts`, `engine/GameLifecycle.ts`,
`engine/StaticObjectsCatalog.ts` (via `pickVariant` → `hash2D`), `entities/Torch.ts`,
`entities/hazards/FloorSpike.ts`, `entities/Fruit.ts`, `engine/Renderer.ts` (`pulse`).

## Story 2 — `findLandingRow` (extended in `engine/Standable.ts`)

```ts
export type LandingSolidPredicate = (level: LevelDef, col: number, row: number) => boolean;
export function findLandingRow(
  level: LevelDef,
  col: number,
  fromRow: number,
  isSolidForKind: LandingSolidPredicate,
): number | null;
```

**Semantics**: first row `> fromRow` (and `< level.height`) where the predicate is true; `null` if none.
The predicate captures the caller's blocks/crumbling-floor state via closure.

**Callers and their predicate + adjustment**:

| Caller | Predicate | Adjustment |
| --- | --- | --- |
| `FallingStalactite.fallingStalactiteLandingRow` | `isStandableCell(level, blocks, crumblingFloorStates, c, r)` | none (returns the row) |
| `PlacedBomb.bombLandingRow` | `tileGround(level, c, r) \|\| isBlockOccupied(blocks, c, r)` (with crumbling special case) | `landing - 1`, `null` preserved |
| `DeployableLadder.ladderLandingRow` | `isSolid(tileAt(level, c, r))` | `landing === null ? level.height - 1 : landing - 1` |

## Story 3 — `engine/TileAtlas.ts` (new) + shared `pickVariant`

```ts
// engine/TileAtlas.ts
export type QuarterTurns = 0 | 1 | 2 | 3;
export interface TileAtlasEntry { sx: number; sy: number; rotation: QuarterTurns; }
export const ATLAS_STRIDE = 19;
export function atlasCell(col: number, row: number): { sx: number; sy: number };
```

- `GroundAtlasEntry extends TileAtlasEntry { kind: GroundTileKind }` (GroundAtlas.ts).
- `BackgroundAtlasEntry extends TileAtlasEntry` (BackgroundAtlas.ts); `BACKGROUND_ATLAS_ROW_PITCH = 60`
  and its material-pitched `cell` stay in BackgroundAtlas.ts.
- `pickVariant<T>(variants: readonly T[], col: number, row: number): T` — exported from
  `StaticObjectsCatalog.ts`, body over `hash2D`, imported by `BackgroundDecorCatalog.ts`.

## Story 4 — `level/layoutFile.ts` (new)

```ts
export function idFromPath(path: string): string;
export function isLayout(value: unknown): value is string[];       // non-empty array of strings
export function isBackground(value: unknown): value is string[];   // array of strings (may be empty)
export function isMarkers(value: unknown): value is MarkerPlacement[];
export function parseLevelModules(modules: Record<string, unknown>): LevelEntry[];
export function parseBlueprintModules(modules: Record<string, unknown>): Blueprint[];
```

Plus the exported `normalizeMarkerEntry` (see Story 4 below): the editor imports it from
`level/LevelParser.ts` (made public), satisfying FR-014.

**Marker vocabulary** (unchanged, for reference — from `level/LevelData.ts`):

```ts
export type MarkerEntry =
  | { kind: 'patrolBoundary' }
  | { kind: 'connectionPoint' }
  | { kind: 'fallingStalactite' }
  | { kind: 'sign'; hintId: HintId }
  | { kind: 'torch'; strength: TorchStrength };
export type MarkerGrid = (MarkerEntry | null)[][];
export interface MarkerPlacement { col: number; row: number; marker: MarkerEntry; }
```

## Story 5 — Kind-union derivation

| Module | Before | After |
| --- | --- | --- |
| `entities/hazards/index.ts` | `HAZARD_TYPES` + `HazardTypeKey = keyof typeof HAZARD_TYPES` | also exports `HazardKind = keyof typeof HAZARD_TYPES` (single canonical name) |
| `level/LevelParser.ts` | hand-written `HazardKind` + `HAZARD_CHARS` | imports `HazardKind`; `HAZARD_CHARS: Record<string, { hazardType: HazardKind; facing: HazardFacing } \| undefined>` |
| `entities/blocks/index.ts` | `BLOCK_TYPES` | also exports `BlockKind = keyof typeof BLOCK_TYPES` |
| `entities/Block.ts` | hand-written `BlockKind` | imports `BlockKind` from `./blocks` |
| `types.ts` | `BlockDef.blockKind: 'crate' \| … \| 'bombPot'` | `BlockDef.blockKind: BlockKind` (imported) |

## Story 6 — Merges / removals

| Module | Disposition |
| --- | --- |
| `engine/EnemyAI.ts` | **deleted**. `stepEnemyHitReaction` → `entities/enemies/` (e.g. `hitReaction.ts` or `shared.ts`); `stepEnemyPatrol` removed. |
| `engine/IrisTransition.ts` | **deleted**. Constants + `maxIrisRadius` → `GameLifecycle.ts`; `lerpRadius` → shared `lerp`. |
| `contracts/Contact.ts` | **deleted**. `ContactSide`/`Contact`/`CollisionOutcome` folded into `contracts/Outcome.ts`. |
| `entities/Coin.ts` | `coinFrameSource` removed; the HUD coin-counter icon in `PlatformerPage.tsx` retargets to `frameSource(COIN_SHEET, 0)`. |
| `entities/pickups/Fruit.ts` | **replaced** — the dormant placed-fruit `PickupType` is deleted; the renamed `bonusFruit` pickup (`pickups/BonusFruit.ts`) takes its place with key `'fruit'`. |
| `entities/BonusFruit.ts` | **merged** into `entities/Fruit.ts` (constants + `FruitState`/`spawnFruit`/`tickFruit`/`fruitY`/`FRUIT_RISE_DURATION_SECONDS`). |
| `entities/pickups/BonusFruit.ts` | **renamed** to `entities/pickups/Fruit.ts`. |
| `entities/Fruit.ts` | **gains** the fruit entity (merged from `BonusFruit.ts`); `FRUIT_FRAME_SIZE`, `FRUIT_RENDERED_SIZE`, `FRUIT_ICON_COLUMNS`, `FRUIT_ICON_COUNT`, `FRUIT_ICON_ORDER`, `fruitFrameSource` stay. |

### Kind-union / contract edits tied to Story 6

- `contracts/PickupKind.ts`: `'coin' | 'fruit' | 'key' | 'heart' | 'bomb'` — `fruit` names the renamed
  question-mark reward; the dead placed `'fruit'` and the `'bonusFruit'` member are both dropped.
- `entities/pickups/index.ts`: `PICKUP_TYPES = { coin, fruit, key, heart, bomb }` — `fruit` is the renamed
  `bonusFruit` pickup.
- `level/CollectibleMapper.ts`: `CollectiblePlacement.spriteType: 'coin'`; `placeCollectibles` takes coin
  markers only.

## Relationship summary

```
shared/math.ts  ◄── (pure leaf, no deps) ── imported by engine/, entities/
contracts/Outcome.ts (merged) ◄── imports geometry, PickupKind, counters, types
engine/TileAtlas.ts ◄── level/Terrain
engine/Standable.findLandingRow ◄── level/Terrain, level/BlockMapper, engine/CrumblingFloor (existing)
level/layoutFile.ts ◄── level/LevelData, level/level, level/BlueprintData (same layer)
```

No edge crosses a layer boundary: `contracts/` stays a leaf, `shared/` is a pure leaf, `level/` never imports `engine/`,
`engine/` never imports state.
