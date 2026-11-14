# export.py RAW — turn the raw fal renders into game-136/art/.
#   RAW/title.png        -> art/title.webp          1600 px wide (title screen)
#   RAW/por-<id>.png     -> art/por-<id>.webp       magenta cut out by flood fill from the border, 320 px
#   RAW/motif-<m>.png    -> art/motif-<m>.webp      centre 84 % (some came back as a tile with a margin), 512 px
# Run with: python3 -I game-136/dev/art/export.py RAW
import sys, os, glob
from collections import deque
from PIL import Image

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
os.makedirs(OUT, exist_ok=True)


def magenta(p):
    r, g, b = p[0], p[1], p[2]
    return r > 140 and b > 120 and g < 140 and r - g > 60 and b - g > 50


def cutout(im):
    """Flood fill from the border through magenta, then drop a magenta fringe one pixel deep."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        if not magenta(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # pockets the border fill can't reach (between braids, under an arm): strict magenta anywhere
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and r > 160 and b > 140 and g < 125 and r - g > 80 and b - g > 60:
                px[x, y] = (0, 0, 0, 0)
    # fringe: a pinkish pixel touching transparency goes too, and its neighbours lose the tint
    for _ in range(2):
        kill = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                p = px[x, y]
                if p[3] == 0:
                    continue
                if any(px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    r, g, b = p[0], p[1], p[2]
                    if r - g > 45 and b - g > 35:
                        kill.append((x, y))
        for x, y in kill:
            px[x, y] = (0, 0, 0, 0)
    return im


t = Image.open(os.path.join(RAW, 'title.png')).convert('RGB')
t.resize((1600, round(1600 * t.height / t.width)), Image.LANCZOS).save(os.path.join(OUT, 'title.webp'), quality=80)
print('title')

for f in sorted(glob.glob(os.path.join(RAW, 'por-*.png'))):
    name = os.path.basename(f)[:-4]
    im = cutout(Image.open(f))
    im.resize((320, 320), Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), quality=86)
    print(name)

for f in sorted(glob.glob(os.path.join(RAW, 'motif-*.png'))):
    name = os.path.basename(f)[:-4]
    im = Image.open(f).convert('RGB')
    w, h = im.size
    m = 0.08
    im = im.crop((int(w * m), int(h * m), int(w * (1 - m)), int(h * (1 - m))))
    im.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), quality=82)
    print(name)
