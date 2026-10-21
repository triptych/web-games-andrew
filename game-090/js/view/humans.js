// People: a low-poly humanoid built from merged primitives with ink outlines and a few joints
// to pose. Faces +z. About 1.8 units tall at scale 1. Used for the Agent, the Navigator, the
// Marshal and the rest of the cast, in the field, in cutscenes and as bust portraits.

import * as THREE from 'three';
import { K, merge, part, glow, toonMat } from './toon.js';
import { CHARS } from '../sim/data/story.js';

export const AGENT_LOOKS = [
    { skin: '#c89070', hair: '#2a2a3a', coat: '#2f8f7a', accent: '#7affd0', hairStyle: 'short' },
    { skin: '#8a5a3c', hair: '#101018', coat: '#4a5aa8', accent: '#9ab4ff', hairStyle: 'bun' },
    { skin: '#f0c8a8', hair: '#c8742a', coat: '#c8683a', accent: '#ffc07a', hairStyle: 'spiky' },
    { skin: '#e0b090', hair: '#e8e8f0', coat: '#d8d8e0', accent: '#ff7ae0', hairStyle: 'ponytail' },
];

const HAIR = {
    short: (c) => [K.sph(0.245, { c, p: [0, 0.04, -0.02], s: [1, 0.8, 1.02] }), K.box(0.5, 0.1, 0.1, { c, p: [0, 0.2, 0.15] })],
    bun: (c) => [K.sph(0.245, { c, p: [0, 0.04, -0.03], s: [1, 0.75, 1] }), K.sph(0.11, { c, p: [0, 0.3, -0.12] })],
    spiky: (c) => [K.sph(0.24, { c, p: [0, 0.03, -0.02], s: [1, 0.7, 1] }), ...[-0.15, 0, 0.15].map((x, i) => K.cone(0.07, 0.24, { c, p: [x, 0.27, 0.0 - i % 2 * 0.06], r: [0, 0, -x * 2.2] }))],
    ponytail: (c) => [K.sph(0.245, { c, p: [0, 0.04, -0.03], s: [1, 0.8, 1.02] }), K.cap(0.07, 0.3, { c, p: [0, -0.1, -0.32], r: [0.3, 0, 0] })],
    braids: (c) => [K.sph(0.25, { c, p: [0, 0.05, -0.03], s: [1, 0.85, 1.05] }), K.cap(0.05, 0.4, { c, p: [-0.25, -0.18, -0.02] }), K.cap(0.05, 0.4, { c, p: [0.25, -0.18, -0.02] })],
    leaves: (c) => [K.sph(0.24, { c, p: [0, 0.05, -0.03], s: [1, 0.8, 1] }), ...[-0.2, -0.07, 0.07, 0.2].map((x, i) => K.cone(0.07, 0.3, { c: i % 2 ? '#8ae05a' : '#4a9a3a', p: [x, 0.24, -0.02], r: [-0.2, 0, -x * 3] }))],
    hood: (c) => [K.sph(0.28, { c, p: [0, 0.02, -0.06], s: [1, 0.95, 1.05] })],
};

/**
 * look: { skin, hair, coat, accent, hairStyle, beard, goggles, scarf, pockets, tall, weapon }
 * Returns { root, joints, setMood, pose(state, t) }.
 */
