import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditorEntrySelect, type EditorEntrySelectLabels } from './EditorEntrySelect';
import { levelEditorPage } from './LevelEditorPage.page';

const ENTRIES = [
  { id: 'main', name: 'main' },
  { id: 'empty', name: 'empty' },
];

const LABELS: EditorEntrySelectLabels = {
  triggerAriaLabel: 'Level',
  tooltip: 'Levels',
  discardTitle: (loadedName) => `Discard changes to “${loadedName}”?`,
  discardDescription: (loadedName, pendingName) =>
    `Loading “${pendingName}” replaces the grid and discards your unsaved edits to “${loadedName}”.`,
};

const renderSelect = (isDirty = false, onLoad = vi.fn()) => {
  render(
    <EditorEntrySelect
      entries={ENTRIES}
      loadedName="main"
      isDirty={isDirty}
      onLoad={onLoad}
      labels={LABELS}
    />,
  );
  return { onLoad };
};

const openDropdown = () => fireEvent.click(levelEditorPage.entrySelect.trigger);

describe('EditorEntrySelect', () => {
  it('open-listsEveryEntry', () => {
    renderSelect();
    openDropdown();
    expect(levelEditorPage.entrySelect.option('main')).toBeInTheDocument();
    expect(levelEditorPage.entrySelect.option('empty')).toBeInTheDocument();
  });

  it('namesTheLoadedEntryOnTheTriggerSoItIsVisibleWithoutOpening', () => {
    render(
      <EditorEntrySelect
        entries={ENTRIES}
        loadedName="Cave Run"
        isDirty={false}
        onLoad={vi.fn()}
        labels={LABELS}
      />,
    );
    expect(levelEditorPage.entrySelect.trigger).toHaveTextContent('Cave Run');
  });

  it('notDirty-selectingAnEntry-loadsItWithNoConfirmation', async () => {
    const { onLoad } = renderSelect(false);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('empty'));
    expect(onLoad).toHaveBeenCalledWith(ENTRIES[1]);
    expect(levelEditorPage.entrySelect.queryDiscardDialog).not.toBeInTheDocument();
  });

  it('dirty-selectingAnEntry-doesNotLoadItYetAndAsksFirst', async () => {
    const { onLoad } = renderSelect(true);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('empty'));
    expect(onLoad).not.toHaveBeenCalled();
    expect(levelEditorPage.entrySelect.discardDialog).toBeInTheDocument();
  });

  it('dirty-confirmingTheDialog-loadsTheSelectedEntry', async () => {
    const { onLoad } = renderSelect(true);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('empty'));
    await userEvent.click(levelEditorPage.entrySelect.discardConfirm);
    expect(onLoad).toHaveBeenCalledWith(ENTRIES[1]);
  });

  it('dirty-cancellingTheDialog-loadsNothing', async () => {
    const { onLoad } = renderSelect(true);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('empty'));
    await userEvent.click(levelEditorPage.entrySelect.discardCancel);
    expect(onLoad).not.toHaveBeenCalled();
    expect(levelEditorPage.entrySelect.queryDiscardDialog).not.toBeInTheDocument();
  });

  it('dirty-reselectingTheAlreadyLoadedEntry-reloadsItAfterConfirmation', async () => {
    const { onLoad } = renderSelect(true);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('main'));
    await userEvent.click(levelEditorPage.entrySelect.discardConfirm);
    expect(onLoad).toHaveBeenCalledWith(ENTRIES[0]);
  });
});
