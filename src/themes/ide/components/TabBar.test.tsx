import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import { activeFile, openTabs, openFile } from '@/state/ide';
import { TabBar } from './TabBar';

beforeEach(() => {
  activeFile.value = null;
  openTabs.value = [];
});

describe('TabBar', () => {
  it('renders-open-tabs-as-tab-items-with-file-names', () => {
    openFile('about.tsx');
    openFile('experience.tsx');
    render(<TabBar />);
    expect(screen.getByText('about.tsx')).toBeInTheDocument();
    expect(screen.getByText('experience.tsx')).toBeInTheDocument();
  });

  it('active-tab-has-highlight-styling', () => {
    openFile('about.tsx');
    render(<TabBar />);
    const tab = screen.getByText('about.tsx').closest('button');
    expect(tab?.className).toContain('bg-[var(--color-ctp-mantle)]');
  });

  it('clicking-tab-switches-active-tab', async () => {
    const user = userEvent.setup();
    openFile('about.tsx');
    openFile('experience.tsx');
    render(<TabBar />);
    await user.click(screen.getByText('about.tsx'));
    expect(activeFile.value).toBe('about.tsx');
  });

  it('clicking-close-button-removes-tab', async () => {
    const user = userEvent.setup();
    openFile('about.tsx');
    render(<TabBar />);
    const closeBtn = screen.getByLabelText('Close about.tsx');
    await user.click(closeBtn);
    expect(openTabs.value).not.toContain('about.tsx');
  });

  it('closing-active-tab-activates-rightmost-remaining-tab', async () => {
    const user = userEvent.setup();
    openFile('about.tsx');
    openFile('experience.tsx');
    openFile('skills.md');
    render(<TabBar />);
    const closeBtn = screen.getByLabelText('Close skills.md');
    await user.click(closeBtn);
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
    const { container } = render(<TabBar />);
    const tabLabels = container.querySelectorAll('button > span:first-child');
    expect(tabLabels[0]).toHaveTextContent('skills.md');
    expect(tabLabels[1]).toHaveTextContent('about.tsx');
    expect(tabLabels[2]).toHaveTextContent('experience.tsx');
  });
});
