# Contract — Bomb System

**Feature**: `R-011-platformer-player-damage-bombs` | **Spec**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

Normative form of spec FR-011…FR-013 and data-model §4. Module:
`src/themes/platformer/engine/BombSystem.ts` (MODIFIED) — an `engine/` module. It consumes the shipped
R-008 contracts unchanged (`BlastRequest`,
`applyDeployableItemConsequences`) and the geometry in `engine/Blast.ts`.

---

## 1. Signature

```ts
export interface BlastWorld {
  readonly level: LevelDef;
  readonly player: PlayerState; // the tick-local post-physics value
  readonly blocks: readonly BlockState[];
  readonly enemies: readonly EnemyState[];
}

export interface BlastDelta {
  readonly blocks: readonly BlockState[];
  readonly terminalBlockIds: readonly string[];
  readonly enemies: readonly EnemyState[];
  readonly damagedEnemyIds: readonly string[];
  readonly playerEffects?: readonly HitEffect[];
  readonly playerSplatter?: { readonly side: -1 | 0 | 1; readonly id: string };
  readonly explosions: readonly { id: string; x: number; y: number }[];
}

export function resolveBlasts(blasts: readonly BlastRequest[], world: BlastWorld): BlastDelta;
```

No `originX`/`originY`: the page anchors the splatter (data-model §6).

## 2. Resolution order (per today's inline loop)

For each `blast` in order:

1. `blastTiles(blast.col, blast.row, level.width, level.height)` (`engine/Blast.ts`).
2. **Blocks**: `blocksInBlast`; for each, `resolveHitEffects(block, [{ damage, amount:
BLOCK_TYPES[kind].maxHits }])` (drives to terminal); collect `terminalBlockIds` (deduped across
   overlapping blasts).
3. **Enemies**: `enemiesInBlast`; for each, `resolveHitEffects(enemy, [{ damage: BOMB_DAMAGE },
{ reaction }])`; collect `damagedEnemyIds`.
4. **Player** (at most once across all blasts): if no `playerEffects` yet and the player is not
   invulnerable and `playerInBlast(...)`, build `[damage BOMB_DAMAGE, reaction, velocity(away from
blast centre) unless crouching]`; set `playerSplatter = { side, id: blast.hitEffectId }` only when
   `player.hitPoints > BOMB_DAMAGE` (survives); latch.
5. **Explosion**: push `{ id: blast.effectId, x: blast.x + tile/2, y: blast.y + tile/2 }` — always.

## 3. Page apply contract

1. `blockStates.value = delta.blocks`; `resolveBlockTerminalOutcome(block, outcome)` for each
   `terminalBlockIds` (the page re-runs the block adapter to obtain `outcome`, unchanged applier).
2. `enemyStates.value = delta.enemies`; feed `damagedEnemyIds` into the enemy splatter loop
   (unchanged). **Parity note**: the shipped blast never spawned an enemy splatter (the splatter loop
   runs for contacts before the blast pass), so `damagedEnemyIds` is recorded but not consumed for
   splatter.
3. If `delta.playerEffects`: `next = resolveHitEffects(next, delta.playerEffects).player`.
4. If `delta.playerSplatter`: build with `playerEffectAnchor(next, originX, originY, 'center')` and
   `spawnEffect(startPlayerHitSplatter(id, x, y, side))`.
5. Spawn each `delta.explosions` via `startExplosionEffect(id, x, y)`.

## 4. Invariants

1. Never re-owns fuse/detonation/drop-out (FR-012).
2. Writes no signal, imports no `state/` (FR-014); returns data.
3. Geometry byte-identical (rounded 5×5-minus-corners, bounds-clipped, no line-of-sight).
4. Block destruction identical to a bump (same `applyBlockHit` path + terminal applier).
5. Enemy damage via the shared pipeline; defeats still paid by `applyEnemyDefeats`.
6. At most one player effect list per tick, honouring invulnerability and crouch; the splatter is
   returned only when the hit survives.
7. A second placed bomb and a question-mark in the blast are untouched.

## 5. Guard checks

`engine/hitStructure.test.ts` asserts the page contains no `blastTiles`/`blocksInBlast`/
`enemiesInBlast`/`playerInBlast`/`BOMB_DAMAGE` reference and no blast loop, and that `BombSystem`
consumes `BlastRequest` (no fuse constant).
