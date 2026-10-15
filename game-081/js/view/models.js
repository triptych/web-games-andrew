// The monsters of Gloamhollow and the clinic's cast, built in code.
//
// Every builder returns a Group facing +z, standing on y = 0, with userData.anim(t, mood) for its
// idle (mood: 'hurt' | 'idle' | 'happy') and userData.height. Parts are displaced icospheres with
// smooth normals, lathes, tubes and capsules, with physical materials: sheen for fur and cloth,
// clearcoat for slime and chitin, iridescence on scales, shell fur on the owlbear.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ghostMaterial, slimeMaterial, furShells } from './shaders.js';
import { hash3 } from '../rng.js';

let QUALITY = 1;
export const setModelQuality = (q) => { QUALITY = q; };

// ------------------------------------------------------------------ toolkit

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

function std(color, o = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.7, metalness: o.metal ?? 0, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, flatShading: !!o.flat });
}
function phys(color, o = {}) {
    return new THREE.MeshPhysicalMaterial({
        color, roughness: o.rough ?? 0.6, metalness: o.metal ?? 0,
        sheen: o.sheen ?? 0, sheenColor: new THREE.Color(o.sheenColor ?? color), sheenRoughness: 0.6,
        clearcoat: o.coat ?? 0, clearcoatRoughness: o.coatRough ?? 0.3, iridescence: o.irid ?? 0, iridescenceIOR: 1.6,
        emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, side: o.side ?? THREE.FrontSide,
    });
}
/** Skin: a soft sheen, like velvet under rim light. */
const skin = (c, o = {}) => phys(c, { rough: 0.62, sheen: 0.5, sheenColor: new THREE.Color(c).offsetHSL(0, -0.1, 0.25).getHex(), ...o });
const cloth = (c, o = {}) => phys(c, { rough: 0.9, sheen: 1, sheenColor: new THREE.Color(c).offsetHSL(0, 0, 0.3).getHex(), ...o });
const stone = (c) => std(c, { rough: 0.95 });

function mesh(geo, m, pos, rot, scale) {
    const o = new THREE.Mesh(geo, m);
    if (pos) o.position.copy(pos);
    if (rot) o.rotation.set(rot[0], rot[1], rot[2]);
    if (scale) typeof scale === 'number' ? o.scale.setScalar(scale) : o.scale.set(scale[0], scale[1], scale[2]);
    o.castShadow = true;
    return o;
}

/** A displaced icosphere with smooth normals. fn(v: unit dir) → radius multiplier. */
function blob(r, detail, fn = null, seed = 1) {
    let g = new THREE.IcosahedronGeometry(r, detail);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const d = v.clone().normalize();
        let k = fn ? fn(d) : 1;
        k *= 1 + (hash3(Math.round(d.x * 40), Math.round(d.y * 40), Math.round(d.z * 40) + seed) - 0.5) * 0.02;
        v.copy(d).multiplyScalar(r * k);
        p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
}

/** A lathe from [radius, y] pairs. */
const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y)), seg);

/** A tube along points with a radius that tapers from r0 to r1. */
function tube(points, r0, r1 = r0, seg = 24, radial = 10) {
    const curve = new THREE.CatmullRomCurve3(points);
    const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const ring = radial + 1;
    for (let i = 0; i <= seg; i++) {
        const t = i / seg;
        const r = r0 + (r1 - r0) * t;
        const c = curve.getPointAt(t);
        for (let j = 0; j < ring; j++) {
            const k = i * ring + j;
            p.setXYZ(k, c.x + n.getX(k) * r, c.y + n.getY(k) * r, c.z + n.getZ(k) * r);
        }
    }
    g.computeVertexNormals();
    return g;
}

/** A capsule between two points. */
function limb(a, b, r, m) {
    const d = b.clone().sub(a);
    const len = d.length();
    const o = mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2 + r * 0.6), 6, 12), m);
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(UP, d.normalize());
    return o;
}

/** A cartoon eye: white, iris, pupil and a catch-light; eyelid group scaled for blinks. */
function eye(r, iris = 0x3a2a10, o = {}) {
    const g = new THREE.Group();
    const lid = new THREE.Group();
    g.add(lid);
    const white = mesh(new THREE.SphereGeometry(r, 20, 14), phys(o.white ?? 0xf8f4ea, { rough: 0.2, coat: 1 }));
    lid.add(white);
    const ir = mesh(new THREE.CircleGeometry(r * 0.62, 20), std(iris, { rough: 0.3, emissive: o.glow ? iris : 0, ei: o.glow ? 1.6 : 0 }), V(0, 0, r * 0.985));
    lid.add(ir);
    const pu = mesh(new THREE.CircleGeometry(r * (o.slit ? 0.14 : 0.32), 16), std(0x050505, { rough: 0.2 }), V(0, 0, r * 0.99));
    if (o.slit) pu.scale.set(1, 3.2, 1);
    lid.add(pu);
    const hl = mesh(new THREE.CircleGeometry(r * 0.13, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), V(r * 0.25, r * 0.28, r * 1.0));
    lid.add(hl);
    g.userData.lid = lid;
    return g;
}

/** A glowing eye (sockets, ghosts, golems). */
function glowEye(r, color) {
    const g = new THREE.Group();
    g.add(mesh(new THREE.SphereGeometry(r, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2) })));
    g.userData.lid = g;
    return g;
}

/** A bat wing: a shape of finger bones with a membrane. side = ±1. */
function batWing(span, color, side, boneColor = color) {
    const g = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(span * 0.35, span * 0.45);
    s.quadraticCurveTo(span * 0.55, span * 0.5, span, span * 0.25);
    s.quadraticCurveTo(span * 0.82, span * 0.05, span * 0.85, -span * 0.12);
    s.quadraticCurveTo(span * 0.62, -span * 0.02, span * 0.6, -span * 0.3);
    s.quadraticCurveTo(span * 0.42, -span * 0.12, span * 0.32, -span * 0.38);
    s.quadraticCurveTo(span * 0.2, -span * 0.12, 0, -span * 0.15);
    s.lineTo(0, 0);
    const memb = mesh(new THREE.ShapeGeometry(s, 12), phys(color, { rough: 0.7, sheen: 0.6, side: THREE.DoubleSide }));
    memb.scale.x = side;
    g.add(memb);
    const bm = std(boneColor, { rough: 0.6 });
    for (const [x, y] of [[span, span * 0.25], [span * 0.85, -span * 0.12], [span * 0.6, -span * 0.3], [span * 0.32, -span * 0.38]]) {
        g.add(limb(V(span * 0.35 * side, span * 0.45, 0.01), V(x * side, y, 0.01), span * 0.018, bm));
    }
    g.add(limb(V(0, 0, 0.01), V(span * 0.35 * side, span * 0.45, 0.01), span * 0.025, bm));
    return g;
}

/** Curved horn. */
function horn(len, r, color, curl = 0.6, side = 1) {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        pts.push(V(side * (t * len * 0.35 + Math.sin(t * curl * 2) * len * 0.15), t * len * 0.8, -Math.sin(t * curl * 3) * len * 0.35));
    }
    return mesh(tube(pts, r, r * 0.08, 20, 10), phys(color, { rough: 0.45, coat: 0.6 }));
}

function finish(g, height, anim, extra = {}) {
    g.userData.height = height;
    g.userData.anim = anim;
    Object.assign(g.userData, extra);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
}

/** A blink value 0..1 for time t, seeded so a room of monsters doesn't blink in unison. */
const blink = (t, seed) => { const p = (t + seed * 1.7) % 4.3; return p < 0.12 ? 0.1 : 1; };
const setBlink = (eyes, b) => { for (const e of eyes) e.userData.lid.scale.y = b; };

// ------------------------------------------------------------------ species

