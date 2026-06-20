import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  it('renders with destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole('button', { name: /delete/i });
    expect(button).toBeInTheDocument();
  });

  it('renders with outline variant', () => {
    render(<Button variant="outline">Outline</Button>);
    const button = screen.getByRole('button', { name: /outline/i });
    expect(button).toBeInTheDocument();
  });

  it('renders with secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button', { name: /secondary/i });
    expect(button).toBeInTheDocument();
  });

  it('renders with ghost variant', () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole('button', { name: /ghost/i });
    expect(button).toBeInTheDocument();
  });

  it('renders with link variant', () => {
    render(<Button variant="link">Link</Button>);
    const button = screen.getByRole('button', { name: /link/i });
    expect(button).toBeInTheDocument();
  });

  it('renders with different sizes', () => {
    render(<Button size="xs">Extra Small</Button>);
    expect(screen.getByRole('button', { name: /extra small/i })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole('button', { name: /custom/i });
    expect(button).toHaveClass('custom-class');
  });

  describe('theme CSS variable overrides', () => {
    const themes: Array<{ id: string; label: string }> = [
      { id: 'ide', label: 'IDE' },
      { id: 'space', label: '3D Room' },
      { id: 'terminal', label: 'Retro Terminal' },
    ];

    themes.forEach(({ id, label }) => {
      it(`renders Button without crashing under data-theme="${id}"`, () => {
        document.documentElement.dataset.theme = id;
        render(<Button>{label}</Button>);
        const button = screen.getByRole('button', { name: new RegExp(label, 'i') });
        expect(button).toBeInTheDocument();
        delete document.documentElement.dataset.theme;
      });
    });

    it('each theme CSS file defines the required CSS variables under [data-theme] selector', async () => {
      const { readFileSync } = await import('node:fs');
      const { resolve } = await import('node:path');
      const { fileURLToPath } = await import('node:url');

      const currentDir = resolve(fileURLToPath(import.meta.url), '..');
      const themeFiles = ['ide.css', 'space.css', 'terminal.css'];
      const requiredVars = [
        '--background', '--foreground', '--card', '--card-foreground',
        '--primary', '--primary-foreground', '--secondary', '--secondary-foreground',
        '--muted', '--muted-foreground', '--accent', '--accent-foreground',
        '--destructive', '--destructive-foreground',
        '--border', '--input', '--ring',
        '--font-sans', '--font-heading',
      ];

      const themesDir = resolve(currentDir, '../../../src/styles/themes');

      for (const file of themeFiles) {
        const content = readFileSync(resolve(themesDir, file), 'utf-8');
        const themeId = file.replace('.css', '');
        expect(content).toContain(`[data-theme="${themeId}"]`);

        for (const variable of requiredVars) {
          expect(content).toContain(variable);
        }
      }
    });
  });
});
