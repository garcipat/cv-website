import type { Translation } from '@/i18n/translations';

/**
 * The keys of the shipped platformer hint messages.
 */
type PlatformerHintKey = keyof Translation['platformer']['hints'];

/**
 * The six hints a hand-authored sign may carry, in their stable order. This is
 * the order the old `SIGN_CHARS` digits carried (`1` = `bridgeDropThrough` …
 * `6` = `bomb`), so the editor's badge code, the sign tool's cycle and the
 * migration of a legacy digit all read the same numbering. The catalog is
 * deliberately explicit rather than derived from the i18n object's key order,
 * which is not a contract. `noKeyForChest`/`noBombs` are UI messages, not sign
 * hints, so they are not part of it.
 *
 * Declared as `as const satisfies readonly PlatformerHintKey[]` so every sign
 * hint is compile-time-linked to a real i18n key.
 */
const SIGN_HINT_IDS = [
  'bridgeDropThrough',
  'ladderClimbUp',
  'fragileRockBreaksFromBelow',
  'chestNeedsKey',
  'openAllChestsHaveFun',
  'bomb',
] as const satisfies readonly PlatformerHintKey[];

/** The hints a hand-authored sign may carry (FR-007). */
export type SignHintId = (typeof SIGN_HINT_IDS)[number];

/** Every message a bubble may display — the sign hints plus the UI-only
 *  messages (`noKeyForChest`/`noBombs`) (FR-007). */
export type BubbleMessageId = PlatformerHintKey;

/**
 * The registered sign hints in their stable order (codes `1`–`6`). This is the
 * order the old `SIGN_CHARS` digits carried, so badge codes and legacy
 * migration agree.
 */
export const HINT_IDS: readonly SignHintId[] = SIGN_HINT_IDS;

/** The hint a `T` with no `sign` marker resolves to (FR-027), and the hint
 *  the sign tool paints on a fresh cell (FR-030). */
export const DEFAULT_HINT_ID: SignHintId = HINT_IDS[0];

/** The editor badge's short code for a hint — `'1'`–`'6'` (FR-028). */
export function hintCode(hintId: SignHintId): string {
  const index = HINT_IDS.indexOf(hintId);
  return String((index === -1 ? 0 : index) + 1);
}

/** The next hint in `HINT_IDS`, wrapping — the sign tool's re-click cycle
 *  (FR-030). */
export function nextHintId(hintId: SignHintId): SignHintId {
  const index = HINT_IDS.indexOf(hintId);
  return HINT_IDS[(index + 1) % HINT_IDS.length] ?? DEFAULT_HINT_ID;
}

/** Forgiving validation of a stored marker's `hintId`: true only for a
 *  registered sign hint (FR-027); rejects the UI-only messages. */
export function isSignHintId(value: unknown): value is SignHintId {
  return typeof value === 'string' && (HINT_IDS as readonly string[]).includes(value);
}

/**
 * A hand-authored hint sign (spec.md FR-037). Unlike EnemyDef/BlockDef/
 * ChestDef, a sign carries no CV mapping at all — no `fact`, no
 * `cvSection`/`cvIndex` — its only content is `hintId`, which
 * `SignMapper.ts`'s `placeSigns` turns into a `SignPlacement` (adds x/y),
 * mirroring every other Def/Placement pair in this codebase.
 */
export interface SignDef {
  id: string;
  hintId: SignHintId;
}
