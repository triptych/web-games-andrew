// The Springwood's land: an endless spring forest made on the fly in square
// chunks as you walk, each seeded by where it is, so a place always looks the
// same when you come back to it. Four kinds of wood blend into one another
// (blossom glades, bluebell beechwoods, birch hollows and clover meadows),
// winding footpaths run through them, and every so often there is a lily pond
// or one of the wood's special places (forest-places.js). Everything in a chunk
// is merged into one mesh with one material, which sways the leaves and
// flowers in the breeze, lays moving flecks of sunlight on the ground, and lets
// blossom, toadstools and windows glow after dark.

import * as THREE from 'three';
import { rng, fbm2, noise2, clamp, lerp, smoothstep, TAU } from './util.js';
import { Acc, C, mat, paint, blob, strip, arc, rockGeo, mossyStone, placed, limbGeometry, flat, fadeY } from './forest-kit.js';
import { PLACE_KINDS, buildPlace } from './forest-places.js';

export const CHUNK = 32;          // metres along a side
const STEP = 2;                   // ground grid spacing
export const CELL = 80;           // one pond or special place at most in each of these squares
export const HOME_R = 10;         // the clearing round the portal home
const V3 = THREE.Vector3;

// ------------------------------------------------------------------ the lie of the land

/** How much of each kind of wood is here: { blossom, bluebell, birch, meadow }, summing to 1. */
export function biomeAt(x, z) {
    const home = Math.exp(-(x * x + z * z) / 2500);
    const a = fbm2(x * 0.0042 + 11.3, z * 0.0042 - 4.1, 3) * 2.6;
    const b = fbm2(x * 0.0038 - 7.7, z * 0.0038 + 19.2, 3) * 2.6;
    const blossom = clamp(0.4 + a, 0, 1.5) + home * 2;
    const bluebell = clamp(b - 0.1, 0, 1.5) * (1 - home);
    const birch = clamp(-b - 0.2, 0, 1.5) * (1 - home);
    const meadow = clamp(-a - 0.15, 0, 1.5) * (1 - home) + 0.15;
    const s = blossom + bluebell + birch + meadow;
    return { blossom: blossom / s, bluebell: bluebell / s, birch: birch / s, meadow: meadow / s };
}

export function dominant(w) {
    let best = 'meadow';
    for (const k of ['blossom', 'bluebell', 'birch']) if (w[k] > w[best]) best = k;
    return best;
}

/** The rolling ground before ponds and clearings are pressed into it. Never below 0.9. */
function baseY(x, z) {
    const broad = fbm2(x * 0.0055 + 5.1, z * 0.0055 - 2.7, 3);
    const mid = fbm2(x * 0.028 - 1.3, z * 0.028 + 8.8, 3);
    let y = 2.6 + broad * 6 + mid * 1.1;
    const home = Math.exp(-(x * x + z * z) / 700);
    y = lerp(y, 2.4 + mid * 0.3, home);
    // a soft floor, so dry land never sinks to the ponds' water
    return 0.9 + Math.log1p(Math.exp((y - 0.9) * 1.5)) / 1.5;
}

/** Footpaths: the lines where a slow noise crosses zero, so they wind on for ever. 1 on a path. */
export function pathAt(x, z) {
    const n = Math.abs(fbm2(x * 0.0062 + 31.7, z * 0.0062 - 17.3, 2));
    return 1 - smoothstep(0.011, 0.024, n);
}

// the pond or special place in each CELL square, if any (cached; there are few)
const feats = new Map();
export function featureIn(ci, cj) {
    const key = ci * 100003 + cj;
    let f = feats.get(key);
    if (f !== undefined) return f;
    const r = rng(`springwood:${ci}:${cj}`);
    const x = ci * CELL + 22 + r() * (CELL - 44), z = cj * CELL + 22 + r() * (CELL - 44);
    const roll = r(), pick = r(), yaw = r() * TAU, seed = r() * 100;
    f = null;
    if (Math.hypot(x, z) > 50) {
        if (roll < 0.36) {
            const R = 5.5 + pick * 6;
            f = { kind: 'pond', x, z, R, r: R + 6, seed, yaw };
        } else if (roll < 0.74) {
            const kind = PLACE_KINDS[Math.floor(pick * PLACE_KINDS.length)];
            f = { kind: kind.id, x, z, r: kind.r, yaw, seed, y0: baseY(x, z), def: kind };
        }
    }
    if (feats.size > 6000) feats.clear();
    feats.set(key, f);
    return f;
}
export const featureAt = (x, z) => featureIn(Math.floor(x / CELL), Math.floor(z / CELL));

/** The height of the ground; the ponds' water stands at y = 0. */
export function groundY(x, z) {
    let y = baseY(x, z);
    const f = featureAt(x, z);
    if (f) {
        const d = Math.hypot(x - f.x, z - f.z);
        if (f.kind === 'pond') {
            const dd = d + noise2(x * 0.17 + f.seed, z * 0.17 - f.seed) * 1.8;
            y = lerp(y, -1.1, 1 - smoothstep(f.R * 0.5, f.R + 6, dd));
        } else y = lerp(y, f.y0, 1 - smoothstep(f.r * 0.7, f.r + 6, d));
    }
    return y;
}

/** True where something may grow: dry, off the path, out of the clearings. */
function open(x, z, f, room = 0) {
    if (Math.hypot(x, z) < HOME_R + room) return false;
    if (f && Math.hypot(x - f.x, z - f.z) < f.r + room) return false;
    return true;
}

// ------------------------------------------------------------------ the material

