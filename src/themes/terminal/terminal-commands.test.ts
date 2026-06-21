import { describe, it, expect } from 'vitest';
import { parseCommand, executeCommand } from './terminal-commands';

describe('parseCommand', () => {
  // --- Edge cases ---
  it('parseCommand-empty-input-returns-empty-command-and-no-args', () => {
    // Arrange
    const input = '';
    // Act
    const result = parseCommand(input);
    // Assert
    expect(result).toEqual({ command: '', args: [] });
  });

  it('parseCommand-whitespace-only-returns-empty-command', () => {
    // Arrange
    const input = '   ';
    // Act
    const result = parseCommand(input);
    // Assert
    expect(result).toEqual({ command: '', args: [] });
  });

  // --- Valid command parsing ---
  it('parseCommand-valid-command-without-args-parses-correctly', () => {
    // Arrange
    const input = ':help';
    // Act
    const result = parseCommand(input);
    // Assert
    expect(result).toEqual({ command: ':help', args: [] });
  });

  it('parseCommand-valid-command-with-args-parses-correctly', () => {
    // Arrange
    const input = ':theme ide';
    // Act
    const result = parseCommand(input);
    // Assert
    expect(result).toEqual({ command: ':theme', args: ['ide'] });
  });

  it('parseCommand-multiple-args-returns-all-args', () => {
    // Arrange
    const input = ':theme space terminal';
    // Act
    const result = parseCommand(input);
    // Assert
    expect(result).toEqual({ command: ':theme', args: ['space', 'terminal'] });
  });

  // --- Whitespace handling ---
  it('parseCommand-leading-whitespace-is-trimmed', () => {
    // Arrange
    const input = '  :help';
    // Act
    const result = parseCommand(input);
    // Assert
    expect(result).toEqual({ command: ':help', args: [] });
  });

  it('parseCommand-trailing-whitespace-is-trimmed', () => {
    // Arrange
    const input = ':help  ';
    // Act
    const result = parseCommand(input);
    // Assert
    expect(result).toEqual({ command: ':help', args: [] });
  });

  it('parseCommand-extra-spaces-around-args-are-trimmed', () => {
    // Arrange
    const input = ':theme   ide  ';
    // Act
    const result = parseCommand(input);
    // Assert
    expect(result).toEqual({ command: ':theme', args: ['ide'] });
  });

  // --- Case insensitivity ---
  it('parseCommand-uppercase-command-is-lowercased', () => {
    // Arrange
    const input = ':HELP';
    // Act
    const result = parseCommand(input);
    // Assert
    expect(result).toEqual({ command: ':help', args: [] });
  });

  it('parseCommand-mixed-case-command-is-lowercased', () => {
    // Arrange
    const input = ':Help';
    // Act
    const result = parseCommand(input);
    // Assert
    expect(result).toEqual({ command: ':help', args: [] });
  });

  // --- Argument extraction ---
  it('parseCommand-theme-with-ide-arg-extracts-correctly', () => {
    // Arrange
    const input = ':theme ide';
    // Act
    const result = parseCommand(input);
    // Assert
    expect(result.command).toBe(':theme');
    expect(result.args).toContain('ide');
  });

  it('parseCommand-lang-with-de-arg-extracts-correctly', () => {
    // Arrange
    const input = ':lang de';
    // Act
    const result = parseCommand(input);
    // Assert
    expect(result.command).toBe(':lang');
    expect(result.args).toContain('de');
  });

  it('parseCommand-leaves-args-case-as-typed', () => {
    // Arrange
    const input = ':lang DE';
    // Act
    const result = parseCommand(input);
    // Assert
    expect(result.args).toContain('DE');
  });
});

