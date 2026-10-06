// The fruit kit: bodies (lathe profiles + procedural skins), faces, hats, floating gloves and
// shoes, and kitchenware weapons. Every hero, townsfolk and monster is assembled from these.
// Models face +Z. One unit is one tile.

import * as THREE from 'three';
import { skinTex, rottenTex } from './textures.js';

const geoCache = new Map();
const cached = (key, fn) => { if (!geoCache.has(key)) { const g = fn(); g.userData.shared = true; geoCache.set(key, g); } return geoCache.get(key); };

// ------------------------------------------------------------------ bodies
// Profiles: control points (radius, height) from the bottom pole to the top pole, unit height.
export const FRUIT = {
    apple:      { color: 0xd8262c, h: 0.84, pts: [[0, 0.05], [0.18, 0], [0.36, 0.1], [0.44, 0.36], [0.43, 0.6], [0.36, 0.78], [0.18, 0.86], [0.04, 0.8], [0, 0.78]], skin: 'plain', gloss: 0.8, top: 'stemleaf', face: 0.42 },
    orange:     { color: 0xf28a12, h: 0.84, pts: [[0, 0], [0.24, 0.03], [0.4, 0.18], [0.44, 0.42], [0.4, 0.66], [0.24, 0.81], [0, 0.84]], skin: 'orange', gloss: 0.35, top: 'leaf', face: 0.44 },
    lemon:      { color: 0xf6d93a, h: 0.94, pts: [[0, 0], [0.05, 0.03], [0.18, 0.12], [0.32, 0.3], [0.36, 0.46], [0.32, 0.64], [0.18, 0.82], [0.05, 0.91], [0, 0.94]], skin: 'lemon', gloss: 0.45, top: 'none', face: 0.48 },
    pear:       { color: 0xb6cf3e, h: 0.98, pts: [[0, 0.02], [0.24, 0], [0.4, 0.14], [0.43, 0.32], [0.34, 0.52], [0.23, 0.7], [0.2, 0.84], [0.12, 0.95], [0, 0.97]], skin: 'plain', gloss: 0.35, top: 'stemleaf', face: 0.36 },
    strawberry: { color: 0xe3223a, h: 0.86, pts: [[0, 0], [0.09, 0.06], [0.25, 0.24], [0.37, 0.5], [0.4, 0.68], [0.33, 0.8], [0.12, 0.86], [0, 0.86]], skin: 'strawberry', gloss: 0.6, top: 'calyx', face: 0.52 },
    watermelon: { color: 0x3a8a3a, h: 0.86, pts: [[0, 0], [0.3, 0.03], [0.47, 0.2], [0.51, 0.42], [0.47, 0.64], [0.3, 0.82], [0, 0.86]], skin: 'watermelon', gloss: 0.55, top: 'nub', face: 0.44 },
    grape:      { color: 0x6b2d8a, h: 0.78, pts: [[0, 0], [0.22, 0.03], [0.36, 0.17], [0.4, 0.39], [0.36, 0.6], [0.22, 0.75], [0, 0.78]], skin: 'plain', gloss: 0.3, top: 'stem', face: 0.4 },
    peach:      { color: 0xf8a86a, h: 0.84, pts: [[0, 0.03], [0.22, 0], [0.4, 0.14], [0.44, 0.4], [0.4, 0.64], [0.26, 0.8], [0.06, 0.85], [0, 0.83]], skin: 'peach', gloss: 0.1, sheen: true, top: 'leaf', face: 0.42 },
    cherry:     { color: 0xb3101e, h: 0.74, pts: [[0, 0], [0.22, 0.02], [0.37, 0.15], [0.4, 0.36], [0.36, 0.56], [0.22, 0.7], [0.05, 0.74], [0, 0.71]], skin: 'plain', gloss: 1, top: 'longstem', face: 0.37 },
    banana:     { color: 0xf4d23c, h: 1.1, pts: [[0, 0], [0.06, 0.02], [0.17, 0.12], [0.22, 0.32], [0.23, 0.55], [0.2, 0.8], [0.12, 0.98], [0.05, 1.07], [0, 1.1]], skin: 'banana', gloss: 0.3, top: 'bananatip', bend: 0.32, face: 0.6 },
    pineapple:  { color: 0xd6a334, h: 0.98, pts: [[0, 0], [0.24, 0.03], [0.38, 0.18], [0.4, 0.45], [0.36, 0.72], [0.22, 0.9], [0, 0.94]], skin: 'pineapple', gloss: 0.2, top: 'crown', face: 0.48 },
    coconut:    { color: 0x6d4527, h: 0.84, pts: [[0, 0], [0.24, 0.03], [0.4, 0.18], [0.43, 0.42], [0.4, 0.64], [0.24, 0.8], [0, 0.84]], skin: 'coconut', gloss: 0, sheen: true, top: 'none', face: 0.44 },
    kiwi:       { color: 0x8a6a3a, h: 0.86, pts: [[0, 0], [0.22, 0.03], [0.36, 0.2], [0.38, 0.43], [0.36, 0.66], [0.22, 0.83], [0, 0.86]], skin: 'kiwi', gloss: 0, sheen: true, top: 'none', face: 0.44 },
    plum:       { color: 0x5a2a6e, h: 0.82, pts: [[0, 0.02], [0.22, 0], [0.38, 0.15], [0.42, 0.4], [0.38, 0.64], [0.22, 0.79], [0.04, 0.82], [0, 0.8]], skin: 'plain', gloss: 0.4, top: 'stem', face: 0.42 },
    blueberry:  { color: 0x34509a, h: 0.74, pts: [[0, 0], [0.24, 0.03], [0.38, 0.17], [0.42, 0.37], [0.38, 0.57], [0.25, 0.7], [0.08, 0.73], [0, 0.7]], skin: 'plain', gloss: 0.2, top: 'star', face: 0.37 },
    mango:      { color: 0xf2a23a, h: 0.92, pts: [[0, 0], [0.2, 0.03], [0.36, 0.2], [0.41, 0.45], [0.37, 0.7], [0.22, 0.87], [0, 0.92]], skin: 'peach', gloss: 0.35, top: 'stem', bend: 0.12, face: 0.46 },
    // Monster-only bodies.
    tomato:     { color: 0xd8382a, h: 0.7, pts: [[0, 0.02], [0.28, 0], [0.42, 0.13], [0.46, 0.34], [0.42, 0.56], [0.28, 0.68], [0.05, 0.7], [0, 0.68]], skin: 'plain', gloss: 0.7, top: 'calyx', face: 0.34 },
    eggplant:   { color: 0x4a1f5c, h: 1.1, pts: [[0, 0], [0.26, 0.04], [0.38, 0.22], [0.36, 0.45], [0.25, 0.7], [0.17, 0.9], [0.1, 1.05], [0, 1.1]], skin: 'plain', gloss: 0.9, top: 'cap', face: 0.55 },
    pumpkin:    { color: 0xe8741e, h: 0.8, pts: [[0, 0.04], [0.3, 0], [0.5, 0.14], [0.56, 0.38], [0.5, 0.62], [0.3, 0.77], [0.06, 0.8], [0, 0.76]], skin: 'pumpkin', gloss: 0.2, top: 'pumpkinstem', face: 0.4 },
    chili:      { color: 0xd8161e, h: 1.0, pts: [[0, 0], [0.05, 0.05], [0.12, 0.25], [0.2, 0.55], [0.23, 0.8], [0.18, 0.95], [0, 0.98]], skin: 'plain', gloss: 0.9, top: 'cap', bend: 0.25, face: 0.7 },
    durian:     { color: 0x9aa63a, h: 0.94, pts: [[0, 0], [0.26, 0.03], [0.44, 0.2], [0.48, 0.45], [0.44, 0.7], [0.26, 0.9], [0, 0.94]], skin: 'plain', gloss: 0.1, top: 'stem', face: 0.45 },
    mangoboss:  { color: 0xf5a020, h: 0.92, pts: [[0, 0], [0.2, 0.03], [0.36, 0.2], [0.41, 0.45], [0.37, 0.7], [0.22, 0.87], [0, 0.92]], skin: 'peach', gloss: 0.5, top: 'stem', bend: 0.12, face: 0.46 },
    cactus:     { color: 0x4f8f3a, h: 0.9, pts: [[0, 0], [0.3, 0.02], [0.38, 0.2], [0.38, 0.6], [0.32, 0.82], [0.16, 0.9], [0, 0.9]], skin: 'cactus', gloss: 0.2, top: 'pricklyfruit', face: 0.5 },
    lime:       { color: 0x6cc23a, h: 0.8, pts: [[0, 0], [0.05, 0.03], [0.2, 0.12], [0.34, 0.3], [0.37, 0.42], [0.33, 0.56], [0.2, 0.72], [0.05, 0.8], [0, 0.82]], skin: 'lime', gloss: 0.45, top: 'none', face: 0.42 },
};

