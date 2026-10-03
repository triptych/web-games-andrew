/**
 * models.js — procedural low-poly models for the party, every monster body
 * plan, the six bosses, siege engines and obstacles.
 *
 * A model is a small rig: a root Group holding a few meshes (body, arms,
 * legs, wings, tail…) whose geometries are merged primitives with vertex
 * colours. Glowing bits (eyes, staff orbs, cauldron brew) go into a sibling
 * mesh with an unlit material so bloom picks them up. Geometries are cached
 * per species / unit type; each actor gets its own material so it can flash
 * when hit. Models face +x; monsters are turned around by the view.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ------------------------------------------------------------------ Part builder

const PRIM = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sph: new THREE.IcosahedronGeometry(1, 1),
    sph2: new THREE.IcosahedronGeometry(1, 2),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
    cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
    cone: new THREE.ConeGeometry(1, 1, 8),
    cone4: new THREE.ConeGeometry(1, 1, 4),
    oct: new THREE.OctahedronGeometry(1, 0),
    ico: new THREE.IcosahedronGeometry(1, 0),
    tor: new THREE.TorusGeometry(1, 0.12, 5, 12, Math.PI),
    ring: new THREE.TorusGeometry(1, 0.08, 4, 16),
    dod: new THREE.DodecahedronGeometry(1, 0),
};
for (const k in PRIM) { const g = PRIM[k].index ? PRIM[k].toNonIndexed() : PRIM[k]; g.deleteAttribute('uv'); PRIM[k] = g; }

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _c = new THREE.Color();

function hash3(a, b, c) {
    let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Parts {
    constructor(seed = 1) { this.solid = []; this.glow = []; this.seed = seed; this.n = 0; }
    /** prim: key of PRIM or a geometry. opts: {glow, rough (colour noise 0..1)} */
    add(prim, color, pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0], opts = {}) {
        const src = typeof prim === 'string' ? PRIM[prim] : prim;
        const g = src.clone();
        _m.compose(_p.set(pos[0], pos[1], pos[2]), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.set(scale[0], scale[1], scale[2]));
        g.applyMatrix4(_m);
        const n = g.attributes.position.count;
        const arr = new Float32Array(n * 3);
        _c.set(color);
        const rough = opts.rough ?? 0.07;
        const id = this.n++;
        for (let i = 0; i < n; i += 3) {
            const f = 1 + (hash3(this.seed, id, i) - 0.5) * 2 * rough;
            for (let k = 0; k < 3; k++) {
                arr[(i + k) * 3] = Math.min(1, _c.r * f);
                arr[(i + k) * 3 + 1] = Math.min(1, _c.g * f);
                arr[(i + k) * 3 + 2] = Math.min(1, _c.b * f);
            }
        }
        g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
        if (g.attributes.uv) g.deleteAttribute('uv');
        (opts.glow ? this.glow : this.solid).push(g);
        return this;
    }
    box(c, p, s, r, o) { return this.add('box', c, p, s, r, o); }
    sph(c, p, s, r, o) { return this.add('sph', c, p, s, r, o); }
    cyl(c, p, s, r, o) { return this.add('cyl', c, p, s, r, o); }
    cone(c, p, s, r, o) { return this.add('cone', c, p, s, r, o); }
    /** A limb segment from a to b (centres), radius r. */
    limb(c, a, b, r, prim = 'cyl', o) {
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
        const len = Math.hypot(dx, dy, dz) || 1e-3;
        const g = (typeof prim === 'string' ? PRIM[prim] : prim).clone();
        const dir = new THREE.Vector3(dx, dy, dz).normalize();
        _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        _m.compose(_p.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), _q, _s.set(r, len, r));
        g.applyMatrix4(_m);
        return this.add(g, c, undefined, undefined, undefined, o);
    }
    build() {
        const solid = this.solid.length ? mergeGeometries(this.solid) : null;
        const glow = this.glow.length ? mergeGeometries(this.glow) : null;
        return { solid, glow };
    }
}

/** Mesh (with optional glow child) from a Parts build. */
function partMesh(built, mat, glowMat, pivot = [0, 0, 0]) {
    const g = new THREE.Group();
    g.position.set(pivot[0], pivot[1], pivot[2]);
    if (built.solid) { const m = new THREE.Mesh(built.solid, mat); g.add(m); }
    if (built.glow) { const m = new THREE.Mesh(built.glow, glowMat); g.add(m); }
    return g;
}

const GLOW_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false });

export function actorMaterial(opts = {}) {
    return new THREE.MeshStandardMaterial({
        vertexColors: true, flatShading: true, roughness: opts.rough ?? 0.82, metalness: opts.metal ?? 0.05,
        transparent: !!opts.transparent, opacity: opts.opacity ?? 1, emissive: new THREE.Color(0, 0, 0),
    });
}

const cache = new Map();
function cached(key, fn) {
    if (!cache.has(key)) cache.set(key, fn());
    return cache.get(key);
}

/**
 * Assemble a rig from a cached template: { parts: {name: {built, pivot}}, height, opts }.
 * Returns { root, parts: {name: Group}, mat, height, plan }.
 */
function instantiate(tpl, matOpts) {
    const mat = actorMaterial(matOpts ?? tpl.mat);
    const root = new THREE.Group();
    const inner = new THREE.Group();
    root.add(inner);
    const parts = {};
    for (const [name, def] of Object.entries(tpl.parts)) {
        const g = partMesh(def.built, mat, GLOW_MAT, def.pivot);
        if (def.parent) (parts[def.parent] ?? inner).add(g); else inner.add(g);
        parts[name] = g;
    }
    root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    return { root, inner, parts, mat, height: tpl.height, plan: tpl.plan, kind: tpl.kind, extra: tpl.extra ?? {} };
}

// ------------------------------------------------------------------ Shared bits

const darker = (hex, k = 0.7) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const lighter = (hex, k = 1.25) => { const c = new THREE.Color(hex); c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k); return '#' + c.getHexString(); };

function eyes(P, n, color, x, y, z, r, spread) {
    if (n <= 0) return;
    const pos = n === 1 ? [0] : n === 2 ? [-spread, spread] : [-spread, 0, spread];
    pos.forEach((dz, i) => P.sph(color, [x, y + (n === 3 && i === 1 ? r * 1.6 : 0), z + dz], [r, r, r], [0, 0, 0], { glow: true, rough: 0 }));
}

function weapon(P, kind, hand, s, opts = {}) {
    const [hx, hy, hz] = hand;
    const wood = '#6a4a2a', steel = '#c8ccd4', dark = '#3a3a40';
    switch (kind) {
        case 'club':
            P.limb(wood, [hx, hy, hz], [hx + 0.12 * s, hy + 0.32 * s, hz], 0.035 * s);
            P.sph(darker(wood, 0.9), [hx + 0.14 * s, hy + 0.36 * s, hz], [0.07 * s, 0.09 * s, 0.07 * s]);
            break;
        case 'dagger':
            P.box(steel, [hx + 0.08 * s, hy + 0.04 * s, hz], [0.16 * s, 0.03 * s, 0.03 * s]);
            break;
        case 'sword':
            P.box(steel, [hx + 0.03 * s, hy + 0.22 * s, hz], [0.04 * s, 0.4 * s, 0.015 * s], [0, 0, -0.25]);
            P.box('#b8962a', [hx, hy + 0.02 * s, hz], [0.04 * s, 0.03 * s, 0.12 * s]);
            break;
        case 'axe':
            P.limb(wood, [hx, hy - 0.05 * s, hz], [hx + 0.08 * s, hy + 0.36 * s, hz], 0.025 * s);
            P.box(steel, [hx + 0.11 * s, hy + 0.32 * s, hz], [0.14 * s, 0.12 * s, 0.025 * s], [0, 0, -0.2]);
            break;
        case 'spear':
            P.limb(wood, [hx - 0.1 * s, hy - 0.25 * s, hz], [hx + 0.2 * s, hy + 0.45 * s, hz], 0.02 * s);
            P.cone(steel, [hx + 0.23 * s, hy + 0.53 * s, hz], [0.035 * s, 0.12 * s, 0.035 * s], [0, 0, -0.4]);
            break;
        case 'scythe':
            P.limb(wood, [hx - 0.05 * s, hy - 0.2 * s, hz], [hx + 0.05 * s, hy + 0.5 * s, hz], 0.022 * s);
            P.add('tor', steel, [hx + 0.16 * s, hy + 0.48 * s, hz], [0.14 * s, 0.14 * s, 0.14 * s], [0, 0, 0.3]);
            break;
        case 'staff':
            P.limb(wood, [hx, hy - 0.3 * s, hz], [hx + 0.02 * s, hy + 0.42 * s, hz], 0.022 * s);
            if (opts.skull) P.sph('#e8e0c8', [hx + 0.02 * s, hy + 0.47 * s, hz], [0.05 * s, 0.06 * s, 0.05 * s]);
            P.sph(opts.glow ?? '#ff6a1a', [hx + 0.02 * s, hy + (opts.skull ? 0.56 : 0.48) * s, hz], [0.05 * s, 0.05 * s, 0.05 * s], [0, 0, 0], { glow: true, rough: 0 });
            break;
        case 'bow':
            P.add('tor', '#5a3a1a', [hx + 0.04 * s, hy + 0.05 * s, hz], [0.05 * s, 0.26 * s, 0.26 * s], [Math.PI / 2, Math.PI / 2, 0]);
            break;
        case 'bomb':
            P.sph('#2a2a2a', [hx + 0.05 * s, hy, hz], [0.08 * s, 0.08 * s, 0.08 * s]);
            P.sph('#ffd24a', [hx + 0.05 * s, hy + 0.1 * s, hz], [0.025 * s, 0.025 * s, 0.025 * s], [0, 0, 0], { glow: true });
            break;
        case 'boulder':
            P.add('dod', '#8ab0d0', [hx + 0.05 * s, hy + 0.08 * s, hz], [0.14 * s, 0.13 * s, 0.14 * s]);
            break;
    }
}

// ------------------------------------------------------------------ Monster plans

