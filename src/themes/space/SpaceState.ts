import { signal } from '@preact/signals-react';

/** Current scroll offset in vh units — updated by SpacePage scroll listener. */
export const scrollOffset = signal(0);

/** Active circle index — written by CircleParade, read by AnchorDots. */
export const activeCircleIndex = signal(0);

/** Poster visibility — hidden on first scroll. */
export const showPoster = signal(true);
