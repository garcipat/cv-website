import { BLUEPRINTS_FOLDER } from '../src/themes/platformer/editor/saveBlueprintEndpoint';
import {
  writeLayoutJsonFile,
  type LayoutWriteRequest,
  type LayoutWriteResult,
} from './writeLayoutJsonFile';

export type BlueprintWriteRequest = LayoutWriteRequest;
export type BlueprintWriteResult = LayoutWriteResult;

/**
 * Writes one saved blueprint into `<root>/<BLUEPRINTS_FOLDER>`, the folder
 * `blueprintRegistry.ts` globs — the blueprint counterpart of
 * `writeLevelFile.ts`, differing from it in nothing but the target folder,
 * which is exactly why both delegate to the same validated writer.
 */
export const writeBlueprintFile = (
  root: string,
  request: BlueprintWriteRequest,
): BlueprintWriteResult => writeLayoutJsonFile(root, BLUEPRINTS_FOLDER, request);