function bipedTemplate(sp) {
    const p = sp.params;
    const s = 1;
    const g = p.girth ?? 1, sh = p.shoulder ?? 1;
    const L = 0.36 * (p.legLen ?? 1) * s;
    const torsoH = 0.36 * s;
    const hunch = p.hunch ?? 0.1;
    const skin = p.skin, cloth = p.cloth ?? darker(skin), armor = p.armorColor ?? '#5a5a5a';
    const bone = p.skeleton;
    const seed = (sp.id.length * 131) | 0;
    // --- body (torso + head + features) ---
    const B = new Parts(seed);
    const tw = 0.33 * g * sh * (bone ? 0.75 : 1), td = 0.24 * g * (bone ? 0.6 : 1);
    const tTop = L + torsoH;
    const hx = Math.sin(hunch) * torsoH * 0.9;
    // hips / loincloth
    B.box(cloth, [0, L + 0.03, 0], [td * 1.05, 0.12, tw * 1.02]);
    if (bone) {
        B.box(skin, [0, L + torsoH * 0.5, 0], [0.05, torsoH, 0.05], [0, 0, -hunch]);
        for (let i = 0; i < 4; i++) B.add('tor', skin, [hx * (0.3 + i * 0.18), L + 0.12 + i * 0.07, 0], [0.09, 0.05, 0.12 * g], [0, Math.PI / 2, 0]);
    } else {
        B.box(skin, [hx * 0.5, L + torsoH * 0.5, 0], [td, torsoH, tw], [0, 0, -hunch]);
        B.sph(skin, [hx * 0.55 + td * 0.25, L + torsoH * 0.45, 0], [td * 0.55, torsoH * 0.42, tw * 0.48]);
    }
    if (p.armor === 'leather') B.box(armor, [hx * 0.5 + 0.01, L + torsoH * 0.55, 0], [td * 1.12, torsoH * 0.7, tw * 1.08], [0, 0, -hunch]);
    if (p.armor === 'plate') {
        B.box(armor, [hx * 0.5 + 0.015, L + torsoH * 0.55, 0], [td * 1.18, torsoH * 0.78, tw * 1.12], [0, 0, -hunch], { rough: 0.03 });
        for (const z of [-1, 1]) B.sph(lighter(armor), [hx, tTop - 0.02, z * (tw * 0.55)], [0.08 * g, 0.06, 0.08 * g]);
    }
    if (p.fur) for (const z of [-1, 1]) B.add('ico', lighter(p.cloth ?? '#e0e8f0', 1.05), [hx * 0.8, tTop - 0.03, z * tw * 0.45], [0.09 * g, 0.07, 0.1 * g]);
    if (p.moss) { B.sph('#5a7a2a', [hx - 0.05, tTop - 0.02, 0.04], [0.09, 0.04, 0.12]); B.sph('#4a6a2a', [hx * 0.4 - 0.08, L + 0.2, -0.05], [0.05, 0.06, 0.08]); }
    if (p.spikes) for (let i = 0; i < 3; i++) B.cone(p.hornColor ?? '#d8d0b8', [hx * (0.3 + i * 0.3) - td * 0.5, L + 0.12 + i * 0.1, 0], [0.03, 0.09, 0.03], [0, 0, 1.2]);
    if (p.crystal) for (const z of [-1, 1]) B.add('oct', '#bff0ff', [hx, tTop + 0.05, z * tw * 0.5], [0.04, 0.12, 0.04], [0, 0, z * 0.3], { glow: true, rough: 0 });
    if (p.wingsSmall) for (const z of [-1, 1]) B.box(darker(skin), [hx - td * 0.6, tTop - 0.02, z * tw * 0.6], [0.02, 0.18, 0.22], [z * 0.6, 0, 0]);
    if (p.tail) B.limb(skin, [-td * 0.4, L + 0.05, 0], [-td * 0.4 - 0.25, L - 0.12, 0], 0.035, 'cone');
    if (p.backpack === 'quiver') { B.cyl('#6a4a2a', [hx * 0.5 - td * 0.65, L + torsoH * 0.6, 0.05], [0.05, 0.24, 0.05], [0.2, 0, 0.2]); for (let i = 0; i < 3; i++) B.box('#d8d0b8', [hx * 0.5 - td * 0.6, L + torsoH * 0.6 + 0.15, 0.02 + i * 0.02], [0.01, 0.08, 0.01]); }
    if (p.backpack === 'bomb') { B.sph('#2a2a2a', [hx * 0.5 - td * 0.75, L + torsoH * 0.6, 0], [0.11, 0.11, 0.11]); B.sph('#ffaa2a', [hx * 0.5 - td * 0.75, L + torsoH * 0.6 + 0.13, 0], [0.025, 0.025, 0.025], [0, 0, 0], { glow: true }); }
    if (p.backpack === 'chest') {
        B.box('#8a5a2a', [hx * 0.5 - td * 0.85, L + torsoH * 0.62, 0], [0.18, 0.16, 0.24]);
        B.box('#ffd24a', [hx * 0.5 - td * 0.85, L + torsoH * 0.62 + 0.085, 0], [0.19, 0.03, 0.25], [0, 0, 0], { glow: true });
        B.box('#c89a2a', [hx * 0.5 - td * 0.85, L + torsoH * 0.62, 0], [0.19, 0.17, 0.04]);
    }
    // head
    const hr = 0.12 * (p.head ?? 1) * (bone ? 0.95 : 1);
    const hp = [hx + 0.02, tTop + hr * 0.85, 0];
    const headCol = bone ? '#e8e0c8' : skin;
    B.add('sph2', headCol, hp, [hr * 1.02, hr, hr * 0.95]);
    if (p.snout) B.box(headCol, [hp[0] + hr * 0.9, hp[1] - hr * 0.25, 0], [hr * 0.9, hr * 0.5, hr * 0.7]);
    if (bone) B.box('#2a2420', [hp[0] + hr * 0.7, hp[1] - hr * 0.5, 0], [hr * 0.4, hr * 0.25, hr * 0.8]);
    if (p.tusks) for (const z of [-1, 1]) B.cone('#f0e8d0', [hp[0] + hr * 0.75, hp[1] - hr * 0.35, z * hr * 0.45], [0.02, 0.07, 0.02], [0, 0, -0.3]);
    if (p.beard) B.cone(p.beard, [hp[0] + hr * 0.5, hp[1] - hr * 1.05, 0], [hr * 0.7, hr * 1.3, hr * 0.8], [Math.PI, 0, 0]);
    if (p.ears === 'long') for (const z of [-1, 1]) B.cone(skin, [hp[0] - hr * 0.1, hp[1] + hr * 0.2, z * hr * 1.2], [0.035, hr * 1.6, 0.06], [z * 1.2, 0, 0.3]);
    if (p.ears === 'pointy') for (const z of [-1, 1]) B.cone(skin, [hp[0] - hr * 0.1, hp[1] + hr * 0.5, z * hr * 0.75], [0.035, hr * 0.8, 0.05], [z * 0.5, 0, 0.1]);
    if (p.horns) for (const z of [-1, 1]) {
        const c = p.hornColor ?? '#e8d8b8';
        B.limb(c, [hp[0], hp[1] + hr * 0.6, z * hr * 0.55], [hp[0] - hr * 0.3 * p.hornCurl, hp[1] + hr * 1.5, z * hr * (0.9 + p.hornCurl * 0.4)], 0.028, 'cone');
    }
    // helmet
    if (p.helmet === 'cap') B.add('sph2', p.armorColor ?? '#6a5a4a', [hp[0], hp[1] + hr * 0.35, 0], [hr * 1.08, hr * 0.7, hr * 1.04]);
    if (p.helmet === 'horned') {
        B.add('sph2', p.armorColor ?? '#7a7a80', [hp[0], hp[1] + hr * 0.3, 0], [hr * 1.1, hr * 0.8, hr * 1.06], [0, 0, 0], { rough: 0.03 });
        for (const z of [-1, 1]) B.limb('#e8e0c8', [hp[0], hp[1] + hr * 0.6, z * hr * 0.9], [hp[0] + hr * 0.2, hp[1] + hr * 1.5, z * hr * 1.5], 0.03, 'cone');
    }
    if (p.helmet === 'hood') {
        B.add('sph2', cloth, [hp[0] - hr * 0.1, hp[1] + hr * 0.15, 0], [hr * 1.2, hr * 1.15, hr * 1.15]);
        B.cone(cloth, [hp[0] - hr * 0.5, hp[1] + hr * 0.9, 0], [hr * 0.6, hr * 0.9, hr * 0.6], [0, 0, 0.9]);
    }
    if (p.helmet === 'skull') B.add('sph2', '#e8e0c8', [hp[0] + hr * 0.1, hp[1] + hr * 0.45, 0], [hr * 1.05, hr * 0.65, hr * 1.0]);
    if (p.helmet === 'crown') for (let i = 0; i < 5; i++) B.cone('#ffd24a', [hp[0] + Math.cos(i * 1.256) * hr * 0.7, hp[1] + hr * 0.9, Math.sin(i * 1.256) * hr * 0.7], [0.025, 0.08, 0.025]);
    if (p.hair) B.cone('#d8e8e0', [hp[0] - hr * 0.6, hp[1] - hr * 0.2, 0], [hr * 1.1, hr * 2.4, hr * 1.1], [0, 0, 0.6]);
    const eyeR = hr * (p.eyes === 1 ? 0.3 : 0.2);
    eyes(B, p.eyes ?? 2, p.eyeColor ?? '#ffd24a', hp[0] + hr * 0.85, hp[1] + hr * 0.12, 0, eyeR, hr * 0.38);
    // --- arms ---
    const armLen = 0.34 * (p.armLen ?? 1);
    const shY = tTop - 0.05;
    const shZ = tw * 0.5 + 0.035 * g;
    const armR = 0.064 * g * (p.claws ? 1.15 : 1);
    const mkArm = (side, hold) => {
        const A = new Parts(seed + side);
        A.limb(skin, [0, 0, 0], [0.03, -armLen, 0], armR, 'cyl6');
        if (p.armor === 'plate') A.sph(armor, [0, -0.02, 0], [armR * 1.6, armR * 1.4, armR * 1.6]);
        A.sph(skin, [0.04, -armLen - 0.02, 0], [armR * 1.3, armR * 1.3, armR * 1.3]);
        if (p.claws) for (let i = -1; i <= 1; i++) A.cone('#f0e8d0', [0.08, -armLen - 0.05, i * armR * 0.7], [0.012, 0.06, 0.012], [0, 0, -2.2]);
        if (hold === 'weapon' && p.weapon && p.weapon !== 'none') weapon(A, p.weapon, [0.05, -armLen, 0], 1.0, { glow: p.staffGlow, skull: p.skullStaff });
        if (hold === 'shield' && p.shieldItem) {
            A.cyl(p.armorColor ?? '#7a5a3a', [0.08, -armLen * 0.6, side * 0.03], [0.17, 0.03, 0.17], [0, 0, Math.PI / 2], { rough: 0.05 });
            A.sph(lighter(p.armorColor ?? '#7a5a3a', 1.4), [0.1, -armLen * 0.6, side * 0.03], [0.04, 0.04, 0.04]);
        }
        return A.build();
    };
    // --- legs ---
    const mkLeg = () => {
        const Lg = new Parts(seed + 7);
        Lg.limb(bone ? '#e8e0c8' : darker(skin, 0.85), [0, 0, 0], [0, -L + 0.05, 0], 0.072 * g * (bone ? 0.6 : 1), 'cyl6');
        Lg.box(darker(cloth, 0.7), [0.035, -L + 0.035, 0], [0.16, 0.07, 0.11]);
        return Lg.build();
    };
    return {
        plan: 'biped', height: tTop + hr * 2,
        parts: {
            body: { built: B.build() },
            armR: { built: mkArm(1, 'weapon'), pivot: [hx, shY, shZ] },
            armL: { built: mkArm(-1, 'shield'), pivot: [hx, shY, -shZ] },
            legR: { built: mkLeg(), pivot: [0, L, 0.08 * g] },
            legL: { built: mkLeg(), pivot: [0, L, -0.08 * g] },
        },
        extra: { headY: hp[1] },
        mat: { rough: p.armor === 'plate' ? 0.5 : 0.85, metal: p.armor === 'plate' ? 0.3 : 0.05 },
    };
}

