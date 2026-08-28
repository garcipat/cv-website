import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { activeFile, openTabs, openFile } from '@/state/ide';
import { TabBar } from './TabBar';
import { tabBarPage } from './TabBar.page';

beforeEach(() => {
  activeFile.value = null;
  openTabs.value = [];
});

describe('TabBar', () => {
  it('renders-open-tabs-as-tab-items-with-file-names', () => {
    openFile('about.tsx');
    openFile('experience.tsx');
    render(<TabBar />);
    expect(tabBarPage.about.tab).toBeInTheDocument();
    expect(tabBarPage.experience.tab).toBeInTheDocument();
  });

  it('active-tab-has-highlight-styling', () => {
    openFile('about.tsx');
    render(<TabBar />);
    expect(tabBarPage.about.tab.className).toContain('bg-[var(--color-ctp-mantle)]');
  });

  it('clicking-tab-switches-active-tab', async () => {
    const user = userEvent.setup();
    openFile('about.tsx');
    openFile('experience.tsx');
    render(<TabBar />);
    await user.click(tabBarPage.about.tab);
    expect(activeFile.value).toBe('about.tsx');
  });

  it('clicking-close-button-removes-tab', async () => {
    const user = userEvent.setup();
    openFile('about.tsx');
    render(<TabBar />);
    await user.click(tabBarPage.about.closeButton);
    expect(openTabs.value).not.toContain('about.tsx');
  });

  it('closing-active-tab-activates-rightmost-remaining-tab', async () => {
    const user = userEvent.setup();
    openFile('about.tsx');
    openFile('experience.tsx');
    openFile('skills.md');
    render(<TabBar />);
    await user.click(tabBarPage.skills.closeButton);
    expect(activeFile.value).toBe('experience.tsx');
  });

  it('empty-state-renders-nothing-when-no-tabs-open', () => {
    render(<TabBar />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('tab-order-matches-openTabs-signal-order', () => {
    openFile('skills.md');
    openFile('about.tsx');
    openFile('experience.tsx');
    render(<TabBar />);
    const tabs = tabBarPage.allTabs;
    expect(tabs[0]).toHaveTextContent('skills.md');
    expect(tabs[1]).toHaveTextContent('about.tsx');
    expect(tabs[2]).toHaveTextContent('experience.tsx');
  });
});
