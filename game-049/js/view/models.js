/**
 * models.js — a tiny kit for building low-poly models from primitives.
 *
 * kit() collects parts ({ geometry, colour, emissive?, transform }) and bakes
 * them into at most two merged geometries with vertex colours: a lit body and
 * an emissive glow. Props, decor, objects and floor items are all built here.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

export function kit() {
    const body = [], glow = [];
    const api = {
        add(geo, color, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, glow: g = false } = {}) {
            let gg = geo.index ? geo.toNonIndexed() : geo.clone();
            for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
            _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
            gg.applyMatrix4(_m);
            const c = new THREE.Color(color);
            const n = gg.attributes.position.count;
            const col = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
            gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
            (g ? glow : body).push(gg);
            return api;
        },
        bake() {
            return {
                body: body.length ? mergeGeometries(body) : null,
                glow: glow.length ? mergeGeometries(glow) : null,
            };
        },
    };
    return api;
}

// Shared primitives (cloned by kit.add).
export const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
    cone: new THREE.ConeGeometry(0.5, 1, 8),
    sph: new THREE.SphereGeometry(0.5, 10, 8),
    ico: new THREE.IcosahedronGeometry(0.5, 0),
    dod: new THREE.DodecahedronGeometry(0.5, 0),
    oct: new THREE.OctahedronGeometry(0.5, 0),
    tor: new THREE.TorusGeometry(0.4, 0.1, 6, 14),
    plane: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    cap: new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
};

const rnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

/** Blocking furniture, ~1 tile, centred on the origin, standing on y=0. */
export function buildProp(kind, accent, seed = 1) {
    const r = rnd(seed);
    const k = kit();
    switch (kind) {
        case 'barrel': k.add(G.cyl, 0x6a4424, { y: 0.4, sx: 0.6, sy: 0.8, sz: 0.6 }).add(G.cyl, 0x3a3a3a, { y: 0.15, sx: 0.62, sy: 0.06, sz: 0.62 }).add(G.cyl, 0x3a3a3a, { y: 0.65, sx: 0.62, sy: 0.06, sz: 0.62 }); break;
        case 'crate': k.add(G.box, 0x7a5430, { y: 0.32, sx: 0.64, sy: 0.64, sz: 0.64, ry: r() }).add(G.box, 0x5a3a20, { y: 0.32, sx: 0.66, sy: 0.1, sz: 0.66, ry: r() * 0 }); break;
        case 'shelf': k.add(G.box, 0x4a3020, { y: 0.6, sx: 0.85, sy: 1.2, sz: 0.4 }); for (let i = 0; i < 3; i++) k.add(G.box, [0xa04030, 0x40608a, 0x608a40][i], { y: 0.3 + i * 0.35, x: (r() - 0.5) * 0.3, sx: 0.3, sy: 0.2, sz: 0.3 }); break;
        case 'bigshroom': k.add(G.cyl, 0xd8d0b0, { y: 0.45, sx: 0.22, sy: 0.9, sz: 0.22 }).add(G.cap, accent, { y: 0.85, sx: 0.95, sy: 0.55, sz: 0.95 }).add(G.cap, 0x6affd0, { y: 0.82, sx: 0.7, sy: 0.12, sz: 0.7, rx: Math.PI, glow: true }); break;
        case 'stalagmite': k.add(G.cone, 0x34484a, { y: 0.6, sx: 0.55, sy: 1.2, sz: 0.55 }).add(G.cone, 0x3a5050, { x: 0.25, y: 0.3, sx: 0.3, sy: 0.6, sz: 0.3 }); break;
        case 'bookshelf': k.add(G.box, 0x3a2416, { y: 0.75, sx: 0.9, sy: 1.5, sz: 0.45 }); for (let s = 0; s < 3; s++) for (let i = 0; i < 4; i++) k.add(G.box, [0x8a2a2a, 0x2a4a7a, 0x4a6a2a, 0x8a7a3a][(s + i) % 4], { x: -0.3 + i * 0.2, y: 0.3 + s * 0.45, z: 0.06, sx: 0.14, sy: 0.32, sz: 0.3 }); break;
        case 'lectern': k.add(G.box, 0x4a3020, { y: 0.45, sx: 0.25, sy: 0.9, sz: 0.25 }).add(G.box, 0x5a3a24, { y: 0.92, sx: 0.6, sy: 0.08, sz: 0.45, rx: -0.4 }).add(G.box, 0xf0e8d0, { y: 0.97, sx: 0.5, sy: 0.04, sz: 0.36, rx: -0.4 }); break;
        case 'bookpile': for (let i = 0; i < 5; i++) k.add(G.box, [0x8a2a2a, 0x2a4a7a, 0x4a6a2a, 0x7a5a2a, 0x5a2a5a][i], { y: 0.07 + i * 0.13, sx: 0.5 - i * 0.03, sy: 0.12, sz: 0.38, ry: r() * 0.8 }); break;
        case 'anvil': k.add(G.box, 0x3a3a40, { y: 0.2, sx: 0.4, sy: 0.4, sz: 0.3 }).add(G.box, 0x4a4a54, { y: 0.48, sx: 0.8, sy: 0.18, sz: 0.34 }).add(G.cone, 0x4a4a54, { x: 0.5, y: 0.48, rz: -Math.PI / 2, sx: 0.18, sy: 0.3, sz: 0.18 }); break;
        case 'forge': k.add(G.box, 0x2a1e1a, { y: 0.45, sx: 0.9, sy: 0.9, sz: 0.8 }).add(G.box, 0xff6010, { y: 0.55, z: 0.36, sx: 0.5, sy: 0.3, sz: 0.1, glow: true }).add(G.cyl, 0x2a1e1a, { y: 1.2, sx: 0.3, sy: 0.7, sz: 0.3 }); break;
        case 'ore': for (let i = 0; i < 4; i++) k.add(G.dod, i ? 0x4a3a30 : accent, { x: (r() - 0.5) * 0.5, y: 0.2, z: (r() - 0.5) * 0.5, sx: 0.4, sy: 0.35, sz: 0.4, glow: i === 0 }); break;
        case 'crystal': for (let i = 0; i < 5; i++) k.add(G.oct, accent, { x: (r() - 0.5) * 0.5, y: 0.4, z: (r() - 0.5) * 0.5, sx: 0.25, sy: 0.6 + r() * 0.8, sz: 0.25, rz: (r() - 0.5) * 0.6, glow: i < 2 }); break;
        case 'geode': k.add(G.dod, 0x4a4050, { y: 0.35, sx: 0.8, sy: 0.7, sz: 0.8 }).add(G.oct, accent, { y: 0.55, z: 0.25, sx: 0.3, sy: 0.4, sz: 0.3, glow: true }); break;
        case 'sarcophagus': k.add(G.box, 0x5a564e, { y: 0.3, sx: 0.55, sy: 0.6, sz: 0.95 }).add(G.box, 0x6a665e, { y: 0.65, sx: 0.6, sy: 0.12, sz: 1.0 }).add(G.sph, 0x7a766e, { y: 0.75, z: -0.3, sx: 0.25, sy: 0.15, sz: 0.25 }); break;
        case 'urn': k.add(G.sph, 0x6a5a48, { y: 0.35, sx: 0.5, sy: 0.6, sz: 0.5 }).add(G.cyl, 0x6a5a48, { y: 0.72, sx: 0.25, sy: 0.2, sz: 0.25 }); break;
        case 'bonepile': for (let i = 0; i < 7; i++) k.add(G.cyl, 0xd8d0b8, { x: (r() - 0.5) * 0.6, y: 0.1 + r() * 0.2, z: (r() - 0.5) * 0.6, rz: r() * 3, rx: r() * 3, sx: 0.06, sy: 0.5, sz: 0.06 }); k.add(G.sph, 0xe0d8c0, { y: 0.3, sx: 0.25, sy: 0.25, sz: 0.25 }); break;
        case 'gearstack': for (let i = 0; i < 3; i++) k.add(G.tor, 0xb08a40, { y: 0.2 + i * 0.3, rx: Math.PI / 2, sx: 1.2 - i * 0.3, sy: 1.2 - i * 0.3, sz: 2 }); k.add(G.cyl, 0x5a4a30, { y: 0.5, sx: 0.12, sy: 1, sz: 0.12 }); break;
        case 'pipes': k.add(G.cyl, 0x8a7040, { y: 0.7, sx: 0.2, sy: 1.4, sz: 0.2 }).add(G.cyl, 0x8a7040, { x: 0.25, y: 0.5, sx: 0.16, sy: 1.0, sz: 0.16 }).add(G.box, 0xff5040, { y: 0.9, z: 0.11, sx: 0.08, sy: 0.08, sz: 0.04, glow: true }); break;
        case 'boiler': k.add(G.cyl, 0x6a5030, { y: 0.55, sx: 0.8, sy: 1.1, sz: 0.8 }).add(G.cap, 0x7a6038, { y: 1.1, sx: 0.8, sy: 0.4, sz: 0.8 }).add(G.box, 0xff8030, { y: 0.4, z: 0.4, sx: 0.3, sy: 0.15, sz: 0.04, glow: true }); break;
        case 'icespike': for (let i = 0; i < 4; i++) k.add(G.cone, 0xb8e0ff, { x: (r() - 0.5) * 0.5, y: 0.5, z: (r() - 0.5) * 0.5, sx: 0.25, sy: 0.8 + r() * 0.8, sz: 0.25, glow: i === 0 }); break;
        case 'frozenstatue': k.add(G.box, 0x9ac8e8, { y: 0.15, sx: 0.6, sy: 0.3, sz: 0.6 }).add(G.cyl, 0xa8d4f0, { y: 0.8, sx: 0.35, sy: 1.0, sz: 0.3 }).add(G.sph, 0xb8e0ff, { y: 1.45, sx: 0.3, sy: 0.3, sz: 0.3 }); break;
        case 'monolith': k.add(G.box, 0x1a1430, { y: 0.9, sx: 0.5, sy: 1.8, sz: 0.3 }).add(G.box, accent, { y: 1.1, z: 0.16, sx: 0.12, sy: 0.6, sz: 0.02, glow: true }); break;
        case 'orb': k.add(G.cyl, 0x2a2440, { y: 0.3, sx: 0.4, sy: 0.6, sz: 0.4 }).add(G.sph, accent, { y: 0.85, sx: 0.4, sy: 0.4, sz: 0.4, glow: true }); break;
        case 'obelisk': k.add(G.box, 0x0e0a14, { y: 0.9, sx: 0.45, sy: 1.8, sz: 0.45 }).add(G.cone, 0x0e0a14, { y: 1.95, sx: 0.5, sy: 0.35, sz: 0.5, ry: Math.PI / 4 }).add(G.box, 0xa070ff, { y: 1.0, z: 0.23, sx: 0.06, sy: 1.2, sz: 0.02, glow: true }); break;
        case 'cage': k.add(G.cyl, 0x2a2a30, { y: 0.03, sx: 0.85, sy: 0.06, sz: 0.85 }).add(G.cyl, 0x2a2a30, { y: 1.3, sx: 0.85, sy: 0.06, sz: 0.85 }); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; k.add(G.cyl, 0x3a3a44, { x: Math.cos(a) * 0.4, y: 0.65, z: Math.sin(a) * 0.4, sx: 0.04, sy: 1.3, sz: 0.04 }); } break;
        default: k.add(G.box, 0x555555, { y: 0.4, sx: 0.6, sy: 0.8, sz: 0.6 });
    }
    return k.bake();
}

