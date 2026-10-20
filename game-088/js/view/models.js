// Procedural models for the dig: the six finds, the specials, boulders, crust and relics.
// Built front-facing (+Y up, +Z toward the camera); geometries are cached per kind and each
// tile is a cheap group of meshes that share them.

import * as THREE from 'three';
import { Kit, instance, lathe, sphere, box, cyl, cone, torus, tube, bumpy, extrude, starShape, shade, glowTexture } from './kit.js';
import { TILES } from '../config.js';
import { buildArtifact } from './artifacts.js';

const cache = new Map();
const cached = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

// ------------------------------------------------------------------ the six finds
function amphora() {
    const k = new Kit();
    const body = TILES[0].color;
    k.add(lathe([[0, -0.38], [0.11, -0.38], [0.13, -0.35], [0.09, -0.3], [0.2, -0.18], [0.27, -0.04], [0.27, 0.06], [0.22, 0.15], [0.12, 0.22], [0.085, 0.27], [0.085, 0.31], [0.14, 0.34], [0.14, 0.38], [0.06, 0.38], [0.06, 0.34]], 28),
        (x, y) => (y > -0.02 && y < 0.07) || y > 0.33 ? '#3a1c10' : (y > 0.09 && y < 0.12) ? '#f2d6a0' : body, 'gloss');
    for (const s of [-1, 1]) k.add(torus(0.085, 0.024, 6, 14, Math.PI * 1.1), shade(body, -0.15), 'gloss', { p: [s * 0.16, 0.24, 0], r: [0, 0, s > 0 ? -1.2 : Math.PI + 1.2] });
    return k.geometries();
}

function coin() {
    const k = new Kit();
    const g = TILES[1].color;
    k.add(cyl(0.34, 0.34, 0.09, 36), g, 'gold', { r: [Math.PI / 2, 0, 0] });
    k.add(torus(0.335, 0.035, 8, 36), shade(g, -0.12), 'gold');
    k.add(torus(0.22, 0.016, 6, 30), shade(g, -0.05), 'gold', { p: [0, 0, 0.045] });
    k.add(extrude(starShape(5, 0.15, 0.065), 0.025, 0.008, 2), shade(g, 0.15), 'gold', { p: [0, 0, 0.055] });
    k.add(extrude(starShape(5, 0.15, 0.065), 0.025, 0.008, 2), shade(g, 0.15), 'gold', { p: [0, 0, -0.055], r: [0, Math.PI, 0] });
    return k.geometries();
}

function leaf() {
    const k = new Kit();
    const c = TILES[2].color;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
        const t = i / 24, y = -0.36 + t * 0.74;
        const w = Math.sin(t * Math.PI) ** 0.8 * 0.25 * (1 - 0.25 * t);
        pts.push([w, y]);
    }
    for (let i = 23; i > 0; i--) pts.push([-pts[i][0], pts[i][1]]);
    k.add(extrude(pts, 0.06, 0.035, 2), (x, y) => shade(c, -0.15 + (y + 0.4) * 0.3), 'gloss', { r: [0, 0, -0.35] });
    k.add(box(0.022, 0.66, 0.02), shade(c, -0.4), 'gloss', { p: [0.02, 0.0, 0.07], r: [0, 0, -0.35] });
    for (let i = 0; i < 4; i++) {
        const y = -0.18 + i * 0.12;
        for (const s of [-1, 1]) k.add(box(0.16 - i * 0.02, 0.016, 0.016), shade(c, -0.4), 'gloss', { p: [0.02 + Math.sin(0.35) * -y + s * 0.07, y * Math.cos(0.35) + 0.04, 0.072], r: [0, 0, -0.35 + s * 0.6] });
    }
    k.add(cyl(0.018, 0.022, 0.14, 6), '#6b4a2a', 'matte', { p: [-0.14, -0.36, 0], r: [0, 0, -0.35] });
    return k.geometries();
}

function shell() {
    const k = new Kit();
    const c = TILES[3].color;
    const pts = [], radii = [];
    const turns = 2.6;
    for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * turns * Math.PI * 2;
        const r = 0.032 * Math.exp(0.128 * t);
        pts.push([Math.cos(t) * r, Math.sin(t) * r, 0]);
        radii.push(r * 0.52 * (1 + 0.07 * Math.sin(t * 9)));
    }
    k.add(tube(pts, radii, 12), (x, y, z) => shade(c, Math.sin(Math.atan2(y, x) * 6) * 0.12 + z * 0.8), 'pearl', { s: 0.98, r: [0, 0, 0.6] });
    return k.geometries();
}

