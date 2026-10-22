// Every prop of the world as geometry: trees, houses, lamps, chests, pillars, whole towns and dungeon mouths on the overmap.
// Builders write into two Geos: `g` (lit, textured) and `em` (emissive: windows, crystals, flames, lantern glass).

import * as THREE from 'three';
import { Geo, G, cyl, cone, blob } from './geo.js';
import { TEX } from './texatlas.js';
import { hash3 } from '../rng.js';

const R = (seed, i) => hash3(seed | 0, i, 17);
const GREENS = [0xc8f0b0, 0xd8ffc0, 0xb4e0a0, 0xe0ffc8];
const pick = (arr, seed, i) => arr[Math.floor(R(seed, i) * arr.length)];

// ------------------------------------------------------------------ plants
export function oak(g, x, y, z, seed, s = 1, tint = 0) {
    cyl(g, { x, y, z, r: 0.12 * s, h: 0.8 * s, color: 0x6a4a2a, tile: TEX.trim });
    const base = tint || pick(GREENS, seed, 1);
    for (let i = 0; i < 3; i++) {
        const a = R(seed, 2 + i) * 6.28, r = 0.32 * s;
        blob(g, { x: x + Math.cos(a) * r, y: y + (0.95 + i * 0.18) * s, z: z + Math.sin(a) * r, r: (0.5 + R(seed, 8 + i) * 0.14) * s, color: base, tile: TEX.woods, rep: 2.2 });
    }
    blob(g, { x, y: y + 1.55 * s, z, r: 0.5 * s, color: base, tile: TEX.woods, rep: 2.2 });
}
export function pine(g, x, y, z, seed, s = 1, snow = false) {
    cyl(g, { x, y, z, r: 0.1 * s, h: 0.5 * s, color: 0x5a3a22, tile: TEX.trim });
    const c = snow ? 0xa8d8c0 : 0xa0e0b0;
    for (let i = 0; i < 4; i++) {
        cone(g, { x, y: y + (0.35 + i * 0.5) * s, z, r: (0.78 - i * 0.16) * s, h: 0.75 * s, color: c, tile: TEX.forest, rep: 2 });
        if (snow) cone(g, { x, y: y + (0.62 + i * 0.5) * s, z, r: (0.66 - i * 0.14) * s, h: 0.5 * s, color: 0xf0f6ff, tile: TEX.snow });
    }
}
export function palm(g, x, y, z, seed, s = 1) {
    const lean = (R(seed, 1) - 0.5) * 0.5, a = R(seed, 2) * 6.28;
    let px = x, pz = z;
    for (let i = 0; i < 5; i++) {
        px += Math.cos(a) * lean * 0.18 * s; pz += Math.sin(a) * lean * 0.18 * s;
        cyl(g, { x: px, y: y + i * 0.38 * s, z: pz, r: (0.1 - i * 0.008) * s, h: 0.4 * s, color: 0x9a7a4a, tile: TEX.trim });
    }
    for (let i = 0; i < 7; i++) {
        const fa = (i / 7) * 6.28 + a;
        g.add(G.box, { x: px + Math.cos(fa) * 0.45 * s, y: y + 1.95 * s - 0.1 * s, z: pz + Math.sin(fa) * 0.45 * s, sx: 1.0 * s, sy: 0.05 * s, sz: 0.28 * s, ry: -fa, rz: -0.35, color: i % 2 ? 0x3f9a44 : 0x58b04c, tile: TEX.forest });
    }
    blob(g, { x: px, y: y + 1.95 * s, z: pz, r: 0.16 * s, color: 0x6a4a2a, tile: TEX.trim });
}
export function bush(g, x, y, z, seed, s = 1) {
    blob(g, { x, y: y + 0.22 * s, z, ax: 0.42 * s, ay: 0.3 * s, az: 0.42 * s, color: pick(GREENS, seed, 3), tile: TEX.forest, rep: 2 });
    if (R(seed, 9) > 0.55) blob(g, { x: x + 0.25 * s, y: y + 0.3 * s, z: z - 0.1, r: 0.2 * s, color: pick([0xe84a6a, 0xffe44a, 0xffffff, 0xff9a4a], seed, 5), tile: TEX.forest });
}
export function rock(g, x, y, z, seed, s = 1, color = 0xdcdce6, tile = TEX.rock) {
    g.add(G.dod, { x, y: y + 0.2 * s, z, sx: 0.45 * s, sy: 0.32 * s * (0.7 + R(seed, 1) * 0.6), sz: 0.4 * s, ry: R(seed, 2) * 3, color, tile, jitter: 0.1 });
    if (R(seed, 3) > 0.5) g.add(G.dod, { x: x + 0.3 * s, y: y + 0.1 * s, z: z + 0.2 * s, sx: 0.22 * s, sy: 0.16 * s, sz: 0.2 * s, color, tile });
}
export function spike(g, x, y, z, seed, h, color = 0xdcdce6, tile = TEX.rock) {
    cone(g, { x, y, z, r: 0.55 + R(seed, 1) * 0.35, h, color, tile, jitter: 0.08, rep: 2.4 });
}
export function cactus(g, x, y, z, seed, s = 1) {
    cyl(g, { x, y, z, r: 0.14 * s, h: 0.9 * s, color: 0x4a9a4a, tile: TEX.forest });
    cyl(g, { x: x + 0.22 * s, y: y + 0.4 * s, z, r: 0.08 * s, h: 0.35 * s, color: 0x4a9a4a, tile: TEX.forest });
    g.add(G.box, { x: x + 0.14 * s, y: y + 0.42 * s, z, sx: 0.2 * s, sy: 0.08 * s, sz: 0.08 * s, color: 0x4a9a4a, tile: TEX.forest });
}

