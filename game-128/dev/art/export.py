#!/usr/bin/env python3
"""Gemheart Saga art pipeline: raw fal renders -> game-128/art/*.webp.

    python3 -I game-128/dev/art/export.py RAW_DIR

RAW_DIR holds the renders named as in dev/art/prompts.mjs (bg-*, spr-*, por-*, npc-*, sheet-*, boss-*, icons-*,
skills-*). Needs Pillow and numpy only. The cut-out helpers (label, cutout, trim, shrink, grid_cells) come from
game-126's pipeline: sprites were rendered on a flat key colour (magenta, or green for violet subjects; the Gloam
Sovereign came back on near-white), the key is measured from the border and flood-filled away, stray fragments are
dropped, and the figure is box-filtered down to the size its own pixel grid implies so the game draws it with
nearest-neighbour scaling and it reads as crisp 32-bit-era pixels.
"""
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'art'))

# cell order of each region sheet (data/world.js order: five monsters, then the elite)
SHEETS = {
    'greenmarch': ['slime', 'boar', 'goblin', 'hornet', 'wolf', 'bandit'],
    'mirefen': ['toad', 'wisp', 'leech', 'lizard', 'shaman', 'troll'],
    'emberdeep': ['kobold', 'beetle', 'bat', 'salamander', 'miner', 'golem'],
    'frostfang': ['imp', 'harpy', 'yeti', 'wraith', 'ram', 'jarl'],
    'gloamspire': ['shade', 'skeleton', 'gargoyle', 'cultist', 'hound', 'revenant'],
}
BOSSES = ['tusk', 'murk', 'cinderjaw', 'hrimfrost', 'sovereign', 'varek', 'quell', 'rotroot', 'vesper']
HEROES = ['kael', 'sela', 'fenn', 'odo']
NPCS = ['maren', 'bess', 'pell', 'ilse', 'garrick', 'tobin']
REGIONS = ['greenmarch', 'mirefen', 'emberdeep', 'frostfang', 'gloamspire']
ICON_SHEETS = ['gems', 'gear', 'goods', 'misc']
# Monsters stand on the right of the battle scene and must face LEFT; heroes stand on the left and face RIGHT.
# The model ignored the direction for these; they were found by eye on the labelled contact sheet and are mirrored.
FLIP = {'mon/wolf', 'mon/hound', 'mon/kobold', 'mon/leech', 'mon/hornet', 'mon/lizard', 'mon/troll', 'mon/toad', 'hero/sela'}

# longest side, in art pixels
SIZE = {'normal': 150, 'elite': 190, 'boss': 240, 'hero': 156, 'icon': 64, 'building': 168, 'skill': 96}

