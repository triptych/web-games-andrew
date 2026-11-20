#!/usr/bin/env python3
"""make-avatars.py - write each game's Messages avatar from its fal painting.

Every game has a character who texts the player in the Pocket Garden's
Messages app (console/js/messages.js). The character, its painting prompt and
its whole message bank live in the game's own folder, in avatar/avatar.json
(see docs/generic/avatars.md); the shared style prompt is dev/avatar-style.json.
This script writes the two pictures beside it:

    avatar/avatar.webp       256 px, the address book, the thread header, friend requests
    avatar/avatar-tiny.webp   64 px, chat bubbles, the inbox, notification banners

With --src, the paintings downloaded from fal (named game-NNN.png, and
garden.png for the Garden's dragonfly) are cropped to a full-bleed square and
written, and avatar.json is marked "art": "fal". A game with no painting yet
gets its painted game icon (icons/icon-512.png) instead, marked "art": "icon",
so every folder is complete and --pending lists what is still to paint.

Needs Pillow (with WebP):  pip install pillow
    python3 dev/make-avatars.py --src path/to/fal-paintings
    python3 dev/make-avatars.py                  # fill in any missing avatars from the icons
    python3 dev/make-avatars.py --pending        # games whose avatar is not painted yet, with their prompts
    ONLY=game-001,garden python3 dev/make-avatars.py --src ...
"""
import argparse
import json
import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SIZES = {"avatar.webp": 256, "avatar-tiny.webp": 64}

ap = argparse.ArgumentParser()
ap.add_argument("--src", type=Path, help="folder of fal paintings named game-NNN.png (and garden.png)")
ap.add_argument("--pending", action="store_true", help="list the avatars still to paint, with their full prompts")
ap.add_argument("--force", action="store_true", help="rewrite icon fallbacks even when the pictures exist")
args = ap.parse_args()
only = set(os.environ["ONLY"].split(",")) if os.environ.get("ONLY") else None
STYLE = json.loads((ROOT / "dev" / "avatar-style.json").read_text())["style"]


def folders():
    for folder in sorted(ROOT.glob("game-*")):
        if folder.is_dir() and (folder / "index.html").exists():
            yield folder.name, folder
    yield "garden", ROOT / "garden"


def square(im):
    im = im.convert("RGB")
    n = min(im.size)
    return im.crop(((im.width - n) // 2, (im.height - n) // 2, (im.width + n) // 2, (im.height + n) // 2))


def save(master, out):
    for name, size in SIZES.items():
        master.resize((size, size), Image.LANCZOS).save(out / name, "WEBP", quality=82 if size > 64 else 86, method=6)


def fallback(name, folder):
    for p in (folder / "icons" / "icon-512.png", ROOT / "console" / "icons" / "icon-512.png"):
        if p.exists():
            return Image.open(p)
    return None


made = painted = 0
for name, folder in folders():
    if only and name not in only:
        continue
    out = folder / "avatar"
    meta_path = out / "avatar.json"
    if not meta_path.exists():
        print(f"skip {name}: no avatar/avatar.json", file=sys.stderr)
        continue
    meta = json.loads(meta_path.read_text())
    if args.pending:
        if meta.get("art") != "fal":
            p = meta["portrait"]
            style = p.get('style') or STYLE  # a character can override the shared style (game-131: Fray is blind, so no "big shiny eyes")
            print(f"{name}\t{style.replace('{subject}', p['subject']).replace('{background}', p['background'])}")
        continue
    src = args.src / f"{name}.png" if args.src else None
    if src and src.exists():
        save(square(Image.open(src)), out)
        meta["art"] = "fal"
        painted += 1
    elif args.force or not all((out / n).exists() for n in SIZES) or meta.get("art") != "fal":
        if meta.get("art") == "fal" and all((out / n).exists() for n in SIZES):
            continue  # painted already; keep it
        im = fallback(name, folder)
        if im is None:
            print(f"skip {name}: no painting and no icon", file=sys.stderr)
            continue
        save(square(im), out)
        meta["art"] = "icon"
    else:
        continue
    meta_path.write_text(json.dumps(meta, indent=1, ensure_ascii=False) + "\n")
    made += 1
if not args.pending:
    print(f"{made} avatars written ({painted} from fal paintings)", file=sys.stderr)
