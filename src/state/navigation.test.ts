import { currentPath, navigateTo } from './navigation';

describe('navigation', () => {
  const originalPath = currentPath.value;

  afterEach(() => {
    window.history.pushState(null, '', originalPath);
    currentPath.value = originalPath;
  });

  it('currentPath-initialValue-matchesWindowLocationPathnameAtModuleLoad', () => {
    // navigation.ts seeds currentPath from window.location.pathname once, at
    // import time — this repo's test environment starts every test at '/'
    // (jsdom's default), so that's what the signal should read here.
    expect(currentPath.value).toBe('/');
  });

  it('navigateTo-called-updatesCurrentPathSignal', () => {
    navigateTo('/platformer/editor');
    expect(currentPath.value).toBe('/platformer/editor');
  });

  it('navigateTo-called-pushesHistoryStateWithoutTriggeringAFullReload', () => {
    // pushState (not location.assign/href) is what avoids a real navigation
    // — asserting window.location.pathname reflects the push is the
    // observable proxy for "no reload happened" in jsdom.
    navigateTo('/platformer/editor');
    expect(window.location.pathname).toBe('/platformer/editor');
  });

  it('popstate-firedAfterBackForwardNavigation-updatesCurrentPathToMatchTheNewLocation', () => {
    navigateTo('/platformer/editor');
    // Simulate the browser back button: pushState the previous URL directly
    // (no popstate fires from pushState itself, matching real browser
    // behavior) then dispatch the popstate event navigation.ts listens for.
    window.history.pushState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(currentPath.value).toBe('/');
  });
});