def label(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    n = 0
    sizes = [0]
    for y0 in range(h):
        row = mask[y0]
        for x0 in np.nonzero(row & (lab[y0] == 0))[0]:
            if lab[y0, x0]:
                continue
            n += 1
            lab[y0, x0] = n
            q = deque([(y0, x0)])
            c = 0
            while q:
                y, x = q.popleft()
                c += 1
                for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                        lab[yy, xx] = n
                        q.append((yy, xx))
            sizes.append(c)
    return lab, sizes


def cutout(img, focus=None):
    """RGBA with the key background removed. Works at a reduced size for the flood fill, then upsamples the mask."""
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    ring = np.concatenate([a[:6].reshape(-1, 3), a[-6:].reshape(-1, 3), a[:, :6].reshape(-1, 3), a[:, -6:].reshape(-1, 3)])
    bg = np.median(ring, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
    # the key colour drifts across a sheet (cells come back in two shades): measure "keyness" by hue family too
    key = np.argmax(bg)  # 0 r, 1 g, 2 b dominant
    if bg[0] > 150 and bg[2] > 150 and bg[1] < 120:          # magenta family
        keyish = (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) > 90
    elif bg[1] > 150 and bg[0] < 140 and bg[2] < 140:       # green
        keyish = (a[..., 1] - np.maximum(a[..., 0], a[..., 2])) > 90
    elif bg[2] > 150 and bg[0] < 120 and bg[1] < 140:       # blue
        keyish = (a[..., 2] - np.maximum(a[..., 0], a[..., 1])) > 110
    else:
        keyish = dist < 40
    cand = keyish | (dist < 50)
    # flood fill the candidate background from the border
    lab, sizes = label(cand)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgmask = np.isin(lab, list(border))
    # enclosed pockets of almost exactly the key colour (between legs, inside wings)
    bgmask |= (keyish & (dist < 70))
    # larger enclosed pockets that are clearly key-coloured (inside a necklace loop, under an arch of wings)
    plab, psizes = label(keyish & ~bgmask)
    big_pockets = [i for i in range(1, len(psizes)) if psizes[i] >= 0.0015 * h * w]
    if big_pockets:
        bgmask |= np.isin(plab, big_pockets)
    fg = ~bgmask
    # drop specks and floating fragments (labels, smears) far from the main figure
    flab, fsizes = label(fg)
    if len(fsizes) > 1:
        big = int(np.argmax(fsizes[1:])) + 1
        if focus:
            # in a sheet cell searched with a margin: the biggest figure whose centre lies in the cell itself
            fx0, fy0, fx1, fy1 = focus
            best = 0
            for i in range(1, len(fsizes)):
                if fsizes[i] <= best or fsizes[i] < 50:
                    continue
                ys, xs = np.nonzero(flab == i)
                cy, cx = ys.mean(), xs.mean()
                if fx0 <= cx < fx1 and fy0 <= cy < fy1:
                    best, big = fsizes[i], i
        ys, xs = np.nonzero(flab == big)
        y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
        my, mx = (y1 - y0) * 0.12 + 4, (x1 - x0) * 0.12 + 4
        keep = np.zeros(len(fsizes), bool)
        keep[big] = True
        for i in range(1, len(fsizes)):
            if i == big or fsizes[i] < fsizes[big] * 0.002:
                continue
            ys, xs = np.nonzero(flab == i)
            inside = ys.min() >= y0 - my and ys.max() <= y1 + my and xs.min() >= x0 - mx and xs.max() <= x1 + mx
            if inside and fsizes[i] >= 6:
                keep[i] = True
        fg = keep[flab]
    # despill: pull the key colour out of edge pixels
    rgb = a.copy()
    edge = np.zeros_like(fg)
    for d in range(1, 5):   # a band a few pixels deep, so soft glows lose their key-coloured fringe too
        edge |= fg & (~np.roll(fg, d, 0) | ~np.roll(fg, -d, 0) | ~np.roll(fg, d, 1) | ~np.roll(fg, -d, 1))
    if bg[0] > 150 and bg[2] > 150 and bg[1] < 120:
        lim = rgb[..., 1] + 30
        rgb[..., 0] = np.where(edge, np.minimum(rgb[..., 0], lim), rgb[..., 0])
        rgb[..., 2] = np.where(edge, np.minimum(rgb[..., 2], lim), rgb[..., 2])
    elif bg[1] > 150:
        lim = np.maximum(rgb[..., 0], rgb[..., 2]) + 20
        rgb[..., 1] = np.where(edge, np.minimum(rgb[..., 1], lim), rgb[..., 1])
    elif bg[2] > 150:
        lim = np.maximum(rgb[..., 0], rgb[..., 1]) + 20
        rgb[..., 2] = np.where(edge, np.minimum(rgb[..., 2], lim), rgb[..., 2])
    out = np.dstack([np.clip(rgb, 0, 255), fg * 255.0]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def trim(im, pad=0):
    bbox = im.getchannel('A').point(lambda v: 255 if v > 0 else 0).getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def shrink(im, longest):
    """Downscale an RGBA cutout to `longest` px on its long side with premultiplied box filtering, then harden alpha."""
    s = longest / max(im.width, im.height)
    if s >= 1:
        return im
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    a = np.asarray(im).astype(np.float32)
    al = a[..., 3:4] / 255.0
    pre = np.concatenate([a[..., :3] * al, al * 255.0], axis=2).astype(np.float32)
    chans = [Image.fromarray(pre[..., i]).resize((w, h), Image.BOX) for i in range(4)]
    arr = np.dstack([np.asarray(c) for c in chans])
    alpha = arr[..., 3] / 255.0
    rgb = np.where(alpha[..., None] > 0.01, arr[..., :3] / np.maximum(alpha[..., None], 0.01), 0)
    hard = (alpha > 0.45) * 255.0
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), hard]).astype(np.uint8), 'RGBA')


def save(im, name, **kw):
    path = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if im.mode == 'RGBA':
        im.save(path, 'WEBP', lossless=True, method=6)
    else:
        im.save(path, 'WEBP', quality=kw.get('q', 82), method=6)
    return path


def grid_cells(img, cols, rows, margin=0.0):
    """Each cell of a sheet, searched with a margin into its neighbours (big figures spill over the lines).
    Yields (crop, focus) where focus is the cell's own rectangle inside the crop."""
    w, h = img.size
    for r in range(rows):
        for c in range(cols):
            x0, y0, x1, y1 = c * w // cols, r * h // rows, (c + 1) * w // cols, (r + 1) * h // rows
            mx, my = int((x1 - x0) * margin), int((y1 - y0) * margin)
            X0, Y0, X1, Y1 = max(0, x0 - mx), max(0, y0 - my), min(w, x1 + mx), min(h, y1 + my)
            yield img.crop((X0, Y0, X1, Y1)), (x0 - X0, y0 - Y0, x1 - X0, y1 - Y0)



