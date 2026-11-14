// wheels.mjs <model.glb> [all] — find the wheels of a Meshy vehicle (see game-135/dev/assets/README.md).
// A wheel is a ring of dark (tyre) vertices standing on the ground. For each place the tyres touch the ground, the
// radius whose rim is best covered by vertices all the way round is the wheel; its z extent gives the two sides.
// `all` drops the darkness test (a steel roller drum). Prints [{ x, y, r, z0, z1 }] in the model's own units.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const ALL = process.argv[3] === 'all';
const pts = [];
for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const M = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION'), uv = prim.getAttribute('TEXCOORD_0');
        const { data, info } = await sharp(Buffer.from(prim.getMaterial().getBaseColorTexture().getImage())).raw().toBuffer({ resolveWithObject: true });
        const p = [0, 0, 0], t = [0, 0];
        for (let i = 0; i < pos.getCount(); i++) {
            pos.getElement(i, p); uv.getElement(i, t);
            const x = M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], y = M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], z = M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14];
            const px = Math.min(info.width - 1, Math.max(0, Math.floor(t[0] * info.width))), py = Math.min(info.height - 1, Math.max(0, Math.floor(t[1] * info.height)));
            const o = (py * info.width + px) * info.channels;
            if (ALL || (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) / 255 < 0.22) pts.push({ x, y, z });
        }
    }
}
// where tyres touch the ground, clustered along x
const low = pts.filter((p) => p.y < 0.035).map((p) => p.x).sort((a, b) => a - b);
const groups = [];
for (const x of low) { const g = groups[groups.length - 1]; if (g && x - g[g.length - 1] < 0.05) g.push(x); else groups.push([x]); }
const out = [];
for (const g of groups.filter((g) => g.length >= 6)) {
    const cx = (g[0] + g[g.length - 1]) / 2;
    let best = null;
    for (let r = 0.07; r <= 0.5; r += 0.004) {
        const bins = new Set(); let n = 0;
        for (const p of pts) { const d = Math.hypot(p.x - cx, p.y - r); if (Math.abs(d - r) < 0.014) { bins.add(Math.floor((Math.atan2(p.y - r, p.x - cx) + Math.PI) / (2 * Math.PI) * 36)); n++; } }
        const cover = bins.size / 36;
        if (!best || cover > best.cover + 0.02 || (cover >= best.cover - 0.02 && r > best.r && cover > 0.85)) best = { r, cover, n };
    }
    if (best.cover < 0.8) { console.error('  (no clean ring at x', cx.toFixed(2), 'cover', best.cover.toFixed(2), ')'); continue; }
    const rim = pts.filter((p) => Math.abs(Math.hypot(p.x - cx, p.y - best.r) - best.r) < 0.02);
    for (const side of [-1, 1]) {
        const zs = rim.filter((p) => p.z * side > 0.02).map((p) => p.z);
        if (zs.length < 12) continue;
        out.push({ x: +cx.toFixed(3), y: +best.r.toFixed(3), r: +best.r.toFixed(3), z0: +Math.min(...zs).toFixed(3), z1: +Math.max(...zs).toFixed(3) });
    }
}
console.log(JSON.stringify(out));
