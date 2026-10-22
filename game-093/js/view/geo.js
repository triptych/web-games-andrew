// A merge-everything geometry builder: parts are added with a colour, a tile of the atlas and a transform, then baked into one
// BufferGeometry with vertex colours. Props, houses and trees are all built from it, so a whole chunk is one draw call.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tileUV, TEX } from './texatlas.js';
import { hash3 } from '../rng.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

export class Geo {
    constructor() { this.parts = []; this.n = 0; }

    /** Bake a geometry: transform, colour, and a UV that lands inside one atlas tile. */
    add(geometry, o = {}) {
        let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        _p.set(o.x || 0, o.y || 0, o.z || 0);
        _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ'); _q.setFromEuler(_e);
        _s.set(o.sx ?? o.s ?? 1, o.sy ?? o.s ?? 1, o.sz ?? o.s ?? 1);
        _m.compose(_p, _q, _s);
        g.applyMatrix4(_m);
        g.deleteAttribute('uv');
        const pos = g.attributes.position, n = pos.count;
        const uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
        const r = tileUV(o.tile ?? TEX.trim);
        _c.set(o.color ?? 0xffffff);
        const jit = o.jitter || 0;
        for (let i = 0; i < n; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            // projected uv: pick the dominant axis per triangle later; a cheap blend of world position keeps it pixel-ish
            const a = (x + z) * (o.rep ?? 1.5), b = y * (o.rep ?? 1.5) + (x - z) * 0.3;
            uv[i * 2] = r.u0 + (a - Math.floor(a)) * (r.u1 - r.u0);
            uv[i * 2 + 1] = r.v0 + (b - Math.floor(b)) * (r.v1 - r.v0);
            const v = 1 + (jit ? (hash3(Math.round(x * 20), Math.round(y * 20), Math.round(z * 20)) - 0.5) * jit : 0);
            col[i * 3] = _c.r * v; col[i * 3 + 1] = _c.g * v; col[i * 3 + 2] = _c.b * v;
        }
        g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.deleteAttribute('normal');
        g.computeVertexNormals();
        this.parts.push(g); this.n += n;
        return this;
    }

