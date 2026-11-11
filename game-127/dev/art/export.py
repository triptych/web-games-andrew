#!/usr/bin/env python3
"""The First Dragon Prince art pipeline: raw fal renders -> game-127/art/*.webp. Needs Pillow and numpy.

    python3 -I game-127/dev/art/export.py RAW_DIR [names...]

RAW_DIR holds the renders named as in dev/art/README.md: sheet-<who>.png (character sheets on magenta),
bg-<id>.png, cg-<id>.png, act-<id>.png, foe-<region>-<n|boss>.png, title.png. With names, only those raw files are exported.

Character sheets are keyed out (soft chroma key: the background connected to the border, measured from the border
colour, with a despill on the edge), split into the figures they hold left to right, trimmed and scaled to a fixed
height. Backgrounds, CGs and vignettes are resized and written as WebP.
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'art'))

# Which portrait each figure on a sheet becomes, left to right.
SHEETS = {
    'cael-child': ['cael-child-neutral', 'cael-child-happy', 'cael-child-sad', 'cael-child-angry'],
    'cael-teen': ['cael-teen-neutral', 'cael-teen-happy', 'cael-teen-sad', 'cael-teen-angry'],
    'cael-adult': ['cael-adult-neutral', 'cael-adult-happy', 'cael-adult-sad', 'cael-adult-angry'],
    'isolde': ['isolde-child', 'isolde-adult', 'isolde-adult-happy'],
    'rowan': ['rowan-child', 'rowan-adult', 'rowan-adult-happy'],
    'pip': ['pip-child', 'pip-adult', 'pip-adult-happy'],
    'theo': ['theo-child', 'theo-adult', 'theo-adult-happy'],
    'saffi': ['saffi-child', 'saffi-adult', 'saffi-adult-happy'],
    'lumi': ['lumi-child', 'lumi-adult', 'lumi-adult-happy'],
    'npc-a': ['king', 'duke', 'brannoc', 'hobb'],
    'npc-b': ['velis', 'ilsabet', 'coralie', 'orsolo'],
    'npc-c': ['vey', 'ysolde', 'ashkar'],
}
POR_H = 960          # portrait height in pixels
FOE_MAX = 720        # expedition creatures: longest side in pixels
SIZES = {'bg': (1280, 720), 'cg': (1280, 720), 'act': (960, 540), 'title': (1600, 900)}
QUALITY = {'bg': 78, 'cg': 80, 'act': 76, 'title': 82, 'por': 84, 'foe': 84}


def border_key(a):
    b = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).astype(np.float32)
    return np.median(b, axis=0)


def flood_border(mask):
    """Pixels of `mask` connected to the image border (4-connected), by BFS."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if mask[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if mask[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True; q.append((yy, xx))
    return seen


