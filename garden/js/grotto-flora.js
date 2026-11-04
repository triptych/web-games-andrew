// Everything that grows in the glowing garden under the well, built from the
// Springwood's geometry tools (forest-kit.js): glowcap mushrooms, lumenbloom
// ferns and bells, lanternwood trees hung with fruit, moonlichen on boulders,
// and the wild things that only decorate the cave (shelf fungi, hanging
// vines, wall lichen, stalactites). Each function adds to an `Acc`, which
// the caller turns into one geometry; `glow` is how brightly a vertex shines.

import * as THREE from 'three';
import { Acc, C, mat, blob, rockGeo, strip, limbGeometry, paint, TAU } from './forest-kit.js';
import { fbm2, clamp, smoothstep } from './util.js';

const V3 = THREE.Vector3;
const _c = new THREE.Color();

/** Cap, rim and spot colours for each kind of glowing mushroom. */
export const HUES = {
    teal: { cap: '#3af0c0', rim: '#0b8f88', spot: '#e0fff6', stem: '#bfeee4' },
    violet: { cap: '#a58bff', rim: '#4a2bb5', spot: '#f0e8ff', stem: '#d6ccf5' },
    blue: { cap: '#58b0ff', rim: '#1f56bc', spot: '#e4f4ff', stem: '#c4dcf2' },
    pink: { cap: '#ff72d6', rim: '#a6258f', spot: '#ffe4f8', stem: '#f2cde6' },
    amber: { cap: '#ffb64a', rim: '#c4561a', spot: '#fff2cc', stem: '#f0dcb0' },
};
const HUE_KEYS = Object.keys(HUES);

// geometry that is the same every time is made once
let CAP, CAP_SEAT, GILLS, SPOT, CUSHION, BELL, FRUIT, BUD;
function shared() {
    if (CAP) return;
    // a mushroom cap: a dome with a rolled lip, one unit across
    const prof = [[0, 0.62], [0.2, 0.6], [0.4, 0.52], [0.6, 0.38], [0.8, 0.2], [0.95, 0.07], [1.0, 0.0], [0.93, -0.03], [0.8, 0.02]];
    CAP = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 14);
    CAP_SEAT = new THREE.CircleGeometry(0.8, 14).rotateX(Math.PI / 2);   // faces down: the gills
    GILLS = CAP_SEAT;
    SPOT = new THREE.SphereGeometry(1, 6, 4);
    CUSHION = new THREE.IcosahedronGeometry(1, 1);
    // a bell flower hanging open end down
    BELL = new THREE.LatheGeometry([[0.0, 0.0], [0.05, -0.01], [0.09, -0.05], [0.12, -0.12], [0.16, -0.2], [0.2, -0.25], [0.17, -0.27], [0.12, -0.22], [0.06, -0.12]].map(([r, y]) => new THREE.Vector2(r, y)), 8);
    // a lantern-shaped fruit hanging by its top
    FRUIT = new THREE.LatheGeometry([[0.0, 0.0], [0.04, -0.02], [0.1, -0.08], [0.15, -0.18], [0.16, -0.28], [0.12, -0.4], [0.05, -0.48], [0.0, -0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 9);
    BUD = new THREE.SphereGeometry(1, 6, 5);
}

const tint = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);

// ---------------------------------------------------------------- mushrooms

/**
 * One glowing mushroom with its foot at (x, 0, z). r is the cap's radius.
 * `o.glow` scales every glow (a ripe one shines harder).
 */
