# Feature Specification: Platformer Abstract Light Sources

**Feature Branch**: `R-003-platformer-abstract-light-sources`
**Created**: 2026-09-25
**Status**: Draft
**Input**: GitHub issue #91 — "R-003: Platformer Abstract Light Sources". Introduce one `LightSource` concept so the wall torches, the player's carried light, and future emitters share a single lighting model, and collapse the duplicated punch/glow blocks in the darkness pass.

**Depends on**: [R-001 Platformer Core Contracts & Dependency Layers](../R-001-platformer-core-contracts/spec.md) (the `contracts/` + layer invariants the light list must respect) and [R-002 Platformer Shared Primitives & Dedup](../R-002-platformer-shared-primitives/spec.md) (the `shared/math.ts` primitives the lighting math already consumes). [S-031 Platformer Torch Strength](../S-031-platformer-torch-strength/spec.md) (shipped) supplies the per-torch `strength` the torch adapter scales by.
**Design reference**: [`docs/PlatformerArchitectureAnalysis.md`](../../docs/PlatformerArchitectureAnalysis.md) — Phase 1, findings **L2** (lighting is torch-shaped), **L3** (fog duplicates the falloff + hash technique — already resolved by R-002), and **X5** (Torch.ts + the torch half of Lighting.ts are one concept split).

## Clarifications

### Session 2026-09-25

- Q: Do enemy eyes become a true emitter in the light list, or stay a separate effect? → A: Enemy-eye visibility is **not** a light effect; it is an additional effect drawn on top of the cave overlay. It stays a separate pass that only *reads* the shared light list to derive local darkness — it never becomes a `LightSource`.
- Q: Which module owns the `LightSource` type? → A: `contracts/lighting.ts` — `LightSource` is a shared render contract (like `WorldType`/`geometry`/`DrawContext`), so it joins the R-001 `contracts/` leaf. The torch *adapter* stays with the torch in `entities/Torch.ts`; `contracts/lighting.ts` holds only the type/vocabulary and imports nothing upward.
- Q: Is `LightSource.radius` a resolved number or a time function `radius(t)`? → A: A resolved number produced by per-kind adapters at the caller's `worldElapsed`; `LightSource` stays a plain data shape both the draw pass and `localDarknessAt` read directly.
- Q: The torch and player glow gradients use different mid stops (`0.35` vs `0.3`). → A: `LightSource` carries a `glowMidAlpha` field alongside `color` and `intensity` — the torch adapter sets `0.35`, the player adapter `0.3` — so one generic glow loop reproduces both exact gradients (FR-006) while `drawDarkness` stays generic. `color` stays the opaque base colour and `intensity` drives only the overall `globalAlpha`.
- Q: Where is the `LightSource[]` assembled? → A: The `torchPositions` signal keeps its `TorchLight[]` shape; the page/editor adapts to `LightSource[]` per frame (radius resolved with `worldElapsed`) and appends the player light. Time stays out of state.
- Q: Where does the player's carried light live? → A: With the player. The player module (`entities/Player.ts`) implements the `LightSource` contract — a player light adapter replaces `engine/Renderer.ts`'s `heldTorchLightPosition`, so the player, like the torch, is a light emitter and its light geometry cannot drift from the drawn held torch.
- Q: Should `worldElapsed` remain on `drawDarkness`/`localDarknessAt`? → A: No. Once the adapters resolve `radius`, neither needs time; both drop `worldElapsed`. `drawEnemyEyes` keeps `worldElapsed` only for the eye bob.
- Q: What time does the editor preview resolve torch radii at? → A: `worldElapsed = 0`, matching `EditorCanvas`'s current static preview — so the preview stays visually unchanged.
- Q: Should the light list be built when there is no darkness? → A: No. When `darknessLevel <= 0` the render loop skips assembling the `LightSource[]` and skips calling `drawDarkness`/`drawEnemyEyes`; the existing pass-level fast path is extended to the assembly and call site (FR-019).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - One light list drives the darkness pass (Priority: P1)

