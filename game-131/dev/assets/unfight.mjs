// unfight.mjs [--fix] <file.glb ...> — find triangles that lie in the same plane and overlap: they z-fight.
//
// Meshy closes thin parts (leaves, nets, planks) with two faces back to back in one plane. Drawn double-sided,
// as its materials ask, each pair fights for the same pixels. The game draws every model single-sided instead
// (js/view/props.js), which settles those. What is left is pairs facing the SAME way (water just over a basin, a
// label on a barrel): --fix lifts the outer face of each such pair a hair along its normal and rewrites the file.
//
//   node unfight.mjs ../../assets/models/*.glb            # report
//   node unfight.mjs --fix ../../assets/models/*.glb      # report, nudge, rewrite
//   LIFT=0.012 node unfight.mjs --fix cistern.glb         # a bigger gap, as a share of the model's size (default 0.004)
// Fix a model once, from its freshly shrunk file: each run lifts again, and stacked layers only shuffle.
// Run in a folder with @gltf-transform/core, /functions and /extensions installed (see README.md).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, quantize } from '@gltf-transform/functions';

const args = process.argv.slice(2), FIX = args[0] === '--fix', files = FIX ? args.slice(1) : args;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function pairs(prim) {
    const P = prim.getAttribute('POSITION'), I = prim.getIndices();
    const n = I ? I.getCount() / 3 : P.getCount() / 3, at = (i) => (I ? I.getScalar(i) : i);
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < P.getCount(); i++) { const e = P.getElement(i, []); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], e[k]); hi[k] = Math.max(hi[k], e[k]); } }
    const size = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), eps = size * 0.0015;
    const T = [];
    for (let t = 0; t < n; t++) {
        const ia = at(t * 3), ib = at(t * 3 + 1), ic = at(t * 3 + 2), a = P.getElement(ia, []), b = P.getElement(ib, []), c = P.getElement(ic, []);
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0];
        const l = Math.hypot(nx, ny, nz);
        if (l < 1e-12) continue;
        nx /= l; ny /= l; nz /= l;
        T.push({ v: [ia, ib, ic], a, b, c, n: [nx, ny, nz], d: nx * a[0] + ny * a[1] + nz * a[2], cen: [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3] });
    }
    const inside = (p, t) => {
        const s = (u, w) => { const x = [w[0] - u[0], w[1] - u[1], w[2] - u[2]], y = [p[0] - u[0], p[1] - u[1], p[2] - u[2]]; return (x[1] * y[2] - x[2] * y[1]) * t.n[0] + (x[2] * y[0] - x[0] * y[2]) * t.n[1] + (x[0] * y[1] - x[1] * y[0]) * t.n[2]; };
        const s1 = s(t.a, t.b), s2 = s(t.b, t.c), s3 = s(t.c, t.a);
        return (s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0);
    };
    const back = [], same = [];
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
        const A = T[i], B = T[j], dot = A.n[0] * B.n[0] + A.n[1] * B.n[1] + A.n[2] * B.n[2];
        if (Math.abs(dot) < 0.9995) continue;
        const off = A.n[0] * B.cen[0] + A.n[1] * B.cen[1] + A.n[2] * B.cen[2] - A.d;      // how far B sits in front of A
        if (Math.abs(off) > eps || !(inside(B.cen, A) || inside(A.cen, B))) continue;
        (dot < 0 ? back : same).push({ A, B, off });
    }
    return { back, same, size, P };
}

for (const f of files) {
    const doc = await io.read(f);
    await doc.transform(dequantize());
    let back = 0, same = 0, moved = 0;
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
        const r = pairs(prim);
        back += r.back.length; same += r.same.length;
        if (!FIX || !r.same.length) continue;
        // lift every vertex of the outer face of each same-facing pair, once, along that face's normal
        const lift = r.size * +(process.env.LIFT || 0.004), done = new Set();
        for (const { A, B, off } of r.same) {
            const outer = off >= 0 ? B : A;
            for (const vi of outer.v) {
                if (done.has(vi)) continue;
                done.add(vi);
                const p = r.P.getElement(vi, []);
                r.P.setElement(vi, [p[0] + outer.n[0] * lift, p[1] + outer.n[1] * lift, p[2] + outer.n[2] * lift]);
            }
        }
        moved += done.size;
    }
    console.log(`${f.split('/').pop().padEnd(16)} back-to-back ${String(back).padStart(4)}   same-facing ${String(same).padStart(4)}${moved ? `   lifted ${moved} vertices` : ''}`);
    if (FIX && moved) { await doc.transform(quantize()); await io.write(f, doc); }
}
