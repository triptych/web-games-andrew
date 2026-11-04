// Shared pieces of the Black Nocturne: her measurements (one set of numbers
// for the model and for walking about on her), the materials, and a small
// helper for laying many parts into one batch.
//
// Ship coordinates: +x is starboard, +y up from the waterline at rest, the bow
// is toward -z and the stern toward +z. The ship's yaw turns the bow to face
// the same way the camera would look at the same yaw.

import * as THREE from 'three';
import { Batch, xf } from './materials.js';
import { clamp, lerp, smoothstep } from './util.js';

export const S = {
    HL: 12.5,            // half length
    BEAM: 3.6,           // half beam amidships at the deck
    DRAFT: 1.7,
    DECK: 2.1,           // main deck
    FORE: 3.4,           // forecastle deck
    QUARTER: 3.7,        // quarterdeck
    FORE_Z: -8.2,        // the forecastle ends here
    QUARTER_Z: 3.4,      // the quarterdeck begins here
    STAIR_IN: 1.3,       // the stairs to either castle stand between these |x|
    STAIR_OUT: 2.8,
    FORE_STAIR_Z: -5.7,
    QUARTER_STAIR_Z: 0.1,
    GANG_Z: [0.1, 1.9],  // the gap in the port bulwark where the gangplank comes aboard
    WHEEL_Z: 9.2,
    HELM_Z: 10.85,       // where the helmsman stands
    MASTS: [
        { id: 'fore', z: -7.0, base: 2.1, top: 21.0, r: 0.4 },
        { id: 'main', z: -1.0, base: 2.1, top: 25.5, r: 0.46 },
        { id: 'mizzen', z: 6.2, base: 3.7, top: 19.0, r: 0.34 },
    ],
};

/** The ship's materials, made once and shared with the wharf (the lamps glow together at night). */
export function shipMats(world) {
    return (world.shipMats ??= shipMaterials(world.mats));
}

// ------------------------------------------------------------- the hull's shape

/** Half-beam at the deck line at z. */
export function beam(z) {
    const t = clamp((z + S.HL) / (2 * S.HL), 0, 1);
    const f = t < 0.5 ? 0.12 + 0.88 * Math.pow(Math.sin((t / 0.5) * Math.PI / 2), 1.15) : 1 - 0.22 * Math.pow(smoothstep(0.5, 1, t), 1.3);
    return S.BEAM * f;
}

/** How deep the keel runs at z. */
export function keel(z) {
    const t = clamp((z + S.HL) / (2 * S.HL), 0, 1);
    return S.DRAFT * (0.1 + 0.9 * smoothstep(0, 0.42, t)) * (1 - 0.3 * smoothstep(0.7, 1, t));
}

/** Half width of the hull's outer skin at height y above the waterline. */
export function sideX(z, y) {
    const B = beam(z);
    if (y <= 0) {
        const d = keel(z);
        return B * 0.97 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.min(1, -y / d), 2.2)));
    }
    // a flare up to the main deck, then tumblehome (the sides lean in) up the castles
    return B * (0.97 + 0.07 * Math.min(y, S.DECK) / S.DECK - 0.05 * Math.max(0, y - S.DECK));
}

/** Height of the hull's top edge, the foot of the bulwark, at z. */
export function topAt(z) {
    return z < S.FORE_Z ? S.FORE : z >= S.QUARTER_Z ? S.QUARTER : S.DECK;
}

/** The planks' height at (lx, lz) in ship coordinates, or -Infinity off the deck. */
export function deckAt(lx, lz) {
    if (lz < -S.HL + 0.3 || lz > S.HL - 0.2) return -Infinity;
    const y = topAt(lz);
    if (Math.abs(lx) > sideX(lz, y) - 0.25) return -Infinity;
    const ax = Math.abs(lx);
    if (ax >= S.STAIR_IN && ax <= S.STAIR_OUT) {
        if (lz >= S.QUARTER_STAIR_Z && lz <= S.QUARTER_Z) return lerp(S.DECK, S.QUARTER, (lz - S.QUARTER_STAIR_Z) / (S.QUARTER_Z - S.QUARTER_STAIR_Z));
        if (lz <= S.FORE_Z + 0.01 || lz < S.FORE_STAIR_Z) {
            if (lz >= S.FORE_Z) return lerp(S.FORE, S.DECK, (lz - S.FORE_Z) / (S.FORE_STAIR_Z - S.FORE_Z));
        }
    }
    return y;
}

// ------------------------------------------------------------------- materials

