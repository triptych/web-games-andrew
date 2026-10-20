// The island's people: chibi animals built from spheres and capsules. Each has a body, a head,
// two arms and two legs as separate groups so they can walk, wave and bob, plus the props that
// say who they are (Moss's mop, Penny's clipboard, Ledger's spectacles...).
// Facing +Z, standing on y = 0, about 1.3 units tall.

import * as THREE from 'three';
import { Kit, sphere, box, cyl, cone, torus, capsule, tube, shade } from './kit.js';

const PI = Math.PI;

const LOOKS = {
    player: { fur: '#c8553a', belly: '#f4e3cf', ear: 'round', mask: '#f4e3cf', tail: 'ringed', hat: 'pith', extra: 'satchel' },
    otter: { fur: '#8a5a3a', belly: '#e8d2b0', ear: 'tiny', muzzle: '#e8d2b0', hat: 'captain', tail: 'thick' },
    badger: { fur: '#6a6a72', belly: '#d9d6ce', head: '#f2f0ea', ear: 'tiny', stripes: '#2a2a30', extra: 'mop', apron: '#3a6ea8' },
    owl: { fur: '#a8784a', belly: '#f0dcb6', ear: 'tuft', beak: '#f2a03a', eyesBig: true, extra: 'clipboard', scarf: '#c74a6a', wings: true },
    tortoise: { fur: '#8fae5a', belly: '#e8e0b0', ear: 'none', shell: '#6a5a32', glasses: true, bow: '#c23a3a' },
    fox: { fur: '#e2783a', belly: '#fff4e4', ear: 'pointy', earTip: '#3a2a22', tail: 'bushy', scarf: '#3a9a6a' },
    raccoon: { fur: '#8a8a94', belly: '#e4e2dc', ear: 'round', mask: '#2e2e36', tail: 'striped', hat: 'beret', extra: 'brush' },
    hare: { fur: '#ead8cc', belly: '#fff8f0', ear: 'long', earIn: '#f2b8c6', hat: 'sun', extra: 'pearls' },
    // visitors
    puffin: { fur: '#2a2a32', belly: '#f6f4ee', ear: 'none', beak: '#f27a2a', wings: true },
    bunny: { fur: '#c9b29a', belly: '#f4ece0', ear: 'long', earIn: '#f0c0c8' },
    bear: { fur: '#8a5f3e', belly: '#d9b892', ear: 'round', muzzle: '#d9b892' },
    cat: { fur: '#e0a050', belly: '#fff2dc', ear: 'pointy', tail: 'thin' },
    seal: { fur: '#7d8a94', belly: '#c8d0d6', ear: 'none', muzzle: '#c8d0d6' },
    sheep: { fur: '#f2efe6', belly: '#f2efe6', head: '#4a3e3a', ear: 'round' },
};

export const VISITOR_KINDS = ['puffin', 'bunny', 'bear', 'cat', 'seal', 'sheep'];

/**
 * Build an animal. Returns { group, parts } with parts.body, head, armL, armR, legL, legR.
 * tint (optional) recolours a visitor's fur.
 */
