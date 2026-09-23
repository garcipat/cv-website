import { describe, it, expect, vi } from 'vitest';
import { applyInteract, type Interactable } from './Interact';

function fakeInteractable(kind: string, candidateId: string | null): Interactable & { applyInteractMock: ReturnType<typeof vi.fn> } {
  const applyInteractMock = vi.fn();
  return {
    kind,
    findCandidate: () => candidateId,
    applyInteract: applyInteractMock,
    applyInteractMock,
  };
}

describe('applyInteract-noCandidates-returnsFalseAndCallsNothing', () => {
  it('does nothing when nothing is found', () => {
    const a = fakeInteractable('a', null);
    const b = fakeInteractable('b', null);
    expect(applyInteract([a, b])).toBe(false);
    expect(a.applyInteractMock).not.toHaveBeenCalled();
    expect(b.applyInteractMock).not.toHaveBeenCalled();
  });
});

describe('applyInteract-firstKindHasCandidate-appliesItAndStops', () => {
  it('applies the first match and never checks the rest', () => {
    const a = fakeInteractable('a', 'a-1');
    const b = fakeInteractable('b', 'b-1');
    expect(applyInteract([a, b])).toBe(true);
    expect(a.applyInteractMock).toHaveBeenCalledWith('a-1');
    expect(b.applyInteractMock).not.toHaveBeenCalled();
  });
});

describe('applyInteract-onlySecondKindHasCandidate-appliesTheSecond', () => {
  it('falls through to the next kind when the first has none', () => {
    const a = fakeInteractable('a', null);
    const b = fakeInteractable('b', 'b-1');
    expect(applyInteract([a, b])).toBe(true);
    expect(b.applyInteractMock).toHaveBeenCalledWith('b-1');
  });
});

describe('applyInteract-emptyList-returnsFalse', () => {
  it('handles an empty interactables list', () => {
    expect(applyInteract([])).toBe(false);
  });
});
