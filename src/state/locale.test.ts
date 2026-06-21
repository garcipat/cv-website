import { describe, it, expect, vi, beforeEach } from 'vitest';

function stubNavigatorLanguage(value: string | undefined | (() => never)): void {
  if (typeof value === 'function') {
    Object.defineProperty(navigator, 'language', { get: value, configurable: true });
  } else {
    Object.defineProperty(navigator, 'language', { value, configurable: true });
  }
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  stubNavigatorLanguage('en-US');
});

describe('getBrowserLocale', () => {
  async function importModule() {
    await vi.resetModules();
    return import('@/state/locale');
  }

  it.each([
    ['de-DE', 'de'],
    ['de', 'de'],
    ['de-AT', 'de'],
    ['de-CH', 'de'],
  ])('returns "de" for navigator.language "%s"', async (lang, expected) => {
    stubNavigatorLanguage(lang);
    const { getBrowserLocale } = await importModule();
    expect(getBrowserLocale()).toBe(expected);
  });

  it.each([
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['en', 'en'],
  ])('returns "en" for navigator.language "%s"', async (lang, expected) => {
    stubNavigatorLanguage(lang);
    const { getBrowserLocale } = await importModule();
    expect(getBrowserLocale()).toBe(expected);
  });

  it('returns "en" fallback for unsupported language "fr"', async () => {
    vi.stubGlobal('navigator', { language: 'fr' });
    const { getBrowserLocale } = await importModule();
    expect(getBrowserLocale()).toBe('en');
  });

  it('returns "en" fallback for "es"', async () => {
    vi.stubGlobal('navigator', { language: 'es' });
    const { getBrowserLocale } = await importModule();
    expect(getBrowserLocale()).toBe('en');
  });

  it('returns "en" when navigator.language is undefined', async () => {
    stubNavigatorLanguage(undefined);
    const { getBrowserLocale } = await importModule();
    expect(getBrowserLocale()).toBe('en');
  });

  it('returns "en" when navigator.language throws', async () => {
    stubNavigatorLanguage(() => { throw new Error('unavailable'); });
    const { getBrowserLocale } = await importModule();
    expect(getBrowserLocale()).toBe('en');
  });
});

describe('currentLocale', () => {
  async function importModule() {
    await vi.resetModules();
    return import('@/state/locale');
  }

  it('initializes from browser detection when localStorage is empty (de)', async () => {
    vi.stubGlobal('navigator', { language: 'de' });
    const { currentLocale } = await importModule();
    expect(currentLocale.value).toBe('de');
  });

  it('initializes from browser detection when localStorage is empty (en)', async () => {
    vi.stubGlobal('navigator', { language: 'en' });
    const { currentLocale } = await importModule();
    expect(currentLocale.value).toBe('en');
  });
});

describe('currentCV', () => {
  async function importModule() {
    await vi.resetModules();
    return import('@/state/locale');
  }

  it('returns German CV data when locale is "de"', async () => {
    const { currentLocale, currentCV } = await importModule();
    currentLocale.value = 'de';
    expect(currentCV.value.personality.name).toBe('Julia Entwicklerin');
    expect(currentCV.value.personality.tagline).toContain('Frontend-Ingenieurin');
  });

  it('returns English CV data when locale is "en"', async () => {
    const { currentLocale, currentCV } = await importModule();
    currentLocale.value = 'en';
    expect(currentCV.value.personality.name).toBe('Jane Developer');
    expect(currentCV.value.personality.tagline).toContain('Frontend Engineer');
  });
});

describe('currentUI', () => {
  async function importModule() {
    await vi.resetModules();
    return import('@/state/locale');
  }

  it('returns German UI translations when locale is "de"', async () => {
    const { currentLocale, currentUI } = await importModule();
    currentLocale.value = 'de';
    expect(currentUI.value.nav.experience).toBe('Erfahrung');
    expect(currentUI.value.nav.skills).toBe('Kenntnisse');
    expect(currentUI.value.language.switchTo).toBe('Zu Englisch wechseln');
    expect(currentUI.value.themes.space).toBe('Space');
  });

  it('returns English UI translations when locale is "en"', async () => {
    const { currentLocale, currentUI } = await importModule();
    currentLocale.value = 'en';
    expect(currentUI.value.nav.experience).toBe('Experience');
    expect(currentUI.value.nav.skills).toBe('Skills');
    expect(currentUI.value.language.switchTo).toBe('Switch language to Deutsch');
    expect(currentUI.value.themes.ide).toBe('IDE');
  });
});

