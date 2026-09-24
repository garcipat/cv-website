# Research — Platformer Shared Primitives & Dedup (R-002)

Phase 0 output. Every "NEEDS CLARIFICATION" in the Technical Context is resolved here, and every
spec assumption that touches a concrete code shape is validated against the current source.

> Method note: findings below were produced by reading the actual `src/themes/platformer/`
> modules (not the analysis doc's line numbers, which drift). Where the spec and the current
> code disagree, the discrepancy is called out explicitly and a resolution is recorded.

---

## R1 — Shared math primitives (`shared/math.ts`)

### R1.1 Exact primitive signatures

The spec (FR-001) names six primitives but not their signatures. The following signatures are
chosen so that **every existing call site maps byte-for-byte** (spec FR-003/FR-004/FR-006 and
the "byte-equivalent" edge case):

```ts
// shared/math.ts — pure leaf (imports nothing from engine/entities/level/state)

/** Clamp `x` to [0, 1]. */
export function clamp01(x: number): number;

/** Smoothstep (Hermite) on [0,1]: `t*t*(3-2*t)`. */
export function smoothstep(t: number): number;

/** Linear interpolation `a → b` at `t`, clamped to [0,1]: `a + (b-a)*clamp01(t)`. */
export function lerp(a: number, b: number, t: number): number;

/** Deterministic 32-bit position hash in [0, 2^32). `salt` defaults to 0. */
export function hash2D(col: number, row: number, salt?: number): number;

/** Sine pulse for a normalized phase in [0,1]: `sin(phase * 2π)`, range [-1, 1]. */
export function pulse(phase: number): number;

/** Deterministic horizontal shake jitter: `sin(elapsed * 40) * amplitude`. */
export function shakeOffsetX(elapsed: number, amplitude: number): number;
```

Decisions and rationale:

- **`hash2D` returns the raw `>>> 0` uint32, not a normalized [0,1) value.** Rationale: the three
  callers normalize differently — `Lighting.cellHash01` divides by `0xffffffff`, `Torch.torchPhase`
  takes `% TORCH_FRAME_COUNT`, and `pickVariant` takes `% variants.length`. Returning the raw hash
  lets each caller keep its own normalization. (FR-004: the salted variant must collapse into the
  same function.)
- **`hash2D(col, row, salt = 0)` uses the salted formula unconditionally** —
  `(Math.imul(col + salt*92821, 374761393) ^ Math.imul(row + salt*68917, 668265263)) >>> 0`. With
  `salt = 0` this is exactly the unsalted `(imul(col,374761393) ^ imul(row,668265263)) >>> 0` used by
  `Torch`/`StaticObjectsCatalog`/`BackgroundDecorCatalog`, and with `salt = 1|2|3` it reproduces
  `Lighting.cellHash01`. Byte-equivalent at every site.
- **`lerp(a, b, t) = a + (b-a)*clamp01(t)`.** The `CollectionEffects` inline lerps clamp only the
  upper bound (`Math.min(1, …)`) but are never fed a negative `t` (their inputs are `elapsed/DURATION`
  with `elapsed ≥ 0`), so full `clamp01` is byte-equivalent there. `IrisTransition.lerpRadius` already
  uses full `clamp01`; after Story 6 merges it into `GameLifecycle`, it is subsumed by `lerp`.
- **`pulse(phase) = Math.sin(phase * 2π)`** covers four shapes: the `1 ± AMPLITUDE * sin(…)` pulses
  (`Lighting.torchPulseScale`, `Lighting.fogPuffAt`), the `AMPLITUDE * sin(…)` bob
  (`Lighting.enemyEyeBobOffset`), and the two `(sin(…) + 1) / 2` [0,1] waves (`Renderer.ts:2009`,
  `Renderer.ts:2303`). Each site maps to `pulse(phase)` with its own offset/amplitude applied
  afterward. *(Note: `fogPuffAt`'s `Math.sin(jitterAngle)` and `CollectionEffects`'s
  `Math.cos(angle)*radius` are geometric, not the repeating pulse — those stay as-is.)*
- **`shakeOffsetX(elapsed, amplitude)`** collapses the two byte-identical shakes
  (`CrumblingFloor.ts:172` with amplitude `1`, `FallingStalactite.ts:74` with amplitude `1.5`).

### R1.2 Call-site inventory

| Primitive | Call sites (current) | Count |
| --- | --- | --- |
| `smoothstep` | `Lighting.ts:185` (fogPeekStrengthAt), `:337` (torchGlowStrengthAt), `:376` (playerGlowStrengthAt), `:389` (enemyEyeOpacity, wraps the `clamp01` + `t*t*(3-2*t)`) | 4 |
| `hash2D` (unsalted) | `entities/Torch.ts:57`, `engine/StaticObjectsCatalog.ts:197`, `engine/BackgroundDecorCatalog.ts:35` | 3 |
| `hash2D` (salted) | `engine/Lighting.ts:124-128` (`cellHash01`) | 1 |
| `clamp01` | `Lighting.ts:388`, `CrumblingFloor.ts:131`, `CrumblingFloor.ts:152`, `BlockAI.ts:64`, `DeployableLadder.ts:117`, `MushroomSquash.ts:55`, `IrisTransition.ts:55` (becomes `lerp`), `CollectionEffects.ts:653`, `entities/hazards/FloorSpike.ts:115`, `entities/BonusFruit.ts:81` | 10 |
| `lerp` | `IrisTransition.ts:54` (`lerpRadius`), `CollectionEffects.ts:134/143` (inline, two sites) | 3 |
| `pulse` | `Lighting.ts:153` (fog pulse), `Lighting.ts:306` (torchPulseScale), `Lighting.ts:407` (enemyEyeBobOffset), `Renderer.ts:2009`, `Renderer.ts:2303` | 5 |
| `shakeOffsetX` | `CrumblingFloor.ts:172`, `FallingStalactite.ts:74` | 2 |

### R1.3 Discrepancies resolved

- **`Renderer.ts` is NOT a `clamp01` site in the current code.** The analysis (`L5`) cited
  `Renderer.ts:1650`; that line is now `clampedCornerRadius` — `Math.max(0, Math.min(radius, width/2,
  height/2))`, a clamp to a *dynamic* upper bound, not to 1. **Resolution:** no `Renderer` `clamp01`
  migration is needed; spec US1 scenario 3's "Renderer" item is a no-op (nothing to retarget). The
  spec's SC-001 ("zero duplicated re-implementations") is unaffected.
- **Two extra `clamp01` sites not in the spec's list** were found: `entities/hazards/FloorSpike.ts:115`
  and `entities/BonusFruit.ts:81`. Both are inside `entities/`, so FR-003 ("no inline re-implementation
  may remain in `engine/`, `entities/`, or `level/`") requires them to migrate too. **Resolution:**
  include both in the retarget list. SC-001 still holds (they become imports, not duplicates).
- **`hash2D` salt formula.** `Lighting.cellHash01` salts both axes with different multipliers
  (`salt*92821` on `col`, `salt*68917` on `row`). This is captured exactly by `hash2D`; no normalization
  drift.

---

## R2 — One `findLandingRow` downward scan

### R2.1 The three scans and their off-by-one semantics

| Caller | Current function | Predicate | Returns | On no floor |
| --- | --- | --- | --- | --- |
| `FallingStalactite` | `fallingStalactiteLandingRow` | `isStandableCell` (blocks + crumblingFloorStates + ladder/mushroom) | first **standable** row | `null` → `gone` |
| `PlacedBomb` | `bombLandingRow` | `isSolid(tile) \|\| isBlockOccupied`, crumbling-solid | **resting** row (`firstSolid - 1`) | `null` → falls out |
| `DeployableLadder` | `ladderLandingRow` | `isSolid(tile)` only | **resting** row (`firstSolid - 1`), `row` if cell below is solid or on bottom | never null (clamps to `row` / last row) |

The spec Assumptions already record that the bomb/ladder return the *resting* row (one above the first
solid) while the stalactite returns the *standable* row (the solid itself). **Resolution:** the shared
helper returns the first solid/standable row, and each caller keeps its own one-row adjustment:

```ts
// engine/Standable.ts
export type LandingSolidPredicate = (level: LevelDef, col: number, row: number) => boolean;

/** First row strictly below `fromRow` where `isSolidForKind` is true, or null. */
export function findLandingRow(
  level: LevelDef,
  col: number,
  fromRow: number,
  isSolidForKind: LandingSolidPredicate,
): number | null {
  for (let row = fromRow + 1; row < level.height; row++) {
    if (isSolidForKind(level, col, row)) return row;
  }
  return null;
}
```

Callers:

- **Stalactite** — `findLandingRow(level, col, hazard.row, (l,c,r) => isStandableCell(l, blocks, crumblingFloorStates, c, r))`, returns the row directly (byte-identical to the current loop).
- **Bomb** — `const landing = findLandingRow(level, col, row, (l,c,r) => tileGround(l,c,r) || isBlockOccupied(blocks,c,r)); return landing === null ? null : landing - 1;` where `tileGround` keeps the crumbling-floor special case. Byte-identical.
- **Ladder** — `const landing = findLandingRow(level, col, row, (l,c,r) => isSolid(tileAt(l,c,r))); return landing === null ? level.height - 1 : landing - 1;`. Byte-identical: when the first cell below is solid, `landing = row + 1` → returns `row`; when no floor, returns `level.height - 1` (the old loop's final `land` value).

### R2.2 Contract nuance vs spec wording

Spec FR-007 says "first row **at or below** `fromRow`". The existing three scans all start at
`fromRow + 1` (strictly below). Since behavior must be byte-preserved, the helper scans from
`fromRow + 1`. **Resolution:** document the contract as "first row strictly below `fromRow`" and note
the spec's "at or below" as a loose wording; the byte-preservation assumption governs.

---

## R3 — Shared `TileAtlas`

### R3.1 What is genuinely shared

Reading both atlas modules:

- `QuarterTurns = 0 | 1 | 2 | 3` — **identical** in both (GroundAtlas.ts:25, BackgroundAtlas.ts:16).
- The 19px stride — identical value, but named `ATLAS_STRIDE` (Ground) vs `BACKGROUND_ATLAS_STRIDE` (Background).
- The `{ sx, sy, rotation }` entry shape — GroundAtlas's `GroundAtlasEntry` *adds* `kind`; BackgroundAtlas's `BackgroundAtlasEntry` is exactly the base shape.
- **The `cell()` helpers differ.** GroundAtlas `cell(col, row) => { sx: col*19, sy: row*19 }` (uniform stride). BackgroundAtlas `cell(materialIndex, gx, gy) => { sx: gx*19, sy: materialIndex*60 + gy*19 }` (uses the extra 60px row pitch between materials). The analysis (`L6`) called these "duplicate"; they share the stride but not the pitch.

**Resolution:** the shared module exports the truly-shared pieces, and BackgroundAtlas keeps its
material-pitched `cell`:

```ts
// engine/TileAtlas.ts
export type QuarterTurns = 0 | 1 | 2 | 3;
export interface TileAtlasEntry { sx: number; sy: number; rotation: QuarterTurns; }
export const ATLAS_STRIDE = 19;
export function atlasCell(col: number, row: number): { sx: number; sy: number } {
  return { sx: col * ATLAS_STRIDE, sy: row * ATLAS_STRIDE };
}
```

- `GroundAtlas` uses `atlasCell` (replaces its private `cell`), imports `QuarterTurns`/`ATLAS_STRIDE`, and defines `GroundAtlasEntry extends TileAtlasEntry { kind: GroundTileKind }`.
- `BackgroundAtlas` imports `QuarterTurns`/`ATLAS_STRIDE`/`TileAtlasEntry`, defines `BackgroundAtlasEntry extends TileAtlasEntry`, and keeps its own material-pitched `cell` (renamed or documented as background-specific). `BACKGROUND_ATLAS_ROW_PITCH = 60` stays in BackgroundAtlas.

**Alternatives considered:** a fully generic `cell(stride, …)` shared by both — rejected because the
background's row-pitch cell is materially different and forcing it through a shared helper would
obscure rather than dedupe. The dedup win that matters (one `QuarterTurns`, one `ATLAS_STRIDE`, one
entry shape) is achieved without it.

### R3.2 Shared `pickVariant` (FR-011 / L4 / X3)

`pickVariant` is duplicated verbatim in `StaticObjectsCatalog.ts:181-200` and
`BackgroundDecorCatalog.ts:31-38`. Per spec Assumptions, `pickVariant` is colocated with the
static-object/decor catalog, **not** inside `shared/math.ts`.

**Resolution:** export `pickVariant` from `StaticObjectsCatalog.ts` (its current, primary home),
reimplement its body over `hash2D` (`const hash = hash2D(col, row); const index = hash % variants.length`),
and have `BackgroundDecorCatalog.ts` import it. `StaticObjectsCatalog`'s own `pickVariant` body keeps its
empty-array guard (throws on `variants.length === 0`).

**Alternatives considered:** a new `engine/variantCatalog.ts` module — rejected as unnecessary churn;
`StaticObjectsCatalog.ts` already is "the variant catalog" for static objects, and the spec says
"colocated with the static-object/background-decor catalog".

---

## R4 — One `layoutFile.ts` + the torch-marker bug (M4)

### R4.1 What moves

Four consumers duplicate raw-file validation:

- `level/levelRegistry.ts` — `idFromPath` (45-46), `isLayout`/`isBackground`/`isMarkers` (48-84), `parseLevelModules` (98-125).
- `level/BlueprintData.ts` — `isLayout`/`isBackground`/`isMarkers` (30-54), used by `isBlueprint`.
- `level/blueprintRegistry.ts` — `idFromPath` (4-5), `parseBlueprintModules` (24-61).
- `editor/editorState.ts` — `isMarkerEntry`/`isMarkerGrid` (31-48), the weaker marker validator.

**Resolution:** `level/layoutFile.ts` exports:

```ts
export function idFromPath(path: string): string;
export function isLayout(value: unknown): value is string[];        // non-empty array of strings
export function isBackground(value: unknown): value is string[];    // array of strings (may be empty)
export function isMarkers(value: unknown): value is MarkerPlacement[];
export function parseLevelModules(modules: Record<string, unknown>): LevelEntry[];
export function parseBlueprintModules(modules: Record<string, unknown>): Blueprint[];
```

`parseLevelModules` and `parseBlueprintModules` are *not* textually identical (the blueprint parser
routes through `isBlueprint` and attaches `background`/`markers` independently), so they remain two
small functions — but they share `idFromPath` and the three validators, which is the actual duplication
the finding names. The spec's "the level/blueprint module parser" (singular) is read as "the module
parsing concern", not "one generic function".

### R4.2 The torch-marker bug fix (FR-014/FR-015)

The editor's `isMarkerEntry` (`editorState.ts:31-40`) omits the `torch` kind, so a persisted torch
marker is dropped on reload. `LevelParser.normalizeMarkerEntry` (private, `LevelParser.ts:323-338`) is
the complete validator (handles `torch` with strength fallback to `DEFAULT_TORCH_STRENGTH`).

**Resolution:** export `normalizeMarkerEntry` from `LevelParser.ts` (currently private) and have
`editorState.ts` delegate to it:

```ts
import { normalizeMarkerEntry } from '../level/LevelParser';
const isMarkerEntry = (value: unknown): value is MarkerEntry => normalizeMarkerEntry(value) !== null;
```

**Nuance for the implementer:** `normalizeMarkerEntry` *normalizes* (falls back to `DEFAULT_HINT_ID` /
`DEFAULT_TORCH_STRENGTH`), it does not merely validate. The editor's localStorage guard currently only
tests shape. Using it as a guard makes the editor accept `torch` (fixing the bug) and accept a `sign`
with any string `hintId` (previously accepted) — but a `torch` with an out-of-range `strength` would
pass the guard while the raw (un-normalized) value is stored. The implementer must confirm the editor
persists the *normalized* entry (or validates `strength` explicitly) so an out-of-range stored strength
cannot leak; behavior for valid authored data is unchanged. This is the one place the merge needs care
beyond a mechanical retarget.

### R4.3 `isLayout` non-empty-array requirement

`isLayout` requires `length > 0` while `isBackground` does not. This asymmetry is intentional (a level
must have at least one layout row; a background may be empty) and is preserved exactly in `layoutFile.ts`.

---

## R5 — Kind-union derivation (M5)

### R5.1 Hazards

`HazardKind` (`LevelParser.ts:142`) is hand-written: `'spike' | 'spear' | 'floorSpike' | 'fallingStalactite'`.
`HAZARD_TYPES` (`entities/hazards/index.ts:10`) has exactly those four keys. Enemies already do it right
(`EnemyTypeKey = keyof typeof ENEMY_TYPES`).

**Resolution (FR-016):** `entities/hazards/index.ts` exports `export type HazardKind = keyof typeof HAZARD_TYPES;`. `LevelParser.ts` imports `HazardKind` (and `HAZARD_CHARS`'s `hazardType` field is typed against it) instead of re-declaring the union. `HazardTypeKey` (the existing `keyof` alias) becomes the single source; `HazardKind` is either an alias of it or the canonical name (choose one name to avoid two aliases — FR-023 "exactly one home").

### R5.2 Blocks

`BlockKind` (`entities/Block.ts:13`) is hand-written: `'crate' | 'questionMark' | 'fragileRock' | 'coinPot' | 'potionPot' | 'bombPot'`. `BLOCK_TYPES` (`entities/blocks/index.ts:11`) has those six keys.

**Resolution (FR-017):** `entities/blocks/index.ts` exports `export type BlockKind = keyof typeof BLOCK_TYPES;`. `entities/Block.ts` and `types.ts`'s `BlockDef.blockKind` import `BlockKind` instead of re-declaring it. This also satisfies US5's "BlockDef.blockKind conforms to it".

**Note:** `PickupKind` (in `contracts/PickupKind.ts`) stays spelled out explicitly — R-001's SC-004 already
fixed it this way (the registry conforms via `satisfies`), and it must remain a strict `contracts/` leaf
that cannot import the `entities/pickups` registry. Story 6 removes `'fruit'` from it.

---

## R6 — Dead-code merges and removals (Group X)

### R6.1 `EnemyAI` shim (FR-018, X1)

`engine/EnemyAI.ts` has two exports:
- `stepEnemyPatrol` — **dead** wrapper over `typeOf(enemy).movement.step`; the game loop already calls the strategy directly. Only `EnemyAI.test.ts`'s `stepEnemyPatrol` describe block exercises it.
- `stepEnemyHitReaction` — **live**; imported by `PlatformerPage.tsx:64` (used at `:1261`) and `entities/enemies/Bee.test.ts:159`.

**Resolution:** migrate `stepEnemyHitReaction` into `entities/enemies/` (the enemy family owns its hit
reaction; a small `entities/enemies/hitReaction.ts` module, or fold into `entities/enemies/shared.ts`
which already documents it). Its tests relocate with it. Delete `stepEnemyPatrol`; its characterization
tests are *migrated* to call `typeOf(enemy).movement.step(...)` directly (preserving coverage) rather
than deleted. `EnemyAI.ts` + `EnemyAI.test.ts` are removed.

### R6.2 `IrisTransition` merge (FR-019, X2)

`engine/IrisTransition.ts` exports `maxIrisRadius` and `lerpRadius` (+ the four iris constants).
Consumers: `GameLifecycle.ts` (all constants + `lerpRadius`) **and** `PlatformerPage.tsx:79`
(`maxIrisRadius` at `:1046`). The analysis ("used only by GameLifecycle (+ one page import)") already
knew about the page import.

**Resolution:** move the iris constants + `maxIrisRadius` into `GameLifecycle.ts`; `lerpRadius` is
subsumed by the shared `lerp` from `shared/math.ts` (R1.1). `PlatformerPage.tsx` imports
`maxIrisRadius` from `GameLifecycle`. Delete `IrisTransition.ts` + `IrisTransition.test.ts` (tests
merge into `GameLifecycle.test.ts`). No `GameLifecycle` consumer changes behavior.

### R6.3 `Contact` + `Outcome` merge (FR-020, X4)

`contracts/Contact.ts` imports `PlayerEffects` from `contracts/Outcome.ts` (a one-way dependency in the
current post-R-001 code; the analysis's "mutual" describes the pre-R-001 `engine/` pair). The merged
module must stay a `contracts/` leaf.

**Resolution:** fold the contact vocabulary (`ContactSide`, `Contact`, `CollisionOutcome`) into
`contracts/Outcome.ts` and delete `contracts/Contact.ts`. Importers retarget: `engine/Collision.ts`
imports `ContactSide` + `strongerBounce` from the one module. `CollisionOutcome<S> extends PlayerEffects`
remains self-consistent inside the single file. *(Concrete filename `Outcome.ts` vs a renamed
`outcomeVocabulary.ts` is a naming detail settled during implementation; both satisfy FR-020's "one
outcome-vocabulary module" and the leaf constraint.)*

### R6.4 `coinFrameSource` — NOT literally dead (FR-021, X6)

**Discrepancy.** The spec/analysis call `Coin.ts`'s `coinFrameSource` "proven-dead" (byte-equal to
`frameSource(COIN_SHEET, i)` per `PickupType.test.ts:9`). It is **redundant**, but it is **live**:
`PlatformerPage.tsx:160` imports it and `:939` uses `coinFrameSource(0)` for the HUD coin-counter icon
(`{ ...coinFrameSource(0), size: COIN_FRAME_SIZE }`), and `Coin.test.ts` (34-44) + `PickupType.test.ts:9`
reference it.

**Resolution:** remove the redundant wrapper **and retarget its live consumers**:
- `PlatformerPage.tsx:939` → `iconFrame: { ...frameSource(COIN_SHEET, 0), size: COIN_FRAME_SIZE }`.
- `Coin.test.ts` → delete the `coinFrameSource` describe block (its behavior is covered by the generic
  `frameSource` tests).
- `PickupType.test.ts:9` → drop the `coinFrameSource` import and the equivalence assertion (or point it
  at `frameSource` directly, which is now trivially self-referential).

This keeps FR-021's intent ("no remaining references") while acknowledging the current references that
must be retargeted. The plan's FR-021 acceptance ("no code references it and all tests pass") is
achieved *after* the retarget.

### R6.5 Fruit-pickup consolidation — remove placed fruit + rename `bonusFruit` → `fruit` (FR-022, X6)

The theme has two fruit pickups that should be one:

- **Placed fruit (dead):** `entities/pickups/Fruit.ts` is dormant scaffolding — `placeCollectibles` is
  always called with `fruit: []` (`PlatformerState.ts:280`) and no fruit marker character exists, so its
  `PickupKind`/`CollectibleMapper` plumbing is never exercised.
- **`bonusFruit` (live):** `entities/BonusFruit.ts` + `entities/pickups/BonusFruit.ts` are the
  question-mark block's reward (F-018) — spawned on a hit, rises into the tile above, carries a
  Certificate/Project fact, and counts in `levelTotals.fruits`.

**Resolution — delete the dead placed fruit, then rename the live one to `fruit`:**

1. Delete `entities/pickups/Fruit.ts` (the dormant placed-fruit `PickupType`).
2. Rename the live `bonusFruit` pickup into its place:
   - `entities/pickups/BonusFruit.ts` → `entities/pickups/Fruit.ts` (key `'fruit'`, `PickupType<FruitState>`).
   - `entities/BonusFruit.ts` merges into `entities/Fruit.ts` (the `FRUIT_*` constants module) — one
     `Fruit.ts` owning constants + `FruitState`/`spawnFruit`/`tickFruit`/`fruitY`/`FRUIT_RISE_DURATION_SECONDS`.
   - Rename identifiers: `bonusFruitStates` → `fruitStates`, `spawnBonusFruit` → `spawnFruit`,
     `tickBonusFruit` → `tickFruit`, `bonusFruitY` → `fruitY`, `checkBonusFruitCollisions` →
     `checkFruitCollisions`, `drawBonusFruits` → `drawFruits`, `BonusFruitState` → `FruitState`,
     `BONUS_FRUIT_RISE_DURATION_SECONDS` → `FRUIT_RISE_DURATION_SECONDS`.
3. `contracts/PickupKind.ts`: `'coin' | 'fruit' | 'key' | 'heart' | 'bomb'` — `fruit` now names the
   question-mark reward (was `bonusFruit`); the dead placed `'fruit'` is dropped.
4. `entities/pickups/index.ts`: `PICKUP_TYPES = { coin, fruit, key, heart, bomb }` where `fruit` is the
   renamed `bonusFruit` pickup.
5. `level/CollectibleMapper.ts`: narrow `CollectiblePlacement.spriteType` to `'coin'`; drop
   `CollectibleMarkerPositions.fruit`; `placeCollectibles` accepts coin markers only.
6. `PlatformerState.ts:280`: `placeCollectibles(COIN_TILES.value)` (drop the `{ fruit: [] }` wrapper).
7. Tests: `CollectibleMapper.test.ts` (drop fruit fixtures), `Renderer.test.ts` (`makeFruitPlacement`),
   `pickups/index.test.ts` (the `fruit` assertion now targets the renamed bonus-fruit pickup),
   `BonusFruit.test.ts` → `Fruit.test.ts` (or folded into it), and all `bonusFruit`-named test references
   renamed.

**Confirmed live (unchanged behavior):** the question-mark reward still rises, carries its fact, has no
bob, and counts in `fruits`; `entities/Fruit.ts` constants, `FRUIT_SHEET`, `fruitFrameSource`, and the
HUD fruit icon all stay — only the name of the entity/pickup moves from `bonusFruit` to `fruit`.

---

## R7 — Layer-invariant re-check (FR-025)

After all moves, the dependency invariants R-001 established still hold:

- `shared/math.ts` imports nothing (pure) — the new `shared/` folder is a pure leaf alongside `contracts/`. `contracts/Outcome.ts` (merged) imports only `../types`,
  `./PickupKind`, `./counters`, `./geometry` — still a leaf. ✅
- `level/layoutFile.ts` lives in `level/`; it imports `MarkerPlacement`/`LevelEntry`/`Blueprint`
  (same layer) and (for `parseLevelModules`) the `level` built-ins — no `engine/` import. ✅
- `engine/` gains `TileAtlas.ts` (imports only `level/Terrain`) and `findLandingRow` (in `Standable.ts`,
  already imports `level/` + `entities/` contracts only). No `engine/ → state` edge is introduced. ✅
- `editor/editorState.ts` imports `normalizeMarkerEntry` from `level/LevelParser.ts` — the already-accepted
  `editor/ → level/` direction. ✅

No `level/ → engine/` edge is created or restored.
