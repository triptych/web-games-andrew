// Things that stand in the mine: track, the cart, timber supports, lanterns,
// crates, a trestle across the lava, a miner who never made it home. Each is
// built from boxes and cylinders in a Batch, in the track's own frame: x to the
// left of travel, y up, z along the line.

import * as THREE from 'three';
import { Batch, xf } from './materials.js';
import { pointAt, frameAt, TRACK } from './minepath.js';
import { rng, TAU } from './util.js';
import { noise3, spikeGeometry } from './minegeo.js';

const P = {}, F = {};
const M4 = new THREE.Matrix4();

/** A box whose texture coordinates follow its size, so grain and planks keep a real-world scale. */
export function boxUV(w, h, d, k = 1.2) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) {
        for (let i = 0; i < 4; i++) {
            const n = f * 4 + i;
            uv.setXY(n, uv.getX(n) * dims[f][0] * k, uv.getY(n) * dims[f][1] * k);
        }
    }
    return g;
}

/** The matrix that puts local (x left, y up, z ahead) at track position s, offset (lx, ly, ls) and turned by yaw/roll. */
export function trackMatrix(s, lx = 0, ly = 0, ls = 0, yaw = 0, bank = 1, out = new THREE.Matrix4()) {
    pointAt(s, P);
    frameAt(s, F, bank);
    const { t, l, u } = F;
    out.makeBasis(new THREE.Vector3(l.x, l.y, l.z), new THREE.Vector3(u.x, u.y, u.z), new THREE.Vector3(t.x, t.y, t.z));
    out.setPosition(P.x + l.x * lx + u.x * ly + t.x * ls, P.y + l.y * lx + u.y * ly + t.y * ls, P.z + l.z * lx + u.z * ly + t.z * ls);
    if (yaw) out.multiply(M4.makeRotationY(yaw));
    return out;
}

/** Materials the parts use, built on the garden's own (wood, iron, brass...) so night glow works the same. */
export function partMaterials(base) {
    const std = (o) => new THREE.MeshStandardMaterial(o);
    return {
        wood: base.wood, darkWood: base.darkWood, iron: base.iron, brass: base.brass, bronze: base.bronze, copper: base.copper,
        oldWood: std({ map: base.darkWood.map, normalMap: base.darkWood.normalMap, color: 0x5a4636, roughness: 0.92 }),
        rust: std({ color: 0x6b3b24, roughness: 0.75, metalness: 0.55 }),
        blackIron: std({ color: 0x17161a, roughness: 0.55, metalness: 0.8 }),
        lanternGlass: std({ color: 0x3a2008, emissive: 0xffa040, emissiveIntensity: 3.0, roughness: 0.3 }),
        bone: std({ color: 0xcfc5ae, roughness: 0.7 }),
        canvas: std({ color: 0x8a7a5c, roughness: 1 }),
        gravel: std({ color: 0x3b3835, roughness: 1 }),
        coal: std({ color: 0x0b0a0c, roughness: 0.4, metalness: 0.3 }),
    };
}

// ---------------------------------------------------------------- track

