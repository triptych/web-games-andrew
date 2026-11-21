#!/usr/bin/env python3
"""Raw fal renders -> game-030/art/.   python3 -I game-030/dev/art/export.py RAW_DIR [names...]

RAW_DIR holds the raw PNGs named <kind>-<id>.png (see prompts.mjs and README.md):
  bg-*, cg-*      cover-cropped to 16:9, 1280x720 WebP; cg-title also 1600x900 as art/title.webp (its painted lettering
                  is covered, the game sets its own logo over it)
  por-*           keyed out of their flat background, trimmed, 760 px tall WebP with alpha (art/por/)
  chibi-*         keyed, trimmed, 150 px tall (art/chibi/); the map draws them facing right and mirrors them
  enemy-*         keyed, trimmed, at most 460 px (art/enemy/)
  prop-*          keyed, trimmed, at most 420 px wide (art/prop/)
  sheet-*         a 3x3 sheet of props: keyed, cut into cells, each trimmed, at most 220 px (art/prop/<name>.webp)
  items-a/-b      sheets of item icons (4x3 and 3x3), cut into 96 px icons (art/item/<id>.webp)
  tex-*           made seamless (blended with a half-offset copy through a soft cross mask), 384 px (art/tex/)
Keying: the key colour is the median of the border (the model paints #0a0-ish green or #d040c0-ish magenta,
never the pure colour). Alpha ramps with the distance to the key; only background connected to the border is
keyed, plus enclosed pockets of near-pure key; part-key pixels are unmixed, and a 3 px band at the edge is
despilled (green or magenta cast pulled back). Adapted from game-028 / game-140. Needs Pillow and numpy.
"""
import os, sys, re
import numpy as np
from PIL import Image
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, '..', '..', 'art'))
SHEETS = {
    'nature': ['tree_oak', 'tree_pine', 'tree_dead', 'bush', 'rock', 'flowers', 'mushrooms', 'stump', 'fern'],
    'town': ['barrel', 'crates', 'signpost', 'lamp', 'well', 'scrap_heap', 'pipes', 'gear_big', 'chest'],
}
# items-a came back as ragged rows, not the 4x3 grid asked for: its icons are picked by blob, in reading order
# (rows ~450 px tall, then left to right). Blob 4 is a second, copper oil can the game doesn't use.
ITEMS_A_BLOBS = {'tea': 0, 'scone': 1, 'smoke': 2, 'oilcan': 3, 'tonic': 5, 'wakeup': 6, 'wrench': 8, 'rollingpin': 9, 'spanner': 10, 'skillet': 11, 'sparkrod': 12, 'apron': 13}
ITEM_SHEETS = {
    'a': None,
    'b': (3, 3, ['brassvest', 'goggles', 'charm', 'cog', 'spring', 'scrap', 'kettle', 'lairkey', 'goldgear']),
}

