import { describe, expect, it, vi } from 'vitest';
import { particleList } from './particles';

describe('particleList', () => {
  it('emitsExactlyCountItems', () => {
    expect(particleList(5, () => ({ dx: 0, dy: 0 }), () => 1)).toHaveLength(5);
  });

  it('zeroCount-emitsNothing', () => {
    expect(particleList(0, () => ({ dx: 0, dy: 0 }), () => 1)).toEqual([]);
  });

  it('appliesOffsetAtForEachIndex', () => {
    const particles = particleList(
      3,
      (index) => ({ dx: index, dy: index * 2 }),
      () => 1,
    );
    expect(particles.map((particle) => [particle.dx, particle.dy])).toEqual([
      [0, 0],
      [1, 2],
      [2, 4],
    ]);
  });

  it('appliesOpacityAtToEveryItem', () => {
    const particles = particleList(4, () => ({ dx: 0, dy: 0 }), () => 0.25);
    expect(particles.every((particle) => particle.opacity === 0.25)).toBe(true);
  });

  it('callsOffsetAtOncePerIndexInOrder', () => {
    const offsetAt = vi.fn((index: number) => ({ dx: index, dy: 0 }));
    particleList(4, offsetAt, () => 1);
    expect(offsetAt.mock.calls.map((call) => call[0])).toEqual([0, 1, 2, 3]);
  });

  it('introducesNoRandomness-sameInputsProduceIdenticalOutput', () => {
    const make = () =>
      particleList(6, (index) => ({ dx: Math.cos(index), dy: Math.sin(index) }), () => 0.5);
    expect(make()).toEqual(make());
  });
});