describe('executeCommand', () => {
  // --- Empty input ---
  it('executeCommand-empty-input-returns-none', () => {
    // Arrange
    const input = '';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result.type).toBe('none');
  });

  it('executeCommand-whitespace-input-returns-none', () => {
    // Arrange
    const input = '   ';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result.type).toBe('none');
  });

  // --- Section commands ---
  const sectionCommands = [
    { cmd: ':me', target: 'me' },
    { cmd: ':exp', target: 'exp' },
    { cmd: ':skills', target: 'skills' },
    { cmd: ':projs', target: 'projs' },
    { cmd: ':edu', target: 'edu' },
    { cmd: ':crs', target: 'crs' },
    { cmd: ':certs', target: 'certs' },
    { cmd: ':contact', target: 'contact' },
  ] as const;

  sectionCommands.forEach(({ cmd, target }) => {
    it(`executeCommand-${cmd.slice(1)}-returns-navigate-${target}`, () => {
      // Arrange
      const input = cmd;
      // Act
      const result = executeCommand(input);
      // Assert
      expect(result).toEqual({ type: 'navigate', target });
    });
  });

  // --- Case insensitivity for commands ---
  it('executeCommand-uppercase-HELP-returns-help', () => {
    // Arrange
    const input = ':HELP';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result.type).toBe('help');
  });

  it('executeCommand-mixed-case-Help-returns-help', () => {
    // Arrange
    const input = ':Help';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result.type).toBe('help');
  });

  // --- System commands ---
  it('executeCommand-help-returns-help-type', () => {
    // Arrange
    const input = ':help';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result).toEqual({ type: 'help' });
  });

  it('executeCommand-cls-returns-clear-type', () => {
    // Arrange
    const input = ':cls';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result).toEqual({ type: 'clear' });
  });

  it('executeCommand-reset-returns-reset-type', () => {
    // Arrange
    const input = ':reset';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result).toEqual({ type: 'reset' });
  });

  // --- :theme command ---
  it('executeCommand-theme-ide-returns-theme-ide', () => {
    // Arrange
    const input = ':theme ide';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result).toEqual({ type: 'theme', themeId: 'ide' });
  });

  it('executeCommand-theme-space-returns-theme-space', () => {
    // Arrange
    const input = ':theme space';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result).toEqual({ type: 'theme', themeId: 'space' });
  });

  it('executeCommand-theme-terminal-returns-theme-terminal', () => {
    // Arrange
    const input = ':theme terminal';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result).toEqual({ type: 'theme', themeId: 'terminal' });
  });

  // --- :lang command ---
  it('executeCommand-lang-en-returns-lang-en', () => {
    // Arrange
    const input = ':lang en';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result).toEqual({ type: 'lang', locale: 'en' });
  });

  it('executeCommand-lang-de-returns-lang-de', () => {
    // Arrange
    const input = ':lang de';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result).toEqual({ type: 'lang', locale: 'de' });
  });

  // --- Error cases ---
  it('executeCommand-unknown-command-returns-error', () => {
    // Arrange
    const input = ':foo';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result.type).toBe('error');
    if (result.type === 'error') {
      expect(result.message).toContain('Unknown command');
    }
  });

  it('executeCommand-invalid-theme-returns-error', () => {
    // Arrange
    const input = ':theme foo';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result.type).toBe('error');
    if (result.type === 'error') {
      expect(result.message).toContain('Invalid theme');
      expect(result.message).toContain('foo');
    }
  });

  it('executeCommand-theme-without-arg-returns-error', () => {
    // Arrange
    const input = ':theme';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result.type).toBe('error');
    if (result.type === 'error') {
      expect(result.message).toContain('Invalid theme');
    }
  });

  it('executeCommand-invalid-lang-returns-error', () => {
    // Arrange
    const input = ':lang fr';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result.type).toBe('error');
    if (result.type === 'error') {
      expect(result.message).toContain('Invalid locale');
      expect(result.message).toContain('fr');
    }
  });

  it('executeCommand-lang-without-arg-returns-error', () => {
    // Arrange
    const input = ':lang';
    // Act
    const result = executeCommand(input);
    // Assert
    expect(result.type).toBe('error');
    if (result.type === 'error') {
      expect(result.message).toContain('Invalid locale');
    }
  });
});
