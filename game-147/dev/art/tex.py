# Cut the ElevenLabs material sheet (a 4x4 grid of swatches with white gaps) into tileable textures.
# Each swatch is cropped inside its gap, made seamless by offset-and-blend (the half-offset copy supplies the
# edges, the original the middle, mixed over a narrow band so patterns barely ghost), and saved as webp.
# Usage: python3 -I tex.py sheet.png ../../art/tex
import sys
import numpy as np
from PIL import Image

NAMES = [
    'wood-honey', 'wood-walnut', 'tiles', 'paper-flowers',
    'paper-mint', 'paper-stars', 'paper-rose', 'paper-leaves',
    'plaster', 'shingles', 'fieldstone', 'grass',
    'moss', 'cave', 'cliff', 'rug',
]
# regular patterns ghost when blended: they are cut as-is and tile with MirroredRepeatWrapping in the game
# (assets.js MIRROR lists the same names); the rug is a single decal
NO_BLEND = {'rug', 'wood-honey', 'wood-walnut', 'tiles', 'paper-mint', 'paper-rose', 'cave'}
SIZE = 512
BAND = 0.18                  # blend band width as a fraction of the tile


def gaps(a, axis):
    m = (a > 240).mean(axis=axis)
    idx = np.where(m > 0.9)[0]
    runs, s, p = [], idx[0], idx[0]
    for i in idx[1:]:
        if i != p + 1:
            runs.append((s, p))
            s = i
        p = i
    runs.append((s, p))
    runs = [r for r in runs if 0 < r[0] and r[1] < a.shape[1 - axis] - 1]
    edges = [0] + [x for r in runs for x in (r[0], r[1] + 1)] + [a.shape[1 - axis]]
    return [(edges[i], edges[i + 1]) for i in range(0, len(edges), 2)]


def seamless(img):
    a = np.asarray(img).astype(float)
    n = a.shape[0]
    sh = np.roll(np.roll(a, n // 2, 0), n // 2, 1)
    t = np.linspace(0, 1, n)
    d = np.minimum(t, 1 - t)                       # 0 at the edges, 0.5 in the middle
    w1 = np.clip(d / BAND, 0, 1)                   # 0 at the edge → 1 a band in
    w = np.minimum.outer(w1, w1)[..., None]
    return Image.fromarray((a * w + sh * (1 - w)).round().astype(np.uint8))


def main(src, out):
    im = Image.open(src).convert('RGB')
    g = np.asarray(im.convert('L')).astype(float)
    cols, rows = gaps(g, 0), gaps(g, 1)
    assert len(cols) == 4 and len(rows) == 4, (cols, rows)
    k = 0
    for (y0, y1) in rows:
        for (x0, x1) in cols:
            inset = 14
            sw = im.crop((x0 + inset, y0 + inset, x1 - inset, y1 - inset)).resize((SIZE, SIZE), Image.LANCZOS)
            name = NAMES[k]
            if name not in NO_BLEND:
                sw = seamless(sw)
            sw.save(f'{out}/{name}.webp', quality=84, method=6)
            k += 1
    print('wrote', k)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
