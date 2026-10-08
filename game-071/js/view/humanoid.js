/**
 * humanoid.js — people, wight, skeletons, trolls, giants, gloomkin, golems, sentinels and
 * the wyrm hierophant, built from one parametric skeleton; plus their clothes, armour and weapons.
 */
import * as THREE from 'three';
import { PartBuilder, M } from './rig.js';
import { ITEMS } from '../sim/items.js';
import { KIN } from '../sim/stats.js';

const C = (r, g, b) => new THREE.Color(r, g, b).getHex();
const MAT_COLOR = {
    iron: 0x6f6c68, steel: 0xa4a9ae, hill: 0x4f5a3c, deep: 0xb08a45, glimmer: 0xd6b95e, crystal: 0x7fd6a0, night: 0x23252c, dread: 0x3a1210, dragon: 0xd8d0b8,
    hide: 0x7a5a3a, leather: 0x5c3e26, scaled: 0x6b6a5a, dscale: 0x5a7a6a, plate: 0xb4b8be, dplate: 0xd8d0b8, ancient: 0x5a6a5a, chitin: 0x8a7a5a, bound: 0x6aa8ff, cloth: 0x888888,
};
const MAT_KIND = { iron: M.metal, steel: M.metal, hill: M.metal, deep: M.gold, glimmer: M.gold, crystal: M.crystal, night: M.metal, dread: M.metal, dragon: M.bone, hide: M.leather, leather: M.leather, scaled: M.scale, dscale: M.scale, plate: M.metal, dplate: M.bone, ancient: M.metal, chitin: M.bone, bound: M.glow };

/** Height of the head's centre for a 1.8 m figure (chin about 1.57 m, crown 1.8 m). */
const HY = 1.685;

/** Bind-pose skeleton (1.8 m tall); `p` gives proportions. */
function skeleton(B, p) {
    const s = p.h / 1.8, sw = p.shoulder, hw = p.hip;
    B.bone('root', null, 0, 0, 0);
    B.bone('pelvis', 'root', 0, 0.98 * s, 0);
    B.bone('spine', 'pelvis', 0, 1.12 * s, 0.0);
    B.bone('chest', 'spine', 0, 1.32 * s, 0);
    B.bone('neck', 'chest', 0, 1.47 * s, 0);
    B.bone('head', 'neck', 0, 1.57 * s, 0);
    for (const [side, sx] of [['R', 1], ['L', -1]]) {
        B.bone(`arm${side}`, 'chest', sx * sw * s, 1.44 * s, 0);
        B.bone(`fore${side}`, `arm${side}`, sx * (sw + 0.02) * s, (1.44 - 0.29 * p.arm) * s, 0);
        B.bone(`hand${side}`, `fore${side}`, sx * (sw + 0.03) * s, (1.44 - 0.55 * p.arm) * s, 0);
        B.bone(`thigh${side}`, 'pelvis', sx * hw * s, 0.93 * s, 0);
        B.bone(`shin${side}`, `thigh${side}`, sx * hw * s, 0.5 * s, 0);
        B.bone(`foot${side}`, `shin${side}`, sx * hw * s, 0.08 * s, 0);
    }
    return s;
}

function proportions(look, body) {
    const f = look?.sex === 'f';
    const b = look?.build || 1;
    const p = { h: f ? 1.7 : 1.8, shoulder: (f ? 0.17 : 0.2) * b, hip: f ? 0.1 : 0.095, arm: 1, girth: (f ? 0.9 : 1) * b, f };
    if (KIN[look?.kin]?.ears) p.h *= 1.03;
    if (look?.kin === 'orsk') { p.girth *= 1.12; p.shoulder *= 1.08; }
    if (body === 'troll') { p.h = 1.9; p.arm = 1.45; p.shoulder = 0.27; p.girth = 1.5; }
    if (body === 'giant') { p.h = 1.8; p.shoulder = 0.24; p.girth = 1.35; }
    if (body === 'gloomkin') { p.h = 1.6; p.girth = 0.85; p.arm = 1.15; }
    if (body === 'wight' || body === 'skeleton') { p.girth = 0.78; }
    if (body === 'sentinel') { p.shoulder = 0.27; p.girth = 1.4; }
    if (body === 'golem') { p.girth = 1.1; p.shoulder = 0.24; }
    return p;
}

// ------------------------------------------------------------------ the torso
/**
 * One smooth torso from the hips to the base of the neck: hips, waist, ribcage, then the
 * shoulder line sloping into the neck (the trapezius). Profile radii are sideways; the
 * cross-section is an ellipse `depth` deep. Returned as [r, y] pairs at y in metres.
 */
