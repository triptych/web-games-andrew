#!/usr/bin/env python3
"""Shared helpers for turning generated renders into game sprites. Python 3 with Pillow and numpy only (no scipy);
run scripts with `python3 -I`.

Everything is rendered on a flat magenta background, but the model does not hold the exact colour: some sheets come back
with a salmon, orchid or lavender wash. So the key colour is measured from the image border, and only background that is
connected to the border (or, on pure magenta, a big enclosed gap) is removed. A lavender sprite with a dark outline
therefore survives a lavender background.
"""
from collections import deque
import numpy as np
from PIL import Image, ImageFilter


def label(mask):
    """4-connected labelling of a small boolean array. Returns (labels, count)."""
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    n = 0
    for y0 in range(h):
        for x0 in range(w):
            if mask[y0, x0] and not lab[y0, x0]:
                n += 1
                lab[y0, x0] = n
                q = deque([(y0, x0)])
                while q:
                    y, x = q.popleft()
                    for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                        if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n
                            q.append((yy, xx))
    return lab, n


def _dilate(mask, px):
    im = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2 * px + 1))
    return np.asarray(im) > 0


def _key_magenta(a, bg, mbg):
    """Key for a (near) pure magenta background. How magenta a pixel is says how much background shows through it. Only
    pixels that are mostly background go (the model's ghosting and smears are exactly that); this game's own palette is full
    of purples and pinks, so anything less magenta than that keeps its colour untouched. Edge pixels are un-mixed from the
    background so no pink fringe is left."""
    m = np.clip(np.minimum(a[..., 0], a[..., 2]) - a[..., 1], 0, None) / mbg
    alpha = np.clip((0.74 - m) / 0.2, 0.0, 1.0)
    edge = (alpha < 1.0) & (alpha > 0.0)
    k = np.clip(m, 0, 0.95)[..., None]
    un = np.clip((a - k * bg) / (1 - k), 0, 255)
    rgb = np.where(edge[..., None], un, a)
    return Image.fromarray(np.dstack([rgb, alpha * 255.0]).astype(np.uint8), 'RGBA')


def key_background(img):
    """RGBA with the background made transparent (soft edges, despilled)."""
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    ring = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    bg = np.median(ring, axis=0)
    mbg = min(bg[0], bg[2]) - bg[1]
    if mbg >= 150:
        return _key_magenta(a, bg, mbg)
    pure = False
    T = 30.0
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    m = d < T
    f = 4
    hh, ww = h // f, w // f
    blk = m[:hh * f, :ww * f].reshape(hh, f, ww, f).mean(axis=(1, 3)) > 0.5
    lab, n = label(blk)
    keep = np.zeros(n + 1, bool)
    border = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    areas = np.bincount(lab.ravel(), minlength=n + 1)
    for i in range(1, n + 1):
        if i in border or (pure and areas[i] >= 40):
            keep[i] = True
    big = keep[lab]
    big = np.kron(big, np.ones((f, f), bool))
    full = np.zeros((h, w), bool)
    full[:big.shape[0], :big.shape[1]] = big
    full[big.shape[0]:, :] = full[big.shape[0] - 1:big.shape[0], :]
    full[:, big.shape[1]:] = full[:, big.shape[1] - 1:big.shape[1]]
    bgmask = m & _dilate(full, f)
    alpha = np.where(bgmask, 0.0, 1.0)
    band = _dilate(bgmask, 3) & ~bgmask
    soft = np.clip((d - T * 0.45) / (T * 1.3), 0.0, 1.0)
    alpha = np.where(band, np.minimum(alpha, soft), alpha)
    al = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.where(band[..., None], (a - (1 - al) * bg) / al, a)
    rgb = np.clip(rgb, 0, 255)
    return Image.fromarray(np.dstack([rgb, alpha * 255.0]).astype(np.uint8), 'RGBA')