function quadTemplate(sp) {
    const p = sp.params;
    const seed = sp.id.length * 977;
    const len = 0.62 * (p.len ?? 1), legH = 0.3 * (p.legH ?? 0.4) / 0.4 * (p.worm ? 0.2 : 1);
    const girth = 0.25 * (p.girth ?? 1);
    const skin = p.skin, belly = p.belly ?? lighter(skin);
    const B = new Parts(seed);
    const y = legH + girth * 0.8;
    if (p.worm) {
        for (let i = 0; i < 5; i++) B.add('sph', i % 2 ? skin : darker(skin, 0.9), [len * 0.5 - i * len * 0.24, girth * (0.9 - i * 0.08), 0], [girth * 1.1, girth * (1 - i * 0.08), girth * (1.05 - i * 0.08)]);
        B.add('sph2', skin, [len * 0.62, girth * 0.95, 0], [girth * 1.1, girth, girth]);
        for (let i = 0; i < 6; i++) B.cone('#e8f0ff', [len * 0.85, girth * 0.95 + Math.cos(i) * girth * 0.5, Math.sin(i) * girth * 0.5], [0.025, 0.12, 0.025], [0, 0, -Math.PI / 2]);
        if (p.spikes) for (let i = 0; i < 4; i++) B.add('oct', '#bff0ff', [len * 0.4 - i * len * 0.24, girth * 1.8, 0], [0.04, 0.1, 0.04], [0, 0, 0], { glow: true });
        return { plan: 'worm', height: girth * 2, parts: { body: { built: B.build() } }, mat: { rough: 0.6 } };
    }
    B.add('sph2', skin, [0, y, 0], [len * 0.62, girth, girth * 0.95]);
    B.add('sph', belly, [0.02, y - girth * 0.35, 0], [len * 0.5, girth * 0.6, girth * 0.8]);
    if (p.stripe) for (let i = 0; i < 3; i++) B.box(darker(skin, 0.6), [-len * 0.2 + i * 0.12, y + girth * 0.75, 0], [0.04, 0.05, girth * 1.6]);
    if (p.ribs) for (let i = 0; i < 4; i++) B.add('tor', '#d8d0b8', [-0.1 + i * 0.07, y + 0.02, 0], [girth * 0.9, girth * 0.9, girth * 0.9], [0, Math.PI / 2, 0]);
    if (p.mane) B.add('ico', darker(skin, 0.8), [len * 0.38, y + girth * 0.4, 0], [girth * 0.9, girth * 1.0, girth * 1.05]);
    if (p.spikes) for (let i = 0; i < 4; i++) B.cone(p.hornColor ?? '#e8d8b8', [len * 0.3 - i * len * 0.22, y + girth * 0.95, 0], [0.025, 0.1, 0.025]);
    if (p.fire) for (let i = 0; i < 3; i++) B.cone('#ff8a2a', [len * 0.2 - i * 0.12, y + girth * 1.05, 0], [0.04, 0.12, 0.04], [0, 0, 0], { glow: true });
    // head
    const hs = 0.13 * (p.head ?? 1);
    const hp = [len * 0.62, y + girth * 0.5, 0];
    B.limb(skin, [len * 0.4, y + girth * 0.2, 0], hp, girth * 0.55, 'cyl6');
    B.add('sph2', skin, hp, [hs * 1.1, hs, hs * 0.95]);
    const sn = hs * (p.snout ?? 1);
    B.box(skin, [hp[0] + sn * 0.9, hp[1] - hs * 0.3, 0], [sn * 1.1, hs * 0.55, hs * 0.75]);
    B.box('#1a1a1a', [hp[0] + sn * 1.45, hp[1] - hs * 0.15, 0], [0.03, 0.04, 0.05]);
    B.box('#f0e8d0', [hp[0] + sn * 1.0, hp[1] - hs * 0.62, 0], [sn * 0.9, 0.02, hs * 0.6]);
    if (p.ears === 'pointy') for (const z of [-1, 1]) B.cone(skin, [hp[0] - hs * 0.2, hp[1] + hs * 0.85, z * hs * 0.5], [0.035, hs * 0.8, 0.05], [z * 0.3, 0, 0.2]);
    if (p.horns) for (const z of [-1, 1]) B.limb(p.hornColor ?? '#e8d8b8', [hp[0], hp[1] + hs * 0.6, z * hs * 0.45], [hp[0] - hs * 0.6, hp[1] + hs * 1.4, z * hs * 0.8], 0.025, 'cone');
    eyes(B, p.eyes ?? 2, p.eyeColor ?? '#ffd24a', hp[0] + hs * 0.75, hp[1] + hs * 0.25, 0, hs * 0.18, hs * 0.45);
    // tail
    const T = new Parts(seed + 3);
    if (p.tail === 'bushy') T.add('ico', darker(skin, 0.9), [-0.15, 0.04, 0], [0.18, 0.07, 0.07], [0, 0, 0.5]);
    else if (p.tail === 'long') T.limb(skin, [0, 0, 0], [-0.4, -0.12, 0], 0.045, 'cone');
    else if (p.tail) T.limb(skin, [0, 0, 0], [-0.3, 0.1, 0], 0.025, 'cone');
    // legs
    const mkLeg = () => {
        const Lg = new Parts(seed + 5);
        Lg.add('sph', darker(skin, 0.92), [0, -0.02, 0], [girth * 0.5, girth * 0.7, girth * 0.45]);
        Lg.limb(darker(skin, 0.85), [0, -0.04, 0], [0.03, -legH, 0], girth * 0.36, 'cyl6');
        Lg.box(darker(skin, 0.6), [0.05, -legH + 0.025, 0], [0.11, 0.05, 0.09]);
        return Lg.build();
    };
    const lz = girth * 0.6, lx = len * 0.38;
    const parts = {
        body: { built: B.build() },
        legFL: { built: mkLeg(), pivot: [lx, legH + 0.02, lz] },
        legFR: { built: mkLeg(), pivot: [lx, legH + 0.02, -lz] },
        legBL: { built: mkLeg(), pivot: [-lx, legH + 0.02, lz] },
        legBR: { built: mkLeg(), pivot: [-lx, legH + 0.02, -lz] },
    };
    if (p.tail) parts.tail = { built: T.build(), pivot: [-len * 0.55, y + girth * 0.3, 0] };
    return { plan: 'quad', height: y + girth + hs, parts, mat: { rough: 0.85 } };
}

function flyerTemplate(sp) {
    const p = sp.params;
    const seed = sp.id.length * 541;
    const b = 0.16 * (p.body ?? 0.6) / 0.6;
    const skin = p.skin;
    const B = new Parts(seed);
    B.add('sph2', skin, [0, 0, 0], [b * 1.2, b, b * 0.9]);
    const hs = b * 0.75 * (p.head ?? 1);
    const hp = [b * 1.1, b * 0.35, 0];
    B.add('sph2', skin, hp, [hs, hs, hs * 0.95]);
    if (p.wing === 'drake') { B.box(skin, [hp[0] + hs * 0.9, hp[1] - hs * 0.2, 0], [hs * 1.1, hs * 0.5, hs * 0.7]); B.limb(skin, [-b * 0.6, 0, 0], [-b * 3, -b * 0.4, 0], b * 0.3, 'cone'); }
    if (p.ears === 'long') for (const z of [-1, 1]) B.cone(skin, [hp[0] - hs * 0.2, hp[1] + hs * 0.9, z * hs * 0.5], [0.03, hs * 1.3, 0.04], [z * 0.3, 0, 0]);
    if (p.horns) for (const z of [-1, 1]) B.limb(p.hornColor ?? '#2a1a1a', [hp[0], hp[1] + hs * 0.6, z * hs * 0.45], [hp[0] - hs * 0.5, hp[1] + hs * 1.5, z * hs * 0.7], 0.022, 'cone');
    if (p.tail && p.wing !== 'drake') B.limb(skin, [-b, 0, 0], [-b * 2.6, -b * 0.6, 0], b * 0.15, 'cone');
    if (p.legs) for (const z of [-1, 1]) B.limb(darker(skin), [0, -b * 0.6, z * b * 0.4], [b * 0.2, -b * 1.6, z * b * 0.45], b * 0.13, 'cyl6');
    eyes(B, p.eyes ?? 2, p.eyeColor ?? '#ff4a2a', hp[0] + hs * 0.8, hp[1] + hs * 0.15, 0, hs * 0.2, hs * 0.4);
    const span = 0.32 * (p.span ?? 1.2);
    const wc = p.wingColor ?? darker(skin);
    const mkWing = (side) => {
        const W = new Parts(seed + side);
        if (p.wing === 'bat' || p.wing === 'drake') {
            W.box(wc, [0, 0, side * span * 0.5], [span * 0.55, 0.012, span], [0, 0, 0], { rough: 0.15 });
            for (let i = 0; i < 3; i++) W.limb(darker(wc, 0.7), [0, 0.01, 0], [-span * 0.3 + i * span * 0.25, 0.01, side * span], 0.012, 'cyl6');
            W.cone(darker(wc, 0.6), [span * 0.2, 0.01, side * span], [0.015, 0.06, 0.015], [0, 0, -1.2]);
        } else {
            for (let i = 0; i < 4; i++) W.box(i % 2 ? wc : lighter(wc), [-i * 0.04, 0, side * (span * 0.3 + i * span * 0.18)], [0.18 - i * 0.02, 0.01, span * 0.3], [0, 0, 0]);
        }
        return W.build();
    };
    return {
        plan: 'flyer', height: b * 2,
        parts: {
            body: { built: B.build() },
            wingL: { built: mkWing(1), pivot: [0, b * 0.4, b * 0.4] },
            wingR: { built: mkWing(-1), pivot: [0, b * 0.4, -b * 0.4] },
        },
        mat: { rough: 0.8 },
    };
}

