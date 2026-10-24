// The four friends (seen from behind, like you are following them in) and Winnie the ghost.
// All procedural: capsules and spheres with a flat, toy-like look.

import * as THREE from 'three';
import { M, box, cyl, sph, cone, torus, mesh, group, add, glowMat, glowSprite, blob } from './kit.js';

export const FRIENDS = {
    maya: { name: 'Maya', color: '#2fb5a8', skin: 0x8a5a3c },
    theo: { name: 'Theo', color: '#f08a3a', skin: 0xf0c8a0 },
    june: { name: 'June', color: '#a06be0', skin: 0xd9a47a },
    dev: { name: 'Dev', color: '#e0453d', skin: 0xb77a50 },
};

function kid({ coat, pants, skin, hair, h = 1.5 }) {
    const g = group(), body = group();
    const cm = M(coat, { rough: 0.9 }), pm = M(pants, { rough: 0.9 }), sm = M(skin, { rough: 0.8 });
    for (const s of [-1, 1]) {
        add(body, cyl(0.11, 0.1, 0.62 * h / 1.5, pm, s * 0.14, 0.34, 0, 8));
        add(body, box(0.2, 0.1, 0.3, M(0x2a2420), s * 0.14, 0.05, 0.05));
    }
    add(body, cyl(0.27, 0.3, 0.62, cm, 0, 0.92, 0, 12));
    add(body, sph(0.27, cm, 0, 1.2, 0, 12, 8)).scale.set(1, 0.5, 0.9);
    const arms = [];
    for (const s of [-1, 1]) {
        const a = group(cyl(0.075, 0.07, 0.55, cm, 0, -0.27, 0, 6), sph(0.08, sm, 0, -0.58, 0, 8, 6));
        a.position.set(s * 0.34, 1.18, 0); a.rotation.z = s * 0.12; add(body, a); arms.push(a);
    }
    const head = group(sph(0.27, sm, 0, 0, 0, 14, 10));
    head.position.y = 1.56;
    add(body, head);
    add(g, body, blob(0.9, 0.9, 0, 0));
    g.userData = { body, head, arms, hairMat: M(hair, { rough: 1 }) };
    return g;
}

export function makeTeens() {
    const root = group(), m = {};
    // Maya: teal jacket, ponytail, a notebook
    const maya = kid({ coat: 0x2fb5a8, pants: 0x2b3a55, skin: FRIENDS.maya.skin, hair: 0x1c1410 });
    add(maya.userData.head, sph(0.29, maya.userData.hairMat, 0, 0.04, -0.03, 12, 8), sph(0.13, maya.userData.hairMat, 0, 0.0, -0.32, 8, 6), cone(0.09, 0.4, maya.userData.hairMat, 0, -0.28, -0.4, 6));
    add(maya.userData.arms[0], box(0.22, 0.3, 0.05, M(0xfff2cc), 0.1, -0.5, 0.18));
    // Theo: orange hoodie, curly hair, a flashlight
    const theo = kid({ coat: 0xf08a3a, pants: 0x4a5a7a, skin: FRIENDS.theo.skin, hair: 0x5a3a22, h: 1.45 });
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(theo.userData.head, sph(0.13, theo.userData.hairMat, Math.cos(a) * 0.2, 0.18 + (i % 2) * 0.05, Math.sin(a) * 0.2 - 0.03, 6, 5)); }
    add(theo.userData.head, sph(0.2, theo.userData.hairMat, 0, 0.15, -0.04, 8, 6));
    add(theo.userData.body, cone(0.25, 0.3, M(0xd9742a), 0, 1.4, -0.28, 8)).rotation.x = -0.4;
    const fl = group(cyl(0.05, 0.06, 0.34, M(0x333333, { metal: 0.5 }), 0, 0, 0, 8), cyl(0.09, 0.06, 0.1, M(0xcccccc, { metal: 0.6 }), 0, 0.2, 0, 8));
    fl.rotation.x = -Math.PI / 2; fl.position.set(0, -0.58, 0.18);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    // the cone's apex is at +y: flip it so the narrow end sits at the lamp and the wide end lights the room
    beam.position.set(0, 1.8, 0); beam.rotation.x = Math.PI; fl.add(beam);
    add(theo.userData.arms[1], fl);
    theo.userData.beam = beam;
    // June: purple dress, magenta bob, a beret
    const june = kid({ coat: 0xa06be0, pants: 0xa06be0, skin: FRIENDS.june.skin, hair: 0xd23a8e });
    add(june.userData.head, sph(0.3, june.userData.hairMat, 0, 0.0, -0.04, 12, 8), sph(0.27, june.userData.hairMat, 0, -0.14, -0.08, 8, 6));
    add(june.userData.head, cyl(0.26, 0.26, 0.06, M(0x2a2a8a), 0.04, 0.27, 0, 14));
    add(june.userData.body, cone(0.42, 0.55, M(0x8a50c8), 0, 0.62, 0, 14));
    for (const [x, y, c] of [[-0.1, 1.0, 0xffd43a], [0.12, 0.9, 0x3ad0ff], [0.0, 0.7, 0xff6b8b]]) add(june.userData.body, sph(0.05, M(c), x, y, -0.3, 6, 5));
    // Dev: red hoodie, messy blond hair, a backpack
    const dev = kid({ coat: 0xe0453d, pants: 0x3a3a44, skin: FRIENDS.dev.skin, hair: 0xe3b84a, h: 1.55 });
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; add(dev.userData.head, cone(0.1, 0.24, dev.userData.hairMat, Math.cos(a) * 0.17, 0.3, Math.sin(a) * 0.17, 5)).rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
    add(dev.userData.head, sph(0.27, dev.userData.hairMat, 0, 0.1, -0.02, 10, 6)).scale.set(1, 0.7, 1);
    add(dev.userData.body, box(0.46, 0.6, 0.26, M(0x2a7ab0), 0, 1.0, -0.3), box(0.34, 0.24, 0.06, M(0x1f5f8f), 0, 0.9, -0.45));
    const order = [['maya', maya], ['theo', theo], ['june', june], ['dev', dev]];
    order.forEach(([k, kidG], i) => { kidG.position.set(-2.1 + i * 1.4, 0, 3.2 + (i % 2) * 0.15); kidG.scale.setScalar(1.05); add(root, kidG); m[k] = kidG; });
    return { group: root, members: m };
}

