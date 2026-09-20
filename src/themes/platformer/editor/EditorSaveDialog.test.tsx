import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorSaveDialog, type EditorSaveDialogConfig } from './EditorSaveDialog';
import { levelEditorPage } from './LevelEditorPage.page';

const CONFIG: EditorSaveDialogConfig = {
  title: 'Save this level',
  description: (
    <>
      Writes into <code>levels/</code>.
    </>
  ),
  nameLabel: 'Level name',
  saveLabel: 'Save level file',
  fallbackHint: (
    <>
      Move it into <code>levels/</code> yourself.
    </>
  ),
};

interface Overrides {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultName?: string;
  result?: { written: boolean; path?: string; error?: string } | null;
  onSave?: (name: string) => void;
}

const renderDialog = (overrides: Overrides = {}) =>
  render(
    <EditorSaveDialog
      open
      onOpenChange={vi.fn()}
      config={CONFIG}
      defaultName="main"
      result={null}
      onSave={vi.fn()}
      {...overrides}
    />,
  );

describe('EditorSaveDialog', () => {
  it('open-prefillsTheNameInputWithTheDefaultName', () => {
    renderDialog({ defaultName: 'Cave Run' });
    expect(levelEditorPage.saveDialog.nameInput).toHaveValue('Cave Run');
  });

  it('typingAName-thenReopening-resetsTheInputToTheDefaultName', async () => {
    const { rerender } = renderDialog();
    await userEvent.clear(levelEditorPage.saveDialog.nameInput);
    await userEvent.type(levelEditorPage.saveDialog.nameInput, 'Changed');
    expect(levelEditorPage.saveDialog.nameInput).toHaveValue('Changed');

    rerender(
      <EditorSaveDialog
        open={false}
        onOpenChange={vi.fn()}
        config={CONFIG}
        defaultName="main"
        result={null}
        onSave={vi.fn()}
      />,
    );
    rerender(
      <EditorSaveDialog
        open
        onOpenChange={vi.fn()}
        config={CONFIG}
        defaultName="main"
        result={null}
        onSave={vi.fn()}
      />,
    );

    expect(levelEditorPage.saveDialog.nameInput).toHaveValue('main');
  });

  it('successfulWriteResult-showsNoFallbackMessage', () => {
    renderDialog({ result: { written: true, path: 'levels/cave-run.json' } });
    expect(levelEditorPage.saveDialog.queryResult).not.toBeInTheDocument();
  });

  it('fallbackDownloadResult-explainsWhereToMoveTheFile', () => {
    renderDialog({ result: { written: false, error: 'contents must be JSON' } });
    expect(levelEditorPage.saveDialog.result).toHaveTextContent('contents must be JSON');
    expect(levelEditorPage.saveDialog.result).toHaveTextContent('levels/');
  });

  it('confirm-callsOnSaveWithTheEnteredName', async () => {
    const onSave = vi.fn();
    renderDialog({ onSave });
    await userEvent.clear(levelEditorPage.saveDialog.nameInput);
    await userEvent.type(levelEditorPage.saveDialog.nameInput, 'New Level');
    await userEvent.click(levelEditorPage.saveDialog.confirm);
    expect(onSave).toHaveBeenCalledWith('New Level');
  });

  it('cancel-closesTheDialog', async () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });
    await userEvent.click(levelEditorPage.saveDialog.cancel);
    // base-ui passes a second event-details argument alongside the open flag.
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
  });

  it('beforeAnySave-theDismissControlReadsCancel', () => {
    renderDialog();
    expect(levelEditorPage.saveDialog.cancel).toHaveTextContent('Cancel');
  });

  it('afterAFallbackDownload-theDismissControlReadsDone', () => {
    renderDialog({ result: { written: false } });
    expect(levelEditorPage.saveDialog.cancel).toHaveTextContent('Done');
  });

  it('closed-doesNotRenderTheDialog', () => {
    render(
      <EditorSaveDialog
        open={false}
        onOpenChange={vi.fn()}
        config={CONFIG}
        defaultName="main"
        result={null}
        onSave={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('editor-save-dialog')).not.toBeInTheDocument();
  });
});