function crystal() {
    const k = new Kit();
    const c = TILES[4].color;
    const prism = (r, h, p, rot, tone) => {
        k.add(cyl(r, r * 0.9, h, 6, 1), shade(c, tone), 'gem', { p, r: rot });
        const up = new THREE.Vector3(0, h / 2 + r * 0.6, 0).applyEuler(new THREE.Euler(...rot));
        k.add(cone(r, r * 1.2, 6), shade(c, tone + 0.15), 'gem', { p: [p[0] + up.x, p[1] + up.y, p[2] + up.z], r: rot });
    };
    prism(0.13, 0.42, [0, -0.04, 0], [0.1, 0.3, 0], 0);
    prism(0.09, 0.28, [-0.17, -0.12, 0.02], [0, 0.2, 0.55], -0.1);
    prism(0.085, 0.24, [0.17, -0.15, 0.03], [0.1, -0.2, -0.6], 0.05);
    k.add(bumpy(sphere(0.14, 8, 6), 0.03, 4, 3), '#5b4a6e', 'flat', { p: [0, -0.3, -0.02], s: [1.6, 0.6, 0.9] });
    return k.geometries();
}

function bone() {
    const k = new Kit();
    const c = TILES[5].color;
    const col = (x, y) => shade(c, -0.08 + y * 0.3);
    k.add(cyl(0.07, 0.07, 0.48, 14), col, 'bone', { r: [0, 0, Math.PI / 2] });
    for (const x of [-1, 1]) for (const y of [-1, 1]) k.add(sphere(0.105, 16, 12), col, 'bone', { p: [x * 0.27, y * 0.07, 0] });
    const g = k.geometries();
    for (const p of g) p.geo.rotateZ(0.62);
    return g;
}

const FINDERS = [amphora, coin, leaf, shell, crystal, bone];
export function tileGeos(color) { return cached('tile' + color, FINDERS[color]); }

// ------------------------------------------------------------------ specials
function glowMat(color, opacity = 1) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
}
const sharedGlow = {};
function glow(key, color, opacity) { if (!sharedGlow[key]) sharedGlow[key] = glowMat(color, opacity); return sharedGlow[key]; }

/** Glowing arrows and a bar for a trowel; returns a group to add to the tile. */
export function trowelOverlay(dir) {
    const g = new THREE.Group();
    const bar = new THREE.Mesh(cached('barGeo', () => new THREE.CapsuleGeometry(0.035, 0.74, 4, 8)), glow('bar', 0xfff1b8, 0.85));
    bar.rotation.z = Math.PI / 2;
    g.add(bar);
    const arrowGeo = cached('arrowGeo', () => new THREE.ConeGeometry(0.075, 0.14, 4));
    for (const s of [-1, 1]) {
        const a = new THREE.Mesh(arrowGeo, glow('arrow', 0xffe27a, 1));
        a.position.x = s * 0.47;
        a.rotation.z = -s * Math.PI / 2;
        g.add(a);
    }
    // a little metal trowel blade behind the find
    const blade = instance(cached('trowelBlade', () => {
        const k = new Kit();
        k.add(extrude([[0, 0.2], [0.1, 0.02], [0.08, -0.1], [-0.08, -0.1], [-0.1, 0.02]], 0.015, 0.006, 2), '#c9d2d8', 'metal');
        k.add(cyl(0.012, 0.012, 0.1, 6), '#8a8f94', 'metal', { p: [0, -0.15, 0] });
        k.add(cyl(0.03, 0.026, 0.16, 8), '#a45a2a', 'gloss', { p: [0, -0.27, 0] });
        return k.geometries();
    }), false);
    blade.position.set(0.24, 0.2, -0.12);
    blade.rotation.z = -0.8;
    blade.scale.setScalar(0.85);
    g.add(blade);
    if (dir === 'v') g.rotation.z = Math.PI / 2;
    g.userData.pulse = [bar];
    return g;
}

