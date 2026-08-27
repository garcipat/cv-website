import { maxIrisRadius, lerpRadius } from './IrisTransition';

describe('maxIrisRadius', () => {
  it('centerAtOrigin-returns-distanceToFarthestCorner', () => {
    expect(maxIrisRadius(100, 100, 0, 0)).toBeCloseTo(Math.sqrt(100 * 100 + 100 * 100));
  });

  it('centerAtMiddle-returns-halfDiagonal', () => {
    expect(maxIrisRadius(200, 100, 100, 50)).toBeCloseTo(Math.sqrt(100 * 100 + 50 * 50));
  });

  it('centerOffCanvas-usesFarthestEdgeDistance', () => {
    // Center past the right/bottom edge: the farthest corner is top-left (0,0).
    expect(maxIrisRadius(100, 100, 150, 150)).toBeCloseTo(Math.sqrt(150 * 150 + 150 * 150));
  });
});

describe('lerpRadius', () => {
  it('progressZero-returnsFromRadius', () => {
    expect(lerpRadius(0, 100, 500)).toBe(100);
  });

  it('progressOne-returnsToRadius', () => {
    expect(lerpRadius(1, 100, 500)).toBe(500);
  });

  it('progressHalf-returnsMidpoint', () => {
    expect(lerpRadius(0.5, 100, 500)).toBe(300);
  });

  it('fromGreaterThanTo-progressHalf-returnsMidpoint', () => {
    expect(lerpRadius(0.5, 500, 100)).toBe(300);
  });

  it('progressBeyondOne-clampsToOne', () => {
    expect(lerpRadius(1.5, 100, 500)).toBe(500);
  });

  it('progressBelowZero-clampsToZero', () => {
    expect(lerpRadius(-0.5, 100, 500)).toBe(100);
  });
});
