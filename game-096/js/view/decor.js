// Scenery: palms, rocks, castles, lighthouses, boats, coral and clouds. All of it is placed from the
// level's own seed and is never part of the simulation, so it can look as lush as it likes. Static
// pieces go into one merged mesh; a few things that move are returned separately.

import { THREE, G, Merger, toon, mesh, shade, mix, glowSprite, vcMat } from './kit.js';
import { makeRng, hash3 } from '../rng.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _d = new THREE.Vector3();

/** A unit cylinder stretched between two points. */
function rod(M, color, ax, ay, az, bx, by, bz, ra, rb = ra) {
    _d.set(bx - ax, by - ay, bz - az);
    const len = _d.length() || 0.001;
    _q.setFromUnitVectors(UP, _d.normalize());
    _v.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    _s.set((ra + rb) / 2, len, (ra + rb) / 2);
    _m.compose(_v, _q, _s);
    M.add(G.cyl(rb / ((ra + rb) / 2), ra / ((ra + rb) / 2), 1, 7), color, _m);
}

// ---------------------------------------------------------------- pieces
export function palm(M, x, y, z, s, rng, o = {}) {
    const trunk = o.trunk ?? 0xa87848, leaves = o.leaves ?? [0x2f9a46, 0x4cc25a];
    const lean = 0.25 + rng() * 0.6, dir = rng() * TAU, h = (3.4 + rng() * 1.2) * s, segs = 6;
    let px = x, py = y, pz = z;
    for (let i = 1; i <= segs; i++) {
        const t = i / segs, bend = lean * t * t * h * 0.6;
        const nx = x + Math.cos(dir) * bend, ny = y + t * h, nz = z + Math.sin(dir) * bend;
        rod(M, i % 2 ? trunk : shade(trunk, 0.88), px, py, pz, nx, ny, nz, 0.2 * s * (1.1 - (i - 1) / segs * 0.4), 0.2 * s * (1.1 - i / segs * 0.4));
        px = nx; py = ny; pz = nz;
    }
    const n = 8;
    for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rng() * 0.3, len = (1.7 + rng() * 0.5) * s;
        const ex = px + Math.cos(a) * len, ez = pz + Math.sin(a) * len, ey = py - 0.5 * s + (i % 2) * 0.25 * s;
        const mx = px + Math.cos(a) * len * 0.5, mz = pz + Math.sin(a) * len * 0.5, my = py + 0.5 * s;
        rod(M, leaves[i % 2], px, py, pz, mx, my, mz, 0.12 * s, 0.1 * s);
        // a flat blade of leaf
        _d.set(ex - mx, ey - my, ez - mz); const l = _d.length();
        _q.setFromUnitVectors(UP, _d.normalize());
        _v.set((mx + ex) / 2, (my + ey) / 2, (mz + ez) / 2);
        _s.set(0.42 * s, l, 0.06);
        _m.compose(_v, _q, _s);
        M.add(G.cone(1, 1, 4), leaves[i % 2], _m);
    }
    for (let i = 0; i < 3; i++) M.put(G.sphere(0.17 * s, 7, 5), 0x6b4426, px + Math.cos(i * 2.1) * 0.22 * s, py - 0.22 * s, pz + Math.sin(i * 2.1) * 0.22 * s);
}

export function rock(M, x, y, z, s, rng, c = 0x9aa3ad) {
    const col = shade(c, 0.88 + rng() * 0.25);
    M.put(G.sphere(1, 7, 5), col, x, y + 0.35 * s, z, s * (0.9 + rng() * 0.4), s * (0.55 + rng() * 0.3), s * (0.8 + rng() * 0.4), 0, rng() * 3, 0);
    if (rng() > 0.5) M.put(G.sphere(1, 6, 4), shade(col, 1.12), x + s * 0.7, y + 0.2 * s, z + s * 0.2, s * 0.5, s * 0.35, s * 0.5);
}

export function shellDecor(M, x, y, z, s, rng) {
    const c = [0xffb6c9, 0xfff0d8, 0xffd28a, 0xc9b6ff][Math.floor(rng() * 4)];
    M.put(G.cone(0.2 * s, 0.4 * s, 7), c, x, y + 0.2 * s, z, 1, 1, 1, 0, rng() * 3, 0.5);
    M.put(G.torus(0.14 * s, 0.05 * s, 5, 10), shade(c, 0.9), x, y + 0.12 * s, z, 1, 1, 1, Math.PI / 2);
}