describe('changeLocale DOM side effects', () => {
  async function importModule() {
    await vi.resetModules();
    return import('@/state/locale');
  }

  beforeEach(() => {
    document.title = '';
    document.documentElement.lang = '';
    const existing = document.querySelector('meta[name="description"]');
    if (existing) existing.remove();
  });

  it('updates document.documentElement.lang to "de" when switching to German', async () => {
    const { changeLocale } = await importModule();
    changeLocale('de');
    expect(document.documentElement.lang).toBe('de');
  });

  it('updates document.documentElement.lang to "en" when switching to English', async () => {
    const { changeLocale } = await importModule();
    changeLocale('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('updates document.title to German page title', async () => {
    const { changeLocale } = await importModule();
    changeLocale('de');
    expect(document.title).toBe('Lebenslauf — Julia Entwicklerin');
  });

  it('updates document.title to English page title', async () => {
    const { changeLocale } = await importModule();
    changeLocale('en');
    expect(document.title).toBe('Curriculum Vitae — Julia Developer');
  });

  it('updates meta description content to German', async () => {
    const { changeLocale } = await importModule();
    changeLocale('de');
    const meta = document.querySelector('meta[name="description"]');
    expect(meta).not.toBeNull();
    expect(meta!.getAttribute('content')).toBe(
      'Professioneller Lebenslauf und Portfolio von Julia Entwicklerin, Senior Frontend-Ingenieurin & UI-Architektin.',
    );
  });

  it('updates meta description content to English', async () => {
    const { changeLocale } = await importModule();
    changeLocale('en');
    const meta = document.querySelector('meta[name="description"]');
    expect(meta).not.toBeNull();
    expect(meta!.getAttribute('content')).toBe(
      'Professional CV and portfolio of Julia Developer, Senior Frontend Engineer & UI Architect.',
    );
  });

  it('creates meta description tag on module init if absent', async () => {
    expect(document.querySelector('meta[name="description"]')).toBeNull();
    await importModule();
    expect(document.querySelector('meta[name="description"]')).not.toBeNull();
  });

  it('ignores invalid locale and does not throw', async () => {
    const { changeLocale, currentLocale } = await importModule();
    currentLocale.value = 'en';
    expect(() => changeLocale('fr' as never)).not.toThrow();
    expect(currentLocale.value).toBe('en');
  });
});

describe('locale persistence (US3)', () => {
  async function importModule() {
    await vi.resetModules();
    return import('@/state/locale');
  }

  it('reads stored "de" from localStorage on init', async () => {
    localStorage.setItem('locale', JSON.stringify('de'));
    vi.stubGlobal('navigator', { language: 'en-US' });
    const { currentLocale } = await importModule();
    expect(currentLocale.value).toBe('de');
  });

  it('reads stored "en" from localStorage on init', async () => {
    localStorage.setItem('locale', JSON.stringify('en'));
    vi.stubGlobal('navigator', { language: 'de' });
    const { currentLocale } = await importModule();
    expect(currentLocale.value).toBe('en');
  });

  it('ignores invalid stored locale "fr" and falls back to browser detection', async () => {
    localStorage.setItem('locale', JSON.stringify('fr'));
    vi.stubGlobal('navigator', { language: 'de' });
    const { currentLocale } = await importModule();
    expect(currentLocale.value).toBe('de');
  });

  it('ignores corrupted localStorage JSON and falls back to browser detection', async () => {
    localStorage.setItem('locale', '{broken');
    vi.stubGlobal('navigator', { language: 'en' });
    const { currentLocale } = await importModule();
    expect(currentLocale.value).toBe('en');
  });

  it('persists locale change to localStorage', async () => {
    const { changeLocale } = await importModule();
    changeLocale('de');
    expect(JSON.parse(localStorage.getItem('locale')!)).toBe('de');
    changeLocale('en');
    expect(JSON.parse(localStorage.getItem('locale')!)).toBe('en');
  });

  it('still updates in-memory value when localStorage.setItem throws', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage full');
    });
    const { currentLocale } = await importModule();
    currentLocale.value = 'de';
    expect(currentLocale.value).toBe('de');
    setItemSpy.mockRestore();
  });
});