function blobTemplate(sp) {
    const p = sp.params;
    const r = 0.32 * (p.r ?? 0.45) / 0.45;
    const B = new Parts(sp.id.length * 13);
    B.add('sph2', p.skin, [0, r * 0.85, 0], [r * 1.1, r * 0.85, r]);
    B.add('sph', p.core ?? darker(p.skin, 0.5), [0, r * 0.75, 0], [r * 0.45, r * 0.4, r * 0.45]);
    if (p.bones) for (let i = 0; i < 3; i++) B.box('#e8e0c8', [-0.05 + i * 0.06, r * (0.5 + i * 0.15), (i - 1) * 0.08], [0.18, 0.03, 0.03], [0, i, 0.5 * i]);
    eyes(B, p.eyes ?? 2, p.eyeColor === '#1a1a1a' ? '#ffffff' : p.eyeColor, r * 0.95, r * 1.05, 0, r * 0.16, r * 0.35);
    if (p.eyeColor === '#1a1a1a') for (const z of [-1, 1]) B.sph('#111111', [r * 1.06, r * 1.05, z * r * 0.35], [r * 0.08, r * 0.08, r * 0.08]);
    return { plan: 'blob', height: r * 1.8, parts: { body: { built: B.build() } }, mat: { rough: 0.25, transparent: true, opacity: 0.88 } };
}

function wraithTemplate(sp) {
    const p = sp.params;
    const h = 0.75 * (p.h ?? 0.9);
    const B = new Parts(sp.id.length * 17);
    const robe = p.robe ?? '#5a6a7a';
    if (p.wisp) {
        B.sph(p.glowColor, [0, h * 0.6, 0], [0.13, 0.13, 0.13], [0, 0, 0], { glow: true, rough: 0 });
        B.sph(lighter(p.glowColor, 1.3), [0, h * 0.6, 0], [0.07, 0.07, 0.07], [0, 0, 0], { glow: true, rough: 0 });
        for (let i = 0; i < 4; i++) B.sph(p.glowColor, [-0.08 - i * 0.07, h * 0.6 - i * 0.04, Math.sin(i) * 0.03], [0.05 - i * 0.01, 0.05 - i * 0.01, 0.05 - i * 0.01], [0, 0, 0], { glow: true });
        B.sph('#203028', [0.06, h * 0.62, 0], [0.04, 0.04, 0.04]);
        return { plan: 'wisp', height: h, parts: { body: { built: B.build() } }, mat: { rough: 0.3, transparent: true, opacity: 0.9 } };
    }
    B.cone(robe, [0, h * 0.45, 0], [0.2, h * 0.75, 0.2], [0, 0, 0.12], { rough: 0.12 });
    for (let i = 0; i < 6; i++) B.cone(darker(robe, 0.85), [Math.cos(i) * 0.15, h * 0.08, Math.sin(i) * 0.15], [0.05, 0.16, 0.05], [Math.PI, 0, 0]);
    const hp = [0.04, h * 0.9, 0];
    B.add('sph2', p.hood !== false ? darker(robe, 0.8) : '#d8e0e0', hp, [0.12, 0.13, 0.12]);
    if (p.hood) B.cone(darker(robe, 0.7), [hp[0] - 0.05, hp[1] + 0.1, 0], [0.09, 0.16, 0.09], [0, 0, 0.6]);
    if (p.hair) B.cone('#c8e0d8', [hp[0] - 0.12, hp[1] - 0.1, 0], [0.13, 0.4, 0.14], [0, 0, 0.8]);
    B.sph('#0a0a10', [hp[0] + 0.06, hp[1] - 0.01, 0], [0.07, 0.08, 0.09]);
    eyes(B, p.eyes ?? 2, p.glowColor, hp[0] + 0.11, hp[1], 0, 0.022, 0.04);
    const mkArm = () => {
        const A = new Parts(5);
        A.limb(robe, [0, 0, 0], [0.12, -0.2, 0], 0.035, 'cone');
        A.sph('#c8d0d8', [0.14, -0.22, 0], [0.03, 0.03, 0.03]);
        return A.build();
    };
    return {
        plan: 'wraith', height: h * 1.05,
        parts: {
            body: { built: B.build() },
            armR: { built: mkArm(), pivot: [0.05, h * 0.72, 0.13] },
            armL: { built: mkArm(), pivot: [0.05, h * 0.72, -0.13] },
        },
        mat: { rough: 0.7, transparent: true, opacity: 0.86 },
    };
}

function siegeTemplate(sp) {
    const p = sp.params;
    const wood = p.wood ?? '#5a3a2a', metal = p.metal ?? '#3a3a3a';
    const B = new Parts(sp.id.length * 23);
    B.box(wood, [0, 0.18, 0], [0.9, 0.08, 0.5]);
    for (const x of [-0.32, 0.32]) for (const z of [-0.28, 0.28]) {
        B.cyl(darker(wood, 0.8), [x, 0.14, z], [0.14, 0.05, 0.14], [Math.PI / 2, 0, 0]);
        B.cyl(metal, [x, 0.14, z * 1.08], [0.05, 0.04, 0.05], [Math.PI / 2, 0, 0]);
    }
    const A = new Parts(3);
    if (p.ballista) {
        B.box(wood, [0, 0.35, 0], [0.12, 0.3, 0.12]);
        A.box(wood, [0.1, 0, 0], [0.6, 0.07, 0.08]);
        A.add('tor', darker(wood, 0.8), [0.2, 0, 0], [0.08, 0.3, 0.3], [Math.PI / 2, Math.PI / 2, 0]);
        A.cone(p.ammo, [0.45, 0.04, 0], [0.03, 0.12, 0.03], [0, 0, -Math.PI / 2], { glow: true });
    } else {
        for (const z of [-0.18, 0.18]) B.limb(wood, [-0.1, 0.2, z], [0.05, 0.55, z * 0.5], 0.035, 'box');
        B.cyl(metal, [0.02, 0.5, 0], [0.04, 0.4, 0.04], [Math.PI / 2, 0, 0]);
        A.limb(wood, [0, 0, 0], [-0.45, 0.1, 0], 0.035, 'box');
        A.cyl(darker(wood, 0.8), [-0.47, 0.13, 0], [0.09, 0.06, 0.09]);
        A.add('dod', p.ammo ?? '#5a5050', [-0.47, 0.2, 0], [0.07, 0.07, 0.07]);
    }
    // a crewman (simple)
    const crewSkin = p.crew === 'kobold' ? '#a83a2a' : '#5a7a3a';
    B.box(crewSkin, [-0.35, 0.4, 0.3], [0.1, 0.18, 0.12]);
    B.sph(crewSkin, [-0.33, 0.55, 0.3], [0.07, 0.07, 0.07]);
    B.sph('#ffd24a', [-0.27, 0.56, 0.3], [0.015, 0.015, 0.015], [0, 0, 0], { glow: true });
    B.box('#4a3a2a', [-0.35, 0.25, 0.3], [0.08, 0.12, 0.1]);
    return {
        plan: 'siege', height: 0.7,
        parts: { body: { built: B.build() }, armR: { built: A.build(), pivot: p.ballista ? [0, 0.52, 0] : [0.02, 0.5, 0] } },
        mat: { rough: 0.9 },
    };
}

function icewallTemplate() {
    const B = new Parts(77);
    for (let i = 0; i < 7; i++) {
        const a = i * 0.9;
        B.add('oct', i % 2 ? '#bff0ff' : '#8fd8ff', [Math.cos(a) * 0.15, 0.3 + (i % 3) * 0.12, Math.sin(a) * 0.35], [0.14, 0.35 + (i % 3) * 0.12, 0.14], [0.2 * Math.sin(a), 0, 0.2 * Math.cos(a)], { rough: 0.05 });
    }
    B.add('oct', '#e8fbff', [0, 0.55, 0], [0.12, 0.3, 0.12], [0, 0, 0], { glow: true });
    return { plan: 'icewall', height: 0.9, parts: { body: { built: B.build() } }, mat: { rough: 0.15, metal: 0.1, transparent: true, opacity: 0.85 } };
}

// ------------------------------------------------------------------ Bosses

