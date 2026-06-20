import { cn } from './utils';

describe('cn', () => {
  it('merges Tailwind classes correctly and resolves conflicts', () => {
    // Basic merge
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');

    // Conflict resolution (last class wins)
    expect(cn('px-4', 'px-6')).toBe('px-6');

    // Merging with conditional classes (using variable to avoid constant truthiness lint)
    const showHidden = false;
    expect(cn('base-class', showHidden && 'hidden', 'extra')).toBe('base-class extra');

    // Undefined and null values are ignored
    expect(cn('a', undefined, null, 'b')).toBe('a b');

    // Array inputs
    expect(cn(['a', 'b'], 'c')).toBe('a b c');

    // Merges Tailwind conflicts properly using tailwind-merge
    expect(cn('p-4', 'p-6')).toBe('p-6');
    expect(cn('text-red-500', 'text-blue-700')).toBe('text-blue-700');
    expect(cn('bg-blue-500', 'bg-red-700')).toBe('bg-red-700');
  });
});