export function umbrella(M, x, y, z, s, rng) {
    rod(M, 0xf6f0e0, x, y, z, x, y + 2.3 * s, z, 0.04 * s);
    const cols = [0xff6b6b, 0xfff4d6];
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        M.put(G.cone(0.9 * s, 0.45 * s, 4), cols[i % 2], x, y + 2.35 * s, z, 0.6, 1, 0.6, 0, a, 0);
    }
    M.put(G.cone(1.05 * s, 0.5 * s, 8), 0xff6b6b, x, y + 2.35 * s, z, 1, 1, 1);
}

export function sandcastle(M, x, y, z, s, rng) {
    const c = 0xe9c77e, c2 = 0xf6dc9c;
    M.put(G.cyl(0.7 * s, 0.8 * s, 0.7 * s, 10), c, x, y + 0.35 * s, z);
    M.put(G.cyl(0.4 * s, 0.5 * s, 0.9 * s, 10), c2, x, y + 1.15 * s, z);
    M.put(G.cone(0.5 * s, 0.6 * s, 10), 0xff8a6b, x, y + 1.9 * s, z);
    rod(M, 0xf6f0e0, x, y + 2.1 * s, z, x, y + 2.7 * s, z, 0.02 * s);
    M.put(G.box(0.4 * s, 0.22 * s, 0.02), 0xff6b6b, x + 0.2 * s, y + 2.55 * s, z);
}

export function tower(M, x, y, z, s, rng, wall = 0xe2c07a, roof = 0xff7a6b) {
    M.put(G.cyl(1.1 * s, 1.3 * s, 5 * s, 12), wall, x, y + 2.5 * s, z);
    M.put(G.cyl(1.35 * s, 1.35 * s, 0.4 * s, 12), shade(wall, 1.1), x, y + 5.1 * s, z);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; M.put(G.box(0.5 * s, 0.5 * s, 0.5 * s), shade(wall, 1.1), x + Math.cos(a) * 1.25 * s, y + 5.6 * s, z + Math.sin(a) * 1.25 * s, 1, 1, 1, 0, -a, 0); }
    M.put(G.cone(1.2 * s, 1.8 * s, 12), roof, x, y + 6.6 * s, z);
    rod(M, 0xf6f0e0, x, y + 7.5 * s, z, x, y + 8.6 * s, z, 0.04 * s);
    M.put(G.box(0.8 * s, 0.45 * s, 0.04), 0xffd34d, x + 0.4 * s, y + 8.35 * s, z);
    for (let i = 0; i < 3; i++) M.put(G.box(0.22 * s, 0.5 * s, 0.1), 0x3a2a1a, x + Math.cos(i * 2) * 1.12 * s, y + (2 + i * 1.1) * s, z + Math.sin(i * 2) * 1.12 * s, 1, 1, 1, 0, -i * 2, 0);
}

export function wallPiece(M, x, y, z, w, s, rotY, wall = 0xe2c07a) {
    M.put(G.box(w, 2 * s, 0.9 * s), wall, x, y + s, z, 1, 1, 1, 0, rotY, 0);
    const n = Math.floor(w / (0.9 * s));
    for (let i = 0; i < n; i += 2) {
        const o = -w / 2 + (i + 0.5) * (w / n);
        M.put(G.box(0.55 * s, 0.5 * s, 0.9 * s), shade(wall, 1.08), x + Math.cos(rotY) * o, y + 2.25 * s, z - Math.sin(rotY) * o, 1, 1, 1, 0, rotY, 0);
    }
}

