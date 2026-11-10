#!/usr/bin/env python3
"""EMBERSPIRE art pipeline: raw fal renders -> game-126/art/*.webp.

    python3 -I game-126/dev/art/export.py RAW_DIR

RAW_DIR holds the renders named as in dev/art/README.md (sheet-<biome>.png, boss-<id>.png, spr-<hero>.png,
evo-<hero>.png, por-<hero>.png, npc-<id>.png, bg-<name>.png, icons-<sheet>.png). Needs Pillow and numpy only.

Sprites were rendered on a flat key colour (magenta, green or blue, whichever the subject does not use). The key is
measured from the image border, background connected to the border is removed by flood fill, enclosed pockets that
are almost exactly the key colour go too, and anything left floating far from the main figure (a stray label, a smear)
is dropped. The figure is trimmed and box-filtered down to roughly the size the art's own pixel grid implies, so the
game can draw it with nearest-neighbour scaling and it reads as true 16-bit pixels, at a few KB a sprite.
"""
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'art'))

# stratum order of the monster sheets, and the order of the six cells in each (5 monsters + the mini boss)
SHEETS = {
    'undercroft': ['moss_slime', 'gnawer_rat', 'dusk_bat', 'goblin_scrapper', 'puffcap', 'grubnak'],
    'grotto': ['kobold_miner', 'crystal_spider', 'geode_tortoise', 'shard_wisp', 'quartz_mole', 'basilisk'],
    'library': ['living_tome', 'ink_shade', 'skeleton_scholar', 'quill_imp', 'wax_wraith', 'grand_mimic'],
    'forge': ['fire_imp', 'magma_salamander', 'cinder_hound', 'slag_golem', 'forge_wight', 'furnace_ogre'],
    'frost': ['frost_wolf', 'ice_wraith', 'snow_yeti', 'frozen_knight', 'rime_harpy', 'glacier_troll'],
    'clockwork': ['clock_soldier', 'gear_spider', 'brass_owl', 'cog_hound', 'sentinel_orb', 'siege_automaton'],
    'garden': ['mandrake', 'bog_lurker', 'thorn_dryad', 'mire_toad', 'flytrap', 'hydra'],
    'astral': ['star_jelly', 'nebula_moth', 'astral_sentinel', 'void_eye', 'starlight_stag', 'eclipse_knight'],
    'abyss': ['hellhound', 'horned_fiend', 'gargoyle', 'void_spawn', 'demon_knight', 'pit_warden'],
    'summit': ['thunderbird', 'storm_elemental', 'griffon', 'seraph_sentinel', 'sky_drake', 'storm_drake'],
}
BOSSES = ['colossus', 'vitreous_wyrm', 'archivist', 'ignivar', 'hrimgard', 'orrery', 'motherbloom', 'celestine', 'malgrath', 'aurelion']
HEROES = ['arin', 'mira', 'brakka', 'sylas', 'lyra', 'thorne', 'pip', 'grimble', 'nyx']
NPCS = ['bram', 'hilde', 'corwin', 'zephyrine', 'amaya', 'watcher']
BGS_BATTLE = ['undercroft', 'grotto', 'library', 'forge', 'frost', 'clockwork', 'garden', 'astral', 'abyss', 'summit']
BGS_TOWN = ['town', 'tavern', 'tavern-night', 'smithy', 'shop', 'guild', 'temple']
CROP_BOTTOM = {'garden': 0.11}
# The model didn't always draw the facing it was asked for. Heroes stand on the right and must face left;
# monsters stand on the left and must face right. These were checked by eye on a contact sheet and are mirrored.
# sprites the model drew facing the wrong way (monsters face right, toward the party; heroes face left).
# Judge at full size: at thumbnail size a three-quarter view is easy to misread (v1.0.4 un-mirrored grubnak,
# celestine and thorne, which v1.0.0 had mirrored the wrong way).
FLIP = {'arin', 'arin-evo', 'grimble', 'grimble-evo', 'lyra', 'lyra-evo', 'pip', 'pip-evo', 'thorne-evo'}
ICON_SHEETS = ['gear', 'goods', 'uniques', 'misc']

# longest side, in game pixels (the battle canvas is 640x360)
SIZE = {'normal': 124, 'mini': 172, 'boss': 228, 'hero': 92, 'icon': 48}


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


