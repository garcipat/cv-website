/** Which collectible counters exist — the HUD's transient popups
 *  (`CounterPopupLabelKey`, which omits `chests`: chests have a permanent HUD
 *  counter instead) plus the journal's summary rows, which do include it. */
export type CounterKey = 'coins' | 'fruits' | 'enemies' | 'crates' | 'chests';

/**
 * Which collectible counters get a TRANSIENT popup — derived from `CounterKey`
 * rather than spelled out again, so adding a sixth counter cannot leave this
 * union silently stale. `'chests'` is the one exclusion: chests already have a
 * PERMANENT HUD counter (see Renderer.ts's chest counter), so a chest reveal
 * deliberately bumps no popup.
 */
export type CounterPopupLabelKey = Exclude<CounterKey, 'chests'>;
