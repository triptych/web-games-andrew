#!/usr/bin/env python3
"""Cut the generated renders into the game's sprites: assets/**/*.png and assets/manifest.json.

usage: python3 -I game-110/dev/assets/export_sprites.py RAW_DIR      (RAW_DIR holds the renders, named as below)

  overlord-<tool>.png   three poses side by side: idle, craft, cackle      (tool: cook sew deco party)
  minion-<id>.png       one figure           visitor-<kind>.png   henchman.png
  station-<hobby>.png   four tiers side by side
  token-<kind>.png      match-three tokens   icon-scissors.png icon-paw.png
  pet-<id>.png          idle, happy, sad, blink (+ a fifth frame for the dog and the bat)
  accessories.png       bow, bell collar, wizard hat, scarf, crown

The game sizes a sprite by its logical size (w x h in 'sprite pixels', the size of the painted sprite it replaces), so every
figure is placed bottom-centre in a box of that aspect ratio at S times the size.
"""
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout import key_background, main_figure, crop_to_alpha, split_columns, split_even, fit

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, '..', '..', 'assets'))
S = 6          # output pixels per logical pixel
FILL = 0.96

OVERLORD = (34, 46)
WIDE_O = 1.7
MINIONS = {'imp': (22, 26), 'cauldron': (28, 24), 'golem': (28, 36), 'spider': (30, 24), 'loom': (30, 32), 'bat': (30, 22),
           'gargoyle': (26, 30), 'wraith': (22, 30), 'portrait': (26, 30), 'skeleton': (24, 34), 'mimic': (30, 26), 'lich': (26, 38)}
VISITORS = {'kitten': (20, 16), 'critic': (22, 32), 'bard': (24, 34), 'hero': (24, 36)}
HENCH = (18, 20)
STATION = (48, 48)
TOKENS = ['skull', 'cupcake', 'yarn', 'candle', 'rose', 'teacup', 'pumpkin']
PETS = {'cat': (26, 28, 4), 'dog': (28, 28, 5), 'bat': (30, 26, 5), 'bunny': (24, 30, 4), 'toad': (26, 26, 4), 'owl': (22, 30, 4)}
# accessories: file name -> logical width on a pet (the game places them by the pet's head and neck)
# A frame the model drew badly can be swapped for another cell, e.g. {'bat': {'happy': 3}}; none needs it now.
PET_MAP = {}
PET_WIDE = {'bat': 1.5}
# where accessories sit on the generated pets, in each pet's sprite pixels (head: [x, top of the head]; neck: [x, y, width]);
# a pet not listed here uses the head and neck of the painted pet (PET_GEOM in js/view/art.js)
PET_GEOM = {'cat': {'head': [10.5, 4.5], 'neck': [11, 17, 8]}, 'toad': {'head': [13, 5.5], 'neck': [13, 14, 12]},
            'owl': {'head': [11, 6.5], 'neck': [11, 17.5, 9]}}
ACC = [('bow', 9), ('bell', 9), ('hat', 13), ('scarf', 12), ('crown', 8)]


def load(raw, name):
    p = os.path.join(raw, name + '.png')
    if not os.path.exists(p):
        print('missing', p)
        return None
    return key_background(Image.open(p))


def fig(img, keep=0.03):
    return crop_to_alpha(main_figure(img, keep), 1)


def recolour_hair(im, top=0.8):
    """The model let the Overlord's hair drift to brown in two of the duster frames. Pull brown/orange pixels in the head
    back to her black-violet."""
    import colorsys
    import numpy as np
    arr = np.asarray(im).copy()
    h = arr.shape[0]
    for y in range(int(h * top)):
        for x in range(arr.shape[1]):
            r, g, b, al = arr[y, x]
            if al < 40:
                continue
            hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if 0.03 <= hh <= 0.14 and ss > 0.16 and vv < 0.8:
                nr, ng, nb = colorsys.hsv_to_rgb(0.72, min(0.45, ss), vv * 0.55)
                arr[y, x, :3] = (int(nr * 255), int(ng * 255), int(nb * 255))
    return Image.fromarray(arr, 'RGBA')


def clean_edges(im):
    """Fully transparent pixels still carry the key colour; filtered or mipmapped, that bleeds a magenta halo. Give them the
    outline's deep violet instead."""
    import numpy as np
    a = np.asarray(im.convert('RGBA')).copy()
    a[a[..., 3] == 0, :3] = (28, 18, 40)
    return Image.fromarray(a, 'RGBA')


def save(man, key, rel, im, **meta):
    im = clean_edges(im)
    path = os.path.join(ASSETS, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)
    man[key] = dict(src=rel, **meta)
    print(rel, im.size)