function goblin(o = {}) {
    const g = new THREE.Group();
    const green = o.skin ?? 0x6faa3e;
    const S = skin(green);
    const body = new THREE.Group(); g.add(body);
    // legs and feet
    for (const s of [-1, 1]) {
        body.add(limb(V(0.09 * s, 0.05, 0), V(0.1 * s, 0.32, 0), 0.055, S));
        body.add(mesh(new THREE.SphereGeometry(0.08, 14, 10), S, V(0.11 * s, 0.04, 0.05), null, [1, 0.6, 1.5]));
    }
    // tunic
    const tunic = mesh(lathe([[0.01, 0.28], [0.2, 0.3], [0.22, 0.42], [0.19, 0.6], [0.13, 0.68], [0.01, 0.7]]), cloth(o.cloth ?? 0x7a4a26));
    body.add(tunic);
    body.add(mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24), std(0x3a2510), V(0, 0.4, 0), [Math.PI / 2, 0, 0]));
    // arms
    const arms = [];
    for (const s of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(0.17 * s, 0.62, 0);
        arm.add(limb(V(0, 0, 0), V(0.1 * s, -0.25, 0.06), 0.045, S));
        arm.add(mesh(new THREE.SphereGeometry(0.06, 12, 10), S, V(0.11 * s, -0.28, 0.07)));
        body.add(arm); arms.push(arm);
    }
    // head
    const head = new THREE.Group(); head.position.y = 0.86; body.add(head);
    head.add(mesh(blob(0.22, 3, (d) => 1 + d.y * 0.08 - Math.max(0, -d.y) * 0.15), S));
    head.add(mesh(new THREE.ConeGeometry(0.055, 0.2, 12), S, V(0, -0.02, 0.24), [Math.PI / 2.3, 0, 0]));
    for (const s of [-1, 1]) {
        const ear = mesh(new THREE.ConeGeometry(0.09, 0.42, 4, 1), S, V(0.26 * s, 0.06, -0.02), [0, 0, -s * 1.25], [1, 1, 0.35]);
        head.add(ear);
    }
    const eyes = [-1, 1].map((s) => { const e = eye(0.065, 0xd8b020, { slit: true }); e.position.set(0.09 * s, 0.07, 0.17); head.add(e); return e; });
    head.add(mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 16, Math.PI), std(0x2a1a10), V(0, -0.1, 0.19), [0, 0, Math.PI]));
    const seed = Math.random() * 10;
    return finish(g, 1.1, (t, mood) => {
        const bob = mood === 'happy' ? Math.abs(Math.sin(t * 7)) * 0.08 : Math.sin(t * 2) * 0.01;
        body.position.y = bob;
        head.rotation.z = mood === 'hurt' ? Math.sin(t * 1.3) * 0.08 + 0.12 : Math.sin(t * 1.1) * 0.05;
        head.rotation.x = mood === 'hurt' ? 0.18 : 0;
        arms[0].rotation.z = mood === 'happy' ? -2.2 + Math.sin(t * 9) * 0.3 : Math.sin(t * 1.6) * 0.06;
        arms[1].rotation.z = mood === 'happy' ? 2.2 - Math.sin(t * 9) * 0.3 : -Math.sin(t * 1.6) * 0.06;
        setBlink(eyes, blink(t, seed));
    }, { head });
}

function slime(o = {}) {
    const g = new THREE.Group();
    const color = o.color ?? 0x5fd36a;
    const body = new THREE.Group(); g.add(body);
    const jelly = mesh(blob(0.5, 4, (d) => (d.y < 0 ? 1 + d.y * 0.55 : 1 + d.y * 0.15) * (1 + Math.sin(d.x * 6) * 0.02)), slimeMaterial(color, QUALITY), V(0, 0.32, 0));
    body.add(jelly);
    const core = mesh(new THREE.IcosahedronGeometry(0.13, 2), std(0xfff0a0, { emissive: 0xffd040, ei: 1.4 }), V(0, 0.3, -0.05));
    body.add(core);
    for (let i = 0; i < 9; i++) {
        const b = mesh(new THREE.SphereGeometry(0.02 + (i % 3) * 0.012, 8, 6), phys(0xffffff, { rough: 0.05, coat: 1 }), V((hash3(i, 1) - 0.5) * 0.6, 0.12 + hash3(i, 2) * 0.5, (hash3(i, 3) - 0.5) * 0.5));
        b.material.transparent = true; b.material.opacity = 0.45;
        body.add(b);
    }
    const eyes = [-1, 1].map((s) => { const e = eye(0.075, 0x102018); e.position.set(0.15 * s, 0.52, 0.36); body.add(e); return e; });
    body.add(mesh(new THREE.TorusGeometry(0.08, 0.014, 6, 16, Math.PI), std(0x103018), V(0, 0.38, 0.45), [0.3, 0, Math.PI]));
    const seed = Math.random() * 10;
    return finish(g, 0.9, (t, mood) => {
        const f = mood === 'happy' ? 6 : mood === 'hurt' ? 1.2 : 2.2;
        const a = mood === 'happy' ? 0.14 : 0.05;
        const s = Math.sin(t * f) * a;
        body.scale.set(1 + s * 0.6, 1 - s, 1 + s * 0.6);
        body.position.y = mood === 'happy' ? Math.max(0, Math.sin(t * f)) * 0.2 : 0;
        core.rotation.y = t * 0.8;
        setBlink(eyes, blink(t, seed));
    });
}

function myconid(o = {}) {
    const g = new THREE.Group();
    const capC = o.cap ?? 0xc0402e;
    const body = new THREE.Group(); g.add(body);
    const stemM = skin(0xe8dcc0);
    body.add(mesh(lathe([[0.01, 0], [0.2, 0.02], [0.24, 0.1], [0.18, 0.4], [0.15, 0.7], [0.17, 0.8], [0.01, 0.82]]), stemM));
    for (const s of [-1, 1]) body.add(mesh(tube([V(0.15 * s, 0.55, 0), V(0.3 * s, 0.42, 0.05), V(0.33 * s, 0.2, 0.1)], 0.04, 0.02), stemM));
    const cap = new THREE.Group(); cap.position.y = 0.78; body.add(cap);
    cap.add(mesh(lathe([[0.62, 0], [0.6, 0.06], [0.5, 0.2], [0.32, 0.32], [0.01, 0.38]], 36), phys(capC, { rough: 0.45, coat: 0.6 })));
    cap.add(mesh(lathe([[0.01, 0.0], [0.6, -0.01], [0.62, 0]], 36), std(0xd8c2a0, { rough: 1 })));
    for (let i = 0; i < 14; i++) {
        const a = hash3(i, 7) * Math.PI * 2, r = 0.12 + hash3(i, 8) * 0.4;
        const y = 0.38 - (r / 0.62) ** 2 * 0.32;
        cap.add(mesh(new THREE.SphereGeometry(0.035 + hash3(i, 9) * 0.03, 10, 6), std(0xfaf2e0), V(Math.cos(a) * r, y, Math.sin(a) * r), null, [1, 0.4, 1]));
    }
    const eyes = [-1, 1].map((s) => { const e = eye(0.045, 0x1a1a1a); e.position.set(0.07 * s, 0.55, 0.16); body.add(e); return e; });
    const glow = new THREE.PointLight(0xffd090, 0.5, 2);
    glow.position.set(0, 0.7, 0.3); body.add(glow);
    const seed = Math.random() * 10;
    return finish(g, 1.3, (t, mood) => {
        cap.rotation.z = Math.sin(t * 1.2) * (mood === 'hurt' ? 0.12 : 0.04);
        cap.rotation.x = mood === 'hurt' ? 0.15 : 0;
        body.position.y = mood === 'happy' ? Math.abs(Math.sin(t * 5)) * 0.1 : 0;
        setBlink(eyes, blink(t, seed));
    });
}

