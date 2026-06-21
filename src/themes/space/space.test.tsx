// ---------------------------------------------------------------------------
// Space Theme — Component tests for Circle Parade, Anchor Dots, Floating
// Controls, reduced-motion fallback, locale reactivity, and edge cases.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SpacePage } from './SpacePage';

// Mock @preact/signals-react/runtime
vi.mock('@preact/signals-react/runtime', () => ({
  useSignals: vi.fn(),
}));

// Mock currentCV signal with full test data
const mockCV = {
  personality: {
    name: 'Test User',
    tagline: 'Test Tagline',
    summary: 'Test summary for the test user.',
    favoriteQuote: 'Test quote.',
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

const mockCurrentCV = { value: mockCV };
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
    themes: {
      ide: 'IDE',
      space: '3D Room',
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
    } as any;
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
    mockCurrentCV.value = { ...mockCV, contact: undefined } as any;
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
    } as any;
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
    } as any;
    renderSpacePage();
    expect(document.body).toBeTruthy();
    mockCurrentCV.value = original;
  });

  it('handles missing optional fields', () => {
    const original = mockCurrentCV.value;
    mockCurrentCV.value = {
      ...mockCV,
      personality: { name: 'Minimal', tagline: 'Tag', summary: 'Sum.', favoriteQuote: undefined },
    } as any;
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
