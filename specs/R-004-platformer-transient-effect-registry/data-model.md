# Phase 1 Data Model: Platformer Transient Effect Registry (R-004)

**Feature**: `specs/R-004-platformer-transient-effect-registry/` | **Date**: 2026-09-25

R-004 is a refactor: it introduces no persisted data and no new gameplay entities. The "data model" below is the **runtime type model** the feature introduces or reshapes. Field-level interface signatures live in [`contracts/`](./contracts/); this document states the entities, their relationships, and the invariants that must hold.

---

## 1. `TransientEffect<S>`

The one base every registered effect is expressed in.

| Field | Type | Notes |
| --- | --- | --- |
| `kind` | `EffectKind` | The registry kind that drives this effect — grouping for the draw dispatch, `effectCount`, and the keyed-slot lookup in `spawnEffect`. |
| `id` | `string` | Stable identity (per-instance; also used for keyed lookups). |
| `elapsed` | `number` | Seconds since start; advanced by `tick`. |
| `duration` | `number` | Total lifetime in seconds; the default expiry bound. |
| `state` | `S` | Per-family payload (position, text, labelKey, layers, …). Generic so each kind keeps its own shape (FR-016). |
| `tick` | `(effect, dt) => TransientEffect<S> \| null` | Advances/transitions; `null` is the sentinel for "drop now". |
| `draw` | `(effect, rc) => void` | Renders into the shared render context. |
| `expired` | `(effect) => boolean` | The family's exact expiry boundary. |

**Invariants**
- Every registered family produces an object assignable to `TransientEffect<S>`; no family keeps a parallel store (FR-003).
- `id` is required for all kinds (the flat collection may hold several effects).
- `expired` reproduces the family's exact pre-refactor boundary (see §5).

---

## 2. `EffectRegistryEntry<S>`

Maps a kind to its start/tick/draw/expiry and the metadata the collection needs.

| Field | Type | Notes |
| --- | --- | --- |
| `kind` | `EffectKind` | Union of the eight shipped families (FR-019: no new kinds). |
| `create` | `(...args) => TransientEffect<S>` | The family's start/create function. |
| `tick` | optional `(effect, dt) => TransientEffect<S> \| null` | Only `flyingText` + counter popup override the default advance. |
| `draw` | `(effect, rc) => void` | The family's registered draw. |
| `expired` | optional `(effect) => boolean` | Only `flyingText` + counter popup override; default is `elapsed > duration`. |
| `layer` | `EffectLayer` | Pipeline depth for the single dispatch. |
| `resetScope` | `EffectResetScope` | `'death'` (cleared by `resetGame()`) or `'progress'`. |
| `keyOf` | optional `(effect) => string` | Present only for keyed slots (counter popups). |

**`EffectKind`** (fixed set — no additions): `flyingText`, `counterPopup`, `puff`, `healAura`, `hitSplatter`, `fadeOutText`, `explosion`, `debris`.

**`EffectLayer`**: `midWorld`, `worldEffects`, `aboveWorld`, `hudLast`.

**`EffectResetScope`**: `death`, `progress`.

**Registry order** is declaration order and is significant: it fixes the intra-layer draw order (`flyingText` → `puff` → `debris` → `hitSplatter` → `fadeOutText`) that matches today's render loop.

---

## 3. The `activeEffects` collection

| Concern | Rule |
| --- | --- |
| Name | Exactly one collection named `activeEffects` (replacing the eight signals). It lives in `PlatformerState.ts` and is typed against the base. |
| Spawn | A state-owned helper (`spawnEffect` in `PlatformerState.ts`) creates the effect and appends it; for a keyed kind it replaces any existing effect with the same `(kind, key)` (refresh-in-place, FR-016/US5-1). `engine/effects` exports no `spawnEffect` (no `engine/ → state/`). |
| Advance | Exactly one `advanceEffects(effects, dt, options?)` ticks the collection through each effect's registered `tick` and drops `null`/expired results (FR-004). |
| Filtered advance | A `kinds` filter ticks/prunes only the named kinds and leaves the rest frozen (dying lead-in, US5-3). |
| Reset | `clearEffectsByResetScope('death')` removes only `'death'`-scoped kinds; `resetGameProgress()` empties the collection. |
| Counts | `effectCount(activeEffects, 'flyingText')` seeds the slot allocator from live flying-text effects only. |

