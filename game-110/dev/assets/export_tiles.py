#!/usr/bin/env python3
"""Cut the 3x3 texture sheet (RAW_DIR/textures.png, greyscale swatches) into assets/tiles/*.png + manifest entries.

usage: python3 -I game-110/dev/assets/export_tiles.py RAW_DIR

The swatches are greyscale on purpose: the castle has five lairs, each with its own palette, so the game colours a swatch at
load time (a gradient map from the palette's dark tone through its base to its light tone). Here each swatch is trimmed, its
levels are stretched (2nd percentile -> 0.08, median -> 0.5, 98th -> 0.95, so the palette's base colour is what you see on
average) and its edges are cross-faded with the opposite edges so it repeats without a hard seam.
"""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, '..', '..', 'assets'))
SIZE = 256
# row-major order in the sheet; rep = how much to multiply the painted texture's repeat count (generated swatches hold more
# detail per tile, so they are repeated less often to keep bricks, planks and tiles the size they were)
NAMES = [('brick', 0.32), ('stone', 0.8), ('paper', 0.5), ('plank', 0.55), ('wallWood', 0.8), ('check', 0.5),
         ('marble', 0.4), ('flag', 0.6), ('carpet', 1.0)]
NO_BLEND = {'check', 'marble', 'carpet'}     # strictly regular patterns: a cross-fade would only blur them


def levels(g):
    lo, mid, hi = np.percentile(g, [2, 50, 98])
    out = np.interp(g, [0, lo, mid, hi, 255], [0, 0.08, 0.5, 0.95, 1.0])
    return out


def wrap_edges(a, band=14):
    h, w = a.shape
    out = a.copy()
    for i in range(band):
        t = i / band
        out[:, i] = a[:, i] * t + a[:, w - band + i] * (1 - t) * 0 + a[:, w - band + i] * (1 - t)
    for i in range(band):
        t = i / band
        out[i, :] = out[i, :] * t + out[h - band + i, :] * (1 - t)
    return out


def main(raw):
    src = Image.open(os.path.join(raw, 'textures.png')).convert('L')
    cell = src.width // 3
    inset = 10
    mpath = os.path.join(ASSETS, 'manifest.json')
    man = json.load(open(mpath)) if os.path.exists(mpath) else {}
    os.makedirs(os.path.join(ASSETS, 'tiles'), exist_ok=True)
    for i, (name, rep) in enumerate(NAMES):
        cx, cy = (i % 3) * cell, (i // 3) * cell
        g = np.asarray(src.crop((cx + inset, cy + inset, cx + cell - inset, cy + cell - inset)).resize((SIZE, SIZE), Image.LANCZOS)).astype(np.float32)
        a = levels(g)
        if name not in NO_BLEND:
            a = wrap_edges(a)
        im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), 'L')
        rel = f'tiles/{name}.png'
        im.save(os.path.join(ASSETS, rel), optimize=True)
        man['tex/' + name] = {'src': rel, 'w': SIZE, 'h': SIZE, 'rep': rep}
        print(rel, im.size)
    json.dump(man, open(mpath, 'w'), indent=1, sort_keys=True)


if __name__ == '__main__':
    main(sys.argv[1])
