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

// Hair: a skull cap, a fringe over the brow, sideburns, and a style on top. Built around the head's
// origin (it is lifted 0.12 when attached). Everything is a squashed sphere so the outline stays soft.
const cap = (c, r = 0.245, s = [1, 0.8, 1.04]) => [K.sph(r, { c, p: [0, 0.05, -0.03], s }, 14, 10), K.sph(0.2, { c, p: [0, -0.02, -0.12], s: [1.05, 1.05, 0.9] })];
const fringe = (c, n = 3) => Array.from({ length: n }, (_, i) => { const x = (i - (n - 1) / 2) * 0.1; return K.sph(0.085, { c, p: [x, 0.2 - Math.abs(x) * 0.35, 0.09 - Math.abs(x) * 0.2], s: [1.2, 0.42, 0.7], r: [0.2, 0, -x * 2.2] }); });
const burns = (c, len = 0.1) => [-1, 1].map((sd) => K.cap(0.03, len, { c, p: [sd * 0.205, -0.03, 0.05] }));
const HAIR = {
    short: (c) => [...cap(c), ...fringe(c, 4), ...burns(c)],
    bun: (c) => [...cap(c, 0.243, [1, 0.78, 1.02]), K.sph(0.115, { c, p: [0, 0.29, -0.13] }), K.tor(0.115, 0.022, { c: '#d8b86a', p: [0, 0.2, -0.1], r: [1.1, 0, 0] }), ...fringe(c, 3), ...burns(c, 0.08)],
    spiky: (c) => [...cap(c, 0.24, [1, 0.72, 1.02]), ...[-0.16, -0.06, 0.06, 0.16].map((x, i) => K.cone(0.075, 0.26 - Math.abs(x) * 0.25, { c, p: [x, 0.25, -0.02 - (i % 2) * 0.05], r: [-0.15, 0, -x * 2.4] })), ...fringe(c, 2).map((g) => g), ...burns(c, 0.07)],
    ponytail: (c) => [...cap(c, 0.243, [1, 0.8, 1.02]), K.sph(0.07, { c: '#ff5aa0', p: [0, 0.04, -0.27] }), K.cap(0.07, 0.34, { c, p: [0, -0.15, -0.34], r: [0.35, 0, 0] }), ...fringe(c, 3), ...burns(c, 0.12)],
    braids: (c) => [...cap(c, 0.25, [1, 0.84, 1.04]), ...fringe(c, 3), ...[-1, 1].flatMap((sd) => [0, 1, 2, 3].map((i) => K.sph(0.058 - i * 0.004, { c, p: [sd * (0.235 + i * 0.012), -0.07 - i * 0.1, -0.02 - i * 0.015], s: [1, 1.2, 1] }))), ...[-1, 1].map((sd) => K.sph(0.035, { c: '#7af0ff', p: [sd * 0.25, -0.46, -0.06] }))],
    leaves: (c) => [...cap(c, 0.24, [1, 0.8, 1]), ...fringe(c, 3), ...[-0.22, -0.11, 0, 0.11, 0.22].map((x, i) => K.cone(0.06, 0.28 - Math.abs(x) * 0.3, { c: i % 2 ? '#8ae05a' : '#4a9a3a', p: [x, 0.25, -0.03], r: [-0.25, 0, -x * 3] }))],
    hood: (c) => [K.sph(0.28, { c, p: [0, 0.02, -0.06], s: [1, 0.95, 1.05] })],
};