    /** A box with a tile repeated across each face (the atlas has no wrapping, so large faces are cut into unit cells). */
    box(w, h, d, o = {}) {
        const tile = o.tile ?? TEX.plaster, r = tileUV(tile);
        const { x = 0, y = 0, z = 0 } = o;
        const col = new THREE.Color(o.color ?? 0xffffff);
        const faces = [
            // [origin, axisU, axisV, normal]
            [[-w / 2, 0, d / 2], [w, 0, 0], [0, h, 0], [0, 0, 1], w, h],
            [[w / 2, 0, -d / 2], [-w, 0, 0], [0, h, 0], [0, 0, -1], w, h],
            [[w / 2, 0, d / 2], [0, 0, -d], [0, h, 0], [1, 0, 0], d, h],
            [[-w / 2, 0, -d / 2], [0, 0, d], [0, h, 0], [-1, 0, 0], d, h],
        ];
        if (!o.noTop) faces.push([[-w / 2, h, d / 2], [w, 0, 0], [0, 0, -d], [0, 1, 0], w, d]);
        const pos = [], uvs = [], cols = [], nor = [];
        const shadeF = { '0,0,1': 1, '0,0,-1': 0.78, '1,0,0': 0.9, '-1,0,0': 0.84, '0,1,0': 1.05 };
        for (const [org, au, av, nrm, fu, fv] of faces) {
            const nu = Math.max(1, Math.round(fu * (o.rep ?? 1))), nv = Math.max(1, Math.round(fv * (o.rep ?? 1)));
            const sh = shadeF[nrm.join(',')] ?? 1;
            for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
                const c00 = [org[0] + au[0] * i / nu + av[0] * j / nv, org[1] + au[1] * i / nu + av[1] * j / nv, org[2] + au[2] * i / nu + av[2] * j / nv];
                const c10 = [c00[0] + au[0] / nu, c00[1] + au[1] / nu, c00[2] + au[2] / nu];
                const c01 = [c00[0] + av[0] / nv, c00[1] + av[1] / nv, c00[2] + av[2] / nv];
                const c11 = [c10[0] + av[0] / nv, c10[1] + av[1] / nv, c10[2] + av[2] / nv];
                for (const [p, u, v] of [[c00, r.u0, r.v0], [c10, r.u1, r.v0], [c11, r.u1, r.v1], [c00, r.u0, r.v0], [c11, r.u1, r.v1], [c01, r.u0, r.v1]]) {
                    pos.push(p[0] + x, p[1] + y, p[2] + z); uvs.push(u, v); cols.push(col.r * sh, col.g * sh, col.b * sh); nor.push(...nrm);
                }
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        if (o.ry) g.rotateY(o.ry);
        this.parts.push(g); this.n += pos.length / 3;
        return this;
    }

    /** A flat quad grid between four corners, textured with a tile (roof slopes). */
    slope(p0, p1, p2, p3, o = {}) {
        // p0-p1 along u, p0-p3 along v
        const r = tileUV(o.tile ?? TEX.roof), col = new THREE.Color(o.color ?? 0xffffff);
        const nu = o.nu || 4, nv = o.nv || 3;
        const pos = [], uvs = [], cols = [];
        const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        const P = (i, j) => lerp(lerp(p0, p1, i / nu), lerp(p3, p2, i / nu), j / nv);
        for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
            const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
            for (const [p, u, v] of [[a, r.u0, r.v0], [b, r.u1, r.v0], [c, r.u1, r.v1], [a, r.u0, r.v0], [c, r.u1, r.v1], [d, r.u0, r.v1]]) { pos.push(p[0], p[1], p[2]); uvs.push(u, v); cols.push(col.r, col.g, col.b); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
        g.computeVertexNormals();
        this.parts.push(g); this.n += pos.length / 3;
        return this;
    }

    tri(a, b, c, o = {}) {
        const g = new THREE.BufferGeometry(), r = tileUV(o.tile ?? TEX.plaster), col = new THREE.Color(o.color ?? 0xffffff);
        g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute([r.u0, r.v0, r.u1, r.v0, (r.u0 + r.u1) / 2, r.v1], 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute([col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b], 3));
        g.computeVertexNormals();
        this.parts.push(g); this.n += 3;
        return this;
    }

    build() {
        if (!this.parts.length) return null;
        const g = mergeGeometries(this.parts, false);
        for (const p of this.parts) p.dispose();
        this.parts = [];
        return g;
    }
}

// shared unit geometries
export const G = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl6: new THREE.CylinderGeometry(1, 1, 1, 6, 1),
    cyl8: new THREE.CylinderGeometry(1, 1, 1, 8, 1),
    cone6: new THREE.ConeGeometry(1, 1, 6, 1),
    cone8: new THREE.ConeGeometry(1, 1, 8, 1),
    ico1: new THREE.IcosahedronGeometry(1, 1),
    ico0: new THREE.IcosahedronGeometry(1, 0),
    oct: new THREE.OctahedronGeometry(1, 0),
    dod: new THREE.DodecahedronGeometry(1, 0),
    plane: new THREE.PlaneGeometry(1, 1),
};

/** A box whose y runs from its base up (so positions read as "sits on the ground"). */
export function cyl(g, o) { return g.add(G.cyl8, { ...o, sx: o.r, sz: o.r, sy: o.h, y: (o.y || 0) + o.h / 2 }); }
export function cone(g, o) { return g.add(G.cone8, { ...o, sx: o.r, sz: o.r, sy: o.h, y: (o.y || 0) + o.h / 2 }); }
export function blob(g, o) { return g.add(G.ico1, { ...o, sx: o.ax ?? o.r, sy: o.ay ?? o.r, sz: o.az ?? o.r, jitter: o.jitter ?? 0.12 }); }