export function pickaxeOverlay() {
    const g = new THREE.Group();
    const pick = instance(cached('pickaxe', () => {
        const k = new Kit();
        k.add(cyl(0.026, 0.03, 0.62, 8), '#9a5b2e', 'gloss', { r: [0, 0, 0.7] });
        k.add(tube([[-0.24, 0.05, 0], [0, 0.15, 0], [0.24, 0.05, 0]], [0.012, 0.04, 0.012], 8), '#aeb7bd', 'metal', { p: [0.2, 0.24, 0], r: [0, 0, 0.7] });
        return k.geometries();
    }), false);
    pick.position.set(0, 0, -0.14);
    g.add(pick);
    const aura = new THREE.Mesh(cached('auraGeo', () => new THREE.SphereGeometry(0.46, 20, 14)), cached('auraMat', () => fresnelMat(0xff8a2a)));
    g.add(aura);
    g.userData.aura = aura;
    return g;
}

function fresnelMat(color) {
    return new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        vertexShader: /* glsl */`
            varying vec3 vN; varying vec3 vV;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */`
            uniform vec3 uColor; uniform float uTime;
            varying vec3 vN; varying vec3 vV;
            void main() {
                float f = 1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
                f = f * f * (0.75 + 0.25 * sin(uTime * 6.0));
                gl_FragColor = vec4(uColor * f * 1.6, f);
            }`,
    });
}
export const auraMaterial = () => cached('auraMat', () => fresnelMat(0xff8a2a));

/** The scarab replaces the find's model; its wing cases keep the find's colour. */
export function scarabGeos(color) {
    return cached('scarab' + color, () => {
        const k = new Kit();
        const c = TILES[color].color;
        k.add(sphere(0.2, 20, 14), '#2b2418', 'gold', { p: [0, -0.02, -0.03], s: [1, 1.3, 0.7] });
        for (const s of [-1, 1]) k.add(sphere(0.2, 18, 12), (x, y) => shade(c, 0.1 + y * 0.4), 'gloss', { p: [s * 0.1, -0.05, 0.04], s: [0.52, 1.22, 0.6] });
        k.add(sphere(0.12, 16, 12), '#d9a93a', 'gold', { p: [0, 0.25, 0.02], s: [1.1, 0.75, 0.7] });
        k.add(sphere(0.075, 12, 10), '#3a2c18', 'gold', { p: [0, 0.35, 0.03] });
        for (const s of [-1, 1]) {
            k.add(sphere(0.022, 8, 6), '#fff6d0', 'glow', { p: [s * 0.04, 0.37, 0.09] });
            for (let i = 0; i < 3; i++) k.add(cyl(0.012, 0.01, 0.22, 5), '#3a2c18', 'gold', { p: [s * 0.24, 0.12 - i * 0.14, 0], r: [0, 0, s * (1.2 + (i - 1) * 0.35)] });
            k.add(cyl(0.008, 0.006, 0.18, 4), '#3a2c18', 'gold', { p: [s * 0.08, 0.46, 0.02], r: [0, 0, -s * 0.45] });
        }
        return k.geometries();
    });
}

/** The sunstone: a faceted rainbow orb with rays and a halo. */
let sunMat = null;
export function sunMaterial() {
    if (sunMat) return sunMat;
    sunMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        toneMapped: false,
        vertexShader: /* glsl */`
            varying vec3 vN; varying vec3 vV; varying vec3 vP;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position;
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */`
            uniform float uTime;
            varying vec3 vN; varying vec3 vV; varying vec3 vP;
            vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
            void main() {
                float f = 1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
                float h = fract(vP.y * 1.1 + vP.x * 0.6 + uTime * 0.2 + f * 0.5);
                vec3 gold = mix(vec3(1.0, 0.62, 0.12), vec3(1.0, 0.92, 0.55), clamp(0.5 + vP.y * 1.6, 0.0, 1.0));
                vec3 c = mix(gold, hue(h), clamp(f * f * 0.85, 0.0, 1.0));
                c *= 0.95 + 0.25 * sin(uTime * 4.0 + vP.y * 14.0) + 0.6 * f;
                gl_FragColor = vec4(c * 0.92, 1.0);
            }`,
    });
    return sunMat;
}
export function sunGroup() {
    const g = new THREE.Group();
    const orb = new THREE.Mesh(cached('sunOrb', () => new THREE.IcosahedronGeometry(0.27, 1)), sunMaterial());
    g.add(orb);
    const rays = new THREE.Group();
    const rayGeo = cached('rayGeo', () => new THREE.ConeGeometry(0.045, 0.2, 4));
    for (let i = 0; i < 8; i++) {
        const r = new THREE.Mesh(rayGeo, glow('ray', 0xffe9a0, 0.9));
        const a = (i / 8) * Math.PI * 2;
        r.position.set(Math.cos(a) * 0.37, Math.sin(a) * 0.37, 0);
        r.rotation.z = a - Math.PI / 2;
        rays.add(r);
    }
    g.add(rays);
    const halo = new THREE.Sprite(cached('haloMat', () => new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff0b0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.75 })));
    halo.scale.setScalar(1.3);
    g.add(halo);
    g.userData.spin = rays;
    g.userData.orb = orb;
    return g;
}