function bossTemplate(kind) {
    const P = new Parts(kind.length * 991);
    const parts = {};
    let height = 1;
    switch (kind) {
        case 'warg': {
            // A giant warg with a crowned goblin chieftain on its back.
            const fur = '#4a4038', belly = '#8a7a60';
            P.add('sph2', fur, [0, 0.55, 0], [0.6, 0.3, 0.3]);
            P.add('sph', belly, [0.05, 0.42, 0], [0.45, 0.2, 0.24]);
            P.add('ico', darker(fur, 0.8), [0.35, 0.68, 0], [0.32, 0.3, 0.34]);
            for (let i = 0; i < 6; i++) P.cone('#2a2420', [0.35 - i * 0.14, 0.85, 0], [0.04, 0.16, 0.04], [0, 0, -0.3]);
            P.add('sph2', fur, [0.72, 0.72, 0], [0.2, 0.18, 0.17]);
            P.box(fur, [0.92, 0.66, 0], [0.24, 0.12, 0.15]);
            P.box('#f0e8d0', [0.93, 0.58, 0], [0.2, 0.02, 0.12]);
            for (const z of [-1, 1]) { P.cone(fur, [0.66, 0.9, z * 0.09], [0.04, 0.12, 0.05]); P.cone('#f0e8d0', [1.0, 0.6, z * 0.05], [0.015, 0.06, 0.015], [Math.PI, 0, 0]); }
            eyes(P, 2, '#ffaa1a', 0.85, 0.77, 0, 0.03, 0.08);
            // rider
            P.box('#7a3a2a', [0.05, 0.92, 0], [0.18, 0.08, 0.36]);
            P.box('#6a9a3a', [0.0, 1.1, 0], [0.14, 0.24, 0.2]);
            P.add('sph2', '#6a9a3a', [0.03, 1.32, 0], [0.11, 0.1, 0.1]);
            for (const z of [-1, 1]) P.cone('#6a9a3a', [0.0, 1.36, z * 0.13], [0.025, 0.14, 0.04], [z * 1.2, 0, 0.3]);
            for (let i = 0; i < 5; i++) P.cone('#ffd24a', [0.03 + Math.cos(i * 1.26) * 0.08, 1.44, Math.sin(i * 1.26) * 0.08], [0.018, 0.07, 0.018], [0, 0, 0], { glow: true });
            eyes(P, 2, '#ff3a1a', 0.12, 1.33, 0, 0.018, 0.04);
            P.limb('#6a4a2a', [0.05, 1.0, 0.15], [0.35, 1.5, 0.2], 0.02);
            P.box('#8a1a1a', [0.28, 1.42, 0.2], [0.02, 0.18, 0.12]);
            const leg = () => { const L = new Parts(9); L.limb(darker(fur, 0.9), [0, 0, 0], [0.03, -0.42, 0], 0.07, 'cyl6'); L.box('#2a2420', [0.06, -0.42, 0], [0.12, 0.05, 0.1]); return L.build(); };
            parts.legFL = { built: leg(), pivot: [0.32, 0.45, 0.18] };
            parts.legFR = { built: leg(), pivot: [0.32, 0.45, -0.18] };
            parts.legBL = { built: leg(), pivot: [-0.32, 0.45, 0.18] };
            parts.legBR = { built: leg(), pivot: [-0.32, 0.45, -0.18] };
            const T = new Parts(4); T.add('ico', fur, [-0.2, 0.05, 0], [0.26, 0.08, 0.08], [0, 0, 0.4]); parts.tail = { built: T.build(), pivot: [-0.55, 0.62, 0] };
            height = 1.5;
            break;
        }
        case 'toad': {
            const skin = '#5a7a3a', belly = '#c8c87a';
            P.add('sph2', skin, [0, 0.42, 0], [0.62, 0.42, 0.55]);
            P.add('sph2', belly, [0.2, 0.32, 0], [0.42, 0.3, 0.45]);
            for (let i = 0; i < 14; i++) { const a = i * 2.4, b2 = i * 0.7; P.sph(i % 2 ? '#7a8a3a' : '#4a6a2a', [Math.cos(a) * 0.4, 0.55 + Math.sin(b2) * 0.2, Math.sin(a) * 0.4], [0.06, 0.05, 0.06]); }
            P.box('#3a1a1a', [0.55, 0.42, 0], [0.12, 0.05, 0.6]);
            P.box('#c84a4a', [0.6, 0.4, 0], [0.06, 0.03, 0.3]);
            for (const z of [-1, 1]) {
                P.add('sph2', skin, [0.35, 0.82, z * 0.25], [0.14, 0.14, 0.14]);
                P.sph('#ffea4a', [0.42, 0.86, z * 0.27], [0.08, 0.09, 0.09], [0, 0, 0], { glow: true });
                P.box('#111111', [0.5, 0.86, z * 0.27], [0.02, 0.1, 0.03]);
                P.add('sph', skin, [0.25, 0.12, z * 0.5], [0.25, 0.12, 0.18]);
                P.add('sph', skin, [0.5, 0.06, z * 0.3], [0.14, 0.05, 0.1]);
            }
            for (let i = 0; i < 7; i++) P.limb('#8a9a4a', [Math.cos(i) * 0.15 - 0.05, 0.8, Math.sin(i) * 0.25], [Math.cos(i) * 0.2 - 0.08, 1.15 + (i % 3) * 0.08, Math.sin(i) * 0.3], 0.015, 'cone');
            height = 1.2;
            break;
        }
        case 'warlord': {
            const skin = '#4a6a3a', iron = '#3a3638', red = '#8a1a1a';
            P.box(red, [0, 0.62, 0], [0.32, 0.22, 0.5]);
            P.box(iron, [0.02, 0.92, 0], [0.38, 0.42, 0.6], [0, 0, -0.08], { rough: 0.03 });
            for (const z of [-1, 1]) { P.sph(iron, [0.0, 1.14, z * 0.34], [0.16, 0.12, 0.16]); for (let i = 0; i < 3; i++) P.cone('#c8c0b0', [0.0 + (i - 1) * 0.08, 1.26, z * 0.36], [0.025, 0.12, 0.025]); }
            P.add('sph2', skin, [0.06, 1.3, 0], [0.16, 0.15, 0.15]);
            for (const z of [-1, 1]) P.cone('#f0e8d0', [0.2, 1.24, z * 0.07], [0.02, 0.07, 0.02], [0, 0, -0.3]);
            P.add('sph2', iron, [0.05, 1.38, 0], [0.17, 0.1, 0.16]);
            for (const z of [-1, 1]) P.limb('#e8e0c8', [0.05, 1.42, z * 0.14], [0.0, 1.7, z * 0.3], 0.04, 'cone');
            eyes(P, 2, '#ff3a1a', 0.2, 1.31, 0, 0.022, 0.055);
            P.limb('#5a3a1a', [-0.25, 0.7, 0], [-0.3, 1.8, 0], 0.02);
            P.box(red, [-0.42, 1.62, 0], [0.24, 0.3, 0.02]);
            P.add('sph', '#e8e0c8', [-0.42, 1.63, 0.02], [0.05, 0.06, 0.02]);
            const arm = (axe) => { const A = new Parts(axe ? 2 : 3); A.limb(skin, [0, 0, 0], [0.05, -0.42, 0], 0.08, 'cyl6'); A.sph(iron, [0, -0.02, 0], [0.12, 0.1, 0.12]); if (axe) { A.limb('#5a3a1a', [0.05, -0.55, 0], [0.12, 0.25, 0], 0.03); A.box('#a8acb4', [0.2, 0.18, 0], [0.26, 0.3, 0.03], [0, 0, -0.1], { rough: 0.02 }); A.box('#a8acb4', [-0.0, 0.18, 0], [0.12, 0.22, 0.03]); } return A.build(); };
            parts.armR = { built: arm(true), pivot: [0.04, 1.08, 0.38] };
            parts.armL = { built: arm(false), pivot: [0.04, 1.08, -0.38] };
            const leg = () => { const L = new Parts(8); L.limb('#3a3020', [0, 0, 0], [0.02, -0.5, 0], 0.09, 'cyl6'); L.box(iron, [0.05, -0.5, 0], [0.2, 0.08, 0.14]); return L.build(); };
            parts.legR = { built: leg(), pivot: [0, 0.55, 0.15] };
            parts.legL = { built: leg(), pivot: [0, 0.55, -0.15] };
            height = 1.75;
            break;
        }
        case 'colossus': {
            const ice = '#9ac8e8', deep = '#5a8ab8';
            P.add('dod', ice, [0, 0.95, 0], [0.38, 0.42, 0.45], [0, 0.3, 0], { rough: 0.12 });
            P.add('ico', deep, [0, 0.62, 0], [0.3, 0.2, 0.32]);
            P.add('oct', '#e8fbff', [0.25, 1.0, 0], [0.12, 0.14, 0.12], [0, 0, 0], { glow: true });
            P.add('dod', ice, [0.08, 1.48, 0], [0.18, 0.16, 0.18], [0.4, 0, 0]);
            eyes(P, 2, '#4ad8ff', 0.24, 1.5, 0, 0.03, 0.07);
            for (let i = 0; i < 7; i++) P.add('oct', i % 2 ? '#bff0ff' : ice, [-0.15 + Math.cos(i * 0.9) * 0.15, 1.25 + (i % 3) * 0.15, Math.sin(i * 0.9) * 0.35], [0.06, 0.24, 0.06], [Math.sin(i), 0, Math.cos(i) * 0.4], { glow: i % 3 === 0 });
            const arm = () => { const A = new Parts(6); A.add('dod', ice, [0.02, -0.18, 0], [0.13, 0.22, 0.13]); A.add('dod', deep, [0.06, -0.48, 0], [0.16, 0.16, 0.16]); return A.build(); };
            parts.armR = { built: arm(), pivot: [0.02, 1.18, 0.44] };
            parts.armL = { built: arm(), pivot: [0.02, 1.18, -0.44] };
            const leg = () => { const L = new Parts(7); L.add('dod', deep, [0, -0.25, 0], [0.15, 0.28, 0.15]); L.box(ice, [0.06, -0.52, 0], [0.26, 0.08, 0.2]); return L.build(); };
            parts.legR = { built: leg(), pivot: [0, 0.56, 0.18] };
            parts.legL = { built: leg(), pivot: [0, 0.56, -0.18] };
            height = 1.75;
            break;
        }
        case 'lich': {
            const robe = '#2a1a3a', bone = '#e8e0c8', gold = '#ffd24a';
            P.cone(robe, [0, 0.62, 0], [0.32, 1.0, 0.32], [0, 0, 0.05], { rough: 0.1 });
            for (let i = 0; i < 8; i++) P.cone(darker(robe, 0.8), [Math.cos(i * 0.8) * 0.26, 0.14, Math.sin(i * 0.8) * 0.26], [0.06, 0.2, 0.06], [Math.PI, 0, 0]);
            P.box('#4a2a5a', [0.08, 0.9, 0], [0.1, 0.5, 0.2]);
            for (const z of [-1, 1]) P.add('sph', darker(robe, 0.7), [0, 1.1, z * 0.24], [0.13, 0.1, 0.13]);
            P.add('sph2', bone, [0.04, 1.32, 0], [0.13, 0.14, 0.12]);
            P.box('#1a1418', [0.15, 1.27, 0], [0.04, 0.05, 0.12]);
            eyes(P, 2, '#8aff8a', 0.15, 1.34, 0, 0.025, 0.05);
            for (let i = 0; i < 6; i++) P.cone(gold, [0.04 + Math.cos(i * 1.05) * 0.11, 1.48, Math.sin(i * 1.05) * 0.11], [0.02, 0.1, 0.02], [0, 0, 0], { glow: i % 2 === 0 });
            P.add('ring', '#6aff8a', [0, 0.35, 0], [0.55, 0.55, 0.55], [Math.PI / 2, 0, 0], { glow: true });
            const arm = (staff) => { const A = new Parts(staff ? 11 : 12); A.limb(robe, [0, 0, 0], [0.12, -0.3, 0], 0.06, 'cone'); A.sph(bone, [0.14, -0.33, 0], [0.04, 0.04, 0.04]); if (staff) { A.limb('#3a2a2a', [0.15, -0.8, 0], [0.15, 0.4, 0], 0.025); A.sph(bone, [0.15, 0.46, 0], [0.06, 0.07, 0.06]); A.sph('#8aff8a', [0.15, 0.58, 0], [0.07, 0.07, 0.07], [0, 0, 0], { glow: true }); } return A.build(); };
            parts.armR = { built: arm(true), pivot: [0.04, 1.1, 0.26] };
            parts.armL = { built: arm(false), pivot: [0.04, 1.1, -0.26] };
            height = 1.6;
            break;
        }
        case 'dragon': {
            const scale = '#2a1218', bellyC = '#8a3a1a', horn = '#e8d8b8';
            P.add('sph2', scale, [0, 0.62, 0], [0.68, 0.38, 0.4]);
            P.add('sph', bellyC, [0.08, 0.46, 0], [0.56, 0.24, 0.32]);
            P.add('sph', scale, [-0.35, 0.6, 0], [0.4, 0.3, 0.33]);
            for (let i = 0; i < 7; i++) P.cone('#4a1a1a', [0.4 - i * 0.16, 0.9 - Math.abs(i - 2) * 0.02, 0], [0.04, 0.14, 0.04], [0, 0, -0.3]);
            // neck & head
            P.limb(scale, [0.45, 0.72, 0], [0.8, 1.15, 0], 0.17, 'cyl6');
            P.limb(bellyC, [0.5, 0.66, 0], [0.84, 1.06, 0], 0.11, 'cyl6');
            P.add('sph2', scale, [0.9, 1.24, 0], [0.24, 0.19, 0.19]);
            P.box(scale, [1.14, 1.18, 0], [0.32, 0.13, 0.2]);
            P.box('#f0e8d0', [1.16, 1.1, 0], [0.28, 0.025, 0.17]);
            for (const z of [-1, 1]) for (let i = 0; i < 4; i++) P.cone('#f0e8d0', [1.04 + i * 0.07, 1.1, z * 0.08], [0.015, 0.05, 0.015], [Math.PI, 0, 0]);
            for (const z of [-1, 1]) { P.limb(horn, [0.82, 1.32, z * 0.08], [0.6, 1.5, z * 0.16], 0.03, 'cone'); P.limb(horn, [0.86, 1.26, z * 0.12], [0.72, 1.32, z * 0.24], 0.02, 'cone'); }
            eyes(P, 2, '#ffaa1a', 1.0, 1.27, 0, 0.025, 0.08);
            P.sph('#ff5a1a', [1.2, 1.15, 0], [0.04, 0.03, 0.05], [0, 0, 0], { glow: true });
            const wing = (side) => { const W2 = new Parts(side + 20); W2.box('#1a0a0e', [0, 0, side * 0.55], [0.6, 0.015, 1.1], [0, 0, 0], { rough: 0.15 }); for (let i = 0; i < 4; i++) W2.limb('#3a1a1a', [0.1, 0.02, 0], [0.3 - i * 0.25, 0.02, side * 1.1], 0.018, 'cyl6'); W2.cone(horn, [0.32, 0.02, side * 1.1], [0.02, 0.1, 0.02], [0, 0, -1.3]); return W2.build(); };
            parts.wingL = { built: wing(1), pivot: [0.1, 0.82, 0.18] };
            parts.wingR = { built: wing(-1), pivot: [0.1, 0.82, -0.18] };
            const T = new Parts(31); T.limb(scale, [0, 0, 0], [-1.0, -0.32, 0], 0.16, 'cone'); T.cone('#4a1a1a', [-0.85, -0.25, 0], [0.08, 0.12, 0.02], [0, 0, 1.2]); parts.tail = { built: T.build(), pivot: [-0.55, 0.62, 0] };
            const leg = () => { const L = new Parts(32); L.add('sph', scale, [0, -0.02, 0], [0.13, 0.16, 0.11]); L.limb(scale, [0, 0, 0], [0.04, -0.42, 0], 0.095, 'cyl6'); for (let i = -1; i <= 1; i++) L.cone(horn, [0.12, -0.42, i * 0.04], [0.015, 0.06, 0.015], [0, 0, -1.8]); return L.build(); };
            parts.legFL = { built: leg(), pivot: [0.3, 0.45, 0.2] };
            parts.legFR = { built: leg(), pivot: [0.3, 0.45, -0.2] };
            parts.legBL = { built: leg(), pivot: [-0.3, 0.45, 0.2] };
            parts.legBR = { built: leg(), pivot: [-0.3, 0.45, -0.2] };
            height = 1.4;
            break;
        }
    }
    parts.body = { built: P.build() };
    // the body goes first so limbs draw after
    const ordered = { body: parts.body };
    for (const k in parts) if (k !== 'body') ordered[k] = parts[k];
    const plan = kind === 'warg' || kind === 'dragon' ? 'quad' : kind === 'toad' ? 'toad' : kind === 'lich' ? 'wraith' : 'biped';
    return { plan, kind, height, parts: ordered, mat: { rough: kind === 'colossus' ? 0.2 : 0.7, metal: kind === 'warlord' ? 0.25 : 0.05, transparent: kind === 'colossus', opacity: kind === 'colossus' ? 0.92 : 1 } };
}