def save(im, name, q=82):
    path = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if im.mode == 'RGBA':
        im.save(path, 'WEBP', lossless=True, method=6)
    else:
        im.save(path, 'WEBP', quality=q, method=6)
    return path


def main(raw):
    meta = {'sprites': {}}
    have = lambda n: os.path.exists(os.path.join(raw, n))
    op = lambda n: Image.open(os.path.join(raw, n))

    def sprite(sp, name, longest):
        sp = trim(sp)
        if name in FLIP:
            sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
        sp = shrink(sp, longest)
        save(sp, name + '.webp')
        meta['sprites'][name.split('/')[-1]] = [sp.width, sp.height]

    for region, ids in SHEETS.items():
        f = f'sheet-{region}.png'
        if not have(f):
            print('missing', f); continue
        for i, (cell, focus) in enumerate(grid_cells(op(f), 3, 2, margin=0.22)):
            sprite(cutout(cell, focus), f'mon/{ids[i]}', SIZE['elite' if i == 5 else 'normal'])
    for b in BOSSES:
        if have(f'boss-{b}.png'):
            sprite(cutout(op(f'boss-{b}.png')), f'mon/{b}', SIZE['boss'])
    for h in HEROES:
        if have(f'spr-{h}.png'):
            sp = trim(cutout(op(f'spr-{h}.png')))
            s = SIZE['hero'] / sp.height          # heroes by height, so a broad monk stays the same height as the mage
            sprite(sp, f'hero/{h}', max(sp.width, sp.height) * s)
        if have(f'por-{h}.png'):
            save(op(f'por-{h}.png').convert('RGB').resize((256, 256), Image.BOX), f'por/{h}.webp', q=84)
    for n in NPCS:
        if have(f'npc-{n}.png'):
            save(op(f'npc-{n}.png').convert('RGB').resize((256, 256), Image.BOX), f'por/{n}.webp', q=84)
    for r in REGIONS:
        if have(f'bg-{r}.png'):
            save(op(f'bg-{r}.png').convert('RGB').resize((768, 432), Image.BOX), f'bg/{r}.webp', q=80)
    for n in ('title', 'village'):
        if have(f'bg-{n}.png'):
            save(op(f'bg-{n}.png').convert('RGB').resize((1280, 720), Image.BOX), f'bg/{n}.webp', q=82)
    # buildings: 3x3 atlas of square cells, each building centred and bottom-aligned
    if have('sheet-buildings.png'):
        C = SIZE['building']
        atlas = Image.new('RGBA', (C * 3, C * 3), (0, 0, 0, 0))
        for i, (cell, focus) in enumerate(grid_cells(op('sheet-buildings.png'), 3, 3, margin=0.08)):
            b = shrink(trim(cutout(cell, focus)), C - 4)
            atlas.paste(b, ((i % 3) * C + (C - b.width) // 2, (i // 3) * C + C - 2 - b.height), b)
        save(atlas, 'buildings.webp')
    # 4x4 icon atlases (gems are the board pieces)
    for s in ICON_SHEETS:
        f = f'icons-{s}.png'
        if not have(f):
            print('missing', f); continue
        C = SIZE['icon']
        atlas = Image.new('RGBA', (C * 4, C * 4), (0, 0, 0, 0))
        for i, (cell, focus) in enumerate(grid_cells(op(f), 4, 4, margin=0.06)):
            ic = shrink(trim(cutout(cell, focus)), C - 2)
            atlas.paste(ic, ((i % 4) * C + (C - ic.width) // 2, (i // 4) * C + (C - ic.height) // 2), ic)
        save(atlas, f'icons/{s}.webp')
    # skill icons: painted square tiles; cut each cell inside its gutter
    for h in HEROES:
        f = f'skills-{h}.png'
        if not have(f):
            print('missing', f); continue
        img = op(f).convert('RGB')
        C = SIZE['skill']
        atlas = Image.new('RGB', (C * 3, C * 3), (0, 0, 0))
        w, hh = img.size
        for i in range(9):
            x0, y0 = (i % 3) * w // 3, (i // 3) * hh // 3
            inset = int(w / 3 * 0.07)
            tile = img.crop((x0 + inset, y0 + inset, x0 + w // 3 - inset, y0 + hh // 3 - inset)).resize((C, C), Image.BOX)
            atlas.paste(tile, ((i % 3) * C, (i // 3) * C))
        save(atlas, f'skills/{h}.webp', q=86)
    with open(os.path.join(OUT, 'sprites.json'), 'w') as fh:
        json.dump(meta, fh, indent=0, sort_keys=True)
    print('wrote', OUT)


if __name__ == '__main__':
    main(sys.argv[1])
