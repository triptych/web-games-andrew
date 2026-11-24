#!/usr/bin/env python3
"""
make-sprites.py: turn painted turnaround sheets into the Lounge's walking sprites.

Every game's character has a little JRPG overworld sprite beside its avatar
(game-NNN/avatar/sprite.png) for the Pocket Garden Lounge (console/js/lounge.js).
The art is painted with ElevenLabs (recraft-v4.1-flash, 16:9, one generation
each) from the character's portrait.subject, or its own sprite.subject, in
the shared prompt of dev/sprite-style.json: a one-row turnaround of five views
on a flat background (green, or magenta for characters with green in them):
front, three-quarter front right, right profile, three-quarter back, back.
See docs/generic/avatars.md.

This script clears the background with a flood fill from the edges (the dark
outlines stop it, so a green goblin keeps its skin), cuts the inked width into
five slots at the emptiest columns, drops floating specks, scales each figure
to 34 px tall on a shared baseline with a small palette and a dark outline,
and draws a three-frame walk cycle (left step, stand, right step) for each
facing. The sheet is 5 rows (S, SE, E, NE, N) by 3 columns of 32x40 cells;
the Lounge mirrors the right-facing rows for SW, W and NW, so a sprite walks
in all eight directions. It also notes the sprite in the character's
avatar.json ("sprite": {...}).

    python3 dev/make-sprites.py --src path/to/folder     # game-NNN.png / .webp per character
    python3 dev/make-sprites.py --src dir --only game-001
    python3 dev/make-sprites.py --src dir --only game-129 --loose   # figures that touch (a held bowl)
    python3 dev/make-sprites.py --src dir --preview out/  # 4x previews instead of writing
    python3 dev/make-sprites.py --sheet                  # every sprite's stand frames -> dev/sprites-contact.png
    python3 dev/make-sprites.py --pending                # characters with no sprite yet
    python3 dev/make-sprites.py --cast                   # console/lounge-cast.json: who has a sprite, their save keys

A painting that doesn't split into five even figures is reported and
skipped: paint it again (or try --loose).
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CELL_W, CELL_H = 32, 40
FIG_H = 34  # tallest figure, in sprite pixels
ROWS = ["s", "se", "e", "ne", "n"]


def avatar_dirs():
    out = []
    for p in sorted(ROOT.glob("game-*/avatar/avatar.json")):
        out.append((p.parent.parent.name, p.parent))
    g = ROOT / "garden" / "avatar"
    if (g / "avatar.json").exists():
        out.append(("garden", g))
    return out


def key_out(im):
    """Clear the flat background: a flood fill from the edges (the figures' dark outlines stop it),
    then any pocket of the same colour left between an arm and the body."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    border = [px[x, 0] for x in range(0, w, 7)] + [px[x, h - 1] for x in range(0, w, 7)] + [px[0, y] for y in range(0, h, 7)] + [px[w - 1, y] for y in range(0, h, 7)]
    bg = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))

    def dist(c):
        return ((c[0] - bg[0]) ** 2 + (c[1] - bg[1]) ** 2 + (c[2] - bg[2]) ** 2) ** 0.5

    seen = bytearray(w * h)
    stack = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    while stack:
        x, y = stack.pop()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        if dist(px[x, y]) > 95:
            continue
        px[x, y] = (0, 0, 0, 0)
        if x > 0: stack.append((x - 1, y))
        if x < w - 1: stack.append((x + 1, y))
        if y > 0: stack.append((x, y - 1))
        if y < h - 1: stack.append((x, y + 1))
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c[3] and dist(c) < 45:
                px[x, y] = (0, 0, 0, 0)
    return im


def ink_columns(im):
    """How many opaque pixels each x column holds."""
    w, h = im.size
    a = im.getchannel("A").load()
    return [sum(1 for y in range(0, h, 2) if a[x, y]) for x in range(w)]