// ------------------------------------------------------------------ Party

const UNIT_BUILDERS = {
    archer(P) { return humanoid(P, { skin: '#f0c8a0', robe: '#3a6a2a', legs: '#4a3a2a', hood: '#2e5a24', cape: '#2e5a24', quiver: true, weapon: 'bow', h: 0.86 }); },
    alchemist(P) { return humanoid(P, { skin: '#f0c8a0', robe: '#8a5a9a', legs: '#4a3a5a', hat: '#c83a3a', beard: '#f0f0f0', apron: '#d8c8a8', h: 0.66, girth: 1.15, cauldron: true, weapon: 'flask', goggles: true }); },
    knight(P) { return humanoid(P, { skin: '#f0c8a0', robe: '#b9c4d6', legs: '#8a94a6', plate: true, tabard: '#2a4a9a', helm: '#c8d0dc', plume: '#c83a3a', weapon: 'sword', shield: '#2a4a9a', h: 0.92, girth: 1.12 }); },
    pyro(P) { return humanoid(P, { skin: '#f0c8a0', robe: '#a82a1a', legs: '#5a1a1a', wizardHat: '#7a1a10', belt: '#ffd24a', weapon: 'staff', orb: '#ff7a2a', h: 0.9, beard: '#7a5a3a' }); },
    frost(P) { return humanoid(P, { skin: '#e8eef8', robe: '#7ab0e0', legs: '#4a6a9a', hair: '#ffffff', iceCrown: true, weapon: 'staff', orb: '#8fe8ff', crystalStaff: true, h: 0.9 }); },
    dwarf(P) { return humanoid(P, { skin: '#e8b08a', robe: '#8a5a2a', legs: '#4a3020', beard: '#d8782a', hornHelm: '#9aa0a8', apron: '#5a3a1a', barrelBack: true, weapon: 'keg', h: 0.68, girth: 1.35 }); },
    cleric(P) { return humanoid(P, { skin: '#f0c8a0', robe: '#f0ece0', legs: '#c8c0a8', trim: '#ffd24a', hood: '#e8e4d8', weapon: 'sunstaff', orb: '#fff0a0', medallion: true, h: 0.88 }); },
    druid(P) { return humanoid(P, { skin: '#d8b08a', robe: '#4a6a2a', legs: '#3a2a1a', hood: '#3a5a24', antlers: true, leaves: true, weapon: 'woodstaff', orb: '#8aff6a', h: 0.9, cape: '#5a4a2a' }); },
    storm(P) { return humanoid(P, { skin: '#e0d0c0', robe: '#2a2a6a', legs: '#1a1a3a', trim: '#c8d0e8', spikeCrown: true, weapon: 'orb', orb: '#c9a8ff', h: 0.92, cape: '#1a1a4a' }); },
};

