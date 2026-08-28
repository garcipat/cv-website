import { render, screen } from '@testing-library/react';
import { FloatingControls } from './FloatingControls';

describe('FloatingControls', () => {
  it('render-default-showsThemeAndLanguageSelectors', () => {
    render(<FloatingControls />);
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });
});
