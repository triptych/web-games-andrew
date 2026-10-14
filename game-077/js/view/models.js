// Procedural models: the ball-shaped cast, cars and boats, palms and props.
// Everything is built from three.js primitives and canvas textures at load.
//
// Convention: a model faces +Z at rotation.y = 0 and sits on y = 0.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintBallSkin, leafTex, stripeTex, screenTex, flagTex, cssOf } from './textures.js';
import { hash01 } from '../rng.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
const glow = (color, k = 2) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: k, roughness: 0.4 });
const geoCache = new Map();
function cached(key, make) {
    if (!geoCache.has(key)) { const g = make(); g.userData.shared = true; geoCache.set(key, g); }
    return geoCache.get(key);
}
const sphere = (r, w = 16, h = 12) => cached(`s${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
const cyl = (rt, rb, h, s = 12) => cached(`c${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const box = (w, h, d) => cached(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));

function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    if (parent) parent.add(m);
    return m;
}

// ------------------------------------------------------------------ cast
/**
 * A round character. Returns { root, pivot, body, mats } — the world places
 * `root`, the animator tilts/squashes `pivot` (game-063's lesson).
 */
export function makeCharacter(look, r, kind = 'crew', opts = {}) {
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.position.y = r;
    root.add(pivot);
    const skin = paintBallSkin(look, kind);
    const bodyMat = new THREE.MeshStandardMaterial({ map: skin, emissiveMap: skin, emissive: 0xffffff, emissiveIntensity: 0.32, roughness: 0.45, metalness: 0.05, transparent: true });
    const body = mesh(new THREE.SphereGeometry(r, 32, 20), bodyMat, 0, 0, 0, pivot);
    const mats = [bodyMat];
    const hairMat = std(cssOf(look.hair ?? '#222'), { roughness: 0.5, transparent: true, emissive: cssOf(look.hair ?? '#222'), emissiveIntensity: 0.25 });
    mats.push(hairMat);
    const top = new THREE.Group();
    pivot.add(top);
    switch (look.hairStyle) {
        case 'swept': {
            const h = mesh(new THREE.SphereGeometry(r * 1.03, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.2), hairMat, 0, 0, 0, top);
            h.rotation.x = -0.45;
            const q = mesh(sphere(r * 0.4, 12, 8), hairMat, 0, r * 0.84, -r * 0.12, top);
            q.scale.set(1.7, 0.55, 1.1);
            break;
        }
        case 'pony': {
            mesh(new THREE.SphereGeometry(r * 1.03, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.2), hairMat, 0, 0, 0, top).rotation.x = -0.45;
            const p = mesh(cyl(r * 0.16, r * 0.08, r * 1.1, 8), hairMat, 0, r * 0.4, -r * 1.05, top);
            p.rotation.x = 0.9;
            mesh(sphere(r * 0.14, 8, 6), std(0xff3fa4), 0, r * 0.62, -r * 0.88, top);
            break;
        }
        case 'bun': {
            mesh(new THREE.SphereGeometry(r * 1.02, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.2), hairMat, 0, 0, 0, top).rotation.x = -0.45;
            mesh(sphere(r * 0.3, 12, 8), hairMat, 0, r * 0.95, -r * 0.35, top);
            break;
        }
        case 'flat': {
            mesh(cyl(r * 0.62, r * 0.7, r * 0.34, 16), hairMat, 0, r * 0.9, -r * 0.12, top);
            const band = mesh(new THREE.TorusGeometry(r * 0.86, r * 0.07, 6, 24), std(0xff8a3a, { emissive: 0xff8a3a, emissiveIntensity: 0.4 }), 0, r * 0.6, -r * 0.05, top);
            band.rotation.x = Math.PI / 2 - 0.35;
            break;
        }
        case 'mohawk': {
            const neon = new THREE.MeshStandardMaterial({ color: cssOf(look.hair), emissive: cssOf(look.hair), emissiveIntensity: 0.8 });
            mats.push(neon);
            for (let k = 0; k < 6; k++) {
                const a = -0.9 + k * 0.36;
                const c = mesh(cyl(0, r * 0.13, r * 0.6, 6), neon, 0, Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05, top);
                c.rotation.x = a;
            }
            break;
        }
        case 'cap': {
            const capMat = std(0x2a3a6a);
            mesh(new THREE.SphereGeometry(r * 1.04, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.2), capMat, 0, 0, 0, top).rotation.x = -0.3;
            const brim = mesh(cyl(r * 0.55, r * 0.55, r * 0.06, 16, 1), capMat, 0, r * 0.95, r * 0.25, top);
            brim.scale.z = 0.7; brim.rotation.x = 0.35;
            break;
        }
        case 'big': {
            for (let k = 0; k < 9; k++) {
                const a = (k / 9) * Math.PI * 2;
                mesh(sphere(r * 0.42, 10, 8), hairMat, Math.cos(a) * r * 0.62, r * 0.7 + hash01(k) * r * 0.15, Math.sin(a) * r * 0.62 - r * 0.15, top);
            }
            mesh(sphere(r * 0.55, 12, 8), hairMat, 0, r * 0.95, -r * 0.15, top);
            break;
        }
        case 'slick': default: {
            const h = mesh(new THREE.SphereGeometry(r * 1.025, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.2), hairMat, 0, 0, 0, top);
            h.rotation.x = -0.5;
        }
    }
    if (look.hat) {
        const hatMat = std(0x101a3a);
        const hat = new THREE.Group(); hat.position.set(0, r * 0.82, -r * 0.18); hat.rotation.x = -0.35; top.add(hat);
        mesh(cyl(r * 0.55, r * 0.62, r * 0.38, 16), hatMat, 0, r * 0.12, 0, hat);
        const brim = mesh(cyl(r * 0.68, r * 0.68, r * 0.05, 16), std(0x080810), 0, -r * 0.05, r * 0.12, hat);
        brim.scale.z = 1.1;
        mesh(box(r * 0.22, r * 0.2, r * 0.05), std(0xffd040, { metalness: 0.8, roughness: 0.3, emissive: 0x806010, emissiveIntensity: 0.6 }), 0, r * 0.18, r * 0.58, hat);
    }
    if (look.fin) {
        const s = new THREE.Shape();
        s.moveTo(-r * 0.55, 0); s.quadraticCurveTo(-r * 0.1, r * 0.4, r * 0.25, r * 1.1); s.quadraticCurveTo(r * 0.2, r * 0.4, r * 0.55, 0); s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: r * 0.12, bevelEnabled: false });
        g.translate(0, 0, -r * 0.06);
        const fin = mesh(g, std(0x6a7488, { metalness: 0.3, roughness: 0.35 }), 0, r * 0.75, -r * 0.1, top);
        fin.rotation.y = Math.PI / 2;
    }
    const ring = makeRing(r, opts.ring ?? (kind === 'crew' ? 0x2ff2e0 : 0xff2e3e));
    root.add(ring);
    return { root, pivot, body, mats, ring, top, r };
}

