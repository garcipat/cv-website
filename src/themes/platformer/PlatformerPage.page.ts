import { screen } from '@testing-library/react';
import { journalPage } from './components/Journal.page';

// Mock shape for the canvas's 2D context in jsdom (which has no real canvas
// implementation) — see src/test/setup.ts for the getContext mock. Exposing
// every mocked method here avoids each test repeating its own `as unknown as
// { drawImage: ... }` cast.
export interface MockCanvasContext2D {
  drawImage: ReturnType<typeof vi.fn>;
  fillText: ReturnType<typeof vi.fn>;
  strokeRect: ReturnType<typeof vi.fn>;
}

export const platformerPage = {
  journal: journalPage,
  get canvas() {
    return screen.getByTestId('platformer-canvas') as HTMLCanvasElement;
  },
  get context() {
    return this.canvas.getContext('2d') as unknown as MockCanvasContext2D;
  },
  get journalOpenButton() {
    return screen.getByTestId('journal-open-button');
  },
  get debugKillButton() {
    return screen.getByTestId('debug-kill-button');
  },
  get queryDebugKillButton() {
    return screen.queryByTestId('debug-kill-button');
  },
  get debugRespawnButton() {
    return screen.getByTestId('debug-respawn-button');
  },
  get queryDebugRespawnButton() {
    return screen.queryByTestId('debug-respawn-button');
  },
  get debugHitboxesToggle() {
    return screen.getByTestId('debug-hitboxes-toggle');
  },
  get controlsOverlay() {
    return screen.getByTestId('platformer-controls-overlay');
  },
  get floatingControlsThemeCombobox() {
    return screen.getAllByRole('combobox')[0];
  },
};