def main(raw):
    meta = {'sprites': {}}
    have = lambda n: os.path.exists(os.path.join(raw, n))
    for biome, ids in SHEETS.items():
        f = f'sheet-{biome}.png'
        if not have(f):
            print('missing', f); continue
        img = Image.open(os.path.join(raw, f))
        if biome in CROP_BOTTOM:   # this sheet came back with a name caption under every creature: blank them
            img = img.convert('RGB')
            bgc = img.getpixel((4, 4))
            w, h = img.size
            for r in range(2):
                y1 = (r + 1) * h // 2
                img.paste(bgc, (0, int(y1 - h / 2 * CROP_BOTTOM[biome]), w, y1))
        for i, (cell, focus) in enumerate(grid_cells(img, 3, 2, margin=0.22)):
            mid = ids[i]
            sp = trim(cutout(cell, focus))
            if mid in FLIP: sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
            sp = shrink(sp, SIZE['mini' if i == 5 else 'normal'])
            save(sp, f'mon/{mid}.webp')
            meta['sprites'][mid] = [sp.width, sp.height]
    for b in BOSSES:
        f = f'boss-{b}.png'
        if not have(f):
            print('missing', f); continue
        sp = trim(cutout(Image.open(os.path.join(raw, f))))
        if b in FLIP: sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
        sp = shrink(sp, SIZE['boss'])
        save(sp, f'mon/{b}.webp')
        meta['sprites'][b] = [sp.width, sp.height]
    for h in HEROES:
        for pre in ('spr', 'evo'):
            f = f'{pre}-{h}.png'
            if not have(f):
                print('missing', f); continue
            sp = trim(cutout(Image.open(os.path.join(raw, f))))
            if (h if pre == 'spr' else h + '-evo') in FLIP: sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
            # heroes are scaled by height so a halfling stays shorter than a half-orc
            tall = {'pip': 0.78, 'grimble': 0.86}.get(h, 1.0)
            s = SIZE['hero'] * tall / sp.height
            sp = shrink(sp, max(sp.width, sp.height) * s)
            name = f'hero/{h}{"" if pre == "spr" else "-evo"}.webp'
            save(sp, name)
            meta['sprites'][name[5:-5]] = [sp.width, sp.height]
    for h in HEROES:
        if have(f'por-{h}.png'):
            save(Image.open(os.path.join(raw, f'por-{h}.png')).convert('RGB').resize((256, 256), Image.BOX), f'por/{h}.webp', q=84)
    for n in NPCS:
        if have(f'npc-{n}.png'):
            save(Image.open(os.path.join(raw, f'npc-{n}.png')).convert('RGB').resize((256, 256), Image.BOX), f'por/{n}.webp', q=84)
    for b in BGS_BATTLE:
        if have(f'bg-{b}.png'):
            save(Image.open(os.path.join(raw, f'bg-{b}.png')).convert('RGB').resize((640, 360), Image.BOX), f'bg/{b}.webp', q=80)
    for b in BGS_TOWN:
        if have(f'bg-{b}.png'):
            save(Image.open(os.path.join(raw, f'bg-{b}.png')).convert('RGB').resize((960, 540), Image.BOX), f'bg/{b}.webp', q=80)
    if have('bg-title.png'):
        save(Image.open(os.path.join(raw, 'bg-title.png')).convert('RGB').resize((1280, 720), Image.BOX), 'bg/title.webp', q=82)
    # icon atlases: 4x4 cells of 48 px, the icon centred and bottom-aligned within a 2 px margin
    for s in ICON_SHEETS:
        f = f'icons-{s}.png'
        if not have(f):
            print('missing', f); continue
        img = Image.open(os.path.join(raw, f))
        atlas = Image.new('RGBA', (48 * 4, 48 * 4), (0, 0, 0, 0))
        for i, (cell, _) in enumerate(grid_cells(img, 4, 4)):
            ic = shrink(trim(cutout(cell)), SIZE['icon'] - 4)
            atlas.paste(ic, ((i % 4) * 48 + (48 - ic.width) // 2, (i // 4) * 48 + (48 - ic.height) // 2), ic)
        save(atlas, f'icons/{s}.webp')
    with open(os.path.join(OUT, 'sprites.json'), 'w') as fh:
        json.dump(meta, fh, indent=0, sort_keys=True)
    print('wrote', OUT)


if __name__ == '__main__':
    main(sys.argv[1])