function torsoProfile(p, s, g, inflate = 0) {
    const f = p.f;
    const key = [
        [0.875, 0.12], [0.93, f ? 0.178 : 0.162], [1.0, f ? 0.176 : 0.166], [1.08, f ? 0.13 : 0.148], [1.16, f ? 0.138 : 0.153],
        [1.25, f ? 0.158 : 0.172], [1.34, f ? 0.168 : 0.19], [1.41, f ? 0.165 : 0.192], [1.455, f ? 0.148 : 0.172],
        [1.495, f ? 0.105 : 0.122], [1.525, 0.072], [1.545, 0.058],
    ];
    const out = [];
    const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    for (let i = 0; i < key.length - 1; i++) {
        const k0 = key[Math.max(0, i - 1)], k1 = key[i], k2 = key[i + 1], k3 = key[Math.min(key.length - 1, i + 2)];
        const n = i < 8 ? 3 : 2;
        for (let j = 0; j < n; j++) {
            const t = j / n;
            const y = cr(k0[0], k1[0], k2[0], k3[0], t), r = cr(k0[1], k1[1], k2[1], k3[1], t);
            out.push([Math.max(0.01, r * (r > 0.1 ? g : Math.sqrt(g)) + inflate), y * s]);
        }
    }
    const last = key[key.length - 1];
    out.push([last[1] * Math.sqrt(g) + inflate, last[0] * s]);
    return out;
}
/** Lay a torso profile as two lathes (pelvis→spine below the waist, spine→chest above). */
function torsoLathe(B, prof, s, color, mat, depth, opts = {}) {
    const split = 1.12 * s;
    const lo = prof.filter(([, y]) => y <= split + 1e-6), hi = prof.filter(([, y]) => y >= split - 1e-6);
    const at = (y) => { for (let i = 1; i < prof.length; i++) if (prof[i][1] >= y) { const [r0, y0] = prof[i - 1], [r1, y1] = prof[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0 || 1); } return prof[prof.length - 1][0]; };
    if (lo[lo.length - 1][1] < split) lo.push([at(split), split]);
    if (hi[0][1] > split) hi.unshift([at(split), split]);
    const o = { seg: 20, scale: [1, 1, depth], pos: [0, 0, 0.004], ...opts };
    B.lathe('pelvis', lo.map(([r, y]) => [r, y]), color, mat, { ...o, blend: 'spine', blendFrom: 0 });
    B.lathe('spine', hi.map(([r, y]) => [r, y]), color, mat, { ...o, blend: 'chest', blendFrom: 0 });
}

// ------------------------------------------------------------------ the body
function addBody(B, s, p, look, body, skinCol, clothed = false) {
    const g = p.girth;
    const skinM = body === 'skeleton' ? M.bone : body === 'golem' ? (look?.frost ? M.ice : M.glow) : body === 'sentinel' ? M.gold : M.skin;
    const k = skinCol;
    if (body === 'skeleton') {
        B.limb('spine', [0, 0.95 * s, 0], [0, 1.45 * s, 0], 0.03, 0.03, k, M.bone, { seg: 6 });
        for (let i = 0; i < 5; i++) B.lathe('chest', [[0.001, 0], [0.15 * g - i * 0.012, 0.01], [0.15 * g - i * 0.012, 0.025], [0.001, 0.03]], k, M.bone, { pos: [0, (1.22 + i * 0.05) * s, 0.01], scale: [1, 1, 0.75], seg: 10 });
        B.ellipsoid('pelvis', [0, 0.98 * s, 0], [0.13, 0.06, 0.08], k, M.bone);
    } else if (body === 'sentinel') {
        B.ellipsoid('pelvis', [0, 0.98 * s, 0], [0.2 * g, 0.14, 0.15 * g], k, M.gold, { w: 8, h: 6 });
        B.box('chest', [0, 1.3 * s, 0], [0.52 * g, 0.42, 0.34 * g], k, M.gold);
        B.ellipsoid('chest', [0, 1.42 * s, 0], [0.33 * g, 0.12, 0.2 * g], k, M.gold, { w: 10, h: 6 });
    } else {
        // under clothes the skin torso is never seen (and would poke through at the shoulders)
        if (!clothed) {
            B.ellipsoid('pelvis', [0, 0.93 * s, 0.01], [0.15 * g + (p.f ? 0.02 : 0), 0.09 * s, 0.1 * g], k, skinM);   // seat
            torsoLathe(B, torsoProfile(p, s, g), s, k, skinM, 0.64);
        }
        if (p.f && body === 'human' && !clothed) B.ellipsoid('chest', [0, 1.315 * s, -0.024], [0.126 * g, 0.094 * s, 0.083], k, skinM, { w: 18, h: 12 });
        if (body === 'troll' || body === 'gloomkin') B.ellipsoid('chest', [0, 1.42 * s, 0.08], [0.2 * g, 0.12, 0.1 * g], k, skinM);   // hunch
    }
    // neck: short and thick, sitting on a trapezius slope that runs out to the shoulders
    if (body === 'skeleton') B.limb('neck', [0, 1.46 * s, 0.01], [0, 1.6 * s, 0.0], 0.025, 0.025, k, M.bone, { seg: 8, blend: 'head', blendFrom: 0.7 });
    else {
        const nr = (p.f ? 0.054 : 0.063) * Math.sqrt(g);
        B.limb('neck', [0, 1.44 * s, 0.012], [0, 1.6 * s, 0.004], nr, nr * 0.9, k, skinM, { seg: 10, blend: 'head', blendFrom: 0.75 });
        if (body !== 'sentinel' && !clothed) {
            for (const sx of [1, -1]) B.ellipsoid(`arm${sx > 0 ? 'R' : 'L'}`, [sx * (p.shoulder * s - 0.006), 1.425 * s, 0.002], [0.054 * g, 0.062 * s, 0.056 * g], k, skinM, { w: 10, h: 8 });   // deltoid
        }
    }
    // limbs
    for (const [side, sx] of [['R', 1], ['L', -1]]) {
        const sw = p.shoulder * s, ax = sx * sw;
        const thin = body === 'skeleton' ? 0.4 : 1;
        B.limb(`arm${side}`, [ax, 1.415 * s, 0], [ax + sx * 0.02 * s, (1.44 - 0.29 * p.arm) * s, 0], 0.052 * g * thin, 0.042 * g * thin, k, skinM, { seg: 9, bulge: 0.1 });
        B.limb(`fore${side}`, [ax + sx * 0.02 * s, (1.44 - 0.29 * p.arm) * s, 0], [ax + sx * 0.03 * s, (1.44 - 0.53 * p.arm) * s, 0], 0.042 * g * thin, 0.03 * g * thin, k, skinM, { seg: 9 });
        // hand: palm and thumb
        const hy = (1.44 - 0.55 * p.arm) * s;
        B.ellipsoid(`hand${side}`, [ax + sx * 0.03 * s, hy - 0.055, -0.005], [0.03, 0.055, 0.02], k, skinM, { w: 8, h: 6 });
        B.ellipsoid(`hand${side}`, [ax + sx * 0.012 * s, hy - 0.035, -0.022], [0.012, 0.03, 0.012], k, skinM, { w: 6, h: 4, rot: [0.4, 0, 0] });
        const hx = sx * p.hip * s;
        B.limb(`thigh${side}`, [hx, 0.93 * s, 0], [hx, 0.5 * s, 0], 0.08 * g * thin, 0.056 * g * thin, k, skinM, { seg: 10, bulge: 0.08 });
        B.limb(`shin${side}`, [hx, 0.5 * s, 0], [hx, 0.09 * s, 0.01], 0.055 * g * thin, 0.036 * g * thin, k, skinM, { seg: 9, bulge: 0.1 });
        B.box(`foot${side}`, [hx, 0.04 * s, -0.05], [0.085 * g, 0.07, 0.22], k, skinM);
    }
}

