import { render, screen } from '@testing-library/react';
import { currentTheme } from '@/state/theme';
import { App } from './App';
import { platformerPage } from './themes/platformer/PlatformerPage.page';

describe('App', () => {
  it('renders the IDE theme page by default', () => {
    render(<App />);
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('renders with layout structure', () => {
    render(<App />);
    // Each menu label now sits in its own wrapper div (needed to anchor
    // that item's dropdown, see MenuBar.tsx), so the menu bar itself is the
    // *grandparent* of the label, not the direct parent as before.
    const menuBar = screen.getByText('File').parentElement?.parentElement;
    expect(menuBar).toHaveClass('col-span-2');
    const grid = menuBar?.parentElement;
    expect(grid).toHaveClass('grid');
    expect(screen.getByText('resume/')).toBeInTheDocument();
  });

  it('renders the Platformer theme page when currentTheme is platformer', () => {
    currentTheme.value = 'platformer';
    render(<App />);
    expect(platformerPage.canvas).toBeInTheDocument();
    currentTheme.value = 'ide';
  });
});
