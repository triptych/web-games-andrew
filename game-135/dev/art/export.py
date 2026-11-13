# export.py RAW MESHY_WORK — turn the raw renders into the game's art/ folder.
#   RAW/por-<id>.png  -> art/por-<id>.webp   256 px portraits
#   RAW/title.png     -> art/title.webp      1600 px wide
#   RAW/badge.png     -> art/badge.webp      magenta background cut out by flood fill from the border, 384 px
#   MESHY_WORK/th-veh-<id>.png -> art/veh-<id>.webp   128 px vehicle buttons (Meshy's own thumbnails of the models)
# Run with: python3 -I game-135/dev/art/export.py RAW MESHY_WORK
import sys, os, glob
from collections import deque
from PIL import Image

RAW, WORK = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
os.makedirs(OUT, exist_ok=True)


def cutout(im, key=(255, 0, 255), tol=110):
    """Flood fill from the border: every pixel near the key colour that touches the edge becomes transparent."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    near = lambda p: abs(p[0] - key[0]) + abs(p[1] - key[1]) + abs(p[2] - key[2]) < tol * 3 and p[1] < 140
    seen = bytearray(w * h)
    q = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        if not near(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im.crop(im.getbbox())


for f in sorted(glob.glob(os.path.join(RAW, 'por-*.png'))):
    name = os.path.basename(f)[:-4]
    Image.open(f).convert('RGB').resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), quality=84)
    print(name)

t = Image.open(os.path.join(RAW, 'title.png')).convert('RGB')
t.resize((1600, round(1600 * t.height / t.width)), Image.LANCZOS).save(os.path.join(OUT, 'title.webp'), quality=80)
print('title')

b = cutout(Image.open(os.path.join(RAW, 'badge.png')))
b.thumbnail((384, 384), Image.LANCZOS)
b.save(os.path.join(OUT, 'badge.webp'), quality=88)
print('badge', b.size)

for f in sorted(glob.glob(os.path.join(WORK, 'th-veh-*.png'))):
    name = os.path.basename(f)[3:-4]
    im = Image.open(f).convert('RGBA')
    im = im.crop(im.getbbox())
    side = max(im.size)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    sq.resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), quality=86)
    print(name)