export function makeDog(look, r) {
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.position.y = r * 0.9;
    root.add(pivot);
    const fur = std(cssOf(look.fur), { roughness: 0.8, transparent: true, emissive: cssOf(look.fur), emissiveIntensity: 0.35 });
    const dark = std(0x1a1008, { transparent: true });
    const body = mesh(sphere(r, 16, 12), fur, 0, 0, 0, pivot);
    body.scale.set(0.9, 0.85, 1.35);
    mesh(sphere(r * 0.62, 14, 10), fur, 0, r * 0.45, r * 1.05, pivot);
    const snout = mesh(sphere(r * 0.32, 10, 8), fur, 0, r * 0.32, r * 1.55, pivot);
    snout.scale.set(0.9, 0.8, 1.3);
    mesh(sphere(r * 0.12, 8, 6), dark, 0, r * 0.42, r * 1.92, pivot);
    for (const s of [-1, 1]) {
        const e = mesh(cyl(0, r * 0.22, r * 0.5, 4), dark, s * r * 0.36, r * 0.95, r * 0.92, pivot);
        e.rotation.z = -s * 0.35;
        mesh(sphere(r * 0.08, 6, 4), new THREE.MeshStandardMaterial({ color: 0xffd040, emissive: 0xff8020, emissiveIntensity: 1.2 }), s * r * 0.2, r * 0.62, r * 1.45, pivot);
    }
    const tail = mesh(cyl(r * 0.07, r * 0.12, r * 0.8, 6), fur, 0, r * 0.35, -r * 1.3, pivot);
    tail.rotation.x = -0.8;
    mesh(new THREE.TorusGeometry(r * 0.5, r * 0.06, 6, 16), std(0xff2e3e), 0, r * 0.28, r * 0.8, pivot).rotation.x = Math.PI / 2 - 0.4;
    const ring = makeRing(r, 0xff2e3e);
    root.add(ring);
    return { root, pivot, body, mats: [fur, dark], ring, top: new THREE.Group(), r, tail };
}

