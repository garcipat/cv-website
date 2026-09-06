import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface LayoutWriteRequest {
  fileName: unknown;
  contents: unknown;
}

export interface LayoutWriteResult {
  status: number;
  body: { path?: string; error?: string };
}

/**
 * A slugified filename and nothing else — the same shape `levelFileName` and
 * `blueprintFileName` produce (lowercase, hyphen-separated, `.json`). Anything
 * with a path separator, a `..`, a drive letter, or another extension fails
 * this, which is the first half of keeping the write inside the target folder.
 */
const FILE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*\.json$/;

const isLayoutJson = (contents: string): boolean => {
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

const reject = (error: string): LayoutWriteResult => ({ status: 400, body: { error } });

/**
 * Writes one saved layout file (a level or a blueprint — they are the same
 * `{ name, layout, background? }` JSON shape) into `<root>/<folder>`, the
 * folder its registry globs, so a file saved in the editor lands where it will
 * be loaded from instead of in the browser's downloads (spec FR-032).
 *
 * Shared by `writeLevelFile.ts` and `writeBlueprintFile.ts` rather than
 * duplicated: this only ever runs in the dev server, but it is still a
 * filesystem write driven by a request body, and its three defenses — bare
 * slug filename, resolved path inside the folder, contents the registry would
 * actually accept — must hold identically for both. A request failing any of
 * them writes nothing at all.
 */
export const writeLayoutJsonFile = (
  root: string,
  folder: string,
  request: LayoutWriteRequest,
): LayoutWriteResult => {
  const { fileName, contents } = request;

  if (typeof fileName !== 'string' || !FILE_NAME_PATTERN.test(fileName)) {
    return reject('fileName must be a slugified name ending in .json');
  }
  if (typeof contents !== 'string' || contents === '') {
    return reject('contents must be a non-empty string');
  }
  if (!isLayoutJson(contents)) {
    return reject('contents must be JSON with a non-empty layout array of strings');
  }

  const targetDir = resolve(root, folder);
  const target = resolve(targetDir, fileName);
  // Belt-and-braces against the pattern above ever being loosened: a target
  // that escaped the folder is refused rather than written.
  if (target !== join(targetDir, fileName)) {
    return reject('resolved path is outside the target folder');
  }

  try {
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(target, contents, 'utf8');
  } catch (error) {
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : 'write failed' },
    };
  }

  return { status: 200, body: { path: `${folder}${fileName}` } };
};