/** The party's humanoids (faces +x). Returns a template. */
function humanoid(P, o) {
    const g = o.girth ?? 1;
    const h = o.h ?? 0.9;
    const L = 0.3 * h;
    const tH = 0.3 * h;
    const tw = 0.27 * g, td = 0.19 * g;
    const tTop = L + tH;
    // robe/legs as one: a skirt cone + tunic
    P.cone(o.robe, [0, L + 0.02, 0], [tw * 0.62, L * 1.1, tw * 0.62], [Math.PI, 0, 0]);
    for (const z of [-1, 1]) P.box(o.legs, [0.01, L * 0.35, z * 0.06 * g], [0.09, L * 0.7, 0.08]);
    for (const z of [-1, 1]) P.box('#3a2a1a', [0.04, 0.03, z * 0.06 * g], [0.13, 0.06, 0.09]);
    P.box(o.robe, [0, L + tH * 0.5, 0], [td, tH, tw]);
    if (o.plate) { P.box(o.robe, [0.01, L + tH * 0.55, 0], [td * 1.15, tH * 0.85, tw * 1.1], [0, 0, 0], { rough: 0.03 }); for (const z of [-1, 1]) P.sph('#d8dee8', [0, tTop, z * tw * 0.55], [0.08, 0.06, 0.08]); }
    if (o.tabard) { P.box(o.tabard, [td * 0.55, L + tH * 0.4, 0], [0.02, tH * 1.1, tw * 0.6]); P.box('#ffd24a', [td * 0.57, L + tH * 0.55, 0], [0.02, 0.06, 0.06]); }
    if (o.belt) P.box(o.belt, [0, L + 0.03, 0], [td * 1.06, 0.04, tw * 1.04]);
    if (o.trim) { P.box(o.trim, [td * 0.51, L + tH * 0.5, 0], [0.015, tH, 0.04]); P.box(o.trim, [0, L + 0.01, 0], [td * 1.1, 0.03, tw * 1.08]); }
    if (o.apron) P.box(o.apron, [td * 0.55, L + 0.02, 0], [0.02, tH * 1.2, tw * 0.7]);
    if (o.cape) P.box(o.cape, [-td * 0.6, L + tH * 0.3, 0], [0.03, tH * 1.5, tw * 1.1], [0, 0, 0.12]);
    if (o.quiver) { P.cyl('#6a4a2a', [-td * 0.7, L + tH * 0.65, 0.06], [0.045, 0.24, 0.045], [0.2, 0, 0.25]); for (let i = 0; i < 3; i++) P.box('#e8e0c8', [-td * 0.75 - 0.03, L + tH + 0.08, 0.04 + i * 0.025], [0.01, 0.07, 0.015]); }
    if (o.barrelBack) { P.cyl('#8a5a2a', [-td * 0.95, L + tH * 0.6, 0], [0.12, 0.2, 0.12]); for (const y of [-0.06, 0.06]) P.cyl('#3a3a3a', [-td * 0.95, L + tH * 0.6 + y, 0], [0.125, 0.02, 0.125]); }
    if (o.medallion) P.sph('#ffe680', [td * 0.6, L + tH * 0.7, 0], [0.035, 0.035, 0.02], [0, 0, 0], { glow: true });
    if (o.leaves) for (let i = 0; i < 5; i++) P.add('ico', i % 2 ? '#5a8a2a' : '#7aa83a', [Math.cos(i * 1.3) * td * 0.6, L + tH * (0.3 + 0.15 * (i % 3)), Math.sin(i * 1.3) * tw * 0.6], [0.05, 0.03, 0.05]);
    if (o.cauldron) {
        P.add('sph', '#2a2a2e', [0.28, 0.12, 0.12], [0.14, 0.11, 0.14]);
        P.cyl('#2a2a2e', [0.28, 0.2, 0.12], [0.13, 0.03, 0.13]);
        P.cyl('#6aff4a', [0.28, 0.21, 0.12], [0.11, 0.015, 0.11], [0, 0, 0], { glow: true });
        for (const z of [-0.06, 0.06]) P.box('#4a3a2a', [0.28, 0.0, 0.12 + z], [0.04, 0.06, 0.03]);
    }
    // head
    const hr = 0.1 * (h / 0.9) ** 0.3;
    const hp = [0.01, tTop + hr * 0.95, 0];
    P.add('sph2', o.skin, hp, [hr, hr * 1.02, hr * 0.95]);
    P.sph('#2a2018', [hp[0] + hr * 0.85, hp[1] + hr * 0.1, hr * 0.32], [0.012, 0.018, 0.012]);
    P.sph('#2a2018', [hp[0] + hr * 0.85, hp[1] + hr * 0.1, -hr * 0.32], [0.012, 0.018, 0.012]);
    if (o.beard) P.cone(o.beard, [hp[0] + hr * 0.55, hp[1] - hr * 0.75, 0], [hr * 0.75, hr * 1.4 * (o.girth > 1.2 ? 1.3 : 1), hr * 0.8], [Math.PI, 0, -0.2]);
    if (o.hair) P.cone(o.hair, [hp[0] - hr * 0.5, hp[1] - hr * 0.3, 0], [hr * 0.95, hr * 2.2, hr * 1.0], [0, 0, 0.5]);
    if (o.hood) { P.add('sph2', o.hood, [hp[0] - hr * 0.12, hp[1] + hr * 0.12, 0], [hr * 1.15, hr * 1.12, hr * 1.12]); P.cone(o.hood, [hp[0] - hr * 0.6, hp[1] + hr * 0.6, 0], [hr * 0.5, hr * 0.9, hr * 0.5], [0, 0, 1.0]); P.box(o.skin, [hp[0] + hr * 0.75, hp[1], 0], [hr * 0.4, hr * 0.9, hr * 1.1]); }
    if (o.hat) { P.cone(o.hat, [hp[0] - hr * 0.1, hp[1] + hr * 1.5, 0], [hr * 1.1, hr * 2.4, hr * 1.1], [0, 0, 0.25]); P.cyl(o.hat, [hp[0], hp[1] + hr * 0.55, 0], [hr * 1.2, 0.03, hr * 1.2]); }
    if (o.wizardHat) { P.cyl(o.wizardHat, [hp[0], hp[1] + hr * 0.6, 0], [hr * 1.6, 0.025, hr * 1.6]); P.cone(o.wizardHat, [hp[0] - hr * 0.2, hp[1] + hr * 1.7, 0], [hr * 0.9, hr * 2.3, hr * 0.9], [0, 0, 0.35]); P.cyl('#ffd24a', [hp[0], hp[1] + hr * 0.75, 0], [hr * 0.95, 0.03, hr * 0.95]); }
    if (o.goggles) for (const z of [-1, 1]) P.cyl('#c8a84a', [hp[0] + hr * 0.85, hp[1] + hr * 0.25, z * hr * 0.35], [0.03, 0.02, 0.03], [0, 0, Math.PI / 2]);
    if (o.helm) {
        P.add('sph2', o.helm, [hp[0], hp[1] + hr * 0.1, 0], [hr * 1.12, hr * 1.12, hr * 1.08], [0, 0, 0], { rough: 0.02 });
        P.box('#1a1a20', [hp[0] + hr * 1.0, hp[1], 0], [0.02, 0.02, hr * 1.2]);
        P.cone(o.plume, [hp[0] - hr * 0.2, hp[1] + hr * 1.2, 0], [0.03, 0.2, 0.05], [0, 0, 0.9]);
    }
    if (o.hornHelm) { P.add('sph2', o.hornHelm, [hp[0], hp[1] + hr * 0.35, 0], [hr * 1.1, hr * 0.75, hr * 1.06], [0, 0, 0], { rough: 0.02 }); for (const z of [-1, 1]) P.limb('#e8e0c8', [hp[0], hp[1] + hr * 0.6, z * hr * 0.95], [hp[0] + hr * 0.2, hp[1] + hr * 1.5, z * hr * 1.5], 0.022, 'cone'); }
    if (o.iceCrown) for (let i = 0; i < 5; i++) P.add('oct', '#bff0ff', [hp[0] + Math.cos(i * 1.26) * hr * 0.75, hp[1] + hr * 1.05, Math.sin(i * 1.26) * hr * 0.75], [0.02, 0.07 + (i % 2) * 0.03, 0.02], [0, 0, 0], { glow: true });
    if (o.spikeCrown) for (let i = 0; i < 6; i++) P.cone('#c8d0e8', [hp[0] + Math.cos(i * 1.05) * hr * 0.8, hp[1] + hr * 1.0, Math.sin(i * 1.05) * hr * 0.8], [0.015, 0.09, 0.015]);
    if (o.antlers) for (const z of [-1, 1]) { P.limb('#8a6a4a', [hp[0], hp[1] + hr * 0.8, z * hr * 0.5], [hp[0] - hr * 0.3, hp[1] + hr * 2.2, z * hr * 1.4], 0.018); P.limb('#8a6a4a', [hp[0] - hr * 0.15, hp[1] + hr * 1.5, z * hr * 0.95], [hp[0] + hr * 0.4, hp[1] + hr * 2.1, z * hr * 1.2], 0.014); }
    // arms
    const armLen = 0.27 * h;
    const shY = tTop - 0.04, shZ = tw * 0.5 + 0.03;
    const sleeve = o.plate ? o.robe : o.robe;
    const mkArm = (side, hold) => {
        const A = new Parts(side + 3);
        A.limb(sleeve, [0, 0, 0], [0.02, -armLen, 0], 0.045 * g, 'cyl6');
        A.sph(o.skin, [0.03, -armLen - 0.02, 0], [0.04, 0.04, 0.04]);
        if (hold === 'bow') A.add('tor', '#6a4a2a', [0.06, -armLen, 0], [0.04, 0.27, 0.27], [Math.PI / 2, Math.PI / 2, 0]);
        if (hold === 'sword') { A.box('#d8dce4', [0.05, -armLen + 0.2, 0], [0.035, 0.38, 0.012], [0, 0, -0.2], { rough: 0.02 }); A.box('#ffd24a', [0.03, -armLen + 0.02, 0], [0.04, 0.025, 0.12]); }
        if (hold === 'shield') { A.add('cyl6', o.shield, [0.07, -armLen * 0.55, 0], [0.16, 0.03, 0.13], [0, 0, Math.PI / 2]); A.box('#ffd24a', [0.09, -armLen * 0.55, 0], [0.02, 0.18, 0.03]); A.box('#ffd24a', [0.09, -armLen * 0.5, 0], [0.02, 0.03, 0.15]); }
        if (hold === 'staff' || hold === 'woodstaff' || hold === 'sunstaff') {
            A.limb(hold === 'sunstaff' ? '#d8c890' : '#6a4a2a', [0.04, -armLen - 0.3, 0], [0.05, -armLen + 0.5, 0], 0.018);
            if (o.crystalStaff) A.add('oct', o.orb, [0.05, -armLen + 0.58, 0], [0.045, 0.1, 0.045], [0, 0, 0], { glow: true });
            else if (hold === 'sunstaff') { A.add('ring', '#ffd24a', [0.05, -armLen + 0.56, 0], [0.07, 0.07, 0.07], [0, Math.PI / 2, 0]); A.sph(o.orb, [0.05, -armLen + 0.56, 0], [0.04, 0.04, 0.04], [0, 0, 0], { glow: true }); }
            else { if (hold === 'woodstaff') for (let i = 0; i < 3; i++) A.add('ico', '#6a9a3a', [0.05 + Math.cos(i * 2) * 0.04, -armLen + 0.5, Math.sin(i * 2) * 0.04], [0.035, 0.02, 0.035]); A.sph(o.orb, [0.05, -armLen + 0.56, 0], [0.045, 0.045, 0.045], [0, 0, 0], { glow: true }); }
        }
        if (hold === 'flask') { A.add('sph', '#a8ffda', [0.06, -armLen - 0.04, 0], [0.04, 0.05, 0.04], [0, 0, 0], { glow: true }); A.cyl('#d8d8d8', [0.06, -armLen + 0.02, 0], [0.015, 0.04, 0.015]); }
        if (hold === 'keg') { A.cyl('#8a5a2a', [0.08, -armLen - 0.02, 0], [0.08, 0.13, 0.08], [0, 0, Math.PI / 2]); A.cyl('#3a3a3a', [0.08, -armLen - 0.02, 0], [0.085, 0.02, 0.085], [0, 0, Math.PI / 2]); A.sph('#ffd24a', [0.15, -armLen + 0.05, 0], [0.018, 0.018, 0.018], [0, 0, 0], { glow: true }); }
        if (hold === 'orb') A.sph(o.orb, [0.1, -armLen + 0.06, 0], [0.065, 0.065, 0.065], [0, 0, 0], { glow: true });
        return A.build();
    };
    const right = o.weapon === 'bow' ? null : o.weapon;
    return {
        height: tTop + hr * 2.2,
        armR: mkArm(1, right ?? 'none'), armL: mkArm(-1, o.weapon === 'bow' ? 'bow' : o.shield ? 'shield' : 'none'),
        pivR: [0.0, shY, shZ], pivL: [0.0, shY, -shZ], headY: hp[1],
    };
}

