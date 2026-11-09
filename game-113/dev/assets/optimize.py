#!/usr/bin/env python3
"""Shrink the PNGs under assets/: quantise to a 256-colour palette (alpha kept) where that makes the file smaller.
usage: python3 -I dev/assets/optimize.py"""
import os
from PIL import Image
ASSETS = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets'))
before = after = 0
for root, _, files in os.walk(ASSETS):
    for fn in files:
        if not fn.endswith('.png'): continue
        p = os.path.join(root, fn); b = os.path.getsize(p); before += b
        im = Image.open(p).convert('RGBA')
        q = im.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        tmp = p + '.tmp'; q.save(tmp, format='PNG', optimize=True)
        if os.path.getsize(tmp) < b: os.replace(tmp, p)
        else: os.remove(tmp)
        after += os.path.getsize(p)
print(f'{before / 1e6:.1f} MB -> {after / 1e6:.1f} MB')
