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
import { LEVELS, findLevel, type LevelEntry } from '../level/levelRegistry';

export interface LevelSelectProps {
  /** Name of the level currently open — shown on the dropdown's trigger. */
  loadedLevelName: string;
  /** Whether the grid has unsaved edits, i.e. whether loading has to ask first. */
  isDirty: boolean;
  onLoadLevel: (level: LevelEntry) => void;
}

/**
 * The editor's level dropdown (spec User Story 7). Replaces what used to be
 * separate Reset and Scratch buttons: `main` and `empty` are simply the first
 * two entries, so reloading the shipped level and clearing to a bare grid are
 * both "pick a level".
 *
 * The Select is deliberately driven as an action menu — `value` is pinned to
 * `null` and the loaded level's name is shown as the trigger's own text —
 * rather than bound to the loaded level. A value-bound Select swallows the
 * selection of the already-selected item, which is exactly the reset case
 * ("I've made a mess of `main`, give me `main` back").
 */
export const LevelSelect = ({ loadedLevelName, isDirty, onLoadLevel }: LevelSelectProps) => {
  const [pendingLevel, setPendingLevel] = useState<LevelEntry | null>(null);

  const handleSelect = (value: string | null) => {
    if (value === null) return;
    const level = findLevel(value);
    if (level === undefined) return;

    if (isDirty) {
      setPendingLevel(level);
      return;
    }
    onLoadLevel(level);
  };

  const confirmPendingLevel = () => {
    if (pendingLevel !== null) onLoadLevel(pendingLevel);
    setPendingLevel(null);
  };

  const items = Object.fromEntries(LEVELS.map((level) => [level.id, level.name]));

  return (
    <>
      <Select value={null} onValueChange={handleSelect} items={items}>
        <SelectTrigger className="w-full" aria-label="Level">
          <SelectValue placeholder={loadedLevelName} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {LEVELS.map((level) => (
            <SelectItem key={level.id} value={level.id}>
              {level.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog
        open={pendingLevel !== null}
        onOpenChange={(open) => {
          if (!open) setPendingLevel(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard changes to “{loadedLevelName}”?</DialogTitle>
            <DialogDescription>
              Loading “{pendingLevel?.name}” replaces the grid and discards your unsaved edits to
              “{loadedLevelName}”. Save it first if you want to keep it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="button" variant="destructive" onClick={confirmPendingLevel}>
              Discard and load
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
