// Geometry builders. Each chunk of city is a handful of merged meshes (one per
// material) built with these, so a whole block of buildings is one draw call.
//
// Coordinates passed in are chunk-local (relative to the chunk origin), which
// keeps float32 precision fine however far you drive.

import * as THREE from 'three';

const L = (() => { const x = 0.45, z = 0.6, l = Math.hypot(x, z); return [x / l, z / l]; })();
const CELLS = 32;              // window texture is 32×32 cells
export const ROOF_UV = [0.5, 0.5 / CELLS];

export class Geo {
    constructor(withUV = false) {
        this.withUV = withUV;
        this.pos = [];
        this.col = [];
        this.uv = withUV ? [] : null;
    }

    get empty() { return this.pos.length === 0; }

    /**
     * Quad p0..p3 (each [x,y,z]) in order around the face. If `n` is given the
     * winding is flipped as needed so the face points along n — never trust
     * winding by eye.
     */
    quad(p0, p1, p2, p3, color, uvs = null, n = null) {
        if (n) {
            const e1x = p1[0] - p0[0], e1y = p1[1] - p0[1], e1z = p1[2] - p0[2];
            const e2x = p2[0] - p0[0], e2y = p2[1] - p0[1], e2z = p2[2] - p0[2];
            const cx = e1y * e2z - e1z * e2y, cy = e1z * e2x - e1x * e2z, cz = e1x * e2y - e1y * e2x;
            if (cx * n[0] + cy * n[1] + cz * n[2] < 0) {
                [p1, p3] = [p3, p1];
                if (uvs) uvs = [uvs[0], uvs[3], uvs[2], uvs[1]];
            }
        }
        const P = [p0, p1, p2, p0, p2, p3];
        const U = uvs ? [uvs[0], uvs[1], uvs[2], uvs[0], uvs[2], uvs[3]] : null;
        const multi = Array.isArray(color[0]);
        const C = multi ? [color[0], color[1], color[2], color[0], color[2], color[3]] : null;
        for (let i = 0; i < 6; i++) {
            const p = P[i];
            this.pos.push(p[0], p[1], p[2]);
            const c = multi ? C[i] : color;
            this.col.push(c[0], c[1], c[2]);
            if (this.uv) {
                const u = U ? U[i] : ROOF_UV;
                this.uv.push(u[0], u[1]);
            }
        }
    }

    /**
     * Oriented box standing on y0. (ax, az) is the unit "width" axis; the
     * depth axis is its perpendicular. `win` maps window cells onto the faces:
     * { cw, ch, ou, ov } cell width/height in metres and cell offsets.
     */
    box(cx, cz, y0, y1, ax, az, hw, hd, color, win = null, opts = {}) {
        const bx = -az, bz = ax;
        const faces = [
            [ax, az, hw, hd], [-ax, -az, hw, hd],
            [bx, bz, hd, hw], [-bx, -bz, hd, hw],
        ];
        const shadeSide = opts.flat ? null : true;
        for (let f = 0; f < 4; f++) {
            if (opts.skip && opts.skip[f]) continue;
            const [nx, nz, hn, hwid] = faces[f];
            const fx = cx + nx * hn, fz = cz + nz * hn;
            const rx = nz, rz = -nx;
            const p0 = [fx - rx * hwid, y0, fz - rz * hwid];
            const p1 = [fx + rx * hwid, y0, fz + rz * hwid];
            const p2 = [p1[0], y1, p1[2]];
            const p3 = [p0[0], y1, p0[2]];
            const k = shadeSide ? 0.74 + 0.26 * (nx * L[0] + nz * L[1]) : 1;
            const c = [color[0] * k, color[1] * k, color[2] * k];
            let uvs = null;
            if (this.uv && win) {
                const sx = 1 / (win.cw * CELLS), sy = 1 / (win.ch * CELLS);
                const ou = Math.round((win.ou + f * 7.37) * CELLS) / CELLS;
                const v0 = y0 * sy + win.ov, v1 = y1 * sy + win.ov;
                const u1 = ou + hwid * 2 * sx;
                uvs = [[ou, v0], [u1, v0], [u1, v1], [ou, v1]];
            }
            this.quad(p0, p1, p2, p3, c, uvs, [nx, 0, nz]);
        }
        if (opts.top !== false) {
            const k = opts.flat ? 1 : 0.42;
            const c = [color[0] * k, color[1] * k, color[2] * k];
            const p = [
                [cx - ax * hw - bx * hd, y1, cz - az * hw - bz * hd],
                [cx + ax * hw - bx * hd, y1, cz + az * hw - bz * hd],
                [cx + ax * hw + bx * hd, y1, cz + az * hw + bz * hd],
                [cx - ax * hw + bx * hd, y1, cz - az * hw + bz * hd],
            ];
            this.quad(p[0], p[1], p[2], p[3], opts.topColor || c, null, [0, 1, 0]);
        }
        if (opts.bottom) {
            const c = [color[0] * 0.3, color[1] * 0.3, color[2] * 0.3];
            const p = [
                [cx - ax * hw - bx * hd, y0, cz - az * hw - bz * hd],
                [cx + ax * hw - bx * hd, y0, cz + az * hw - bz * hd],
                [cx + ax * hw + bx * hd, y0, cz + az * hw + bz * hd],
                [cx - ax * hw + bx * hd, y0, cz - az * hw + bz * hd],
            ];
            this.quad(p[0], p[1], p[2], p[3], c, null, [0, -1, 0]);
        }
    }

