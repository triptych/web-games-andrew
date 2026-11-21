// A small geometry kit: quads, boxes, cylinders and lathes pushed into buckets by material, then merged into one
// mesh per material. Everything the city is made of goes through here, so a whole block or a whole floor of a
// building is a handful of draw calls.

import * as THREE from 'three';

export class Kit {
    constructor() {
        this.buckets = new Map();
        this.T = { x: 0, y: 0, z: 0, c: 1, s: 0 };   // current transform: translate + rotate about Y
    }

    bucket(mat) {
        let b = this.buckets.get(mat);
        if (!b) { b = { mat, pos: [], nrm: [], uv: [], col: [], extra: null }; this.buckets.set(mat, b); }
        return b;
    }

    /** Run fn with a local frame at (x, y, z) turned by ry about Y. */
    at(x, y, z, ry, fn) {
        const old = this.T;
        const c = Math.cos(ry), s = Math.sin(ry);
        // compose: new local → old local → world
        const ox = old.x + (x * old.c + z * old.s), oz = old.z + (-x * old.s + z * old.c);
        this.T = { x: ox, y: old.y + y, z: oz, c: c * old.c - s * old.s, s: s * old.c + c * old.s };
        fn();
        this.T = old;
    }

    _p(p) { const T = this.T; return [T.x + p[0] * T.c + p[2] * T.s, T.y + p[1], T.z - p[0] * T.s + p[2] * T.c]; }
    _n(n) { const T = this.T; return [n[0] * T.c + n[2] * T.s, n[1], -n[0] * T.s + n[2] * T.c]; }