function addHead(B, s, look, body, skinCol, hairCol) {
    const y = HY * s;
    const kin = KIN[look?.kin] || KIN.norrhen;
    const skinM = body === 'skeleton' ? M.bone : body === 'sentinel' ? M.gold : body === 'golem' ? (look?.frost ? M.ice : M.glow) : M.skin;
    if (body === 'sentinel') {
        B.ellipsoid('head', [0, y, 0], [0.13, 0.12, 0.13], skinCol, M.gold);
        B.box('head', [0, y, -0.12], [0.16, 0.03, 0.04], 0x222222, M.dark);
        B.box('head', [0, y, -0.135], [0.12, 0.012, 0.01], 0xffaa44, M.glow);
        return;
    }
    if (body === 'golem') {
        B.ellipsoid('head', [0, y, 0], [0.1, 0.13, 0.1], skinCol, skinM);
        for (let i = 0; i < 5; i++) B.limb('head', [0, y + 0.08, 0], [Math.sin(i * 1.3) * 0.15, y + 0.28, Math.cos(i * 1.3) * 0.15], 0.03, 0.005, skinCol, skinM, { seg: 5 });
        return;
    }
    const skull = body === 'skeleton' || body === 'wight' ? 0.92 : 1;
    B.ellipsoid('head', [0, y, 0], [0.093 * skull, 0.115, 0.105], skinCol, skinM, { w: 14, h: 11 });
    B.ellipsoid('head', [0, y - 0.065, -0.025], [0.072 * skull, 0.05, 0.075], skinCol, skinM, { w: 12, h: 7 });   // jaw
    if (body !== 'skeleton') {
        B.ellipsoid('head', [0, y - 0.015, -0.104], [0.016, 0.03, 0.022], skinCol, skinM, { w: 7, h: 6 });          // nose
        const earR = kin.ears || body === 'gloomkin' ? [0.012, 0.05, 0.022] : [0.014, 0.03, 0.022];
        for (const sx of [1, -1]) B.ellipsoid('head', [sx * 0.094, y + (kin.ears ? 0.02 : 0), 0.005], earR, skinCol, skinM, { w: 6, h: 5, rot: [kin.ears ? -0.5 : 0, 0, sx * (kin.ears ? -0.35 : 0)] });
    }
    // eyes
    const glow = body === 'wight' || body === 'golem';
    for (const sx of [1, -1]) {
        if (body === 'gloomkin') { B.box('head', [sx * 0.034, y + 0.008, -0.088], [0.03, 0.006, 0.01], 0x3a3530, M.dark); continue; }
        if (body === 'skeleton' || body === 'wight') {
            B.ellipsoid('head', [sx * 0.034, y + 0.008, -0.083], [0.019, 0.016, 0.01], 0x0a0806, M.dark, { w: 7, h: 5 });
            if (glow) B.ellipsoid('head', [sx * 0.034, y + 0.008, -0.09], [0.008, 0.008, 0.006], 0x66aaff, M.glow, { w: 6, h: 4 });
            continue;
        }
        B.ellipsoid('head', [sx * 0.033, y + 0.008, -0.0885], [0.0165, 0.0105, 0.012], 0xe2dcd2, M.eye, { w: 10, h: 7 });
        const eyeCol = kin.eyes ? new THREE.Color().setRGB(...kin.eyes, THREE.SRGBColorSpace).getHex() : look?.eye ?? 0x3a5a7a;
        B.ellipsoid('head', [sx * 0.033, y + 0.008, -0.0985], [0.0075, 0.0082, 0.0045], eyeCol, kin.eyes ? M.glow : M.eye, { w: 8, h: 6 });
        B.ellipsoid('head', [sx * 0.033, y + 0.008, -0.1018], [0.0034, 0.0036, 0.0015], 0x0a0806, M.dark, { w: 6, h: 4 });   // pupil
        B.ellipsoid('head', [sx * 0.033, y + 0.0165, -0.0905], [0.0185, 0.006, 0.0125], skinCol, M.skin, { w: 10, h: 5 });   // upper lid
        B.box('head', [sx * 0.036, y + 0.036, -0.094], [0.038, 0.009, 0.012], hairCol, M.hair, { rot: [0, 0, sx * -0.12] });
    }
    if (body !== 'skeleton') B.box('head', [0, y - 0.056, -0.094], [0.032, 0.005, 0.008], new THREE.Color(skinCol).multiplyScalar(0.6).getHex(), M.skin);
    if (body === 'skeleton') for (let i = 0; i < 6; i++) B.box('head', [-0.025 + i * 0.01, y - 0.07, -0.088], [0.007, 0.014, 0.008], 0xe8e0cc, M.bone);
    if (kin.tusks) for (const sx of [1, -1]) B.limb('head', [sx * 0.03, y - 0.075, -0.07], [sx * 0.035, y - 0.03, -0.085], 0.009, 0.003, 0xe8e0c8, M.bone, { seg: 5, caps: false });
}

