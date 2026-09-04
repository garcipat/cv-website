import { collectedFacts, activeEffects, activeCounterPopups, levelTotals } from '../PlatformerState';
import { startFlightEffect, startCounterPopup } from './CollectionEffects';
import { countCollectedFor } from '../entities/CollectiblesSummary';
import type { CounterPopupLabelKey, SlotAllocator } from './CollectionEffects';
import { formatJournalEntry } from '../entities/JournalEntry';
import type { CollectedFact } from '../types';

/**
 * Everything a tick's reveals share: this frame's world-to-screen origin, the
 * canvas size, where the journal button currently is, and how many fact-flight
 * effects are still in the air from previous ticks.
 */
export interface RevealContext {
  originX: number;
  originY: number;
  canvasWidth: number;
  canvasHeight: number;
  /** The journal button's screen rect, or null when it hasn't mounted yet —
   *  the flight then targets the bottom-right corner instead. */
  journalRect: DOMRect | null;
  /** This tick's collection-text slot allocator (see `createSlotAllocator`).
   *  Passed in rather than built here because it is SHARED with the key
   *  pickup, which is outside this trigger: one counter across every
   *  flight-text site is what keeps two texts in the same tick off the same
   *  row. */
  allocateSlotOffset: SlotAllocator;
}

export interface RevealOptions {
  /** The revealing entity's world-space position. */
  x: number;
  y: number;
  /** Unique id for the flight effect — usually the entity's own id, but a
   *  coin revealing more than one fact needs one per fact. */
  effectId: string;
  /**
   * Which HUD counter popup to bump, or omitted for a reveal that bumps none.
   * Typed against `CounterPopupLabelKey` (which deliberately has no
   * `'chests'`) rather than `CounterKey`: chests already have a PERMANENT HUD
   * counter, so the chest site omits this and gets no transient popup. That
   * is a spec non-goal, not an oversight.
   *
   * The coin site also omits it, for a different reason: a coin's reward is
   * resolved dynamically at pickup time and most coins reveal no fact, so its
   * popup must not be gated on a reveal and is bumped at the pickup site
   * itself.
   */
  counterKey?: CounterPopupLabelKey;
}

/**
 * Builds this tick's fact-reveal trigger: the one place that turns "this
 * entity revealed a fact" into collected state, a flight effect and a counter
 * popup. Every fact-reveal site in the game goes through it — enemy defeat,
 * coin pickup, bonus fruit, chest open, crate destruction — replacing five
 * near-duplicate inline blocks that each did the same three things slightly
 * differently.
 *
 * The key pickup deliberately does NOT go through this: it reveals no fact,
 * has a static caption, and flies to the HUD key counter rather than the
 * journal.
 *
 * Writes the signals directly rather than staging into local arrays. Two of
 * the five original sites (crate, chest) already did exactly that. Do not wrap
 * these in `batch()` — nothing in this repo uses it, and it is the escape
 * hatch only if a browser check ever shows jank from several reveals landing
 * in one tick.
 *
 * Returns whether it actually revealed, so a caller can still gate its own
 * side effects on a fresh reveal rather than a deduped one.
 */
export function createRewardReveal(
  ctx: RevealContext,
): (fact: CollectedFact, options: RevealOptions) => boolean {
  const targetX = ctx.journalRect
    ? ctx.journalRect.left + ctx.journalRect.width / 2
    : ctx.canvasWidth - 32;
  const targetY = ctx.journalRect
    ? ctx.journalRect.top + ctx.journalRect.height / 2
    : ctx.canvasHeight - 32;
  // Fact text rises toward the upper-middle of the screen and holds there
  // before flying on to the journal icon, so it's actually readable.
  // Deliberately above dead-center: gameplay sits in the lower half, so a
  // dead-center pause competes with it.
  const midX = ctx.canvasWidth / 2;
  const midY = ctx.canvasHeight * 0.3;

  return (fact, options) => {
    // Dedup by fact id — the guard every one of the five original sites had.
    if (collectedFacts.value.some((f) => f.id === fact.id)) return false;

    // Reuses the journal's own title/icon derivation: formatJournalEntry gets
    // every section's display title right (Course's `title`, Experience's
    // `role`/`company`, Education's `degree`), unlike an ad-hoc
    // `'name' in data` check. `icon` is passed to startFlightEffect
    // separately, NOT concatenated into `label`: Renderer.ts draws it in a
    // different font, and the pixel font `label` uses has no emoji glyphs.
    const { icon, title: label } = formatJournalEntry(fact);
    // The offset applies to BOTH the rise's start and its mid hold point —
    // offsetting mid alone still let two effects starting near the same world
    // position overlap through most of the rise.
    const stackOffsetY = ctx.allocateSlotOffset();

    collectedFacts.value = [...collectedFacts.value, fact];

    if (options.counterKey) {
      const counterKey = options.counterKey;
      activeCounterPopups.value = {
        ...activeCounterPopups.value,
        [counterKey]: startCounterPopup(
          counterKey,
          countCollectedFor(counterKey, collectedFacts.value),
          levelTotals.value[counterKey],
        ),
      };
    }

    activeEffects.value = [
      ...activeEffects.value,
      startFlightEffect(
        options.effectId,
        label,
        options.x + ctx.originX,
        options.y + ctx.originY + stackOffsetY,
        midX,
        midY + stackOffsetY,
        targetX,
        targetY,
        icon,
      ),
    ];

    return true;
  };
}