export function lighthouse(M, x, y, z, s) {
    const segs = 6;
    for (let i = 0; i < segs; i++) {
        const r0 = 2.3 - i * 0.22, r1 = 2.3 - (i + 1) * 0.22;
        M.put(G.cyl(r1 * s, r0 * s, 3 * s, 14), i % 2 ? 0xe94b4b : 0xfaf4e8, x, y + (i + 0.5) * 3 * s, z);
    }
    const top = y + segs * 3 * s;
    M.put(G.cyl(1.6 * s, 1.5 * s, 0.35 * s, 14), 0x444b58, x, top + 0.17 * s, z);
    M.put(G.cyl(1.0 * s, 1.0 * s, 1.5 * s, 12), 0xfff3b0, x, top + 1.1 * s, z);
    M.put(G.cone(1.5 * s, 1.2 * s, 12), 0xe94b4b, x, top + 2.45 * s, z);
    M.put(G.sphere(0.2 * s, 8, 6), 0xffd34d, x, top + 3.2 * s, z);
    M.put(G.box(0.9 * s, 1.4 * s, 0.2 * s), 0x3a2a1a, x, y + 0.7 * s, z - 2.2 * s);
    return top + 1.1 * s;
}

export function boat(M, x, y, z, s, rotY, rng) {
    const hull = 0xb8743a;
    M.put(G.box(1.4 * s, 0.6 * s, 3.4 * s), hull, x, y + 0.15 * s, z, 1, 1, 1, 0, rotY, 0);
    const cx = Math.sin(rotY), cz = Math.cos(rotY);
    M.put(G.cone(0.7 * s, 1.0 * s, 4), hull, x + cx * 1.9 * s, y + 0.15 * s, z + cz * 1.9 * s, 1, 1, 0.8, Math.PI / 2, rotY, 0);
    rod(M, 0xf6f0e0, x, y + 0.4 * s, z, x, y + 3.8 * s, z, 0.06 * s);
    const sail = [0xfff4d6, 0xff8a6b, 0x6bb6ff][Math.floor(rng() * 3)];
    M.put(G.cone(1.1 * s, 3 * s, 3), sail, x - cz * 0.1 * s, y + 2.2 * s, z + cx * 0.1 * s, 1, 1, 0.12, 0, rotY, 0);
}

export function coral(M, x, y, z, s, rng) {
    const cols = [0xff7aa8, 0xff9a62, 0xc08aff, 0xffd34d, 0x5ee8c8];
    const c = cols[Math.floor(rng() * cols.length)];
    const n = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rng(), h = (0.8 + rng() * 1.3) * s;
        rod(M, c, x, y, z, x + Math.cos(a) * 0.5 * s, y + h, z + Math.sin(a) * 0.5 * s, 0.14 * s, 0.07 * s);
        M.put(G.sphere(0.14 * s, 6, 5), shade(c, 1.15), x + Math.cos(a) * 0.5 * s, y + h, z + Math.sin(a) * 0.5 * s);
    }
}

export function anemone(M, x, y, z, s, rng) {
    const c = [0xff6bb5, 0xffb347, 0x8aff9a][Math.floor(rng() * 3)];
    M.put(G.cyl(0.25 * s, 0.32 * s, 0.4 * s, 8), shade(c, 0.8), x, y + 0.2 * s, z);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; rod(M, c, x + Math.cos(a) * 0.1 * s, y + 0.4 * s, z + Math.sin(a) * 0.1 * s, x + Math.cos(a) * 0.4 * s, y + 0.95 * s, z + Math.sin(a) * 0.4 * s, 0.07 * s, 0.03 * s); }
}

export function fern(M, x, y, z, s, rng) {
    const c = [0x2f9a46, 0x4cc25a, 0x7fd857][Math.floor(rng() * 3)];
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + rng() * 0.4;
        _d.set(Math.cos(a) * 0.8, 0.7, Math.sin(a) * 0.8).multiplyScalar(s);
        _q.setFromUnitVectors(UP, _d.clone().normalize());
        _v.set(x + _d.x / 2, y + _d.y / 2, z + _d.z / 2);
        _s.set(0.28 * s, _d.length(), 0.05);
        _m.compose(_v, _q, _s);
        M.add(G.cone(1, 1, 4), c, _m);
    }
}

export function mushroom(M, x, y, z, s, rng) {
    const c = [0xff6b6b, 0xffb347, 0xc08aff][Math.floor(rng() * 3)];
    M.put(G.cyl(0.14 * s, 0.18 * s, 0.5 * s, 7), 0xf6ecd8, x, y + 0.25 * s, z);
    M.put(new THREE.SphereGeometry(0.46 * s, 10, 6, 0, TAU, 0, Math.PI / 2), c, x, y + 0.5 * s, z);
    for (let i = 0; i < 3; i++) M.put(G.sphere(0.07 * s, 5, 4), 0xffffff, x + Math.cos(i * 2.1) * 0.25 * s, y + 0.75 * s, z + Math.sin(i * 2.1) * 0.25 * s);
}

