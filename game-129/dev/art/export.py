#!/usr/bin/env python3
"""HOLLOWDEEP art pipeline: raw fal renders -> game-129/art/*.webp.

    python3 -I game-129/dev/art/export.py RAW_DIR

RAW_DIR holds the renders named as in README.md (sheet-<stratum>.png, bosses-N.png, reaper.png, tex-N.png,
portraits-N.png, portraits-npc.png, bgs-N.png, bg-title.png, icons-<sheet>.png). Needs Pillow and numpy only.

The cut-out helpers (label, cutout, trim, shrink, grid_cells) are game-126's: sprites were rendered on a flat key colour,
the key is measured from the border, background connected to the border is flood-filled away, enclosed key-coloured
pockets go too, and floating fragments far from the main figure are dropped. Unlike EMBERSPIRE's pixel art, these are
painted sprites, so they are scaled with a box filter to a size the battle screen shows them at and saved as lossy WebP.
"""
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'art'))

STRATA = ['catacombs', 'grotto', 'drowned', 'foundry', 'ossuary', 'thornwood', 'clockwork', 'sanctum']
SHEETS = {
    'catacombs': ['bone_rat', 'crypt_bat', 'moss_slime', 'skeleton', 'ghoul', 'wisp'],
    'grotto': ['sporeling', 'cave_beetle', 'glow_moth', 'myconid_shaman', 'rock_lizard', 'kobold'],
    'drowned': ['kelp_horror', 'merrow', 'giant_crab', 'drowned_sailor', 'eel_serpent', 'siren'],
    'foundry': ['fire_imp', 'magma_slug', 'iron_golem', 'salamander', 'ember_hound', 'dwarf_revenant'],
    'ossuary': ['frost_wolf', 'ice_wraith', 'yeti', 'rime_archer', 'snow_harpy', 'frost_thrall'],
    'thornwood': ['treant_sapling', 'thorn_dryad', 'mantis', 'venom_toad', 'owlbear', 'vine_strangler'],
    'clockwork': ['gear_spider', 'brass_sentry', 'clock_owl', 'steam_knight', 'mimic', 'copper_golem'],
    'sanctum': ['void_eye', 'star_jelly', 'astral_knight', 'nebula_moth', 'fallen_seraph', 'shadow_fiend'],
}
BOSS_SHEETS = [['ossuary_knight', 'mother_mycelia', 'brine_leviathan', 'forgefather'],
               ['winter_lich', 'elder_briar', 'orrery_engine', 'hollow_king']]
TEX_SHEETS = [['catacombs', 'grotto'], ['drowned', 'foundry'], ['ossuary', 'thornwood'], ['clockwork', 'sanctum']]
POR_SHEETS = [['fighter_a', 'fighter_b', 'knight_a', 'knight_b', 'thief_a', 'thief_b'],
              ['mage_a', 'mage_b', 'priest_a', 'priest_b', 'ranger_a', 'ranger_b']]
NPCS = ['marta', 'odo', 'varga', 'elowen', 'pell', 'ansel']
BG_SHEETS = [['square', 'inn', 'shop', 'guild'], ['temple', 'tavern', 'gate', 'deeps']]
ICON_SHEETS = ['gear', 'misc']
# longest side of a sprite in the game's files (CSS shows them smaller; the extra is for 2x screens)
SIZE = {'normal': 380, 'boss': 640, 'icon': 64}
# the townsfolk sheet came back with each role written above the portrait: cut that band off
NPC_CAPTION = 0.15
# bgs-1 came back with the cell number in each top-left corner: crop a margin all round
BG_MARGIN = {'bgs-1': 0.05, 'bgs-2': 0.02}

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
            # a long thin fragment is a cell border the model drew, not part of the creature (game-129)
            bw, bh = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
            thin = fsizes[i] / float(bw * bh) < 0.12 and max(bw, bh) > 40
            if inside and fsizes[i] >= 6 and not thin:
                keep[i] = True
        fg = keep[flab]
    # despill: pull the key colour out of edge pixels
    rgb = a.copy()
    edge = np.zeros_like(fg)
    band = 22 if (bg[0] > 150 and bg[2] > 150 and bg[1] < 120) else 5   # painted glows pick up a wide magenta halo
    for d in range(1, band):   # a band a few pixels deep, so soft glows lose their key-coloured fringe too
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


