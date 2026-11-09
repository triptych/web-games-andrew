#!/usr/bin/env python3
"""Fit cut-out monster art into each sprite's logical box and write assets/monsters/*.png + manifest entries.

usage: python3 -I dev/assets/export_monsters.py RAW_DIR      (RAW_DIR holds monster-<enemyId>.png magenta-key renders)
The game scales a sprite by its logical size (w x h, in 'pixels'), so the art is bottom-centred in a box of the
same aspect ratio and written at 4x that size; the game sizes it exactly as it sized the painted one.
"""
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout import key_magenta, crop_to_alpha

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, '..', '..', 'assets'))
SCALE = 4
FILL = 0.96
# enemy id -> logical size (from js/view/monsters.js)
SIZES = {
    'shardcrab': (32, 32), 'gloomwisp': (32, 32), 'rustling': (32, 32), 'reefgob': (32, 32), 'jellyhush': (32, 32),
    'thornling': (32, 32), 'frostmite': (32, 32), 'crowl': (40, 40), 'snowwolf': (40, 40), 'hushknight': (40, 40),
    'silencer': (40, 40), 'maelstra': (64, 64), 'hollowhay': (64, 64), 'rimefang': (64, 64), 'warden': (64, 64),
    'vorthrax': (112, 104), 'colossus': (112, 104),
}

def main(raw):
    os.makedirs(os.path.join(ASSETS, 'monsters'), exist_ok=True)
    mpath = os.path.join(ASSETS, 'manifest.json')
    man = json.load(open(mpath)) if os.path.exists(mpath) else {}
    for name, (w, h) in SIZES.items():
        src = os.path.join(raw, f'monster-{name}.png')
        if not os.path.exists(src): print('missing', src); continue
        im = crop_to_alpha(key_magenta(Image.open(src)), 1)
        bw, bh = w * SCALE, h * SCALE
        s = min(bw * FILL / im.width, bh * FILL / im.height)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        box = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
        box.paste(im, ((bw - im.width) // 2, bh - im.height - round(bh * 0.02)), im)
        rel = f'monsters/{name}.png'
        box.save(os.path.join(ASSETS, rel), optimize=True)
        man[f'monster/{name}'] = {'src': rel, 'w': w, 'h': h}
        print(rel, box.size)
    json.dump(man, open(mpath, 'w'), indent=1, sort_keys=True)

if __name__ == '__main__':
    main(sys.argv[1])