/** Rails, sleepers and a bed of gravel from s0 to s1. Returns a Group. */
export function buildTrack(s0, s1, mats) {
    const g = new THREE.Group();
    const step = 0.5;
    const n = Math.ceil((s1 - s0) / step);
    const half = TRACK.gauge / 2;
    const rail = (side) => {
        // a long box strip: four faces round a 0.06 x 0.1 section, rail top at y = 0
        const pos = [], idx = [];
        const w = TRACK.railW / 2, h = TRACK.railH;
        const corners = [[-w, 0], [w, 0], [w, -h], [-w, -h]];
        for (let i = 0; i <= n; i++) {
            const s = Math.min(s1, s0 + i * step);
            pointAt(s, P);
            frameAt(s, F);
            const { l, u } = F;
            for (const [cx, cy] of corners) {
                const lx = side * half + cx, ly = cy;
                pos.push(P.x + l.x * lx + u.x * ly, P.y + l.y * lx + u.y * ly, P.z + l.z * lx + u.z * ly);
            }
        }
        for (let i = 0; i < n; i++) {
            for (let c = 0; c < 4; c++) {
                const a = i * 4 + c, b = i * 4 + ((c + 1) % 4), c2 = (i + 1) * 4 + c, d = (i + 1) * 4 + ((c + 1) % 4);
                idx.push(a, b, c2, b, d, c2);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        return geo;
    };
    const rails = [rail(-1), rail(1)];
    for (const geo of rails) {
        const m = new THREE.Mesh(geo, mats.rust);
        m.castShadow = true;
        g.add(m);
    }
    // sleepers and the gravel under them
    const batch = new Batch();
    const sl = new THREE.BoxGeometry(1.55, 0.1, 0.17);
    const bed = new THREE.BoxGeometry(2.0, 0.26, step + 0.02);
    for (let s = s0 + 0.3; s < s1; s += TRACK.sleeperEvery) {
        batch.add('oldWood', sl, trackMatrix(s, 0, -0.11, 0));
    }
    for (let i = 0; i < n; i++) {
        const s = s0 + (i + 0.5) * step;
        batch.add('gravel', bed, trackMatrix(s, 0, -0.26, 0));
    }
    g.add(batch.build(mats, { castShadow: false, receiveShadow: true }));
    return g;
}

// ---------------------------------------------------------------- the cart

/** A wooden mine cart on four iron wheels, with a lantern on a pole. Local frame: x left, y up, z ahead. */
export function buildCart(mats) {
    const group = new THREE.Group();
    const b = new Batch();
    const W = 1.18, L = 2.1, H = 0.4;
    const floorY = 0.42;
    // floor and sides, slightly flared
    b.add('oldWood', boxUV(W - 0.1, 0.08, L - 0.1), xf(0, floorY, 0));
    for (const sd of [-1, 1]) {
        const m = xf(sd * (W / 2 - 0.04), floorY + H / 2, 0, 0, 1, 1, 1, 0, sd * 0.07);
        b.add('wood', boxUV(0.07, H, L), m);
        // iron straps
        for (const z of [-0.8, -0.27, 0.27, 0.8]) b.add('rust', new THREE.BoxGeometry(0.085, H + 0.04, 0.07), xf(sd * (W / 2 - 0.035), floorY + H / 2, z, 0, 1, 1, 1, 0, sd * 0.07));
        // rim
        b.add('rust', new THREE.BoxGeometry(0.12, 0.06, L + 0.06), xf(sd * (W / 2 + 0.0), floorY + H + 0.02, 0, 0, 1, 1, 1, 0, sd * 0.07));
    }
    for (const sd of [-1, 1]) {
        b.add('wood', boxUV(W - 0.02, H, 0.07), xf(0, floorY + H / 2, sd * (L / 2 - 0.03), 0, 1, 1, 1, sd * -0.06, 0));
        b.add('rust', new THREE.BoxGeometry(W + 0.04, 0.06, 0.12), xf(0, floorY + H + 0.02, sd * (L / 2 + 0.0)));
        for (const x of [-0.38, 0, 0.38]) b.add('rust', new THREE.BoxGeometry(0.07, H + 0.04, 0.085), xf(x, floorY + H / 2, sd * (L / 2 - 0.0), 0, 1, 1, 1, sd * -0.06, 0));
    }
    // chassis, axles, couplers
    b.add('blackIron', new THREE.BoxGeometry(0.1, 0.1, L + 0.5), xf(0, 0.3, 0));
    for (const z of [-0.68, 0.68]) b.add('blackIron', new THREE.CylinderGeometry(0.035, 0.035, TRACK.gauge + 0.16, 8).rotateZ(Math.PI / 2), xf(0, 0.18, z));
    for (const sd of [-1, 1]) b.add('blackIron', new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6).rotateX(Math.PI / 2), xf(0, 0.32, sd * (L / 2 + 0.3)));
    group.add(b.build(mats, { castShadow: true, receiveShadow: true }));
    // wheels: a rim, a hub and four spokes, spinning
    const wheels = [];
    const wheelGeo = new THREE.Group();
    {
        const parts = new Batch();
        parts.add('blackIron', new THREE.TorusGeometry(0.15, 0.03, 6, 18).rotateY(Math.PI / 2), xf());
        parts.add('blackIron', new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8).rotateZ(Math.PI / 2), xf());
        for (let k = 0; k < 4; k++) parts.add('blackIron', new THREE.BoxGeometry(0.045, 0.3, 0.03), xf(0, 0, 0, 0, 1, 1, 1, (k * Math.PI) / 4));
        wheelGeo.add(parts.build(mats, { castShadow: true }));
    }
    for (const z of [-0.68, 0.68]) {
        for (const sd of [-1, 1]) {
            const wmesh = wheelGeo.clone();
            wmesh.position.set(sd * (TRACK.gauge / 2), 0.18, z);
            group.add(wmesh);
            wheels.push(wmesh);
        }
    }
    // the lantern: a short pole at the front left corner with a cage and a glowing core
    const lanternGroup = new THREE.Group();
    lanternGroup.position.set(0.46, floorY + H + 0.45, L / 2 - 0.12);
    const lb = new Batch();
    lb.add('blackIron', new THREE.CylinderGeometry(0.018, 0.018, 0.9, 6), xf(0, -0.1, 0));
    lb.add('brass', new THREE.CylinderGeometry(0.1, 0.12, 0.05, 8), xf(0, 0.28, 0.1));
    lb.add('brass', new THREE.ConeGeometry(0.11, 0.1, 8), xf(0, 0.38, 0.1));
    lb.add('brass', new THREE.CylinderGeometry(0.12, 0.09, 0.04, 8), xf(0, 0.08, 0.1));
    for (let k = 0; k < 4; k++) lb.add('blackIron', new THREE.BoxGeometry(0.015, 0.2, 0.015), xf(Math.cos((k * TAU) / 4 + 0.78) * 0.095, 0.18, 0.1 + Math.sin((k * TAU) / 4 + 0.78) * 0.095));
    lb.add('lanternGlass', new THREE.CylinderGeometry(0.07, 0.07, 0.18, 8), xf(0, 0.18, 0.1));
    lanternGroup.add(lb.build(mats, { castShadow: false }));
    group.add(lanternGroup);
    // a little ore in the corner
    const ore = new Batch();
    const r = rng('cart-ore');
    for (let i = 0; i < 7; i++) ore.add('coal', new THREE.DodecahedronGeometry(r.range(0.05, 0.11), 0), xf(r.range(-0.3, 0.3), floorY + 0.09, r.range(-0.8, -0.4), r() * 3));
    group.add(ore.build(mats, { castShadow: false }));
    return { group, wheels, lantern: lanternGroup, seat: new THREE.Vector3(0, 1.42, -0.28) };
}

