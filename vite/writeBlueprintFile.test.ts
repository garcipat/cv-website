import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeBlueprintFile } from './writeBlueprintFile';
import { BLUEPRINTS_FOLDER } from '../src/themes/platformer/editor/saveBlueprintEndpoint';

const VALID_CONTENTS = `${JSON.stringify({ name: 'Cave Room', layout: ['#+#', '#.#'] }, null, 2)}\n`;

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'blueprint-write-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const blueprintsPath = (fileName: string) => join(root, BLUEPRINTS_FOLDER, fileName);

describe('writeBlueprintFile', () => {
  it('validRequest-writesTheFileIntoTheBlueprintsFolderNotTheLevelsFolder', () => {
    const result = writeBlueprintFile(root, {
      fileName: 'cave-room.json',
      contents: VALID_CONTENTS,
    });

    expect(result.status).toBe(200);
    expect(readFileSync(blueprintsPath('cave-room.json'), 'utf8')).toBe(VALID_CONTENTS);
    expect(existsSync(join(root, 'src/themes/platformer/level/levels/cave-room.json'))).toBe(false);
  });

  it('validRequest-reportsThePathItWroteRelativeToTheRepositoryRoot', () => {
    const result = writeBlueprintFile(root, {
      fileName: 'cave-room.json',
      contents: VALID_CONTENTS,
    });

    expect(result.body.path).toBe(`${BLUEPRINTS_FOLDER}cave-room.json`);
  });

  it('missingBlueprintsFolder-isCreatedRatherThanFailing', () => {
    expect(existsSync(join(root, BLUEPRINTS_FOLDER))).toBe(false);

    writeBlueprintFile(root, { fileName: 'cave-room.json', contents: VALID_CONTENTS });

    expect(existsSync(blueprintsPath('cave-room.json'))).toBe(true);
  });

  it('fileNameThatEscapesTheBlueprintsFolder-isRejectedWithoutWriting', () => {
    const result = writeBlueprintFile(root, {
      fileName: '../../evil.json',
      contents: VALID_CONTENTS,
    });

    expect(result.status).toBe(400);
    expect(existsSync(join(root, 'evil.json'))).toBe(false);
  });

  it('contentsTheRegistryWouldNotAccept-isRejectedWithoutWriting', () => {
    const result = writeBlueprintFile(root, {
      fileName: 'cave-room.json',
      contents: '{ "layout": [] }',
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toBeTruthy();
    expect(existsSync(blueprintsPath('cave-room.json'))).toBe(false);
  });
});
