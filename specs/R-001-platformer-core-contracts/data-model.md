# Phase 1 Data Model — Platformer Core Contracts & Dependency Layers

**Feature**: R-001 | **Date**: 2026-09-24 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

This is a structural refactor, so the "entities" are **layers, modules, and the
symbols they own** rather than game data. The model below is the authoritative
move map and ownership table used by the tasks and by the manual import
inspection. Values, shapes, and behaviour are out of scope for change (SC-004).

---

## 1. Layers

| Layer               | Folder                     | May import from                                  | Must NOT import from                                         |
| ------------------- | -------------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| **Contracts**       | `contracts/` (NEW)              | itself, top-level `types.ts`                     | `engine/`, `entities/`, `level/`, `state/`, `editor/`, `components/`, `PlatformerState`, `PlatformerPage` |
| **Level**           | `level/`                   | `contracts/`, `entities/`, itself, top-level `types.ts` | `engine/`, `state/`, `editor/`, app pages                     |
| **Entities**        | `entities/`                | `contracts/`, `level/`, itself, top-level `types.ts`  | `state/`, `editor/`, app pages                                |
| **Engine**          | `engine/`                  | `contracts/`, `level/`, `entities/`, itself           | `state/`, `PlatformerState`, app pages                        |
| **State / features**| `state/`, `PlatformerState.ts` | everything below it                          | —                                                             |
| **App / UI**        | `PlatformerPage.tsx`, `editor/`, `components/` | everything below                       | —                                                             |

The change **adds** the `contracts/` layer, removes the `level/ → engine/` edge, and
removes the `engine/ → state/` edge. The accepted `level/ ↔ entities/` mutual
folder relationship is unchanged (spec assumption).

---

## 2. Symbol ownership (one home per contract — FR-012 / SC-002)

### 2.1 Contracts that move into `contracts/`

| Symbol                                                                 | New home                    | Former home                          |
| ---------------------------------------------------------------------- | --------------------------- | ------------------------------------ |
| `WorldType`, `Boxed`                                                   | `contracts/WorldType.ts`         | `entities/WorldType.ts`              |
| `Moving`, `SelfAnimated`, `Damageable`, `DamageableType`, `isInvulnerable` | `contracts/capabilities.ts`  | `entities/capabilities.ts`           |
| `Direction`, `Rect`, `Box`                                             | `contracts/geometry.ts`          | `entities/geometry.ts` + `engine/Collision.ts` (`Box`) |
| `PlayerEffects`, `RewardEffects`, `strongerBounce`                     | `contracts/Outcome.ts`           | `engine/Outcome.ts`                  |
| `ContactSide`, `Contact`, `CollisionOutcome`                           | `contracts/Contact.ts`           | `engine/Contact.ts`                  |
| `DrawContext` (now generic over the pot plan)                          | `contracts/DrawContext.ts`       | `engine/DrawContext.ts`              |
| `PHYSICS_CONFIG`                                                       | `contracts/PhysicsConfig.ts`     | `engine/PhysicsConfig.ts`            |

### 2.2 Referenced vocabulary extracted into `contracts/` (FR-003)

| Symbol                                     | New home                 | Former home                          |
| ------------------------------------------ | ------------------------ | ------------------------------------ |
| `SpriteLookup`                             | `contracts/SpriteLookup.ts`   | `entities/sprites/SpriteSheet.ts`    |
| `PickupKind`                               | `contracts/PickupKind.ts`     | `entities/pickups/index.ts`          |
| `CounterKey`, `CounterPopupLabelKey`       | `contracts/counters.ts`       | `entities/CollectiblesSummary.ts` (`CounterKey`), `engine/CollectionEffects.ts` (`CounterPopupLabelKey`) |

### 2.3 Decoupled type that stays put

| Symbol | Stays in | Now imported from |
| --- | --- | --- |
| `PotRenderPlan`, `PotRun`, `PotRunMember`, `PotFiller`, `PotKind` | `entities/blocks/potTypes.ts` | unchanged (the contracts layer sees only the generic parameter) |

### 2.4 Vocabulary that moves to a new home

| Symbol | Former home | New home |
| --- | --- | --- |
| `TorchStrength` | `level/LevelData.ts` | `entities/Torch.ts` |
| `FloorSpikePhase`, `FloorSpikeTimerState` | `engine/FloorSpike.ts` | `entities/hazards/phases.ts` |
| `FallingStalactitePhase`, `FallingStalactiteTimerState` | `engine/FallingStalactite.ts` | `entities/hazards/phases.ts` |

### 2.5 Behaviour module that changes layer

| Symbol / module                                   | New home             | Former home              |
| ------------------------------------------------- | -------------------- | ------------------------ |
| `createRewardReveal`, `RevealContext`, `RevealOptions` | `state/rewards.ts` | `engine/RewardReveal.ts` |

---

## 3. Module move map

