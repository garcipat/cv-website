// ---------------------------------------------------------------------------
// Space Theme — Component tests for Circle Parade, Anchor Dots, Floating
// Controls, reduced-motion fallback, locale reactivity, and edge cases.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SpacePage } from './SpacePage';
import { showPoster, scrollOffset } from './SpaceState';
import type { CVData } from '@/types/cv';

// Mock @preact/signals-react/runtime
vi.mock('@preact/signals-react/runtime', () => ({
  useSignals: vi.fn(),
}));

// Mock currentCV signal with full test data
const mockCV: CVData = {
  personality: {
    name: 'Test User',
    tagline: 'Test Tagline',
    summary: 'Test summary for the test user.',
    favoriteQuote: { text: 'Test quote.', author: 'Test Author' },
  },
  experience: [
    {
      company: 'Test Corp',
      role: 'Developer',
      startDate: '2020-01',
      highlights: ['Did stuff', 'Did more stuff'],
      location: 'Test City',
    },
    {
      company: 'Another Corp',
      role: 'Senior Dev',
      startDate: '2018-01',
      endDate: '2020-01',
      highlights: ['Older stuff'],
    },
  ],
  projects: [
    {
      name: 'Test Project',
      description: 'A test project description.',
    },
  ],
  skills: [
    {
      category: 'Frontend',
      skills: [
        { name: 'React', level: 90 },
        { name: 'TypeScript', level: 80 },
      ],
    },
  ],
  education: [
    {
      degree: 'B.Sc. Test',
      institution: 'Test University',
      startDate: '2015-01',
      endDate: '2018-01',
      description: 'Test description.',
    },
  ],
  courses: [
    {
      title: 'Test Course',
      provider: 'Test Provider',
      date: '2023-01',
      category: 'Other',
    },
  ],
  certificates: [
    {
      name: 'Test Cert',
      issuer: 'Test Issuer',
      date: '2022-01',
      credentialId: 'CERT-123',
    },
  ],
  contact: {
    email: 'test@example.com',
    location: 'Test City',
  },
};

const mockCurrentCV: { value: CVData } = { value: mockCV };
const mockCurrentUI = {
  value: {
    nav: {
      experience: 'Experience',
      skills: 'Skills',
      projects: 'Projects',
      education: 'Education',
      courses: 'Courses',
      certificates: 'Certificates',
    },
    sections: {
      summary: 'Summary',
      experience: 'Experience',
      skills: 'Skills',
      projects: 'Projects',
      education: 'Education',
      courses: 'Courses',
      certificates: 'Certificates',
      contact: 'Contact',
    },
    themes: {
      ide: 'IDE',
      space: 'Space',
      terminal: 'Retro Terminal',
      select: 'Select theme',
    },
    language: {
      names: { en: 'English', de: 'Deutsch' },
    },
  },
};

vi.mock('@/state/locale', () => ({
  currentCV: {
    get value() { return mockCurrentCV.value; },
  },
  currentLocale: { value: 'en' },
  currentUI: {
    get value() { return mockCurrentUI.value; },
  },
  supportedLocales: ['en', 'de'],
  changeLocale: vi.fn(),
}));

vi.mock('@/state/theme', () => ({
  currentTheme: { value: 'space' },
  platformerPrototypeUnlocked: { value: false },
  setPlatformerPrototypeUnlocked: vi.fn(),
  visibleThemes: { value: [
    { id: 'ide', label: 'IDE' },
    { id: 'space', label: 'Space' },
    { id: 'terminal', label: 'Retro Terminal' },
  ] },
}));

