import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeLayoutJsonFile } from './writeLayoutJsonFile';

const FOLDER = 'some/nested/folder/';
const VALID_CONTENTS = `${JSON.stringify({ name: 'Room', layout: ['#G#'] }, null, 2)}\n`;

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'layout-write-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const targetPath = (fileName: string) => join(root, FOLDER, fileName);

describe('writeLayoutJsonFile', () => {
  it('validRequest-writesTheFileIntoTheGivenFolder', () => {
    const result = writeLayoutJsonFile(root, FOLDER, {
      fileName: 'room.json',
      contents: VALID_CONTENTS,
    });

    expect(result.status).toBe(200);
    expect(readFileSync(targetPath('room.json'), 'utf8')).toBe(VALID_CONTENTS);
  });

  it('validRequest-reportsThePathItWroteRelativeToTheRepositoryRoot', () => {
    const result = writeLayoutJsonFile(root, FOLDER, {
      fileName: 'room.json',
      contents: VALID_CONTENTS,
    });

    expect(result.body.path).toBe(`${FOLDER}room.json`);
  });

  it('missingFolder-isCreatedRatherThanFailing', () => {
    expect(existsSync(join(root, FOLDER))).toBe(false);

    writeLayoutJsonFile(root, FOLDER, { fileName: 'room.json', contents: VALID_CONTENTS });

    expect(existsSync(targetPath('room.json'))).toBe(true);
  });

  it('existingFileOfTheSameName-isOverwritten', () => {
    mkdirSync(join(root, FOLDER), { recursive: true });
    writeFileSync(targetPath('room.json'), 'stale', 'utf8');

    writeLayoutJsonFile(root, FOLDER, { fileName: 'room.json', contents: VALID_CONTENTS });

    expect(readFileSync(targetPath('room.json'), 'utf8')).toBe(VALID_CONTENTS);
  });

  it('fileNameThatEscapesTheFolder-isRejectedWithoutWritingAnything', () => {
    const result = writeLayoutJsonFile(root, FOLDER, {
      fileName: '../../evil.json',
      contents: VALID_CONTENTS,
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBeTruthy();
    expect(existsSync(join(root, FOLDER))).toBe(false);
  });

  it('contentsWithoutAUsableLayout-isRejectedWithoutWritingAnything', () => {
    const result = writeLayoutJsonFile(root, FOLDER, {
      fileName: 'room.json',
      contents: '{ "name": "Room" }',
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBeTruthy();
    expect(existsSync(targetPath('room.json'))).toBe(false);
  });
});