// ------------------------------------------------------------------ small town props
export function lamp(g, em, x, y, z, color = 0xffd9a0) {
    cyl(g, { x, y, z, r: 0.05, h: 1.9, color: 0x2a2430, tile: TEX.trim });
    g.add(G.box, { x, y: y + 1.9, z, sx: 0.28, sy: 0.05, sz: 0.28, color: 0x2a2430, tile: TEX.trim });
    em.add(G.box, { x, y: y + 1.62, z, sx: 0.2, sy: 0.28, sz: 0.2, color, tile: TEX.glass });
    g.add(G.cone6, { x, y: y + 2.05, z, sx: 0.2, sy: 0.2, sz: 0.2, color: 0x2a2430, tile: TEX.trim });
}
export function crate(g, x, y, z, seed) { g.add(G.box, { x, y: y + 0.28, z, sx: 0.56, sy: 0.56, sz: 0.56, ry: R(seed, 1) * 0.5, color: 0xffffff, tile: TEX.crate, rep: 1 }); }
export function barrel(g, x, y, z) { cyl(g, { x, y, z, r: 0.27, h: 0.58, color: 0x9a6a38, tile: TEX.wood }); g.add(G.cyl8, { x, y: y + 0.18, z, sx: 0.29, sy: 0.04, sz: 0.29, color: 0x3a2a1a, tile: TEX.trim }); g.add(G.cyl8, { x, y: y + 0.42, z, sx: 0.29, sy: 0.04, sz: 0.29, color: 0x3a2a1a, tile: TEX.trim }); }
export function bench(g, x, y, z) { g.add(G.box, { x, y: y + 0.28, z, sx: 1.1, sy: 0.08, sz: 0.34, color: 0x8a5a2a, tile: TEX.wood }); for (const dx of [-0.45, 0.45]) g.add(G.box, { x: x + dx, y: y + 0.14, z, sx: 0.08, sy: 0.28, sz: 0.3, color: 0x4a3018, tile: TEX.trim }); }
export function board(g, x, y, z) {
    for (const dx of [-0.5, 0.5]) g.add(G.box, { x: x + dx, y: y + 0.7, z, sx: 0.1, sy: 1.4, sz: 0.1, color: 0x5a3a1c, tile: TEX.trim });
    g.add(G.box, { x, y: y + 1.0, z, sx: 1.3, sy: 0.9, sz: 0.08, color: 0xc8a068, tile: TEX.wood });
    for (const [dx, dy, c] of [[-0.35, 1.2, 0xffffff], [0.1, 1.15, 0xf8e8c0], [0.4, 0.9, 0xffffff], [-0.2, 0.85, 0xf0d8a0]]) g.add(G.box, { x: x + dx, y: y + dy, z: z + 0.06, sx: 0.3, sy: 0.34, sz: 0.02, color: c, tile: TEX.plaster, rep: 1 });
    g.add(G.cone6, { x, y: y + 1.5, z, sx: 0.9, sy: 0.3, sz: 0.3, ry: 0, color: 0x4a6aa8, tile: TEX.roof });
}
export function fountain(g, em, x, y, z) {
    cyl(g, { x, y, z, r: 1.1, h: 0.4, color: 0xc0bcae, tile: TEX.stone, rep: 2 });
    cyl(g, { x, y: y + 0.4, z, r: 0.92, h: 0.04, color: 0x3a8ad8, tile: TEX.water });
    cyl(g, { x, y: y + 0.4, z, r: 0.2, h: 0.9, color: 0xd0ccbe, tile: TEX.stone });
    cyl(g, { x, y: y + 1.2, z, r: 0.46, h: 0.12, color: 0xd0ccbe, tile: TEX.stone });
    em.add(G.ico0, { x, y: y + 1.5, z, s: 0.12, s: 0.14, color: 0x9ad8ff, tile: TEX.water });
}
export function gate(g, x, y, z, w) {
    for (const dx of [-w / 2 + 0.1, w / 2 - 0.1]) { g.add(G.box, { x: x + dx, y: y + 1.1, z, sx: 0.4, sy: 2.2, sz: 0.4, color: 0xa8a49a, tile: TEX.stone, rep: 1 }); g.add(G.box, { x: x + dx, y: y + 2.3, z, sx: 0.55, sy: 0.18, sz: 0.55, color: 0xc0bcb0, tile: TEX.stone }); }
    g.add(G.box, { x, y: y + 2.1, z, sx: w, sy: 0.3, sz: 0.4, color: 0x8a5a2a, tile: TEX.wood });
    g.add(G.box, { x, y: y + 1.65, z, sx: w - 0.7, sy: 0.5, sz: 0.06, color: 0xc83a3a, tile: TEX.plaster });
}
export function shrine(g, em, x, y, z) {
    g.add(G.box, { x, y: y + 0.12, z, sx: 4.4, sy: 0.24, sz: 3.4, color: 0xc0bcae, tile: TEX.stone, rep: 1 });
    g.add(G.box, { x, y: y + 0.36, z, sx: 3.4, sy: 0.24, sz: 2.6, color: 0xd0ccbe, tile: TEX.stone, rep: 1 });
    for (const [dx, dz] of [[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]]) { cyl(g, { x: x + dx, y: y + 0.48, z: z + dz, r: 0.22, h: 2.2, color: 0xe8e4d6, tile: TEX.stone }); g.add(G.box, { x: x + dx, y: y + 2.7, z: z + dz, sx: 0.6, sy: 0.18, sz: 0.6, color: 0xf0ecde, tile: TEX.stone }); }
    g.add(G.box, { x, y: y + 2.9, z, sx: 3.6, sy: 0.22, sz: 2.8, color: 0xe8e4d6, tile: TEX.stone });
    cyl(g, { x, y: y + 0.6, z, r: 0.5, h: 0.6, color: 0xb8b4a6, tile: TEX.stone });
    // the broken crystal
    em.add(G.oct, { x: x - 0.15, y: y + 1.5, z, sx: 0.28, sy: 0.7, sz: 0.28, rz: 0.4, color: 0xfff0a8, tile: TEX.glass });
    em.add(G.oct, { x: x + 0.28, y: y + 1.3, z: z + 0.1, sx: 0.2, sy: 0.45, sz: 0.2, rz: -0.6, color: 0xffd36a, tile: TEX.glass });
}

