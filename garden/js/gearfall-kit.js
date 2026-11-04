// Small tools for Gearfall, the derelict city past the vault door (gearfall.js):
// an accumulator that merges transformed, coloured pieces into one geometry,
// each vertex carrying what the city's one material needs to know about it,
// and that material itself. The material paints windows onto every facade in
// its shader (dark glass, panes smashed to jagged holes, boarded windows, rags
// of curtain and, here and there, a light still on and flickering), streaks the
// walls with grime, dims everything indoors so the rooms are gloomy, lets
// lamps, signs and fires glow and stutter, and sways hanging cables in the wind.
//
// Per-vertex data: aFac (metres across and up a box face, and the face's width
// and height, so windows can be laid out on it), aA (window style, a seed,
// glow, flicker seed) and aB (indoors 0..1, sway in metres).

import * as THREE from 'three';
import { fbm2, noise2, clamp, TAU } from './util.js';
import { gearShape } from './architecture.js';

const V3 = THREE.Vector3;
export const C = (h) => new THREE.Color(h);
export { TAU };

// window styles for aA.x
export const WIN = { none: 0, office: 1, flat: 2, house: 3, shop: 4 };
// floor styles indoors (also aA.x): tiles, boards, carpet, concrete; and walls indoors
export const FLOOR = { tiles: 5, boards: 6, carpet: 7, concrete: 8 };
export const WALL_IN = 9;

const _v = new V3(), _n = new V3(), _w = new V3(), _nm = new THREE.Matrix3(), _c = new THREE.Color();
const _q = new THREE.Quaternion(), _s = new V3(), _p = new V3(), _e = new THREE.Euler();

/** A transform: at (x, y, z), turned by yaw, scaled, and tipped (pitch about x, roll about z). */
export function mat(x, y, z, yaw = 0, sx = 1, sy = sx, sz = sx, tiltX = 0, tiltZ = 0) {
    _q.setFromEuler(_e.set(tiltX, yaw, tiltZ, 'YXZ'));
    return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

// ------------------------------------------------------------------ the flicker, in JS and GLSL

const f32 = Math.fround;
const fract = (x) => x - Math.floor(x);
/** The same hash as the shader's h11, in float32 steps so the two mostly agree. */
export function h11(p) {
    p = f32(fract(f32(f32(p) * f32(0.1031))));
    p = f32(p * f32(p + f32(33.33)));
    p = f32(p * f32(p + p));
    return fract(p);
}
/** A dying light: mostly on, now and then a burst of stutter, now and then dark. 0..1. */
export function flick(t, s) {
    const slow = h11(Math.floor(t * 1.1) + s * 173);
    const fast = h11(Math.floor(t * 14) + s * 911);
    return slow < 0.4 ? (fast >= 0.5 ? 1 : 0.05) : slow < 0.5 ? 0.0 : 0.88 + 0.12 * fast;
}

export const GLSL_HASH = /* glsl */ `
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float flick(float t, float s) {
    float slow = h11(floor(t * 1.1) + s * 173.0);
    float fast = h11(floor(t * 14.0) + s * 911.0);
    return slow < 0.4 ? (fast >= 0.5 ? 1.0 : 0.05) : (slow < 0.5 ? 0.0 : 0.88 + 0.12 * fast);
}
float vn(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { return vn(p) * 0.5 + vn(p * 2.07 + 5.3) * 0.3 + vn(p * 4.3 - 2.1) * 0.2; }
`;

// ------------------------------------------------------------------ the accumulator

// a unit box with its six faces in BoxGeometry's order (+x, -x, +y, -y, +z, -z)
const UNIT = new THREE.BoxGeometry(1, 1, 1);
const FACE_OF = new Uint8Array(24);
for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) FACE_OF[f * 4 + k] = f;

export class Acc {
    constructor() {
        this.pos = [];
        this.nor = [];
        this.col = [];
        this.fac = [];
        this.a = [];
        this.b = [];
        this.idx = [];
        this.n = 0;
    }

    get empty() {
        return this.n === 0;
    }