export function jungleTree(M, x, y, z, s, rng) {
    rod(M, 0x7a5a38, x, y, z, x, y + 6 * s, z, 0.45 * s, 0.3 * s);
    for (let i = 0; i < 5; i++) {
        const a = rng() * TAU, r = (0.8 + rng() * 1.6) * s;
        M.put(G.sphere(1.5 * s, 8, 6), i % 2 ? 0x2f9a46 : 0x3dbb56, x + Math.cos(a) * r, y + (5.6 + rng() * 1.4) * s, z + Math.sin(a) * r, 1, 0.7, 1);
    }
    for (let i = 0; i < 4; i++) { const a = rng() * TAU; rod(M, 0x4cc25a, x + Math.cos(a) * 1.6 * s, y + 5 * s, z + Math.sin(a) * 1.6 * s, x + Math.cos(a) * 1.7 * s, y + (2.4 + rng()) * s, z + Math.sin(a) * 1.7 * s, 0.05 * s); }
}

export function tiki(M, x, y, z, s, rotY) {
    M.put(G.box(0.9 * s, 2.6 * s, 0.9 * s), 0x7a4a2a, x, y + 1.3 * s, z, 1, 1, 1, 0, rotY, 0);
    const fx = -Math.sin(rotY) * 0.46 * s, fz = -Math.cos(rotY) * 0.46 * s;
    M.put(G.box(0.7 * s, 0.35 * s, 0.1), 0xffd34d, x + fx, y + 2.0 * s, z + fz, 1, 1, 1, 0, rotY, 0);
    for (const sd of [-1, 1]) M.put(G.sphere(0.12 * s, 6, 5), 0xffffff, x + fx + Math.cos(rotY) * sd * 0.2 * s, y + 1.6 * s, z + fz - Math.sin(rotY) * sd * 0.2 * s);
    M.put(G.box(0.4 * s, 0.14 * s, 0.1), 0xe94b4b, x + fx * 1.05, y + 1.25 * s, z + fz * 1.05, 1, 1, 1, 0, rotY, 0);
}

export function barrelStack(M, x, y, z, s, rng) {
    const c = 0xb8743a;
    const one = (bx, by, bz) => { M.put(G.cyl(0.46 * s, 0.4 * s, 0.9 * s, 10), c, bx, by + 0.45 * s, bz); M.put(G.torus(0.45 * s, 0.03 * s, 4, 12), 0x4b5563, bx, by + 0.45 * s, bz, 1, 1, 1, Math.PI / 2); };
    one(x, y, z); one(x + 0.95 * s, y, z + 0.2 * s); one(x + 0.45 * s, y + 0.9 * s, z + 0.1 * s);
}

export function crateStack(M, x, y, z, s, rng) {
    const c = 0xd9a15c;
    M.put(G.box(0.9 * s, 0.9 * s, 0.9 * s), c, x, y + 0.45 * s, z, 1, 1, 1, 0, rng() * 0.5, 0);
    M.put(G.box(0.8 * s, 0.8 * s, 0.8 * s), shade(c, 0.92), x + 0.9 * s, y + 0.4 * s, z + 0.2 * s, 1, 1, 1, 0, rng(), 0);
    M.put(G.box(0.7 * s, 0.7 * s, 0.7 * s), shade(c, 1.05), x + 0.4 * s, y + 1.2 * s, z + 0.1 * s, 1, 1, 1, 0, rng() * 0.8, 0);
}

export function lampPost(M, x, y, z, s) {
    rod(M, 0x3a4350, x, y, z, x, y + 3.2 * s, z, 0.07 * s);
    M.put(G.sphere(0.24 * s, 8, 6), 0xfff3b0, x, y + 3.35 * s, z);
    M.put(G.cone(0.34 * s, 0.25 * s, 8), 0x3a4350, x, y + 3.65 * s, z);
}