function profile(def) {
    const pts = def.pts.map(([r, y]) => new THREE.Vector2(r, y * def.h / Math.max(...def.pts.map((p) => p[1]))));
    const curve = new THREE.SplineCurve(pts);
    const out = curve.getPoints(28);
    out[0].x = 0; out[out.length - 1].x = 0;
    for (const p of out) p.x = Math.max(0, p.x);
    return out;
}

/** Radius of the body at height y (for placing faces, hands and hats on the surface). */
export function radiusAt(kind, y) {
    const pts = profileCached(kind);
    for (let i = 1; i < pts.length; i++) if (pts[i].y >= y) {
        const a = pts[i - 1], b = pts[i];
        const t = (y - a.y) / Math.max(1e-5, b.y - a.y);
        return a.x + (b.x - a.x) * t;
    }
    return 0.1;
}
const profCache = new Map();
function profileCached(kind) { if (!profCache.has(kind)) profCache.set(kind, profile(FRUIT[kind])); return profCache.get(kind); }

export function bodyGeo(kind) {
    return cached('body:' + kind, () => {
        const def = FRUIT[kind];
        const g = new THREE.LatheGeometry(profileCached(kind), 32);
        // Rotate so the lathe seam (u = 0) sits at the back, not on the face.
        g.rotateY(Math.PI / 2);
        if (def.bend) {
            const p = g.attributes.position;
            for (let i = 0; i < p.count; i++) { const y = p.getY(i) / def.h; p.setZ(i, p.getZ(i) - def.bend * (y - 0.5) * (y - 0.5) * 1.6 + def.bend * 0.2); }
            g.computeVertexNormals();
        }
        return g;
    });
}

export function bodyMaterial(kind, { tint = 0, rotten = false, seed = 1 } = {}) {
    const def = FRUIT[kind];
    const base = new THREE.Color(def.color);
    if (tint) { const hsl = {}; base.getHSL(hsl); base.setHSL((hsl.h + tint + 1) % 1, hsl.s, hsl.l); }
    const hexc = base.getHex();
    const tex = rotten ? rottenTex(hexc, seed) : skinTex(def.skin === 'plain' ? 'mold' : def.skin, hexc);
    const m = new THREE.MeshPhysicalMaterial({
        map: tex.map, bumpMap: tex.bump || null, bumpScale: tex.bump ? 0.6 : 0,
        roughness: rotten ? 0.85 : 0.55 - def.gloss * 0.35, clearcoat: rotten ? 0 : def.gloss * 0.8, clearcoatRoughness: 0.35,
        sheen: def.sheen ? 1 : 0, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xffe0c0),
    });
    return m;
}