    /**
     * @param {THREE.BufferGeometry} geo  position + normal (+ color unless o.color / o.colorFn)
     * @param {THREE.Matrix4} m
     * @param {object} o  color | colorFn(local, normal, world, face) | tint; win, seed, glow, flick,
     *                    inside (0..1, or fn(face) for boxes), sway (metres at the top) with swayH,
     *                    fac(i) => [u, v, W, H] (boxes fill it in)
     */
    add(geo, m, o = {}) {
        const p = geo.attributes.position, nr = geo.attributes.normal, gc = geo.attributes.color;
        const nm = _nm.getNormalMatrix(m);
        const base = this.n;
        const sway = o.sway || 0, H = o.swayH || 1;
        const win = o.win || 0, seed = o.seed ?? 0.5, glow = o.glow || 0, fl = o.flick || 0;
        const inside = o.inside || 0;
        const insideFn = typeof inside === 'function';
        for (let i = 0; i < p.count; i++) {
            _v.fromBufferAttribute(p, i);
            _n.fromBufferAttribute(nr, i);
            const face = o.faces ? o.faces[i] : -1;
            _w.copy(_v).applyMatrix4(m);
            let c;
            if (o.colorFn) c = o.colorFn(_v, _n, _w, face);
            else if (o.color) c = o.color;
            else {
                c = _c.fromBufferAttribute(gc, i);
                if (o.tint) c.multiply(o.tint);
            }
            const ly = _v.y;
            _n.applyMatrix3(nm).normalize();
            this.pos.push(_w.x, _w.y, _w.z);
            this.nor.push(_n.x, _n.y, _n.z);
            this.col.push(c.r, c.g, c.b);
            if (o.fac) {
                const f = o.fac(i);
                this.fac.push(f[0], f[1], f[2], f[3]);
            } else this.fac.push(0, 0, 0, 0);
            this.a.push(win, seed, glow, fl);
            this.b.push(insideFn ? inside(face) : inside, sway ? sway * clamp(ly / H, 0, 1) ** 1.5 : 0);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(base + geo.index.getX(i));
        else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
        this.n += p.count;
    }

    /**
     * A box w x h x d sitting on y = 0 of the transform `m` (so its base is at m's origin).
     * o.win gives it windows on its sides; o.inside may be fn(face) (0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z).
     */
    box(w, h, d, m, o = {}) {
        const mm = m.clone().multiply(_bm.compose(_p.set(0, h / 2, 0), _q.identity(), _s.set(w, h, d)));
        const uv = UNIT.attributes.uv;
        const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
        this.add(UNIT, mm, {
            ...o, faces: FACE_OF,
            fac: (i) => {
                const [W, Hh] = dims[FACE_OF[i]];
                return [uv.getX(i) * W, uv.getY(i) * Hh, W, Hh];
            },
        });
    }

    build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        g.setAttribute('aFac', new THREE.Float32BufferAttribute(this.fac, 4));
        g.setAttribute('aA', new THREE.Float32BufferAttribute(this.a, 4));
        g.setAttribute('aB', new THREE.Float32BufferAttribute(this.b, 2));
        g.setIndex(this.n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
        g.computeBoundingSphere();
        return g;
    }
}
const _bm = new THREE.Matrix4();

// ------------------------------------------------------------------ shapes

const ROCKS = [];
/** One of a few shared rock shapes. */
export function rock(k) {
    if (!ROCKS.length) for (let i = 0; i < 6; i++) {
        const g = new THREE.IcosahedronGeometry(1, 0);
        const p = g.attributes.position;
        for (let j = 0; j < p.count; j++) {
            _v.fromBufferAttribute(p, j);
            const s = 1 + fbm2(_v.x * 1.3 + i * 7, _v.z * 1.3 + _v.y * 1.1 - i * 3, 2) * 0.5;
            p.setXYZ(j, _v.x * s, _v.y * s * 0.65, _v.z * s);
        }
        g.computeVertexNormals();
        ROCKS.push(g);
    }
    return ROCKS[Math.abs(Math.floor(k)) % ROCKS.length];
}

const CYL = new Map();
/** A shared cylinder (radius 1, height 1, base at y = 0). */
export function cyl(segs = 8, open = false) {
    const key = segs + (open ? 'o' : '');
    if (!CYL.has(key)) CYL.set(key, new THREE.CylinderGeometry(1, 1, 1, segs, 1, open).translate(0, 0.5, 0));
    return CYL.get(key);
}
const CONE = new Map();
export function cone(segs = 8) {
    if (!CONE.has(segs)) CONE.set(segs, new THREE.ConeGeometry(1, 1, segs).translate(0, 0.5, 0));
    return CONE.get(segs);
}
const SPH = new Map();
export function sphere(w = 10, h = 7) {
    const key = w * 100 + h;
    if (!SPH.has(key)) SPH.set(key, new THREE.SphereGeometry(1, w, h));
    return SPH.get(key);
}
const QUAD = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);   // flat, facing up
export const quad = () => QUAD;
const VQUAD = new THREE.PlaneGeometry(1, 1);                         // upright, facing +z
export const vquad = () => VQUAD;
const TRI = (() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.1, 1, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    return g;
})();
/** A thin upright triangle (a shard of glass, a tuft): base 1 along x, 1 tall. */
export const tri = () => TRI;