export function buoy(M, x, y, z, s) {
    M.put(G.sphere(0.45 * s, 9, 7), 0xff5b5b, x, y + 0.25 * s, z, 1, 1.1, 1);
    M.put(G.cyl(0.46 * s, 0.46 * s, 0.14 * s, 10), 0xffffff, x, y + 0.3 * s, z);
    rod(M, 0x4b5563, x, y + 0.6 * s, z, x, y + 1.0 * s, z, 0.04 * s);
    M.put(G.sphere(0.1 * s, 5, 4), 0xffd34d, x, y + 1.05 * s, z);
}

export function driftwood(M, x, y, z, s, rng) {
    const a = rng() * TAU;
    rod(M, 0xb99468, x - Math.cos(a) * 1.4 * s, y + 0.15, z - Math.sin(a) * 1.4 * s, x + Math.cos(a) * 1.4 * s, y + 0.2, z + Math.sin(a) * 1.4 * s, 0.17 * s, 0.13 * s);
}

export function starfishDecor(M, x, y, z, s, rng) {
    const c = [0xff8a3c, 0xff6bb5, 0xffd34d][Math.floor(rng() * 3)], r0 = rng() * TAU;
    for (let i = 0; i < 5; i++) { const a = r0 + (i / 5) * TAU; rod(M, c, x, y + 0.06, z, x + Math.cos(a) * 0.5 * s, y + 0.06, z + Math.sin(a) * 0.5 * s, 0.11 * s, 0.04 * s); }
    M.put(G.sphere(0.13 * s, 6, 4), shade(c, 1.1), x, y + 0.08, z, 1, 0.6, 1);
}

export function flowers(M, x, y, z, s, rng) {
    const cols = [0xff7aa8, 0xffd34d, 0xffffff, 0xc08aff];
    for (let i = 0; i < 4; i++) {
        const fx = x + (rng() - 0.5) * 0.9, fz = z + (rng() - 0.5) * 0.9;
        rod(M, 0x3fa84a, fx, y, fz, fx, y + 0.3 * s, fz, 0.025 * s);
        M.put(G.sphere(0.1 * s, 5, 4), cols[Math.floor(rng() * cols.length)], fx, y + 0.33 * s, fz);
    }
}

export function cloud(rng, color = 0xffffff) {
    const M = new Merger();
    const n = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) M.put(G.sphere(1, 9, 7), shade(color, 0.93 + rng() * 0.07), (i - n / 2) * 2.4 + rng(), rng() * 1.4, (rng() - 0.5) * 2.2, 2.4 + rng() * 1.8, 1.6 + rng() * 0.9, 2.2 + rng() * 1.2);
    M.put(G.box(n * 2.9, 0.5, 4), shade(color, 0.82), 0, -0.9, 0, 1, 1, 1);
    const g = M.build();
    const m = new THREE.Mesh(g, vcMat());
    return m;
}

