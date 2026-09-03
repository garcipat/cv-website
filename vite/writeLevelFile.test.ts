import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeLevelFile } from './writeLevelFile';
import { LEVELS_FOLDER } from '../src/themes/platformer/editor/saveLevelEndpoint';

const VALID_CONTENTS = `${JSON.stringify({ name: 'Cave Run', layout: ['.S.', 'GGG'] }, null, 2)}\n`;

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'level-write-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const levelsPath = (fileName: string) => join(root, LEVELS_FOLDER, fileName);

describe('writeLevelFile', () => {
  it('validRequest-writesTheFileIntoTheLevelsFolder', () => {
    const result = writeLevelFile(root, { fileName: 'cave-run.json', contents: VALID_CONTENTS });

    expect(result.status).toBe(200);
    expect(readFileSync(levelsPath('cave-run.json'), 'utf8')).toBe(VALID_CONTENTS);
  });

  it('validRequest-reportsThePathItWroteRelativeToTheRepositoryRoot', () => {
    const result = writeLevelFile(root, { fileName: 'cave-run.json', contents: VALID_CONTENTS });

    expect(result.body.path).toBe(`${LEVELS_FOLDER}cave-run.json`);
  });

  it('missingLevelsFolder-isCreatedRatherThanFailing', () => {
    expect(existsSync(join(root, LEVELS_FOLDER))).toBe(false);

    const result = writeLevelFile(root, { fileName: 'cave-run.json', contents: VALID_CONTENTS });

    expect(result.status).toBe(200);
    expect(existsSync(levelsPath('cave-run.json'))).toBe(true);
  });

  it('existingFileOfTheSameName-isOverwritten', () => {
    mkdirSync(join(root, LEVELS_FOLDER), { recursive: true });
    writeFileSync(levelsPath('cave-run.json'), 'stale', 'utf8');

    writeLevelFile(root, { fileName: 'cave-run.json', contents: VALID_CONTENTS });

    expect(readFileSync(levelsPath('cave-run.json'), 'utf8')).toBe(VALID_CONTENTS);
  });

  describe('rejects anything that is not a slugified level file', () => {
    const rejected: Record<string, unknown> = {
      'a path segment': 'levels/cave-run.json',
      'a parent-directory escape': '../../../evil.json',
      'a Windows-style escape': '..\\..\\evil.json',
      'an absolute path': '/etc/evil.json',
      'uppercase letters': 'CaveRun.json',
      'a non-json extension': 'cave-run.ts',
      'no extension': 'cave-run',
      'a dotfile': '.json',
      'an empty name': '',
      'a non-string': 42,
    };

    Object.entries(rejected).forEach(([label, fileName]) => {
      it(`${label}-isRejectedWithoutWritingAnything`, () => {
        const result = writeLevelFile(root, { fileName, contents: VALID_CONTENTS });

        expect(result.status).toBe(400);
        expect(result.body.error).toBeTruthy();
        expect(existsSync(join(root, LEVELS_FOLDER))).toBe(false);
      });
    });
  });

  describe('rejects contents the level registry would not accept', () => {
    const rejected: Record<string, unknown> = {
      'a non-string body': { name: 'x' },
      'an empty body': '',
      'unparseable JSON': '{ not json',
      'JSON without a layout': '{ "name": "x" }',
      'a layout that is not an array': '{ "layout": "GGG" }',
      'a layout of non-strings': '{ "layout": [1, 2] }',
      'an empty layout': '{ "layout": [] }',
    };

    Object.entries(rejected).forEach(([label, contents]) => {
      it(`${label}-isRejectedWithoutWritingAnything`, () => {
        const result = writeLevelFile(root, { fileName: 'cave-run.json', contents });

        expect(result.status).toBe(400);
        expect(result.body.error).toBeTruthy();
        expect(existsSync(levelsPath('cave-run.json'))).toBe(false);
      });
    });
  });
});