A developer adding any light emitter — today a wall torch or the player's carried light, later a glowing pickup or a lava tile — currently has to edit two places that both hardcode the current two kinds. `drawDarkness` takes a `torches` array **and** a separate `playerLight` point and contains four near-duplicated blocks (a torch punch, a player punch, a torch glow, a player glow) whose only differences are radius source, colour literal, and intensity. `localDarknessAt` hardcodes the same two-kind max. After this feature there is one `LightSource` concept, `drawDarkness` is two loops (punch, then glow) over a single `readonly LightSource[]`, `localDarknessAt` iterates that same list, and the separate `playerLight` parameter is gone — so a third emitter is data, not a new code path.

**Why this priority**: This is the core abstraction the feature exists to deliver, and it removes the duplicated blocks that make lighting the least attractive place to add an emitter. It has the highest leverage of the phase and is a prerequisite for the torch-module merge in Story 3.

**Independent Test**: Inspect `drawDarkness` and `localDarknessAt` — each consumes one `readonly LightSource[]`; `drawDarkness` contains exactly one punch loop and one glow loop; neither declares nor takes a `playerLight` parameter. Then add a throwaway third `LightSource` (e.g. at an arbitrary position) and confirm it punches/glows and darkens enemy eyes with **no** edit to either function.

**Acceptance Scenarios**:

1. **Given** the platformer theme, **When** it is searched for a `LightSource` type, **Then** exactly one is exported (from `contracts/lighting.ts`) with the fields `x`, `y`, `radius`, `color`, `intensity`, `glowMidAlpha`, and `punchHole`, where `color` is the opaque base colour and `glowMidAlpha` the per-light mid-stop alpha.
2. **Given** `drawDarkness`, **When** its signature is inspected, **Then** it takes one `lights: readonly LightSource[]` (no `torches` parameter and no `playerLight` parameter) and contains exactly one loop that punches holes and one loop that paints glows.
3. **Given** `localDarknessAt`, **When** its signature is inspected, **Then** it takes the same `readonly LightSource[]` and returns `clamp(darknessLevel − strongestLight, 0, darknessLevel)` using the **maximum** contribution, exactly as before.
4. **Given** a third light added to the list (neither a torch nor the player), **When** `drawDarkness` and `localDarknessAt` run, **Then** it is punched, glowed, and counted in local darkness with no new branch.
5. **Given** a light whose `punchHole` is `false`, **When** the darkness pass runs, **Then** it contributes a glow and local light but erases no darkness.
6. **Given** `darknessLevel <= 0`, **When** a frame renders, **Then** no `LightSource[]` is built and neither `drawDarkness` nor `drawEnemyEyes` is called.

---

### User Story 2 - Torch and player light are adapters onto `LightSource` (Priority: P1)

The two shipped lights are today two parallel constant-and-function stacks with different shapes and homes: torches are `TorchLight` records (`{col, row, strength, x, y}`) with radius/pulse/glow helpers, while the player's carried light is a bare `Point` produced by `heldTorchLightPosition` **inside `engine/Renderer.ts`** with its own radius/colour/intensity constants. After this feature each is expressed as a `LightSource` adapter owned by its subject: the torch adapter lives in `entities/Torch.ts`, and the player module implements the `LightSource` contract (the player light adapter replaces `heldTorchLightPosition` in the renderer), so both feed the one list Story 1 consumes.

**Why this priority**: These are the concrete implementations the abstraction is proven against; without them Story 1 has nothing to draw. It is the "abstract interface that torch and player both implement" the issue asks for.

**Independent Test**: Call each adapter and compare against the pre-refactor values — a torch's `LightSource.radius` equals `TORCH_LIGHT_RADIUS_PX × torchLightScale(strength) × torchPulseScale(torch, t)`, the player light adapter's radius/color/glow-mid-alpha/intensity equal `PLAYER_LIGHT_RADIUS_PX` / `PLAYER_GLOW_COLOR` / `0.3` / `PLAYER_GLOW_INTENSITY`, and the player light adapter lives in the player module (not the renderer). Both produce the same screen output as today.

