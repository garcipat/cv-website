import { describe, it, expect } from 'vitest';
import { updatePanOffset } from './EditorPan';

describe('updatePanOffset', () => {
  it('adds the drag delta to the current offset', () => {
    expect(updatePanOffset({ x: 0, y: 0 }, 10, -5)).toEqual({ x: 10, y: -5 });
  });

  it('accumulates across multiple calls', () => {
    const first = updatePanOffset({ x: 0, y: 0 }, 10, 10);
    const second = updatePanOffset(first, -3, 7);
    expect(second).toEqual({ x: 7, y: 17 });
  });

  it('does not mutate the input offset', () => {
    const current = { x: 0, y: 0 };
    updatePanOffset(current, 5, 5);
    expect(current).toEqual({ x: 0, y: 0 });
  });
});