**Validation rules**
- No parallel per-kind effect store exists (FR-003/FR-018).
- The `dt <= 0` no-rewind rule applies to the **timed-tile core** (§6), not to the effect advance; the effect tick is only invoked from the positive-`dt` `playing` branch.
- Counter popups remain at most one per `labelKey` (US5-1).
- Hit splatters alone advance during `dying`; all other kinds keep their elapsed exactly (US5-3).

---

## 4. `EffectRenderContext`

The render context passed to every registered `draw` (FR-017), so no family loses the information it needs.

| Field | Purpose |
| --- | --- |
| `ctx` | Canvas 2D context (screen-space families). |
| `dc` | `DrawContext` (sprites, origin, world clock) for world-space families. |
| `canvasWidth`, `canvasHeight` | For fixed HUD positions (counter popups). |
| `playerAnchor` | `{ x, y, width }` — the live player anchor for the position-less heal aura. |
| `popupIcons` | `labelKey → { icon, iconFrame, iconYOffset }`, resolved once per frame by the page from its sprite refs; the counter-popup draw assembles its row from these plus the live effects. |
| `effects` | The live unified collection this frame, so a sibling-dependent draw (the counter-popup row) can compute its own slot. |

**Invariants**
- The heal aura stores no position; its anchor is always re-derived from `playerAnchor` each frame (US5-2).
- The counter-popup draw builds its row in the fixed `coins`/`fruits`/`enemies`/`crates` order from `popupIcons` (byte-identical layout).
- The draw dispatch receives the context at the layer's pipeline point, so depth is preserved ([plan.md](./plan.md) Key Design Decisions #3; [research.md](./research.md) D3).

---

## 5. Effect lifecycle & depth table (preservation contract)

| Kind | State payload | Advance | Expiry boundary | Layer | Reset scope | Keyed |
| --- | --- | --- | --- | --- | --- | --- |
| `flyingText` | text/icon/start-mid-target + phase | 4-phase machine | `phase === 'done'` | `worldEffects` | `progress` | no |
| `counterPopup` | labelKey/collected/total | elapsed | `tick → null` at `>= duration` | `hudLast` | `progress` | yes (`labelKey`) |
| `puff` | x/y/scale/pixel | default | `elapsed > duration` | `worldEffects` | `progress` | no |
| `healAura` | id only | default | `elapsed > duration` | `midWorld` | `progress` | no |
| `hitSplatter` | x/y/color/droplet params | default | `elapsed > duration` | `worldEffects` | `progress` | no |
| `fadeOutText` | x/y/text | default | `elapsed > duration` | `worldEffects` | **death** | no |
| `explosion` | x/y | default | `elapsed > duration` | `aboveWorld` | `progress` | no |
| `debris` | x/y/layers | default | `elapsed > duration` | `worldEffects` | `progress` | no |

Every row's counts, positions, opacity curves, and reset behaviour must be identical to the pre-refactor build (FR-014/US5).

---

## 6. Timed-tile core (`shared/timedTile.ts`)

A pure, dependency-free core (imports only `shared/math.ts`) that owns the arm/advance/elapsed/shake scaffolding copied across `MushroomSquash`, `FloorSpike`, `CrumblingFloor`, and `FallingStalactite`.

**Configuration (per caller)**

| Field | Purpose |
| --- | --- |
| `keyOf(state)` / `keyOf(arm input)` | Selects the caller's key shape: `{col,row}` (mushroom/crumbling) or `{id}` (spike/stalactite). Composite keys are compared structurally. |
| `duration` | Cycle length. |
| `prune` | `true` for mushroom/spike/crumbling (drop at/after duration); `false` for stalactite (`gone` persists). |
| `rearm` | `'replace'` (mushroom restarts an in-progress entry) or `'noop'` (spike/crumbling/stalactite leave it running). |

