// The Springwood's special places: every so often, in a clearing of its own,
// something to find. A thatched cottage with the lamps lit, a ring of glowing
// toadstools, a picnic someone has only just left, a circle of mossy standing
// stones, a wishing well, and a great blossom tree, the Great Tree's sister.
// Each is built into the chunk its middle falls in (forest-land.js), from the
// same coloured pieces as the rest of the wood. The lily ponds count too.

import * as THREE from 'three';
import { rng, fbm2, noise2, clamp, TAU } from './util.js';
import { C, mat, paint, rockGeo, mossyStone } from './forest-kit.js';

/** The places the wood can put in a clearing, and how much room each wants. */
export const PLACE_KINDS = [
    { id: 'cottage', name: 'The Bramble Cottage', sub: 'The lamps are lit and the kettle is on', accent: '#ffcf8a', r: 10, note: 'Nobody is home, but the lamps are lit and there is a woodpile by the wall.' },
    { id: 'fairyring', name: 'A Fairy Ring', sub: 'Toadstools in a perfect circle', accent: '#c8b0ff', r: 6, note: 'A perfect circle of toadstools. Best not to step inside after dark.' },
    { id: 'picnic', name: 'A Forgotten Picnic', sub: 'The tea is still warm', accent: '#ff9aa6', r: 6, note: 'A checked blanket, a teapot, cake, and a small bear keeping watch.' },
    { id: 'stones', name: 'The Mossy Stones', sub: 'Older than the oldest tree', accent: '#a8e0b0', r: 9, note: 'A ring of standing stones, green with moss, round a flat stone table.' },
    { id: 'well', name: 'The Wishing Well', sub: 'Make a wish', accent: '#9fd8ff', r: 6, note: 'An old stone well with a bucket on a rope. The water shines a little, even at night.' },
    { id: 'elder', name: 'The Elder Blossom', sub: "The Great Tree's sister, far from home", accent: '#ffb7d5', r: 10, note: 'A great old blossom tree, with a bench to sit and look up into it.' },
];
export const POND = { id: 'pond', name: 'A Lily Pond', sub: 'Lilies, reeds and still water', accent: '#8fe0d0', note: 'Still water, lily pads and a fringe of reeds.' };
export const ALL_PLACES = [...PLACE_KINDS, POND];

/** Local placement in a place's clearing: x across, z out of its front, y up from its floor. */
function placer(f) {
    const c = Math.cos(f.yaw), s = Math.sin(f.yaw);
    return {
        at: (lx, lz) => ({ x: f.x + lx * c + lz * s, z: f.z - lx * s + lz * c }),
        m(lx, ly, lz, yaw = 0, sx = 1, sy = sx, sz = sx, tx = 0, tz = 0) {
            const p = this.at(lx, lz);
            return mat(p.x, f.y0 + ly, p.z, f.yaw + yaw, sx, sy, sz, tx, tz);
        },
    };
}

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, n = 8, open = false) => new THREE.CylinderGeometry(rt, rb, h, n, 1, open);
const proto = (list, r) => list[Math.floor(r() * list.length)];

/** Ring of circles along a rectangle's edge (for walls). */
function wallColliders(L, cx, cz, w, d, colliders, rad = 0.5) {
    const per = 2 * (w + d), n = Math.ceil(per / 0.8);
    for (let k = 0; k < n; k++) {
        let s = (k / n) * per, lx, lz;
        if (s < w) [lx, lz] = [-w / 2 + s, -d / 2];
        else if ((s -= w) < d) [lx, lz] = [w / 2, -d / 2 + s];
        else if ((s -= d) < w) [lx, lz] = [w / 2 - s, d / 2];
        else [lx, lz] = [-w / 2, d / 2 - (s - w)];
        const p = L.at(cx + lx, cz + lz);
        colliders.push({ x: p.x, z: p.z, r: rad });
    }
}

// ------------------------------------------------------------------ the cottage

