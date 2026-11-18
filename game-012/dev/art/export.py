# export.py RAW SHEETS.json — turn the raw fal renders into game-012/art/.
#   RAW/cards-<n>.png  -> art/card-<id>.webp   360x540, four per 2x2 sheet (the last sheet is a pair side by side)
#   RAW/foes-<n>.png   -> art/foe-<id>.webp    360x540, four per sheet
#   RAW/foe-the_world.png -> art/foe-the_world.webp
#   RAW/realm-<n>.png  -> art/realm-<n>.webp   1600 wide, the battle backdrops
#   RAW/title, parlour, reading, ending.png -> art/<name>.webp 1600 wide; over.png 1280 wide
#   RAW/cardback.png   -> art/cardback.webp    360x540
# Sheets came back with black gutters (most) or white ones (cards-14, cards-15, foes-1), never exactly on the half
# line: each split is found as the most uniform row or column within 7% of the middle, each cell is cut with a small
# inset, then trim() peels near-uniform edge rows and columns (gutter remains, the gold frame on Strength's cell).
# Run with: node game-012/dev/art/prompts.mjs sheets > SHEETS.json; python3 -I game-012/dev/art/export.py RAW SHEETS.json
import sys, os, json
from PIL import Image, ImageStat

RAW, SHEETS = sys.argv[1], json.load(open(sys.argv[2]))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
os.makedirs(OUT, exist_ok=True)


def save(im, name, q=80):
    path = os.path.join(OUT, name + '.webp')
    im.save(path, quality=q, method=6)
    print(name, im.size, os.path.getsize(path) // 1024, 'KB')


def edge_bad(strip):
    st = ImageStat.Stat(strip.convert('L'))
    m, sd = st.mean[0], st.stddev[0]
    return sd < 14 and (m > 200 or m < 26)


def trim(im, cap=0.06):
    w, h = im.size
    l, t, r, b = 0, 0, w, h
    step = max(1, w // 300)
    while l < w * cap and edge_bad(im.crop((l, t, l + step, b))): l += step
    while r > w * (1 - cap) and edge_bad(im.crop((r - step, t, r, b))): r -= step
    while t < h * cap and edge_bad(im.crop((l, t, r, t + step))): t += step
    while b > h * (1 - cap) and edge_bad(im.crop((l, b - step, r, b))): b -= step
    return im.crop((l, t, r, b))


def split(im, axis):
    """The most uniform line (lowest std of luminance) within 7% of the middle, along axis 'x' or 'y'."""
    g = im.convert('L')
    w, h = g.size
    n = w if axis == 'x' else h
    best, at = 1e9, n // 2
    for p in range(int(n * 0.43), int(n * 0.57)):
        line = g.crop((p, 0, p + 1, h)) if axis == 'x' else g.crop((0, p, w, p + 1))
        sd = ImageStat.Stat(line).stddev[0]
        if sd < best: best, at = sd, p
    return at


def fit(im, w, h):
    """Centre-crop to w:h, then resize."""
    iw, ih = im.size
    k = max(w / iw, h / ih)
    cw, ch = round(w / k), round(h / k)
    x, y = (iw - cw) // 2, (ih - ch) // 2
    return im.crop((x, y, x + cw, y + ch)).resize((w, h), Image.LANCZOS)


def cells(im, count):
    w, h = im.size
    ins = round(w * 0.012)
    if count == 2:
        sx = split(im, 'x')
        boxes = [(0, 0, sx, h), (sx, 0, w, h)]
    else:
        sx, sy = split(im, 'x'), split(im, 'y')
        boxes = [(0, 0, sx, sy), (sx, 0, w, sy), (0, sy, sx, h), (sx, sy, w, h)]
    return [im.crop((a + ins, b + ins, c - ins, d - ins)) for a, b, c, d in boxes]


def raw(name):
    return Image.open(os.path.join(RAW, name + '.png')).convert('RGB')


for f in sorted(os.listdir(RAW)):
    name, ext = os.path.splitext(f)
    if ext != '.png' or name.endswith('-v1'):
        continue
    if name in SHEETS:
        ids = SHEETS[name]
        prefix = 'card-' if name.startswith('cards-') else 'foe-'
        for cid, cell in zip(ids, cells(raw(name), len(ids))):
            save(fit(trim(cell), 360, 540), prefix + cid, 78)
    elif name == 'foe-the_world':
        save(fit(trim(raw(name)), 360, 540), name, 80)
    elif name == 'cardback':
        save(fit(trim(raw(name)), 360, 540), name, 82)
    elif name.startswith('realm-') or name in ('title', 'parlour', 'reading', 'ending'):
        im = trim(raw(name))
        save(im.resize((1600, round(1600 * im.height / im.width)), Image.LANCZOS), name, 74)
    elif name == 'over':
        im = trim(raw(name))
        save(im.resize((1280, round(1280 * im.height / im.width)), Image.LANCZOS), name, 74)
