import { render, screen, fireEvent } from '@testing-library/react';
import { MenuBar } from './MenuBar';
import { menuBarPage } from './MenuBar.page';
import { currentPath } from '@/state/navigation';

const originalPath = currentPath.value;

describe('MenuBar', () => {
  afterEach(() => {
    history.replaceState(null, '', originalPath);
    currentPath.value = originalPath;
  });

  it('decorativeMenuItem-clicked-opensNoDropdown', () => {
    render(<MenuBar />);

    fireEvent.click(screen.getByText('File'));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('viewMenuClicked-opensDropdownWithLevelEditorLink', () => {
    render(<MenuBar />);

    fireEvent.click(menuBarPage.view.trigger);

    expect(menuBarPage.view.dropdown).toBeInTheDocument();
    expect(menuBarPage.view.levelEditorItem).toBeInTheDocument();
  });

  it('viewMenu-listsNoPlatformerUnlockToggle', () => {
    render(<MenuBar />);

    fireEvent.click(menuBarPage.view.trigger);

    expect(screen.queryByRole('menuitemcheckbox')).not.toBeInTheDocument();
  });

  it('levelEditorItemClicked-navigatesToTheEditorRouteAndClosesTheDropdown', () => {
    render(<MenuBar />);
    fireEvent.click(menuBarPage.view.trigger);

    fireEvent.click(menuBarPage.view.levelEditorItem);

    expect(currentPath.value).toBe('/platformer/editor');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('viewMenuOpen-clickingSameTriggerAgain-closesTheDropdown', () => {
    render(<MenuBar />);
    const trigger = menuBarPage.view.trigger;

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
    fireEvent.click(menuBarPage.view.trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // The outside-click backdrop is a fixed full-viewport layer rendered
    // alongside the dropdown, not the literal "outside" element above —
    // clicking it is what closes the menu.
    fireEvent.click(menuBarPage.backdrop);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