function cottage(acc, f, colliders, env) {
    const r = rng('cottage' + f.seed);
    const L = placer(f);
    const t = new THREE.Color();
    const cream = C('#efe2c8'), stone = C('#8c867a'), beam = C('#5a3e2a'), thatch = C('#c9a15a'), thatchDark = C('#9a7638');
    // walls, with a stone footing
    acc.add(box(5, 2.3, 4), L.m(0, 1.15, 0), { colorFn: (v) => (v.y < -0.75 ? t.copy(stone).multiplyScalar(0.85 + noise2(v.x * 4, v.z * 4 + v.y * 6) * 0.2) : t.copy(cream).multiplyScalar(0.95 + noise2(v.x * 2, v.y * 3) * 0.06)) });
    for (const [x, z] of [[-2.5, -2], [2.5, -2], [-2.5, 2], [2.5, 2]]) acc.add(box(0.2, 2.3, 0.2), L.m(x, 1.15, z), { color: beam });
    acc.add(box(5.1, 0.16, 0.12), L.m(0, 2.25, 2.02), { color: beam });
    acc.add(box(5.1, 0.16, 0.12), L.m(0, 2.25, -2.02), { color: beam });
    // the gable ends
    const tri = new THREE.Shape([new THREE.Vector2(-2.05, 0), new THREE.Vector2(2.05, 0), new THREE.Vector2(0, 1.55)]);
    const gable = new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false }).rotateY(Math.PI / 2);
    for (const x of [-2.5, 2.44]) acc.add(gable, L.m(x - 0.03, 2.3, 0), { color: cream });
    // the thatch: two thick slopes, rounded over the ridge
    const ang = Math.atan2(1.75, 2.6);
    const slope = new THREE.BoxGeometry(5.9, 0.34, 3.3, 8, 1, 4);
    const thatchFn = (v) => t.copy(thatch).lerp(thatchDark, clamp(0.5 + Math.sin(v.x * 9 + noise2(v.x * 2, v.z * 3) * 3) * 0.25 + fbm2(v.x * 1.5, v.z * 1.5, 2) * 0.6, 0, 1));
    for (const s of [-1, 1]) acc.add(slope, L.m(0, 3.05, s * 1.36, 0, 1, 1, 1, s * ang), { colorFn: thatchFn });
    acc.add(cyl(0.3, 0.3, 5.95, 8).rotateZ(Math.PI / 2), L.m(0, 4.0, 0), { colorFn: thatchFn });
    // chimney
    acc.add(box(0.62, 2.2, 0.62), L.m(1.55, 3.7, -0.9), { colorFn: (v) => t.copy(stone).multiplyScalar(0.8 + noise2(v.x * 9 + v.z * 9, v.y * 7) * 0.25) });
    acc.add(box(0.72, 0.14, 0.72), L.m(1.55, 4.84, -0.9), { color: C('#6e685e') });
    // the door, the windows (lit after dark) and flower boxes under them
    acc.add(box(0.95, 1.75, 0.1), L.m(0, 0.88, 2.03), { colorFn: (v) => t.copy(C('#6a3e22')).multiplyScalar(0.85 + Math.abs(Math.sin(v.x * 18)) * 0.2) });
    acc.add(box(0.07, 0.07, 0.06), L.m(0.3, 0.9, 2.1), { color: C('#e8c860'), glow: 0.4 });
    const glass = C('#ffd27a');
    const windows = [[-1.55, 2.03, 0], [1.55, 2.03, 0], [2.53, 0, Math.PI / 2], [-2.53, 0.6, -Math.PI / 2]];
    for (const [x, z, yaw] of windows) {
        const front = yaw === 0;
        acc.add(box(0.85, 0.75, 0.06), L.m(x, 1.35, z, yaw), { color: glass, glow: 1.3 });
        acc.add(box(0.95, 0.08, 0.1), L.m(x, 1.35, z + (front ? 0.02 : 0), yaw), { color: beam });
        acc.add(box(0.08, 0.85, 0.1), L.m(x, 1.35, z + (front ? 0.02 : 0), yaw), { color: beam });
        if (front) {
            acc.add(box(1.0, 0.2, 0.28), L.m(x, 0.86, z + 0.16), { color: C('#7a5232') });
            for (let k = 0; k < 3; k++) acc.addProto(proto(env.P.tulip, r), L.m(x - 0.3 + k * 0.3, 0.95, z + 0.16, r() * TAU, 0.55));
        }
    }
    // a lantern by the door
    acc.add(box(0.08, 1.5, 0.08), L.m(0.85, 0.75, 2.6), { color: beam });
    acc.add(box(0.22, 0.28, 0.22), L.m(0.85, 1.6, 2.6), { color: C('#ffe0a0'), glow: 1.6 });
    acc.add(box(0.28, 0.06, 0.28), L.m(0.85, 1.77, 2.6), { color: C('#3a2a1e') });
    // stepping stones from the door
    for (let k = 0; k < 6; k++) {
        const z = 2.7 + k * 0.85, x = Math.sin(k * 1.3) * 0.25;
        acc.add(cyl(0.3, 0.32, 0.12, 7), L.m(x, 0.02, z, k), { colorFn: mossyStone(k * 7, 0.3) });
    }
    // a woodpile against the side wall
    const wood = C('#8a6440'), end = C('#d8b080');
    const logGeo = cyl(0.13, 0.13, 1.3, 7).rotateX(Math.PI / 2);
    for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) {
        acc.add(logGeo, L.m(-2.72 - k * 0.26 - row * 0.13, 0.14 + row * 0.23, -0.75), { colorFn: (v, n) => (Math.abs(n.z) > 0.9 ? end : wood) });
    }
    // flowers round about
    for (let k = 0; k < 16; k++) {
        const a = r() * TAU, d = r.range(3.4, 7.5);
        const lx = Math.sin(a) * d * 1.2, lz = Math.cos(a) * d;
        if (Math.abs(lx) < 1 && lz > 2) continue;
        const p = L.at(lx, lz);
        const list = r() < 0.5 ? env.P.tulip : r() < 0.5 ? env.P.daisy : env.P.daffodil;
        acc.addProto(proto(list, r), mat(p.x, env.groundY(p.x, p.z) - 0.02, p.z, r() * TAU, r.range(0.8, 1.2)));
    }
    wallColliders(L, 0, 0, 5.2, 4.2, colliders);
    const wp = L.at(-3.1, -0.75);
    colliders.push({ x: wp.x, z: wp.z, r: 0.7 });
    const lp = L.at(0.85, 2.6);
    colliders.push({ x: lp.x, z: lp.z, r: 0.2 });
}

