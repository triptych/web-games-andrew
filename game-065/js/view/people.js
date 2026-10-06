// People: the player, the rival, the Forgemasters, the Syndicate and every townsfolk, built from a
// look description (js/sim/data/story.js LOOKS): body shape, coat, hat, hair, goggles, scarf,
// beard, gas mask. Chunky, slightly chibi proportions so they read from the overworld camera.
// Faces +z; walk cycle swings arms and legs.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LOOKS } from '../sim/data/story.js';
import { metal, glow, MAT } from './materials.js';
import { buildBot } from './botgen.js';
import { BY_NAME } from '../sim/dex.js';
import { hashStr } from '../rng.js';

const gc = new Map();
const G = (k, f) => { if (!gc.has(k)) gc.set(k, f()); return gc.get(k); };
const matC = new Map();
function cloth(color, rough = 0.85) { const k = `${color}|${rough}`; if (!matC.has(k)) matC.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })); return matC.get(k); }
function M(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }

const SKINS = ['#f0c8a0', '#e0b48a', '#c89070', '#a87050', '#8a5a3a', '#6a4a3a', '#f4d8c0'];
const HAIRS = ['#1a1410', '#3a2418', '#6a3a1a', '#a8582a', '#d8b060', '#c8c8c8', '#2a2a3a', '#8a2a2a'];
const COATS = ['#7a3a22', '#2a4a6a', '#3a5a3a', '#5a3a5a', '#6a5a3a', '#4a4a52', '#8a6a2a', '#2a3a3a', '#7a2a2a'];
const PANTS = ['#3a3a44', '#2a2a30', '#4a3a2a', '#3a2a22', '#2a3040'];
const HATS = ['cap', 'none', 'bowler', 'top', 'bandana', 'none', 'wide', 'cap'];
const STYLES = ['short', 'messy', 'long', 'bun', 'slick', 'spiky'];

/** Fill in a look: named looks, class looks, random looks from a seed. */
export function resolveLook(lookName, seedKey = 'x', override = null) {
    const base = typeof lookName === 'object' && lookName ? lookName : (LOOKS[lookName] || {});
    const h = hashStr(seedKey + (typeof lookName === 'string' ? lookName : ''));
    const pick = (arr, k) => arr[(h >>> k) % arr.length];
    const L = {
        body: 'adult', skin: pick(SKINS, 1), hair: pick(HAIRS, 4), hairStyle: pick(STYLES, 7), hat: lookName === 'rand' ? pick(HATS, 10) : 'none',
        coat: 'jacket', coatColor: pick(COATS, 13), pants: pick(PANTS, 16), scarf: (h >>> 19) % 3 === 0 ? pick(COATS, 20) : null,
        goggles: (h >>> 22) % 4 === 0, beard: false, mask: false, accent: '#c8902a',
        ...base, ...(override || {}),
    };
    if (lookName === 'rand') L.body = ['adult', 'adult', 'kid', 'old', 'big', 'tall'][(h >>> 25) % 6];
    return L;
}

