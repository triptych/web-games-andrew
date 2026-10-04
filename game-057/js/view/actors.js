/**
 * actors.js — everything that moves: the marine, Ellie, the Brood (one
 * instanced mesh per bug type, legs/mandibles/wings animated in the vertex
 * shader from a per-instance phase), the five bosses (JS-animated groups),
 * pickups, gun drones and grenades.
 *
 * Model space: forward is +X, up is +Y. A sim angle a maps to rotation.y = −a.
 */

import * as THREE from 'three';
import { WEAPONS, ENEMIES, ENEMY_ORDER, BOSSES, POWERUPS } from '../config.js';
import { box, cyl, sph, merge, paint, makeLitMaterial } from './level.js';
import { patchLit, Q } from './scene.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** A cylinder from a to b. */
function limb(a, b, r0, r1, color, glow = 0, seg = 6) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(r1, r0, len, seg);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.normalize());
    g.applyQuaternion(q);
    g.translate(a.x, a.y, a.z);
    return paint(g, color, glow);
}

/** Tag every vertex of g with a bone id and pivot. */
function bone(g, id, pivot = V(0, 0, 0)) {
    const n = g.attributes.position.count;
    const b = new Float32Array(n).fill(id);
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = pivot.x; p[i * 3 + 1] = pivot.y; p[i * 3 + 2] = pivot.z; }
    g.setAttribute('aBone', new THREE.BufferAttribute(b, 1));
    g.setAttribute('aPivot', new THREE.BufferAttribute(p, 3));
    return g;
}

function parts(list) { return merge(list); }

// ------------------------------------------------------------------ Weapon models

const WMAT = {};
function weaponMat() {
    if (!WMAT.m) WMAT.m = makeLitMaterial('weapon', { roughness: 0.35, metalness: 0.7 });
    return WMAT.m;
}

export function weaponGeo(id) {
    const c = WEAPONS[id]?.color ?? 0xffffff;
    const dark = 0x23272c, mid = 0x3a4048;
    switch (id) {
    case 'pulse': return merge([box(0.62, 0.12, 0.1, 0.25, 0, 0, mid), box(0.22, 0.18, 0.11, 0.05, -0.04, 0, dark), box(0.08, 0.16, 0.08, 0.12, -0.14, 0, dark), box(0.3, 0.05, 0.06, 0.45, 0.05, 0, c, 1.2), cyl(0.025, 0.025, 0.18, 6, 0.62, 0, 0, dark, 0, 0, Math.PI / 2)]);
    case 'scatter': return merge([box(0.5, 0.1, 0.12, 0.25, 0, 0, 0x5a3a24), cyl(0.045, 0.045, 0.55, 8, 0.45, 0.03, 0.03, dark, 0, 0, Math.PI / 2), cyl(0.045, 0.045, 0.55, 8, 0.45, 0.03, -0.03, dark, 0, 0, Math.PI / 2), box(0.12, 0.06, 0.13, 0.4, -0.05, 0, c, 0.8)]);
    case 'flame': return merge([box(0.5, 0.14, 0.12, 0.2, 0, 0, mid), cyl(0.08, 0.08, 0.3, 10, 0.05, -0.12, 0, 0xc0401a, 0.2), cyl(0.04, 0.06, 0.3, 8, 0.55, 0.02, 0, dark, 0, 0, Math.PI / 2), sph(0.035, 0.7, 0.02, 0, 0x6ab0ff, 2)]);
    case 'smart': return merge([box(0.6, 0.16, 0.14, 0.25, 0, 0, 0x2e3a2a), box(0.2, 0.1, 0.1, 0.2, 0.13, 0, dark), sph(0.04, 0.3, 0.13, 0.06, c, 2), cyl(0.04, 0.04, 0.2, 8, 0.62, 0, 0, dark, 0, 0, Math.PI / 2), box(0.3, 0.03, 0.15, 0.3, -0.06, 0, c, 0.8)]);
    case 'arc': return merge([box(0.45, 0.14, 0.14, 0.18, 0, 0, dark), ...[0, 1, 2].map((i) => cyl(0.05, 0.05, 0.04, 10, 0.45 + i * 0.07, 0, 0, c, 1.6, 0, Math.PI / 2)), cyl(0.02, 0.02, 0.2, 6, 0.6, 0, 0, 0xffffff, 1, 0, Math.PI / 2)]);
    case 'rail': return merge([box(0.8, 0.08, 0.16, 0.35, 0, 0, mid), box(0.7, 0.04, 0.04, 0.4, 0.06, 0.05, c, 1.5), box(0.7, 0.04, 0.04, 0.4, 0.06, -0.05, c, 1.5), box(0.2, 0.18, 0.12, 0.0, -0.04, 0, dark)]);
    case 'gl': return merge([cyl(0.09, 0.09, 0.5, 10, 0.3, 0, 0, 0x4a5a3a, 0, 0, Math.PI / 2), cyl(0.12, 0.12, 0.18, 6, 0.08, 0, 0, dark, 0, Math.PI / 2), box(0.1, 0.16, 0.08, 0.0, -0.12, 0, dark), box(0.12, 0.03, 0.03, 0.35, 0.1, 0, c, 1)]);
    case 'minigun': return merge([...[0, 1, 2, 3, 4, 5].map((i) => cyl(0.025, 0.025, 0.6, 6, 0.45, Math.cos(i) * 0.06, Math.sin(i) * 0.06, dark, 0, 0, Math.PI / 2)), box(0.3, 0.2, 0.2, 0.05, 0, 0, mid), cyl(0.09, 0.09, 0.05, 10, 0.72, 0, 0, c, 0.8, 0, Math.PI / 2)]);
    case 'plasma': return merge([box(0.5, 0.18, 0.18, 0.2, 0, 0, 0x3a2a48), sph(0.11, 0.42, 0.03, 0, c, 2), cyl(0.07, 0.1, 0.25, 10, 0.62, 0.03, 0, dark, 0, 0, Math.PI / 2), box(0.3, 0.04, 0.2, 0.15, -0.1, 0, c, 1)]);
    case 'ellie': return merge([box(0.24, 0.08, 0.06, 0.12, 0, 0, dark), box(0.06, 0.12, 0.05, 0.03, -0.08, 0, dark)]);
    default: return box(0.4, 0.1, 0.1, 0.2, 0, 0, mid);
    }
}

const WGEO = {};
export function weaponModel(id) {
    WGEO[id] ??= weaponGeo(id);
    const m = new THREE.Mesh(WGEO[id], weaponMat());
    m.castShadow = true;
    const g = new THREE.Group();
    g.add(m);
    return g;
}

// ------------------------------------------------------------------ Marine

