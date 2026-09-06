import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
 * The editor's blueprint dropdown (roadmap step 44a) — the blueprint canvas's
 * counterpart of `LevelSelect`, deliberately built the same way: `value` is
 * pinned to `null` and the loaded name is shown as the trigger's own text, so
 * re-picking the entry you are already on still reloads it ("I've made a mess
 * of this room, give me it back") instead of being swallowed as an
 * already-selected no-op.
 *
 * Entries come from `blueprintRegistry.ts`'s build-time glob of
 * `level/blueprints/*.json`, exactly the way `LevelSelect` reads `LEVELS` — so
 * a blueprint saved moments ago appears once Vite has picked the new file up,
 * not instantly. The Save Blueprint dialog says as much, mirroring what the
 * level Save dialog already tells the developer.
 */
export const BlueprintSelect = ({
  loadedBlueprintName,
  isDirty,
  onLoadBlueprint,
}: BlueprintSelectProps) => {
  const [pendingBlueprint, setPendingBlueprint] = useState<Blueprint | null>(null);

  const entries: Blueprint[] = [BLANK_BLUEPRINT, ...BLUEPRINTS];

  const handleSelect = (value: string | null) => {
    if (value === null) return;
    const blueprint = entries.find((entry) => entry.id === value);
    if (blueprint === undefined) return;

    if (isDirty) {
      setPendingBlueprint(blueprint);
      return;
    }
    onLoadBlueprint(blueprint);
  };

  const confirmPendingBlueprint = () => {
    if (pendingBlueprint !== null) onLoadBlueprint(pendingBlueprint);
    setPendingBlueprint(null);
  };

  const items = Object.fromEntries(entries.map((entry) => [entry.id, entry.name]));

  return (
    <>
      <Select value={null} onValueChange={handleSelect} items={items}>
        <SelectTrigger className="w-full" aria-label="Blueprint">
          <SelectValue placeholder={loadedBlueprintName} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {entries.map((entry) => (
            <SelectItem key={entry.id} value={entry.id}>
              {entry.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog
        open={pendingBlueprint !== null}
        onOpenChange={(open) => {
          if (!open) setPendingBlueprint(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard changes to “{loadedBlueprintName}”?</DialogTitle>
            <DialogDescription>
              Loading “{pendingBlueprint?.name}” replaces the blueprint canvas and discards your
              unsaved edits to “{loadedBlueprintName}”. Save it first if you want to keep it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="button" variant="destructive" onClick={confirmPendingBlueprint}>
              Discard and load
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
