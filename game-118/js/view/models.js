// Every item, generator and prop in the game, built from three.js primitives. No asset files.
// A model's origin is the middle of its base; it stands on y = 0 and fits in about 0.8 x 0.8 x 0.9.
// getModel(chain, tier) returns a clone that shares geometry and materials, so a full board is cheap.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const PAL = {
    orange: 0xf08a24, orangeDk: 0xd2650e, green: 0x6d9c2e, greenDk: 0x48781f, brown: 0x7a4a28, brownLt: 0xa8713f,
    soil: 0x6a3f22, cream: 0xfff0d0, crust: 0xe2a95a, red: 0xc92f3c, redDk: 0x9c1d2d, yellow: 0xffcf40,
    gold: 0xf5b82e, tan: 0xd9b27c, white: 0xfdf8ee, black: 0x2a2320, blue: 0x3d7ed8, purple: 0x7a4b9b,
    wood: 0xa06a38, woodDk: 0x6e431f, kraft: 0xcf9f62, terracotta: 0xb9532d, roast: 0xb9631f, silver: 0xcdd3da,
};

const matCache = new Map();
export function mat(color, o) {
    o = o || {};
    const key = `${color}|${o.rough ?? 0.6}|${o.metal ?? 0}|${o.emissive ?? 0}|${o.side ?? 0}`;
    let m = matCache.get(key);
    if (!m) {
        m = new THREE.MeshStandardMaterial({
            color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0,
            emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissive ? 0.6 : 0, side: o.side ?? THREE.FrontSide,
        });
        matCache.set(key, m);
    }
    return m;
}

const geoCache = new Map();
function geo(key, make) {
    let g = geoCache.get(key);
    if (!g) { g = make(); geoCache.set(key, g); }
    return g;
}

function finish(m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

const sph = (r, color, sx = 1, sy = 1, sz = 1, o) => {
    const m = new THREE.Mesh(geo(`s${r}`, () => new THREE.SphereGeometry(r, 24, 16)), mat(color, o));
    m.scale.set(sx, sy, sz);
    return m;
};
const cyl = (rt, rb, h, color, o, seg = 24) => new THREE.Mesh(geo(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat(color, o));
const cone = (r, h, color, o, seg = 16) => new THREE.Mesh(geo(`k${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg)), mat(color, o));
const box = (w, h, d, color, o, rad = 0.02) => new THREE.Mesh(geo(`b${w}|${h}|${d}|${rad}`, () => new RoundedBoxGeometry(w, h, d, 3, rad)), mat(color, o));
const tor = (R, r, color, o, arc = Math.PI * 2) => new THREE.Mesh(geo(`t${R}|${r}|${arc}`, () => new THREE.TorusGeometry(R, r, 10, 28, arc)), mat(color, o));
const cap = (r, len, color, o) => new THREE.Mesh(geo(`p${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 12)), mat(color, o));

const FLAT = Math.PI / 2;
const at = (m, ...a) => finish(m, ...a);
const group = (...parts) => { const g = new THREE.Group(); for (const p of parts) g.add(p); return g; };

/** A sphere with meridian ridges: a pumpkin. */
function ridged(r, sy, ridges, depth, color) {
    const g = geo(`r${r}|${sy}|${ridges}|${depth}`, () => {
        const s = new THREE.SphereGeometry(r, 40, 24);
        const p = s.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const k = 1 + depth * Math.cos(ridges * Math.atan2(z, x)) * (1 - Math.pow(Math.abs(y / r), 3));
            p.setXYZ(i, x * k, y * sy, z * k);
        }
        s.computeVertexNormals();
        return s;
    });
    return new THREE.Mesh(g, mat(color, { rough: 0.5 }));
}

/** A flat leaf outline, extruded a little. */
function leafGeo(len = 0.3, wid = 0.16, thick = 0.025) {
    return geo(`leaf${len}|${wid}|${thick}`, () => {
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.bezierCurveTo(wid, len * 0.2, wid * 0.9, len * 0.7, 0, len);
        s.bezierCurveTo(-wid * 0.9, len * 0.7, -wid, len * 0.2, 0, 0);
        const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 10 });
        g.rotateX(-FLAT);               // lie flat in XZ, tip toward -z
        return g;
    });
}
const leaf = (color, len, wid, thick, o) => new THREE.Mesh(leafGeo(len, wid, thick), mat(color, o));

function starGeo() {
    return geo('star', () => {
        const s = new THREE.Shape();
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 + FLAT, r = i % 2 ? 0.045 : 0.1;
            if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        return new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 });
    });
}

function lathe(points, color, o, seg = 32) {
    return new THREE.Mesh(geo(`l${points.join()}|${seg}`, () => new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg)), mat(color, { side: THREE.DoubleSide, ...o }));
}

// ------------------------------------------------------------------ pumpkin chain

function soil(r = 0.3) { return at(cyl(r * 0.85, r, 0.09, PAL.soil, { rough: 0.95 }), 0, 0.045, 0); }
function stem(h, color = PAL.green) { return at(cyl(0.022, 0.035, h, color), 0, 0, 0); }