export function mushroom(acc, rnd, x, z, r, hue = 'teal', o = {}) {
    shared();
    const H = HUES[hue];
    const h = r * (o.tall ?? rnd.range(1.1, 1.9));
    const lean = rnd.range(-0.25, 0.25) * h, lean2 = rnd.range(-0.25, 0.25) * h;
    const yaw = rnd() * TAU;
    const gk = o.glow ?? 1;
    const stemGeo = limbGeometry([new V3(0, -0.05, 0), new V3(lean * 0.5, h * 0.5, lean2 * 0.5), new V3(lean, h, lean2)], r * 0.17, r * 0.11, 6, 5);
    const stemC = C(H.stem), stemDark = tint(H.stem, 0.6);
    acc.add(stemGeo, mat(x, 0, z, yaw, 1), {
        colorFn: (v) => _c.copy(stemDark).lerp(stemC, clamp(v.y / h, 0, 1)),
        glow: (v) => 0.25 * gk + 0.5 * gk * clamp(v.y / h, 0, 1),
    });
    const capC = C(H.cap), rimC = C(H.rim);
    const cm = mat(x + lean, h, z + lean2, yaw, r, r * rnd.range(0.8, 1.1), r, rnd.range(-0.07, 0.07), rnd.range(-0.07, 0.07));
    acc.add(CAP, cm, {
        colorFn: (v) => _c.copy(rimC).lerp(capC, 1 - Math.hypot(v.x, v.z) ** 1.6),
        glow: (v) => gk * (0.7 + 0.8 * (1 - Math.hypot(v.x, v.z))),
        sway: 0.012 * r,
        swayH: 1,
    });
    acc.add(GILLS, mat(x + lean, h - 0.01 * r, z + lean2, yaw, r, 1, r), { color: tint(H.rim, 1.1), glow: 0.9 * gk });
    // spots on the dome
    const n = o.spots ?? (r > 0.3 ? 4 : 2);
    for (let k = 0; k < n; k++) {
        const a = rnd() * TAU, d = rnd.range(0.1, 0.62);
        const sy = 0.62 * (1 - (d / 1.0) ** 1.9) + 0.02;
        const sr = rnd.range(0.07, 0.14);
        acc.add(SPOT, mat(x + lean + Math.cos(a) * d * r, h + sy * r * 0.95, z + lean2 + Math.sin(a) * d * r, 0, sr * r, sr * r * 0.5, sr * r), { color: C(H.spot), glow: 2.0 * gk });
    }
}

/** A tight cluster of mushrooms of one hue around (x, z). */
export function glowcapCluster(acc, rnd, x, z, spread, count, rMax, hue, o = {}) {
    for (let i = 0; i < count; i++) {
        const a = rnd() * TAU, d = Math.sqrt(rnd()) * spread;
        // the big ones in the middle, small ones at the edges
        const r = rMax * (0.35 + 0.65 * (1 - d / (spread + 1e-3))) * rnd.range(0.7, 1.05);
        mushroom(acc, rnd, x + Math.cos(a) * d, z + Math.sin(a) * d, r, o.mix ? rnd.pick(HUE_KEYS) : hue, o);
    }
}

// ------------------------------------------------------------------- lumen

/** A lumen fern: arching fronds with a shining midrib. */
export function lumenFern(acc, rnd, x, z, s, o = {}) {
    const n = o.fronds ?? 7;
    const gk = o.glow ?? 1;
    const deep = C(o.deep ?? '#134f5e'), tip = C(o.tip ?? '#4dffc8');
    for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + rnd.range(-0.3, 0.3);
        const len = rnd.range(0.8, 1.35) * s, up = rnd.range(0.35, 0.65) * s;
        const pts = [];
        for (let i = 0; i < 7; i++) {
            const t = i / 6;
            pts.push(new V3(Math.cos(a) * t * len, Math.sin(t * Math.PI * 0.62) * up + t * 0.08 * s, Math.sin(a) * t * len));
        }
        const side = new V3(-Math.sin(a), 0, Math.cos(a));
        const geo = strip(pts, (t) => (Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5) * (1 - t * 0.85)) * 0.3 * s, side);
        acc.add(geo, mat(x, 0, z, 0, 1), {
            colorFn: (v) => _c.copy(deep).lerp(tip, clamp(Math.hypot(v.x, v.z) / (len * 1.05), 0, 1) ** 1.3),
            glow: (v) => gk * (0.25 + 1.1 * clamp(Math.hypot(v.x, v.z) / len, 0, 1)),
            sway: 0.1 * s,
            swayH: 0.6 * s,
        });
    }
}

/**
 * Slender stalks arching out. With ripe = false: the stalks, each with a closed bud;
 * with ripe = true: just the open bells at the stalks' tips (the same ones, so the
 * two meshes sit one over the other). Pass an rng made from the same seed each time.
 */
