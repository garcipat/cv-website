import { describe, it, expect } from 'vitest';
import {
  ZOOM_LEVELS,
  DEFAULT_ZOOM,
  stepZoom,
  anchoredPan,
  sliderZoomIndex,
} from './EditorZoom';

describe('ZOOM_LEVELS', () => {
  it('isExactlyTheFourSpecifiedLevelsInAscendingOrder', () => {
    expect(ZOOM_LEVELS).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('defaultsTo100Percent', () => {
    expect(DEFAULT_ZOOM).toBe(1);
  });
});

describe('stepZoom', () => {
  it('movesToTheNextLargerLevelWhenSteppingUp', () => {
    expect(stepZoom(0.25, 1)).toBe(0.5);
    expect(stepZoom(0.5, 1)).toBe(0.75);
    expect(stepZoom(0.75, 1)).toBe(1);
  });

  it('movesToTheNextSmallerLevelWhenSteppingDown', () => {
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(0.75, -1)).toBe(0.5);
    expect(stepZoom(0.5, -1)).toBe(0.25);
  });

  it('holdsAtTheCeilingRatherThanWrapping', () => {
    expect(stepZoom(1, 1)).toBe(1);
  });

  it('holdsAtTheFloorRatherThanWrapping', () => {
    expect(stepZoom(0.25, -1)).toBe(0.25);
  });
});

describe('anchoredPan', () => {
  it('leavesPanUnchangedWhenTheZoomLevelDoesNotChange', () => {
    expect(anchoredPan({ x: 40, y: -10 }, { x: 100, y: 100 }, 1, 1)).toEqual({ x: 40, y: -10 });
  });

  it('keepsTheAnchorPointsWorldContentFixedWhenZoomingOut', () => {
    // At zoom 1, pan 0, the anchor (200, 100) sits over world point (200, 100).
    // Zooming to 0.5 must still show that same world point at screen (200, 100):
    // newPan = anchor - (0.5/1) * (anchor - pan) = (200,100) - 0.5*(200,100) = (100, 50)
    expect(anchoredPan({ x: 0, y: 0 }, { x: 200, y: 100 }, 1, 0.5)).toEqual({ x: 100, y: 50 });
  });

  it('keepsTheAnchorPointsWorldContentFixedWhenZoomingIn', () => {
    // newPan = (200,100) - 2*((200,100) - (100,50)) = (200,100) - (200,100) = (0, 0)
    expect(anchoredPan({ x: 100, y: 50 }, { x: 200, y: 100 }, 0.5, 1)).toEqual({ x: 0, y: 0 });
  });

  it('accountsForAnExistingNonZeroPanOffset', () => {
    // pan = (30, 30), anchor = (130, 30) -> world under anchor at zoom 1 is (100, 0).
    // At zoom 0.5, newPan.x = 130 - 0.5*(130-30) = 130 - 50 = 80; newPan.y = 30 - 0.5*(30-30) = 30.
    expect(anchoredPan({ x: 30, y: 30 }, { x: 130, y: 30 }, 1, 0.5)).toEqual({ x: 80, y: 30 });
  });
});

describe('sliderZoomIndex', () => {
  it('unwrapsTheArrayShapeTheSliderUsesForItsValueProp', () => {
    expect(sliderZoomIndex([2])).toBe(2);
  });

  it('acceptsThePlainNumberTheSliderPassesForASingleThumbPointerInteraction', () => {
    // The live bug this exists for: reading the callback argument as only an
    // array threw "number N is not iterable" mid-handler, so clicking and
    // dragging the zoom slider did nothing while the wheel still worked.
    expect(sliderZoomIndex(0)).toBe(0);
    expect(sliderZoomIndex(3)).toBe(3);
  });
});
