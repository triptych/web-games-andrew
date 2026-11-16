"""WanderQuest art export: raw fal renders -> game-085/art/*.webp, icons/*.png and js/art-files.js.

    python3 -I game-085/dev/art/export.py RAW_DIR [name ...]

RAW_DIR holds one PNG per job in prompts.mjs, named after the job (s-mon1.png, w-sphinx.png, bg-frost.png ...).
Sheets are split into their objects by the empty gaps between them (rows first, then columns in each row), not by
an even grid: fal does not always keep to the grid it was asked for. Each object is then cut out on its own:

- the key colour is sampled from the border of the crop (it drifts between renders: magenta came back dusky pink
  on one sheet), white grid lines and gutters are treated as background,
- background is flood-filled from the edges at half resolution, so a key-coloured pocket inside a subject stays,
- rim pixels are un-mixed from the key (a pixel is subject * a + key * (1 - a)), which removes the pink or green
  fringe and turns glows and wisps into real translucency,
- the result is trimmed, scaled (premultiplied) and saved as WebP with alpha.

Needs Pillow and numpy; run with python3 -I.
"""
import json
import subprocess
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
GAME = HERE.parent.parent
OUT = GAME / 'art'
ICONS = GAME / 'icons'

# long side in px for each exported sprite (by name, else by prefix)
SIZE = {'m-': 512, 'w-': 640, 't-': 480, 'c-': 512, 'h-': 448, 'p-': 384, 'x-': 384}
SIZE_NAME = {
    'p-oak': 512, 'p-oak2': 512, 'p-birch': 512, 'p-poplar': 512, 'p-autumn': 512, 'p-willow': 512, 'p-swamptree': 512,
    'p-deadtree': 512, 'p-pine': 512, 'p-pine2': 512, 'p-snowpine': 512, 'p-deadpine': 512, 'p-icespire': 448, 'p-ashtree': 448,
    'p-startree': 512, 'p-blossom': 512, 'p-palm': 448, 'p-saguaro': 448, 'p-windmill': 448, 'p-giantshroom': 448,
    'p-tuft': 160, 'p-flowers': 192, 'p-pebbles': 160, 'p-smallrock': 160, 'p-drytuft': 160, 'p-snowtuft': 160,
    'p-ashtuft': 160, 'p-lily': 192, 'p-toadstool': 192, 'p-glowtuft': 160, 'p-shard': 160, 'p-ember': 192, 'p-iceshards': 192,
    'p-mesa': 1200, 'p-dune': 1000, 'p-treeline': 1400, 'p-pineline': 1400,
    'x-gate': 768, 'x-campfire': 256, 'x-waystone': 384, 'x-waystone-lit': 384, 'x-ox': 384,
}
# sheets whose objects came back in a different layout: which of the found objects to keep, in item order
PICK = {'p-meadow-ground': [0, 1, 2, 3, 4, 7]}      # 8 objects in three rows (two logs and two stumps); keep the first of each
# objects whose glow blends into the key: un-mix a wider rim
GLOW = {'p-floatrock', 'p-blossom', 'm-wisp', 'm-rime', 'm-wraith', 'm-shade', 'p-crystal', 'p-crystal2', 'p-shard', 'p-glowshroom', 'p-glowtuft',
        'p-obelisk', 'p-startree', 'x-waystone-lit', 'x-campfire', 'w-witch', 'p-vent', 'p-ember', 'p-lavarock', 'm-imp'}
# town sheets that came back with captions written across the top of each painting
CAPTIONED = {'s-towns1', 's-towns4'}


def jobs():
    out = subprocess.run(['node', str(HERE / 'prompts.mjs')], capture_output=True, text=True, check=True).stdout
    return {j['name']: j for j in json.loads(out)}