function imp(o = {}) {
    const g = new THREE.Group();
    const red = o.skin ?? 0xc23a2a;
    const S = skin(red);
    const body = new THREE.Group(); body.position.y = 0.25; g.add(body);
    body.add(mesh(blob(0.18, 3, (d) => 1 + d.y * 0.2), S, V(0, 0.15, 0), null, [1, 1.2, 0.9]));
    for (const s of [-1, 1]) {
        body.add(limb(V(0.08 * s, 0, 0), V(0.1 * s, -0.22, 0.03), 0.035, S));
        body.add(limb(V(0.14 * s, 0.25, 0), V(0.22 * s, 0.08, 0.1), 0.03, S));
    }
    const head = new THREE.Group(); head.position.y = 0.45; body.add(head);
    head.add(mesh(blob(0.17, 3, (d) => 1 - Math.max(0, -d.y) * 0.2), S));
    for (const s of [-1, 1]) {
        head.add(horn(0.18, 0.03, 0x2a1a14, 0.4, s).translateX(0.08 * s).translateY(0.1));
        head.add(mesh(new THREE.ConeGeometry(0.05, 0.16, 4), S, V(0.18 * s, 0.02, 0), [0, 0, -s * 1.3], [1, 1, 0.4]));
    }
    const eyes = [-1, 1].map((s) => { const e = eye(0.05, 0xffc020, { glow: true, slit: true }); e.position.set(0.065 * s, 0.03, 0.14); head.add(e); return e; });
    head.add(mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 12, Math.PI), std(0x200808), V(0, -0.07, 0.15), [0, 0, Math.PI]));
    const wings = [-1, 1].map((s) => { const w = batWing(0.42, 0x6a1a20, s, 0x3a0c0c); w.position.set(0.06 * s, 0.25, -0.12); body.add(w); return w; });
    body.add(mesh(tube([V(0, 0.02, -0.12), V(0, -0.1, -0.3), V(0.08, -0.15, -0.45), V(0.12, 0.0, -0.55)], 0.025, 0.01), S));
    body.add(mesh(new THREE.ConeGeometry(0.04, 0.08, 3), S, V(0.13, 0.04, -0.57), [0.6, 0, -0.4]));
    const seed = Math.random() * 10;
    return finish(g, 0.8, (t, mood) => {
        const fl = mood === 'hurt' ? 0.15 : 0.6;
        const sp = mood === 'happy' ? 16 : 9;
        wings[0].rotation.y = 0.3 + Math.sin(t * sp) * fl;
        wings[1].rotation.y = -0.3 - Math.sin(t * sp) * fl;
        body.position.y = 0.25 + (mood === 'hurt' ? -0.12 : Math.sin(t * 3) * 0.06 + (mood === 'happy' ? 0.2 : 0));
        head.rotation.z = Math.sin(t * 1.4) * 0.08;
        setBlink(eyes, blink(t, seed));
    });
}

function owlbear(o = {}) {
    const g = new THREE.Group();
    const brown = 0x6b4a2c;
    const body = new THREE.Group(); g.add(body);
    const torsoGeo = blob(0.8, 4, (d) => 1 + Math.max(0, -d.y) * 0.1 - Math.max(0, d.y) * 0.08);
    const torsoM = phys(brown, { rough: 1, sheen: 1, sheenColor: 0xc89a60 });
    const torso = mesh(torsoGeo, torsoM, V(0, 0.95, 0), null, [1, 1.15, 0.9]);
    body.add(torso);
    const fur = furShells(torsoGeo, brown, { layers: 10, length: 0.09, density: 70, quality: QUALITY });
    fur.position.copy(torso.position); fur.scale.copy(torso.scale);
    body.add(fur);
    for (const s of [-1, 1]) {
        body.add(limb(V(0.42 * s, 0.4, 0.05), V(0.48 * s, 0.05, 0.12), 0.2, torsoM));
        const arm = limb(V(0.72 * s, 1.3, 0.1), V(0.85 * s, 0.6, 0.35), 0.17, torsoM);
        body.add(arm);
        for (let k = -1; k <= 1; k++) body.add(mesh(new THREE.ConeGeometry(0.035, 0.14, 8), std(0xe8e0c8, { rough: 0.3 }), V(0.86 * s + k * 0.06, 0.48, 0.45), [1.2, 0, 0]));
    }
    // the cream feathered belly
    body.add(mesh(blob(0.52, 3), phys(0xc8a878, { rough: 1, sheen: 1 }), V(0, 0.85, 0.42), null, [1, 1.2, 0.5]));
    const head = new THREE.Group(); head.position.set(0, 1.85, 0.12); body.add(head);
    const hg = blob(0.48, 4, (d) => 1 + Math.abs(d.x) * 0.1);
    head.add(mesh(hg, torsoM));
    const hf = furShells(hg, brown, { layers: 8, length: 0.06, density: 80, quality: QUALITY });
    head.add(hf);
    // facial disc and beak
    for (const s of [-1, 1]) head.add(mesh(new THREE.CircleGeometry(0.2, 24), phys(0xe8d4a8, { rough: 1, sheen: 1, side: THREE.DoubleSide }), V(0.16 * s, 0.05, 0.43), [0, s * 0.35, 0]));
    head.add(mesh(new THREE.ConeGeometry(0.08, 0.26, 12), phys(0xe0a020, { rough: 0.3, coat: 1 }), V(0, -0.08, 0.5), [Math.PI / 2 + 0.6, 0, 0]));
    for (const s of [-1, 1]) head.add(mesh(new THREE.ConeGeometry(0.09, 0.3, 6), torsoM, V(0.3 * s, 0.42, -0.05), [0, 0, -s * 0.35]));
    const eyes = [-1, 1].map((s) => { const e = eye(0.11, 0xf08a10, { glow: true }); e.position.set(0.16 * s, 0.08, 0.42); head.add(e); return e; });
    // golden arrows stuck in her while she is hurt
    const arrows = new THREE.Group();
    for (const [x, y, z, rx, ry] of [[0.4, 1.2, 0.5, 0.4, 0.5], [-0.5, 0.9, 0.4, 0.2, -0.6], [0.1, 1.4, -0.6, -0.5, 0.2]]) {
        const a = new THREE.Group();
        a.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), std(0xd4a020, { metal: 0.8, rough: 0.3 }), V(0, 0.2, 0)));
        a.add(mesh(new THREE.ConeGeometry(0.05, 0.12, 3), std(0xffe08a, { metal: 0.7, rough: 0.3 }), V(0, 0.48, 0)));
        a.position.set(x, y, z); a.rotation.set(rx, ry, 0.6);
        arrows.add(a);
    }
    body.add(arrows);
    const seed = Math.random() * 10;
    return finish(g, 2.3, (t, mood) => {
        arrows.visible = mood === 'hurt';
        body.position.y = mood === 'happy' ? Math.abs(Math.sin(t * 3)) * 0.05 : Math.sin(t * 1.2) * 0.015;
        body.rotation.z = mood === 'hurt' ? 0.06 : 0;
        head.rotation.z = Math.sin(t * 0.8) * 0.1 + (mood === 'hurt' ? 0.15 : 0);
        head.rotation.y = Math.sin(t * 0.5) * 0.15;
        torso.scale.y = 1.15 + Math.sin(t * 1.6) * 0.015;
        setBlink(eyes, blink(t, seed));
    });
}

