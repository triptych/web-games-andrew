// Flagstone ribbons that follow each path's centreline over the terrain,
// with a low granite curb on both edges.

import * as THREE from 'three';
import { PATH_HALF, PAVILION_PLAZA } from './layout.js';
import { flagstones } from './textures.js';

const ACROSS = 6; // vertices across the ribbon

function ribbon(island, pts, sFrom, sTo, half, lift, crown, uvScale) {
    const pos = [], uv = [], idx = [];
    const rows = [];
    for (let i = 0; i < pts.length; i++) {
        if (pts[i].s < sFrom - 0.5 || pts[i].s > sTo + 0.5) continue;
        rows.push(i);
    }
    rows.forEach((i, r) => {
        const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
        let tx = b.x - a.x, tz = b.z - a.z;
        const l = Math.hypot(tx, tz) || 1;
        tx /= l; tz /= l;
        const nx = -tz, nz = tx;
        const p = pts[i];
        for (let k = 0; k < ACROSS; k++) {
            const u = k / (ACROSS - 1) * 2 - 1;
            const x = p.x + nx * u * half, z = p.z + nz * u * half;
            const y = island.heightAt(x, z) + lift + crown * (1 - u * u);
            pos.push(x, y, z);
            uv.push((u * half) / uvScale, p.s / uvScale);
        }
        if (r > 0) {
            const a0 = (r - 1) * ACROSS, b0 = r * ACROSS;
            for (let k = 0; k < ACROSS - 1; k++) idx.push(a0 + k, a0 + k + 1, b0 + k, a0 + k + 1, b0 + k + 1, b0 + k);
        }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

/** Curb: a small box section swept along one edge. */
function curb(island, pts, sFrom, sTo, offset) {
    const pos = [], idx = [], uv = [];
    const prof = [[-0.12, 0], [-0.12, 0.13], [-0.06, 0.18], [0.06, 0.18], [0.12, 0.13], [0.12, 0]];
    let r = 0;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p.s < sFrom || p.s > sTo) continue;
        const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)];
        let tx = b.x - a.x, tz = b.z - a.z;
        const l = Math.hypot(tx, tz) || 1;
        tx /= l; tz /= l;
        const nx = -tz, nz = tx;
        const cx = p.x + nx * offset, cz = p.z + nz * offset;
        const gy = island.heightAt(cx, cz) - 0.04;
        for (const [o, h] of prof) {
            pos.push(cx + nx * o, gy + h, cz + nz * o);
            uv.push(o * 2, p.s * 0.5);
        }
        if (r > 0) {
            const a0 = (r - 1) * prof.length, b0 = r * prof.length;
            for (let k = 0; k < prof.length - 1; k++) idx.push(a0 + k, a0 + k + 1, b0 + k, a0 + k + 1, b0 + k + 1, b0 + k);
        }
        r++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

export function buildPaths(world) {
    const { island, layout, mats, root } = world;
    const fl = flagstones();
    const mat = new THREE.MeshStandardMaterial({ map: fl.map, normalMap: fl.normalMap, roughness: 0.82, color: 0xf2eadc, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const geos = [], curbs = [];
    // spoke paths start under the hub rim and stop at the pavilion plaza
    for (const sp of layout.spokes) {
        const s0 = 0.4, s1 = sp.length - PAVILION_PLAZA + 0.4;
        geos.push(ribbon(island, sp.pts, s0, s1, PATH_HALF, 0.05, 0.04, 3.2));
        for (const side of [-1, 1]) curbs.push(curb(island, sp.pts, s0 + 1.2, s1 - 0.5, side * (PATH_HALF + 0.1)));
    }
    const dk = layout.dock.pts;
    const dEnd = dk[dk.length - 1].s;
    geos.push(ribbon(island, dk, 0.4, dEnd, PATH_HALF, 0.05, 0.04, 3.2));
    for (const side of [-1, 1]) curbs.push(curb(island, dk, 1.6, dEnd - 1.2, side * (PATH_HALF + 0.1)));

    for (const g of geos) {
        const m = new THREE.Mesh(g, mat);
        m.receiveShadow = true;
        root.add(m);
    }
    for (const g of curbs) {
        const m = new THREE.Mesh(g, mats.granite);
        m.receiveShadow = true;
        m.castShadow = false;
        root.add(m);
    }
}
