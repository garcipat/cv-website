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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface EditorEntry {
  id: string;
  name: string;
}

export interface EditorEntrySelectLabels {
  /** Accessible name of the trigger ("Level" / "Blueprint"). */
  triggerAriaLabel: string;
  /** Tooltip naming the selector ("Levels" / "Blueprints"). */
  tooltip: string;
  discardTitle: (loadedName: string) => string;
  discardDescription: (loadedName: string, pendingName: string) => string;
}

export interface EditorEntrySelectProps {
  entries: readonly EditorEntry[];
  /** Name of the entry currently open — shown on the dropdown's trigger. */
  loadedName: string;
  /** Whether the canvas has unsaved edits, i.e. whether loading has to ask. */
  isDirty: boolean;
  onLoad: (entry: EditorEntry) => void;
  labels: EditorEntrySelectLabels;
}

/**
 * The single entry selector behind both the level and blueprint dropdowns
 * (FR-021, SC-005). The two call sites differ only by entry source and labels.
 *
 * Deliberately driven as an action menu — `value` is pinned to `null` and the
 * loaded entry's name is shown as the trigger's own text — so re-picking the
 * entry you are already on still reloads it ("I've made a mess of this, give me
 * it back") instead of being swallowed as an already-selected no-op.
 */
export const EditorEntrySelect = ({
  entries,
  loadedName,
  isDirty,
  onLoad,
  labels,
}: EditorEntrySelectProps) => {
  const [pendingEntry, setPendingEntry] = useState<EditorEntry | null>(null);

  const handleSelect = (value: string | null) => {
    if (value === null) return;
    const entry = entries.find((candidate) => candidate.id === value);
    if (entry === undefined) return;

    if (isDirty) {
      setPendingEntry(entry);
      return;
    }
    onLoad(entry);
  };

  const confirmPendingEntry = () => {
    if (pendingEntry !== null) onLoad(pendingEntry);
    setPendingEntry(null);
  };

  const items = Object.fromEntries(entries.map((entry) => [entry.id, entry.name]));

  return (
    <>
      <Select value={null} onValueChange={handleSelect} items={items}>
        <Tooltip>
          <TooltipTrigger
            render={
              <SelectTrigger
                className="w-40 shrink-0"
                aria-label={labels.triggerAriaLabel}
                data-testid="editor-entry-select"
              >
                <SelectValue placeholder={loadedName} />
              </SelectTrigger>
            }
          />
          <TooltipContent role="tooltip">{labels.tooltip}</TooltipContent>
        </Tooltip>
        <SelectContent alignItemWithTrigger={false}>
          {entries.map((entry) => (
            <SelectItem
              key={entry.id}
              value={entry.id}
              data-testid={`editor-entry-select-option-${entry.id}`}
            >
              {entry.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Dialog
        open={pendingEntry !== null}
        onOpenChange={(open) => {
          if (!open) setPendingEntry(null);
        }}
      >
        <DialogContent data-testid="editor-entry-discard-dialog">
          <DialogHeader>
            <DialogTitle>{labels.discardTitle(loadedName)}</DialogTitle>
            <DialogDescription>
              {labels.discardDescription(loadedName, pendingEntry?.name ?? '')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" data-testid="editor-entry-discard-cancel" />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              data-testid="editor-entry-discard-confirm"
              onClick={confirmPendingEntry}
            >
              Discard and load
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