function skeleton(o = {}) {
    const g = new THREE.Group();
    const B = phys(0xe9dfc4, { rough: 0.55, coat: 0.2 });
    const body = new THREE.Group(); g.add(body);
    for (const s of [-1, 1]) {
        body.add(limb(V(0.1 * s, 0.05, 0), V(0.1 * s, 0.45, 0), 0.03, B));
        body.add(limb(V(0.1 * s, 0.48, 0), V(0.09 * s, 0.85, 0), 0.032, B));
        body.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), B, V(0.1 * s, 0.46, 0.01)));
        body.add(mesh(new THREE.BoxGeometry(0.08, 0.04, 0.16), B, V(0.1 * s, 0.03, 0.04)));
    }
    body.add(mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 16), B, V(0, 0.9, 0), [Math.PI / 2, 0, 0], [1.2, 1, 0.7]));
    for (let i = 0; i < 8; i++) body.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.05, 8), B, V(0, 0.95 + i * 0.055, -0.04)));
    const ribs = new THREE.Group(); ribs.position.set(0, 1.2, 0); body.add(ribs);
    for (let i = 0; i < 5; i++) ribs.add(mesh(new THREE.TorusGeometry(0.15 - i * 0.012, 0.016, 6, 20, Math.PI * 1.6), B, V(0, i * 0.055 - 0.08, 0.02), [Math.PI / 2, 0, Math.PI * 0.7], [1.1, 0.75, 1]));
    ribs.add(mesh(new THREE.BoxGeometry(0.03, 0.26, 0.02), B, V(0, 0, 0.15)));
    const sigils = new THREE.Group();
    for (let i = 0; i < 3; i++) sigils.add(mesh(new THREE.TorusGeometry(0.04, 0.006, 4, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xb070ff).multiplyScalar(2) }), V(-0.08 + i * 0.08, 0.05 - i * 0.03, 0.15)));
    ribs.add(sigils);
    const arms = [];
    for (const s of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(0.2 * s, 1.36, 0);
        arm.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), B));
        arm.add(limb(V(0, 0, 0), V(0.04 * s, -0.3, 0.02), 0.026, B));
        arm.add(limb(V(0.04 * s, -0.32, 0.02), V(0.06 * s, -0.6, 0.1), 0.022, B));
        body.add(arm); arms.push(arm);
    }
    const head = new THREE.Group(); head.position.y = 1.6; body.add(head);
    head.add(mesh(blob(0.15, 3, (d) => 1 + Math.max(0, d.y) * 0.12 - Math.max(0, -d.z) * 0.05), B, V(0, 0.04, 0)));
    head.add(mesh(new THREE.BoxGeometry(0.16, 0.06, 0.13), B, V(0, -0.1, 0.04)));
    const eyes = [-1, 1].map((s) => {
        head.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), std(0x080605), V(0.055 * s, 0.03, 0.115)));
        const e = glowEye(0.016, o.eyes ?? 0x6ad0ff); e.position.set(0.055 * s, 0.03, 0.14); head.add(e); return e;
    });
    for (let i = 0; i < 5; i++) head.add(mesh(new THREE.BoxGeometry(0.018, 0.025, 0.01), std(0xf4ecd8), V(-0.04 + i * 0.02, -0.07, 0.11)));
    if (o.nurse) {
        head.add(mesh(lathe([[0.15, 0], [0.16, 0.06], [0.1, 0.1], [0.01, 0.1]]), cloth(0xf4f0ea), V(0, 0.12, -0.01), [-0.25, 0, 0]));
        head.add(mesh(new THREE.BoxGeometry(0.05, 0.015, 0.01), std(0xd03040), V(0, 0.19, 0.12)));
        head.add(mesh(new THREE.BoxGeometry(0.015, 0.05, 0.01), std(0xd03040), V(0, 0.19, 0.12)));
        body.add(mesh(lathe([[0.17, 0.7], [0.21, 0.95], [0.19, 1.25], [0.16, 1.4], [0.01, 1.42]]), cloth(0x7aa6c8), null, null, [1, 1, 0.8]));
        body.add(mesh(new THREE.PlaneGeometry(0.26, 0.5), cloth(0xf4f0ea, { side: THREE.DoubleSide }), V(0, 1.0, 0.18)));
    }
    const seed = Math.random() * 10;
    return finish(g, 1.75, (t, mood) => {
        sigils.visible = mood === 'hurt' && !o.nurse;
        body.position.x = mood === 'hurt' ? Math.sin(t * 40) * 0.004 : 0;
        head.rotation.z = Math.sin(t * 1.2) * 0.06;
        head.rotation.x = mood === 'hurt' ? 0.15 : 0;
        arms[0].rotation.z = mood === 'happy' ? -2.4 + Math.sin(t * 8) * 0.3 : 0.05;
        arms[1].rotation.z = mood === 'happy' ? 2.4 - Math.sin(t * 8) * 0.3 : -0.05;
        setBlink(eyes, blink(t, seed) > 0.5 ? 1 : 0.2);
    });
}

function ghost(o = {}) {
    const g = new THREE.Group();
    const color = o.color ?? 0xbfe6ff;
    const body = new THREE.Group(); body.position.y = 0.25; g.add(body);
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([Math.sin(t * Math.PI * 0.5 + 0.08) * 0.42 * (1 - t * t * 0.15), 1.0 - t * 1.0]); }
    const geo = lathe(pts.reverse(), 40);
    // a wavy hem
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (y < 0.15) { const a = Math.atan2(p.getZ(i), p.getX(i)); p.setY(i, y + Math.sin(a * 6) * 0.06 * (0.15 - y) / 0.15); }
    }
    geo.computeVertexNormals();
    const sheet = mesh(geo, ghostMaterial(color));
    sheet.castShadow = false;
    body.add(sheet);
    const eyes = [-1, 1].map((s) => { const e = new THREE.Group(); e.add(mesh(new THREE.SphereGeometry(0.06, 12, 10), std(0x0a1020, { rough: 0.2 }), null, null, [1, 1.3, 0.5])); e.userData.lid = e; e.position.set(0.13 * s, 0.72, 0.38); body.add(e); return e; });
    body.add(mesh(new THREE.SphereGeometry(0.05, 12, 10), std(0x0a1020), V(0, 0.55, 0.4), null, [1, 1.4, 0.5]));
    const light = new THREE.PointLight(color, 0.8, 3); light.position.set(0, 0.6, 0); body.add(light);
    const seed = Math.random() * 10;
    return finish(g, 1.2, (t, mood) => {
        body.position.y = 0.25 + Math.sin(t * 1.6) * 0.08 + (mood === 'happy' ? 0.15 : 0);
        body.rotation.z = Math.sin(t * 0.9) * 0.05;
        setBlink(eyes, mood === 'hurt' ? 0.5 : blink(t, seed));
    });
}

