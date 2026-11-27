"""export.py — cut HAYATE RIVER STRIKE's ElevenLabs renders into game art and Meshy references.

    python3 -I game-152/dev/art/export.py RAW_DIR game-152/art REF_DIR

RAW_DIR holds sheet-a.png (3x2), sheet-b.png (2x2), sheet-c.png (2x2), portraits.png (3 across, magenta key)
and title.png. Writes:
  REF_DIR/<name>.png          one vehicle per picture on white, square, 1024 px (Meshy image-to-3D input)
  art/unit-<name>.webp        the same vehicle cut out (white flood fill from the border), 256 px, for the UI
  art/por-<rin|tomo|kurogane>.webp   portraits keyed out of the magenta, 512 px tall
  art/title.webp              the title picture, 1600 px wide
Needs Pillow and numpy.
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

RAW, OUT, REF = (Path(a) for a in sys.argv[1:4])
OUT.mkdir(parents=True, exist_ok=True)
REF.mkdir(parents=True, exist_ok=True)

SHEETS = {
    'sheet-a': (3, 2, ['hayate', 'patrol', 'gunboat', 'raider', 'barge', 'tank']),
    'sheet-b': (2, 2, ['turret', 'mine', 'kabuto', 'torii']),
    'sheet-c': (2, 2, ['souen', 'raijin', 'tetsuren', 'zero']),
}


def flood_bg(rgb, is_bg):
    """Boolean mask of background pixels connected to the border."""
    h, w = is_bg.shape
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg[y, x] and not bg[y, x]:
                bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg[y, x] and not bg[y, x]:
                bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and is_bg[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    return bg


def drop_border_pieces(fg):
    """Keep the biggest piece and every piece that doesn't touch the cell border; the rest are slivers of the
    neighbouring cell's vehicle crossing the line."""
    h, w = fg.shape
    lab = np.zeros((h, w), np.int32)
    sizes, touches = [0], [False]
    n = 0
    for sy, sx in zip(*np.nonzero(fg)):
        if lab[sy, sx]:
            continue
        n += 1
        lab[sy, sx] = n
        q = deque([(sy, sx)])
        size, touch = 0, False
        while q:
            y, x = q.popleft()
            size += 1
            if y == 0 or x == 0 or y == h - 1 or x == w - 1:
                touch = True
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and fg[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n; q.append((ny, nx))
        sizes.append(size); touches.append(touch)
    big = int(np.argmax(sizes))
    keep = [i for i in range(1, n + 1) if i == big or (not touches[i] and sizes[i] > 30)]
    return np.isin(lab, keep)


def bbox(mask):
    ys, xs = np.nonzero(mask)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def square(img, fill, size, margin=0.08):
    w, h = img.size
    s = int(max(w, h) * (1 + 2 * margin))
    canvas = Image.new(img.mode, (s, s), fill)
    canvas.paste(img, ((s - w) // 2, (s - h) // 2), img if img.mode == 'RGBA' else None)
    return canvas.resize((size, size), Image.LANCZOS)


for sheet, (cols, rows, names) in SHEETS.items():
    im = Image.open(RAW / f'{sheet}.png').convert('RGB')
    a = np.asarray(im).astype(int)
    W, H = im.size
    white = (a.min(axis=2) > 236)
    for i, name in enumerate(names):
        cx, cy = i % cols, i // cols
        x0, y0, x1, y1 = cx * W // cols, cy * H // rows, (cx + 1) * W // cols, (cy + 1) * H // rows
        cell = a[y0:y1, x0:x1]
        bg = flood_bg(cell, white[y0:y1, x0:x1])
        fg = drop_border_pieces(~bg)
        bx0, by0, bx1, by1 = bbox(fg)
        part = cell.copy()
        part[~fg] = 255                       # anything outside the vehicle becomes plain white
        crop = Image.fromarray(part[by0:by1, bx0:bx1].astype('uint8'))
        # Meshy reference: on white, square
        square(crop, (255, 255, 255), 1024).save(REF / f'{name}.png')
        # UI cut-out: alpha from the flood fill
        alpha = Image.fromarray((fg[by0:by1, bx0:bx1] * 255).astype('uint8'))
        rgba = crop.convert('RGBA'); rgba.putalpha(alpha)
        square(rgba, (0, 0, 0, 0), 256, 0.03).save(OUT / f'unit-{name}.webp', quality=86)
        print(sheet, name, (bx1 - bx0, by1 - by0))

# portraits: magenta key, three across
im = Image.open(RAW / 'portraits.png').convert('RGB')
a = np.asarray(im).astype(int)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
mag = (r > 200) & (b > 200) & (g < 90)
W, H = im.size
for i, name in enumerate(['rin', 'tomo', 'kurogane']):
    x0, x1 = i * W // 3, (i + 1) * W // 3
    bg = flood_bg(a[:, x0:x1], mag[:, x0:x1])
    fg = ~bg
    # soften the fringe: pixels that are still magenta-ish next to the edge go transparent
    cell = a[:, x0:x1].copy()
    pink = (cell[..., 0] > 170) & (cell[..., 2] > 170) & (cell[..., 1] < 120)
    fg &= ~pink
    bx0, by0, bx1, by1 = bbox(fg)
    rgba = Image.fromarray(cell[by0:by1, bx0:bx1].astype('uint8')).convert('RGBA')
    rgba.putalpha(Image.fromarray((fg[by0:by1, bx0:bx1] * 255).astype('uint8')))
    h = 512
    rgba = rgba.resize((round(rgba.width * h / rgba.height), h), Image.LANCZOS)
    rgba.save(OUT / f'por-{name}.webp', quality=88)
    print('portrait', name, rgba.size)

t = Image.open(RAW / 'title.png').convert('RGB')
t = t.resize((1600, round(t.height * 1600 / t.width)), Image.LANCZOS)
t.save(OUT / 'title.webp', quality=82)
print('title', t.size)
