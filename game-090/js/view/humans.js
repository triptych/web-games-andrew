// People. Sculpted, not stacked: a lofted body with real shoulders, elbows and knees, a head
// with a jaw, brow, nose and ears and a painted face that is re-drawn for each mood, hair built
// from skull cap and locks, and clothing with collars, belts, hems and glowing seams. Faces +z,
// about 1.9 units tall at scale 1. Used for the Agent and the cast, in the field, in cutscenes
// and as bust portraits.

import * as THREE from 'three';
import { toonMat, part, glow } from './toon.js';
import { loft, tube, ball, deform, carve, planarUV, tint, bake, xform, lock, onShell, smooth } from './sculpt.js';
import { faceTexture, hairTexture, clothTexture, FACE, hexShade } from './skin.js';
import { CHARS } from '../sim/data/story.js';

export const AGENT_LOOKS = [
    { skin: '#c89070', hair: '#2a2a3a', coat: '#2f8f7a', accent: '#7affd0', eye: '#3ad0b0', hairStyle: 'short' },
    { skin: '#8a5a3c', hair: '#14141e', coat: '#4a5aa8', accent: '#9ab4ff', eye: '#6a86ff', hairStyle: 'bun' },
    { skin: '#f0c8a8', hair: '#c8742a', coat: '#c8683a', accent: '#ffc07a', eye: '#e8903a', hairStyle: 'spiky' },
    { skin: '#e0b090', hair: '#e8e8f0', coat: '#d8d8e0', accent: '#ff7ae0', eye: '#c04ad8', hairStyle: 'ponytail' },
];

const HEAD = { rx: 0.125, ry: 0.17, rz: 0.15, cy: 0.17 };
const PI = Math.PI;
const gauss = (d) => Math.exp(-d * d);

// [y from the head's centre, half-width, half-depth, forward shift of the ring, squareness]
const PROF = [
    [-0.168, 0.036, 0.062, 0.058, 2.6], [-0.158, 0.05, 0.078, 0.05, 2.6], [-0.138, 0.068, 0.098, 0.034, 2.6], [-0.108, 0.088, 0.118, 0.018, 2.5], [-0.07, 0.106, 0.134, 0.008, 2.4],
    [-0.02, 0.118, 0.147, 0.0, 2.2], [0.04, 0.125, 0.152, -0.004, 2.1], [0.1, 0.122, 0.15, -0.006, 2.0], [0.145, 0.106, 0.14, -0.008, 2.0], [0.17, 0.07, 0.115, -0.01, 2.0], [0.18, 0.03, 0.07, -0.01, 2.0], [0.184, 0.004, 0.01, -0.01, 2.0],
];
/** The skull profile as n smooth rings, grown by `s` (hair and beard shells are slightly larger). */
function profRings(s = 1, n = 30, lift = 0) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const f = (i / (n - 1)) * (PROF.length - 1), k = Math.min(PROF.length - 2, Math.floor(f)), t = f - k;
        const A = PROF[k], B = PROF[k + 1], m = (j) => A[j] + (B[j] - A[j]) * t;
        out.push({ y: m(0) * s + lift, rx: Math.max(0.003, m(1) * s), rz: Math.max(0.006, m(2) * s), z: m(3) * s, sq: m(4) });
    }
    return out;
}

/**
 * The skull, built ring by ring from the chin up so the jaw is a real shape: a flat, forward chin,
 * a jaw that narrows toward it, cheekbones, a wide brow and a rounded crown. Then a nose, brow
 * ridge, lips and eye sockets are pushed out of the front.
 */
function headGeo() {
    const g = loft(profRings(1, 34), { seg: 40, caps: true });
    deform(g, (x, y, z, o) => {
        if (z > 0) {
            z += 0.034 * gauss(Math.hypot(x / 0.02, (y + 0.012) / 0.034));               // nose
            z += 0.012 * gauss(Math.hypot(x / 0.026, (y + 0.03) / 0.012));               // tip
            z += 0.008 * gauss(((y - 0.062) / 0.02)) * gauss(x / 0.1);                   // brow
            for (const sd of [-1, 1]) z -= 0.007 * gauss(Math.hypot((x - sd * 0.054) / 0.03, (y - 0.014) / 0.02)); // sockets
            z += 0.007 * gauss(Math.hypot(x / 0.032, (y + 0.09) / 0.012));               // lips
            z -= 0.006 * gauss(Math.hypot(x / 0.04, (y + 0.118) / 0.01));                // under-lip dent
        }
        o[0] = x; o[1] = y; o[2] = z;
    });
    planarUV(g, 0, 0, FACE.w, FACE.h);
    g.translate(0, HEAD.cy, 0);
    return g;
}

