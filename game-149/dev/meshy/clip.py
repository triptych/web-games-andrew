#!/usr/bin/env python3
"""Strip a Meshy animation GLB down to its animation: the skeleton's nodes and the keyframes, no mesh, no textures.

    python3 -I game-147/dev/meshy/clip.py IN.glb OUT.glb

Meshy's animate task returns the whole rigged character (about 3 MB) with one clip. The game already has the rigged
character once (models/<who>.glb), and three.js binds a clip to it by bone name, so only the animation is kept:
meshes, skins, materials, textures and images are dropped, and the binary chunk is rebuilt with just the accessors
the animation samplers use. About 3 MB in, 30-120 KB out.
"""
import json, struct, sys

src, dst = sys.argv[1], sys.argv[2]
data = open(src, 'rb').read()
assert struct.unpack_from('<I', data, 0)[0] == 0x46546C67, 'not a GLB'
off, chunks = 12, []
while off < len(data):
    ln, typ = struct.unpack_from('<II', data, off)
    chunks.append((typ, data[off + 8: off + 8 + ln]))
    off += 8 + ln
g = json.loads(next(c for t, c in chunks if t == 0x4E4F534A))
binary = next((c for t, c in chunks if t == 0x004E4942), b'')

for n in g.get('nodes', []):
    n.pop('mesh', None); n.pop('skin', None)
for k in ('meshes', 'skins', 'materials', 'textures', 'images', 'samplers'):
    g.pop(k, None)

used = sorted({s[k] for a in g.get('animations', []) for s in a['samplers'] for k in ('input', 'output')})
remap = {old: i for i, old in enumerate(used)}
accs, views, out = [], [], bytearray()
for old in used:
    a = dict(g['accessors'][old])
    bv = g['bufferViews'][a['bufferView']]
    start = bv.get('byteOffset', 0)
    blob = binary[start: start + bv['byteLength']]
    while len(out) % 4: out.append(0)
    views.append({'buffer': 0, 'byteOffset': len(out), 'byteLength': len(blob)})
    out += blob
    a['bufferView'] = len(views) - 1
    accs.append(a)
while len(out) % 4: out.append(0)
for anim in g.get('animations', []):
    for s in anim['samplers']:
        s['input'] = remap[s['input']]; s['output'] = remap[s['output']]
g['accessors'], g['bufferViews'] = accs, views
g['buffers'] = [{'byteLength': len(out)}]

js = json.dumps(g, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out))
glb += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
open(dst, 'wb').write(glb)
print(f'{src} -> {dst}: {len(data) // 1024} KB -> {len(glb) // 1024} KB, {len(g.get("animations", []))} clip(s)')