def keyed(img, lo=34.0, hi=104.0):
    """RGBA with the flat key-colour background removed (soft edge, despilled)."""
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    # the key drifts across a gradient background: estimate it per pixel from a heavily blurred border-only image
    k = border_key(a)
    d = np.sqrt(((a - k) ** 2).sum(-1))
    # magenta-ness: red and blue well above green
    mag = np.minimum(a[..., 0], a[..., 2]) - a[..., 1]
    keyish = (d < hi) | ((mag > 90) & (a[..., 1] < 140))
    # a sheet sometimes has a second, darker band of key colour along the floor: key the corner colours too
    for patch in (a[-10:, :24], a[-10:, -24:]):
        k2 = np.median(patch.reshape(-1, 3), axis=0)
        if np.sqrt(((k2 - k) ** 2).sum()) > 30 and min(k2[0], k2[2]) - k2[1] > 30:
            d2 = np.sqrt(((a - k2) ** 2).sum(-1))
            keyish |= d2 < 40
            d = np.minimum(d, d2 * (hi / 40))
    # flood fill at quarter resolution, then bring the result back up
    s = 4
    small = keyish[::s, ::s]
    bg_small = flood_border(small)
    bg = np.repeat(np.repeat(bg_small, s, 0), s, 1)[:h, :w] & keyish
    alpha = np.clip((d - lo) / (hi - lo), 0, 1)
    alpha = np.where(bg, alpha, 1.0)
    # enclosed pockets of key colour (inside a looped tail, between an arm and a staff) are not reached by the
    # flood fill: anything strongly magenta and close to the key goes too, with the same soft ramp
    pocket = ~bg & (mag > 80) & (d < hi * 0.95)
    alpha = np.where(pocket, np.clip((d - lo) / (hi - lo), 0, 1), alpha)
    alpha = np.where(mag > 135, 0.0, alpha)
    # some sheets come back with thin white divider lines between the figures: drop near-white full-height columns
    white = (a.min(-1) > 225)
    colw = white.mean(0) > 0.85
    for x in np.nonzero(colw)[0]:
        alpha[:, max(0, x - 2):x + 3] = 0
    # despill: unmix the key from partly transparent pixels, then pull any leftover magenta cast toward neutral
    al = alpha[..., None]
    rgb = np.where(al > 0.03, (a - (1 - al) * k) / np.maximum(al, 0.03), 0)
    nb = bg | (alpha < 0.5)
    edge = (alpha < 0.999) | np.pad(nb, 2, mode='edge')[4:, 4:][:h, :w] | np.pad(nb, 2, mode='edge')[:-4, :-4][:h, :w]
    g = rgb[..., 1]
    cast = np.minimum(rgb[..., 0], rgb[..., 2]) - g
    fix = edge & (cast > 10)
    rgb[..., 0] = np.where(fix, rgb[..., 0] - (cast - 10) * 0.85, rgb[..., 0])
    rgb[..., 2] = np.where(fix, rgb[..., 2] - (cast - 10) * 0.85, rgb[..., 2])
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def figures(rgba, n):
    """Split a keyed sheet into n figures, left to right: columns separated by the emptiest vertical lines."""
    al = np.asarray(rgba)[..., 3] > 40
    h, w = al.shape
    col = al.sum(0).astype(np.float32)
    # smooth the column profile, then find the n-1 deepest valleys near the even split points
    kern = np.ones(15) / 15
    sm = np.convolve(col, kern, mode='same')
    cuts = []
    for i in range(1, n):
        c = int(w * i / n)
        lo, hi = max(0, c - w // (2 * n)), min(w, c + w // (2 * n))
        cuts.append(lo + int(np.argmin(sm[lo:hi])))
    edges = [0] + cuts + [w]
    out = []
    for i in range(n):
        part = rgba.crop((edges[i], 0, edges[i + 1], h))
        bb = part.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
        out.append(part.crop(bb) if bb else part)
    return out


def finish_foe(im, key, feather=40):
    """Two extra passes for expedition creatures, whose steam, mist, sparks and glows are semi-transparent.

    The model paints a see-through part as subject blended with the magenta behind it, which the keyer leaves
    opaque and pink (lilac steam, pink fringes on wisps). Any pixel whose hue is near the key's is unmixed: with
    the key K and a neutral subject colour v, a pixel is a*v + (1-a)*K, so the key's share 1-a is the pixel's
    magenta cast (min(r, b) - g) over the key's own cast. Its alpha drops by that share and its colour becomes
    the neutral v = g / a. Pinks far from the key's hue (coral, flesh) are left alone. Then the alpha fades out
    near the frame, so a subject the model let run off the image (an avalanche) ends in a soft edge.
    """
    a = np.asarray(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3] / 255
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    kcast = max(1.0, min(key[0], key[2]) - key[1])
    cast = np.minimum(r, b) - g
    near = (cast > 10) & (np.abs(r - b) < 0.35 * np.maximum(r, b))
    share = np.where(near, np.clip(cast / kcast, 0, 0.98), 0)
    keep = 1 - share
    v = np.where(near, np.clip(g / np.maximum(keep, 0.05), 0, 255), 0)
    for c in range(3):
        rgb[..., c] = np.where(near, v, rgb[..., c])
    al = al * keep
    h, w = al.shape
    ys = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None]
    xs = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :]
    al = al * np.clip(np.minimum(ys, xs) / feather, 0, 1)
    out = np.dstack([np.clip(rgb, 0, 255), al * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')


def save_portrait(im, name):
    w, h = im.size
    nh = POR_H
    nw = max(1, round(w * nh / h))
    im = im.resize((nw, nh), Image.LANCZOS)
    os.makedirs(os.path.join(OUT, 'por'), exist_ok=True)
    im.save(os.path.join(OUT, 'por', name + '.webp'), 'WEBP', quality=QUALITY['por'], method=4)


def fit(im, size):
    """Cover-crop to the target aspect, then resize."""
    tw, th = size
    w, h = im.size
    r = max(tw / w, th / h)
    im = im.resize((round(w * r), round(h * r)), Image.LANCZOS)
    w, h = im.size
    x, y = (w - tw) // 2, (h - th) // 2
    return im.crop((x, y, x + tw, y + th))


def main(raw, only):
    files = sorted(f for f in os.listdir(raw) if f.endswith('.png'))
    for f in files:
        name = f[:-4]
        if only and name not in only:
            continue
        src = Image.open(os.path.join(raw, f))
        if name.startswith('sheet-'):
            who = name[6:]
            if who not in SHEETS:
                continue
            figs = figures(keyed(src), len(SHEETS[who]))
            for im, por in zip(figs, SHEETS[who]):
                save_portrait(im, por)
            print('sheet', who, [im.size for im in figs])
        elif name.startswith('foe-'):
            # an expedition creature: one subject on magenta, keyed, trimmed to its figure, longest side FOE_MAX
            im = finish_foe(keyed(src), border_key(np.asarray(src.convert('RGB')).astype(np.float32)))
            bb = im.getchannel('A').point(lambda v: 255 if v > 40 else 0).getbbox()
            if bb:
                pad = 6
                im = im.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(im.width, bb[2] + pad), min(im.height, bb[3] + pad)))
            r = FOE_MAX / max(im.size)
            if r < 1:
                im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
            os.makedirs(os.path.join(OUT, 'foe'), exist_ok=True)
            im.save(os.path.join(OUT, 'foe', name[4:] + '.webp'), 'WEBP', quality=QUALITY['foe'], method=4)
            print('foe', name[4:], im.size)
        elif name == 'title':
            os.makedirs(OUT, exist_ok=True)
            fit(src.convert('RGB'), SIZES['title']).save(os.path.join(OUT, 'title.webp'), 'WEBP', quality=QUALITY['title'], method=4)
            print('title')
        else:
            kind, _, ident = name.partition('-')
            if kind not in SIZES:
                continue
            os.makedirs(os.path.join(OUT, kind), exist_ok=True)
            fit(src.convert('RGB'), SIZES[kind]).save(os.path.join(OUT, kind, ident + '.webp'), 'WEBP', quality=QUALITY[kind], method=4)
            print(kind, ident)


if __name__ == '__main__':
    main(sys.argv[1], set(sys.argv[2:]))