function earGeo(sd) {
    const g = ball(0.012, 0.03, 0.022, { seg: 10, rings: 8 }, (x, y, z, o) => { o[0] = x; o[1] = y; o[2] = z - 0.01 * Math.abs(y / 0.03); });
    return xform(g, { r: [0, sd * 0.35, 0], p: [sd * 0.124, HEAD.cy - 0.005, -0.005] });
}

// ---------------------------------------------------------------- hair
function hairParts(style, color) {
    const { rx, ry, rz } = HEAD, c = HEAD.cy;
    const R = [rx * 1.07, ry * 1.06, rz * 1.09];
    // a skull cap whose lower edge is bent onto the hairline: high at the brow, low at the nape
    const cap = loft(profRings(1.07, 36, 0.004), { seg: 48 });
    deform(cap, (x, y, z, o) => {
        const front = smooth(-0.01, 0.09, z);
        const hf = Math.max(-0.005, ry * (0.7 - 0.9 * Math.pow(Math.abs(x / rx), 3)));
        const hb = -0.085 + 0.085 * smooth(rx * 0.68, rx * 1.0, Math.abs(x));
        const H = hb + (hf - hb) * front;
        o[0] = x; o[1] = Math.max(y, H); o[2] = z;
    });
    const parts = [cap];
    const L = (az0, el0, az1, el1, o) => lock(R[0], R[1], R[2], az0, el0, az1, el1, o);
    const fringe = (n, sweep, w = 0.034, el1 = 0.42) => {
        for (let k = 0; k < n; k++) {
            const t = n === 1 ? 0 : k / (n - 1) - 0.5;
            parts.push(L(t * 0.9, 1.0, t * 1.5 + sweep, el1 - Math.abs(t) * 0.18, { w, bump: 0.065, out1: 1.05, flat: 0.45 }));
        }
    };
    const burns = (len = -0.25, w = 0.028) => { for (const sd of [-1, 1]) parts.push(L(sd * 1.42, 0.45, sd * 1.52, len * 0.55 + 0.05, { w, bump: 0.03, out0: 1.0, out1: 1.0 })); };
    const back = (n = 5, low = -0.3) => { for (let k = 0; k < n; k++) { const a = PI + (k / (n - 1) - 0.5) * 1.5; parts.push(L(a, 1.0, a * 0.99 + (k % 2 ? 0.1 : -0.1), low - (k % 2) * 0.1, { w: 0.04, bump: 0.05, out1: 1.0 })); } };
    switch (style) {
        case 'short': fringe(5, 0.5); burns(-0.15); back(5, -0.1); break;
        case 'bun': {
            fringe(5, 0, 0.032, 0.35); burns(-0.55, 0.026); back(4, -0.1);
            parts.push(xform(ball(0.07, 0.065, 0.07, { seg: 14, rings: 10 }), { p: [0, 0.145, -0.14] }));
            parts.push(xform(loft([{ y: -0.01, rx: 0.058, rz: 0.058 }, { y: 0.01, rx: 0.062, rz: 0.062 }], { seg: 12 }), { r: [0.6, 0, 0], p: [0, 0.11, -0.13] }));
            break;
        }
        case 'spiky': {
            fringe(4, 0.2, 0.04, 0.5);
            for (let k = 0; k < 9; k++) {
                const a = (k / 9) * PI * 2, el = 0.95 - (k % 3) * 0.12;
                const p0 = onShell(...R, a, el, 1.0), p1 = onShell(...R, a, el, 1.45), p2 = onShell(...R, a + 0.14, el + 0.05, 1.95);
                parts.push(tube([p0, p1, p2], [0.045, 0.036, 0.004], { seg: 6, n: 8, flat: 0.8 }));
            }
            burns(-0.1); break;
        }
        case 'ponytail': {
            fringe(5, -0.4, 0.034, 0.4); burns(-0.5, 0.026);
            parts.push(tube([[0, 0.1, -0.14], [0, 0.07, -0.24], [0, -0.05, -0.3], [0, -0.22, -0.28], [0, -0.38, -0.24]], [0.05, 0.062, 0.058, 0.04, 0.008], { seg: 8, n: 18, flat: 0.8 }));
            parts.push(xform(loft([{ y: -0.012, rx: 0.058, rz: 0.058 }, { y: 0.012, rx: 0.06, rz: 0.06 }], { seg: 10 }), { r: [-1.1, 0, 0], p: [0, 0.095, -0.17] }));
            break;
        }
        case 'braids': {
            fringe(5, 0.1, 0.034, 0.4);
            for (const sd of [-1, 1]) {
                const path = [[sd * 0.12, 0.02, -0.04], [sd * 0.15, -0.12, 0.0], [sd * 0.16, -0.28, 0.04], [sd * 0.15, -0.44, 0.07], [sd * 0.14, -0.58, 0.08]];
                parts.push(tube(path, [0.032, 0.036, 0.036, 0.03, 0.012], { seg: 8, n: 20, flat: 0.9 }));
                for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6; const p = path[Math.min(3, Math.floor(t * 4))]; parts.push(xform(ball(0.034, 0.03, 0.034, { seg: 8, rings: 6 }), { p: [p[0] * 1.0, -0.06 - i * 0.092, p[2] + i * 0.007] })); }
            }
            break;
        }
        case 'leaves': {
            fringe(4, 0, 0.034, 0.44); burns(-0.35, 0.026);
            const leafc = ['#4a9a3a', '#6ac04a', '#8ae05a'];
            for (let k = 0; k < 9; k++) {
                const a = (k / 9) * PI * 2 + 0.3, el = 0.9 - (k % 2) * 0.25;
                const p0 = onShell(...R, a, el, 0.98), p1 = onShell(...R, a + 0.1, el + 0.12, 1.55), p2 = onShell(...R, a + 0.25, el + 0.05, 2.1);
                const g = tube([p0, p1, p2], [0.012, 0.05, 0.003], { seg: 6, n: 10, flat: 0.16 });
                parts.push(tint(g, leafc[k % 3], { ao: 0.15 }));
            }
            break;
        }
        default: fringe(5, 0.3); burns(); back();
    }
    // ears of hair aside, everything moves up to the head's centre
    for (const g of parts) g.translate(0, c, 0);
    return parts;
}

