#!/usr/bin/env python3
"""Fairy lamp art pipeline: raw fal paintings -> game-149/art/lamps/*.webp (transparent, trimmed).

    python3 -I game-149/dev/art/export.py RAW_DIR [--size 512]

RAW_DIR holds the 2048 px paintings named ID-PART.png (PART = shade, base, unlit, lit), painted on a flat key colour
(magenta, or green for pink and purple glass; see prompts.mjs). Needs Pillow and numpy only.

1. The key is measured from the image border (the model's "magenta" drifts, e.g. #e050e0).
2. Pixels near the key that connect to the border are background (flood fill), so a key-tinted pocket *inside*
   the glass is kept: that is the glass, not the background.
3. Alpha is feathered over a band of key distance, and the edge pixels are despilled (the key's tint is pulled
   back toward neutral), so there is no pink or green halo on the dark game backdrop.
4. All four parts of a lamp share one crop box (the union of their figures plus a margin) and one scale, so they
   stay pixel-aligned; the longest side is --size px. Saved as WebP
   (about a tenth of the PNG size, alpha kept).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'art', 'lamps'))
WORK = 1024           # process at this size (the paintings are 2048)
NEAR, FAR = 70, 130   # key distance: <= NEAR is background, >= FAR is fully opaque, feathered between


def key_colour(rgb):
    h, w, _ = rgb.shape
    b = 6
    border = np.concatenate([rgb[:b].reshape(-1, 3), rgb[-b:].reshape(-1, 3), rgb[:, :b].reshape(-1, 3), rgb[:, -b:].reshape(-1, 3)])
    return np.median(border, axis=0)


def cut(path):
    im = Image.open(path).convert('RGB').resize((WORK, WORK), Image.LANCZOS)
    rgb = np.asarray(im).astype(np.float32)
    key = key_colour(rgb)
    dist = np.sqrt(((rgb - key) ** 2).sum(axis=2))

    # background = near-key pixels connected to the border
    near = Image.fromarray(np.where(dist <= FAR, 255, 0).astype(np.uint8))
    draw = ImageDraw.Draw(near)
    px = near.load()
    for i in range(WORK):
        for (x, y) in ((i, 0), (i, WORK - 1), (0, i), (WORK - 1, i)):
            if px[x, y] == 255:
                ImageDraw.floodfill(near, (x, y), 128)
    bg = np.asarray(near) == 128

    alpha = np.clip((dist - NEAR) / (FAR - NEAR), 0, 1)
    alpha = np.where(bg, alpha, 1.0)
    # soften the cut edge by one pixel
    a_img = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
    alpha = np.minimum(alpha, np.asarray(a_img).astype(np.float32) / 255)

    # despill: where alpha < 1 (edges), remove the key's contribution  c = a*fg + (1-a)*key  ->  fg
    a = alpha[..., None]
    fg = np.where(a > 0.02, (rgb - (1 - a) * key) / np.maximum(a, 0.02), rgb)
    # Pull the key's tint out everywhere: the model lets the key show through glass (green inside the pink lamp).
    # None of the glass colours has the key's signature, so a global despill is safe: on a green key, G is capped
    # at max(R, B); on a magenta key, R and B are pulled toward G by what they share above it.
    if key[1] < key[0]:   # magenta key
        spill = np.maximum(0, np.minimum(fg[..., 0], fg[..., 2]) - fg[..., 1])
        fg[..., 0] -= spill * 0.6
        fg[..., 2] -= spill * 0.6
    else:                 # green key
        fg[..., 1] = np.minimum(fg[..., 1], np.maximum(fg[..., 0], fg[..., 2]) * 1.02)
    fg = np.clip(fg, 0, 255)

    rgba = np.dstack([fg, alpha * 255]).astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    ys, xs = np.nonzero(alpha > 0.05)
    return out, (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), key, bg.mean()


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    raw = args[0]
    size = int(args[args.index('--size') + 1]) if '--size' in args else 512
    os.makedirs(OUT, exist_ok=True)
    lamps = {}
    for name in sorted(os.listdir(raw)):
        if name.endswith('.png'):
            lamp, part = name[:-4].rsplit('-', 1)
            lamps.setdefault(lamp, {})[part] = os.path.join(raw, name)
    for lamp, parts in lamps.items():
        cuts = {part: cut(path) for part, path in parts.items()}
        # One crop box and one scale for all of a lamp's parts, so they stay aligned: the shade drawn over the
        # base lands exactly where it sits in the whole-lamp picture.
        m = 8
        x0 = max(0, min(c[1][0] for c in cuts.values()) - m)
        y0 = max(0, min(c[1][1] for c in cuts.values()) - m)
        x1 = min(WORK, max(c[1][2] for c in cuts.values()) + m)
        y1 = min(WORK, max(c[1][3] for c in cuts.values()) + m)
        s = min(1, size / max(x1 - x0, y1 - y0))
        w, h = round((x1 - x0) * s), round((y1 - y0) * s)
        for part, (img, box, key, bgfrac) in sorted(cuts.items()):
            img = img.crop((x0, y0, x1, y1)).resize((w, h), Image.LANCZOS)
            img.save(os.path.join(OUT, f'{lamp}-{part}.webp'), quality=88, method=6)
            print(f'{lamp}-{part:6s} key #{int(key[0]):02x}{int(key[1]):02x}{int(key[2]):02x}  bg {bgfrac:.0%}  -> {w}x{h}')


if __name__ == '__main__':
    main()