export function lumenBells(acc, rnd, x, z, s, ripe, hue = 'pink', o = {}) {
    shared();
    const gk = o.glow ?? 1;
    const pal = hue === 'violet' ? ['#b99bff', '#6a45d6'] : hue === 'blue' ? ['#69c0ff', '#2a6ed6'] : ['#ff7ad9', '#b02f9a'];
    const n = o.stalks ?? 5;
    const P = [];
    for (let k = 0; k < n; k++) P.push({ a: (k / n) * TAU + rnd.range(-0.4, 0.4), reach: rnd.range(0.2, 0.55) * s, h: rnd.range(0.65, 1.15) * s, bs: rnd.range(1.1, 1.7) * s, yaw: rnd() * TAU, t1: rnd.range(-0.2, 0.2), t2: rnd.range(-0.2, 0.2) });
    const capC = C(pal[0]), rimC = C(pal[1]);
    for (const p of P) {
        const end = new V3(Math.cos(p.a) * p.reach, p.h, Math.sin(p.a) * p.reach);
        if (!ripe) {
            const mid = new V3(Math.cos(p.a) * p.reach * 0.25, p.h * 0.6, Math.sin(p.a) * p.reach * 0.25);
            const stalk = limbGeometry([new V3(0, 0, 0), mid, end], 0.016 * s, 0.01 * s, 5, 6);
            acc.add(stalk, mat(x, 0, z, 0, 1), {
                colorFn: (v) => _c.set('#2a6a5a').lerp(C('#5fffc0'), clamp(v.y / p.h, 0, 1)),
                glow: (v) => gk * 0.5 * clamp(v.y / p.h, 0, 1),
                sway: 0.08 * s,
                swayH: p.h,
            });
            const bs = 0.04 * s;
            acc.add(BUD, mat(x + end.x, end.y, z + end.z, 0, bs, bs * 1.7, bs), { color: capC, glow: 1.2 * gk, sway: 0.06 * s, swayH: p.h });
        } else {
            acc.add(BELL, mat(x + end.x, end.y + 0.02, z + end.z, p.yaw, p.bs, p.bs, p.bs, p.t1, p.t2), {
                colorFn: (v) => _c.copy(capC).lerp(rimC, clamp(-v.y * 4.2, 0, 1)),
                glow: (v) => gk * (1.0 + clamp(-v.y * 6, 0, 1.4)),
                sway: 0.06 * s,
                swayH: p.h,
            });
            // the stamen: a bright dot hanging inside
            acc.add(BUD, mat(x + end.x, end.y - 0.2 * p.bs, z + end.z, 0, 0.025 * s, 0.025 * s, 0.025 * s), { color: C('#fff6c8'), glow: 3.2 * gk });
        }
    }
}

// ------------------------------------------------------------------- trees

/** The bark of a lanternwood: a dark violet-brown with faintly glowing cracks. */
function barkFn(seed, glowAmt) {
    const a = C('#3b2c3c'), b = C('#6a5870'), g = C('#45ffd0');
    const t = new THREE.Color();
    return {
        colorFn: (v) => {
            const k = fbm2(v.x * 4 + seed, v.y * 1.4 + v.z * 4, 2);
            t.copy(a).lerp(b, clamp(0.5 + k, 0, 1));
            const crack = smoothstep(0.03, 0.07, Math.abs(fbm2(v.x * 6 + seed * 3, v.y * 2.1 + v.z * 6, 2)));
            return crack > 0.5 ? t : t.lerp(g, 0.6);
        },
        glow: (v) => {
            const crack = smoothstep(0.03, 0.07, Math.abs(fbm2(v.x * 6 + seed * 3, v.y * 2.1 + v.z * 6, 2)));
            return crack > 0.5 ? 0 : glowAmt;
        },
    };
}

/**
 * A lanternwood: a leaning trunk, boughs and a crown of glowing leaf clumps.
 * With `fruitOnly` it builds just the hanging lantern fruits (shown when ripe);
 * every random number is drawn up front, so the same seed puts those fruits
 * exactly under the crown the full tree grew.
 */
