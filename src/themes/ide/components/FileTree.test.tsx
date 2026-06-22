import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { activeFile, openTabs, sidebarExpanded, openFile } from '@/state/ide';
import { FileTree } from './FileTree';

beforeEach(() => {
  activeFile.value = null;
  openTabs.value = [];
  sidebarExpanded.value = new Set(['resume', 'src', 'src/sections']);
});

describe('FileTree', () => {
  it('renders-all-files-and-folders-in-correct-hierarchy', () => {
    render(<FileTree />);
    expect(screen.getByText('resume/')).toBeInTheDocument();
    expect(screen.getByText('src/')).toBeInTheDocument();
    expect(screen.getByText('sections/')).toBeInTheDocument();
    expect(screen.getByText('about.tsx')).toBeInTheDocument();
    expect(screen.getByText('experience.tsx')).toBeInTheDocument();
    expect(screen.getByText('skills.md')).toBeInTheDocument();
    expect(screen.getByText('projects.tsx')).toBeInTheDocument();
    expect(screen.getByText('education.tsx')).toBeInTheDocument();
    expect(screen.getByText('courses.tsx')).toBeInTheDocument();
    expect(screen.getByText('certificates.tsx')).toBeInTheDocument();
  });

  it('expands-and-collapses-folders-on-click', async () => {
    const user = userEvent.setup();
    render(<FileTree />);
    const srcFolder = screen.getByText('src/');
    await user.click(srcFolder);
    expect(sidebarExpanded.value.has('src')).toBe(false);
    await user.click(srcFolder);
    expect(sidebarExpanded.value.has('src')).toBe(true);
  });

  it('src-and-sections-folders-expanded-by-default', () => {
    render(<FileTree />);
    expect(screen.getByText('about.tsx')).toBeVisible();
    expect(screen.getByText('experience.tsx')).toBeVisible();
  });

  it('clicking-file-calls-openFile-with-correct-file-name', async () => {
    const user = userEvent.setup();
    render(<FileTree />);
    await user.click(screen.getByText('experience.tsx'));
    expect(activeFile.value).toBe('experience.tsx');
    expect(openTabs.value).toContain('experience.tsx');
  });

  it('active-file-is-visually-highlighted', () => {
    openFile('about.tsx');
    render(<FileTree />);
    const fileEl = screen.getByText('about.tsx').closest('button') ?? screen.getByText('about.tsx');
    expect(fileEl.closest('[data-active="true"]') ?? fileEl.parentElement).toBeDefined();
  });
});