// ------------------------------------------------------------------ blockers
export function rockGeos(hp, variant = 0) {
    return cached(`rock${hp}-${variant}`, () => {
        const k = new Kit();
        const col = (x, y, z) => (y + z * 0.4 > 0.12 ? (hp === 2 ? '#6f8f4a' : '#7c9a52') : hp === 2 ? '#7d7a74' : '#9a958b');
        if (hp >= 2) {
            k.add(bumpy(new THREE.IcosahedronGeometry(0.4, 2), 0.07, 3.2, 7 + variant), col, 'flat', { s: [1.08, 0.95, 0.9] });
        } else {
            k.add(bumpy(new THREE.IcosahedronGeometry(0.24, 1), 0.05, 4, 11 + variant), col, 'flat', { p: [-0.13, -0.05, 0], s: [1, 1.1, 0.9], r: [0, 0, 0.2] });
            k.add(bumpy(new THREE.IcosahedronGeometry(0.22, 1), 0.05, 4, 17 + variant), col, 'flat', { p: [0.15, -0.07, 0.02], s: [1, 1, 0.9], r: [0, 0, -0.2] });
            k.add(bumpy(new THREE.IcosahedronGeometry(0.12, 1), 0.03, 5, 23 + variant), col, 'flat', { p: [0.02, 0.17, 0.04] });
        }
        return k.geometries();
    });
}

let crustMatV = null;
export function crustGeos() {
    return cached('crust', () => {
        const geo = bumpy(new THREE.IcosahedronGeometry(0.43, 2), 0.05, 5, 31);
        geo.scale(1, 1, 0.75);
        const c = new THREE.Color();
        const pos = geo.attributes.position;
        const col = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) {
            const n = (Math.sin(pos.getX(i) * 40) + Math.sin(pos.getY(i) * 37 + pos.getZ(i) * 23)) * 0.5;
            c.set(n > 0.6 ? '#a8864e' : '#e3c48a').multiplyScalar(0.85 + n * 0.1);
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        crustMatV = crustMatV || new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, transparent: true, opacity: 0.8, flatShading: true });
        return [{ geo, mat: crustMatV, kind: 'flat' }];
    });
}

// ------------------------------------------------------------------ relics
const RELIC_KINDS = [
    { kind: 'idol', a: '#e7c04a', b: '#3b8a8a' },
    { kind: 'chest', a: '#8a5a33', b: '#e7c35a' },
    { kind: 'mask', a: '#e9c24e', b: '#c43a3a' },
    { kind: 'vase2', a: '#2f64b8', b: '#f3e7c9' },
    { kind: 'crown', a: '#e8be3c', b: '#d23a5a' },
];
export function relicGroup(item) {
    const spec = RELIC_KINDS[item % RELIC_KINDS.length];
    const g = cached('relic' + (item % RELIC_KINDS.length), () => {
        const holder = buildArtifact({ ...spec, id: 'relic' }, 0.72);
        return holder;
    });
    const out = g.clone(true);
    const halo = new THREE.Sprite(cached('relicHalo', () => new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd36a, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.55 })));
    halo.scale.setScalar(1.15);
    halo.position.z = -0.2;
    out.add(halo);
    return out;
}

// ------------------------------------------------------------------ a find, as a tile object
/**
 * The model for a board tile: { group, body, overlay } where body is the find (or scarab or
 * sunstone) and overlay the special's decoration, if any.
 */
export function tileModel(t) {
    const group = new THREE.Group();
    let body;
    if (t.k === 'sun') body = sunGroup();
    else if (t.k === 'relic') body = relicGroup(t.item || 0);
    else if (t.s === 'scarab') body = instance(scarabGeos(t.c));
    else body = instance(tileGeos(t.c));
    group.add(body);
    let overlay = null;
    if (t.k === 'gem' && (t.s === 'h' || t.s === 'v')) overlay = trowelOverlay(t.s);
    if (t.k === 'gem' && t.s === 'bomb') overlay = pickaxeOverlay();
    if (overlay) group.add(overlay);
    let crust = null;
    if (t.crust) { crust = instance(crustGeos()); group.add(crust); }
    return { group, body, overlay, crust };
}