export function lanternTree(acc, rnd, x, z, s, o = {}) {
    shared();
    const gk = o.glow ?? 1;
    const H = (o.height ?? 3.2) * s;
    const girth = o.girth ?? 1;
    const leaf = o.leaf ?? ['#2fb9a0', '#3fd9b8', '#2a90c0', '#58c8e8'];
    const lean = new V3(rnd.range(-0.5, 0.5), 0, rnd.range(-0.5, 0.5)).multiplyScalar(s);
    const top = new V3(lean.x, H * 0.55, lean.z);
    const bark = barkFn(rnd() * 20, 0.7 * gk);
    const nroots = o.roots ?? 4, nb = o.boughs ?? 4, nf = o.fruits ?? 2;
    const roots = Array.from({ length: nroots }, (_, k) => ({ a: (k / nroots) * TAU + rnd.range(-0.4, 0.4), len: rnd.range(0.5, 0.9) * s * girth }));
    const boughs = Array.from({ length: nb }, (_, k) => ({ a: (k / nb) * TAU + rnd.range(-0.4, 0.4), d: rnd.range(0.75, 1.15) * s * (o.spread ?? 1), y: rnd.range(0.78, 0.98) }));
    const crowns = Array.from({ length: nb + 1 }, () => ({
        R: rnd.range(0.55, 0.8) * s * (o.crown ?? 1), jx: rnd.range(-0.15, 0.15) * s, jy: rnd.range(-0.05, 0.25) * s, seed: rnd() * 40, yaw: rnd() * TAU,
        fruits: Array.from({ length: nf }, () => ({ a: rnd() * TAU, d: rnd.range(0.2, 0.75), drop: rnd.range(0, 0.25) * s, size: rnd.range(0.85, 1.15), yaw: rnd() * TAU })),
    }));
    if (!o.fruitOnly) {
        acc.add(limbGeometry([new V3(0, -0.2, 0), new V3(lean.x * 0.4, H * 0.28, lean.z * 0.4), top], 0.2 * s * girth, 0.11 * s * girth, 8, 7), mat(x, 0, z, 0, 1), bark);
        for (const r of roots) {
            const root = limbGeometry([new V3(0, 0.25 * s, 0), new V3(Math.cos(r.a) * r.len * 0.55, 0.12 * s, Math.sin(r.a) * r.len * 0.55), new V3(Math.cos(r.a) * r.len, -0.05, Math.sin(r.a) * r.len)], 0.1 * s * girth, 0.025 * s, 6, 5);
            acc.add(root, mat(x, 0, z, 0, 1), bark);
        }
    }
    const crownAt = boughs.map((b) => new V3(top.x + Math.cos(b.a) * b.d, H * b.y, top.z + Math.sin(b.a) * b.d));
    crownAt.push(new V3(top.x, H * 1.02, top.z));
    if (!o.fruitOnly) {
        boughs.forEach((b, k) => {
            const end = crownAt[k];
            const mid = top.clone().lerp(end, 0.5).add(new V3(0, 0.15 * s, 0));
            acc.add(limbGeometry([top, mid, end], 0.085 * s * girth, 0.03 * s, 6, 5), mat(x, 0, z, 0, 1), bark);
        });
    }
    crownAt.forEach((e, i) => {
        const c = crowns[i];
        if (!o.fruitOnly) {
            const g = blob(1, 1, c.seed, 0.24);
            const col = C(leaf[i % leaf.length]), col2 = C(leaf[(i + 1) % leaf.length]);
            acc.add(g, mat(e.x + x + c.jx, e.y + c.jy, e.z + z, c.yaw, c.R, c.R * 0.78, c.R), {
                colorFn: (v, n) => _c.copy(col).lerp(col2, clamp(0.5 + n.y * 0.6, 0, 1)).multiplyScalar(0.32 + clamp(n.y, -1, 1) * 0.08 + fbm2(v.x * 3, v.z * 3 + v.y, 2) * 0.14),
                glow: (v) => gk * (0.9 + 0.6 * clamp(-v.y, 0, 1)),
                sway: 0.07 * s,
                swayH: 1,
            });
        }
        // lantern fruits hang under the clump (small green-gold buds on the tree, big lanterns when ripe)
        for (const f of c.fruits) {
            const fx = x + e.x + Math.cos(f.a) * f.d * c.R, fz = z + e.z + Math.sin(f.a) * f.d * c.R;
            const fy = e.y - c.R * 0.5 - f.drop;
            const fs = (o.fruitSize ?? 1) * s * f.size;
            if (o.fruitOnly) {
                acc.add(limbGeometry([new V3(0, 0.3 * fs, 0), new V3(0, 0.15 * fs, 0), new V3(0, 0, 0)], 0.01 * fs, 0.01 * fs, 4, 2), mat(fx, fy, fz, 0, 1), { color: C('#5a6a3a'), glow: 0.2 });
                acc.add(FRUIT, mat(fx, fy, fz, f.yaw, fs, fs, fs), {
                    colorFn: (v) => _c.set('#ff8a2a').lerp(C('#ffd870'), clamp(1 + v.y * 1.4, 0, 1) ** 1.5),
                    glow: (v) => gk * (1.3 + clamp((v.y + 0.5) * 1.8, 0, 1.1)),
                    sway: 0.05 * s,
                    swayH: 1,
                });
            } else {
                const bs = 0.05 * s;
                acc.add(BUD, mat(fx, fy - 0.04 * s, fz, 0, bs, bs * 1.5, bs), { color: C('#d6c85a'), glow: 0.8 * gk });
            }
        }
    });
}