// ---------------------------------------------------------------- supports and lights

/** A timber arch (two posts, a cap beam and braces) standing across the track at s. */
export function timberFrame(batch, s, halfW, height, floor = -0.4) {
    const t = 0.26;
    for (const sd of [-1, 1]) {
        batch.add('oldWood', boxUV(t, height - floor, t), trackMatrix(s, sd * halfW, floor + (height - floor) / 2));
        // diagonal brace from post to cap
        const bl = 1.1;
        batch.add('oldWood', new THREE.BoxGeometry(0.16, bl * 1.42, 0.16), trackMatrix(s, sd * (halfW - 0.4), height - 0.45, 0).multiply(new THREE.Matrix4().makeRotationZ(sd * Math.PI / 4)));
    }
    batch.add('oldWood', boxUV(halfW * 2 + 0.6, t, t * 1.05), trackMatrix(s, 0, height + t / 2));
    batch.add('rust', new THREE.BoxGeometry(halfW * 2 + 0.7, 0.04, t * 1.08), trackMatrix(s, 0, height + t + 0.01));
}

/** A hanging lantern: chain, cage, a glowing core. Returns its world position. */
export function hangingLantern(batch, s, lx, ly, drop = 0.7) {
    batch.add('blackIron', new THREE.CylinderGeometry(0.012, 0.012, drop, 4), trackMatrix(s, lx, ly + drop / 2));
    batch.add('brass', new THREE.ConeGeometry(0.13, 0.12, 8), trackMatrix(s, lx, ly - 0.06));
    batch.add('brass', new THREE.CylinderGeometry(0.1, 0.12, 0.04, 8), trackMatrix(s, lx, ly - 0.38));
    batch.add('lanternGlass', new THREE.CylinderGeometry(0.075, 0.075, 0.22, 8), trackMatrix(s, lx, ly - 0.22));
    for (let k = 0; k < 4; k++) batch.add('blackIron', new THREE.BoxGeometry(0.014, 0.26, 0.014), trackMatrix(s, lx + Math.cos(k * TAU / 4 + 0.78) * 0.09, ly - 0.22, 0, 0).multiply(new THREE.Matrix4().makeTranslation(0, 0, Math.sin(k * TAU / 4 + 0.78) * 0.09)));
    pointAt(s, P);
    frameAt(s, F);
    const { l, u } = F;
    return new THREE.Vector3(P.x + l.x * lx + u.x * (ly - 0.22), P.y + l.y * lx + u.y * (ly - 0.22), P.z + l.z * lx + u.z * (ly - 0.22));
}

// ---------------------------------------------------------------- things lying about

