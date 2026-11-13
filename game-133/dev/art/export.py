#!/usr/bin/env python3
"""Lanternhall art export: raw fal PNGs -> the WebP files the game loads.

    python3 -I game-133/dev/art/export.py RAW_DIR [name...]

RAW_DIR holds sheet-<id>.png (a 2x2 sheet of one character: neutral, happy, sad, angry), roster.png and
givers-<type>.png (3x2 sheets of six busts), bg-<id>.png, cg-<id>.png and title.png.

Sheets are cut into cells and each cell is keyed on its own border colour (the model paints magenta, green,
pinkish or even white behind a figure, and sometimes white lines between cells): pixels close to the key that
are connected to the cell's edge become transparent, the cut is shrunk by a pixel and feathered, key-coloured
spill on the rim is neutralised, and the figure is trimmed and scaled.
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

RAW = sys.argv[1]
ONLY = set(sys.argv[2:])
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
EXPR = ['neutral', 'happy', 'sad', 'angry']
ROSTER = ['fenna', 'mirelle', 'dorn', 'lyra', 'oswin', 'jorun']


def cut(cell, tol=70, inset=10):
    """Key one cell on its border colour. Returns an RGBA image trimmed to the figure."""
    a = np.asarray(cell.convert('RGB')).astype(np.int32)
    h, w, _ = a.shape
    a = a[inset:h - inset, inset:w - inset]
    h, w, _ = a.shape
    # the key: the median of a band along the top and upper sides (the bottom edge is the figure's own body)
    band = np.concatenate([a[:12].reshape(-1, 3), a[: h // 2, :12].reshape(-1, 3), a[: h // 2, -12:].reshape(-1, 3)])
    key = np.median(band, axis=0)
    dist = np.sqrt(((a - key) ** 2).sum(axis=2))
    near = dist < tol
    # white divider lines the model sometimes draws along cell edges count as background too
    white = (a.min(axis=2) > 235)
    edge = np.zeros_like(near); edge[:14] = edge[-14:] = True; edge[:, :14] = edge[:, -14:] = True
    near |= white & edge
    lab, _ = ndimage.label(near)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    # pockets of key colour enclosed by an arm or a strand of hair
    pockets = near & ~bg & (dist < tol * 0.5)
    plab, n = ndimage.label(pockets)
    if n:
        sizes = ndimage.sum(pockets, plab, range(1, n + 1))
        bg |= np.isin(plab, [i + 1 for i, s in enumerate(sizes) if s > 14])
    fg = ~ndimage.binary_dilation(bg, iterations=1)
    # keep the big connected figure, drop specks
    flab, n = ndimage.label(fg)
    if n > 1:
        sizes = ndimage.sum(fg, flab, range(1, n + 1))
        fg = np.isin(flab, [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * 0.02])
    alpha = ndimage.gaussian_filter(fg.astype(np.float32), 0.8)
    alpha = np.clip((alpha - 0.35) / 0.5, 0, 1)
    # despill: on the rim, pull colour away from the key
    rim = (alpha > 0) & (ndimage.binary_erosion(fg, iterations=3) == 0)
    k = key / 255.0
    rgb = a.astype(np.float32) / 255.0
    lum = rgb.mean(axis=2, keepdims=True)
    closeness = np.clip(1 - dist / (tol * 2.2), 0, 1)[..., None]
    rgb = np.where(rim[..., None], rgb * (1 - closeness) + lum * 0.55 * closeness, rgb)
    out = np.dstack([np.clip(rgb * 255, 0, 255), alpha * 255]).astype(np.uint8)
    im = Image.fromarray(out, 'RGBA')
    box = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    return im.crop(box) if box else im


def save(im, path, height=None, q=86):
    if height and im.height != height:
        im = im.resize((max(1, round(im.width * height / im.height)), height), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=q, method=6)
    return im.size


def cells(im, cols, rows):
    w, h = im.size
    return [im.crop((round(c * w / cols), round(r * h / rows), round((c + 1) * w / cols), round((r + 1) * h / rows))) for r in range(rows) for c in range(cols)]


def cover(im, w, h):
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


made = []
for f in sorted(os.listdir(RAW)):
    name, ext = os.path.splitext(f)
    if ext != '.png' or (ONLY and name not in ONLY):
        continue
    im = Image.open(os.path.join(RAW, f))
    if name.startswith('sheet-'):
        who = name[6:]
        for expr, cell in zip(EXPR, cells(im, 2, 2)):
            made.append((f'por/{who}-{expr}', save(cut(cell), f'{OUT}/por/{who}-{expr}.webp', 900)))
    elif name == 'roster':
        for who, cell in zip(ROSTER, cells(im, 3, 2)):
            made.append((f'por/adv-{who}', save(cut(cell), f'{OUT}/por/adv-{who}.webp', 420)))
    elif name.startswith('givers-'):
        for i, cell in enumerate(cells(im, 3, 2)):
            made.append((f'giv/{name[7:]}-{i}', save(cut(cell), f'{OUT}/giv/{name[7:]}-{i}.webp', 420)))
    elif name.startswith('bg-') or name.startswith('cg-'):
        made.append((name.replace('-', '/', 1), save(cover(im.convert('RGB'), 1280, 720), f'{OUT}/{name[:2]}/{name[3:]}.webp', q=80)))
    elif name == 'title':
        made.append(('title', save(cover(im.convert('RGB'), 1600, 900), f'{OUT}/title.webp', q=82)))
for n, size in made:
    print(f'{n:28s} {size[0]}x{size[1]}')