export function makeRing(r, color) {
    const geo = cached(`ring${r}`, () => new THREE.RingGeometry(r * 1.05, r * 1.28, 40));
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.025;
    m.renderOrder = 2;
    return m;
}

// ------------------------------------------------------------------ vehicles
let _blob = null;
/** A soft round falloff, used for contact shadows and underglow. */
function blobTex() {
    if (_blob) return _blob;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.55, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    _blob = new THREE.CanvasTexture(c);
    return _blob;
}

/** Underglow colour: hot pink, or teal under a car that is already pink. */
function glowFor(paint) {
    const c = new THREE.Color(typeof paint === 'number' ? paint : 0xffffff);
    const hsl = {}; c.getHSL(hsl);
    const pinkish = hsl.s > 0.4 && hsl.l < 0.85 && (hsl.h > 0.85 || hsl.h < 0.05);
    return pinkish ? 0x2ff2e0 : 0xff3fa4;
}

function profileCar() {
    // side profile, x along length (front +x), y up; a wedge with a raked windshield
    const s = new THREE.Shape();
    s.moveTo(-1.05, 0.12);
    s.lineTo(1.05, 0.12);
    s.lineTo(1.07, 0.3);
    s.lineTo(0.55, 0.38);
    s.lineTo(0.1, 0.58);
    s.lineTo(-0.45, 0.6);
    s.lineTo(-0.75, 0.46);
    s.lineTo(-1.06, 0.44);
    s.closePath();
    return s;
}

