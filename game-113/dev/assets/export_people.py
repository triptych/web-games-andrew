#!/usr/bin/env python3
"""Slice generated character sheets into game sprite sheets.

usage: python3 -I dev/assets/export_people.py RAW_DIR [id ...]
  RAW_DIR/walk-<id>.png   3x3 grid, rows front/back/side(right), cols idle/step/step      -> assets/people/<id>.png
  RAW_DIR/pose-<id>.png   3x2 grid, idle/play/hurt, ko/cheer/(blank)                      -> assets/poses/<id>.png

Every cell is keyed out of its magenta background, reduced to its main figure (floating notes, hearts and sparkles are
dropped), then all cells of a sheet are scaled by ONE factor and their feet put on one baseline, so a character keeps its
size from view to view and the walk cycle doesn't jump. Output cells are BW x BH (a person is 24x32 logical pixels at 4x).
"""
import json, os, sys
import numpy as np
from PIL import Image
from PIL import ImageFilter
from collections import deque
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cutout import key_magenta

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, '..', '..', 'assets'))
BOX = {'otto': (160, 144)}            # logical 40x36 at 4x
DEFAULT_BOX = (96, 128)               # logical 24x32 at 4x
FILL = 0.94

def label(mask):
    """4-connected component labelling of a small boolean array (no scipy). Returns (labels, count)."""
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32); n = 0
    for y0 in range(h):
        for x0 in range(w):
            if mask[y0, x0] and not lab[y0, x0]:
                n += 1; lab[y0, x0] = n; q = deque([(y0, x0)])
                while q:
                    y, x = q.popleft()
                    for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                        if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not lab[yy, xx]:
                            lab[yy, xx] = n; q.append((yy, xx))
    return lab, n