// ---------------------------------------------------------------- the body
const SKIN_TONE = (s) => s;

function matSkin() { return toonMat({ vertexColors: true, steps: 3 }); }

/**
 * look: { skin, hair, coat, accent, eye, hairStyle, beard, goggles, scarf, pockets, tall, weapon,
 *   build ('slim'|'std'|'broad'|'soft'), epaulettes, hat, vines, vest, pants }
 * Returns { root, joints, look, setMood, pose(state, t) }.
 */
export function buildHuman(look = {}) {
    const L = { skin: '#c89070', hair: '#222', coat: '#446', accent: '#7affd0', hairStyle: 'short', tall: 1, build: 'std', ...look };
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    body.scale.setScalar(L.tall);
    const pants = L.pants || '#232832', boot = '#14161c';
    const bw = { slim: 0.94, std: 1, broad: 1.14, soft: 1.04 }[L.build] || 1;       // shoulder width
    const ww = { slim: 0.92, std: 1, broad: 1.12, soft: 1.1 }[L.build] || 1;        // waist
    const hw = { slim: 0.95, std: 1, broad: 1.04, soft: 1.12 }[L.build] || 1;       // hips
    const trim = L.accent, coatDark = hexShade(L.coat, 0.62), coatLite = hexShade(L.coat, 1.25);
    const cloth = toonMat({ vertexColors: true, map: clothTexture('twill'), steps: 3 });
    const leather = toonMat({ vertexColors: true, map: clothTexture('leather'), steps: 3 });
    const skinM = matSkin();
    const P = (geo, mat, w = 0.012) => part(geo, { mat, outline: w });

    // ----- legs: hip pivots, knee pivots
    const mkLeg = (sd) => {
        const pivot = new THREE.Group(); pivot.position.set(sd * 0.095 * hw, 0.93, 0);
        const thigh = tint(loft([{ y: 0.04, rx: 0.085 * hw, rz: 0.088 }, { y: -0.06, rx: 0.082 * hw, rz: 0.086 }, { y: -0.22, rx: 0.07, rz: 0.074 }, { y: -0.43, rx: 0.054, rz: 0.056 }], { seg: 14 }), pants, { ao: 0.3 });
        pivot.add(P(thigh, cloth));
        const knee = new THREE.Group(); knee.position.y = -0.43; pivot.add(knee);
        const kneeCap = tint(ball(0.056, 0.05, 0.058, { seg: 12, rings: 9 }), pants, { ao: 0.2 });
        const shin = tint(loft([{ y: 0, rx: 0.054, rz: 0.056 }, { y: -0.1, rx: 0.056, rz: 0.066 }, { y: -0.26, rx: 0.044, rz: 0.05 }, { y: -0.43, rx: 0.036, rz: 0.04 }], { seg: 14 }), pants, { ao: 0.3 });
        const shaft = tint(loft([{ y: -0.14, rx: 0.052, rz: 0.058 }, { y: -0.16, rx: 0.058, rz: 0.064 }, { y: -0.3, rx: 0.049, rz: 0.054 }, { y: -0.43, rx: 0.046, rz: 0.05 }], { seg: 14 }), boot, { ao: 0.3 });
        const cuff = tint(loft([{ y: -0.135, rx: 0.06, rz: 0.066 }, { y: -0.17, rx: 0.06, rz: 0.066 }], { seg: 14 }), trim, { ao: 0.1 });
        const foot = tint(ball(0.05, 0.04, 0.115, { seg: 14, rings: 10 }, (x, y, z, o) => { o[0] = x * (1 + 0.15 * smooth(-0.04, 0.1, z)); o[1] = y - 0.01 * smooth(0.02, 0.1, z) * 0; o[2] = z; }), boot, { ao: 0.35 });
        xform(foot, { p: [0, -0.43 - 0.012, 0.035] });
        const heel = xform(tint(ball(0.044, 0.032, 0.05, { seg: 8, rings: 6 }), '#0a0b0e', { ao: 0.2 }), { p: [0, -0.452, -0.03] });
        knee.add(P(bake([kneeCap, shin]), cloth, 0.011), P(bake([shaft, cuff, foot, heel]), leather, 0.011));
        body.add(pivot);
        return { pivot, knee };
    };
    const legL = mkLeg(-1), legR = mkLeg(1);

    // ----- torso: a fitted jacket, collar, belt, glowing seams
    const sh = 0.205 * bw;
    const jacket = tint(loft([
        { y: 0.88, rx: 0.17 * hw, rz: 0.115, sq: 2.4 },
        { y: 1.0, rx: 0.155 * ww, rz: 0.105, sq: 2.4 },
        { y: 1.12, rx: 0.17 * ww, rz: 0.112, sq: 2.5 },
        { y: 1.26, rx: 0.195 * bw, rz: 0.122, sq: 2.7 },
        { y: 1.38, rx: sh + 0.02, rz: 0.118, sq: 2.7 },
        { y: 1.45, rx: sh - 0.03, rz: 0.098, sq: 2.4 },
        { y: 1.5, rx: 0.085, rz: 0.08 },
    ], { seg: 18 }), L.coat, { top: coatLite, ao: 0.35, curve: 0.8 });
    const collar = tint(loft([{ y: 1.44, rx: 0.112, rz: 0.098 }, { y: 1.51, rx: 0.098, rz: 0.088 }, { y: 1.57, rx: 0.108, rz: 0.098, sq: 2.3 }], { seg: 16 }), hexShade(L.coat, 0.85), { ao: 0.2 });
    const collarTrim = tint(loft([{ y: 1.555, rx: 0.106, rz: 0.096, sq: 2.3 }, { y: 1.58, rx: 0.11, rz: 0.1, sq: 2.3 }], { seg: 16 }), trim, { ao: 0 });
    const belt = tint(loft([{ y: 0.97, rx: 0.16 * ww, rz: 0.11, sq: 2.4 }, { y: 1.03, rx: 0.16 * ww, rz: 0.11, sq: 2.4 }], { seg: 18 }), '#1c1a1a', { ao: 0.1 });
    const buckle = tint(ball(0.025, 0.022, 0.012, { seg: 8, rings: 6 }), '#e8d8a0', { ao: 0 }); xform(buckle, { p: [0, 1.0, 0.112] });
    const neck = tint(loft([{ y: 1.42, rx: 0.056, rz: 0.058 }, { y: 1.6, rx: 0.05, rz: 0.054 }], { seg: 12 }), L.skin, { ao: 0.4 });
    const torsoParts = [jacket, belt, buckle];
    if (L.vest) torsoParts.push(tint(loft([{ y: 1.0, rx: 0.166, rz: 0.116, sq: 2.4 }, { y: 1.2, rx: 0.2, rz: 0.13, sq: 2.6 }, { y: 1.4, rx: 0.2, rz: 0.12, sq: 2.6 }], { seg: 18 }), L.vest, { ao: 0.3 }));
    const torso = new THREE.Group();
    torso.add(P(bake(torsoParts), cloth, 0.013), P(bake([collar]), cloth, 0.012), P(bake([collarTrim]), leather, 0.006), P(neck, skinM, 0.008));
    // seams: a front placket and shoulder lines in glowing thread
    const seamPts = [[0, 1.42, 0.118], [0, 1.26, 0.128], [0, 1.1, 0.116], [0, 0.99, 0.112]];
    torso.add(glow(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPts.map((p) => new THREE.Vector3(...p))), 8, 0.0035, 4), trim));
    for (const sd of [-1, 1]) {
        const lp = [[sd * 0.1, 1.46, 0.09], [sd * 0.12, 1.34, 0.118], [sd * 0.11, 1.18, 0.114]];
        torso.add(glow(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lp.map((p) => new THREE.Vector3(...p))), 8, 0.0028, 4), trim));
    }
    body.add(torso);

    // ----- coat tails: sway with the stride
    const skirt = new THREE.Group(); skirt.position.set(0, 0.98, 0);
    if (L.tails !== false) {
        const hem = (a) => 0.045 * Math.cos(a * 4) + 0.02 * Math.sin(a * 7);
        const tails = tint(loft([
            { y: 0.0, rx: 0.16 * ww, rz: 0.112, sq: 2.4 },
            { y: -0.14, rx: 0.2 * hw, rz: 0.14, sq: 2.3 },
            { y: -0.34, rx: 0.245 * hw, rz: 0.17, sq: 2.1, wob: (a) => hem(a) * 0.4 },
            { y: -0.52, rx: 0.27 * hw, rz: 0.19, sq: 2.0, wob: hem },
        ], { seg: 22 }), L.coat, { top: coatLite, ao: 0.4, curve: 0.5 });
        carve(tails, (x, y, z) => !(z > 0 && Math.abs(x) < 0.052 && y < 0.1));
        const hemTrim = tint(loft([{ y: -0.5, rx: 0.268 * hw, rz: 0.188, sq: 2.0, wob: hem }, { y: -0.53, rx: 0.272 * hw, rz: 0.192, sq: 2.0, wob: hem }], { seg: 22 }), trim, { ao: 0 });
        carve(hemTrim, (x, y, z) => !(z > 0 && Math.abs(x) < 0.052));
        skirt.add(P(tails, cloth, 0.013), P(hemTrim, leather, 0.006));
        if (L.pockets) for (const sd of [-1, 1]) skirt.add(P(tint(ball(0.05, 0.055, 0.025, { seg: 8, rings: 6 }), '#a8742a', { ao: 0.2 }), leather, 0.008)).children.at(-1).position.set(sd * 0.145, -0.2, 0.12);
    }
    body.add(skirt);

    // ----- arms: shoulder pivots, elbow pivots, hands
    const mkArm = (sd) => {
        const pivot = new THREE.Group(); pivot.position.set(sd * (sh + 0.025), 1.4, 0);
        const sleeve = tint(loft([{ y: 0.04, rx: 0.062, rz: 0.062 }, { y: -0.05, rx: 0.066, rz: 0.066 }, { y: -0.16, rx: 0.056, rz: 0.058 }, { y: -0.3, rx: 0.046, rz: 0.048 }], { seg: 12 }), L.coat, { ao: 0.3 });
        const cap = tint(ball(0.07, 0.065, 0.07, { seg: 12, rings: 9 }), L.coat, { top: coatLite, ao: 0.25 });
        pivot.add(P(bake([sleeve, cap]), cloth, 0.012));
        const elbow = new THREE.Group(); elbow.position.y = -0.3; pivot.add(elbow);
        const joint = tint(ball(0.048, 0.044, 0.05, { seg: 10, rings: 8 }), L.coat, { ao: 0.2 });
        const fore = tint(loft([{ y: 0, rx: 0.046, rz: 0.048 }, { y: -0.08, rx: 0.048, rz: 0.05 }, { y: -0.22, rx: 0.038, rz: 0.04 }, { y: -0.28, rx: 0.036, rz: 0.038 }], { seg: 12 }), L.coat, { ao: 0.3 });
        const cuff = tint(loft([{ y: -0.2, rx: 0.042, rz: 0.044 }, { y: -0.27, rx: 0.044, rz: 0.046 }], { seg: 12 }), trim, { ao: 0.05 });
        elbow.add(P(bake([joint, fore]), cloth, 0.011), P(cuff, leather, 0.006));
        const hand = tint(loft([{ y: -0.275, rx: 0.03, rz: 0.02 }, { y: -0.32, rx: 0.038, rz: 0.022 }, { y: -0.37, rx: 0.036, rz: 0.021 }, { y: -0.415, rx: 0.026, rz: 0.016 }, { y: -0.43, rx: 0.008, rz: 0.006 }], { seg: 10 }), L.glove || L.skin, { ao: 0.35 });
        const thumb = tint(tube([[sd * 0.028, -0.3, 0.012], [sd * 0.052, -0.34, 0.026], [sd * 0.05, -0.375, 0.04]], [0.011, 0.011, 0.007], { seg: 6, n: 6 }), L.glove || L.skin, { ao: 0.3 });
        elbow.add(P(bake([hand, thumb]), skinM, 0.009));
        body.add(pivot);
        return { pivot, elbow };
    };
    const armL = mkArm(-1), armR = mkArm(1);

    // ----- shoulder gear
    if (L.epaulettes) for (const a of [armL, armR]) {
        a.pivot.add(P(tint(ball(0.085, 0.022, 0.07, { seg: 10, rings: 6 }), L.epaulettes, { ao: 0.1 }), leather, 0.008)).children.at(-1).position.set(0, 0.062, 0);
    }
    if (L.pauldron) armR.pivot.add(P(bake([tint(ball(0.095, 0.07, 0.09, { seg: 12, rings: 8 }, (x, y, z, o) => { o[0] = x; o[1] = Math.max(y, -0.01); o[2] = z; }), coatDark, { ao: 0.2 }), xform(tint(loft([{ y: 0.0, rx: 0.098, rz: 0.093 }, { y: 0.012, rx: 0.1, rz: 0.095 }], { seg: 12 }), trim, { ao: 0 }), { p: [0, 0.0, 0] })]), leather, 0.01)).children.at(-1).position.set(0.008, 0.04, 0);
    // the Grafter: a wrist device with a glowing face
    if (L.grafter) {
        const dev = P(bake([tint(loft([{ y: -0.12, rx: 0.056, rz: 0.058, sq: 3 }, { y: -0.2, rx: 0.058, rz: 0.06, sq: 3 }], { seg: 10 }), '#252a34', { ao: 0.2 })]), leather, 0.008);
        armL.elbow.add(dev);
        const scr = glow(new THREE.PlaneGeometry(0.05, 0.045), trim, { p: [-0.0, -0.16, 0.062] }); scr.rotation.x = 0; armL.elbow.add(scr);
    }

    // ----- head
    const head = new THREE.Group(); head.position.set(0, 1.58, 0); body.add(head);
    const face = faceTexture(L, 512);
    const faceMat = toonMat({ map: face.tex, color: '#ffffff', steps: 4, flash: { value: 0 } });
    faceMat.userData.keepMaps = false;
    const hg = headGeo();
    head.add(part(hg, { mat: faceMat, outline: 0.008 }));
    const earG = bake([earGeo(-1), earGeo(1)]); tint(earG, hexShade(L.skin, 0.95), { ao: 0.3 });
    head.add(part(earG, { mat: skinM, outline: 0.007 }));
    const hairM = toonMat({ map: hairTexture(L.hair), vertexColors: true, color: '#ffffff', steps: 3 });
    const hp = hairParts(L.hairStyle, L.hair);
    for (const g of hp) tint(g, '#ffffff', { ao: 0.28 });
    head.add(part(bake(hp), { mat: hairM, outline: 0.007 }));
    if (L.beard) {
        const { rx, ry, rz } = HEAD;
        const b = loft(profRings(1.06, 30, 0), { seg: 36 });
        carve(b, (x, y, z) => (z > -0.01 && y < -0.045 && y > -0.2 && !(y > -0.085 && Math.abs(x) < 0.055 && z > 0.1)) || (z < -0.01 && y < -0.1 && Math.abs(x) > 0.06));
        b.translate(0, HEAD.cy, 0);
        const must = [-1, 1].map((sd) => tube([[sd * 0.004, 0.103, 0.158], [sd * 0.03, 0.095, 0.158], [sd * 0.062, 0.076, 0.14]], [0.014, 0.017, 0.006], { seg: 6, n: 8, flat: 0.7 }));
        const bg = [b, ...must]; for (const g of bg) tint(g, '#ffffff', { ao: 0.25 });
        head.add(part(bake(bg), { mat: hairM, outline: 0.01 }));
    }
    if (L.goggles) {
        const gg = [-1, 1].map((sd) => tint(tube(Array.from({ length: 9 }, (_, i) => { const a = (i / 8) * PI * 2; return [sd * 0.055 + Math.cos(a) * 0.044, 0.275 + Math.sin(a) * 0.044, 0.118]; }).concat([[sd * 0.055 + 0.044, 0.275, 0.118]]), 0.011, { seg: 6, n: 20 }), '#2a2a30', { ao: 0.1 }));
        const strap = tint(loft([{ y: 0.255, rx: 0.138, rz: 0.158 }, { y: 0.295, rx: 0.138, rz: 0.158 }], { seg: 24 }), '#1c1c22', { ao: 0.1 });
        carve(strap, (x, y, z) => z < 0.0 || Math.abs(x) > 0.1);
        head.add(P(bake([...gg, strap]), leather, 0.006));
        for (const sd of [-1, 1]) { const lens = glow(new THREE.CircleGeometry(0.04, 14), trim, { opacity: 0.8 }); lens.position.set(sd * 0.055, 0.275, 0.122); head.add(lens); }
    }
    if (L.hat) {
        // a wide-brimmed hat with a band and a feather: Quill spends the money on these
        const crown = tint(loft([{ y: 0, rx: 0.138, rz: 0.15, sq: 2.2 }, { y: 0.05, rx: 0.126, rz: 0.138, sq: 2.3 }, { y: 0.12, rx: 0.115, rz: 0.126, sq: 2.6 }, { y: 0.155, rx: 0.09, rz: 0.1, sq: 2.6 }, { y: 0.16, rx: 0.02, rz: 0.02 }], { seg: 20 }), L.hat, { top: hexShade(L.hat, 1.3), ao: 0.3 });
        const brim = tint(loft([{ y: -0.012, rx: 0.19, rz: 0.2, sq: 2 }, { y: 0.004, rx: 0.2, rz: 0.21, sq: 2 }, { y: 0.02, rx: 0.14, rz: 0.152, sq: 2 }], { seg: 24 }), hexShade(L.hat, 0.9), { ao: 0.2 });
        const band = tint(loft([{ y: 0.012, rx: 0.14, rz: 0.152, sq: 2.2 }, { y: 0.05, rx: 0.13, rz: 0.142, sq: 2.3 }], { seg: 20 }), L.accent, { ao: 0.1 });
        const feather = tint(tube([[0.1, 0.05, 0.04], [0.16, 0.12, 0.0], [0.19, 0.2, -0.08], [0.15, 0.24, -0.16]], [0.006, 0.026, 0.02, 0.003], { seg: 6, n: 12, flat: 0.25 }), '#e84a3a', { ao: 0.15 });
        const hatG = bake([crown, brim, band, feather]);
        const hm = new THREE.Group(); hm.position.set(0, 0.29, 0); hm.rotation.set(-0.12, 0, 0.06);
        hm.add(P(hatG, cloth, 0.009));
        head.add(hm);
    }
    if (L.scarf) {
        const wrap = tint(loft([{ y: 1.44, rx: 0.13, rz: 0.115 }, { y: 1.5, rx: 0.14, rz: 0.125 }, { y: 1.56, rx: 0.125, rz: 0.11 }], { seg: 16 }), L.scarf, { ao: 0.3 });
        const tailG = tint(tube([[0.1, 1.5, -0.1], [0.14, 1.36, -0.15], [0.12, 1.14, -0.2], [0.14, 0.95, -0.2]], [0.045, 0.05, 0.05, 0.03], { seg: 8, n: 16, flat: 0.25 }), L.scarf, { ao: 0.3 });
        torso.add(P(bake([wrap, tailG]), cloth, 0.011));
    }
    if (L.vines) {
        const v = tint(tube([[-0.2, 1.45, 0.08], [-0.12, 1.25, 0.13], [0.1, 1.1, 0.13], [0.2, 0.85, 0.08], [0.1, 0.62, 0.15], [-0.15, 0.55, 0.14]], 0.014, { seg: 6, n: 30 }), '#4a8a3a', { ao: 0.3 });
        const leaves = Array.from({ length: 8 }, (_, i) => { const t = i / 7; return xform(tint(tube([[0, 0, 0], [0.03, 0.05, 0.02], [0.06, 0.09, 0.0]], [0.003, 0.028, 0.002], { seg: 6, n: 6, flat: 0.2 }), '#7ac84a', { ao: 0.15 }), { p: [lerp3(-0.2, 0.2, t), 1.45 - t * 0.75, 0.13], r: [0.4, t * 3, 0.3 + t] }); });
        torso.add(P(bake([v, ...leaves]), cloth, 0.008));
    }

    // ----- weapons: a blade at the right hand, a sidearm at the left hip
    let blade = null, gun = null;
    if (L.weapon) {
        blade = new THREE.Group();
        const hilt = tint(loft([{ y: -0.12, rx: 0.016, rz: 0.016 }, { y: 0.08, rx: 0.018, rz: 0.018 }], { seg: 8 }), '#2a2420', { ao: 0.2 });
        const guard = tint(ball(0.07, 0.014, 0.025, { seg: 10, rings: 6 }), trim, { ao: 0.1 }); xform(guard, { p: [0, 0.09, 0] });
        const bl = tint(loft([{ y: 0.1, rx: 0.026, rz: 0.008 }, { y: 0.5, rx: 0.028, rz: 0.008 }, { y: 0.9, rx: 0.02, rz: 0.006 }, { y: 1.0, rx: 0.002, rz: 0.002 }], { seg: 8 }), '#dfe8f0', { top: '#ffffff', ao: 0.2 });
        blade.add(P(bake([hilt, guard, bl]), leather, 0.007));
        blade.add(glow(new THREE.BoxGeometry(0.008, 0.82, 0.014), trim, { p: [0, 0.54, 0], opacity: 0.7 }));
        blade.position.set(0, -0.37, 0.03); blade.rotation.x = PI / 2 - 0.2;
        armR.elbow.add(blade);
        gun = P(bake([tint(loft([{ y: -0.05, rx: 0.025, rz: 0.06, sq: 3 }, { y: 0.05, rx: 0.028, rz: 0.07, sq: 3 }], { seg: 8 }), '#2a2e38', { ao: 0.2 }), xform(tint(loft([{ y: -0.015, rx: 0.012, rz: 0.012 }, { y: 0.015, rx: 0.012, rz: 0.012 }], { seg: 6 }), '#11141a', { ao: 0 }), { p: [0, 0.03, 0.1], r: [PI / 2, 0, 0] })]), leather, 0.007);
        gun.position.set(-0.22, 0.86, 0.06);
        body.add(gun);
    }

    // ----- the face rig: head tilt and mood
    const J = { legL: legL.pivot, legR: legR.pivot, kneeL: legL.knee, kneeR: legR.knee, armL: armL.pivot, armR: armR.pivot, elbowL: armL.elbow, elbowR: armR.elbow, head, torso, skirt, body, blade, gun };
    const api = { root, joints: J, look: L };
    api.setMood = (m = 'neutral') => { face.draw(m); head.userData.mood = m; };
    api.setMood('neutral');

    /**
     * state: { move: 0..1 (walk), run: bool, atk: 0..1 progress of a swing, hurt: 0..1, down: 0..1,
     *          cast: 0..1, guard: bool, talk: bool }
     */
    api.pose = (s, t) => {
        const w = s.move || 0, sp = s.run ? 11 : 7;
        const ph = t * sp;
        const swing = Math.sin(ph) * 0.85 * w;
        J.legL.rotation.x = swing; J.legR.rotation.x = -swing;
        J.kneeL.rotation.x = Math.max(0, -Math.sin(ph + 0.6)) * 0.9 * w; J.kneeR.rotation.x = Math.max(0, Math.sin(ph + 0.6)) * 0.9 * w;
        J.armL.rotation.x = -swing * 0.9; J.armR.rotation.x = swing * 0.9;
        J.armL.rotation.z = 0.08; J.armR.rotation.z = -0.08;
        J.elbowL.rotation.x = -(0.14 + Math.max(0, swing) * 0.6 + (s.run ? 0.6 : 0)); J.elbowR.rotation.x = -(0.14 + Math.max(0, -swing) * 0.6 + (s.run ? 0.6 : 0));
        body.position.y = Math.abs(Math.sin(ph)) * 0.05 * w + (1 - w) * Math.sin(t * 1.8) * 0.008;
        torso.rotation.y = Math.sin(ph) * 0.1 * w;
        skirt.rotation.x = -0.1 * Math.abs(Math.sin(ph)) * w - 0.05 * w; skirt.rotation.z = Math.sin(ph) * 0.04 * w;
        head.rotation.y = s.talk ? Math.sin(t * 2.2) * 0.08 : 0;
        head.rotation.x = 0;
        body.rotation.x = 0; body.rotation.z = 0; body.position.z = 0;
        if (s.run) body.rotation.x = 0.2;
        if (s.atk > 0) {
            const k = s.atk, sw = Math.sin(Math.min(1, k) * PI);
            J.armR.rotation.x = -2.4 + k * 3.2; J.armR.rotation.z = -0.2; J.elbowR.rotation.x = -0.1;
            torso.rotation.y = -0.5 + k * 1.0;
            body.position.z = sw * 0.25; body.rotation.x = sw * 0.25;
        }
        if (s.cast > 0) {
            J.armL.rotation.x = -2.2; J.armR.rotation.x = -2.2; J.armL.rotation.z = 0.5; J.armR.rotation.z = -0.5; J.elbowL.rotation.x = J.elbowR.rotation.x = -0.35;
            head.rotation.x = -0.25;
            body.position.y += Math.sin(s.cast * PI) * 0.15;
        }
        if (s.guard) { J.armL.rotation.x = -1.6; J.armR.rotation.x = -1.6; J.armL.rotation.z = -0.5; J.armR.rotation.z = 0.5; J.elbowL.rotation.x = J.elbowR.rotation.x = -1.2; body.rotation.x = 0.25; }
        if (s.hurt > 0) { body.rotation.x = -0.4 * s.hurt; body.position.z = -0.25 * s.hurt; head.rotation.x = -0.3 * s.hurt; }
        if (s.down > 0) { body.rotation.x = -1.35 * s.down; body.position.y = -0.55 * s.down; body.position.z = -0.1 * s.down; }
    };
    return api;
}
const lerp3 = (a, b, t) => a + (b - a) * t;

/** The cast, by id: Agent looks come from AGENT_LOOKS. */
export function buildCast(id, { look = 0, weapon = false } = {}) {
    if (id === 'agent') return buildHuman({ ...AGENT_LOOKS[look % AGENT_LOOKS.length], weapon: true, grafter: true, pauldron: true, tall: 1.0, build: 'std' });
    const c = CHARS[id];
    if (!c || !c.look) return null;
    return buildHuman({ ...c.look, ...(CAST_EXTRA[id] || {}), weapon });
}

// extra styling for the cast that does not belong in the story data
const CAST_EXTRA = {
    dov: { build: 'broad', epaulettes: '#d8a43a', eye: '#a8742a' },
    wren: { build: 'slim', vest: '#1c5a6a', pockets: true, eye: '#3acfe8' },
    ilsa: { build: 'soft', eye: '#d83a4a' },
    maple: { build: 'slim', vines: true, tails: true, eye: '#6ab83a' },
    quill: { build: 'std', hat: '#7a3a1a', vest: '#c8884a', eye: '#e89a2a', hairStyle: 'short' },
};
