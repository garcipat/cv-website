// ---------------------------------------------------------------------------
// Command parsing, validation, and execution logic for the Terminal theme
//
// This module is pure logic — no signal imports. All signal access happens
// in terminal.ts and React components.
// ---------------------------------------------------------------------------

import type { ThemeId } from '@/state/theme';
import type { Locale } from '@/state/locale';
import type { CVData } from '@/types/cv';
import type { Translation } from '@/i18n/translations';
import type { TerminalOutputLine } from '@/state/terminal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Structured result of command execution, consumed by TerminalPage. */
export type CommandResult =
  | { type: 'navigate'; target: SectionId }
  | { type: 'theme'; themeId: ThemeId }
  | { type: 'lang'; locale: Locale }
  | { type: 'clear' }
  | { type: 'help' }
  | { type: 'reset' }
  | { type: 'error'; message: string }
  | { type: 'none' }; // empty input, no action

/** Section identifiers matching :command names. */
export type SectionId =
  | 'me' | 'exp' | 'skills' | 'projs'
  | 'edu' | 'crs' | 'certs' | 'contact';

/** Maps command name to SectionId for section commands. */
export const SECTION_COMMANDS: Record<string, SectionId> = {
  ':me': 'me',
  ':exp': 'exp',
  ':skills': 'skills',
  ':projs': 'projs',
  ':edu': 'edu',
  ':crs': 'crs',
  ':certs': 'certs',
  ':contact': 'contact',
};

/** Valid themes for :theme command. */
export const VALID_THEMES: ThemeId[] = ['ide', 'space', 'terminal'];

/** Valid locales for :lang command. */
export const VALID_LOCALES: Locale[] = ['en', 'de'];

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parses a raw input string into a command name and list of arguments.
 *
 * - Trims leading/trailing whitespace
 * - Splits on first whitespace to separate command from arguments
 * - Normalizes command to lowercase
 * - Returns { command: '', args: [] } for empty or whitespace-only input
 */
export function parseCommand(input: string): { command: string; args: string[] } {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { command: '', args: [] };
  }

  const firstSpace = trimmed.indexOf(' ');
  if (firstSpace === -1) {
    return { command: trimmed.toLowerCase(), args: [] };
  }

  const command = trimmed.slice(0, firstSpace).toLowerCase();
  const rest = trimmed.slice(firstSpace + 1).trim();
  const args = rest.length > 0 ? rest.split(/\s+/) : [];

  return { command, args };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

/**
 * Validates and executes a command string.
 * Returns a CommandResult indicating what action TerminalPage should take.
 *
 * This is a pure function — no side effects on signals.
 * Signal updates happen in TerminalPage based on the returned CommandResult.
 */
export function executeCommand(input: string): CommandResult {
  const { command, args } = parseCommand(input);

  // Empty input → no action
  if (command === '') {
    return { type: 'none' };
  }

  // Section commands
  if (command in SECTION_COMMANDS) {
    return { type: 'navigate', target: SECTION_COMMANDS[command] };
  }

  // Built-in commands
  switch (command) {
    case ':help':
      return { type: 'help' };

    case ':cls':
      return { type: 'clear' };

    case ':reset':
      return { type: 'reset' };

    case ':theme': {
      const themeId = args[0] as ThemeId;
      if (!themeId || !(VALID_THEMES as readonly string[]).includes(themeId)) {
        return {
          type: 'error',
          message: `Invalid theme '${themeId || ''}'. Valid themes: ${VALID_THEMES.join(', ')}.`,
        };
      }
      return { type: 'theme', themeId };
    }

    case ':lang': {
      const locale = args[0] as Locale;
      if (!locale || !(VALID_LOCALES as readonly string[]).includes(locale)) {
        return {
          type: 'error',
          message: `Invalid locale '${locale || ''}'. Valid locales: ${VALID_LOCALES.join(', ')}.`,
        };
      }
      return { type: 'lang', locale };
    }

    default:
      return {
        type: 'error',
        message: `Unknown command '${command}'. Type :help for available commands.`,
      };
  }
}

// ---------------------------------------------------------------------------
// CV-to-Output-Line Conversion
// ---------------------------------------------------------------------------

/**
 * Builds the initial intro screen lines shown on first load / reset.
 */
