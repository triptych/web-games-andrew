"""Folio & Fable — turn the ElevenLabs renders into the game's art/ folder.

    python3 -I game-150/dev/art/export.py RAW      # RAW holds the PNGs named in dev/art/README.md

Sheets on plain grey were cut out by ElevenLabs' BiRefNet node first (cut-*.png, real alpha). Here each figure is
found as a connected blob of alpha (the model's grids are never even), named in reading order, trimmed and scaled; scene sheets are sliced into equal panels with
a small inset so no seam shows. Everything is written as webp. Needs Pillow.
"""
import json
import os
import sys

from PIL import Image

RAW = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
os.makedirs(OUT, exist_ok=True)


def src(name):
    return Image.open(os.path.join(RAW, name))


def save(im, name, q=82):
    path = os.path.join(OUT, name)
    im.save(path, 'WEBP', quality=q, method=6)
    print(f'{name:28s} {im.size[0]}x{im.size[1]}  {os.path.getsize(path) // 1024} KB')


def fit_w(im, w):
    if im.width <= w:
        return im
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def cells(im, cols, rows, inset=0.0):
    W, H = im.size
    cw, ch = W / cols, H / rows
    for r in range(rows):
        for c in range(cols):
            x0, y0 = c * cw + cw * inset, r * ch + ch * inset
            yield im.crop((round(x0), round(y0), round(x0 + cw * (1 - 2 * inset)), round(y0 + ch * (1 - 2 * inset))))