function addHair(B, s, look, hairCol) {
    const y = HY * s;
    const st = look?.hair ?? 1;
    if (st === 6) return;   // bald
    const capR = [0.1, 0.105, 0.112];
    B.ellipsoid('head', [0, y + 0.02, 0.005], capR, hairCol, M.hair, { t1: Math.PI * 0.55, w: 14, h: 6 });
    if (st >= 1) B.ellipsoid('head', [0, y + 0.0, 0.03], [0.1, 0.1, 0.095], hairCol, M.hair, { t0: Math.PI * 0.35, t1: Math.PI * 0.75, w: 12, h: 5 });   // back
    if (st === 2 || st === 4) B.box('head', [0, y - 0.1, 0.07], [0.17, 0.22, 0.05], hairCol, M.hair, { blend: 'neck', blendFrom: 0.2 });   // long
    if (st === 3) B.ellipsoid('head', [0, y + 0.05, 0.11], [0.045, 0.045, 0.045], hairCol, M.hair);   // bun
    if (st === 4) for (const sx of [1, -1]) B.limb('head', [sx * 0.085, y - 0.02, -0.02], [sx * 0.09, y - 0.25, -0.05], 0.018, 0.012, hairCol, M.hair, { seg: 6 });   // braids
    if (st === 5) B.limb('head', [0, y + 0.02, 0.1], [0, y - 0.22, 0.13], 0.03, 0.014, hairCol, M.hair, { seg: 7 });   // ponytail
}

function addBeard(B, s, look, hairCol) {
    const y = HY * s;
    const st = look?.beard || 0;
    if (!st || look?.sex === 'f') return;
    if (st === 1) { B.ellipsoid('head', [0, y - 0.07, -0.03], [0.076, 0.052, 0.078], hairCol, M.hair, { t0: Math.PI * 0.45 }); return; }
    B.ellipsoid('head', [0, y - 0.075, -0.035], [0.08, 0.06, 0.082], hairCol, M.hair, { t0: Math.PI * 0.4 });
    B.ellipsoid('head', [0, y - 0.04, -0.09], [0.04, 0.012, 0.02], hairCol, M.hair);   // moustache
    if (st >= 3) B.lathe('head', [[0.06, 0], [0.055, -0.08], [0.035, -0.17], [0.005, -0.22]], hairCol, M.hair, { pos: [0, y - 0.09, -0.07], scale: [1, 1, 0.6], seg: 10, blend: 'chest', blendFrom: 0.5 });
    if (st === 4) for (const sx of [1, -1]) B.limb('head', [sx * 0.03, y - 0.2, -0.08], [sx * 0.025, y - 0.32, -0.08], 0.012, 0.008, hairCol, M.hair, { seg: 5 });
}

