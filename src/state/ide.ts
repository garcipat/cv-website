import { signal, type Signal } from '@preact/signals-react';
import { createLocalStorageSignal } from '@/lib/utils';

export const activeFile: Signal<string | null> = createLocalStorageSignal<string | null>('ide-activeFile', 'README.md');

export const openTabs: Signal<string[]> = createLocalStorageSignal<string[]>('ide-openTabs', ['README.md']);

export const sidebarExpanded: Signal<Set<string>> = signal<Set<string>>(new Set(['resume', 'src', 'src/sections']));

export function openFile(fileName: string): void {
  if (!openTabs.value.includes(fileName)) {
    openTabs.value = [...openTabs.value, fileName];
  }
  activeFile.value = fileName;
}

export function closeTab(fileName: string): void {
  const idx = openTabs.value.indexOf(fileName);
  if (idx === -1) return;

  const newTabs = openTabs.value.filter((t) => t !== fileName);
  openTabs.value = newTabs;

  if (activeFile.value === fileName) {
    if (newTabs.length === 0) {
      activeFile.value = null;
    } else if (idx < newTabs.length) {
      activeFile.value = newTabs[idx];
    } else {
      activeFile.value = newTabs[newTabs.length - 1];
    }
  }
}