/** A gable roof: a triangular prism, `w` along x, `d` deep, `h` high at the ridge, base on y = 0. */
const PRISMS = new Map();
export function prism() {
    if (!PRISMS.has(1)) {
        const s = new THREE.Shape();
        s.moveTo(-0.5, 0);
        s.lineTo(0.5, 0);
        s.lineTo(0, 1);
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
        g.translate(0, 0, -0.5);
        g.rotateY(Math.PI / 2);   // ridge along x
        g.deleteAttribute('uv');
        PRISMS.set(1, g);
    }
    return PRISMS.get(1);
}

const GEARS = [];
/** A gear lying in the xz plane (radius about 1 to the teeth, 0.25 thick), centred on the origin. */
export function gearGeo(k = 0) {
    if (!GEARS.length) {
        for (const [teeth, hole] of [[12, 0.2], [18, 0.16], [24, 0.14], [9, 0.22]]) {
            const g = new THREE.ExtrudeGeometry(gearShape(0.86, teeth, 0.14, hole), { depth: 0.22, bevelEnabled: false, curveSegments: 3 });
            g.translate(0, 0, -0.11);
            g.rotateX(-Math.PI / 2);
            g.deleteAttribute('uv');
            GEARS.push(g);
        }
    }
    return GEARS[Math.abs(k) % GEARS.length];
}

/** A tube along points (a cable, a pipe). */
export function tube(pts, r, segs = 8, radial = 5) {
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, r, radial, false);
    g.deleteAttribute('uv');
    return g;
}

/** A cable sagging between two points. */
export function sag(a, b, droop, n = 8) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        pts.push(new V3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * droop, a.z + (b.z - a.z) * t));
    }
    return pts;
}

// ------------------------------------------------------------------ colours

const RUST_A = C('#7a3d1a'), RUST_B = C('#4a2412'), RUST_C = C('#a8622a'), _t = new THREE.Color(), _u = new THREE.Color();

/** Paint gone to rust: `base` showing through in patches, by `rust` (0..1). */
export function rusty(base, rust = 0.55, scale = 1.2) {
    const b = C(base);
    return (v, n, w) => {
        const k = fbm2(w.x * scale + w.y * 0.7, w.z * scale - w.y * 0.5, 3);
        const k2 = noise2(w.x * 4.1 + w.y * 3.3, w.z * 4.1);
        _t.copy(RUST_A).lerp(RUST_B, clamp(0.5 + k2, 0, 1));
        if (k2 > 0.55) _t.lerp(RUST_C, 0.5);
        const r = clamp((rust - 0.5) * 3 + k * 2.2 + 0.5, 0, 1);
        _u.copy(b).multiplyScalar(0.85 + k2 * 0.15).lerp(_t, r);
        // streaks running down
        _u.multiplyScalar(0.82 + 0.18 * noise2(w.x * 0.6 + w.z * 0.6, w.y * 0.15));
        return _u;
    };
}