export function makeMarine() {
    const mat = makeLitMaterial('marine', {
        roughness: 0.45, metalness: 0.45, uniforms: { uHurt: { value: 0 } }, fragmentPars: 'uniform float uHurt;',
        emissiveFragment: `totalEmissiveRadiance += vec3(1.0, 0.1, 0.05) * uHurt;
            float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);
            totalEmissiveRadiance += vec3(0.3, 0.75, 0.9) * rim * 0.35;`,
    });
    const armor = 0x6a7a52, armor2 = 0x4a5638, dark = 0x22262a, teal = 0x46e0ff, cloth = 0x3a3f44;
    const root = new THREE.Group();
    const body = new THREE.Group();   // rolls
    root.add(body);
    const hips = new THREE.Group();
    hips.position.y = 0.88;
    body.add(hips);
    const legs = [];
    for (const s of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(0, 0, s * 0.13);
        const geo = merge([
            box(0.2, 0.42, 0.18, 0, -0.2, 0, cloth), box(0.22, 0.12, 0.2, 0.02, -0.38, 0, armor2),
            box(0.18, 0.42, 0.16, 0, -0.62, 0, armor), box(0.3, 0.12, 0.2, 0.06, -0.82, 0, dark),
        ]);
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = true;
        leg.add(m);
        hips.add(leg);
        legs.push(leg);
    }
    const torso = new THREE.Group();
    torso.position.y = 0.0;
    hips.add(torso);
    const torsoGeo = merge([
        box(0.34, 0.18, 0.4, 0, 0.08, 0, cloth),
        box(0.36, 0.42, 0.48, 0.02, 0.38, 0, armor), box(0.06, 0.3, 0.36, 0.2, 0.4, 0, armor2),
        box(0.04, 0.05, 0.3, 0.215, 0.5, 0, teal, 1.2),
        box(0.3, 0.46, 0.42, -0.3, 0.42, 0, armor2), box(0.12, 0.2, 0.3, -0.48, 0.38, 0, dark), // backpack
        sph(0.07, -0.3, 0.72, 0.16, 0xfff2c0, 2.2), // shoulder lamp
        sph(0.15, 0.0, 0.62, 0.3, armor, 0, 1.1, 0.75, 1, 8), sph(0.15, 0.0, 0.62, -0.3, armor, 0, 1.1, 0.75, 1, 8),
        sph(0.17, 0.02, 0.82, 0, armor, 0, 1.05, 1, 1, 12), // helmet
        box(0.1, 0.08, 0.24, 0.15, 0.82, 0, teal, 2.0), // visor
        box(0.18, 0.05, 0.3, -0.02, 0.95, 0, armor2),
    ]);
    const tm = new THREE.Mesh(torsoGeo, mat);
    tm.castShadow = true;
    torso.add(tm);
    // Arms reach forward to the gun.
    const arms = new THREE.Mesh(merge([
        limb(V(0.0, 0.55, 0.3), V(0.25, 0.32, 0.18), 0.07, 0.06, cloth), limb(V(0.25, 0.32, 0.18), V(0.42, 0.3, 0.02), 0.06, 0.05, armor),
        limb(V(0.0, 0.55, -0.3), V(0.2, 0.36, -0.15), 0.07, 0.06, cloth), limb(V(0.2, 0.36, -0.15), V(0.55, 0.32, -0.01), 0.06, 0.05, armor),
        sph(0.06, 0.42, 0.3, 0.02, dark), sph(0.06, 0.56, 0.32, 0, dark),
    ]), mat);
    arms.castShadow = true;
    torso.add(arms);
    const gun = new THREE.Group();
    gun.position.set(0.28, 0.33, 0);
    torso.add(gun);
    // Ground ring with an aim notch: keeps the marine readable in a swarm.
    const ringMat = new THREE.ShaderMaterial({
        uniforms: { uCol: { value: new THREE.Color(0x46e0ff) }, uA: { value: 0.8 } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 uCol; uniform float uA; varying vec2 vUv;
            void main() {
                vec2 q = vUv - 0.5; float d = length(q) * 2.0;
                float ring = smoothstep(0.08, 0.0, abs(d - 0.82));
                float a = atan(q.y, q.x);
                float notch = smoothstep(0.35, 0.0, abs(a)) * smoothstep(0.62, 0.95, d) * step(d, 1.0);
                float al = (ring * 0.55 + notch) * uA;
                if (al < 0.01) discard;
                gl_FragColor = vec4(uCol * al * 1.4, al);
            }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    ring.renderOrder = 2;
    root.add(ring);
    root.userData = { body, hips, legs, torso, gun, gunId: null, mat, ring };
    return root;
}

export function setMarineGun(marine, id) {
    const ud = marine.userData;
    if (ud.gunId === id) return;
    ud.gunId = id;
    ud.gun.clear();
    const m = weaponModel(id);
    ud.gun.add(m);
}

export function animateMarine(marine, p, ix, iy, t, hurt) {
    const ud = marine.userData;
    marine.position.set(ix, 0, iy);
    const speed = Math.hypot(p.vx, p.vy);
    const moveA = speed > 0.3 ? Math.atan2(p.vy, p.vx) : p.face;
    // Hips follow movement (or aim when still); torso aims.
    let hipYaw = -moveA;
    const aimYaw = -p.face;
    let diff = aimYaw - hipYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Walking backwards: turn the hips around rather than twisting 180°.
    if (Math.abs(diff) > Math.PI / 2) { hipYaw += Math.PI; diff = aimYaw - hipYaw; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2; }
    ud.hips.rotation.y = hipYaw;
    ud.torso.rotation.y = diff;
    ud.ring.rotation.z = -p.face;
    ud.ring.material.uniforms.uA.value = p.alive ? (p.rollT > 0 ? 0.3 : 0.8) : 0;
    const sw = Math.sin(p.anim * 2.6) * Math.min(1, speed / 4) * 0.7;
    ud.legs[0].rotation.z = sw;
    ud.legs[1].rotation.z = -sw;
    ud.hips.position.y = 0.88 + Math.abs(Math.cos(p.anim * 2.6)) * 0.04 * Math.min(1, speed / 4);
    ud.torso.rotation.z = -Math.min(1, speed / 6) * 0.08;
    // Recoil kick on the gun.
    ud.gun.position.x = 0.28 - (p.recoil ?? 0) * 0.08;
    // Roll: a full forward tumble.
    if (p.rollT > 0) {
        const f = 1 - p.rollT / 0.32;
        ud.body.rotation.set(0, -Math.atan2(p.rdy, p.rdx), 0);
        ud.body.children[0].rotation.z = -f * Math.PI * 2;
        ud.body.position.y = Math.sin(f * Math.PI) * 0.2 - 0.25 * Math.sin(f * Math.PI);
        ud.hips.rotation.y = 0; ud.torso.rotation.y = 0;
    } else {
        ud.body.rotation.set(0, 0, 0);
        ud.body.children[0].rotation.z = 0;
        ud.body.position.y = 0;
    }
    ud.mat.userData.u.uHurt.value = hurt;
    if (!p.alive) { ud.body.rotation.set(0, -p.face, 0); ud.body.children[0].rotation.z = 0; ud.body.children[0].rotation.x = 0; ud.body.rotation.z = 0; ud.hips.rotation.set(0, 0, 1.45); ud.torso.rotation.y = 0; ud.hips.position.y = 0.28; }
}

// ------------------------------------------------------------------ Ellie

export function makeEllie() {
    const mat = makeLitMaterial('ellie', { roughness: 0.6, metalness: 0.1 });
    const root = new THREE.Group();
    const hips = new THREE.Group();
    hips.position.y = 0.78;
    root.add(hips);
    const legs = [];
    for (const s of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.z = s * 0.1;
        leg.add(new THREE.Mesh(merge([box(0.13, 0.7, 0.13, 0, -0.38, 0, 0x2a3a5a), box(0.2, 0.08, 0.13, 0.04, -0.74, 0, 0x1a1a1a)]), mat));
        hips.add(leg);
        legs.push(leg);
    }
    const torso = new THREE.Group();
    hips.add(torso);
    torso.add(new THREE.Mesh(merge([
        box(0.26, 0.5, 0.36, 0, 0.25, 0, 0xe8ecec), box(0.27, 0.36, 0.38, -0.01, -0.06, 0, 0xdde2e2), // lab coat
        box(0.04, 0.12, 0.1, 0.14, 0.32, 0.08, 0x46c8ff, 1.2), // ID badge
        sph(0.13, 0.02, 0.66, 0, 0xe0b090, 0, 1, 1.05, 1, 10),
        sph(0.15, -0.03, 0.72, 0, 0xd8642a, 0, 1, 0.85, 1.05, 10), box(0.12, 0.3, 0.2, -0.12, 0.52, 0, 0xd8642a), // hair
        limb(V(0.02, 0.42, 0.2), V(0.3, 0.3, 0.06), 0.05, 0.045, 0xe8ecec), limb(V(0.02, 0.42, -0.2), V(0.3, 0.3, -0.02), 0.05, 0.045, 0xe8ecec),
    ]), mat));
    const gun = weaponModel('ellie');
    gun.position.set(0.32, 0.3, 0.02);
    torso.add(gun);
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    root.userData = { hips, legs, torso };
    return root;
}

export function animateEllie(m, el, ix, iy) {
    const ud = m.userData;
    m.position.set(ix, 0, iy);
    const speed = Math.hypot(el.vx, el.vy);
    ud.hips.rotation.y = -(speed > 0.3 ? Math.atan2(el.vy, el.vx) : el.face);
    let d = -el.face - ud.hips.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    ud.torso.rotation.y = Math.max(-1.2, Math.min(1.2, d));
    const sw = Math.sin(el.anim * 3) * Math.min(1, speed / 3) * 0.7;
    ud.legs[0].rotation.z = sw; ud.legs[1].rotation.z = -sw;
}

// ------------------------------------------------------------------ The Brood (instanced)

// Bones: 0 body · 1–6 legs (pivot = hip) · 7/8 mandibles · 9 wings · 10 tail/abdomen · 11 arms (swing X) · 12 humanoid legs (swing Z) · 13 head (track)

function insectLegs(list, n, hipX0, hipX1, hipY, hipZ, reach, footY, r, color) {
    for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const hx = hipX0 + (hipX1 - hipX0) * t;
        for (const s of [-1, 1]) {
            const hip = V(hx, hipY, s * hipZ);
            const knee = V(hx + (t - 0.5) * reach * 0.6, hipY + reach * 0.35, s * (hipZ + reach * 0.6));
            const foot = V(hx + (t - 0.5) * reach * 1.1, footY, s * (hipZ + reach * 1.05));
            const id = 1 + i * 2 + (s > 0 ? 1 : 0);
            list.push(bone(limb(hip, knee, r, r * 0.8, color), Math.min(6, id), hip));
            list.push(bone(limb(knee, foot, r * 0.8, r * 0.4, color), Math.min(6, id), hip));
        }
    }
}

export function bugGeometry(type) {
    const d = ENEMIES[type];
    const c = d.color, gl = d.glow;
    const L = [];
    const B = (g, id = 0, p) => L.push(bone(g, id, p));
    switch (type) {
    case 'skitter': {
        B(sph(0.22, -0.08, 0.2, 0, c, 0, 1.4, 0.6, 1, 10));
        B(sph(0.13, 0.2, 0.2, 0, c, 0, 1, 0.8, 1, 8));
        B(sph(0.17, -0.32, 0.22, 0, 0x6a4a30, 0, 1.3, 0.7, 1, 8), 10, V(-0.15, 0.2, 0));
        B(sph(0.035, 0.3, 0.25, 0.06, gl, 2.5)); B(sph(0.035, 0.3, 0.25, -0.06, gl, 2.5));
        B(limb(V(0.28, 0.18, 0.05), V(0.42, 0.12, 0.09), 0.025, 0.01, 0x2a1a10), 7, V(0.28, 0.18, 0.05));
        B(limb(V(0.28, 0.18, -0.05), V(0.42, 0.12, -0.09), 0.025, 0.01, 0x2a1a10), 8, V(0.28, 0.18, -0.05));
        insectLegs(L, 3, 0.12, -0.2, 0.2, 0.1, 0.3, 0.0, 0.025, 0x3a2818);
        break;
    }
    case 'drone': {
        B(sph(0.3, -0.05, 0.42, 0, c, 0, 1.3, 0.7, 0.9, 12));
        B(sph(0.26, 0.38, 0.52, 0, 0x1e2129, 0, 1.6, 0.6, 0.75, 12), 13, V(0.2, 0.45, 0)); // long domed head
        B(sph(0.05, 0.52, 0.52, 0.12, gl, 2.4), 13, V(0.2, 0.45, 0)); B(sph(0.05, 0.52, 0.52, -0.12, gl, 2.4), 13, V(0.2, 0.45, 0));
        B(sph(0.24, -0.5, 0.42, 0, 0x22252c, 0, 1.6, 0.65, 0.8, 10), 10, V(-0.25, 0.42, 0));
        B(limb(V(-0.8, 0.45, 0), V(-1.2, 0.35, 0), 0.06, 0.02, 0x1e2129), 10, V(-0.25, 0.42, 0));
        for (const s of [-1, 1]) {
            // Raptorial scythes.
            B(limb(V(0.15, 0.45, s * 0.2), V(0.35, 0.7, s * 0.35), 0.05, 0.04, c), 11, V(0.15, 0.45, s * 0.2));
            B(limb(V(0.35, 0.7, s * 0.35), V(0.65, 0.3, s * 0.25), 0.04, 0.01, 0x8a9aa8), 11, V(0.15, 0.45, s * 0.2));
        }
        B(box(0.4, 0.04, 0.16, -0.05, 0.62, 0, gl, 0.6));
        insectLegs(L, 2, 0.0, -0.35, 0.38, 0.15, 0.5, 0.0, 0.045, 0x15171c);
        break;
    }
    case 'spitter': {
        B(sph(0.25, 0.1, 0.38, 0, c, 0, 1.1, 0.8, 1, 10));
        B(sph(0.34, -0.35, 0.48, 0, 0x6a8a1a, 0.55, 1.2, 1.0, 1.05, 12), 10, V(-0.1, 0.4, 0));
        B(cyl(0.07, 0.11, 0.3, 8, 0.4, 0.42, 0, 0x2a3a10, 0, 0, Math.PI / 2 - 0.3));
        B(sph(0.06, 0.56, 0.48, 0, gl, 2.5));
        B(sph(0.04, 0.25, 0.55, 0.12, gl, 2)); B(sph(0.04, 0.25, 0.55, -0.12, gl, 2));
        insectLegs(L, 3, 0.25, -0.15, 0.33, 0.18, 0.4, 0.0, 0.035, 0x232e10);
        break;
    }
    case 'bloater': {
        B(sph(0.55, -0.05, 0.62, 0, 0x7a8a2a, 0.35, 1.05, 0.95, 1, 14), 10, V(0, 0.6, 0));
        for (let i = 0; i < 6; i++) { const a = i * 1.05; B(sph(0.12, Math.cos(a) * 0.4, 0.75 + Math.sin(i * 2) * 0.2, Math.sin(a) * 0.4, gl, 1.4, 1, 1, 1, 6), 10, V(0, 0.6, 0)); }
        B(sph(0.18, 0.5, 0.42, 0, c, 0, 1, 0.8, 1, 8));
        B(sph(0.04, 0.64, 0.48, 0.07, 0xff3a2a, 2)); B(sph(0.04, 0.64, 0.48, -0.07, 0xff3a2a, 2));
        insectLegs(L, 3, 0.25, -0.25, 0.3, 0.3, 0.3, 0.0, 0.04, 0x3a4010);
        break;
    }
    case 'burrower': {
        for (let i = 0; i < 4; i++) B(sph(0.26 - i * 0.03, 0.2 - i * 0.3, 0.3, 0, i % 2 ? 0x5a4030 : c, 0, 1.1, 0.75, 1, 10), i > 1 ? 10 : 0, V(-0.2, 0.3, 0));
        B(cyl(0.02, 0.22, 0.35, 8, 0.55, 0.3, 0, 0x8a6a4a, 0, 0, -Math.PI / 2));
        B(sph(0.04, 0.36, 0.42, 0.12, gl, 2.5)); B(sph(0.04, 0.36, 0.42, -0.12, gl, 2.5));
        insectLegs(L, 3, 0.2, -0.5, 0.25, 0.18, 0.28, 0.0, 0.035, 0x2a1a10);
        break;
    }
    case 'brute': {
        B(sph(0.6, -0.15, 0.62, 0, c, 0, 1.25, 0.75, 1, 14));
        B(sph(0.55, 0.45, 0.65, 0, 0x3a3038, 0, 0.55, 1.05, 1.15, 12)); // front shield plate
        B(limb(V(0.6, 0.85, 0), V(1.15, 1.25, 0), 0.14, 0.02, 0x4a4048)); // horn
        B(limb(V(0.55, 0.7, 0.3), V(0.95, 0.95, 0.5), 0.08, 0.01, 0x4a4048)); B(limb(V(0.55, 0.7, -0.3), V(0.95, 0.95, -0.5), 0.08, 0.01, 0x4a4048));
        B(sph(0.06, 0.72, 0.62, 0.22, gl, 2.5)); B(sph(0.06, 0.72, 0.62, -0.22, gl, 2.5));
        for (let i = 0; i < 4; i++) B(box(0.2, 0.06, 0.6, -0.6 + i * 0.25, 1.06, 0, gl, 0.7));
        insectLegs(L, 3, 0.3, -0.55, 0.5, 0.4, 0.55, 0.0, 0.09, 0x1a161a);
        break;
    }
    case 'husk': {
        // An infested soldier.
        const ar = 0x4a5040;
        for (const s of [-1, 1]) {
            B(box(0.16, 0.42, 0.16, 0, 0.62, s * 0.12, 0x2a2e26), 12, V(0, 0.84, s * 0.12));
            B(box(0.15, 0.42, 0.15, 0, 0.22, s * 0.12, ar), 12, V(0, 0.84, s * 0.12));
        }
        B(box(0.3, 0.5, 0.42, 0, 1.08, 0, ar));
        B(sph(0.15, 0.04, 1.47, 0, 0x3a4032, 0, 1, 1, 1, 10));
        B(box(0.06, 0.05, 0.2, 0.15, 1.48, 0, gl, 2.4));
        for (let i = 0; i < 5; i++) B(limb(V(-0.15, 1.0 + i * 0.1, (i - 2) * 0.1), V(-0.45, 1.25 + i * 0.12, (i - 2) * 0.22), 0.05, 0.005, 0x6a2a3a, 0.3));
        B(sph(0.2, -0.1, 1.1, 0.18, 0x6a2a3a, 0.25, 1, 1.3, 0.7, 8));
        B(limb(V(0, 1.25, 0.24), V(0.4, 1.05, 0.08), 0.06, 0.05, ar), 11, V(0, 1.25, 0.24));
        B(limb(V(0, 1.25, -0.24), V(0.42, 1.08, -0.05), 0.06, 0.05, ar), 11, V(0, 1.25, -0.24));
        B(box(0.65, 0.1, 0.08, 0.55, 1.08, 0.02, 0x1a1c1e)); B(box(0.12, 0.04, 0.04, 0.85, 1.1, 0.02, 0xff5a2a, 1));
        break;
    }
    case 'wasp': {
        B(sph(0.16, 0.05, 1.0, 0, c, 0, 1.4, 0.8, 0.9, 10));
        B(sph(0.2, -0.35, 0.95, 0, 0xe0b020, 0.15, 1.6, 0.75, 0.75, 10), 10, V(-0.1, 1.0, 0));
        B(box(0.06, 0.2, 0.3, -0.3, 0.95, 0, 0x1a1a10), 10, V(-0.1, 1.0, 0)); B(box(0.06, 0.2, 0.3, -0.45, 0.95, 0, 0x1a1a10), 10, V(-0.1, 1.0, 0));
        B(limb(V(-0.65, 0.95, 0), V(-0.85, 0.85, 0), 0.04, 0.005, 0x1a1a10), 10, V(-0.1, 1.0, 0));
        B(sph(0.11, 0.28, 1.0, 0, c, 0, 1, 0.9, 1, 8));
        B(sph(0.05, 0.36, 1.04, 0.07, gl, 2.6)); B(sph(0.05, 0.36, 1.04, -0.07, gl, 2.6));
        for (const s of [-1, 1]) {
            const wg = new THREE.PlaneGeometry(0.5, 0.2);
            wg.rotateX(-Math.PI / 2); wg.translate(0.0, 1.12, s * 0.3);
            B(paint(wg, 0xc0e0ff, 0.25), 9, V(0.0, 1.12, s * 0.06));
            const wg2 = new THREE.PlaneGeometry(0.38, 0.16);
            wg2.rotateX(-Math.PI / 2); wg2.translate(-0.15, 1.1, s * 0.24);
            B(paint(wg2, 0xc0e0ff, 0.25), 9, V(-0.15, 1.1, s * 0.06));
        }
        insectLegs(L, 3, 0.1, -0.1, 0.92, 0.08, 0.2, 0.7, 0.015, 0x1a1a10);
        break;
    }
    case 'stalker': {
        B(sph(0.18, 0, 0.95, 0, c, 0, 1.6, 0.6, 0.8, 10));
        B(sph(0.15, 0.36, 1.12, 0, c, 0, 1.4, 0.7, 0.8, 10), 13, V(0.2, 1.05, 0));
        B(sph(0.04, 0.5, 1.15, 0.07, gl, 2.8), 13, V(0.2, 1.05, 0)); B(sph(0.04, 0.5, 1.15, -0.07, gl, 2.8), 13, V(0.2, 1.05, 0));
        B(sph(0.16, -0.38, 0.85, 0, c, 0, 1.5, 0.6, 0.7, 8), 10, V(-0.15, 0.9, 0));
        for (const s of [-1, 1]) {
            B(limb(V(0.15, 1.0, s * 0.12), V(0.4, 1.35, s * 0.25), 0.04, 0.03, c), 11, V(0.15, 1.0, s * 0.12));
            B(limb(V(0.4, 1.35, s * 0.25), V(0.85, 0.75, s * 0.2), 0.035, 0.005, 0xb46aff, 0.6), 11, V(0.15, 1.0, s * 0.12));
        }
        insectLegs(L, 2, 0.05, -0.25, 0.9, 0.1, 0.65, 0.0, 0.03, 0x14161c);
        break;
    }
    case 'sac': {
        B(sph(0.75, 0, 0.45, 0, c, 0.2, 1, 0.7, 1, 14), 10, V(0, 0.3, 0));
        for (let i = 0; i < 7; i++) { const a = i * 0.9; B(sph(0.16, Math.cos(a) * 0.55, 0.65 + (i % 3) * 0.08, Math.sin(a) * 0.55, gl, 1.6, 1, 1, 1, 6), 10, V(0, 0.3, 0)); }
        for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.4; B(limb(V(Math.cos(a) * 0.5, 0.15, Math.sin(a) * 0.5), V(Math.cos(a) * 1.25, 0.02, Math.sin(a) * 1.25), 0.09, 0.02, 0x4a1a34)); }
        break;
    }
    case 'clone': {
        for (const s of [-1, 1]) B(limb(V(0, 0.8, s * 0.15), V(0.05, 0, s * 0.2), 0.08, 0.05, c), 12, V(0, 0.8, s * 0.15));
        B(sph(0.28, 0, 1.05, 0, c, 0, 0.8, 1.3, 1, 10));
        B(sph(0.18, 0.08, 1.55, 0, c, 0, 1, 1.1, 0.9, 10));
        B(box(0.06, 0.04, 0.22, 0.24, 1.58, 0, d.glow, 2.6));
        for (const s of [-1, 1]) B(limb(V(0, 1.3, s * 0.3), V(0.6, 0.7, s * 0.45), 0.07, 0.02, c), 11, V(0, 1.3, s * 0.3));
        for (let i = 0; i < 4; i++) B(limb(V(-0.15, 1.2, (i - 1.5) * 0.12), V(-0.7, 1.7 + (i % 2) * 0.2, (i - 1.5) * 0.4), 0.05, 0.01, d.glow, 0.5), 10, V(-0.15, 1.2, 0));
        break;
    }
    default: B(sph(0.4, 0, 0.4, 0, c));
    }
    return merge(L);
}

const BUG_VERT = /* glsl */`
    attribute float aBone; attribute vec3 aPivot; attribute vec4 iAnim;
    varying float vFlash; varying float vCloak;
    vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
    vec3 rotZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z); }
    vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }
`;
const BUG_BEGIN = /* glsl */`
    {
        float ph = iAnim.x, mv = iAnim.y, sp = iAnim.w;
        vFlash = iAnim.z; vCloak = 0.0;
        float side = aPivot.z >= 0.0 ? 1.0 : -1.0;
        vec3 p = transformed - aPivot;
        if (aBone > 0.5 && aBone < 6.5) {
            float idx = aBone - 1.0;
            float gait = mod(floor(idx * 0.5) + mod(idx, 2.0), 2.0) * 3.14159;
            float a = sin(ph * 9.0 + gait) * 0.42 * mv;
            float lift = max(0.0, cos(ph * 9.0 + gait)) * 0.1 * mv;
            p = rotY(p, a * side);
            transformed = aPivot + p + vec3(0.0, lift, 0.0);
        } else if (aBone > 6.5 && aBone < 8.5) {
            float open = (sin(ph * 7.0) * 0.5 + 0.5) * 0.4 + sp * 0.4;
            transformed = aPivot + rotY(p, (aBone < 7.5 ? -1.0 : 1.0) * open);
        } else if (aBone > 8.5 && aBone < 9.5) {
            float a = sin(uTime * 55.0 + ph * 3.0) * 0.7;
            transformed = aPivot + rotX(p, a * side);
        } else if (aBone > 9.5 && aBone < 10.5) {
            float a = sin(ph * 3.5) * 0.12 * (0.4 + mv);
            p = rotY(p, a);
            p *= 1.0 + sp * 0.35 + sin(uTime * 4.0 + ph) * 0.03;
            transformed = aPivot + p;
        } else if (aBone > 10.5 && aBone < 11.5) {
            float a = sin(ph * 6.0 + side * 1.5) * 0.35 * mv + sp * 0.9;
            transformed = aPivot + rotZ(p, a);
        } else if (aBone > 11.5 && aBone < 12.5) {
            float a = sin(ph * 6.0 + (side > 0.0 ? 0.0 : 3.14159)) * 0.55 * mv;
            transformed = aPivot + rotZ(p, a);
        } else if (aBone > 12.5) {
            transformed = aPivot + rotY(p, sin(ph * 1.3) * 0.2);
        }
        if (aBone < 0.5) transformed.y += sin(ph * 18.0) * 0.012 * mv;
    }
`;

export class Brood {
    constructor(scene) {
        this.meshes = {};
        this.cloaked = null;
        this.scene = scene;
        const caps = { skitter: 420, drone: 90, spitter: 70, bloater: 50, burrower: 50, brute: 30, husk: 70, wasp: 70, stalker: 50, sac: 16, clone: 6 };
        for (const type of [...ENEMY_ORDER, 'clone']) {
            const geo = bugGeometry(type);
            const cap = Math.max(4, Math.round(caps[type] * (Q.cap / 260)));
            const anim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
            anim.setUsage(THREE.DynamicDrawUsage);
            geo.setAttribute('iAnim', anim);
            const stalker = type === 'stalker';
            const mat = makeLitMaterial('bug' + (stalker ? 'C' : ''), {
                roughness: 0.32, metalness: 0.25, transparent: stalker,
                vertexPars: BUG_VERT,
                vertexBegin: BUG_BEGIN + (stalker ? 'vCloak = iAnim.w;' : ''),
                fragmentPars: 'varying float vFlash; varying float vCloak;',
                emissiveFragment: `
                    totalEmissiveRadiance += vec3(1.0, 0.95, 0.85) * vFlash * 1.1;
                    float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
                    totalEmissiveRadiance += vec3(0.35, 0.42, 0.5) * rim * 0.9;
                    ${stalker ? 'float fr = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5); diffuseColor.a = mix(1.0, 0.06 + fr * 0.55, vCloak); totalEmissiveRadiance += vec3(0.6, 0.4, 1.0) * fr * vCloak * 0.8;' : ''}
                `,
            });
            const mesh = new THREE.InstancedMesh(geo, mat, cap);
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.castShadow = Q.shadows && type !== 'skitter';
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.userData = { anim, cap, type };
            scene.add(mesh);
            this.meshes[type] = mesh;
        }
        // Dirt mounds for burrowers under the deck.
        const moundGeo = merge([sph(0.45, 0, 0.0, 0, 0x2a2018, 0, 1.2, 0.35, 1, 8), sph(0.15, 0.3, 0.1, 0.2, 0x3a2a20, 0, 1, 0.6, 1, 6), sph(0.12, -0.25, 0.08, -0.25, 0x3a2a20, 0, 1, 0.6, 1, 6)]);
        this.mound = new THREE.InstancedMesh(moundGeo, makeLitMaterial('mound', { roughness: 0.9, metalness: 0 }), 50);
        this.mound.count = 0;
        this.mound.frustumCulled = false;
        scene.add(this.mound);
        this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.p = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0);
    }

    update(w, alpha, t) {
        const counts = {};
        for (const k in this.meshes) counts[k] = 0;
        let mounds = 0;
        const { m, q, s, p, up } = this;
        const pl = w.player;
        for (const e of w.enemies) {
            if (e.boss || e.dead) continue;
            const x = e.ox + (e.x - e.ox) * alpha, y = e.oy + (e.y - e.oy) * alpha;
            if (e.under) {
                if (mounds < 50) {
                    q.setFromAxisAngle(up, e.anim * 2);
                    m.compose(p.set(x, 0.02 + Math.sin(t * 20 + e.seed * 9) * 0.03, y), q, s.set(e.r * 2, e.r * 2, e.r * 2));
                    this.mound.setMatrixAt(mounds++, m);
                }
                continue;
            }
            const mesh = this.meshes[e.type];
            if (!mesh) continue;
            const i = counts[e.type];
            if (i >= mesh.userData.cap) continue;
            counts[e.type]++;
            const def = ENEMIES[e.type];
            const scale = e.r / def.r * (e.alpha ? 1 : 1);
            let yy = 0, sc = scale;
            if (e.spawnT > 0) {
                const f = Math.max(0, Math.min(1, 1 - e.spawnT / 0.75));
                yy = -0.9 * (1 - f) * scale;
                sc = scale * (0.4 + 0.6 * f);
            }
            if (e.type === 'wasp') yy += Math.sin(t * 3 + e.seed * 10) * 0.12;
            q.setFromAxisAngle(up, -e.face);
            m.compose(p.set(x, yy, y), q, s.set(sc, sc, sc));
            mesh.setMatrixAt(i, m);
            const a = mesh.userData.anim.array;
            const mv = Math.min(1, Math.hypot(e.vx, e.vy) / Math.max(1, e.speed * 0.6)) + (e.state === 'lunge' || e.state === 'charge' ? 0.6 : 0);
            let special = 0;
            if (e.type === 'bloater') special = e.state === 'swell' ? 1 - Math.max(0, e.t) / 0.55 : 0;
            else if (e.type === 'sac') special = Math.max(0, Math.sin(t * 3 + e.seed * 6)) * 0.4 + (e.cd < 0.5 ? 0.5 : 0);
            else if (e.type === 'stalker') {
                const d = Math.hypot(pl.x - e.x, pl.y - e.y);
                special = e.cloak > 0 || d < 4 || e.state === 'slash' ? 0 : Math.min(1, (d - 4) / 1.5);
            } else if (e.state === 'windup' || e.state === 'aim' || e.state === 'spit' || e.state === 'slash') special = 1;
            a[i * 4] = e.anim + e.seed * 7;
            a[i * 4 + 1] = Math.min(1.4, mv);
            a[i * 4 + 2] = e.flash;
            a[i * 4 + 3] = special;
        }
        for (const k in this.meshes) {
            const mesh = this.meshes[k];
            mesh.count = counts[k];
            if (counts[k]) {
                mesh.instanceMatrix.needsUpdate = true;
                mesh.userData.anim.needsUpdate = true;
            }
        }
        this.mound.count = mounds;
        if (mounds) this.mound.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        for (const k in this.meshes) { this.scene.remove(this.meshes[k]); this.meshes[k].geometry.dispose(); }
        this.scene.remove(this.mound);
    }
}

