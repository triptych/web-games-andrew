// opt.mjs <in.glb> <out.glb> [texSize=1024] — shrink a Meshy GLB for the web: WebP textures, quantised geometry.
// Normalises a static model to stand on y=0 and be 1 unit tall (pass KEEP=1 for a rigged model).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, quantize, weld, getBounds, transformMesh, flatten } from '@gltf-transform/functions';
import sharp from 'sharp';
const [src, out, size = '1024'] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
await doc.transform(dedup(), weld(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [+size, +size], quality: 82 }));
if (!process.env.KEEP) {
    await doc.transform(flatten());
    const scene = doc.getRoot().listScenes()[0];
    const b = getBounds(scene), h = b.max[1] - b.min[1], s = 1 / h;
    const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
    for (const n of scene.listChildren()) { const t = n.getTranslation(), sc = n.getScale(); n.setScale([sc[0] * s, sc[1] * s, sc[2] * s]); n.setTranslation([(t[0] - cx) * s, (t[1] - b.min[1]) * s, (t[2] - cz) * s]); }
}
await doc.transform(prune(), quantize());
await io.write(out, doc);
const tris = doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() || 0) / 3, 0), 0);
console.log(out.split('/').pop(), Math.round(tris), 'tris', 'anims', doc.getRoot().listAnimations().map((a) => a.getName()).join(','), 'skins', doc.getRoot().listSkins().length);
