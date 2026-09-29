import { signal } from '@preact/signals-react';
import { introState } from '../engine/GameLifecycle';
import type { LifecycleState } from '../engine/GameLifecycle';
import type { CollectedFact, SectionId } from '../types';
import { spawnCenter } from './playerStore';

/**
 * Facts discovered so far this session. Starts empty;
 * populated via real coin/fruit collection, enemy defeat, block hits, and
 * chest opens.
 */
export const collectedFacts = signal<CollectedFact[]>([]);

/**
 * The journal's last manually-selected bookmark section, remembered across
 * closing and reopening the journal — `Journal.tsx`
 * itself fully unmounts on close, so this can't live in its local
 * `useState`. `undefined` until the user clicks a bookmark tab for the
 * first time, in which case `Journal.tsx` falls back to defaulting from
 * the first collected fact's section this session (`facts[0]`, not the most
 * recently collected one).
 */
export const activeJournalSection = signal<SectionId | undefined>(undefined);

/**
 * One-shot latch: true once the Thank You screen has been shown this
 * "session" (i.e. since the last Reset Game). Without this,
 * `allChestsOpen(chestStates.value)` stays true forever after the last chest
 * opens (opening is permanent — see entities/chests/Chest.ts's openChest), so the
 * ending-screen check at the end of each tick would otherwise re-trigger
 * `showEndingScreen`/`setEndingScreenOpen(true)` on the very next tick after
 * dismissal, permanently locking the visitor out.
 *
 * Deliberately a module-level signal, not a component-local `useRef` in
 * PlatformerPage.tsx: `chestStates` already survives a component
 * unmount (it's module-level), but a `useRef` does not — switching to
 * another CV-site theme and back would reset a local ref to `false` while
 * every chest is STILL open (theme-switch reset isn't implemented yet),
 * which would make the Thank You screen reappear on
 * the very first tick after switching back, with no player action. Living
 * here keeps this latch's lifetime matched to `chestStates`'s, and it's
 * reset back to `false` in `resetGameProgress()` below (alongside
 * `chestStates`'s own reset) so a visitor can see the screen again after a
 * genuine Reset Game.
 */
export const endingScreenShown = signal(false);

/**
 * Whether `<ThankYouScreen>` is currently mounted — the sibling piece of
 * ending-screen state to `endingScreenShown` above, but a distinct concern:
 * `endingScreenShown` is a permanent one-shot latch (never reset except by
 * Reset Game) while this one flips back to `false` on every dismissal so the
 * screen can be shown again after a future re-trigger.
 *
 * Deliberately module-level, not a component-local `useState` in
 * PlatformerPage.tsx: `chestStates`, `endingScreenShown`, and
 * `lifecycleState` are all module-level and survive a theme-switch
 * unmount/remount, but a local `useState` would not. If a visitor switches
 * away from the Platformer theme and back while this screen is showing,
 * `lifecycleState` still reads `'ending-screen'` (so the game loop's
 * early-return for that phase keeps firing forever — see PlatformerPage.tsx's
 * tick callback); a local `endingScreenOpen` would reset to `false` on
 * remount, meaning `<ThankYouScreen>` would never render — no visible way to
 * dismiss, and `endingScreenShown` (correctly still `true`) blocks the "all
 * chests open" check from ever re-triggering it either, permanently stuck
 * paused with nothing on screen. Being module-level (matching
 * `endingScreenShown`'s lifetime) means a remount sees the screen was open
 * and keeps showing it, same as it would without ever switching themes.
 *
 * PlatformerPage.tsx must call `useSignals()` (from
 * `@preact/signals-react/runtime`, same as ThankYouScreen.tsx already does)
 * for reading `.value` in its JSX to actually re-render on change — a plain
 * signal read outside that hook (or outside `<Component>`-wrapped access)
 * would not resubscribe the component.
 */
export const endingScreenOpen = signal(false);

/**
 * One-shot latch: true once the visitor
 * has dismissed the controls overlay (i.e. walked far enough from where it
 * appeared — see ControlsOverlay.tsx) this browser session. Unlike
 * `endingScreenShown` above, this is NEVER reset by
 * `resetGame()` or `resetGameProgress()` — requires the overlay to
 * not reappear "for the remainder of the session", and a visitor clicking
 * Reset Game is still the same session, not a new one. Module-level (not a
 * component-local `useState`) for the same reason `endingScreenShown` is:
 * it must survive a theme-switch unmount/remount of `PlatformerPage`.
 */
export const controlsOverlayDismissed = signal(false);

/**
 * Death/respawn/intro phase state (see engine/GameLifecycle.ts). Starts in
 * `intro` (circle growing open) centered on the spawned player, the same as
 * what a restart transitions back to.
 */
export const lifecycleState = signal<LifecycleState>(introState(spawnCenter().x, spawnCenter().y));

/**
 * The progress domain's full-reset hook — the only hook this domain has: a
 * death/respawn must preserve discovered facts, the journal bookmark and the
 * ending-screen latches. A full Reset Game clears the facts and bookmark
 * (re-opening the journal falls back to Journal.tsx's default section) and
 * resets both ending-screen latches so a visitor can see the screen again.
 *
 * `controlsOverlayDismissed` and `lifecycleState` are deliberately NOT written
 * here (FR-006): the overlay dismissal is a browser-session latch the page's
 * mount effect owns, and `lifecycleState` is driven only by the lifecycle
 * transitions.
 */
export function resetFull(): void {
  collectedFacts.value = [];
  activeJournalSection.value = undefined;
  endingScreenShown.value = false;
  endingScreenOpen.value = false;
}
