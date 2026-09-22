# Contract: adding an enemy kind (`FR-017` / `FR-018` / `SC-005` / `SC-006`)

This is the seam's whole point: after O-024, a new enemy kind needs its own
module plus a registry line, and **no edit** to the shared game loop, contact
resolution, or rendering dispatch.

## What a kind MUST declare

`EnemyType<S>` (see [movement-strategy.md](./movement-strategy.md) and
[enemy-animation.md](./enemy-animation.md)):

- `movement: MovementStrategy<S>` — an existing strategy (configured) or a new
  module. Never a branch in a shared file.
- `defaultAnimState: string` — present in the kind's own `sprite.animations`.
- Its own `sprite.animations` table (or the shared `ENEMY_ANIMATIONS` for a
  slime-like kind).

## The per-kind cost (unchanged from today, minus one field)

1. `entities/enemies/<Name>.ts` — the state interface and the `EnemyType`.
2. `entities/enemies/index.ts` — one line in `ENEMY_TYPES`.
3. `entities/sprites/sheets.ts` — a sheet registration if the art is new.
4. A level marker (only if the kind is author-placeable): `ENTITY_CHARS` +
   `EntityKind` + `TileChar` + a finder + `level.ts` computed + `EnemyMapper`
   entry + `PlatformerState` wiring + editor palette/synthesis.
5. Tests alongside the module (plus the registry/contract tests, which pick it
   up automatically).

`types.ts` is **no longer** on this list: `EnemyDef['type']` derives from
`EnemyTypeKey`, so registering the kind widens the placement union for free
(research D7).

## What MUST NOT be edited to add a kind

- `PlatformerPage.tsx`'s enemy step — it calls `typeOf(enemy).movement.step(...)`,
  `typeOf(enemy).onTick?.(...)` and `advanceEnemyAnimation(...)` and never
  branches on kind.
- `engine/Collision.ts`'s `resolveEnemyContacts` — it calls `typeOf(enemy).box`
  and `onPlayerCollide`.
- `engine/Renderer.ts`'s `drawEnemies` — it calls `typeOf(enemy).draw`.
- `engine/EnemyAI.ts`'s hit-reaction step — it reads `hitReactionSeconds` and
  `defaultAnimState` from the kind.

## Automated proof

`entities/enemies/movement/contract.test.ts`:

1. **Registry contract (SC-006 / FR-017)** — for every entry of `ENEMY_TYPES`:
   `typeof entry.movement.step === 'function'`, and
   `entry.defaultAnimState in entry.sprite.animations`.
2. **Fixture end-to-end (SC-005 / FR-018)** — build a fixture `EnemyType` with
   its own movement (the `chase` strategy) and its own animation table, then
   drive it through the shared pipeline
   (`movement.step` → `onTick` → `advanceEnemyAnimation` → `drawSpriteSheetEntity`)
   and assert it moves by its own rule and renders frames from its own table,
   while the registered slimes are untouched. The fixture is **not** added to
   `ENEMY_TYPES` — the point is that no shared file had to change for it to work.
3. **Fallback (FR-009)** — a fixture whose table omits the requested state
   resolves to its `defaultAnimState` rather than throwing or rendering blank.