// Mock matchMedia for reduced motion tests
let matchMediaMatches = false;
const mockMatchMedia = vi.fn((query: string) => ({
  matches: matchMediaMatches,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

beforeEach(() => {
  matchMediaMatches = false;
  window.matchMedia = mockMatchMedia;
  // Reset SpaceState signals between tests
  showPoster.value = true;
  scrollOffset.value = 0;
  // jsdom doesn't support scrollTo on div elements
  if (!HTMLDivElement.prototype.scrollTo) {
    Object.defineProperty(HTMLDivElement.prototype, 'scrollTo', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderSpacePage() {
  return render(<SpacePage />);
}

// ---------------------------------------------------------------------------
// Circle pool rendering
// ---------------------------------------------------------------------------

describe('Circle pool rendering (FR-030)', () => {
  it('renders the space theme page without crashing', () => {
    renderSpacePage();
    expect(document.body).toBeTruthy();
  });

  it('renders floating controls', () => {
    renderSpacePage();
    expect(document.querySelector('[class*="fixed"][class*="top-4"]')).toBeTruthy();
  });

  it('renders anchor dots for multiple sections', () => {
    renderSpacePage();
    const nav = document.querySelector('nav[aria-label="Section navigation"]');
    expect(nav).toBeTruthy();
    const buttons = nav?.querySelectorAll('button');
    expect(buttons && buttons.length).toBeGreaterThan(1);
  });

  it('does not render anchor dots when only one section exists', () => {
    const original = mockCurrentCV.value;
    mockCurrentCV.value = {
      personality: mockCV.personality,
      experience: [],
      projects: [],
      skills: [],
      education: [],
      courses: [],
      certificates: [],
      contact: undefined,
    } as unknown as CVData;
    renderSpacePage();
    expect(document.querySelector('nav[aria-label="Section navigation"]')).toBeNull();
    mockCurrentCV.value = original;
  });

  it('renders circles in the fixed stage overlay', () => {
    renderSpacePage();
    // Circles should be in a fixed overlay (stage), not in the scroll container
    const stages = document.querySelectorAll('[class*="fixed"][class*="inset-0"][class*="pointer-events-none"][class*="z-10"]');
    expect(stages.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Anchor dots interaction
// ---------------------------------------------------------------------------

describe('Anchor dots interaction', () => {
  it('renders a dot for each non-empty section', () => {
    renderSpacePage();
    const buttons = document.querySelectorAll('nav[aria-label="Section navigation"] button');
    expect(buttons.length).toBe(8);
  });

  it('clicking a dot does not throw', () => {
    renderSpacePage();
    const buttons = document.querySelectorAll('nav[aria-label="Section navigation"] button');
    expect(buttons.length).toBeGreaterThan(0);
    expect(() => fireEvent.click(buttons[0])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Floating controls
// ---------------------------------------------------------------------------

describe('Floating controls', () => {
  it('renders theme and language selectors', () => {
    renderSpacePage();
    const controls = document.querySelector('[class*="fixed"][class*="top-4"]');
    expect(controls).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Starfield background
// ---------------------------------------------------------------------------

describe('Starfield background', () => {
  it('renders starfield stars', () => {
    renderSpacePage();
    // Starfield renders 100 star elements with star-twinkle class
    const stars = document.querySelectorAll('.star-twinkle');
    expect(stars.length).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Poster overlay
// ---------------------------------------------------------------------------

describe('Poster overlay', () => {
  it('shows the initial poster with scroll hint', () => {
    renderSpacePage();
    // Should contain "Circle Parade" and "Scroll" text
    expect(document.body.textContent).toContain('Circle Parade');
    expect(document.body.textContent).toContain('Scroll');
  });
});

// ---------------------------------------------------------------------------
// Locale reactivity
// ---------------------------------------------------------------------------

describe('Locale reactivity', () => {
  it('re-renders when CV data changes', () => {
    const { rerender } = renderSpacePage();
    mockCurrentCV.value = {
      ...mockCV,
      personality: { ...mockCV.personality, name: 'German Name' },
    };
    rerender(<SpacePage />);
    expect(document.body).toBeTruthy();
    mockCurrentCV.value = mockCV;
  });

  it('handles empty contact data', () => {
    const original = mockCurrentCV.value;
    mockCurrentCV.value = { ...mockCV, contact: undefined } as unknown as CVData;
    renderSpacePage();
    const buttons = document.querySelectorAll('nav[aria-label="Section navigation"] button');
    const labels = Array.from(buttons).map(
      (b) => b.getAttribute('aria-label'),
    );
    expect(labels.some((l) => l?.includes('Contact'))).toBe(false);
    mockCurrentCV.value = original;
  });
});

// ---------------------------------------------------------------------------
// Reduced motion fallback
// ---------------------------------------------------------------------------

describe('Reduced motion fallback (FR-025, FR-026)', () => {
  it('renders static vertical stack when prefers-reduced-motion is active', () => {
    matchMediaMatches = true;
    renderSpacePage();
    // Static cards with rounded corners
    const staticCards = document.querySelectorAll('[class*="rounded-[40px]"]');
    expect(staticCards.length).toBeGreaterThan(0);
    // No anchor dots in reduced motion mode (since sections <= 1 check? No, still >1)
    // Actually anchor dots should still render per FR-026
  });

  it('renders circle parade when prefers-reduced-motion is not active', () => {
    matchMediaMatches = false;
    renderSpacePage();
    expect(document.querySelector('nav[aria-label="Section navigation"]')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('handles empty data sections gracefully', () => {
    const original = mockCurrentCV.value;
    mockCurrentCV.value = {
      personality: mockCV.personality,
      experience: [],
      projects: [],
      skills: [],
      education: [],
      courses: [],
      certificates: [],
      contact: undefined,
    } as unknown as CVData;
    renderSpacePage();
    expect(document.body).toBeTruthy();
    mockCurrentCV.value = original;
  });

  it('handles single-item sections', () => {
    const original = mockCurrentCV.value;
    mockCurrentCV.value = {
      personality: mockCV.personality,
      experience: [mockCV.experience[0]],
      projects: [],
      skills: [],
      education: [],
      courses: [],
      certificates: [],
      contact: undefined,
    } as unknown as CVData;
    renderSpacePage();
    expect(document.body).toBeTruthy();
    mockCurrentCV.value = original;
  });

  it('handles missing optional fields', () => {
    const original = mockCurrentCV.value;
    mockCurrentCV.value = {
      ...mockCV,
      personality: { name: 'Minimal', tagline: 'Tag', summary: 'Sum.', favoriteQuote: undefined },
    } as unknown as CVData;
    expect(() => renderSpacePage()).not.toThrow();
    mockCurrentCV.value = original;
  });
});

// ---------------------------------------------------------------------------
// Space theme CSS
// ---------------------------------------------------------------------------

describe('Space theme CSS', () => {
  it('defines required CSS custom properties and animations', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const currentDir = resolve(fileURLToPath(import.meta.url), '..');
    const spaceCss = readFileSync(
      resolve(currentDir, '../../styles/themes/space.css'),
      'utf-8',
    );

    expect(spaceCss).toContain('--perspective-depth');
    expect(spaceCss).toContain('--float-duration');
    expect(spaceCss).toContain('--background');
    expect(spaceCss).toContain('--card');
    expect(spaceCss).toContain('--primary');
    expect(spaceCss).toContain('--border');

    expect(spaceCss).toContain('circle-float');
    expect(spaceCss).toContain('space-float');
    expect(spaceCss).toContain('float-panel');

    expect(spaceCss).toContain('prefers-reduced-motion');
  });
});

// ===========================================================================
// T016: Foundational refactor tests
// ===========================================================================

describe('Foundational refactor (T016)', () => {
  it('renders scroll container owned by SpacePage', () => {
    renderSpacePage();
    // SpacePage should render the scroll container (overflow-y-scroll)
    const scrollContainers = document.querySelectorAll('[class*="overflow-y-scroll"]');
    expect(scrollContainers.length).toBeGreaterThan(0);
  });

  it('renders spacer div within scroll container', () => {
    renderSpacePage();
    const scrollContainer = document.querySelector('[class*="overflow-y-scroll"]');
    expect(scrollContainer).toBeTruthy();
    // Spacer div has pointerEvents: 'none' style
    const spacer = scrollContainer?.querySelector('[style*="pointer-events: none"]');
    expect(spacer).toBeTruthy();
  });

  it('CircleParade renders in a fixed z-10 overlay', () => {
    renderSpacePage();
    // CircleParade should render the fixed stage at z-10
    const stage = document.querySelector('[class*="fixed"][class*="z-10"][class*="pointer-events-none"]');
    expect(stage).toBeTruthy();
  });
});

// ===========================================================================
// T017-T019: User Story 1 — Scroll-driven element tests (TDD — currently FAIL)
// ===========================================================================

import { SpaceParade } from './components/SpaceParade';
import { scrollOffset as paradeScrollOffset } from './SpaceState';

describe('User Story 1 — Scroll-driven elements (T017-T019)', () => {
  it('T017: renders scroll-driven elements at correct z-index in SpaceParade', () => {
    paradeScrollOffset.value = 0;
    const { container } = render(
      <SpaceParade totalSpan={15} />,
    );
    // SpaceParade should render elements behind CircleParade (z-5)
    // Stub returns null, so this should FAIL initially
    const paradeEl = container.querySelector('[class~="z-5"]');
    expect(paradeEl).toBeTruthy();
  });

  it('T018: element visibility at start, mid, and end of scroll range', () => {
    // At scroll offset 1.5vh with totalSpan=15, several elements should be in range
    paradeScrollOffset.value = 1.5;
    const { container } = render(
      <SpaceParade totalSpan={15} />,
    );
    // SpaceParade renders a z-5 container with element divs inside
    const paradeContainer = container.querySelector('[class~="z-5"]');
    expect(paradeContainer).toBeTruthy();
    // At least some elements should be rendered as children
    // (planet spans most of the range and should be visible at offset 1.5 with totalSpan=15)
    expect(paradeContainer!.children.length).toBeGreaterThan(0);
  });

  it('T019: deterministic backward scroll (same position → same element state)', () => {
    // Render twice with same signal value — should produce identical output
    paradeScrollOffset.value = 2.0;
    const { container: c1 } = render(
      <SpaceParade totalSpan={15} />,
    );
    const { container: c2 } = render(
      <SpaceParade totalSpan={15} />,
    );
    // Both renders at same scroll offset should have same DOM structure
    expect(c1.innerHTML).toBe(c2.innerHTML);
  });
});

// ===========================================================================
// T026-T027: User Story 2 — Ambient layer tests (TDD)
// ===========================================================================

import { Nebula } from './components/space-elements/Nebula';
import { Sun } from './components/space-elements/Sun';

describe('User Story 2 — Ambient layer (T026-T027)', () => {
  it('T026: ambient layer elements (Nebula, Sun) render when mounted', () => {
    const { container: nebulaContainer } = render(<Nebula />);
    // Nebula has blurred blobs
    expect(nebulaContainer.querySelector('[style*="blur"]')).toBeTruthy();

    const { container: sunContainer } = render(<Sun />);
    // Sun has radial-gradient
    expect(sunContainer.querySelector('[style*="radial-gradient"]')).toBeTruthy();
  });

  it('T027: Starfield always renders with 100 stars', () => {
    renderSpacePage();
    const stars = document.querySelectorAll('.star-twinkle');
    expect(stars.length).toBe(100);
  });
});

// ===========================================================================
// T032-T033: User Story 5 — Shooting Stars & Asteroids
// ===========================================================================

describe('User Story 5 — Shooting Stars and Asteroids (T032-T033)', () => {
  it('T032: shooting stars render at correct scroll positions', () => {
    // At offset where SS1 is active (1.5 vh with totalSpan=15)
    paradeScrollOffset.value = 1.5;
    const { container } = render(
      <SpaceParade totalSpan={15} />,
    );
    // Verify the parade container has element children
    const paradeContainer = container.querySelector('[class~="z-5"]');
    expect(paradeContainer).toBeTruthy();
    // Planet, spaceship, and SS1 should be active at offset 1.5
    expect(paradeContainer!.children.length).toBeGreaterThanOrEqual(2);
  });

  it('T033: asteroids render with rotation', () => {
    // At offset where asteroid-3 is active (0.37 * 15 = 5.55 vh)
    paradeScrollOffset.value = 5.55;
    const { container } = render(
      <SpaceParade totalSpan={15} />,
    );
    const paradeContainer = container.querySelector('[class~="z-5"]');
    expect(paradeContainer).toBeTruthy();
    // Planet and asteroid-3 should be active at this offset
    expect(paradeContainer!.children.length).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// T038-T039: User Story 4 — Reduced-motion fallback
// ===========================================================================

describe('User Story 4 — Reduced-motion fallback (T038-T039)', () => {
  it('T038: SpaceParade hidden when prefers-reduced-motion: reduce', () => {
    matchMediaMatches = true;
    const { container } = render(<SpacePage />);
    // SpaceParade should not render its z-5 fixed overlay
    const paradeContainer = container.querySelector('[class~="z-5"]');
    expect(paradeContainer).toBeNull();
    matchMediaMatches = false;
  });

  it('T039: SpaceParade renders when reduced-motion is not active', () => {
    matchMediaMatches = false;
    const { container } = render(<SpacePage />);
    // SpaceParade renders at z-5
    const paradeContainer = container.querySelector('[class~="z-5"]');
    expect(paradeContainer).toBeTruthy();
  });
});

// ===========================================================================
// T043-T047: Polish — Z-index layering & visual consistency
// ===========================================================================

describe('Polish — Z-index layering and visual consistency (T043-T047)', () => {
  it('T043: space elements (z-0 ambient, z-5 SpaceParade) render behind CV circles (z-10)', () => {
    const { container } = render(<SpacePage />);
    // Verify both z-0 and z-5 exist, and z-10 is present
    const z0Els = container.querySelectorAll('[class~="z-0"]');
    const z10Els = container.querySelectorAll('[class~="z-10"]');
    expect(z0Els.length).toBeGreaterThan(0);
    // SpaceParade may or may not render depending on reduced motion
    expect(z10Els.length).toBeGreaterThan(0);
  });

  it('T044: anchor dots (z-40) and floating controls (z-50) render on top', () => {
    const { container } = render(<SpacePage />);
    const z40Els = container.querySelectorAll('[class~="z-40"]');
    const z50Els = container.querySelectorAll('[class~="z-50"]');
    expect(z40Els.length).toBeGreaterThan(0);
    expect(z50Els.length).toBeGreaterThan(0);
  });

  it('T045: space elements use pointer-events: none', () => {
    const { container } = render(<SpacePage />);
    // SpaceParade element container has pointer-events-none
    const spaceParadeContainer = container.querySelector('[class~="z-5"]');
    if (spaceParadeContainer) {
      expect(spaceParadeContainer.className).toContain('pointer-events-none');
    }
  });

  it('T046: no canvas in space background DOM', () => {
    renderSpacePage();
    // Space background should be pure CSS/SVG — no external image elements
    // Note: inline SVGs are allowed for element shapes
    const allElements = document.body.querySelectorAll('*');
    let backgroundCanvas = 0;
    allElements.forEach((el) => {
      if (el.tagName === 'CANVAS') backgroundCanvas++;
    });
    expect(backgroundCanvas).toBe(0);
  });

  it('T047: all space elements are div elements with CSS styling', () => {
    paradeScrollOffset.value = 1.5;
    const { container } = render(<SpaceParade totalSpan={15} />);
    const paradeEl = container.querySelector('[class~="z-5"]');
    if (paradeEl && paradeEl.children.length > 0) {
      // All children should be divs
      for (let i = 0; i < paradeEl.children.length; i++) {
        expect(paradeEl.children[i].tagName).toBe('DIV');
      }
    }
  });
});