// ------------------------------------------------------------------ Bosses

function bossMaterial() {
    return makeLitMaterial('boss', { roughness: 0.3, metalness: 0.3, uniforms: { uFlash: { value: 0 } }, fragmentPars: 'uniform float uFlash;', emissiveFragment: 'totalEmissiveRadiance += vec3(1.0, 0.85, 0.75) * uFlash * 0.3;' });
}

function legGroup(mat, a, b, c, r, color) {
    const g = new THREE.Group();
    g.position.copy(a);
    const m = new THREE.Mesh(merge([limb(V(0, 0, 0), b.clone().sub(a), r, r * 0.8, color), limb(b.clone().sub(a), c.clone().sub(a), r * 0.8, r * 0.3, color), sph(r * 1.1, b.x - a.x, b.y - a.y, b.z - a.z, color, 0, 1, 1, 1, 6)]), mat);
    m.castShadow = true;
    g.add(m);
    return g;
}

export function makeBoss(type) {
    const def = BOSSES[type];
    const mat = bossMaterial();
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const ud = { type, mat, body, legs: [], parts: {} };
    const add = (geo, parent = body) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; parent.add(m); return m; };
    const c = def.color, gl = def.glow;
    switch (type) {
    case 'ravager': {
        add(merge([
            sph(1.3, -0.3, 1.2, 0, c, 0, 1.5, 0.75, 1.05, 16),
            sph(0.9, 1.1, 1.15, 0, 0x2a1e18, 0, 0.9, 0.8, 1.05, 14),
            limb(V(1.5, 1.5, 0), V(2.8, 2.6, 0), 0.32, 0.03, 0x4a3a30),
            limb(V(1.6, 1.0, 0.5), V(2.6, 0.9, 0.9), 0.14, 0.02, 0x4a3a30), limb(V(1.6, 1.0, -0.5), V(2.6, 0.9, -0.9), 0.14, 0.02, 0x4a3a30),
            sph(0.12, 1.75, 1.3, 0.42, gl, 3), sph(0.12, 1.75, 1.3, -0.42, gl, 3),
            ...[-1.2, -0.6, 0, 0.6].map((x) => box(0.3, 0.12, 1.2, x, 2.08, 0, gl, 1.4)),
            ...[0, 1, 2, 3, 4].map((i) => limb(V(-0.8 + i * 0.4, 1.9, 0), V(-1.0 + i * 0.4, 2.5, 0), 0.12, 0.02, 0x2a1e18)),
        ]));
        for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
            const hip = V(0.8 - i * 0.9, 0.9, s * 0.9);
            const lg = legGroup(mat, hip, V(hip.x + 0.3, 1.8, s * 2.0), V(hip.x + 0.4, 0, s * 2.6), 0.16, 0x2a1e18);
            body.add(lg); ud.legs.push({ g: lg, i, s });
        }
        break;
    }
    case 'goliath': {
        const hull = add(merge([
            box(2.4, 1.4, 2.2, 0, 2.6, 0, c), box(0.9, 0.6, 1.4, 1.2, 2.9, 0, 0x30363c),
            box(0.2, 0.3, 1.0, 1.66, 2.95, 0, 0xff3a2a, 2.5),
            box(1.0, 0.8, 0.8, -0.2, 3.6, 1.0, 0x3a4048), box(1.0, 0.8, 0.8, -0.2, 3.6, -1.0, 0x3a4048),
            ...[0, 1, 2].map((i) => cyl(0.1, 0.1, 0.1, 8, 0.32, 3.75 - i * 0.2, 1.0, 0xffa83a, 1.5, 0, Math.PI / 2)),
            ...[0, 1, 2].map((i) => cyl(0.1, 0.1, 0.1, 8, 0.32, 3.75 - i * 0.2, -1.0, 0xffa83a, 1.5, 0, Math.PI / 2)),
        ]));
        // Exposed bug flesh, revealed when the armour breaks.
        const flesh = add(merge([sph(1.0, -0.2, 2.7, 0, 0x6a2a3a, 0.5, 1.3, 0.8, 1.1, 14), ...[0, 1, 2, 3].map((i) => sph(0.15, -0.6 + i * 0.4, 3.3, (i % 2 - 0.5) * 0.8, gl, 2, 1, 1, 1, 6))]));
        flesh.visible = false;
        const plates = add(merge([box(2.6, 0.3, 2.4, 0, 3.4, 0, 0x5a6068), box(0.3, 1.2, 2.4, -1.3, 2.6, 0, 0x5a6068), box(2.0, 0.9, 0.2, 0, 2.6, 1.2, 0x5a6068), box(2.0, 0.9, 0.2, 0, 2.6, -1.2, 0x5a6068)]));
        ud.parts.flesh = flesh; ud.parts.plates = plates; ud.parts.hull = hull;
        for (const s of [-1, 1]) {
            const arm = new THREE.Group();
            arm.position.set(0.3, 2.6, s * 1.5);
            add(merge([box(0.6, 0.6, 0.5, 0, 0, 0, 0x3a4048), ...[0, 1, 2, 3, 4, 5].map((k) => cyl(0.06, 0.06, 1.4, 6, 0.9, Math.cos(k) * 0.16, Math.sin(k) * 0.16, 0x1a1c1e, 0, 0, Math.PI / 2)), cyl(0.24, 0.24, 0.1, 10, 1.55, 0, 0, gl, 1, 0, Math.PI / 2)]), arm);
            body.add(arm);
            ud.parts['arm' + s] = arm;
        }
        for (const s of [-1, 1]) {
            const hip = V(-0.2, 2.0, s * 0.9);
            const lg = legGroup(mat, hip, V(0.6, 1.1, s * 1.2), V(-0.1, 0, s * 1.3), 0.28, 0x3a4048);
            body.add(lg); ud.legs.push({ g: lg, i: s > 0 ? 0 : 1, s, walker: true });
        }
        break;
    }
    case 'zero': {
        add(merge([
            limb(V(0, 1.1, 0.25), V(0.1, 0, 0.35), 0.13, 0.08, c), limb(V(0, 1.1, -0.25), V(0.1, 0, -0.35), 0.13, 0.08, c),
            sph(0.45, 0, 1.6, 0, c, 0, 0.8, 1.3, 1.0, 14), sph(0.3, 0.12, 2.35, 0, c, 0, 1, 1.15, 0.9, 12),
            box(0.08, 0.05, 0.36, 0.4, 2.38, 0, gl, 3),
            ...[0, 1, 2, 3, 4].map((i) => limb(V(0.2, 1.4 + i * 0.15, 0.2 * Math.sin(i * 2)), V(0.4, 1.5 + i * 0.15, 0.3 * Math.sin(i * 2)), 0.05, 0.03, gl, 0.8)),
        ]));
        const arms = [];
        for (const s of [-1, 1]) {
            const arm = new THREE.Group();
            arm.position.set(0, 2.0, s * 0.45);
            add(merge([limb(V(0, 0, 0), V(0.5, -0.6, s * 0.3), 0.11, 0.08, c), limb(V(0.5, -0.6, s * 0.3), V(1.3, -1.1, s * 0.2), 0.08, 0.02, 0xe0f0e8)]), arm);
            body.add(arm);
            arms.push(arm);
        }
        const tent = [];
        for (let i = 0; i < 6; i++) {
            const tg = new THREE.Group();
            tg.position.set(-0.3, 1.9, (i - 2.5) * 0.18);
            add(merge([limb(V(0, 0, 0), V(-0.8, 0.7, (i - 2.5) * 0.3), 0.08, 0.04, c), limb(V(-0.8, 0.7, (i - 2.5) * 0.3), V(-1.6, 1.4 + (i % 2) * 0.4, (i - 2.5) * 0.6), 0.04, 0.01, gl, 0.7)]), tg);
            body.add(tg);
            tent.push(tg);
        }
        ud.parts.arms = arms; ud.parts.tent = tent;
        break;
    }
    case 'widow': {
        add(merge([
            sph(1.3, -1.3, 1.5, 0, c, 0, 1.2, 1.0, 1.1, 16),
            ...[0, 1, 2, 3, 4, 5, 6].map((i) => box(0.12, 0.05, 1.6 - Math.abs(i - 3) * 0.3, -2.2 + i * 0.3, 2.3 + Math.cos((i - 3) * 0.5) * 0.2, 0, gl, 2)),
            sph(0.7, 0.3, 1.3, 0, 0x2a1414, 0, 1.2, 0.8, 1, 14),
            sph(0.45, 1.1, 1.25, 0, 0x2a1414, 0, 1, 0.9, 1, 12),
            ...[[0.25, 0.15], [0.25, -0.15], [0.3, 0.3], [0.3, -0.3]].map(([z, y]) => sph(0.07, 1.48, 1.4 + y * 0.4, z, gl, 3, 1, 1, 1, 6)),
            limb(V(1.4, 1.1, 0.15), V(1.8, 0.6, 0.12), 0.08, 0.01, 0x8a2a1a, 0.4), limb(V(1.4, 1.1, -0.15), V(1.8, 0.6, -0.12), 0.08, 0.01, 0x8a2a1a, 0.4),
        ]));
        for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
            const hip = V(0.6 - i * 0.35, 1.4, s * 0.5);
            const lg = legGroup(mat, hip, V(1.2 - i * 0.9, 2.8, s * 1.9), V(1.5 - i * 1.3, 0, s * 3.0), 0.11, 0x1a0e0e);
            body.add(lg); ud.legs.push({ g: lg, i, s });
        }
        break;
    }
    case 'mother': {
        add(merge([
            // Egg sac stretching back to the wall.
            sph(2.2, -3.2, 1.5, 0, 0x3a1a3a, 0.15, 1.8, 0.75, 1.1, 18),
            ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => sph(0.35, -2.2 - (i % 3) * 1.1, 2.4 + (i % 2) * 0.2, (Math.floor(i / 3) - 1) * 0.9, gl, 0.9, 1, 1, 1, 8)),
            sph(1.0, 0, 1.7, 0, c, 0, 1.2, 1.1, 1.0, 16),
            sph(0.75, 1.0, 2.5, 0, c, 0, 1.0, 1.1, 0.9, 14),
        ]));
        const head = new THREE.Group();
        head.position.set(1.4, 3.1, 0);
        add(merge([
            sph(0.6, 0.6, 0, 0, 0x1e1222, 0, 1.6, 0.55, 0.65, 14),
            ...[-0.6, -0.3, 0, 0.3, 0.6].map((z) => limb(V(-0.1, 0.2, z * 0.6), V(-1.6, 1.0 + Math.abs(z) * 0.6, z * 2.6), 0.18, 0.02, 0x1e1222)),
            limb(V(-0.2, 0.3, 0), V(-1.7, 1.9, 0), 0.25, 0.04, 0x1e1222),
            sph(0.1, 1.3, 0.05, 0.25, gl, 3), sph(0.1, 1.3, 0.05, -0.25, gl, 3), sph(0.08, 1.15, 0.12, 0.38, gl, 3), sph(0.08, 1.15, 0.12, -0.38, gl, 3),
            limb(V(1.5, -0.1, 0.15), V(2.0, -0.6, 0.2), 0.08, 0.01, 0x8a8a9a), limb(V(1.5, -0.1, -0.15), V(2.0, -0.6, -0.2), 0.08, 0.01, 0x8a8a9a),
        ]), head);
        body.add(head);
        const arms = [];
        for (let i = 0; i < 2; i++) for (const s of [-1, 1]) {
            const arm = new THREE.Group();
            arm.position.set(0.8 - i * 0.5, 2.3 - i * 0.5, s * 0.7);
            add(merge([limb(V(0, 0, 0), V(0.9, 0.4, s * 0.9), 0.16, 0.12, c), limb(V(0.9, 0.4, s * 0.9), V(2.0, -0.4, s * 1.1), 0.12, 0.02, 0x9a8aa8)]), arm);
            body.add(arm);
            arms.push({ g: arm, i, s });
        }
        for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
            const hip = V(0.4 - i * 0.6, 1.0, s * 0.8);
            const lg = legGroup(mat, hip, V(0.6 - i * 0.6, 1.6, s * 2.0), V(0.9 - i * 0.8, 0, s * 2.7), 0.17, 0x1e1222);
            body.add(lg); ud.legs.push({ g: lg, i, s });
        }
        ud.parts.head = head; ud.parts.arms = arms;
        break;
    }
    default: break;
    }
    root.userData = ud;
    return root;
}

