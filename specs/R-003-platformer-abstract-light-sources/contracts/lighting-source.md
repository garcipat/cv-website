# Contract — `LightSource` and its adapters

**Feature**: R-003 | **Date**: 2026-09-25
**Layer**: `LightSource` is in `contracts/lighting.ts` (a strict leaf). The adapters are in
`entities/Torch.ts` and `entities/Player.ts`.

This is the interface contract the spec's FR-001…FR-004 / FR-011 / SC-002 / SC-004 define. It is
the single way a light is described in the platformer theme; the darkness pass, the local-darkness
probe, and the enemy-eye pass all consume it, and adding a third emitter is data, not a new code
path (SC-003).

---

## 1. `LightSource` (in `contracts/lighting.ts`)

```ts
export interface LightSource {
  x: number;
  y: number;
  radius: number;
  color: string;       // 'rgb(r, g, b)'
  intensity: number;
  glowMidAlpha: number;
  punchHole: boolean;
}
```

**Imports**: none. `contracts/lighting.ts` imports nothing from `engine/`, `entities/`, `level/`,
state, `shared/`, or the app pages (FR-011; R-001 FR-002). It is type-only and erased at build.

| Field | Must hold |
| --- | --- |
| `x`, `y` | World-space centre in rendered pixels, matching the draw passes' coordinate space. |
| `radius` | A resolved number ≥ 0, computed by the adapter at the caller's `worldElapsed`; not a function (FR-002). |
| `color` | Opaque `rgb(r, g, b)`; the pass derives `rgba(r, g, b, α)` stops from it, so the exact base stop is preserved. |
| `intensity` | Overall glow `globalAlpha` multiplier only; does not alter the gradient stops (FR-001). |
| `glowMidAlpha` | The alpha of the `0.55` gradient stop; per-light so one glow loop reproduces each gradient (FR-006). |
| `punchHole` | `true` → the punch loop erases darkness; `false` → glow-only, but still illuminates `localDarknessAt` (Story 1 scenario 5). |

**One definition**: `LightSource` is exported exactly once; no module re-declares or shadows it.

---

## 2. Torch adapter (in `entities/Torch.ts`) — FR-003

```ts
export function torchLightSource(torch: TorchLight, worldElapsed: number): LightSource
```

| Output field | Value | Preserved from |
| --- | --- | --- |
| `x`, `y` | `torch.x`, `torch.y` | `TorchLight` |
| `radius` | `torchLightRadius(torch, worldElapsed)` = `TORCH_LIGHT_RADIUS_PX × torchLightScale(strength) × torchPulseScale(torch, t)` | byte-identical to today's `torchLightRadius` |
| `color` | `TORCH_GLOW_COLOR` = `'rgb(255, 176, 74)'` | base glow stop |
| `intensity` | `1` | torch glow `globalAlpha = darknessLevel` |
| `glowMidAlpha` | `0.35` | `rgba(255, 176, 74, 0.35)` mid stop |
| `punchHole` | `true` | torch holes erase darkness |

`entities/Torch.ts` exports `TorchLight` (`col`, `row`, `x`, `y`, `strength`), the torch light
constants (`TORCH_LIGHT_RADIUS_PX`, `TORCH_PULSE_AMPLITUDE`, `TORCH_PULSE_PERIOD_SECONDS`,
`TORCH_GLOW_COLOR`), and the helpers (`torchPulseScale`, `torchLightRadius`, `torchGlowStrengthAt`)
moved from `engine/Lighting.ts` (X5); `torchGlowStrengthAt` delegates to `shared/math.ts`'s
`radialFalloffAt` rather than re-inlining the falloff. It must reach only `shared/math.ts` plus
`contracts/lighting.ts` — no `level/` or `engine/` edge (FR-017; Story 3 scenario 4).

---

## 3. Player adapter (in `entities/Player.ts`) — FR-004

```ts
export function playerLightSource(player: PlayerState): LightSource

export function heldTorchPlacement(
  player: PlayerState,
): { centerX: number; topY: number; width: number; height: number }
```

| Output field | Value | Preserved from |
| --- | --- | --- |
| `x` | `heldTorchPlacement(player).centerX` | `heldTorchLightPosition(player).x` |
| `y` | `topY + height / 2` | `heldTorchLightPosition(player).y` |
| `radius` | `PLAYER_LIGHT_RADIUS_PX` | current player light radius |
| `color` | `PLAYER_GLOW_COLOR` = `'rgb(255, 145, 45)'` | base glow stop |
| `intensity` | `PLAYER_GLOW_INTENSITY` = `0.7` | player glow `globalAlpha = darknessLevel × 0.7` |
| `glowMidAlpha` | `0.3` | `rgba(255, 145, 45, 0.3)` mid stop |
| `punchHole` | `true` | player holes erase darkness |

`heldTorchPlacement` mirrors with `player.direction` and owns the held-torch offsets/scale
(`HELD_TORCH_SCALE`, `HELD_TORCH_OFFSET_X`, `HELD_TORCH_OFFSET_Y`) moved from `engine/Renderer.ts`.
`engine/Renderer.ts`'s `drawHeldTorch` **must** consume this helper so the drawn flame and its
light share one geometry and cannot drift (SC-007). `heldTorchLightPosition` is deleted.

---

## 4. Adapter invariants

1. **Pure and total** — adapters are pure functions of their arguments; no I/O, React, signals, or
   `Math.random`; never throw for valid input.
2. **Time stays in the adapter** — `radius` is resolved at the caller's `worldElapsed`; the type
   and the passes carry no time (FR-002/FR-005/FR-007).
3. **Behavior preservation** — for the two shipped kinds, every output field equals the pre-refactor
   values (torch: Story 2 scenario 1; player: Story 2 scenario 2), and the drawn result is
   unchanged (Story 2 scenario 3).
4. **Import direction** — `entities/` implements the contract; it never imports `engine/`
   (R-001). `engine/` and the app/editor layers depend down on the adapters.
5. **No re-declaration** — the light vocabulary lives only in `contracts/lighting.ts`; adapters
   import the type rather than redeclaring its shape.

---

## 5. Verification (one-time inspection, mirrors R-001/R-002)

```powershell
# exactly one LightSource definition, in contracts/lighting.ts
rg "interface LightSource" src/themes/platformer

# no leftover torch/player light plumbing in engine/
rg "heldTorchLightPosition|playerGlowStrengthAt|torchGlowStrengthAt|PLAYER_LIGHT_RADIUS_PX|TorchLight" src/themes/platformer/engine

# contracts/lighting.ts imports nothing upward
rg "from '" src/themes/platformer/contracts/lighting.ts   # must print no import lines
```

See [quickstart.md](../quickstart.md) §3 for the full command set and interpretation.