function pumpkinSeed() {
    const g = group(soil(0.32));
    [[-0.1, 0.06], [0.11, -0.02], [0.0, 0.13]].forEach(([x, z], i) => g.add(at(sph(0.075, PAL.cream, 1.3, 0.55, 0.8), x, 0.115, z, 0, i * 1.1, 0.12)));
    g.add(at(sph(0.04, PAL.cream, 1.3, 0.55, 0.8), -0.03, 0.105, -0.12, 0, 0.5, 0));
    return g;
}
function sprout() {
    const g = group(soil(0.3));
    g.add(at(stem(0.34), 0, 0.26, 0));
    g.add(at(leaf(PAL.green, 0.34, 0.19, 0.025), 0.02, 0.4, 0.02, -0.45, -0.55, 0.15));
    g.add(at(leaf(PAL.greenDk, 0.3, 0.17, 0.025), -0.02, 0.34, 0, -0.45, 2.5, -0.1));
    g.add(at(leaf(0x86b83a, 0.2, 0.11, 0.02), 0.0, 0.5, 0.0, -0.6, 1.4, 0));
    g.add(at(sph(0.04, PAL.green), 0, 0.44, 0));
    return g;
}
function miniPumpkin() {
    const g = group(at(ridged(0.28, 0.78, 8, 0.07, PAL.orange), 0, 0.22, 0));
    g.add(at(cyl(0.03, 0.05, 0.1, PAL.green), 0.01, 0.44, 0, 0, 0, 0.2));
    g.add(at(leaf(PAL.green, 0.2, 0.1, 0.02), 0.12, 0.38, 0.0, -0.3, -1.0, 0.1));
    g.add(at(tor(0.05, 0.01, PAL.greenDk, null, Math.PI * 1.6), -0.07, 0.43, 0.04, 0.3, 0.4, 0));
    return g;
}
function pumpkin() {
    const g = group(at(ridged(0.4, 0.8, 10, 0.075, PAL.orange), 0, 0.31, 0));
    g.add(at(cyl(0.045, 0.07, 0.16, PAL.greenDk), 0.02, 0.64, 0, 0, 0, 0.25));
    g.add(at(leaf(PAL.green, 0.28, 0.13, 0.02), 0.2, 0.54, 0.1, -0.2, -0.9, 0.1));
    g.add(at(leaf(PAL.greenDk, 0.22, 0.11, 0.02), -0.2, 0.5, 0.18, -0.1, 0.9, -0.1));
    g.add(at(tor(0.07, 0.012, PAL.green, null, Math.PI * 1.7), -0.12, 0.62, 0.1, 0.4, 0.2, 0));
    return g;
}
function pie(plateColor = null) {
    const g = new THREE.Group();
    if (plateColor) g.add(at(cyl(0.44, 0.46, 0.05, plateColor, { metal: 0.7, rough: 0.28 }), 0, 0.025, 0));
    const y0 = plateColor ? 0.05 : 0;
    g.add(at(cyl(0.38, 0.31, 0.16, PAL.silver, { metal: 0.5, rough: 0.35 }), 0, y0 + 0.08, 0));
    g.add(at(cyl(0.355, 0.355, 0.06, PAL.orangeDk, { rough: 0.5 }), 0, y0 + 0.165, 0));
    g.add(at(tor(0.37, 0.05, PAL.crust, { rough: 0.7 }), 0, y0 + 0.16, 0, FLAT, 0, 0));
    g.add(at(cyl(0.3, 0.3, 0.02, PAL.orange, { rough: 0.35 }), 0, y0 + 0.2, 0));
    return g;
}
function pumpkinPie() {
    const g = pie();
    [[0, 0.3, 0.12], [0.2, 0.18, -0.1], [-0.2, 0.18, -0.1]].forEach(([x, y, z]) => {
        void y;
        g.add(at(sph(0.075, PAL.white, 1, 0.7, 1), x, 0.23, z));
    });
    g.add(at(sph(0.04, PAL.crust), 0, 0.27, 0));
    return g;
}
function blueRibbonPie() {
    const g = pie(PAL.gold);
    g.add(at(sph(0.17, PAL.white, 1, 0.55, 1), 0, 0.3, 0));
    g.add(at(sph(0.11, PAL.white, 1, 0.55, 1), 0, 0.37, 0));
    g.add(at(sph(0.05, PAL.white, 1, 0.8, 1), 0, 0.43, 0));
    g.add(at(sph(0.035, PAL.red), 0, 0.49, 0));
    [-0.1, 0.1].forEach((s) => g.add(at(box(0.07, 0.012, 0.24, PAL.blue), 0.3 * Math.sign(s) * 0.4 + s * 0.4, 0.15, 0.4, 0.55, 0, s * 2)));
    g.add(at(cyl(0.1, 0.1, 0.035, PAL.blue), 0.0, 0.18, 0.38, 0.55, 0, 0));
    g.add(at(cyl(0.055, 0.055, 0.045, PAL.gold, { metal: 0.6, rough: 0.3 }), 0.0, 0.19, 0.385, 0.55, 0, 0));
    return g;
}

// ------------------------------------------------------------------ turkey chain