// ------------------------------------------------------------------ the fairy ring

function fairyRing(acc, f, colliders, env) {
    const r = rng('fairy' + f.seed);
    const L = placer(f);
    const n = r.int(18, 24), R = r.range(2.6, 3.1);
    for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + r.range(-0.06, 0.06), d = R + r.range(-0.15, 0.15);
        acc.addProto(proto(r() < 0.8 ? env.P.mushFairy : env.P.mushRed, r), L.m(Math.sin(a) * d, -0.01, Math.cos(a) * d, r() * TAU, r.range(1.2, 1.9)));
    }
    for (let k = 0; k < 10; k++) {
        const a = r() * TAU, d = r() * (R - 0.6);
        acc.addProto(proto(r() < 0.5 ? env.P.forget : env.P.clover, r), L.m(Math.sin(a) * d, -0.01, Math.cos(a) * d, r() * TAU, r.range(0.8, 1.2)));
    }
    // a few tiny lights hanging in the air over the ring
    const spark = new THREE.OctahedronGeometry(0.04, 0);
    for (let k = 0; k < 14; k++) {
        const a = r() * TAU, d = r() * R;
        acc.add(spark, L.m(Math.sin(a) * d, r.range(0.5, 1.8), Math.cos(a) * d, r() * TAU), { color: C(r.pick(['#e0d0ff', '#c8f0ff', '#fff0c0'])), glow: 2.2, sway: 0.25, swayH: 1 });
    }
}

// ------------------------------------------------------------------ the picnic