export function buildIntroLines(cv: CVData, ui: Translation): TerminalOutputLine[] {
  const t = ui.terminal;
  return [
    { type: 'content', text: cv.personality?.name || 'Name', variant: 'bright' },
    { type: 'content', text: cv.personality?.tagline || 'Tagline' },
    { type: 'separator' },
    { type: 'content', text: t?.intro?.hint || 'Type a command to explore —', variant: 'dim' },
    { type: 'help-command', name: ':help', description: t?.commands?.help || 'List all available commands and sections', variant: 'accent' },
    { type: 'help-command', name: ':lang', description: `<en | de> — ${t?.commands?.lang ? 'switch language' : ''}`, variant: 'accent' },
    { type: 'help-command', name: ':theme', description: `<terminal | ide | space> — ${t?.commands?.theme ? 'switch visual theme' : ''}`, variant: 'accent' },
    { type: 'separator' },
    { type: 'content', text: `${cv.contact?.github || ''} · ${cv.contact?.email || ''}`, variant: 'dim' },
  ];
}

/**
 * Builds TerminalOutputLines for a single CV section.
 */
export function buildSectionLines(
  sectionId: string,
  cv: CVData,
  ui: Translation,
): TerminalOutputLine[] {
  const lines: TerminalOutputLine[] = [];

  const sectionLabels: Record<string, string> = {
    me: ui.terminal?.sections?.personality || 'PERSONALITY',
    exp: ui.terminal?.sections?.experience || 'EXPERIENCE',
    skills: ui.terminal?.sections?.skills || 'SKILLS',
    projs: ui.terminal?.sections?.projects || 'PROJECTS',
    edu: ui.terminal?.sections?.education || 'EDUCATION',
    crs: ui.terminal?.sections?.courses || 'COURSES',
    certs: ui.terminal?.sections?.certificates || 'CERTIFICATES',
    contact: ui.terminal?.sections?.contact || 'CONTACT',
  };

  lines.push({ type: 'section-header', sectionId, label: sectionLabels[sectionId] || sectionId.toUpperCase() });

  switch (sectionId) {
    case 'me': {
      const p = cv.personality;
      if (p) {
        lines.push({ type: 'content', text: p.name || '', variant: 'bright' });
        lines.push({ type: 'content', text: p.tagline || '' });
        lines.push({ type: 'separator' });
        // Split summary by newlines for multiple paragraphs
        const paragraphs = (p.summary || '').split('\n').filter(Boolean);
        paragraphs.forEach((para) => {
          lines.push({ type: 'content', text: para.trim() });
        });
        if (p.favoriteQuote) {
          lines.push({ type: 'content', text: `> ${p.favoriteQuote}`, variant: 'dim' });
        }
      }
      break;
    }

    case 'exp': {
      (cv.experience || []).forEach((exp) => {
        lines.push({ type: 'content', text: `${exp.role || ''} @ ${exp.company || ''}${exp.client ? ` — ${exp.client}` : ''}`, variant: 'bright' });
        const startYear = (exp.startDate || '').slice(0, 7);
        const endYear = exp.endDate ? exp.endDate.slice(0, 7) : 'present';
        lines.push({ type: 'content', text: `[${startYear} — ${endYear}]`, variant: 'dim' });
        (exp.highlights || []).forEach((h) => {
          lines.push({ type: 'bullet', text: h });
        });
        if (exp.skills && exp.skills.length > 0) {
          lines.push({
            type: 'content',
            text: exp.skills.join(' · '),
            variant: 'dim',
          });
        }
      });
      break;
    }

    case 'skills': {
      (cv.skills || []).forEach((cat) => {
        lines.push({ type: 'skills-category', name: cat.category || '' });
        (cat.skills || []).forEach((skill) => {
          lines.push({ type: 'skills-bar', name: skill.name || '', level: skill.level ?? 0 });
        });
      });
      break;
    }

    case 'projs': {
      (cv.projects || []).forEach((proj) => {
        lines.push({ type: 'content', text: proj.name || '', variant: 'bright' });
        lines.push({ type: 'content', text: proj.description || '' });
        if (proj.url) {
          lines.push({ type: 'link', text: proj.url, url: proj.url });
        }
        if (proj.githubUrl) {
          lines.push({ type: 'link', text: proj.githubUrl || '', url: proj.githubUrl || '' });
        }
        if (proj.skills && proj.skills.length > 0) {
          lines.push({
            type: 'tags',
            tags: proj.skills,
          });
        }
      });
      break;
    }

    case 'edu': {
      (cv.education || []).forEach((edu) => {
        const startYear = (edu.startDate || '').slice(0, 7);
        const endYear = edu.endDate ? edu.endDate.slice(0, 7) : 'present';
        lines.push({
          type: 'content',
          text: `${edu.degree || ''}`,
          variant: 'bright',
        });
        lines.push({
          type: 'content',
          text: `@ ${edu.institution || ''} [${startYear} — ${endYear}]`,
          variant: 'amber',
        });
        if (edu.description) {
          lines.push({ type: 'content', text: edu.description, variant: 'dim' });
        }
      });
      break;
    }

    case 'crs': {
      const sorted = [...(cv.courses || [])].sort((a, b) => b.date.localeCompare(a.date));
      for (const course of sorted) {
        const date = `[${(course.date || '').slice(0, 7)}]`;
        const cat = course.category ? `[${course.category}]` : '';
        lines.push({
          type: 'content-segments',
          segments: [
            { text: date, variant: 'amber' },
            { text: `  ${course.title || ''}`, variant: 'bright' },
          ],
        });
        lines.push({
          type: 'content-segments',
          segments: [
            { text: course.provider || '', variant: 'dim' },
            { text: cat ? `  ${cat}` : '', variant: 'dim' },
          ],
        });
        if (course.certificate) {
          lines.push({ type: 'link', text: course.certificate, url: course.certificate });
        }
      }
      break;
    }

    case 'certs': {
      (cv.certificates || []).forEach((cert) => {
        lines.push({
          type: 'content',
          text: `${cert.name || ''} — ${cert.issuer || ''} [${(cert.date || '').slice(0, 7)}]`,
        });
        if (cert.credentialId) {
          lines.push({ type: 'content', text: `ID: ${cert.credentialId}`, variant: 'dim' });
        }
        if (cert.url) {
          lines.push({ type: 'link', text: cert.url, url: cert.url });
        }
      });
      break;
    }

    case 'contact': {
      const c = cv.contact;
      if (c) {
        if (c.email) lines.push({ type: 'content', text: `Email: ${c.email}`, variant: 'amber' });
        if (c.phone) lines.push({ type: 'content', text: `Phone: ${c.phone}` });
        if (c.location) lines.push({ type: 'content', text: `Location: ${c.location}`, variant: 'dim' });
        if (c.website) lines.push({ type: 'link', text: c.website, url: c.website });
        if (c.linkedin) lines.push({ type: 'link', text: c.linkedin, url: c.linkedin });
        if (c.github) lines.push({ type: 'content', text: `GitHub: ${c.github}`, variant: 'amber' });
      }
      break;
    }
  }

  return lines;
}

