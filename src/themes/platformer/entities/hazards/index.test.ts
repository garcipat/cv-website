import { HAZARD_TYPES, typeOf } from './index';
import type { HazardPlacement } from '../../level/HazardMapper';

describe('HAZARD_TYPES', () => {
  it('everyEntry-keyMatchesItsRegistrySlot', () => {
    for (const [slot, type] of Object.entries(HAZARD_TYPES)) {
      expect(type.key).toBe(slot);
    }
  });
});

describe('typeOf', () => {
  it('spikeHazard-returnsTheSpikeType', () => {
    const hazard: HazardPlacement = { id: 'h1', hazardType: 'spike', facing: 'up', x: 0, y: 0 };
    expect(typeOf(hazard).key).toBe('spike');
  });
});