export function buildPerson(lookName, seedKey = 'x', override = null) {
    const L = resolveLook(lookName, seedKey, override);
    if (L.body === 'capsule') return buildCapsule(override && override.capsule);
    const root = new THREE.Group();
    const rig = new THREE.Group();
    root.add(rig);
    const P = {
        kid: { s: 0.82, head: 0.27, torso: 0.36, leg: 0.32, w: 0.26 },
        adult: { s: 1, head: 0.25, torso: 0.46, leg: 0.42, w: 0.3 },
        big: { s: 1.06, head: 0.26, torso: 0.5, leg: 0.4, w: 0.4 },
        tall: { s: 1.1, head: 0.24, torso: 0.52, leg: 0.5, w: 0.28 },
        old: { s: 0.94, head: 0.25, torso: 0.42, leg: 0.38, w: 0.3 },
    }[L.body] || { s: 1, head: 0.25, torso: 0.46, leg: 0.42, w: 0.3 };
    const skin = cloth(L.skin, 0.7), coat = cloth(L.coatColor, 0.8), pants = cloth(L.pants, 0.9), hair = cloth(L.hair, 0.9);
    const boot = cloth('#2a1a10', 0.6), accent = metal(L.accent === '#c8902a' ? 'brass' : 'brass');
    const hipY = P.leg + 0.08;
    // Legs.
    const legs = [];
    for (const x of [-P.w * 0.32, P.w * 0.32]) {
        const lg = new THREE.Group();
        lg.position.set(x, hipY, 0);
        lg.add(M(G(`leg${P.leg}`, () => new THREE.CylinderGeometry(0.065, 0.055, P.leg, 10)), pants, 0, -P.leg / 2, 0));
        lg.add(M(G('boot', () => new RoundedBoxGeometry(0.14, 0.1, 0.22, 2, 0.03)), boot, 0, -P.leg - 0.03, 0.03));
        rig.add(lg); legs.push(lg);
    }
    // Torso by coat.
    const torsoY = hipY + P.torso / 2;
    const tg = new THREE.Group(); rig.add(tg);
    const torsoGeo = G(`torso${P.w}|${P.torso}`, () => new THREE.CylinderGeometry(P.w * 0.5, P.w * 0.58, P.torso, 14));
    tg.add(M(torsoGeo, L.coat === 'armor' ? metal('steel') : coat, 0, torsoY, 0));
    if (['longcoat', 'labcoat', 'robe', 'dress', 'parka'].includes(L.coat)) {
        const len = L.coat === 'robe' || L.coat === 'dress' ? hipY : hipY * 0.62;
        const skirtMat = L.coat === 'labcoat' ? cloth('#e8e8e0') : coat;
        tg.add(M(G(`skirt${P.w}|${len}`, () => new THREE.CylinderGeometry(P.w * 0.58, P.w * 0.8, len, 14, 1, true)), skirtMat, 0, hipY - len / 2 + 0.02, 0));
        tg.children[tg.children.length - 1].material.side = THREE.DoubleSide;
        if (L.coat === 'labcoat') tg.children[0].material = skirtMat;
        if (L.coat === 'parka') { const r = M(G('parkarim', () => new THREE.TorusGeometry(P.w * 0.5, 0.05, 8, 16)), cloth('#f0f0f0', 1), 0, hipY + P.torso, 0); r.rotation.x = Math.PI / 2; tg.add(r); }
    }
    if (L.coat === 'apron') tg.add(M(G('apron', () => new RoundedBoxGeometry(P.w * 0.8, P.torso * 1.3, 0.04, 2, 0.02)), cloth('#5a3a22', 0.95), 0, torsoY - 0.1, P.w * 0.5));
    if (L.coat === 'overalls') { tg.add(M(G('bib', () => new RoundedBoxGeometry(P.w * 0.6, P.torso * 0.6, 0.04, 2, 0.02)), pants, 0, torsoY, P.w * 0.52)); for (const x of [-0.08, 0.08]) tg.add(M(G('strap', () => new THREE.BoxGeometry(0.03, P.torso, 0.02)), pants, x, torsoY + 0.05, P.w * 0.5)); }
    if (L.coat === 'vest') tg.add(M(G(`vest${P.w}`, () => new THREE.CylinderGeometry(P.w * 0.52, P.w * 0.6, P.torso * 0.85, 14, 1, true, -1.2, 2.4)), cloth('#e8dcc0'), 0, torsoY, 0));
    // Belt and buckle.
    const belt = M(G(`belt${P.w}`, () => new THREE.TorusGeometry(P.w * 0.56, 0.03, 6, 18)), cloth('#3a2214', 0.6), 0, hipY + 0.04, 0); belt.rotation.x = Math.PI / 2; tg.add(belt);
    tg.add(M(G('buckle', () => new THREE.BoxGeometry(0.07, 0.06, 0.02)), accent, 0, hipY + 0.04, P.w * 0.57));
    if (L.coat === 'armor') for (const y of [0.1, 0.25]) { const r = M(G(`arm${P.w}`, () => new THREE.TorusGeometry(P.w * 0.55, 0.035, 6, 18)), metal('iron'), 0, hipY + y, 0); r.rotation.x = Math.PI / 2; tg.add(r); }
    // Arms.
    const shoulderY = hipY + P.torso - 0.06;
    const arms = [];
    for (const side of [-1, 1]) {
        const ar = new THREE.Group();
        ar.position.set(side * (P.w * 0.62), shoulderY, 0);
        const sleeve = L.coat === 'labcoat' ? cloth('#e8e8e0') : L.coat === 'armor' ? metal('steel') : coat;
        ar.add(M(G(`armu${P.torso}`, () => new THREE.CylinderGeometry(0.055, 0.05, P.torso * 0.85, 8)), sleeve, 0, -P.torso * 0.42, 0));
        ar.add(M(G('hand', () => new THREE.SphereGeometry(0.055, 10, 8)), L.coat === 'armor' ? metal('iron') : skin, 0, -P.torso * 0.88, 0));
        ar.rotation.z = side * 0.12;
        rig.add(ar); arms.push(ar);
    }
    // Satchel for the player-ish kids.
    if (L.body === 'kid') {
        const s = M(G('satchel', () => new RoundedBoxGeometry(0.16, 0.14, 0.08, 2, 0.02)), cloth('#6a4a2a', 0.8), P.w * 0.5, hipY + 0.06, 0.04); rig.add(s);
        const strap = M(G('sstrap', () => new THREE.TorusGeometry(P.torso * 0.62, 0.012, 4, 20)), cloth('#4a2a1a'), 0, hipY + P.torso * 0.5, 0); strap.rotation.set(0.15, 0, 0.75); rig.add(strap);
    }
    // Neck, head.
    const headR = P.head;
    const headY = hipY + P.torso + headR * 0.95;
    const head = new THREE.Group(); head.position.y = headY; rig.add(head);
    head.add(M(G(`head${headR}`, () => new THREE.SphereGeometry(headR, 20, 16)), skin));
    // Face.
    for (const x of [-headR * 0.35, headR * 0.35]) {
        head.add(M(G('eye', () => new THREE.SphereGeometry(0.035, 8, 6)), cloth('#1a1410', 0.3), x, headR * 0.08, headR * 0.9));
        head.add(M(G('eyeh', () => new THREE.SphereGeometry(0.012, 6, 4)), cloth('#ffffff', 0.2), x + 0.012, headR * 0.12, headR * 0.96));
    }
    head.add(M(G('nose', () => new THREE.SphereGeometry(0.03, 8, 6)), skin, 0, -headR * 0.1, headR * 0.97));
    head.add(M(G('mouth', () => new THREE.BoxGeometry(0.06, 0.012, 0.01)), cloth('#5a2a20'), 0, -headR * 0.36, headR * 0.9));
    if (L.beard) head.add(M(G(`beard${headR}`, () => new THREE.SphereGeometry(headR * 0.75, 12, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55)), hair, 0, -headR * 0.15, headR * 0.15));
    if (L.mask) {
        head.add(M(G('maskp', () => new THREE.CylinderGeometry(headR * 0.5, headR * 0.6, 0.14, 12)), metal('gunmetal'), 0, -headR * 0.25, headR * 0.75));
        head.children[head.children.length - 1].rotation.x = Math.PI / 2;
        for (const x of [-0.08, 0.08]) head.add(M(G('maskf', () => new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10)), metal('brass'), x, -headR * 0.42, headR * 0.82));
        for (const x of [-headR * 0.35, headR * 0.35]) head.add(M(G('maskeye', () => new THREE.SphereGeometry(0.045, 10, 8)), glow(L.accent || '#ff7a2a', 2.5), x, headR * 0.1, headR * 0.92));
    }
    // Hair.
    const hs = L.hairStyle;
    if (L.hat !== 'helm' && L.hat !== 'hood' && L.hat !== 'plague') {
        if (hs === 'messy' || hs === 'spiky') {
            for (let i = 0; i < 9; i++) {
                const a = (i / 9) * Math.PI * 2;
                const t = M(G(hs === 'spiky' ? 'spike' : 'tuft', () => (hs === 'spiky' ? new THREE.ConeGeometry(0.05, 0.16, 6) : new THREE.IcosahedronGeometry(0.07, 0))), hair, Math.cos(a) * headR * 0.6, headR * 0.65, Math.sin(a) * headR * 0.6 - 0.03);
                t.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
                head.add(t);
            }
        }
        head.add(M(G(`hairc${headR}`, () => new THREE.SphereGeometry(headR * 1.04, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45)), hair, 0, 0.0, -0.01));
        if (hs === 'long') head.add(M(G(`hairl${headR}`, () => new THREE.CapsuleGeometry(headR * 0.8, headR * 1.2, 4, 10)), hair, 0, -headR * 0.6, -headR * 0.45));
        if (hs === 'bun') head.add(M(G('bun', () => new THREE.SphereGeometry(0.1, 10, 8)), hair, 0, headR * 0.6, -headR * 0.7));
        if (hs === 'slick') head.add(M(G(`slick${headR}`, () => new THREE.SphereGeometry(headR * 1.06, 16, 10, Math.PI * 0.6, Math.PI * 0.8, 0, Math.PI * 0.5)), hair, 0, 0, 0));
    }
    // Hat.
    const hatMat = cloth(L.hat === 'top' || L.hat === 'bowler' ? '#1e1a1c' : L.coatColor, 0.75);
    const hy = headR * 0.6;
    switch (L.hat) {
        case 'cap':
            head.add(M(G(`cap${headR}`, () => new THREE.SphereGeometry(headR * 1.08, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42)), hatMat, 0, 0.02, 0));
            head.add(M(G('brim', () => new THREE.CylinderGeometry(0.16, 0.16, 0.02, 14, 1, false, -Math.PI / 2, Math.PI)), hatMat, 0, hy - 0.02, headR * 0.65));
            break;
        case 'top': case 'bowler': {
            const tall = L.hat === 'top' ? 0.3 : 0.14;
            head.add(M(G(`hatb${tall}`, () => new THREE.CylinderGeometry(headR * 0.75, headR * 0.82, tall, 16)), hatMat, 0, hy + tall / 2, 0));
            head.add(M(G('hatbrim', () => new THREE.CylinderGeometry(headR * 1.3, headR * 1.3, 0.025, 18)), hatMat, 0, hy, 0));
            const band = M(G(`hband${tall}`, () => new THREE.CylinderGeometry(headR * 0.83, headR * 0.83, 0.05, 16, 1, true)), metal('brass'), 0, hy + 0.05, 0); head.add(band);
            if (L.hat === 'top' && L.goggles) { for (const x of [-0.07, 0.07]) { const g = M(G('hgog', () => new THREE.TorusGeometry(0.05, 0.015, 8, 14)), metal('brass'), x, hy + 0.08, headR * 0.82); head.add(g); head.add(M(G('hgogl', () => new THREE.CircleGeometry(0.045, 12)), glow('#ffcc6a', 1), x, hy + 0.08, headR * 0.83)); } }
            break;
        }
        case 'aviator':
            head.add(M(G(`avi${headR}`, () => new THREE.SphereGeometry(headR * 1.08, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55)), cloth('#5a3a1a', 0.9), 0, 0.01, 0));
            for (const x of [-1, 1]) head.add(M(G('flap', () => new RoundedBoxGeometry(0.05, 0.16, 0.12, 2, 0.02)), cloth('#5a3a1a', 0.9), x * headR * 0.95, -0.03, 0));
            break;
        case 'wide':
            head.add(M(G('wideb', () => new THREE.CylinderGeometry(0.42, 0.42, 0.025, 20)), cloth('#6a4a2a'), 0, hy - 0.02, 0));
            head.add(M(G('widet', () => new THREE.CylinderGeometry(headR * 0.7, headR * 0.85, 0.16, 16)), cloth('#6a4a2a'), 0, hy + 0.06, 0));
            break;
        case 'witch': {
            head.add(M(G('witchb', () => new THREE.CylinderGeometry(0.36, 0.36, 0.02, 18)), cloth('#2a2a6a'), 0, hy - 0.02, 0));
            const c = M(G('witchc', () => new THREE.ConeGeometry(headR * 0.8, 0.5, 14)), cloth('#2a2a6a'), 0, hy + 0.24, -0.03); c.rotation.x = -0.25; head.add(c);
            head.add(M(G('witchcoil', () => new THREE.TorusGeometry(headR * 0.55, 0.02, 6, 16)), metal('copper'), 0, hy + 0.15, -0.05));
            head.children[head.children.length - 1].rotation.x = Math.PI / 2 - 0.25;
            head.add(M(G('witchtip', () => new THREE.SphereGeometry(0.04, 8, 6)), glow(L.accent || '#ffd82a', 2.5), 0, hy + 0.48, -0.15));
            break;
        }
        case 'helm':
            head.add(M(G(`helm${headR}`, () => new THREE.SphereGeometry(headR * 1.15, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62)), metal('steel'), 0, 0.02, 0));
            head.add(M(G('helmv', () => new THREE.BoxGeometry(headR * 1.4, 0.04, 0.05)), glow(L.accent || '#d0d8e4', 1.2), 0, headR * 0.15, headR * 1.0));
            break;
        case 'hood':
            head.add(M(G(`hood${headR}`, () => new THREE.SphereGeometry(headR * 1.18, 16, 12, Math.PI * 0.75, Math.PI * 1.5)), cloth(L.coatColor, 0.95), 0, 0.03, -0.02));
            break;
        case 'bandana':
            head.add(M(G(`band${headR}`, () => new THREE.SphereGeometry(headR * 1.06, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.4)), cloth('#a8201a'), 0, 0.02, 0));
            break;
        case 'mask':
            head.add(M(G(`hood${headR}`, () => new THREE.SphereGeometry(headR * 1.18, 16, 12, Math.PI * 0.75, Math.PI * 1.5)), cloth(L.coatColor, 0.95), 0, 0.03, -0.02));
            if (!L.mask) {
                head.add(M(G('maskp', () => new THREE.CylinderGeometry(headR * 0.5, headR * 0.6, 0.14, 12)), metal('gunmetal'), 0, -headR * 0.25, headR * 0.75));
                head.children[head.children.length - 1].rotation.x = Math.PI / 2;
                for (const x of [-headR * 0.35, headR * 0.35]) head.add(M(G('maskeye', () => new THREE.SphereGeometry(0.045, 10, 8)), glow('#ff7a2a', 2.5), x, headR * 0.1, headR * 0.92));
            }
            break;
        case 'captain':
            head.add(M(G(`capt${headR}`, () => new THREE.CylinderGeometry(headR * 0.95, headR * 0.85, 0.14, 16)), cloth('#f0f0f0'), 0, hy + 0.04, 0));
            head.add(M(G('captbrim', () => new THREE.CylinderGeometry(0.15, 0.15, 0.02, 14, 1, false, -Math.PI / 2, Math.PI)), cloth('#1a1a2a'), 0, hy - 0.02, headR * 0.6));
            head.add(M(G('captbadge', () => new THREE.SphereGeometry(0.03, 8, 6)), metal('gold'), 0, hy + 0.05, headR * 0.93));
            break;
        case 'plague': {
            head.add(M(G(`hood${headR}`, () => new THREE.SphereGeometry(headR * 1.18, 16, 12, Math.PI * 0.75, Math.PI * 1.5)), cloth('#1a1a1a', 0.9), 0, 0.03, -0.02));
            const b = M(G('beak', () => new THREE.ConeGeometry(0.08, 0.34, 10)), cloth('#e8dcc0', 0.6), 0, -0.04, headR + 0.12); b.rotation.x = Math.PI / 2 + 0.25; head.add(b);
            for (const x of [-0.08, 0.08]) head.add(M(G('plaguee', () => new THREE.SphereGeometry(0.05, 10, 8)), glow(L.accent || '#8ad83a', 2), x, headR * 0.15, headR * 0.85));
            head.add(M(G('hatbrim', () => new THREE.CylinderGeometry(headR * 1.3, headR * 1.3, 0.025, 18)), cloth('#1a1a1a'), 0, hy, 0));
            head.add(M(G('hatb0.14', () => new THREE.CylinderGeometry(headR * 0.75, headR * 0.82, 0.14, 16)), cloth('#1a1a1a'), 0, hy + 0.07, 0));
            break;
        }
        case 'crown': for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; head.add(M(G('crownp', () => new THREE.ConeGeometry(0.03, 0.1, 5)), metal('gold'), Math.cos(a) * headR * 0.6, hy + 0.05, Math.sin(a) * headR * 0.6)); } break;
    }
    // Goggles on the forehead.
    if (L.goggles && L.hat !== 'top' && L.hat !== 'helm' && L.hat !== 'plague') {
        for (const x of [-headR * 0.38, headR * 0.38]) {
            const g = M(G('gog', () => new THREE.TorusGeometry(0.055, 0.018, 8, 14)), metal('brass'), x, headR * 0.5, headR * 0.82); g.rotation.x = -0.5; head.add(g);
            const l = M(G('gogl', () => new THREE.CircleGeometry(0.05, 12)), new THREE.MeshStandardMaterial({ color: '#4a8aa8', metalness: 0.5, roughness: 0.1, emissive: new THREE.Color('#1a3a4a') }), x, headR * 0.5, headR * 0.83); l.rotation.x = -0.5; head.add(l);
        }
        head.add(M(G(`gogstrap${headR}`, () => new THREE.TorusGeometry(headR * 1.02, 0.015, 4, 24)), cloth('#3a2214'), 0, headR * 0.45, 0));
        head.children[head.children.length - 1].rotation.x = Math.PI / 2 - 0.35;
    }
    if (L.scarf) { const sc = M(G(`scarf${P.w}`, () => new THREE.TorusGeometry(P.w * 0.42, 0.05, 8, 16)), cloth(L.scarf, 0.95), 0, hipY + P.torso + 0.02, 0); sc.rotation.x = Math.PI / 2; rig.add(sc); }
    rig.scale.setScalar(P.s);

    let t = 0;
    const height = (headY + headR * 1.6) * P.s;
    function update(dt, moving = 0, running = false) {
        t += dt * (running ? 1.7 : 1);
        const sw = moving ? Math.sin(t * 10) : 0;
        legs[0].rotation.x = sw * 0.7; legs[1].rotation.x = -sw * 0.7;
        arms[0].rotation.x = -sw * 0.6; arms[1].rotation.x = sw * 0.6;
        rig.position.y = moving ? Math.abs(Math.cos(t * 10)) * 0.04 : Math.sin(t * 2) * 0.006;
        head.rotation.z = moving ? 0 : Math.sin(t * 0.8) * 0.03;
        tg.rotation.y = moving ? sw * 0.06 : 0;
    }
    return { root, update, height, head, look: L };
}

