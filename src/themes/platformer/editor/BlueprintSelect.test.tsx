import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlueprintSelect } from './BlueprintSelect';
import { BLANK_BLUEPRINT, type Blueprint } from '../level/BlueprintData';
import { levelEditorPage } from './LevelEditorPage.page';

// The registry is a build-time glob, so the suite swaps in a list it can
// control. It has to be a STABLE array the tests mutate rather than a fresh one
// per test: the component reads the module binding at render time, so emptying
// and refilling this same array is what makes each test's registry its own.
const { registryEntries } = vi.hoisted(() => ({ registryEntries: [] as Blueprint[] }));

vi.mock('../level/blueprintRegistry', () => ({
  BLUEPRINTS: registryEntries,
  findBlueprint: (id: string) => registryEntries.find((entry) => entry.id === id),
}));

const openDropdown = () => fireEvent.click(levelEditorPage.entrySelect.trigger);

const registerBlueprint = (blueprint: Blueprint): Blueprint => {
  registryEntries.push(blueprint);
  return blueprint;
};

const TEST_ROOM: Blueprint = { id: 'test-room', name: 'Test Room', layout: ['#'] };

beforeEach(() => {
  registryEntries.length = 0;
});

describe('BlueprintSelect', () => {
  it('open-listsTheBlankNewEntry', () => {
    render(<BlueprintSelect loadedBlueprintName="new" isDirty={false} onLoadBlueprint={vi.fn()} />);
    openDropdown();

    expect(levelEditorPage.entrySelect.option('new')).toBeInTheDocument();
  });

  it('open-listsEverySavedBlueprint', () => {
    registerBlueprint(TEST_ROOM);
    render(<BlueprintSelect loadedBlueprintName="new" isDirty={false} onLoadBlueprint={vi.fn()} />);
    openDropdown();

    expect(levelEditorPage.entrySelect.option('test-room')).toBeInTheDocument();
  });

  it('namesTheLoadedBlueprintOnTheTriggerSoItIsVisibleWithoutOpening', () => {
    render(
      <BlueprintSelect loadedBlueprintName="Test Room" isDirty={false} onLoadBlueprint={vi.fn()} />,
    );

    expect(levelEditorPage.entrySelect.trigger).toHaveTextContent('Test Room');
  });

  it('notDirty-selectingASavedBlueprint-loadsItWithNoConfirmation', async () => {
    const saved = registerBlueprint(TEST_ROOM);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="new" isDirty={false} onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('test-room'));

    expect(onLoadBlueprint).toHaveBeenCalledWith(saved);
    expect(levelEditorPage.entrySelect.queryDiscardDialog).not.toBeInTheDocument();
  });

  it('notDirty-selectingTheBlankEntry-loadsTheBlankBlueprint', async () => {
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="Test Room" isDirty={false} onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('new'));

    expect(onLoadBlueprint).toHaveBeenCalledWith(BLANK_BLUEPRINT);
  });

  it('dirty-selectingAnotherBlueprint-doesNotLoadItYet', async () => {
    registerBlueprint(TEST_ROOM);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="new" isDirty onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('test-room'));

    expect(onLoadBlueprint).not.toHaveBeenCalled();
    expect(levelEditorPage.entrySelect.discardDialog).toBeInTheDocument();
  });

  it('dirty-confirmingTheDialog-loadsTheSelectedBlueprint', async () => {
    const saved = registerBlueprint(TEST_ROOM);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="new" isDirty onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('test-room'));
    await userEvent.click(levelEditorPage.entrySelect.discardConfirm);

    expect(onLoadBlueprint).toHaveBeenCalledWith(saved);
  });

  it('dirty-cancellingTheDialog-loadsNothing', async () => {
    registerBlueprint(TEST_ROOM);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="new" isDirty onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('test-room'));
    await userEvent.click(levelEditorPage.entrySelect.discardCancel);

    expect(onLoadBlueprint).not.toHaveBeenCalled();
    expect(levelEditorPage.entrySelect.queryDiscardDialog).not.toBeInTheDocument();
  });

  // Reopening the blueprint you are already on is "start this room over",
  // exactly the reset case LevelSelect's own action-menu Select preserves.
  it('dirty-reselectingTheLoadedBlueprint-reloadsItAfterConfirmation', async () => {
    const saved = registerBlueprint(TEST_ROOM);
    const onLoadBlueprint = vi.fn();
    render(
      <BlueprintSelect loadedBlueprintName="Test Room" isDirty onLoadBlueprint={onLoadBlueprint} />,
    );
    openDropdown();
    await userEvent.click(levelEditorPage.entrySelect.option('test-room'));
    await userEvent.click(levelEditorPage.entrySelect.discardConfirm);

    expect(onLoadBlueprint).toHaveBeenCalledWith(saved);
  });

  it('registryEntries-areListedAfterTheBlankEntryInTheirRegistryOrder', () => {
    // The registry already sorted by id and dropped anything malformed
    // (blueprintRegistry.ts) — this component adds only the blank entry, at
    // the front, and never re-sorts or re-validates.
    registerBlueprint({ id: 'alpha', name: 'Alpha', layout: ['#'] });
    registerBlueprint({ id: 'zulu', name: 'Zulu', layout: ['#'] });
    render(<BlueprintSelect loadedBlueprintName="new" isDirty={false} onLoadBlueprint={vi.fn()} />);
    openDropdown();

    expect(levelEditorPage.entrySelect.options.map((option) => option.textContent)).toEqual([
      BLANK_BLUEPRINT.name,
      'Alpha',
      'Zulu',
    ]);
  });
});
