#!/usr/bin/env python3
"""Export the ElevenLabs art into the game's art/ folder.

    python3 -I game-147/dev/art/export.py RAW OUT

- title.webp (1920 wide), ending.webp, bg-<place>.webp: straight resizes of title-v2, ending-v2 and the backdrops.
- por-<who>.webp (256 square, transparent): a cut-out of the reference picture. The white background connected to the
  border is removed by flood fill (a soft edge where it meets the figure); people are cropped to head and shoulders
  (the top 42% of the figure), creatures are kept whole.
Needs Pillow and numpy.
"""
import os, sys
from collections import deque
import numpy as np
from PIL import Image

RAW, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

def save(im, name, w=None, q=82):
    if w and im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name), 'WEBP', quality=q, method=6)

save(Image.open(os.path.join(RAW, 'title-v2.png')).convert('RGB'), 'title.webp', 1920)
save(Image.open(os.path.join(RAW, 'ending-v2.png')).convert('RGB'), 'ending.webp', 1376)
for p in ['meadow', 'grove', 'cave', 'hotel']:
    save(Image.open(os.path.join(RAW, f'bg-{p}.png')).convert('RGB'), f'bg-{p}.webp', 1376, 78)

def cutout(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im).astype(int)
    H, W, _ = a.shape
    white = (a.min(axis=2) > 232) & ((a.max(axis=2) - a.min(axis=2)) < 18)
    bg = np.zeros((H, W), bool)
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if white[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(H):
        for x in (0, W - 1):
            if white[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < H and 0 <= nx < W and white[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8)).filter(__import__('PIL.ImageFilter', fromlist=['x']).GaussianBlur(0.8))
    rgba = im.copy(); rgba.putalpha(alpha)
    ys, xs = np.nonzero(~bg)
    return rgba, xs.min(), xs.max(), ys.min(), ys.max()

PEOPLE = ['maple', 'ember', 'kit', 'fern', 'bru', 'goldmaw', 'guest-merchant', 'guest-noble', 'guest-adventurer']
CREATURES = ['dustbunny', 'honeyslime', 'thistlehog', 'puffcap', 'mosssnail', 'grandmorel', 'crystalbat', 'pebblegolem', 'molequeen']
for who in PEOPLE + CREATURES:
    rgba, x0, x1, y0, y1 = cutout(os.path.join(RAW, f'ref-{who}.png'))
    h = y1 - y0
    if who in PEOPLE:
        side = int(h * (0.5 if who == 'goldmaw' else 0.42))
        cx = (x0 + x1) // 2
        # the head is where the figure is thickest just below its top: weight each column by how many figure pixels
        # it has in the band, so a weapon held up beside the head (Bru's mop) doesn't pull the crop sideways
        band = np.asarray(rgba)[y0 + side // 6:y0 + side, :, 3] > 128
        w = band.sum(axis=0).astype(float) ** 2
        if w.sum(): cx = int((w * np.arange(len(w))).sum() / w.sum())
        box = (cx - side // 2, y0 - side // 20, cx + side // 2, y0 - side // 20 + side)
    else:
        side = int(max(x1 - x0, h) * 1.06)
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        box = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)
    crop = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    crop.paste(rgba.crop(box), (0, 0))
    save(crop.resize((256, 256), Image.LANCZOS), f'por-{who}.webp', None, 86)
print('done:', len(os.listdir(OUT)), 'files')
