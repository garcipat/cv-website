import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { signal, type Signal } from '@preact/signals-react';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Creates a Preact Signal that is synced to localStorage.
 *
 * - On creation, reads `localStorage[key]`, parses as JSON, uses the value if valid.
 * - Falls back to `defaultValue` on any error (storage unavailable, parse error, etc.).
 * - On signal write, persists the value back to localStorage as JSON.
 * - All localStorage access is wrapped in try/catch.
 */
export function createLocalStorageSignal<T>(
  key: string,
  defaultValue: T,
): Signal<T> {
  const stored = readLocalStorage<T>(key);
  const themeSignal = signal<T>(stored !== undefined ? stored : defaultValue);

  themeSignal.subscribe((value: T) => {
    writeLocalStorage(key, value);
  });

  return themeSignal;
}

/**
 * Creates a Preact Signal whose localStorage write is debounced.
 *
 * - On creation, reads `localStorage[key]`, parses as JSON, uses the value if
 *   valid — exactly the same fallback rules as `createLocalStorageSignal`.
 * - The signal itself updates synchronously on every write; only the
 *   `localStorage` write waits for `delayMs` of quiet after the last change.
 * - The pending write reads the signal's CURRENT value when its timer fires,
 *   so a later change (e.g. loading a different level) can never be overwritten
 *   by an earlier pending value.
 * - All localStorage access is wrapped in try/catch.
 */
export function createDebouncedLocalStorageSignal<T>(
  key: string,
  defaultValue: T,
  delayMs: number,
): Signal<T> {
  const stored = readLocalStorage<T>(key);
  const debouncedSignal = signal<T>(stored !== undefined ? stored : defaultValue);

  let timer: ReturnType<typeof setTimeout> | undefined;
  // `subscribe` invokes its callback once immediately on subscription, with the
  // value just read — that first call is not a change and must not schedule a
  // write of its own.
  let initialized = false;

  debouncedSignal.subscribe(() => {
    if (!initialized) {
      initialized = true;
      return;
    }
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      writeLocalStorage(key, debouncedSignal.value);
    }, delayMs);
  });

  return debouncedSignal;
}

function readLocalStorage<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function writeLocalStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently ignore storage errors
  }
}