function picnic(acc, f, colliders, env) {
    const r = rng('picnic' + f.seed);
    const L = placer(f);
    // the blanket: a checked cloth, a little rumpled
    const cloth = new THREE.PlaneGeometry(2.6, 2.0, 8, 6).rotateX(-Math.PI / 2).toNonIndexed();
    const p = cloth.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, Math.abs(noise2(p.getX(i) * 2.2, p.getZ(i) * 2.2)) * 0.035);
    cloth.computeVertexNormals();
    const red = C(r.pick(['#d8434a', '#3a78c8', '#4aa05a'])), white = C('#f6efe6');
    paint(cloth, (v, n, i) => {
        const cell = Math.floor(Math.floor(i / 3) / 2);
        return (cell % 8 + Math.floor(cell / 8)) % 2 ? red : white;
    });
    acc.add(cloth, L.m(0, 0.03, 0));
    // the basket, with its lid half open
    const wick = C('#b8874a'), wickDark = C('#8a6030'), t = new THREE.Color();
    acc.add(cyl(0.3, 0.26, 0.3, 12), L.m(-0.85, 0.18, -0.55, 0.3), { colorFn: (v) => t.copy(Math.sin(v.y * 60) > 0 ? wick : wickDark) });
    acc.add(new THREE.TorusGeometry(0.26, 0.022, 5, 14, Math.PI), L.m(-0.85, 0.33, -0.55, 0.3), { color: wickDark });
    // a teapot, two cups on saucers, and a cake on a plate
    const china = C('#a8c8e8'), cream = C('#fffaf0');
    acc.add(new THREE.SphereGeometry(0.15, 10, 8).scale(1, 0.85, 1), L.m(0.2, 0.17, -0.3), { color: china });
    acc.add(new THREE.SphereGeometry(0.06, 8, 4), L.m(0.2, 0.3, -0.3), { color: china });
    acc.add(cyl(0.02, 0.035, 0.2, 6), L.m(0.36, 0.22, -0.3, 0, 1, 1, 1, 0, -0.9), { color: china });
    acc.add(new THREE.TorusGeometry(0.07, 0.015, 5, 10), L.m(0.04, 0.2, -0.3, Math.PI / 2), { color: china });
    for (const [x, z] of [[0.55, 0.15], [-0.25, 0.45]]) {
        acc.add(cyl(0.09, 0.09, 0.012, 12), L.m(x, 0.05, z), { color: cream });
        acc.add(cyl(0.05, 0.04, 0.07, 10), L.m(x, 0.09, z), { colorFn: (v, n) => (n.y > 0.9 ? C('#a8683a') : cream) });
    }
    acc.add(cyl(0.22, 0.22, 0.015, 14), L.m(0.6, 0.05, -0.45), { color: cream });
    acc.add(cyl(0.15, 0.15, 0.13, 14), L.m(0.6, 0.12, -0.45), { colorFn: (v, n) => (n.y > 0.9 ? cream : Math.abs(v.y) < 0.015 ? C('#e85a7a') : C('#f8c8a8')) });
    for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        acc.add(new THREE.TetrahedronGeometry(0.03), L.m(0.6 + Math.sin(a) * 0.09, 0.2, -0.45 + Math.cos(a) * 0.09), { color: C('#e82a3a') });
    }
    // a small bear keeping watch
    const fur = C('#9a6a40'), muzzle = C('#d8b088');
    acc.add(new THREE.SphereGeometry(0.17, 10, 8).scale(1, 1.15, 0.9), L.m(-0.9, 0.22, 0.5), { color: fur });
    acc.add(new THREE.SphereGeometry(0.12, 10, 8), L.m(-0.9, 0.49, 0.52), { color: fur });
    acc.add(new THREE.SphereGeometry(0.05, 8, 6), L.m(-0.9, 0.47, 0.63), { color: muzzle });
    for (const s of [-1, 1]) {
        acc.add(new THREE.SphereGeometry(0.045, 8, 6), L.m(-0.9 + s * 0.09, 0.59, 0.5), { color: fur });
        acc.add(new THREE.SphereGeometry(0.06, 8, 6).scale(1, 1, 1.6), L.m(-0.9 + s * 0.09, 0.08, 0.63), { color: fur });
        acc.add(new THREE.SphereGeometry(0.05, 8, 6).scale(1, 1.6, 1), L.m(-0.9 + s * 0.17, 0.24, 0.55), { color: fur });
        acc.add(new THREE.SphereGeometry(0.014, 6, 4), L.m(-0.9 + s * 0.04, 0.52, 0.62), { color: C('#1a1410') });
    }
    // a lantern for when it gets dark
    acc.add(box(0.16, 0.22, 0.16), L.m(1.15, 0.14, 0.8), { color: C('#ffe0a0'), glow: 1.6 });
    acc.add(box(0.2, 0.04, 0.2), L.m(1.15, 0.27, 0.8), { color: C('#3a2a1e') });
    for (let k = 0; k < 10; k++) {
        const a = r() * TAU, d = r.range(2.4, 5.5);
        const q = L.at(Math.sin(a) * d, Math.cos(a) * d);
        acc.addProto(proto(r() < 0.6 ? env.P.daisy : env.P.buttercup, r), mat(q.x, env.groundY(q.x, q.z) - 0.02, q.z, r() * TAU));
    }
}