def cover(im, w, h):
    sw, sh = im.size
    s = max(w / sw, h / sh)
    im = im.resize((round(sw * s), round(sh * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))

def key_out(im, trim=True, full_despill=False):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    H, W, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    key = np.median(border, axis=0)
    green = key[1] > key[0] and key[1] > key[2]
    d = np.sqrt(((a - key) ** 2).sum(axis=2))
    lo, hi = 34.0, 95.0
    alpha = np.clip((d - lo) / (hi - lo), 0, 1)
    near = d < hi
    seen = np.zeros((H, W), bool)
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if near[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if near[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    pocket = np.clip((d - lo) / 25.0, 0, 1)
    alpha = np.where(seen, alpha, np.where(d < lo + 25, pocket, 1.0))
    am = np.maximum(alpha, 0.05)[..., None]
    fg = np.clip((a - (1 - am) * key) / am, 0, 255)
    keyed = alpha < 0.99
    edge = keyed.copy()
    for _ in range(3):
        e = edge.copy()
        e[1:] |= edge[:-1]; e[:-1] |= edge[1:]; e[:, 1:] |= edge[:, :-1]; e[:, :-1] |= edge[:, 1:]
        edge = e
    if green:
        m = np.maximum(fg[..., 0], fg[..., 2])
        # glows (a blazing staff, a lantern) let the key through everywhere, not just at the edge: for people, who wear no
        # green on a green key, pull every pixel's green down to its other channels
        spill = np.clip(fg[..., 1] - m, 0, None) * (1.0 if full_despill else np.where(edge, 0.85, 0))
        fg[..., 1] -= spill
    else:
        m = np.minimum(fg[..., 0], fg[..., 2])
        # magenta leaves a pink rim on the cut-out: drop pixels near the edge that are still clearly magenta-tinted
        near = keyed.copy()
        for _ in range(6):
            e = near.copy()
            e[1:] |= near[:-1]; e[:-1] |= near[1:]; e[:, 1:] |= near[:, :-1]; e[:, :-1] |= near[:, 1:]
            near = e
        tint = (fg[..., 0] - fg[..., 1] > 28) & (fg[..., 2] - fg[..., 1] > 28)
        alpha = np.where(near & tint, 0.0, alpha)
        spill = np.where(edge, np.clip(m - fg[..., 1], 0, None) * 1.0, 0)
        fg[..., 0] -= spill; fg[..., 2] -= spill
    rgba = np.dstack([fg, alpha * 255]).astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    if not trim: return out
    bbox = out.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return out.crop(bbox) if bbox else out

def fit(im, maxw, maxh):
    s = min(maxw / im.width, maxh / im.height, 1.0)
    return im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)

def components(alpha, min_area):
    """Bounding boxes of the opaque blobs (4-connected, on a 1/4 scale mask for speed)."""
    small = alpha[::4, ::4] > 40
    H, W = small.shape
    lab = np.zeros((H, W), np.int32)
    boxes = []
    n = 0
    for y in range(H):
        for x in range(W):
            if not small[y, x] or lab[y, x]: continue
            n += 1
            q = deque([(y, x)]); lab[y, x] = n
            x0 = x1 = x; y0 = y1 = y; area = 0
            while q:
                cy, cx = q.popleft(); area += 1
                x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and small[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n; q.append((ny, nx))
            if area * 16 >= min_area: boxes.append((x0 * 4, y0 * 4, (x1 + 1) * 4, (y1 + 1) * 4, area))
    return boxes

def cut_grid(im, cols, rows, names, outdir, size):
    keyed = key_out(im, trim=False)
    A = np.asarray(keyed.getchannel('A'))
    W, H = keyed.size
    cw, ch = W / cols, H / rows
    boxes = components(A, (cw * ch) * 0.004)
    for i, name in enumerate(names):
        c, r = i % cols, i // cols
        cx0, cy0 = c * cw, r * ch
        mine = [b for b in boxes if cx0 <= (b[0] + b[2]) / 2 < cx0 + cw and cy0 <= (b[1] + b[3]) / 2 < cy0 + ch]
        if not mine: print('  EMPTY cell', name); continue
        x0 = min(b[0] for b in mine); y0 = min(b[1] for b in mine); x1 = max(b[2] for b in mine); y1 = max(b[3] for b in mine)
        # keep only this cell's blobs: blank everything else in the crop
        crop = np.asarray(keyed.crop((x0, y0, x1, y1))).copy()
        mask = np.zeros(crop.shape[:2], bool)
        for b in mine: mask[b[1] - y0:b[3] - y0, b[0] - x0:b[2] - x0] = True
        crop[~mask, 3] = 0
        out = Image.fromarray(crop, 'RGBA')
        bbox = out.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        if bbox: out = out.crop(bbox)
        fit(out, size, size).save(os.path.join(outdir, name + '.webp'), quality=86, method=6)
        print('  cell', name, out.size)

def cut_blobs(im, mapping, outdir, size):
    keyed = key_out(im, trim=False)
    boxes = components(np.asarray(keyed.getchannel('A')), (im.width * im.height) * 0.0008)
    boxes.sort(key=lambda b: (round((b[1] + b[3]) / 2 / (im.height / 4)), (b[0] + b[2]) / 2))
    for name, i in mapping.items():
        x0, y0, x1, y1, _ = boxes[i]
        out = keyed.crop((x0, y0, x1, y1))
        bbox = out.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
        if bbox: out = out.crop(bbox)
        fit(out, size, size).save(os.path.join(outdir, name + '.webp'), quality=86, method=6)
        print('  blob', name, out.size)

def seamless(im, size):
    a = np.asarray(im.convert('RGB').resize((size, size), Image.LANCZOS)).astype(np.float32)
    b = np.roll(np.roll(a, size // 2, 0), size // 2, 1)
    t = np.linspace(-1, 1, size)
    wx = np.clip(np.abs(t) * 1.6 - 0.6, 0, 1)
    w = np.maximum(wx[None, :], wx[:, None])[..., None]   # 1 near the edges: use the shifted copy there
    out = a * (1 - w) + b * w
    return Image.fromarray(out.astype(np.uint8), 'RGB')

TITLE_BOX = (0.45, 0.745, 0.055, 0.285)   # x0, x1, y0, y1 of the painted lettering, as fractions of the 1600x900 picture

def main():
    raw = sys.argv[1]
    only = set(sys.argv[2:])
    for d in ('bg', 'cg', 'por', 'chibi', 'enemy', 'prop', 'item', 'tex'): os.makedirs(os.path.join(ART, d), exist_ok=True)
    for f in sorted(os.listdir(raw)):
        if not f.endswith('.png'): continue
        name = f[:-4]
        if only and name not in only: continue
        im = Image.open(os.path.join(raw, f))
        kind, _, id_ = name.partition('-')
        if kind in ('bg', 'cg'):
            cover(im.convert('RGB'), 1280, 720).save(os.path.join(ART, kind, id_ + '.webp'), quality=80, method=6)
            if name == 'cg-title':
                t = cover(im.convert('RGB'), 1600, 900)
                a = np.asarray(t).copy()
                # the model painted the title into the sky: cover it with the sky just to its left, mirrored in
                x0, x1 = (int(v * 1600) for v in TITLE_BOX[:2]); y0, y1 = (int(v * 900) for v in TITLE_BOX[2:])
                af = a.astype(np.float32)
                left = af[y0:y1, x0 - 10:x0].mean(axis=1)          # the sky just outside the box, row by row
                right = af[y0:y1, x1:x1 + 10].mean(axis=1)
                t = np.linspace(0, 1, x1 - x0)[None, :, None]
                fill = left[:, None, :] * (1 - t) + right[:, None, :] * t
                fill += np.random.RandomState(3).normal(0, 2.0, fill.shape)
                a[y0:y1, x0:x1] = np.clip(fill, 0, 255).astype(np.uint8)
                Image.fromarray(a).save(os.path.join(ART, 'title.webp'), quality=82, method=6)
        elif kind == 'por':
            out = key_out(im, full_despill=True)
            fit(out, 2000, 760).save(os.path.join(ART, 'por', id_ + '.webp'), quality=84, method=6)
            if id_ == 'bertha':   # no separate battle painting: Bertha fights as her portrait
                fit(out, 460, 560).save(os.path.join(ART, 'enemy', 'bigbertha.webp'), quality=86, method=6)
        elif kind == 'chibi':
            fit(key_out(im, full_despill=True), 400, 150).save(os.path.join(ART, 'chibi', id_ + '.webp'), quality=88, method=6)
        elif kind == 'enemy':
            fit(key_out(im), 460, 460).save(os.path.join(ART, 'enemy', id_ + '.webp'), quality=86, method=6)
        elif kind == 'prop':
            fit(key_out(im), 420, 420).save(os.path.join(ART, 'prop', id_ + '.webp'), quality=86, method=6)
        elif kind == 'sheet':
            print('sheet', id_); cut_grid(im, 3, 3, SHEETS[id_], os.path.join(ART, 'prop'), 220)
        elif kind == 'items':
            print('items', id_)
            if ITEM_SHEETS[id_] is None: cut_blobs(im, ITEMS_A_BLOBS, os.path.join(ART, 'item'), 96)
            else:
                cols, rows, ids = ITEM_SHEETS[id_]
                cut_grid(im, cols, rows, ids, os.path.join(ART, 'item'), 96)
        elif kind == 'tex':
            seamless(im, 384).save(os.path.join(ART, 'tex', id_.replace('wall2', 'wall') + '.webp'), quality=82, method=6)
        else:
            continue
        print('ok', name)

if __name__ == '__main__':
    main()
