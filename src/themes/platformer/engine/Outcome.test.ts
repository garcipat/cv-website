import { strongerBounce } from './Outcome';

/**
 * Pins the tie-break rule that `resolveEnemyContacts` (Collision.ts) and,
 * later, the block-hit aggregator in PlatformerPage.tsx both delegate to.
 * Every real bounce-supplying entity today happens to share one constant, so
 * these values are deliberately distinct from any of them — only differing
 * inputs can actually pin "most negative wins".
 */
describe('strongerBounce', () => {
  it('candidateMoreNegativeThanCurrent-returnsCandidate', () => {
    expect(strongerBounce(-100, -200)).toBe(-200);
  });

  it('candidateLessNegativeThanCurrent-returnsCurrent', () => {
    expect(strongerBounce(-200, -100)).toBe(-200);
  });

  it('candidateEqualToCurrent-returnsCurrent', () => {
    const current = -150;
    const candidate = -150;
    expect(strongerBounce(current, candidate)).toBe(current);
  });

  it('currentUndefined-returnsCandidate', () => {
    expect(strongerBounce(undefined, -220)).toBe(-220);
  });

  it('candidateUndefined-returnsCurrent', () => {
    expect(strongerBounce(-330, undefined)).toBe(-330);
  });

  it('bothUndefined-returnsUndefined', () => {
    expect(strongerBounce(undefined, undefined)).toBeUndefined();
  });

  it('candidateZeroAgainstUndefinedCurrent-acceptsZero', () => {
    // 0 is a real velocity, not "absent" — must not be treated like undefined.
    expect(strongerBounce(undefined, 0)).toBe(0);
  });
});
