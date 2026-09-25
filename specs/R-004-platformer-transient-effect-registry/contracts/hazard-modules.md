# Contract: Hazard Module Ownership & Import Invariants

**Feature**: R-004 | **Modules**: `src/themes/platformer/entities/hazards/{FloorSpike,FallingStalactite}.ts`

Each hazard kind is one self-contained module owning its view, timer state, constants, phase vocabulary, and cycle/offset functions (FR-011/FR-012). `engine/FloorSpike.ts`, `engine/FallingStalactite.ts`, and `entities/hazards/phases.ts` are deleted.

---

## Ownership

| Export | Owner |
| --- | --- |
| `floorSpike` (view) | `entities/hazards/FloorSpike.ts` |
| `FloorSpikePhase`, `FloorSpikeTimerState` | `entities/hazards/FloorSpike.ts` |
| `FLOOR_SPIKE_*` constants, `armFloorSpike`, `advanceFloorSpikes`, `floorSpikePhaseAt/For`, `isFloorSpikeArmed`, `floorSpikeExtensionAt/For` | `entities/hazards/FloorSpike.ts` |
| `fallingStalactite` (view) | `entities/hazards/FallingStalactite.ts` |
| `FallingStalactitePhase`, `FallingStalactiteTimerState` | `entities/hazards/FallingStalactite.ts` |
| `FALLING_STALACTITE_*` constants, `armFallingStalactite`, `advanceFallingStalactites`, `isFallingStalactiteArmed`, `fallingStalactiteElapsedFor`, `fallingStalactiteOffsetYAt`, `fallingStalactiteShakeOffsetXAt`, `fallingStalactiteLandingRow`, `fallingStalactiteSpriteHeight`, `fallingStalactiteRestOffsetY`, `fallingStalactitePhaseFor`, `detectionZoneCells`, `fallingStalactiteShatter` | `entities/hazards/FallingStalactite.ts` |

No orphan `phases.ts` re-export remains.

## Consumer retargeting

| Former importer | New source |
| --- | --- |
| `PlatformerState.ts` | `entities/hazards/FloorSpike`, `entities/hazards/FallingStalactite` |
| `PlatformerPage.tsx` | `entities/hazards/FallingStalactite` |
| `engine/Collision.ts` + `engine/Collision.test.ts` | `entities/hazards/FloorSpike`, `entities/hazards/FallingStalactite` |
| `level/HazardMapper.ts` | phase types from `entities/hazards/FloorSpike`, `entities/hazards/FallingStalactite` |
| hazard tests | merged into `entities/hazards/{FloorSpike,FallingStalactite}.test.ts` |
| editor preview | already consumes hazards via `entities/hazards`; verify no direct engine-machine import remains |

Behaviour is unchanged; only import paths, file locations, and test locations change (FR-012/FR-014).

## Import invariants (R-001, FR-013)

1. No new `level/ → engine/` edge. `level/HazardMapper.ts` reaches phase types through the allowed `level/ → entities/` edge.
2. No new `engine/ → state/` edge.
3. `contracts/` remains a leaf (untouched).
4. The pre-existing `entities/hazards/ → engine/` imports (`engine/Standable.findLandingRow`, `engine/StaticObjectsCatalog` stalactite twin geometry, and the `DebrisLayer` type — retargeted from the deleted `engine/CollectionEffects` to `engine/effects/debris`) are preserved, not widened. The merged falling-stalactite module types its `crumblingFloorStates` parameter against `shared/timedTile.ts`'s `GridTimerState`, so it adds no `entities/ → engine/CrumblingFloor` import. Relocating those helpers is out of scope.
5. The timed-tile core is imported from `shared/timedTile.ts`, so the relocation adds no new cross-folder edge.

## Verification

A one-time manual import inspection (R-001's chosen method), documented in [`quickstart.md`](../quickstart.md): search the theme for `engine/FloorSpike`, `engine/FallingStalactite`, `hazards/phases`, any `level/ → engine/` import, and any `engine/ → PlatformerState`/state import; all must be absent.
