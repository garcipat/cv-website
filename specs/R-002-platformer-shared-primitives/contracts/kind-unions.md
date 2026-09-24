# Contract — Kind-union derivation (FR-016 / FR-017)

## Goal

`HazardKind` and `BlockKind` must be **derived from their registries**, matching how enemies already
do it (`EnemyTypeKey = keyof typeof ENEMY_TYPES`), so adding a kind is one registry line with no
parallel hand-edited list.

## Hazard union

```ts
// entities/hazards/index.ts
export const HAZARD_TYPES = { spike, spear, floorSpike, fallingStalactite };
export type HazardKind = keyof typeof HAZARD_TYPES;   // single canonical name
```

`level/LevelParser.ts` imports `HazardKind` (no longer re-declares the union) and types
`HAZARD_CHARS` against it:

```ts
export const HAZARD_CHARS: Record<string, { hazardType: HazardKind; facing: HazardFacing } | undefined>;
```

The existing `HazardTypeKey` alias is consolidated to `HazardKind` (FR-023: exactly one home).

## Block union

```ts
// entities/blocks/index.ts
export const BLOCK_TYPES = { crate, questionMark, fragileRock, coinPot, potionPot, bombPot };
export type BlockKind = keyof typeof BLOCK_TYPES;
```

`entities/Block.ts` and `types.ts`'s `BlockDef.blockKind` import `BlockKind` (no longer re-declare it).

## Invariants

1. **Derived, not duplicated** — the union is `keyof typeof <REGISTRY>`; there is no separate
   hand-written list.
2. **Exhaustive by construction** — an unhandled kind is a compile error, not a runtime miss
   (spec SC-005, edge case).
3. **Direction of dependency** — the union lives with the registry (`entities/hazards/`,
   `entities/blocks/`), not in `contracts/`; `contracts/` stays a leaf. `level/LevelParser.ts` and
   `types.ts` already import from `entities/`, so no new layer edge is created.