/** Non-blocking floor dressing: small, flat-ish, random. */
export function buildDecor(kind, accent, seed = 1) {
    const r = rnd(seed);
    const k = kit();
    const scatter = (n, fn) => { for (let i = 0; i < n; i++) fn((r() - 0.5) * 0.7, (r() - 0.5) * 0.7, i); };
    switch (kind) {
        case 'roots': scatter(3, (x, z) => k.add(G.cyl, 0x5a4028, { x, y: 0.03, z, rz: Math.PI / 2, ry: r() * 3, sx: 0.06, sy: 0.6, sz: 0.06 })); break;
        case 'bones': scatter(3, (x, z) => k.add(G.cyl, 0xd8d0b8, { x, y: 0.03, z, rz: Math.PI / 2, ry: r() * 3, sx: 0.05, sy: 0.35, sz: 0.05 })); break;
        case 'skulls': scatter(2, (x, z) => k.add(G.sph, 0xe0d8c0, { x, y: 0.08, z, sx: 0.16, sy: 0.15, sz: 0.18 })); break;
        case 'sack': k.add(G.sph, 0x8a7a5a, { y: 0.15, sx: 0.4, sy: 0.32, sz: 0.35 }); break;
        case 'shrooms': scatter(4, (x, z) => { k.add(G.cyl, 0xe0d8c0, { x, y: 0.06, z, sx: 0.04, sy: 0.12, sz: 0.04 }); k.add(G.cap, accent, { x, y: 0.12, z, sx: 0.14, sy: 0.08, sz: 0.14, glow: r() < 0.5 }); }); break;
        case 'spores': scatter(5, (x, z) => k.add(G.sph, 0xa0ff80, { x, y: 0.05 + r() * 0.3, z, sx: 0.05, sy: 0.05, sz: 0.05, glow: true })); break;
        case 'pebbles': scatter(4, (x, z) => k.add(G.dod, 0x5a5650, { x, y: 0.03, z, sx: 0.1 + r() * 0.08, sy: 0.06, sz: 0.1 })); break;
        case 'pages': scatter(4, (x, z) => k.add(G.plane, 0xe8e0c8, { x, y: 0.01, z, ry: r() * 3, sx: 0.18, sz: 0.24 })); break;
        case 'books': scatter(2, (x, z) => k.add(G.box, r() < 0.5 ? 0x8a2a2a : 0x2a4a7a, { x, y: 0.04, z, ry: r() * 3, sx: 0.22, sy: 0.07, sz: 0.3 })); break;
        case 'puddle': k.add(G.cyl, 0x10284a, { y: 0.005, sx: 0.7, sy: 0.01, sz: 0.5 }); break;
        case 'coals': scatter(5, (x, z) => k.add(G.dod, r() < 0.4 ? 0xff5010 : 0x1a1210, { x, y: 0.03, z, sx: 0.08, sy: 0.05, sz: 0.08, glow: r() < 0.4 })); break;
        case 'chains': scatter(3, (x, z) => k.add(G.tor, 0x4a4a50, { x, y: 0.02, z, rx: Math.PI / 2, sx: 0.25, sy: 0.25, sz: 0.25 })); break;
        case 'slag': k.add(G.dod, 0x2a1a14, { y: 0.04, sx: 0.4, sy: 0.08, sz: 0.3 }); break;
        case 'shards': scatter(4, (x, z) => k.add(G.oct, accent, { x, y: 0.06, z, sx: 0.06, sy: 0.18, sz: 0.06, rz: r(), glow: r() < 0.3 })); break;
        case 'gems': scatter(3, (x, z) => k.add(G.oct, [0xff4080, 0x40ffb0, 0xffd040][(r() * 3) | 0], { x, y: 0.06, z, sx: 0.09, sy: 0.12, sz: 0.09, glow: true })); break;
        case 'candles': scatter(3, (x, z) => { k.add(G.cyl, 0xf0e8d0, { x, y: 0.08, z, sx: 0.06, sy: 0.16, sz: 0.06 }); k.add(G.sph, 0xffc060, { x, y: 0.19, z, sx: 0.05, sy: 0.08, sz: 0.05, glow: true }); }); break;
        case 'cogs': scatter(2, (x, z) => k.add(G.tor, 0xb08a40, { x, y: 0.02, z, rx: Math.PI / 2, sx: 0.4, sy: 0.4, sz: 0.4 })); break;
        case 'bolts': scatter(4, (x, z) => k.add(G.cyl, 0x8a8a90, { x, y: 0.02, z, sx: 0.05, sy: 0.04, sz: 0.05 })); break;
        case 'grate': k.add(G.box, 0x2a2418, { y: 0.005, sx: 0.7, sy: 0.01, sz: 0.7 }); break;
        case 'snow': scatter(3, (x, z) => k.add(G.sph, 0xf0f8ff, { x, y: 0, z, sx: 0.4, sy: 0.08, sz: 0.3 })); break;
        case 'icicles': scatter(3, (x, z) => k.add(G.cone, 0xc8ecff, { x, y: 0.12, z, sx: 0.08, sy: 0.25, sz: 0.08 })); break;
        case 'stardust': scatter(6, (x, z) => k.add(G.sph, 0xd0c0ff, { x, y: 0.03 + r() * 0.2, z, sx: 0.03, sy: 0.03, sz: 0.03, glow: true })); break;
        case 'runes': k.add(G.tor, accent, { y: 0.01, rx: Math.PI / 2, sx: 0.8, sy: 0.8, sz: 0.1, glow: true }); break;
        case 'blackflame': k.add(G.cone, 0x6a40c0, { y: 0.18, sx: 0.12, sy: 0.35, sz: 0.12, glow: true }); break;
        case 'ash': scatter(3, (x, z) => k.add(G.dod, 0x3a3640, { x, y: 0, z, sx: 0.3, sy: 0.03, sz: 0.25 })); break;
        default: k.add(G.dod, 0x555555, { y: 0.03, sx: 0.15, sy: 0.05, sz: 0.15 });
    }
    return k.bake();
}

