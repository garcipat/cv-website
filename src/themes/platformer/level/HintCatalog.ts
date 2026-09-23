import type { HintId } from '../types';

/**
 * The registered sign hints in their stable order. This is the order the old
 * `SIGN_CHARS` digits carried (`1` = `bridgeDropThrough` … `6` = `bomb`), so
 * the editor's badge code, the sign tool's cycle and the migration of a legacy
 * digit all read the same numbering. The catalog is deliberately explicit
 * rather than derived from the i18n object's key order, which is not a
 * contract (research D6). `noKeyForChest`/`noBombs` are UI messages, not sign
 * hints, so they are not part of it.
 */
export const HINT_IDS: readonly HintId[] = [
  'bridgeDropThrough',
  'ladderClimbUp',
  'fragileRockBreaksFromBelow',
  'chestNeedsKey',
  'openAllChestsHaveFun',
  'bomb',
];

/** The hint a `T` with no `sign` marker resolves to (FR-027), and the hint
 *  the sign tool paints on a fresh cell (FR-030). */
export const DEFAULT_HINT_ID: HintId = HINT_IDS[0];

/** The editor badge's short code for a hint — `'1'`–`'6'` (FR-028). */
export function hintCode(hintId: HintId): string {
  const index = HINT_IDS.indexOf(hintId);
  return String((index === -1 ? 0 : index) + 1);
}

/** The next hint in `HINT_IDS`, wrapping — the sign tool's re-click cycle
 *  (FR-030). */
export function nextHintId(hintId: HintId): HintId {
  const index = HINT_IDS.indexOf(hintId);
  return HINT_IDS[(index + 1) % HINT_IDS.length] ?? DEFAULT_HINT_ID;
}

/** Forgiving validation of a stored marker's `hintId`: true only for a
 *  registered hint (FR-027). */
export function isHintId(value: unknown): value is HintId {
  return typeof value === 'string' && (HINT_IDS as readonly string[]).includes(value);
}