/**
 * Builds output lines for all CV sections sequentially.
 */
export function buildFullCVLines(
  cv: CVData,
  ui: Translation,
): TerminalOutputLine[] {
  const allLines: TerminalOutputLine[] = [];
  const sections: SectionId[] = ['me', 'exp', 'skills', 'projs', 'edu', 'crs', 'certs', 'contact'];

  sections.forEach((sectionId) => {
    if (allLines.length > 0) {
      allLines.push({ type: 'separator' });
    }
    const sectionLines = buildSectionLines(sectionId, cv, ui);
    allLines.push(...sectionLines);
  });

  return allLines;
}

/**
 * Builds :help output lines.
 */
export function buildHelpLines(ui: Translation): TerminalOutputLine[] {
  const t = ui.terminal;
  const lines: TerminalOutputLine[] = [];

  // Navigation group
  lines.push({ type: 'help-group', title: t?.commandsNavigation || 'Navigation' });
  const navCommands = ['me', 'exp', 'projs', 'skills', 'edu', 'crs', 'certs', 'contact'] as const;
  navCommands.forEach((cmd) => {
    lines.push({
      type: 'help-command',
      name: `:${cmd}`,
      description: t?.commands?.[cmd] || '',
    });
  });

  // System group
  lines.push({ type: 'help-group', title: t?.commandsSystem || 'System' });
  const sysCommands = ['help', 'theme', 'lang', 'cls', 'reset'] as const;
  sysCommands.forEach((cmd) => {
    lines.push({
      type: 'help-command',
      name: `:${cmd}`,
      description: t?.commands?.[cmd] || '',
    });
  });

  lines.push({ type: 'help-footer', text: t?.helpFooter || 'Arrow Up/Down to jump between sections' });

  return lines;
}
