#!/usr/bin/env python3
"""Turn NEBULA REQUIEM's raw fal renders into the game's art/ folder.

    python3 -I game-144/dev/art/export.py RAW          # RAW holds <name>.png as downloaded (see README.md)

- por-*        portraits on a green key: cut out (flood fill from the border + hue key), despilled, trimmed,
               scaled to 560 px tall, WebP with alpha -> art/por/<id>.webp  (por-sora uses the green re-key edit)
- cs-*, title  cutscene stills -> art/cs/<name>.webp at 1280x720 (title 1600x900)
- bg-*         stage backdrops -> art/bg/<stage>.webp at 1600x900
- boss-*       warning cards   -> art/boss/<key>.webp at 960x540
Needs Pillow and numpy.
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

RAW = sys.argv[1] if len(sys.argv) > 1 else 'raw'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
for d in ('por', 'cs', 'bg', 'boss'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

# The first pilot pass of Sora came back on white; the edit put her on green. Use that one.
RENAME = {'por-sora-green': 'por-sora'}
SKIP = {'por-sora'}


def key_out(im):
    """Green-screen cut-out: anything green-dominant connected to the border goes; then despill the edge."""
    a = np.asarray(im.convert('RGB')).astype(np.int32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    greenness = g - np.maximum(r, b)
    keyish = greenness > 40
    # flood fill from the border through key-ish pixels so green inside the figure (eyes, gems) survives
    h, w = keyish.shape
    bg = np.zeros_like(keyish)
    stack = [(y, x) for x in range(w) for y in (0, h - 1)] + [(y, x) for y in range(h) for x in (0, w - 1)]
    while stack:
        y, x = stack.pop()
        if bg[y, x] or not keyish[y, x]:
            continue
        bg[y, x] = True
        if y > 0: stack.append((y - 1, x))
        if y < h - 1: stack.append((y + 1, x))
        if x > 0: stack.append((y, x - 1))
        if x < w - 1: stack.append((y, x + 1))
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # soften the edge a pixel and pull the green out of the fringe
    am = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8))
    alpha = np.asarray(am).astype(np.int32)
    near = (alpha < 255) | (greenness > 10)
    g2 = np.where(near & (g > np.maximum(r, b)), np.maximum(r, b), g)
    rgba = np.dstack([r, g2, b, alpha]).clip(0, 255).astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    bbox = out.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return out.crop(bbox) if bbox else out


def fit(im, w, h):
    """Cover-crop to exactly w x h."""
    sw, sh = im.size
    k = max(w / sw, h / sh)
    im = im.resize((round(sw * k), round(sh * k)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


total = 0
for f in sorted(os.listdir(RAW)):
    if not f.endswith('.png'):
        continue
    name = f[:-4]
    if name in SKIP:
        continue
    name = RENAME.get(name, name)
    im = Image.open(os.path.join(RAW, f))
    if name.startswith('por-'):
        cut = key_out(im)
        k = 560 / cut.height
        cut = cut.resize((round(cut.width * k), 560), Image.LANCZOS)
        dst = os.path.join(OUT, 'por', name[4:] + '.webp')
        cut.save(dst, 'WEBP', quality=86, method=6)
    elif name.startswith('cs-') or name == 'title':
        size = (1600, 900) if name == 'title' else (1280, 720)
        dst = os.path.join(OUT, 'cs', name + '.webp')
        fit(im.convert('RGB'), *size).save(dst, 'WEBP', quality=80, method=6)
    elif name.startswith('bg-'):
        dst = os.path.join(OUT, 'bg', name[3:] + '.webp')
        fit(im.convert('RGB'), 1600, 900).save(dst, 'WEBP', quality=78, method=6)
    elif name.startswith('boss-'):
        dst = os.path.join(OUT, 'boss', name[5:] + '.webp')
        fit(im.convert('RGB'), 960, 540).save(dst, 'WEBP', quality=80, method=6)
    else:
        continue
    total += os.path.getsize(dst)
    print(f'{name:22s} -> {os.path.relpath(dst, OUT)} {os.path.getsize(dst) // 1024} KB')
print(f'total {total / 1e6:.1f} MB')
