import type { TileSpriteSpec } from './paletteTiles';
import { cn } from '@/lib/utils';

interface PaletteTileProps {
  label: string;
  sprite: TileSpriteSpec | null;
  selected: boolean;
  onClick: () => void;
}

const TILE_BOX_SIZE = 40;
const SPRITE_PADDING = 6;

/**
 * One square in the palette catalog: either a cropped sprite (plain `<img>`
 * of the whole sheet, absolutely positioned inside an `overflow: hidden`
 * box, both scaled up so the target frame fills most of `TILE_BOX_SIZE` —
 * a CSS "sprite sheet" crop, no canvas involved) or, when `sprite` is
 * `null` (the Eraser tool), an empty square with just a border.
 */
export const PaletteTile = ({ label, sprite, selected, onClick }: PaletteTileProps) => {
  const scale = sprite
    ? (TILE_BOX_SIZE - SPRITE_PADDING) / Math.max(sprite.frameWidth, sprite.frameHeight)
    : 1;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center rounded border-2 border-border bg-muted p-0.5',
        selected && 'border-blue-400 ring-2 ring-blue-400',
      )}
      style={{ width: TILE_BOX_SIZE, height: TILE_BOX_SIZE }}
    >
      {sprite ? (
        <div
          style={{
            width: sprite.frameWidth * scale,
            height: sprite.frameHeight * scale,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <img
            src={sprite.sheet}
            alt={label}
            style={{
              position: 'absolute',
              left: -sprite.sx * scale,
              top: -sprite.sy * scale,
              width: sprite.sheetWidth * scale,
              height: sprite.sheetHeight * scale,
              maxWidth: 'none',
              imageRendering: 'pixelated',
            }}
          />
        </div>
      ) : (
        <span className="block h-full w-full rounded-sm border border-dashed border-muted-foreground" />
      )}
    </button>
  );
};
