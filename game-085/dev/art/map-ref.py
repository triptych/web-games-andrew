"""The colour layout the painted map is an edit of: a soft blob in each region's colour round each of its towns.

    node -e "import('./game-085/js/sim/data.js').then(d=>console.log(JSON.stringify({towns:d.TOWNS.map(t=>[t.x,t.y,t.region]),colors:d.REGIONS.map(r=>r.color)})))" > mapdata.json
    python3 -I game-085/dev/art/map-ref.py mapdata.json map-ref.png
"""
import json
import sys

from PIL import Image, ImageDraw, ImageFilter

d = json.load(open(sys.argv[1]))
W, H = 1000, 700
im = Image.new('RGB', (W, H), (230, 214, 176))
for x, y, r in d['towns']:
    col = tuple(int(d['colors'][r][i:i + 2], 16) for i in (1, 3, 5))
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(lay).ellipse((x - 120, y - 120, x + 120, y + 120), fill=col + (200,))
    lay = lay.filter(ImageFilter.GaussianBlur(40))
    im.paste(lay, (0, 0), lay)
im.resize((1400, 980)).save(sys.argv[2])