const shade = (hex, f) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join('');

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

    // torso with a coat that flares: chest, skirt, belt, placket, shoulders, a high collar and a neck
    const torsoParts = [
        K.cyl(0.25, 0.2, 0.55, { c: L.coat, g: L.coat, p: [0, 1.2, 0] }, 10),
        K.cyl(0.27, 0.34, 0.42, { c: L.coat, p: [0, 0.82, 0] }, 10),
        K.cyl(0.232, 0.232, 0.06, { c: L.accent, p: [0, 1.0, 0] }, 10),
        K.box(0.07, 0.07, 0.03, { c: '#e8e0c8', p: [0, 1.0, 0.232] }),
        K.box(0.045, 0.62, 0.02, { c: shade(L.coat, 0.7), p: [0, 1.06, 0.255] }),
        K.sph(0.105, { c: L.coat, p: [-0.3, 1.42, 0], s: [1, 0.85, 1] }), K.sph(0.105, { c: L.coat, p: [0.3, 1.42, 0], s: [1, 0.85, 1] }),
        K.cyl(0.125, 0.19, 0.1, { c: shade(L.coat, 0.85), p: [0, 1.5, 0] }, 10),
        K.cyl(0.062, 0.07, 0.16, { c: shade(L.skin, 0.92), p: [0, 1.57, 0] }, 8),
    ];
    if (L.scarf) torsoParts.push(K.tor(0.17, 0.06, { c: L.scarf, p: [0, 1.5, 0], r: [Math.PI / 2, 0, 0] }), K.box(0.1, 0.4, 0.05, { c: L.scarf, p: [0.15, 1.3, -0.2] }));
    if (L.pockets) for (const x of [-0.18, 0.18]) torsoParts.push(K.box(0.12, 0.12, 0.08, { c: '#a8742a', p: [x, 0.95, 0.27] }));
    const torso = part(merge(torsoParts));
    body.add(torso);

    // arms: pivots at the shoulders
    const mkArm = (side) => {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.33, 1.42, 0);
        const g = merge([K.cap(0.075, 0.3, { c: L.coat, p: [0, -0.22, 0] }), K.cap(0.065, 0.25, { c: L.coat, p: [0, -0.5, 0] }), K.cyl(0.072, 0.072, 0.05, { c: L.accent, p: [0, -0.6, 0] }, 8),
            K.sph(0.066, { c: L.skin, p: [0, -0.68, 0.01], s: [1, 1.15, 0.9] }), K.sph(0.028, { c: L.skin, p: [side * 0.055, -0.65, 0.04] })]);
        pivot.add(part(g, { outline: 0.018 }));
        body.add(pivot);
        return pivot;
    };
    const armL = mkArm(-1), armR = mkArm(1);

    // head: a skull, a tapered jaw and chin, ears and a small nose. The cheeks are a soft blush decal.
    const head = new THREE.Group();
    head.position.set(0, 1.64, 0);
    body.add(head);
    const skin2 = shade(L.skin, 0.9);
    const faceParts = [K.sph(0.215, { c: L.skin, p: [0, 0.12, 0], s: [1, 1.12, 0.98] }, 16, 12),
        K.sph(0.15, { c: L.skin, p: [0, -0.015, 0.05], s: [0.9, 0.9, 0.86] }, 14, 10),
        K.sph(0.06, { c: L.skin, p: [0, -0.1, 0.12], s: [1, 0.8, 0.8] }, 10, 8),
        K.sph(0.042, { c: skin2, p: [-0.212, 0.1, -0.01], s: [0.45, 1.1, 0.8] }, 8, 6), K.sph(0.042, { c: skin2, p: [0.212, 0.1, -0.01], s: [0.45, 1.1, 0.8] }, 8, 6),
        K.cone(0.022, 0.055, { c: shade(L.skin, 0.95), p: [0, 0.078, 0.216], r: [1.3, 0, 0] }, 6)];
    if (L.beard) faceParts.push(K.sph(0.165, { c: L.hair, p: [0, -0.06, 0.07], s: [1, 0.75, 0.8] }, 12, 8), K.sph(0.05, { c: L.hair, p: [-0.04, 0.035, 0.195], s: [1.3, 0.5, 0.7], r: [0, 0, 0.2] }), K.sph(0.05, { c: L.hair, p: [0.04, 0.035, 0.195], s: [1.3, 0.5, 0.7], r: [0, 0, -0.2] }));
    head.add(part(merge(faceParts), { outline: 0.02 }));
    head.add(part(merge((HAIR[L.hairStyle] || HAIR.short)(L.hair).map((g) => g.translate(0, 0.12, 0))), { outline: 0.02 }));
    const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
    const blushMat = basic('#ff7f78', { transparent: true, opacity: 0.1, depthWrite: false });
    for (const sd of [-1, 1]) {
        const b = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), blushMat);
        b.scale.set(1.5, 0.7, 1); b.position.set(sd * 0.125, 0.045, 0.172); b.rotation.y = sd * 0.6; b.renderOrder = 2;
        head.add(b);
    }
    // eyes: white, a coloured iris, a pupil, a catch-light and a dark upper lid
    const iris = new THREE.Color(L.accent).multiplyScalar(0.62);
    const scl = basic('#f4f6f8'), irisM = basic(iris), pup = basic('#0c1018'), hl = basic('#ffffff'), lidM = basic(shade(L.hair === '#e8e8f0' ? '#6a6a7a' : L.hair, 0.45));
    const eyes = [-1, 1].map((sd) => {
        const g = new THREE.Group(); g.position.set(sd * 0.086, 0.125, 0.209); g.userData.s = 1.15; g.scale.setScalar(1.15);
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.066, 0.016), scl);
        const p = new THREE.Group(); p.position.z = 0.009;
        const ir = new THREE.Mesh(new THREE.CircleGeometry(0.033, 14), irisM); ir.scale.y = 1.12;
        const pu = new THREE.Mesh(new THREE.CircleGeometry(0.017, 12), pup); pu.position.z = 0.002; pu.scale.y = 1.15;
        const sp = new THREE.Mesh(new THREE.CircleGeometry(0.009, 8), hl); sp.position.set(0.011, 0.014, 0.004);
        p.add(ir, pu, sp);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.016, 0.02), lidM); lid.position.set(sd * 0.004, 0.036, 0.004); lid.rotation.z = sd * -0.1;
        g.add(w, p, lid); head.add(g); return { g, p };
    });
    const eyeL = eyes[0].g, eyeR = eyes[1].g;
    const browMat = basic(L.hair === '#e8e8f0' || L.hair === '#c9c9c9' ? '#8a8a96' : shade(L.hair, 0.8));
    const mkBrow = (x) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.02, 0.018), browMat); b.position.set(x, 0.212, 0.2); head.add(b); return b; };
    const browL = mkBrow(-0.086), browR = mkBrow(0.086);
    // mouth: two short halves that tilt for the mood, plus an open mouth for shock
    const mouthCol = basic('#7a2c34');
    const mouth = new THREE.Group(); mouth.position.set(0, 0.022, 0.204);
    const half = (sd) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.014, 0.014), mouthCol); m.position.x = sd * 0.019; mouth.add(m); return m; };
    const mhL = half(-1), mhR = half(1);
    const mOpen = new THREE.Mesh(new THREE.CircleGeometry(0.026, 10), basic('#4a1820')); mOpen.scale.y = 1.3; mOpen.position.z = 0.002; mOpen.visible = false; mouth.add(mOpen);
    head.add(mouth);
    if (L.goggles) {
        const gg = merge([K.tor(0.07, 0.022, { c: '#2a2a30', p: [-0.09, 0.2, 0.15] }), K.tor(0.07, 0.022, { c: '#2a2a30', p: [0.09, 0.2, 0.15] }), K.box(0.5, 0.03, 0.04, { c: '#2a2a30', p: [0, 0.2, 0.04] })]);
        const gm = part(gg, { outline: 0.01 });
        gm.position.y = 0.2;
        head.add(gm);
        for (const sd of [-1, 1]) head.add(glow(new THREE.CircleGeometry(0.055, 8), L.accent, { p: [sd * 0.09, 0.4, 0.176] }));
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
        const rot = { neutral: [0, 0], smile: [0.08, -0.08], smirk: [-0.15, -0.35], angry: [-0.45, 0.45], sad: [0.4, -0.4], shock: [0, 0] }[m] || [0, 0];
        browL.rotation.z = rot[0]; browR.rotation.z = rot[1];
        browL.position.y = browR.position.y = m === 'shock' ? 0.252 : m === 'angry' ? 0.203 : 0.212;
        // tilt of each mouth half: positive lifts the outer end
        const [tl, tr] = { neutral: [0.04, 0.04], smile: [0.38, 0.38], smirk: [0.02, 0.4], angry: [-0.2, -0.2], sad: [-0.34, -0.34], shock: [0, 0] }[m] || [0.04, 0.04];
        mhL.rotation.z = -tl; mhR.rotation.z = tr;
        mhL.position.y = Math.sin(tl) * 0.01; mhR.position.y = Math.sin(tr) * 0.01;
        mhL.visible = mhR.visible = m !== 'shock'; mOpen.visible = m === 'shock';
        mouth.scale.x = m === 'smile' ? 1.3 : m === 'sad' ? 0.85 : 1;
        blushMat.opacity = m === 'smile' ? 0.18 : m === 'angry' ? 0.06 : 0.1;
        for (const e of eyes) { e.g.scale.y = 1.15 * (m === 'smile' ? 0.5 : m === 'shock' ? 1.25 : m === 'angry' ? 0.82 : m === 'sad' ? 0.9 : 1); e.p.position.x = m === 'smirk' ? 0.012 : 0; }
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
