import { EditorEntrySelect } from './EditorEntrySelect';
import { LEVELS, findLevel, type LevelEntry } from '../level/levelRegistry';

export interface LevelSelectProps {
  /** Name of the level currently open — shown on the dropdown's trigger. */
  loadedLevelName: string;
  /** Whether the grid has unsaved edits, i.e. whether loading has to ask first. */
  isDirty: boolean;
  onLoadLevel: (level: LevelEntry) => void;
}

/**
 * The editor's level dropdown — a thin adapter over the shared
 * `EditorEntrySelect` supplying the level registry and level wording
 * (FR-021).
 *
 * `main` and `empty` are simply the first two entries, so reloading the
 * shipped level and clearing to a bare grid are both "pick a level" — the
 * editor has no separate Reset or Scratch button.
 */
export const LevelSelect = ({ loadedLevelName, isDirty, onLoadLevel }: LevelSelectProps) => (
  <EditorEntrySelect
    entries={LEVELS}
    loadedName={loadedLevelName}
    isDirty={isDirty}
    onLoad={(entry) => {
      const level = findLevel(entry.id);
      if (level !== undefined) onLoadLevel(level);
    }}
    labels={{
      triggerAriaLabel: 'Level',
      tooltip: 'Levels',
      discardTitle: (loadedName) => `Discard changes to “${loadedName}”?`,
      discardDescription: (loadedName, pendingName) =>
        `Loading “${pendingName}” replaces the grid and discards your unsaved edits to “${loadedName}”. Save it first if you want to keep it.`,
    }}
  />
);
