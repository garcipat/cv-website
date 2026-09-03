import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LevelSelect } from './LevelSelect';
import { findLevel } from '../level/levelRegistry';

const openDropdown = () => fireEvent.click(screen.getByRole('combobox'));

describe('LevelSelect', () => {
  it('open-listsTheBuiltInMainAndEmptyEntries', () => {
    render(<LevelSelect loadedLevelName="main" isDirty={false} onLoadLevel={vi.fn()} />);
    openDropdown();

    expect(screen.getByRole('option', { name: 'main' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'empty' })).toBeInTheDocument();
  });

  it('namesTheLoadedLevelOnTheTriggerSoItIsVisibleWithoutOpening', () => {
    render(<LevelSelect loadedLevelName="Cave Run" isDirty={false} onLoadLevel={vi.fn()} />);

    expect(screen.getByRole('combobox')).toHaveTextContent('Cave Run');
  });

  it('notDirty-selectingAnotherLevel-loadsItWithNoConfirmation', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="main" isDirty={false} onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'empty' }));

    expect(onLoadLevel).toHaveBeenCalledWith(findLevel('empty'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // "Reset" is picking the level you are already on, so re-selecting the
  // loaded entry has to reload it rather than being swallowed as a no-op.
  it('dirty-reselectingTheLoadedLevel-reloadsItAfterConfirmation', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="empty" isDirty onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'empty' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard and load' }));

    expect(onLoadLevel).toHaveBeenCalledWith(findLevel('empty'));
  });

  it('dirty-selectingAnotherLevel-doesNotLoadItYet', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="empty" isDirty onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'main' }));

    expect(onLoadLevel).not.toHaveBeenCalled();
  });

  it('dirty-selectingAnotherLevel-namesBothLevelsInTheConfirmationDialog', async () => {
    render(<LevelSelect loadedLevelName="empty" isDirty onLoadLevel={vi.fn()} />);
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'main' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('empty');
    expect(dialog).toHaveTextContent('main');
  });

  it('confirmingTheDialog-loadsTheSelectedLevel', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="empty" isDirty onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'main' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard and load' }));

    expect(onLoadLevel).toHaveBeenCalledWith(findLevel('main'));
  });

  it('cancellingTheDialog-loadsNothing', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="empty" isDirty onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'main' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onLoadLevel).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancellingThenSelectingAgain-stillConfirmsRatherThanLoadingStraightAway', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="empty" isDirty onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'main' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'main' }));

    expect(onLoadLevel).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  // A saved level has no registry entry until its file is moved into
  // `levels/`, so the trigger has to show whatever name it was saved under
  // without that name having to resolve to an entry.
  it('loadedLevelNameOutsideTheRegistry-stillLoadsAnEntryThatIsInIt', async () => {
    const onLoadLevel = vi.fn();
    render(<LevelSelect loadedLevelName="Cave Run" isDirty={false} onLoadLevel={onLoadLevel} />);
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'main' }));

    expect(onLoadLevel).toHaveBeenCalledWith(findLevel('main'));
  });
});