    /** A quad a-b-c-d, counter-clockwise seen from the front. uv: four [u, v]; col: one [r, g, b] or four. */
    quad(mat, a, b, c, d, uv, col = [1, 1, 1], extra = null) {
        const B = this.bucket(mat);
        const P = [this._p(a), this._p(b), this._p(c), this._p(d)];
        // normal from the diagonals, so a quad with two corners at one point (a fan slice) still has one
        const e1 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]];
        const e2 = [P[3][0] - P[1][0], P[3][1] - P[1][1], P[3][2] - P[1][2]];
        let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const l = Math.hypot(n[0], n[1], n[2]) || 1;
        n = [n[0] / l, n[1] / l, n[2] / l];
        const cols = col.length === 4 ? col : [col, col, col, col];
        for (const i of [0, 1, 2, 0, 2, 3]) {
            B.pos.push(P[i][0], P[i][1], P[i][2]);
            B.nrm.push(n[0], n[1], n[2]);
            B.uv.push(uv[i][0], uv[i][1]);
            B.col.push(cols[i][0], cols[i][1], cols[i][2]);
            if (extra) { (B.extra ??= []).push(extra); }
        }
    }

    /** An axis-aligned (in the local frame) box centred at (x, y0 + h/2, z). s = metres per texture repeat. */
    box(mat, x, y0, z, w, h, d, col = [1, 1, 1], s = 1, faces = 63) {
        const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y0 + h;
        const U = (a, b) => [a / s, b / s];
        const top = Array.isArray(col[0]) ? col[0] : col, side = Array.isArray(col[0]) ? col[1] : col;
        if (faces & 1) this.quad(mat, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [U(x0, z1), U(x1, z1), U(x1, z0), U(x0, z0)], top);   // top
        if (faces & 2) this.quad(mat, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [U(x0, z0), U(x1, z0), U(x1, z1), U(x0, z1)], side); // bottom
        if (faces & 4) this.quad(mat, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [U(x0, y0), U(x1, y0), U(x1, y1), U(x0, y1)], side); // +z
        if (faces & 8) this.quad(mat, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [U(x1, y0), U(x0, y0), U(x0, y1), U(x1, y1)], side); // -z
        if (faces & 16) this.quad(mat, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [U(z1, y0), U(z0, y0), U(z0, y1), U(z1, y1)], side); // +x
        if (faces & 32) this.quad(mat, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [U(z0, y0), U(z1, y0), U(z1, y1), U(z0, y1)], side); // -x
    }

    /** A cylinder (or cone, r1 at the top) standing on y0. */
    cyl(mat, x, y0, z, r0, h, seg = 10, col = [1, 1, 1], r1 = r0, caps = true) {
        const y1 = y0 + h;
        for (let i = 0; i < seg; i++) {
            const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
            const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
            this.quad(mat, [x + c1 * r0, y0, z + s1 * r0], [x + c0 * r0, y0, z + s0 * r0], [x + c0 * r1, y1, z + s0 * r1], [x + c1 * r1, y1, z + s1 * r1],
                [[(i + 1) / seg * 2, 0], [i / seg * 2, 0], [i / seg * 2, h / 2], [(i + 1) / seg * 2, h / 2]], col);
            if (caps && r1 > 0.001) this.quad(mat, [x, y1, z], [x, y1, z], [x + c1 * r1, y1, z + s1 * r1], [x + c0 * r1, y1, z + s0 * r1], [[0.5, 0.5], [0.5, 0.5], [0.5 + c1 / 2, 0.5 + s1 / 2], [0.5 + c0 / 2, 0.5 + s0 / 2]], col);
        }
    }

    /** A tube between two points (branches, pipes, rails). */
    tube(mat, a, b, r, seg = 6, col = [1, 1, 1], r2 = r) {
        const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const len = Math.hypot(d[0], d[1], d[2]) || 1e-6;
        const f = [d[0] / len, d[1] / len, d[2] / len];
        const up = Math.abs(f[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
        let u = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
        const ul = Math.hypot(...u); u = u.map((v) => v / ul);
        const v = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
        const ring = (p, rr, a0) => [p[0] + (u[0] * Math.cos(a0) + v[0] * Math.sin(a0)) * rr, p[1] + (u[1] * Math.cos(a0) + v[1] * Math.sin(a0)) * rr, p[2] + (u[2] * Math.cos(a0) + v[2] * Math.sin(a0)) * rr];
        for (let i = 0; i < seg; i++) {
            const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
            this.quad(mat, ring(a, r, a0), ring(a, r, a1), ring(b, r2, a1), ring(b, r2, a0), [[i / seg, 0], [(i + 1) / seg, 0], [(i + 1) / seg, len], [i / seg, len]], col);
        }
    }

    /** A flat quad lying on the floor (papers, puddles, decals): centre, size, angle, height. */
    flat(mat, x, y, z, w, d, r = 0, col = [1, 1, 1], uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const c = Math.cos(r), s = Math.sin(r);
        const P = (u, v) => [x + u * c + v * s, y, z - u * s + v * c];
        this.quad(mat, P(-w / 2, d / 2), P(w / 2, d / 2), P(w / 2, -d / 2), P(-w / 2, -d / 2), uv, col);
    }

    empty() { return this.buckets.size === 0; }

    /** Merge every bucket into a mesh. shadows: cast/receive. Returns a Group (or null if nothing). */
    build({ cast = true, receive = true, name = '' } = {}) {
        if (!this.buckets.size) return null;
        const g = new THREE.Group();
        g.name = name;
        for (const B of this.buckets.values()) {
            if (!B.pos.length) continue;
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
            geo.setAttribute('normal', new THREE.Float32BufferAttribute(B.nrm, 3));
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
            geo.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
            if (B.extra) geo.setAttribute('bid', new THREE.Float32BufferAttribute(B.extra, 1));
            geo.computeBoundingSphere();
            const m = new THREE.Mesh(geo, B.mat);
            const transparent = B.mat.transparent;
            m.castShadow = cast && !transparent && !B.mat.userData?.noShadow;
            m.receiveShadow = receive;
            if (transparent) m.renderOrder = 2;
            g.add(m);
        }
        this.buckets.clear();
        return g;
    }
}

/** Dispose every geometry under a group (materials are shared and kept). */
export function disposeGroup(g) {
    if (!g) return;
    // instanced Meshy vehicles share their model's geometry: free only their instance buffers
    g.traverse((o) => { if (o.isInstancedMesh && o.userData.shared) o.dispose(); else if (o.geometry) o.geometry.dispose(); });
    g.removeFromParent();
}