function banshee() {
    const g = new THREE.Group();
    const body = new THREE.Group(); body.position.y = 0.2; g.add(body);
    const gm = ghostMaterial(0xd8ecff, 1.2);
    const gown = mesh(lathe([[0.55, 0], [0.42, 0.3], [0.3, 0.8], [0.22, 1.2], [0.18, 1.45], [0.2, 1.55], [0.01, 1.6]], 40), gm);
    gown.castShadow = false;
    body.add(gown);
    const head = new THREE.Group(); head.position.y = 1.78; body.add(head);
    head.add(mesh(blob(0.16, 3, (d) => 1 + Math.max(0, -d.y) * 0.15), phys(0xe6f0ff, { rough: 0.3, emissive: 0x405870, ei: 0.6 })));
    const hair = new THREE.Group(); head.add(hair);
    for (let i = 0; i < 9; i++) {
        const a = (i / 8 - 0.5) * 2.6;
        const x = Math.sin(a) * 0.15, z = -Math.cos(a) * 0.12;
        hair.add(mesh(tube([V(x, 0.1, z), V(x * 1.5, -0.2, z - 0.1), V(x * 1.8, -0.6, z - 0.15), V(x * 1.6, -1.0, z - 0.25)], 0.035, 0.005, 16, 6), gm));
    }
    const eyes = [-1, 1].map((s) => { const e = glowEye(0.025, 0x9ad8ff); e.position.set(0.055 * s, 0.02, 0.14); head.add(e); return e; });
    const mouth = mesh(new THREE.SphereGeometry(0.035, 10, 8), std(0x101828), V(0, -0.07, 0.14), null, [1, 1.5, 0.5]);
    head.add(mouth);
    const chains = new THREE.Group();
    for (let i = 0; i < 7; i++) chains.add(mesh(new THREE.TorusGeometry(0.06, 0.015, 6, 12), std(0x9a8a70, { metal: 0.8, rough: 0.4, emissive: 0x5a2a80, ei: 0.6 }), V(Math.cos(i * 0.9) * 0.3, 1.1 + i * 0.03, Math.sin(i * 0.9) * 0.3), [i, i * 0.7, 0]));
    body.add(chains);
    for (const s of [-1, 1]) body.add(mesh(tube([V(0.18 * s, 1.5, 0), V(0.35 * s, 1.2, 0.15), V(0.4 * s, 0.95, 0.3)], 0.04, 0.025), gm));
    const light = new THREE.PointLight(0xa0d8ff, 1.2, 5); light.position.set(0, 1.4, 0.4); body.add(light);
    return finish(g, 2.1, (t, mood) => {
        chains.visible = mood === 'hurt';
        chains.rotation.y = t * 0.6;
        body.position.y = 0.2 + Math.sin(t * 1.1) * 0.1;
        mouth.scale.y = mood === 'hurt' ? 2.6 + Math.sin(t * 20) * 0.4 : 1.2;
        hair.rotation.x = Math.sin(t * 1.3) * 0.08 - 0.05;
        head.rotation.z = Math.sin(t * 0.7) * 0.08;
        setBlink(eyes, 1);
    });
}

function kobold() {
    const g = new THREE.Group();
    const S = phys(0xc8602a, { rough: 0.45, irid: 0.35, coat: 0.3 });
    const body = new THREE.Group(); g.add(body);
    body.add(mesh(blob(0.2, 3), S, V(0, 0.42, 0), null, [1, 1.3, 0.9]));
    body.add(mesh(blob(0.14, 2), phys(0xe8b070, { rough: 0.6 }), V(0, 0.4, 0.1), null, [1, 1.3, 0.6]));
    for (const s of [-1, 1]) {
        body.add(limb(V(0.1 * s, 0.25, 0), V(0.12 * s, 0.03, 0.06), 0.05, S));
        body.add(limb(V(0.17 * s, 0.55, 0), V(0.24 * s, 0.32, 0.1), 0.035, S));
    }
    body.add(mesh(tube([V(0, 0.3, -0.15), V(0, 0.15, -0.35), V(0.1, 0.06, -0.55), V(0.2, 0.08, -0.7)], 0.07, 0.01), S));
    const head = new THREE.Group(); head.position.y = 0.78; body.add(head);
    head.add(mesh(blob(0.15, 3), S));
    head.add(mesh(blob(0.1, 2), S, V(0, -0.04, 0.14), null, [0.9, 0.7, 1.3]));
    for (const s of [-1, 1]) head.add(horn(0.12, 0.02, 0xe8dcc0, 0.3, s).translateX(0.07 * s).translateY(0.08).translateZ(-0.05));
    const eyes = [-1, 1].map((s) => { const e = eye(0.045, 0xffd030, { slit: true }); e.position.set(0.08 * s, 0.05, 0.1); head.add(e); return e; });
    // mining helmet with a candle
    const helm = new THREE.Group(); helm.position.set(0, 0.1, 0); head.add(helm);
    helm.add(mesh(new THREE.SphereGeometry(0.17, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0x8a6a2a, { metal: 0.6, rough: 0.4 })));
    helm.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 10), std(0xf0e6c8), V(0, 0.2, 0.06)));
    const flame = mesh(new THREE.ConeGeometry(0.02, 0.06, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.0, 0.3) }), V(0, 0.27, 0.06));
    helm.add(flame);
    const lt = new THREE.PointLight(0xffb060, 0.7, 3); lt.position.set(0, 0.3, 0.1); helm.add(lt);
    const seed = Math.random() * 10;
    return finish(g, 1.0, (t, mood) => {
        body.position.y = mood === 'happy' ? Math.abs(Math.sin(t * 8)) * 0.1 : 0;
        head.rotation.z = Math.sin(t * 1.8) * 0.07;
        flame.scale.y = 1 + Math.sin(t * 17) * 0.2;
        setBlink(eyes, blink(t, seed));
    });
}

function golem(o = {}) {
    const g = new THREE.Group();
    const R = stone(o.stone ?? 0x7a7670);
    const rune = new THREE.MeshBasicMaterial({ color: new THREE.Color(o.rune ?? 0x40d0ff).multiplyScalar(2) });
    const body = new THREE.Group(); g.add(body);
    const rb = (w, h, d, pos, rot) => mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.18), R, pos, rot);
    body.add(rb(0.95, 0.8, 0.6, V(0, 1.35, 0)));
    body.add(rb(0.6, 0.45, 0.45, V(0, 0.8, 0)));
    for (const s of [-1, 1]) {
        body.add(rb(0.3, 0.6, 0.3, V(0.2 * s, 0.3, 0)));
        body.add(rb(0.3, 0.55, 0.3, V(0.65 * s, 1.15, 0.05), [0, 0, s * 0.1]));
        body.add(rb(0.38, 0.38, 0.38, V(0.7 * s, 0.7, 0.1)));
        body.add(mesh(new THREE.BoxGeometry(0.04, 0.4, 0.01), rune, V(0.2 * s, 1.4, 0.305)));
    }
    body.add(mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 6), rune, V(0, 1.4, 0.31)));
    const head = rb(0.45, 0.38, 0.4, V(0, 1.98, 0.05));
    body.add(head);
    const eyes = [-1, 1].map((s) => { const e = glowEye(0.04, o.rune ?? 0x40d0ff); e.position.set(0.1 * s, 2.0, 0.26); body.add(e); return e; });
    for (let i = 0; i < 6; i++) body.add(mesh(blob(0.08, 1), std(0x4a6a2a, { rough: 1 }), V((hash3(i, 3) - 0.5) * 0.8, 1.7 + hash3(i, 4) * 0.1, (hash3(i, 5) - 0.5) * 0.4), null, [1.5, 0.4, 1.5]));
    const chains = new THREE.Group();
    for (let i = 0; i < 6; i++) chains.add(mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 10), std(0xc0a040, { metal: 0.8, rough: 0.3 }), V(-0.45 + i * 0.18, 1.1 + Math.sin(i) * 0.05, 0.32), [0, i % 2 ? Math.PI / 2 : 0, 0]));
    body.add(chains);
    return finish(g, 2.4, (t, mood) => {
        chains.visible = mood === 'hurt';
        body.rotation.z = mood === 'hurt' ? Math.sin(t * 2) * 0.02 : 0;
        body.position.y = mood === 'happy' ? Math.abs(Math.sin(t * 3)) * 0.06 : 0;
        rune.color.setScalar(1).multiply(new THREE.Color(o.rune ?? 0x40d0ff)).multiplyScalar(1.4 + Math.sin(t * 2) * 0.6);
        setBlink(eyes, 1);
    });
}

