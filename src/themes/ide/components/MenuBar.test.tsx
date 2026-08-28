import { render, screen, fireEvent } from '@testing-library/react';
import { MenuBar } from './MenuBar';
import { platformerPrototypeUnlocked } from '@/state/theme';

const originalUnlocked = platformerPrototypeUnlocked.value;

describe('MenuBar', () => {
  afterEach(() => {
    platformerPrototypeUnlocked.value = originalUnlocked;
  });

  it('decorativeMenuItem-clicked-opensNoDropdown', () => {
    render(<MenuBar />);

    fireEvent.click(screen.getByText('File'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('viewMenuClicked-opensDropdownWithPlatformerToggle', () => {
    render(<MenuBar />);

    fireEvent.click(screen.getByTestId('menu-trigger-view'));

    expect(screen.getByTestId('menu-dropdown-view')).toBeInTheDocument();
    expect(screen.getByRole('menuitemcheckbox')).toBeInTheDocument();
  });

  it('platformerLocked-toggleItemShowsUnchecked', () => {
    platformerPrototypeUnlocked.value = false;

    render(<MenuBar />);
    fireEvent.click(screen.getByTestId('menu-trigger-view'));

    expect(screen.getByRole('menuitemcheckbox')).toHaveAttribute('aria-checked', 'false');
  });

  it('platformerUnlocked-toggleItemShowsChecked', () => {
    platformerPrototypeUnlocked.value = true;

    render(<MenuBar />);
    fireEvent.click(screen.getByTestId('menu-trigger-view'));

    expect(screen.getByRole('menuitemcheckbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('toggleItemClicked-flipsTheUnlockedSignalAndClosesTheDropdown', () => {
    platformerPrototypeUnlocked.value = false;

    render(<MenuBar />);
    fireEvent.click(screen.getByTestId('menu-trigger-view'));
    fireEvent.click(screen.getByRole('menuitemcheckbox'));

    expect(platformerPrototypeUnlocked.value).toBe(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('viewMenuOpen-clickingSameTriggerAgain-closesTheDropdown', () => {
    render(<MenuBar />);
    const trigger = screen.getByTestId('menu-trigger-view');

    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('viewMenuOpen-clickingOutside-closesTheDropdown', () => {
    render(
      <div>
        <MenuBar />
        <div data-testid="outside">outside</div>
      </div>,
    );
    fireEvent.click(screen.getByTestId('menu-trigger-view'));
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // The outside-click backdrop is a fixed full-viewport layer rendered
    // alongside the dropdown, not the literal "outside" element above —
    // clicking it is what closes the menu.
    fireEvent.click(document.querySelector('.fixed.inset-0.z-40')!);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
