import { cn, createLocalStorageSignal } from './utils';

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

describe('createLocalStorageSignal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes from localStorage when a value exists', () => {
    localStorage.setItem('test-key', JSON.stringify('stored-value'));
    const sig = createLocalStorageSignal('test-key', 'default');
    expect(sig.value).toBe('stored-value');
  });

  it('uses defaultValue when localStorage is empty', () => {
    const sig = createLocalStorageSignal('test-key', 'default');
    expect(sig.value).toBe('default');
  });

  it('writes to localStorage on signal change', () => {
    const sig = createLocalStorageSignal('test-key', 'default');
    sig.value = 'new-value';
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('new-value'));
  });

  it('handles JSON parse errors and falls back to default', () => {
    localStorage.setItem('test-key', 'not-valid-json');
    const sig = createLocalStorageSignal('test-key', 'fallback');
    expect(sig.value).toBe('fallback');
  });

  it('handles localStorage getItem throwing and falls back to default', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    const sig = createLocalStorageSignal('test-key', 'fallback');
    expect(sig.value).toBe('fallback');
    getItemSpy.mockRestore();
  });

  it('handles localStorage setItem throwing gracefully', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage full');
    });
    const sig = createLocalStorageSignal('test-key', 'default');
    expect(() => {
      sig.value = 'new-value';
    }).not.toThrow();
    setItemSpy.mockRestore();
  });

  it('type parameter preserves type safety with object types', () => {
    interface Settings {
      volume: number;
      muted: boolean;
    }
    const defaultValue: Settings = { volume: 50, muted: false };
    const sig = createLocalStorageSignal<Settings>('settings', defaultValue);
    expect(sig.value).toEqual(defaultValue);

    const newValue: Settings = { volume: 75, muted: true };
    sig.value = newValue;
    expect(JSON.parse(localStorage.getItem('settings')!)).toEqual(newValue);
  });
});