// ------------------------------------------------------------------ clothes and armour
function addApparel(B, s, p, actor) {
    const eq = actor.equip || {};
    const g = p.girth;
    const piece = (slot) => { const e = eq[slot]; return e ? ITEMS[e.id] : null; };
    const body = piece('body'), head = piece('head'), hands = piece('hands'), feet = piece('feet');
    const look = actor.look || {};
    if (!body && actor.rig === 'humanoid' && (actor.body === 'human' || actor.body === undefined)) {
        // modesty layer
        B.ellipsoid('pelvis', [0, 0.97 * s, 0], [0.172 * g, 0.1, 0.118 * g], 0xd8d0c0, M.cloth);
    }
    if (body) {
        const mat = body.clothing ? M.cloth : MAT_KIND[body.material] ?? M.leather;
        const col = body.clothing || body.material === 'cloth' ? body.color : MAT_COLOR[body.material] ?? body.color;
        const heavy = body.armorType === 'heavy';
        const robe = body.id?.startsWith('robe') || body.id === 'warden' || body.id === 'fine';
        // torso shell
        const shell = torsoProfile(p, s, g, heavy ? 0.022 : 0.012).filter(([, y]) => y <= 1.53 * s);
        torsoLathe(B, shell, s, col, mat, 0.66, { vary: 0.06 });
        B.lathe('neck', [[0.074 * Math.sqrt(g), 0], [0.068 * Math.sqrt(g), 0.03], [0.062 * Math.sqrt(g), 0.032]], col, mat, { pos: [0, 1.5 * s, 0.006], scale: [1, 1, 0.9], seg: 16 });   // collar
        if (p.f) B.ellipsoid('chest', [0, 1.315 * s, -0.026], [0.136 * g, 0.1 * s, 0.092], col, mat, { w: 18, h: 12 });
        // belt
        B.lathe('pelvis', [[(p.f ? 0.19 : 0.182) * g, 0], [(p.f ? 0.188 : 0.18) * g, 0.05]], 0x3a2a1c, M.leather, { pos: [0, 1.0 * s, 0.004], scale: [1, 1, 0.68], seg: 20 });
        B.box('pelvis', [0, 1.025 * s, -0.122 * g], [0.055, 0.045, 0.02], 0xb09050, M.gold);
        // skirt: robes to the ankles, tunics and armour to mid-thigh
        const len = robe ? 0.82 : heavy ? 0.42 : 0.36;
        B.lathe('pelvis', [[(p.f ? 0.19 : 0.178) * g, 0], [0.2 * g, -len * 0.5], [0.24 * g, -len]], col, robe ? M.cloth : mat === M.metal ? M.chain : mat, { pos: [0, 1.0 * s, 0], scale: [1, 1, 0.78], seg: 14, flipN: false, vary: 0.06 });
        B.lathe('pelvis', [[0.235 * g, -len + 0.001], [(p.f ? 0.19 : 0.178) * g, 0]], col, robe ? M.cloth : mat, { pos: [0, 1.0 * s, 0], scale: [1, 1, 0.78], seg: 14 });
        // sleeves
        for (const [side, sx] of [['R', 1], ['L', -1]]) {
            const ax = sx * p.shoulder * s;
            B.limb(`arm${side}`, [ax, 1.43 * s, 0], [ax + sx * 0.02 * s, (1.44 - 0.29 * p.arm) * s, 0], 0.058 * g, 0.05 * g, col, mat, { seg: 9 });
            B.ellipsoid(`arm${side}`, [ax - sx * 0.005, 1.425 * s, 0.002], [0.064 * g, 0.072 * s, 0.066 * g], col, mat, { w: 12, h: 8 });
            if (robe || heavy) B.limb(`fore${side}`, [ax + sx * 0.02 * s, (1.44 - 0.29 * p.arm) * s, 0], [ax + sx * 0.03 * s, (1.44 - 0.5 * p.arm) * s, 0], 0.05 * g, robe ? 0.06 * g : 0.04 * g, col, mat, { seg: 9 });
            if (heavy) {
                B.ellipsoid('chest', [ax * 1.05, 1.47 * s, 0], [0.1 * g, 0.075, 0.1 * g], col, mat, { t1: Math.PI * 0.6 });   // pauldron
                B.ellipsoid('chest', [ax * 1.1, 1.43 * s, 0], [0.105 * g, 0.06, 0.105 * g], col, mat, { t1: Math.PI * 0.55 });
            } else if (mat === M.leather && body.material === 'hide') {
                B.ellipsoid('chest', [ax * 0.9, 1.48 * s, 0], [0.12 * g, 0.06, 0.11 * g], 0x8a7258, M.fur, { t1: Math.PI * 0.6 });   // fur mantle
            }
        }
        if (heavy) B.box('chest', [0, 1.33 * s, -0.13 * g], [0.22 * g, 0.2, 0.03], col, mat);   // breastplate
        if (body.id === 'guard_bw' || body.id === 'reaver' || body.id === 'hearth') {
            const tab = body.id === 'guard_bw' ? 0xc89a2a : body.id === 'reaver' ? 0x8a2a24 : 0x2a4a8a;
            B.box('chest', [0, 1.2 * s, -0.135 * g], [0.2 * g, 0.4, 0.015], tab, M.cloth, { blend: 'pelvis' });
        }
        if (body.id === 'priest_robe') { /* none */ }
    }
    if (head) {
        const y = HY * s;
        const mat = head.clothing ? M.cloth : MAT_KIND[head.material] ?? M.metal;
        const col = head.clothing || head.material === 'cloth' ? head.color : MAT_COLOR[head.material] ?? head.color;
        if (head.id === 'hood') { B.ellipsoid('head', [0, y + 0.0, 0.01], [0.125, 0.14, 0.13], col, M.cloth, { t1: Math.PI * 0.62 }); B.ellipsoid('head', [0, y - 0.04, 0.04], [0.13, 0.12, 0.11], col, M.cloth, { t0: Math.PI * 0.4, t1: Math.PI * 0.85 }); }
        else if (head.id === 'circlet') B.lathe('head', [[0.104, 0], [0.104, 0.012]], 0xd8d8e0, M.gold, { pos: [0, y + 0.05, 0], seg: 18 });
        else if (head.id === 'hierophant_crown') { B.ellipsoid('head', [0, y, -0.03], [0.11, 0.13, 0.1], 0x3a6a3a, M.metal, { t1: Math.PI * 0.6 }); B.box('head', [0, y + 0.0, -0.12], [0.13, 0.14, 0.03], 0x3a6a3a, M.metal); B.box('head', [0, y + 0.02, -0.136], [0.08, 0.012, 0.01], 0x88ff88, M.glow); }
        else {
            B.ellipsoid('head', [0, y + 0.015, 0.005], [0.118, 0.13, 0.125], col, mat, { t1: Math.PI * 0.6, vary: 0.05 });
            B.lathe('head', [[0.122, 0], [0.124, 0.025]], col, mat, { pos: [0, y - 0.005, 0.005], scale: [1, 1, 1.05], seg: 16 });
            if (mat === M.metal || mat === M.gold || mat === M.bone) B.box('head', [0, y - 0.02, -0.122], [0.022, 0.08, 0.012], col, mat);   // nose guard
            if (head.material === 'iron' || head.material === 'ancient' || head.material === 'dread') for (const sx of [1, -1]) {   // horns
                const hc = head.material === 'dread' ? 0x1a0a08 : 0xd8cdb4;
                B.limb('head', [sx * 0.1, y + 0.07, 0], [sx * 0.18, y + 0.14, -0.02], 0.026, 0.016, hc, M.bone, { seg: 6, caps: false });
                B.limb('head', [sx * 0.18, y + 0.14, -0.02], [sx * 0.2, y + 0.24, -0.06], 0.016, 0.003, hc, M.bone, { seg: 6, caps: false });
            }
            if (head.material === 'steel' || head.material === 'plate') for (const sx of [1, -1]) B.box('head', [sx * 0.09, y - 0.05, -0.04], [0.025, 0.09, 0.08], col, mat);
            if (head.material === 'glimmer') B.box('head', [0, y + 0.14, 0.01], [0.012, 0.06, 0.2], col, mat);
            if (head.material === 'dragon' || head.material === 'dplate') for (let i = 0; i < 4; i++) B.limb('head', [0, y + 0.1, 0.06 - i * 0.04], [0, y + 0.2 - i * 0.02, 0.1 - i * 0.04], 0.015, 0.002, col, M.bone, { seg: 5, caps: false });
            if (head.material === 'hide' || head.material === 'leather') B.lathe('head', [[0.13, 0], [0.13, 0.03]], 0x8a7258, M.fur, { pos: [0, y - 0.01, 0.005], seg: 14 });
        }
    }
    if (hands) {
        const mat = hands.clothing ? M.leather : MAT_KIND[hands.material] ?? M.leather;
        const col = MAT_COLOR[hands.material] ?? hands.color;
        for (const [side, sx] of [['R', 1], ['L', -1]]) {
            const ax = sx * p.shoulder * s;
            B.limb(`fore${side}`, [ax + sx * 0.025 * s, (1.44 - 0.4 * p.arm) * s, 0], [ax + sx * 0.03 * s, (1.44 - 0.54 * p.arm) * s, 0], 0.047 * g, 0.04 * g, col, mat, { seg: 9 });
            B.ellipsoid(`hand${side}`, [ax + sx * 0.03 * s, (1.44 - 0.55 * p.arm) * s - 0.05, -0.005], [0.035, 0.058, 0.025], col, mat, { w: 8, h: 6 });
        }
    }
    if (feet) {
        const mat = feet.clothing ? M.leather : MAT_KIND[feet.material] ?? M.leather;
        const col = feet.clothing ? feet.color : MAT_COLOR[feet.material] ?? feet.color;
        for (const [side, sx] of [['R', 1], ['L', -1]]) {
            const hx = sx * p.hip * s;
            B.limb(`shin${side}`, [hx, 0.36 * s, 0], [hx, 0.08 * s, 0.01], 0.06 * g, 0.048 * g, col, mat, { seg: 9 });
            B.box(`foot${side}`, [hx, 0.045 * s, -0.05], [0.1 * g, 0.085, 0.24], col, mat);
            if (feet.id === 'boots_fur') B.lathe(`shin${side}`, [[0.07, 0], [0.07, 0.06]], 0x8a7258, M.fur, { pos: [hx, 0.34 * s, 0], seg: 10 });
        }
    }
    // wight wrappings and gloomkin hide
    if (actor.body === 'wight') {
        B.lathe('pelvis', [[0.16 * g, 0], [0.19 * g, -0.2], [0.2 * g, -0.4]], 0x4a4236, M.cloth, { pos: [0, 1.0 * s, 0], scale: [1, 1, 0.78], seg: 10, vary: 0.25 });
        B.lathe('pelvis', [[0.198 * g, -0.399], [0.158 * g, 0]], 0x4a4236, M.cloth, { pos: [0, 1.0 * s, 0], scale: [1, 1, 0.78], seg: 10 });
        if (!head) B.ellipsoid('head', [0, HY * s + 0.02, 0.01], [0.1, 0.11, 0.11], 0x3a3428, M.cloth, { t1: Math.PI * 0.5 });
    }
    if (actor.body === 'gloomkin') B.lathe('pelvis', [[0.15, 0], [0.18, -0.25]], 0x5a5040, M.leather, { pos: [0, 1.0 * s, 0], scale: [1, 1, 0.8], seg: 10 });
    if (actor.body === 'priest') {
        B.lathe('chest', [[0.2, 0.15], [0.26, -0.3], [0.34, -0.9], [0.3, -1.25]], 0x1e2a1e, M.cloth, { pos: [0, 1.35 * s, 0], seg: 14, vary: 0.2 });
        B.lathe('chest', [[0.3, -1.249], [0.2, 0.149]], 0x1e2a1e, M.cloth, { pos: [0, 1.35 * s, 0], seg: 14 });
    }
}

