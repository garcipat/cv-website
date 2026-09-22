# Contract: the bee (`entities/enemies/Bee.ts`)

The seam's first real consumer and end-to-end validation: a flying enemy that
uses `fly`, is stompable like a green slime, and pays nothing.

## Module

```ts
export interface BeeState extends BaseEnemyState {
  type: 'bee';
}

export const bee: EnemyType<BeeState> = { /* see below */ };
```

## Sprite and animation

| Item | Value |
| --- | --- |
| Sheet | `BEE_SHEET` (`/sprites/bee.png`, already present): 192x168, 8 columns x 7 rows of 24x24 **cells** |
| Visible art | Smaller than the cell and **not bottom-anchored**: row 5 (the fly loop) measures x=3..21, y=7..18 — ~18–19 px wide, ~12 px tall, with transparent margins of ~3 px left, ~2 px right, 7 px top, 5 px bottom |
| `renderScale` | `1` → a 48 px cell, so the visible bee is ~38×24 px on screen (smaller than a slime's silhouette; may be raised after the browser check) |
| `hitboxPaddingNative` | `{ side: 7, top: 7, bottom: 5 }` — hugs the **body**, not the wing span: the full art is ~18 px wide (wings out) but the body is ~10 px wide by ~12 px tall, so the box is taller than wide (20×24 px) and the wing tips overhang; the `bottom` inset (FR-019) pulls the collision box up to the art's bottom and anchors the draw on the placement row |
| `animations.fly` | frames `[32..39]` (row 5, the neutral flight loop), `frameDuration: 0.12` |
| `animations.hit` | **not declared** — FR-009's fallback reuses `fly` during the reaction |
| `defaultAnimState` | `'fly'` (must exist in the table; asserted by the contract test) |
| Draw opacity | `draw` passes `bodyAlpha: 1` — the bee is opaque, not at the slimes' `SLIME_BODY_ALPHA` (0.78), since it has no held item to show through |

## Movement

`movement: flyMovement({ speed: 40, bobAmplitude: 6, bobPeriod: 1.4, sprite:
BEE_SPRITE, hitboxPaddingNative })` — see [fly.md](./fly.md). No chase.

## Combat (identical to a green slime)

| Contact | Outcome |
| --- | --- |
| `isInvulnerable(enemy, hitReactionSeconds)` or `hitPoints <= 0` | `{}` — harmless in every way |
| `contact.side === 'top'` while falling | `{ self: takeHit(enemy), bounceVelocity: PHYSICS_CONFIG.stompBounceVelocity }` — exactly a green slime's stomp (FR-010) |
| any other side | `{ damagePlayer: 1, knockback: 'away' }` — half a heart + knockback, opening the shared refractory window (FR-011) |

`maxHitPoints: 1`; `heldItem: null`; no `fact`. A hit bee is frozen and inert for
its reaction (FR-012) and is defeated with the shared puff, revealing nothing
(FR-013). Because `takeHit` zeroes `vx` and the loop skips `movement.step` while
`animState === 'hit'`, the bee freezes where it is; when the reaction ends it
resumes `fly` on the clock's current phase.

## Placement and progression

- Marker `q` → `enemyBee` → `BEE_TILES` → `placeBees` (plain placement, no
  fact) → `enemyPlacements` ([data-model.md](../data-model.md)).
- The bee is **not** counted by `levelTotals.enemies` or `enemiesDefeated`
  (both filter `type === 'slimeGreen'`), contributes nothing to the journal or
  any completion condition, and reveals no CV fact (FR-013/SC-008).
- The bee is **non-solid**: it never blocks the character's movement and its bob
  never affects terrain collision.

## Invariants (asserted by `Bee.test.ts` and `PlatformerPage.test.tsx`)

1. `create`/`revive` seed `animState: 'fly'`, `hitPoints: 1`, `homeX/homeY`, and
   the fly-loop stagger.
2. `box` is the visible silhouette — the render slot inset by the bee's side, top
   **and bottom** padding — so its bottom edge matches the visible art rather than the
   transparent cell bottom (FR-019/SC-009).
3. A falling top contact stomps (one hit, green-slime bounce); side/underside
   contact damages and knocks back.
4. While reacting, the bee neither takes a second hit nor damages the player.
5. Stepped through the real loop over a gap, it crosses without reversing and its
   height rises and falls in a repeating cycle.
6. A level containing bees reports the same enemies total, enemies defeated and
   completion state as the same level with the bees removed (SC-008).