// what may sit on a slab: low things anywhere, tall things only on wide slabs
const LOW = {
    beach: [(M, x, y, z, r) => shellDecor(M, x, y, z, 0.8 + r() * 0.6, r), (M, x, y, z, r) => starfishDecor(M, x, y, z, 0.8, r), (M, x, y, z, r) => flowers(M, x, y, z, 1, r), (M, x, y, z, r) => rock(M, x, y, z, 0.3 + r() * 0.2, r, 0xb8a888), (M, x, y, z, r) => flowers(M, x, y, z, 1, r)],
    jungle: [(M, x, y, z, r) => fern(M, x, y, z, 0.7 + r() * 0.4, r), (M, x, y, z, r) => mushroom(M, x, y, z, 0.7, r), (M, x, y, z, r) => flowers(M, x, y, z, 1, r), (M, x, y, z, r) => rock(M, x, y, z, 0.3, r, 0x8f9a8e)],
    pier: [(M, x, y, z, r) => rod(M, 0x3a2a1a, x, y, z, x, y + 0.7, z, 0.18, 0.2), (M, x, y, z, r) => rock(M, x, y, z, 0.25, r, 0x8a8f9a), (M, x, y, z, r) => shellDecor(M, x, y, z, 1, r)],
    castle: [(M, x, y, z, r) => starfishDecor(M, x, y, z, 0.8, r), (M, x, y, z, r) => shellDecor(M, x, y, z, 1, r), (M, x, y, z, r) => rock(M, x, y, z, 0.3, r, 0xe8d7a8), (M, x, y, z, r) => flowers(M, x, y, z, 1, r)],
    storm: [(M, x, y, z, r) => rock(M, x, y, z, 0.35, r, 0x8a90aa), (M, x, y, z, r) => shellDecor(M, x, y, z, 1, r), (M, x, y, z, r) => buoy(M, x, y, z, 0.5)],
    reef: [(M, x, y, z, r) => coral(M, x, y, z, 0.6 + r() * 0.3, r), (M, x, y, z, r) => anemone(M, x, y, z, 0.7, r), (M, x, y, z, r) => shellDecor(M, x, y, z, 1.2, r), (M, x, y, z, r) => starfishDecor(M, x, y, z, 1, r), (M, x, y, z, r) => flowers(M, x, y, z, 1, r)],
};
const TALL = {
    beach: [(M, x, y, z, r) => palm(M, x, y, z, 0.7 + r() * 0.3, r), (M, x, y, z, r) => umbrella(M, x, y, z, 0.7, r), (M, x, y, z, r) => sandcastle(M, x, y, z, 0.6, r)],
    jungle: [(M, x, y, z, r) => palm(M, x, y, z, 0.8 + r() * 0.3, r, { leaves: [0x1f8a3a, 0x3dbb56] }), (M, x, y, z, r, side) => tiki(M, x, y, z, 0.7, side * 0.6)],
    pier: [(M, x, y, z, r) => barrelStack(M, x, y, z, 0.8, r), (M, x, y, z, r) => crateStack(M, x, y, z, 0.8, r), (M, x, y, z, r) => lampPost(M, x, y, z, 0.9)],
    castle: [(M, x, y, z, r) => sandcastle(M, x, y, z, 0.7, r), (M, x, y, z, r, s, ax) => wallPiece(M, x, y, z, 2.2, 0.5, ax ? 0 : Math.PI / 2)],
    storm: [(M, x, y, z, r) => lampPost(M, x, y, z, 0.9), (M, x, y, z, r) => barrelStack(M, x, y, z, 0.7, r)],
    reef: [(M, x, y, z, r) => coral(M, x, y, z, 1.2, r), (M, x, y, z, r) => anemone(M, x, y, z, 1.1, r)],
};

// ---------------------------------------------------------------- the whole level
function rectDistTo(solids, x, z) {
    let d = Infinity;
    for (const b of solids) {
        const dx = Math.max(b.x0 - x, x - b.x1, 0), dz = Math.max(b.z0 - z, z - b.z1, 0);
        d = Math.min(d, Math.hypot(dx, dz));
    }
    return d;
}

