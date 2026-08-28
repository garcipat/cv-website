import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { activeFile, openTabs, sidebarExpanded, openFile } from '@/state/ide';
import { FileTree } from './FileTree';
import { fileTreePage } from './FileTree.page';

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
    expect(fileTreePage.aboutFile).toBeInTheDocument();
    expect(fileTreePage.experienceFile).toBeInTheDocument();
    expect(fileTreePage.skillsFile).toBeInTheDocument();
    expect(fileTreePage.projectsFile).toBeInTheDocument();
    expect(fileTreePage.educationFile).toBeInTheDocument();
    expect(fileTreePage.coursesFile).toBeInTheDocument();
    expect(fileTreePage.certificatesFile).toBeInTheDocument();
  });

  it('expands-and-collapses-folders-on-click', async () => {
    const user = userEvent.setup();
    render(<FileTree />);
    const srcFolder = fileTreePage.srcFolder;
    await user.click(srcFolder);
    expect(sidebarExpanded.value.has('src')).toBe(false);
    await user.click(srcFolder);
    expect(sidebarExpanded.value.has('src')).toBe(true);
  });

  it('src-and-sections-folders-expanded-by-default', () => {
    render(<FileTree />);
    expect(fileTreePage.aboutFile).toBeVisible();
    expect(fileTreePage.experienceFile).toBeVisible();
  });

  it('clicking-file-calls-openFile-with-correct-file-name', async () => {
    const user = userEvent.setup();
    render(<FileTree />);
    await user.click(fileTreePage.experienceFile);
    expect(activeFile.value).toBe('experience.tsx');
    expect(openTabs.value).toContain('experience.tsx');
  });

  it('active-file-is-visually-highlighted', () => {
    openFile('about.tsx');
    render(<FileTree />);
    expect(fileTreePage.aboutFile).toHaveAttribute('data-active', 'true');
  });
});
