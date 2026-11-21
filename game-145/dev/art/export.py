#!/usr/bin/env python3
"""VACANCY art export: raw fal renders -> game-145/art/*.webp.   python3 -I game-145/dev/art/export.py RAW_DIR

- t-*  surface textures: made seamless (half-offset cross-fade) unless they are grids whose lines already sit on the
       image edges (ceiling, tiles, lino, lab panels, sidewalk), then 512 px.
- d-*  decals: mold/stain/cracks are on white and drawn with multiply blending (near-white snapped to pure white);
       graffiti/leaves are cut out of their magenta key into RGBA.
- s-ads  the 2x2 poster sheet is split into four posters.
- p-*  portraits are cropped to the instant photo (one has a typed slip in its corner) and sized for the journal.
- k-*  key art at 1280x720; s-sky as an equirect panorama; s-portal and s-paper as they are.
"""
import os
import sys

import numpy as np
from PIL import Image

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
os.makedirs(OUT, exist_ok=True)

GRID = {'t-ceiling', 't-floor-lino', 't-tile-white', 't-lab-panel', 't-sidewalk'}


def load(name, mode='RGB'):
    return Image.open(os.path.join(RAW, name + '.png')).convert(mode)


def save(im, name, q=80):
    path = os.path.join(OUT, name + '.webp')
    im.save(path, 'WEBP', quality=q, method=6)
    return os.path.getsize(path)


def seamless(im):
    """Cross-fade the image with itself shifted by half, so every edge meets its opposite."""
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    b = np.roll(np.roll(a, h // 2, axis=0), w // 2, axis=1)
    y = np.abs(np.linspace(-1, 1, h))[:, None]
    x = np.abs(np.linspace(-1, 1, w))[None, :]
    m = np.clip(1 - np.maximum(x, y), 0, 1)        # 1 in the middle, 0 at the edges
    m = np.clip(m * 2.2, 0, 1) ** 1.5
    m = m[..., None]
    return Image.fromarray((a * m + b * (1 - m)).clip(0, 255).astype(np.uint8))


def key_magenta(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = np.clip(np.minimum(r, b) - g, 0, 255)
    alpha = 255 * (1 - np.clip((spill - 40) / 110.0, 0, 1))       # strongly magenta -> transparent
    rgb = np.stack([r - spill * 0.85, g, b - spill * 0.85], -1)       # despill the fringe
    return Image.fromarray(np.dstack([rgb, alpha]).clip(0, 255).astype(np.uint8), 'RGBA')


total = 0
for f in sorted(os.listdir(RAW)):
    if not f.endswith('.png'):
        continue
    n = f[:-4]
    if n.startswith('t-'):
        im = load(n)
        if n not in GRID:
            im = seamless(im)
        total += save(im.resize((512, 512), Image.LANCZOS), n[2:])
    elif n in ('d-mold', 'd-stain', 'd-cracks'):
        a = np.asarray(load(n)).astype(np.float32)
        lum = a.mean(-1, keepdims=True)
        a = np.where(lum > 228, 255, a)
        total += save(Image.fromarray(a.astype(np.uint8)).resize((512, 512), Image.LANCZOS), n)
    elif n in ('d-graffiti', 'd-leaves'):
        total += save(key_magenta(load(n)).resize((512, 512), Image.LANCZOS), n, 85)
    elif n == 's-ads':
        im = load(n)
        w, h = im.size
        for i, (cx, cy) in enumerate([(0, 0), (1, 0), (0, 1), (1, 1)]):
            c = im.crop((cx * w // 2 + 20, cy * h // 2 + 20, (cx + 1) * w // 2 - 20, (cy + 1) * h // 2 - 20))
            total += save(c.resize((384, 384), Image.LANCZOS), f'poster{i}')
    elif n.startswith('p-'):
        im = load(n)
        w, h = im.size
        c = im.crop((int(w * 0.1), int(h * 0.06), int(w * 0.9), int(h * 0.75)))
        c.thumbnail((360, 420), Image.LANCZOS)
        total += save(c, 'p-' + ('ruth' if n == 'p-nurse' else n[2:]), 82)
    elif n.startswith('k-'):
        im = load(n)
        total += save(im.resize((1280, 720), Image.LANCZOS), n, 78)
    elif n == 's-sky':
        total += save(load(n).resize((2048, 869), Image.LANCZOS), 'sky', 82)
    elif n == 's-portal':
        total += save(load(n).resize((512, 512), Image.LANCZOS), 'portal')
    elif n == 's-paper':
        total += save(load(n).resize((600, 800), Image.LANCZOS), 'paper', 78)
    print('ok', n)

print(f'{total / 1e6:.2f} MB written to {os.path.relpath(OUT)}')
