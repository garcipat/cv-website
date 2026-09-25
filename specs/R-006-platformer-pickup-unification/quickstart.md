# Quickstart — Platformer Pickup Unification (R-006)

How to build, verify, and manually confirm this refactor. No new tooling, dependency, or data is
involved; the acceptance bar is **behaviour preservation** with **one collect-once mechanism**
(`collected` on the shared `Pickup` model — SC-008).

## 1. Install & run

```bash
npm install        # no new dependencies — re-run only to ensure a clean tree
npm run dev        # Vite dev server; open the platformer theme
```

There is no server/API/DB (static site, [docs/Architecture.md](../../docs/Architecture.md)). The
platformer renders to a `<canvas>` in the web app.

## 2. Tests

```bash
npm test             # single run (Vitest + jsdom)
npm run test:watch   # watch mode while working
npm run build        # production build must succeed (FR-010/SC-004)
```

Per [docs/TestingGuide.md](../../docs/TestingGuide.md), tests follow
`{method}-{condition}-{expected-result}` naming with `// Arrange / Act / Assert` where a section spans
more than one line. Every `engine/`, `entities/`, and `level/` module carries a co-located `.test.ts`.

**Acceptance (FR-010/SC-004/SC-008):** the full suite passes with the production build. Existing tests
were relocated and re-expressed around the generic API and the flag-based collection storage only —
never deleted, skipped or weakened. The two restructured suites are `engine/Collision.test.ts` (five
family describes → `checkPickupCollisions`) and `engine/Renderer.test.ts` (five draw-wrapper describes
→ `drawPickups`); the coin-dedup and reset-scope scenarios in `PlatformerState.test.ts` /
`PlatformerPage.test.tsx` legitimately change shape (an entry retained + flagged instead of an id set)
while every scenario, gate and reset scope stays asserted. See the plan's "Test Migration &
Restructuring".

## 3. Static inspection (the feature's independent tests)

These are one-time manual import-graph / grep checks, mirroring R-001/R-002's "one-time manual import
inspection" convention (no new automated boundary test).

**One collision path and one draw path (SC-001):**
```bash
rg "checkCollectibleCollisions|checkFruitCollisions|checkKeyPickupCollisions|checkHeartPickupCollisions|checkBombPickupCollisions" src/themes/platformer   # no matches
rg "drawCollectibles|drawFruits|drawKeyPickups|drawHeartPickups|drawBombPickups" src/themes/platformer                                                   # no matches
rg "checkPickupCollisions" src/themes/platformer   # defined once (engine/Collision.ts) + call sites
rg "drawPickups" src/themes/platformer             # defined once (engine/Renderer.ts) + page + editor
```

**One collect-once mechanism (SC-008):**
```bash
rg "collectedCollectibleIds" src/themes/platformer          # no matches (deleted)
rg "PickupDisposition|'remove' \| 'flag'|disposition" src/themes/platformer   # no matches (deleted vocabulary)
rg "markCollected" src/themes/platformer                    # the shared applier's one collect-once action
rg "\.filter\(.*!hit" src/themes/platformer                 # no per-kind removal on collect
```

**The page names no pickup kind (SC-001/SC-002):**
```bash
rg "=== '(coin|fruit|key|heart|bomb)'|=== \"(coin|fruit|key|heart|bomb)\"" src/themes/platformer/PlatformerPage.tsx   # no matches
```

**One module per family; no top-level state modules (SC-003):**
```bash
# no pickup state module remains directly under entities/
ls src/themes/platformer/entities/{Fruit,Coin,KeyPickup,HeartPickup,BombPickup}.ts   # must not exist
ls src/themes/platformer/entities/pickups/{Coin,Fruit,Key,Heart,Bomb}.ts             # each exists
ls src/themes/platformer/entities/{Health,Torch}.ts                                  # unchanged, still here
rg "spriteType" src/themes/platformer                                                # no matches (renamed to kind)
```

**The live fruit kind is intact (the documented deviation, FR-006/US4):**
```bash
rg "'fruit'" src/themes/platformer/contracts/PickupKind.ts        # still present
rg "spawnPickup" src/themes/platformer/entities/blocks src/themes/platformer/contracts/Outcome.ts   # 'fruit' still reachable
```

**Contracts stays a leaf (SC-007):**
```bash
rg "from '\.\./(engine|entities|level)/|from '\.\./\.\./(engine|entities|level)/" src/themes/platformer/contracts   # no matches
```

**Keys equal their registry slot (SC-002):**
```bash
npm test -- entities/pickups/index.test.ts
```

## 4. Manual browser pass (SC-005 — required by the constitution)

Visible behaviour is unchanged, so a passing suite is not sufficient. In the running theme:

1. Collect a placed coin — the spin/bob frame, the coins HUD popup and the journal skill-fact reveal
   are as before; the coin stays in the world flagged collected (not re-collected).
2. Defeat a purple slime — the dropped key bobs, the "Key" flying text flies to the HUD key counter,
   the key stays flagged (not re-collected), and the counter increments once.
3. Break a potion-pot — the heart bobs; collect it at reduced health (heals) and confirm at full
   health it stays in the world.
4. Break a bomb-pot — collect a dropped bomb below the cap (banked); confirm at the cap it stays in
   the world, still bobbing.
5. Hit a question-mark block — the fruit rises from behind its block, becomes touchable only once
   risen, reveals its fact on touch, and is flagged collected (retained, not re-collectible). Confirm
   it is drawn **before** the block (occluded mid-rise) and that placed coins still draw in front of /
   behind enemies exactly as before.
6. Die and respawn — dropped hearts and bombs are cleared, while fruits, keys and **collected coin
   flags** persist.
7. Use Reset Game — every pickup array is cleared and the placed coins reappear uncollected (their
   `collected` flags re-derived to `false`); no collected-id set exists.
8. Open the level editor preview — coins preview as before (synthesized placements all
   `collected: false`).

## 5. Expected outcome

No gameplay, tuning, visual, level-data or translation difference; the only changes are that the
engine dispatches pickups generically, each family lives in one module, and collect-once is the single
`collected` flag on the shared `Pickup` model (with permanence expressed only by array reset scope).
The build and full test suite are green, and `docs/Features.md`'s dependency diagram is updated once
implementation and tests are done.
