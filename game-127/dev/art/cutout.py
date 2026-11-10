"""Soft chroma-key for painted sprites on a flat magenta (or green) background.

The key colour is measured from the border. Background connected to the border is found by a flood fill on a
coarse "is key-ish" mask; alpha is then a soft ramp on colour distance to the key (so anti-aliased line art keeps
a smooth edge), and the key colour is subtracted from semi-transparent edge pixels (despill) so no pink fringe stays.
"""
import numpy as np
from PIL import Image



def key_of(a):
    b = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).astype(np.float32)
    return np.median(b, axis=0)


def cutout(img, lo=38.0, hi=110.0):
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    k = key_of(a)
    d = np.sqrt(((a - k) ** 2).sum(-1))
    # chroma-aware: magenta key -> green channel low, red & blue high. Use distance plus a "keyness" check.
    keyish = d < hi
    # flood fill from the border through keyish pixels
    from collections import deque
    h, w = keyish.shape
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if keyish[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if keyish[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= yy < h and 0 <= xx < w and keyish[yy, xx] and not bg[yy, xx]:
                bg[yy, xx] = True; q.append((yy, xx))
    alpha = np.clip((d - lo) / (hi - lo), 0, 1)
    alpha = np.where(bg, alpha, 1.0)
    # enclosed pockets that are almost exactly the key go too
    alpha = np.where(d < lo * 0.8, 0.0, alpha)
    # despill: remove the key's contribution from partially transparent pixels
    al = alpha[..., None]
    rgb = np.where(al > 0.02, (a - (1 - al) * k) / np.maximum(al, 0.02), 0)
    # clamp magenta cast on edges: limit R and B to not exceed G by much where alpha < 1
    edge = (alpha < 0.999)[..., None]
    g = rgb[..., 1:2]
    lim = np.concatenate([np.minimum(rgb[..., 0:1], g + 60), g, np.minimum(rgb[..., 2:3], g + 60)], -1)
    rgb = np.where(edge, lim, rgb)
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')
