# Phase 0 Research: Platformer Transient Effect Registry (R-004)

**Feature**: `specs/R-004-platformer-transient-effect-registry/` | **Date**: 2026-09-25

This document resolves the open technical decisions for R-004. The spec intentionally deferred the module home of `TransientEffect<S>` and its registry to planning; that decision is recorded first, together with the other choices the design depends on.

---

## D1 — Module home of `TransientEffect<S>` and its registry

**Decision**: A new **`engine/effects/` directory** replacing `engine/CollectionEffects.ts`. It contains the base, the registry, one module per effect kind (each owning its start/tick/derive/**draw**), the shared particle producer, the single layer-filtered draw pass, and an `index.ts` barrel. The old file is deleted; no compatibility re-export survives (FR-018).

**Rationale**:
- `contracts/` is a strict leaf (R-001) and cannot hold `draw`/`tick` behaviour, so the subsystem must live in `engine/` or higher.
- The registry must make "a new effect = one module plus one registry line" true (FR-002, US1, US6). One module per kind is that module; a single file would keep eight families co-located and leave no home for the extracted particle producer.
- `engine/effects/` is a directory rename/split of the existing `engine/CollectionEffects.ts` home, so it introduces no new top-level layer and no forbidden edge.
- It gives the eventual F7 split a clean lift point: the whole folder later moves to `features/effects/` unchanged.

**Alternatives considered**:
- **`engine/effects.ts` (single file)** — rejected: it preserves the "one grab-bag file" shape the issue targets, has no clean place for `particles.ts`/`drawEffects.ts`, and makes the recipe's "one module" claim untrue.
- **`features/effects/` (F7 target)** — rejected: the spec's Assumptions explicitly state F7 is later work and R-004 performs no folder reorganisation beyond the hazard move. Landing F7 here would contradict the spec and enlarge review scope.
- **`contracts/effects.ts`** — rejected: contracts is a leaf and holds no behaviour; the registry carries `draw`/`tick` closures.

**Consequences**: New exports live under `engine/effects`; `engine/CollectionEffects.ts` is deleted; importers (`PlatformerState.ts`, `PlatformerPage.tsx`, `state/rewards.ts`, `engine/Renderer.ts`'s former consumers, `entities/hazards/FallingStalactite.ts`, and the tests) retarget to `engine/effects`/its per-kind modules.

---

## D2 — Home of the shared timed-tile core

**Decision**: A new **pure leaf `shared/timedTile.ts`**, sibling to the R-002 `shared/math.ts`. It exports the parameterized arm/advance/elapsed/shake helpers plus the neutral `GridTimerState` shape (`{ col, row, elapsed }`).

**Rationale**:
- The four consumers straddle folders: `engine/MushroomSquash.ts` and `engine/CrumblingFloor.ts` (engine), and the relocated `engine/FloorSpike.ts` → `entities/hazards/FloorSpike.ts` and `engine/FallingStalactite.ts` → `entities/hazards/FallingStalactite.ts` (entities).
- A `shared/` leaf is importable by both without creating any new cross-folder edge. Both folders already import `shared/math.ts`, so `shared/` is the established pure-primitives home.
- It keeps the core genuinely dependency-free (only `shared/math.ts` for `shakeOffsetX`), which is what lets it be parameterized purely by key accessor, duration, prune policy, and re-arm policy (FR-008).

**Alternatives considered**:
- **`engine/timedTile.ts`** — rejected: the relocated `entities/hazards/*` machines would then carry a new `entities/ → engine/` edge. That edge is not *forbidden*, but the spec requires the hazard move to preserve the existing dependency surface and add no new such edge (FR-013); a leaf home avoids the question entirely.
- **`entities/hazards/timedTile.ts`** — rejected: the engine mushroom/crumbling machines would then reach into a hazard folder for a generic primitive, an arbitrary coupling.
- **Fold into the effect registry** — rejected: R-005 re-homes the mushroom squash as a registered effect; R-004 deliberately keeps the timed tiles separate (the timed tile owns a *keyed timer collection*, not a transient effect instance), and the hazard machines must not depend on the effects registry.

**Consequences**: `MushroomSquash.ts`, `CrumblingFloor.ts`, `entities/hazards/FloorSpike.ts`, and `entities/hazards/FallingStalactite.ts` delegate their arm/advance/prune/shake to `shared/timedTile.ts` and keep only their durations, key shape, arm/prune semantics, and phase/offset mappings. The relocated falling-stalactite machine types its `crumblingFloorStates` parameter against `shared/timedTile.ts`'s `GridTimerState` (which `CrumblingFloorTimerState` satisfies structurally), so the move adds no `entities/ → engine/CrumblingFloor` import.

---

## D3 — "One draw pass" with preserved depth

**Decision**: One dispatch function `drawEffects(rc, layer, effects)` in `engine/effects/drawEffects.ts`. It iterates registry entries **in declaration order**, drawing only those whose `layer` matches, and for each kind draws the collection's effects of that kind. The page invokes the one dispatch at the four pipeline points the eight passes occupy today:

| Layer | Kinds (declaration order) | Pipeline position today |
| --- | --- | --- |
| `midWorld` | `healAura` | after player/held torch, before collectibles |
| `worldEffects` | `flyingText`, `puff`, `debris`, `hitSplatter`, `fadeOutText` | after the hint bubble |
| `aboveWorld` | `explosion` | above world effects, below the counters |
| `hudLast` | `counterPopup` | last, after enemy-eye/hint/UI work |

**Rationale**: FR-005 permits "more than one invocation of the one dispatch"; this reproduces each family's exact depth while keeping a single dispatch implementation. Declaration order reproduces the existing intra-layer call order byte-for-byte.

**Alternatives considered**:
- **One invocation with a numeric `order` field, sorting the collection** — rejected: more moving parts for no benefit; iteration order is already fixed and legible as registry order.
- **Collapse to one z-layer** — explicitly forbidden by FR-005/US5-4 (heal aura is mid-world; explosions sit above world effects and below counters).

**Consequences**: Renderer's eight `draw*Effects`/`drawCounterPopups` functions move into their effect modules; `Renderer.ts` no longer imports effect types. The page builds the per-frame render context (including the resolved counter-popup icons and the live player anchor) and calls `drawEffects` four times.

---

## D4 — `TransientEffect<S>` shape and the per-kind interval logic

**Decision**: `TransientEffect<S>` carries the issue's fields — `id`, `elapsed`, `duration`, `tick`, `draw`, `expired` — plus the per-kind state payload. `tick` may return a transitioned effect or the `null` sentinel; `expired` reports the family's exact boundary. The six byte-identical advance bodies collapse into one default.

**Per-kind boundary table** (must be preserved exactly):

| Kind | Advance | Expiry |
| --- | --- | --- |
| `flyingText` | 4-phase machine (`rising`→`holding`→`flying`→`done`) | `phase === 'done'` (set at `elapsed >= RISE+HOLD+FLIGHT`) |
| `counterPopup` | advance elapsed | `tick` returns `null` at `elapsed >= duration` |
| `puff` | default | `elapsed > SPARKLE_DURATION_SECONDS` |
| `healAura` | default | `elapsed > HEAL_AURA_DURATION_SECONDS` |
| `hitSplatter` | default | `elapsed > HIT_SPLATTER_DURATION_SECONDS` |
| `fadeOutText` | default | `elapsed > FADE_OUT_TEXT_DURATION_SECONDS` |
| `explosion` | default | `elapsed > EXPLOSION_DURATION_SECONDS` |
| `debris` | default | `elapsed > DEBRIS_DURATION_SECONDS` |

**Rationale**: Matches the spec's edge-case resolution (mixed `<=`/`<`/sentinel/phase-machine expiry) and FR-004/FR-007. A default `expired = elapsed > duration` covers six families; flyingText and counter override.

**Alternatives considered**:
- **A single uniform `elapsed >= duration` boundary** — rejected: changes one-frame behaviour for six families and breaks byte-identity.
- **No `tick` on the object; external per-kind ticks** — rejected: contradicts the issue's named fields and the registry's purpose.

**Consequences**: `advanceEffects(effects, dt, options?)` maps each effect through its registered `tick` and drops `null`/expired results; `resetGame()`/`resetGameProgress()` clear by registry reset scope.

---

## D5 — Reset scope and keyed slots

**Decision**: Registry metadata carries `resetScope: 'death' | 'progress'` and an optional `keyOf(effect)`. Only `fadeOutText` is `'death'`-scoped among effects; insertion of a keyed kind replaces the existing effect with the same `(kind, key)`.

**Rationale**: FR-006/US5-5 require that death/respawn keeps puffs/auras/splatters/debris/explosions/flyingText/counter popups and clears only fade-out labels (plus the four separate timed-tile timer arrays). FR-016/US5-1 require counter popups to be one-per-`labelKey` with refresh-in-place.

**Alternatives considered**:
- **Hard-code the clear lists in the state module** — rejected: FR-002/FR-006 want the policy declared where the kind is registered, so adding a kind is one registry line.
- **Keep counter popups as a record** — rejected by FR-003 (one collection) and the flat-collection requirement.

**Consequences**: `resetGame()` calls `clearEffectsByResetScope('death')` and clears the four timed-tile arrays; `resetGameProgress()` clears the whole collection. The counter popup's `tick`/refresh path upserts by key.

---

## D6 — The dying lead-in filtered advance

**Decision**: `advanceEffects(effects, dt, { kinds })` ticks and prunes only the named kinds; other effects are left untouched (frozen). The `dying` branch calls `advanceEffects(activeEffects, dt, { kinds: ['hitSplatter'] })`.

**Rationale**: US5-3/edge case require splatters to keep advancing while the world freezes, and the frozen effects must not have their `elapsed` advanced (which would desynchronise their fade timings).

**Alternatives considered**: A separate `advanceHitSplatters` entry point — rejected by FR-018 (no second per-kind tick path); filtering the shared advance is the single path.

---

## D7 — Text drawing without a renderer cycle

**Decision**: Extract `fillTextWithOutline` and the shared pixel font-family constant from `Renderer.ts` into a small `engine/textDraw.ts`. `Renderer.ts` and the effect modules import from it.

**Rationale**: Per-kind draws (flyingText, fade-out text, counter popup) need outlined text and the pixel font. Importing `Renderer.ts` from an effect module would couple feature logic to the god module; moving the helper gives one definition and an acyclic graph (`effects → textDraw`, `Renderer → textDraw`).

**Alternatives considered**:
- **Effect modules import `Renderer.ts`** — rejected: backwards coupling and a large dependency surface; the eventual F7 direction is `features/effects → engine/render` helpers, not the reverse.
- **Duplicate the helper** — rejected: violates one-home-per-primitive (R-002 spirit).

**Consequences**: `Renderer.test.ts`'s import of the font-family constant updates its path (allowed by FR-014).

---

## D8 — Hazard relocation and phase-vocabulary fold

**Decision**: `engine/FloorSpike.ts` merges into `entities/hazards/FloorSpike.ts`; `engine/FallingStalactite.ts` merges into `entities/hazards/FallingStalactite.ts`. `FloorSpikePhase`/`FloorSpikeTimerState` and `FallingStalactitePhase`/`FallingStalactiteTimerState` move into their owning modules, and `entities/hazards/phases.ts` is deleted. `engine/Collision.ts`, `PlatformerState.ts`, `PlatformerPage.tsx`, and `level/HazardMapper.ts` retarget. The merged falling-stalactite module types its `crumblingFloorStates` parameter with `shared/timedTile.ts`'s `GridTimerState` (structurally satisfied by `CrumblingFloorTimerState`), so it imports no `engine/CrumblingFloor` and the move adds no new `entities/ → engine/` edge.

**Rationale**: FR-011/US4 require each kind to be one self-contained module (view + timer state + constants + cycle/phase functions) and no orphan `phases.ts` re-export. The relocation preserves the existing `entities/hazards/ → engine/` imports (`findLandingRow`, `StaticObjectsCatalog` geometry, and the `DebrisLayer` type retargeted to `engine/effects/debris`), adds no `entities/ → engine/CrumblingFloor` import (the crumbling-floor parameter uses `shared/timedTile.ts`'s `GridTimerState`), and adds no `level/ → engine/` or `engine/ → state/` edge (FR-013).

**Alternatives considered**:
- **Keep a dependency-free `entities/hazards/phases.ts` sibling** — permitted by FR-011's parenthetical, but it leaves the phase vocabulary in a third file instead of the owning module and keeps `HazardMapper`'s import one hop away from the owner. The fold is the stronger "one self-contained module" reading, and the existing `level/ ↔ entities/` type relationship already exists (the `entities/hazards` barrel already reaches `level/HazardMapper` type-only), so no new cycle is introduced.
- **Leave the machines in `engine/`** — rejected: contradicts the issue and the analysis F2 placement row.

**Consequences**: Two engine modules and one phase module are deleted; their tests merge into the existing hazard view tests (updated, never weakened); editor code already consumes hazards through `entities/hazards` and needs no direct retarget.

---

## D9 — Shared particle-list producer

**Decision**: `engine/effects/particles.ts` exports one producer that owns the count/emission loop and the `{dx, dy, opacity}` assembly. Each family supplies its own count, layout closure, and fade curve (and keeps its constants).

**Rationale**: FR-010/US3 require one producer and byte-identical output while keeping per-family constants local. The arithmetic that determines bytes stays in the callers' closures, so no float-op reordering occurs.

**Alternatives considered**:
- **A formula-heavy shared producer with parameters for every curve** — rejected: risks float-op order changes and pushes family constants into a shared module, violating US3-2.

**Consequences**: `sparkleParticles`, `hitSplatterDroplets`, and `debrisPieces` become thin wrappers; their existing output tests keep asserting the same bytes.

---

## D10 — R-001 dependency-layer invariants

**Decision**: The design adds no `level/ → engine/` edge, no `engine/ → state/` edge, and keeps `contracts/` a leaf. The only cross-folder edges touched are `level/ → entities/` (hazard phases, unchanged direction) and the pre-existing `entities/hazards/ → engine/` helper imports (preserved).

**Rationale**: FR-013/SC-008. Verification is a one-time manual import inspection (R-001's chosen method) documented in the quickstart; if R-014 later adds a lint guard, it will be enforced automatically.

**Consequences**: `engine/effects/` imports `contracts/`, `shared/`, `entities/` and `engine/textDraw` — never a state module and never `level/` *state* (the app's game state). The two per-kind draw modules that need the render scale (`debris.ts`, `explosion.ts`) import `RENDER_SCALE` from `level/Terrain`, an allowed, pre-existing `engine/ → level/` constant import already used by `Renderer.ts`; `hitSplatter.ts` type-imports `EnemyTypeKey` from `entities/enemies`, preserving its pre-existing surface. `shared/timedTile.ts` imports only `shared/math.ts`.

---

## Summary of new structures and dependencies

**New modules**: `engine/effects/` (13 files incl. barrel), `shared/timedTile.ts`, `engine/textDraw.ts`.
**Deleted modules**: `engine/CollectionEffects.ts`, `engine/FloorSpike.ts`, `engine/FallingStalactite.ts`, `entities/hazards/phases.ts` (plus their relocated tests merged into existing ones).
**New runtime dependencies**: none. **New data**: none.
**Net layer change**: none forbidden; one new directory inside `engine/`.
