import { cn, createLocalStorageSignal, createDebouncedLocalStorageSignal } from './utils';

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

describe('createLocalStorageSignal — optional isValid predicate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('createLocalStorageSignal-withValidPredicateAndStoredValue-keepsIt', () => {
    localStorage.setItem('appearance', JSON.stringify('dark'));
    const isValid = vi.fn((value: unknown) => value === 'light' || value === 'dark');

    const sig = createLocalStorageSignal('appearance', 'light', isValid);

    expect(sig.value).toBe('dark');
    expect(isValid).toHaveBeenCalledWith('dark');
  });

  it('createLocalStorageSignal-withInvalidStoredValue-fallsBackToDefault', () => {
    localStorage.setItem('appearance', JSON.stringify('blue'));
    const isValid = (value: unknown) => value === 'light' || value === 'dark';

    const sig = createLocalStorageSignal('appearance', 'light', isValid);

    expect(sig.value).toBe('light');
  });

  it('createLocalStorageSignal-withoutStoredValue-usesDefaultWithoutCallingPredicate', () => {
    const isValid = vi.fn(() => true);

    const sig = createLocalStorageSignal('appearance', 'light', isValid);

    expect(sig.value).toBe('light');
    expect(isValid).not.toHaveBeenCalled();
  });

  it('createLocalStorageSignal-withoutAStoredPredicate-keepsTheExistingBehaviourUnchanged', () => {
    localStorage.setItem('appearance', JSON.stringify('anything'));
    const sig = createLocalStorageSignal('appearance', 'light');
    expect(sig.value).toBe('anything');

    localStorage.setItem('unparseable', 'not-json');
    const fallback = createLocalStorageSignal('unparseable', 'light');
    expect(fallback.value).toBe('light');
  });
});

describe('createDebouncedLocalStorageSignal', () => {
  const KEY = 'debounced-key';
  const DELAY_MS = 400;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes from localStorage when a value exists', () => {
    localStorage.setItem(KEY, JSON.stringify('stored-value'));
    const sig = createDebouncedLocalStorageSignal(KEY, 'default', DELAY_MS);
    expect(sig.value).toBe('stored-value');
  });

  it('uses defaultValue when localStorage is empty', () => {
    const sig = createDebouncedLocalStorageSignal(KEY, 'default', DELAY_MS);
    expect(sig.value).toBe('default');
  });

  it('writingAValue-updatesTheSignalImmediatelyButDoesNotWriteStorageYet', () => {
    const sig = createDebouncedLocalStorageSignal(KEY, 'default', DELAY_MS);
    sig.value = 'next';

    expect(sig.value).toBe('next');
    expect(localStorage.getItem(KEY)).toBeNull();

    vi.advanceTimersByTime(DELAY_MS - 1);
    expect(localStorage.getItem(KEY)).toBeNull();

    vi.advanceTimersByTime(1);
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify('next'));
  });

  it('writingManyValuesInABurst-writesStorageOnlyOnceAtTheEnd', () => {
    const sig = createDebouncedLocalStorageSignal(KEY, 'default', DELAY_MS);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    sig.value = 'one';
    vi.advanceTimersByTime(100);
    sig.value = 'two';
    vi.advanceTimersByTime(100);
    sig.value = 'three';
    vi.advanceTimersByTime(DELAY_MS);

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(KEY)).toBe(JSON.stringify('three'));
    setItemSpy.mockRestore();
  });

  it('pendingWrite-readsTheCurrentValueAtFireTimeRatherThanTheScheduledOne', () => {
    const sig = createDebouncedLocalStorageSignal(KEY, 'default', DELAY_MS);
    sig.value = 'scheduled';
    vi.advanceTimersByTime(DELAY_MS - 50);
    // A later change (e.g. a level load) reschedules and must win.
    sig.value = 'later';
    vi.advanceTimersByTime(DELAY_MS);

    expect(localStorage.getItem(KEY)).toBe(JSON.stringify('later'));
  });

  it('creatingTheSignal-withoutAnyChange-doesNotWriteStorage', () => {
    createDebouncedLocalStorageSignal(KEY, 'default', DELAY_MS);
    vi.advanceTimersByTime(DELAY_MS * 2);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('writingValue-persistsUnderTheGivenKeyAndRoundTrips', () => {
    const sig = createDebouncedLocalStorageSignal(KEY, 'default', DELAY_MS);
    sig.value = 'persisted';
    vi.advanceTimersByTime(DELAY_MS);

    expect(localStorage.getItem(KEY)).toBe(JSON.stringify('persisted'));
    const reread = createDebouncedLocalStorageSignal(KEY, 'fallback', DELAY_MS);
    expect(reread.value).toBe('persisted');
  });

  it('handles localStorage setItem throwing gracefully', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage full');
    });
    const sig = createDebouncedLocalStorageSignal(KEY, 'default', DELAY_MS);
    sig.value = 'new-value';

    expect(() => {
      vi.advanceTimersByTime(DELAY_MS);
    }).not.toThrow();
    setItemSpy.mockRestore();
  });
});
