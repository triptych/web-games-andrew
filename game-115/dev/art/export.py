"""Hearthwick art export: raw fal sheets -> game-115/art/**/*.webp plus art/manifest.json.

    python3 -I game-115/dev/art/export.py RAW_DIR

RAW_DIR holds one PNG per sheet in prompts.json (b-hall.png, n-oak.png, c-mage.png ...). Needs Pillow, numpy, scipy.

Every sheet was rendered on a flat magenta key. The key is measured from each image's border (it drifts between renders),
flood-filled from the edges, enclosed pockets of it are removed, rim pixels are despilled. A sheet is cut into its grid at the
emptiest gutters near the expected lines, and inside a cell only the subject is kept: stray grid lines, caption text under a
building and specks are dropped. Each sprite is trimmed, scaled to a fixed pixel density and its size in tiles written to the
manifest. Buildings also get a night-glow mask (warm lit windows, forges, lamps found by colour and local contrast) and, for the
types that smoke, the tops of their chimneys.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'art'
PPT = 112                        # exported pixels per tile

# Width in tiles of each building's sprite (the code painter's widths, so footprints line up), and its tallest allowed height.
BW = {'hall': 3.5, 'house': 2.5, 'storehouse': 2.5, 'woodshed': 3.5, 'quarry': 3.4, 'farm': 4.6, 'orchard': 3.4, 'dock': 2.8,
      'herbgarden': 2.5, 'henhouse': 2.5, 'apiary': 2.4, 'mine': 3.4, 'library': 3.5, 'carpenter': 3.5, 'mill': 2.0,
      'loom': 2.5, 'smithy': 3.5, 'alchemist': 2.5, 'tavern': 3.5, 'guild': 3.5, 'inn': 3.5, 'itemshop': 2.5, 'market': 2.6,
      'healer': 2.6, 'watchtower': 1.9, 'stables': 3.5, 'flowerbed': 1.0, 'lantern': 0.55, 'bench': 1.0, 'well': 1.05,
      'fountain': 2.0, 'statue': 1.4}
HMAX = {'mill': 3.4, 'watchtower': 3.7, 'lantern': 1.5, 'statue': 2.7}
SMOKY = {'hall', 'house', 'library', 'carpenter', 'loom', 'smithy', 'alchemist', 'tavern', 'inn', 'itemshop'}
# Overrides: a different grid than asked for, which columns to keep, keep only the biggest piece.
GRID = {'c-archer': ((4, 2), [0, 2, 3]), 'c-rogue': ((4, 2), [0, 2, 3])}
LARGEST_ONLY = {'house3', 'alchemist1'}
HUB = {'mill1': [0.5, 0.36], 'mill2': [0.5, 0.33], 'mill3': [0.35, 0.33]}
# Rows split by their real gaps instead of an even grid: the guild's second row holds two wide halls; the alchemist sheet came
# back with five subjects for three stages (two touching huts, the shop, two towers): its columns are given by hand (x in the
# 2200 px wide working copy), and the first hut is cut free of the second with LARGEST_ONLY.
SEGMENT = {'b-guild': None, 'b-alchemist': [(10, 430), (876, 1341), (1771, 2157)]}   # sail hubs, read off the contact sheet


def kind_of(name):
    for t in sorted(BW, key=len, reverse=True):
        if name.startswith(t) and (name[len(t):].isdigit() or name == t):
            return 'b', t
    return ('n', None) if name.startswith(('tree', 'rock', 'stump', 'pebbles', 'bush', 'flax', 'herbp', 'mush')) else \
           ('x', None) if name in ('sails', 'scaffold', 'cart') else ('c', None)


def key_of(a):
    b = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    return np.median(b, axis=0)


def background(a, tol=72):
    """Boolean mask of the key: flood fill from the border through key-like pixels, plus pockets of near-exact key."""
    key = key_of(a)
    d = np.abs(a - key[None, None, :]).max(axis=2)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    magentaish = (g < np.minimum(r, b) - 70) & (np.abs(r - b) < 70) & (r > 120)
    near = (d < tol) | magentaish
    lab, _ = ndimage.label(near)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, edge[edge > 0])
    bg |= d < tol * 0.5
    # straight divider lines the model drew between cells: dark rows/columns running most of the image
    dark = a.max(axis=2) < 90
    H, W = dark.shape
    dcol = (dark | np.roll(dark, 1, axis=1) | np.roll(dark, -1, axis=1)).mean(axis=0)
    drow = (dark | np.roll(dark, 1, axis=0) | np.roll(dark, -1, axis=0)).mean(axis=1)
    iso = lambda p, i: p[i] > 0.85 and p[max(0, i - 9)] < 0.15 and p[min(len(p) - 1, i + 9)] < 0.15   # thin, not a dark tower
    for x in [i for i in range(len(dcol)) if iso(dcol, i)]:
        bg[:, max(0, x - 2):x + 3] = True
    for y in [i for i in range(len(drow)) if iso(drow, i)]:
        bg[max(0, y - 2):y + 3] = True
    return bg, d, key


def segments(fg, n):
    """Split a strip into n items at its widest empty column runs (None if it has fewer than n pieces)."""
    occ = ndimage.binary_dilation(fg.any(axis=0), iterations=6)
    lab, k = ndimage.label(occ)
    if n == 99:
        return [(sl[0].start, sl[0].stop) for sl in ndimage.find_objects(lab)]
    if k < n:
        return None
    runs = [(sl[0].start, sl[0].stop) for sl in ndimage.find_objects(lab)]
    while len(runs) > n:                                   # merge across the narrowest gap
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = int(np.argmin(gaps))
        runs[i:i + 2] = [(runs[i][0], runs[i + 1][1])]
    return runs


def gutters(fg, n, axis):
    """n-1 cut positions along an axis, each at the emptiest line within 14% of where an even grid would put it."""
    prof = fg.sum(axis=1 - axis).astype(np.float32)
    L = len(prof)
    cuts = [0]
    for i in range(1, n):
        c = L * i / n
        lo, hi = int(c - L * 0.14 / n * 2), int(c + L * 0.14 / n * 2)
        seg = ndimage.uniform_filter1d(prof[lo:hi], 9)
        cuts.append(lo + int(np.argmin(seg)))
    cuts.append(L)
    return cuts


def clean(fg, largest_only=False):
    """Keep the subject in one cell: the biggest piece plus anything big enough that sits with it."""
    lab, n = ndimage.label(fg, structure=np.ones((3, 3)))
    if n == 0:
        return fg
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    objs = ndimage.find_objects(lab)
    main = int(np.argmax(sizes))
    my0, my1 = objs[main][0].start, objs[main][0].stop
    mx0, mx1 = objs[main][1].start, objs[main][1].stop
    H, W = fg.shape
    keep = np.zeros(n + 1, bool)
    keep[main + 1] = True
    if not largest_only:
        for i, (sl, s) in enumerate(zip(objs, sizes)):
            if i == main:
                continue
            h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
            thin = min(h, w) < max(6, 0.012 * max(H, W)) and max(h, w) > 0.12 * min(H, W)
            below = sl[0].start > my1 + 2                       # a caption under the subject
            far = sl[1].stop < mx0 - 0.08 * W or sl[1].start > mx1 + 0.08 * W
            if s > sizes[main] * 0.004 and not thin and not below and not far:
                keep[i + 1] = True
    return keep[lab]


def trim_edge_lines(alpha):
    """Drop a narrow, tall stripe at either side that is joined to the subject only by a faint smudge (a divider line)."""
    occ = alpha > 100
    ys, xs = np.nonzero(occ)
    if xs.size == 0:
        return alpha
    x0, x1 = xs.min(), xs.max() + 1
    cov = occ[:, x0:x1].mean(axis=0)
    W = x1 - x0
    for side in (0, 1):
        c = cov if side == 0 else cov[::-1]
        lead = 0
        while lead < len(c) and c[lead] < 0.1:
            lead += 1
        run = lead
        while run < len(c) and c[run] > 0.25:
            run += 1
        gap = run
        while gap < len(c) and c[gap] < 0.1:
            gap += 1
        if 0 < run - lead < max(4, W * 0.04) and gap - run >= 3:
            sl = slice(x0, x0 + gap) if side == 0 else slice(x1 - gap, x1)
            alpha[:, sl] = 0
    return alpha


def cut(a, bg, d, key, box, largest_only=False):
    y0, y1, x0, x1 = box
    m = 6                                                      # stay off grid lines drawn on the cell borders
    sub, sbg, sd = a[y0 + m:y1 - m, x0 + m:x1 - m], bg[y0 + m:y1 - m, x0 + m:x1 - m], d[y0 + m:y1 - m, x0 + m:x1 - m]
    fg = clean(~sbg, largest_only)
    if fg.sum() < 200:
        return None
    alpha = np.where(fg, 255, 0).astype(np.uint8)
    rim = fg & ~ndimage.binary_erosion(fg)
    rgb = sub.astype(np.float32).copy()
    lean = rim & (sd < 72 * 1.8)
    alpha[lean] = np.clip((sd[lean] - 36) / 94 * 255, 70, 255).astype(np.uint8)
    # glows and soft edges blended into the magenta: estimate how much key is mixed in and take it out again
    near_bg = fg & ~ndimage.binary_erosion(fg, iterations=12)
    spill = np.clip(np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1], 0, None)
    kspill = max(1.0, min(key[0], key[2]) - key[1])
    mix = np.where(near_bg, np.clip(spill / kspill - 0.08, 0, 0.85), 0)
    for c in range(3):
        rgb[..., c] = np.where(mix > 0, (rgb[..., c] - mix * key[c]) / (1 - mix), rgb[..., c])
    alpha = np.minimum(alpha, ((1 - mix) * 255).astype(np.uint8))
    alpha[fg & (mix > 0.6)] = 0
    # what is still magenta after that is painted smoke or haze over the key: drop it (the game makes its own smoke)
    r, g, b = sub[..., 0], sub[..., 1], sub[..., 2]                  # judged on the colours as painted
    tinted = near_bg & (g < np.minimum(r, b) - 24) & (r > 140) & (b > 140) & (np.abs(r - b) < 70)
    alpha[ndimage.binary_dilation(tinted, iterations=1) & near_bg] = 0
    alpha = trim_edge_lines(alpha)
    im = Image.fromarray(np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), alpha]), 'RGBA')
    bb = im.getchannel('A').point(lambda v: 255 if v > 60 else 0).getbbox()
    return im.crop(bb) if bb else None


def glow_mask(im):
    """Warm, bright, locally contrasting pixels (lamplit windows, forge fire, lanterns) as an RGBA glow layer."""
    a = np.asarray(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    v = mx / 255
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    warm = (r >= g) & (g >= b) & (r > 200) & (g > 120) & (r - b > 90)
    lum = rgb @ np.array([0.3, 0.55, 0.15])
    m = warm & (v > 0.84) & (s > 0.4) & (al > 200)
    m = ndimage.binary_opening(m, iterations=1)
    lab, n = ndimage.label(m)
    keep = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        blob = lab[sl] == i + 1
        size = blob.sum()
        if size < 6 or size > m.size * 0.012:
            continue
        y0, y1, x0, x1 = max(0, sl[0].start - 4), sl[0].stop + 4, max(0, sl[1].start - 4), sl[1].stop + 4
        own = lab[y0:y1, x0:x1] == i + 1
        ring = ndimage.binary_dilation(own, iterations=3) & ~ndimage.binary_dilation(own, iterations=1) & (al[y0:y1, x0:x1] > 128)
        if ring.sum() < 4:
            continue
        inside, frame = lum[y0:y1, x0:x1][own].mean(), lum[y0:y1, x0:x1][ring].mean()
        if frame < inside * 0.62:                       # a window or a fire: dark all around
            keep.append(i + 1)
    m = np.isin(lab, keep)
    if m.sum() < 12:
        return None
    soft = ndimage.gaussian_filter(m.astype(np.float32), 1.6)
    soft = np.clip(soft * 1.8, 0, 1) * (al / 255)
    out = np.dstack([np.full_like(r, 255), np.full_like(r, 196), np.full_like(r, 110), soft * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def chimneys(im):
    """Tops of narrow protrusions on the roof line, as [x, y] fractions of the sprite (smoke comes out there)."""
    al = np.asarray(im.getchannel('A')) > 128
    H, W = al.shape
    top = np.where(al.any(axis=0), al.argmax(axis=0), H).astype(np.float32)
    out = []
    win = max(3, int(W * 0.09))
    x = 0
    while x < W:
        if top[x] >= H * 0.55:
            x += 1; continue
        l, r = max(0, x - win), min(W, x + win)
        side = np.concatenate([top[max(0, l - win):l], top[r:min(W, r + win)]])
        if side.size and top[x] < np.median(side) - H * 0.06 and top[x] == top[l:r].min():
            run = np.flatnonzero(top[l:r] <= top[x] + H * 0.03) + l
            if run.size and (run[-1] - run[0]) < W * 0.14:
                out.append([round(float(run.mean()) / W, 3), round(float(top[x]) / H + 0.01, 3)])
                x = r; continue
        x += 1
    return out[:2]


SCALE = {}                                                      # tiles per source px of a full plant, for its picked twin


def sized(name, im):
    """Scale and size in tiles. Returns (image, [wTiles, hTiles])."""
    k, t = kind_of(name)
    src_h = im.height
    asp = im.height / im.width
    if k == 'b':
        w = BW[t]; h = w * asp
        if h > HMAX.get(t, 3.2):
            h = HMAX.get(t, 3.2); w = h / asp
    elif name.startswith('tree'):
        h = 2.25; w = h / asp
        if w > 1.95: w = 1.95; h = w * asp
    elif name.startswith('rock'):
        h = 0.95 if name == 'rock1' else 0.8; w = h / asp
    elif name in ('stump', 'pebbles'):
        h = 0.55; w = h / asp
    elif name[:-1] in ('bush', 'flax', 'herbp', 'mush'):
        if name.endswith('1'):
            h = 0.8; w = h / asp; SCALE[name[:-1]] = h / src_h
        else:
            h = im.height * SCALE.get(name[:-1], 0.8 / src_h); w = im.width * SCALE.get(name[:-1], 0.8 / src_h)
    elif name == 'sails':
        w = h = 1.9
    elif name == 'scaffold':
        w = 3.5; h = w * asp
    elif name == 'cart':
        w = 1.6; h = w * asp
    else:                                                       # people: 1.2 tiles tall in town, bigger for portraits
        h = 1.2; w = h / asp
        im = im.resize((max(1, round(160 / asp)), 160), Image.LANCZOS)
        return im, [round(w, 3), round(h, 3)]
    px = max(1, round(w * PPT)), max(1, round(h * PPT))
    return im.resize(px, Image.LANCZOS), [round(w, 3), round(h, 3)]


def main(raw):
    raw = Path(raw)
    spec = json.loads((HERE / 'prompts.json').read_text())['sheets']
    man = {'ppt': PPT, 'sprites': {}}
    for sub in ('b', 'n', 'c'):
        (OUT / sub).mkdir(parents=True, exist_ok=True)
    for sheet, s in spec.items():
        src = raw / f'{sheet}.png'
        if not src.exists():
            print('missing', sheet); continue
        img = Image.open(src).convert('RGB')
        if img.width > 2200:
            img = img.resize((2200, round(img.height * 2200 / img.width)), Image.LANCZOS)
        a = np.asarray(img).astype(np.float32)
        bg, d, key = background(a)
        (cols, rows), pick = GRID.get(sheet, (tuple(s['grid']), None))
        xs, ys = gutters(~bg, cols, 1), gutters(~bg, rows, 0)
        boxes = []
        left = len(s['names'])
        for r in range(rows):
            want = len(pick) if pick else min(cols, left)
            seg = None
            if sheet in SEGMENT:
                seg = SEGMENT[sheet] or segments(~bg[ys[r]:ys[r + 1]], want)
            if seg is None:
                seg = [(xs[c], xs[c + 1]) for c in (pick or range(cols))][:want]
            boxes += [(ys[r], ys[r + 1], x0, x1) for x0, x1 in seg]
            left -= want
        for name, box in zip(s['names'], boxes):
            im = cut(a, bg, d, key, box, name in LARGEST_ONLY)
            if im is None:
                print('  EMPTY', sheet, name); continue
            k, t = kind_of(name)
            im, tiles = sized(name, im)
            folder = 'b' if k in ('b', 'x') else k
            im.save(OUT / folder / f'{name}.webp', quality=86, method=6)
            entry = {'f': f'{folder}/{name}.webp', 't': tiles}
            if k == 'b':
                gl = glow_mask(im)
                if gl is not None:
                    gl.save(OUT / 'b' / f'{name}-e.webp', quality=80, method=6)
                    entry['e'] = f'b/{name}-e.webp'
                if t in SMOKY:
                    entry['smoke'] = chimneys(im)
                if name in HUB:
                    entry['hub'] = HUB[name]
            man['sprites'][name] = entry
        print(sheet, 'ok', [n for n in s['names'] if n in man['sprites']].__len__(), '/', len(s['names']))
    (OUT / 'manifest.json').write_text(json.dumps(man, indent=0, sort_keys=True))
    print('sprites', len(man['sprites']))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'raw')
