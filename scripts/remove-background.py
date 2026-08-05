#!/usr/bin/env python3
"""Remove a checkerboard/grey background from sprite images, producing real alpha.

Approach:
  1. Auto-detect the background tones by sampling the image border
     (k-means with k=2 on border pixels).
  2. For each tone, auto-derive a per-image tolerance from the noise of the
     border pixels (99th percentile of their distance to the tone), floored
     at 50 so blended checkerboard edges are classified as background too.
  3. Build a "background-like" mask (pixels within tolerance of any tone).
  4. Flood-fill the mask from every border pixel so only background connected
     to the edges becomes transparent (interior pixels that happen to be
     grey/white are preserved).
  5. Feather the alpha (~1px) to hide JPEG/AA edges.

Usage:
  remove-background.py input.jpg
  remove-background.py images/*.jpg           # batch, writes <name>-alpha.png
  remove-background.py -o out.png input.jpg
  remove-background.py --dist 40 input.jpg    # tune tolerance per image
  remove-background.py --feather 0.5 input.jpg  # thinner/fatter feather
"""
import sys
import math
import os
import argparse
from PIL import Image, ImageFilter

K = 2               # number of checkerboard tones
BORDER = 3          # px of border sampled for bg-tone detection


def dist(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def kmeans(points, k, iters=20):
    centroids = points[:k]
    for _ in range(iters):
        buckets = [[] for _ in range(k)]
        for p in points:
            bi = min(range(k), key=lambda i: dist(p, centroids[i]))
            buckets[bi].append(p)
        new = []
        for b in buckets:
            if not b:
                new.append(centroids[buckets.index(b)])
                continue
            new.append(tuple(round(sum(c[i] for c in b) / len(b)) for i in range(3)))
        centroids = new
    return centroids


def detect_tones(img):
    w, h = img.size
    px = img.load()
    border = []
    for x in range(0, w, 4):
        for y in (0, h - 1):
            border.append(px[x, y][:3])
    for y in range(0, h, 4):
        for x in (0, w - 1):
            border.append(px[x, y][:3])
    return kmeans(border, K)


def tone_tolerances(img, tones, manual):
    """Per-tone tolerance: manual override, else 99th %ile noise of the border
    pixels assigned to that tone (nearest-neighbour), with a floor of 50 so the
    blended checkerboard edges (which sit between the two tones) are also
    classified as background."""
    w, h = img.size
    px = img.load()
    if manual is not None:
        return [manual] * len(tones)
    buckets = [[] for _ in tones]
    for x in range(0, w, 3):
        for y in (0, h - 1):
            c = px[x, y][:3]
            i = min(range(len(tones)), key=lambda k: dist(c, tones[k]))
            buckets[i].append(dist(c, tones[i]))
    for y in range(0, h, 3):
        for x in (0, w - 1):
            c = px[x, y][:3]
            i = min(range(len(tones)), key=lambda k: dist(c, tones[k]))
            buckets[i].append(dist(c, tones[i]))
    tol = []
    for b in buckets:
        b.sort()
        tol.append(max(b[int(0.99 * len(b))], 50) if b else 50)
    return tol


def flood_from_border(mask, w, h):
    """Return a new boolean mask of bg-cells connected to any border cell."""
    filled = [[False] * w for _ in range(h)]
    stack = []
    for y in (0, h - 1):
        for x in range(w):
            if mask[y][x]:
                filled[y][x] = True
                stack.append((x, y))
    for x in range(w):
        for y in (0, h - 1):
            if mask[y][x]:
                filled[y][x] = True
                stack.append((x, y))
    while stack:
        x, y = stack.pop()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and mask[ny][nx] and not filled[ny][nx]:
                filled[ny][nx] = True
                stack.append((nx, ny))
    return filled


def process(src, dst, dist_override=None, feather=1.0):
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    px = img.load()
    tones = detect_tones(img)
    tols = tone_tolerances(img, tones, dist_override)
    print(f"  detected bg tones: {list(zip(tones, [round(t, 1) for t in tols]))}")

    near = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            c = px[x, y][:3]
            if any(dist(c, t) <= tol for t, tol in zip(tones, tols)):
                near[y][x] = True

    bg = flood_from_border(near, w, h)

    alpha = Image.new("L", (w, h), 255)
    apx = alpha.load()
    for y in range(h):
        for x in range(w):
            if bg[y][x]:
                apx[x, y] = 0
    if feather > 0:
        alpha = alpha.filter(ImageFilter.GaussianBlur(feather))
    img.putalpha(alpha)
    img.save(dst)


def main():
    p = argparse.ArgumentParser(description="Remove checkerboard/grey background from sprites.")
    p.add_argument("files", nargs="+", help="input image(s)")
    p.add_argument("-o", "--output", help="output path (single input only)")
    p.add_argument("--dist", type=float, default=None, help="override color tolerance")
    p.add_argument("--feather", type=float, default=1.0, help="alpha feather radius (0 = none)")
    a = p.parse_args()

    for f in a.files:
        dst = a.output if (len(a.files) == 1 and a.output) else os.path.splitext(f)[0] + "-alpha.png"
        print(f"{f} -> {dst}")
        process(f, dst, a.dist, a.feather)


if __name__ == "__main__":
    main()
