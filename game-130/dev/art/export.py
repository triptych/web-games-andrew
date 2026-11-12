#!/usr/bin/env python3
"""Starbase Spooky art pipeline: raw fal renders -> game-130/art/*.webp.

    python3 -I game-130/dev/art/export.py RAW_DIR

RAW_DIR holds the renders named as in dev/art/README.md (bg-<room>.png, spr-<id>.png, icons-<sheet>.png). Needs
Pillow and numpy. The cut-out helpers (key-colour flood fill, despill, trim, premultiplied box shrink) are game-126's,
copied unchanged. Backdrops are box-filtered to the game's 640x360 canvas, sprites to their height in game pixels
(`h` in js/sim/data/cast.js), so the game draws everything 1:1 and scales the whole canvas with nearest-neighbour.
"""
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'art'))

ROOMS = ['deck', 'dock', 'garden', 'galley', 'engine', 'observatory', 'quarters', 'vents', 'station']
# sprite height in game pixels (the canvas is 640x360); matches `h` in js/sim/data/cast.js
SPRITES = {'kit': 84, 'orby': 40, 'ada': 120, 'zorp': 96, 'gloobella': 112, 'snorkel': 112, 'quasar': 108,
           'blipblop': 92, 'ghost': 96, 'wisp': 64, 'mama': 220}
FLIP = set()
# The item sheet came back with a caption under every icon: blank the bottom of each cell before cutting.
CAPTION = {'items': 0.2}
# The station map came back with a letter beside each module: paint them over with the sky (game pixels).
SCRUB = {'station': [(355, 28, 18, 16), (164, 70, 16, 16), (167, 263, 16, 16), (362, 309, 16, 16), (462, 277, 16, 16), (448, 109, 16, 16), (474, 205, 16, 16)]}
ICONS = {'items': (4, 4, 40), 'planets': (3, 3, 56)}

def label(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    n = 0
    sizes = [0]
    for y0 in range(h):
        row = mask[y0]
        for x0 in np.nonzero(row & (lab[y0] == 0))[0]:
            if lab[y0, x0]:
                continue
            n += 1
            lab[y0, x0] = n
            q = deque([(y0, x0)])
            c = 0
            while q:
                y, x = q.popleft()
                c += 1
                for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        q.append((yy, xx))
            sizes.append(c)
    return lab, sizes


def cutout(img, focus=None):
    """RGBA with the key background removed. Works at a reduced size for the flood fill, then upsamples the mask."""
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    ring = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    bg = np.median(ring, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
    # the key colour drifts across a sheet (cells come back in two shades): measure "keyness" by hue family too
    key = np.argmax(bg)  # 0 r, 1 g, 2 b dominant
    if bg[0] > 150 and bg[2] > 150 and bg[1] < 120:          # magenta family
        keyish = (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) > 90
    elif bg[1] > 150 and bg[0] < 140 and bg[2] < 140:       # green
        keyish = (a[..., 1] - np.maximum(a[..., 0], a[..., 2])) > 90
    elif bg[2] > 150 and bg[0] < 120 and bg[1] < 140:       # blue
        keyish = (a[..., 2] - np.maximum(a[..., 0], a[..., 1])) > 110
    else:
        keyish = dist < 40
    cand = keyish | (dist < 50)
    # flood fill the candidate background from the border
    lab, sizes = label(cand)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(border))
    # enclosed pockets of almost exactly the key colour (between legs, inside wings)
    bgmask |= (keyish & (dist < 70))
    # larger enclosed pockets that are clearly key-coloured (inside a necklace loop, under an arch of wings)
    plab, psizes = label(keyish & ~bgmask)
    big_pockets = [i for i in range(1, len(psizes)) if psizes[i] >= 0.0015 * h * w]
    if big_pockets:
        bgmask |= np.isin(plab, big_pockets)
    fg = ~bgmask
    # drop specks and floating fragments (labels, smears) far from the main figure
    flab, fsizes = label(fg)
    if len(fsizes) > 1:
        big = int(np.argmax(fsizes[1:])) + 1
        if focus:
            # in a sheet cell searched with a margin: the biggest figure whose centre lies in the cell itself
            fx0, fy0, fx1, fy1 = focus
            best = 0
            for i in range(1, len(fsizes)):
                if fsizes[i] <= best or fsizes[i] < 50:
                    continue
                ys, xs = np.nonzero(flab == i)
                cy, cx = ys.mean(), xs.mean()
                if fx0 <= cx < fx1 and fy0 <= cy < fy1:
                    best, big = fsizes[i], i
        ys, xs = np.nonzero(flab == big)
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
        my, mx = (y1 - y0) * 0.12 + 4, (x1 - x0) * 0.12 + 4
        keep = np.zeros(len(fsizes), bool)
        keep[big] = True
        for i in range(1, len(fsizes)):
            if i == big or fsizes[i] < fsizes[big] * 0.002:
                continue
            ys, xs = np.nonzero(flab == i)
            inside = ys.min() >= y0 - my and ys.max() <= y1 + my and xs.min() >= x0 - mx and xs.max() <= x1 + mx
            if inside and fsizes[i] >= 6:
                keep[i] = True
        fg = keep[flab]
    # despill: pull the key colour out of edge pixels
    rgb = a.copy()
    edge = np.zeros_like(fg)
    for d in range(1, 5):   # a band a few pixels deep, so soft glows lose their key-coloured fringe too
        edge |= fg & (~np.roll(fg, d, 0) | ~np.roll(fg, -d, 0) | ~np.roll(fg, d, 1) | ~np.roll(fg, -d, 1))
    if bg[0] > 150 and bg[2] > 150 and bg[1] < 120:
        lim = rgb[..., 1] + 30
        rgb[..., 0] = np.where(edge, np.minimum(rgb[..., 0], lim), rgb[..., 0])
        rgb[..., 2] = np.where(edge, np.minimum(rgb[..., 2], lim), rgb[..., 2])
    elif bg[1] > 150:
        lim = np.maximum(rgb[..., 0], rgb[..., 2]) + 20
        rgb[..., 1] = np.where(edge, np.minimum(rgb[..., 1], lim), rgb[..., 1])
    elif bg[2] > 150:
        lim = np.maximum(rgb[..., 0], rgb[..., 1]) + 20
        rgb[..., 2] = np.where(edge, np.minimum(rgb[..., 2], lim), rgb[..., 2])
    out = np.dstack([np.clip(rgb, 0, 255), fg * 255.0]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def trim(im, pad=0):
    bbox = im.getchannel('A').point(lambda v: 255 if v > 0 else 0).getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def shrink(im, longest):
    """Downscale an RGBA cutout to `longest` px on its long side with premultiplied box filtering, then harden alpha."""
    s = longest / max(im.width, im.height)
    if s >= 1:
        return im
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    a = np.asarray(im).astype(np.float32)
    al = a[..., 3:4] / 255.0
    pre = np.concatenate([a[..., :3] * al, al * 255.0], axis=2).astype(np.float32)
    chans = [Image.fromarray(pre[..., i]).resize((w, h), Image.BOX) for i in range(4)]
    arr = np.dstack([np.asarray(c) for c in chans])
    alpha = arr[..., 3] / 255.0
    rgb = np.where(alpha[..., None] > 0.01, arr[..., :3] / np.maximum(alpha[..., None], 0.01), 0)
    hard = (alpha > 0.45) * 255.0
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), hard]).astype(np.uint8), 'RGBA')


