// The shape of the cave under the well: a rounded cavern whose floor is flat
// and whose walls rise into a dome, a brick-lined shaft up through the dome's
// southern side (the way you came down), and the bowl of the pool. Pure
// geometry; grotto.js dresses it.

import * as THREE from 'three';
import { fbm2, smoothstep, clamp, lerp, TAU } from './util.js';
import { C, shellMaterial, brickTexture } from './grotto-kit.js';

export const CAVE = { rx: 14.6, rz: 11.9, ry: 9.4 };
export const LAND = { x: 0, z: 7.4 };            // the foot of the shaft, where the rope hangs
export const POOL = { x: -6.3, z: -0.9, r: 2.8, y: -0.17 };
export const SHAFT_R = 1.05;
export const PLAYER_MARGIN = 1.1;

/** The wall's radius in direction th (th = 0 is +z, the way the shaft side lies). */
export function wallR(th) {
    const e = 1 / Math.hypot(Math.sin(th) / CAVE.rx, Math.cos(th) / CAVE.rz);
    return e * (1 + 0.085 * Math.sin(3 * th + 0.7) + 0.05 * Math.sin(5 * th + 2.1) + 0.03 * Math.sin(8 * th + 0.3));
}

/** Is (x, z) on the cave floor, at least `margin` from the wall? */
export function insideCave(x, z, margin = PLAYER_MARGIN) {
    return Math.hypot(x, z) < wallR(Math.atan2(x, z)) - margin;
}

/** Height of the dome overhead at (x, z), roughly (decorations hang a little below it). */
export function ceilingAt(x, z) {
    const r = Math.hypot(x, z) / wallR(Math.atan2(x, z));
    return CAVE.ry * Math.sqrt(Math.max(0, 1 - r * r));
}

const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), P2 = new THREE.Vector3();

/** The cave's surface at longitude th (0..TAU) and latitude ph (-PI/2 floor centre .. PI/2 apex). */
export function shellPoint(th, ph, out) {
    const ca = Math.cos(ph), sa = Math.sin(ph);
    const R = wallR(th);
    let rho = R * ca;
    let y = ph > 0 ? CAVE.ry * sa : 0;
    // the floor curls up into the wall
    if (ph <= 0) y = 0.5 * smoothstep(0.9, 1.0, ca) ** 2;
    let x = Math.sin(th) * rho, z = Math.cos(th) * rho;
    if (ph > 0) {
        const k = smoothstep(0.0, 0.3, ph);
        const n = fbm2(x * 0.17 + y * 0.21, z * 0.17 - y * 0.18, 4) * 1.6 + fbm2(x * 0.5 + 9.1, z * 0.5 - y * 0.4, 2) * 0.35;
        const s = 1 + (n * k) / Math.max(4, R * 0.55);
        x *= s;
        z *= s;
        y *= 1 + (n * k * 0.5) / CAVE.ry;
    }
    return out.set(x, y, z);
}

export function shellNormal(th, ph, out) {
    const e = 0.004;
    const lo = Math.max(-Math.PI / 2, ph - e), hi = Math.min(Math.PI / 2, ph + e);
    shellPoint(th + e, ph, P0).sub(shellPoint(th - e, ph, P1));
    shellPoint(th, hi, P2).sub(shellPoint(th, lo, P1));
    out.crossVectors(P2, P0);
    // at the two poles the longitude means nothing: the floor's middle faces down (out of the cave), the apex up
    if (out.lengthSq() < 1e-12) return out.set(0, ph < 0 ? -1 : 1, 0);
    out.normalize();
    // outward: away from the middle of the cave
    shellPoint(th, ph, P1);
    if (out.dot(P1.set(P1.x, P1.y - 3, P1.z)) < 0) out.negate();
    return out;
}

