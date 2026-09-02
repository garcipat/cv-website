import { render, screen } from '@testing-library/react';
import { FloatingControls } from './FloatingControls';

describe('FloatingControls', () => {
  it('render-default-showsThemeAndLanguageSelectors', () => {
    render(<FloatingControls />);
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('render-default-hasFloatingControlsTestId', () => {
    render(<FloatingControls />);
    expect(screen.getByTestId('floating-controls')).toBeInTheDocument();
  });

  it('render-noVariant-omitsGlassStyling', () => {
    render(<FloatingControls />);
    expect(screen.getByTestId('floating-controls').className).not.toMatch(/backdrop-blur/);
  });

  it('render-glassVariant-appliesGlassStyling', () => {
    render(<FloatingControls variant="glass" />);
    expect(screen.getByTestId('floating-controls').className).toMatch(/backdrop-blur/);
  });

  it('render-plainVariant-omitsGlassStyling', () => {
    render(<FloatingControls variant="plain" />);
    expect(screen.getByTestId('floating-controls').className).not.toMatch(/backdrop-blur/);
  });
});
