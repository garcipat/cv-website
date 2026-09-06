import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlueprintSelect } from './BlueprintSelect';
import { savedBlueprintsSignal, saveBlueprintToStash } from './blueprintStash';
import { BLANK_BLUEPRINT } from '../level/BlueprintData';

const openDropdown = () => fireEvent.click(screen.getByRole('combobox'));

beforeEach(() => {
  savedBlueprintsSignal.value = [];
});

describe('BlueprintSelect', () => {
  it('open-listsTheBlankNewEntry', () => {
    render(<BlueprintSelect loadedBlueprintName="new" isDirty={false} onLoadBlueprint={vi.fn()} />);
    openDropdown();

    expect(screen.getByRole('option', { name: 'new' })).toBeInTheDocument();
  });

  it('open-listsEverySavedBlueprint', () => {
    saveBlueprintToStash('Test Room', ['#'], []);
    render(<BlueprintSelect loadedBlueprintName="new" isDirty={false} onLoadBlueprint={vi.fn()} />);
    openDropdown();

    expect(screen.getByRole('option', { name: 'Test Room' })).toBeInTheDocument();
  });

  it('namesTheLoadedBlueprintOnTheTriggerSoItIsVisibleWithoutOpening', () => {
    render(
      <BlueprintSelect loadedBlueprintName="Test Room" isDirty={false} onLoadBlueprint={vi.fn()} />,
    );

    expect(screen.getByRole('combobox')).toHaveTextContent('Test Room');
  });

  it('notDirty-selectingASavedBlueprint-loadsItWithNoConfirmation', async () => {
    const saved = saveBlueprintToStash('Test Room', ['#'], []);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="new" isDirty={false} onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'Test Room' }));

    expect(onLoadBlueprint).toHaveBeenCalledWith(saved);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('notDirty-selectingTheBlankEntry-loadsTheBlankBlueprint', async () => {
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="Test Room" isDirty={false} onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'new' }));

    expect(onLoadBlueprint).toHaveBeenCalledWith(BLANK_BLUEPRINT);
  });

  it('dirty-selectingAnotherBlueprint-doesNotLoadItYet', async () => {
    saveBlueprintToStash('Test Room', ['#'], []);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="new" isDirty onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'Test Room' }));

    expect(onLoadBlueprint).not.toHaveBeenCalled();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('dirty-confirmingTheDialog-loadsTheSelectedBlueprint', async () => {
    const saved = saveBlueprintToStash('Test Room', ['#'], []);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="new" isDirty onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'Test Room' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard and load' }));

    expect(onLoadBlueprint).toHaveBeenCalledWith(saved);
  });

  it('dirty-cancellingTheDialog-loadsNothing', async () => {
    saveBlueprintToStash('Test Room', ['#'], []);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="new" isDirty onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'Test Room' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onLoadBlueprint).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // Reopening the blueprint you are already on is "start this room over",
  // exactly the reset case LevelSelect's own action-menu Select preserves.
  it('dirty-reselectingTheLoadedBlueprint-reloadsItAfterConfirmation', async () => {
    const saved = saveBlueprintToStash('Test Room', ['#'], []);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="Test Room" isDirty onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(screen.getByRole('option', { name: 'Test Room' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Discard and load' }));

    expect(onLoadBlueprint).toHaveBeenCalledWith(saved);
  });

  it('malformedStoredEntry-isNotOfferedAsAnOption', () => {
    savedBlueprintsSignal.value = [{ id: 'bad', name: 'Bad', layout: [] }];
    render(<BlueprintSelect loadedBlueprintName="new" isDirty={false} onLoadBlueprint={vi.fn()} />);
    openDropdown();

    expect(screen.queryByRole('option', { name: 'Bad' })).not.toBeInTheDocument();
  });
});
