import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import type { SaveResult } from './editorState';

export interface EditorSaveDialogConfig {
  /** "Save this level" / "Save this blueprint". */
  title: string;
  /** The description paragraph, including the target folder. */
  description: ReactNode;
  /** "Level name" / "Blueprint name". */
  nameLabel: string;
  /** "Save level file" / "Save blueprint". */
  saveLabel: string;
  /** The "move it into <folder> yourself" hint shown on a fallback download. */
  fallbackHint: ReactNode;
}

export interface EditorSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: EditorSaveDialogConfig;
  /** The name the input is reset to each time the dialog opens. */
  defaultName: string;
  /** The last save's result, or `null` before one has run. */
  result: SaveResult | null;
  onSave: (name: string) => void;
}

/**
 * The single save dialog behind both the level and the blueprint save flows
 * (FR-020). The two call sites differ only by `config`, `defaultName` and
 * `onSave`.
 *
 * The name input is reset from `defaultName` every time the dialog opens. A
 * fallback download keeps the dialog open (there is still something to do with
 * the file) and explains where to move it; a successful write is closed by the
 * caller.
 */
export const EditorSaveDialog = ({
  open,
  onOpenChange,
  config,
  defaultName,
  result,
  onSave,
}: EditorSaveDialogProps) => {
  const [name, setName] = useState(defaultName);
  // Read through a ref so a `defaultName` change while the dialog is already
  // open does not clobber what the author is typing. The ref is updated in an
  // effect (never during render).
  const defaultNameRef = useRef(defaultName);
  useEffect(() => {
    defaultNameRef.current = defaultName;
  }, [defaultName]);

  useEffect(() => {
    if (open) setName(defaultNameRef.current);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="editor-save-dialog">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1 text-sm" htmlFor="editor-save-name">
          {config.nameLabel}
          <input
            id="editor-save-name"
            data-testid="editor-save-dialog-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded border px-2 py-1 font-mono text-xs"
          />
        </label>
        {result !== null && !result.written && (
          <p className="text-sm" role="status" data-testid="editor-save-dialog-result">
            No dev server to write it
            {result.error === undefined ? '' : ` (${result.error})`}, so it went to your downloads
            instead. {config.fallbackHint}
          </p>
        )}
        <DialogFooter>
          <DialogClose
            render={<Button type="button" variant="outline" data-testid="editor-save-dialog-cancel" />}
          >
            {result === null ? 'Cancel' : 'Done'}
          </DialogClose>
          <Button
            type="button"
            data-testid="editor-save-dialog-confirm"
            onClick={() => onSave(name)}
          >
            {config.saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
