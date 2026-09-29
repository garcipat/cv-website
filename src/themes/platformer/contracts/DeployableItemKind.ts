/**
 * The deployable-item kind vocabulary — the level's player-affected
 * low-count objects (`bomb`, `ladder`, `chest`). Spelled out here (not
 * derived from `entities/deployableItems/index.ts`'s registry) so this file
 * stays a strict `contracts/` leaf that imports nothing, exactly like
 * `PickupKind.ts`. `DEPLOYABLE_ITEM_TYPES` conforms to this union via a
 * `Record<DeployableItemKind, …>` annotation, so a kind added to one side
 * without the other fails to compile.
 */
export type DeployableItemKind = 'bomb' | 'ladder' | 'chest';
