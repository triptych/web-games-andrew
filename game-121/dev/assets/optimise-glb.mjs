// Shrink a raw Meshy GLB into a web-sized character model.
//   node optimise-glb.mjs in.glb out.glb [targetTriangles=9000] [textureSize=1024]
//   PLAIN=1 node optimise-glb.mjs ...   plain GLB (JPEG texture, no quantising, no meshopt) for uploading to Meshy
//
// What it does: welds and simplifies the mesh to roughly the target triangle count, re-origins the model so its
// feet are at y=0 and it is centred on x/z, scales it to exactly 1 unit tall (the game scales it to the character's
// height), resizes the colour texture and stores it as WebP, quantises, and compresses the geometry with meshopt
// (EXT_meshopt_compression, decoded in the browser by three's MeshoptDecoder).
//
// Needs: npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer sharp
// (see dev/assets/README.md). Run it from a folder that has those in node_modules.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, textureCompress, quantize, meshopt, dedup, prune, getBounds, flatten, join, reorder } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const [, , inPath, outPath, tris = '9000', texSize = '1024'] = process.argv;
if (!inPath || !outPath) { console.error('usage: optimise-glb.mjs in.glb out.glb [triangles] [textureSize]'); process.exit(2); }

await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inPath);
const root = doc.getRoot();

const count = () => {
    let t = 0;
    for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
        const idx = p.getIndices();
        t += idx ? idx.getCount() / 3 : p.getAttribute('POSITION').getCount() / 3;
    }
    return Math.round(t);
};
const before = count();

await doc.transform(flatten(), join(), weld({ tolerance: 0.0001 }));
const now = count();
const ratio = Math.min(1, Number(tris) / now);
if (ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01, lockBorder: false }));

// feet to the origin, one unit tall
const scene = root.getDefaultScene() || root.listScenes()[0];
const bounds = getBounds(scene);
const h = bounds.max[1] - bounds.min[1];
const cx = (bounds.max[0] + bounds.min[0]) / 2, cz = (bounds.max[2] + bounds.min[2]) / 2;
for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        const v = [0, 0, 0];
        for (let i = 0; i < pos.getCount(); i++) {
            pos.getElement(i, v);
            pos.setElement(i, [(v[0] - cx) / h, (v[1] - bounds.min[1]) / h, (v[2] - cz) / h]);
        }
    }
}
// the flattened scene may still carry a node transform: reset it, we baked it into the positions already
for (const n of root.listNodes()) { n.setTranslation([0, 0, 0]); n.setRotation([0, 0, 0, 1]); n.setScale([1, 1, 1]); }

if (process.env.PLAIN) {
    await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [Number(texSize), Number(texSize)], quality: 90 }));
} else {
    await doc.transform(
        dedup(), prune(),
        textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [Number(texSize), Number(texSize)], quality: 82 }),
        quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
        reorder({ encoder: MeshoptEncoder }),
        meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
}
await io.write(outPath, doc);
console.log(JSON.stringify({ in: inPath, out: outPath, trianglesBefore: before, trianglesAfter: count(), heightRaw: +h.toFixed(3) }));