def main_parts(crop):
    """Drop floating specks (sparkles, a hovering crystal): keep the connected parts of a slot that
    are at least 4% the size of its biggest one. Works on a quarter-size mask, in plain Python."""
    k = 4
    w, h = crop.size
    sw, sh = max(1, w // k), max(1, h // k)
    a = crop.getchannel("A").resize((sw, sh), Image.Resampling.BOX).load()
    lab = [[0] * sw for _ in range(sh)]
    sizes, boxes = [0], [None]
    n = 0
    for y in range(sh):
        for x in range(sw):
            if a[x, y] < 40 or lab[y][x]:
                continue
            n += 1
            sizes.append(0)
            bx = [x, y, x, y]
            st = [(x, y)]
            lab[y][x] = n
            while st:
                cx, cy = st.pop()
                sizes[n] += 1
                bx[0], bx[1], bx[2], bx[3] = min(bx[0], cx), min(bx[1], cy), max(bx[2], cx), max(bx[3], cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1), (cx + 1, cy + 1), (cx - 1, cy - 1), (cx + 1, cy - 1), (cx - 1, cy + 1)):
                    if 0 <= nx < sw and 0 <= ny < sh and not lab[ny][nx] and a[nx, ny] >= 40:
                        lab[ny][nx] = n
                        st.append((nx, ny))
            boxes.append(bx)
    if not n:
        return None
    big = max(sizes[1:])
    keep = [i for i in range(1, n + 1) if sizes[i] >= big * 0.04]
    # clear what isn't kept
    out = crop.copy()
    op = out.load()
    for y in range(h):
        for x in range(w):
            if op[x, y][3]:
                ly, lx = min(sh - 1, y // k), min(sw - 1, x // k)
                if lab[ly][lx] and lab[ly][lx] not in keep:
                    op[x, y] = (0, 0, 0, 0)
    return out


LOOSE = False


def figures(im, want=5):
    """Five evenly spaced figures: cut the inked width into five slots at the emptiest column near
    each expected gap, then keep each slot's main body."""
    w, h = im.size
    ink = ink_columns(im)
    xs = [x for x, v in enumerate(ink) if v]
    if not xs:
        return [], None
    x0, x1 = xs[0], xs[-1] + 1
    slot = (x1 - x0) / want
    cuts = [x0]
    for k in range(1, want):
        e = int(x0 + k * slot)
        r = int(slot * 0.28)
        lo, hi = max(x0, e - r), min(x1, e + r)
        best = min(range(lo, hi), key=lambda x: (ink[x], abs(x - e)))
        cuts.append(best)
    cuts.append(x1)
    boxes, figs = [], []
    for k in range(want):
        crop = im.crop((cuts[k], 0, cuts[k + 1], h))
        crop = main_parts(crop)
        bb = crop.getbbox() if crop else None
        if not bb:
            return boxes, None
        boxes.append((cuts[k] + bb[0], bb[1], cuts[k] + bb[2], bb[3]))
        figs.append(crop.crop(bb))
    hs = sorted(f.height for f in figs)
    med = hs[len(hs) // 2]
    if any(f.height < med * 0.7 or f.height > med * 1.3 for f in figs):
        return boxes, None
    # a gap that had to cut through a figure leaves lots of ink in the cut column
    if not LOOSE and any(ink[c] > h * 0.5 * 0.12 for c in cuts[1:-1]):
        return boxes, None
    return boxes, figs


def quantize(img, colors=24):
    """Flatten a downscaled figure to a small palette with hard alpha, like a hand-made sprite."""
    a = img.getchannel("A").point(lambda v: 255 if v >= 110 else 0)
    rgb = Image.new("RGB", img.size, (0, 0, 0))
    rgb.paste(img, mask=a)
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    out = q.convert("RGBA")
    out.putalpha(a)
    return out


def outline(img, color=(28, 22, 34, 255)):
    """A dark one-pixel outline around the figure, so it reads on any floor."""
    w, h = img.size
    src = img.load()
    out = img.copy()
    dst = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and src[nx, ny][3]:
                    dst[x, y] = color
                    break
    return out


def shift_region(img, box, dx, dy):
    """Move the pixels inside box by (dx, dy), leaving what was under it transparent."""
    part = img.crop(box)
    out = img.copy()
    out.paste((0, 0, 0, 0), box)
    out.alpha_composite(part, (box[0] + dx, box[1] + dy))
    return out


def walk_frames(cell, row):
    """Left step, stand, right step: the legs move, the body bobs a pixel on the stand frame's neighbours."""
    bb = cell.getbbox()
    if not bb:
        return [cell, cell, cell]
    x0, y0, x1, y1 = bb
    legs_top = y1 - max(4, (y1 - y0) * 26 // 100)
    mid = (x0 + x1) // 2
    frames = []
    for side in (-1, 1):
        f = cell.copy()
        if row == "e":
            # side view: the front foot forward, the back foot back
            f = shift_region(f, (x0, legs_top + (y1 - legs_top) // 2, x1, y1), side, 0)
        else:
            # facing (or away from) the viewer: one leg lifts
            lift = (x0, legs_top, mid, y1) if side < 0 else (mid, legs_top, x1, y1)
            f = shift_region(f, lift, 0, -1)
        f = shift_region(f, (0, 0, cell.width, legs_top), 0, 1)
        frames.append(f)
    return [frames[0], cell, frames[1]]


def build_sheet(figs):
    """Five figures, cut from the painting, to a 3x5 walking sheet on a shared scale and baseline."""
    tallest = max(f.height for f in figs)
    scale = FIG_H / tallest
    sheet = Image.new("RGBA", (CELL_W * 3, CELL_H * len(ROWS)), (0, 0, 0, 0))
    for r, (fig, row) in enumerate(zip(figs, ROWS)):
        w = max(1, round(fig.width * scale))
        h = max(1, round(fig.height * scale))
        w = min(w, CELL_W - 2)
        small = fig.resize((w, h), Image.Resampling.LANCZOS if fig.width > 4 * w else Image.Resampling.BOX)
        small = quantize(small)
        cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
        cell.alpha_composite(small, ((CELL_W - w) // 2, CELL_H - 2 - h))
        cell = outline(cell)
        for c, f in enumerate(walk_frames(cell, row)):
            sheet.alpha_composite(f, (c * CELL_W, r * CELL_H))
    return sheet


def process(gid, src, adir, dry=False):
    im = Image.open(src)
    im = key_out(im)
    boxes, figs = figures(im)
    if not figs:
        print(f"  !! {gid}: found {len(boxes)} figures, wanted 5 ({src.name})")
        return False
    sheet = build_sheet(figs)
    if dry:
        return sheet
    sheet.save(adir / "sprite.png", optimize=True)
    meta_p = adir / "avatar.json"
    d = json.loads(meta_p.read_text())
    keep = d.get("sprite", {}).get("subject")
    d["sprite"] = {"art": "elevenlabs", "w": CELL_W, "h": CELL_H, "rows": ROWS, "frames": 3}
    if keep:
        d["sprite"]["subject"] = keep
    meta_p.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print(f"  ok {gid}")
    return True


def cast(out):
    """console/lounge-cast.json: every character with a sprite, and its save keys (so the Lounge can
    tell which games you have saved without loading every avatar.json)."""
    data = {}
    for gid, d in avatar_dirs():
        if gid == "garden" or not (d / "sprite.png").exists():
            continue
        a = json.loads((d / "avatar.json").read_text())
        data[gid] = {"keys": (a.get("save") or {}).get("keys") or []}
    out.write_text(json.dumps(data, separators=(",", ":")) + "\n")
    print(f"wrote {out.relative_to(ROOT)} ({len(data)} characters)")


def contact(out):
    """Every sprite's five stand frames in a grid, two characters to a row, for a look over the lot."""
    dirs = [(g, d) for g, d in avatar_dirs() if (d / "sprite.png").exists()]
    if not dirs:
        print("no sprites yet")
        return
    cw, ch = CELL_W * 5 + 8, CELL_H + 4
    sheet = Image.new("RGBA", (cw * 2, ch * ((len(dirs) + 1) // 2)), (70, 58, 74, 255))
    for i, (gid, d) in enumerate(dirs):
        sp = Image.open(d / "sprite.png").convert("RGBA")
        ox, oy = (i % 2) * cw, (i // 2) * ch
        for r in range(len(ROWS)):
            sheet.alpha_composite(sp.crop((CELL_W, r * CELL_H, 2 * CELL_W, (r + 1) * CELL_H)), (ox + r * CELL_W, oy + 2))
    sheet = sheet.resize((sheet.width * 2, sheet.height * 2), Image.Resampling.NEAREST)
    sheet.save(out)
    print(f"wrote {out} ({len(dirs)} sprites)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", help="folder of game-NNN.png paintings")
    ap.add_argument("--only", help="comma-separated ids")
    ap.add_argument("--sheet", action="store_true")
    ap.add_argument("--cast", action="store_true", help="write console/lounge-cast.json (run after adding sprites)")
    ap.add_argument("--pending", action="store_true")
    ap.add_argument("--preview", help="write a preview png of the sheet(s) here instead of saving")
    ap.add_argument("--loose", action="store_true", help="accept figures that touch (a cut runs through a held item)")
    a = ap.parse_args()
    global LOOSE
    LOOSE = a.loose
    if a.pending:
        for gid, d in avatar_dirs():
            if gid != "garden" and not (d / "sprite.png").exists():
                print(gid)
        return
    if a.cast:
        cast(ROOT / "console" / "lounge-cast.json")
        return
    if a.sheet:
        contact(ROOT / "dev" / "sprites-contact.png")
        return
    if not a.src:
        ap.error("--src is required")
    only = set(a.only.split(",")) if a.only else None
    src = Path(a.src)
    bad = 0
    for gid, d in avatar_dirs():
        if only and gid not in only:
            continue
        f = next((src / f"{gid}{ext}" for ext in (".png", ".webp", ".jpg") if (src / f"{gid}{ext}").exists()), None)
        if not f:
            continue
        if a.preview:
            s = process(gid, f, d, dry=True)
            if s:
                s.resize((s.width * 4, s.height * 4), Image.Resampling.NEAREST).save(Path(a.preview) / f"{gid}-preview.png")
                print(f"  preview {gid}")
            else:
                bad += 1
        elif not process(gid, f, d):
            bad += 1
    if bad:
        sys.exit(1)


if __name__ == "__main__":
    main()
