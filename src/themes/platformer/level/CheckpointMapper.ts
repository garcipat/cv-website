import { placeAtMarkers } from './placement';

/**
 * A checkpoint's static position, parsed from a `C` marker (LevelParser.ts's
 * findCheckpointTiles). `col`/`row` are the level-grid cell the marker was
 * read from — kept so the logic layer can check for solid ground directly
 * below it — and `x`/`y` are the rendered-world top-left the flag
 * draws at.
 */
export interface CheckpointPlacement {
  id: string;
  col: number;
  row: number;
  x: number;
  y: number;
}

/**
 * Places one `CheckpointPlacement` per hand-authored `C` marker through the
 * shared `placeAtMarkers`, preserving the markers' reading order — that order
 * is the contract the deterministic same-tick tie-break depends on (see
 * CheckpointLogic.ts). Unlike placeChests/placeBlocks there is no
 * CVData-derived def list to zip against: a checkpoint marker's character
 * alone fully determines its placement. The id embeds the cell so two
 * checkpoints are always distinct.
 */
export function placeCheckpoints(
  markers: readonly { col: number; row: number }[],
): CheckpointPlacement[] {
  return placeAtMarkers<{ col: number; row: number }, CheckpointPlacement>(markers, {
    idPrefix: 'checkpoint',
    build: (marker) => ({ col: marker.col, row: marker.row }),
  });
}