def drop_lines(A):
    """Mask of the pixels that belong to real shapes: thin lines (the grid some sheets come with) are removed by an opening,
    then the shapes' own pixels within a few pixels are put back so fine detail (a staff, a loose strand) survives."""
    h, w = A.shape
    im = Image.fromarray((A * 255).astype(np.uint8)).resize((w // 2, h // 2), Image.BILINEAR)
    opened = im.point(lambda v: 255 if v > 127 else 0).filter(ImageFilter.MinFilter(7)).filter(ImageFilter.MaxFilter(7))
    near = opened.filter(ImageFilter.MaxFilter(13)).resize((w, h), Image.NEAREST)
    return np.asarray(near) > 0

def runs(flags):
    """[(start, end)) of consecutive True values."""
    out, start = [], None
    for i, f in enumerate(list(flags) + [False]):
        if f and start is None: start = i
        if not f and start is not None: out.append((start, i)); start = None
    return out

def main_figure(cell, keep=0.04, shrink=6):
    """Reduce a keyed RGBA crop to its main figure: the largest blob plus any blob that's a real part of it (>= keep of its
    area). Floating notes, hearts and sparkles are dropped. Returns the cropped RGBA or None."""
    arr = np.asarray(cell).copy()
    a = arr[..., 3] > 40
    if not a.any(): return None
    H, W = a.shape
    small = Image.fromarray((a * 255).astype(np.uint8)).resize((max(1, W // shrink), max(1, H // shrink)), Image.BILINEAR)
    small = np.asarray(small.filter(ImageFilter.MaxFilter(5))) > 40      # dilate so thin gaps don't split a figure
    lab, n = label(small)
    if n == 0: return None
    sizes = np.bincount(lab.ravel(), minlength=n + 1)[1:]
    ok = [i + 1 for i, sz in enumerate(sizes) if sz >= sizes.max() * keep]
    m = np.asarray(Image.fromarray(np.isin(lab, ok).astype(np.uint8) * 255).resize((W, H), Image.NEAREST)) > 0
    arr[..., 3] = np.where(m, arr[..., 3], 0)
    im = Image.fromarray(arr, 'RGBA'); bb = im.getbbox()
    return im.crop(bb) if bb else None

def sheet_figures(img, nrows):
    """Find the figures on a generated sheet. The model doesn't always draw a perfect grid (a row can have four figures
    where three were asked for), so split on the empty magenta gaps instead of on fixed thirds: the nrows-1 widest empty
    horizontal gaps separate the rows, and any empty vertical gap wider than 1% of the sheet separates figures in a row.
    Returns a list of rows, each a left-to-right list of RGBA crops."""
    rgba = key_magenta(img)
    arr = np.asarray(rgba).copy()
    A = arr[..., 3] > 40
    A = A & drop_lines(A)
    arr[..., 3] = np.where(A, arr[..., 3], 0)
    rgba = Image.fromarray(arr, 'RGBA')
    H, W = A.shape
    rows_on = A.sum(axis=1) > 2
    gaps = [(b0 - a1, (a1 + b0) // 2) for (a0, a1), (b0, b1) in zip(runs(rows_on), runs(rows_on)[1:])]
    cuts = sorted(c for _, c in sorted(gaps, reverse=True)[:nrows - 1])
    edges = [0] + cuts + [H]
    out = _rows(rgba, A, edges, W)
    if any(not r for r in out) or len(out) != nrows:                 # rows that touch have no empty gap: use equal bands
        out = _rows(rgba, A, [round(H * i / nrows) for i in range(nrows + 1)], W)
    return out

def _rows(rgba, A, edges, W):
    out = []
    for y0, y1 in zip(edges, edges[1:]):
        band = A[y0:y1]
        segs = runs(band.sum(axis=0) > 2)
        merged = []
        for s0, s1 in segs:                                        # join runs closer than the figure gap
            if merged and s0 - merged[-1][1] < W * 0.01: merged[-1] = (merged[-1][0], s1)
            else: merged.append((s0, s1))
        mass = [band[:, s0:s1].sum() for s0, s1 in merged]
        row = []
        for (s0, s1), m in zip(merged, mass):
            if m < max(mass) * 0.08: continue                       # a stray note or sparkle, not a figure
            f = main_figure(rgba.crop((s0, y0, s1, y1)))
            if f is not None and f.width > 12 and f.height > 12: row.append(f)
        out.append(row)
    return out

def pick(row, want, drop_wide=False):
    """Choose `want` figures from a row that may hold more (a 4-wide row: idle, step, ..., other step). The model sometimes
    pastes the reference portrait into a cell: a figure much wider than its row-mates is that bust, so it is dropped."""
    if drop_wide and len(row) > want:
        med = sorted(f.width for f in row)[len(row) // 2]
        row = [f for f in row if f.width <= med * 1.45] or row
    if len(row) <= want: return row + [row[-1]] * (want - len(row)) if row else []
    if want == 3: return [row[0], row[1], row[-1]]
    return row[:want]

# Sheets whose generated layout isn't the 3x2 that was asked for: how many rows to detect, and which detected (row, col)
# figure is idle, play, hurt, ko, cheer. (Found by looking at the raw sheet.)
POSE_OVERRIDES = {'mari': {'nrows': 3, 'cells': [(0, 0), (1, 1), (2, 1), (0, 3), (1, 2)]}}

def build(src, dst, layout, box, sizing=None, min_height=0.0, override=None):
    """layout: figures wanted per row, e.g. [3, 3, 3]. Cells are placed row-major in a cols x rows sheet."""
    BW, BH = box
    rows = sheet_figures(Image.open(src), override['nrows'] if override else len(layout))
    if override:
        figs = [rows[r][c] for r, c in override['cells']]
        rows = [figs[0:3], figs[3:5]]
    if min_height:                                                   # walk sheets: every real figure is nearly full height
        tall = max((f.height for r in rows for f in r), default=0)
        rows = [[f for f in r if f.height >= tall * min_height] for r in rows]
    cells = []
    for row, want in zip(rows, layout):
        got = pick(row, want, drop_wide=bool(min_height))
        if len(row) != want: print('  note:', os.path.basename(src), 'row has', len(row), 'figures, wanted', want)
        cells.append(got)
    cols = max(layout)
    ref = [c for r in cells for i, c in enumerate(r) if sizing is None or (cells.index(r) * cols + i) in sizing]
    s = min(BW * FILL / max(c.width for c in ref), BH * FILL / max(c.height for c in ref))
    sheet = Image.new('RGBA', (BW * cols, BH * len(layout)), (0, 0, 0, 0))
    for r, row in enumerate(cells):
        for c, f in enumerate(row):
            k = min(s, BW * FILL / f.width, BH * FILL / f.height)       # a wide pose (lying down) shrinks to fit its cell
            g = f.resize((max(1, round(f.width * k)), max(1, round(f.height * k))), Image.LANCZOS)
            sheet.paste(g, (c * BW + (BW - g.width) // 2, r * BH + BH - g.height - 2), g)
    sheet.save(dst, optimize=True)
    return [len(r) for r in rows]

def main(raw, only):
    os.makedirs(os.path.join(ASSETS, 'people'), exist_ok=True); os.makedirs(os.path.join(ASSETS, 'poses'), exist_ok=True)
    mpath = os.path.join(ASSETS, 'manifest.json')
    man = json.load(open(mpath)) if os.path.exists(mpath) else {}
    for fn in sorted(os.listdir(raw)):
        kind, _, rest = fn.partition('-')
        if kind not in ('walk', 'pose') or not fn.endswith('.png'): continue
        pid = rest[:-4]
        if only and pid not in only: continue
        box = BOX.get(pid, DEFAULT_BOX)
        if kind == 'walk':
            got = build(os.path.join(raw, fn), os.path.join(ASSETS, 'people', pid + '.png'), [3, 3, 3], box, min_height=0.6)
            man[f'person/{pid}'] = {'src': f'people/{pid}.png', 'w': box[0] // 4, 'h': box[1] // 4, 'cols': 3, 'rows': 3}
        else:
            got = build(os.path.join(raw, fn), os.path.join(ASSETS, 'poses', pid + '.png'), [3, 2], box, sizing={0, 1, 2, 4}, override=POSE_OVERRIDES.get(pid))
            man[f'pose/{pid}'] = {'src': f'poses/{pid}.png', 'w': box[0] // 4, 'h': box[1] // 4, 'cols': 3, 'rows': 2}
        print(kind, pid, 'figures per row', got)
    json.dump(man, open(mpath, 'w'), indent=1, sort_keys=True)

if __name__ == '__main__':
    main(sys.argv[1], set(sys.argv[2:]))