const FEATHERS = [PAL.redDk, PAL.orangeDk, PAL.yellow, PAL.orange, PAL.red];
function eyes(g, y, z, x = 0.06, r = 0.028) {
    [-1, 1].forEach((s) => {
        g.add(at(sph(r, PAL.white), s * x, y, z));
        g.add(at(sph(r * 0.55, PAL.black), s * x, y, z + r * 0.7));
    });
}
function egg() {
    const g = group(at(tor(0.25, 0.07, 0xb98a4a, { rough: 0.9 }), 0, 0.07, 0, FLAT, 0, 0));
    g.add(at(cyl(0.25, 0.27, 0.06, 0x8a5e30, { rough: 0.95 }), 0, 0.03, 0));
    g.add(at(sph(0.21, 0xf6e6c6, 0.82, 1.12, 0.82, { rough: 0.45 }), 0, 0.27, 0));
    [[0.1, 0.34, 0.12], [-0.1, 0.28, 0.12], [0.04, 0.4, 0.1], [-0.05, 0.21, 0.14], [0.12, 0.23, 0.1]].forEach(([x, y, z]) => g.add(at(sph(0.02, 0x9a6a3a, 1, 1, 0.5), x, y, z)));
    return g;
}
function chick() {
    const g = group(at(sph(0.23, 0xffd84a, 1, 0.95, 1), 0, 0.25, 0));
    g.add(at(sph(0.15, 0xffd84a), 0, 0.5, 0.05));
    g.add(at(cone(0.04, 0.1, PAL.orange, null, 12), 0, 0.48, 0.2, FLAT, 0, 0));
    eyes(g, 0.54, 0.15, 0.065, 0.03);
    [-1, 1].forEach((s) => {
        g.add(at(sph(0.1, 0xf2c030, 0.4, 0.8, 1), s * 0.22, 0.28, -0.02, 0, 0, s * 0.3));
        g.add(at(box(0.07, 0.025, 0.1, PAL.orange), s * 0.08, 0.02, 0.08));
    });
    g.add(at(cone(0.03, 0.09, 0xf2c030, null, 8), 0, 0.66, 0.02));
    return g;
}
/** The bird itself: body, neck, head, wattle and legs. `fan` feathers spread behind it. */
function bird(scale, fan, body = 0x8a5330) {
    const g = new THREE.Group();
    const b = new THREE.Group();
    b.add(at(sph(0.28, body, 1, 0.9, 1.15), 0, 0.33, 0));
    b.add(at(sph(0.17, 0xa36b42, 1, 1, 1), 0, 0.37, 0.2));
    b.add(at(cyl(0.05, 0.08, 0.26, 0xe3a58b), 0, 0.6, 0.2, -0.2, 0, 0));
    b.add(at(sph(0.095, 0xe3a58b, 1, 1.05, 1.1), 0, 0.76, 0.24));
    b.add(at(cone(0.035, 0.1, PAL.orange, null, 10), 0, 0.74, 0.35, FLAT, 0, 0));
    b.add(at(sph(0.045, PAL.red, 0.7, 1.5, 0.7), 0, 0.66, 0.34));
    eyes(b, 0.79, 0.3, 0.06, 0.024);
    [-1, 1].forEach((s) => {
        b.add(at(cyl(0.018, 0.022, 0.2, PAL.orange), s * 0.1, 0.1, 0.02));
        b.add(at(box(0.09, 0.02, 0.12, PAL.orange), s * 0.1, 0.015, 0.06));
        b.add(at(sph(0.13, 0x734226, 0.45, 0.8, 1.1), s * 0.27, 0.36, -0.02, 0, 0, s * 0.25));
    });
    g.add(b);
    for (let i = 0; i < fan; i++) {
        const a = fan === 1 ? 0 : (i / (fan - 1) - 0.5) * 2.5;
        const f = group(
            at(sph(0.32, FEATHERS[i % FEATHERS.length], 0.2, 1, 0.05), 0, 0.3, 0),
            at(sph(0.1, PAL.cream, 0.45, 0.9, 0.08), 0, 0.57, 0.012),
        );
        const holder = new THREE.Group();
        holder.add(at(f, 0, 0.0, 0));
        holder.position.set(0, 0.33, -0.22);
        holder.rotation.set(-0.15, 0, a);
        g.add(holder);
    }
    g.scale.setScalar(scale);
    return g;
}
const poult = () => bird(0.82, 3, 0x9a6038);
const gobbler = () => bird(1, 7);
function roastBody(s = 1) {
    const g = new THREE.Group();
    g.add(at(sph(0.29, PAL.roast, 1, 0.78, 1.18, { rough: 0.35 }), 0, 0.28, 0));
    g.add(at(sph(0.2, 0xd1802f, 1, 0.5, 0.9, { rough: 0.3 }), 0, 0.42, 0.04));
    [-1, 1].forEach((sd) => {
        g.add(at(cyl(0.055, 0.08, 0.24, PAL.roast, { rough: 0.35 }), sd * 0.27, 0.2, 0.2, 0.9, 0, sd * 0.7));
        g.add(at(sph(0.055, PAL.cream), sd * 0.36, 0.14, 0.31));
        g.add(at(cyl(0.05, 0.035, 0.07, PAL.white), sd * 0.34, 0.16, 0.29, 0.9, 0, sd * 0.7));
    });
    g.scale.setScalar(s);
    return g;
}
function roastTurkey() {
    const g = group(at(cyl(0.44, 0.46, 0.05, PAL.white, { rough: 0.25 }), 0, 0.025, 0), at(tor(0.44, 0.015, PAL.gold, { metal: 0.6, rough: 0.3 }), 0, 0.05, 0, FLAT, 0, 0));
    const r = roastBody();
    r.position.y = 0.04;
    g.add(r);
    [[-0.1, -0.3], [0.12, -0.28]].forEach(([x, z]) => g.add(at(sph(0.05, PAL.green), x, 0.08, z)));
    g.add(at(sph(0.05, PAL.red), 0.28, 0.08, -0.22));
    return g;
}
function feastPlatter() {
    const g = group(at(cyl(0.47, 0.49, 0.06, PAL.gold, { metal: 0.75, rough: 0.28 }), 0, 0.03, 0), at(tor(0.47, 0.02, PAL.gold, { metal: 0.75, rough: 0.25 }), 0, 0.06, 0, FLAT, 0, 0));
    const r = roastBody(0.8);
    r.position.set(0, 0.06, -0.02);
    g.add(r);
    for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.15 + (i / 8) * 0.7);
        const col = i % 3 === 0 ? PAL.red : i % 3 === 1 ? PAL.green : PAL.tan;
        g.add(at(sph(i % 3 === 2 ? 0.06 : 0.045, col), Math.cos(a) * 0.37, 0.09, Math.sin(a) * 0.33));
    }
    g.add(at(sph(0.04, PAL.red), -0.34, 0.09, 0.02));
    g.add(at(sph(0.04, PAL.red), 0.35, 0.09, 0.02));
    return g;
}