function unitTemplate(type) {
    if (type === 'palisade') {
        const P = new Parts(41);
        for (let i = 0; i < 5; i++) {
            const z = -0.4 + i * 0.2;
            P.cyl(i % 2 ? '#8a6a3a' : '#7a5a2a', [0.05 * (i % 2), 0.32, z], [0.065, 0.64, 0.065], [0, 0, 0.18]);
            P.cone('#c8a87a', [0.12 + 0.05 * (i % 2), 0.7, z], [0.065, 0.14, 0.065], [0, 0, -0.18 + 0.18]);
        }
        for (const y of [0.22, 0.46]) P.box('#5a3a1a', [0.0, y, 0], [0.06, 0.05, 0.92], [0, 0, 0.18]);
        P.box('#6a5a4a', [-0.1, 0.03, 0], [0.4, 0.06, 0.95]);
        return { plan: 'structure', height: 0.8, parts: { body: { built: P.build() } }, mat: { rough: 0.95 } };
    }
    if (type === 'ballista') {
        const P = new Parts(43);
        P.box('#5a4a3a', [0, 0.08, 0], [0.6, 0.16, 0.5]);
        P.cyl('#4a3a2a', [0, 0.25, 0], [0.08, 0.2, 0.08]);
        const A = new Parts(44);
        A.box('#7a5a3a', [0.05, 0, 0], [0.7, 0.07, 0.08]);
        A.add('tor', '#5a3a1a', [0.25, 0, 0], [0.1, 0.35, 0.35], [Math.PI / 2, Math.PI / 2, 0]);
        A.limb('#e8e0c8', [0.2, 0, 0.33], [-0.2, 0, 0], 0.006);
        A.limb('#e8e0c8', [0.2, 0, -0.33], [-0.2, 0, 0], 0.006);
        A.cone('#c8ccd4', [0.45, 0.05, 0], [0.025, 0.1, 0.025], [0, 0, -Math.PI / 2]);
        A.box('#8a6a3a', [0.1, 0.05, 0], [0.6, 0.02, 0.02]);
        // engineer
        P.box('#8a6a4a', [-0.28, 0.32, 0.22], [0.12, 0.2, 0.14]);
        P.sph('#e8b08a', [-0.27, 0.49, 0.22], [0.065, 0.065, 0.065]);
        P.sph('#5a4a3a', [-0.27, 0.53, 0.22], [0.07, 0.04, 0.07]);
        P.box('#3a3a3a', [-0.27, 0.15, 0.22], [0.1, 0.14, 0.1]);
        return { plan: 'structure', height: 0.6, parts: { body: { built: P.build() }, armR: { built: A.build(), pivot: [0, 0.4, 0] } }, mat: { rough: 0.85 } };
    }
    const P = new Parts(type.length * 59);
    const r = UNIT_BUILDERS[type](P);
    return {
        plan: 'unit', height: r.height,
        parts: { body: { built: P.build() }, armR: { built: r.armR, pivot: r.pivR }, armL: { built: r.armL, pivot: r.pivL } },
        extra: { headY: r.headY },
        mat: { rough: type === 'knight' ? 0.45 : 0.85, metal: type === 'knight' ? 0.35 : 0.04 },
    };
}

// ------------------------------------------------------------------ Public API

export function speciesTemplate(sp) {
    return cached(`sp:${sp.id}`, () => {
        if (sp.plan === 'boss') return bossTemplate(sp.bossKind);
        if (sp.plan === 'icewall') return icewallTemplate();
        if (sp.plan === 'biped') return bipedTemplate(sp);
        if (sp.plan === 'quad') return quadTemplate(sp);
        if (sp.plan === 'flyer') return flyerTemplate(sp);
        if (sp.plan === 'blob') return blobTemplate(sp);
        if (sp.plan === 'wraith') return wraithTemplate(sp);
        if (sp.plan === 'siege') return siegeTemplate(sp);
        return bipedTemplate(sp);
    });
}

export function makeMonster(sp) { return instantiate(speciesTemplate(sp)); }
export function makeUnit(type) { return instantiate(cached(`unit:${type}`, () => unitTemplate(type))); }

/**
 * Animate a rig. state: { t, move (0..1 walk intensity), atk (0..1 attack swing), fly, hit }.
 */
export function animateRig(rig, s) {
    const P = rig.parts;
    const t = s.t;
    const w = s.move ?? 0;
    const a = s.atk ?? 0;
    const sw = Math.sin(t * 9) * 0.6 * w;
    const swing = a > 0 ? Math.sin((1 - a) * Math.PI) : 0;
    switch (rig.plan) {
        case 'biped':
        case 'unit':
            if (P.legL) { P.legL.rotation.z = sw; P.legR.rotation.z = -sw; }
            if (P.armR) P.armR.rotation.z = -sw * 0.6 - swing * 1.8 + (rig.plan === 'unit' ? 0.15 : 0);
            if (P.armL) P.armL.rotation.z = sw * 0.6 - swing * 0.4 + (rig.plan === 'unit' ? 0.25 : 0);
            rig.inner.position.y = Math.abs(Math.sin(t * 9)) * 0.03 * w + Math.sin(t * 2) * 0.006;
            rig.inner.rotation.z = -swing * 0.15;
            break;
        case 'quad':
            if (P.legFL) {
                P.legFL.rotation.z = sw; P.legBR.rotation.z = sw;
                P.legFR.rotation.z = -sw; P.legBL.rotation.z = -sw;
            }
            if (P.tail) P.tail.rotation.y = Math.sin(t * 6) * 0.4;
            if (P.wingL) { const f = s.fly ? Math.sin(t * 6) * 0.6 : 0.9; P.wingL.rotation.x = f; P.wingR.rotation.x = -f; }
            rig.inner.position.y = Math.abs(Math.sin(t * 9)) * 0.03 * w;
            rig.inner.rotation.z = -swing * 0.25;
            break;
        case 'worm':
            rig.inner.position.y = Math.sin(t * 5) * 0.02;
            rig.inner.scale.set(1 + Math.sin(t * 7) * 0.08, 1, 1);
            break;
        case 'flyer': {
            const f = Math.sin(t * 16);
            P.wingL.rotation.x = f * 0.8;
            P.wingR.rotation.x = -f * 0.8;
            rig.inner.position.y = Math.sin(t * 4) * 0.04;
            rig.inner.rotation.z = -swing * 0.5;
            break;
        }
        case 'blob': {
            const sq = Math.sin(t * 6) * 0.08 * (0.4 + w);
            rig.inner.scale.set(1 + sq, 1 - sq, 1 + sq);
            break;
        }
        case 'wisp':
            rig.inner.position.y = Math.sin(t * 3) * 0.05;
            break;
        case 'wraith':
            rig.inner.position.y = 0.05 + Math.sin(t * 2.5) * 0.04;
            if (P.armR) { P.armR.rotation.z = -0.3 - swing * 1.4 + Math.sin(t * 3) * 0.1; P.armL.rotation.z = -0.3 + Math.sin(t * 3 + 1) * 0.1; }
            break;
        case 'toad': {
            const sq = Math.sin(t * 2) * 0.03 + swing * 0.1;
            rig.inner.scale.set(1 + sq, 1 - sq, 1 + sq);
            break;
        }
        case 'siege':
        case 'structure':
            if (P.armR) P.armR.rotation.z = rig.plan === 'siege' && !s.ballista ? -swing * 1.6 : 0;
            if (P.armR && rig.plan === 'structure') P.armR.position.x = -swing * 0.08;
            break;
        case 'icewall':
            break;
    }
}

/** Obstacles on the field (rocks, stumps, graves…). One merged geometry per kind. */
export function obstacleModel(kind) {
    const built = cached(`ob:${kind}`, () => {
        const P = new Parts(kind.length * 7);
        switch (kind) {
            case 'rock': case 'stones':
                P.add('dod', '#8a8680', [0, 0.22, 0], [0.34, 0.26, 0.3], [0.3, 0.5, 0]);
                P.add('dod', '#7a766e', [0.2, 0.1, 0.2], [0.16, 0.12, 0.14]);
                if (kind === 'stones') P.add('dod', '#9a968e', [-0.2, 0.1, -0.2], [0.14, 0.12, 0.16]);
                P.sph('#5a7a3a', [0.0, 0.42, 0.05], [0.14, 0.04, 0.12]);
                break;
            case 'stump':
                P.cyl('#6a4a2a', [0, 0.14, 0], [0.24, 0.28, 0.24]);
                P.cyl('#c8a87a', [0, 0.29, 0], [0.22, 0.02, 0.22]);
                for (let i = 0; i < 4; i++) P.limb('#5a3a1a', [Math.cos(i * 1.6) * 0.15, 0.05, Math.sin(i * 1.6) * 0.15], [Math.cos(i * 1.6) * 0.35, 0.0, Math.sin(i * 1.6) * 0.35], 0.05, 'cone');
                break;
            case 'reeds':
                for (let i = 0; i < 9; i++) P.limb(i % 2 ? '#7a8a3a' : '#5a6a2a', [Math.cos(i * 2.1) * 0.2, 0, Math.sin(i * 2.1) * 0.25], [Math.cos(i * 2.1) * 0.25, 0.5 + (i % 3) * 0.1, Math.sin(i * 2.1) * 0.3], 0.02, 'cone');
                P.cyl('#3a5a4a', [0, 0.01, 0], [0.38, 0.02, 0.38]);
                break;
            case 'basalt': case 'spire':
                for (let i = 0; i < 4; i++) P.add('cyl6', i % 2 ? '#2a2628' : '#3a3434', [Math.cos(i * 1.7) * 0.12, (kind === 'spire' ? 0.4 : 0.22) + i * 0.04, Math.sin(i * 1.7) * 0.15], [0.12, (kind === 'spire' ? 0.8 : 0.44) + i * 0.08, 0.12]);
                if (kind === 'spire') P.add('oct', '#ff4a1a', [0, 0.95, 0], [0.04, 0.08, 0.04], [0, 0, 0], { glow: true });
                break;
            case 'vent':
                P.add('dod', '#2a2424', [0, 0.1, 0], [0.32, 0.14, 0.3]);
                P.cyl('#ff6a1a', [0, 0.2, 0], [0.12, 0.03, 0.12], [0, 0, 0], { glow: true });
                break;
            case 'iceblock': case 'drift':
                if (kind === 'drift') P.sph('#f0f6fb', [0, 0.08, 0], [0.42, 0.16, 0.36]);
                else for (let i = 0; i < 3; i++) P.add('oct', i ? '#bfe6ff' : '#8fd0f0', [Math.cos(i * 2) * 0.12, 0.25, Math.sin(i * 2) * 0.12], [0.16, 0.35 - i * 0.06, 0.16], [0.1 * i, 0, 0.2]);
                break;
            case 'grave':
                P.box('#7a7a80', [0, 0.28, 0], [0.1, 0.5, 0.36]);
                P.cyl('#7a7a80', [0, 0.53, 0], [0.18, 0.1, 0.18], [Math.PI / 2, 0, 0]);
                P.box('#4a3a2a', [0.25, 0.04, 0], [0.4, 0.08, 0.3]);
                P.box('#5a5a60', [0.06, 0.32, 0], [0.01, 0.15, 0.04]);
                P.box('#5a5a60', [0.06, 0.36, 0], [0.01, 0.04, 0.14]);
                break;
            case 'bones':
                P.add('sph2', '#e8e0c8', [0, 0.12, 0], [0.13, 0.12, 0.12]);
                for (let i = 0; i < 4; i++) P.box('#d8d0b8', [Math.cos(i) * 0.2, 0.04, Math.sin(i * 1.7) * 0.2], [0.3, 0.04, 0.04], [0, i, 0]);
                break;
            default:
                P.box('#888888', [0, 0.2, 0], [0.4, 0.4, 0.4]);
        }
        return P.build();
    });
    const mat = actorMaterial({ rough: 0.9 });
    return partMesh(built, mat, GLOW_MAT);
}

export { GLOW_MAT, darker, lighter };