def seamless(im):
    """Blend a tile with itself shifted by half, weighted to the centre, so its edges wrap."""
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    b = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    yy, xx = np.mgrid[0:h, 0:w]
    wy = 1 - np.abs(yy / (h - 1) * 2 - 1)
    wx = 1 - np.abs(xx / (w - 1) * 2 - 1)
    m = np.clip(np.minimum(wx, wy) * 3.2, 0, 1)[..., None]
    return Image.fromarray(np.clip(a * m + b * (1 - m), 0, 255).astype(np.uint8), 'RGB')


def save(im, name, q=82):
    path = os.path.join(OUT, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=q, method=6)
    return path


def cells(img, cols, rows, inset=0.0):
    w, h = img.size
    for r in range(rows):
        for c in range(cols):
            x0, y0, x1, y1 = c * w / cols, r * h / rows, (c + 1) * w / cols, (r + 1) * h / rows
            dx, dy = (x1 - x0) * inset, (y1 - y0) * inset
            yield img.crop((round(x0 + dx), round(y0 + dy), round(x1 - dx), round(y1 - dy)))


# sprites whose own glow blended into the magenta key and came back with a lavender halo (checked by eye)
HALO = {'crypt_bat', 'wisp', 'ice_wraith', 'glow_moth', 'forgefather'}


def dehalo(im, depth=28):
    """Drop magenta-tinted pixels within `depth` px of the sprite's edge (the glow's key-coloured fringe)."""
    a = np.asarray(im).copy()
    alpha = a[..., 3] > 0
    near = ~alpha
    band = np.zeros_like(alpha)
    for d in range(1, depth):
        near = near | np.roll(near, 1, 0) | np.roll(near, -1, 0) | np.roll(near, 1, 1) | np.roll(near, -1, 1)
        band |= alpha & near
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    tinted = ((np.minimum(r, b) - g > 12) & (np.abs(r - b) < 90)) | ((g - b > 40) & (g >= r - 12))   # magenta, or green / yellow-green key glow
    a[..., 3] = np.where(band & tinted, 0, a[..., 3])
    return Image.fromarray(a, 'RGBA')