/** Glowing light-source decor (fungus, crystals, candles…). */
export function buildGlow(kind, color, seed = 1) {
    const r = rnd(seed);
    const k = kit();
    switch (kind) {
        case 'glowshroom': for (let i = 0; i < 4; i++) { const x = (r() - 0.5) * 0.5, z = (r() - 0.5) * 0.5, h = 0.2 + r() * 0.35; k.add(G.cyl, 0xd0e8e0, { x, y: h / 2, z, sx: 0.06, sy: h, sz: 0.06 }); k.add(G.cap, color, { x, y: h, z, sx: 0.28, sy: 0.16, sz: 0.28, glow: true }); } break;
        case 'crystal': case 'gems': for (let i = 0; i < 4; i++) k.add(G.oct, color, { x: (r() - 0.5) * 0.5, y: 0.3, z: (r() - 0.5) * 0.5, sx: 0.18, sy: 0.5 + r() * 0.5, sz: 0.18, rz: (r() - 0.5) * 0.5, glow: true }); break;
        case 'candles': for (let i = 0; i < 4; i++) { const x = (r() - 0.5) * 0.4, z = (r() - 0.5) * 0.4, h = 0.15 + r() * 0.25; k.add(G.cyl, 0xf0e8d0, { x, y: h / 2, z, sx: 0.07, sy: h, sz: 0.07 }); k.add(G.sph, 0xffc060, { x, y: h + 0.04, z, sx: 0.06, sy: 0.1, sz: 0.06, glow: true }); } break;
        case 'coals': k.add(G.cyl, 0x2a1e1a, { y: 0.1, sx: 0.6, sy: 0.2, sz: 0.6 }); for (let i = 0; i < 6; i++) k.add(G.dod, 0xff5010, { x: (r() - 0.5) * 0.4, y: 0.2, z: (r() - 0.5) * 0.4, sx: 0.12, sy: 0.08, sz: 0.12, glow: true }); break;
        case 'lamp': k.add(G.cyl, 0x5a4a30, { y: 0.5, sx: 0.08, sy: 1.0, sz: 0.08 }).add(G.sph, 0xffd890, { y: 1.05, sx: 0.22, sy: 0.22, sz: 0.22, glow: true }); break;
        case 'aurora': for (let i = 0; i < 3; i++) k.add(G.oct, color, { x: (r() - 0.5) * 0.4, y: 0.35, z: (r() - 0.5) * 0.4, sx: 0.2, sy: 0.8, sz: 0.2, glow: true }); break;
        case 'starstone': k.add(G.dod, 0x1a1430, { y: 0.2, sx: 0.5, sy: 0.4, sz: 0.5 }).add(G.sph, color, { y: 0.5, sx: 0.18, sy: 0.18, sz: 0.18, glow: true }); break;
        case 'blackfire': k.add(G.cyl, 0x0e0a14, { y: 0.1, sx: 0.5, sy: 0.2, sz: 0.5 }).add(G.cone, color, { y: 0.45, sx: 0.3, sy: 0.6, sz: 0.3, glow: true }); break;
        default: k.add(G.sph, color, { y: 0.3, sx: 0.3, sy: 0.3, sz: 0.3, glow: true });
    }
    return k.bake();
}

