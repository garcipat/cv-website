import { computed } from '@preact/signals-react';
import { placeTorches } from '../level/TorchMapper';
import type { TorchPlacement } from '../level/TorchMapper';
import { placeSigns } from '../level/SignMapper';
import type { SignPlacement } from '../level/SignMapper';
import { SIGN_TILES, TORCH_TILES, currentLevel } from './levelSession';

/**
 * Every torch tile's world-space centre (`tileToPixel` plus half a rendered
 * tile) and its light strength, derived from `TORCH_TILES` so the Level Editor's
 * Try button updates it reactively like every other placement list. A torch's
 * strength is its `torch` marker's value, or `DEFAULT_TORCH_STRENGTH` when it
 * carries none. This is the light-source list the render pass reads for both
 * the darkness overlay's holes and the enemy-eye pass's local-darkness check.
 */
export const torchPositions = computed<TorchPlacement[]>(() =>
  placeTorches(TORCH_TILES.value, currentLevel.value),
);

/**
 * Every hint sign in the level, placed once at module load — same
 * non-reactive-to-CVData-but-reactive-to-`currentLayout` convention as
 * chestPlacements/blockPlacements above. Unlike those, there's no CVData to
 * zip against: a marker's character alone determines its hintId (see
 * SignMapper.ts's placeSigns).
 */
export const signPlacements = computed<SignPlacement[]>(() => placeSigns(SIGN_TILES.value));
