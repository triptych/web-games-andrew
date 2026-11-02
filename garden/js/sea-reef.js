// The sea floor under the Moon Fountain: an endless seabed made on the fly in
// square chunks as the submarine moves, each one seeded by where it is, so a
// place always looks the same when you come back to it. Four kinds of floor
// blend into one another: coral gardens, kelp forest, sand flats and stone
// arches. Everything in a chunk (its ground, corals, kelp, rocks, starfish and
// clams) is merged into one mesh drawn with one material, which sways the soft
// things, lays moving caustics over the tops, and lets the anemones and clams
// glow after dark.

import * as THREE from 'three';
import { rng, fbm2, ridged2, clamp, lerp, smoothstep, TAU } from './util.js';

export const CHUNK = 32;          // metres along a side
const STEP = 2;                   // ground grid spacing
const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);
const C = (h) => new THREE.Color(h);

// ------------------------------------------------------------------ the floor

/** How much of each kind of floor is here: { reef, kelp, rock, sand }, summing to 1. */
export function biomeAt(x, z) {
    const home = Math.exp(-(x * x + z * z) / 4900);
    const a = fbm2(x * 0.0045 + 11.3, z * 0.0045 - 4.1, 3) * 2.4;
    const b = fbm2(x * 0.004 - 7.7, z * 0.004 + 19.2, 3) * 2.4;
    const reef = clamp(0.5 + a, 0, 1.5) + home * 2;
    const kelp = clamp(b - 0.1, 0, 1.5) * (1 - home);
    const rock = clamp(-b - 0.35, 0, 1.5) * (1 - home);
    const sand = 0.45;
    const s = reef + kelp + rock + sand;
    return { reef: reef / s, kelp: kelp / s, rock: rock / s, sand: sand / s };
}

export function dominant(w) {
    let best = 'sand';
    for (const k of ['reef', 'kelp', 'rock']) if (w[k] > w[best]) best = k;
    return best;
}

/** Height of the sea floor (the surface is y = 0). Shallower round the start. */
export function seabedY(x, z, w = biomeAt(x, z)) {
    const home = Math.exp(-(x * x + z * z) / 6400);
    const broad = fbm2(x * 0.0032 + 3.3, z * 0.0032 - 1.1, 3);
    const mid = fbm2(x * 0.017 - 8.1, z * 0.017 + 2.7, 3);
    let y = -21 + broad * 16 + mid * 3 + home * 6;
    y += (ridged2(x * 0.03 + 1.7, z * 0.03 - 4.4, 3) - 0.45) * 7 * w.rock;
    // never shallower than 7 m, eased in so there is no shelf
    return y > -11 ? -11 + 4 * Math.tanh((y + 11) / 4) : y;
}

// ------------------------------------------------------------------ the material

const CAUSTIC = /* glsl */ `
float caustic(vec2 p, float t) {
    p *= 0.32;
    vec2 q = p + vec2(sin(p.y * 1.3 + t * 0.7), cos(p.x * 1.1 - t * 0.6)) * 0.9;
    float a = sin(q.x * 2.1 + t) * sin(q.y * 2.3 - t * 0.8);
    vec2 r = p * 1.7 + vec2(cos(p.y * 0.9 - t * 0.5), sin(p.x * 1.2 + t * 0.4)) * 1.1;
    float b = sin(r.x * 1.9 - t * 0.9) * sin(r.y * 2.0 + t * 0.6);
    return pow(clamp(1.0 - abs(a + b) * 0.5, 0.0, 1.0), 7.0);
}`;

/** One material for every chunk. `u` holds the shared uniforms { uTime, uCaustic, uGlow }. */
export function reefMaterial(u) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = u.uTime;
        sh.uniforms.uCaustic = u.uCaustic;
        sh.uniforms.uGlow = u.uGlow;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', `#include <common>
