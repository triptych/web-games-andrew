#!/usr/bin/env python3
"""Cut the ElevenLabs item sheets into one picture per object (the references Meshy models them from).

    python3 -I game-147/dev/art/cut.py RAW OUT

RAW holds sheet-ingredients.png, sheet-meals-gear.png, sheet-decor.png, sheet-furniture2.png (4x4) and
sheet-furniture.png (3x3); a missing sheet is skipped.
For each cell, the object is the bounding box of the non-white pixels inside the cell (with a margin, so an object
that leans over a line is still whole); it is centred on a white square with 12% padding and saved at 512 px as
OUT/<name>.png. Needs Pillow and numpy.
"""
import os, sys
import numpy as np
from PIL import Image

RAW, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

SHEETS = {
    'sheet-ingredients': (4, ['honey', 'pepper', 'puffcap', 'glowmoss', 'sugar', 'fluff', 'herbs', 'flour',
                              'honeyDrop', 'mintTea', 'smellingSalts', 'pepperBomb', 'copperPot', 'goldenWhisk', 'turboBroom', 'sparkleSpray']),
    'sheet-meals-gear': (4, ['honeyTart', 'herbSalad', 'emberStew', 'puffcapPie', 'glowTea', 'crystalParfait', 'cloudSouffle', 'marblePin',
                             'starLadle', 'silverOpeners', 'moonLute', 'sudsHalberd', 'luckyBell', 'silkScarf', 'copperRing', 'dragonflyPin']),
    'sheet-decor': (4, ['sunflowerVase', 'copperKettle', 'luggageCart', 'pottedFern', 'armorStand', 'suitcase', 'diary', 'featherDuster',
                        'oakPin', 'brassLadle', 'letterOpeners', 'gourdLute', 'mopHalberd', 'chest', 'coins', 'deskBell']),
    'sheet-furniture': (3, ['desk', 'bed', 'stove', 'table', 'planter', 'armchair', 'bookshelf', 'bathtub', 'wardrobe']),
    # v1.1.0: dressing for the rebuilt inn (Meshy flattened the flower bush into a disc and split the crates: unused)
    'sheet-furniture2': (4, ['fireplace', 'sofa', 'clock', 'coatRack', 'kitchenShelf', 'barrel', 'crates', 'chair',
                             'nightstand', 'floorLamp', 'tree', 'hedge', 'lampPost', 'bench', 'flowerBush', 'pumpkins']),
}

for sheet, (n, names) in SHEETS.items():
    if not os.path.exists(os.path.join(RAW, sheet + '.png')):
        print('skip', sheet); continue
    im = Image.open(os.path.join(RAW, sheet + '.png')).convert('RGB')
    a = np.asarray(im).astype(int)
    ink = (a.min(axis=2) < 235)                       # anything not near-white
    H, W = ink.shape
    ch, cw = H / n, W / n
    for i, name in enumerate(names):
        r, c = divmod(i, n)
        y0, y1 = int(r * ch), int((r + 1) * ch)
        x0, x1 = int(c * cw), int((c + 1) * cw)
        m = ink[y0:y1, x0:x1]
        # rows and columns with only a few ink pixels are specks (a stray sparkle), not the object
        cols = np.nonzero(m.sum(axis=0) > 4)[0]
        rows = np.nonzero(m.sum(axis=1) > 4)[0]
        if len(cols) == 0:
            print('EMPTY', name); continue
        bx0, bx1 = x0 + cols.min(), x0 + cols.max()
        by0, by1 = y0 + rows.min(), y0 + rows.max()
        crop = im.crop((bx0, by0, bx1 + 1, by1 + 1))
        side = int(max(crop.size) * 1.24)
        sq = Image.new('RGB', (side, side), 'white')
        sq.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
        sq.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, name + '.png'))
    print(sheet, len(names))
