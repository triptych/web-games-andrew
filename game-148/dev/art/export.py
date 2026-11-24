"""Turn the raw ElevenLabs renders into the game's art/*.webp.

    python3 -I game-148/dev/art/export.py RAW      # RAW holds the PNGs named below, as downloaded

Backgrounds and scenes are resized and re-encoded. Sprites come from the `cut-*.png` renders, which ElevenLabs'
background-removal model (BiRefNet v2) already cut out with a real alpha channel (the fairy's wings stay
translucent). Sheets are split into equal grid cells (the prompts ask for one figure centred in each, with
plenty of space around it); each cell is trimmed to its opaque pixels and scaled to fit.
"""
import sys, os
from PIL import Image

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
os.makedirs(OUT, exist_ok=True)

def save(im, name, q=82):
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=q, method=6)
    print(name, im.size)

def fit(im, box):
    im = im.copy(); im.thumbnail((box, box), Image.LANCZOS); return im

def scene(src, name, long_side):
    im = Image.open(os.path.join(RAW, src)).convert('RGB')
    s = long_side / max(im.size)
    save(im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS), name, 80)

def trim(im, pad=4):
    a = im.split()[-1].point(lambda v: 255 if v > 24 else 0)
    bb = a.getbbox()
    if not bb: return im
    x0, y0, x1, y1 = bb
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))

def sheet(src, cols, rows, names, box):
    im = Image.open(os.path.join(RAW, src)).convert('RGBA')
    cw, ch = im.width / cols, im.height / rows
    for i, name in enumerate(names):
        if not name: continue
        c, r = i % cols, i // cols
        cell = im.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
        save(fit(trim(cell), box), name)

scene('title.png', 'title', 1920)
scene('ending.png', 'ending', 1600)
for ch in ['meadow', 'hollow', 'moonpond', 'grotto', 'canopy']:
    scene(f'bg-{ch}.png', f'bg-{ch}', 1400)
for p in ['lumi', 'willow']:
    im = Image.open(os.path.join(RAW, f'por-{p}.png')).convert('RGB')
    save(im.resize((320, 320), Image.LANCZOS), f'por-{p}')
for pose, src in [('lumi', 'cut-lumi-base.png'), ('lumi-cheer', 'cut-lumi-cheer.png'), ('lumi-think', 'cut-lumi-think.png')]:
    save(fit(trim(Image.open(os.path.join(RAW, src)).convert('RGBA')), 420), pose)
sheet('cut-creatures-a.png', 3, 2, ['creature-rose', 'creature-gold', 'creature-lilac', 'creature-coral', 'creature-indigo', 'creature-bramble'], 256)
sheet('cut-creatures-b.png', 2, 2, ['creature-mint', 'creature-sky', 'creature-teal', 'creature-pearl'], 256)
sheet('cut-icons.png', 2, 2, ['icon-undo', 'icon-sprout', 'icon-hint', 'icon-restart'], 128)
