"""export.py RAW — turn the fal originals in RAW into the game's art/ folder.

  card-*.jpg       → art/card-*.webp   1280x720 story paintings
  tex-*.jpg        → art/tex-*.webp    512x512 tiling surfaces
  icons1.png, ...  → art/icon-*.webp   128 px icons cut from 4x4 sheets on a magenta key
  ref-thimble.png  → art/face-thimble.webp  her portrait for the subtitle box

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
    'icons2.png': ['rune', 'pipe', 'pearl', 'bauble', 'heart', 'journal', 'hint', 'footprints',
                   None, None, None, None, None, None, None, None],
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
    cw, ch = w // 4, h // 4
    for i, name in enumerate(names):
        if not name:
            continue
        cell = im.crop(((i % 4) * cw, (i // 4) * ch, (i % 4 + 1) * cw, (i // 4 + 1) * ch))
        box = cell.getbbox()
        if not box:
            print('  empty cell', name); continue
        cell = cell.crop(box)
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
    elif f == 'ref-thimble.png':
        im = Image.open(src).convert('RGB')
        w, h = im.size
        s = int(w * 0.5)
        im.crop(((w - s) // 2, int(h * 0.03), (w + s) // 2, int(h * 0.03) + s)).resize((160, 160), Image.LANCZOS).save(os.path.join(OUT, 'face-thimble.webp'), quality=85)
print(len(os.listdir(OUT)), 'files in art/')