/** Everything the ship is made of, keyed for the batch (and a few loose ones). */
export function shipMaterials(base) {
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const m = {
        hull: std({ map: base.darkWood.map, normalMap: base.darkWood.normalMap, color: 0x2e211d, roughness: 0.72, side: THREE.DoubleSide }),
        hullRed: std({ map: base.darkWood.map, normalMap: base.darkWood.normalMap, color: 0x6d1823, roughness: 0.6, side: THREE.DoubleSide }),
        plank: std({ map: base.darkWood.map, normalMap: base.darkWood.normalMap, color: 0x57443a, roughness: 0.85 }),
        deck: std({ map: base.wood.map, normalMap: base.wood.normalMap, color: 0x8b6a50, roughness: 0.85, side: THREE.DoubleSide }),
        trim: std({ color: 0xcaa24e, roughness: 0.3, metalness: 0.95 }),
        iron: std({ color: 0x23242a, roughness: 0.45, metalness: 0.8 }),
        bone: std({ color: 0xdad2bb, roughness: 0.55 }),
        stone: std({ map: base.granite.map, normalMap: base.granite.normalMap, color: 0x6b6672, roughness: 0.85 }),
        rope: std({ color: 0x9c8660, roughness: 1 }),
        black: std({ color: 0x0e0b10, roughness: 0.8 }),
        cloth: std({ color: 0x7d1424, roughness: 0.9, side: THREE.DoubleSide }),
        // glowing things: dim by day, bright at night (Ship.update sets the intensities)
        lamp: std({ color: 0x1a0f04, emissive: 0xffa84a, emissiveIntensity: 0.4, roughness: 0.4 }),
        ecto: std({ color: 0x06140f, emissive: 0x6dffc8, emissiveIntensity: 0.5, roughness: 0.4 }),
        redlamp: std({ color: 0x1a0404, emissive: 0xff2a20, emissiveIntensity: 0.5, roughness: 0.4 }),
        greenlamp: std({ color: 0x041a06, emissive: 0x30ff50, emissiveIntensity: 0.5, roughness: 0.4 }),
    };
    return m;
}

// --------------------------------------------------------------- parts helper

const _up = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _one = new THREE.Vector3(1, 1, 1);
const _geos = new Map();
const cached = (key, make) => {
    let g = _geos.get(key);
    if (!g) _geos.set(key, (g = make()));
    return g;
};

/** A Batch with shortcuts for the shapes the ship is made of. */
export class Parts {
    constructor() {
        this.batch = new Batch();
    }

    add(key, geo, m) {
        this.batch.add(key, geo, m);
        return this;
    }

    box(key, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
        return this.add(key, cached(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)), xf(x, y, z, ry, 1, 1, 1, rx, rz));
    }

    cyl(key, rt, rb, h, x, y, z, { ry = 0, rx = 0, rz = 0, seg = 8, open = false } = {}) {
        return this.add(key, cached(`c${rt},${rb},${h},${seg},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open)), xf(x, y, z, ry, 1, 1, 1, rx, rz));
    }

    cone(key, r, h, x, y, z, { seg = 8, ry = 0, rx = 0, rz = 0 } = {}) {
        return this.add(key, cached(`k${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)), xf(x, y, z, ry, 1, 1, 1, rx, rz));
    }

    sph(key, r, x, y, z, sx = 1, sy = sx, sz = sx, seg = 10) {
        return this.add(key, cached(`s${r},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(5, seg - 3))), xf(x, y, z, 0, sx, sy, sz));
    }

    tor(key, r, t, x, y, z, { rx = 0, ry = 0, rz = 0, arc = Math.PI * 2, seg = 12 } = {}) {
        return this.add(key, cached(`t${r},${t},${arc},${seg}`, () => new THREE.TorusGeometry(r, t, 5, seg, arc)), xf(x, y, z, ry, 1, 1, 1, rx, rz));
    }

    /** A straight round rod between two points (rope, spar, stay), optionally tapering. */
    rod(key, a, b, r, r1 = r, seg = 5) {
        const d = new THREE.Vector3().subVectors(b, a);
        const len = d.length();
        if (len < 1e-4) return this;
        _q.setFromUnitVectors(_up, d.divideScalar(len));
        const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), _q, new THREE.Vector3(1, len, 1));
        return this.add(key, cached(`r${r},${r1},${seg}`, () => new THREE.CylinderGeometry(r1, r, 1, seg)), m);
    }

    /** A tube through points. */
    tube(key, pts, r, { closed = false, seg = 5, n } = {}) {
        const curve = new THREE.CatmullRomCurve3(pts, closed);
        return this.add(key, new THREE.TubeGeometry(curve, n ?? Math.max(8, pts.length * 4), r, seg, closed), null);
    }

    build(mats) {
        return this.batch.build(mats);
    }
}

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export { xf, _one as ONE };

/**
 * A grid of vertices (nu x nv) from fn(i, j) -> [x, y, z]; uv scaled by (su, sv).
 * flip reverses the winding.
 */
export function grid(nu, nv, fn, su = 1, sv = 1, flip = false) {
    const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
    const uv = new Float32Array((nu + 1) * (nv + 1) * 2);
    for (let j = 0; j <= nv; j++) {
        for (let i = 0; i <= nu; i++) {
            const k = j * (nu + 1) + i;
            pos.set(fn(i, j), k * 3);
            uv[k * 2] = (i / nu) * su;
            uv[k * 2 + 1] = (j / nv) * sv;
        }
    }
    const idx = [];
    for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
            const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
            if (flip) idx.push(a, b, c, b, d, c);
            else idx.push(a, c, b, b, c, d);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}