// ------------------------------------------------------------------- lichen

/** A boulder to carry lichen: lumpy slate with a little moss. */
export function boulder(acc, rnd, x, z, size, o = {}) {
    const g = rockGeo(rnd() * 60, 2);
    const slate = C('#4a5660'), dark = C('#2a323c'), moss = C('#3f7a58');
    const t = new THREE.Color();
    const sx = size * rnd.range(1.0, 1.4), sy = size * rnd.range(0.7, 1.0), sz = size * rnd.range(0.9, 1.3);
    const yaw = rnd() * TAU;
    acc.add(g, mat(x, (o.y ?? 0) + sy * 0.35, z, yaw, sx, sy, sz), {
        colorFn: (v, n) => {
            const k = fbm2(v.x * 2.3, v.z * 2.3 + v.y, 2);
            t.copy(slate).lerp(dark, clamp(0.5 - k, 0, 1));
            if (n.y > 0.3) t.lerp(moss, clamp((n.y - 0.3) * 1.4, 0, 0.7) * (0.5 + k));
            return t;
        },
        glow: o.glow ?? 0,
    });
    return { x, z, y: o.y ?? 0, sx, sy, sz, yaw, geo: g };
}

const LICHEN = ['#3fe0c0', '#62a8ff', '#b0e84a', '#a58bff', '#ff86d0', '#58f0a0'];

/**
 * Lichen on a boulder, in `tiers`: the first has a few small cushions and each
 * later one adds more and bigger ones, so a patch visibly spreads as it grows.
 * Returns an array of Accs, one per tier.
 */
