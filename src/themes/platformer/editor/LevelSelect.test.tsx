import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LevelSelect } from './LevelSelect';
import { findLevel } from '../level/levelRegistry';
import { levelEditorPage } from './LevelEditorPage.page';

const openDropdown = () => fireEvent.click(levelEditorPage.entrySelect.trigger);

describe('LevelSelect', () => {
  it('open-listsTheBuiltInMainAndEmptyEntries', () => {
    render(<LevelSelect loadedLevelName="main" isDirty={false} onLoadLevel={vi.fn()} />);
    openDropdown();

    expect(levelEditorPage.entrySelect.option('main')).toBeInTheDocument();
    expect(levelEditorPage.entrySelect.option('empty')).toBeInTheDocument();
  });

  it('namesTheLoadedLevelOnTheTriggerSoItIsVisibleWithoutOpening', () => {
    render(<LevelSelect loadedLevelName="Cave Run" isDirty={false} onLoadLevel={vi.fn()} />);

    expect(levelEditorPage.entrySelect.trigger).toHaveTextContent('Cave Run');
  });

  it('notDirty-selectingAnotherLevel-loadsItWithNoConfirmation', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="main" isDirty={false} onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('empty'));

    expect(onLoadLevel).toHaveBeenCalledWith(findLevel('empty'));
    expect(levelEditorPage.entrySelect.queryDiscardDialog).not.toBeInTheDocument();
  });

  // "Reset" is picking the level you are already on, so re-selecting the
  // loaded entry has to reload it rather than being swallowed as a no-op.
  it('dirty-reselectingTheLoadedLevel-reloadsItAfterConfirmation', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="empty" isDirty onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('empty'));
    await userEvent.click(levelEditorPage.entrySelect.discardConfirm);

    expect(onLoadLevel).toHaveBeenCalledWith(findLevel('empty'));
  });

  it('dirty-selectingAnotherLevel-doesNotLoadItYet', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="empty" isDirty onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('main'));

    expect(onLoadLevel).not.toHaveBeenCalled();
  });

  it('dirty-selectingAnotherLevel-namesBothLevelsInTheConfirmationDialog', async () => {
    render(<LevelSelect loadedLevelName="empty" isDirty onLoadLevel={vi.fn()} />);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('main'));

    const dialog = levelEditorPage.entrySelect.discardDialog;
    expect(dialog).toHaveTextContent('empty');
    expect(dialog).toHaveTextContent('main');
  });

  it('confirmingTheDialog-loadsTheSelectedLevel', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="empty" isDirty onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('main'));
    await userEvent.click(levelEditorPage.entrySelect.discardConfirm);

    expect(onLoadLevel).toHaveBeenCalledWith(findLevel('main'));
  });

  it('cancellingTheDialog-loadsNothing', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="empty" isDirty onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('main'));
    await userEvent.click(levelEditorPage.entrySelect.discardCancel);

    expect(onLoadLevel).not.toHaveBeenCalled();
    expect(levelEditorPage.entrySelect.queryDiscardDialog).not.toBeInTheDocument();
  });

  it('cancellingThenSelectingAgain-stillConfirmsRatherThanLoadingStraightAway', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="empty" isDirty onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('main'));
    await userEvent.click(levelEditorPage.entrySelect.discardCancel);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('main'));

    expect(onLoadLevel).not.toHaveBeenCalled();
    expect(levelEditorPage.entrySelect.discardDialog).toBeInTheDocument();
  });

  // A saved level has no registry entry until its file is moved into
  // `levels/`, so the trigger has to show whatever name it was saved under
  // without that name having to resolve to an entry.
  it('loadedLevelNameOutsideTheRegistry-stillLoadsAnEntryThatIsInIt', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="Cave Run" isDirty={false} onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('main'));

    expect(onLoadLevel).toHaveBeenCalledWith(findLevel('main'));
  });
});