/** A colour with grime: darker low down and in blotches. */
export function grimy(base, amount = 0.3) {
    const b = C(base);
    return (v, n, w) => {
        const k = fbm2(w.x * 0.4 + w.z * 0.3, w.y * 0.6 + w.z * 0.2, 2);
        return _u.copy(b).multiplyScalar(clamp(1 - amount * (0.5 + k) - (w.y < 1 ? (1 - w.y) * 0.25 : 0), 0.25, 1.1));
    };
}

/** Pick a colour from a palette and vary it a little. */
export function vary(hex, r, amt = 0.12) {
    const c = C(hex);
    const k = 1 + (r() - 0.5) * 2 * amt;
    return c.multiplyScalar(k);
}

// ------------------------------------------------------------------ the material

/**
 * One material for everything in the city that isn't the ground.
 * `u` holds shared uniforms: { uTime, uWind, uNight, uInDim, uSky }.
 */
export function cityMaterial(u, opts = {}) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.05, side: opts.side ?? THREE.FrontSide });
    m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, { uTime: u.uTime, uWind: u.uWind, uNight: u.uNight, uInDim: u.uInDim, uSky: u.uSky });
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', `#include <common>
attribute vec4 aFac; attribute vec4 aA; attribute vec2 aB;
uniform float uTime; uniform float uWind;
varying vec4 vFac; varying vec4 vA; varying float vIn; varying vec3 vWP; varying vec3 vWN;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
if (aB.y > 0.0) {
    float ph = uTime * 1.7 + position.x * 0.45 + position.z * 0.33;
    float gust = 0.6 + 0.4 * sin(uTime * 0.31 + position.x * 0.03);
    transformed.x += (sin(ph) + 0.4 * sin(ph * 2.7)) * aB.y * uWind * gust;
    transformed.z += cos(ph * 0.83 + 1.1) * aB.y * uWind * gust * 0.7;
}
vFac = aFac; vA = aA; vIn = aB.x;
vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWN = normalize(mat3(modelMatrix) * objectNormal);`);
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uNight; uniform float uInDim; uniform vec3 uSky;
varying vec4 vFac; varying vec4 vA; varying float vIn; varying vec3 vWP; varying vec3 vWN;
${GLSL_HASH}`)
            .replace('#include <color_fragment>', `#include <color_fragment>
vec3 winGlow = vec3(0.0);
float winRough = -1.0;
{
    // grime: blotches and streaks running down every outside wall
    float gr = fbm(vec2(vWP.x * 0.35 + vWP.z * 0.35, vWP.y * 0.12));
    float st = vn(vec2((vWP.x + vWP.z) * 2.3, vWP.y * 0.08));
    diffuseColor.rgb *= mix(1.0, 0.72 + 0.28 * gr - 0.12 * st * step(0.3, abs(vWN.y - 1.0)), 1.0 - vIn * 0.5);
}
if (vA.x > 0.5 && vA.x < 4.5 && abs(vWN.y) < 0.4 && vIn < 0.5) {
    float style = vA.x;
    float W = vFac.z, H = vFac.w;
    float bayT = style < 1.5 ? 2.3 : style < 2.5 ? 3.1 : style < 3.5 ? 3.4 : 4.0;
    float fh = style < 1.5 ? 3.5 : style < 3.5 ? 3.1 : 4.0;
    float n = max(1.0, floor(W / bayT + 0.5));
    float bw = W / n;
    vec2 cell = vec2(floor(vFac.x / bw), floor(vFac.y / fh));
    vec2 f = vec2(fract(vFac.x / bw), fract(vFac.y / fh));
    vec4 rect = style < 1.5 ? vec4(0.06, 0.94, 0.14, 0.9) : style < 2.5 ? vec4(0.24, 0.76, 0.24, 0.8) : style < 3.5 ? vec4(0.28, 0.72, 0.3, 0.78) : vec4(0.08, 0.92, 0.12, 0.8);
    float rows = floor((H - 0.4) / fh);
    float okRow = step(cell.y + 0.5, rows);
    vec2 cid = cell + vec2(vA.y * 517.0, vA.y * 131.0) + floor(vWN.xz * 3.0) * 71.0;
    float h = h21(cid);
    float inWin = okRow * step(rect.x, f.x) * step(f.x, rect.y) * step(rect.z, f.y) * step(f.y, rect.w);
    // stains running down from each sill
    float under = okRow * step(rect.x + 0.05, f.x) * step(f.x, rect.y - 0.05) * step(f.y, rect.z) * (1.0 - f.y / rect.z);
    diffuseColor.rgb *= 1.0 - under * 0.35 * vn(vec2(f.x * 9.0 + cid.x, cid.y));
    if (inWin > 0.5) {
        vec2 q = (f - rect.xz) / (rect.yw - rect.xz);   // 0..1 across the pane
        float edge = min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y));
        float frame = 1.0 - step(0.06, edge);
        vec3 glass = mix(vec3(0.05, 0.065, 0.075), uSky * 0.45, 0.25 + 0.5 * q.y) * (0.7 + 0.3 * vn(q * 3.0 + cid));
        vec3 dark = vec3(0.012, 0.011, 0.01);
        vec3 c = glass;
        winRough = 0.25;
        if (h < 0.34) {
            // smashed: a hole with jagged teeth of glass left round the frame
            float ang = atan(q.y - 0.5, q.x - 0.5 + 1e-4);   // atan(0, 0) is undefined
            float teeth = 0.07 + 0.16 * abs(sin(ang * (5.0 + floor(h * 30.0)) + h * 40.0)) * (0.5 + vn(vec2(ang * 3.0, h * 9.0)));
            c = edge < teeth ? glass * 1.1 : dark;
            winRough = edge < teeth ? 0.3 : 1.0;
        } else if (h < 0.44) {
            // boarded over
            float plank = step(0.12, fract(q.y * 3.0 + 0.1 * sin(q.x * 3.0 + h * 9.0)));
            c = mix(vec3(0.05, 0.035, 0.02), vec3(0.32, 0.22, 0.13) * (0.7 + 0.3 * vn(q * vec2(2.0, 12.0) + cid)), plank);
            winRough = 1.0;
        } else if (h < 0.52) {
            // a rag of curtain behind cracked glass
            float hang = step(q.x, 0.45 + 0.25 * sin(q.y * 7.0 + h * 20.0));
            c = mix(glass, vec3(0.3, 0.22, 0.2) * (0.6 + 0.4 * h21(cid * 1.7)), hang * 0.8);
        } else if (h < 0.555) {
            // still lit, and flickering
            float fk = flick(uTime, fract(h * 37.0));
            vec3 lc = h21(cid + 3.0) < 0.5 ? vec3(1.0, 0.62, 0.3) : vec3(0.6, 0.85, 0.75);
            c = lc * 0.2;
            winGlow = lc * fk * (0.35 + uNight * 1.6) * (0.6 + 0.4 * q.y);
        } else if (h < 0.62) {
            c = dark;
            winRough = 1.0;
        }
        // cracks across what glass is left
        float cr = (1.0 - smoothstep(0.0, 0.03, abs(vn(q * 5.0 + cid * 3.1) - 0.5))) * step(0.5, h21(cid * 2.3));
        c = mix(c, vec3(0.5), cr * 0.25 * step(winRough, 0.5));
        c = mix(c, diffuseColor.rgb * 0.45, frame);
        diffuseColor.rgb = c;
    }
} else if (vA.x > 4.5 && vA.x < 8.5 && vWN.y > 0.5) {
    // floors indoors: 5 tiles, 6 boards, 7 carpet, 8 bare concrete, all water-stained
    vec2 p = vWP.xz;
    float st = vA.x;
    vec3 base = diffuseColor.rgb;
    if (st < 5.5) {
        vec2 t = floor(p / 0.5);
        float chk = mod(t.x + t.y, 2.0);
        vec2 tf = fract(p / 0.5);
        float gap = step(min(min(tf.x, 1.0 - tf.x), min(tf.y, 1.0 - tf.y)), 0.03);
        base = mix(vec3(0.62, 0.6, 0.55), vec3(0.16, 0.16, 0.16), chk) * (0.85 + 0.15 * h21(t)) * (1.0 - gap * 0.5);
        base *= 1.0 - step(0.93, h21(t + 7.0)) * 0.6;   // a tile gone
    } else if (st < 6.5) {
        float row = floor(p.y / 0.18);
        float plank = floor((p.x + h21(vec2(row, 3.0)) * 3.0) / 1.6);
        float seam = step(fract(p.y / 0.18), 0.06) + step(fract((p.x + h21(vec2(row, 3.0)) * 3.0) / 1.6), 0.015);
        base *= (0.75 + 0.35 * h21(vec2(row, plank))) * (1.0 - clamp(seam, 0.0, 1.0) * 0.45) * (0.85 + 0.15 * vn(vec2(p.x * 6.0, row)));
        base *= 1.0 - step(0.95, h21(vec2(row, plank) + 3.0)) * 0.85;   // a board missing
    } else if (st < 7.5) {
        base *= 0.75 + 0.3 * vn(p * 3.0) + 0.1 * vn(p * 17.0);
    } else {
        base *= 0.8 + 0.25 * vn(p * 0.8) + 0.08 * vn(p * 9.0);
        base *= 1.0 - (1.0 - smoothstep(0.0, 0.015, abs(fbm(p * 0.6) - 0.5))) * 0.5;
    }
    float stain = smoothstep(0.55, 0.75, fbm(p * 0.35 + vA.y * 10.0));
    base = mix(base, base * vec3(0.55, 0.5, 0.42), stain * 0.7);
    diffuseColor.rgb = base;
} else if (vA.x > 8.5 && vIn > 0.5 && abs(vWN.y) < 0.4) {
    // walls indoors: paint or paper peeling off the plaster, a dado rail, water stains from above
    float u = vFac.x, v = vFac.y;
    vec3 base = diffuseColor.rgb;
    float paper = step(0.5, fract(vA.y * 7.0));
    base *= mix(1.0, 0.9 + 0.1 * step(0.5, fract(u * 3.0)), paper);
    if (v < 1.0) base *= 0.72;
    if (abs(v - 1.0) < 0.04) base *= 0.6;
    float peel = smoothstep(0.58, 0.62, fbm(vec2(u * 0.9, v * 0.9) + vWP.xz * 0.05 + vA.y * 30.0));
    vec3 plaster = mix(vec3(0.5, 0.47, 0.42), vec3(0.42, 0.24, 0.17), step(0.72, fbm(vec2(u * 3.0, v * 6.0))));
    base = mix(base, plaster * 0.75, peel * 0.65);
    float wet = (1.0 - smoothstep(0.0, 0.3, (vFac.w - v) / max(vFac.w, 1.0) - fbm(vec2(u * 0.7, 3.0)) * 0.6));
    base *= 1.0 - wet * 0.45;
    base *= 1.0 - (1.0 - smoothstep(0.0, 0.6, v)) * 0.35;
    diffuseColor.rgb = base;
}`)
            .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
if (winRough >= 0.0) roughnessFactor = winRough;`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float fl = vA.w > 0.0 ? flick(uTime, vA.w) : 1.0;
totalEmissiveRadiance += vColor.rgb * vA.z * fl + winGlow;`)
            .replace('#include <aomap_fragment>', `#include <aomap_fragment>
float dimF = mix(1.0, uInDim, vIn);
reflectedLight.directDiffuse *= dimF;
reflectedLight.indirectDiffuse *= dimF;
reflectedLight.directSpecular *= dimF;
reflectedLight.indirectSpecular *= dimF;`)
            .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n// a NaN or Inf here would be smeared by the bloom pass into a black block over the view\nif (any(isnan(gl_FragColor)) || any(isinf(gl_FragColor))) gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);`);
    };
    m.customProgramCacheKey = () => 'gearfall-city' + (opts.side ?? 0);
    return m;
}