// ------------------------------------------------------------------ the whole figure
export function buildHumanoid(actor, material) {
    const B = new PartBuilder();
    const body = actor.body || 'human';
    const look = actor.look || {};
    const p = proportions(look, body);
    const s = skeleton(B, p);
    const kin = KIN[look.kin] || KIN.norrhen;
    let skin = look.skin != null ? look.skin : new THREE.Color().setRGB(...kin.skin.map((v) => v * (0.86 + (look.age || 0) * 0.06)), THREE.SRGBColorSpace).getHex();
    if (body === 'wight') skin = 0x6a6a58;
    if (body === 'skeleton') skin = 0xd8d0bc;
    if (body === 'troll') skin = actor.color || 0x8a847a;
    if (body === 'giant') skin = 0xc8a888;
    if (body === 'gloomkin') skin = 0x9a9e8e;
    if (body === 'golem') { skin = actor.color; look.frost = actor.tpl === 'rime_golem'; }
    if (body === 'sentinel') skin = actor.color || 0xb08a45;
    if (body === 'priest') skin = 0x5a6a5a;
    const hairCol = look.hairCol ?? 0x4a3420;
    const clothed = !!(actor.equip?.body && ITEMS[actor.equip.body.id]);
    if (body !== 'priest') addBody(B, s, p, look, body, skin, clothed);
    else {
        B.ellipsoid('chest', [0, 1.33 * s, 0], [0.18, 0.15, 0.12], 0x2a3a2a, M.cloth);
        for (const sx of [1, -1]) { const side = sx > 0 ? 'R' : 'L'; B.limb(`arm${side}`, [sx * 0.2 * s, 1.45 * s, 0], [sx * 0.22 * s, 1.15 * s, 0], 0.06, 0.05, 0x1e2a1e, M.cloth); B.limb(`fore${side}`, [sx * 0.22 * s, 1.15 * s, 0], [sx * 0.23 * s, 0.9 * s, 0], 0.05, 0.03, 0x2a2420, M.bone); }
    }
    addHead(B, s, look, body, skin, hairCol);
    if (body === 'human' || body === 'giant') { addHair(B, s, look, hairCol); addBeard(B, s, look, hairCol); }
    if (body === 'troll') { B.ellipsoid('head', [0, (HY + 0.07) * s, 0.03], [0.11, 0.06, 0.11], 0xe0dcd0, M.fur); B.ellipsoid('chest', [0, 1.45 * s, 0.1], [0.24, 0.12, 0.16], 0xe0dcd0, M.fur, { vary: 0.3 }); }
    if (body === 'giant') { B.lathe('pelvis', [[0.2, 0], [0.24, -0.35]], 0x6a5038, M.fur, { pos: [0, 1.0 * s, 0], scale: [1, 1, 0.8], seg: 10 }); B.lathe('pelvis', [[0.238, -0.349], [0.198, 0]], 0x6a5038, M.fur, { pos: [0, 1.0 * s, 0], scale: [1, 1, 0.8], seg: 10 }); }
    addApparel(B, s, p, actor);
    const mesh = B.finish(material);
    mesh.userData.kind = 'humanoid';
    mesh.userData.s = s;
    mesh.userData.p = p;
    return mesh;
}