// ------------------------------------------------------------------ buildings
export function building(g, em, b, gy) {
    const cx = b.x + b.w / 2, cz = b.y + b.h / 2, W = b.w - 0.2, D = b.h - 0.2, seed = b.seed;
    const floors = b.floors, fh = 1.1, base = 0.22;
    const wallCol = new THREE.Color(b.wall);
    const stone = b.kind === 'barracks' || b.kind === 'chapel';
    if (b.kind === 'barracks') wallCol.set(0xa8a49a);
    if (b.kind === 'chapel') wallCol.set(0xf4f0e8);
    if (b.kind === 'library') wallCol.set(0xf2e2b8);
    g.box(W + 0.12, base, D + 0.12, { x: cx, y: gy, z: cz, tile: TEX.stone, color: 0xb0aa9c, rep: 1 });
    g.box(W, floors * fh, D, { x: cx, y: gy + base, z: cz, tile: stone ? TEX.stone : TEX.plaster, color: wallCol.getHex(), rep: 1, noTop: true });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.box(0.18, floors * fh + 0.04, 0.18, { x: cx + sx * W / 2, y: gy + base, z: cz + sz * D / 2, tile: TEX.trim, color: stone ? 0xa8a49a : 0x7a5a38, rep: 1 });
    if (floors > 1) g.box(W + 0.06, 0.12, D + 0.06, { x: cx, y: gy + base + fh - 0.06, z: cz, tile: TEX.trim, color: 0x7a5a38, rep: 1 });
    // roof: a gable along x
    const ry = gy + base + floors * fh, rh = 0.55 + D * 0.18, ox = 0.32, oz = 0.38;
    const roofCol = new THREE.Color(b.roof).getHex();
    g.slope([cx - W / 2 - ox, ry, cz + D / 2 + oz], [cx + W / 2 + ox, ry, cz + D / 2 + oz], [cx + W / 2 + ox, ry + rh, cz], [cx - W / 2 - ox, ry + rh, cz], { tile: TEX.roof, color: roofCol, nu: Math.round(W + 1), nv: 3 });
    g.slope([cx + W / 2 + ox, ry, cz - D / 2 - oz], [cx - W / 2 - ox, ry, cz - D / 2 - oz], [cx - W / 2 - ox, ry + rh, cz], [cx + W / 2 + ox, ry + rh, cz], { tile: TEX.roof, color: roofCol, nu: Math.round(W + 1), nv: 3 });
    for (const sx of [-1, 1]) g.tri([cx + sx * W / 2, ry, cz - D / 2], [cx + sx * W / 2, ry, cz + D / 2], [cx + sx * W / 2, ry + rh, cz], { tile: TEX.plaster, color: wallCol.getHex() });
    g.box(W + 0.7, 0.1, 0.12, { x: cx, y: ry + rh, z: cz, tile: TEX.trim, color: 0x5a3a22, rep: 1 });
    if (b.kind === 'house' || b.kind === 'inn' || b.kind === 'tavern') g.box(0.42, 0.9, 0.42, { x: cx + W * 0.28, y: ry + rh * 0.5, z: cz - D * 0.22, tile: TEX.stone, color: 0x9a9488, rep: 1 });
    // windows: glass is emissive, framed in timber
    const fz = cz + D / 2 + 0.02, doorX = b.door[0] + 0.5;
    for (let f = 0; f < floors; f++) {
        const n = Math.max(1, Math.floor(W / 1.7));
        for (let i = 0; i < n; i++) {
            const wx = cx - W / 2 + (i + 0.5) * (W / n);
            if (f === 0 && Math.abs(wx - doorX) < 0.9) continue;
            const wy = gy + base + f * fh + 0.5;
            g.box(0.62, 0.62, 0.05, { x: wx, y: wy, z: fz, tile: TEX.trim, color: 0x5a3a22, rep: 1, noTop: false });
            em.box(0.46, 0.46, 0.04, { x: wx, y: wy + 0.08, z: fz + 0.03, tile: TEX.glass, color: 0xffc070, rep: 1 });
            g.box(0.7, 0.1, 0.12, { x: wx, y: wy - 0.04, z: fz + 0.06, tile: TEX.wood, color: 0x7a5230, rep: 1 });
            if (b.kind === 'house' && R(seed, i + f * 5) > 0.5) g.box(0.5, 0.12, 0.1, { x: wx, y: wy + 0.04, z: fz + 0.1, tile: TEX.forest, color: [0xe84a6a, 0xffe44a, 0xffffff][i % 3], rep: 1 });
        }
    }
    // door
    g.box(0.84, 1.18, 0.1, { x: doorX, y: gy + base, z: fz + 0.02, tile: TEX.wood, color: 0x6a4222, rep: 1 });
    g.box(1.0, 0.1, 0.16, { x: doorX, y: gy + base + 1.18, z: fz + 0.04, tile: TEX.trim, color: 0x4a2a14, rep: 1 });
    em.box(0.08, 0.08, 0.04, { x: doorX + 0.28, y: gy + base + 0.58, z: fz + 0.1, tile: TEX.glass, color: 0xffd36a, rep: 1 });
    g.box(1.1, 0.12, 0.5, { x: doorX, y: gy, z: fz + 0.26, tile: TEX.stone, color: 0xb0aa9c, rep: 1 });
    // kind-specific dressing
    const sign = (col, y = 1.4) => {
        g.box(0.07, 0.7, 0.07, { x: doorX + 0.95, y: gy + base + y - 0.3, z: fz + 0.3, tile: TEX.trim, color: 0x4a2a14, rep: 1 });
        g.box(0.6, 0.45, 0.08, { x: doorX + 1.2, y: gy + base + y, z: fz + 0.3, tile: TEX.wood, color: col, rep: 1 });
    };
    switch (b.kind) {
        case 'inn': sign(0xd8903a); for (const dx of [-1.2, 1.4]) barrel(g, cx + dx, gy, fz + 0.5); break;
        case 'shop': {
            for (let i = 0; i < 6; i++) g.box(W * 0.8 / 6, 0.06, 0.55, { x: doorX - W * 0.4 + (i + 0.5) * W * 0.8 / 6, y: gy + base + 1.5, z: fz + 0.35, tile: TEX.plaster, color: i % 2 ? 0xe8e4d6 : 0x4a8ac8, rep: 1, rx: 0.4 });
            crate(g, doorX - 1.3, gy, fz + 0.6, seed); crate(g, doorX + 1.35, gy, fz + 0.6, seed + 1); sign(0x4a8ac8); break;
        }
        case 'gear': {
            sign(0x8a8a96);
            g.box(0.5, 0.3, 0.3, { x: doorX - 1.3, y: gy + 0.15, z: fz + 0.5, tile: TEX.rock, color: 0x4a4a56, rep: 1 }); g.box(0.7, 0.14, 0.3, { x: doorX - 1.3, y: gy + 0.4, z: fz + 0.5, tile: TEX.rock, color: 0x5a5a66, rep: 1 });
            break;
        }
        case 'guild': for (const dx of [-1.0, 1.0]) g.box(0.4, 1.3, 0.05, { x: doorX + dx * 1.1, y: gy + base + 0.9, z: fz + 0.06, tile: TEX.plaster, color: 0x3a6ac8, rep: 1 }); sign(0xc8a040); break;
        case 'tavern': for (const dx of [-1.2, 1.3]) barrel(g, cx + dx, gy, fz + 0.5); sign(0xa84a2a); break;
        case 'warehouse': for (let i = 0; i < 3; i++) crate(g, cx - 1.5 + i * 1.1, gy, fz + 0.7, seed + i); break;
        case 'barracks': { for (let i = 0; i < Math.floor(W); i++) g.box(0.5, 0.35, 0.3, { x: cx - W / 2 + 0.4 + i * 0.95, y: ry + 0.0, z: cz + D / 2 - 0.15, tile: TEX.stone, color: 0xa8a49a, rep: 1 }); g.box(0.06, 1.6, 0.06, { x: cx - W / 2, y: ry + rh, z: cz, tile: TEX.trim, color: 0x4a2a14, rep: 1 }); g.box(0.7, 0.4, 0.04, { x: cx - W / 2 + 0.38, y: ry + rh + 1.2, z: cz, tile: TEX.plaster, color: 0x3a6ac8, rep: 1 }); break; }
        case 'chapel': {
            g.box(1.5, 2.4, 1.5, { x: cx, y: ry, z: cz + D * 0.1, tile: TEX.stone, color: 0xf0ece4, rep: 1, noTop: true });
            g.add(G.cone8, { x: cx, y: ry + 3.1, z: cz + D * 0.1, sx: 1.2, sy: 1.5, sz: 1.2, ry: 0.78, color: 0x4a6aa8, tile: TEX.roof });
            g.box(0.1, 0.6, 0.1, { x: cx, y: ry + 4.1, z: cz + D * 0.1, tile: TEX.trim, color: 0xffd36a, rep: 1 }); g.box(0.4, 0.1, 0.1, { x: cx, y: ry + 4.4, z: cz + D * 0.1, tile: TEX.trim, color: 0xffd36a, rep: 1 });
            em.box(0.5, 0.7, 0.05, { x: cx, y: ry + 1.2, z: cz + D * 0.1 + 0.78, tile: TEX.glass, color: 0x8fd0ff, rep: 1 });
            break;
        }
        case 'library': {
            blob(g, { x: cx, y: ry + 0.5, z: cz, ax: W * 0.32, ay: 1.1, az: D * 0.32, color: 0x3a8a9a, tile: TEX.roof, jitter: 0.02 });
            for (const dx of [-1.6, -0.8, 0.8, 1.6]) cyl(g, { x: cx + dx, y: gy + base, z: fz + 0.5, r: 0.14, h: floors * fh, color: 0xf4ecd8, tile: TEX.sandstone });
            break;
        }
        case 'elder': sign(0x6a4aa8); break;
    }
    return { gy, top: ry + rh };
}