**Acceptance Scenarios**:

1. **Given** a torch of a given `strength` at a given `worldElapsed`, **When** its adapter produces a `LightSource`, **Then** its `radius` is byte-identical to today's `torchLightRadius(torch, worldElapsed)`, its `color` is `TORCH_GLOW_COLOR` (`rgb(255, 176, 74)`), its `glowMidAlpha` is `0.35`, its intensity is `1`, and it punches a hole.
2. **Given** a `PlayerState`, **When** the player module's light adapter is called, **Then** it returns a `LightSource` centred on the held torch (same `x`/`y` as today), with radius `PLAYER_LIGHT_RADIUS_PX`, `color` `rgb(255, 145, 45)`, `glowMidAlpha` `0.3`, intensity `PLAYER_GLOW_INTENSITY`, and a punched hole — and `engine/Renderer.ts` no longer owns the player light.
3. **Given** the same cave scene, **When** the page draws the darkness pass from the adapted list, **Then** the rendering is unchanged from the four-block version (same hole radii, same glow colours and alphas, same layering).
4. **Given** the page's call sites, **When** they are inspected, **Then** they adapt the `torchPositions` signal and the held torch to one `LightSource[]` per frame and pass it to both `drawDarkness` and `drawEnemyEyes`.

---

### User Story 3 - The torch module owns its own light (Priority: P2)

Finding X5: `entities/Torch.ts` (frame animation, `TorchStrength`, strength scaling) and the torch half of `engine/Lighting.ts` (the `TorchLight` shape, radius, pulse, glow colour, glow strength) are one concept split across two folders. After this feature the torch's light half moves to `entities/Torch.ts`, so the torch module is whole, and `Lighting.ts` keeps only the things that are not torch-specific: darkness easing/clamping, the cave-cell probe, fog, and the enemy-eye opacity/bob.

**Why this priority**: It completes the "one concept, one home" intent, removes the last torch-specific formula from the generic lighting module, and shrinks the surface a future `features/torch/` organisation (F7) has to touch.

**Independent Test**: Inspect `entities/Torch.ts` — it exports the torch descriptor (`TorchLight`, including `strength`) and the torch light adapter/constants; inspect `engine/Lighting.ts` — it contains no torch light radius, pulse, or glow-colour formula, and still exports the fog, darkness, and enemy-eye math.

**Acceptance Scenarios**:

1. **Given** a search for the torch light radius/pulse/glow formula across the theme, **When** the code is inspected, **Then** it appears only in `entities/Torch.ts`; `engine/Lighting.ts` imports it rather than re-deriving it.
2. **Given** `entities/Torch.ts`, **When** its exports are inspected, **Then** the `TorchStrength` type and strength helpers plus the torch's light adapter and its constants live together in that one module.
3. **Given** `engine/Lighting.ts`, **When** its exports are inspected, **Then** it still owns `nextDarknessLevel`, `isCellDarkening`, `playerOccupiedCell`, fog (`fogPuffAt`/`fogPeekStrengthAt`), and the enemy-eye math (`enemyEyeOpacity`/`enemyEyeBobOffset`), and it remains pure and DOM-free.
4. **Given** the import graph, **When** it is inspected, **Then** `entities/Torch.ts` still reaches only `shared/math` (a leaf), and no new `level/` or `engine/` edge is introduced into it.

---

### User Story 4 - Enemy eyes and the editor preview consume the shared list (Priority: P2)

The enemy-eye pass and the editor's dark-mode preview are the other two consumers of the torch/player light inputs. Today `drawEnemyEyes` takes `torches` + `playerLight` separately, and `caveLightingPreview` returns a `{ torches, playerLight }` pair. After this feature both take the same `readonly LightSource[]` the darkness pass takes, so there is exactly one way to describe lights in the whole theme.

