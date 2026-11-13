#!/usr/bin/env python3
"""make-icons.py - write each game's install icons from its Garden picture.

Takes the centre square of garden/img/games/<game>.jpg (made by
dev/screenshots.mjs) and writes game-NNN/icons/icon-192.png and icon-512.png
(and icon-180.png for the iOS home screen). The icons live inside the game's
own folder so they travel with it (itch.io zips, copies).

Needs Pillow:  pip install pillow
    python3 dev/make-icons.py
    ONLY=game-001,game-002 python3 dev/make-icons.py
"""
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SIZES = (180, 192, 512)
only = set(os.environ["ONLY"].split(",")) if os.environ.get("ONLY") else None

made = 0
for shot in sorted((ROOT / "garden" / "img" / "games").glob("game-*.jpg")):
    game = shot.stem
    if only and game not in only:
        continue
    folder = ROOT / game
    if not folder.is_dir():
        continue
    im = Image.open(shot).convert("RGB")
    w, h = im.size
    side = min(w, h)
    # centre square; maskable icons keep their subject inside the middle 80%
    square = im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
    out = folder / "icons"
    out.mkdir(exist_ok=True)
    for size in SIZES:
        icon = square.resize((size, size), Image.LANCZOS)
        # 256-colour palette keeps a PNG of a screenshot to ~100 KB
        icon.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(
            out / f"icon-{size}.png", optimize=True)
    made += 1
print(f"{made} games' icons written", file=sys.stderr)
