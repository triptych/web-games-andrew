// strip-anim.mjs <in.glb> <out.glb> — keep only a Meshy animation GLB's skeleton nodes and clips: no mesh, no
// textures, no skin. The game plays the clip on the model it already loaded (track names are bone names).
// Needs @gltf-transform/core, functions, extensions (see README.md).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup } from '@gltf-transform/functions';
const [src, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();
for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
for (const s of root.listSkins()) s.dispose();
for (const m of root.listMeshes()) m.dispose();
await doc.transform(prune(), dedup());
await io.write(out, doc);
console.log(out.split('/').pop(), 'clips', root.listAnimations().map((a) => `${a.getName()} (${a.listChannels().length} channels)`).join(', '));