**Why this priority**: It is the last consumer to migrate, so leaving it would keep the old two-input shape alive and defeat the abstraction. It carries no new behaviour, so it follows the core work.

**Independent Test**: Inspect `drawEnemyEyes` and `caveLightingPreview` — neither accepts nor exposes separate torch/player light inputs; the editor's preview still toggles on, still darkens a cave grid, and still shows identical torch pools and the spawn's carried light.

**Acceptance Scenarios**:

1. **Given** `drawEnemyEyes`, **When** its signature is inspected, **Then** it takes one `lights: readonly LightSource[]` (no `torches` + `playerLight` pair) and still computes each enemy's local darkness from that list.
2. **Given** the editor's `caveLightingPreview`, **When** its result is inspected, **Then** it exposes the preview's lights as a `LightSource[]` (wall torches plus the spawn's carried light), and `EditorCanvas` passes that one list to `drawDarkness` and `drawEnemyEyes`.
3. **Given** editor dark mode with a spawn and at least one torch, **When** the preview renders, **Then** the visual frame matches the pre-refactor preview.
4. **Given** a level with no torches and no spawn, **When** the preview renders, **Then** the result is unchanged (maximum preview darkness, no lights).

---

### Edge Cases

- ✅ **`punchHole` must mean something for both light kinds, and for future glow-only emitters.** A torch and the player's carried light both punch (they erase darkness *and* warm it); a glow-only emitter (e.g. a lit rune) punches nothing but must still count as local light. Resolved by `LightSource.punchHole` + FR-001/FR-005/FR-007.
- ✅ **A non-punching light must still reduce `localDarknessAt` output** (it illuminates) **while leaving the darkness layer intact** (it does not erase it) — two different questions that the old code conflated into "is it a torch or the player". Resolved by separate `punchHole` handling in `drawDarkness` and uniform handling in `localDarknessAt`.
- ✅ **The four-block collapse must not change visuals.** Radius source, glow colour, glow alpha (`darknessLevel` vs `darknessLevel × PLAYER_GLOW_INTENSITY`), the glow-inside-the-hole ratio (`× 0.7`), and draw order (all punches, composite, then all glows) must all be preserved. Resolved by FR-006 and Story 2 scenario 3.
- ✅ **The glow-gradient colour stops are per-light literals, not just a base colour.** The torch glow has a mid stop (`rgba(255, 176, 74, 0.35)`) and the player glow has its own (`rgba(255, 145, 45, 0.3)`), while the punch hole is always a black radial. Resolved by `LightSource.color` (opaque base) plus a per-light `glowMidAlpha` (`0.35` torch / `0.3` player), so the one glow loop reproduces both exactly; `intensity` drives only the overall `globalAlpha`, and the punch hole stays black. See FR-001/FR-005/FR-006.
- ✅ **Zoom and origin must keep applying exactly once.** `drawDarkness` runs at identity transform and scales world positions/radii by its `zoom` argument before adding `origin`; the editor passes raw pan + `zoom`, the live game passes `1` after its own scale. Resolved by FR-005 and the "zoom/origin" assumption.
- ✅ **The offscreen layer reuse and the full-brightness fast path must survive.** `darknessLevel <= 0` still draws nothing, and the caller-owned layer is still cleared/filled/composited once. Resolved by FR-008.
- ✅ **Per-light viewport filtering must stay.** Only lights whose glow can intersect the canvas do work, keeping the pass O(visible lights). Resolved by FR-008.
- ✅ **No light list is built when there is no darkness.** The passes already no-op at `darknessLevel <= 0`; assembling the `LightSource[]` (and running each adapter) in a fully bright level is pure waste, so the render loop skips it. This holds because lights only matter to the darkness pass — a `punchHole: false` glow still shows only inside it; revisit if atmospheric light in bright levels is ever wanted. Resolved by FR-019.
- ✅ **Enemy eyes must remain a separate post-darkness effect, not a light.** They are an addition on top of the cave overlay whose opacity comes from local darkness; if they became a `LightSource` emitter they would render into the darkness rather than over it and would change their purpose (being *visible through* darkness). Resolved by FR-009/FR-015.
- ✅ **Moving the player light out of `engine/Renderer.ts` must not break its importers.** The player light adapter (formerly `heldTorchLightPosition`) is imported by the page render loop, the editor preview, and mocked in three editor tests; those imports retarget to the player module, and the held-torch draw must keep using the same geometry so the flame and its light stay aligned. Resolved by FR-004/FR-012.
- ✅ **R-002's fog dedup must not regress.** `fogPuffAt`/`fogPeekStrengthAt` already use `shared/math.ts` `hash2D`/`smoothstep`; the X5 move must not re-inline those formulas. Resolved by FR-010.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: A single `LightSource` type MUST be exported from `contracts/lighting.ts` with the fields `x`, `y`, `radius`, `color`, `intensity`, `glowMidAlpha`, and `punchHole`; `color` MUST be the light's opaque base colour and `glowMidAlpha` its per-light mid-stop alpha, so a single glow loop reproduces each light's exact gradient while `intensity` remains the overall `globalAlpha` multiplier only; it MUST be the one light shape the darkness pass, the local-darkness probe, and the enemy-eye pass all consume.
- **FR-002**: `LightSource.radius` MUST be a resolved number computed by the per-kind adapter at the caller's current `worldElapsed` (not a time function carried on the light); a light with a constant radius (the player's carried light) and one whose radius pulses (a torch) MUST both fit the type, with the adapter owning the time dependency.
- **FR-003**: A torch adapter (in `entities/Torch.ts`) MUST map a torch descriptor (`TorchLight`, carrying `col`, `row`, `x`, `y`, `strength`) plus `worldElapsed` to a `LightSource`, with radius byte-identical to today's `torchLightRadius`, `color` `TORCH_GLOW_COLOR`, `glowMidAlpha` `0.35`, intensity `1`, and `punchHole` true.
- **FR-004**: The player module (`entities/Player.ts`) MUST own the player's carried light and implement the `LightSource` contract: a player light adapter (replacing `engine/Renderer.ts`'s `heldTorchLightPosition`) MUST return a `LightSource` centred on the held torch, with radius `PLAYER_LIGHT_RADIUS_PX`, `color` `PLAYER_GLOW_COLOR`, `glowMidAlpha` `0.3`, intensity `PLAYER_GLOW_INTENSITY`, and `punchHole` true. The held-torch geometry the adapter needs (offsets/scale) MUST have one home in the player module, and `engine/Renderer.ts`'s held-torch draw MUST consume it from there so the drawn flame and its light cannot drift.
- **FR-005**: `drawDarkness` MUST take one `lights: readonly LightSource[]` and MUST NOT take a `playerLight` parameter nor a `worldElapsed` parameter (the adapters already resolved each radius); it MUST contain exactly one loop that punches holes (`destination-out`) and one loop that paints additive glows (`lighter`), replacing the four per-kind blocks.
- **FR-006**: `drawDarkness` MUST preserve its current visual output for the current torch/player inputs — same per-light radii, punch colour, per-light glow stops (`color` base + `glowMidAlpha` mid stop), overall glow alphas (`darknessLevel` for the torch, `darknessLevel × intensity` for the player), glow-inside-the-hole ratio, and draw order.
- **FR-007**: `localDarknessAt` MUST take the same `readonly LightSource[]` and MUST NOT take a `worldElapsed` parameter; it MUST return `clamp(darknessLevel − strongest, 0, darknessLevel)` using the **maximum** contribution (never a sum); with no lights it MUST return `darknessLevel` unchanged.
- **FR-008**: `drawDarkness` MUST keep its full-brightness fast path (`darknessLevel <= 0` draws nothing), its single caller-owned offscreen-layer composite, and per-light viewport filtering.
- **FR-009**: `drawEnemyEyes` MUST take the same `readonly LightSource[]` (replacing the `torches` + `playerLight` pair) and MUST remain a separate post-darkness overlay effect — it is not a light emitter, and it reads the list only to derive each enemy's local darkness.
- **FR-010**: The light-kind halves of `engine/Lighting.ts` MUST move to their subjects: the torch half (the `TorchLight` shape and the radius/pulse/glow constants and helpers) to `entities/Torch.ts` (finding X5), and the player half (`PLAYER_LIGHT_RADIUS_PX`, `PLAYER_GLOW_COLOR`, `PLAYER_GLOW_INTENSITY`, `playerGlowStrengthAt`) to `entities/Player.ts` beside the player's `LightSource` adapter (FR-004) — an `entities/ → engine/` import would violate R-001. `engine/Lighting.ts` MUST retain darkness easing/clamping, the cave-cell probe, fog, the enemy-eye math, and `localDarknessAt` (which derives every contribution from `LightSource.radius`), and MUST NOT re-derive any kind-specific light formula. The falloff itself MUST have one implementation: a shared `radialFalloffAt(x, y, centerX, centerY, radius)` primitive in `shared/math.ts` that `localDarknessAt`, `torchGlowStrengthAt`, and `playerGlowStrengthAt` all delegate to, so the light probes share one falloff and the torch/player helpers are thin test-covered wrappers. (Fog's own peek falloff stays a separate effect and is out of scope.)
- **FR-011**: The `LightSource` type MUST live in `contracts/lighting.ts`, a `contracts/` leaf that imports nothing from `engine/`, `entities/`, `level/`, state, or the app pages (R-001 FR-002), so both `engine/` and `entities/` can import it without a cycle. The torch *adapter* stays in `entities/Torch.ts`; the type module holds only the light vocabulary.
- **FR-012**: Every former consumer of the separate light inputs (`PlatformerPage`'s render loop, `EditorCanvas`, `caveLightingPreview`, and the `PlatformerState` torch list) MUST route through the single `LightSource[]`; no consumer MAY keep a parallel `torches` + `playerLight` input pair. The `LightSource[]` MUST be assembled at the draw call site each frame (the `torchPositions` signal keeps its `TorchLight[]` shape; radius is resolved with `worldElapsed`), so no resolved radius is stored in state.
- **FR-013**: The editor's `caveLightingPreview` MUST expose the preview lights as a `LightSource[]` (resolving each torch's radius at `worldElapsed = 0`, matching the preview's current static frame) and keep its current behaviour (always `EDITOR_PREVIEW_DARKNESS` while active; wall torches from the grid; the spawn's carried light when a spawn exists, `null`/absent otherwise).
- **FR-014**: Fog MUST continue to use the shared `shared/math.ts` `hash2D`/`smoothstep` primitives introduced by R-002; the refactor MUST NOT re-inline either formula.
- **FR-015**: Enemy-eye visibility MUST NOT be modelled as a `LightSource`; it MUST remain a separate post-darkness overlay effect (an addition on top of the cave overlay) whose opacity is derived from `localDarknessAt`, not a light emitter added to the list.
- **FR-016**: The change MUST preserve behaviour: all existing tests (updated only where a signature changed, never weakened, skipped, or deleted) MUST pass and the production build MUST succeed.
- **FR-017**: The change MUST NOT regress R-001's layer invariants (`contracts/` stays a leaf; no `level/ → engine/`; no `engine/ → state`) and MUST keep `engine/Lighting.ts` a pure, DOM-free module.
- **FR-018**: There MUST be no data migration: authored levels, markers, torch strengths, and tuning are unchanged.
- **FR-019**: When `darknessLevel <= 0`, the render loop MUST skip the light work entirely — it MUST NOT build the `LightSource[]` and MUST NOT call `drawDarkness` or `drawEnemyEyes`, so no light adapter runs and no list is allocated in a fully bright level. This extends FR-008's pass-level fast path to the assembly and the call site.