export function animateBoss(g, b, ix, iy, t, dt) {
    const ud = g.userData;
    g.position.set(ix, 0, iy);
    g.rotation.y = -b.face;
    ud.mat.userData.u.uFlash.value = b.flash;
    const mv = Math.min(1, Math.hypot(b.vx, b.vy) / 3);
    const pat = b.pat ?? '';
    g.visible = !b.hidden;
    for (const L of ud.legs) {
        const ph = t * (L.walker ? 4 : 9) * (0.3 + mv) + L.i * 1.7 + (L.s > 0 ? 0 : Math.PI);
        if (L.walker) { L.g.rotation.z = Math.sin(ph) * 0.35 * mv; }
        else { L.g.rotation.y = Math.sin(ph) * 0.25 * (0.3 + mv) * L.s; L.g.rotation.x = Math.max(0, Math.cos(ph)) * 0.15 * L.s * (0.3 + mv); }
    }
    ud.body.position.y = Math.sin(t * 2) * 0.05;
    switch (ud.type) {
    case 'ravager':
        ud.body.rotation.z = pat === 'charge' && b.step === 1 ? -0.15 : pat === 'stomp' && b.step === 1 ? 0.18 : 0;
        break;
    case 'goliath':
        ud.parts.flesh.visible = b.phase >= 2;
        ud.parts.plates.visible = b.phase < 2;
        for (const s of [-1, 1]) { const arm = ud.parts['arm' + s]; arm.children[0].rotation.x += dt * (pat === 'sweep' && b.step === 2 ? 30 : 2); }
        break;
    case 'zero':
        ud.parts.tent.forEach((tg, i) => { tg.rotation.x = Math.sin(t * 2.5 + i) * 0.3; tg.rotation.z = Math.sin(t * 1.7 + i * 2) * 0.25; });
        ud.parts.arms.forEach((a, i) => { a.rotation.z = pat === 'lash' ? -0.8 : Math.sin(t * 2 + i * 3) * 0.2; });
        ud.body.rotation.z = pat === 'spiral' ? Math.sin(t * 20) * 0.03 : 0;
        if (pat === 'spiral') ud.body.rotation.y += dt * 8; else ud.body.rotation.y *= 0.9;
        break;
    case 'widow':
        ud.body.position.y = 0.1 + Math.sin(t * 3) * 0.06;
        break;
    case 'mother': {
        const h = ud.parts.head;
        h.rotation.z = (pat === 'fans' || pat === 'nova') ? -0.25 + Math.sin(t * 9) * 0.05 : Math.sin(t * 0.8) * 0.08;
        ud.parts.arms.forEach((a) => { a.g.rotation.y = Math.sin(t * 1.4 + a.i * 2 + a.s) * 0.35 * a.s; a.g.rotation.z = Math.sin(t * 1.1 + a.i) * 0.2; });
        break;
    }
    default: break;
    }
}