attribute float aSway; attribute float aGlow; uniform float uTime;
varying vec3 vWP; varying float vWNy; varying float vGlow;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
float ph = uTime * 1.1 + position.x * 0.21 + position.z * 0.17;
transformed.x += sin(ph) * aSway;
transformed.z += cos(ph * 0.83 + 1.3) * aSway * 0.7;
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNy = normal.y;
vGlow = aGlow;`);
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uCaustic; uniform float uGlow;
varying vec3 vWP; varying float vWNy; varying float vGlow;
${CAUSTIC}`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float cst = caustic(vWP.xz, uTime) * uCaustic * clamp(vWNy * 0.8 + 0.25, 0.0, 1.0) * exp(vWP.y * 0.04);
totalEmissiveRadiance += diffuseColor.rgb * cst * vec3(0.9, 1.05, 1.1) + diffuseColor.rgb * vGlow * uGlow;`);
    };
    m.customProgramCacheKey = () => 'garden-reef-1';
    return m;
}

// ------------------------------------------------------------------ geometry helpers

/** Accumulates transformed pieces with a colour, sway and glow per vertex, then builds one geometry. */
class Acc {
    constructor() {
        this.pos = [];
        this.nor = [];
        this.col = [];
        this.sway = [];
        this.glow = [];
        this.idx = [];
        this.n = 0;
    }

    /**
     * @param {THREE.BufferGeometry} geo  with position and normal
     * @param {THREE.Matrix4} m
     * @param {object} o  color | colorFn(localPos, localNormal) -> Color, sway (m at the top), base/H (world
     *                    height range the sway grows over), glow
     */
    add(geo, m, o = {}) {
        const p = geo.attributes.position, nr = geo.attributes.normal;
        const nm = _nm.getNormalMatrix(m);
        const base = this.n;
        const sway = o.sway || 0, glow = o.glow || 0;
        for (let i = 0; i < p.count; i++) {
            _v.fromBufferAttribute(p, i);
            _n.fromBufferAttribute(nr, i);
            const c = o.colorFn ? o.colorFn(_v, _n) : o.color;
            _w.copy(_v).applyMatrix4(m);
            _n.applyMatrix3(nm).normalize();
            this.pos.push(_w.x, _w.y, _w.z);
            this.nor.push(_n.x, _n.y, _n.z);
            this.col.push(c.r, c.g, c.b);
            this.sway.push(sway ? sway * Math.pow(clamp((_w.y - o.base) / o.H, 0, 1), 1.5) : 0);
            this.glow.push(typeof glow === 'function' ? glow(_v) : glow);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(base + geo.index.getX(i));
        else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
        this.n += p.count;
    }

    build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sway, 1));
        g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1));
        g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
        g.computeBoundingSphere();
        return g;
    }
}
const _v = new V3(), _n = new V3(), _w = new V3(), _nm = new THREE.Matrix3();

// shared unit pieces, all standing on y = 0
const UNIT_CYL = new THREE.CylinderGeometry(0.72, 1, 1, 6, 1).translate(0, 0.5, 0);
const UNIT_SPH = new THREE.SphereGeometry(1, 8, 6);
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
const UNIT_CONE = new THREE.ConeGeometry(1, 1, 5).translate(0, 0.5, 0);
const TUBE = new THREE.CylinderGeometry(1, 0.85, 1, 10, 1).translate(0, 0.5, 0);
const PLATE = new THREE.CylinderGeometry(1, 0.85, 0.1, 14).translate(0, 0.05, 0);
const SHELL_LO = new THREE.SphereGeometry(1, 14, 6, 0, TAU, Math.PI * 0.5, Math.PI * 0.5);
const SHELL_HI = new THREE.SphereGeometry(1, 14, 5, 0, TAU, 0, Math.PI * 0.5);
const STAR = (() => {
    const s = new THREE.Shape();
    for (let k = 0; k <= 10; k++) {
        const a = (k / 10) * TAU, r = k % 2 ? 0.38 : 1;
        if (k === 0) s.moveTo(Math.sin(a) * r, Math.cos(a) * r);
        else s.lineTo(Math.sin(a) * r, Math.cos(a) * r);
    }
    return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);
})();

const _q = new THREE.Quaternion(), _s = new V3(), _p = new V3(), _e = new THREE.Euler();
function mat(x, y, z, yaw, sx, sy = sx, sz = sx, tiltX = 0, tiltZ = 0) {
    _q.setFromEuler(_e.set(tiltX, yaw, tiltZ, 'YXZ'));
    return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

/** A strip through `pts`, `side` wide, seen from both faces. */
function ribbon(pts, w0, w1, side) {
    const pos = [], nor = [], idx = [];
    const n = pts.length;
    const nrm = new V3();
    for (let face = 0; face < 2; face++) {
        const off = face * n * 2;
        for (let i = 0; i < n; i++) {
            const t = i / (n - 1), w = lerp(w0, w1, t) / 2;
            const p = pts[i];
            const tan = pts[Math.min(n - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
            nrm.crossVectors(side, tan).normalize();
            if (face) nrm.negate();
            pos.push(p.x - side.x * w, p.y - side.y * w, p.z - side.z * w, p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
            nor.push(nrm.x, nrm.y, nrm.z, nrm.x, nrm.y, nrm.z);
            if (i < n - 1) {
                const a = off + i * 2;
                if (face) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
                else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            }
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
}

// ------------------------------------------------------------------ things on the floor

const PALETTE = {
    branch: [['#ff8fb0', '#ffd0dc'], ['#b46cff', '#e8c8ff'], ['#ff9a3c', '#ffe0a0'], ['#4fd6e0', '#c8fbff'], ['#f0e070', '#fff8c8']],
    fan: ['#c03a6a', '#8a3ad0', '#ff6a3a', '#f0c040', '#e04848'],
    tube: ['#9a4ad8', '#ff8a2a', '#f2d23a', '#3ab0c8', '#d84a8a'],
    brain: [['#5a7a3a', '#c8d88a'], ['#7a5a3a', '#e8c890'], ['#3a6a6a', '#9ae0c8'], ['#8a4a5a', '#f0b0b8']],
    table: ['#7ab08a', '#a8b8d8', '#c8b07a', '#d89ab0'],
    anemone: [['#c83a8a', '#ffb0e0'], ['#3ac87a', '#c8ffd0'], ['#ff7a2a', '#ffe0a0'], ['#7a5aff', '#d8c8ff']],
    star: ['#ff7a3a', '#d8323a', '#8a4ad0', '#3a6ae8', '#f0a030'],
    clam: ['#2a8aff', '#20d0c0', '#9a4aff', '#40c060'],
};

function branching(acc, r, x, y, z, s) {
    const [ca, cb] = r.pick(PALETTE.branch);
    const colA = C(ca), colB = C(cb);
    const m0 = mat(x, y, z, r() * TAU, s);
    const depthMax = r() < 0.5 ? 2 : 3;
    const grow = (p, dir, len, rad, depth) => {
        const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
        const m = new THREE.Matrix4().compose(p, q, new V3(rad, len, rad));
        acc.add(UNIT_CYL, m0.clone().multiply(m), { color: depth === 0 ? colB : colA });
        const end = p.clone().addScaledVector(dir, len);
        if (depth <= 0) {
            acc.add(UNIT_SPH, m0.clone().multiply(new THREE.Matrix4().compose(end, q, new V3(rad * 0.75, rad * 0.75, rad * 0.75))), { color: colB });
            return;
        }
        const n = r() < 0.5 ? 2 : 3;
        for (let k = 0; k < n; k++) {
            const a = r() * TAU;
            const nd = dir.clone().applyAxisAngle(new V3(Math.cos(a), 0, Math.sin(a)), 0.35 + r() * 0.5);
            nd.y = Math.max(nd.y, 0.25);
            grow(end, nd.normalize(), len * (0.62 + r() * 0.2), rad * 0.72, depth - 1);
        }
    };
    grow(new V3(), new V3(r() * 0.3 - 0.15, 1, r() * 0.3 - 0.15).normalize(), 0.42, 0.075, depthMax);
}

function fan(acc, r, x, y, z, s) {
    const col = C(r.pick(PALETTE.fan));
    const m0 = mat(x, y, z, r() * TAU, s, s, s, (r() - 0.5) * 0.3);
    const H = 1.7;
    const grow = (px, py, ang, len, w, depth) => {
        const ex = px + Math.sin(ang) * len, ey = py + Math.cos(ang) * len;
        _q.setFromAxisAngle(new V3(0, 0, 1), -ang);
        const m = new THREE.Matrix4().compose(new V3(px, py, 0), _q, new V3(w, len, 0.025));
        acc.add(UNIT_BOX, m0.clone().multiply(m), { color: col, sway: 0.12 * s, base: y, H: H * s });
        if (depth <= 0) return;
        const n = r() < 0.25 ? 3 : 2;
        for (let k = 0; k < n; k++) {
            const da = (k - (n - 1) / 2) * (0.5 + r() * 0.3) + (r() - 0.5) * 0.2;
            grow(ex, ey, clamp(ang + da, -1.25, 1.25), len * (0.72 + r() * 0.12), w * 0.75, depth - 1);
        }
    };
    grow(0, 0, (r() - 0.5) * 0.2, H * 0.28, 0.07, r() < 0.5 ? 4 : 5);
}

function tubes(acc, r, x, y, z, s) {
    const col = C(r.pick(PALETTE.tube));
    const dark = col.clone().multiplyScalar(0.18);
    const n = r.int(3, 7);
    for (let k = 0; k < n; k++) {
        const a = r() * TAU, d = r() * 0.3 * s;
        const h = (0.4 + r() * 1.0) * s, rad = (0.07 + r() * 0.07) * s;
        acc.add(TUBE, mat(x + Math.cos(a) * d, y, z + Math.sin(a) * d, r() * TAU, rad, h, rad, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3), {
            colorFn: (v, nn) => (nn.y > 0.9 && v.y > 0.99 ? dark : col),
            sway: 0.03 * s, base: y, H: h,
        });
    }
}

function brain(acc, r, x, y, z, s) {
    const [ca, cb] = r.pick(PALETTE.brain);
    const dark = C(ca), light = C(cb);
    const seed = r() * 100;
    const g = new THREE.SphereGeometry(1, 22, 11, 0, TAU, 0, Math.PI * 0.56);
    const p = g.attributes.position;
    const ridge = (vx, vy, vz) => Math.abs(Math.sin(fbm2(vx * 1.6 + seed, vz * 1.6 + vy * 1.2, 2) * 16));
    for (let i = 0; i < p.count; i++) {
        _v.fromBufferAttribute(p, i);
        const k = 1 + ridge(_v.x, _v.y, _v.z) * 0.06;
        p.setXYZ(i, _v.x * k, _v.y * k, _v.z * k);
    }
    g.computeVertexNormals();
    const tmp = new THREE.Color();
    acc.add(g, mat(x, y - 0.12 * s, z, r() * TAU, s, s * 0.72, s), { colorFn: (v) => tmp.copy(dark).lerp(light, ridge(v.x, v.y, v.z)) });
    g.dispose();
}

function table(acc, r, x, y, z, s) {
    const col = C(r.pick(PALETTE.table));
    const top = col.clone().lerp(C('#ffffff'), 0.25);
    const n = r() < 0.4 ? 2 : 1;
    for (let k = 0; k < n; k++) {
        const ox = k ? (r() - 0.5) * 1.4 * s : 0, oz = k ? (r() - 0.5) * 1.4 * s : 0;
        const h = (0.35 + r() * 0.5) * s, R = (0.5 + r() * 0.6) * s;
        acc.add(UNIT_CYL, mat(x + ox, y, z + oz, 0, 0.08 * s, h, 0.08 * s), { color: col });
        acc.add(PLATE, mat(x + ox, y + h, z + oz, r() * TAU, R, s, R * (0.8 + r() * 0.2), (r() - 0.5) * 0.15), { colorFn: (v, nn) => (nn.y > 0.5 ? top : col) });
    }
}

/** Returns where the anemone's crown is, for clownfish to move in. */
function anemone(acc, r, x, y, z, s) {
    const [ca, cb] = r.pick(PALETTE.anemone);
    const base = C(ca), tip = C(cb);
    const tmp = new THREE.Color();
    const h = 0.22 * s;
    acc.add(UNIT_CYL, mat(x, y, z, 0, 0.16 * s, h, 0.16 * s), { color: base.clone().multiplyScalar(0.6) });
    const n = r.int(18, 26);
    for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + r() * 0.3, rr = (0.03 + r() * 0.12) * s;
        const dir = new V3(Math.cos(a) * (0.4 + r()), 1, Math.sin(a) * (0.4 + r())).normalize();
        const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
        const len = (0.25 + r() * 0.2) * s;
        const m = new THREE.Matrix4().compose(new V3(x + Math.cos(a) * rr, y + h, z + Math.sin(a) * rr), q, new V3(0.022 * s, len, 0.022 * s));
        acc.add(UNIT_CONE, m, { colorFn: (v) => tmp.copy(base).lerp(tip, v.y), sway: 0.05 * s, base: y + h, H: len, glow: (v) => 0.25 + v.y * 0.75 });
    }
    return new V3(x, y + h + 0.3 * s, z);
}

function kelp(acc, r, x, y, z, s) {
    const H = (7 + r() * 8) * s;
    const ph = r() * TAU, lean = r() * TAU;
    const n = 14;
    const pts = [];
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        pts.push(new V3(x + Math.sin(t * 3 + ph) * 0.35 + Math.cos(lean) * t * t * 0.8, y + t * H, z + Math.cos(t * 2.4 + ph) * 0.3 + Math.sin(lean) * t * t * 0.8));
    }
    const sideA = new V3(Math.cos(ph), 0, Math.sin(ph));
    const stipe = ribbon(pts, 0.16, 0.09, sideA);
    const stem = C('#7a6424'), leafA = C('#8a7a26'), leafB = C('#d0b444');
    const tmp = new THREE.Color();
    acc.add(stipe, new THREE.Matrix4(), { color: stem, sway: 0.9 * s, base: y, H });
    stipe.dispose();
    const leaves = Math.floor(H / 0.6);
    for (let k = 1; k < leaves; k++) {
        const t = k / leaves;
        const i = t * (n - 1), i0 = Math.floor(i);
        const p0 = pts[i0].clone().lerp(pts[Math.min(n - 1, i0 + 1)], i - i0);
        const sd = k % 2 ? 1 : -1;
        const out = sideA.clone().multiplyScalar(sd).applyAxisAngle(UP, (r() - 0.5) * 0.8);
        const L = 0.9 + r() * 0.8;
        const lp = [];
        for (let j = 0; j < 5; j++) {
            const u = j / 4;
            lp.push(p0.clone().addScaledVector(out, u * L).add(new V3(0, u * 0.35 - u * u * 0.45, 0)));
        }
        const side = new V3().crossVectors(out, UP).normalize();
        const lg = ribbon(lp, 0.12, 0.34, side);
        acc.add(lg, new THREE.Matrix4(), { colorFn: () => tmp.copy(leafA).lerp(leafB, t), sway: 0.9 * s, base: y, H });
        lg.dispose();
    }
}

function seagrass(acc, r, x, y, z, s) {
    const a = C('#3f7a32'), b = C('#9ac25a');
    const tmp = new THREE.Color();
    const n = r.int(7, 13);
    for (let k = 0; k < n; k++) {
        const ang = r() * TAU, d = r() * 0.35 * s;
        const bx = x + Math.cos(ang) * d, bz = z + Math.sin(ang) * d;
        const h = (0.4 + r() * 0.7) * s;
        const lean = new V3(r() - 0.5, 0, r() - 0.5).multiplyScalar(0.5);
        const pts = [0, 1, 2, 3].map((i) => new V3(bx + lean.x * (i / 3) ** 2 * h, y + (i / 3) * h, bz + lean.z * (i / 3) ** 2 * h));
        const g = ribbon(pts, 0.05 * s, 0.015 * s, new V3(Math.cos(ang + 1.5), 0, Math.sin(ang + 1.5)));
        acc.add(g, new THREE.Matrix4(), { colorFn: (v) => tmp.copy(a).lerp(b, clamp((v.y - y) / h, 0, 1)), sway: 0.14 * s, base: y, H: h });
        g.dispose();
    }
}

function rockGeo(seed, detail = 1) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        _v.fromBufferAttribute(p, i);
        const k = 1 + fbm2(_v.x * 1.3 + seed, _v.z * 1.3 + _v.y * 1.1 - seed, 3) * 0.35;
        p.setXYZ(i, _v.x * k, _v.y * k, _v.z * k);
    }
    g.computeVertexNormals();
    return g;
}

const ROCK = C('#6b675e'), ROCK_DARK = C('#4a4842'), CORALLINE = C('#b8707e'), MOSS = C('#6a8a4a');
function rockColor(seed) {
    const tmp = new THREE.Color();
    const crust = seed % 2 < 1 ? CORALLINE : MOSS;
    return (v, nn) => {
        const k = fbm2(v.x * 2.1 + seed, v.z * 2.1 + v.y, 2);
        tmp.copy(ROCK).lerp(ROCK_DARK, clamp(0.5 - k, 0, 1));
        if (nn.y > 0.45) tmp.lerp(crust, smoothstep(0.45, 0.85, nn.y) * (0.5 + k * 0.5));
        return tmp;
    };
}

function rock(acc, r, x, y, z, s, solids) {
    const seed = r() * 100;
    const g = rockGeo(seed);
    const sx = (1 + r() * 1.6) * s, sy = (0.6 + r() * 1.1) * s, sz = (1 + r() * 1.6) * s;
    acc.add(g, mat(x, y + sy * 0.15, z, r() * TAU, sx, sy, sz, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3), { colorFn: rockColor(seed) });
    g.dispose();
    if (sy > 0.8) solids.push({ x, y: y + sy * 0.4, z, r: Math.min(sx, sz) * 0.85 });
}

function arch(acc, r, x, y, z, solids) {
    const seed = r() * 100;
    const R = 4 + r() * 2.5, tube = 1.1 + r() * 0.5;
    const g = new THREE.TorusGeometry(R, tube, 8, 22, Math.PI);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        _v.fromBufferAttribute(p, i);
        const k = fbm2(_v.x * 0.6 + seed, _v.y * 0.6 + _v.z * 0.5, 3);
        p.setXYZ(i, _v.x + k * 0.9, _v.y + k * 0.7, _v.z * (1 + k * 0.4));
    }
    g.computeVertexNormals();
    const yaw = r() * TAU;
    const m = mat(x, y - 1.2, z, yaw, 1);
    acc.add(g, m, { colorFn: rockColor(seed) });
    g.dispose();
    for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * Math.PI;
        const w = new V3(Math.cos(a) * R, Math.sin(a) * R, 0).applyMatrix4(m);
        solids.push({ x: w.x, y: w.y, z: w.z, r: tube * 1.15 });
    }
}

function starfish(acc, r, x, y, z) {
    const s = 0.14 + r() * 0.16;
    acc.add(STAR, mat(x, y + 0.04, z, r() * TAU, s, s, s), { color: C(r.pick(PALETTE.star)) });
}

function clam(acc, r, x, y, z) {
    const s = 0.5 + r() * 0.5;
    const yaw = r() * TAU;
    const shell = C('#cfc6b0'), lip = C(r.pick(PALETTE.clam));
    const tmp = new THREE.Color();
    acc.add(SHELL_LO, mat(x, y + 0.12 * s, z, yaw, 0.5 * s, 0.26 * s, 0.32 * s), { colorFn: (v) => tmp.copy(shell).multiplyScalar(0.8 + 0.2 * Math.sin(Math.atan2(v.z, v.x) * 9)) });
    acc.add(SHELL_HI, mat(x, y + 0.11 * s, z, yaw, 0.46 * s, 0.07 * s, 0.24 * s), {
        colorFn: (v) => tmp.copy(lip).multiplyScalar(0.7 + 0.3 * Math.sin(v.x * 18) * Math.sin(v.z * 22)),
        glow: 0.9,
    });
}

// ------------------------------------------------------------------ chunks

const PICK = {
    reef: [['branching', 22], ['brain', 15], ['fan', 12], ['tubes', 12], ['table', 10], ['anemone', 8], ['starfish', 8], ['rock', 6], ['clam', 4], ['seagrass', 3]],
    kelp: [['kelp', 30], ['rock', 3], ['seagrass', 5], ['starfish', 2]],
    sand: [['seagrass', 14], ['starfish', 5], ['rock', 2], ['tubes', 1], ['fan', 1], ['clam', 1]],
    rock: [['rock', 10], ['fan', 6], ['anemone', 3], ['tubes', 3], ['brain', 2], ['starfish', 1]],
};
const ACCEPT = { reef: 1, kelp: 0.6, sand: 0.22, rock: 0.45 };

function weighted(r, list) {
    let total = 0;
    for (const [, w] of list) total += w;
    let k = r() * total;
    for (const [id, w] of list) if ((k -= w) <= 0) return id;
    return list[0][0];
}

const SAND = C('#b8a67e'), SAND_REEF = C('#c8b294'), SAND_KELP = C('#7c7456'), SAND_ROCK = C('#6c6a60');

/**
 * Build chunk (ci, cj): one mesh in world coordinates, the solid things the
 * submarine must not pass through, and the anemones clownfish can live in.
 * `density` scales how much grows (by quality tier).
 */
export function buildChunk(ci, cj, material, density = 1) {
    const r = rng(`sea:${ci}:${cj}`);
    const acc = new Acc();
    const solids = [], anemones = [];
    const x0 = ci * CHUNK, z0 = cj * CHUNK;

    // the ground: a grid whose normals come from the height field, so neighbouring chunks meet without a seam
    const N = CHUNK / STEP + 1;
    const pos = [], nor = [], col = [], idx = [];
    const tmp = new THREE.Color();
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const x = x0 + i * STEP, z = z0 + j * STEP;
            const w = biomeAt(x, z);
            const y = seabedY(x, z, w);
            const e = 0.6;
            const hx = seabedY(x + e, z) - seabedY(x - e, z), hz = seabedY(x, z + e) - seabedY(x, z - e);
            _n.set(-hx, 2 * e, -hz).normalize();
            pos.push(x, y, z);
            nor.push(_n.x, _n.y, _n.z);
            tmp.copy(SAND).multiplyScalar(w.sand * 1.6).add(_c.copy(SAND_REEF).multiplyScalar(w.reef)).add(_c.copy(SAND_KELP).multiplyScalar(w.kelp)).add(_c.copy(SAND_ROCK).multiplyScalar(w.rock * 1.4));
            tmp.multiplyScalar(1 / (w.sand * 1.6 + w.reef + w.kelp + w.rock * 1.4));
            tmp.multiplyScalar(0.86 + 0.14 * fbm2(x * 0.35, z * 0.35, 2) + 0.06 * (r() - 0.5));
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
    gGround.setIndex(idx);
    let gi = 0;
    acc.add(gGround, new THREE.Matrix4(), { colorFn: () => tmp.setRGB(col[gi * 3], col[gi * 3 + 1], col[gi++ * 3 + 2]) });
    gGround.dispose();

    // an arch now and then among the rocks
    const wc = biomeAt(x0 + CHUNK / 2, z0 + CHUNK / 2);
    if (wc.rock > 0.35 && r() < 0.35) {
        const ax = x0 + 8 + r() * (CHUNK - 16), az = z0 + 8 + r() * (CHUNK - 16);
        arch(acc, r, ax, seabedY(ax, az), az, solids);
    }

    const home = Math.exp(-((x0 + CHUNK / 2) ** 2 + (z0 + CHUNK / 2) ** 2) / 6400);
    const tries = Math.round((80 + home * 50) * density);
    for (let k = 0; k < tries; k++) {
        const x = x0 + r() * CHUNK, z = z0 + r() * CHUNK;
        const w = biomeAt(x, z);
        let pick = r() * (w.reef + w.kelp + w.rock + w.sand), b = 'sand';
        for (const key of ['reef', 'kelp', 'rock', 'sand']) if ((pick -= w[key]) <= 0) { b = key; break; }
        let accept = ACCEPT[b];
        if (b === 'reef') accept *= 0.2 + 0.8 * smoothstep(-0.25, 0.25, fbm2(x * 0.06 + 3, z * 0.06 - 5, 2));
        if (r() > accept) continue;
        const y = seabedY(x, z, w);
        const s = 0.7 + r() * 0.7;
        switch (weighted(r, PICK[b])) {
            case 'branching': branching(acc, r, x, y, z, s * 1.5); break;
            case 'brain': brain(acc, r, x, y, z, 0.5 + r() * 0.9); break;
            case 'fan': fan(acc, r, x, y, z, s); break;
            case 'tubes': tubes(acc, r, x, y, z, s); break;
            case 'table': table(acc, r, x, y, z, s); break;
            case 'anemone': anemones.push(anemone(acc, r, x, y, z, s * 1.2)); break;
            case 'starfish': starfish(acc, r, x, y, z); break;
            case 'rock': rock(acc, r, x, y, z, b === 'rock' ? s * 1.4 : s * 0.7, solids); break;
            case 'clam': clam(acc, r, x, y, z); break;
            case 'seagrass': seagrass(acc, r, x, y, z, s); break;
            case 'kelp': kelp(acc, r, x, y, z, s); break;
        }
    }
    const mesh = new THREE.Mesh(acc.build(), material);
    mesh.matrixAutoUpdate = false;
    return { mesh, solids, anemones };
}
const _c = new THREE.Color();
