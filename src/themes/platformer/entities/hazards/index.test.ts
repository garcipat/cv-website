import { HAZARD_TYPES, typeOf } from './index';
import { floorSpike } from './FloorSpike';
import type { HazardPlacement } from '../../level/HazardMapper';

describe('HAZARD_TYPES', () => {
  it('everyEntry-keyMatchesItsRegistrySlot', () => {
    for (const [slot, type] of Object.entries(HAZARD_TYPES)) {
      expect(type.key).toBe(slot);
    }
  });

  it('spear-isRegisteredWithItsOwnKey', () => {
    expect(HAZARD_TYPES.spear.key).toBe('spear');
  });
});

describe('typeOf', () => {
  it('spikeHazard-returnsTheSpikeType', () => {
    const hazard: HazardPlacement = { id: 'h1', hazardType: 'spike', facing: 'up', x: 0, y: 0 };
    expect(typeOf(hazard).key).toBe('spike');
  });

  it('spearHazard-returnsTheSpearType', () => {
    const hazard: HazardPlacement = { id: 'h1', hazardType: 'spear', facing: 'up', x: 0, y: 0 };
    expect(typeOf(hazard).key).toBe('spear');
  });

  it('floorSpikePlacement-typeOfResolvesToFloorSpike', () => {
    expect(typeOf({ id: 'h1', hazardType: 'floorSpike', facing: 'up', x: 0, y: 0 })).toBe(floorSpike);
  });
});