// ------------------------------------------------------------------ the stones

function stones(acc, f, colliders, env) {
    const r = rng('stones' + f.seed);
    const L = placer(f);
    const n = r.int(7, 9), R = 5;
    for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + r.range(-0.1, 0.1);
        const h = r.range(1.4, 2.5), seed = r() * 100;
        const g = rockGeo(seed);
        const lx = Math.sin(a) * R, lz = Math.cos(a) * R;
        acc.add(g, L.m(lx, h * 0.45, lz, a + r.range(-0.3, 0.3), 0.62, h * 0.62, 0.42, r.range(-0.08, 0.08), r.range(-0.08, 0.08)), { colorFn: mossyStone(seed, 1.2) });
        g.dispose();
        const q = L.at(lx, lz);
        colliders.push({ x: q.x, z: q.z, r: 0.62 });
        acc.addProto(proto(r() < 0.5 ? env.P.fern : env.P.bluebell, r), L.m(lx * 1.12, 0, lz * 1.12, r() * TAU));
    }
    const g = rockGeo(f.seed);
    acc.add(g, L.m(0, 0.25, 0, r() * TAU, 1.3, 0.38, 1.0), { colorFn: mossyStone(f.seed, 0.8) });
    g.dispose();
    const c = L.at(0, 0);
    colliders.push({ x: c.x, z: c.z, r: 1.15 });
    for (let k = 0; k < 8; k++) {
        const a = r() * TAU, d = r.range(1.8, 3.8);
        acc.addProto(proto(env.P.forget, r), L.m(Math.sin(a) * d, -0.01, Math.cos(a) * d, r() * TAU));
    }
}

// ------------------------------------------------------------------ the well