// ------------------------------------------------------------------ dungeon dressing
export function deco(g, em, p, gy, th) {
    const { x, y } = p, cx = x + 0.5, cz = y + 0.5, seed = p.seed;
    switch (p.kind) {
        case 'pillar': cyl(g, { x: cx, y: gy, z: cz, r: 0.34, h: 2.2, color: th.pillar ?? 0xa8a49a, tile: TEX.stone }); g.add(G.box, { x: cx, y: gy + 2.2, z: cz, sx: 0.8, sy: 0.18, sz: 0.8, color: th.pillar ?? 0xb8b4aa, tile: TEX.stone }); g.add(G.box, { x: cx, y: gy + 0.1, z: cz, sx: 0.8, sy: 0.2, sz: 0.8, color: th.pillar ?? 0xb8b4aa, tile: TEX.stone }); break;
        case 'statue': g.add(G.box, { x: cx, y: gy + 0.2, z: cz, sx: 0.8, sy: 0.4, sz: 0.8, color: 0x8a8a94, tile: TEX.stone }); cyl(g, { x: cx, y: gy + 0.4, z: cz, r: 0.22, h: 0.9, color: 0xa8a8b4, tile: TEX.stone }); blob(g, { x: cx, y: gy + 1.5, z: cz, r: 0.22, color: 0xa8a8b4, tile: TEX.stone }); g.add(G.box, { x: cx + 0.3, y: gy + 1.1, z: cz, sx: 0.08, sy: 0.8, sz: 0.08, color: 0xc8c8d4, tile: TEX.stone }); break;
        case 'urn': blob(g, { x: cx, y: gy + 0.4, z: cz, ax: 0.3, ay: 0.4, az: 0.3, color: 0xa8683a, tile: TEX.wood, jitter: 0.04 }); cyl(g, { x: cx, y: gy + 0.7, z: cz, r: 0.18, h: 0.2, color: 0xa8683a, tile: TEX.wood }); break;
        case 'rock': rock(g, cx, gy, cz, seed, 1.2, th.rock ?? 0x6a6a76, TEX.rock); break;
        case 'crate': crate(g, cx, gy, cz, seed); if (R(seed, 4) > 0.5) crate(g, cx + 0.3, gy + 0.56, cz, seed + 2); break;
        case 'cart': g.add(G.box, { x: cx, y: gy + 0.4, z: cz, sx: 1.1, sy: 0.45, sz: 0.7, color: 0x7a5230, tile: TEX.wood }); for (const dx of [-0.4, 0.4]) cyl(g, { x: cx + dx, y: gy + 0.05, z: cz + 0.38, r: 0.22, h: 0.06, color: 0x4a3018, tile: TEX.trim }); blob(g, { x: cx, y: gy + 0.75, z: cz, ax: 0.45, ay: 0.2, az: 0.28, color: 0x8a8a94, tile: TEX.rock }); break;
        case 'stump': cyl(g, { x: cx, y: gy, z: cz, r: 0.36, h: 0.5, color: 0x7a5230, tile: TEX.wood }); g.add(G.cyl8, { x: cx, y: gy + 0.5, z: cz, sx: 0.32, sy: 0.02, sz: 0.32, color: 0xc89a5a, tile: TEX.wood }); break;
        case 'mushroom': for (let i = 0; i < 3; i++) { const a = i * 2.1, r = 0.22; cyl(g, { x: cx + Math.cos(a) * r, y: gy, z: cz + Math.sin(a) * r, r: 0.05, h: 0.3 + i * 0.1, color: 0xf0e0c0, tile: TEX.plaster }); em.add(G.ico1, { x: cx + Math.cos(a) * r, y: gy + 0.32 + i * 0.1, z: cz + Math.sin(a) * r, sx: 0.2, sy: 0.12, sz: 0.2, color: [0x7fe8c0, 0xc08aff, 0x7fc8ff][i], tile: TEX.glass }); } break;
        case 'crystal': for (let i = 0; i < 3; i++) em.add(G.oct, { x: cx + (i - 1) * 0.22, y: gy + 0.45 + i * 0.1, z: cz + (i % 2) * 0.12, sx: 0.14, sy: 0.5 + i * 0.12, sz: 0.14, rz: (i - 1) * 0.3, color: th.light ?? 0x9fe8ff, tile: TEX.glass }); break;
        case 'icicle': for (let i = 0; i < 3; i++) cone(g, { x: cx + (i - 1) * 0.2, y: gy, z: cz + (i % 2) * 0.15, r: 0.14, h: 0.7 + i * 0.25, color: 0xc8f0ff, tile: TEX.ice }); break;
        case 'brazier': cyl(g, { x: cx, y: gy, z: cz, r: 0.08, h: 0.7, color: 0x3a3440, tile: TEX.trim }); g.add(G.cyl8, { x: cx, y: gy + 0.75, z: cz, sx: 0.3, sy: 0.14, sz: 0.3, color: 0x4a4450, tile: TEX.trim }); em.add(G.cone6, { x: cx, y: gy + 1.05, z: cz, sx: 0.2, sy: 0.5, sz: 0.2, color: 0xff8a30, tile: TEX.glass }); break;
        case 'bones': g.add(G.box, { x: cx, y: gy + 0.05, z: cz, sx: 0.5, sy: 0.08, sz: 0.1, ry: 0.5, color: 0xe8e0c8, tile: TEX.plaster }); g.add(G.ico0, { x: cx + 0.3, y: gy + 0.12, z: cz, s: 0.12, color: 0xe8e0c8, tile: TEX.plaster }); break;
        case 'sarcophagus': g.add(G.box, { x: cx, y: gy + 0.35, z: cz, sx: 0.8, sy: 0.7, sz: 1.5, color: 0xd8b868, tile: TEX.sandstone }); g.add(G.box, { x: cx, y: gy + 0.74, z: cz, sx: 0.7, sy: 0.12, sz: 1.4, color: 0xe8cc80, tile: TEX.sandstone }); break;
        case 'coral': for (let i = 0; i < 4; i++) cone(g, { x: cx + (i - 1.5) * 0.18, y: gy, z: cz + ((i * 7) % 3 - 1) * 0.12, r: 0.1, h: 0.5 + (i % 3) * 0.22, color: [0xff7a9a, 0xff9ab0, 0xffb06a, 0xff6a8a][i], tile: TEX.plaster }); break;
        case 'tree': oak(g, cx, gy, cz, seed, 1.15, 0x2e6a2a); break;
        default: rock(g, cx, gy, cz, seed, 1);
    }
}

