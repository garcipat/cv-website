import {
  isSolid,
  isSolidExcludingBridge,
  isStandableLadderTop,
  isStandableLadderBundleTop,
  isStandableMushroomCap,
  tileAt,
} from '../level/Terrain';
import { isBlockOccupied } from '../level/BlockMapper';
import type { BlockPlacement } from '../level/BlockMapper';
import { isCrumblingFloorBroken } from './CrumblingFloor';
import type { CrumblingFloorTimerState } from './CrumblingFloor';
import type { LevelDef } from '../level/LevelData';

export interface StandableOptions {
  /** Treat a `bridge` tile as passable (not ground), matching `Physics.ts`'s
   *  active drop-through state. Omitted, a bridge stops a fall like any other
   *  solid (O-027 FR-008). */
  excludeBridge?: boolean;
}

/**
 * Whether the player could stand on the tile at `(col, row)` — the single
 * shared definition of "a landing solid" (O-027 FR-008/FR-003). Composed of
 * exactly the union `engine/Physics.ts`'s ground branch computes:
 *
 * - terrain `isSolid` (with `crumblingFloor` solid only while at rest or
 *   cracking, and `bridge` excludable via `excludeBridge`)
 * - `isStandableLadderTop`
 * - `isStandableLadderBundleTop`
 * - `isStandableMushroomCap`
 * - `isBlockOccupied`
 *
 * `Physics.ts` delegates here with `{ excludeBridge: droppingThroughBridge }`
 * so its behavior is unchanged; a falling stalactite calls it with no options,
 * so a bridge always stops it.
 */
export function isStandableCell(
  level: LevelDef,
  blocks: readonly BlockPlacement[],
  crumblingFloorStates: readonly CrumblingFloorTimerState[],
  col: number,
  row: number,
  options: StandableOptions = {},
): boolean {
  const tile = tileAt(level, col, row);
  const baseCheck = options.excludeBridge ? isSolidExcludingBridge : isSolid;
  const tileIsGround =
    tile === 'crumblingFloor' ? !isCrumblingFloorBroken(crumblingFloorStates, col, row) : baseCheck(tile);
  return (
    tileIsGround ||
    isStandableLadderTop(level, col, row) ||
    isStandableLadderBundleTop(level, col, row) ||
    isStandableMushroomCap(level, col, row) ||
    isBlockOccupied(blocks, col, row)
  );
}

/**
 * A caller's "solid for this kind of falling thing" rule, given the level, a
 * column and a row. Each falling item supplies its own rule (the stalactite's
 * `isStandableCell`, the bomb's ground-or-block test, the ladder's plain
 * `isSolid`) so `findLandingRow` never hardcodes one.
 */
export type LandingSolidPredicate = (level: LevelDef, col: number, row: number) => boolean;

/**
 * The first row strictly below `fromRow` (`fromRow + 1 … level.height - 1`)
 * at which `isSolidForKind` is true, or `null` when no such row exists before
 * the level's bottom. The single home of the downward landing scan shared by
 * the falling stalactite, placed bomb, and deployable ladder (FR-007/FR-008).
 *
 * The predicate captures the caller's live blocks/crumbling-floor state via
 * closure; the off-by-one mapping (stalactite returns the row itself, the
 * bomb/ladder return `row - 1`) stays with each caller.
 */
export function findLandingRow(
  level: LevelDef,
  col: number,
  fromRow: number,
  isSolidForKind: LandingSolidPredicate,
): number | null {
  for (let row = fromRow + 1; row < level.height; row++) {
    if (isSolidForKind(level, col, row)) return row;
  }
  return null;
}