export function lichenTiers(rnd, rock, tiers = 3) {
    shared();
    const accs = [];
    const pos = rock.geo.attributes.position, nrm = rock.geo.attributes.normal;
    const cands = [];
    const v = new V3(), nn = new V3();
    for (let i = 0; i < pos.count; i++) {
        nn.fromBufferAttribute(nrm, i);
        if (nn.y > -0.1) cands.push(i);
    }
    const m = mat(rock.x, (rock.y ?? 0) + rock.sy * 0.35, rock.z, rock.yaw, rock.sx, rock.sy, rock.sz);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const q = new THREE.Quaternion(), up = new V3(0, 1, 0);
    for (let t = 0; t < tiers; t++) {
        const acc = new Acc();
        const count = [7, 8, 9][t] ?? 8;
        const rMax = [0.2, 0.28, 0.36][t] ?? 0.3;
        for (let k = 0; k < count; k++) {
            const i = cands[Math.floor(rnd() * cands.length)];
            v.fromBufferAttribute(pos, i).applyMatrix4(m);
            nn.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
            q.setFromUnitVectors(up, nn);
            const r = rnd.range(0.55, 1) * rMax * (rock.sx + rock.sz) * 0.5;
            const col = C(LICHEN[Math.floor(rnd() * LICHEN.length)]);
            const cm = new THREE.Matrix4().compose(v.clone().addScaledVector(nn, 0.01), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(up, rnd() * TAU)), new V3(r, r * 0.3, r));
            acc.add(CUSHION, cm, {
                colorFn: (p) => _c.copy(col).multiplyScalar(0.4 + 0.35 * clamp(p.y * 1.2 + 0.4, 0, 1)),
                glow: (p) => 1.0 + 0.9 * clamp(p.y, 0, 1),
            });
            // a ring of small lobes round the edge, so it reads as a rosette
            const lobes = 5;
            for (let l = 0; l < lobes; l++) {
                const a = (l / lobes) * TAU + rnd() * 0.5;
                const off = new V3(Math.cos(a) * r * 0.95, 0, Math.sin(a) * r * 0.95).applyQuaternion(q);
                const lr = r * 0.32;
                const lm = new THREE.Matrix4().compose(v.clone().addScaledVector(nn, 0.01).add(off), q, new V3(lr, lr * 0.4, lr));
                acc.add(CUSHION, lm, { color: col.clone().multiplyScalar(0.5), glow: 1.0 });
            }
        }
        accs.push(acc);
    }
    return accs;
}

// ------------------------------------------------------------- the cave's own

