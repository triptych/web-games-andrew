# export.py RAW — turn the raw fal renders into game-137/art/.
#   RAW/title.png                 -> art/title.webp            1600 px wide (title screen)
#   RAW/hangar.png, ending.png,
#   RAW/sector-<id>.png           -> art/<name>.webp           1280 px wide (hangar, ending, briefing backdrops)
#   RAW/cast-<id>.png,
#   RAW/crew-<id>.png             -> art/<name>.webp           384 px square portraits
# crew-hana came back as a card with a paper margin (the pilot prompt said "eyecatch card"): CROP keeps its centre.
# Run with: python3 -I game-137/dev/art/export.py RAW
import sys, os, glob
from PIL import Image

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art')
os.makedirs(OUT, exist_ok=True)
CROP = {'crew-hana': 0.86}


def save(im, name, q=80):
    path = os.path.join(OUT, name + '.webp')
    im.save(path, quality=q, method=6)
    print(name, im.size, os.path.getsize(path) // 1024, 'KB')


t = Image.open(os.path.join(RAW, 'title.png')).convert('RGB')
save(t.resize((1600, round(1600 * t.height / t.width)), Image.LANCZOS), 'title', 78)

for f in sorted(glob.glob(os.path.join(RAW, '*.png'))):
    name = os.path.splitext(os.path.basename(f))[0]
    if name in ('title',) or name.startswith('pilot'):
        continue
    im = Image.open(f).convert('RGB')
    if name.startswith(('cast-', 'crew-')):
        k = CROP.get(name, 1)
        w, h = im.size
        cw, ch = round(w * k), round(h * k)
        im = im.crop(((w - cw) // 2, (h - ch) // 2, (w + cw) // 2, (h + ch) // 2))
        save(im.resize((384, 384), Image.LANCZOS), name, 82)
    else:
        save(im.resize((1280, round(1280 * im.height / im.width)), Image.LANCZOS), name, 78)
