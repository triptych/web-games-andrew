#!/usr/bin/env python3
"""Shrink a Meshy GLB for the web: re-encode its embedded textures smaller.

    python3 -I game-144/dev/meshy/shrink.py IN.glb OUT.glb [max_px]

Meshy's refine returns 2K+ PNG textures (base colour, normal, metallic-roughness, emission), which makes each model
10-30 MB. A ship on screen is a few hundred pixels wide, so every texture is resized to max_px (default 512) and saved
as JPEG (WebP would be smaller, but JPEG needs no glTF extension). Textures with real alpha stay PNG. The GLB's binary
chunk is rebuilt and every bufferView offset fixed up. Needs Pillow.
"""
import io, json, struct, sys
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 512

data = open(src, 'rb').read()
magic, version, _ = struct.unpack_from('<III', data, 0)
assert magic == 0x46546C67, 'not a GLB'
off = 12
chunks = []
while off < len(data):
    ln, typ = struct.unpack_from('<II', data, off)
    chunks.append((typ, data[off + 8: off + 8 + ln]))
    off += 8 + ln
gltf = json.loads(next(c for t, c in chunks if t == 0x4E4F534A))
binary = next((c for t, c in chunks if t == 0x004E4942), b'')

views = gltf.get('bufferViews', [])
image_views = {}
for i, img in enumerate(gltf.get('images', [])):
    if 'bufferView' in img:
        image_views[img['bufferView']] = i

new_bin = bytearray()
before = after = 0
for vi, bv in enumerate(views):
    blob = binary[bv.get('byteOffset', 0): bv.get('byteOffset', 0) + bv['byteLength']]
    if vi in image_views:
        img_def = gltf['images'][image_views[vi]]
        im = Image.open(io.BytesIO(blob))
        before += len(blob)
        im.thumbnail((MAX, MAX), Image.LANCZOS)
        out = io.BytesIO()
        has_alpha = im.mode in ('RGBA', 'LA') and im.getchannel('A').getextrema()[0] < 250
        if has_alpha:
            im.save(out, 'PNG', optimize=True)
            img_def['mimeType'] = 'image/png'
        else:
            im.convert('RGB').save(out, 'JPEG', quality=84, optimize=True)
            img_def['mimeType'] = 'image/jpeg'
        blob = out.getvalue()
        after += len(blob)
    while len(new_bin) % 4:
        new_bin.append(0)
    bv['byteOffset'] = len(new_bin)
    bv['byteLength'] = len(blob)
    new_bin += blob
while len(new_bin) % 4:
    new_bin.append(0)
gltf['buffers'] = [{'byteLength': len(new_bin)}]

js = json.dumps(gltf, separators=(',', ':')).encode()
js += b' ' * ((4 - len(js) % 4) % 4)
total = 12 + 8 + len(js) + 8 + len(new_bin)
with open(dst, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(new_bin), 0x004E4942)); f.write(new_bin)
print(f'{dst}: {len(data) // 1024} KB -> {total // 1024} KB (textures {before // 1024} -> {after // 1024} KB)')
