"""export.py — turn the raw fal pictures into the game's art (game-149/art/).

    python3 game-149/dev/art/export.py RAW_DIR

RAW_DIR holds the downloads named as in dev/art/README.md (kai-normal.png, bg-lab.png, cg-title.png, icons-a.png, ...).

- Sprites (waist-up, plain light grey background): the background is flood-filled from the border (anime line art
  closes every outline, so the fill stops at the character), enclosed background pockets (between an arm and the body)
  are dropped too, the edge is feathered by a pixel, and the figure is trimmed and scaled to 960 px tall.
- Backgrounds and CGs: re-encoded as WebP (CGs and the title at 1600 px wide).
- Item icons: each 4 x 4 sheet is split into cells, each cell cut out the same way, trimmed and scaled to 128 px.
"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

RAW = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'art')

SPRITES = ['kai-normal', 'kai-determined', 'kai-surprised',
           'hana-normal', 'hana-happy', 'hana-angry', 'hana-sad', 'hana-blush',
           'lys-normal', 'lys-happy', 'lys-surprised', 'lys-sad', 'lys-blush',
           'pip-normal', 'pip-happy', 'pip-surprised', 'pip-sad', 'pip-blush',
           'ren-normal', 'ren-happy', 'ren-serious', 'ren-sad', 'ren-blush',
           'veymont-kind', 'veymont-think', 'veymont-sinister', 'hollow-menace',
           'graves-stern', 'graves-soft', 'graves-alarm', 'theo-normal', 'yuki-normal']
ICONS_A = ['healing', 'mana', 'phoenix', 'chime', 'tart', 'candy', 'chestnuts', 'starchart', 'gears', 'honeybun',
           'moonflower', 'fireopal', 'windchime', 'bubblesoap', 'bookmark', 'charm']
ICONS_B = ['moonpetal', 'librarybook', 'hollowshard', 'silverkey', 'maskshard', 'cagekey', 'lantern', 'ticket',
           'mochitreat', 'notes', 'wand', 'broom', 'coin', 'letter', 'pendant', 'badge']


def cutout(im, tol=30, hole_tol=8, hole_min=3000, seed_bottom=True):
    """RGBA with the background made transparent.

    The background is the light, colourless region connected to the image border (the plain grey backdrop, and the
    grey tiles an icon sheet sometimes draws behind each item): anime line art closes every outline, so the fill
    stops at the figure. Big pockets of the exact backdrop colour enclosed by the figure (between an arm and the
    body) go too; small or slightly different ones stay, because light shirts and silver hair are close to it.
    seed_bottom=False for waist-up sprites, whose bottom edge cuts through the figure (a white shirt would leak)."""
    a = np.asarray(im.convert('RGB')).astype(np.int32)
    border = np.concatenate([a[0], a[:, 0], a[:, -1]] + ([a[-1]] if seed_bottom else []))
    bg = np.median(border, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(-1))
    chroma = a.max(-1) - a.min(-1)
    light = a.mean(-1)
    near = (dist < tol) | ((chroma < 16) & (light > 150) & (dist < tol * 2.2))
    lab, _ = ndimage.label(near)
    seeds = [lab[0], lab[:, 0], lab[:, -1]] + ([lab[-1]] if seed_bottom else [])
    edge = set(np.unique(np.concatenate(seeds))) - {0}
    mask = np.isin(lab, list(edge))
    pockets = (dist < hole_tol) & ~mask
    plab, n = ndimage.label(pockets)
    if n:
        sizes = np.bincount(plab.ravel())
        big = np.nonzero(sizes >= hole_min)[0]
        big = big[big != 0]
        if len(big):
            mask |= np.isin(plab, big)
    alpha = np.where(mask, 0, 255).astype(np.uint8)
    # grow the cut by a pixel into the antialiased fringe, then soften it
    alpha = ndimage.grey_erosion(alpha, size=(3, 3))
    alpha_im = Image.fromarray(alpha).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGBA')
    out.putalpha(alpha_im)
    return out


def trim(im, pad=4):
    bb = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if not bb:
        return im
    l, t, r, b = bb
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def save(im, path, q=86):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=q, method=6)


def main():
    for n in SPRITES:
        src = os.path.join(RAW, n + '.png')
        if not os.path.exists(src):
            print('missing', n); continue
        im = trim(cutout(Image.open(src), seed_bottom=False))
        # sprites are waist-up and run off the bottom: keep the bottom edge, scale to 960 tall
        s = 960 / im.height
        im = im.resize((round(im.width * s), 960), Image.LANCZOS)
        save(im, os.path.join(OUT, 'spr', n + '.webp'))
    # Mochi: the full-body reference is the sprite
    m = trim(cutout(Image.open(os.path.join(RAW, 'ref-mochi.png'))))
    m.thumbnail((520, 520), Image.LANCZOS)
    save(m, os.path.join(OUT, 'spr', 'mochi.webp'))

    for f in sorted(os.listdir(RAW)):
        if f.startswith('bg-') and f.endswith('.png'):
            im = Image.open(os.path.join(RAW, f)).convert('RGB')
            save(im, os.path.join(OUT, 'bg', f[3:-4] + '.webp'), 80)
        elif f.startswith('cg-') and f.endswith('.png'):
            im = Image.open(os.path.join(RAW, f)).convert('RGB')
            if im.width > 1600:
                im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
            save(im, os.path.join(OUT, 'cg', f[3:-4] + '.webp'), 82)

    for sheet, names in (('icons-a', ICONS_A), ('icons-b', ICONS_B)):
        im = Image.open(os.path.join(RAW, sheet + '.png')).convert('RGB')
        cw, ch = im.width / 4, im.height / 4
        for i, n in enumerate(names):
            x, y = i % 4, i // 4
            cell = im.crop((round(x * cw), round(y * ch), round((x + 1) * cw), round((y + 1) * ch)))
            ic = trim(cutout(cell, tol=26, hole_min=400), pad=2)
            side = max(ic.width, ic.height)
            sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
            sq.paste(ic, ((side - ic.width) // 2, (side - ic.height) // 2))
            save(sq.resize((128, 128), Image.LANCZOS), os.path.join(OUT, 'icons', n + '.webp'), 88)
    print('done')


if __name__ == '__main__':
    main()
