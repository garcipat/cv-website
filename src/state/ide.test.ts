import { describe, it, expect, beforeEach } from 'vitest';
import { activeFile, openTabs, sidebarExpanded, openFile, closeTab } from './ide';

beforeEach(() => {
  activeFile.value = null;
  openTabs.value = [];
  sidebarExpanded.value = new Set(['cv-website', 'src', 'src/sections']);
});

describe('openFile', () => {
  it('adds-file-to-openTabs-and-sets-activeFile', () => {
    openFile('about.tsx');
    expect(openTabs.value).toEqual(['about.tsx']);
    expect(activeFile.value).toBe('about.tsx');
  });

  it('does-not-duplicate-already-open-tab', () => {
    openFile('about.tsx');
    openFile('exp.tsx');
    openFile('about.tsx');
    expect(openTabs.value).toEqual(['about.tsx', 'exp.tsx']);
    expect(activeFile.value).toBe('about.tsx');
  });

  it('preserves-insertion-order', () => {
    openFile('about.tsx');
    openFile('exp.tsx');
    openFile('skills.tsx');
    expect(openTabs.value).toEqual(['about.tsx', 'exp.tsx', 'skills.tsx']);
  });
});

describe('closeTab', () => {
  it('removes-tab-from-openTabs', () => {
    openFile('about.tsx');
    openFile('exp.tsx');
    closeTab('about.tsx');
    expect(openTabs.value).toEqual(['exp.tsx']);
  });

  it('selects-rightmost-remaining-tab-when-closing-active-tab', () => {
    openFile('about.tsx');
    openFile('exp.tsx');
    openFile('skills.tsx');
    closeTab('skills.tsx');
    expect(activeFile.value).toBe('exp.tsx');
  });

  it('selects-rightmost-when-closing-middle-active-tab', () => {
    openFile('about.tsx');
    openFile('exp.tsx');
    openFile('skills.tsx');
    activeFile.value = 'exp.tsx';
    closeTab('exp.tsx');
    expect(activeFile.value).toBe('skills.tsx');
  });

  it('results-in-null-activeFile-and-empty-openTabs-when-closing-last-tab', () => {
    openFile('about.tsx');
    closeTab('about.tsx');
    expect(activeFile.value).toBeNull();
    expect(openTabs.value).toEqual([]);
  });

  it('does-nothing-if-fileName-not-in-openTabs', () => {
    openFile('about.tsx');
    closeTab('nonexistent.tsx');
    expect(openTabs.value).toEqual(['about.tsx']);
    expect(activeFile.value).toBe('about.tsx');
  });

  it('preserves-tab-ordering-after-close', () => {
    openFile('about.tsx');
    openFile('exp.tsx');
    openFile('skills.tsx');
    openFile('projects.tsx');
    closeTab('skills.tsx');
    expect(openTabs.value).toEqual(['about.tsx', 'exp.tsx', 'projects.tsx']);
  });
});