// ------------------------------------------------------------------ weapons, shields, bows
const _wcache = new Map();
export function weaponMesh(id, material) {
    const d = ITEMS[id];
    if (!d) return null;
    const key = id;
    let geo = _wcache.get(key);
    if (!geo) {
        const B = new PartBuilder();
        B.bone('w', null, 0, 0, 0);
        const mc = MAT_COLOR[d.material] ?? d.color ?? 0x999999;
        const mk = d.material === 'bound' ? M.glow : MAT_KIND[d.material] ?? M.metal;
        const grip = 0x3a2618;
        const t = d.wtype;
        if (d.type === 'torch') {
            B.limb('w', [0, -0.12, 0], [0, 0.42, 0], 0.02, 0.026, 0x4a3020, M.wood, { seg: 6 });
            B.limb('w', [0, 0.36, 0], [0, 0.5, 0], 0.04, 0.035, 0x2a2018, M.cloth, { seg: 7 });
        } else if (d.type === 'armor' && d.slot === 'shield') {
            const big = d.armorType === 'heavy';
            B.lathe('w', [[0.001, 0.05], [0.18, 0.04], [0.34, 0.0], [0.35, -0.02], [0.001, -0.03]], d.material === 'hide' ? 0x7a5a3a : mc, d.material === 'hide' || d.material === 'ancient' ? M.wood : mk, { scale: big ? [1, 1, 1.1] : [1, 1, 1], seg: 18, vary: 0.06 });
            B.lathe('w', [[0.33, 0.0], [0.36, 0.01], [0.36, -0.03], [0.33, -0.03]], 0x5a5a5a, M.metal, { seg: 18 });
            B.ellipsoid('w', [0, 0.05, 0], [0.07, 0.04, 0.07], 0x8a8a8a, M.metal);
        } else if (d.bow) {
            for (let k = -1; k <= 1; k += 2) {
                const pts = [];
                for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push([0, u * 0.65 * k, Math.sin(u * Math.PI * 0.55) * 0.16]); }
                for (let i = 0; i < 6; i++) B.limb('w', pts[i], pts[i + 1], 0.018 - i * 0.002, 0.016 - i * 0.002, d.material === 'iron' || d.material === 'ancient' ? 0x5a3a22 : mc, d.material === 'iron' ? M.wood : mk, { seg: 6, caps: false });
            }
            B.limb('w', [0, -0.06, 0], [0, 0.06, 0], 0.022, 0.022, grip, M.leather, { seg: 6 });
            B.limb('w', [0, 0.65, 0.13], [0, -0.65, 0.13], 0.003, 0.003, 0xdddddd, M.cloth, { seg: 3, caps: false });
        } else if (t === 'staff') {
            B.limb('w', [0, -0.7, 0], [0, 0.85, 0], 0.022, 0.018, 0x4a3020, M.wood, { seg: 7 });
            B.ellipsoid('w', [0, 0.92, 0], [0.06, 0.08, 0.06], d.staff?.includes('ice') || d.staff?.includes('frost') ? 0x88ccff : 0xff7733, M.glow);
            for (let i = 0; i < 3; i++) B.limb('w', [0, 0.82, 0], [Math.cos(i * 2.1) * 0.06, 0.98, Math.sin(i * 2.1) * 0.06], 0.012, 0.004, 0x3a2a1a, M.wood, { seg: 4 });
        } else {
            // grip along +y from the fist; the business end above it
            const two = d.two;
            const gl = two ? 0.32 : 0.13;
            B.limb('w', [0, -0.04, 0], [0, gl, 0], 0.017, 0.016, grip, M.leather, { seg: 7 });
            B.ellipsoid('w', [0, -0.06, 0], [0.026, 0.026, 0.026], mc, mk);
            if (t === 'sword' || t === 'greatsword' || t === 'dagger') {
                const L = t === 'dagger' ? 0.26 : t === 'sword' ? 0.78 : 1.15, W = t === 'dagger' ? 0.035 : t === 'sword' ? 0.055 : 0.075;
                B.box('w', [0, gl + 0.02, 0], [W * 3.2, 0.035, 0.035], mc, mk);   // guard
                const blade = new THREE.BufferGeometry();
                const y0 = gl + 0.04, y1 = y0 + L;
                const v = [-W / 2, y0, -0.006, W / 2, y0, -0.006, W / 2, y1 - W, -0.004, 0, y1, 0, -W / 2, y1 - W, -0.004, -W / 2, y0, 0.006, W / 2, y0, 0.006, W / 2, y1 - W, 0.004, -W / 2, y1 - W, 0.004];
                blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
                blade.setIndex([0, 2, 1, 0, 4, 2, 4, 3, 2, 5, 6, 7, 5, 7, 8, 8, 7, 3, 0, 1, 6, 0, 6, 5, 1, 2, 7, 1, 7, 6, 0, 5, 8, 0, 8, 4, 4, 8, 3, 2, 3, 7]);
                blade.computeVertexNormals();
                B.add(blade, 'w', d.material === 'crystal' ? 0x9af0c0 : d.material === 'night' ? 0x34363e : 0xd0d4da, d.material === 'crystal' ? M.crystal : d.material === 'bound' ? M.glow : M.metal);
                B.box('w', [0, y0 + L * 0.4, 0], [0.008, L * 0.75, 0.014], mc, mk);   // fuller
            } else if (t === 'waraxe' || t === 'battleaxe') {
                const big = t === 'battleaxe';
                const top = gl + (big ? 0.55 : 0.32);
                B.limb('w', [0, gl, 0], [0, top + 0.05, 0], 0.016, 0.014, 0x4a3020, M.wood, { seg: 6 });
                const head = new THREE.CylinderGeometry(big ? 0.2 : 0.13, big ? 0.2 : 0.13, 0.025, 12, 1, false, -0.9, 1.8);
                B.add(head, 'w', mc, mk, { pos: [0, top - 0.02, -0.01], rot: [Math.PI / 2, 0, 0], scale: [1, 1, big ? 1.4 : 1.1] });
                if (big) B.add(head.clone(), 'w', mc, mk, { pos: [0, top - 0.02, 0.01], rot: [-Math.PI / 2, 0, 0], scale: [1, 1, 1.4] });
            } else if (t === 'mace' || t === 'warhammer') {
                const big = t === 'warhammer';
                const top = gl + (big ? 0.6 : 0.42);
                B.limb('w', [0, gl, 0], [0, top, 0], 0.018, 0.016, mc, mk, { seg: 6 });
                if (big) { B.box('w', [0, top + 0.06, 0], [0.12, 0.14, 0.3], mc, mk); B.box('w', [0, top + 0.06, 0.18], [0.06, 0.06, 0.08], mc, mk); }
                else { B.ellipsoid('w', [0, top + 0.05, 0], [0.065, 0.08, 0.065], mc, mk); for (let i = 0; i < 6; i++) B.box('w', [Math.cos(i) * 0.06, top + 0.05, Math.sin(i) * 0.06], [0.02, 0.1, 0.02], mc, mk, { rot: [0, -i, 0] }); }
            }
        }
        geo = B;
        _wcache.set(key, geo);
    }
    // weapons are plain meshes (attached to a hand bone)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(geo.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(geo.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(geo.col, 3));
    g.setAttribute('mat', new THREE.Float32BufferAttribute(geo.mat, 1));
    g.setAttribute('rest', new THREE.Float32BufferAttribute(geo.rest, 3));
    const m = new THREE.Mesh(g, material);
    m.castShadow = true;
    m.userData.item = d;
    return m;
}
