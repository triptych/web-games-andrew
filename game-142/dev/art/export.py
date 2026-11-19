"""Export Kaboom Keep's fal art into game-142/art/.

    python3 -I game-142/dev/art/export.py RAW     # RAW holds the downloaded originals (see README.md)

Textures are resized to 512 px (they tile), skies to 2048 px wide, region banners to 1200 px,
the title art to 1600 px. Portraits are cut out of their flat key colour (magenta or green) by a
flood fill from the border, softened at the edge, trimmed and saved as 384 px WebP with alpha.
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

RAW = Path(sys.argv[1])
OUT = Path(__file__).resolve().parents[2] / 'art'
OUT.mkdir(exist_ok=True)

TEXTURES = ['stone', 'wood', 'roof', 'ice', 'brick', 'tnt', 'grass', 'snow', 'autumn']
SKIES = {'sky-meadow': 'sky.jpg', 'sky-frost': 'sky-frost.jpg', 'sky-sunset': 'sky-sunset.jpg'}
REGIONS = ['region-meadow', 'region-frost', 'region-sunset']
CAST = {'cast-knight': 'knight.png', 'cast-king': 'cast-king.png', 'cast-wizard': 'cast-wizard.png',
        'cast-prince': 'cast-prince.png', 'cast-pip': 'cast-pip.png'}


def save(im, name, q=82):
    im.save(OUT / f'{name}.webp', 'WEBP', quality=q, method=6)
    print(f'  {name}.webp {im.size[0]}x{im.size[1]}')


def cutout(im, tol=70):
    """Clear every pixel connected to the border whose colour is near the border's key colour."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    corners = [px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3]]
    key = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
    near = lambda c: abs(c[0] - key[0]) + abs(c[1] - key[1]) + abs(c[2] - key[2]) < tol
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if not near(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    # soften the edge and pull the key colour out of the fringe
    a = im.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    im.putalpha(a)
    for y in range(h):
        for x in range(w):
            r, g, b, al = px[x, y]
            if 0 < al < 255:
                if key[1] > key[0]:      # green key
                    g = min(g, max(r, b))
                else:                    # magenta key
                    r = min(r, g + 40); b = min(b, g + 40)
                px[x, y] = (r, g, b, al)
    return im.crop(im.getbbox())


print('textures')
for t in TEXTURES:
    save(Image.open(RAW / f'{t}.png').convert('RGB').resize((512, 512), Image.LANCZOS), f'tex-{t}')
print('skies')
for name, f in SKIES.items():
    im = Image.open(RAW / f).convert('RGB')
    save(im.resize((2048, round(2048 * im.height / im.width)), Image.LANCZOS), name, 78)
print('regions and title')
for r in REGIONS:
    im = Image.open(RAW / f'{r}.jpg').convert('RGB')
    save(im.resize((1200, round(1200 * im.height / im.width)), Image.LANCZOS), r, 80)
im = Image.open(RAW / 'title.jpg').convert('RGB')
save(im.resize((1600, round(1600 * im.height / im.width)), Image.LANCZOS), 'title', 80)
print('cast')
for name, f in CAST.items():
    im = cutout(Image.open(RAW / f))
    im.thumbnail((384, 384), Image.LANCZOS)
    save(im, name, 85)