// ------------------------------------------------------------------ grain chain

function wheat() {
    const g = new THREE.Group();
    [[-0.17, -0.22, 0.02], [-0.06, -0.08, -0.05], [0.06, 0.08, -0.05], [0.17, 0.22, 0.02]].forEach(([x, a, z]) => {
        const s = new THREE.Group();
        s.add(at(cyl(0.017, 0.022, 0.56, 0xd9b24a), 0, 0.28, 0));
        s.add(at(sph(0.06, 0xe9c65a, 0.85, 2.7, 0.85), 0, 0.6, 0));
        s.add(at(sph(0.048, 0xf0d070, 0.8, 2, 0.8), 0, 0.73, 0));
        [-1, 1].forEach((k) => s.add(at(cyl(0.005, 0.008, 0.16, 0xe0b848), k * 0.05, 0.68, 0, 0, 0, k * -0.3)));
        s.position.set(x, 0.03, z);
        s.rotation.z = -a;
        g.add(s);
    });
    g.add(at(tor(0.095, 0.02, PAL.red), 0, 0.22, 0, FLAT, 0, 0));
    g.add(at(cyl(0.24, 0.26, 0.04, 0xc9a56a, { rough: 0.9 }), 0, 0.02, 0));
    return g;
}
function flourSack() {
    const g = group(lathe([[0, 0], [0.24, 0], [0.31, 0.14], [0.3, 0.3], [0.2, 0.44], [0.1, 0.5], [0.12, 0.54], [0.0, 0.54]], 0xf0e2c4, { rough: 0.9 }));
    g.children[0].castShadow = true;
    g.add(at(tor(0.105, 0.016, PAL.red), 0, 0.49, 0, FLAT, 0, 0));
    g.add(at(cone(0.13, 0.12, 0xf0e2c4, { rough: 0.9, side: THREE.DoubleSide }, 14), 0, 0.6, 0));
    g.add(at(cyl(0.12, 0.12, 0.012, PAL.red), 0, 0.26, 0.3, FLAT, 0, 0));
    g.add(at(sph(0.04, PAL.gold, 1, 1, 0.3), 0, 0.26, 0.31));
    return g;
}
function dough() {
    const g = group(at(box(0.72, 0.06, 0.54, PAL.wood, null, 0.02), 0, 0.03, 0));
    g.add(at(sph(0.2, 0xf6e5c0, 1.25, 0.8, 1, { rough: 0.8 }), -0.04, 0.18, -0.04));
    g.add(at(cyl(0.04, 0.04, 0.4, PAL.brownLt), 0.0, 0.1, 0.2, 0, 0, FLAT));
    [-1, 1].forEach((s) => g.add(at(sph(0.05, PAL.woodDk), s * 0.22, 0.1, 0.2)));
    for (let i = 0; i < 6; i++) g.add(at(sph(0.012, PAL.white), -0.3 + i * 0.1, 0.07, -0.18 + (i % 2) * 0.35));
    return g;
}
function roll(x, z, s = 1, ry = 0) {
    const g = new THREE.Group();
    g.add(at(sph(0.16 * s, 0xd99a47, 1.25, 0.85, 1, { rough: 0.45 }), 0, 0.13 * s, 0));
    g.add(at(sph(0.1 * s, 0xe8b365, 1.2, 0.4, 0.8, { rough: 0.4 }), 0, 0.2 * s, 0));
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    return g;
}
function dinnerRoll() {
    const g = group(at(cyl(0.4, 0.42, 0.04, PAL.cream, { rough: 0.3 }), 0, 0.02, 0));
    g.add(at(tor(0.4, 0.012, PAL.gold, { metal: 0.6, rough: 0.3 }), 0, 0.04, 0, FLAT, 0, 0));
    const r = [roll(-0.14, 0.1, 1, 0.3), roll(0.16, 0.08, 1, -0.4), roll(0.0, -0.15, 1, 0.1)];
    r.forEach((m) => { m.position.y = 0.04; g.add(m); });
    return g;
}
function breadBasket() {
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [0.2, 0], [0.3, 0.1], [0.4, 0.24]], PAL.brownLt, { rough: 0.9 }));
    g.children[0].castShadow = true;
    g.add(at(tor(0.4, 0.035, 0x8d5a2b, { rough: 0.9 }), 0, 0.24, 0, FLAT, 0, 0));
    [0.07, 0.15].forEach((y, i) => g.add(at(tor(0.25 + i * 0.06 + y * 0.35, 0.012, 0x8d5a2b, { rough: 0.9 }), 0, y, 0, FLAT, 0, 0)));
    [[-0.17, 0.05], [0.18, 0.06], [0.0, -0.18], [0.02, 0.14]].forEach(([x, z], i) => { const r = roll(x, z, 1.05, i); r.position.y = 0.22 + (i === 3 ? 0.08 : 0); g.add(r); });
    g.add(at(box(0.3, 0.015, 0.2, PAL.red), 0.1, 0.34, 0.3, -0.7, 0.1, 0));
    return g;
}
function cornucopia() {
    const g = new THREE.Group();
    // a horn of overlapping wicker spheres curling from a tip at the back left to a wide mouth at the front
    const N = 14;
    for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        const x = -0.36 + t * 0.5 + Math.sin(t * 3.0) * 0.04;
        const y = 0.38 - t * 0.17 + Math.sin(t * Math.PI) * 0.06;
        const z = -0.24 + t * 0.4;
        const r = 0.035 + Math.pow(t, 1.3) * 0.17;
        g.add(at(sph(r, i % 2 ? 0x9b6b34 : 0xb98245, 1, 1, 1, { rough: 0.9 }), x, y, z));
    }
    // the mouth: an open ring facing the camera, with the harvest spilling out of it
    g.add(at(tor(0.17, 0.035, 0x8d5a2b, { rough: 0.9 }), 0.14, 0.23, 0.18, 0.9, 0.1, 0));
    g.add(at(ridged(0.15, 0.8, 8, 0.07, PAL.orange), 0.16, 0.34, 0.3));
    g.add(at(cyl(0.02, 0.03, 0.06, PAL.greenDk), 0.16, 0.44, 0.3));
    g.add(at(sph(0.1, PAL.red), -0.04, 0.3, 0.34));
    g.add(at(sph(0.1, 0xd23b3b), 0.38, 0.26, 0.28));
    g.add(at(sph(0.085, PAL.yellow, 1, 1.3, 1), 0.36, 0.1, 0.42));
    [[0.0, 0.1, 0.44], [0.06, 0.1, 0.5], [0.12, 0.1, 0.44], [0.03, 0.17, 0.46], [0.09, 0.17, 0.46], [0.06, 0.24, 0.47]].forEach(([x, y, z]) => g.add(at(sph(0.05, PAL.purple), x, y, z)));
    g.add(at(cyl(0.05, 0.05, 0.24, 0xf0c640), 0.24, 0.12, 0.48, FLAT, 0, 0.7));
    g.add(at(leaf(PAL.greenDk, 0.24, 0.11, 0.02), -0.12, 0.2, 0.48, -0.1, 0.7, 0));
    g.add(at(leaf(PAL.red, 0.22, 0.1, 0.02), 0.5, 0.12, 0.36, -0.1, -0.7, 0.1));
    g.add(at(leaf(PAL.orange, 0.2, 0.1, 0.02), 0.3, 0.1, 0.55, -0.1, -0.2, 0));
    return g;
}

