"""export.py RAW — turn the fal originals in RAW into the game's art/ folder.

  card-*.jpg       → art/card-*.webp   1280x720 story paintings
  tex-*.jpg        → art/tex-*.webp    512x512 tiling surfaces
  icons1.png, ...  → art/icon-*.webp   128 px icons cut from 4x4 sheets on a magenta key
  ref-fray.png  → art/face-fray.webp  her portrait for the subtitle box

Run with: python3 -I game-131/dev/art/export.py RAW      (needs Pillow)
"""
import sys, os
from collections import deque
from PIL import Image

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
os.makedirs(OUT, exist_ok=True)

SHEETS = {
    'icons1.png': ['gem-leaf', 'gem-stone', 'gem-light', 'gem-wind', 'gem-water', 'gem-moon', 'gem-heart', 'pendant',
                   'seaglass', 'feather', 'shard', 'crown', 'starseed', 'songshell', 'button', 'moonmint'],
    'icons2.png': ['rune', 'pipe', 'pearl', 'bauble', 'heart', 'journal', 'hint', 'footprints'],
}


def is_key(p):
    r, g, b = p[:3]
    return r > 150 and b > 150 and g < 0.72 * min(r, b)


def cut(sheet, names):
    im = Image.open(os.path.join(RAW, sheet)).convert('RGBA')
    w, h = im.size
    px = im.load()
    # flood the magenta from the border inward, so magenta-ish paint inside an icon survives
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x] or not is_key(px[x, y]):
            continue
        seen[y * w + x] = 1
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # soften the pink rim left on edge pixels
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if px[x, y][3] and (seen[y * w + x - 1] or seen[y * w + x + 1] or seen[(y - 1) * w + x] or seen[(y + 1) * w + x]):
                r, g, b, a = px[x, y]
                if r > g * 1.25 and b > g * 1.25:
                    px[x, y] = (g, g, g, 120)
    # magenta shut inside an icon (a button's holes, a pendant's gaps) is background too
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and r > 185 and b > 185 and g < 120: px[x, y] = (0, 0, 0, 0)
    # find the icons by the empty bands between them (rows first, then columns in each row): the model does not
    # keep to an exact grid, and sometimes leaves part of the sheet empty
    alpha = im.getchannel('A')
    def bands(img, axis):
        ww, hh = img.size
        n = hh if axis == 'y' else ww
        data = img.load()
        full = [any(data[(x, i) if axis == 'y' else (i, x)] > 40 for x in range(0, ww if axis == 'y' else hh, 3)) for i in range(n)]
        out, start = [], None
        for i, f in enumerate(full + [False]):
            if f and start is None: start = i
            elif not f and start is not None:
                if i - start > 24: out.append((start, i))
                start = None
        return out
    cells = []
    for (y0, y1) in bands(alpha, 'y'):
        for (x0, x1) in bands(alpha.crop((0, y0, w, y1)), 'x'):
            cells.append((x0, y0, x1, y1))
    names = [n for n in names if n]
    if len(cells) != len(names): print('  WARNING', sheet, 'found', len(cells), 'icons, expected', len(names))
    for name, box in zip(names, cells):
        cell = im.crop(box)
        cell = cell.crop(cell.getbbox())
        side = max(cell.size)
        sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        sq.paste(cell, ((side - cell.width) // 2, (side - cell.height) // 2))
        sq.resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, f'icon-{name}.webp'), quality=88)
    print(sheet, 'cut')


for f in sorted(os.listdir(RAW)):
    src = os.path.join(RAW, f)
    name = os.path.splitext(f)[0]
    if f.startswith('card-'):
        im = Image.open(src).convert('RGB')
        w, h = im.size
        th = int(w * 9 / 16)
        if th < h:
            im = im.crop((0, (h - th) // 2, w, (h - th) // 2 + th))
        im.resize((1280, 720), Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), quality=80)
    elif f.startswith('tex-'):
        Image.open(src).convert('RGB').resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), quality=82)
    elif f in SHEETS:
        cut(f, SHEETS[f])
    elif f == 'ref-fray.png':
        im = Image.open(src).convert('RGB')
        w, h = im.size
        s = int(w * 0.5)
        im.crop(((w - s) // 2, int(h * 0.03), (w + s) // 2, int(h * 0.03) + s)).resize((160, 160), Image.LANCZOS).save(os.path.join(OUT, 'face-fray.webp'), quality=85)
# The Cold Hearth: the painting for this card was declined by the image model's content filter, so the card is
# composed here from the hearth's prop painting on a warm dark ground.
if os.path.exists(os.path.join(RAW, 'ref-hearth.png')):
    bg = Image.new('RGB', (1280, 720))
    px = bg.load()
    for y in range(720):
        for x in range(1280):
            d = ((x - 640) ** 2 + (y - 400) ** 2) ** 0.5 / 760
            k = max(0.0, 1 - d)
            px[x, y] = (int(34 + 70 * k), int(22 + 42 * k), int(18 + 26 * k))
    ref = Image.open(os.path.join(RAW, 'ref-hearth.png')).convert('RGB').resize((640, 640), Image.LANCZOS)
    mask = Image.new('L', ref.size, 0)
    mp, rp = mask.load(), ref.load()
    for y in range(640):
        for x in range(640):
            r, g, b = rp[x, y]
            grey = abs(r - g) < 14 and abs(g - b) < 14 and r > 150            # the reference's plain backdrop
            mp[x, y] = 0 if grey else 255
    bg.paste(ref, (320, 60), mask)
    bg.save(os.path.join(OUT, 'card-hearth.webp'), quality=80)
print(len(os.listdir(OUT)), 'files in art/')
