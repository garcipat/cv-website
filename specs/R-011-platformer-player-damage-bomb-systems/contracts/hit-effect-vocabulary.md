# Contract — Hit-Effect Vocabulary

**Feature**: `R-011-platformer-player-damage-bombs` | **Spec**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

Normative form of spec FR-001/FR-002/FR-010 and data-model §1–§2. Module:
`src/themes/platformer/contracts/HitEffect.ts` (NEW) — a strict `contracts/` leaf.

---

## 1. Exported type

```ts
export type HitEffect =
  | { readonly type: 'damage'; readonly amount: number }
  | {
      readonly type: 'velocity';
      readonly x?: number; // signed px/s; also sets facing
      readonly y?: number; // px/s, negative = up
      readonly duration?: number; // seconds of input override (knockbackTimer)
      readonly preserveJump?: boolean; // apply bounceAscending
    }
  | { readonly type: 'reaction'; readonly blinkOnly?: boolean };
```

No `Impact` container, no `ImpactSource`, no `SplatterVariant`, no `HitAnchor`. A hit is
`readonly HitEffect[]`.

## 2. Rules

1. **Primitives, not use-cases.** Members name mechanics only. Forbidden as members: `awayAndUp`,
   `splatter`/`variant`, `hit`/`destroy`, `lethal`, `knockback`. A `damage{amount: currentHitPoints}`
   at an unguarded site expresses the spear; a signed `velocity.x` expresses `away`/`awayAndUp`; a
   block takes `damage` (amount = hits).
2. **Independence.** Any subset in any order: damage-only, velocity-only (no damage), reaction-only.
3. **Order is application order.** The resolver folds left to right.
4. **Immutability.** Every member is `readonly`; the resolver never mutates input.
5. **Leaf safety.** Imports sibling `contracts/` types only (currently none) — never
   `engine/`/`entities/`/`level/`/`tiles/`/`state/`.
6. **Visual-neutral.** No visual is a member; visuals ride R-004 (FR-008).
7. **No source branch.** The resolver dispatches on the _member type_, never on a source string.

## 3. Member reference

| Member                                          | Meaning                          | Family semantics                                                                                                 | Replaces                                  |
| ----------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------- |
| `damage { amount }`                             | Reduce health (block: hit count) | player `takeDamage` + `alive`; enemy `takeHit`×amount + `onDamaged`; block `applyBlockHit`×amount, saturating    | `damagePlayer`, `hit`/`destroy`, `lethal` |
| `velocity { x?, y?, duration?, preserveJump? }` | A signed impulse                 | player sets `vx`+facing / `vy` / `knockbackTimer` / `bounceAscending`; others ignore                             | `knockback{away                           | awayAndUp}`, `push`, `lift`, `bounceVelocity` |
| `reaction { blinkOnly? }`                       | Enter the hurt state             | player: `applyHitReaction` (or `beginPitFallReaction` when `blinkOnly`); enemy: entered by `takeHit`; block: n/a | `reaction{kind:'hit'                      | 'pit'}`                                       |

## 4. Adding a primitive or source (extension contract — US5)

- **New source**: build a `HitEffect[]` (`damage`/`velocity`/`reaction`) at the emitting site and pass
  it to `resolveHitEffects`; spawn any visual via R-004. No shared union to edit.
- **New primitive**: add one union member here + one handler per family that understands it (a family
  ignores members it does not). No page hit-site edit.
- **New visual**: add an R-004 effect and spawn it; the vocabulary is untouched.

## 5. Kind-facing reconciliation (`contracts/Outcome.ts`)

```ts
export interface PlayerEffects {
  readonly effects?: readonly HitEffect[];
}
export interface CollisionOutcome extends PlayerEffects {
  readonly selfEffects?: readonly HitEffect[];
}
export type BlockHitOutcome = PlayerEffects & RewardEffects;
```

- `self?: S` is **removed**; `selfEffects` carries an enemy-side hit.
- `CollisionOutcome` is not generic (the entity-typed field is gone).
- `Contact` gains `awayDirection: -1 | 1` (the engine's player-centre-vs-self-centre sign) so a kind
  builds a concrete signed `velocity.x`.
- `RewardEffects`/`DefeatApi` unchanged.

## 6. Guard checks

`engine/hitStructure.test.ts` asserts: `contracts/HitEffect.ts` declares the union exactly once and
only the three primitives; `contracts/Outcome.ts` declares no
`damagePlayer`/`knockback`/`bounceVelocity`/`self`; no kind module returns `self` or imports
`takeHit`/`applyEnemyDamage`; `HitEffect.ts` has no forbidden import.

> **Permitted engine aggregates.** `engine/Collision.ts`'s `EnemyContactResult`/`HazardContactResult`
> are resolved-contact results the engine computes, not a kind-facing vocabulary. `EnemyContactResult`
> MAY carry the aggregated `bounceEffects`/`hitEffects: HitEffect[]` plus scalar
> `knockbackDirection` for splatter anchoring.