### Key Entities

- **`LightSource`**: the one light shape (`x`, `y`, `radius`, `color`, `intensity`, `glowMidAlpha`, `punchHole`) that the darkness pass, the local-darkness probe, and the enemy-eye pass all consume; `color` is the opaque base and `glowMidAlpha` the per-light mid-stop alpha.
- **Torch descriptor (`TorchLight`)**: a torch's `col`/`row`/`strength` plus its world centre — the input to the torch adapter (kept because `col`/`row` drive the pulse phase and `strength` drives the radius).
- **Torch light adapter + constants** (in `entities/Torch.ts`): the torch-specific radius/pulse/glow math (`TORCH_LIGHT_RADIUS_PX`, `TORCH_PULSE_AMPLITUDE`, `TORCH_PULSE_PERIOD_SECONDS`, `TORCH_GLOW_COLOR`, `torchLightRadius`, `torchPulseScale`, `torchGlowStrengthAt`) moving there from `engine/Lighting.ts`, plus the `torchLightSource(torch, worldElapsed): LightSource` adapter.
- **Player carried light** (in `entities/Player.ts`): the player module's `LightSource` adapter (replacing `engine/Renderer.ts`'s `heldTorchLightPosition`) with the player's radius, color, glow-mid-alpha, and intensity constants, plus the held-torch geometry it shares with the renderer's draw.
- **Darkness pass (`drawDarkness`)**: two loops (punch, glow) over the light list, plus the offscreen-layer composite and viewport filter.
- **Local-darkness probe (`localDarknessAt`)**: the max-combine of all lights' contributions at a point.
- **Enemy-eye pass (`drawEnemyEyes`)**: consumes the same light list to derive local darkness but stays a separate post-darkness overlay effect — it is not a light.
- **Editor preview (`caveLightingPreview`)**: exposes the editor's lights as a `LightSource[]`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `drawDarkness` contains exactly one punch loop and one glow loop and takes neither a `playerLight` nor a `worldElapsed` parameter; a search finds no remaining per-kind punch/glow block (four blocks reduced to two loops).
- **SC-002**: `LightSource` is defined exactly once, and `drawDarkness`, `localDarknessAt`, and `drawEnemyEyes` each accept that one list type (zero remaining `torches`+`playerLight` input pairs in the theme).
- **SC-003**: Adding a third, non-torch/non-player light changes no branch in `drawDarkness` or `localDarknessAt` — it is data in the list.
- **SC-004**: The torch light formula (radius/pulse/glow) is defined only in `entities/Torch.ts` and the player light formula only in `entities/Player.ts`; `engine/Lighting.ts` contains neither and still exports the fog and enemy-eye math.
- **SC-005**: The full test suite passes and the production build succeeds; a manual browser pass over a cave level (walking in/out of dark cells, passing torches of different strengths, entering a cave with fog) and an editor dark-mode preview show no visible or behavioural difference.
- **SC-006**: Enemy-eye markers still appear only above the darkness overlay and still fade in as local darkness grows (farther from lights); the four-block collapse changes no marker position, opacity, or bob.
- **SC-007**: The player light adapter lives in the player module (`entities/Player.ts`) and implements the `LightSource` contract; `engine/Renderer.ts` contains no player-light radius/glow/intensity formula, and the held-torch draw and the light share one geometry source.
- **SC-008**: At `darknessLevel <= 0` no light adapter runs and no `LightSource[]` is allocated, and neither light pass is called.