function gargoyle() {
    const g = new THREE.Group();
    const R = std(0x6c6e74, { rough: 0.9 });
    const body = new THREE.Group(); g.add(body);
    body.add(mesh(blob(0.32, 3), R, V(0, 0.65, 0), [0.4, 0, 0], [1, 1.3, 0.9]));
    for (const s of [-1, 1]) {
        body.add(limb(V(0.2 * s, 0.4, 0.1), V(0.25 * s, 0.05, 0.25), 0.08, R));
        body.add(limb(V(0.25 * s, 0.85, 0.15), V(0.22 * s, 0.25, 0.35), 0.06, R));
        const w = batWing(0.75, 0x55575c, s, 0x3c3e44);
        w.position.set(0.12 * s, 0.95, -0.15); w.rotation.set(0.2, s * 0.9, 0); body.add(w);
    }
    body.add(mesh(tube([V(0, 0.4, -0.25), V(0, 0.15, -0.5), V(0.2, 0.06, -0.7), V(0.4, 0.15, -0.75)], 0.06, 0.015), R));
    const head = new THREE.Group(); head.position.set(0, 1.2, 0.25); body.add(head);
    head.add(mesh(blob(0.2, 3, (d) => 1 + Math.max(0, d.z) * 0.2), R));
    for (const s of [-1, 1]) head.add(horn(0.3, 0.04, 0x46484e, 0.8, s).translateX(0.1 * s).translateY(0.1));
    for (const s of [-1, 1]) head.add(mesh(new THREE.ConeGeometry(0.018, 0.07, 6), std(0xe0dcd0), V(0.06 * s, -0.12, 0.17), [Math.PI, 0, 0]));
    const eyes = [-1, 1].map((s) => { const e = glowEye(0.025, 0xffa040); e.position.set(0.08 * s, 0.04, 0.18); head.add(e); return e; });
    return finish(g, 1.6, (t, mood) => {
        head.rotation.y = Math.sin(t * 0.6) * 0.3;
        head.rotation.z = mood === 'hurt' ? Math.sin(t * 6) * 0.1 : 0;
        body.position.y = mood === 'happy' ? Math.abs(Math.sin(t * 4)) * 0.06 : 0;
        setBlink(eyes, 1);
    });
}

function troll() {
    const g = new THREE.Group();
    const S = skin(0x6e8a60);
    const body = new THREE.Group(); g.add(body);
    body.add(mesh(blob(0.6, 4, (d) => 1 + Math.max(0, d.z) * 0.1), S, V(0, 1.3, -0.05), [0.25, 0, 0], [1, 1.15, 0.85]));
    body.add(mesh(lathe([[0.45, 0.7], [0.5, 0.85], [0.42, 1.05], [0.01, 1.06]]), cloth(0x6a4a2a)));
    for (const s of [-1, 1]) {
        body.add(limb(V(0.25 * s, 0.75, 0), V(0.3 * s, 0.1, 0.05), 0.14, S));
        body.add(mesh(new THREE.SphereGeometry(0.16, 12, 8), S, V(0.32 * s, 0.07, 0.12), null, [1, 0.5, 1.5]));
        body.add(limb(V(0.6 * s, 1.65, 0.1), V(0.75 * s, 0.6, 0.35), 0.13, S));
        body.add(mesh(new THREE.SphereGeometry(0.17, 12, 10), S, V(0.77 * s, 0.5, 0.38)));
    }
    const head = new THREE.Group(); head.position.set(0, 1.95, 0.35); body.add(head);
    head.add(mesh(blob(0.3, 3, (d) => 1 - Math.max(0, d.y) * 0.15 + Math.max(0, -d.y) * 0.1), S));
    head.add(mesh(blob(0.12, 2), S, V(0, -0.02, 0.3), null, [1, 1.3, 1.4]));
    for (const s of [-1, 1]) head.add(mesh(new THREE.ConeGeometry(0.04, 0.14, 8), std(0xf0e6c8, { rough: 0.4 }), V(0.12 * s, -0.17, 0.22), [-0.3, 0, -s * 0.2]));
    const eyes = [-1, 1].map((s) => { const e = eye(0.045, 0x8a3010); e.position.set(0.1 * s, 0.08, 0.26); head.add(e); return e; });
    for (let i = 0; i < 6; i++) head.add(mesh(tube([V((i - 2.5) * 0.04, 0.28, -0.02), V((i - 2.5) * 0.06, 0.42, -0.1), V((i - 2.5) * 0.08, 0.38, -0.22)], 0.02, 0.005, 8, 5), cloth(0x2a3a20)));
    const seed = Math.random() * 10;
    return finish(g, 2.5, (t, mood) => {
        body.rotation.z = mood === 'hurt' ? 0.05 : Math.sin(t * 0.8) * 0.02;
        body.position.y = mood === 'happy' ? Math.abs(Math.sin(t * 3)) * 0.07 : 0;
        head.rotation.z = Math.sin(t * 1.1) * 0.06;
        setBlink(eyes, blink(t, seed));
    });
}

function dragon() {
    const g = new THREE.Group();
    const scales = phys(0x7a2012, { rough: 0.6, coat: 0.2, coatRough: 0.6, irid: 0.7, metal: 0.1 });
    const belly = phys(0xc88040, { rough: 0.6, emissive: 0xff5010, ei: 0.12 });
    const body = new THREE.Group(); g.add(body);
    const torso = mesh(blob(1.0, 4, (d) => 1 - Math.max(0, d.y) * 0.1), scales, V(0, 1.1, -0.4), null, [1.1, 0.9, 1.6]);
    body.add(torso);
    body.add(mesh(blob(0.8, 3), belly, V(0, 0.85, -0.2), null, [1.05, 0.6, 1.6]));
    for (const s of [-1, 1]) for (const z of [0.5, -1.3]) {
        body.add(limb(V(0.7 * s, 0.9, z), V(0.85 * s, 0.1, z + 0.2), 0.2, scales));
        for (let k = -1; k <= 1; k++) body.add(mesh(new THREE.ConeGeometry(0.05, 0.2, 8), std(0x201010, { rough: 0.3 }), V(0.85 * s + k * 0.1, 0.08, z + 0.45), [1.4, 0, 0]));
    }
    const neckPts = [V(0, 1.4, 0.7), V(0, 2.2, 1.0), V(0, 2.75, 1.6), V(0, 2.9, 2.1)];
    body.add(mesh(tube(neckPts, 0.42, 0.26, 20, 14), scales));
    const head = new THREE.Group(); head.position.set(0, 2.95, 2.3); body.add(head);
    head.add(mesh(blob(0.42, 3, (d) => 1 + Math.max(0, d.z) * 0.6 - Math.max(0, d.y) * 0.2), scales, null, null, [0.9, 0.8, 1.1]));
    const jaw = mesh(blob(0.3, 2, (d) => 1 + Math.max(0, d.z) * 0.8), scales, V(0, -0.22, 0.25), null, [0.8, 0.4, 1.1]);
    head.add(jaw);
    for (const s of [-1, 1]) {
        head.add(horn(0.9, 0.09, 0x2a1a14, 0.9, s).translateX(0.25 * s).translateY(0.2).translateZ(-0.2));
        head.add(mesh(new THREE.ConeGeometry(0.03, 0.12, 6), std(0xfff0e0), V(0.14 * s, -0.25, 0.65), [Math.PI, 0, 0]));
    }
    const eyes = [-1, 1].map((s) => { const e = eye(0.09, 0xffb020, { glow: true, slit: true }); e.position.set(0.28 * s, 0.12, 0.3); e.rotation.y = s * 0.6; head.add(e); return e; });
    const wings = [-1, 1].map((s) => { const w = batWing(2.6, 0x7a1a10, s, 0x3a0c08); w.position.set(0.5 * s, 1.8, -0.2); w.rotation.set(-0.3, s * 0.5, s * 0.2); body.add(w); return w; });
    const tailPts = [V(0, 1.0, -1.8), V(0.3, 0.6, -2.8), V(1.2, 0.3, -3.6), V(2.2, 0.25, -3.5)];
    body.add(mesh(tube(tailPts, 0.4, 0.05, 30, 12), scales));
    for (let i = 0; i < 7; i++) {
        const c = new THREE.CatmullRomCurve3([V(0, 1.3, 0.8), V(0, 2.0, -0.2), V(0, 1.6, -1.6), ...tailPts.slice(1)]).getPointAt(0.05 + i * 0.12);
        body.add(mesh(new THREE.ConeGeometry(0.1, 0.32, 6), std(0x2a1410, { rough: 0.4 }), c.add(V(0, 0.32, 0))));
    }
    const lance = new THREE.Group();
    lance.add(mesh(new THREE.CylinderGeometry(0.04, 0.06, 2.2, 8), std(0xd8b040, { metal: 0.9, rough: 0.25 })));
    lance.position.set(-1.6, 2.2, -0.4); lance.rotation.set(0.4, 0, 1.1);
    body.add(lance);
    const glow = new THREE.PointLight(0xff7020, 1.5, 8); glow.position.set(0, 1.2, 1.6); body.add(glow);
    const seed = Math.random() * 10;
    return finish(g, 4.0, (t, mood) => {
        lance.visible = mood === 'hurt';
        torso.scale.y = 0.9 + Math.sin(t * 1.0) * 0.03;
        head.rotation.y = Math.sin(t * 0.4) * 0.2;
        head.rotation.x = mood === 'hurt' ? 0.25 : Math.sin(t * 0.7) * 0.05;
        jaw.rotation.x = mood === 'happy' ? 0.2 + Math.sin(t * 3) * 0.1 : 0.05;
        wings[0].rotation.z = 0.2 + (mood === 'hurt' ? -0.5 : Math.sin(t * 0.8) * 0.15);
        wings[1].rotation.z = -0.2 - (mood === 'happy' ? Math.sin(t * 0.8) * 0.15 : Math.sin(t * 0.8) * 0.15);
        glow.intensity = 1.2 + Math.sin(t * 2) * 0.3;
        setBlink(eyes, blink(t, seed));
    });
}