/** Stalactites hanging at (x, y, z), with a drop that glows at the tip. */
export function stalactite(acc, rnd, x, y, z, r, len, o = {}) {
    const g = new THREE.ConeGeometry(r, len, 7, 3).rotateX(Math.PI);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const k = 1 + fbm2(p.getX(i) * 4 + x, p.getZ(i) * 4 + p.getY(i) * 2 + z, 2) * 0.35;
        p.setX(i, p.getX(i) * k);
        p.setZ(i, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    const slate = C('#59666e'), wet = C('#7a929a');
    acc.add(g, mat(x, y - len / 2, z, rnd() * TAU, 1), { colorFn: (v) => _c.copy(slate).lerp(wet, clamp(-v.y / len + 0.5, 0, 1) * 0.6), glow: 0 });
    if (o.tip) acc.add(BUD, mat(x, y - len - 0.04, z, 0, 0.035, 0.05, 0.035), { color: C(o.tip), glow: 3 });
}

export function stalagmite(acc, rnd, x, z, r, len) {
    const g = new THREE.ConeGeometry(r, len, 7, 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const k = 1 + fbm2(p.getX(i) * 4 + x, p.getZ(i) * 4 + p.getY(i) * 2 + z, 2) * 0.35;
        p.setX(i, p.getX(i) * k);
        p.setZ(i, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    const slate = C('#4c5a63'), moss = C('#3a6e52');
    acc.add(g, mat(x, len / 2 - 0.05, z, rnd() * TAU, 1), { colorFn: (v) => _c.copy(slate).lerp(moss, clamp(0.6 - v.y / len, 0, 1) * 0.6), glow: 0 });
}

/** A shelf of bracket fungus on the wall at p (n is the wall's normal, pointing into the cave): a half disc with a shining rim. */
export function shelfFungus(acc, rnd, p, n, r, hue = 'teal') {
    const H = HUES[hue];
    // the half cylinder bulges towards local +x; its flat edge lies against the wall
    const g = new THREE.CylinderGeometry(1, 0.85, 0.2, 12, 1, false, 0, Math.PI);
    const yaw = Math.atan2(-n.z, n.x);
    const h = Math.hypot(n.x, n.z) || 1;
    const capC = C(H.cap), rimC = C(H.rim);
    acc.add(g, mat(p.x + (n.x / h) * 0.03, p.y, p.z + (n.z / h) * 0.03, yaw, r, r, r, 0, rnd.range(-0.12, 0.12)), {
        colorFn: (v) => _c.copy(capC).lerp(rimC, clamp(Math.hypot(v.x, v.z), 0, 1) ** 2),
        glow: (v) => 0.6 + 2.0 * clamp(Math.hypot(v.x, v.z), 0, 1) ** 3,
    });
}

/** A vine hanging from the ceiling with glowing bulbs along it. */
export function hangingVine(acc, rnd, x, y, z, len, hue = 'pink') {
    shared();
    const pts = [];
    const dx = rnd.range(-0.4, 0.4), dz = rnd.range(-0.4, 0.4);
    for (let i = 0; i < 6; i++) {
        const t = i / 5;
        pts.push(new V3(dx * Math.sin(t * 2) * 0.5, -t * len, dz * Math.sin(t * 2) * 0.5));
    }
    acc.add(limbGeometry(pts, 0.025, 0.012, 5, 8), mat(x, y, z, 0, 1), { color: C('#2f5a45'), glow: 0.1, sway: 0.12, swayH: len });
    const cols = { pink: '#ff7ad9', teal: '#4dffd0', blue: '#6ab8ff', amber: '#ffc060', violet: '#b595ff' };
    const col = C(cols[hue] ?? cols.pink);
    const bulbs = Math.floor(len / 0.7);
    for (let b = 0; b < bulbs; b++) {
        const t = (b + 1) / (bulbs + 1) * rnd.range(0.7, 1);
        const pi = Math.min(4, Math.floor(t * 5));
        const a = pts[pi], c = pts[pi + 1];
        const f = t * 5 - pi;
        const bp = a.clone().lerp(c, f);
        const bs = rnd.range(0.05, 0.1);
        acc.add(BUD, mat(x + bp.x + 0.04, y + bp.y, z + bp.z, 0, bs, bs * 1.4, bs), { color: col, glow: 2.4, sway: 0.12 * Math.abs(bp.y / len), swayH: 1 });
    }
}

/** A flat patch of glowing lichen lying on a wall (p is the point, n the surface normal). */
export function wallLichen(acc, rnd, p, n, r) {
    const hex = LICHEN[Math.floor(rnd() * LICHEN.length)];
    const col = C(hex);
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), n);
    const base = new THREE.Matrix4().compose(p.clone().addScaledVector(n, 0.03), q, new V3(1, 1, 1));
    const lobes = 4 + Math.floor(rnd() * 4);
    for (let l = 0; l < lobes; l++) {
        const a = rnd() * TAU, d = l === 0 ? 0 : rnd.range(0.2, 0.9) * r;
        const lr = r * rnd.range(0.25, 0.5) * (l === 0 ? 1.25 : 1);
        const lm = base.clone().multiply(mat(Math.cos(a) * d, 0, Math.sin(a) * d, rnd() * TAU, lr, lr * 0.22, lr));
        acc.add(CUSHION, lm, {
            colorFn: (v) => _c.copy(col).multiplyScalar(0.34 + 0.3 * clamp(v.y + 0.5, 0, 1)),
            glow: (v) => 0.7 + 0.9 * clamp(v.y, 0, 1),
        });
    }
}

/** A planter's ring of stones round (x, z). */
export function stoneRing(acc, rnd, x, z, R, count = 10, size = null) {
    const slate = C('#8a9aa2'), moss = C('#58a876'), dark = C('#4a565e');
    const t = new THREE.Color();
    for (let k = 0; k < count; k++) {
        const a = (k / count) * TAU + rnd.range(-0.1, 0.1);
        const s = size ? rnd.range(0.7, 1.15) * size : rnd.range(0.2, 0.32) * (R / 0.9);
        acc.add(rockGeo(rnd() * 40, 1), mat(x + Math.cos(a) * R, s * 0.25, z + Math.sin(a) * R, rnd() * TAU, s * 1.3, s * 0.85, s), {
            colorFn: (v, n) => {
                const k2 = fbm2(v.x * 2.5, v.z * 2.5 + v.y, 2);
                t.copy(slate).lerp(dark, clamp(0.5 - k2, 0, 1));
                if (n.y > 0.3) t.lerp(moss, clamp((n.y - 0.3) * 1.2, 0, 0.6));
                return t;
            },
            glow: 0,
        });
    }
}

export { Acc, paint };
