# export.py RAW — turn the raw fal renders into game-139/art/.
#   RAW/rival-<id>.png  -> art/rival-<id>.webp   384x512 portraits (dialogue, letters, the rival's standing card, partner cards)
#   RAW/sheet-<n>.png   -> art/card-<id>.webp    320x320, four per 2x2 sheet (order: SHEETS in prompts.mjs, read from SHEETS.json)
#   RAW/card-<id>.png   -> art/card-<id>.webp    320x320 (the pilot's two single images)
#   RAW/cardback.png, rivalback.png -> art/<name>.webp   360x540 card backs
#   RAW/table.png       -> art/table.webp        1600 wide, the tabletop texture
#   RAW/title.png       -> art/title.webp        1600 wide
#   RAW/over.png, ending.png -> art/<name>.webp  1280 wide
# The model sometimes paints a cream "storybook" paper margin (Brannoc, Quell, the title) or light gutters between
# sheet cells (sheets 6 and 7): trim() peels off edge rows/columns that are near-uniform and much lighter or darker
# than the picture, up to 9% a side. Sheet cells are cut with a 2.5% inset first, which drops the gutters.
# Run with: node game-139/dev/art/prompts.mjs sheets > SHEETS.json; python3 -I game-139/dev/art/export.py RAW SHEETS.json
import sys, os, json
from PIL import Image, ImageStat

RAW, SHEETS = sys.argv[1], json.load(open(sys.argv[2]))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
os.makedirs(OUT, exist_ok=True)


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


for f in sorted(os.listdir(RAW)):
    name, ext = os.path.splitext(f)
    if ext != '.png':
        continue
    if name.startswith('rival-'):
        save(fit(trim(raw(name)), 384, 512), name, 82)
    elif name.startswith('card-'):
        save(fit(trim(raw(name)), 320, 320), name, 82)
    elif name.startswith('sheet-'):
        ids = SHEETS[int(name.split('-')[1]) - 1]
        im = raw(name)
        w, h = im.size
        for k, cid in enumerate(ids):
            cx, cy = (k % 2) * w // 2, (k // 2) * h // 2
            ins = round(w * 0.025)
            cell = im.crop((cx + ins, cy + ins, cx + w // 2 - ins, cy + h // 2 - ins))
            save(fit(trim(cell), 320, 320), 'card-' + cid, 82)
    elif name in ('cardback', 'rivalback'):
        save(fit(trim(raw(name)), 360, 540), name, 85)
    elif name in ('table', 'title'):
        im = trim(raw(name))
        save(im.resize((1600, round(1600 * im.height / im.width)), Image.LANCZOS), name, 78)
    elif name in ('over', 'ending'):
        im = trim(raw(name))
        save(im.resize((1280, round(1280 * im.height / im.width)), Image.LANCZOS), name, 78)
