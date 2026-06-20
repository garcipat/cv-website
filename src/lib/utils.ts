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