| # | From                                        | To                                            | Kind   |
| - | ------------------------------------------- | --------------------------------------------- | ------ |
| 1 | `entities/WorldType.ts`                     | `contracts/WorldType.ts`                           | move   |
| 2 | `entities/capabilities.ts`                  | `contracts/capabilities.ts`                        | move   |
| 3 | `entities/geometry.ts`                      | `contracts/geometry.ts` (+ `Box`)                  | move   |
| 4 | `engine/Outcome.ts`                         | `contracts/Outcome.ts`                             | move   |
| 5 | `engine/Contact.ts`                         | `contracts/Contact.ts`                             | move   |
| 6 | `engine/DrawContext.ts`                     | `contracts/DrawContext.ts`                         | move   |
| 7 | `engine/PhysicsConfig.ts`                   | `contracts/PhysicsConfig.ts`                       | move   |
| 8 | `entities/sprites/SpriteSheet.ts` (`SpriteLookup`) | `contracts/SpriteLookup.ts`                 | extract |
| 9 | `entities/pickups/index.ts` (`PickupKind`)  | `contracts/PickupKind.ts`                          | extract |
|10 | `entities/CollectiblesSummary.ts` + `engine/CollectionEffects.ts` (counter keys) | `contracts/counters.ts` | extract |
|11 | `engine/Torch.ts`                           | `entities/Torch.ts` (+ `TorchStrength`) | move |
|12 | `engine/Torch.test.ts`                      | `entities/Torch.test.ts`              | move   |
|13 | `engine/Outcome.test.ts`                    | `contracts/Outcome.test.ts`                        | move   |
|14 | `engine/FloorSpike.ts` (phase + timer types) | `entities/hazards/phases.ts`                  | extract |
|15 | `engine/FallingStalactite.ts` (phase + timer types) | `entities/hazards/phases.ts`           | extract |
|16 | `engine/RewardReveal.ts`                    | `state/rewards.ts`                            | move   |
|17 | `engine/RewardReveal.test.ts`               | `state/rewards.test.ts`                       | move   |
|18 | `engine/Collision.ts` (`Box`)               | `contracts/geometry.ts`                            | extract |

`entities/WorldType.test.ts` and `entities/capabilities.test.ts` stay in place
(conformance tests — see research §4).

---

## 4. Validation rules (invariants)

- **I1 — Contracts leaf**: every import in `contracts/**` resolves to `contracts/**` or the
  top-level `types.ts`. No other folder is named. (FR-002)
- **I2 — No level→engine**: no file under `level/` imports from `../engine/` or
  deeper. (FR-008)
- **I3 — No engine→state**: no file under `engine/` imports `PlatformerState` or
  any `state/` module. (FR-010)
- **I4 — One home**: each contract in §2.1/§2.2 is exported from exactly one
  module; no compatibility re-export preserves a former upward path. (FR-012)
- **I5 — Behaviour preserved**: moved module bodies are unchanged apart from import paths;
  the only sanctioned body changes are the `DrawContext` type-parameter change, the three
  vocabulary extractions (`SpriteLookup`, `PickupKind`, counter keys), and the `PICKUP_TYPES`
  conformance clause. Constants, values, and function logic are unchanged. (SC-004)
- **I6 — Tests intact**: no test is deleted, skipped, or weakened; only import
  paths change. (FR-011)

### Conformance assertions added (type-level only)

- `entities/pickups/index.ts`: `PICKUP_TYPES` must satisfy
  `Record<PickupKind, unknown>` so the contracts vocabulary and the registry cannot
  drift.
- `contracts/DrawContext.ts`: `DrawContext<PotRenderPlan>` must remain assignable to
  the default `DrawContext` used by entity families (covariant `potPlan`).

---

## 5. State transitions

The feature is stateless in the game sense. The only "state transition" is the
module graph itself, expressed as before/after edges:

```text
BEFORE
  contracts:       (does not exist)
  level  ────────► engine        (cycle with engine → level)
  engine ──► PlatformerState     (layer inversion)
  entities ──► engine            (contracts: WorldType, Outcome, Contact, DrawContext, PhysicsConfig)

AFTER
  contracts (leaf)
  level     ──► contracts, entities
  engine    ──► contracts, level, entities
  entities  ──► contracts, level
  state     ──► contracts, engine, entities, PlatformerState
  app       ──► everything
  (no level → engine edge; no engine → state edge)
```

---

## 6. Out of scope (does not change)

`LightSource`, the transient-effect registry, `SpeechBubble`, pickup
unification, registry-dispatch completion, `findLandingRow` / `layoutFile` /
`TileAtlas` dedup, kind-union derivation, world items, static-tile registry and
renderer split, mapper/editor unification, damage/bomb systems, per-domain state
stores, sprite asset organization (**R-002–R-013**); gameplay, balance, visuals,
level data, and public behaviour.