export function buildHuman(look = {}) {
    const L = { skin: '#c89070', hair: '#222', coat: '#446', accent: '#7affd0', hairStyle: 'short', tall: 1, ...look };
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    body.scale.setScalar(L.tall);
    const pants = '#252a36', boot = '#161820';

    // legs: pivots at the hips
    const mkLeg = (side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.13, 0.92, 0);
        const g = merge([K.cap(0.085, 0.38, { c: pants, p: [0, -0.3, 0] }), K.box(0.17, 0.12, 0.28, { c: boot, p: [0, -0.8, 0.05] }), K.cap(0.075, 0.3, { c: pants, p: [0, -0.62, 0] })]);
        pivot.add(part(g, { outline: 0.018 }));
        body.add(pivot);
        return pivot;
    };
    const legL = mkLeg(-1), legR = mkLeg(1);

    // torso with a coat that flares
    const torsoParts = [
        K.cyl(0.25, 0.2, 0.55, { c: L.coat, g: L.coat, p: [0, 1.2, 0] }, 8),
        K.cyl(0.27, 0.33, 0.42, { c: L.coat, p: [0, 0.82, 0] }, 8),
        K.box(0.5, 0.06, 0.3, { c: L.accent, p: [0, 1.02, 0] }),
    ];
    if (L.scarf) torsoParts.push(K.tor(0.22, 0.07, { c: L.scarf, p: [0, 1.48, 0], r: [Math.PI / 2, 0, 0] }), K.box(0.1, 0.4, 0.05, { c: L.scarf, p: [0.15, 1.28, -0.2] }));
    if (L.pockets) for (const x of [-0.18, 0.18]) torsoParts.push(K.box(0.12, 0.12, 0.08, { c: '#a8742a', p: [x, 0.95, 0.27] }));
    const torso = part(merge(torsoParts));
    body.add(torso);

    // arms: pivots at the shoulders
    const mkArm = (side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.33, 1.42, 0);
        const g = merge([K.cap(0.075, 0.3, { c: L.coat, p: [0, -0.22, 0] }), K.cap(0.065, 0.25, { c: L.coat, p: [0, -0.5, 0] }), K.sph(0.07, { c: L.skin, p: [0, -0.68, 0] })]);
        pivot.add(part(g, { outline: 0.018 }));
        body.add(pivot);
        return pivot;
    };
    const armL = mkArm(-1), armR = mkArm(1);

    // head
    const head = new THREE.Group();
    head.position.set(0, 1.62, 0);
    body.add(head);
    const faceParts = [K.sph(0.22, { c: L.skin, p: [0, 0.1, 0], s: [1, 1.1, 1] }), K.box(0.06, 0.1, 0.06, { c: L.skin, p: [0, 0.02, 0.2] })];
    if (L.beard) faceParts.push(K.sph(0.17, { c: L.hair, p: [0, -0.05, 0.1], s: [1, 0.7, 0.8] }));
    head.add(part(merge(faceParts), { outline: 0.02 }));
    head.add(part(merge((HAIR[L.hairStyle] || HAIR.short)(L.hair).map((g) => g.translate(0, 0.12, 0))), { outline: 0.02 }));
    // eyes and brows
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#10141c', toneMapped: false });
    const mkEye = (x) => { const e = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.02), eyeMat); e.position.set(x, 0.13, 0.205); head.add(e); return e; };
    const eyeL = mkEye(-0.085), eyeR = mkEye(0.085);
    const browMat = new THREE.MeshBasicMaterial({ color: L.hair === '#e8e8f0' ? '#9090a0' : L.hair, toneMapped: false });
    const mkBrow = (x) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.02), browMat); b.position.set(x, 0.22, 0.2); head.add(b); return b; };
    const browL = mkBrow(-0.085), browR = mkBrow(0.085);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 0.02), new THREE.MeshBasicMaterial({ color: '#5a2a2a', toneMapped: false }));
    mouth.position.set(0, 0.02, 0.208);
    head.add(mouth);
    if (L.goggles) {
        const gg = merge([K.tor(0.075, 0.025, { c: '#2a2a30', p: [-0.09, 0.2, 0.16] }), K.tor(0.075, 0.025, { c: '#2a2a30', p: [0.09, 0.2, 0.16] }), K.box(0.5, 0.03, 0.04, { c: '#2a2a30', p: [0, 0.2, 0.05] })]);
        const gm = part(gg, { outline: 0.01 });
        gm.position.y = 0.2;
        head.add(gm);
        head.add(glow(new THREE.CircleGeometry(0.06, 8), L.accent, { p: [-0.09, 0.4, 0.2] }), glow(new THREE.CircleGeometry(0.06, 8), L.accent, { p: [0.09, 0.4, 0.2] }));
        head.children.slice(-2).forEach((c) => c.position.y -= 0.2);
    }
    // weapons: a blade at the right hand, a sidearm at the left hip
    let blade = null, gun = null;
    if (L.weapon) {
        blade = new THREE.Group();
        blade.add(part(merge([K.box(0.05, 0.24, 0.05, { c: '#3a2a22', p: [0, 0.0, 0] }), K.box(0.2, 0.04, 0.06, { c: L.accent, p: [0, 0.14, 0] }), K.box(0.05, 0.9, 0.025, { c: '#dfe8f0', g: '#9aa8b8', p: [0, 0.62, 0] })]), { outline: 0.012 }));
        blade.add(glow(new THREE.BoxGeometry(0.02, 0.88, 0.03), L.accent, { p: [0, 0.62, 0], opacity: 0.55 }));
        blade.position.set(0, -0.68, 0.04); blade.rotation.x = Math.PI / 2 - 0.2;
        armR.add(blade);
        gun = part(merge([K.box(0.07, 0.12, 0.2, { c: '#2a2e38' }), K.box(0.05, 0.05, 0.14, { c: '#11141a', p: [0, 0.03, 0.14] })]), { outline: 0.01 });
        gun.position.set(-0.3, 0.78, 0.1);
        body.add(gun);
    }

    const J = { legL, legR, armL, armR, head, torso, body, eyeL, eyeR, browL, browR, mouth, blade, gun };
    const api = { root, joints: J, look: L };

    api.setMood = (m = 'neutral') => {
        const brow = { neutral: [0, 0], smile: [0.1, 0.05], smirk: [-0.12, 0.15], angry: [-0.5, -0.5], sad: [0.4, 0.4], shock: [0, 0] }[m] || [0, 0];
        browL.rotation.z = brow[0]; browR.rotation.z = -(brow[1] || brow[0]);
        if (m === 'angry') { browL.rotation.z = -0.4; browR.rotation.z = 0.4; }
        if (m === 'sad') { browL.rotation.z = 0.35; browR.rotation.z = -0.35; }
        browL.position.y = browR.position.y = m === 'shock' ? 0.26 : 0.22;
        mouth.scale.set(m === 'shock' ? 0.5 : 1, m === 'shock' ? 4 : 1, 1);
        mouth.rotation.z = m === 'smile' ? 0.0 : 0;
        mouth.scale.x = m === 'smile' ? 1.5 : m === 'shock' ? 0.5 : 1;
        mouth.position.y = m === 'smile' ? 0.03 : m === 'sad' ? 0.0 : 0.02;
        mouth.material.color.set(m === 'smile' ? '#7a2a30' : '#5a2a2a');
        eyeL.scale.y = eyeR.scale.y = m === 'smile' ? 0.5 : m === 'shock' ? 1.4 : 1;
    };
    api.setMood('neutral');

    /**
     * state: { move: 0..1 (walk), run: bool, atk: 0..1 progress of a swing, hurt: 0..1, down: 0..1,
     *          cast: 0..1, guard: bool, talk: bool }
     */
    api.pose = (s, t) => {
        const w = s.move || 0, sp = s.run ? 11 : 7;
        const ph = t * sp;
        const swing = Math.sin(ph) * 0.8 * w;
        legL.rotation.x = swing; legR.rotation.x = -swing;
        armL.rotation.x = -swing * 0.9; armR.rotation.x = swing * 0.9;
        armL.rotation.z = 0.08; armR.rotation.z = -0.08;
        body.position.y = Math.abs(Math.sin(ph)) * 0.05 * w + (1 - w) * Math.sin(t * 1.8) * 0.008;
        torso.rotation.y = Math.sin(ph) * 0.1 * w;
        head.rotation.y = s.talk ? Math.sin(t * 2.2) * 0.08 : 0;
        head.rotation.x = 0;
        body.rotation.x = 0; body.rotation.z = 0; body.position.z = 0;
        if (s.run) body.rotation.x = 0.2;
        if (s.atk > 0) {
            const k = s.atk;
            const sw = Math.sin(Math.min(1, k) * Math.PI);
            armR.rotation.x = -2.4 + k * 3.2; armR.rotation.z = -0.2;
            torso.rotation.y = -0.5 + k * 1.0;
            body.position.z = sw * 0.25;
            body.rotation.x = sw * 0.25;
        }
        if (s.cast > 0) {
            armL.rotation.x = -2.2; armR.rotation.x = -2.2; armL.rotation.z = 0.5; armR.rotation.z = -0.5;
            head.rotation.x = -0.25;
            body.position.y += Math.sin(s.cast * Math.PI) * 0.15;
        }
        if (s.guard) { armL.rotation.x = -1.6; armR.rotation.x = -1.6; armL.rotation.z = -0.5; armR.rotation.z = 0.5; body.rotation.x = 0.25; }
        if (s.hurt > 0) { body.rotation.x = -0.4 * s.hurt; body.position.z = -0.25 * s.hurt; head.rotation.x = -0.3 * s.hurt; }
        if (s.down > 0) { body.rotation.x = -1.35 * s.down; body.position.y = -0.55 * s.down; body.position.z = -0.1 * s.down; }
    };
    return api;
}

/** The cast, by id: Agent looks come from AGENT_LOOKS. */
export function buildCast(id, { look = 0, weapon = false } = {}) {
    if (id === 'agent') return buildHuman({ ...AGENT_LOOKS[look % AGENT_LOOKS.length], weapon: true, tall: 1.0, scarf: '#d8f0e0' });
    const c = CHARS[id];
    if (!c || !c.look) return null;
    return buildHuman({ ...c.look, weapon });
}