export function crate(batch, s, lx, ls, size = 0.6, yaw = 0, ly = -0.4) {
    batch.add('wood', boxUV(size, size, size), trackMatrix(s, lx, ly + size / 2, ls, yaw));
    for (const k of [-1, 1]) batch.add('oldWood', new THREE.BoxGeometry(size + 0.03, 0.06, size + 0.03), trackMatrix(s, lx, ly + size / 2 + k * size * 0.38, ls, yaw));
}

export function barrel(batch, s, lx, ls, ly = -0.4, h = 0.85, r = 0.32) {
    const prof = new THREE.CylinderGeometry(r * 0.88, r * 0.88, h, 12);
    batch.add('oldWood', prof, trackMatrix(s, lx, ly + h / 2, ls));
    for (const k of [-0.3, 0, 0.3]) batch.add('rust', new THREE.CylinderGeometry(r * (k === 0 ? 1.03 : 0.94), r * (k === 0 ? 1.03 : 0.94), 0.05, 12), trackMatrix(s, lx, ly + h / 2 + k * h, ls));
}

export function pickaxe(batch, s, lx, ls, ly = -0.4, lean = 0.5, yaw = 0) {
    const m = trackMatrix(s, lx, ly + 0.55, ls, yaw).multiply(new THREE.Matrix4().makeRotationZ(lean));
    batch.add('oldWood', new THREE.CylinderGeometry(0.022, 0.022, 1.1, 6), m);
    batch.add('blackIron', new THREE.BoxGeometry(0.5, 0.04, 0.04), m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.52, 0)));
}

/** A miner, long past caring: bones sat against the wall, a helmet with a dead lamp. */
export function skeleton(batch, s, lx, ls, yaw = 0.3, ly = -0.4) {
    const m = (x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => trackMatrix(s, lx, ly, ls, yaw).multiply(xf(x, y, z, ry, sx, sy, sz, rx, rz));
    // pelvis and spine, leaning back
    batch.add('bone', new THREE.BoxGeometry(0.28, 0.1, 0.16), m(0, 0.14, 0));
    batch.add('bone', new THREE.CylinderGeometry(0.025, 0.03, 0.5, 6), m(0, 0.42, -0.1, 0, 1, 1, 1, -0.25));
    for (let k = 0; k < 5; k++) {
        const y = 0.38 + k * 0.07;
        batch.add('bone', new THREE.TorusGeometry(0.1 - k * 0.006, 0.01, 4, 10, Math.PI * 1.5).rotateX(Math.PI / 2), m(0, y, -0.1 - k * 0.02));
    }
    // skull, jaw, helmet
    batch.add('bone', new THREE.SphereGeometry(0.1, 10, 8), m(0, 0.78, -0.2));
    batch.add('bone', new THREE.BoxGeometry(0.1, 0.05, 0.1), m(0, 0.7, -0.13));
    batch.add('coal', new THREE.SphereGeometry(0.024, 6, 5), m(-0.035, 0.79, -0.1));
    batch.add('coal', new THREE.SphereGeometry(0.024, 6, 5), m(0.035, 0.79, -0.1));
    batch.add('rust', new THREE.SphereGeometry(0.125, 10, 6, 0, TAU, 0, Math.PI / 2), m(0, 0.82, -0.2));
    batch.add('brass', new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8).rotateX(Math.PI / 2), m(0, 0.9, -0.08));
    // arms and legs, loosely
    for (const sd of [-1, 1]) {
        batch.add('bone', new THREE.CylinderGeometry(0.018, 0.02, 0.34, 5), m(sd * 0.17, 0.42, 0.02, 0, 1, 1, 1, 0.9, sd * 0.2));
        batch.add('bone', new THREE.CylinderGeometry(0.02, 0.025, 0.42, 5), m(sd * 0.1, 0.12, 0.2, 0, 1, 1, 1, 1.45, sd * 0.1));
        batch.add('bone', new THREE.CylinderGeometry(0.018, 0.022, 0.4, 5), m(sd * 0.1, 0.1, 0.5, 0, 1, 1, 1, 1.5, 0));
    }
}

// ---------------------------------------------------------------- the trestle

