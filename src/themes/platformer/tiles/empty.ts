import type { TileModule } from './TileModule';

/**
 * `empty` — open space (`.`). No rules of any kind. `drawBand` is declared
 * `'terrain'` for uniformity, but `empty` has no `draw`, so the terrain loop
 * simply skips it.
 */
export const emptyModule = {
  char: '.',
  fogExempt: false,
  drawBand: 'terrain',
} as const satisfies TileModule;