## Assumptions

- **L3 is already satisfied by R-002.** The fog falloff/hash duplication (L3) was resolved when `shared/math.ts` landed: `fogPuffAt`/`fogPeekStrengthAt` already call `hash2D`/`smoothstep`. R-003 verifies this and must not regress it (FR-014); it does not redo it.
- **`LightSource.radius` is a resolved value.** The issue's `radius(t)` is realised by adapters that resolve a radius at the caller's `worldElapsed` (the render loop already has `worldElapsed`); the type itself stays a plain number. This keeps `LightSource` a data shape both the draw pass and the darkness probe can read directly (FR-002).
- **`TorchLight` is retained as the torch's own descriptor.** It carries `col`/`row` (needed for `torchPhase`) and `strength` (needed for `torchLightScale`); the generic `LightSource` cannot supply the pulse phase. The adapter bridges the two.
- **The `LightSource` home is `contracts/lighting.ts`.** `LightSource` is a shared render contract (alongside `WorldType`/`geometry`/`DrawContext`), so it joins the R-001 `contracts/` leaf; the torch *adapter* stays with the torch in `entities/Torch.ts`, and `contracts/lighting.ts` holds only the light vocabulary and imports nothing upward (FR-011).
- **Enemy eyes are not a light.** They stay a separate effect drawn on top of the cave overlay; they only read local darkness from the shared list to decide opacity, and are never added as a `LightSource` (FR-009/FR-015).
- **The player is a light emitter.** The player module (`entities/Player.ts`) owns its carried light and implements the `LightSource` contract as the second adapter beside the torch; `engine/Renderer.ts` keeps only the held-torch *draw* and consumes the shared geometry, so the light and the drawn flame agree (FR-004).
- **No time parameter survives on the draw or the probe.** Once the adapters resolve `radius`, `drawDarkness` and `localDarknessAt` no longer need `worldElapsed`; they drop it. `drawEnemyEyes` keeps it only for the eye bob (FR-005/FR-007).
- **The editor preview resolves at `t = 0`.** That is what `EditorCanvas` passes today, so the preview stays a static, byte-identical frame (FR-013).
- **No folder reorganisation.** The `engine/` → `engine/render/` + `features/` split (F7) is later work; this feature keeps `entities/Torch.ts`, `entities/Player.ts`, and `engine/Lighting.ts` where R-001/R-002 landed them and only moves the torch light half and the player light between modules.
- **Behaviour is byte-for-byte preserved.** The only sanctioned body changes are the two-loop collapse, the torch/player adapter extractions, the `playerLight` → `LightSource` widening, the dropped `worldElapsed` parameters, and the torch-light/player-light moves — never a change to gameplay, visuals, or level data.
- **No data migration.** Authored levels, markers, torch strengths, and tuning are unchanged.
- **The light list is assembled per frame, not stored.** `torchPositions` keeps its `TorchLight[]` shape (it has no time dependency); the page/editor adapt it to `LightSource[]` at the draw call site, resolving each torch's radius with the frame's `worldElapsed` and appending the held torch. No resolved radius enters a signal/store (FR-012).
- **No darkness means no light work.** The `LightSource[]` is built only when `darknessLevel > 0`, so the bright-level fast path covers the assembly and the two passes, not just the pass bodies (FR-019).
- **Layer invariants continue to hold.** `contracts/lighting.ts` is a `contracts/` leaf; `engine/` and `entities/` both depend down on it; `level/` never reaches into `engine/`; `engine/` never imports state (R-001).

## Out of Scope

- The `Renderer.ts` god-module decomposition (`STATIC_TILE_TYPES`, the `drawTerrain` signature collapse, the `SceneRenderer`/`HudRenderer` split) — **R-009**.
- The transient-effect registry, `SpeechBubble`, timed-tile state machines, and the effect draw-pass unification — **R-004/R-005**.
- Pickup unification, registry-dispatch completion, placeable world items, the static-tile registry and renderer split, mapper/editor unification, damage/bomb systems, per-domain state stores, and sprite asset/atlas organisation — **R-006–R-014**.
- New gameplay emitters themselves (glowing pickups, lava tiles, a true enemy-eye emitter); this feature ships only the abstraction that makes adding them cheap, and only migrates the two shipped lights (wall torch, player carried light).
- The `engine/` → `engine/render/` + `features/torch/` folder reorganisation (F7).
- The lint guard for layer boundaries — **R-014**.
- Any change to gameplay, balance, visuals, level data, or public behaviour.