export function buildAnimal(kind, tint = null) {
    const L = { ...LOOKS[kind] };
    if (tint) L.fur = tint;
    const fur = L.fur, belly = L.belly, head = L.head || fur;
    const group = new THREE.Group();
    const parts = {};
    const part = (name, kit, pos) => {
        const g = kit.build();
        const holder = new THREE.Group();
        holder.position.set(...pos);
        holder.add(g);
        group.add(holder);
        parts[name] = holder;
        return holder;
    };

    // body
    const body = new Kit();
    body.add(sphere(0.36, 22, 16), (x, y, z) => (z > 0.12 && y < 0.12 ? belly : fur), 'fur', { p: [0, 0.48, 0], s: [1, 1.05, 0.9] });
    if (L.shell) {
        body.add(new THREE.SphereGeometry(0.44, 20, 12, 0, PI * 2, 0, PI * 0.55), (x, y, z) => (Math.sin(x * 22) * Math.sin(y * 22 + z * 12) > 0.3 ? shade(L.shell, 0.15) : L.shell), 'gloss', { p: [0, 0.4, -0.2], r: [-0.55, 0, 0], s: [0.95, 0.9, 0.85] });
    }
    if (L.apron) body.add(box(0.36, 0.34, 0.04), L.apron, 'fur', { p: [0, 0.42, 0.32], r: [-0.25, 0, 0] });
    if (L.scarf) body.add(torus(0.22, 0.06, 8, 20), L.scarf, 'fur', { p: [0, 0.8, 0.02], r: [PI / 2 - 0.15, 0, 0] });
    if (L.bow) for (const s of [-1, 1]) body.add(cone(0.06, 0.1, 4), L.bow, 'gloss', { p: [s * 0.05, 0.78, 0.3], r: [0, 0, s * PI / 2] });
    if (L.extra === 'pearls') for (let i = 0; i < 9; i++) { const a = PI * 0.15 + (i / 8) * PI * 0.7; body.add(sphere(0.028, 8, 6), '#fbf7ff', 'pearl', { p: [Math.cos(a) * 0.2, 0.8 - Math.sin(a) * 0.05, Math.sin(a) * 0.22] }); }
    if (L.extra === 'satchel') {
        body.add(box(0.2, 0.16, 0.08), '#7a5a32', 'fur', { p: [0.24, 0.36, 0.18], r: [0, 0.5, 0] });
        body.add(torus(0.34, 0.02, 4, 24), '#5a3e22', 'fur', { p: [0, 0.5, 0], r: [0.2, 0, 0.75] });
    }
    // tails
    if (L.tail === 'bushy') body.add(tube([[0, 0.3, -0.3], [0.1, 0.45, -0.55], [0.05, 0.7, -0.62]], [0.08, 0.15, 0.06], 10), (x, y) => (y > 0.62 ? '#fff4e4' : fur), 'fur');
    if (L.tail === 'striped' || L.tail === 'ringed') body.add(tube([[0, 0.3, -0.28], [0.15, 0.35, -0.55], [0.2, 0.6, -0.6]], [0.07, 0.1, 0.05], 10), (x, y, z) => (Math.sin((y - z) * 30) > 0 ? (L.tail === 'striped' ? '#2e2e36' : '#f4e3cf') : fur), 'fur');
    if (L.tail === 'thick') body.add(tube([[0, 0.25, -0.3], [0, 0.12, -0.55], [0.05, 0.06, -0.75]], [0.09, 0.08, 0.04], 8), fur, 'fur');
    if (L.tail === 'thin') body.add(tube([[0, 0.3, -0.3], [0.1, 0.5, -0.5], [0.2, 0.75, -0.45]], [0.035, 0.035, 0.03], 6), fur, 'fur');
    part('body', body, [0, 0, 0]);

    // head
    const hk = new Kit();
    const hy = 0;
    hk.add(sphere(0.34, 24, 18), (x, y, z) => (L.stripes && Math.abs(x) > 0.06 && Math.abs(x) < 0.15 && y > -0.05 ? L.stripes : head), 'fur', { p: [0, hy, 0], s: [1.05, 0.95, 0.95] });
    const muzzle = L.muzzle || (L.mask && kind === 'player' ? L.mask : null);
    if (muzzle) hk.add(sphere(0.15, 16, 12), muzzle, 'fur', { p: [0, -0.08, 0.26], s: [1.2, 0.8, 0.8] });
    if (L.mask && kind === 'raccoon') hk.add(sphere(0.3, 18, 10), L.mask, 'fur', { p: [0, 0.04, 0.06], s: [1.12, 0.32, 0.95] });
    if (L.mask && kind === 'player') for (const s of [-1, 1]) hk.add(sphere(0.08, 10, 8), L.mask, 'fur', { p: [s * 0.15, 0.06, 0.27], s: [1.1, 0.7, 0.5] });
    // eyes
    const eyeR = L.eyesBig ? 0.075 : 0.05;
    for (const s of [-1, 1]) {
        if (L.eyesBig) hk.add(sphere(0.12, 14, 10), '#fff6e6', 'gloss', { p: [s * 0.13, 0.04, 0.26], s: [1, 1, 0.45] });
        hk.add(sphere(eyeR, 12, 10), '#1a1414', 'gloss', { p: [s * 0.13, 0.04, 0.3], s: [1, 1.15, 0.6] });
        hk.add(sphere(eyeR * 0.35, 8, 6), '#ffffff', 'glow', { p: [s * 0.13 + eyeR * 0.3, 0.04 + eyeR * 0.4, 0.33] });
        hk.add(sphere(0.05, 10, 8), '#f29aa0', 'fur', { p: [s * 0.21, -0.08, 0.26], s: [1.2, 0.6, 0.4] });
    }
    // nose or beak
    if (L.beak) hk.add(cone(0.06, 0.16, 8), L.beak, 'gloss', { p: [0, -0.05, 0.36], r: [PI / 2, 0, 0] });
    else if (kind !== 'tortoise') hk.add(sphere(0.045, 10, 8), '#2a1a1a', 'gloss', { p: [0, -0.04, 0.38], s: [1.2, 0.8, 0.8] });
    hk.add(torus(0.05, 0.012, 4, 10, PI), '#4a2a2a', 'matte', { p: [0, -0.13, 0.33], r: [0, 0, PI] });
    // ears
    for (const s of [-1, 1]) {
        if (L.ear === 'round') hk.add(sphere(0.1, 12, 10), fur, 'fur', { p: [s * 0.24, 0.26, -0.02], s: [1, 1, 0.5] });
        if (L.ear === 'tiny') hk.add(sphere(0.06, 10, 8), fur, 'fur', { p: [s * 0.25, 0.22, 0], s: [1, 1, 0.5] });
        if (L.ear === 'pointy') {
            hk.add(cone(0.1, 0.24, 8), fur, 'fur', { p: [s * 0.2, 0.36, -0.02], r: [0, 0, -s * 0.3] });
            hk.add(cone(0.05, 0.1, 6), L.earTip || shade(fur, -0.3), 'fur', { p: [s * 0.24, 0.47, -0.02], r: [0, 0, -s * 0.3] });
        }
        if (L.ear === 'long') {
            hk.add(capsule(0.07, 0.34, 4, 10), fur, 'fur', { p: [s * 0.13, 0.5, -0.05], r: [-0.15, 0, -s * 0.18] });
            hk.add(capsule(0.04, 0.26, 4, 8), L.earIn || belly, 'fur', { p: [s * 0.13, 0.5, -0.01], r: [-0.15, 0, -s * 0.18] });
        }
        if (L.ear === 'tuft') hk.add(cone(0.06, 0.2, 5), shade(fur, -0.2), 'fur', { p: [s * 0.22, 0.32, 0], r: [0, 0, -s * 0.5] });
    }
    if (L.glasses) {
        for (const s of [-1, 1]) hk.add(torus(0.075, 0.012, 6, 16), '#c9973f', 'metal', { p: [s * 0.13, 0.04, 0.33] });
        hk.add(box(0.08, 0.012, 0.012), '#c9973f', 'metal', { p: [0, 0.05, 0.34] });
    }
    // hats
    if (L.hat === 'captain') {
        hk.add(cyl(0.27, 0.29, 0.14, 20), '#24345a', 'fur', { p: [0, 0.3, -0.02] });
        hk.add(cyl(0.3, 0.27, 0.05, 20), '#f2f0ea', 'fur', { p: [0, 0.39, -0.02] });
        hk.add(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16, 1, false, -PI / 2, PI), '#1a1a22', 'gloss', { p: [0, 0.24, 0.12] });
        hk.add(sphere(0.035), '#e7c04a', 'gold', { p: [0, 0.31, 0.27] });
    }
    if (L.hat === 'pith') {
        hk.add(new THREE.SphereGeometry(0.3, 20, 12, 0, PI * 2, 0, PI / 2), '#e6d6a6', 'fur', { p: [0, 0.18, 0] });
        hk.add(cyl(0.42, 0.42, 0.025, 24), '#d8c68e', 'fur', { p: [0, 0.18, 0] });
        hk.add(torus(0.29, 0.02, 4, 24), '#7a5a32', 'fur', { p: [0, 0.2, 0], r: [PI / 2, 0, 0] });
    }
    if (L.hat === 'beret') hk.add(sphere(0.26, 18, 10), '#c23a4a', 'fur', { p: [0.04, 0.3, -0.02], s: [1.1, 0.35, 1.1], r: [0, 0, -0.2] });
    if (L.hat === 'sun') {
        hk.add(cyl(0.48, 0.48, 0.02, 28), '#f0d890', 'fur', { p: [0, 0.22, 0] });
        hk.add(cyl(0.2, 0.24, 0.16, 20), '#f0d890', 'fur', { p: [0, 0.3, 0] });
        hk.add(torus(0.22, 0.03, 6, 20), '#d96a8a', 'fur', { p: [0, 0.26, 0], r: [PI / 2, 0, 0] });
    }
    part('head', hk, [0, 1.02, 0]);

    // arms and legs (pivot at the shoulder or hip)
    const arm = (s) => {
        const a = new Kit();
        if (L.wings) a.add(sphere(0.14, 12, 10), shade(fur, -0.1), 'fur', { p: [0, -0.16, 0], s: [0.45, 1.3, 0.9] });
        else a.add(capsule(0.075, 0.2, 4, 10), fur, 'fur', { p: [0, -0.15, 0] });
        if (s > 0 && L.extra === 'mop') {
            a.add(cyl(0.02, 0.02, 1.2, 6), '#b08a5a', 'gloss', { p: [0, -0.2, 0.08] });
            a.add(sphere(0.14, 10, 8), '#e8e2cc', 'fur', { p: [0, -0.8, 0.08], s: [1.2, 0.8, 1.2] });
        }
        if (s > 0 && L.extra === 'clipboard') {
            a.add(box(0.22, 0.3, 0.02), '#9a6a3a', 'gloss', { p: [0, -0.28, 0.1], r: [0.3, 0, 0] });
            a.add(box(0.18, 0.24, 0.005), '#fbf7ee', 'matte', { p: [0, -0.28, 0.115], r: [0.3, 0, 0] });
        }
        if (s > 0 && L.extra === 'brush') {
            a.add(cyl(0.015, 0.015, 0.36, 6), '#3a2a1a', 'gloss', { p: [0, -0.3, 0.08], r: [0.6, 0, 0] });
            a.add(cone(0.03, 0.08, 6), '#e2a63a', 'fur', { p: [0, -0.46, 0.18], r: [0.6 + PI, 0, 0] });
        }
        return a;
    };
    part('armL', arm(-1), [-0.33, 0.68, 0.02]).rotation.z = -0.25;
    part('armR', arm(1), [0.33, 0.68, 0.02]).rotation.z = 0.25;
    const leg = () => { const l = new Kit(); l.add(capsule(0.09, 0.12, 4, 10), L.shell ? fur : shade(fur, -0.08), 'fur', { p: [0, -0.1, 0.02] }); return l; };
    part('legL', leg(), [-0.15, 0.22, 0]);
    part('legR', leg(), [0.15, 0.22, 0]);
    group.userData.kind = kind;
    return { group, parts };
}

