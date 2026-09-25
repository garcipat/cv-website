# Quickstart — Platformer Abstract Light Sources (R-003)

How to build, verify, and manually confirm this refactor. No new tooling, dependency, or data is
involved; the acceptance bar is **behavior preservation** (FR-016/SC-005).

## 1. Install & run

```bash
npm install        # no new dependencies — re-run only to ensure a clean tree
npm run dev        # Vite dev server; open the platformer theme
```

There is no server/API/DB (static site, [docs/Architecture.md](../../docs/Architecture.md)). The
platformer renders to a `<canvas>` in the web app.

## 2. Tests

```bash
npm test           # single run (Vitest + jsdom)
npm run test:watch # watch mode while working
```

Per [docs/TestingGuide.md](../../docs/TestingGuide.md), tests follow
`{method}-{condition}-{expected-result}` naming with `// Arrange / Act / Assert` where a section
spans more than one line. Every `engine/`, `entities/`, and `editor/` module keeps a co-located
`.test.ts`.

**Acceptance (FR-016, SC-005):** the full suite passes. Tests changed only where a signature
changed or a helper moved to its subject module (`torchLightRadius`/`torchPulseScale`/
`torchGlowStrengthAt` → `entities/Torch.test.ts`; `playerGlowStrengthAt`/`heldTorchLightPosition`
→ `entities/Player.test.ts`). None was deleted, skipped, or weakened. New adapter behavior
(`torchLightSource`, `playerLightSource`, the generic two-loop pass, the generic probe) is
TDD'd first.

## 3. Static inspection (the phase's independent checks)

One-time manual import-graph / grep checks, mirroring R-001's and R-002's convention (no new
automated boundary test).

**One light shape (SC-002):**
```bash
rg "interface LightSource" src/themes/platformer          # exactly one, in contracts/lighting.ts
rg "playerLight|torches:" src/themes/platformer           # no two-input light plumbing remains
```

**Two loops, not four (SC-001/SC-003):**
```bash
# drawDarkness must contain one punch loop and one glow loop, no per-kind blocks
rg "destination-out|lighter" src/themes/platformer/engine/Renderer.ts
```

**One home per light formula (SC-004):**
```bash
rg "torchLightRadius|torchPulseScale|torchGlowStrengthAt|TORCH_GLOW_COLOR" src/themes/platformer  # entities/Torch.ts only
rg "PLAYER_LIGHT_RADIUS_PX|PLAYER_GLOW_COLOR|PLAYER_GLOW_INTENSITY" src/themes/platformer         # entities/Player.ts only
rg "heldTorchLightPosition" src/themes/platformer                                                  # no matches (deleted)
rg "heldTorchPlacement" src/themes/platformer                                                      # Player.ts defines; Renderer.ts consumes
rg "radialFalloffAt" src/themes/platformer                                                          # shared/math.ts defines; Lighting/Torch/Player consume (one falloff, FR-010)
```

**Layer invariants (FR-017; R-001):**
```bash
# contracts/lighting.ts is a leaf (prints no import lines)
rg "from '" src/themes/platformer/contracts/lighting.ts
# no entities/ -> engine/ edge from the new light code
rg "from '.*engine/" src/themes/platformer/entities/Torch.ts src/themes/platformer/entities/Player.ts
# existing forbidden edges still absent
rg "from '(\.\./)?engine/" src/themes/platformer/level
rg "PlatformerState|from '.*state/" src/themes/platformer/engine
```

**Fog dedup not regressed (FR-014):**
```bash
rg "374761393|t \* t \* \(3 - 2 \* t\)" src/themes/platformer/engine/Lighting.ts   # must NOT match
```

**Bright-level fast path (FR-019/SC-008):**
```bash
# the light assembly + both calls sit inside a darknessLevel > 0 guard
rg -n "darknessLevel.value > 0|drawDarkness|drawEnemyEyes" src/themes/platformer/PlatformerPage.tsx
```

## 4. Manual browser pass (SC-005/SC-006)

The constitution's "changes with visible behavior must be verified by a manual browser check" rule
applies — a passing suite is not proof the game looks right. Open a cave level and confirm **no
visible difference** vs. before the refactor:

1. **Darkness + torches** — walk in/out of dark cave cells; each torch punches and warms a pool;
   torch strengths produce the same radii; flame pulse unchanged.
2. **Player carried light** — the small steady pool stays centered on the held torch; the drawn
   flame and its light stay aligned while walking and when facing left.
3. **Fog** — cave fog haze/puffing is unchanged in and around fogged cells.
4. **Enemy eyes** — markers still appear only over the darkness overlay, at the same position,
   opacity, and bob, and still vanish inside a torch pool.
5. **Bright level** — a fully lit level looks identical (and, per FR-019, does no light work).
6. **Editor dark-mode preview** — toggling dark preview still darkens a cave grid, shows the same
   torch pools and the spawn's carried light, at `t=0`; light appearance is byte-for-byte static.

## 5. Production build

```bash
npm run build
```

Must succeed with no new dependency and no bundle regression (constitution Principle V).

## 6. Completion tracking

When implementation **and** tests are fully done, update `docs/Features.md` — prefix the `R003`
node label with `✅ ` and add `class R003 done` to the dependency diagram (per
[AGENTS.md](../../AGENTS.md) feature-tracking rules). Do not commit; wait for an explicit request.