const DAPPLE = /* glsl */ `
float dapple(vec2 p, float t) {
    p *= 0.42;
    float a = sin(p.x * 1.7 + sin(p.y * 1.3 + t * 0.21) * 1.4) * sin(p.y * 1.9 + sin(p.x * 1.1 - t * 0.17) * 1.4);
    float b = sin(p.x * 3.1 - p.y * 0.7 + t * 0.33) * sin(p.y * 2.7 + p.x * 0.9 - t * 0.29);
    return smoothstep(0.25, 0.85, a * 0.7 + b * 0.45);
}`;

/** One material for every chunk. `u` holds the shared uniforms { uTime, uWind, uDapple, uGlow }. */
export function forestMaterial(u) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { uTime: u.uTime, uWind: u.uWind, uDapple: u.uDapple, uGlow: u.uGlow });
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', `#include <common>
attribute float aSway; attribute float aGlow; uniform float uTime; uniform float uWind;
varying vec3 vWP; varying float vWNy; varying float vGlow;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
float ph = uTime * 1.25 + position.x * 0.31 + position.z * 0.23;
float gust = 0.75 + 0.25 * sin(uTime * 0.37 + position.x * 0.02);
transformed.x += (sin(ph) + 0.35 * sin(ph * 2.3 + 1.0)) * aSway * uWind * gust;
transformed.z += cos(ph * 0.87 + 1.3) * aSway * uWind * gust * 0.6;
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNy = normal.y;
vGlow = aGlow;`);
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uDapple; uniform float uGlow;
varying vec3 vWP; varying float vWNy; varying float vGlow;
${DAPPLE}`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float dp = dapple(vWP.xz, uTime) * uDapple * clamp(vWNy * 1.3 - 0.2, 0.0, 1.0);
totalEmissiveRadiance += diffuseColor.rgb * (dp * vec3(0.55, 0.48, 0.3) + vGlow * uGlow);`);
    };
    m.customProgramCacheKey = () => 'garden-springwood-1';
    return m;
}

// ------------------------------------------------------------------ prototypes: trees

const BARK = C('#5d4a3a'), BARK_HI = C('#7d6a56');
function barkFn(seed, a = BARK, b = BARK_HI) {
    const t = new THREE.Color();
    return (v) => t.copy(a).lerp(b, clamp(0.5 + fbm2(v.x * 3 + seed, v.y * 1.2 + v.z * 3, 2) * 1.2, 0, 1));
}
function leafFn(base, seed, light = 0.18) {
    const t = new THREE.Color(), c = C(base);
    return (v, n) => {
        t.copy(c).multiplyScalar(0.72 + clamp(n.y, -1, 1) * 0.22 + fbm2(v.x * 2 + seed, v.z * 2 + v.y, 2) * light);
        return t;
    };
}

/** A limb from `a` to `b` bending through a point nudged off the middle. */
function bough(r, a, b, r0, r1, radial = 6, segs = 5) {
    const mid = a.clone().lerp(b, 0.5).add(new V3(r.range(-0.3, 0.3), r.range(0, 0.4), r.range(-0.3, 0.3)).multiplyScalar(a.distanceTo(b) * 0.35));
    return limbGeometry([a, mid, b], r0, r1, radial, segs);
}

function broadTree(seed) {
    const r = rng('fbroad' + seed);
    const H = r.range(8, 10.5);
    const parts = [];
    const top = new V3(r.range(-0.4, 0.4), H * 0.42, r.range(-0.4, 0.4));
    parts.push({ geo: paint(bough(r, new V3(0, -0.4, 0), top, 0.46, 0.3, 8, 6), barkFn(seed, C('#6e655a'), C('#8f877a'))) });
    const ends = [];
    const nb = r.int(4, 5);
    for (let k = 0; k < nb; k++) {
        const a = (k / nb) * TAU + r() * 0.6, d = r.range(2, 3.2);
        const end = new V3(Math.sin(a) * d, H * r.range(0.66, 0.8), Math.cos(a) * d);
        parts.push({ geo: paint(bough(r, top, end, 0.24, 0.09, 5, 4), barkFn(seed + k, C('#6e655a'), C('#8f877a'))) });
        ends.push(end);
    }
    ends.push(new V3(0, H * 0.86, 0));
    const greens = ['#7fbf4a', '#93cc55', '#6db244', '#a6d462'];
    for (const e of ends) {
        const nbl = r.int(1, 2);
        for (let k = 0; k < nbl; k++) {
            const R = r.range(1.5, 2.2);
            const g = blob(R, 1, r() * 50, 0.24);
            paint(g, leafFn(r.pick(greens), r() * 9));
            parts.push({ geo: placed(g, mat(e.x + r.range(-0.7, 0.7), e.y + r.range(-0.2, 0.7), e.z + r.range(-0.7, 0.7), r() * TAU, 1, r.range(0.75, 0.95), 1)), sway: 0.16 });
        }
    }
    return { parts, H, R: 0.5 };
}

function birchTree(seed) {
    const r = rng('fbirch' + seed);
    const H = r.range(7, 9);
    const parts = [];
    const white = C('#ece8dc'), black = C('#2c2824'), grey = C('#9a958a');
    const t = new THREE.Color();
    const pts = [new V3(0, -0.3, 0), new V3(r.range(-0.3, 0.3), H * 0.35, r.range(-0.3, 0.3)), new V3(r.range(-0.4, 0.4), H * 0.7, r.range(-0.4, 0.4)), new V3(r.range(-0.3, 0.3), H * 0.95, r.range(-0.3, 0.3))];
    const trunk = limbGeometry(pts, 0.17, 0.06, 6, 10);
    paint(trunk, (v) => {
        const mark = noise2(v.y * 2.6 + seed, Math.atan2(v.z, v.x) * 1.3) > 0.42;
        t.copy(mark ? black : white);
        if (v.y < 0.6) t.lerp(grey, 1 - v.y / 0.6);
        return t;
    });
    parts.push({ geo: trunk });
    const curve = new THREE.CatmullRomCurve3(pts);
    const greens = ['#b5dc6e', '#cde98a', '#a4d05e'];
    for (let k = 0; k < 7; k++) {
        const s = r.range(0.45, 0.9);
        const a = curve.getPointAt(s);
        const ang = r() * TAU, len = r.range(0.9, 1.7);
        const b = a.clone().add(new V3(Math.sin(ang) * len, r.range(0.3, 0.9), Math.cos(ang) * len));
        parts.push({ geo: paint(limbGeometry([a, a.clone().lerp(b, 0.5).add(new V3(0, 0.15, 0)), b], 0.05, 0.02, 4, 3), flat(C('#4a403a'))) });
        for (let j = 0; j < 3; j++) {
            const g = blob(r.range(0.5, 0.85), 0, r() * 50, 0.15);
            paint(g, leafFn(r.pick(greens), r() * 9, 0.1));
            parts.push({ geo: placed(g, mat(b.x + r.range(-0.4, 0.4), b.y + r.range(-0.5, 0.2), b.z + r.range(-0.4, 0.4), r() * TAU, 1, 1.3, 1)), sway: 0.22 });
        }
    }
    const tip = curve.getPointAt(1);
    for (let j = 0; j < 3; j++) {
        const g = blob(r.range(0.55, 0.8), 0, r() * 50, 0.15);
        paint(g, leafFn(r.pick(greens), r() * 9, 0.1));
        parts.push({ geo: placed(g, mat(tip.x + r.range(-0.3, 0.3), tip.y - j * 0.5, tip.z + r.range(-0.3, 0.3), r() * TAU, 1, 1.3, 1)), sway: 0.22 });
    }
    return { parts, H, R: 0.28 };
}

export const BLOSSOM_PALETTES = [
    ['#ffc4dc', '#ffd8e8', '#f7a8c8', '#ffb6d2'],   // cherry
    ['#fff4f6', '#ffe6ee', '#f8dce6', '#ffffff'],   // apple and pear
    ['#f490b8', '#ff9ec4', '#e878a8', '#ffb0cc'],   // deep pink
    ['#e8c8ff', '#f0d8ff', '#d8b0f4', '#f6e6ff'],   // a lilac-ish plum
];

function blossomTree(seed, palette, big = 1) {
    const r = rng('fbloss' + seed);
    const H = r.range(4.6, 6) * big;
    const parts = [];
    const top = new V3(r.range(-0.6, 0.6) * big, r.range(1.8, 2.4) * big, r.range(-0.6, 0.6) * big);
    parts.push({ geo: paint(bough(r, new V3(0, -0.3, 0), top, 0.3 * big, 0.22 * big, 7, 6), barkFn(seed, C('#3e2c22'), C('#5c4434'))) });
    const ends = [];
    const nb = r.int(3, 5);
    for (let k = 0; k < nb; k++) {
        const a = (k / nb) * TAU + r() * 0.8, d = r.range(2.2, 3.4) * big;
        const end = new V3(Math.sin(a) * d, r.range(H * 0.62, H * 0.86), Math.cos(a) * d);
        parts.push({ geo: paint(bough(r, top, end, 0.16 * big, 0.06 * big, 5, 4), barkFn(seed + k, C('#3e2c22'), C('#5c4434'))) });
        ends.push(end);
    }
    ends.push(new V3(top.x, H * 0.95, top.z));
    const t = new THREE.Color();
    for (const e of ends) {
        const n = Math.round(r.int(6, 8) * (big > 1 ? 1.6 : 1));
        for (let k = 0; k < n; k++) {
            const R = r.range(0.55, 0.95) * Math.sqrt(big);
            const g = blob(R, 0, r() * 50, 0.18);
            const leafy = r() < 0.12;
            const base = leafy ? C('#9ccc5a') : C(r.pick(palette));
            paint(g, (v, nn) => t.copy(base).multiplyScalar(0.84 + nn.y * 0.14));
            const sp = 1.3 * Math.sqrt(big);
            parts.push({ geo: placed(g, mat(e.x + r.range(-sp, sp), e.y + r.range(-0.7, 0.7), e.z + r.range(-sp, sp), r() * TAU, 1)), sway: 0.12, glow: leafy ? 0 : 0.14 });
        }
    }
    return { parts, H, R: 0.32 * big };
}

function firTree(seed) {
    const r = rng('ffir' + seed);
    const H = r.range(6.5, 9);
    const parts = [];
    parts.push({ geo: paint(new THREE.CylinderGeometry(0.12, 0.22, H * 0.4, 6).translate(0, H * 0.2 - 0.2, 0), flat(C('#4a3a2e'))) });
    const tiers = 4;
    for (let k = 0; k < tiers; k++) {
        const t = k / tiers;
        const R = lerp(2.0, 0.7, t), h = lerp(2.6, 1.8, t);
        const g = new THREE.ConeGeometry(R, h, 8, 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const y = p.getY(i);
            if (y < h / 2 - 0.01) p.setXYZ(i, p.getX(i) * (1 + Math.sin(i * 2.3) * 0.08), y - (y < -h / 2 + 0.01 ? Math.abs(Math.sin(i * 1.7)) * 0.25 : 0), p.getZ(i) * (1 + Math.cos(i * 1.9) * 0.08));
        }
        g.computeVertexNormals();
        paint(g, fadeY('#2f5a3a', '#5a8f58', -h / 2, h / 2));
        parts.push({ geo: placed(g, mat(0, H * 0.3 + k * H * 0.18 + h / 2, 0, r() * TAU, 1)), sway: 0.05 });
    }
    return { parts, H, R: 0.3 };
}

function bush(seed, flower) {
    const r = rng('fbush' + seed);
    const parts = [];
    const fc = C(flower), t = new THREE.Color();
    const n = r.int(3, 5);
    const spots = [];
    for (let k = 0; k < n; k++) {
        const R = r.range(0.45, 0.8);
        const x = r.range(-0.6, 0.6), z = r.range(-0.6, 0.6), y = R * 0.7 + r.range(0, 0.3);
        const g = blob(R, 1, r() * 50, 0.2);
        paint(g, leafFn('#5f9a3e', r() * 9, 0.15));
        parts.push({ geo: placed(g, mat(x, y, z, r() * TAU, 1, 0.85, 1)), sway: 0.05 });
        spots.push({ x, y, z, R });
    }
    const bud = new THREE.TetrahedronGeometry(0.075, 0);
    for (let k = 0; k < 26; k++) {
        const s = r.pick(spots);
        const d = new V3(r() - 0.5, r() * 0.9, r() - 0.5).normalize().multiplyScalar(s.R * 0.95);
        parts.push({ geo: placed(paint(bud.clone(), () => t.copy(fc).multiplyScalar(0.9 + r() * 0.15)), mat(s.x + d.x, s.y + d.y * 0.85, s.z + d.z, r() * TAU, 1)), sway: 0.05, glow: 0.1 });
    }
    return { parts, H: 1.6, R: 0.6 };
}

// ------------------------------------------------------------------ prototypes: small things

function tuft(seed) {
    const r = rng('ftuft' + seed);
    const pos = [], nor = [];
    const n = r.int(6, 9);
    for (let b = 0; b < n; b++) {
        const a = r() * TAU, d = r() * 0.16;
        const bx = Math.cos(a) * d, bz = Math.sin(a) * d;
        const face = r() * TAU, h = r.range(0.22, 0.5), w = r.range(0.035, 0.055), lean = r.range(0.04, 0.2);
        const fx = Math.cos(face), fz = Math.sin(face);
        const lx = Math.cos(face + Math.PI / 2) * lean, lz = Math.sin(face + Math.PI / 2) * lean;
        pos.push(bx - fx * w, 0, bz - fz * w, bx + fx * w, 0, bz + fz * w, bx + lx, h, bz + lz);
        const nx = -Math.sin(face) * 0.5, nz = Math.cos(face) * 0.5;
        nor.push(nx, 0.85, nz, nx, 0.85, nz, nx, 0.85, nz);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    paint(g, fadeY('#3c6a26', '#a8d460', 0, 0.45));
    return { parts: [{ geo: g, sway: 0.09 }], H: 0.5 };
}

function fern(seed) {
    const r = rng('ffern' + seed);
    const parts = [];
    const n = r.int(6, 9);
    for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + r() * 0.4;
        const dir = new V3(Math.sin(a), 0, Math.cos(a));
        const len = r.range(0.55, 0.9);
        const pts = arc(dir, len, r.range(0.35, 0.55), 0.85, 7);
        const g = strip(pts, (t) => Math.sin(Math.min(1, t * 1.15) * Math.PI) * 0.22 + 0.01, new V3(Math.cos(a), 0, -Math.sin(a)));
        paint(g, fadeY('#3f7a32', '#8cc25a', 0, 0.5));
        parts.push({ geo: g, sway: 0.08 });
    }
    return { parts, H: 0.55 };
}

function bluebells(seed) {
    const r = rng('fbell' + seed);
    const parts = [];
    const bell = new THREE.ConeGeometry(0.028, 0.055, 5, 1, true).rotateX(Math.PI);
    const t = new THREE.Color();
    const blue = C(r.pick(['#5a62d8', '#6a5ae0', '#4f6ae0'])), pale = C('#a8b0ff');
    const n = r.int(3, 5);
    for (let k = 0; k < n; k++) {
        const a = r() * TAU;
        const dir = new V3(Math.sin(a), 0, Math.cos(a));
        const h = r.range(0.26, 0.38);
        const pts = [];
        for (let i = 0; i < 6; i++) {
            const s = i / 5;
            pts.push(new V3(dir.x * (0.02 + s * s * 0.12), h * Math.sin(s * Math.PI * 0.62) / Math.sin(Math.PI * 0.62), dir.z * (0.02 + s * s * 0.12)));
        }
        const g = strip(pts, () => 0.012, new V3(Math.cos(a), 0, -Math.sin(a)));
        paint(g, flat(C('#4f7a36')));
        parts.push({ geo: g, sway: 0.05 });
        for (let j = 0; j < 4; j++) {
            const p = pts[2 + j] || pts[5];
            const bg = paint(bell.clone(), (v) => t.copy(blue).lerp(pale, clamp(-v.y * 9, 0, 0.5)));
            parts.push({ geo: placed(bg, mat(p.x + dir.x * 0.02, p.y - 0.035, p.z + dir.z * 0.02, r() * TAU, 1, 1, 1, dir.z * 0.4, -dir.x * 0.4)), sway: 0.05, glow: 0.05 });
        }
    }
    for (let k = 0; k < 3; k++) {
        const a = r() * TAU;
        const g = strip(arc(new V3(Math.sin(a), 0, Math.cos(a)), r.range(0.22, 0.32), 0.12, 0.7, 5), (s) => 0.035 * (1 - s * 0.7), new V3(Math.cos(a), 0, -Math.sin(a)));
        paint(g, flat(C('#3f7030')));
        parts.push({ geo: g, sway: 0.03 });
    }
    return { parts, H: 0.38 };
}

const STAR6 = (() => {
    const s = new THREE.Shape();
    for (let k = 0; k <= 12; k++) {
        const a = (k / 12) * TAU, rr = k % 2 ? 0.45 : 1;
        if (k === 0) s.moveTo(Math.sin(a) * rr, Math.cos(a) * rr);
        else s.lineTo(Math.sin(a) * rr, Math.cos(a) * rr);
    }
    return new THREE.ShapeGeometry(s);
})();

function daffodils(seed) {
    const r = rng('fdaff' + seed);
    const parts = [];
    const petal = C('#fff1a0'), cup = C('#ffb81a'), stem = C('#5a8a3a');
    for (let k = 0; k < r.int(2, 4); k++) {
        const ox = r.range(-0.12, 0.12), oz = r.range(-0.12, 0.12), h = r.range(0.34, 0.46), yaw = r() * TAU;
        const st = new THREE.CylinderGeometry(0.008, 0.01, h, 4).translate(ox, h / 2, oz);
        parts.push({ geo: paint(st, flat(stem)), sway: 0.06 });
        // the flower nods forward, facing out
        const head = mat(ox, h, oz, yaw, 1, 1, 1, -1.1);
        const star = placed(paint(STAR6.clone().scale(0.07, 0.07, 1), flat(petal)), head);
        parts.push({ geo: star, sway: 0.06, glow: 0.05 });
        const tr = new THREE.CylinderGeometry(0.03, 0.022, 0.05, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.025);
        parts.push({ geo: placed(paint(tr, flat(cup)), head), sway: 0.06, glow: 0.05 });
    }
    for (let k = 0; k < 4; k++) {
        const a = r() * TAU;
        const g = strip(arc(new V3(Math.sin(a), 0, Math.cos(a)), 0.18, r.range(0.25, 0.38), 0.55, 5), (s) => 0.03 * (1 - s * 0.6), new V3(Math.cos(a), 0, -Math.sin(a)));
        parts.push({ geo: paint(g, flat(C('#4f8a3c'))), sway: 0.04 });
    }
    return { parts, H: 0.46 };
}

export const TULIP_COLORS = ['#e83a4a', '#ff8ab0', '#ffd23a', '#9a5ad8', '#fff2ea', '#ff8a3a'];
function tulips(seed, color) {
    const r = rng('ftulip' + seed);
    const parts = [];
    const c = C(color), t = new THREE.Color();
    for (let k = 0; k < r.int(3, 5); k++) {
        const ox = r.range(-0.15, 0.15), oz = r.range(-0.15, 0.15), h = r.range(0.3, 0.42);
        parts.push({ geo: paint(new THREE.CylinderGeometry(0.008, 0.011, h, 4).translate(ox, h / 2, oz), flat(C('#5a8f3e'))), sway: 0.05 });
        const cupG = new THREE.CylinderGeometry(0.05, 0.028, 0.085, 6, 2, false);
        const p = cupG.attributes.position;
        for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.04) p.setY(i, 0.0425 + (i % 2) * 0.014);
        cupG.computeVertexNormals();
        paint(cupG, (v) => t.copy(c).multiplyScalar(0.78 + (v.y + 0.04) * 3));
        parts.push({ geo: placed(cupG, mat(ox, h + 0.035, oz, r() * TAU, 1)), sway: 0.05, glow: 0.04 });
    }
    for (let k = 0; k < 3; k++) {
        const a = r() * TAU;
        const g = strip(arc(new V3(Math.sin(a), 0, Math.cos(a)), 0.14, r.range(0.18, 0.26), 0.6, 5), (s) => 0.06 * Math.sin(Math.max(0.15, s) * Math.PI), new V3(Math.cos(a), 0, -Math.sin(a)));
        parts.push({ geo: paint(g, flat(C('#5f9a48'))), sway: 0.04 });
    }
    return { parts, H: 0.45 };
}

/** Little flowers in the grass: daisies, buttercups, forget-me-nots, clover. */
function smallFlowers(seed, kind) {
    const r = rng('fsmall' + seed);
    const parts = [];
    const disc = new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2);
    const [petal, eye, size] = {
        daisy: ['#ffffff', '#ffd23a', 0.035],
        buttercup: ['#ffd820', '#ffb000', 0.028],
        forget: ['#8ab8ff', '#fff4a0', 0.02],
        clover: ['#f0b8e0', '#e890c8', 0.03],
    }[kind];
    const pc = C(petal), ec = C(eye);
    const n = r.int(5, 10);
    for (let k = 0; k < n; k++) {
        const x = r.range(-0.4, 0.4), z = r.range(-0.4, 0.4), h = r.range(0.06, 0.18);
        parts.push({ geo: paint(new THREE.CylinderGeometry(0.004, 0.005, h, 3).translate(x, h / 2, z), flat(C('#5a8f3e'))), sway: 0.03 });
        const s = size * r.range(0.8, 1.2);
        parts.push({ geo: placed(paint(disc.clone(), (v) => (Math.hypot(v.x, v.z) < 0.35 ? ec : pc)), mat(x, h, z, r() * TAU, s, s, s, r.range(-0.3, 0.3), r.range(-0.3, 0.3))), sway: 0.03, glow: kind === 'daisy' ? 0.08 : 0.03 });
    }
    return { parts, H: 0.2 };
}

function mushrooms(seed, kind) {
    const r = rng('fmush' + seed);
    const parts = [];
    const t = new THREE.Color();
    const [capA, capB, spots, glow] = {
        red: ['#d8343a', '#ff5a4a', true, 0],
        brown: ['#8a5a36', '#b88a5a', false, 0],
        fairy: ['#bfe8ff', '#f0d8ff', false, 1],
    }[kind];
    const ca = C(capA), cb = C(capB), white = C('#fff8ec');
    for (let k = 0; k < r.int(2, 5); k++) {
        const x = r.range(-0.18, 0.18), z = r.range(-0.18, 0.18), s = r.range(0.7, 1.4);
        const h = 0.1 * s;
        parts.push({ geo: paint(new THREE.CylinderGeometry(0.018 * s, 0.026 * s, h, 6).translate(x, h / 2, z), flat(white)), glow: glow * 0.4 });
        const cap = new THREE.SphereGeometry(0.07 * s, 8, 4, 0, TAU, 0, Math.PI / 2).scale(1, 0.62, 1);
        paint(cap, (v) => {
            t.copy(ca).lerp(cb, clamp(v.y / (0.04 * s), 0, 1));
            if (spots && noise2(v.x * 90 + seed, v.z * 90) > 0.45) t.copy(white);
            return t;
        });
        parts.push({ geo: placed(cap, mat(x, h - 0.004, z, r() * TAU, 1, 1, 1, r.range(-0.2, 0.2), r.range(-0.2, 0.2))), glow });
    }
    return { parts, H: 0.2 };
}

function reeds(seed) {
    const r = rng('freed' + seed);
    const parts = [];
    for (let k = 0; k < r.int(6, 10); k++) {
        const a = r() * TAU, h = r.range(0.8, 1.5);
        const x = r.range(-0.3, 0.3), z = r.range(-0.3, 0.3);
        const lean = new V3(r() - 0.5, 0, r() - 0.5).multiplyScalar(0.3);
        const pts = [0, 1, 2, 3].map((i) => new V3(x + lean.x * (i / 3) ** 2, (i / 3) * h, z + lean.z * (i / 3) ** 2));
        parts.push({ geo: paint(strip(pts, (s) => 0.035 * (1 - s * 0.8), new V3(Math.cos(a), 0, Math.sin(a))), fadeY('#4a7a30', '#a8c868', 0, 1.4)), sway: 0.12 });
        if (r() < 0.4) {
            const top = pts[3];
            parts.push({ geo: placed(paint(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6), flat(C('#6a4a2a'))), mat(top.x, top.y - 0.15, top.z, 0, 1)), sway: 0.12 });
        }
    }
    return { parts, H: 1.5 };
}

function lily(seed) {
    const r = rng('flily' + seed);
    const parts = [];
    const pad = new THREE.CircleGeometry(1, 10, 0.35, TAU - 0.35).rotateX(-Math.PI / 2);
    for (let k = 0; k < r.int(2, 4); k++) {
        const x = r.range(-0.6, 0.6), z = r.range(-0.6, 0.6), s = r.range(0.18, 0.32);
        parts.push({ geo: placed(paint(pad.clone(), flat(C(r.pick(['#4f8a3a', '#5f9a44', '#6aa848'])))), mat(x, 0.025, z, r() * TAU, s)) });
    }
    if (r() < 0.6) {
        const c = C(r.pick(['#fff4f8', '#ffc8dc', '#ffe8a0']));
        const fl = placed(paint(STAR6.clone().rotateX(-Math.PI / 2), (v) => (Math.hypot(v.x, v.z) < 0.3 ? C('#ffd23a') : c)), mat(0, 0.05, 0, r() * TAU, 0.09));
        parts.push({ geo: fl, glow: 0.25 });
        parts.push({ geo: placed(paint(STAR6.clone().rotateX(-Math.PI / 2), flat(c)), mat(0, 0.08, 0, r() * TAU + 0.3, 0.06, 0.06, 0.06, 0.4, 0)), glow: 0.25 });
    }
    return { parts, H: 0.1 };
}

let PROTOS = null;
/** Every prototype, made once: a few of each, so the wood never looks stamped. */
export function protos() {
    if (PROTOS) return PROTOS;
    const many = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
    PROTOS = {
        broad: many(4, (i) => broadTree(i)),
        birch: many(4, (i) => birchTree(i)),
        blossom: BLOSSOM_PALETTES.flatMap((p, pi) => many(2, (i) => blossomTree(pi * 10 + i, p))),
        fir: many(2, (i) => firTree(i)),
        bush: ['#ffffff', '#ffc8dc', '#ffe070', '#f0f0ff'].map((c, i) => bush(i, c)),
        tuft: many(5, (i) => tuft(i)),
        fern: many(3, (i) => fern(i)),
        bluebell: many(4, (i) => bluebells(i)),
        daffodil: many(3, (i) => daffodils(i)),
        tulip: TULIP_COLORS.map((c, i) => tulips(i, c)),
        daisy: many(2, (i) => smallFlowers(i, 'daisy')),
        buttercup: many(2, (i) => smallFlowers(i + 5, 'buttercup')),
        forget: many(2, (i) => smallFlowers(i + 9, 'forget')),
        clover: many(2, (i) => smallFlowers(i + 13, 'clover')),
        mushRed: many(2, (i) => mushrooms(i, 'red')),
        mushBrown: many(2, (i) => mushrooms(i + 3, 'brown')),
        mushFairy: many(2, (i) => mushrooms(i + 6, 'fairy')),
        elder: [blossomTree(77, BLOSSOM_PALETTES[0], 2.1)],
        reeds: many(3, (i) => reeds(i)),
        lily: many(3, (i) => lily(i)),
    };
    return PROTOS;
}

// ------------------------------------------------------------------ chunks

const TREE_DENSITY = { blossom: 0.42, bluebell: 0.78, birch: 0.66, meadow: 0.05 };
const TREE_PICK = {
    blossom: [['blossom', 70], ['broad', 12], ['bush', 18]],
    bluebell: [['broad', 72], ['birch', 12], ['fir', 8], ['bush', 8]],
    birch: [['birch', 72], ['fir', 14], ['blossom', 8], ['bush', 6]],
    meadow: [['blossom', 35], ['bush', 50], ['broad', 15]],
};
const UNDER_PICK = {
    blossom: [['tuft', 40], ['daisy', 18], ['tulip', 10], ['daffodil', 8], ['clover', 8], ['forget', 6], ['mushRed', 2]],
    bluebell: [['bluebell', 56], ['tuft', 18], ['fern', 14], ['mushBrown', 4], ['mushFairy', 2], ['forget', 6]],
    birch: [['tuft', 30], ['fern', 24], ['daffodil', 18], ['daisy', 8], ['mushRed', 4], ['mushFairy', 3], ['bluebell', 8]],
    meadow: [['tuft', 38], ['daisy', 18], ['tulip', 16], ['buttercup', 12], ['clover', 8], ['daffodil', 6]],
};

function weighted(r, list) {
    let total = 0;
    for (const [, w] of list) total += w;
    let k = r() * total;
    for (const [id, w] of list) if ((k -= w) <= 0) return id;
    return list[0][0];
}
function pickBiome(r, w) {
    let k = r();
    for (const b of ['blossom', 'bluebell', 'birch', 'meadow']) if ((k -= w[b]) <= 0) return b;
    return 'meadow';
}

const GRASS = { blossom: C('#7fae4c'), bluebell: C('#5c8a40'), birch: C('#98b856'), meadow: C('#86bd4c') };
const HAZE = { blossom: C('#f2b8cf'), bluebell: C('#7076d0'), birch: C('#e8e070'), meadow: C('#f4f0a0') };
const DIRT = C('#a08058'), MUD = C('#6a5a40'), BED = C('#4a5a38');

/**
 * Build chunk (ci, cj): one mesh in world coordinates and the circles you can't
 * walk through. `density` scales how much grows (by quality tier).
 */
export function buildChunk(ci, cj, material, density = 1) {
    const P = protos();
    const r = rng(`springwood-chunk:${ci}:${cj}`);
    const acc = new Acc();
    const colliders = [];
    const x0 = ci * CHUNK, z0 = cj * CHUNK;

    // the ground: a grid whose normals come from the height field, so neighbouring chunks meet without a seam
    const N = CHUNK / STEP + 1;
    const pos = [], nor = [], col = [], idx = [];
    const tmp = new THREE.Color(), _c = new THREE.Color(), _n = new V3();
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const x = x0 + i * STEP, z = z0 + j * STEP;
            const y = groundY(x, z);
            const e = 0.7;
            _n.set(groundY(x - e, z) - groundY(x + e, z), 2 * e, groundY(x, z - e) - groundY(x, z + e)).normalize();
            pos.push(x, y, z);
            nor.push(_n.x, _n.y, _n.z);
            const w = biomeAt(x, z);
            tmp.setRGB(0, 0, 0);
            for (const b of ['blossom', 'bluebell', 'birch', 'meadow']) tmp.add(_c.copy(GRASS[b]).multiplyScalar(w[b]));
            // a haze of flowers in drifts: petals under the blossom, a blue mist of bluebells, primroses, buttercups
            const drift = smoothstep(0.05, 0.45, fbm2(x * 0.09 + 7, z * 0.09 - 3, 3));
            _c.setRGB(0, 0, 0);
            for (const b of ['blossom', 'bluebell', 'birch', 'meadow']) {
                _c.r += HAZE[b].r * w[b];
                _c.g += HAZE[b].g * w[b];
                _c.b += HAZE[b].b * w[b];
            }
            tmp.lerp(_c, drift * (0.28 + w.bluebell * 0.35));
            tmp.multiplyScalar(0.9 + 0.12 * fbm2(x * 0.3, z * 0.3, 2));
            const pk = pathAt(x, z) * smoothstep(0.4, 1.2, y) * (Math.hypot(x, z) < HOME_R - 2 ? 0 : 1);
            tmp.lerp(DIRT, pk * 0.85);
            if (y < 0.7) tmp.lerp(MUD, smoothstep(0.7, 0.1, y));
            if (y < 0) tmp.lerp(BED, smoothstep(0, -0.8, y));
            col.push(tmp.r, tmp.g, tmp.b);
            if (i < N - 1 && j < N - 1) {
                const a = j * N + i;
                idx.push(a, a + N, a + 1, a + 1, a + N, a + N + 1);
            }
        }
    }
    const gGround = new THREE.BufferGeometry();
    gGround.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    gGround.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    gGround.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    gGround.setIndex(idx);
    acc.add(gGround, new THREE.Matrix4());
    gGround.dispose();

    // a special place whose middle is in this chunk is built with it
    const fi = Math.floor((x0 + CHUNK / 2) / CELL), fj = Math.floor((z0 + CHUNK / 2) / CELL);
    const places = [];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const f = featureIn(fi + di, fj + dj);
        if (f && f.kind !== 'pond' && f.x >= x0 && f.x < x0 + CHUNK && f.z >= z0 && f.z < z0 + CHUNK) {
            buildPlace(acc, f, colliders, { P, groundY });
            places.push(f);
        }
    }

    // trees on a jittered grid, so they are never on top of one another
    const G = 16 / 3;
    const n = Math.round(CHUNK / G);
    for (let gj = 0; gj < n; gj++) {
        for (let gi = 0; gi < n; gi++) {
            const x = x0 + (gi + 0.15 + r() * 0.7) * G, z = z0 + (gj + 0.15 + r() * 0.7) * G;
            const roll = r(), pick = r(), yaw = r() * TAU, sc = r.range(0.8, 1.2), v = r();
            const w = biomeAt(x, z);
            const dens = (w.blossom * TREE_DENSITY.blossom + w.bluebell * TREE_DENSITY.bluebell + w.birch * TREE_DENSITY.birch + w.meadow * TREE_DENSITY.meadow) * (0.55 + 0.75 * smoothstep(-0.35, 0.35, fbm2(x * 0.045 + 2, z * 0.045 - 9, 2)));
            if (roll > dens * Math.min(1, density * 1.1)) continue;
            const f = featureAt(x, z);
            if (!open(x, z, f, 1.5)) continue;
            if (pathAt(x, z) > 0.25) continue;
            const y = groundY(x, z);
            if (y < 0.6) continue;
            const kind = weighted(() => pick, TREE_PICK[pickBiome(() => v, w)]);
            const list = P[kind];
            const proto = list[Math.floor(r() * list.length)];
            acc.addProto(proto, mat(x, y, z, yaw, sc));
            if (proto.R) colliders.push({ x, z, r: proto.R * sc });
        }
    }

    // stones and fallen logs
    const nRocks = r.int(1, 4);
    for (let k = 0; k < nRocks; k++) {
        const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK;
        const s = r.range(0.4, 1.4), seed = r() * 100, yaw = r() * TAU;
        if (!open(x, z, featureAt(x, z), 1) || pathAt(x, z) > 0.3) continue;
        const y = groundY(x, z);
        if (y < 0.4) continue;
        const g = rockGeo(seed);
        acc.add(g, mat(x, y + s * 0.1, z, yaw, s * 1.3, s * 0.8, s), { colorFn: mossyStone(seed) });
        g.dispose();
        if (s > 0.7) colliders.push({ x, z, r: s * 1.05 });
    }
    if (r() < 0.45 * density) {
        const x = x0 + 4 + r() * (CHUNK - 8), z = z0 + 4 + r() * (CHUNK - 8);
        const w = biomeAt(x, z);
        if (w.meadow < 0.5 && open(x, z, featureAt(x, z), 3) && pathAt(x, z) < 0.2 && groundY(x, z) > 0.8) log(acc, r, x, z, colliders, P);
    }

    // the things underfoot
    const tries = Math.round(520 * density);
    for (let k = 0; k < tries; k++) {
        const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK;
        const roll = r(), pick = r(), yaw = r() * TAU, sc = r.range(0.75, 1.3), v = r();
        const y = groundY(x, z);
        if (y < -0.25) {
            // out on the pond
            if (y < -0.4 && roll < 0.12) acc.addProto(P.lily[Math.floor(pick * P.lily.length)], mat(x, 0, z, yaw, sc));
            continue;
        }
        if (y < 0.55) {
            if (roll < 0.35) acc.addProto(P.reeds[Math.floor(pick * P.reeds.length)], mat(x, y - 0.05, z, yaw, sc));
            continue;
        }
        const f = featureAt(x, z);
        const home = Math.hypot(x, z);
        if (f && f.kind !== 'pond' && Math.hypot(x - f.x, z - f.z) < f.r * 0.8) continue;
        const pk = pathAt(x, z);
        if (pk > 0.45 || (pk > 0.1 && roll < 0.6)) continue;
        if (home < 3.2) continue;
        const w = biomeAt(x, z);
        const kind = weighted(() => pick, UNDER_PICK[pickBiome(() => v, w)]);
        const list = P[kind];
        acc.addProto(list[Math.floor(r() * list.length)], mat(x, y - 0.02, z, yaw, sc));
    }

    const mesh = new THREE.Mesh(acc.build(), material);
    mesh.matrixAutoUpdate = false;
    return { mesh, colliders, places };
}

/** A fallen trunk, mossy on top, with toadstools and ferns about it. */
function log(acc, r, x, z, colliders, P) {
    const yaw = r() * TAU, L = r.range(2.6, 4.2), R = r.range(0.24, 0.36);
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    const a = new V3(x - dx * L / 2, 0, z - dz * L / 2), b = new V3(x + dx * L / 2, 0, z + dz * L / 2);
    a.y = groundY(a.x, a.z) + R * 0.7;
    b.y = groundY(b.x, b.z) + R * 0.7;
    const mid = a.clone().lerp(b, 0.5).add(new V3(0, 0.05, 0));
    const g = limbGeometry([a, mid, b], R, R * 0.85, 8, 6);
    const seed = r() * 100;
    const t = new THREE.Color(), bark = C('#5a4634'), moss = C('#7aa840');
    acc.add(g, new THREE.Matrix4(), { colorFn: (v, n) => t.copy(bark).multiplyScalar(0.85 + fbm2(v.x * 3 + seed, v.z * 3, 2) * 0.3).lerp(moss, clamp((n.y - 0.3) * 1.8, 0, 1) * 0.85) });
    g.dispose();
    for (let k = 0; k <= 3; k++) {
        const p = a.clone().lerp(b, k / 3);
        colliders.push({ x: p.x, z: p.z, r: R + 0.12 });
    }
    for (let k = 0; k < 3; k++) {
        const s = r.range(0.15, 0.85), side = r.sign();
        const p = a.clone().lerp(b, s);
        const px = p.x + dz * side * (R + 0.15), pz = p.z - dx * side * (R + 0.15);
        const list = k === 0 ? P.fern : r() < 0.5 ? P.mushRed : P.mushBrown;
        acc.addProto(list[Math.floor(r() * list.length)], mat(px, groundY(px, pz) - 0.02, pz, r() * TAU, r.range(0.8, 1.2)));
    }
}