/** Ma Bellows' workbench with a starter bot waiting on it. */
function buildCapsule(name) {
    const root = new THREE.Group();
    const top = new THREE.Mesh(G('bench', () => new RoundedBoxGeometry(0.95, 0.12, 0.7, 2, 0.03)), cloth('#6a4a2a', 0.8)); top.position.y = 0.56; top.castShadow = top.receiveShadow = true; root.add(top);
    for (const x of [-0.4, 0.4]) for (const z of [-0.28, 0.28]) { const l = new THREE.Mesh(G('blegs', () => new THREE.BoxGeometry(0.07, 0.56, 0.07)), metal('iron')); l.position.set(x, 0.28, z); l.castShadow = true; root.add(l); }
    let bot = null;
    if (name && BY_NAME[name.toLowerCase()]) {
        bot = buildBot(BY_NAME[name.toLowerCase()].id);
        bot.root.scale.multiplyScalar(0.65);
        bot.root.position.y = 0.62;
        root.add(bot.root);
    }
    const lamp = new THREE.Mesh(G('blamp', () => new THREE.SphereGeometry(0.05, 8, 6)), glow('#ffcc6a', 2)); lamp.position.set(0.38, 0.75, -0.25); root.add(lamp);
    return { root, update(dt) { if (bot) bot.update(dt, 0); }, height: 1.4, head: root, look: { body: 'capsule' } };
}