// ------------------------------------------------------------------ Pickups

const PICK_GLYPH = {
    health: ['✚', '#ff4a4a'], bighealth: ['✚', '#ff2a6a'], armor: ['⬢', '#4ad8ff'], ammo: ['▤', '#ffd23a'],
    grenade: ['●', '#ff9a3a'], pulse: ['◉', '#a98bff'], mod: ['⬆', '#6aff8a'], keycard: ['▭', '#ffffff'],
};

function glyphTexture(glyph, color) {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(48, 48, 2, 48, 48, 46);
    grd.addColorStop(0, color + 'cc'); grd.addColorStop(0.45, color + '44'); grd.addColorStop(1, color + '00');
    g.fillStyle = grd; g.fillRect(0, 0, 96, 96);
    g.strokeStyle = color; g.lineWidth = 3;
    g.beginPath(); g.arc(48, 48, 26, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ffffff';
    g.font = 'bold 34px system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(glyph, 48, 50);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export class Pickups {
    constructor(scene) {
        this.scene = scene;
        this.tex = {};
        this.pool = [];
        this.weaponNodes = new Map();
        const coinGeo = merge([cyl(0.13, 0.13, 0.04, 6, 0, 0, 0, 0xffc83a, 1.2, Math.PI / 2), cyl(0.07, 0.07, 0.05, 6, 0, 0, 0, 0xfff0a0, 2.2, Math.PI / 2)]);
        this.coins = new THREE.InstancedMesh(coinGeo, makeLitMaterial('coin', { roughness: 0.3, metalness: 0.8 }), 400);
        this.coins.count = 0;
        this.coins.frustumCulled = false;
        scene.add(this.coins);
        this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
    }
    sprite(kind, power) {
        const key = kind === 'power' ? 'p_' + power : kind;
        if (!this.tex[key]) {
            if (kind === 'power') { const c = '#' + new THREE.Color(POWERUPS[power].color).getHexString(); this.tex[key] = glyphTexture({ overdrive: '⚡', hyperfire: '»', aegis: '◈', drone: '✜', stim: '➶', cryo: '❄', nova: '✺' }[power] ?? '★', c); }
            else { const [gl, c] = PICK_GLYPH[kind] ?? ['?', '#ffffff']; this.tex[key] = glyphTexture(gl, c); }
        }
        let s = this.pool.pop();
        if (!s) { s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); this.scene.add(s); }
        s.material.map = this.tex[key];
        s.material.needsUpdate = true;
        s.visible = true;
        return s;
    }
    update(w, alpha, t) {
        const live = new Set();
        let coins = 0;
        const { m, q, e } = this;
        const s1 = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
        this.used ??= new Map();
        for (const pk of w.pickups) {
            const x = pk.ox + (pk.x - pk.ox) * alpha, y = pk.oy + (pk.y - pk.oy) * alpha;
            const blink = pk.kind === 'salvage' && pk.life < 3 && (t * 8 % 1) < 0.4;
            if (pk.kind === 'salvage') {
                if (coins >= 400 || blink) continue;
                e.set(0, t * 4 + pk.id, 0.3);
                q.setFromEuler(e);
                m.compose(pos.set(x, 0.3 + Math.sin(t * 5 + pk.id) * 0.06, y), q, s1);
                this.coins.setMatrixAt(coins++, m);
                continue;
            }
            live.add(pk.id);
            if (pk.kind === 'weapon') {
                let node = this.weaponNodes.get(pk.id);
                if (!node) {
                    node = new THREE.Group();
                    const wm = weaponModel(pk.weapon);
                    wm.scale.setScalar(1.5);
                    node.add(wm);
                    const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.6, 24), new THREE.MeshBasicMaterial({ color: WEAPONS[pk.weapon].color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
                    ring.rotation.x = -Math.PI / 2;
                    ring.position.y = 0.03;
                    node.add(ring);
                    this.scene.add(node);
                    this.weaponNodes.set(pk.id, node);
                }
                node.position.set(x, 0.55 + Math.sin(t * 2.5) * 0.08, y);
                node.children[0].rotation.y = t * 1.5;
                node.children[1].position.y = -0.52;
                continue;
            }
            let sp = this.used.get(pk.id);
            if (!sp) { sp = this.sprite(pk.kind, pk.power); this.used.set(pk.id, sp); }
            const big = pk.kind === 'power' || pk.kind === 'mod' || pk.kind === 'bighealth';
            const sc = (big ? 0.95 : 0.7) * (1 + Math.sin(t * 6 + pk.id) * 0.06);
            sp.scale.set(sc, sc, 1);
            sp.position.set(x, 0.55 + Math.sin(t * 3 + pk.id) * 0.1, y);
        }
        for (const [id, sp] of this.used) if (!live.has(id)) { sp.visible = false; this.pool.push(sp); this.used.delete(id); }
        for (const [id, node] of this.weaponNodes) if (!live.has(id)) { this.scene.remove(node); this.weaponNodes.delete(id); }
        this.coins.count = coins;
        this.coins.instanceMatrix.needsUpdate = true;
    }
    dispose() {
        for (const [, sp] of this.used ?? []) this.scene.remove(sp);
        for (const sp of this.pool) this.scene.remove(sp);
        for (const [, n] of this.weaponNodes) this.scene.remove(n);
        this.scene.remove(this.coins);
    }
}

// ------------------------------------------------------------------ Drones & grenades

export function makeDrone() {
    const mat = makeLitMaterial('drone', { roughness: 0.3, metalness: 0.7 });
    const g = new THREE.Group();
    const m = new THREE.Mesh(merge([sph(0.16, 0, 0, 0, 0x3a4048, 0, 1, 0.7, 1, 10), cyl(0.26, 0.26, 0.03, 16, 0, 0, 0, 0x8aff6a, 1.6), box(0.25, 0.05, 0.05, 0.18, -0.02, 0, 0x1a1c1e), sph(0.05, 0.14, 0.04, 0, 0x8aff6a, 3)]), mat);
    g.add(m);
    return g;
}

export function makeGrenadeMesh() {
    const mat = makeLitMaterial('gren', { roughness: 0.4, metalness: 0.6 });
    return new THREE.Mesh(merge([sph(0.11, 0, 0, 0, 0x3a4a2a, 0, 1, 1, 1, 8), cyl(0.04, 0.04, 0.08, 6, 0, 0.1, 0, 0x1a1a1a), sph(0.03, 0.06, 0.06, 0.06, 0xff2a1a, 3)]), mat);
}

export { patchLit };
