#!/usr/bin/env python3
"""JINGLE POP art pipeline: raw ElevenLabs image renders -> game-146/art/*.webp (Pillow + numpy).

    python3 -I game-146/dev/art/export.py RAW_DIR

RAW_DIR holds the renders named as in dev/art/README.md. Sprites were rendered on a flat key colour (magenta, or
green for Grimwick); the key is measured from the image border, the background connected to the border is removed by
region growing, edge pixels are despilled, and the figure is trimmed and scaled down. The power-up sheet is a 3x3 grid:
each cell is cut out the same way and saved as its own icon.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'art'))
BGS = ['workshop', 'gingerbread', 'candy', 'pond', 'ridge', 'hoard']
ICONS = ['candy', 'bomb', 'star', 'bell', 'tinsel', 'cocoa', 'north', 'cookie', 'gift']   # sheet order, row by row
SPRITES = {'elf-base': ('elf', 420), 'elf-cheer': ('elf-cheer', 420), 'elf-sad': ('elf-sad', 420), 'grimwick-sprite': ('grimwick', 360)}


def key_out(im, thr=95):
    a = np.asarray(im.convert('RGB')).astype(np.int32)
    h, w, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    key = np.median(border, axis=0)
    dist = np.sqrt(((a - key) ** 2).sum(axis=2))
    near = dist < thr
    reach = np.zeros_like(near)
    reach[0], reach[-1], reach[:, 0], reach[:, -1] = near[0], near[-1], near[:, 0], near[:, -1]
    while True:
        grown = reach.copy()
        grown[1:] |= reach[:-1]; grown[:-1] |= reach[1:]; grown[:, 1:] |= reach[:, :-1]; grown[:, :-1] |= reach[:, 1:]
        grown &= near
        if (grown == reach).all():
            break
        reach = grown
    # enclosed pockets of almost exactly the key colour (inside a coil, a mug handle) go too
    reach |= dist < 60
    alpha = np.where(reach, 0, 255).astype(np.uint8)
    # despill a band at the edge: pull the key's dominant channels back towards the others
    edge = np.asarray(Image.fromarray(alpha).filter(ImageFilter.MinFilter(7))) < 255
    rgb = a.copy()
    if key[1] > key[0] and key[1] > key[2]:                  # green key
        lim = np.maximum(rgb[..., 0], rgb[..., 2])
        rgb[..., 1] = np.where(edge, np.minimum(rgb[..., 1], lim), rgb[..., 1])
    else:                                                    # magenta key
        ex = np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1]
        ex = np.where(edge & (ex > 0), ex, 0)
        rgb[..., 0] -= (ex * 0.85).astype(np.int32)
        rgb[..., 2] -= (ex * 0.85).astype(np.int32)
    alpha_im = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    out = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).convert('RGBA')
    out.putalpha(alpha_im)
    return out.crop(out.getbbox())


def fit(im, longest):
    im = im.copy()
    im.thumbnail((longest, longest), Image.LANCZOS)
    return im


def main(raw):
    os.makedirs(OUT, exist_ok=True)
    p = lambda n: os.path.join(raw, n + '.png')
    save = lambda im, name, q=82: im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=q, method=6)
    title = Image.open(p('title')).convert('RGB')
    save(fit(title, 1920), 'title', 80)
    for b in BGS:
        save(fit(Image.open(p('bg-' + b)).convert('RGB'), 1376), 'bg-' + b, 78)
    save(fit(Image.open(p('ending')).convert('RGB'), 1376), 'ending', 80)
    for n in ['juni', 'holly', 'grimwick']:
        save(fit(Image.open(p('por-' + n)).convert('RGB'), 320), 'por-' + n, 82)
    for src, (name, size) in SPRITES.items():
        if os.path.exists(p(src)):
            save(fit(key_out(Image.open(p(src))), size), name, 88)
        else:
            print('missing', src)
    sheet = Image.open(p('icons-sheet')).convert('RGB')
    W, H = sheet.size
    for i, name in enumerate(ICONS):
        cx, cy = i % 3, i // 3
        cell = sheet.crop((cx * W // 3, cy * H // 3, (cx + 1) * W // 3, (cy + 1) * H // 3))
        save(fit(key_out(cell), 128), 'icon-' + name, 88)
    print('wrote', OUT, len(os.listdir(OUT)), 'files')


if __name__ == '__main__':
    main(sys.argv[1])
