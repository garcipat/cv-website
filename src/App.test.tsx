import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders the IDE theme page by default', () => {
    render(<App />);
    expect(screen.getByText('Curriculum Vitae IDE')).toBeInTheDocument();
  });

  it('renders with layout structure', () => {
    render(<App />);
    const heading = screen.getByText('Curriculum Vitae IDE');
    expect(heading).toHaveClass('text-3xl', 'font-bold');
    const headerBar = heading.parentElement;
    expect(headerBar).toHaveClass('flex', 'items-center', 'justify-between');
    const pageContainer = headerBar?.parentElement;
    expect(pageContainer).toHaveClass('min-h-screen', 'bg-background', 'text-foreground');
  });
});
