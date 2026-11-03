// Small geometry tools for the Springwood (forest-land.js, forest-places.js):
// an accumulator that merges transformed, coloured pieces into one geometry
// with a sway and a glow per vertex, and helpers that make tapered limbs,
// lumpy blobs and curved strips with their colours painted in.

import * as THREE from 'three';
import { fbm2, clamp, TAU } from './util.js';
import { limbGeometry } from './forest-portal.js';

const V3 = THREE.Vector3;
export const C = (h) => new THREE.Color(h);
export { limbGeometry };

const _v = new V3(), _n = new V3(), _w = new V3(), _nm = new THREE.Matrix3(), _c = new THREE.Color();
const _q = new THREE.Quaternion(), _s = new V3(), _p = new V3(), _e = new THREE.Euler();

/** A transform: at (x, y, z), turned by yaw, scaled, and tipped a little. */
export function mat(x, y, z, yaw, sx, sy = sx, sz = sx, tiltX = 0, tiltZ = 0) {
    _q.setFromEuler(_e.set(tiltX, yaw, tiltZ, 'YXZ'));
    return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

/** Colour every vertex of `geo` by fn(localPos, normal) -> Color. Returns geo. */
export function paint(geo, fn) {
    const p = geo.attributes.position, nr = geo.attributes.normal;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
        _v.fromBufferAttribute(p, i);
        _n.fromBufferAttribute(nr, i);
        const c = fn(_v, _n, i);
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
}

/** One flat colour, or a fade from `a` at y0 to `b` at y1. */
export const flat = (c) => () => c;
export function fadeY(a, b, y0, y1) {
    const ca = C(a), cb = C(b), t = new THREE.Color();
    return (v) => t.copy(ca).lerp(cb, clamp((v.y - y0) / (y1 - y0), 0, 1));
}

/** A lumpy ball: an icosahedron pushed about by noise, so it reads as a clump of leaves. */
export function blob(r, detail, seed, amount = 0.22) {
    const g = new THREE.IcosahedronGeometry(r, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        _v.fromBufferAttribute(p, i);
        const k = 1 + fbm2(_v.x * 1.7 / r + seed, _v.z * 1.7 / r + _v.y * 1.3 / r - seed, 2) * amount * 2;
        p.setXYZ(i, _v.x * k, _v.y * k, _v.z * k);
    }
    g.computeVertexNormals();
    return g;
}

/** A strip through `pts` whose width at t (0..1) is width(t), with `side` across it (one face: the material is two-sided). */
export function strip(pts, width, side) {
    const pos = [], nor = [], idx = [];
    const n = pts.length;
    const nrm = new V3(), tan = new V3();
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1), w = width(t) / 2;
        const p = pts[i];
        tan.copy(pts[Math.min(n - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
        nrm.crossVectors(side, tan).normalize();
        if (nrm.y < 0) nrm.negate();
        pos.push(p.x - side.x * w, p.y - side.y * w, p.z - side.z * w, p.x + side.x * w, p.y + side.y * w, p.z + side.z * w);
        nor.push(nrm.x, nrm.y, nrm.z, nrm.x, nrm.y, nrm.z);
        if (i < n - 1) {
            const a = i * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
}

/** A thin upright stalk at (x, z), h tall: one triangle (the material is two-sided). */
export function stalk(x, z, h, w = 0.012, lean = 0) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([x - w, 0, z, x + w, 0, z, x + lean, h, z], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0.3, 1, 0, 0.3, 1, 0, 0.3, 1], 3));
    return g;
}

/** A leaf or stalk arching out from the origin along `dir` (unit, horizontal), `len` long, rising `up`. */
export function arc(dir, len, up, droop = 0.6, n = 6) {
    const pts = [];
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        pts.push(new V3(dir.x * t * len, Math.sin(t * Math.PI * droop) * up, dir.z * t * len));
    }
    return pts;
}

/** A rock: an icosahedron pushed about by noise. */
export function rockGeo(seed, detail = 1) {
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

const STONE = C('#8a8a80'), STONE_DARK = C('#5e5e58'), MOSS = C('#6f9a3c'), MOSS_HI = C('#9cc458');
/** Grey stone with moss on whatever faces the sky. */
export function mossyStone(seed, moss = 1) {
    const t = new THREE.Color();
    return (v, nn) => {
        const k = fbm2(v.x * 2.1 + seed, v.z * 2.1 + v.y, 2);
        t.copy(STONE).lerp(STONE_DARK, clamp(0.5 - k, 0, 1));
        if (nn.y > 0.25) t.lerp(_c.copy(MOSS).lerp(MOSS_HI, clamp(k + 0.5, 0, 1)), clamp((nn.y - 0.25) * 2.2, 0, 1) * moss * (0.65 + k * 0.5));
        return t;
    };
}

/**
 * Accumulates transformed pieces, each vertex with a colour, a sway (how far the
 * wind moves it) and a glow (how much it lights up after dark), then builds one geometry.
 */
export class Acc {
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
     * @param {THREE.BufferGeometry} geo  position + normal, and a colour attribute unless o.color/o.colorFn
     * @param {THREE.Matrix4} m
     * @param {object} o  color | colorFn(local, normal) | tint (multiplies the geometry's colours);
     *                    sway (metres at the top) with swayH (local height it grows over); glow (number or fn(local))
     */
    add(geo, m, o = {}) {
        const p = geo.attributes.position, nr = geo.attributes.normal, gc = geo.attributes.color;
        const nm = _nm.getNormalMatrix(m);
        const base = this.n;
        const sway = o.sway || 0, glow = o.glow || 0, H = o.swayH || 1, tint = o.tint;
        for (let i = 0; i < p.count; i++) {
            _v.fromBufferAttribute(p, i);
            _n.fromBufferAttribute(nr, i);
            let c;
            if (o.colorFn) c = o.colorFn(_v, _n);
            else if (o.color) c = o.color;
            else {
                c = _c.fromBufferAttribute(gc, i);
                if (tint) c.multiply(tint);
            }
            const ly = _v.y;
            const g = typeof glow === 'function' ? glow(_v) : glow;
            _w.copy(_v).applyMatrix4(m);
            _n.applyMatrix3(nm).normalize();
            this.pos.push(_w.x, _w.y, _w.z);
            this.nor.push(_n.x, _n.y, _n.z);
            this.col.push(c.r, c.g, c.b);
            this.sway.push(sway ? sway * Math.pow(clamp(ly / H, 0, 1), 1.5) : 0);
            this.glow.push(g);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(base + geo.index.getX(i));
        else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
        this.n += p.count;
    }

    /** A prototype: a list of { geo, sway, glow, tint? } parts sharing one transform. */
    addProto(proto, m, o = {}) {
        for (const part of proto.parts) {
            this.add(part.geo, m, { sway: (part.sway || 0) * (o.swayScale ?? 1), swayH: proto.H, glow: part.glow || 0, tint: part.tint === false ? null : o.tint });
        }
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

/** Bake a transform into a copy of a geometry (normals too). */
export function placed(geo, m) {
    return geo.clone().applyMatrix4(m);
}

export { TAU };
