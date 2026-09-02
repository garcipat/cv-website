import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
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

  it('themeDropdownOpened-callsOnOpenChangeWithTrue', () => {
    const onOpenChange = vi.fn();
    render(<FloatingControls onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getAllByRole('combobox')[0]);

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('languageDropdownOpened-callsOnOpenChangeWithTrue', () => {
    const onOpenChange = vi.fn();
    render(<FloatingControls onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getAllByRole('combobox')[1]);

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('bothDropdownsClosed-callsOnOpenChangeWithFalse', () => {
    const onOpenChange = vi.fn();
    render(<FloatingControls onOpenChange={onOpenChange} />);
    const [themeCombobox] = screen.getAllByRole('combobox');
    fireEvent.click(themeCombobox);

    fireEvent.click(screen.getByRole('option', { name: /^ide$/i }));

    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