/** A car facing +Z (length along z). kinds: car, police, van, ambulance, truck. */
export function makeVehicle(kind = 'car', color = 0xff6fb0) {
    const root = new THREE.Group();
    const paint = std(color, { metalness: 0.5, roughness: 0.28 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x0a0a18, metalness: 0.9, roughness: 0.1, emissive: 0x200a30, emissiveIntensity: 0.6 });
    const tyre = std(0x111114, { roughness: 0.9 });
    const rim = std(0xd8d8e0, { metalness: 0.9, roughness: 0.2 });
    const tail = new THREE.MeshStandardMaterial({ color: 0x300008, emissive: 0xff1030, emissiveIntensity: 2.2 });
    const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c0, emissiveIntensity: 1.6 });
    const holder = new THREE.Group();
    root.add(holder);
    holder.rotation.y = -Math.PI / 2;   // profile is built along +x
    let wheelX = [0.68, -0.68], wheelR = 0.17, width = 0.92;
    if (kind === 'car' || kind === 'police') {
        const g = new THREE.ExtrudeGeometry(profileCar(), { depth: width, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
        g.translate(0, 0, -width / 2);
        mesh(g, paint, 0, 0, 0, holder);
        // cabin glass
        const cab = new THREE.Shape();
        cab.moveTo(0.5, 0.39); cab.lineTo(0.1, 0.57); cab.lineTo(-0.42, 0.59); cab.lineTo(-0.66, 0.46); cab.closePath();
        const cg = new THREE.ExtrudeGeometry(cab, { depth: width * 0.84, bevelEnabled: false });
        cg.translate(0, 0.005, -width * 0.42);
        mesh(cg, glass, 0, 0, 0, holder);
        // side strakes
        for (const s of [-1, 1]) for (let k = 0; k < 4; k++) mesh(box(0.42, 0.025, 0.02), std(0x101014), -0.35, 0.22 + k * 0.045, s * (width / 2 + 0.035), holder);
        mesh(box(0.04, 0.06, width * 0.86), tail, -1.09, 0.34, 0, holder);
        for (const s of [-1, 1]) mesh(box(0.05, 0.05, 0.16), head, 1.08, 0.24, s * 0.3, holder);
        if (kind === 'police') {
            mesh(box(0.14, 0.07, 0.5), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2030, emissiveIntensity: 2.5 }), -0.15, 0.64, -0.13, holder);
            mesh(box(0.14, 0.07, 0.5), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x2050ff, emissiveIntensity: 2.5 }), -0.15, 0.64, 0.13, holder).userData.blink = true;
            paint.color.set(0xf4f4f4);
            mesh(box(1.6, 0.12, width + 0.09), std(0x101a3a), 0, 0.26, 0, holder);
        }
    } else {
        const len = kind === 'truck' ? 2.4 : 2.1, h = kind === 'truck' ? 0.75 : 0.85;
        width = kind === 'truck' ? 1.0 : 0.95;
        if (kind === 'truck') {
            mesh(box(0.7, h, width), paint, len / 2 - 0.35, h / 2 + 0.12, 0, holder);
            mesh(box(0.06, 0.28, width * 0.8), glass, len / 2 + 0.005, h * 0.75 + 0.12, 0, holder);
            mesh(box(len - 0.75, 0.18, width), std(0x3a3a44), -0.37, 0.25, 0, holder);
            for (let k = 0; k < 3; k++) mesh(box(0.42, 0.3, width * 0.9), std([0xd84a3a, 0x3a8ac8, 0xf0b030][k]), -1.0 + k * 0.45, 0.5, 0, holder);
            wheelX = [0.8, -0.8];
        } else {
            const body = mesh(box(len, h, width), paint, 0, h / 2 + 0.12, 0, holder);
            body.geometry = new THREE.BoxGeometry(len, h, width, 1, 1, 1);
            mesh(box(0.06, 0.3, width * 0.85), glass, len / 2 + 0.002, h * 0.72 + 0.12, 0, holder);
            for (const s of [-1, 1]) mesh(box(0.5, 0.26, 0.02), glass, len / 2 - 0.4, h * 0.72 + 0.12, s * (width / 2 + 0.002), holder);
            mesh(box(0.04, 0.08, width * 0.8), tail, -len / 2 - 0.01, 0.4, 0, holder);
            if (kind === 'ambulance') {
                paint.color.set(0xffffff);
                for (const s of [-1, 1]) mesh(box(len * 0.9, 0.1, 0.02), std(0xff2e3e), 0, 0.5, s * (width / 2 + 0.006), holder);
                const lb = mesh(box(0.2, 0.08, width * 0.7), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xff2030, emissiveIntensity: 2.5 }), len / 2 - 0.3, h + 0.16, 0, holder);
                lb.userData.blink = true;
                mesh(box(0.3, 0.3, 0.02), std(0xff2e3e), -0.2, 0.62, width / 2 + 0.01, holder);
            }
            if (kind === 'van') {
                for (const s of [-1, 1]) mesh(box(len * 0.92, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: 0x000, emissive: 0xff3fa4, emissiveIntensity: 1.6 }), 0, 0.45, s * (width / 2 + 0.006), holder);
            }
        }
        for (const s of [-1, 1]) mesh(box(0.04, 0.06, 0.14), head, len / 2 + 0.01, 0.28, s * 0.3, holder);
    }
    const wheels = [];
    for (const x of wheelX) for (const s of [-1, 1]) {
        const w = new THREE.Group();
        w.position.set(x, wheelR, s * (width / 2 - 0.02));
        holder.add(w);
        const t = mesh(cyl(wheelR, wheelR, 0.14, 14), tyre, 0, 0, 0, w);
        t.rotation.x = Math.PI / 2;
        const rr = mesh(cyl(wheelR * 0.6, wheelR * 0.6, 0.15, 10), rim, 0, 0, 0, w);
        rr.rotation.x = Math.PI / 2;
        wheels.push(w);
    }
    // a soft dark contact shadow, then a neon underglow in an accent colour
    // (never the paint: a white car would get a white slab under it)
    const shadow = new THREE.Mesh(cached('under', () => new THREE.PlaneGeometry(2.5, 1.35)), new THREE.MeshBasicMaterial({ map: blobTex(), color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.rotation.z = Math.PI / 2; shadow.position.y = 0.015;
    root.add(shadow);
    const accent = glowFor(color);
    const under = new THREE.Mesh(cached('under', () => new THREE.PlaneGeometry(2.5, 1.35)), new THREE.MeshBasicMaterial({ map: blobTex(), color: accent, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    under.rotation.x = -Math.PI / 2; under.rotation.z = Math.PI / 2; under.position.y = 0.02;
    under.scale.set(1.15, 1.25, 1);
    root.add(under);
    root.userData.wheels = wheels;
    return root;
}

export function makeBoat(color = 0xffffff, scale = 1, speed = true) {
    const root = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(0, 1.25); s.quadraticCurveTo(0.55, 0.6, 0.5, -0.9); s.lineTo(-0.5, -0.9); s.quadraticCurveTo(-0.55, 0.6, 0, 1.25);
    const hull = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
    hull.rotateX(Math.PI / 2);
    hull.translate(0, 0.35, 0);
    const holder = new THREE.Group();
    holder.scale.setScalar(scale);
    root.add(holder);
    mesh(hull, std(color, { metalness: 0.2, roughness: 0.3 }), 0, 0, 0, holder);
    mesh(box(0.9, 0.05, 0.4), std(0xff3fa4), 0, 0.12, -0.3, holder);
    const ws = mesh(box(0.8, 0.22, 0.05), new THREE.MeshStandardMaterial({ color: 0x80c8ff, transparent: true, opacity: 0.5, metalness: 0.9, roughness: 0.05 }), 0, 0.45, 0.15, holder);
    ws.rotation.x = -0.5;
    mesh(box(0.7, 0.12, 0.5), std(0xf4e8d8), 0, 0.4, -0.2, holder);
    if (speed) for (const s2 of [-1, 1]) mesh(box(0.03, 0.06, 1.6), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x2ff2e0, emissiveIntensity: 1.6 }), s2 * 0.47, 0.25, 0.1, holder);
    return root;
}

export function makeHeli() {
    const root = new THREE.Group();
    const paint = std(0x1a1a24, { metalness: 0.6, roughness: 0.3 });
    const b = mesh(sphere(0.55, 18, 12), paint, 0, 0.65, 0.1, root);
    b.scale.set(1, 0.85, 1.4);
    mesh(sphere(0.42, 14, 10), new THREE.MeshStandardMaterial({ color: 0x102030, metalness: 0.9, roughness: 0.05, emissive: 0x2a0a3a }), 0, 0.72, 0.42, root).scale.set(1, 0.8, 0.9);
    const tail = mesh(cyl(0.06, 0.14, 1.6, 8), paint, 0, 0.75, -1.2, root);
    tail.rotation.x = Math.PI / 2;
    mesh(box(0.04, 0.4, 0.25), paint, 0, 0.95, -1.95, root);
    for (const s of [-1, 1]) mesh(box(0.05, 0.05, 1.2), std(0x808088), s * 0.4, 0.06, 0.1, root);
    const rotor = new THREE.Group();
    rotor.position.y = 1.18;
    root.add(rotor);
    for (let k = 0; k < 4; k++) { const bl = mesh(box(2.6, 0.02, 0.12), std(0x101014), 0, 0, 0, rotor); bl.rotation.y = (k * Math.PI) / 4 * 2 / 2 + k * Math.PI / 4; }
    mesh(box(0.08, 0.06, 0.4), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff1030, emissiveIntensity: 2.5 }), 0, 0.4, -0.3, root).userData.blink = true;
    root.userData.rotor = rotor;
    return root;
}

// ------------------------------------------------------------------ nature
let _leafMat = null;
export function makePalm(seed = 1, height = 2.5) {
    const root = new THREE.Group();
    const lean = (hash01(seed) - 0.5) * 0.5, dir = hash01(seed + 1) * Math.PI * 2;
    const segs = 7;
    const trunkMat = std(0x8a6a4a, { roughness: 0.9 });
    const ringMat = std(0x6a4a30, { roughness: 0.9 });
    let x = 0, z = 0;
    for (let k = 0; k < segs; k++) {
        const t = k / segs;
        const r0 = 0.13 - t * 0.04;
        const seg = mesh(cyl(r0 * 0.92, r0, height / segs + 0.02, 8), k % 2 ? trunkMat : ringMat, x, (k + 0.5) * height / segs, z, root);
        seg.rotation.z = Math.cos(dir) * lean * t * 1.4; seg.rotation.x = Math.sin(dir) * lean * t * 1.4;
        x += Math.cos(dir) * lean * (t * t) * height / segs * 1.6;
        z += Math.sin(dir) * lean * (t * t) * height / segs * 1.6;
    }
    const crown = new THREE.Group();
    crown.position.set(x, height, z);
    root.add(crown);
    _leafMat ??= new THREE.MeshStandardMaterial({ map: leafTex(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7, transparent: true });
    const mat = _leafMat.clone();
    const leafGeo = cached('leaf', () => {
        const g = new THREE.PlaneGeometry(0.42, 1.5, 1, 8);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const y = p.getY(i) + 0.75;   // 0..1.5 along the leaf
            p.setZ(i, -y * y * 0.32);
            p.setY(i, y);
        }
        g.computeVertexNormals();
        g.rotateX(-Math.PI / 2 + 0.35);
        return g;
    });
    const n = 8;
    for (let k = 0; k < n; k++) {
        const leaf = new THREE.Mesh(leafGeo, mat);
        leaf.rotation.y = (k / n) * Math.PI * 2 + hash01(seed + k) * 0.4;
        leaf.castShadow = true;
        crown.add(leaf);
    }
    for (let k = 0; k < 3; k++) mesh(sphere(0.08, 8, 6), std(0x5a3a1a), Math.cos(k * 2.1) * 0.1, -0.1, Math.sin(k * 2.1) * 0.1, crown);
    root.userData.crown = crown;
    root.userData.leafMat = mat;
    return root;
}

// ------------------------------------------------------------------ props
export function makeProp(p, def) {
    const g = new THREE.Group();
    const c = p.color ?? 0xff3fa4;
    switch (p.p) {
        case 'boat': g.add(makeBoat(c, 1.2, false)); break;
        case 'ship': {
            mesh(box(14, 1.4, 3.2), std(0x2a3a5a), 0, 0.2, 0, g);
            mesh(box(14.1, 0.25, 3.25), std(0xc83a2a), 0, -0.3, 0, g);
            mesh(box(3, 1.6, 2.6), std(0xc8c8d0), -5, 1.6, 0, g);
            for (let k = 0; k < 8; k++) mesh(box(1.4, 0.7, 2.6), std([0xd84a3a, 0x3a8ac8, 0xf0b030, 0x4aa86a][k % 4]), -2.5 + k * 1.3, 1.25, 0, g);
            g.rotation.y = Math.PI / 2;
            break;
        }
        case 'crane': {
            const y = std(0xffc020, { metalness: 0.4 });
            for (const sx of [-1, 1]) for (const t of [-1, 1]) mesh(box(0.22, 4.2, 0.22), y, sx * 1.4, 2.1, t * 1.1, g);
            mesh(box(3.2, 0.35, 0.35), y, 0, 4.2, 1.1, g); mesh(box(3.2, 0.35, 0.35), y, 0, 4.2, -1.1, g);
            mesh(box(0.45, 0.45, 7), y, 0, 4.5, 2.2, g);
            mesh(box(0.7, 0.5, 0.7), std(0x303038), 0, 4.2, 4.2, g);
            mesh(box(0.05, 2.6, 0.05), std(0x202020), 0, 2.9, 4.2, g);
            mesh(box(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff2030, emissiveIntensity: 3 }), 0, 4.85, 5.6, g).userData.blink = true;
            break;
        }
        case 'lamp': {
            mesh(cyl(0.05, 0.07, 2.4, 8), std(0x30303a), 0, 1.2, 0, g);
            const arm = mesh(box(0.06, 0.06, 0.6), std(0x30303a), 0, 2.4, 0.25, g);
            void arm;
            mesh(box(0.22, 0.08, 0.3), new THREE.MeshStandardMaterial({ color: 0xffe0b0, emissive: 0xffc070, emissiveIntensity: 2.2 }), 0, 2.34, 0.5, g);
            const pool = new THREE.Mesh(cached('pool', () => new THREE.CircleGeometry(1.4, 24)), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }));
            pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.03, 0.5);
            g.add(pool);
            break;
        }
        case 'couch': {
            const m = std(0x8a3aa8, { roughness: 0.8 });
            mesh(box(1.6, 0.25, 0.6), m, 0, 0.2, 0, g);
            mesh(box(1.6, 0.35, 0.18), m, 0, 0.4, -0.25, g);
            for (const s of [-1, 1]) mesh(box(0.18, 0.3, 0.6), m, s * 0.8, 0.3, 0, g);
            break;
        }
        case 'desk': {
            mesh(box(1.4, 0.08, 0.7), std(0x5a3a2a), 0, 0.5, 0, g);
            for (const s of [-1, 1]) mesh(box(0.08, 0.5, 0.6), std(0x4a2a1a), s * 0.62, 0.25, 0, g);
            mesh(box(0.42, 0.32, 0.36), std(0xe8e0d0), 0.2, 0.72, -0.1, g);
            mesh(box(0.34, 0.24, 0.02), new THREE.MeshStandardMaterial({ map: screenTex(['> _', 'LEDGER', '$$$$']), emissive: 0xffffff, emissiveMap: screenTex(['> _', 'LEDGER', '$$$$']), emissiveIntensity: 0.9 }), 0.2, 0.74, 0.085, g);
            mesh(box(0.25, 0.04, 0.32), std(0xf0f0e0), -0.35, 0.56, 0, g);
            break;
        }
        case 'bed': {
            mesh(box(1.0, 0.3, 1.8), std(0xd8d8e0), 0, 0.25, 0, g);
            mesh(box(0.9, 0.12, 1.2), std(0x8ac8f0), 0, 0.45, 0.2, g);
            mesh(box(0.6, 0.12, 0.3), std(0xffffff), 0, 0.45, -0.65, g);
            break;
        }
        case 'dj': {
            mesh(box(2.4, 0.5, 0.6), std(0x101018), 0, 0.25, 0, g);
            for (const s of [-1, 1]) {
                const t = mesh(cyl(0.22, 0.22, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0x080808, emissive: s > 0 ? 0xff3fa4 : 0x2ff2e0, emissiveIntensity: 0.9 }), s * 0.7, 0.52, 0, g);
                t.userData.spin = true;
            }
            mesh(box(2.4, 0.04, 0.04), glow(0xff3fa4, 2.5), 0, 0.5, 0.31, g);
            break;
        }
        case 'stool': mesh(cyl(0.18, 0.12, 0.6, 10), std(0xff3fa4, { metalness: 0.7, roughness: 0.2 }), 0, 0.3, 0, g); break;
        case 'flamingo': {
            const pink = std(0xff7ab8, { roughness: 0.4 });
            const b = mesh(sphere(0.2, 12, 8), pink, 0, 0.7, 0, g); b.scale.set(0.8, 0.7, 1.3);
            const n = mesh(cyl(0.035, 0.04, 0.45, 6), pink, 0, 0.95, 0.15, g); n.rotation.x = 0.4;
            mesh(sphere(0.07, 8, 6), pink, 0, 1.15, 0.22, g);
            mesh(cyl(0.01, 0.025, 0.12, 6), std(0x101010), 0, 1.12, 0.32, g).rotation.x = 1.6;
            for (const s of [-1, 1]) mesh(cyl(0.012, 0.012, 0.6, 4), std(0x303030), s * 0.05, 0.3, 0, g);
            break;
        }
        case 'tvcam': {
            for (let k = 0; k < 3; k++) { const l = mesh(cyl(0.02, 0.02, 1, 4), std(0x202024), Math.cos(k * 2.1) * 0.2, 0.5, Math.sin(k * 2.1) * 0.2, g); l.rotation.z = Math.cos(k * 2.1) * 0.3; l.rotation.x = -Math.sin(k * 2.1) * 0.3; }
            mesh(box(0.5, 0.35, 0.3), std(0x30303a), 0, 1.1, 0, g);
            mesh(cyl(0.1, 0.12, 0.35, 10), std(0x101010), 0, 1.1, 0.3, g).rotation.x = Math.PI / 2;
            mesh(sphere(0.04, 6, 4), glow(0xff2030, 3), 0.18, 1.3, 0.1, g).userData.blink = true;
            break;
        }
        case 'servers': {
            mesh(box(2.2, 1.0, 0.7), std(0x1a1a24, { metalness: 0.6 }), 0, 0.5, 0, g);
            for (let k = 0; k < 12; k++) {
                const l = mesh(box(0.06, 0.06, 0.02), glow([0x4dff8a, 0xff2e3e, 0x4fd8ff][k % 3], 2.5), -0.9 + (k % 6) * 0.35, 0.3 + Math.floor(k / 6) * 0.35, 0.36, g);
                l.userData.blink = k % 2 === 0;
            }
            break;
        }
        case 'lift': {
            for (const s of [-1, 1]) mesh(box(0.2, 1.4, 0.2), std(0xd84a3a), s * 1.2, 0.7, 0, g);
            mesh(box(2.6, 0.1, 0.25), std(0x404048), 0, 1.4, 0, g);
            break;
        }
        case 'tires': for (let k = 0; k < 4; k++) { const t = mesh(new THREE.TorusGeometry(0.28, 0.11, 8, 16), std(0x141418, { roughness: 0.9 }), 0, 0.11 + k * 0.2, 0, g); t.rotation.x = Math.PI / 2; } break;
        case 'umbrella': {
            mesh(cyl(0.03, 0.03, 1.6, 6), std(0xf0f0f0), 0, 0.8, 0, g);
            const m = new THREE.MeshStandardMaterial({ map: stripeTex(c, 0xffffff, 8, true), side: THREE.DoubleSide, roughness: 0.6 });
            mesh(new THREE.ConeGeometry(0.9, 0.35, 16, 1, true), m, 0, 1.65, 0, g);
            break;
        }
        case 'chair': {
            const m = std(0xffffff);
            mesh(box(0.5, 0.06, 1.2), m, 0, 0.25, 0, g);
            const b = mesh(box(0.5, 0.06, 0.5), m, 0, 0.45, -0.55, g); b.rotation.x = -0.9;
            mesh(box(0.48, 0.05, 1.0), std(0x2ff2e0), 0, 0.3, 0.05, g);
            break;
        }
        case 'piano': {
            const m = std(0x08080c, { metalness: 0.3, roughness: 0.15 });
            const s = new THREE.Shape();
            s.moveTo(-0.7, -0.6); s.lineTo(0.7, -0.6); s.lineTo(0.7, 0.2); s.quadraticCurveTo(0.6, 0.9, 0, 0.9); s.quadraticCurveTo(-0.5, 0.9, -0.7, 0.4); s.closePath();
            const geo = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false });
            geo.rotateX(-Math.PI / 2);
            mesh(geo, m, 0, 0.55, 0, g);
            mesh(box(1.3, 0.04, 0.2), std(0xf8f8f0), 0, 0.72, 0.7, g);
            break;
        }
        case 'flag': {
            mesh(cyl(0.025, 0.025, 2, 6), std(0xd8c070, { metalness: 0.8 }), 0, 1, 0, g);
            const f = mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ map: flagTex(), side: THREE.DoubleSide }), 0.4, 1.7, 0, g);
            f.userData.flutter = true;
            break;
        }
        case 'table': mesh(box(2.2, 0.08, 1.0), std(0x5a4a3a), 0, 0.5, 0, g); for (const s of [-1, 1]) mesh(box(0.08, 0.5, 0.9), std(0x3a2a1a), s * 1, 0.25, 0, g); break;
        case 'shelves': for (let k = 0; k < 3; k++) { mesh(box(1.4, 0.05, 0.4), std(0x707078), 0, 0.3 + k * 0.4, 0, g); for (let q = 0; q < 4; q++) mesh(box(0.25, 0.25, 0.3), std([0xc8a878, 0xa08868, 0x887058][q % 3]), -0.5 + q * 0.33, 0.45 + k * 0.4, 0, g); } break;
        case 'statue': {
            const m = std(0xd8d0c8, { roughness: 0.5 });
            mesh(cyl(0.6, 0.7, 0.5, 12), m, 0, 0.25, 0, g);
            const s = new THREE.Shape();
            s.moveTo(0, 0); s.quadraticCurveTo(0.5, 0.6, 0.15, 1.6); s.quadraticCurveTo(-0.1, 0.8, -0.5, 0.2); s.closePath();
            const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04 });
            mesh(geo, m, 0, 0.5, -0.06, g);
            break;
        }
        case 'plant': {
            mesh(cyl(0.2, 0.15, 0.35, 10), std(0xe8e0d0), 0, 0.17, 0, g);
            for (let k = 0; k < 6; k++) { const l = mesh(sphere(0.18, 6, 4), std(0x3a8a3a), Math.cos(k) * 0.12, 0.45 + (k % 3) * 0.1, Math.sin(k) * 0.12, g); l.scale.set(0.6, 1.4, 0.6); }
            break;
        }
        default: break;
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
}

/** A small floating pickup: cassette (intel), VHS tape (bonus). */
export function makePickup(kind) {
    const g = new THREE.Group();
    if (kind === 'intel') {
        mesh(box(0.42, 0.06, 0.28), std(0x101014), 0, 0, 0, g);
        mesh(box(0.3, 0.065, 0.12), std(0xffe45c), 0, 0, -0.02, g);
        for (const s of [-1, 1]) mesh(cyl(0.035, 0.035, 0.07, 8), std(0xffffff), s * 0.08, 0, 0.0, g);
    } else {
        mesh(box(0.48, 0.08, 0.28), std(0x18181e), 0, 0, 0, g);
        mesh(box(0.3, 0.085, 0.14), std(0xff3fa4), 0, 0, 0.02, g);
    }
    return g;
}
