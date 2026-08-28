import { screen } from '@testing-library/react';
import { anchorDotsPage } from './components/AnchorDots.page';
import { circleParadePage } from './components/CircleParade.page';
import { spaceParadePage } from './components/SpaceParade.page';
import { floatingControlsPage } from './components/FloatingControls.page';
import { nebulaPage } from './components/space-elements/Nebula.page';
import { sunPage } from './components/space-elements/Sun.page';

export const spacePage = {
  anchorDots: anchorDotsPage,
  circleParade: circleParadePage,
  spaceParade: spaceParadePage,
  floatingControls: floatingControlsPage,
  nebula: nebulaPage,
  sun: sunPage,
  get starfield() {
    return screen.queryByTestId('starfield');
  },
  get stars() {
    return screen.queryAllByTestId('starfield-star');
  },
  get ambientGlow() {
    return screen.queryByTestId('space-ambient-glow');
  },
  get scrollContainer() {
    return screen.queryByTestId('space-scroll-container');
  },
  get scrollSpacer() {
    return screen.queryByTestId('space-scroll-spacer');
  },
  get staticCards() {
    return screen.queryAllByTestId('space-static-card');
  },
  get poster() {
    return screen.queryByTestId('space-poster');
  },
};
