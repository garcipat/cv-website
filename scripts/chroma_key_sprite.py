"""Removes a solid chroma-key background color from a generated sprite and
autocrops to content, producing a transparent PNG ready to drop into
`public/sprites/`.

Used for AI-generated sprite assets (e.g. via the nano-banana MCP server):
generation models don't reliably produce a transparent background, so we ask
for a flat magenta (#FF00FF) background instead and strip it here.

Usage:
    python scripts/chroma_key_sprite.py <in_path> <out_path> \
        [--key R,G,B] [--tolerance N] [--feather N] [--pad N] [--no-crop]

Example:
    python scripts/chroma_key_sprite.py \
        .generated/controls_overlay_keys_magenta.jpg \
        public/sprites/controls_overlay_keys.png
"""

import argparse

from PIL import Image


def chroma_key(img: Image.Image, key: tuple[int, int, int], tolerance: float, feather: float) -> Image.Image:
    """Makes pixels within `tolerance` of `key` fully transparent, and
    linearly ramps alpha back up to opaque over the next `feather` distance
    so the cut edge doesn't leave a hard magenta fringe."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    kr, kg, kb = key
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            dist = ((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2) ** 0.5
            if dist < tolerance:
                px[x, y] = (r, g, b, 0)
            elif dist < tolerance + feather:
                alpha = int(255 * (dist - tolerance) / feather)
                px[x, y] = (r, g, b, max(0, min(255, alpha)))
    return img


def autocrop(img: Image.Image, pad: int) -> Image.Image:
    """Crops to the tightest bounding box of non-transparent pixels, with
    `pad` pixels of transparent margin kept on every side."""
    bbox = img.getbbox()
    if not bbox:
        return img
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(img.width, right + pad)
    bottom = min(img.height, bottom + pad)
    return img.crop((left, top, right, bottom))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("in_path")
    parser.add_argument("out_path")
    parser.add_argument("--key", default="255,0,255", help="R,G,B of the background to remove (default magenta)")
    parser.add_argument("--tolerance", type=float, default=60.0, help="Color-distance below which a pixel is fully removed")
    parser.add_argument("--feather", type=float, default=70.0, help="Color-distance over which alpha ramps back to opaque")
    parser.add_argument("--pad", type=int, default=4, help="Transparent margin kept around the cropped content")
    parser.add_argument("--no-crop", action="store_true", help="Skip autocropping to content")
    args = parser.parse_args()

    key = tuple(int(c) for c in args.key.split(","))
    img = Image.open(args.in_path)
    img = chroma_key(img, key, args.tolerance, args.feather)
    if not args.no_crop:
        img = autocrop(img, args.pad)
    img.save(args.out_path, "PNG")
    print(f"wrote {args.out_path} ({img.width}x{img.height})")


if __name__ == "__main__":
    main()
