# export.py RAW SHEETS.json — turn the raw fal renders into game-027/art/.
#   RAW/title|workshop|map|cauldron|shop|ending.png -> art/<name>.webp   1600 wide
#   RAW/table.png                -> art/table.webp       768x768, the lattice's oak plate
#   RAW/cast-<id>.png (2x2)      -> art/cast-<id>-<expression>.webp  384x384, order: CHARACTERS[id].expressions
#   RAW/foe-<id>.png             -> art/foe-<id>.webp    512x512 (the bosses)
#   RAW/foes-<n>.png (2x2)       -> art/foe-<id>.webp    384x384 (order: SHEETS in prompts.mjs; null quarters skipped)
#   RAW/things-<n>.png (2x2)     -> art/<id>.webp        256x256 elements, items, potions and the coin
# Sheet cells are cut with a 2.5% inset (drops the gutters), then trim() peels any near-uniform light
# or dark margin (things-5 came back with cream gutters), up to 9% a side.
# Run with:
#   node game-027/dev/art/prompts.mjs sheets > SHEETS.json
#   python3 -I game-027/dev/art/export.py RAW SHEETS.json
import sys, os, json
from PIL import Image, ImageStat

RAW, SHEETS = sys.argv[1], json.load(open(sys.argv[2]))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
os.makedirs(OUT, exist_ok=True)
EXPRESSIONS = {
    'player': ['neutral', 'pleased', 'alarmed', 'determined'],
    'guildmaster': ['stern', 'pleased', 'alarmed', 'neutral'],
    'rival': ['smug', 'neutral', 'alarmed', 'pleased'],
    'spirit': ['calm', 'curious', 'urgent', 'serene'],
    'vendor': ['warm', 'pleased', 'curious', 'neutral'],
}


def save(im, name, q=80):
    path = os.path.join(OUT, name + '.webp')
    im.save(path, quality=q, method=6)
    print(name, im.size, os.path.getsize(path) // 1024, 'KB')


def edge_bad(strip, ref):
    st = ImageStat.Stat(strip.convert('L'))
    m, sd = st.mean[0], st.stddev[0]
    return sd < 22 and (m > 195 or m < 22) and abs(m - ref) > 45


def trim(im, cap=0.09):
    w, h = im.size
    ref = ImageStat.Stat(im.convert('L').crop((w // 4, h // 4, 3 * w // 4, 3 * h // 4))).mean[0]
    l, t, r, b = 0, 0, w, h
    step = max(1, w // 200)
    while l < w * cap and edge_bad(im.crop((l, t, l + step, b)), ref): l += step
    while r > w * (1 - cap) and edge_bad(im.crop((r - step, t, r, b)), ref): r -= step
    while t < h * cap and edge_bad(im.crop((l, t, r, t + step)), ref): t += step
    while b > h * (1 - cap) and edge_bad(im.crop((l, b - step, r, b)), ref): b -= step
    return im.crop((l, t, r, b))


def fit(im, w, h):
    """Centre-crop to w:h, then resize."""
    iw, ih = im.size
    k = max(w / iw, h / ih)
    cw, ch = round(w / k), round(h / k)
    x, y = (iw - cw) // 2, (ih - ch) // 2
    return im.crop((x, y, x + cw, y + ch)).resize((w, h), Image.LANCZOS)


def raw(name):
    return Image.open(os.path.join(RAW, name + '.png')).convert('RGB')


def cells(im):
    w, h = im.size
    ins = round(w * 0.025)
    for k in range(4):
        cx, cy = (k % 2) * w // 2, (k // 2) * h // 2
        yield k, trim(im.crop((cx + ins, cy + ins, cx + w // 2 - ins, cy + h // 2 - ins)))


for f in sorted(os.listdir(RAW)):
    name, ext = os.path.splitext(f)
    if ext != '.png':
        continue
    if name in ('title', 'workshop', 'map', 'cauldron', 'shop', 'ending'):
        im = trim(raw(name))
        save(im.resize((1600, round(1600 * im.height / im.width)), Image.LANCZOS), name, 76)
    elif name == 'table':
        save(fit(trim(raw(name)), 768, 768), name, 80)
    elif name.startswith('cast-'):
        cid = name[5:]
        for k, cell in cells(raw(name)):
            save(fit(cell, 384, 384), f'cast-{cid}-{EXPRESSIONS[cid][k]}', 80)
    elif name.startswith('foes-') or name.startswith('things-'):
        ids = SHEETS[name]
        size = 384 if name.startswith('foes-') else 256
        for k, cell in cells(raw(name)):
            if ids[k]:
                save(fit(cell, size, size), ids[k], 82)
    elif name.startswith('foe-'):
        save(fit(trim(raw(name)), 512, 512), name, 82)