/** One friend's idle: a slow sway, and a hop for whoever is speaking. */
export function animateTeens(t, teens, speaker, dt) {
    Object.entries(teens.members).forEach(([k, g], i) => {
        const u = g.userData;
        const talk = speaker === k;
        u.hop = THREE.MathUtils.lerp(u.hop || 0, talk ? 1 : 0, Math.min(1, dt * 8));
        u.body.position.y = Math.abs(Math.sin(t * 7 + i)) * 0.07 * u.hop;
        u.body.rotation.z = Math.sin(t * 1.3 + i * 1.7) * 0.025;
        u.head.rotation.y = Math.sin(t * 0.8 + i * 2.1) * 0.35 * (1 - u.hop * 0.6);
        u.head.rotation.x = Math.sin(t * 1.1 + i) * 0.05;
        u.arms[0].rotation.x = Math.sin(t * 1.4 + i) * 0.06 - u.hop * 0.3;
        u.arms[1].rotation.x = Math.sin(t * 1.4 + i + 1) * 0.06 - u.hop * 0.3;
    });
}

/** Winnie: a small ghost in a bedsheet, with a wavy hem, big dark eyes and pink cheeks. */
export function makeGhost({ scale = 1, opacity = 0.9 } = {}) {
    const g = group();
    const pts = [];
    const prof = [[0.58, 0], [0.62, 0.05], [0.56, 0.25], [0.5, 0.55], [0.42, 0.85], [0.36, 1.05], [0.33, 1.2], [0.36, 1.38], [0.34, 1.55], [0.26, 1.7], [0.1, 1.78], [0.0, 1.8]];
    for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(pts, 28);
    const bodyM = new THREE.MeshStandardMaterial({ color: 0xf4f7ff, emissive: 0x9fb4ff, emissiveIntensity: 0.55, roughness: 0.9, transparent: true, opacity });
    const body = new THREE.Mesh(geo, bodyM);
    const pos = geo.attributes.position, base = Float32Array.from(pos.array), P = pts.length, seg = 28;
    g.userData.hem = (t) => {
        for (let i = 0; i <= seg; i++) {
            const a = (i / seg) * Math.PI * 2;
            const w = Math.sin(a * 4 + t * 3.0) * 0.07 + Math.sin(a * 7 - t * 2.0) * 0.03;
            pos.array[(i * P) * 3 + 1] = base[(i * P) * 3 + 1] + w + 0.07;
        }
        pos.needsUpdate = true;
    };
    add(g, body);
    const faceZ = 0.34;
    const ey = new THREE.MeshBasicMaterial({ color: 0x1a1030, transparent: true, opacity });
    for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), ey); e.position.set(s * 0.12, 1.42, faceZ + 0.03); e.scale.set(0.9, 1.35, 0.5); add(g, e);
        const sh = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity })); sh.position.set(s * 0.12 - 0.015, 1.46, faceZ + 0.07); add(g, sh);
        const ch = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), new THREE.MeshBasicMaterial({ color: 0xff9ab8, transparent: true, opacity: opacity * 0.6 })); ch.position.set(s * 0.22, 1.32, faceZ - 0.02); ch.rotation.y = s * 0.45; add(g, ch);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI), ey); mouth.position.set(0, 1.3, faceZ + 0.04); mouth.rotation.z = Math.PI; add(g, mouth);
    const arms = [];
    for (const s of [-1, 1]) {
        const a = group(sph(0.1, bodyM, 0, 0, 0, 10, 8)); a.children[0].scale.set(0.8, 1.5, 0.8);
        a.position.set(s * 0.46, 1.0, 0.1); add(g, a); arms.push(a);
    }
    g.userData.arms = arms; g.userData.mat = bodyM;
    const gl = glowSprite('#bcd0ff', 3.6, 0.5); gl.position.set(0, 1.0, -0.2); add(g, gl);
    g.userData.glow = gl;
    g.scale.setScalar(scale);
    return g;
}

export function animateGhost(g, t, k = 1) {
    g.userData.hem(t * k);
    g.userData.arms[0].rotation.z = 0.5 + Math.sin(t * 3.2) * 0.35;
    g.userData.arms[1].rotation.z = -0.5 - Math.sin(t * 3.2 + 1) * 0.35;
}