def sheet(cells, bw, bh, scale):
    out = Image.new('RGBA', (bw * len(cells), bh), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        out.paste(fit(c, bw, bh, scale), (i * bw, 0))
    return out


def common_scale(groups, bw, bh):
    return min(min(bw * FILL / c.width, bh * FILL / c.height) for g in groups for c in g)


def main(raw):
    mpath = os.path.join(ASSETS, 'manifest.json')
    man = json.load(open(mpath)) if os.path.exists(mpath) else {}

    # the Overlord: one scale for all twelve frames so she is the same size with every tool and pose
    # (her cells are WIDE_O times wider than her painted sprite so the cackle's raised arms and the tools never set her size)
    ow, oh = round(OVERLORD[0] * WIDE_O) * S, OVERLORD[1] * S
    sheets = {}
    for t in ('cook', 'sew', 'deco', 'party'):
        im = load(raw, 'overlord-' + t)
        if im is not None:
            cells = [fig(c) for c in split_columns(im, 3, 30)]
            if t == 'deco':
                cells[1:] = [recolour_hair(c) for c in cells[1:]]
            sheets[t] = cells
    if sheets:
        sc = min(oh * FILL / c.height for g in sheets.values() for c in g)      # by height only
        sc = min(sc, min(ow * FILL / c.width for g in sheets.values() for c in g))
        for t, cells in sheets.items():
            save(man, 'overlord/' + t, f'overlord/{t}.png', sheet(cells, ow, oh, sc), w=ow // S, h=OVERLORD[1], cols=3)

    for group, table, prefix in ((MINIONS, 'minion', 'minions'), (VISITORS, 'visitor', 'visitors')):
        for k, (w, h) in table_items(group):
            im = load(raw, f'{table}-{k}')
            if im is not None:
                save(man, f'{table}/{k}', f'{prefix}/{k}.png', fit(fig(im), w * S, h * S, fill=FILL), w=w, h=h)
    im = load(raw, 'henchman')
    if im is not None:
        save(man, 'henchman', 'henchman.png', fit(fig(im), HENCH[0] * S, HENCH[1] * S, fill=FILL), w=HENCH[0], h=HENCH[1])

    # the craft centrepieces: four tiers per sheet, one scale per sheet so the tiers keep growing
    bw, bh = STATION[0] * S, STATION[1] * S
    for hobby in ('cook', 'sew', 'deco', 'party'):
        im = load(raw, 'station-' + hobby)
        if im is None:
            continue
        cells = [fig(c) for c in split_columns(im, 4, 30)]
        save(man, 'station/' + hobby, f'stations/{hobby}.png', sheet(cells, bw, bh, common_scale([cells], bw, bh)), w=STATION[0], h=STATION[1], cols=4)

    # Skull Swap tokens and the grave icons: centred in a square
    for k in TOKENS:
        im = load(raw, 'token-' + k)
        if im is not None:
            save(man, 'token/' + k, f'tokens/{k}.png', fit(fig(im), 16 * 8, 16 * 8, fill=0.94, align='centre'), w=16, h=16)
    for k in ('scissors', 'paw'):
        im = load(raw, 'icon-' + k)
        if im is not None:
            save(man, 'icon/' + k, f'tokens/icon-{k}.png', fit(fig(im), 16 * 8, 16 * 8, fill=0.94, align='centre'), w=16, h=16)

    # pets: each frame is its own render (a sheet let neighbouring figures bleed into each other and clipped them), keyed and
    # placed on one common scale; the bat's cells are wider so its raised wings fit
    for pid, (w, h, n) in PETS.items():
        frames = ['idle', 'happy', 'sad', 'blink'] + (['alt'] if n == 5 else [])
        imgs = [load(raw, f'pet-{pid}-{f}') for f in frames]
        if any(i is None for i in imgs):
            continue
        wide = PET_WIDE.get(pid, 1.0)
        cells = [fig(i, 0.25) for i in imgs]
        bw, bh = round(w * wide * 2) // 2 * S, h * S
        sc = min(min(bh * FILL / c.height, bw * FILL / c.width) for c in cells)
        extra = {}
        if pid in PET_MAP:
            extra['map'] = PET_MAP[pid]
        if pid in PET_GEOM:
            extra['geom'] = PET_GEOM[pid]
        if wide != 1.0:
            extra['xpad'] = (bw // S - w) / 2
        save(man, 'pet/' + pid, f'pets/{pid}.png', sheet(cells, bw, bh, sc), w=bw // S, h=h, cols=n, **extra)

    # accessories: trimmed, with a logical width the game scales them to
    im = load(raw, 'accessories')
    if im is not None:
        cells = [fig(c) for c in split_columns(im, len(ACC), 30)]
        for (name, lw), c in zip(ACC, cells):
            k = 8
            c = c.resize((max(1, round(c.width * (lw * k) / c.width)), max(1, round(c.height * (lw * k) / c.width))), Image.LANCZOS)
            save(man, 'acc/' + name, f'pets/acc-{name}.png', c, w=lw, h=round(lw * c.height / c.width, 2))

    json.dump(man, open(mpath, 'w'), indent=1, sort_keys=True)


def table_items(t):
    return t.items()


if __name__ == '__main__':
    main(sys.argv[1])
