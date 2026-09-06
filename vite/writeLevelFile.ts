import { LEVELS_FOLDER } from '../src/themes/platformer/editor/saveLevelEndpoint';
import {
  writeLayoutJsonFile,
  type LayoutWriteRequest,
  type LayoutWriteResult,
} from './writeLayoutJsonFile';

export type LevelWriteRequest = LayoutWriteRequest;
export type LevelWriteResult = LayoutWriteResult;

/**
 * Writes one saved level into `<root>/<LEVELS_FOLDER>`, the folder the level
 * registry globs — so a level saved in the editor lands where it will be
 * loaded from, instead of in the browser's downloads (spec FR-032).
 *
 * All validation (slug-only filename, no path escape, JSON the registry would
 * accept) lives in `writeLayoutJsonFile`, shared with the blueprint writer
 * next to it: the two differ only in which folder they target.
 */
export const writeLevelFile = (root: string, request: LevelWriteRequest): LevelWriteResult =>
  writeLayoutJsonFile(root, LEVELS_FOLDER, request);
