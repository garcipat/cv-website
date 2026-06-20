import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('renders without crashing and displays CV text', () => {
    render(<App />);
    expect(screen.getByText('CV')).toBeInTheDocument();
  });

  it('renders Tailwind utility classes correctly', () => {
    render(<App />);
    const heading = screen.getByText('CV');
    expect(heading).toHaveClass('text-3xl', 'font-bold');
    const container = heading.parentElement;
    expect(container).toHaveClass('min-h-screen', 'bg-background', 'text-foreground');
  });
});