# ------------------------------------------------------------------ keying
def border_keys(a, w=24):
    """Up to three key colours from the image border (the key drifts; white gutters and frames count too)."""
    b = np.concatenate([a[:w].reshape(-1, 3), a[-w:].reshape(-1, 3), a[:, :w].reshape(-1, 3), a[:, -w:].reshape(-1, 3)]).astype(np.float32)
    q = (b // 24).astype(np.int32)
    ids = q[:, 0] * 10000 + q[:, 1] * 100 + q[:, 2]
    vals, counts = np.unique(ids, return_counts=True)
    keys = []
    for v in vals[np.argsort(-counts)][:6]:
        sel = b[ids == v]
        if len(sel) < len(b) * 0.04:
            continue
        k = np.median(sel, axis=0)
        if all(np.abs(k - o).max() > 30 for o in keys):
            keys.append(k)
        if len(keys) == 3:
            break
    return keys or [np.median(b, axis=0)]


def dist_to(a, keys):
    af = a.astype(np.float32)
    return np.min([np.abs(af - k[None, None, :]).max(axis=2) for k in keys], axis=0)


def white_lines(a):
    """Rows/columns that are mostly bright and unsaturated: drawn grid lines and gutters."""
    af = a.astype(np.int16)
    white = (af.min(axis=2) > 205) & ((af.max(axis=2) - af.min(axis=2)) < 40)
    m = np.zeros(white.shape, bool)
    m[white.mean(axis=1) > 0.6, :] = True
    m[:, white.mean(axis=0) > 0.6] = True
    return m & white


def flood(near):
    """Background reachable from the border through `near` pixels (BFS at half resolution)."""
    h, w = near.shape
    small = near[::2, ::2]
    sh, sw = small.shape
    seen = np.zeros_like(small)
    q = deque()
    for x in range(sw):
        for y in (0, sh - 1):
            if small[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(sh):
        for x in (0, sw - 1):
            if small[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < sh and 0 <= nx < sw and small[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    big = np.repeat(np.repeat(seen, 2, axis=0), 2, axis=1)[:h, :w]
    return big & near


def grow(mask, px):
    im = Image.fromarray((mask * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.MaxFilter(px * 2 + 1))) > 127


def cut(rgb, glow=False, tol=60):
    """rgb: HxWx3 uint8 crop with background all round it. Returns an RGBA image, trimmed."""
    a = rgb.copy()
    lines = grow(white_lines(a), 3)          # and their anti-aliased edges
    keys = border_keys(a)
    d = dist_to(a, keys)
    near = (d < tol) | lines
    bg = flood(near) | (d < tol * 0.45) | lines
    alpha = np.where(bg, 0.0, 1.0)
    # un-mix the rim from the main (most common) key colour
    K = keys[0]
    rim = grow(bg, 26 if glow else 4) & ~bg
    af = a.astype(np.float32)
    r, g, b = af[..., 0], af[..., 1], af[..., 2]
    Kr, Kg, Kb = K
    if Kg < min(Kr, Kb):          # magenta-ish key
        cast = np.minimum(r, b) - g; kcast = min(Kr, Kb) - Kg
        hue_ok = np.abs(r - b) < 0.6 * np.maximum(r, b) + 10
    elif Kg > max(Kr, Kb):        # green key
        cast = g - np.maximum(r, b); kcast = Kg - max(Kr, Kb)
        hue_ok = np.ones_like(g, bool)
    else:                         # white or grey key: nothing to un-mix
        cast = np.zeros_like(g); kcast = 1; hue_ok = np.zeros_like(g, bool)
    share = np.clip(cast / max(kcast, 1), 0, 1) * (rim & hue_ok)
    keep = 1 - share
    alpha = np.where(rim, np.minimum(alpha, keep), alpha)
    col = (af - share[..., None] * np.array(K)[None, None, :]) / np.maximum(keep, 0.05)[..., None]
    col = np.where(rim[..., None], col, af)
    # drop the faintest rim pixels and specks
    alpha[alpha < 0.12] = 0
    out = np.dstack([np.clip(col, 0, 255), alpha * 255]).astype(np.uint8)
    im = Image.fromarray(out, 'RGBA')
    bbox = im.getchannel('A').point(lambda v: 255 if v > 60 else 0).getbbox()
    return im.crop(bbox) if bbox else im


def fit(im, long_side):
    k = min(1.0, long_side / max(im.size))
    size = (max(1, round(im.width * k)), max(1, round(im.height * k)))
    return im.convert('RGBa').resize(size, Image.LANCZOS).convert('RGBA')


# ------------------------------------------------------------------ splitting sheets
def bands(profile, gap):
    """Runs of True in a 1D profile, merging runs separated by fewer than `gap` False entries."""
    runs, start, last = [], None, None
    for i, v in enumerate(profile):
        if v:
            if start is None: start = i
            elif i - last > gap:
                runs.append((start, last + 1)); start = i
            last = i
    if start is not None:
        runs.append((start, last + 1))
    return runs


def objects(rgb, tol=60):
    """Bounding boxes of the separate objects on a sheet, in reading order."""
    a = rgb
    keys = border_keys(a)
    fg = ~((dist_to(a, keys) < tol) | white_lines(a))
    # quarter resolution for the layout, and ignore specks
    s = 4
    small = fg[: fg.shape[0] // s * s, : fg.shape[1] // s * s].reshape(fg.shape[0] // s, s, fg.shape[1] // s, s).mean(axis=(1, 3)) > 0.5
    rows = bands(small.sum(axis=1) > 2, 6)
    boxes = []
    for y0, y1 in rows:
        part = small[y0:y1]
        cols = bands(part.sum(axis=0) > 1, 6)
        for x0, x1 in cols:
            sub = part[:, x0:x1]
            mass = sub.sum()
            ys = np.where(sub.any(axis=1))[0]
            boxes.append((mass, (x0 * s, (y0 + ys[0]) * s, x1 * s, (y0 + ys[-1] + 1) * s)))
    if not boxes:
        return []
    big = max(m for m, _ in boxes)
    return [b for m, b in boxes if m > big * 0.02]


def crop_pad(rgb, box, pad=16):
    x0, y0, x1, y1 = box
    h, w, _ = rgb.shape
    return rgb[max(0, y0 - pad): min(h, y1 + pad), max(0, x0 - pad): min(w, x1 + pad)]


def save_sprite(im, name, man):
    side = SIZE_NAME.get(name) or SIZE.get(name[:2], 384)
    im = fit(im, side)
    im.save(OUT / f'{name}.webp', quality=86, method=6)
    man[name] = [im.width, im.height]
    return im


# ------------------------------------------------------------------ main
def main(raw, only):
    raw = Path(raw)
    OUT.mkdir(exist_ok=True)
    J = jobs()
    manpath = OUT / 'manifest.json'
    man = json.loads(manpath.read_text()) if manpath.exists() else {}
    want = lambda n: not only or n in only
    for name, j in J.items():
        src = raw / f'{name}.png'
        if not want(name):
            continue
        if not src.exists():
            print('MISSING', name); continue
        img = np.asarray(Image.open(src).convert('RGB'))
        if j['group'] in ('towns',):
            export_towns(img, j, man)
        elif name == 'title':
            Image.fromarray(img).resize((1920, round(img.shape[0] * 1920 / img.shape[1])), Image.LANCZOS).save(OUT / 'title.webp', quality=80, method=6)
            man['title'] = [1920, round(img.shape[0] * 1920 / img.shape[1])]
            print('title')
        elif name == 'icon':
            export_icon(img)
        elif j['group'] == 'mountains':
            im = cut(img, tol=70)
            im = im.convert('RGBa').resize((round(im.width * 560 / im.height), 560), Image.LANCZOS).convert('RGBA')
            im.save(OUT / f'{name}.webp', quality=84, method=6)
            man[name] = [im.width, im.height]
            print('mountains', name, im.size)
        elif 'items' in j or 'rows' in j:
            items = j.get('items') or j.get('rows')
            boxes = objects(img)
            if name in PICK:
                boxes = [boxes[i] for i in PICK[name]]
            elif len(boxes) != len(items) and 'cells' in j:
                # fall back to the grid it was asked for (the background was too uneven to find the gaps)
                c, r = j['cells']; h, w, _ = img.shape
                boxes = [(round(i % c * w / c) + 40, round(i // c * h / r) + 40, round((i % c + 1) * w / c) - 40, round((i // c + 1) * h / r) - 40) for i in range(len(items))]
                print('   using the even grid')
            flag = '' if len(boxes) == len(items) else f'  <-- found {len(boxes)} objects for {len(items)} items'
            print(name, len(boxes), flag)
            for item, box in zip(items, boxes):
                im = cut(crop_pad(img, box), glow=item in GLOW)
                im = save_sprite(im, item, man)
        else:                         # a single keyed subject
            im = cut(img, glow=name in GLOW)
            save_sprite(im, name, man)
            print('single', name, im.size)
    manpath.write_text(json.dumps(dict(sorted(man.items())), indent=0))
    names = sorted(k for k in man)
    js = '// Generated by dev/art/export.py: every painted picture in art/ and its size in px, so the game never asks for one that isn\'t there.\n'
    js += 'export const ART_FILES = ' + json.dumps({k: man[k] for k in names}, separators=(',', ':')).replace('],"', '],\n"') + ';\n'
    (GAME / 'js' / 'art-files.js').write_text(js)
    print('total', len(man), 'pictures')


def export_towns(img, j, man):
    h, w, _ = img.shape
    af = img.astype(np.int16)
    white = (af.min(axis=2) > 225) & ((af.max(axis=2) - af.min(axis=2)) < 30)
    cols = bands(white.mean(axis=0) < 0.7, 4)
    rows = bands(white.mean(axis=1) < 0.7, 4)
    c, r = j['cells']
    if len(cols) != c:
        cols = [(round(i * w / c), round((i + 1) * w / c)) for i in range(c)]
    if len(rows) != r:
        rows = [(round(i * h / r), round((i + 1) * h / r)) for i in range(r)]
    k = 0
    for y0, y1 in rows:
        for x0, x1 in cols:
            if k >= len(j['items']):
                break
            inset = round(0.035 * (x1 - x0))        # past any frame line drawn round the painting
            cx0, cy0, cx1, cy1 = x0 + inset, y0 + inset, x1 - inset, y1 - inset
            if j['name'] in CAPTIONED:
                cy0 += round(0.11 * (y1 - y0))
            side = min(cx1 - cx0, cy1 - cy0)
            # square from the bottom middle: the town and road sit low, sky and captions high
            sx = (cx0 + cx1 - side) // 2
            sy = cy1 - side
            cell = Image.fromarray(img[sy: sy + side, sx: sx + side]).resize((384, 384), Image.LANCZOS)
            name = j['items'][k]
            cell.save(OUT / f'{name}.webp', quality=82, method=6)
            man[name] = [384, 384]
            k += 1
    print('towns', j['name'], k)


def export_icon(img):
    im = Image.fromarray(img)
    a = img.astype(np.int16)
    nonwhite = a.min(axis=2) < 225
    ys, xs = np.where(nonwhite)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    inset = round(0.07 * (x1 - x0))       # past the rounded corners
    sq = im.crop((x0 + inset, y0 + inset, x1 - inset, y1 - inset))
    side = min(sq.size)
    sq = sq.crop(((sq.width - side) // 2, (sq.height - side) // 2, (sq.width - side) // 2 + side, (sq.height - side) // 2 + side))
    ICONS.mkdir(exist_ok=True)
    for name, px in (('icon-512', 512), ('icon-192', 192), ('icon-180', 180), ('icon-96', 96), ('favicon-32', 32)):
        sq.resize((px, px), Image.LANCZOS).save(ICONS / f'{name}.png', optimize=True)
    print('icons')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'raw', set(sys.argv[2:]))
