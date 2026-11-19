"""Cut out and size the fal renders for the game.

    python3 -I game-143/dev/art/export.py RAWDIR

RAWDIR holds <id>.png as named in prompts.json (grab.py writes them). Writes game-143/art/<kind>/<name>.png
(transparent, trimmed, box-filtered down to the game's pixel size, quantised) and the backdrops as JPEG,
plus art/manifest.json with every file's size. Needs Pillow and numpy.
"""
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'art')
RAW = sys.argv[1]

# id prefix -> (folder, target height in px)
SIZES = {'por': ('por', 220), 'spr': ('spr', 150), 'vil': ('vil', 120), 'en': ('en', 120), 'bld': ('bld', 210), 'wall': ('wall', 340)}
TALL = {'en-king': 230, 'en-golem': 175, 'en-brute': 150, 'en-corn': 80, 'en-licorice': 80, 'en-bat': 80, 'en-ghost': 95,
        'en-slime': 90, 'en-mimic': 110, 'spr-queen': 130, 'vil-tansy': 95, 'bld-oven': 230, 'bld-hall': 250,
        'bld-tower': 240, 'bld-bell': 240, 'bld-site': 170, 'bld-beets': 170, 'por-mother': 230}
BGS = {'bg-town': 1600, 'bg-field': 1600, 'bg-title': 1600}
FLIP = set()   # ids the model drew facing the wrong way


def key_mask(a):
    """True where the pixel is background: flood fill from the border through pixels near the border colour."""
    h, w, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).astype(float)
    key = np.median(border, axis=0)
    d = np.sqrt(((a.astype(float) - key) ** 2).sum(axis=2))
    near = d < 70
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True; q.append((ny, nx))
    # holes the fill can't reach (between a mill's sails, inside a bow): any clump of near-key pixels goes too.
    # Tighter threshold, so a real purple or green inside the figure survives.
    hole = (d < 55) & ~bg
    seen = np.zeros_like(hole)
    for y0, x0 in zip(*np.nonzero(hole)):
        if seen[y0, x0]: continue
        comp = [(y0, x0)]; seen[y0, x0] = True; i = 0
        while i < len(comp):
            y, x = comp[i]; i += 1
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < h and 0 <= nx < w and hole[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; comp.append((ny, nx))
        if len(comp) >= 6:
            for y, x in comp: bg[y, x] = True
    # de-halo: a foreground pixel touching the background that is still tinted towards the key goes too
    for _ in range(2):
        edge = np.zeros_like(bg)
        edge[1:] |= bg[:-1]; edge[:-1] |= bg[1:]; edge[:, 1:] |= bg[:, :-1]; edge[:, :-1] |= bg[:, 1:]
        edge &= ~bg
        bg |= edge & (d < 120)
    return bg


def largest_parts(alpha):
    """Drop specks: keep connected parts at least 2% the size of the biggest."""
    h, w = alpha.shape
    lab = np.zeros((h, w), int)
    sizes = [0]
    n = 0
    for y in range(h):
        for x in range(w):
            if alpha[y, x] and not lab[y, x]:
                n += 1; lab[y, x] = n; q = deque([(y, x)]); c = 0
                while q:
                    cy, cx = q.popleft(); c += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and alpha[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n; q.append((ny, nx))
                sizes.append(c)
    big = max(sizes)
    keep = np.array([s >= big * 0.02 for s in sizes])
    keep[0] = False
    return keep[lab]


def cut(path, target_h):
    im = Image.open(path).convert('RGB')
    small = im.resize((im.width // 2, im.height // 2), Image.NEAREST)   # half size is plenty for the mask and fast
    a = np.asarray(small)
    fg = ~key_mask(a)
    fg = largest_parts(fg)
    mask = Image.fromarray((fg * 255).astype(np.uint8)).resize(im.size, Image.NEAREST)
    rgba = im.convert('RGBA')
    rgba.putalpha(mask)
    bb = rgba.getbbox()
    rgba = rgba.crop(bb)
    s = target_h / rgba.height
    w = max(1, round(rgba.width * s))
    # box filter colours, hard alpha: crisp pixel-art edges with no fringe
    col = rgba.resize((w, target_h), Image.BOX)
    al = rgba.getchannel('A').resize((w, target_h), Image.BOX).point(lambda v: 255 if v >= 128 else 0)
    col.putalpha(al)
    # transparent pixels take a dark violet so a filtered draw has no key-coloured halo
    arr = np.asarray(col).copy()
    arr[arr[:, :, 3] == 0, :3] = (40, 20, 50)
    return Image.fromarray(arr, 'RGBA')


def main():
    spec = json.load(open(os.path.join(HERE, 'prompts.json')))
    manifest = {}
    for it in spec['items']:
        iid = it['id']
        src = os.path.join(RAW, iid + '.png')
        if not os.path.exists(src):
            print('missing', iid); continue
        if iid in BGS:
            os.makedirs(os.path.join(OUT, 'bg'), exist_ok=True)
            im = Image.open(src).convert('RGB')
            w = BGS[iid]; h = round(im.height * w / im.width)
            im = im.resize((w, h), Image.LANCZOS)
            name = iid[3:]
            im.save(os.path.join(OUT, 'bg', name + '.jpg'), quality=84, optimize=True, progressive=True)
            manifest['bg/' + name] = {'w': w, 'h': h, 'file': 'bg/' + name + '.jpg'}
            continue
        prefix = iid.split('-')[0]
        folder, th = SIZES[prefix]
        th = TALL.get(iid, th)
        im = cut(src, th)
        if iid in FLIP: im = im.transpose(Image.FLIP_LEFT_RIGHT)
        name = iid[len(prefix) + 1:]
        os.makedirs(os.path.join(OUT, folder), exist_ok=True)
        # 256-colour palette with alpha: about a third of the size, no visible change on pixel art
        im.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.NONE).save(os.path.join(OUT, folder, name + '.png'), optimize=True)
        manifest[folder + '/' + name] = {'w': im.width, 'h': im.height, 'file': folder + '/' + name + '.png'}
        print(iid, im.size)
    json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=0, sort_keys=True)


main()
