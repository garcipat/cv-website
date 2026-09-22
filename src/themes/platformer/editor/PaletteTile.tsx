import type { TileSpriteSpec } from './paletteTiles';
import { cn } from '@/lib/utils';

interface PaletteTileProps {
  label: string;
  /** Stable test handle for this tile (`editor-palette-tile-*`). */
  testId?: string;
  /** What the tile does, appended to `label` in the button's hover tooltip
   *  (see `PALETTE_TILE_DESCRIPTIONS`). Omitted, the tooltip is just the
   *  name. */
  description?: string;
  sprite: TileSpriteSpec | null;
  /** Character drawn inside the empty square when `sprite` is `null`, so two
   *  sprite-less tools don't render as the same blank button (see
   *  `PALETTE_TILE_GLYPHS`). Ignored when a sprite is given. */
  glyph?: string;
  selected: boolean;
  onClick: () => void;
}

const TILE_BOX_SIZE = 40;
// The button itself carries `border-2` (2px) and `p-0.5` (2px) on every
// side (see the className below), shrinking its actual content box to
// TILE_BOX_SIZE minus that inset on both edges — a sprite scaled against
// the raw TILE_BOX_SIZE alone overflows the content box and gets visually
// clipped by the button's own border/padding. 10px leaves a further ~1px
// of breathing room inside that content box on each side.
const SPRITE_PADDING = 10;

/**
 * One square in the palette catalog: either a cropped sprite (plain `<img>`
 * of the whole sheet, absolutely positioned inside an `overflow: hidden`
 * box, both scaled up so the target frame fills most of `TILE_BOX_SIZE` —
 * a CSS "sprite sheet" crop, no canvas involved) or, when `sprite` is
 * `null` (the Eraser and Patrol Boundary tools), an empty square with just a
 * border, holding `glyph` if one was given. When the
 * spec carries an `overlay`, a second `<img>` of the same sheet is drawn on
 * top, cropped to the overlay's own offset — used to composite grass over
 * the ground block, since the atlas keeps grass out of every ground cell.
 * An overlay with its own `frameHeight` (shorter than the base's) is
 * clipped to that shorter window and bottom-anchored within the base's
 * footprint instead of filling it — the floor spike palette icon uses this
 * to show a partial spike slice sticking up out of its tell, the same
 * bottom-anchored-crop convention `entities/hazards/FloorSpike.ts`'s
 * `draw` uses at runtime, rather than the full (fully-extended-looking)
 * frame the plain same-size overlay would otherwise show.
 */
export const PaletteTile = ({
  label,
  testId,
  description,
  sprite,
  glyph,
  selected,
  onClick,
}: PaletteTileProps) => {
  const scale = sprite
    ? (TILE_BOX_SIZE - SPRITE_PADDING) / Math.max(sprite.frameWidth, sprite.frameHeight)
    : 1;

  return (
    <button
      type="button"
      aria-label={label}
      data-testid={testId}
      title={description ? `${label} — ${description}` : label}
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
          {sprite.overlay && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                // Bottom-anchored: a shorter overlay frameHeight sits flush
                // with the base's own bottom edge rather than its top, so a
                // partial slice reads as "emerging from the ground" instead
                // of "hanging from the ceiling". Omitted (grass overlay),
                // this is 0 and the overlay fills the full footprint exactly
                // as before.
                top: (sprite.frameHeight - (sprite.overlay.frameHeight ?? sprite.frameHeight)) * scale,
                width: sprite.frameWidth * scale,
                height: (sprite.overlay.frameHeight ?? sprite.frameHeight) * scale,
                overflow: 'hidden',
              }}
            >
              <img
                src={sprite.sheet}
                alt=""
                style={{
                  position: 'absolute',
                  left: -sprite.overlay.sx * scale,
                  top: -sprite.overlay.sy * scale,
                  width: sprite.sheetWidth * scale,
                  height: sprite.sheetHeight * scale,
                  maxWidth: 'none',
                  imageRendering: 'pixelated',
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-sm border border-dashed border-muted-foreground text-muted-foreground">
          {glyph}
        </span>
      )}
    </button>
  );
};