function overlord() {
    const g = new THREE.Group();
    const robe = cloth(0x3a2060);
    const gold = phys(0xd8a838, { metal: 0.9, rough: 0.25 });
    const S = skin(0x8a98b8);
    const body = new THREE.Group(); g.add(body);
    body.add(mesh(lathe([[0.95, 0], [0.9, 0.2], [0.78, 1.0], [0.62, 1.9], [0.7, 2.4], [0.75, 2.7], [0.5, 3.0], [0.01, 3.05]], 40), robe));
    body.add(mesh(new THREE.TorusGeometry(0.93, 0.05, 8, 40), gold, V(0, 0.08, 0), [Math.PI / 2, 0, 0]));
    body.add(mesh(new THREE.BoxGeometry(0.12, 2.6, 0.04), gold, V(0, 1.4, 0.78), [-0.1, 0, 0]));
    // cape collar
    body.add(mesh(lathe([[0.62, 0], [0.92, 0.12], [0.98, 0.22]], 40), cloth(0x5a1a2a), V(0, 2.75, -0.05)));
    const arms = [];
    for (const s of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(0.72 * s, 2.6, 0); body.add(arm);
        arm.add(mesh(lathe([[0.18, 0], [0.24, -0.6], [0.32, -1.1], [0.01, -1.12]]), robe, null, [0, 0, s * 0.2]));
        arm.add(mesh(blob(0.14, 2), S, V(0.25 * s, -1.2, 0.1)));
        arms.push(arm);
    }
    // the lantern of the Peace, in the left hand
    const lantern = new THREE.Group(); lantern.position.set(-0.22, -1.45, 0.15); arms[0].add(lantern);
    lantern.add(mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.32, 6, 1, true), std(0x2a2018, { metal: 0.6, rough: 0.5, side: THREE.DoubleSide })));
    const lflame = mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.4, 0.6) }));
    lantern.add(lflame);
    const llight = new THREE.PointLight(0xffc070, 1.5, 6); lantern.add(llight);
    body.add(mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.4, 16), skin(0x8a98b8), V(0, 3.05, 0)));
    const head = new THREE.Group(); head.position.set(0, 3.5, 0.08); body.add(head);
    head.add(mesh(blob(0.38, 3, (d) => 1 + Math.max(0, -d.y) * 0.2 - Math.max(0, d.y) * 0.05), S, null, null, [0.9, 1.05, 0.9]));
    head.add(mesh(blob(0.1, 2), S, V(0, -0.02, 0.36), null, [0.8, 1.2, 1]));
    for (const s of [-1, 1]) head.add(horn(1.3, 0.12, 0x2a2430, 1.0, s).translateX(0.24 * s).translateY(0.2));
    // the beard
    const beard = mesh(lathe([[0.01, -0.95], [0.12, -0.8], [0.26, -0.45], [0.3, -0.2], [0.28, 0], [0.01, 0.02]], 24), cloth(0xd8dce8), V(0, -0.12, 0.12), null, [1, 1, 0.6]);
    head.add(beard);
    const eyeColor = new THREE.Color(0x80d8ff);
    const eyes = [-1, 1].map((s) => { const e = glowEye(0.05, 0x80d8ff); e.position.set(0.14 * s, 0.08, 0.31); head.add(e); return e; });
    // the Diadem of Wrath
    const diadem = new THREE.Group(); diadem.position.y = 0.3; head.add(diadem);
    diadem.add(mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 32), gold, null, [Math.PI / 2, 0, 0]));
    for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        diadem.add(mesh(new THREE.ConeGeometry(0.05, 0.22, 4), gold, V(Math.sin(a) * 0.34, 0.12, Math.cos(a) * 0.34)));
    }
    const gemM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 0.2, 0.2) });
    diadem.add(mesh(new THREE.OctahedronGeometry(0.08), gemM, V(0, 0.05, 0.36)));
    const madLight = new THREE.PointLight(0xff2020, 2.5, 6); madLight.position.set(0, 0.2, 0.6); diadem.add(madLight);
    return finish(g, 4.2, (t, mood) => {
        const mad = mood === 'hurt';
        diadem.visible = mad;
        const ec = mad ? new THREE.Color(2.6, 0.3, 0.2) : eyeColor.clone().multiplyScalar(2.2);
        for (const e of eyes) e.children[0].material.color.copy(ec);
        body.rotation.z = mad ? Math.sin(t * 2.2) * 0.03 : Math.sin(t * 0.6) * 0.01;
        head.rotation.z = mad ? Math.sin(t * 3.1) * 0.08 : 0;
        head.rotation.x = mad ? Math.sin(t * 1.7) * 0.06 : -0.05;
        arms[1].rotation.x = mad ? -0.6 + Math.sin(t * 2.5) * 0.4 : 0;
        arms[0].rotation.x = mad ? 0 : -0.25;
        llight.intensity = mad ? 0.2 : 1.6;
        lflame.visible = !mad;
        madLight.intensity = 2 + Math.sin(t * 6) * 1;
    });
}

// ------------------------------------------------------------------ cast