export function chest(g, em, p, gy, open) {
    const cx = p.x + 0.5, cz = p.y + 0.5, col = p.locked ? 0x4a5a8a : 0x9a6a38, trim = p.locked ? 0xc0c8e0 : 0xffd36a;
    g.add(G.box, { x: cx, y: gy + 0.22, z: cz, sx: 0.78, sy: 0.44, sz: 0.52, color: col, tile: TEX.wood });
    if (!open) { g.add(G.cyl8, { x: cx, y: gy + 0.44, z: cz, sx: 0.26, sy: 0.78, sz: 0.26, rz: Math.PI / 2, color: col, tile: TEX.wood }); em.add(G.box, { x: cx, y: gy + 0.42, z: cz + 0.27, sx: 0.12, sy: 0.14, sz: 0.04, color: trim, tile: TEX.glass }); }
    else { g.add(G.box, { x: cx, y: gy + 0.68, z: cz - 0.3, sx: 0.78, sy: 0.08, sz: 0.4, rx: -1.1, color: col, tile: TEX.wood }); em.add(G.box, { x: cx, y: gy + 0.46, z: cz, sx: 0.6, sy: 0.04, sz: 0.4, color: 0x4a3a2a, tile: TEX.glass }); }
    for (const dx of [-0.3, 0.3]) g.add(G.box, { x: cx + dx, y: gy + 0.24, z: cz, sx: 0.07, sy: 0.5, sz: 0.56, color: trim, tile: TEX.trim });
}

