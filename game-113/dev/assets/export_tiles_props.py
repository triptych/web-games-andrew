#!/usr/bin/env python3
"""Cut terrain sheets into per-theme tile sheets and prop renders into prop sprites.

usage: python3 -I dev/assets/export_tiles_props.py RAW_DIR
  RAW_DIR/tiles-<theme>.png   3x3 swatches: ground, ground2, path / dock, wall, cliff / house, roof, top(unused)
                              -> assets/tiles/<theme>.png, a 3x3 sheet of 96px tiles in the same order. The 'top' tile (the
                                 cap of a wall seen from above) is made from the ground and wall swatches, because the
                                 generated one is a side view. Organic kinds (ground, ground2, path, cliff) are blended so
                                 they repeat without a visible seam.
  RAW_DIR/prop-<name>.png     magenta-key renders -> assets/props/<name>.png fitted into the prop's logical box at 4x.
"""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout import key_magenta, crop_to_alpha

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, '..', '..', 'assets'))
THEMES = ['hollow', 'beach', 'aurelune', 'marisonde', 'sunreach', 'frosthold', 'spire']
TILE = 96
ORGANIC = {0, 1, 2, 5}                       # indices (ground, ground2, path, cliff) that get the seam blend
# swatches whose generated art has a motif at its edges: use only the middle (inset as a fraction of the cell)
INSET = {('sunreach', 2): 0.30}
PROPS = {'palm': (32, 48), 'oak': (32, 44), 'pine': (28, 48), 'shroom-violet': (28, 36), 'shroom-cyan': (28, 36),
         'shroom-amber': (28, 36), 'coral': (24, 30), 'flowers': (16, 10), 'wheat': (16, 22), 'grass': (12, 8)}
# how much of its box a prop fills (the field draws wheat in bunches, so one bundle shouldn't fill its cell)
FILL = {'wheat': 0.72, 'grass': 0.9}

def seamless(im, band=0.22):
    """Blend a tile with itself rolled by half a tile, weighted by distance from the edges, so it wraps without a seam."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    h, w = a.shape[:2]
    r = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    def ramp(n):
        d = np.minimum(np.arange(n), np.arange(n)[::-1]) / (n * band)
        d = np.clip(d, 0, 1); return d * d * (3 - 2 * d)
    m = (ramp(h)[:, None] * ramp(w)[None, :])[..., None]
    return Image.fromarray((a * m + r * (1 - m)).astype(np.uint8))

def tiles(raw):
    os.makedirs(os.path.join(ASSETS, 'tiles'), exist_ok=True)
    man = json.load(open(os.path.join(ASSETS, 'manifest.json')))
    for th in THEMES:
        src = os.path.join(raw, f'tiles-{th}.png')
        if not os.path.exists(src): print('missing', src); continue
        im = Image.open(src).convert('RGB'); W, H = im.size
        cw, ch = W / 3, H / 3
        cells = []
        for i in range(9):
            r, c = divmod(i, 3)
            ins = INSET.get((th, i), 0.035)
            t = im.crop((int(c * cw + cw * ins), int(r * ch + ch * ins), int((c + 1) * cw - cw * ins), int((r + 1) * ch - ch * ins)))
            t = t.resize((TILE, TILE), Image.LANCZOS)
            cells.append(seamless(t) if i in ORGANIC else t)
        # top: the ground, pulled toward the wall's average colour
        wall = np.asarray(cells[4]).reshape(-1, 3).mean(0)
        g = np.asarray(cells[0]).astype(np.float32)
        cells[8] = Image.fromarray((g * 0.62 + wall * 0.38).astype(np.uint8))
        sheet = Image.new('RGB', (TILE * 3, TILE * 3))
        for i, t in enumerate(cells): sheet.paste(t, ((i % 3) * TILE, (i // 3) * TILE))
        sheet.save(os.path.join(ASSETS, 'tiles', th + '.png'), optimize=True)
        man[f'tiles/{th}'] = {'src': f'tiles/{th}.png', 'w': TILE, 'h': TILE, 'cols': 3, 'rows': 3}
        print('tiles', th)
    json.dump(man, open(os.path.join(ASSETS, 'manifest.json'), 'w'), indent=1, sort_keys=True)

def props(raw):
    os.makedirs(os.path.join(ASSETS, 'props'), exist_ok=True)
    man = json.load(open(os.path.join(ASSETS, 'manifest.json')))
    for name, (w, h) in PROPS.items():
        src = os.path.join(raw, f'prop-{name}.png')
        if not os.path.exists(src): print('missing', src); continue
        im = crop_to_alpha(key_magenta(Image.open(src)), 1)
        bw, bh = w * 4, h * 4
        f = FILL.get(name, 0.98)
        s = min(bw * f / im.width, bh * f / im.height)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        box = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
        box.paste(im, ((bw - im.width) // 2, bh - im.height), im)
        box.save(os.path.join(ASSETS, 'props', name + '.png'), optimize=True)
        man[f'prop/{name}'] = {'src': f'props/{name}.png', 'w': w, 'h': h}
        print('prop', name, box.size)
    json.dump(man, open(os.path.join(ASSETS, 'manifest.json'), 'w'), indent=1, sort_keys=True)

if __name__ == '__main__':
    tiles(sys.argv[1]); props(sys.argv[1])