/**
 * Pose an animal for this moment: walking (speed > 0) swings legs and arms and bobs; idle
 * breathes; talk nods the head.
 */
export function animate(a, time, { speed = 0, talk = 0, wave = 0, phase = 0 } = {}) {
    const p = a.parts;
    const t = time * 8 + phase;
    const w = Math.min(1, speed);
    p.legL.rotation.x = Math.sin(t) * 0.7 * w;
    p.legR.rotation.x = -Math.sin(t) * 0.7 * w;
    p.armL.rotation.x = -Math.sin(t) * 0.5 * w;
    p.armR.rotation.x = Math.sin(t) * 0.5 * w - wave * 2.6;
    p.armR.rotation.z = 0.25 + wave * (0.3 + Math.sin(time * 14) * 0.3);
    const bob = Math.abs(Math.sin(t)) * 0.06 * w + Math.sin(time * 2 + phase) * 0.012;
    p.body.position.y = bob;
    p.head.position.y = 1.02 + bob + Math.sin(time * 2.1 + phase) * 0.01;
    p.head.rotation.x = talk ? Math.sin(time * 9) * 0.08 : Math.sin(time * 0.7 + phase) * 0.04;
    p.head.rotation.z = Math.sin(time * 0.9 + phase) * 0.05;
}