function well(acc, f, colliders, env) {
    const r = rng('well' + f.seed);
    const L = placer(f);
    const t = new THREE.Color(), stone = C('#9a948a');
    const ring = new THREE.LatheGeometry([new THREE.Vector2(0.78, 0), new THREE.Vector2(1.05, 0), new THREE.Vector2(1.05, 0.85), new THREE.Vector2(0.98, 0.95), new THREE.Vector2(0.82, 0.95), new THREE.Vector2(0.78, 0.85), new THREE.Vector2(0.78, 0)], 16);
    acc.add(ring, L.m(0, 0, 0), {
        colorFn: (v) => {
            const row = Math.floor(v.y * 5), a = Math.atan2(v.z, v.x) * 3 + row * 0.5;
            const mortar = Math.abs(Math.sin(a * 2)) < 0.12 || Math.abs(Math.sin(v.y * 5 * Math.PI)) < 0.15;
            return t.copy(stone).multiplyScalar(mortar ? 0.65 : 0.85 + noise2(row * 3.1, Math.floor(a) * 1.7) * 0.25);
        },
    });
    acc.add(new THREE.CircleGeometry(0.78, 16).rotateX(-Math.PI / 2), L.m(0, 0.5, 0), { color: C('#1e4a6a'), glow: 0.5 });
    const wood = C('#6a4a30');
    for (const s of [-1, 1]) acc.add(box(0.12, 2.0, 0.12), L.m(s * 0.95, 1.0, 0), { color: wood });
    acc.add(cyl(0.06, 0.06, 2.1, 8).rotateZ(Math.PI / 2), L.m(0, 1.7, 0), { color: wood });
    acc.add(cyl(0.008, 0.008, 0.6, 4), L.m(0, 1.38, 0), { color: C('#c8b088') });
    acc.add(cyl(0.12, 0.1, 0.2, 10), L.m(0, 1.0, 0), { colorFn: (v) => t.copy(wood).multiplyScalar(Math.abs(v.y) > 0.07 ? 0.6 : 1) });
    const roofAng = 0.62;
    for (const s of [-1, 1]) acc.add(box(1.0, 0.08, 2.5), L.m(s * 0.38, 2.2, 0, 0, 1, 1, 1, 0, -s * roofAng), { colorFn: (v) => t.copy(C('#8a4a3a')).multiplyScalar(0.8 + Math.abs(Math.sin(v.z * 14)) * 0.25) });
    const c = L.at(0, 0);
    colliders.push({ x: c.x, z: c.z, r: 1.2 });
    for (let k = 0; k < 10; k++) {
        const a = r() * TAU, d = r.range(1.4, 3.2);
        acc.addProto(proto(r() < 0.5 ? env.P.tuft : env.P.forget, r), L.m(Math.sin(a) * d, -0.01, Math.cos(a) * d, r() * TAU));
    }
}

// ------------------------------------------------------------------ the elder blossom

function elder(acc, f, colliders, env) {
    const r = rng('elder' + f.seed);
    const L = placer(f);
    acc.addProto(env.P.elder[0], L.m(0, -0.2, 0, r() * TAU, 1), { swayScale: 0.6 });
    const c = L.at(0, 0);
    colliders.push({ x: c.x, z: c.z, r: 0.75 });
    // a bench to sit and look up into it
    const wood = C('#8a5a3a'), t = new THREE.Color();
    const bz = 4.2;
    acc.add(box(1.8, 0.08, 0.45), L.m(0, 0.48, bz), { colorFn: (v) => t.copy(wood).multiplyScalar(0.85 + Math.abs(Math.sin(v.x * 9)) * 0.2) });
    acc.add(box(1.8, 0.4, 0.06), L.m(0, 0.8, bz + 0.22, 0, 1, 1, 1, 0.15), { color: wood });
    for (const s of [-1, 1]) for (const dz of [-0.18, 0.18]) acc.add(box(0.07, 0.48, 0.07), L.m(s * 0.8, 0.24, bz + dz), { color: C('#5a3a24') });
    const b = L.at(0, bz);
    colliders.push({ x: b.x, z: b.z, r: 0.5 }, { ...L.at(-0.7, bz), r: 0.4 }, { ...L.at(0.7, bz), r: 0.4 });
    // daffodils in a ring under the boughs
    for (let k = 0; k < 22; k++) {
        const a = (k / 22) * TAU + r.range(-0.1, 0.1), d = r.range(2.4, 3.6);
        if (Math.abs(Math.sin(a)) < 0.3 && Math.cos(a) > 0) continue;
        acc.addProto(proto(env.P.daffodil, r), L.m(Math.sin(a) * d, -0.02, Math.cos(a) * d, r() * TAU));
    }
}

const BUILD = { cottage, fairyring: fairyRing, picnic, stones, well, elder };

/** Build place `f` (from featureIn) into `acc`, adding what can't be walked through to `colliders`. */
export function buildPlace(acc, f, colliders, env) {
    BUILD[f.kind]?.(acc, f, colliders, env);
}
