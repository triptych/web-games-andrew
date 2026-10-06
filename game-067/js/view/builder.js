/**
 * builder.js — a tiny modelling kit. Every model in the game is a list of primitives (boxes,
 * cylinders, cones, spheres, gable roofs, studs), each with a colour and a glow, merged into one
 * BufferGeometry with `color` and `glow` attributes so a whole building is a single draw.
 *
 * Positions: box/cyl/cone/gable take the *bottom* y; sphere takes its centre.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _t = new THREE.Vector3();
const _c = new THREE.Color();

export class Builder {
    constructor() { this.parts = []; }

    add(geo, color, o = {}) {
        let g = geo.index ? geo.toNonIndexed() : geo;
        if (g !== geo) geo.dispose();
        if (g.attributes.uv) g.deleteAttribute('uv');
        if (g.attributes.uv1) g.deleteAttribute('uv1');
        _e.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ');
        _q.setFromEuler(_e);
        _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
        _t.set(o.x || 0, o.y || 0, o.z || 0);
        _m.compose(_t, _q, _s);
        g.applyMatrix4(_m);
        const n = g.attributes.position.count;
        const col = new Float32Array(n * 3), glow = new Float32Array(n);
        _c.setHex(color);
        for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; glow[i] = o.glow || 0; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
        this.parts.push(g);
        return this;
    }

    box(w, h, d, color, x = 0, y = 0, z = 0, o = {}) {
        return this.add(new THREE.BoxGeometry(w, h, d), color, { ...o, x, y: o.centre ? y : y + h / 2, z });
    }
    /** Cylinder standing on y. o.rt = top radius, o.seg = segments. Tilted cylinders: pass rx/rz and centre with o.centre. */
    cyl(r, h, color, x = 0, y = 0, z = 0, o = {}) {
        const g = new THREE.CylinderGeometry(o.rt ?? r, r, h, o.seg || 12, 1, !!o.open, o.ts || 0, o.tl || Math.PI * 2);
        return this.add(g, color, { ...o, x, y: o.centre ? y : y + h / 2, z });
    }
    cone(r, h, color, x = 0, y = 0, z = 0, o = {}) {
        return this.add(new THREE.ConeGeometry(r, h, o.seg || 12), color, { ...o, x, y: y + h / 2, z });
    }
    sphere(r, color, x = 0, y = 0, z = 0, o = {}) {
        return this.add(new THREE.SphereGeometry(r, o.seg || 12, o.rings || 8, 0, Math.PI * 2, 0, o.half ? Math.PI / 2 : Math.PI), color, { ...o, x, y, z });
    }
    ico(r, color, x = 0, y = 0, z = 0, o = {}) {
        return this.add(new THREE.IcosahedronGeometry(r, o.detail || 0), color, { ...o, x, y, z });
    }
    torus(r, tube, color, x = 0, y = 0, z = 0, o = {}) {
        return this.add(new THREE.TorusGeometry(r, tube, o.rseg || 6, o.tseg || 24), color, { ...o, x, y, z });
    }

    /** A gable roof: base w (x) × d (z) at height y, ridge along x at height y + h. */
    gable(w, h, d, color, x = 0, y = 0, z = 0, o = {}) {
        const hw = w / 2, hd = d / 2;
        const p = [
            // two slopes
            -hw, 0, hd, hw, 0, hd, hw, h, 0, -hw, 0, hd, hw, h, 0, -hw, h, 0,
            hw, 0, -hd, -hw, 0, -hd, -hw, h, 0, hw, 0, -hd, -hw, h, 0, hw, h, 0,
            // gable ends
            hw, 0, hd, hw, 0, -hd, hw, h, 0,
            -hw, 0, -hd, -hw, 0, hd, -hw, h, 0,
            // underside
            -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
        ];
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        g.computeVertexNormals();
        return this.add(g, color, { ...o, x, y, z });
    }

    /** A grid of toy studs on a surface at height y, centred at (x, z). */
    studs(x, y, z, nx, nz, pitch, color, r = 0.035) {
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
            this.cyl(r, 0.025, color, x + (i - (nx - 1) / 2) * pitch, y, z + (j - (nz - 1) / 2) * pitch, { seg: 8 });
        }
        return this;
    }

    geometry() {
        const g = this.parts.length === 1 ? this.parts[0] : mergeGeometries(this.parts, false);
        for (const p of this.parts) if (p !== g) p.dispose();
        this.parts = [];
        g.computeBoundingSphere();
        g.computeBoundingBox();
        return g;
    }
}