// ------------------------------------------------------------------ craft chain

function crayon(color, tip, rx, rz, x, z, h = 0.46) {
    const g = new THREE.Group();
    g.add(at(cyl(0.06, 0.06, h, color), 0, h / 2, 0));
    g.add(at(cone(0.06, 0.13, tip, null, 16), 0, h + 0.065, 0));
    [0.1, h - 0.06].forEach((y) => g.add(at(cyl(0.0625, 0.0625, 0.025, PAL.white), 0, y, 0)));
    g.position.set(x, 0.06, z);
    g.rotation.set(rx, 0, rz);
    return g;
}
function crayons() {
    const g = new THREE.Group();
    g.add(crayon(0xd8392b, 0xe85a48, 0.1, 0.28, -0.1, -0.02));
    g.add(crayon(0xf2c230, 0xffd95a, -0.1, -0.2, 0.12, -0.05, 0.4));
    g.add(crayon(0x3b7fd0, 0x5a9cec, 0.0, -0.05, 0.0, 0.14, 0.34));
    g.scale.setScalar(1.15);
    return g;
}
function paperLeaves() {
    const g = new THREE.Group();
    g.add(at(leaf(0xe9772b, 0.5, 0.24, 0.025), -0.08, 0.04, 0.25, -0.18, 0.3, 0));
    g.add(at(leaf(0xf2c230, 0.42, 0.2, 0.025), 0.14, 0.07, 0.2, -0.15, -0.7, 0.05));
    g.add(at(box(0.015, 0.012, 0.36, 0xa0501a, null, 0.004), -0.08, 0.08, 0.04, -0.18, 0.3, 0));
    g.add(at(box(0.015, 0.012, 0.3, 0xb78a0a, null, 0.004), 0.14, 0.11, 0.05, -0.15, -0.7, 0.05));
    g.add(at(cyl(0.012, 0.012, 0.09, 0x6e431f), -0.14, 0.04, 0.3, FLAT - 0.2, 0.3, 0));
    g.scale.setScalar(1.25);
    return g;
}
function placeCard() {
    const g = new THREE.Group();
    const tilt = 0.42;
    const front = at(box(0.58, 0.32, 0.022, PAL.cream, { rough: 0.8 }, 0.008), 0, 0.165, 0.075, -tilt, 0, 0);
    const back = at(box(0.58, 0.32, 0.022, 0xf0dfba, { rough: 0.8 }, 0.008), 0, 0.165, -0.075, tilt, 0, 0);
    // the writing side: a border, a leaf stamp and two lines of "writing"
    front.add(at(box(0.52, 0.03, 0.01, PAL.orangeDk, null, 0.003), 0, 0.12, 0.014));
    front.add(at(box(0.52, 0.03, 0.01, PAL.orangeDk, null, 0.003), 0, -0.12, 0.014));
    front.add(at(box(0.3, 0.03, 0.012, PAL.woodDk, null, 0.004), -0.07, 0.02, 0.014));
    front.add(at(box(0.2, 0.025, 0.012, PAL.woodDk, null, 0.004), -0.12, -0.04, 0.014));
    const stamp = at(leaf(PAL.red, 0.13, 0.07, 0.012), 0.2, 0.04, 0.016, 0, 0.4, 0);
    stamp.rotation.set(FLAT, 0, 0.5);
    front.add(stamp);
    g.add(front, back);
    g.add(at(sph(0.045, PAL.orange), -0.3, 0.05, 0.2), at(sph(0.04, PAL.yellow), -0.22, 0.04, 0.26), at(sph(0.035, PAL.red), 0.3, 0.04, 0.22));
    return g;
}
function finger(col, angle, len = 0.2) {
    const f = new THREE.Group();
    const m = at(cap(0.05, len, col, { rough: 0.8 }), 0, 0, -(len / 2 + 0.05), FLAT, 0, 0);
    m.scale.set(1, 1, 0.14);
    f.add(m);
    f.rotation.y = angle;
    return f;
}
function handprintTurkey() {
    const g = new THREE.Group();
    const sheet = new THREE.Group();
    sheet.add(at(box(0.68, 0.02, 0.72, 0xe7c9a1, { rough: 0.9 }, 0.008), 0, 0, 0));
    // a handprint turkey: a palm for the body, four fingers for the feathers, a thumb for the head
    const hand = new THREE.Group();
    hand.position.set(-0.04, 0.012, 0.18);
    const palm = at(cyl(0.15, 0.15, 0.012, 0x7a4a28), 0, 0, 0);
    hand.add(palm);
    [[0xc92f3c, -0.62], [0xe9772b, -0.2], [0xf2c230, 0.22], [0x6d9c2e, 0.64]].forEach(([c, a]) => hand.add(finger(c, a)));
    const thumb = finger(0x7a4a28, -1.25, 0.12);
    thumb.position.set(0.1, 0, 0.02);
    hand.add(thumb);
    hand.add(at(sph(0.04, PAL.white, 1, 0.4, 1), 0.26, 0.018, 0.0), at(sph(0.02, PAL.black, 1, 0.4, 1), 0.265, 0.026, 0.0));
    hand.add(at(cone(0.026, 0.07, PAL.orange, null, 8), 0.34, 0.012, 0.06, 0, 0, -FLAT));
    sheet.add(hand);
    sheet.position.set(0, 0.31, -0.03);
    sheet.rotation.x = 0.95;
    g.add(sheet);
    g.add(at(box(0.05, 0.42, 0.025, PAL.woodDk, null, 0.006), 0, 0.2, -0.27, -0.45, 0, 0));
    g.add(at(box(0.7, 0.03, 0.06, PAL.wood, null, 0.008), 0, 0.015, 0.2));
    return g;
}
function pilgrimHat() {
    const g = group(at(cyl(0.36, 0.38, 0.045, PAL.black, { rough: 0.5 }, 32), 0, 0.022, 0));
    g.add(at(cyl(0.2, 0.26, 0.4, 0x2f2a28, { rough: 0.55 }), 0, 0.245, 0));
    g.add(at(cyl(0.2, 0.2, 0.012, 0x3c3633, { rough: 0.5 }), 0, 0.45, 0));
    g.add(at(cyl(0.2, 0.2, 0.012, 0x3c3633, { rough: 0.5 }), 0, 0.452, 0));
    g.add(at(cyl(0.252, 0.262, 0.08, PAL.cream, { rough: 0.7 }), 0, 0.12, 0));
    g.add(at(box(0.13, 0.13, 0.03, PAL.gold, { metal: 0.75, rough: 0.28 }, 0.01), 0, 0.125, 0.262));
    g.add(at(box(0.07, 0.07, 0.034, 0x2f2a28, null, 0.008), 0, 0.125, 0.264));
    g.add(at(box(0.012, 0.09, 0.036, PAL.gold, { metal: 0.75, rough: 0.28 }, 0.004), 0.0, 0.125, 0.266));
    return g;
}
function thankfulTree() {
    const g = group(at(cyl(0.22, 0.17, 0.2, PAL.terracotta, { rough: 0.8 }), 0, 0.1, 0));
    g.add(at(tor(0.22, 0.025, 0xc8613a, { rough: 0.8 }), 0, 0.2, 0, FLAT, 0, 0));
    g.add(at(cyl(0.18, 0.18, 0.02, PAL.soil, { rough: 1 }), 0, 0.2, 0));
    g.add(at(cyl(0.035, 0.055, 0.5, PAL.brown), 0, 0.45, 0));
    [[0.2, 0.62, 0.7], [-0.2, 0.58, -0.7], [0.0, 0.68, 0.0]].forEach(([x, y, a], i) => {
        void i;
        g.add(at(cyl(0.015, 0.025, 0.26, PAL.brown), x * 0.55, y - 0.06, 0, 0, 0, -Math.sign(a || 1) * 0.9 * (a ? 1 : 0)));
    });
    const cols = [PAL.red, PAL.orange, PAL.yellow, 0xb8541d, PAL.red, PAL.orange, PAL.yellow, 0xc84a2a, PAL.orange];
    [[0, 0.86, 0, 0.17], [-0.2, 0.74, 0.05, 0.13], [0.2, 0.76, -0.03, 0.14], [-0.12, 0.96, -0.1, 0.11], [0.14, 0.97, 0.08, 0.11], [0.0, 0.7, 0.18, 0.11], [-0.28, 0.6, -0.06, 0.09], [0.3, 0.62, 0.06, 0.09], [0.0, 0.62, -0.2, 0.1]].forEach(([x, y, z, r], i) => {
        g.add(at(sph(r, cols[i % cols.length], 1, 0.9, 1, { rough: 0.7 }), x, y, z));
    });
    g.add(at(new THREE.Mesh(starGeo(), mat(PAL.gold, { metal: 0.7, rough: 0.3, emissive: 0x6a4a00 })), 0, 1.08, -0.015));
    g.scale.setScalar(0.82);
    [[0.1, 0.55, 0.2], [-0.16, 0.5, 0.16]].forEach(([x, y, z]) => g.add(at(leaf(PAL.white, 0.1, 0.055, 0.01), x, y, z, 0.5, 0.3, 0)));
    return g;
}

