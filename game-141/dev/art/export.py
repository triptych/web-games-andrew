"""export.py RAW — turn SANDSUNK's raw fal renders into the game's art/ folder.

    python3 -I game-141/dev/art/export.py RAW

RAW holds the downloaded renders (names from dev/art/README.md). Needs Pillow and numpy.
- tiles.webp       4x4 atlas (256 px cells) of block, floor, pillar and hatch textures, each cell cut 4% inside
                   its grid square so the gutters the model paints between cells never show.
- monsters.webp    3x2 atlas (256 px cells) of monster sprites, cut from their green key; boss.webp alone.
- items.webp       4x4 atlas (128 px cells) of item icons, cut from magenta.
- skills.webp      4x4 atlas (128 px cells) of skill icons, cut from magenta.
- arts.webp        4x4 atlas (256 px cells) of the sixteen artifacts, cut from their grey backdrop, in the order
                   of js/sim/data/artifacts.js.
- por-*.webp       384 px portraits; bg-*.webp 1600 px wide paintings.
"""
import os
import sys
import numpy as np
from PIL import Image

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
os.makedirs(OUT, exist_ok=True)
ARTS = ['compass', 'scarab', 'tablet', 'lens', 'pickhead', 'hourglass', 'bangle', 'mask',
        'lamp', 'chisel', 'starchart', 'feather', 'fork', 'jackal', 'scepter', 'heart']


def load(name):
    return Image.open(os.path.join(RAW, name + '.png')).convert('RGB')


def key_out(im, key=None, tol=70, soft=40):
    """Alpha from a flood fill of the key colour from the border (enclosed key pockets go too if very close)."""
    a = np.asarray(im).astype(np.int32)
    h, w, _ = a.shape
    if key is None:  # measure the backdrop from the border
        border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
        key = np.median(border, axis=0)
    d = np.sqrt(((a - np.array(key)) ** 2).sum(axis=2))
    near = d < tol
    bg = np.zeros_like(near)
    bg[0, :] = near[0, :]; bg[-1, :] = near[-1, :]; bg[:, 0] = near[:, 0]; bg[:, -1] = near[:, -1]
    for _ in range(4000):
        g = bg.copy()
        g[1:, :] |= bg[:-1, :]; g[:-1, :] |= bg[1:, :]; g[:, 1:] |= bg[:, :-1]; g[:, :-1] |= bg[:, 1:]
        g &= near
        if (g == bg).all():
            break
        bg = g
    bg |= d < tol * 0.45           # enclosed pockets of pure key colour (between legs, inside handles)
    alpha = np.where(bg, 0, 255).astype(np.float32)
    # soften the rim: pixels next to the background fade by their distance from the key
    edge = np.zeros_like(bg)
    edge[1:, :] |= bg[:-1, :]; edge[:-1, :] |= bg[1:, :]; edge[:, 1:] |= bg[:, :-1]; edge[:, :-1] |= bg[:, 1:]
    edge &= ~bg
    ramp = np.clip((d - tol) / soft, 0, 1) * 255
    alpha = np.where(edge, np.minimum(alpha, ramp), alpha)
    rgb = a.astype(np.float32)
    # despill: on the rim, pull the key's dominant channel down toward the others
    kc = int(np.argmax(key)) if max(key) - min(key) > 60 else -1
    if kc >= 0:
        others = [c for c in range(3) if c != kc]
        lim = rgb[..., others].max(axis=2)
        spill = edge | (alpha < 255)
        rgb[..., kc] = np.where(spill, np.minimum(rgb[..., kc], lim), rgb[..., kc])
        if kc == 0 or kc == 2:   # magenta keys are red+blue
            pass
    out = np.dstack([np.clip(rgb, 0, 255), alpha]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def trim_fit(im, size, pad=0.06):
    bb = im.getbbox()
    if bb:
        im = im.crop(bb)
    w, h = im.size
    s = size * (1 - 2 * pad) / max(w, h)
    im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    cell = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cell.paste(im, ((size - im.width) // 2, (size - im.height) // 2), im)
    return cell


def cells(im, cols, rows, inset=0.0):
    W, H = im.size
    cw, ch = W / cols, H / rows
    for r in range(rows):
        for c in range(cols):
            x0, y0 = c * cw + cw * inset, r * ch + ch * inset
            yield im.crop((round(x0), round(y0), round(x0 + cw * (1 - 2 * inset)), round(y0 + ch * (1 - 2 * inset))))


def atlas(tiles, cols, size, mode='RGBA'):
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new(mode, (cols * size, rows * size), (0, 0, 0, 0) if mode == 'RGBA' else (0, 0, 0))
    for k, t in enumerate(tiles):
        sheet.paste(t.resize((size, size), Image.LANCZOS) if t.size != (size, size) else t, ((k % cols) * size, (k // cols) * size))
    return sheet


def save(im, name, q=84):
    p = os.path.join(OUT, name)
    im.save(p, 'WEBP', quality=q, method=6)
    print(f'{name:18} {im.size[0]}x{im.size[1]} {os.path.getsize(p) // 1024} KB')


# block and floor textures
save(atlas([t.resize((256, 256), Image.LANCZOS) for t in cells(load('blocks'), 4, 4, 0.04)], 4, 256, 'RGB'), 'tiles.webp', 86)
# monsters on green
mons = [trim_fit(key_out(c, (0, 255, 0) if False else None, tol=90), 256) for c in cells(load('mon'), 3, 2)]
save(atlas(mons, 3, 256), 'monsters.webp')
save(trim_fit(key_out(load('mon-boss'), None, tol=90), 384, 0.03), 'boss.webp')
# icons on magenta
save(atlas([trim_fit(key_out(c, None, tol=100), 128, 0.05) for c in cells(load('icons-items'), 4, 4)], 4, 128), 'items.webp', 88)
save(atlas([trim_fit(key_out(c, None, tol=100), 128, 0.05) for c in cells(load('icons-skills'), 4, 4)], 4, 128), 'skills.webp', 88)
# artifacts on light grey
save(atlas([trim_fit(key_out(load('art-' + a), None, tol=22, soft=18), 256, 0.04) for a in ARTS], 4, 256), 'arts.webp', 88)
# portraits
for name, inset in [('sela', 0.0), ('quill', 0.0), ('zahra', 0.045)]:
    im = load('por-' + name)
    w, h = im.size
    im = im.crop((round(w * inset), round(h * inset), round(w * (1 - inset)), round(h * (1 - inset)))).resize((384, 384), Image.LANCZOS)
    save(im, f'por-{name}.webp', 82)
# paintings (the title came back with a thin inked frame: cut inside it)
for name, inset in [('title', 0.012), ('camp', 0.0), ('ending', 0.0)]:
    im = load('bg-' + name)
    w, h = im.size
    im = im.crop((round(w * inset), round(h * inset), round(w * (1 - inset)), round(h * (1 - inset * 2.2))))
    im = im.resize((1600, round(1600 * im.height / im.width)), Image.LANCZOS)
    save(im, f'bg-{name}.webp', 78)