/** A rickety wooden bridge from s0 to s1: planks, stringers, trestle legs down to y = floorY, rope rails. */
export function trestle(batch, s0, s1, floorY, { gaps = [], seed = 3, legs: withLegs = true } = {}) {
    const r = rng('trestle' + seed);
    // deck planks across the sleepers' line
    for (let s = s0; s < s1; s += 0.42) {
        if (gaps.some(([a, b]) => s > a && s < b) || r() < 0.06) continue;
        batch.add('oldWood', boxUV(1.7 + r() * 0.1, 0.07, 0.34), trackMatrix(s + r() * 0.03, 0, -0.33, 0, (r() - 0.5) * 0.04));
    }
    // two long stringers under the rails
    for (const sd of [-1, 1]) {
        for (let s = s0; s < s1; s += 6) {
            const len = Math.min(6.05, s1 - s);
            batch.add('oldWood', boxUV(0.2, 0.3, len), trackMatrix(s + len / 2, sd * 0.62, -0.55));
        }
    }
    // legs every six metres, braced, down to the floor
    const legs = [];
    for (let s = s0 + 2; s < s1 - 1 && withLegs; s += 6) {
        pointAt(s, P);
        const h = P.y - floorY - 0.5;
        if (h < 1.5) continue;
        for (const sd of [-1, 1]) {
            batch.add('oldWood', boxUV(0.34, h, 0.34), trackMatrix(s, sd * 0.85, -0.5 - h / 2));
            legs.push([s, sd, h]);
        }
        batch.add('oldWood', new THREE.BoxGeometry(1.95, 0.22, 0.26), trackMatrix(s, 0, -0.62));
        // cross braces
        for (let y = 2.5; y < h - 1; y += 3.4) {
            const diag = Math.hypot(1.7, 3.2);
            const ang = Math.atan2(3.2, 1.7);
            batch.add('oldWood', new THREE.BoxGeometry(diag, 0.14, 0.14), trackMatrix(s, 0, -0.5 - y - 1.6).multiply(new THREE.Matrix4().makeRotationZ(ang)));
            batch.add('oldWood', new THREE.BoxGeometry(diag, 0.14, 0.14), trackMatrix(s, 0, -0.5 - y - 1.6).multiply(new THREE.Matrix4().makeRotationZ(-ang)));
        }
    }
    // rope rail posts and a sagging rope
    for (const sd of [-1, 1]) {
        for (let s = s0 + 1; s < s1; s += 3) {
            batch.add('oldWood', new THREE.BoxGeometry(0.1, 1.0, 0.1), trackMatrix(s, sd * 0.98, 0.1));
            batch.add('canvas', new THREE.BoxGeometry(0.035, 0.035, 3.0), trackMatrix(s + 1.5, sd * 0.98, 0.52));
        }
    }
    return legs;
}

/** Hanging molten drips and glowing stalactites use these. */
export { spikeGeometry, noise3 };

/** A suspension bridge's cables and hangers: two catenaries from tower to tower over s0..s1, tower height hT, sag to hM. */
export function cableBridge(batch, s0, s1, hT, hM, { hangEvery = 3 } = {}) {
    const mid = (s0 + s1) / 2, half = (s1 - s0) / 2;
    const cableY = (s) => hM + (hT - hM) * Math.pow((s - mid) / half, 2);
    const seg = 2;
    for (const sd of [-1, 1]) {
        const lx = sd * 1.12;
        for (let s = s0; s < s1; s += seg) {
            const a = cableY(s), b = cableY(s + seg);
            const m = trackMatrix(s + seg / 2, lx, (a + b) / 2).multiply(new THREE.Matrix4().makeRotationX(-Math.atan2(b - a, seg)));
            batch.add('blackIron', new THREE.CylinderGeometry(0.035, 0.035, Math.hypot(seg, b - a) + 0.02, 5).rotateX(Math.PI / 2), m);
        }
        for (let s = s0 + 1.5; s < s1; s += hangEvery) {
            const y = cableY(s);
            batch.add('rust', new THREE.CylinderGeometry(0.012, 0.012, y - 0.55, 4), trackMatrix(s, lx, 0.55 + (y - 0.55) / 2));
        }
        // towers at each end, leaning in, and back-stays into the rock
        for (const [s, back] of [[s0, -1], [s1, 1]]) {
            batch.add('oldWood', boxUV(0.3, hT + 0.4, 0.3), trackMatrix(s, lx, (hT + 0.4) / 2 - 0.4));
            const bl = 9;
            batch.add('blackIron', new THREE.CylinderGeometry(0.04, 0.04, bl, 5).rotateX(Math.PI / 2), trackMatrix(s + back * bl / 2, lx, hT - 0.9 * 0.5).multiply(new THREE.Matrix4().makeRotationX(back * 0.2)));
        }
    }
    batch.add('oldWood', boxUV(2.5, 0.28, 0.28), trackMatrix(s0, 0, hT + 0.1));
    batch.add('oldWood', boxUV(2.5, 0.28, 0.28), trackMatrix(s1, 0, hT + 0.1));
}
