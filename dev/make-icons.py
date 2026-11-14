#!/usr/bin/env python3
"""make-icons.py - write each game's icons from its painted fal icon.

Every game has a square icon painted with fal (fal-ai/nano-banana-2). The
subject for each game and the shared style prompt are in dev/game-icons.json.
The painting is kept in the game's own folder as icons/icon-512.png, and this
script derives every other size from it, so the icons travel with the game
(itch.io zips, copies):

    icons/icon-512.png   install icon (manifest, "any" and "maskable")
    icons/icon-192.png   install icon, and the high-resolution favicon
    icons/icon-180.png   iOS home screen (apple-touch-icon)
    icons/icon-96.png    the game's icon in the launchers (Garden, classic list, Pocket Garden)
    icons/favicon-32.png the browser-tab favicon

With --src, the 1024px paintings downloaded from fal (named game-NNN.png) are
first cropped and written to icons/icon-512.png. A painting that came back
with rounded white corners or a white margin is cropped to its full-bleed
square, so the icon fills the maskable safe zone.

A game with no painting yet falls back to the centre square of its Garden
screenshot (garden/img/games/<game>.jpg).

Needs Pillow:  pip install pillow
    python3 dev/make-icons.py --src path/to/fal-paintings
    python3 dev/make-icons.py                     # re-derive sizes from icon-512.png
    ONLY=game-001,game-002 python3 dev/make-icons.py
"""
import argparse
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SIZES = {"icon-512.png": 512, "icon-192.png": 192, "icon-180.png": 180, "icon-96.png": 96, "favicon-32.png": 32}

ap = argparse.ArgumentParser()
ap.add_argument("--src", type=Path, help="folder of fal paintings named game-NNN.png")
args = ap.parse_args()
only = set(os.environ["ONLY"].split(",")) if os.environ.get("ONLY") else None


def is_margin(px, bg):
    # near the corner colour, and pale: the white (or light grey) the model sometimes paints around the art
    return sum(px[:3]) > 600 and max(abs(a - b) for a, b in zip(px[:3], bg[:3])) < 40


def full_bleed(im):
    """Crop away a white margin or rounded white corners so the art reaches every edge."""
    im = im.convert("RGB")
    n = min(im.size)
    im = im.crop(((im.width - n) // 2, (im.height - n) // 2, (im.width + n) // 2, (im.height + n) // 2))
    px = im.load()
    corners = [(1, 1, 1, 1), (n - 2, 1, -1, 1), (1, n - 2, 1, -1), (n - 2, n - 2, -1, -1)]
    # only a near-white corner is a margin; a pale painted background (game-017's coral) is art
    pale = [px[x, y] for x, y, _, _ in corners if min(px[x, y][:3]) > 235]
    if not pale:
        return im
    # Rounded corners: walk in from each pale corner along the diagonal until the art starts.
    k = 0
    for x, y, dx, dy in corners:
        bg = px[x, y]
        if bg not in pale:
            continue
        t = 0
        while t < n // 5 and is_margin(px[x + dx * t, y + dy * t], bg):
            t += 1
        k = max(k, t)
    # A frame all the way round: the first ring in from the edge that is (almost) free of the margin colour.
    bg, step = pale[0], max(1, n // 256)
    for ring_k in range(0, n // 3, step):
        ring = []
        for t in range(ring_k, n - ring_k, step):
            ring += [px[t, ring_k], px[t, n - 1 - ring_k], px[ring_k, t], px[n - 1 - ring_k, t]]
        if sum(is_margin(p, bg) for p in ring) / len(ring) < 0.002:
            k = max(k, ring_k)
            break
    if not k:
        return im
    k += n // 128  # a little more, past the anti-aliased edge of the frame
    return im.crop((k, k, n - k, n - k))


def save(img, path, size):
    small = img.resize((size, size), Image.LANCZOS)
    if size >= 96:
        # a 256-colour palette with dithering keeps a painted icon small and free of banding
        small = small.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
    small.save(path, optimize=True)


made = 0
for folder in sorted(ROOT.glob("game-*")):
    game = folder.name
    if not folder.is_dir() or (only and game not in only) or not (folder / "index.html").exists():
        continue
    out = folder / "icons"
    out.mkdir(exist_ok=True)
    painted = args.src / f"{game}.png" if args.src else None
    if painted and painted.exists():
        master = full_bleed(Image.open(painted))
        save(master, out / "icon-512.png", 512)
    elif (out / "icon-512.png").exists():
        master = Image.open(out / "icon-512.png").convert("RGB")
    else:
        shot = ROOT / "garden" / "img" / "games" / f"{game}.jpg"
        if not shot.exists():
            print(f"skip {game}: no painting, icon or screenshot", file=sys.stderr)
            continue
        master = full_bleed(Image.open(shot))
        save(master, out / "icon-512.png", 512)
    for name, size in SIZES.items():
        if name != "icon-512.png":
            save(master, out / name, size)
    made += 1
print(f"{made} games' icons written", file=sys.stderr)