def trim(im, pad=4, thresh=20):
    a = im.getchannel('A').point(lambda v: 255 if v > thresh else 0)
    box = a.getbbox()
    if not box:
        return im
    x0, y0, x1, y1 = box
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def blobs(im, names, min_area=400, step=4):
    """Find each figure as a connected blob of alpha (on a 1/step grid), then name them in reading order:
    rows top to bottom, left to right within a row. Grids from the model are never quite even."""
    import numpy as np
    from collections import deque
    a = np.array(im.getchannel('A').resize((im.width // step, im.height // step)))
    m = a > 40
    seen = np.zeros_like(m)
    H, W = m.shape
    found = []
    for y in range(H):
        for x in range(W):
            if not m[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)]); seen[y, x] = True
            x0 = x1 = x; y0 = y1 = y; n = 0
            while q:
                cy, cx = q.popleft(); n += 1
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1), (cy + 1, cx + 1), (cy - 1, cx - 1), (cy + 1, cx - 1), (cy - 1, cx + 1)):
                    if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((ny, nx))
            if n >= min_area / (step * step) * 4:
                found.append([x0 * step, y0 * step, (x1 + 1) * step, (y1 + 1) * step, n])
    # merge small blobs into the nearest big one (a hanging chain, a sword tip)
    found.sort(key=lambda b: -b[4])
    big = found[:len(names)]
    for b in found[len(names):]:
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        t = min(big, key=lambda g: max(0, g[0] - cx, cx - g[2]) + max(0, g[1] - cy, cy - g[3]))
        t[0], t[1], t[2], t[3] = min(t[0], b[0]), min(t[1], b[1]), max(t[2], b[2]), max(t[3], b[3])
    rowh = im.height / max(1, round(im.height / max(1, max(g[3] - g[1] for g in big))))
    big.sort(key=lambda g: (int(((g[1] + g[3]) / 2) // (im.height / ROWS[0])), (g[0] + g[2]) / 2))
    return {n: im.crop((max(0, g[0] - 6), max(0, g[1] - 6), min(im.width, g[2] + 6), min(im.height, g[3] + 6))) for n, g in zip(names, big)}


ROWS = [1]


def key_grey(im, tol=16):
    """Alpha by flood fill from the border over the flat grey background (for what BiRefNet dropped)."""
    import numpy as np
    from collections import deque
    rgb = np.array(im.convert('RGB')).astype(int)
    H, W, _ = rgb.shape
    bg = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), axis=0)
    near = (np.abs(rgb - bg).max(axis=2) <= tol)
    out = np.zeros((H, W), bool)
    q = deque([(y, x) for y in (0, H - 1) for x in range(W)] + [(y, x) for x in (0, W - 1) for y in range(H)])
    for y, x in q: out[y, x] = near[y, x]
    q = deque([(y, x) for (y, x) in q if near[y, x]])
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < H and 0 <= nx < W and near[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True; q.append((ny, nx))
    alpha = Image.fromarray(((~out) * 255).astype('uint8')).filter(__import__('PIL.ImageFilter', fromlist=['x']).MinFilter(3))
    res = im.convert('RGBA'); res.putalpha(alpha)
    return res


def sprites(sheet, rows, names, scale, prefix, meta=None, fix=None):
    im = src(sheet).convert('RGBA')
    ROWS[0] = rows
    for name, t in blobs(im, names).items():
        t = trim(t)
        if fix and name in fix:
            t = fix[name](t)
        t = t.resize((max(1, round(t.width * scale)), max(1, round(t.height * scale))), Image.LANCZOS)
        save(t, f'{prefix}{name}.webp', 88)
        if meta is not None:
            meta[name] = [t.width, t.height]


# ------------------------------------------------------------------ scenes
save(fit_w(src('title.png').convert('RGB'), 1920), 'title.webp', 80)
save(fit_w(src('bg-shop.png').convert('RGB'), 2400), 'bg-shop.webp', 80)
save(fit_w(src('bindery.png').convert('RGB'), 1376), 'bindery.webp', 78)
save(fit_w(src('ending.png').convert('RGB'), 1920), 'ending.webp', 80)
for p in ['tam', 'vellum', 'ottoline', 'elowen']:
    save(src(f'por-{p}.png').convert('RGB').resize((384, 384), Image.LANCZOS), f'por-{p}.webp', 82)

# expedition places and the town's inspirations: 3 x 2 panels
for name, cell in zip(['woods', 'market', 'archive', 'scriptorium', 'attic', 'observatory'], cells(src('places.png').convert('RGB'), 3, 2, 0.012)):
    save(fit_w(cell, 640), f'place-{name}.webp', 80)
for name, cell in zip(['guild', 'school', 'bakery', 'theatre', 'tower', 'garden'], cells(src('town.png').convert('RGB'), 3, 2, 0.012)):
    save(fit_w(cell, 640), f'town-{name}.webp', 80)
# the four adventurers: 2 x 2 portraits
for name, cell in zip(['rook', 'fen', 'juniper', 'maris'], cells(src('adventurers.png').convert('RGB'), 2, 2, 0.01)):
    save(cell.resize((384, 384), Image.LANCZOS), f'hero-{name}.webp', 82)

# ------------------------------------------------------------------ sprites (cut out by BiRefNet)
meta = {}
sprites('cut-furniture.png', 3, ['shelf', 'table', 'armchair', 'lamp', 'fern', 'cat', 'painting', 'ivy'], 0.62, 'furn-', meta)
sprites('cut-customers.png', 2, ['adventurer', 'noble', 'actor', 'cook', 'shopkeeper', 'scholar', 'farmer', 'child'], 0.5, 'folk-', meta)
sprites('cut-cast.png', 1, ['tam', 'vellum'], 0.6, 'cast-', meta)
# BiRefNet dropped the counter (it kept only what it thought was the subject); key it out of the grey ourselves
counter = trim(key_grey(src('furniture.png').crop((1100, 1440, 2046, 2030))))
counter = counter.resize((round(counter.width * 0.62), round(counter.height * 0.62)), Image.LANCZOS)
save(counter, 'furn-counter.webp', 88)
meta['counter'] = [counter.width, counter.height]

# the sixteen materials, packed into one 4 x 4 sheet of 128 px icons
mats = src('cut-materials.png').convert('RGBA')
sheet = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
for i, cell in enumerate(cells(mats, 4, 4)):
    t = trim(cell, 2)
    k = 116 / max(t.width, t.height)
    t = t.resize((max(1, round(t.width * k)), max(1, round(t.height * k))), Image.LANCZOS)
    sheet.paste(t, ((i % 4) * 128 + (128 - t.width) // 2, (i // 4) * 128 + (128 - t.height) // 2), t)
save(sheet, 'mats.webp', 88)

with open(os.path.join(OUT, 'sprites.json'), 'w') as f:
    json.dump(meta, f, indent=1)
print('sprites.json', len(meta))
