#!/usr/bin/env python3
"""Export the raw ElevenLabs pictures into One Shot's art/ folder (Pillow + numpy).

    python3 -I game-151/dev/art/export.py RAW game-151/art

- title.webp (1600 wide), sky.webp (2048 wide, the nebula on the 3D backdrop), cut-juno.webp (the firing cut-in)
- por-juno / por-mira: the magenta key flood-filled out from the border, trimmed, 256 px, alpha
- ship-<id>: every Meshy reference (white background flood-filled out), trimmed, 192 px, for the hangar list
"""
import os, sys
from collections import deque
import numpy as np
from PIL import Image

RAW, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

def flood_key(img, is_key):
    """Alpha 0 for key-coloured pixels connected to the border."""
    a = np.array(img.convert('RGBA'))
    h, w = a.shape[:2]
    key = is_key(a[..., :3].astype(int))
    seen = np.zeros((h, w), bool)
    q = deque([(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)])
    while q:
        y, x = q.popleft()
        if y < 0 or x < 0 or y >= h or x >= w or seen[y, x] or not key[y, x]:
            continue
        seen[y, x] = True
        q.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    a[..., 3][seen] = 0
    # soften the cut edge by one pixel
    edge = np.zeros_like(seen)
    edge[1:-1, 1:-1] = ~seen[1:-1, 1:-1] & (seen[:-2, 1:-1] | seen[2:, 1:-1] | seen[1:-1, :-2] | seen[1:-1, 2:])
    a[..., 3][edge] = 140
    return Image.fromarray(a)

def trim(img, pad=6):
    bb = img.getchannel('A').getbbox()
    if not bb: return img
    x0, y0, x1, y1 = bb
    return img.crop((max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad), min(img.height, y1 + pad)))

def fit(img, size):
    img = img.copy()
    img.thumbnail((size, size), Image.LANCZOS)
    return img

magenta = lambda c: (c[..., 0] > 150) & (c[..., 2] > 150) & (c[..., 1] < 110)
white = lambda c: (c.min(axis=-1) > 225)

def save(img, name, q=82):
    img.save(os.path.join(OUT, name), 'WEBP', quality=q, method=6)
    print(name, img.size, os.path.getsize(os.path.join(OUT, name)) // 1024, 'KB')

src = lambda n: Image.open(os.path.join(RAW, n + '.png'))
im = src('title').convert('RGB'); save(im.resize((1600, round(1600 * im.height / im.width)), Image.LANCZOS), 'title.webp', 78)
im = src('sky').convert('RGB'); save(im.resize((2048, round(2048 * im.height / im.width)), Image.LANCZOS), 'sky.webp', 80)
im = src('cut-juno').convert('RGB'); save(im.resize((1024, round(1024 * im.height / im.width)), Image.LANCZOS), 'cut-juno.webp', 80)
for who in ['juno', 'mira']:
    save(fit(trim(flood_key(src('por-' + who), magenta)), 256), f'por-{who}.webp', 85)
for n in ['solitaire', 'drone', 'picket', 'ember', 'glacier', 'storm', 'prism', 'throne']:
    save(fit(trim(flood_key(src('ref-' + n), white)), 192), f'ship-{n}.webp', 82)