function mimic() {
    const g = new THREE.Group();
    const wood = phys(0x8a5a2a, { rough: 0.7, sheen: 0.3 });
    const gold = phys(0xd4a030, { metal: 0.9, rough: 0.3 });
    const body = new THREE.Group(); g.add(body);
    body.add(mesh(new RoundedBoxGeometry(0.9, 0.5, 0.6, 3, 0.04), wood, V(0, 0.25, 0)));
    for (const x of [-0.3, 0.3]) body.add(mesh(new THREE.BoxGeometry(0.06, 0.52, 0.62), gold, V(x, 0.25, 0)));
    body.add(mesh(new THREE.BoxGeometry(0.4, 0.04, 0.4), phys(0x6a1020, { rough: 0.6 }), V(0, 0.48, 0.02)));
    const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.3); body.add(lid);
    const lidM = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 20, 1, false, 0, Math.PI), wood, V(0, 0, 0.3), [0, 0, Math.PI / 2]);
    lidM.rotation.set(Math.PI / 2, 0, Math.PI / 2); lidM.position.set(0, 0, 0.3);
    lid.add(lidM);
    for (const x of [-0.3, 0.3]) lid.add(mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 16, Math.PI), gold, V(x, 0, 0.3), [0, Math.PI / 2, 0]));
    for (let i = 0; i < 9; i++) {
        lid.add(mesh(new THREE.ConeGeometry(0.03, 0.09, 6), std(0xf4ecd8, { rough: 0.3 }), V(-0.36 + i * 0.09, -0.04, 0.56), [Math.PI, 0, 0]));
        body.add(mesh(new THREE.ConeGeometry(0.03, 0.08, 6), std(0xf4ecd8, { rough: 0.3 }), V(-0.36 + i * 0.09, 0.53, 0.26)));
    }
    const tongue = mesh(tube([V(0, 0.48, 0.1), V(0, 0.6, 0.35), V(0, 0.5, 0.55), V(0.05, 0.42, 0.62)], 0.07, 0.04, 16, 10), phys(0xe0607a, { rough: 0.3, coat: 0.8 }));
    body.add(tongue);
    const quill = mesh(new THREE.ConeGeometry(0.03, 0.4, 6), std(0xf0f0f0), V(0.08, 0.5, 0.62), [0.3, 0, -0.9]);
    body.add(quill);
    const eyes = [-1, 1].map((s) => { const e = eye(0.06, 0x6a2a90); e.position.set(0.2 * s, 0.12, 0.5); lid.add(e); return e; });
    const seed = Math.random() * 10;
    return finish(g, 1.0, (t, mood) => {
        lid.rotation.x = -0.5 - Math.abs(Math.sin(t * (mood === 'happy' ? 6 : 1.3))) * 0.25;
        tongue.rotation.z = Math.sin(t * 2) * 0.05;
        setBlink(eyes, blink(t, seed));
    });
}

function wisp() {
    const root = new THREE.Group();
    const g = new THREE.Group(); g.position.y = 0.3; root.add(g);
    const core = mesh(new THREE.IcosahedronGeometry(0.1, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.0, 2.4) }));
    g.add(core);
    const shell = mesh(new THREE.IcosahedronGeometry(0.17, 3), ghostMaterial(0x9ae8ff, 1.4));
    shell.castShadow = false;
    g.add(shell);
    const eyes = [-1, 1].map((s) => { const e = new THREE.Group(); e.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0x0a2030 }), null, null, [1, 1.5, 1])); e.position.set(0.04 * s, 0.02, 0.15); e.userData.lid = e; g.add(e); return e; });
    const light = new THREE.PointLight(0x8ae0ff, 1.2, 4); g.add(light);
    return finish(root, 0.6, (t) => {
        g.position.y = 0.3 + Math.sin(t * 2) * 0.05;
        core.scale.setScalar(1 + Math.sin(t * 5) * 0.1);
        shell.rotation.y = t;
        setBlink(eyes, blink(t, 3));
    });
}

/** The Gilded Company, as clinic orderlies after the ending. */
function knight(kind) {
    const g = new THREE.Group();
    const look = {
        aldric: { body: phys(0xd8b048, { metal: 0.9, rough: 0.3 }), skin: 0xe8c0a0, hair: 0xe0c060 },
        vessa: { body: cloth(0x2a2a34), skin: 0xd8a888, hair: 0x2a1a14 },
        corvin: { body: cloth(0x6a6a74), skin: 0xe0c8b0, hair: 0x9a9a9a },
        lumina: { body: cloth(0xf0ecdc), skin: 0xf0d0b8, hair: 0xf8e8b0 },
    }[kind];
    const S = skin(look.skin);
    const body = new THREE.Group(); g.add(body);
    for (const s of [-1, 1]) body.add(limb(V(0.1 * s, 0.05, 0), V(0.1 * s, 0.8, 0), 0.07, look.body));
    body.add(mesh(lathe([[0.2, 0.75], [0.26, 1.0], [0.24, 1.35], [0.18, 1.45], [0.01, 1.46]]), look.body));
    if (kind !== 'aldric') body.add(mesh(lathe([[0.32, 0.1], [0.27, 0.6], [0.22, 0.9], [0.01, 0.92]]), look.body));
    const head = new THREE.Group(); head.position.y = 1.62; body.add(head);
    head.add(mesh(blob(0.14, 3), S));
    head.add(mesh(blob(0.15, 3, (d) => (d.y > -0.1 ? 1.05 : 0.6)), cloth(look.hair), V(0, 0.03, -0.02)));
    const eyes = [-1, 1].map((s) => { const e = eye(0.025, 0x3a5a8a); e.position.set(0.05 * s, 0.02, 0.12); head.add(e); return e; });
    // a mop
    const mop = new THREE.Group(); mop.position.set(0.3, 0.9, 0.2); body.add(mop);
    mop.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), std(0x8a6a40)));
    mop.add(mesh(blob(0.12, 2, (d) => 1 + Math.max(0, -d.y) * 0.5), cloth(0xd8d0b8), V(0, -0.85, 0)));
    mop.rotation.z = 0.25;
    for (const s of [-1, 1]) body.add(limb(V(0.24 * s, 1.35, 0), V(0.28 * s, 0.95, 0.15), 0.05, look.body));
    const seed = Math.random() * 10;
    return finish(g, 1.75, (t) => {
        mop.rotation.x = Math.sin(t * 2.5) * 0.3;
        body.rotation.y = Math.sin(t * 2.5) * 0.08;
        setBlink(eyes, blink(t, seed));
    });
}

// ------------------------------------------------------------------ registry

const BUILDERS = {
    goblin, slime, myconid, imp, owlbear, skeleton, ghost, banshee, kobold, golem, gargoyle, troll, dragon, overlord,
    clasp: mimic, ossa: () => skeleton({ nurse: true, eyes: 0x90f0c0 }), pip: wisp,
    aldric: () => knight('aldric'), vessa: () => knight('vessa'), corvin: () => knight('corvin'), lumina: () => knight('lumina'),
};

/** Variation by name, so two goblins don't look identical. */
const VARIANTS = {
    goblin: [{}, { skin: 0x8ab048, cloth: 0x4a6a8a }, { skin: 0x5a9a5a, cloth: 0x8a3a3a }, { skin: 0x9aa040, cloth: 0x6a5a2a }],
    slime: [{}, { color: 0x6aa8ff }, { color: 0xff8ad0 }, { color: 0xffc04a }],
    myconid: [{}, { cap: 0x8a5ac0 }, { cap: 0xd89030 }],
    imp: [{}, { skin: 0x9a3aa0 }, { skin: 0xd8602a }],
    golem: [{}, { stone: 0x8a7a68, rune: 0xff9a40 }, { stone: 0x5a6a7a, rune: 0xa070ff }],
    ghost: [{}, { color: 0xc8b0ff }, { color: 0xb0ffd8 }],
};

export function buildModel(id, variantKey = '') {
    const B = BUILDERS[id] ?? goblin;
    const vs = VARIANTS[id];
    let h = 0;
    for (let i = 0; i < variantKey.length; i++) h = (h * 31 + variantKey.charCodeAt(i)) >>> 0;
    const g = vs ? B(vs[h % vs.length]) : B();
    g.name = id;
    return g;
}

export const MODEL_IDS = Object.keys(BUILDERS);
