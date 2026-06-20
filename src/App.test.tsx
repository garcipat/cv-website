import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the IDE theme page by default', () => {
    render(<App />);
    expect(screen.getByText('File')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('renders with layout structure', () => {
    render(<App />);
    const menuBar = screen.getByText('File').parentElement;
    expect(menuBar).toHaveClass('col-span-2');
    const grid = menuBar?.parentElement;
    expect(grid).toHaveClass('grid');
    expect(screen.getByText('cv-website/')).toBeInTheDocument();
  });
});
