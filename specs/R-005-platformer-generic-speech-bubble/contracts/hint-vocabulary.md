# Contract: Hint Vocabulary

**Feature**: R-005 | **Module home**: `src/themes/platformer/level/HintCatalog.ts`

This is the internal public API of the one hint/sign vocabulary module. Consumers are
`level/LevelData.ts`, `level/LevelParser.ts`, `level/SignMapper.ts`, `engine/Collision.ts`,
`engine/effects/speechBubble.ts` (type-only), `editor/gridRenderState.ts`, `editor/paintMarkerCell.ts`,
`editor/EditorCanvas.tsx`, `PlatformerPage.tsx`, `types.ts` (no longer), and the tests. All signatures
are TypeScript (strict, no `any`).

---

## Types

```ts
import type { Translation } from '@/i18n/translations';

/** The keys of the shipped platformer hint messages. */
type PlatformerHintKey = keyof Translation['platformer']['hints'];

/** The six hints a hand-authored sign may carry, in stable order (codes 1–6). */
const SIGN_HINT_IDS = [
  'bridgeDropThrough',
  'ladderClimbUp',
  'fragileRockBreaksFromBelow',
  'chestNeedsKey',
  'openAllChestsHaveFun',
  'bomb',
] as const satisfies readonly PlatformerHintKey[];

export type SignHintId = (typeof SIGN_HINT_IDS)[number];

/** Every message a bubble may display — the sign hints plus the UI-only messages. */
export type BubbleMessageId = PlatformerHintKey;
// = SignHintId | 'noKeyForChest' | 'noBombs'

/** A hand-authored hint sign. */
export interface SignDef {
  id: string;
  hintId: SignHintId;
}
```

`SignHintId` is derived from an `as const satisfies readonly PlatformerHintKey[]` tuple, so every sign
hint is compile-time-linked to a real i18n key and `noKeyForChest`/`noBombs` are excluded. The
`Translation` import is **type-only** (erased at build time); it is the same app-level i18n type the
root `types.ts` imported before this feature, now sourced from the vocabulary's own home.

## Catalog & helpers

```ts
export const HINT_IDS: readonly SignHintId[];
export const DEFAULT_HINT_ID: SignHintId;          // HINT_IDS[0]

export function hintCode(hintId: SignHintId): string;          // '1'..'6'
export function nextHintId(hintId: SignHintId): SignHintId;    // wrapping
export function isSignHintId(value: unknown): value is SignHintId;
```

## Guarantees

1. `HINT_IDS` yields the six sign hints in their current order; `hintCode` yields `'1'`–`'6'`;
   `nextHintId` wraps (FR-009).
2. `isSignHintId('noKeyForChest') === false` and `isSignHintId('noBombs') === false` — they are
   bubble-only messages (FR-007/FR-009).
3. A `SignHintId` is assignable to `BubbleMessageId`; the reverse does not type-check (FR-007).
4. A sign's `hintId` is a `SignHintId`; a bubble's `messageId` is a `BubbleMessageId` (FR-007).
5. The module imports only the app's `Translation` type (type-only) — no platformer module, no state.

## Invariants

- This is the **only** declaration site of `SignHintId`, `BubbleMessageId`, `HINT_IDS`,
  `DEFAULT_HINT_ID`, `hintCode`, `nextHintId`, `isSignHintId`, and `SignDef`; the root `types.ts`
  declares none of them (FR-008).
- No `isHintId` alias and no mixed `HintId` union survives (FR-017/SC-001).
- It never creates a `contracts/ → level/` edge: `contracts/Outcome.ts` imports the root `types.ts`,
  which (after `SignDef` moves here) no longer imports `level/` (FR-008/SC-007).
- The shipped level, markers, editor codes, and translations are unchanged (FR-009).
