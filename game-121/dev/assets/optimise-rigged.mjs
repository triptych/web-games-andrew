// Shrink a RIGGED Meshy GLB (from `meshy rigging`) for the web, keeping the skeleton and skin weights.
//   node optimise-rigged.mjs in.glb out.glb [textureSize=1024]
//
// Unlike optimise-glb.mjs this does not weld, simplify, join or quantise positions (all of which can break skinning).
// It drops the embedded animation clip (the game poses the bones itself), resizes the colour texture to WebP, and
// compresses the geometry with meshopt. Rigged models come from Meshy at ~10,000 triangles when the model sent to
// the rigger was simplified first (see dev/assets/README.md), so no further simplification is needed.
//
// Needs: npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions meshoptimizer sharp

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, reorder, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const [, , inPath, outPath, texSize = '1024'] = process.argv;
if (!inPath || !outPath) { console.error('usage: optimise-rigged.mjs in.glb out.glb [textureSize]'); process.exit(2); }
await MeshoptEncoder.ready;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(inPath);
const root = doc.getRoot();
for (const a of root.listAnimations()) { for (const c of a.listChannels()) c.dispose(); for (const s of a.listSamplers()) s.dispose(); a.dispose(); }
await doc.transform(
    dedup(), prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [Number(texSize), Number(texSize)], quality: 82 }),
    reorder({ encoder: MeshoptEncoder }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(outPath, doc);
const skin = root.listSkins()[0];
console.log(JSON.stringify({ out: outPath, joints: skin ? skin.listJoints().length : 0 }));