def main_figure(img, keep=0.03, join=6):
    """Drop floating specks: keep the largest blob and any blob at least `keep` of its size."""
    al = np.asarray(img)[..., 3] > 40
    f = 4
    h, w = al.shape
    hh, ww = h // f, w // f
    if hh < 2 or ww < 2:
        return img
    blk = al[:hh * f, :ww * f].reshape(hh, f, ww, f).any(axis=(1, 3))
    lab, n = label(_dilate(blk, join // 2 + 1))
    if n <= 1:
        return img
    areas = np.bincount(lab[blk], minlength=n + 1)
    areas[0] = 0
    big = areas.max()
    ok = areas >= big * keep
    ok[0] = False
    mask = np.kron(ok[lab], np.ones((f, f), bool))
    full = np.zeros((h, w), bool)
    full[:mask.shape[0], :mask.shape[1]] = mask
    full = _dilate(full, f)
    arr = np.asarray(img).copy()
    arr[..., 3] = np.where(full, arr[..., 3], 0)
    return Image.fromarray(arr, 'RGBA')


def bbox(img, thresh=24):
    al = np.asarray(img)[..., 3]
    ys, xs = np.where(al > thresh)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def crop_to_alpha(img, pad=1):
    b = bbox(img)
    if not b:
        return img
    x0, y0, x1, y1 = b
    return img.crop((max(x0 - pad, 0), max(y0 - pad, 0), min(x1 + pad, img.width), min(y1 + pad, img.height)))


def split_columns(img, n, min_gap=10):
    """Cut a keyed sheet into n figures side by side, at the empty gaps between them. Returns a list of RGBA crops."""
    al = (np.asarray(img)[..., 3] > 40).any(axis=0)
    runs = []
    start = None
    for i, v in enumerate(list(al) + [False]):
        if v and start is None:
            start = i
        if not v and start is not None:
            runs.append([start, i])
            start = None
    # specks at the very edge or in a gap are not figures
    runs = [r for r in runs if r[1] - r[0] >= img.width * 0.012]
    # close small gaps, then drop slivers, until n remain
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < min_gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    while len(merged) > n:
        gaps = [merged[i + 1][0] - merged[i][1] for i in range(len(merged) - 1)]
        widths = [r[1] - r[0] for r in merged]
        if min(widths) < img.width * 0.02:
            i = widths.index(min(widths))
            merged.pop(i)
        else:
            i = gaps.index(min(gaps))
            merged[i][1] = merged[i + 1][1]
            merged.pop(i + 1)
    prof = (np.asarray(img)[..., 3] > 40).sum(axis=0)
    while len(merged) < n and merged:
        # a run that holds two figures (touching specks, a smeared gap): cut it at the thinnest column near its middle
        i = max(range(len(merged)), key=lambda j: merged[j][1] - merged[j][0])
        a, b = merged[i]
        k = 2
        mid = a + (b - a) / 2
        win = max(8, int((b - a) * 0.2))
        lo, hi = int(mid - win), int(mid + win)
        cut = lo + int(np.argmin(prof[lo:hi])) if hi > lo else int(mid)
        print(f'  note: split a merged run {a}-{b} at {cut}')
        merged[i:i + 1] = [[a, cut], [cut, b]]
    if len(merged) < n:
        print('  warning: found', len(merged), 'figures, wanted', n, '- cutting evenly')
        merged = [[round(i * img.width / n), round((i + 1) * img.width / n)] for i in range(n)]
    return [img.crop((a, 0, b, img.height)) for a, b in merged]


def fit(img, bw, bh, scale=None, fill=0.96, align='bottom'):
    """Place a cropped RGBA figure in a bw x bh box, scaled to fit (or by `scale`), centred, feet on the bottom (or centred)."""
    if scale is None:
        scale = min(bw * fill / img.width, bh * fill / img.height)
    im = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    box = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
    y = bh - im.height - round(bh * 0.02) if align == 'bottom' else (bh - im.height) // 2
    box.paste(im, ((bw - im.width) // 2, y), im)
    return box
