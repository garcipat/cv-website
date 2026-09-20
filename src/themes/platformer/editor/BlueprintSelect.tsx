import { EditorEntrySelect } from './EditorEntrySelect';
import { BLANK_BLUEPRINT, type Blueprint } from '../level/BlueprintData';
import { BLUEPRINTS } from '../level/blueprintRegistry';

export interface BlueprintSelectProps {
  /** Name of the blueprint currently open — shown on the dropdown's trigger. */
  loadedBlueprintName: string;
  /** Whether the blueprint canvas has unsaved edits, i.e. whether loading has
   *  to ask first. */
  isDirty: boolean;
  onLoadBlueprint: (blueprint: Blueprint) => void;
}

/**
 * The editor's blueprint dropdown — a thin adapter over the shared
 * `EditorEntrySelect` supplying the blank entry plus the saved blueprint
 * registry and blueprint wording (FR-021).
 *
 * The registry is a build-time glob of `level/blueprints/*.json`, so a
 * blueprint saved moments ago appears once Vite has picked the new file up,
 * not instantly — the Save Blueprint dialog says as much.
 */
export const BlueprintSelect = ({
  loadedBlueprintName,
  isDirty,
  onLoadBlueprint,
}: BlueprintSelectProps) => {
  const entries: Blueprint[] = [BLANK_BLUEPRINT, ...BLUEPRINTS];

  return (
    <EditorEntrySelect
      entries={entries}
      loadedName={loadedBlueprintName}
      isDirty={isDirty}
      onLoad={(entry) => {
        const blueprint = entries.find((candidate) => candidate.id === entry.id);
        if (blueprint !== undefined) onLoadBlueprint(blueprint);
      }}
      labels={{
        triggerAriaLabel: 'Blueprint',
        tooltip: 'Blueprints',
        discardTitle: (loadedName) => `Discard changes to “${loadedName}”?`,
        discardDescription: (loadedName, pendingName) =>
          `Loading “${pendingName}” replaces the blueprint canvas and discards your unsaved edits to “${loadedName}”. Save it first if you want to keep it.`,
      }}
    />
  );
};