// ------------------------------------------------------------------ shared materials
const M = {};
export function mat(name) {
    if (M[name]) return M[name];
    const S = (o) => new THREE.MeshStandardMaterial(o);
    const P = (o) => new THREE.MeshPhysicalMaterial(o);
    const defs = {
        eyeWhite: () => P({ color: 0xffffff, roughness: 0.15, clearcoat: 1 }),
        pupil: () => P({ color: 0x14100e, roughness: 0.1, clearcoat: 1 }),
        shine: () => new THREE.MeshBasicMaterial({ color: 0xffffff }),
        mouth: () => S({ color: 0x3a0d12, roughness: 0.6 }),
        tongue: () => S({ color: 0xff6a8a, roughness: 0.5 }),
        teeth: () => S({ color: 0xfffaf0, roughness: 0.3 }),
        brow: () => S({ color: 0x2a1a10, roughness: 0.8 }),
        blush: () => new THREE.MeshBasicMaterial({ color: 0xff7a9a, transparent: true, opacity: 0.45, depthWrite: false }),
        glove: () => P({ color: 0xfaf6ee, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color(0xffffff) }),
        shoe: () => P({ color: 0x8a3a22, roughness: 0.4, clearcoat: 0.6 }),
        leaf: () => S({ color: 0x3f9a2e, roughness: 0.6, side: THREE.DoubleSide }),
        darkleaf: () => S({ color: 0x2d6e22, roughness: 0.6, side: THREE.DoubleSide }),
        stem: () => S({ color: 0x5a3a1c, roughness: 0.9 }),
        steel: () => S({ color: 0xc8ccd4, roughness: 0.25, metalness: 0.9 }),
        darksteel: () => S({ color: 0x5a6070, roughness: 0.35, metalness: 0.8 }),
        gold: () => S({ color: 0xffc23a, roughness: 0.25, metalness: 1, emissive: 0x3a2000 }),
        wood: () => S({ color: 0xb07a44, roughness: 0.7 }),
        darkwood: () => S({ color: 0x6a4424, roughness: 0.8 }),
        bread: () => S({ color: 0xd9973e, roughness: 0.75 }),
        cloth: () => S({ color: 0x3a62c8, roughness: 0.85 }),
        red: () => S({ color: 0xd8282e, roughness: 0.6 }),
        white: () => S({ color: 0xf4f0e8, roughness: 0.7 }),
        black: () => S({ color: 0x1c1a1e, roughness: 0.6 }),
        pink: () => S({ color: 0xff8ab0, roughness: 0.5 }),
        purple: () => S({ color: 0x6a3aa8, roughness: 0.6 }),
        green: () => S({ color: 0x4ea03a, roughness: 0.6 }),
        candy: () => S({ color: 0xffffff, roughness: 0.35 }),
        glow: () => new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.2, 0.8) }),
        glowPink: () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.6, 1.4) }),
        glowOrange: () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 1.3, 0.3) }),
        glowBlue: () => new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.6, 2.6) }),
        glass: () => new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, roughness: 0.05, transmission: 0.0, transparent: true, opacity: 0.35, clearcoat: 1 }),
        spike: () => S({ color: 0x7a7a2a, roughness: 0.6 }),
        bone: () => S({ color: 0xf0e6c8, roughness: 0.7 }),
    };
    M[name] = defs[name]();
    M[name].userData.shared = true;
    return M[name];
}

