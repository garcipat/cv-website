import { IRIS_DURATION_SECONDS, maxIrisRadius, irisRadius } from './IrisTransition';

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

describe('irisRadius', () => {
  it('directionIn-progressZero-returnsZero', () => {
    expect(irisRadius(0, 500, 'in')).toBe(0);
  });

  it('directionIn-progressOne-returnsMaxRadius', () => {
    expect(irisRadius(1, 500, 'in')).toBe(500);
  });

  it('directionIn-progressHalf-returnsHalfMaxRadius', () => {
    expect(irisRadius(0.5, 500, 'in')).toBe(250);
  });

  it('directionOut-progressZero-returnsMaxRadius', () => {
    expect(irisRadius(0, 500, 'out')).toBe(500);
  });

  it('directionOut-progressOne-returnsZero', () => {
    expect(irisRadius(1, 500, 'out')).toBe(0);
  });

  it('directionOut-progressHalf-returnsHalfMaxRadius', () => {
    expect(irisRadius(0.5, 500, 'out')).toBe(250);
  });

  it('progressBeyondOne-clampsToOne', () => {
    expect(irisRadius(1.5, 500, 'in')).toBe(500);
  });

  it('progressBelowZero-clampsToZero', () => {
    expect(irisRadius(-0.5, 500, 'in')).toBe(0);
  });
});
