"""export.py RAW — turn the fal originals in RAW (PNG, named as in prompts.mjs) into the game's art/ folder.

    python3 -I game-132/dev/art/export.py RAW

- title.webp 1920 wide, card-*.webp 1280 wide, portrait-*.webp 512 wide (quality 80)
- tex-*.webp 512 square (the ground and wall textures, tiled with mirrored repeat in the view)
- icons-*.webp: each 4x4 sheet re-cut into a clean 4x4 grid of 128 px cells (512 square), so the UI can use
  CSS background-position. Each cell is taken from inside the sheet's own cell with a small margin, which drops the
  thin dark lines the model draws between cells. icons-sets came back with a caption under most icons: for that sheet
  the top 70% of each cell is used and squared about its centre.
Needs Pillow.
"""
import os
import sys
from PIL import Image

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'art')
os.makedirs(OUT, exist_ok=True)


def save(img, name, q=80):
    img.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=q, method=6)


def wide(name, w):
    im = Image.open(os.path.join(RAW, name + '.png')).convert('RGB')
    h = round(im.height * w / im.width)
    save(im.resize((w, h), Image.LANCZOS), name)


def sheet(name, captions=False, cell=128):
    im = Image.open(os.path.join(RAW, name + '.png')).convert('RGB')
    W, H = im.size
    cw, ch = W / 4, H / 4
    out = Image.new('RGB', (cell * 4, cell * 4))
    for r in range(4):
        for c in range(4):
            x0, y0 = c * cw, r * ch
            if captions:
                side = ch * 0.70
                box = (x0 + (cw - side) / 2, y0 + ch * 0.01, x0 + (cw + side) / 2, y0 + ch * 0.01 + side)
            else:
                m = cw * 0.035
                box = (x0 + m, y0 + m, x0 + cw - m, y0 + ch - m)
            out.paste(im.crop(tuple(round(v) for v in box)).resize((cell, cell), Image.LANCZOS), (c * cell, r * cell))
    save(out, name, 84)


for f in sorted(os.listdir(RAW)):
    n, ext = os.path.splitext(f)
    if ext != '.png':
        continue
    if n == 'title':
        wide(n, 1920)
    elif n.startswith('card-'):
        wide(n, 1280)
    elif n.startswith('portrait-'):
        wide(n, 512)
    elif n.startswith('tex-'):
        im = Image.open(os.path.join(RAW, f)).convert('RGB')
        save(im.resize((512, 512), Image.LANCZOS), n, 82)
    elif n.startswith('icons-'):
        sheet(n, captions=(n == 'icons-sets'))
    else:
        continue
    print('art/' + n + '.webp')