const sphere = (r, seg = 16) => cached(`sph:${r}:${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.75)));
const box = (x, y, z) => cached(`box:${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z));
const cyl = (a, b, h, s = 12) => cached(`cyl:${a}:${b}:${h}:${s}`, () => new THREE.CylinderGeometry(a, b, h, s));
const cone = (r, h, s = 10) => cached(`cone:${r}:${h}:${s}`, () => new THREE.ConeGeometry(r, h, s));
const torus = (r, t, arc = Math.PI * 2, rs = 8, ts = 20) => cached(`tor:${r}:${t}:${arc}:${rs}:${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
const leafGeo = () => cached('leaf', () => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.quadraticCurveTo(0.09, 0.08, 0, 0.22); s.quadraticCurveTo(-0.09, 0.08, 0, 0);
    const g = new THREE.ShapeGeometry(s, 6);
    return g;
});
/** Free a model's own geometries and materials (never the shared kit pieces or any textures). */
export function disposeModel(root) {
    root.traverse((o) => {
        if (o.geometry && !o.isSprite && !o.geometry.userData.shared) o.geometry.dispose();
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of ms) if (!m.userData.shared) m.dispose();
    });
}

export const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };

// ------------------------------------------------------------------ tops (stems, leaves, crowns)
function addTop(group, kind, top, scale = 1) {
    const def = FRUIT[kind];
    const ty = def.h;
    const add = (o) => { group.add(o); return o; };
    switch (top) {
        case 'stemleaf': {
            const s = add(mesh(cyl(0.022, 0.03, 0.16, 6), mat('stem'), 0.01, ty - 0.02, 0)); s.rotation.z = -0.25;
            const l = add(mesh(leafGeo(), mat('leaf'), 0.04, ty + 0.03, 0)); l.rotation.set(-0.4, 0.6, -1.0);
            break;
        }
        case 'leaf': { const l = add(mesh(leafGeo(), mat('leaf'), 0.0, ty - 0.01, 0)); l.rotation.set(-0.9, 0.3, -0.5); add(mesh(cyl(0.015, 0.02, 0.06, 6), mat('stem'), 0, ty, 0)); break; }
        case 'stem': { const s = add(mesh(cyl(0.018, 0.026, 0.14, 6), mat('stem'), 0, ty + 0.02, 0)); s.rotation.z = 0.2; break; }
        case 'longstem': { const s = add(mesh(cyl(0.014, 0.02, 0.38, 6), mat('stem'), 0.06, ty + 0.14, 0)); s.rotation.z = -0.35; const l = add(mesh(leafGeo(), mat('leaf'), 0.14, ty + 0.3, 0)); l.rotation.set(0.3, 0, -1.2); break; }
        case 'nub': add(mesh(cyl(0.02, 0.03, 0.06, 6), mat('stem'), 0, ty, 0)); break;
        case 'calyx': case 'cap': {
            const n = top === 'cap' ? 6 : 7;
            for (let i = 0; i < n; i++) {
                const l = add(mesh(leafGeo(), mat(top === 'cap' ? 'darkleaf' : 'leaf'), 0, ty - 0.03, 0));
                l.rotation.set(-1.25, (i / n) * Math.PI * 2, 0, 'YXZ');
                l.scale.setScalar(top === 'cap' ? 0.9 : 0.85);
            }
            add(mesh(cyl(0.02, 0.03, 0.09, 6), mat('stem'), 0, ty + 0.03, 0));
            break;
        }
        case 'star': for (let i = 0; i < 5; i++) { const c = add(mesh(cone(0.03, 0.08, 4), mat('black'), Math.cos(i * 1.256) * 0.05, ty - 0.01, Math.sin(i * 1.256) * 0.05)); c.rotation.z = Math.cos(i * 1.256) * -1.2; c.rotation.x = Math.sin(i * 1.256) * 1.2; } break;
        case 'crown': {
            for (let i = 0; i < 11; i++) {
                const l = add(mesh(leafGeo(), mat(i % 2 ? 'leaf' : 'darkleaf'), 0, ty - 0.04, 0));
                l.rotation.set(-0.35 - (i % 3) * 0.2, (i / 11) * Math.PI * 2, 0, 'YXZ');
                l.scale.set(1.0, 2.2 - (i % 3) * 0.4, 1);
            }
            break;
        }
        case 'bananatip': add(mesh(cyl(0.03, 0.045, 0.1, 6), mat('stem'), 0, ty + 0.02, -0.02)); break;
        case 'pumpkinstem': { const s = add(mesh(cyl(0.04, 0.06, 0.16, 6), mat('darkleaf'), 0, ty + 0.03, 0)); s.rotation.z = 0.3; break; }
        case 'pricklyfruit': add(mesh(sphere(0.12, 10), mat('pink'), 0, ty + 0.06, 0)); break;
    }
}

export const __addTop = addTop;

// ------------------------------------------------------------------ faces
/**
 * Put a face on a body. opts: { eyes, mouth, angry, brows, scale, eyeColor }
 * Returns { eyesGroup, lids } so actors can blink.
 */
export function addFace(group, kind, opts = {}) {
    const def = FRUIT[kind];
    const fy = def.h * def.face + (opts.lift || 0);
    const r = radiusAt(kind, fy);
    const sc = opts.scale || 1;
    const face = new THREE.Group();
    face.position.set(0, fy, 0);
    group.add(face);
    const onSurf = (x, y) => { const rr = radiusAt(kind, fy + y); const zz = Math.sqrt(Math.max(0, rr * rr - x * x)); return zz; };
    const eyes = new THREE.Group();
    face.add(eyes);
    const style = opts.eyes || 'round';
    const ex = 0.105 * sc, er = (style === 'goggle' ? 0.1 : 0.078) * sc;
    const eyeY = 0.05 * sc;
    for (const sx of [-1, 1]) {
        const x = sx * ex, z = onSurf(x, eyeY) - er * 0.35;
        if (style === 'happy') {
            const arc = mesh(torus(0.05 * sc, 0.014 * sc, Math.PI, 6, 12), mat('pupil'), x, eyeY - 0.01, z + er * 0.4);
            face.add(arc);
            continue;
        }
        const white = mesh(sphere(er, 14), mat('eyeWhite'), x, eyeY, z);
        eyes.add(white);
        const pr = er * (style === 'goggle' ? 0.42 : 0.55);
        const pupil = mesh(sphere(pr, 10), opts.pupilMat || mat('pupil'), x + sx * -0.006, eyeY - 0.005, z + er * 0.72);
        eyes.add(pupil);
        eyes.add(mesh(sphere(pr * 0.35, 6), mat('shine'), x + 0.012 * sc, eyeY + 0.016 * sc, z + er * 0.92));
        if (style === 'starry') eyes.add(mesh(sphere(pr * 0.3, 6), mat('shine'), x - 0.012 * sc, eyeY - 0.014 * sc, z + er * 0.95));
        if (style === 'sleepy') {
            const lid = mesh(sphere(er * 1.06, 12, ), opts.lidMat || mat('brow'), x, eyeY, z);
            lid.scale.set(1, 0.55, 1); lid.position.y += er * 0.45;
            eyes.add(lid);
        }
        if (style === 'goggle') { const ring = mesh(torus(er * 1.02, 0.014, Math.PI * 2, 6, 18), mat('darksteel'), x, eyeY, z + er * 0.5); eyes.add(ring); }
        if (style === 'fierce' || opts.angry) {
            const b = mesh(box(0.1 * sc, 0.024 * sc, 0.03), mat('brow'), x, eyeY + er + 0.03 * sc, z + 0.03);
            b.rotation.z = sx * (opts.angry ? 0.5 : 0.3);
            face.add(b);
        }
    }
    // Mouth.
    const mstyle = opts.mouth || 'smile';
    const my = -0.075 * sc, mz = onSurf(0, my);
    switch (mstyle) {
        case 'smile': case 'tongue': case 'teeth': {
            const m = mesh(torus(0.06 * sc, 0.014 * sc, Math.PI, 6, 14), mat('mouth'), 0, my + 0.03 * sc, mz - 0.005);
            m.rotation.z = Math.PI; face.add(m);
            if (mstyle === 'tongue') face.add(mesh(sphere(0.026 * sc, 8), mat('tongue'), 0.01, my - 0.03 * sc, mz));
            if (mstyle === 'teeth') { face.add(mesh(box(0.024 * sc, 0.03 * sc, 0.01), mat('teeth'), -0.014 * sc, my - 0.04 * sc, mz - 0.002)); face.add(mesh(box(0.024 * sc, 0.03 * sc, 0.01), mat('teeth'), 0.014 * sc, my - 0.04 * sc, mz - 0.002)); }
            break;
        }
        case 'grin': {
            const g = mesh(cached('grin', () => new THREE.CircleGeometry(0.075, 16, Math.PI, Math.PI)), mat('mouth'), 0, my + 0.02 * sc, mz + 0.004);
            g.scale.setScalar(sc); face.add(g);
            const t = mesh(cached('grinT', () => new THREE.PlaneGeometry(0.11, 0.02)), mat('teeth'), 0, my + 0.008 * sc, mz + 0.006); t.scale.setScalar(sc); face.add(t);
            break;
        }
        case 'o': face.add(mesh(torus(0.026 * sc, 0.012 * sc, Math.PI * 2, 6, 12), mat('mouth'), 0, my, mz - 0.004)); break;
        case 'smirk': { const m = mesh(torus(0.05 * sc, 0.013 * sc, Math.PI * 0.6, 6, 10), mat('mouth'), 0.02, my + 0.025 * sc, mz - 0.004); m.rotation.z = Math.PI * 1.15; face.add(m); break; }
        case 'frown': { const m = mesh(torus(0.05 * sc, 0.014 * sc, Math.PI, 6, 12), mat('mouth'), 0, my - 0.03 * sc, mz - 0.004); face.add(m); break; }
        case 'fangs': {
            const g = mesh(cached('grin', () => new THREE.CircleGeometry(0.075, 16, Math.PI, Math.PI)), mat('mouth'), 0, my + 0.02 * sc, mz + 0.004);
            g.scale.setScalar(sc); face.add(g);
            for (const sx of [-1, 1]) { const f = mesh(cone(0.014 * sc, 0.04 * sc, 5), mat('teeth'), sx * 0.035 * sc, my - 0.0 * sc, mz + 0.008); f.rotation.x = Math.PI; face.add(f); }
            break;
        }
    }
    if (opts.blush !== false && !opts.angry) for (const sx of [-1, 1]) {
        const b = mesh(cached('blush', () => new THREE.CircleGeometry(0.035, 12)), mat('blush'), sx * 0.17 * sc, -0.02 * sc, onSurf(sx * 0.17 * sc, -0.02) + 0.004);
        b.rotation.y = sx * 0.45; b.castShadow = false; face.add(b);
    }
    return { face, eyes };
}

// ------------------------------------------------------------------ hats
export function addHat(group, kind, hat, color = null) {
    if (!hat || hat === 'none') return null;
    const def = FRUIT[kind];
    const top = def.h;
    const r = Math.max(0.16, radiusAt(kind, top * 0.86));
    const g = new THREE.Group();
    g.position.y = top * 0.9;
    const add = (o) => { g.add(o); return o; };
    switch (hat) {
        case 'helm': {
            g.position.y = top * 0.95;
            const hr = r * 0.82;
            const dome = add(mesh(cached('helmDome', () => new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mat('steel'), 0, -0.02, 0));
            dome.scale.set(hr, hr * 0.85, hr);
            const plume = add(mesh(sphere(0.08, 10), mat('red'), 0, hr * 0.95, -0.02)); plume.scale.set(0.6, 1.5, 1.7);
            add(mesh(torus(hr, 0.025, Math.PI * 2, 6, 24), mat('darksteel'), 0, -0.02, 0)).rotation.x = Math.PI / 2;
            break;
        }
        case 'viking': {
            g.position.y = top * 0.95;
            const dome = add(mesh(cached('helmDome', () => new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)), mat('darksteel'), 0, -0.02, 0));
            dome.scale.set(r * 1.08, r * 0.95, r * 1.08);
            for (const sx of [-1, 1]) { const h = add(mesh(cone(0.05, 0.26, 8), mat('bone'), sx * r * 1.05, r * 0.4, 0)); h.rotation.z = -sx * 0.9; }
            break;
        }
        case 'wizard': {
            const c = add(mesh(cone(r * 0.95, r * 2.6, 16), new THREE.MeshStandardMaterial({ color: color || 0x3a4ac8, roughness: 0.8 }), 0, r * 1.2, -0.02));
            c.rotation.x = -0.18;
            add(mesh(cached('brim', () => new THREE.CylinderGeometry(1, 1, 0.03, 20)), c.material, 0, 0, 0)).scale.set(r * 1.6, 1, r * 1.6);
            for (let i = 0; i < 3; i++) add(mesh(sphere(0.025, 6), mat('gold'), Math.sin(i * 2) * r * 0.6, r * (0.5 + i * 0.45), Math.cos(i * 2) * r * 0.5));
            break;
        }
        case 'feather': {
            g.position.y = top * 0.96;
            const cr = r * 0.78;
            const cap = add(mesh(cached('capDome', () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), new THREE.MeshStandardMaterial({ color: color || 0x2e7a3a, roughness: 0.8 }), 0, 0, 0));
            cap.scale.set(cr, cr * 0.75, cr);
            const brim = add(mesh(cached('cbrim', () => new THREE.CylinderGeometry(1, 1, 0.025, 20, 1, false, 0, Math.PI)), cap.material, 0, 0, 0.02)); brim.scale.set(cr * 1.15, 1, cr * 1.15); brim.rotation.y = -Math.PI / 2; brim.rotation.x = -0.25;
            const f = add(mesh(leafGeo(), mat('red'), r * 0.6, r * 0.4, -0.05)); f.scale.set(0.8, 2.4, 1); f.rotation.set(0.2, 0, -0.5);
            break;
        }
        case 'crown': {
            add(mesh(cyl(r * 0.8, r * 0.85, r * 0.45, 16), mat('gold'), 0, r * 0.15, 0));
            for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(mesh(cone(0.04, 0.12, 5), mat('gold'), Math.cos(a) * r * 0.78, r * 0.45, Math.sin(a) * r * 0.78)); add(mesh(sphere(0.025, 6), mat(i % 2 ? 'glowPink' : 'glowBlue'), Math.cos(a) * r * 0.86, r * 0.18, Math.sin(a) * r * 0.86)); }
            break;
        }
        case 'bandana': {
            const b = add(mesh(torus(r * 0.98, 0.045, Math.PI * 2, 8, 24), new THREE.MeshStandardMaterial({ color: color || 0xd82a3a, roughness: 0.8 }), 0, -r * 0.05, 0)); b.rotation.x = Math.PI / 2;
            for (const sx of [-1, 1]) { const t = add(mesh(box(0.05, 0.16, 0.02), b.material, sx * 0.05, -r * 0.2, -r * 1.0)); t.rotation.z = sx * 0.4; }
            break;
        }
        case 'propeller': {
            const cap = add(mesh(cached('capDome', () => new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)), mat('cloth'), 0, 0, 0)); cap.scale.set(r * 1.02, r * 0.75, r * 1.02);
            add(mesh(cyl(0.012, 0.012, 0.1, 6), mat('black'), 0, r * 0.8, 0));
            const prop = new THREE.Group(); prop.position.y = r * 0.85; prop.name = 'propeller';
            prop.add(mesh(box(0.34, 0.012, 0.05), mat('red'))); prop.add(mesh(box(0.05, 0.012, 0.34), mat('pink')));
            g.add(prop);
            break;
        }
        case 'chef': {
            add(mesh(cyl(r * 0.8, r * 0.75, r * 0.6, 16), mat('white'), 0, r * 0.25, 0));
            for (let i = 0; i < 5; i++) add(mesh(sphere(r * 0.42, 10), mat('white'), Math.cos(i * 1.256) * r * 0.42, r * 0.75, Math.sin(i * 1.256) * r * 0.42));
            add(mesh(sphere(r * 0.45, 10), mat('white'), 0, r * 0.85, 0));
            break;
        }
        case 'pirate': {
            const b = add(mesh(cyl(r * 1.45, r * 1.45, 0.03, 3), mat('black'), 0, 0.02, 0)); b.rotation.y = Math.PI / 6;
            add(mesh(cyl(r * 0.6, r * 0.8, r * 0.5, 12), mat('black'), 0, r * 0.25, 0));
            add(mesh(sphere(0.04, 8), mat('bone'), 0, r * 0.3, r * 0.68));
            break;
        }
        case 'flower': {
            for (let i = 0; i < 6; i++) { const p = add(mesh(sphere(0.06, 8), mat('pink'), Math.cos(i * 1.05) * 0.075, 0.03, Math.sin(i * 1.05) * 0.075)); p.scale.set(1, 0.45, 1); }
            add(mesh(sphere(0.045, 8), mat('gold'), 0, 0.05, 0));
            g.position.x = r * 0.4; g.rotation.z = -0.4;
            break;
        }
        case 'tophat': {
            add(mesh(cyl(r * 1.25, r * 1.25, 0.03, 18), mat('black'), 0, 0, 0));
            add(mesh(cyl(r * 0.7, r * 0.72, r * 1.3, 18), mat('black'), 0, r * 0.65, 0));
            add(mesh(cyl(r * 0.73, r * 0.73, r * 0.22, 18), mat('red'), 0, r * 0.12, 0));
            g.rotation.z = 0.12;
            break;
        }
    }
    group.add(g);
    return g;
}

// ------------------------------------------------------------------ hands & feet
export function makeHand(glove = 'glove', r = 0.082) {
    const h = mesh(sphere(r, 12), mat(glove));
    h.scale.set(1, 0.9, 1.1);
    const thumb = mesh(sphere(r * 0.42, 8), mat(glove), r * 0.6, r * 0.35, r * 0.3);
    h.add(thumb);
    return h;
}
export function makeFoot(shoeMat = null) {
    const f = mesh(sphere(0.085, 12), shoeMat || mat('shoe'));
    f.scale.set(1.1, 0.75, 1.6);
    return f;
}

// ------------------------------------------------------------------ weapons
// All built along +Y with the grip at the origin; held in the right hand.
const FAMILY = {
    'Butter Knife': 'knife', 'Spork': 'spork', 'Cleaver': 'cleaver', 'Bread Knife': 'longknife', 'Pizza Wheel': 'pizza', "Chef's Cleaver": 'cleaver',
    'Santoku': 'longknife', 'Mythril Mandoline': 'longknife', 'Obsidian Peeler': 'peeler',
    'Rolling Pin': 'pin', 'Baguette': 'baguette', 'Giant Spatula': 'spatula', 'Garden Hoe': 'hoe', 'Cast-Iron Skillet': 'skillet', 'Grand Cleaver': 'bigcleaver', 'Meat-Free Tenderiser': 'mallet',
    'Straw Shooter': 'straw', 'Slingshot': 'slingshot', 'Rubber-band Bow': 'bow', 'Licorice Longbow': 'bow', 'Bamboo Bow': 'bow', 'Crossbow of Crumbs': 'crossbow', 'Seedcannon': 'cannon', 'Harpoon of Plenty': 'crossbow',
    'Pretzel Wand': 'pretzel', 'Chopstick': 'chopstick', 'Cinnamon Stick': 'cinnamon', 'Vanilla Pod': 'cinnamon', 'Star-Anise Wand': 'starwand', 'Saffron Scepter': 'starwand', 'Truffle Baton': 'starwand',
    'Celery Staff': 'celery', 'Licorice Staff': 'licorice', 'Candy-Cane Staff': 'candycane', 'Rhubarb Rod': 'celery', 'Sugarcane Stave': 'candycane', 'Bamboo of Ages': 'licorice',
    'Pot Lid': 'potlid', 'Pie Tin': 'pietin', 'Cutting Board': 'board', 'Trash-Can Lid': 'potlid', 'Wok': 'wok', 'Paella Pan': 'wok', 'Cauldron Lid': 'potlid',
    'Seed Pouch': 'pouch', 'Seed Satchel': 'pouch', 'Bottomless Bag': 'pouch', 'Cornucopia': 'pouch',
    'Gumball': 'gumball', 'Jawbreaker': 'gumball', 'Snow Globe': 'globe', 'Crystal Melon': 'globe',
};

export function makeWeapon(item) {
    const g = new THREE.Group();
    if (!item) return g;
    const fam = FAMILY[item.base] || 'knife';
    const add = (o) => { g.add(o); return o; };
    const glowing = item.rarity === 'legendary';
    const blade = glowing ? mat('gold') : mat('steel');
    switch (fam) {
        case 'knife': add(mesh(cyl(0.025, 0.028, 0.16, 8), mat('wood'), 0, 0.02, 0)); add(mesh(box(0.06, 0.34, 0.012), blade, 0.008, 0.27, 0)); break;
        case 'longknife': add(mesh(cyl(0.025, 0.028, 0.18, 8), mat('black'), 0, 0.02, 0)); { const b = add(mesh(box(0.075, 0.5, 0.012), blade, 0.01, 0.36, 0)); b.scale.x = 1; } add(mesh(cone(0.038, 0.1, 4), blade, 0.01, 0.65, 0)); break;
        case 'peeler': add(mesh(cyl(0.03, 0.03, 0.2, 8), mat('purple'), 0, 0.02, 0)); add(mesh(torus(0.08, 0.016, Math.PI * 2, 6, 14), mat('glowPink'), 0, 0.24, 0)); break;
        case 'spork': add(mesh(cyl(0.022, 0.022, 0.42, 8), mat('red'), 0, 0.12, 0)); { const s = add(mesh(sphere(0.07, 10), mat('red'), 0, 0.38, 0)); s.scale.set(1, 1.3, 0.35); } for (let i = -1; i <= 1; i++) add(mesh(box(0.016, 0.08, 0.016), mat('red'), i * 0.035, 0.48, 0)); break;
        case 'cleaver': add(mesh(cyl(0.028, 0.03, 0.16, 8), mat('darkwood'), 0, 0.02, 0)); add(mesh(box(0.18, 0.28, 0.014), blade, 0.06, 0.26, 0)); add(mesh(cyl(0.02, 0.02, 0.02, 8), mat('black'), 0.11, 0.35, 0)).rotation.x = Math.PI / 2; break;
        case 'bigcleaver': add(mesh(cyl(0.03, 0.03, 0.4, 8), mat('darkwood'), 0, 0.1, 0)); add(mesh(box(0.3, 0.5, 0.02), blade, 0.1, 0.5, 0)); break;
        case 'pizza': add(mesh(cyl(0.025, 0.028, 0.26, 8), mat('red'), 0, 0.06, 0)); { const d = add(mesh(cyl(0.12, 0.12, 0.016, 20), blade, 0, 0.3, 0)); d.rotation.z = Math.PI / 2; } break;
        case 'pin': add(mesh(cyl(0.075, 0.075, 0.5, 14), mat('wood'), 0, 0.32, 0)); add(mesh(cyl(0.025, 0.025, 0.14, 8), mat('darkwood'), 0, 0.02, 0)); add(mesh(cyl(0.025, 0.025, 0.14, 8), mat('darkwood'), 0, 0.62, 0)); break;
        case 'baguette': { const b = add(mesh(cached('bag', () => new THREE.CapsuleGeometry(0.07, 0.75, 6, 12)), mat('bread'), 0, 0.38, 0)); for (let i = 0; i < 4; i++) { const s = add(mesh(box(0.1, 0.016, 0.02), mat('white'), 0, 0.15 + i * 0.17, 0.065)); s.rotation.z = 0.5; } break; }
        case 'spatula': add(mesh(cyl(0.024, 0.024, 0.5, 8), mat('black'), 0, 0.15, 0)); add(mesh(box(0.2, 0.26, 0.02), mat('darksteel'), 0, 0.52, 0)); break;
        case 'hoe': add(mesh(cyl(0.024, 0.024, 0.8, 8), mat('wood'), 0, 0.3, 0)); add(mesh(box(0.2, 0.06, 0.12), blade, 0.06, 0.7, 0.04)); break;
        case 'skillet': add(mesh(cyl(0.028, 0.028, 0.32, 8), mat('black'), 0, 0.08, 0)); { const p = add(mesh(cyl(0.18, 0.15, 0.06, 18), mat('black'), 0, 0.42, 0)); p.rotation.x = Math.PI / 2; } break;
        case 'mallet': add(mesh(cyl(0.024, 0.024, 0.55, 8), mat('wood'), 0, 0.2, 0)); add(mesh(box(0.26, 0.14, 0.14), mat('darksteel'), 0, 0.5, 0)); break;
        case 'straw': { const s = add(mesh(cyl(0.022, 0.022, 0.5, 8), mat('candy'), 0, 0.2, 0)); s.rotation.x = Math.PI / 2 - 0.2; add(mesh(cyl(0.024, 0.024, 0.1, 8), mat('red'), 0, 0.22, 0.12)).rotation.x = Math.PI / 2; break; }
        case 'slingshot': add(mesh(cyl(0.026, 0.026, 0.2, 8), mat('darkwood'), 0, 0.05, 0)); for (const sx of [-1, 1]) { const a = add(mesh(cyl(0.022, 0.022, 0.18, 8), mat('darkwood'), sx * 0.06, 0.2, 0)); a.rotation.z = -sx * 0.4; } add(mesh(box(0.15, 0.012, 0.012), mat('red'), 0, 0.27, -0.02)); break;
        case 'bow': { const arc = add(mesh(torus(0.32, 0.022, Math.PI * 0.9, 6, 16), mat(fam === 'bow' && item.base.includes('Licorice') ? 'black' : 'wood'), -0.0, 0.0, 0)); arc.rotation.z = Math.PI / 2 + Math.PI * 0.05; arc.rotation.y = Math.PI / 2; add(mesh(cyl(0.006, 0.006, 0.6, 4), mat('white'), 0, 0, -0.1)); g.rotation.x = 0; break; }
        case 'crossbow': add(mesh(box(0.06, 0.5, 0.06), mat('darkwood'), 0, 0.2, 0)); add(mesh(box(0.5, 0.04, 0.04), mat('wood'), 0, 0.4, 0)); break;
        case 'cannon': { const c = add(mesh(cyl(0.07, 0.09, 0.5, 12), mat('green'), 0, 0.25, 0)); c.rotation.x = 0.1; add(mesh(torus(0.08, 0.02, Math.PI * 2, 6, 14), mat('gold'), 0, 0.48, 0)).rotation.x = Math.PI / 2; break; }
        case 'pretzel': add(mesh(cyl(0.02, 0.022, 0.3, 8), mat('bread'), 0, 0.12, 0)); { const k = add(mesh(cached('pretzel', () => new THREE.TorusKnotGeometry(0.06, 0.018, 40, 6, 2, 3)), mat('bread'), 0, 0.33, 0)); k.scale.setScalar(1); } add(mesh(sphere(0.03, 8), mat('glow'), 0, 0.33, 0.02)); break;
        case 'chopstick': add(mesh(cyl(0.01, 0.018, 0.5, 6), mat('darkwood'), 0, 0.2, 0)); add(mesh(sphere(0.035, 8), mat('glowBlue'), 0, 0.46, 0)); break;
        case 'cinnamon': add(mesh(cyl(0.03, 0.03, 0.42, 8), mat('darkwood'), 0, 0.18, 0)); add(mesh(sphere(0.04, 8), mat('glowOrange'), 0, 0.42, 0)); break;
        case 'starwand': add(mesh(cyl(0.02, 0.02, 0.4, 8), mat('gold'), 0, 0.15, 0)); { const s = add(mesh(cached('star', () => new THREE.OctahedronGeometry(0.08, 0)), mat('glowPink'), 0, 0.42, 0)); s.scale.set(1, 1, 0.4); } break;
        case 'celery': { add(mesh(cyl(0.035, 0.04, 1.1, 8), mat('green'), 0, 0.3, 0)); for (let i = 0; i < 4; i++) { const l = add(mesh(leafGeo(), mat('leaf'), 0, 0.84, 0)); l.rotation.set(0.5, i * 1.57, 0, 'YXZ'); l.scale.setScalar(1.3); } add(mesh(sphere(0.05, 8), mat('glow'), 0, 0.9, 0)); break; }
        case 'licorice': { const s = add(mesh(cyl(0.035, 0.035, 1.1, 6), mat('black'), 0, 0.3, 0)); s.rotation.y = 0.5; add(mesh(sphere(0.07, 10), mat('glowPink'), 0, 0.9, 0)); break; }
        case 'candycane': {
            const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, 0.5, 0), new THREE.Vector3(0, 0.8, 0), new THREE.Vector3(0.08, 0.92, 0), new THREE.Vector3(0.18, 0.86, 0), new THREE.Vector3(0.19, 0.74, 0)]);
            const tube = cached('cane', () => new THREE.TubeGeometry(curve, 40, 0.035, 8, false));
            add(mesh(tube, candyMat()));
            break;
        }
        case 'potlid': add(mesh(cached('lid', () => new THREE.SphereGeometry(0.26, 20, 6, 0, Math.PI * 2, 0, Math.PI * 0.32)), mat('steel'), 0, -0.2, 0)); add(mesh(sphere(0.04, 8), mat('black'), 0, 0.04, 0)); g.rotation.x = Math.PI / 2; break;
        case 'pietin': add(mesh(cyl(0.24, 0.2, 0.05, 20), mat('bread'), 0, 0, 0)); add(mesh(torus(0.23, 0.03, Math.PI * 2, 6, 20), mat('bread'), 0, 0.02, 0)).rotation.x = Math.PI / 2; for (let i = -1; i <= 1; i++) { add(mesh(box(0.4, 0.02, 0.04), mat('bread'), 0, 0.03, i * 0.1)); add(mesh(box(0.04, 0.02, 0.4), mat('bread'), i * 0.1, 0.035, 0)); } g.rotation.x = Math.PI / 2; break;
        case 'board': add(mesh(box(0.34, 0.46, 0.04), mat('wood'), 0, 0, 0)); add(mesh(cyl(0.04, 0.04, 0.05, 10), mat('darkwood'), 0, 0.17, 0)).rotation.x = Math.PI / 2; break;
        case 'wok': { const w = add(mesh(cached('wok', () => new THREE.SphereGeometry(0.28, 20, 8, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.4)), mat('black'), 0, 0.25, 0)); w.material = mat('darksteel'); g.rotation.x = -Math.PI / 2; break; }
        case 'pouch': { const p = add(mesh(sphere(0.12, 10), mat('darkwood'), 0, 0, 0)); p.scale.set(1, 1.15, 0.8); add(mesh(torus(0.05, 0.015, Math.PI * 2, 6, 10), mat('red'), 0, 0.12, 0)).rotation.x = Math.PI / 2; break; }
        case 'gumball': add(mesh(sphere(0.1, 14), new THREE.MeshPhysicalMaterial({ color: [0xff4a6a, 0x4ac8ff, 0xffd84a, 0x6aff8a][item.id % 4], roughness: 0.15, clearcoat: 1, emissive: 0x220011 }), 0, 0, 0)); break;
        case 'globe': add(mesh(sphere(0.12, 16), mat('glass'), 0, 0, 0)); add(mesh(sphere(0.06, 10), mat('glowBlue'), 0, -0.02, 0)); add(mesh(cyl(0.08, 0.1, 0.05, 12), mat('wood'), 0, -0.12, 0)); break;
    }
    g.userData.family = fam;
    return g;
}

let _candy = null;
function candyMat() {
    if (_candy) return _candy;
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 256);
    x.fillStyle = '#e8202e';
    for (let i = -4; i < 20; i++) { x.beginPath(); x.moveTo(0, i * 20); x.lineTo(64, i * 20 + 24); x.lineTo(64, i * 20 + 34); x.lineTo(0, i * 20 + 10); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 4);
    _candy = new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 });
    _candy.userData.shared = true;
    return _candy;
}
export { candyMat };

/** Whether a weapon family is held like a bow (pointed forward) rather than swung. */
export const isRanged = (fam) => ['straw', 'slingshot', 'bow', 'crossbow', 'cannon'].includes(fam);