/** Items lying on the floor. */
export function buildItem(it) {
    const k = kit();
    const b = it.b, kind = it.k;
    if (kind === 'gold') { for (let i = 0; i < 5; i++) k.add(G.cyl, 0xffc840, { x: (i % 3 - 1) * 0.08, y: 0.02 + Math.floor(i / 3) * 0.04, z: ((i * 7) % 3 - 1) * 0.07, sx: 0.12, sy: 0.03, sz: 0.12, glow: i === 4 }); return k.bake(); }
    if (kind === 'potion') { const col = { heal: 0xff3a50, heal2: 0xff2a90, oil: 0xffb030, antidote: 0x50ff80, haste: 0x50d0ff, might: 0xff9030 }[b] || 0xffffff; k.add(G.sph, 0xd0e0f0, { y: 0.12, sx: 0.2, sy: 0.2, sz: 0.2 }).add(G.sph, col, { y: 0.11, sx: 0.16, sy: 0.15, sz: 0.16, glow: true }).add(G.cyl, 0xd0e0f0, { y: 0.26, sx: 0.07, sy: 0.12, sz: 0.07 }).add(G.cyl, 0x6a4424, { y: 0.33, sx: 0.08, sy: 0.04, sz: 0.08 }); return k.bake(); }
    if (kind === 'scroll') { k.add(G.cyl, 0xe8d8a8, { y: 0.06, rz: Math.PI / 2, sx: 0.1, sy: 0.32, sz: 0.1 }).add(G.cyl, 0xa03030, { y: 0.06, rz: Math.PI / 2, sx: 0.11, sy: 0.04, sz: 0.11 }); return k.bake(); }
    if (kind === 'bomb') { k.add(G.sph, b === 'frostbomb' ? 0x2a4a6a : 0x2a2a2a, { y: 0.12, sx: 0.24, sy: 0.24, sz: 0.24 }).add(G.sph, b === 'frostbomb' ? 0x80e0ff : 0xff6020, { y: 0.28, sx: 0.05, sy: 0.05, sz: 0.05, glow: true }); return k.bake(); }
    if (kind === 'key') { k.add(G.tor, 0xffd040, { y: 0.03, rx: Math.PI / 2, sx: 0.25, sy: 0.25, sz: 0.4 }).add(G.box, 0xffd040, { x: 0.18, y: 0.03, sx: 0.25, sy: 0.04, sz: 0.04, glow: true }); return k.bake(); }
    if (kind === 'page' || kind === 'heirloom' || kind === 'trinket') { k.add(G.plane, 0xf8f0d8, { y: 0.03, sx: 0.3, sz: 0.38, ry: 0.4, glow: kind === 'page' }).add(G.sph, 0xffd8a0, { y: 0.05, sx: 0.08, sy: 0.04, sz: 0.08, glow: true }); return k.bake(); }
    if (kind === 'weapon') {
        const st = it.style;
        if (st === 'ranged') k.add(G.tor, 0x6a4424, { y: 0.04, rx: Math.PI / 2, sx: 0.8, sy: 0.8, sz: 0.4 }).add(G.box, 0xd0d0d0, { y: 0.04, sx: 0.02, sy: 0.02, sz: 0.6 });
        else if (st === 'magic') k.add(G.cyl, 0x5a3a20, { y: 0.04, rx: Math.PI / 2, sx: 0.06, sy: 0.8, sz: 0.06 }).add(G.oct, 0xff9040, { z: -0.42, y: 0.06, sx: 0.12, sy: 0.16, sz: 0.12, glow: true });
        else k.add(G.box, 0xc8ccd8, { y: 0.03, sx: 0.08, sy: 0.02, sz: 0.55 }).add(G.box, 0x6a4a2a, { y: 0.03, z: 0.34, sx: 0.06, sy: 0.04, sz: 0.16 }).add(G.box, 0x9a8a50, { y: 0.03, z: 0.26, sx: 0.22, sy: 0.04, sz: 0.04 });
        return k.bake();
    }
    if (kind === 'armor') { k.add(G.box, b === 'plate' || b === 'chain' ? 0x9a9aa8 : b === 'robe' ? 0x6a3a8a : 0x7a5434, { y: 0.06, sx: 0.4, sy: 0.12, sz: 0.36 }).add(G.box, 0x5a3a20, { y: 0.06, z: 0.12, sx: 0.42, sy: 0.13, sz: 0.06 }); return k.bake(); }
    if (kind === 'ring') { k.add(G.tor, 0xffd060, { y: 0.03, rx: Math.PI / 2, sx: 0.3, sy: 0.3, sz: 0.6 }).add(G.oct, 0x60d0ff, { y: 0.08, z: -0.1, sx: 0.07, sy: 0.07, sz: 0.07, glow: true }); return k.bake(); }
    if (kind === 'amulet') { k.add(G.tor, 0xc8b070, { y: 0.02, rx: Math.PI / 2, sx: 0.45, sy: 0.45, sz: 0.3 }).add(G.oct, 0xff60a0, { y: 0.05, z: 0.18, sx: 0.1, sy: 0.12, sz: 0.1, glow: true }); return k.bake(); }
    k.add(G.box, 0xaaaaaa, { y: 0.06, sx: 0.2, sy: 0.12, sz: 0.2 });
    return k.bake();
}

export const RARITY_COLORS = [0xd8d8d8, 0x5aa8ff, 0xffd040, 0xff8a20];
