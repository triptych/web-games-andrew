#!/usr/bin/env python3
"""Raw fal renders -> game-140/art/.   python3 -I game-140/dev/art/export.py RAW_DIR [names...]

RAW_DIR holds bg-<id>.png, cg-<id>.png, por-<id>.png and title.png (see prompts.mjs).
  bg, cg  cover-cropped to 16:9, 1280x720 WebP (q80)
  title   1600x900 WebP
  por     keyed out of their magenta background, trimmed, 900 px tall WebP with alpha.
          The key colour is the median of the border (the model paints #d040c0-ish, not #ff00ff). Each pixel's
          alpha comes from its distance to the key in RGB, with a soft ramp, and a pixel that is part key is
          "unmixed" (the key's share is removed from its colour), so hair and rim light keep clean edges instead of a
          pink fringe. Only regions connected to the border are keyed, so nothing inside a figure is punched out.
          The Codex is painted on black and drawn with additive light, so it is exported without keying.
Needs Pillow and numpy.
"""
import os, sys
import numpy as np
from PIL import Image
from collections import deque

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.normpath(os.path.join(HERE, '..', '..', 'art'))
NO_KEY = {'codex'}

def cover(im, w, h):
    sw, sh = im.size
    s = max(w / sw, h / sh)
    im = im.resize((round(sw * s), round(sh * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))

def key_out(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    H, W, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    key = np.median(border, axis=0)
    d = np.sqrt(((a - key) ** 2).sum(axis=2))
    lo, hi = 30.0, 90.0
    alpha = np.clip((d - lo) / (hi - lo), 0, 1)
    # only key the background connected to the border: flood from the edges through near-key pixels
    near = d < hi
    seen = np.zeros((H, W), bool)
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if near[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if near[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and near[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    # pockets of background enclosed by the figure (between an arm and the body): key only the strongly-key pixels
    pocket = np.clip((d - lo) / 25.0, 0, 1)
    alpha = np.where(seen, alpha, np.where(d < lo + 25, pocket, 1.0))
    # unmix: c = a*fg + (1-a)*key  ->  fg = (c - (1-a)*key) / a
    am = np.maximum(alpha, 0.05)[..., None]
    fg = np.clip((a - (1 - am) * key) / am, 0, 255)
    # despill: near any keyed pixel, pull the magenta cast (red and blue both above green) back to neutral
    keyed = alpha < 0.99
    edge = keyed.copy()
    for _ in range(3):
        e = edge.copy()
        e[1:] |= edge[:-1]; e[:-1] |= edge[1:]; e[:, 1:] |= edge[:, :-1]; e[:, :-1] |= edge[:, 1:]
        edge = e
    m = np.minimum(fg[..., 0], fg[..., 2])
    spill = np.where(edge, np.clip(m - fg[..., 1], 0, None) * 0.75, 0)
    fg[..., 0] -= spill; fg[..., 2] -= spill
    rgba = np.dstack([fg, alpha * 255]).astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    bbox = out.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    return out.crop(bbox) if bbox else out

def main():
    raw = sys.argv[1]
    only = set(sys.argv[2:])
    for d in ('bg', 'cg', 'por'): os.makedirs(os.path.join(ART, d), exist_ok=True)
    for f in sorted(os.listdir(raw)):
        if not f.endswith('.png'): continue
        name = f[:-4]
        if only and name not in only: continue
        im = Image.open(os.path.join(raw, f))
        if name == 'title':
            cover(im.convert('RGB'), 1600, 900).save(os.path.join(ART, 'title.webp'), quality=82, method=6)
        elif name.startswith(('bg-', 'cg-')):
            kind, id_ = name[:2], name[3:]
            cover(im.convert('RGB'), 1280, 720).save(os.path.join(ART, kind, id_ + '.webp'), quality=80, method=6)
        elif name.startswith('por-'):
            id_ = name[4:]
            out = im.convert('RGB') if id_ in NO_KEY else key_out(im)
            s = 900 / out.height
            out = out.resize((round(out.width * s), 900), Image.LANCZOS)
            out.save(os.path.join(ART, 'por', id_ + '.webp'), quality=82, method=6)
        else:
            continue
        print('ok', name)

if __name__ == '__main__':
    main()