export function buildDecor(level, theme) {
    const rng = makeRng(level.seed ^ 0x5eed);
    const M = new Merger();
    const out = { group: new THREE.Group(), clouds: [], beams: [], flags: [], lighthouseTop: null };
    const solids = level.solids;
    const wy = level.waterY;
    const kind = theme.decor;

    // ---- along the edges of the slabs
    for (let si = 0; si < solids.length; si++) {
        const b = solids[si];
        const w = b.x1 - b.x0, d = b.z1 - b.z0, y = b.y1;
        const long = Math.max(w, d), short = Math.min(w, d);
        const area = w * d;
        const count = Math.min(14, Math.floor(area / 18));
        for (let k = 0; k < count; k++) {
            const side = rng() < 0.5 ? -1 : 1;
            const alongX = w >= d;
            const t = rng();
            // sit on the outer margin of wide slabs only; narrow ones stay clean
            if (short < 4.8 && kind !== 'reef') continue;
            const inset = 0.55 + rng() * 0.2;
            const x = alongX ? b.x0 + 0.6 + t * (w - 1.2) : (side < 0 ? b.x0 + inset : b.x1 - inset);
            const z = alongX ? (side < 0 ? b.z0 + inset : b.z1 - inset) : b.z0 + 0.6 + t * (d - 1.2);
            // tall things only on broad slabs: a palm leaning over a narrow path blocks the camera
            const wide = short >= 7.5 && b.look !== 'arena';
            const set = (wide && rng() < 0.55 ? TALL : LOW)[kind];
            set[Math.floor(rng() * set.length)](M, x, y, z, rng, side, alongX);
        }
    }

    // ---- sea stacks, buoys and driftwood in the water beside the path
    const bounds = level.bounds;
    const place = (n, minD, maxD, fn) => {
        let tries = 0;
        while (n > 0 && tries++ < n * 40 + 200) {
            const b = solids[Math.floor(rng() * solids.length)];
            const a = rng() * TAU, r = minD + rng() * (maxD - minD);
            const x = (b.x0 + b.x1) / 2 + Math.cos(a) * ((b.x1 - b.x0) / 2 + r), z = (b.z0 + b.z1) / 2 + Math.sin(a) * ((b.z1 - b.z0) / 2 + r);
            if (rectDistTo(solids, x, z) < minD * 0.9) continue;
            fn(x, z); n--;
        }
    };
    const nearN = Math.ceil(solids.length * 1.4);
    // little islets with trees close by, so the path has company without anything leaning into the camera
    const islet = (x, z, s) => {
        const top = kind === 'jungle' ? 0x6fd05a : kind === 'castle' || kind === 'beach' ? 0xfff0b8 : kind === 'reef' ? 0xffd0dc : 0xb5bad8;
        const base = kind === 'jungle' ? 0x7a5a38 : kind === 'reef' ? 0xff9db4 : kind === 'storm' ? 0x8a8fa8 : 0xf0d49a;
        M.put(G.cyl(2.4 * s, 3.1 * s, 1.5, 10), base, x, wy - 0.1, z);
        M.put(G.cyl(2.2 * s, 2.4 * s, 0.4, 10), top, x, wy + 0.78, z);
        if (kind === 'beach' || kind === 'jungle') palm(M, x + 0.4, wy + 0.95, z, 0.9 + rng() * 0.4, rng, kind === 'jungle' ? { leaves: [0x1f8a3a, 0x3dbb56] } : {});
        else if (kind === 'castle') sandcastle(M, x, wy + 1, z, 1.1, rng);
        else if (kind === 'reef') { coral(M, x, wy + 0.95, z, 1.4, rng); anemone(M, x + 1, wy + 0.95, z, 1.4, rng); }
        else rock(M, x, wy + 0.6, z, 1.2, rng, 0x8a90aa);
    };
    place(Math.ceil(solids.length * 0.5), 5, 15, (x, z) => islet(x, z, 0.8 + rng() * 0.5));
    if (kind === 'beach') {
        place(nearN, 3, 14, (x, z) => { if (rng() < 0.45) rock(M, x, wy - 0.3, z, 0.7 + rng() * 1.1, rng, 0xa8a090); else if (rng() < 0.5) buoy(M, x, wy, z, 1); else driftwood(M, x, wy, z, 1, rng); });
        place(10, 18, 60, (x, z) => { const s = 1 + rng() * 0.8; M.put(G.cyl(5 * s, 6.5 * s, 1.6, 12), 0xf0d49a, x, wy + 0.3, z); M.put(G.cyl(4 * s, 5 * s, 0.5, 12), 0xfff0b8, x, wy + 1.2, z); palm(M, x + 1, wy + 1.4, z, 1.1, rng); palm(M, x - 1.5, wy + 1.4, z + 1, 0.9, rng); });
        place(5, 30, 90, (x, z) => boat(M, x, wy, z, 1.2, rng() * TAU, rng));
    } else if (kind === 'jungle') {
        place(nearN, 3, 14, (x, z) => { if (rng() < 0.5) rock(M, x, wy - 0.3, z, 0.8 + rng() * 1.3, rng, 0x7f8a7e); else driftwood(M, x, wy, z, 1.2, rng); });
        place(12, 16, 60, (x, z) => { const s = 1 + rng(); M.put(G.cyl(4 * s, 6 * s, 3, 10), 0x7a5a38, x, wy + 0.9, z); M.put(G.cyl(4.2 * s, 4.2 * s, 0.5, 10), 0x4cc25a, x, wy + 2.4, z); jungleTree(M, x, wy + 2.6, z, 1.2, rng); jungleTree(M, x + 2, wy + 2.6, z + 1.5, 0.9, rng); });
        place(5, 20, 70, (x, z) => tiki(M, x, wy, z, 1.6, rng() * TAU));
    } else if (kind === 'pier') {
        place(nearN, 3, 12, (x, z) => { if (rng() < 0.5) { rod(M, 0x4a3426, x, wy - 1, z, x, wy + 1.4 + rng(), z, 0.22, 0.2); } else buoy(M, x, wy, z, 1); });
        place(6, 14, 70, (x, z) => boat(M, x, wy, z, 1.6, rng() * TAU, rng));
        place(5, 20, 80, (x, z) => { for (let i = 0; i < 4; i++) barrelStack(M, x + i * 2, wy + 0.4, z, 1.2, rng); });
    } else if (kind === 'castle') {
        place(nearN, 3, 14, (x, z) => { if (rng() < 0.5) rock(M, x, wy - 0.3, z, 0.8 + rng(), rng, 0xe8d7a8); else buoy(M, x, wy, z, 1); });
        place(7, 24, 80, (x, z) => { tower(M, x, wy - 1, z, 1.3 + rng() * 0.6, rng); wallPiece(M, x + 4, wy - 1, z, 5, 1.4, 0); });
        place(6, 18, 70, (x, z) => { const s = 1 + rng(); M.put(G.cyl(5 * s, 6 * s, 1.6, 12), 0xf6dc9c, x, wy + 0.3, z); sandcastle(M, x, wy + 1, z, 1.8, rng); });
    } else if (kind === 'storm') {
        place(nearN, 3, 12, (x, z) => { rock(M, x, wy - 0.6, z, 1 + rng() * 1.6, rng, 0x6a7090); });
        place(6, 25, 90, (x, z) => { M.put(G.cyl(5, 8, 6 + rng() * 6, 7), 0x6a7090, x, wy + 1, z); });
        place(3, 40, 110, (x, z) => { const top = lighthouse(M, x, wy - 1, z, 1.7 + rng() * 0.5); });
    } else {
        place(nearN, 3, 14, (x, z) => { coral(M, x, wy - 0.2, z, 1.4 + rng(), rng); if (rng() < 0.5) anemone(M, x + 1, wy - 0.2, z, 1.4, rng); });
        place(10, 18, 80, (x, z) => { const s = 1.4 + rng(); for (let i = 0; i < 4; i++) coral(M, x + (rng() - 0.5) * 6, wy, z + (rng() - 0.5) * 6, s, rng); });
    }

    // ---- a lighthouse for the climb
    if (level.meta.id === 'l5_2') {
        let cx = 0, cz = 0, n = 0;
        for (const s of level.sections) if (s.type === 'corner') { cx += s.ox; cz += s.oz; n++; }
        if (n) {
            cx /= n; cz /= n;
            const dmin = rectDistTo(solids, cx, cz);
            const s = Math.max(0.6, Math.min(1.9, (dmin - 0.8) / 2.6));
            out.lighthouseTop = [cx, lighthouse(M, cx, wy - 1, cz, s) , cz];
        }
    }
    if (kind === 'storm' && level.meta.id === 'l5_3') {
        const A = level.arena;
        out.lighthouseTop = [A.cx + 40, lighthouse(M, A.cx + 40, wy - 1, A.cz - 30, 2.4), A.cz - 30];
    }

    // ---- flags on tall towers add colour; clouds add depth
    const g = M.build();
    if (g) {
        const m = new THREE.Mesh(g, vcMat());
        m.castShadow = false; m.receiveShadow = true;
        out.group.add(m);
    }
    const cx = (bounds.x0 + bounds.x1) / 2, cz = (bounds.z0 + bounds.z1) / 2, span = Math.max(bounds.x1 - bounds.x0, bounds.z1 - bounds.z0, 80);
    for (let i = 0; i < 16; i++) {
        const c = cloud(rng, theme.clouds);
        const a = rng() * TAU, r = span * 0.4 + rng() * span * 0.9;
        c.position.set(cx + Math.cos(a) * r, 36 + rng() * 40 + bounds.top * 0.5, cz + Math.sin(a) * r);
        c.scale.setScalar(2 + rng() * 2.4);
        c.userData.speed = 0.4 + rng() * 0.7;
        c.userData.cx = cx; c.userData.cz = cz; c.userData.span = span;
        out.group.add(c); out.clouds.push(c);
    }
    return out;
}