// ------------------------------------------------------------------ the overmap's places
export function townMarker(g, em, x, y, z, seed, theme) {
    const roofs = { village: [0xb84a3a, 0xc8683a], river: [0x4a6a9a, 0x5a7aa8], harbor: [0x3a8a9a, 0xe8c06a], oasis: [0xd89a4a, 0xc87a3a], snow: [0x6a4a3a, 0x4a5a7a] }[theme] || [0xb84a3a, 0xc8683a];
    const wall = theme === 'snow' ? 0xc8b8a0 : 0xf0e4cc;
    const spots = [[-0.9, -0.5, 1], [0.8, -0.4, 0.9], [-0.1, 0.4, 1.1], [0.1, -1.2, 0.8], [-1.2, 0.5, 0.7]];
    spots.forEach(([dx, dz, s], i) => {
        const bx = x + dx, bz = z + dz, w = 0.8 * s, h = 0.55 * s;
        g.box(w, h, w * 0.85, { x: bx, y, z: bz, tile: TEX.plaster, color: wall, rep: 1, noTop: true });
        const rc = roofs[i % 2];
        g.slope([bx - w / 2 - 0.08, y + h, bz + w * 0.46], [bx + w / 2 + 0.08, y + h, bz + w * 0.46], [bx + w / 2 + 0.08, y + h + 0.4 * s, bz], [bx - w / 2 - 0.08, y + h + 0.4 * s, bz], { color: rc, nu: 2, nv: 2 });
        g.slope([bx + w / 2 + 0.08, y + h, bz - w * 0.46], [bx - w / 2 - 0.08, y + h, bz - w * 0.46], [bx - w / 2 - 0.08, y + h + 0.4 * s, bz], [bx + w / 2 + 0.08, y + h + 0.4 * s, bz], { color: rc, nu: 2, nv: 2 });
        for (const sx of [-1, 1]) g.tri([bx + sx * w / 2, y + h, bz - w * 0.42], [bx + sx * w / 2, y + h, bz + w * 0.42], [bx + sx * w / 2, y + h + 0.4 * s, bz], { color: wall });
        em.box(0.1 * s, 0.12 * s, 0.03, { x: bx - 0.15 * s, y: y + 0.2 * s, z: bz + w * 0.44, tile: TEX.glass, color: 0xffc070, rep: 1 });
    });
    // a tower and a banner
    g.box(0.5, 1.5, 0.5, { x: x + 1.2, y, z: z + 0.8, tile: TEX.stone, color: 0xb8b4a6, rep: 1, noTop: true });
    g.add(G.cone8, { x: x + 1.2, y: y + 1.5, z: z + 0.8, sx: 0.46, sy: 0.6, sz: 0.46, ry: 0.78, color: roofs[0], tile: TEX.roof });
    g.box(0.04, 0.8, 0.04, { x: x + 1.2, y: y + 2.05, z: z + 0.8, tile: TEX.trim, color: 0x4a2a14, rep: 1 }); g.box(0.4, 0.22, 0.03, { x: x + 1.4, y: y + 2.5, z: z + 0.8, tile: TEX.plaster, color: roofs[1], rep: 1 });
    // walls
    for (const [dx, dz, sx, sz] of [[0, 1.55, 3.4, 0.14], [-1.65, 0, 0.14, 3.0], [1.65, 0, 0.14, 3.0]]) g.box(sx, 0.32, sz, { x: x + dx, y, z: z + dz, tile: TEX.stone, color: 0xa8a49a, rep: 1 });
}