**Provided helpers**: arm, advance, elapsed-lookup, shake, plus the neutral `GridTimerState` shape (`{ col, row, elapsed }`). Only the grid-keyed states (`MushroomSquashState`, `CrumblingFloorTimerState`) satisfy it; the id-keyed spike/stalactite states do not. The stalactite uses `GridTimerState` solely to type its `crumblingFloorStates` parameter (satisfied by `CrumblingFloorTimerState`).

**Invariants (must hold unchanged)**
- `dt <= 0` leaves `elapsed` unchanged but still prunes already-expired entries (mushroom/spike/crumbling).
- Stalactite advance never prunes.
- Mushroom re-arm replaces; spike/crumbling/stalactite re-arm is a no-op.
- The shake helper takes amplitude and window gating; the stalactite returns `0` outside its shake phase, the crumbling floor always shakes (US2-5).
- Amplitudes stay per-family (crumbling: native px 1; stalactite: rendered px 1.5).

---

## 7. Particle-list producer (`engine/effects/particles.ts`)

One producer owns the count/emission loop and the `{dx, dy, opacity}` assembly. Backs `sparkleParticles`, `hitSplatterDroplets`, and `debrisPieces` (FR-010).

**Invariants**
- Each family's count, layout formula, gravity/curve, and fade start stay in the family module (US3-2).
- Every emitted offset and opacity is byte-identical to the pre-refactor output at the same elapsed time (US3-3/SC-005).

---

## 8. Hazard modules (`entities/hazards/`)

A hazard kind is one self-contained module: view + timer state + constants + cycle/phase/offset functions + phase vocabulary.

| Module | Owns |
| --- | --- |
| `entities/hazards/FloorSpike.ts` | view (existing) + `FloorSpikePhase`, `FloorSpikeTimerState`, constants, `armFloorSpike`, `advanceFloorSpikes`, `floorSpikePhaseAt/For`, `isFloorSpikeArmed`, `floorSpikeExtensionAt/For` |
| `entities/hazards/FallingStalactite.ts` | view (existing) + `FallingStalactitePhase`, `FallingStalactiteTimerState`, constants, `armFallingStalactite`, `advanceFallingStalactites`, `isFallingStalactiteArmed`, `fallingStalactiteElapsedFor`, `fallingStalactiteOffsetYAt`, `fallingStalactiteShakeOffsetXAt`, `fallingStalactiteLandingRow`, `fallingStalactiteSpriteHeight`, `fallingStalactiteRestOffsetY`, `fallingStalactitePhaseFor`, `detectionZoneCells`, `fallingStalactiteShatter` |

**Relationships**
- `platformer/hazardPlacementsForTick()` in `PlatformerState.ts` merges live timer state into `HazardPlacement`.
- `engine/Collision.ts` imports the machines from their new home.
- `level/HazardMapper.ts` imports the phase types from the owning modules (allowed `level/ → entities/`).
- `entities/hazards/FallingStalactite.ts` keeps its existing `entities/ → engine/` imports (`findLandingRow`, `StaticObjectsCatalog` geometry, and the `DebrisLayer` type — retargeted from the deleted `engine/CollectionEffects` to `engine/effects/debris`) and gains only type/primitive imports from `shared/` (including `GridTimerState` from `shared/timedTile.ts` for its crumbling-floor parameter); it does not import `engine/CrumblingFloor` and adds no new `entities/ → engine/` edge beyond those preserved imports.

**Deleted**: `entities/hazards/phases.ts`, `engine/FloorSpike.ts`, `engine/FallingStalactite.ts`.

---

## 9. Non-goals (explicitly not modelled)

- No new effect kind, emitter, hazard, tile, or gameplay state (FR-019).
- No change to `PlacedBomb`/`DeployableLadder` timers (R-008) or the mushroom's effect re-homing (R-005).
- No `SpeechBubble` generalisation (R-005) — the registry is merely shaped to admit it as one module plus one line.
- No authored level, marker, tuning, or constant change (FR-015).