// ------------------------------------------------------------------ generators

function genBase() {
    return group(
        at(cyl(0.47, 0.5, 0.05, PAL.gold, { metal: 0.7, rough: 0.3 }, 32), 0, 0.025, 0),
        at(tor(0.48, 0.022, 0xffd870, { metal: 0.7, rough: 0.25 }), 0, 0.05, 0, FLAT, 0, 0),
    );
}
function patchGen() {
    const g = genBase();
    const y = 0.05;
    g.add(at(box(0.74, 0.3, 0.6, PAL.wood, null, 0.03), 0, y + 0.15, 0.04));
    [-0.2, 0, 0.2].forEach((x) => g.add(at(box(0.012, 0.28, 0.62, PAL.woodDk, null, 0.003), x, y + 0.15, 0.04)));
    g.add(at(box(0.66, 0.03, 0.52, PAL.soil, { rough: 1 }, 0.01), 0, y + 0.3, 0.04));
    g.add(at(ridged(0.17, 0.78, 8, 0.07, PAL.orange), -0.16, y + 0.42, 0.06));
    g.add(at(cyl(0.025, 0.04, 0.07, PAL.greenDk), -0.15, y + 0.57, 0.06));
    g.add(at(ridged(0.12, 0.78, 8, 0.07, PAL.orangeDk), 0.2, y + 0.38, 0.12));
    g.add(at(leaf(PAL.green, 0.3, 0.14, 0.02), 0.05, y + 0.33, -0.1, -0.1, 0.5, 0));
    g.add(at(leaf(PAL.greenDk, 0.26, 0.12, 0.02), 0.25, y + 0.33, -0.12, -0.1, -0.6, 0));
    g.add(at(tor(0.1, 0.015, PAL.green, null, Math.PI * 1.5), 0.0, y + 0.36, -0.1, FLAT, 0, 0));
    return g;
}
function coopGen() {
    const g = genBase();
    const y = 0.05;
    g.add(at(box(0.62, 0.32, 0.5, 0xb6382c, null, 0.03), 0, y + 0.16, -0.02));
    const roof = new THREE.Mesh(geo('roof', () => new THREE.CylinderGeometry(0.02, 0.5, 0.26, 4, 1)), mat(PAL.woodDk));
    roof.scale.set(1.0, 1, 0.78);
    g.add(at(roof, 0, y + 0.45, -0.02, 0, Math.PI / 4, 0));
    g.add(at(box(0.18, 0.2, 0.03, PAL.black, null, 0.01), 0, y + 0.11, 0.24));
    g.add(at(cyl(0.07, 0.07, 0.03, PAL.cream), 0, y + 0.34, 0.24, FLAT, 0, 0));
    g.add(at(cyl(0.05, 0.05, 0.035, PAL.black), 0, y + 0.34, 0.245, FLAT, 0, 0));
    [[-0.28, 0.3], [-0.2, 0.34], [0.24, 0.32], [0.3, 0.27]].forEach(([x, z], i) => g.add(at(sph(0.05, 0xe8c458, 1.4, 0.6, 1), x, y + 0.03, z, 0, i, 0)));
    g.add(at(sph(0.07, 0xf6e6c6, 0.82, 1.12, 0.82), 0.1, y + 0.08, 0.34));
    return g;
}
function barrelGen() {
    const g = genBase();
    const y = 0.05;
    g.add(lathe([[0, 0], [0.3, 0], [0.37, 0.18], [0.39, 0.3], [0.37, 0.42], [0.3, 0.6], [0.0, 0.6]], PAL.wood, { rough: 0.8 }));
    g.children[g.children.length - 1].position.y = y;
    g.children[g.children.length - 1].castShadow = true;
    [0.1, 0.5].forEach((hy) => g.add(at(tor(0.325 + (hy > 0.3 ? 0.0 : 0.0), 0.022, 0x4a3a30, { metal: 0.5, rough: 0.5 }), 0, y + hy, 0, FLAT, 0, 0)));
    [0.2, 0.4].forEach((hy) => g.add(at(tor(0.385, 0.022, 0x4a3a30, { metal: 0.5, rough: 0.5 }), 0, y + hy, 0, FLAT, 0, 0)));
    g.add(at(cyl(0.34, 0.34, 0.02, 0xe9c65a, { rough: 0.9 }), 0, y + 0.58, 0));
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2, tilt = 0.28;
        const s = new THREE.Group();
        s.add(at(cyl(0.012, 0.016, 0.4, 0xd9b24a), 0, 0.2, 0));
        s.add(at(sph(0.04, 0xe9c65a, 0.85, 2.8, 0.85), 0, 0.44, 0));
        s.position.set(Math.cos(a) * 0.12, y + 0.58, Math.sin(a) * 0.12);
        s.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
        g.add(s);
    }
    return g;
}
function craftGen() {
    const g = genBase();
    const y = 0.05;
    g.add(at(box(0.72, 0.28, 0.56, PAL.kraft, { rough: 0.9 }, 0.03), 0, y + 0.14, 0.02));
    g.add(at(box(0.7, 0.02, 0.2, 0xb78747, { rough: 0.9 }, 0.006), 0, y + 0.3, 0.3, 0.9, 0, 0));
    g.add(at(box(0.7, 0.02, 0.2, 0xb78747, { rough: 0.9 }, 0.006), 0, y + 0.3, -0.26, -0.9, 0, 0));
    g.add(at(box(0.5, 0.02, 0.18, PAL.white, { rough: 0.8 }, 0.006), 0, y + 0.16, 0.285));
    g.add(at(sph(0.04, PAL.red), -0.16, y + 0.16, 0.3));
    g.add(at(sph(0.04, PAL.yellow), 0, y + 0.16, 0.3));
    g.add(at(sph(0.04, PAL.blue), 0.16, y + 0.16, 0.3));
    [[0xd8392b, -0.22, 0.12], [0xf2c230, -0.08, -0.05], [0x3b7fd0, 0.08, 0.1], [0x6d9c2e, 0.22, -0.04], [0xe9772b, 0.0, 0.0]].forEach(([c, x, z], i) => {
        const cr = new THREE.Group();
        cr.add(at(cyl(0.04, 0.04, 0.34, c), 0, 0.17, 0));
        cr.add(at(cone(0.04, 0.09, c, null, 12), 0, 0.385, 0));
        cr.position.set(x, y + 0.28, z);
        cr.rotation.set((z - 0.03) * 0.8, 0, -x * 1.2 + i * 0.03);
        g.add(cr);
    });
    g.add(at(leaf(0xe9772b, 0.26, 0.12, 0.02), 0.28, y + 0.5, -0.05, 0.5, 0.4, 0.3));
    g.add(at(leaf(0xc92f3c, 0.22, 0.1, 0.02), -0.3, y + 0.48, -0.02, 0.4, -0.4, -0.3));
    return g;
}

// ------------------------------------------------------------------ the catalogue

const BUILDERS = {
    craft: [crayons, paperLeaves, placeCard, handprintTurkey, pilgrimHat, thankfulTree],
    pumpkin: [pumpkinSeed, sprout, miniPumpkin, pumpkin, pumpkinPie, blueRibbonPie],
    turkey: [egg, chick, poult, gobbler, roastTurkey, feastPlatter],
    grain: [wheat, flourSack, dough, dinnerRoll, breadBasket, cornucopia],
};
const GENERATORS = { craft: craftGen, pumpkin: patchGen, turkey: coopGen, grain: barrelGen };

const protos = new Map();
/** A fresh clone of an item model (tier 1-6) or, with t = 'gen', the generator of that chain. */
export function getModel(c, t) {
    const key = `${c}:${t}`;
    let p = protos.get(key);
    if (!p) {
        p = t === 'gen' ? GENERATORS[c]() : BUILDERS[c][t - 1]();
        p.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        protos.set(key, p);
    }
    return p.clone(true);
}

export { leafGeo, starGeo };
