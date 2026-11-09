#!/usr/bin/env python3
"""Cut a generated sprite out of its magenta (#ff00ff) key background.

usage: cutout.py in.png out.png [--max N] [--pad N]
Keys by distance to magenta with a soft edge, removes magenta fringing (despill), crops to the opaque
bounding box plus padding, and scales so the longest side is at most --max pixels. Run with `python3 -I`.
"""
import sys, numpy as np
from PIL import Image

def key_magenta(img):
    a = np.asarray(img.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # magenta-ness: red and blue high, green low
    m = np.minimum(r, b) - g
    alpha = np.clip(1.0 - (m - 40.0) / 90.0, 0.0, 1.0)
    # despill: pull red/blue down toward green where the pixel is partly magenta
    spill = np.clip(m, 0, None) * (alpha < 1.0)
    r2 = r - spill * 0.8; b2 = b - spill * 0.8
    out = np.stack([np.clip(r2, 0, 255), g, np.clip(b2, 0, 255), alpha * 255.0], axis=-1).astype(np.uint8)
    return Image.fromarray(out, 'RGBA')

def crop_to_alpha(img, pad=2, thresh=24):
    al = np.asarray(img)[..., 3]
    ys, xs = np.where(al > thresh)
    if len(xs) == 0: return img
    x0, x1, y0, y1 = max(xs.min() - pad, 0), min(xs.max() + 1 + pad, img.width), max(ys.min() - pad, 0), min(ys.max() + 1 + pad, img.height)
    return img.crop((x0, y0, x1, y1))

def main():
    args = sys.argv[1:]
    src, dst = args[0], args[1]
    mx = int(args[args.index('--max') + 1]) if '--max' in args else 256
    pad = int(args[args.index('--pad') + 1]) if '--pad' in args else 2
    img = crop_to_alpha(key_magenta(Image.open(src)), pad)
    s = min(1.0, mx / max(img.size))
    if s < 1.0: img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    img.save(dst, optimize=True)
    print(dst, img.size)

if __name__ == '__main__':
    main()