export function dungeonMarker(g, em, id, x, y, z, seed) {
    switch (id) {
        case 'woods': {
            for (let i = 0; i < 7; i++) { const a = -0.3 + i * 0.5; oak(g, x + Math.cos(a * 1.3 + 3.2) * 1.2, y, z + Math.sin(a * 1.3 + 3.2) * 0.9 - 0.2, seed + i, 1.5, 0x2a5a26); }
            g.add(G.box, { x, y: y + 1.1, z: z - 0.3, sx: 1.3, sy: 0.2, sz: 0.4, color: 0x3a2a1a, tile: TEX.trim }); for (const dx of [-0.6, 0.6]) g.add(G.box, { x: x + dx, y: y + 0.55, z: z - 0.3, sx: 0.22, sy: 1.1, sz: 0.4, color: 0x3a2a1a, tile: TEX.trim });
            em.add(G.box, { x, y: y + 0.55, z: z - 0.34, sx: 1.0, sy: 1.0, sz: 0.1, color: 0x9fe8a0, tile: TEX.glass }); break;
        }
        case 'mines': {
            g.add(G.cone8, { x, y: y + 0.9, z: z - 0.6, sx: 2.0, sy: 1.8, sz: 1.6, color: 0x6a6a76, tile: TEX.rock, jitter: 0.1 });
            g.add(G.box, { x, y: y + 0.5, z: z + 0.1, sx: 1.2, sy: 1.0, sz: 0.3, color: 0x08060a, tile: TEX.dark }); for (const dx of [-0.65, 0.65]) g.add(G.box, { x: x + dx, y: y + 0.55, z: z + 0.15, sx: 0.16, sy: 1.1, sz: 0.2, color: 0x7a5230, tile: TEX.wood }); g.add(G.box, { x, y: y + 1.12, z: z + 0.15, sx: 1.5, sy: 0.16, sz: 0.2, color: 0x7a5230, tile: TEX.wood });
            em.add(G.box, { x: x + 0.9, y: y + 0.8, z: z + 0.3, sx: 0.12, sy: 0.14, sz: 0.12, color: 0xffb060, tile: TEX.glass }); break;
        }
        case 'temple': {
            for (const dx of [-1.2, -0.4, 0.4, 1.2]) cyl(g, { x: x + dx, y, z, r: 0.18, h: 1.5 - Math.abs(dx) * 0.3, color: 0x6ad0d8, tile: TEX.temple });
            g.add(G.box, { x, y: y + 1.55, z, sx: 3.0, sy: 0.22, sz: 0.7, color: 0x8ae0e8, tile: TEX.temple }); g.add(G.box, { x, y: y + 0.08, z, sx: 3.4, sy: 0.16, sz: 1.4, color: 0x58b0c0, tile: TEX.temple });
            em.add(G.oct, { x, y: y + 0.9, z, sx: 0.26, sy: 0.5, sz: 0.26, color: 0x70d8ff, tile: TEX.glass }); break;
        }
        case 'pyramid': {
            for (let i = 0; i < 5; i++) g.add(G.box, { x, y: y + 0.2 + i * 0.4, z: z - 0.3, sx: 3.2 - i * 0.62, sy: 0.4, sz: 3.0 - i * 0.58, color: 0xe0c486, tile: TEX.sandstone });
            g.add(G.cone6, { x, y: y + 2.2, z: z - 0.3, sx: 0.4, sy: 0.4, sz: 0.4, ry: 0.78, color: 0xffd36a, tile: TEX.trim });
            g.add(G.box, { x, y: y + 0.35, z: z + 1.15, sx: 0.7, sy: 0.7, sz: 0.2, color: 0x1a0e04, tile: TEX.dark }); break;
        }
        case 'glacier': {
            for (const [dx, dz, h] of [[-1.1, 0, 1.6], [-0.4, -0.5, 2.3], [0.4, -0.4, 1.9], [1.1, 0.1, 1.4], [0.1, 0.4, 1.0]]) { g.add(G.box, { x: x + dx, y: y + h / 2, z: z + dz, sx: 0.55, sy: h, sz: 0.55, color: 0xb8eaff, tile: TEX.ice }); cone(g, { x: x + dx, y: y + h, z: z + dz, r: 0.4, h: 0.7, color: 0xd8f6ff, tile: TEX.ice }); }
            em.add(G.oct, { x, y: y + 0.7, z: z + 0.6, sx: 0.2, sy: 0.4, sz: 0.2, color: 0x9fe8ff, tile: TEX.glass }); break;
        }
        case 'spire': {
            for (const [dx, dz, h, w] of [[0, 0, 5.4, 0.9], [-0.9, 0.3, 3.4, 0.55], [0.9, 0.2, 3.0, 0.5], [0.4, -0.7, 4.0, 0.5]]) { g.add(G.box, { x: x + dx, y: y + h / 2, z: z + dz, sx: w, sy: h, sz: w, color: 0x241f3a, tile: TEX.wallObs }); cone(g, { x: x + dx, y: y + h, z: z + dz, r: w * 0.8, h: 1.2, color: 0x1a162a, tile: TEX.wallObs }); }
            em.add(G.oct, { x, y: y + 6.6, z, sx: 0.22, sy: 0.5, sz: 0.22, color: 0xc08aff, tile: TEX.glass }); em.add(G.box, { x, y: y + 2.2, z: z + 0.5, sx: 0.12, sy: 0.7, sz: 0.04, color: 0x9a60ff, tile: TEX.glass }); break;
        }
        case 'maw': {
            g.add(G.cone8, { x, y: y + 1.0, z, sx: 2.2, sy: 2.0, sz: 2.2, color: 0x3a2a2a, tile: TEX.lavarock, jitter: 0.1 });
            em.add(G.cyl8, { x, y: y + 1.9, z, sx: 0.8, sy: 0.12, sz: 0.8, color: 0xff6a20, tile: TEX.glass }); em.add(G.box, { x, y: y + 0.4, z: z + 0.9, sx: 0.5, sy: 0.9, sz: 0.1, color: 0xff7a30, tile: TEX.glass }); break;
        }
    }
}
