import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { LEVELS_FOLDER } from '../src/themes/platformer/editor/saveLevelEndpoint';

export interface LevelWriteRequest {
  fileName: unknown;
  contents: unknown;
}

export interface LevelWriteResult {
  status: number;
  body: { path?: string; error?: string };
}

/**
 * A slugified level filename and nothing else — the same shape
 * `levelFileName` produces (lowercase, hyphen-separated, `.json`). Anything
 * with a path separator, a `..`, a drive letter, or another extension fails
 * this, which is the first half of keeping the write inside `LEVELS_FOLDER`.
 */
const FILE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*\.json$/;

const isLevelJson = (contents: string): boolean => {
  try {
    const parsed: unknown = JSON.parse(contents);
    if (parsed === null || typeof parsed !== 'object') return false;
    const { layout } = parsed as { layout?: unknown };
    return (
      Array.isArray(layout) && layout.length > 0 && layout.every((row) => typeof row === 'string')
    );
  } catch {
    return false;
  }
};

const reject = (error: string): LevelWriteResult => ({ status: 400, body: { error } });

/**
 * Writes one saved level into `<root>/<LEVELS_FOLDER>`, the folder the level
 * registry globs — so a level saved in the editor lands where it will be
 * loaded from, instead of in the browser's downloads (spec FR-032).
 *
 * This only ever runs in the dev server (see `levelWritePlugin.ts`), but it
 * is still a filesystem write driven by a request body, so it validates
 * accordingly: the filename must be a bare slug + `.json`, the resolved path
 * must sit inside the levels folder, and the contents must be JSON the
 * registry would actually accept. A request failing any of those writes
 * nothing at all.
 */
export const writeLevelFile = (root: string, request: LevelWriteRequest): LevelWriteResult => {
  const { fileName, contents } = request;

  if (typeof fileName !== 'string' || !FILE_NAME_PATTERN.test(fileName)) {
    return reject('fileName must be a slugified name ending in .json');
  }
  if (typeof contents !== 'string' || contents === '') {
    return reject('contents must be a non-empty string');
  }
  if (!isLevelJson(contents)) {
    return reject('contents must be JSON with a non-empty layout array of strings');
  }

  const levelsDir = resolve(root, LEVELS_FOLDER);
  const target = resolve(levelsDir, fileName);
  // Belt-and-braces against the pattern above ever being loosened: a target
  // that escaped the levels folder is refused rather than written.
  if (target !== join(levelsDir, fileName)) {
    return reject('resolved path is outside the levels folder');
  }

  try {
    mkdirSync(levelsDir, { recursive: true });
    writeFileSync(target, contents, 'utf8');
  } catch (error) {
    return { status: 500, body: { error: error instanceof Error ? error.message : 'write failed' } };
  }

  return { status: 200, body: { path: `${LEVELS_FOLDER}${fileName}` } };
};
