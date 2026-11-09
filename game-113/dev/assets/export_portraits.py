#!/usr/bin/env python3
"""Cut portrait renders out of their magenta key, trim the generator's stray frame, fit into a 4:5 box (192x240).

usage: python3 -I dev/assets/export_portraits.py RAW_DIR      (RAW_DIR holds portrait-<id>.png)
"""
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout import key_magenta, crop_to_alpha

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, '..', '..', 'assets'))
IDS = ['lyra', 'sera', 'mari', 'ingrid', 'bram', 'aldric', 'fenwick', 'hakon', 'elder', 'fisher', 'kid', 'miller', 'farmer',
       'guard', 'smith', 'choir1', 'choir2', 'choir3', 'choir4', 'choir5', 'choir6', 'otto', 'archivist']
BW, BH = 192, 240

def main(raw):
    os.makedirs(os.path.join(ASSETS, 'portraits'), exist_ok=True)
    mpath = os.path.join(ASSETS, 'manifest.json')
    man = json.load(open(mpath)) if os.path.exists(mpath) else {}
    for n in IDS:
        src = os.path.join(raw, f'portrait-{n}.png')
        if not os.path.exists(src): print('missing', src); continue
        a = Image.open(src); m = int(a.width * 0.025)
        a = a.crop((m, m, a.width - m, a.height - m))        # some renders come with a thin dark frame
        im = crop_to_alpha(key_magenta(a), 0)
        s = min(BW / im.width, BH / im.height)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        box = Image.new('RGBA', (BW, BH), (0, 0, 0, 0))
        box.paste(im, ((BW - im.width) // 2, BH - im.height), im)     # busts sit on the bottom edge
        rel = f'portraits/{n}.png'
        box.save(os.path.join(ASSETS, rel), optimize=True)
        man[f'portrait/{n}'] = {'src': rel, 'w': 16, 'h': 20}
    json.dump(man, open(mpath, 'w'), indent=1, sort_keys=True)
    print(len([k for k in man if k.startswith('portrait/')]), 'portraits')

if __name__ == '__main__':
    main(sys.argv[1])