    /**
     * Arbitrary convex six-sided solid: b = bottom ring, t = top ring, each four
     * [x,y,z] corners in the same order around. Faces are oriented away from
     * the centroid and shaded by their normal.
     */
    hexa(b, t, color, opts = {}) {
        const all = [...b, ...t];
        const c = [0, 1, 2].map((k) => all.reduce((a, p) => a + p[k], 0) / 8);
        const face = (p0, p1, p2, p3, override) => {
            const fc = [0, 1, 2].map((k) => (p0[k] + p1[k] + p2[k] + p3[k]) / 4);
            const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
            const e2 = [p3[0] - p0[0], p3[1] - p0[1], p3[2] - p0[2]];
            let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
            if (n[0] * (fc[0] - c[0]) + n[1] * (fc[1] - c[1]) + n[2] * (fc[2] - c[2]) < 0) n = n.map((v) => -v);
            const l = Math.hypot(n[0], n[1], n[2]) || 1;
            n = n.map((v) => v / l);
            const k = opts.flat ? 1 : n[1] > 0.5 ? 0.62 + 0.38 * n[1] : n[1] < -0.5 ? 0.3 : 0.62 + 0.28 * (n[0] * L[0] + n[2] * L[1]);
            const col = override || [color[0] * k, color[1] * k, color[2] * k];
            this.quad(p0, p1, p2, p3, col, null, n);
        };
        face(b[0], b[1], b[2], b[3]);
        face(t[0], t[1], t[2], t[3], opts.topColor);
        for (let i = 0; i < 4; i++) {
            const j = (i + 1) % 4;
            face(b[i], b[j], t[j], t[i], opts.sideColors ? opts.sideColors[i] : null);
        }
    }

    build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        if (this.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.computeBoundingSphere();
        return g;
    }
}

/** Glow points: position, colour, world size and a blink pattern. */
export class PointGeo {
    constructor() {
        this.pos = []; this.col = []; this.size = []; this.blink = [];
    }
    get empty() { return this.pos.length === 0; }
    /** rate 0 = steady; otherwise on while fract(t*rate + phase) < duty. */
    add(x, y, z, c, size, rate = 0, phase = 0, duty = 1) {
        this.pos.push(x, y, z);
        this.col.push(c[0], c[1], c[2]);
        this.size.push(size);
        this.blink.push(rate, phase, duty);
    }
    build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        g.setAttribute('size', new THREE.Float32BufferAttribute(this.size, 1));
        g.setAttribute('blink', new THREE.Float32BufferAttribute(this.blink, 3));
        g.computeBoundingSphere();
        return g;
    }
}

/** Plain coloured line segments (lantern strings, cables). */
export class LineGeo {
    constructor() { this.pos = []; this.col = []; }
    get empty() { return this.pos.length === 0; }
    seg(a, b, c) {
        this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        this.col.push(c[0], c[1], c[2], c[0], c[1], c[2]);
    }
    build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        g.computeBoundingSphere();
        return g;
    }
}

export function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