/** The cave's rock: one mesh, vertex-coloured, with the shaft and pool cut out by the shader. */
export function buildShell(u, detail = 1) {
    const NL = Math.round(128 * detail), NV = Math.round(48 * detail);
    const pos = [], nor = [], col = [], idx = [];
    const p = new THREE.Vector3(), n = new THREE.Vector3(), c = new THREE.Color();
    const low = C('#9bb2bc'), high = C('#5d7396'), moss = C('#58a876'), floorC = C('#86a69c'), damp = C('#3a6068');
    for (let j = 0; j <= NV; j++) {
        const ph = -Math.PI / 2 + (j / NV) * Math.PI;
        for (let i = 0; i <= NL; i++) {
            const th = (i / NL) * TAU;
            shellPoint(th, ph, p);
            shellNormal(th, ph, n);
            pos.push(p.x, p.y, p.z);
            nor.push(n.x, n.y, n.z);
            const h = clamp(p.y / CAVE.ry, 0, 1);
            const mottle = fbm2(p.x * 0.35 + 3.3, p.z * 0.35 - p.y * 0.3, 3) * 0.5 + 0.5;
            if (ph <= 0) {
                c.copy(floorC).lerp(damp, clamp(1 - Math.hypot(p.x - POOL.x, p.z - POOL.z) / 9, 0, 1) * 0.8).lerp(moss, mottle * 0.45);
            } else {
                c.copy(low).lerp(high, smoothstep(0.05, 0.75, h));
                c.lerp(moss, (1 - smoothstep(0.0, 0.2, h)) * mottle * 0.7);
                c.multiplyScalar(0.7 + mottle * 0.5);
            }
            col.push(c.r, c.g, c.b);
        }
    }
    for (let j = 0; j < NV; j++) {
        for (let i = 0; i < NL; i++) {
            const a = j * (NL + 1) + i, b = a + 1, d = a + NL + 1, e = d + 1;
            // front faces point out of the cave: the material draws their backs, which is what you see from inside
            idx.push(a, b, d, b, e, d);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, shellMaterial(u));
    mesh.frustumCulled = false;
    return mesh;
}

/** The bowl under the pool's water: sloped sides of wet dark rock down to a hollow. */
export function buildBasin() {
    const R = POOL.r + 0.1;
    const prof = [[R + 0.35, 0.05], [R, -0.03], [R - 0.12, -0.4], [R * 0.78, -0.85], [R * 0.5, -1.2], [R * 0.2, -1.38], [0.001, -1.4]];
    const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 36);
    const pos = g.attributes.position, col = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const k = clamp(-y / 1.4, 0, 1);
        const n = fbm2(pos.getX(i) * 1.1, pos.getZ(i) * 1.1, 3) * 0.5 + 0.5;
        c.set('#35564c').lerp(C('#071c24'), k).multiplyScalar(0.6 + n * 0.6);
        col.push(c.r, c.g, c.b);
        pos.setXYZ(i, pos.getX(i), y + fbm2(pos.getX(i) * 0.9 + 4, pos.getZ(i) * 0.9, 2) * 0.08, pos.getZ(i));
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }));
    m.position.set(POOL.x, 0, POOL.z);
    return m;
}

/** The brick-lined shaft from the cave's ceiling up to the garden, with a beam across its top. */
export function buildShaft(top) {
    const g = new THREE.Group();
    const y0 = ceilingAt(LAND.x, LAND.z) - 1.8;
    const H = top - y0;
    const tex = brickTexture();
    tex.repeat.set(3, H / 3.2);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(SHAFT_R + 0.02, SHAFT_R + 0.02, H, 28, 1, true), new THREE.MeshStandardMaterial({ map: tex, color: 0xb8c4bd, roughness: 0.95, side: THREE.BackSide, emissive: 0x0b1a14, emissiveIntensity: 0.7 }));
    tube.position.set(LAND.x, y0 + H / 2, LAND.z);
    g.add(tube);
    // tree roots and lichen on its lower reaches would hide the join with the cave; a collar of rough stone does it
    const collar = new THREE.Mesh(new THREE.TorusGeometry(SHAFT_R + 0.12, 0.2, 7, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b7a72, roughness: 0.95 }));
    collar.position.set(LAND.x, y0 + 0.2, LAND.z);
    g.add(collar);
    // the beam the rope hangs from
    const beam = new THREE.Mesh(new THREE.BoxGeometry(SHAFT_R * 2 + 0.5, 0.2, 0.22), new THREE.MeshStandardMaterial({ color: 0x4a3828, roughness: 0.9, emissive: 0x1a1006, emissiveIntensity: 0.6 }));
    beam.position.set(LAND.x, top - 0.5, LAND.z);
    g.add(beam);
    return { group: g, y0, top, tube };
}