def scrub_lines(img, cols, rows):
    """Paint over grid lines the model drew between cells (and round the edge): near each cell boundary, any column
    or row with a quarter-length run that is almost all near-black becomes background."""
    a = np.asarray(img.convert('RGB')).copy()
    h, w, _ = a.shape
    key = a[h // 2, 2].copy() if a[h // 2, 2].max() > 120 else a[4, 4].copy()
    dark = a.max(axis=2) < 70
    win = int(0.015 * max(w, h)) + 3
    for k in range(cols + 1):
        b = round(k * w / cols)
        for x in range(max(0, b - win), min(w, b + win)):
            if any(dark[y0:y0 + h // 4, x].mean() > 0.9 for y0 in range(0, h, h // 4)):
                a[:, x] = key
    for k in range(rows + 1):
        b = round(k * h / rows)
        for y in range(max(0, b - win), min(h, b + win)):
            if any(dark[y, x0:x0 + w // 4].mean() > 0.9 for x0 in range(0, w, w // 4)):
                a[y] = key
    return Image.fromarray(a, 'RGB')


def main(raw):
    meta = {'sprites': {}}
    have = lambda n: os.path.exists(os.path.join(raw, n))
    op = lambda n: Image.open(os.path.join(raw, n))
    for s, ids in SHEETS.items():
        f = f'sheet-{s}.png'
        if not have(f):
            print('missing', f); continue
        for i, (cell, focus) in enumerate(grid_cells(scrub_lines(op(f), 3, 2), 3, 2, margin=0.12)):
            sp = trim(cutout(cell, focus))
            if ids[i] in HALO: sp = trim(dehalo(sp))
            sp = shrink(sp, SIZE['normal'])
            save(sp, f'mon/{ids[i]}.webp', q=84)
            meta['sprites'][ids[i]] = [sp.width, sp.height]
    for k, ids in enumerate(BOSS_SHEETS):
        f = f'bosses-{k + 1}.png'
        if not have(f):
            print('missing', f); continue
        for i, (cell, focus) in enumerate(grid_cells(scrub_lines(op(f), 2, 2), 2, 2, margin=0.015)):
            sp = trim(cutout(cell, focus))
            if ids[i] in HALO: sp = trim(dehalo(sp))
            sp = shrink(sp, SIZE['boss'])
            save(sp, f'mon/{ids[i]}.webp', q=84)
            meta['sprites'][ids[i]] = [sp.width, sp.height]
    if have('reaper.png'):
        sp = shrink(trim(cutout(op('reaper.png'))), SIZE['normal'] + 60)
        save(sp, 'mon/reaper.webp', q=84)
        meta['sprites']['reaper'] = [sp.width, sp.height]
    for k, pair in enumerate(TEX_SHEETS):
        f = f'tex-{k + 1}.png'
        if not have(f):
            print('missing', f); continue
        tiles = list(cells(op(f), 2, 2, inset=0.01))
        for j, s in enumerate(pair):
            save(seamless(tiles[j * 2]).resize((512, 512), Image.BOX), f'tex/{s}-wall.webp', q=80)
            save(seamless(tiles[j * 2 + 1]).resize((512, 512), Image.BOX), f'tex/{s}-floor.webp', q=80)
    for k, ids in enumerate(POR_SHEETS):
        f = f'portraits-{k + 1}.png'
        if not have(f):
            print('missing', f); continue
        for i, cell in enumerate(cells(op(f), 3, 2, inset=0.015)):
            w, h = cell.size
            s = min(w, h)
            sq = cell.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).convert('RGB')
            save(sq.resize((256, 256), Image.BOX), f'por/{ids[i]}.webp', q=84)
    if have('portraits-npc.png'):
        for i, cell in enumerate(cells(op('portraits-npc.png'), 3, 2, inset=0.015)):
            w, h = cell.size
            top = int(h * NPC_CAPTION)
            s = h - top
            x0 = (w - s) // 2
            sq = cell.crop((x0, top, x0 + s, h)).convert('RGB')
            save(sq.resize((320, 320), Image.BOX), f'por/{NPCS[i]}.webp', q=84)
    for k, ids in enumerate(BG_SHEETS):
        f = f'bgs-{k + 1}.png'
        if not have(f):
            print('missing', f); continue
        for i, cell in enumerate(cells(op(f), 2, 2, inset=BG_MARGIN[f[:-4]])):
            save(cell.convert('RGB').resize((1280, 720), Image.BOX), f'bg/{ids[i]}.webp', q=78)
    if have('bg-title.png'):
        save(op('bg-title.png').convert('RGB').resize((1600, 900), Image.BOX), 'bg/title.webp', q=80)
    for s in ICON_SHEETS:
        f = f'icons-{s}.png'
        if not have(f):
            print('missing', f); continue
        n = SIZE['icon']
        atlas = Image.new('RGBA', (n * 4, n * 4), (0, 0, 0, 0))
        for i, (cell, _) in enumerate(grid_cells(op(f), 4, 4)):
            ic = shrink(trim(cutout(cell)), n - 4)
            atlas.paste(ic, ((i % 4) * n + (n - ic.width) // 2, (i // 4) * n + (n - ic.height) // 2), ic)
        save(atlas, f'icons/{s}.webp', q=88)
    with open(os.path.join(OUT, 'sprites.json'), 'w') as fh:
        json.dump(meta, fh, indent=0, sort_keys=True)
    print('wrote', OUT)


if __name__ == '__main__':
    main(sys.argv[1])
