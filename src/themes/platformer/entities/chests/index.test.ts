import { chestDeployableItem, toChestState } from './index';
import { CHEST_CLOSED_SHEET, CHEST_OPEN_SHEET } from '../sprites/sheets';
import {
  CHEST_CLOSED_WIDTH,
  CHEST_CLOSED_HEIGHT,
  CHEST_OPEN_WIDTH,
  CHEST_OPEN_HEIGHT,
} from './index';

describe('chestDeployableItem', () => {
  it('closedAndOpen-pointAtTheirOwnSheets', () => {
    expect(chestDeployableItem.closed.sheet).toBe(CHEST_CLOSED_SHEET);
    expect(chestDeployableItem.open.sheet).toBe(CHEST_OPEN_SHEET);
  });

  it('theTwoStates-haveDifferentNativeWidths', () => {
    // A chest's open and closed art are different sizes, which is why each is
    // its own sheet with its own centering offset.
    expect(chestDeployableItem.closed.sheet.frameWidth).not.toBe(
      chestDeployableItem.open.sheet.frameWidth,
    );
  });

  it('sheetGeometry-agreesWithTheChestConstants', () => {
    // `sprites/sheets.ts` declares the chest sheet geometry with local literals
    // (breaking the sheets ⇄ chests/Chest eval-time cycle); the chest module
    // stays the behavioural source of truth, so the two must agree.
    expect(CHEST_CLOSED_SHEET.frameWidth).toBe(CHEST_CLOSED_WIDTH);
    expect(CHEST_CLOSED_SHEET.frameHeight).toBe(CHEST_CLOSED_HEIGHT);
    expect(CHEST_OPEN_SHEET.frameWidth).toBe(CHEST_OPEN_WIDTH);
    expect(CHEST_OPEN_SHEET.frameHeight).toBe(CHEST_OPEN_HEIGHT);
  });

  it('registryFields-areTheChestWorldInteractableEntry', () => {
    expect(chestDeployableItem.key).toBe('chest');
    expect(chestDeployableItem.sprite.sheet).toBe(CHEST_CLOSED_SHEET);
    expect(chestDeployableItem.drawLayer).toBe('afterCrumblingFloors');
    expect(chestDeployableItem.resetScope).toBe('progress');
    expect(chestDeployableItem.interactionPriority).toBe(1);
    expect(typeof chestDeployableItem.onPlayerInteract).toBe('function');
  });

  it('spawnedChestState-kindEqualsTheRegistrySlot', () => {
    const state = toChestState({
      id: 'chest-x',
      col: 0,
      row: 0,
      x: 0,
      y: 0,
      fact: {
        id: 'chest-x',
        sectionId: 'experience',
        sectionLabel: 'Experience',
        data: { company: 'X', role: 'Y', startDate: '2020-01', highlights: [] },
        sourceType: 'chest',
      },
    });
    expect(state.kind).toBe(chestDeployableItem.key);
  });
});
