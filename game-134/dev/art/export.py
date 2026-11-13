"""UFOops! art export: raw fal renders -> game-134/art/*.webp plus art/manifest.json.

    python3 -I game-134/dev/art/export.py RAW_DIR

Sprites were rendered on a flat key colour (magenta, or green / blue where the subject is purple or pink).
The key is measured from each image's border (it drifts between renders), flood-filled away from the edges,
enclosed pockets of the key are removed too, edge pixels are despilled, and the result is trimmed and scaled.
Backdrops are resized and the top of their flat ground strip is found, so the game can line it up with the
ground the walkers stand on. Needs Pillow and numpy.
"""
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'art'

# name -> (long side in px, kind). 'walker' sprites are trimmed so their feet are the bottom edge.
SPRITES = {
    'cow': 220, 'chicken': 140, 'pig': 190, 'sheep': 190, 'golden': 220, 'farmer': 240, 'townie': 240,
    'gunner': 240, 'agent': 240, 'tinfoil': 240, 'tank': 300, 'laser': 220, 'boss': 560, 'jet': 300,
    'ufo': 260, 'ufo-crash': 260, 'mothership': 900,
}
PORTRAITS = {'mother': 'mother-0', 'mother-joy': 'mother-1', 'mother-cross': 'mother--1'}
BACKDROPS = ['farm', 'night', 'corn', 'town', 'base', 'desert', 'finale']
PICKUPS = ['wrench', 'tape', 'turbo', 'mega', 'shield', 'clock', 'star', 'heart']   # 4x2 sheet, row by row


def key_of(a):
    """The key colour: the median of the outermost 6 px border."""
    b = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    return np.median(b, axis=0)


def keyness(a, key):
    """0 = exactly the key, larger = further from it. Hue-aware: compares the chroma direction too."""
    d = np.abs(a.astype(np.float32) - key[None, None, :]).max(axis=2)
    return d


def cut(img, tol=70):
    a = np.asarray(img.convert('RGB')).astype(np.int16)
    h, w, _ = a.shape
    key = key_of(a)
    d = keyness(a, key)
    near = d < tol
    # flood fill from every border pixel through key-coloured pixels
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    # enclosed pockets of pure key (between legs, inside a handle)
    bg |= d < tol * 0.55
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # soften and despill the rim: pixels next to the background that still lean towards the key
    rim = np.zeros_like(bg)
    rim[1:] |= bg[:-1]; rim[:-1] |= bg[1:]; rim[:, 1:] |= bg[:, :-1]; rim[:, :-1] |= bg[:, 1:]
    rim &= ~bg
    rgb = a.astype(np.float32)
    lean = rim & (d < tol * 1.8)
    alpha[lean] = np.clip((d[lean] - tol * 0.5) / (tol * 1.3) * 255, 60, 255).astype(np.uint8)
    # pull the key's dominant channels down to the others on rim pixels
    kmax = key.argmax()
    for c in range(3):
        if key[c] > 160:
            others = [o for o in range(3) if o != c]
            m = rgb[..., others].max(axis=2)
            rgb[..., c] = np.where(rim, np.minimum(rgb[..., c], m + 30), rgb[..., c])
    out = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), alpha])
    im = Image.fromarray(out, 'RGBA')
    bbox = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
    return im.crop(bbox) if bbox else im


def fit(im, long_side):
    k = long_side / max(im.size)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def ground_frac(img):
    """Top of the flat strip at the bottom of a backdrop: walk up from the bottom while rows stay plain."""
    a = np.asarray(img.convert('RGB').resize((400, 200))).astype(np.float32)
    base = np.median(a[-12:].reshape(-1, 3), axis=0)
    for y in range(a.shape[0] - 1, 0, -1):
        row = a[y]
        far = (np.abs(row - base).max(axis=1) > 38).mean()
        if far > 0.12:
            return round((y + 1) / a.shape[0], 3)
    return 0.85


def main(raw):
    raw = Path(raw)
    for sub in ('spr', 'bg', 'por', 'icons'):
        (OUT / sub).mkdir(parents=True, exist_ok=True)
    man = {'sprites': {}, 'backdrops': {}, 'portraits': [], 'pickups': []}
    for name, side in SPRITES.items():
        src = raw / f'{name}.png'
        if not src.exists():
            print('missing', name); continue
        im = fit(cut(Image.open(src)), side)
        im.save(OUT / 'spr' / f'{name}.webp', quality=88, method=6)
        man['sprites'][name] = [im.width, im.height]
        print('sprite', name, im.size)
    for src_name, out_name in PORTRAITS.items():
        src = raw / f'{src_name}.png'
        if not src.exists():
            print('missing', src_name); continue
        im = fit(cut(Image.open(src), tol=80), 320)
        im.save(OUT / 'por' / f'{out_name}.webp', quality=88, method=6)
        man['portraits'].append(out_name)
        print('portrait', out_name, im.size)
    sheet = raw / 'pickups.png'
    if sheet.exists():
        s = Image.open(sheet).convert('RGB')
        cw, ch = s.width / 4, s.height / 2
        for i, name in enumerate(PICKUPS):
            x, y = (i % 4) * cw, (i // 4) * ch
            cell = s.crop((round(x), round(y), round(x + cw), round(y + ch)))
            im = fit(cut(cell), 128)
            im.save(OUT / 'icons' / f'{name}.webp', quality=90, method=6)
            man['pickups'].append(name)
        print('pickups', len(PICKUPS))
    for name in BACKDROPS:
        src = raw / f'bg-{name}.png'
        if not src.exists():
            print('missing bg', name); continue
        img = Image.open(src).convert('RGB')
        g = ground_frac(img)
        h = 720
        im = img.resize((round(img.width * h / img.height), h), Image.LANCZOS)
        im.save(OUT / 'bg' / f'{name}.webp', quality=80, method=6)
        man['backdrops'][name] = {'size': [im.width, im.height], 'ground': g}
        print('backdrop', name, im.size, 'ground at', g)
    (OUT / 'manifest.json').write_text(json.dumps(man, indent=1))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'raw')
