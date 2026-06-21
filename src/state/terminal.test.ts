import { describe, it, expect, beforeEach } from 'vitest';
import {
  commandHistory,
  currentInput,
  cursorVisible,
  terminalOutput,
  executeCommand,
} from './terminal';

describe('terminal state signals', () => {
  beforeEach(() => {
    // Reset all signals to defaults
    commandHistory.value = [];
    currentInput.value = '';
    cursorVisible.value = true;
    terminalOutput.value = [];
  });

  describe('signal initialization', () => {
    it('commandHistory-initializes-as-empty-array', () => {
      expect(commandHistory.value).toEqual([]);
    });

    it('currentInput-initializes-as-empty-string', () => {
      expect(currentInput.value).toBe('');
    });

    it('cursorVisible-initializes-as-true', () => {
      expect(cursorVisible.value).toBe(true);
    });

    it('terminalOutput-initializes-as-empty-array', () => {
      expect(terminalOutput.value).toEqual([]);
    });
  });

  describe('commandHistory behavior', () => {
    it('commandHistory-appends-commands-in-order', () => {
      // Act
      commandHistory.value = [...commandHistory.value, ':help'];
      commandHistory.value = [...commandHistory.value, ':exp'];

      // Assert
      expect(commandHistory.value).toEqual([':help', ':exp']);
    });

    it('commandHistory-duplicate-consecutive-commands-are-added', () => {
      // Act
      commandHistory.value = [...commandHistory.value, ':help'];
      commandHistory.value = [...commandHistory.value, ':help'];

      // Assert
      expect(commandHistory.value).toEqual([':help', ':help']);
    });

    it('commandHistory-can-be-cleared', () => {
      // Arrange
      commandHistory.value = [':help', ':exp'];

      // Act
      commandHistory.value = [];

      // Assert
      expect(commandHistory.value).toEqual([]);
    });
  });

  describe('currentInput read/write', () => {
    it('currentInput-can-be-written-and-read', () => {
      // Act
      currentInput.value = ':help';

      // Assert
      expect(currentInput.value).toBe(':help');
    });

    it('currentInput-can-be-cleared-after-execution', () => {
      // Arrange
      currentInput.value = ':help';

      // Act
      currentInput.value = '';

      // Assert
      expect(currentInput.value).toBe('');
    });
  });

  describe('cursorVisible toggle', () => {
    it('cursorVisible-can-be-set-to-false', () => {
      // Act
      cursorVisible.value = false;

      // Assert
      expect(cursorVisible.value).toBe(false);
    });

    it('cursorVisible-can-be-toggled-back-to-true', () => {
      // Arrange
      cursorVisible.value = false;

      // Act
      cursorVisible.value = true;

      // Assert
      expect(cursorVisible.value).toBe(true);
    });
  });

  describe('terminalOutput append', () => {
    it('terminalOutput-appends-lines-in-order', () => {
      // Arrange
      const line1 = { type: 'command-echo' as const, command: ':help' };
      const line2 = { type: 'separator' as const };

      // Act
      terminalOutput.value = [...terminalOutput.value, line1, line2];

      // Assert
      expect(terminalOutput.value).toHaveLength(2);
      expect(terminalOutput.value[0]).toEqual(line1);
      expect(terminalOutput.value[1]).toEqual(line2);
    });

    it('terminalOutput-can-be-cleared', () => {
      // Arrange
      terminalOutput.value = [{ type: 'separator' as const }];

      // Act
      terminalOutput.value = [];

      // Assert
      expect(terminalOutput.value).toEqual([]);
    });
  });
});

describe('executeCommand', () => {
  beforeEach(() => {
    commandHistory.value = [];
    terminalOutput.value = [];
  });

  // --- Empty input ---
  it('executeCommand-empty-input-returns-none-type', () => {
    // Act
    const result = executeCommand('');
    // Assert
    expect(result.type).toBe('none');
  });

  it('executeCommand-whitespace-only-returns-none-type', () => {
    // Act
    const result = executeCommand('   ');
    // Assert
    expect(result.type).toBe('none');
  });
});
