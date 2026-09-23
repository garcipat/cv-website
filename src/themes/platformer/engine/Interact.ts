/**
 * One interact-key-triggered candidate kind — a ladder bundle, a chest, a
 * door, a sign. `findCandidate`/`applyInteract` close over whatever live
 * state and position that kind needs (PlatformerPage.tsx builds a fresh
 * array of these each tick); this module knows nothing about what any kind
 * actually is. See design.md's "applyInteract: one dispatch, not a fourth
 * hand-written block".
 */
export interface Interactable {
  kind: string;
  /** Returns the id of the thing the player could interact with right now,
   *  or null. Read-only — must not itself change any state. */
  findCandidate(): string | null;
  /** Applies this kind's own one-shot effect for the given candidate. */
  applyInteract(candidateId: string): void;
}

/**
 * Tries each interactable in order and applies the FIRST one with a
 * candidate, then stops — a direct data-driven replacement for a chain of
 * `if (interactPressed && !alreadyHandled) { ... }` blocks. Order is the
 * caller's priority list (PlatformerPage.tsx: ladder bundle, door, chest,
 * sign — see design.md). Returns whether anything was applied, so a caller
 * that needs to know (none currently do, but O-011's `bundleDeployedThisTick`
 * shows the shape) can react.
 */
export function applyInteract(interactables: readonly Interactable[]): boolean {
  for (const interactable of interactables) {
    const candidateId = interactable.findCandidate();
    if (candidateId !== null) {
      interactable.applyInteract(candidateId);
      return true;
    }
  }
  return false;
}