def save(im, name, **kw):
    path = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if im.mode == 'RGBA':
        im.save(path, 'WEBP', lossless=True, method=6)
    else:
        im.save(path, 'WEBP', quality=kw.get('q', 82), method=6)
    return path


def grid_cells(img, cols, rows, margin=0.0):
    """Each cell of a sheet, searched with a margin into its neighbours (big figures spill over the lines).
    Yields (crop, focus) where focus is the cell's own rectangle inside the crop."""
    w, h = img.size
    for r in range(rows):
        for c in range(cols):
            x0, y0, x1, y1 = c * w // cols, r * h // rows, (c + 1) * w // cols, (r + 1) * h // rows
            mx, my = int((x1 - x0) * margin), int((y1 - y0) * margin)
            X0, Y0, X1, Y1 = max(0, x0 - mx), max(0, y0 - my), min(w, x1 + mx), min(h, y1 + my)
            yield img.crop((X0, Y0, X1, Y1)), (x0 - X0, y0 - Y0, x1 - X0, y1 - Y0)


def main(raw):
    meta = {'sprites': {}, 'icons': {}}
    have = lambda n: os.path.exists(os.path.join(raw, n))
    for r in ROOMS:
        if have(f'bg-{r}.png'):
            im = Image.open(os.path.join(raw, f'bg-{r}.png')).convert('RGB').resize((640, 360), Image.BOX)
            for (x, y, w, h) in SCRUB.get(r, []):
                # fill with the median colour of a ring just outside the box (sky, or the Earth under D)
                a = np.asarray(im).astype(np.int32)
                ring = np.concatenate([a[y - 3, x:x + w], a[y + h + 2, x:x + w], a[y:y + h, x - 3], a[y:y + h, x + w + 2]])
                im.paste(tuple(int(v) for v in np.median(ring, axis=0)), (x, y, x + w, y + h))
            save(im, f'bg/{r}.webp', q=84)
        else:
            print('missing', r)
    if have('bg-title.png'):
        save(Image.open(os.path.join(raw, 'bg-title.png')).convert('RGB').resize((1280, 720), Image.BOX), 'bg/title.webp', q=82)
    for sid, h in SPRITES.items():
        f = f'spr-{sid}.png'
        if not have(f):
            print('missing', f); continue
        sp = trim(cutout(Image.open(os.path.join(raw, f))))
        if sid in FLIP: sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
        sp = shrink(sp, max(sp.width, sp.height) * h / sp.height)
        save(sp, f'spr/{sid}.webp')
        meta['sprites'][sid] = [sp.width, sp.height]
    for name, (cols, rows, size) in ICONS.items():
        f = f'icons-{name}.png'
        if not have(f):
            print('missing', f); continue
        img = Image.open(os.path.join(raw, f)).convert('RGB')
        if name in CAPTION:
            bgc = img.getpixel((4, 4))
            w, hh = img.size
            for r in range(rows):
                y1 = (r + 1) * hh // rows
                img.paste(bgc, (0, int(y1 - hh / rows * CAPTION[name]), w, y1))
        atlas = Image.new('RGBA', (size * cols, size * rows), (0, 0, 0, 0))
        for i, (cell, _) in enumerate(grid_cells(img, cols, rows)):
            ic = shrink(trim(cutout(cell)), size - 4)
            atlas.paste(ic, ((i % cols) * size + (size - ic.width) // 2, (i // cols) * size + (size - ic.height) // 2), ic)
        save(atlas, f'icons/{name}.webp')
        meta['icons'][name] = [cols, rows, size]
    with open(os.path.join(OUT, 'sprites.json'), 'w') as fh:
        json.dump(meta, fh, indent=0, sort_keys=True)
    print('wrote', OUT)


if __name__ == '__main__':
    main(sys.argv[1])
