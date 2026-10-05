/**
 * chars.js — every character's design: proportions, materials, palette
 * variants, attachments (hair, armour, weapons) and which animations to bake.
 *
 * Colours are given as one base hex per material; ramp() derives the dark /
 * mid / light tones with hue-shifted shadows (cooler) and highlights (warmer),
 * the classic pixel-art trick that keeps shading from looking muddy.
 */

const PLAYER_ANIMS = ['idle', 'walk', 'run', 'jump', 'land', 'jab', 'cross', 'hook', 'kick', 'upper', 'backfist', 'dashknee',
    'jumpkick', 'jumpknee', 'stomp', 'airkick2', 'grab', 'knee', 'headbutt', 'throwF', 'throwB', 'arc', 'rail', 'meteor',
    'rising', 'pulse', 'overdrive', 'swingA', 'swingB', 'swingC', 'toss', 'hurt', 'hurt2', 'fall', 'down', 'getup', 'spin',
    'grabbed', 'victory', 'portrait', 'dizzy', 'stand'];
const REACT = ['idle', 'walk', 'hurt', 'hurt2', 'fall', 'down', 'getup', 'spin', 'grabbed', 'portrait', 'taunt', 'dizzy'];

// ------------------------------------------------------------------ colour
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
        const d = mx - mn;
        s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
    }
    return [h, s, l];
}
function hslToRgb([h, s, l]) {
    h = ((h % 360) + 360) % 360 / 360;
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t + 1) % 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
function shiftHue(h, toward, amt) {
    let d = ((toward - h + 540) % 360) - 180;
    return h + Math.sign(d) * Math.min(Math.abs(d), amt);
}
/** Base colour -> [dark, mid, light] as [r,g,b] triples. */
export function ramp(hex) {
    const hsl = rgbToHsl(hexToRgb(hex));
    const [h, s, l] = hsl;
    const warm = h < 50 || h > 330;
    const dark = hslToRgb([shiftHue(h, warm ? 340 : 250, warm ? 8 : 14), Math.min(1, s * (warm ? 0.85 : 1.05) + 0.04), l * (warm ? 0.7 : 0.6)]);
    const light = hslToRgb([shiftHue(h, 55, 12), Math.min(1, s * 0.95), Math.min(0.94, l * 1.22 + 0.1)]);
    return [dark, hexToRgb(hex), light].map((c) => c.map((x) => Math.max(0, Math.min(255, Math.round(x)))));
}
export { hexToRgb };

// ------------------------------------------------------------------ helpers
function humanoid(d) {
    const ch = {
        cell: d.cell || [104, 88], scale: d.scale || 1,
        body: { thigh: 13, shin: 13, foot: 5, torso: 17, neck: 3, headR: 5.6, upperArm: 10, foreArm: 9.5, shoulderDrop: 2, ...d.body },
        w: { thigh: [4, 3], shin: [3, 2.3], foot: 2, uarm: [2.5, 2], farm: [2.1, 2.2], hand: 2.2, waist: 3.4, chest: 5, hips: 4.6, neck: 1.7, ...d.w },
        m: { leg: 'suit', arm: 'suit', hand: 'skin', torso: 'suit', skin: 'skin', head: 'skin', foot: 'boot', ...d.m },
        mats: d.mats, outline: d.outline || '#120a14', emissive: d.emissive || ['glow'],
        variants: d.variants || {},
        extras: d.extras || [],
        anims: d.anims || REACT,
        flatBack: d.flatBack !== false,
        noArms: d.noArms, noLegs: d.noLegs, noTorso: d.noTorso, noHead: d.noHead,
        portraitScale: d.portraitScale || 4,
        animOverrides: d.animOverrides || {},
    };
    ch.matNames = Object.keys(ch.mats);
    ch.matIndex = {};
    ch.matNames.forEach((n, i) => { ch.matIndex[n] = i; });
    return ch;
}

// common attachments
const EYE = (a = 0.6, s = 3.8) => ({ L: 'head', b: 'head', t: 'dot', at: [a, s], outline: true });
const BROW = (a = 1.8, s = 3.4) => ({ L: 'head', b: 'head', t: 'cap', p1: [a, s - 1.4], p2: [a - 0.3, s + 1.2], r1: 0.4, m: 'hair', ring: false, mode: 'dark' });

// ------------------------------------------------------------------ cast
export const CHARS = {
    // ============ JUNO — VANTA-7 ============
    juno: humanoid({
        cell: [108, 92],
        mats: { skin: '#f0bd98', hair: '#ff3f9e', suit: '#353f5e', plate: '#7584a8', glow: '#44f2ff', glove: '#1e2132' },
        outline: '#100a18',
        body: { thigh: 13, shin: 13, torso: 17, headR: 6.4, neck: 2.6 },
        w: { thigh: [4.1, 2.9], shin: [2.9, 2.3], uarm: [2.4, 2], farm: [2.1, 2.7], hand: 2.3, waist: 3.4, chest: 5.1, hips: 4.8, headY: 0.82 },
        m: { shin: 'plate', foot: 'plate', forearm: 'plate', hand: 'glove', pelvis: 'suit' },
        variants: {
            od: { glow: '#ffffff', suit: '#4a2068', plate: '#a878ff', hair: '#ff8ad0' },
            mika: { skin: '#f3c6a5', hair: '#24202e', suit: '#e6e4ee', plate: '#b5b9ca', glow: '#59ffd0', glove: '#3b3442' },
        },
        extras: [
            { L: 'back', b: 'head', t: 'chain', at: [3.0, -4.6], ang: 228, segs: [[5, 2.2, 2.9], [5, 2.9, 2.2], [5, 2.2, 1.1], [3, 1.1, 0.5]], curl: 14, m: 'hair' },
            { L: 'head', b: 'head', t: 'ell', at: [2.2, -2.3], rx: 4.7, ry: 4.4, m: 'hair' },
            { L: 'head', b: 'head', t: 'ell', at: [4.3, 2.4], rx: 1.7, ry: 2.6, rot: 40, m: 'hair' },
            { L: 'head', b: 'head', t: 'cap', p1: [3.8, -3.6], p2: [5.8, -5.2], r1: 1.6, r2: 0.6, m: 'hair' },
            { L: 'head', b: 'head', t: 'ell', at: [-0.2, -1.4], rx: 1.7, ry: 1.4, m: 'plate' },
            { L: 'head', b: 'head', t: 'dot', at: [-0.2, -1.4], m: 'glow', tone: 2 },
            { L: 'head', b: 'head', t: 'cap', p1: [1.1, 2.4], p2: [1.2, 5.0], r1: 0.85, m: 'glow', mode: 'glow' },
            { L: 'head', b: 'head', t: 'cap', p1: [-2.6, 4.2], p2: [-2.5, 4.9], r1: 0.25, m: 'skin', mode: 'dark', ring: false, minScale: 2 },
            { L: 'head', b: 'head', t: 'ell', at: [-0.4, 5.0], rx: 1.1, ry: 0.7, m: 'skin', mode: 'flat', ring: false, minScale: 2 },
            { L: 'head', b: 'head', t: 'dot', at: [-2.6, 4.6], outline: true },
            { L: 'torso', b: 'torso', t: 'cap', p1: [2.6, -3.6], p2: [2.6, 3.4], r1: 1.2, m: 'plate' },
            { L: 'torso', b: 'torso', t: 'dot', at: [2.6, 3.5], m: 'glow', tone: 2 },
            { L: 'torso', b: 'torso', t: 'cap', p1: [15.4, -2.4], p2: [16.2, 2.6], r1: 1.5, m: 'plate' },
            { L: 'torso', b: 'torso', t: 'ell', at: [12.6, 3.6], rx: 1.4, ry: 1.4, m: 'glow', mode: 'glow' },
            { L: 'torso', b: 'torso', t: 'cap', p1: [12.4, 3.6], p2: [5, 2.4], r1: 0.45, m: 'glow', mode: 'glow', ring: false },
            { limb: 'uarm', t: 'ell', at: [1.4, 0], rx: 3.2, ry: 2.7, m: 'plate' },
            { limb: 'farm', t: 'cap', p1: [2.2, 0], p2: [7.6, 0], r1: 0.5, m: 'glow', mode: 'glow', ring: false },
            { limb: 'thigh', t: 'cap', p1: [2.5, 0.4], p2: [10.5, 0.2], r1: 0.5, m: 'glow', mode: 'glow', ring: false },
            { limb: 'shin', t: 'ell', at: [0.6, 0], rx: 2.3, ry: 2.4, m: 'plate' },
            { limb: 'foot', t: 'cap', p1: [-0.5, 1.9], p2: [4.6, 1.9], r1: 0.6, m: 'glow', mode: 'glow', ring: false },
        ],
        anims: PLAYER_ANIMS,
    }),

    // ============ MIKA — VANTA-8 (boss & ally) ============
    mika: humanoid({
        cell: [108, 92],
        mats: { skin: '#f3c6a5', hair: '#1d1a28', suit: '#e4e2ec', plate: '#a9aec2', glow: '#ff2d55', glove: '#3a3442', streak: '#f2f2ff' },
        outline: '#160a12',
        body: { thigh: 12.5, shin: 12.5, torso: 16.5, headR: 5.5 },
        w: { thigh: [3.8, 2.8], shin: [2.8, 2.2], uarm: [2.3, 1.9], farm: [2, 2.6], hand: 2.2, waist: 3.2, chest: 4.7, hips: 4.5 },
        m: { shin: 'plate', foot: 'plate', forearm: 'plate', hand: 'glove' },
        emissive: ['glow', 'streak'],
        variants: { freed: { glow: '#59ffd0' }, od: { glow: '#ffffff', suit: '#f0e0ff', plate: '#c8a0ff' }, ghost: { suit: '#ff2d55', plate: '#ff2d55', hair: '#ff2d55', skin: '#ff8aa0', glove: '#ff2d55' } },
        extras: [
            { L: 'head', b: 'head', t: 'ell', at: [0.8, -1.4], rx: 5.6, ry: 5.0, m: 'hair' },
            { L: 'head', b: 'head', t: 'ell', at: [-2.4, -2.2], rx: 3.4, ry: 3.6, m: 'hair' },
            { L: 'head', b: 'head', t: 'ell', at: [3.0, 2.6], rx: 2.2, ry: 2.8, rot: 20, m: 'hair' },
            { L: 'head', b: 'head', t: 'cap', p1: [4.2, 0.6], p2: [1.2, -3.6], r1: 0.6, m: 'streak', mode: 'flat', ring: false },
            { L: 'head', b: 'head', t: 'cap', p1: [0.8, 2.6], p2: [1.0, 5.3], r1: 0.95, m: 'glow', mode: 'glow' },
            { L: 'head', b: 'head', t: 'dot', at: [-2.6, 4.0], outline: true },
            { L: 'torso', b: 'torso', t: 'cap', p1: [2.4, -3.4], p2: [2.4, 3.2], r1: 1.2, m: 'plate' },
            { L: 'torso', b: 'torso', t: 'poly', pts: [[16, -1], [11, 4.2], [8, 3.8], [13, -1.4]], m: 'glow', mode: 'glow', ring: false },
            { L: 'torso', b: 'torso', t: 'cap', p1: [15.2, -2.4], p2: [16, 2.6], r1: 1.5, m: 'plate' },
            { limb: 'uarm', t: 'ell', at: [1.4, 0], rx: 3.3, ry: 2.4, m: 'plate' },
            { limb: 'farm', t: 'cap', p1: [2.2, 0], p2: [7.6, 0], r1: 0.5, m: 'glow', mode: 'glow', ring: false },
            { limb: 'thigh', t: 'cap', p1: [2.5, 0.4], p2: [10.5, 0.2], r1: 0.5, m: 'glow', mode: 'glow', ring: false },
            { limb: 'shin', t: 'ell', at: [0.6, 0], rx: 2.2, ry: 2.3, m: 'plate' },
            { limb: 'foot', t: 'cap', p1: [-0.5, 1.9], p2: [4.6, 1.9], r1: 0.6, m: 'glow', mode: 'glow', ring: false },
        ],
        anims: PLAYER_ANIMS,
    }),

    // ============ ECHO — the suit AI (portrait only) ============
    echo: humanoid({
        cell: [40, 40],
        mats: { skin: '#1c4a66', glow: '#5ff6ff', plate: '#2b6e93', hair: '#0e2232' },
        outline: '#06141e', emissive: ['glow', 'skin', 'plate'],
        body: { headR: 6.2, torso: 6, thigh: 1, shin: 1 },
        w: { neck: 1.6, chest: 4, waist: 3, hips: 2 },
        noArms: true, noLegs: true,
        m: { torso: 'plate', pelvis: 'plate', chest: 'plate' },
        extras: [
            { L: 'head', b: 'head', t: 'ell', at: [1.2, -1.2], rx: 5.6, ry: 5.2, m: 'plate' },
            { L: 'head', b: 'head', t: 'cap', p1: [0.6, 1.0], p2: [0.6, 5.6], r1: 1.2, m: 'glow', mode: 'glow' },
            { L: 'head', b: 'head', t: 'cap', p1: [-2.6, 3.4], p2: [-2.6, 5.0], r1: 0.4, m: 'glow', mode: 'glow', ring: false },
            { L: 'head', b: 'head', t: 'cap', p1: [4.6, -3], p2: [6.6, -5], r1: 0.5, m: 'glow', mode: 'glow', ring: false },
        ],
        anims: ['portrait'],
        portraitScale: 4,
    }),

    // ============ STREET RAT — punk ============
    punk: humanoid({
        cell: [108, 92],
        mats: { skin: '#d8a07a', hair: '#7dff4a', vest: '#4a2f2a', jeans: '#2f4a7a', boot: '#2a2220', metal: '#b9c0cc' },
        outline: '#140c0c',
        body: { thigh: 14, shin: 13.5, torso: 18, headR: 5.8, upperArm: 10.5, foreArm: 10 },
        w: { thigh: [4.3, 3.2], shin: [3.2, 2.6], uarm: [2.8, 2.3], farm: [2.4, 2.3], hand: 2.5, waist: 4, chest: 5.8, hips: 4.8, foot: 2.3 },
        m: { leg: 'jeans', arm: 'skin', torso: 'vest', chest: 'vest', pelvis: 'jeans', foot: 'boot' },
        variants: {
            b: { hair: '#ff8a1e', vest: '#2a2a33', jeans: '#53402e', skin: '#b07a52' },
            c: { hair: '#2ee8ff', vest: '#5a1d2a', jeans: '#2a2a2f', skin: '#efc6a2' },
            d: { hair: '#ff3df0', vest: '#26402a', jeans: '#42425a', skin: '#8a5a3c' },
            e: { hair: '#fff04a', vest: '#1a1a1a', jeans: '#6a2020', skin: '#e2b08a' },
        },
        extras: [
            { L: 'head', b: 'head', t: 'cap', p1: [3.6, -3.4], p2: [8.6, -4.6], r1: 1.4, r2: 0.5, m: 'hair' },
            { L: 'head', b: 'head', t: 'cap', p1: [4.4, -1.2], p2: [9.8, -0.8], r1: 1.5, r2: 0.5, m: 'hair' },
            { L: 'head', b: 'head', t: 'cap', p1: [4.4, 1.2], p2: [9.0, 2.6], r1: 1.4, r2: 0.5, m: 'hair' },
            { L: 'head', b: 'head', t: 'cap', p1: [-1, -4.6], p2: [3.6, -3.6], r1: 1.2, m: 'hair', mode: 'dark' },
            EYE(0.8, 3.9), BROW(1.9, 3.6),
            { L: 'head', b: 'head', t: 'dot', at: [-0.5, -1.0], m: 'metal', tone: 2 },
            { L: 'torso', b: 'torso', t: 'cap', p1: [1.6, -4.2], p2: [1.6, 4.2], r1: 1.1, m: 'metal' },
            { L: 'torso', b: 'torso', t: 'cap', p1: [5, 4.4], p2: [15, 4.6], r1: 1.5, m: 'skin' },
            { limb: 'farm', t: 'cap', p1: [6.5, 0], p2: [8.5, 0], r1: 2.6, m: 'vest' },
            { limb: 'uarm', t: 'ell', at: [1.2, 0], rx: 3.2, ry: 3.0, m: 'vest' },
        ],
        anims: [...REACT, 'run', 'punch', 'jab', 'kick', 'jumpkick', 'jump'],
    }),

    // ============ SHIV — knife punk ============
    knifer: humanoid({
        cell: [108, 92],
        mats: { skin: '#c99272', hood: '#3b3f4a', pants: '#1e2230', boot: '#121214', metal: '#d7dde8', glow: '#ff3a5a' },
        outline: '#0e0c10',
        body: { thigh: 14, shin: 13.5, torso: 17.5, headR: 5.6, upperArm: 10, foreArm: 10 },
        w: { thigh: [3.9, 2.9], shin: [2.9, 2.3], uarm: [2.6, 2.2], farm: [2.3, 2.1], hand: 2.2, waist: 3.8, chest: 5.4, hips: 4.4 },
        m: { leg: 'pants', arm: 'hood', torso: 'hood', chest: 'hood', pelvis: 'pants', foot: 'boot' },
        variants: { b: { hood: '#6a2130', pants: '#2a2a2a' }, c: { hood: '#2c4a30', pants: '#3a3020', skin: '#e6b896' }, d: { hood: '#d0c8b0', pants: '#30304a', skin: '#8a5c40' } },
        extras: [
            { L: 'head', b: 'head', t: 'ell', at: [0.6, -1.0], rx: 6.4, ry: 5.8, m: 'hood' },
            { L: 'head', b: 'head', t: 'ell', at: [-0.8, 2.6], rx: 3.4, ry: 2.6, m: 'skin', ring: false },
            { L: 'head', b: 'head', t: 'cap', p1: [-2.2, 1.6], p2: [-2.2, 4.4], r1: 0.9, m: 'pants', mode: 'flat', ring: false },
            { L: 'head', b: 'head', t: 'dot', at: [0.4, 3.6], m: 'glow', tone: 2 },
            { L: 'torso', b: 'torso', t: 'ell', at: [7, 5.2], rx: 3, ry: 1.4, m: 'hood', mode: 'dark' },
            { L: 'farm', b: 'handF', t: 'poly', pts: [[-1, -0.8], [-1, 0.8], [7, 0.6], [9, 0], [7, -0.9]], m: 'metal', rot: 0 },
        ],
        anims: [...REACT, 'run', 'slash', 'slash2', 'lunge', 'toss', 'jump'],
    }),

    // ============ BULK — bruiser ============
    bruiser: humanoid({
        scale: 1.06,
        cell: [132, 104],
        mats: { skin: '#c48660', beard: '#3a2418', tank: '#d8d0c0', pants: '#4a4a3a', boot: '#2a2018', shades: '#202430', metal: '#b0b6c0' },
        outline: '#140c08',
        body: { thigh: 15, shin: 13, torso: 22, headR: 6.2, neck: 2.5, upperArm: 13, foreArm: 12.5, shoulderDrop: 3 },
        w: { thigh: [6.2, 4.6], shin: [4.4, 3.6], uarm: [4.6, 4.0], farm: [4.0, 4.4], hand: 3.6, waist: 8.6, chest: 9.6, hips: 7.2, neck: 3.4, foot: 3.2, chestY: 1.0 },
        m: { leg: 'pants', arm: 'skin', torso: 'tank', chest: 'tank', pelvis: 'pants' },
        variants: { b: { tank: '#2a2a2a', pants: '#2f3a52', skin: '#8a5838', beard: '#120c08' }, c: { tank: '#a8322a', pants: '#3a2e24', skin: '#e0b08c', beard: '#a0602a' } },
        extras: [
            { L: 'head', b: 'head', t: 'ell', at: [-2.0, 2.2], rx: 3.4, ry: 3.6, m: 'beard' },
            { L: 'head', b: 'head', t: 'cap', p1: [1.0, 1.4], p2: [1.0, 5.6], r1: 1.1, m: 'shades', mode: 'flat' },
            { L: 'head', b: 'head', t: 'dot', at: [1.2, 5.0], m: 'metal', tone: 2 },
            { L: 'torso', b: 'torso', t: 'ell', at: [18, -1], rx: 4, ry: 7, m: 'skin', rot: 90 },
            { limb: 'farm', t: 'cap', p1: [7, 0], p2: [10, 0], r1: 4.6, m: 'metal' },
        ],
        anims: [...REACT, 'slam', 'punch', 'charge', 'windup', 'grab', 'throwF'],
    }),

    // ============ AUREX SEC — shield guard ============
    guard: humanoid({
        cell: [116, 96],
        mats: { armor: '#2c3a52', plate: '#8c9ab4', visor: '#ffb43a', suit: '#1c2232', boot: '#14161e', shield: '#4a5a78', skin: '#c99272' },
        outline: '#0a0c14', emissive: ['visor'],
        body: { thigh: 14, shin: 14, torso: 18.5, headR: 6, upperArm: 10.5, foreArm: 10 },
        w: { thigh: [4.4, 3.4], shin: [3.4, 2.8], uarm: [2.9, 2.5], farm: [2.6, 2.6], hand: 2.4, waist: 4.2, chest: 6.2, hips: 5, foot: 2.4 },
        m: { leg: 'suit', shin: 'armor', arm: 'suit', forearm: 'armor', hand: 'suit', torso: 'armor', chest: 'armor', pelvis: 'suit', head: 'armor' },
        variants: { elite: { armor: '#4a2430', plate: '#c08a90', shield: '#6a3040', visor: '#ff4a6a' } },
        extras: [
            { L: 'head', b: 'head', t: 'ell', at: [0.8, -0.4], rx: 6.4, ry: 6.0, m: 'armor' },
            { L: 'head', b: 'head', t: 'cap', p1: [0.4, 2.2], p2: [0.6, 6.2], r1: 1.4, m: 'visor', mode: 'glow' },
            { L: 'head', b: 'head', t: 'cap', p1: [-3.6, 2.6], p2: [-3.2, 5.6], r1: 1.1, m: 'plate' },
            { L: 'torso', b: 'torso', t: 'ell', at: [12, 1.6], rx: 5.2, ry: 5.2, m: 'plate' },
            { L: 'torso', b: 'torso', t: 'cap', p1: [2.6, -4.2], p2: [2.6, 4.2], r1: 1.3, m: 'plate' },
            { limb: 'uarm', t: 'ell', at: [1.4, 0], rx: 3.4, ry: 3.0, m: 'plate' },
            { L: 'barm', b: 'handB', t: 'cap', p1: [-3, 0], p2: [12, 0], r1: 1.2, m: 'suit' },
            { L: 'barm', b: 'handB', t: 'cap', p1: [9, 0], p2: [12, 0], r1: 0.7, m: 'visor', mode: 'glow', ring: false },
            { L: 'farm', b: 'farmF', t: 'poly', pts: [[-6, -4], [16, -4], [17, 0], [16, 4], [-6, 4], [-7, 0]], m: 'shield' },
            { L: 'farm', b: 'farmF', t: 'cap', p1: [-2, 0], p2: [12, 0], r1: 0.8, m: 'visor', mode: 'glow', ring: false },
        ],
        anims: [...REACT, 'cross', 'bash', 'block'],
    }),

    // ============ ENFORCER — gunner ============
    gunner: humanoid({
        cell: [112, 96],
        mats: { skin: '#e2b490', hair: '#1a1a22', coat: '#3a3448', shirt: '#7a1a2a', pants: '#1e1c26', boot: '#100e14', metal: '#9aa2b4', glow: '#ff3a3a' },
        outline: '#0c0a10',
        body: { thigh: 14, shin: 14, torso: 18.5, headR: 5.8, upperArm: 10.5, foreArm: 10 },
        w: { thigh: [4, 3], shin: [3, 2.4], uarm: [2.8, 2.4], farm: [2.5, 2.3], hand: 2.3, waist: 4, chest: 5.8, hips: 4.8 },
        m: { leg: 'pants', arm: 'coat', torso: 'coat', chest: 'shirt', pelvis: 'coat' },
        variants: { b: { coat: '#4a3a24', shirt: '#2a2a2a', hair: '#8a5a2a' }, c: { coat: '#1a2a3a', shirt: '#d0c8b8', skin: '#8a5a3c' } },
        extras: [
            { L: 'back', b: 'torso', t: 'poly', pts: [[2, -5], [2, 3], [-14, 4], [-16, -7]], m: 'coat' },
            { L: 'head', b: 'head', t: 'ell', at: [2.2, -1.2], rx: 3.8, ry: 5.2, m: 'hair' },
            { L: 'head', b: 'head', t: 'cap', p1: [0.8, 2.0], p2: [0.8, 5.6], r1: 1.0, m: 'pants', mode: 'flat' },
            { L: 'head', b: 'head', t: 'dot', at: [0.9, 5.0], m: 'glow', tone: 2 },
            { L: 'torso', b: 'torso', t: 'poly', pts: [[17, 2], [17, 5.6], [6, 5.6], [10, 2]], m: 'coat' },
            { L: 'farm', b: 'handF', t: 'poly', pts: [[-1, -1.4], [6, -1.4], [6, 0.6], [1.5, 0.6], [1.2, 3], [-0.8, 3]], m: 'metal' },
        ],
        anims: [...REACT, 'shoot', 'punch', 'run'],
    }),

    // ============ KUNOICHI — cyber ninja ============
    ninja: humanoid({
        cell: [112, 96],
        mats: { suit: '#1a1a26', wrap: '#3a2a4a', mask: '#2a2a3a', scarf: '#d02a4a', glow: '#ff2a8a', skin: '#e8b898', metal: '#cfd6e6' },
        outline: '#08060c', emissive: ['glow'],
        body: { thigh: 13.5, shin: 13.5, torso: 16.5, headR: 5.4, upperArm: 10, foreArm: 9.5 },
        w: { thigh: [3.7, 2.7], shin: [2.7, 2.1], uarm: [2.2, 1.9], farm: [1.9, 2.0], hand: 2.0, waist: 3.0, chest: 4.6, hips: 4.4 },
        m: { leg: 'suit', shin: 'wrap', forearm: 'wrap', hand: 'suit', torso: 'suit', head: 'mask', foot: 'wrap' },
        variants: { b: { scarf: '#2ad0ff', glow: '#2ad0ff', wrap: '#2a3a4a' }, c: { scarf: '#ffd02a', glow: '#ffae2a', suit: '#2a1a1a' } },
        extras: [
            { L: 'back', b: 'head', t: 'chain', at: [1.6, -4.4], ang: 190, segs: [[4, 1.8, 2.2], [5, 2.2, 1.6], [6, 1.6, 0.8]], curl: -10, m: 'suit' },
            { L: 'back', b: 'torso', t: 'chain', at: [16, -2], ang: 185, segs: [[6, 1.6, 1.5], [6, 1.5, 1.3], [6, 1.3, 0.8]], curl: -8, swing: 1.4, m: 'scarf' },
            { L: 'head', b: 'head', t: 'cap', p1: [1.0, 1.8], p2: [1.0, 5.2], r1: 0.9, m: 'glow', mode: 'glow' },
            { L: 'torso', b: 'torso', t: 'cap', p1: [15, -3], p2: [16, 3], r1: 1.8, m: 'scarf' },
            { L: 'torso', b: 'torso', t: 'cap', p1: [2.4, -3], p2: [2.4, 3], r1: 1, m: 'scarf' },
            { L: 'farm', b: 'handF', t: 'poly', pts: [[-2, -0.7], [-2, 0.7], [13, 0.6], [16, -0.2], [13, -1.0]], m: 'metal' },
            { L: 'farm', b: 'handF', t: 'cap', p1: [1, -0.9], p2: [14, -0.9], r1: 0.35, m: 'glow', mode: 'glow', ring: false },
        ],
        anims: [...REACT, 'run', 'slash', 'slash2', 'jump', 'flip', 'toss', 'jumpkick'],
    }),

    // ============ RIPPER — claw cyborg ============
    ripper: humanoid({
        cell: [116, 96],
        mats: { skin: '#9c7a6a', metal: '#7a8494', dark: '#2a2e38', pants: '#3a2a22', glow: '#ff4a1a', hair: '#c0c6d2' },
        outline: '#0c0a0a', emissive: ['glow'],
        body: { thigh: 14, shin: 14, torso: 18, headR: 5.8, upperArm: 11, foreArm: 10.5 },
        w: { thigh: [4.2, 3.0], shin: [3.0, 2.6], uarm: [3.0, 2.4], farm: [2.6, 3.0], hand: 2.6, waist: 3.8, chest: 6.0, hips: 4.8 },
        m: { leg: 'pants', shin: 'metal', arm: 'skin', forearm: 'metal', hand: 'metal', torso: 'dark', chest: 'skin', foot: 'metal' },
        variants: { b: { glow: '#3aff6a', pants: '#24302a', skin: '#c8a088' } },
        extras: [
            { L: 'head', b: 'head', t: 'poly', pts: [[3, -4], [7.5, -2], [3.6, 0], [8, 1.4], [3.4, 3]], m: 'hair' },
            { L: 'head', b: 'head', t: 'ell', at: [0.4, 3.4], rx: 1.4, ry: 1.4, m: 'glow', mode: 'glow' },
            { L: 'head', b: 'head', t: 'cap', p1: [-2.6, 2], p2: [-2.4, 5], r1: 1.0, m: 'metal' },
            { L: 'torso', b: 'torso', t: 'cap', p1: [5, 3], p2: [14, 4], r1: 0.6, m: 'glow', mode: 'glow', ring: false },
            { L: 'torso', b: 'torso', t: 'cap', p1: [15, -4], p2: [16, 3], r1: 1.6, m: 'metal' },
            { L: 'farm', b: 'handF', t: 'poly', pts: [[0, 0.6], [9, 1.6], [10.5, 3], [1, 2.2]], m: 'metal' },
            { L: 'farm', b: 'handF', t: 'poly', pts: [[0, -0.8], [10, -0.6], [12, 0.4], [1, 0.8]], m: 'metal' },
            { L: 'farm', b: 'handF', t: 'poly', pts: [[0, -2.2], [9, -2.8], [10.5, -1.6], [1, -0.6]], m: 'metal' },
            { L: 'barm', b: 'handB', t: 'poly', pts: [[0, -0.8], [9, -0.6], [11, 0.4], [1, 0.8]], m: 'metal' },
        ],
        anims: [...REACT, 'run', 'slash', 'slash2', 'leap', 'jump'],
    }),

    // ============ SYNTH TROOPER — android ============
    synth: humanoid({
        cell: [112, 96],
        mats: { shell: '#dfe4ee', joint: '#3a3e4c', glow: '#3affd2', plate: '#9aa4bc', dark: '#20222c' },
        outline: '#0a0c12', emissive: ['glow'],
        body: { thigh: 14, shin: 14, torso: 18, headR: 5.4, upperArm: 10.5, foreArm: 10 },
        w: { thigh: [3.9, 2.8], shin: [2.8, 2.3], uarm: [2.4, 2.0], farm: [2.2, 2.4], hand: 2.2, waist: 3.4, chest: 5.6, hips: 4.4 },
        m: { leg: 'joint', shin: 'shell', arm: 'joint', forearm: 'shell', hand: 'plate', torso: 'joint', chest: 'shell', head: 'shell', pelvis: 'plate', neck: 'joint', foot: 'plate' },
        variants: { elite: { shell: '#2a2a34', plate: '#5a5a6a', glow: '#ff2a4a', joint: '#141418' }, gold: { shell: '#e8c870', plate: '#b08a3a', glow: '#ffffff' } },
        extras: [
            { L: 'head', b: 'head', t: 'cap', p1: [0.4, 1.4], p2: [0.4, 5.0], r1: 0.8, m: 'glow', mode: 'glow' },
            { L: 'head', b: 'head', t: 'cap', p1: [-3, -2], p2: [3, -3.6], r1: 0.5, m: 'plate', ring: false },
            { L: 'torso', b: 'torso', t: 'ell', at: [11.5, 3.6], rx: 1.2, ry: 1.2, m: 'glow', mode: 'glow' },
            { limb: 'uarm', t: 'ell', at: [1.4, 0], rx: 3.0, ry: 2.6, m: 'shell' },
            { limb: 'thigh', t: 'ell', at: [5, 0], rx: 4.4, ry: 3.6, m: 'shell' },
            { limb: 'shin', t: 'dot', at: [0, 0], m: 'glow', tone: 2 },
        ],
        anims: [...REACT, 'run', 'punch', 'jab', 'cross', 'kick', 'lunge', 'block'],
    }),

    // ============ HUSK — lab mutant ============
    husk: humanoid({
        cell: [128, 100],
        mats: { skin: '#7a9a6a', flesh: '#b06a7a', rag: '#cfd2c4', glow: '#c6ff3a', tube: '#4a5a6a', dark: '#2a3428' },
        outline: '#0a1008', emissive: ['glow'],
        body: { thigh: 13, shin: 12, torso: 22, headR: 5.4, upperArm: 13, foreArm: 13, shoulderDrop: 3 },
        w: { thigh: [5.2, 4], shin: [4, 3.4], uarm: [4.2, 3.6], farm: [3.8, 4.6], hand: 3.6, waist: 7, chest: 9, hips: 6, neck: 3, foot: 3 },
        m: { leg: 'rag', arm: 'skin', hand: 'skin', torso: 'skin', chest: 'skin', pelvis: 'rag', foot: 'skin' },
        variants: { b: { skin: '#9a7a9a', glow: '#3affe0', flesh: '#6a4a8a' } },
        extras: [
            { L: 'back', b: 'torso', t: 'cap', p1: [20, -6], p2: [6, -10], r1: 1.4, m: 'tube' },
            { L: 'back', b: 'torso', t: 'cap', p1: [16, -7], p2: [2, -9], r1: 1.2, m: 'tube' },
            { L: 'torso', b: 'torso', t: 'ell', at: [14, -4], rx: 2.4, ry: 2.4, m: 'glow', mode: 'glow' },
            { L: 'torso', b: 'torso', t: 'ell', at: [8, 5], rx: 2.0, ry: 1.6, m: 'glow', mode: 'glow' },
            { L: 'torso', b: 'torso', t: 'ell', at: [17, 3], rx: 3.6, ry: 4.4, m: 'flesh' },
            { L: 'head', b: 'head', t: 'dot', at: [0.6, 3.6], m: 'glow', tone: 2, size: 1.4 },
            { L: 'head', b: 'head', t: 'cap', p1: [-2.6, 2.4], p2: [-2.4, 5.4], r1: 0.8, m: 'dark', mode: 'flat', ring: false },
            { limb: 'farm', t: 'ell', at: [9, 0], rx: 3.2, ry: 4.6, m: 'flesh' },
        ],
        anims: [...REACT, 'slam', 'spit', 'punch'],
    }),

    // ============ HORNET DRONE ============
    drone: humanoid({
        cell: [64, 48],
        mats: { shell: '#3a3e4a', plate: '#8a92a6', glow: '#ff3a3a', rotor: '#b8c0d0', dark: '#1a1c22' },
        outline: '#08080c', emissive: ['glow'],
        body: { thigh: 1, shin: 1, torso: 4, headR: 3 },
        noArms: true, noLegs: true, noTorso: true, noHead: true,
        variants: { b: { glow: '#3affd2', shell: '#2a3a3a' } },
        extras: [
            { L: 'back', b: 'hip', t: 'cap', p1: [6, -10], p2: [6, 10], r1: 0.8, m: 'dark' },
            { L: 'back', b: 'hip', t: 'ell', at: [7.5, -11], rx: 1.0, ry: 4.4, m: 'rotor', rot: 90 },
            { L: 'torso', b: 'hip', t: 'ell', at: [4, 0], rx: 4.2, ry: 7.4, m: 'shell' },
            { L: 'torso', b: 'hip', t: 'ell', at: [5.4, 1.4], rx: 2.2, ry: 4.6, m: 'plate' },
            { L: 'top', b: 'hip', t: 'ell', at: [3.6, 4.6], rx: 1.9, ry: 1.9, m: 'glow', mode: 'glow' },
            { L: 'top', b: 'hip', t: 'cap', p1: [0.4, 2], p2: [-2.6, 5], r1: 0.8, m: 'dark' },
            { L: 'top', b: 'hip', t: 'ell', at: [7.5, 10], rx: 1.0, ry: 4.4, m: 'rotor', rot: 90 },
            { L: 'top', b: 'hip', t: 'cap', p1: [6, 2], p2: [6, 10], r1: 0.8, m: 'dark' },
        ],
        anims: ['hover', 'hurt', 'fall', 'down', 'shoot', 'portrait'],
        animOverrides: {
            hover: { fps: 10, loop: true, frames: [{ dy: 0 }, { dy: 1, hair: 1 }] },
            hurt: { fps: 1, loop: false, frames: [{ spin: -14 }] },
            fall: { fps: 8, loop: true, frames: [{ spin: 30, air: true }, { spin: 70, air: true }] },
            down: { fps: 1, loop: false, frames: [{ spin: 90 }] },
            shoot: { st: [{ spin: -6 }], ac: [{ spin: 4 }], rc: [{ spin: 0 }] },
            portrait: { fps: 1, loop: false, frames: [{}] },
        },
    }),

    // ============ TICK MINE ============
    mine: humanoid({
        cell: [48, 36],
        mats: { shell: '#4a4a3a', plate: '#c8a83a', glow: '#ff3a1a', leg: '#2a2a2a' },
        outline: '#0a0a06', emissive: ['glow'],
        body: { thigh: 5, shin: 5, foot: 1, torso: 3, headR: 2, shoulderDrop: 0 },
        w: { thigh: [1, 0.9], shin: [0.9, 0.7], foot: 0.6 },
        noArms: true, noTorso: true, noHead: true,
        m: { leg: 'leg', foot: 'leg' },
        extras: [
            { L: 'torso', b: 'hip', t: 'ell', at: [3, 0], rx: 4.2, ry: 6.2, m: 'shell' },
            { L: 'torso', b: 'hip', t: 'ell', at: [5, 0], rx: 2.0, ry: 4.4, m: 'plate' },
            { L: 'top', b: 'hip', t: 'ell', at: [5.6, 3.2], rx: 1.4, ry: 1.4, m: 'glow', mode: 'glow' },
        ],
        anims: ['idle', 'walk', 'fall', 'down', 'hurt', 'portrait'],
        animOverrides: {
            idle: { fps: 6, loop: true, frames: [{ fhip: 50, fkn: 100, bhip: -50, bkn: -100 }, { fhip: 46, fkn: 96, bhip: -46, bkn: -96, dy: 1 }] },
            walk: { fps: 14, loop: true, frames: [{ fhip: 70, fkn: 110, bhip: -30, bkn: -90 }, { fhip: 30, fkn: 90, bhip: -70, bkn: -110 }] },
            hurt: { fps: 1, loop: false, frames: [{ fhip: 60, fkn: 120, bhip: -60, bkn: -120, spin: 10 }] },
            fall: { fps: 10, loop: true, frames: [{ air: true, spin: 90, fhip: 60, fkn: 120, bhip: -60, bkn: -120 }, { air: true, spin: 200, fhip: 60, fkn: 120, bhip: -60, bkn: -120 }] },
            down: { fps: 1, loop: false, frames: [{ spin: 180, fhip: 60, fkn: 120, bhip: -60, bkn: -120 }] },
            portrait: { fps: 1, loop: false, frames: [{ fhip: 50, fkn: 100, bhip: -50, bkn: -100 }] },
        },
    }),

    // ================================================== BOSSES
    jackhammer: humanoid({
        scale: 1.28,
        cell: [156, 124],
        mats: { skin: '#b07850', hair: '#e8e0d0', vest: '#e0b020', stripe: '#1a1a1a', pants: '#3a3a44', boot: '#2a1e14', metal: '#7a8090', piston: '#c8ced8', glow: '#ff8a1a' },
        outline: '#120a06', emissive: ['glow'],
        body: { thigh: 16, shin: 15, torso: 25, headR: 6.8, neck: 3, upperArm: 14, foreArm: 15, shoulderDrop: 3 },
        w: { thigh: [6.6, 5.0], shin: [5.0, 4.2], uarm: [5.6, 4.8], farm: [5.6, 7.2], hand: 5.4, waist: 9, chest: 11, hips: 7.6, neck: 3.8, foot: 3.6 },
        m: { leg: 'pants', arm: 'metal', forearm: 'piston', hand: 'metal', torso: 'vest', chest: 'vest', pelvis: 'pants' },
        variants: { rage: { glow: '#ff2a1a', vest: '#ff6a1a', skin: '#c86a50' } },
        extras: [
            { L: 'head', b: 'head', t: 'cap', p1: [4, -4], p2: [6.6, 2], r1: 1.6, r2: 1.2, m: 'hair' },
            { L: 'head', b: 'head', t: 'cap', p1: [0.6, 1.6], p2: [0.8, 6.4], r1: 1.6, m: 'metal' },
            { L: 'head', b: 'head', t: 'ell', at: [0.8, 4.6], rx: 1.2, ry: 1.2, m: 'glow', mode: 'glow' },
            { L: 'head', b: 'head', t: 'ell', at: [-3.4, 2.6], rx: 2.4, ry: 3.4, m: 'hair' },
            { L: 'torso', b: 'torso', t: 'cap', p1: [6, -10], p2: [20, 10], r1: 1.4, m: 'stripe', ring: false },
            { L: 'torso', b: 'torso', t: 'cap', p1: [12, -10], p2: [24, 6], r1: 1.4, m: 'stripe', ring: false },
            { L: 'torso', b: 'torso', t: 'ell', at: [21, 6], rx: 4, ry: 4, m: 'skin' },
            { limb: 'uarm', t: 'ell', at: [1, 0], rx: 6.4, ry: 5.6, m: 'metal' },
            { limb: 'farm', t: 'cap', p1: [3, 2.8], p2: [11, 2.8], r1: 1.4, m: 'metal' },
            { limb: 'farm', t: 'ell', at: [3, 0], rx: 2, ry: 2, m: 'glow', mode: 'glow' },
            { L: 'back', b: 'torso', t: 'poly', pts: [[22, -6], [26, -13], [16, -14], [10, -9]], m: 'metal' },
            { L: 'back', b: 'torso', t: 'cap', p1: [24, -12], p2: [32, -12], r1: 1.4, m: 'piston' },
        ],
        anims: [...REACT, 'slam', 'punch', 'charge', 'windup', 'grab', 'throwF', 'jump', 'land', 'victory', 'stomp'],
    }),

    viper: humanoid({
        cell: [124, 100],
        mats: { skin: '#e8c0a0', hair: '#1aa86a', suit: '#16241e', scale: '#2a5a42', glow: '#7aff3a', metal: '#cfe0d6', visor: '#ffd23a' },
        outline: '#06100a', emissive: ['glow', 'visor'],
        body: { thigh: 14, shin: 14, torso: 17, headR: 5.5, upperArm: 10.5, foreArm: 10 },
        w: { thigh: [3.8, 2.7], shin: [2.7, 2.1], uarm: [2.3, 1.9], farm: [2, 2.2], hand: 2.1, waist: 3.1, chest: 4.8, hips: 4.6 },
        m: { leg: 'suit', shin: 'scale', arm: 'suit', forearm: 'scale', hand: 'suit', torso: 'suit', chest: 'scale', foot: 'scale' },
        variants: { ghost: { suit: '#7aff3a', scale: '#7aff3a', hair: '#7aff3a', skin: '#c0ffb0', metal: '#c0ffb0' } },
        extras: [
            { L: 'back', b: 'head', t: 'chain', at: [2, -4.6], ang: 194, segs: [[6, 2.2, 2.6], [6, 2.6, 2.0], [6, 2.0, 1.4], [6, 1.4, 0.6]], curl: -12, m: 'hair' },
            { L: 'head', b: 'head', t: 'ell', at: [1.4, -1.0], rx: 5.0, ry: 5.0, m: 'scale' },
            { L: 'head', b: 'head', t: 'poly', pts: [[4.6, -3], [7, 1], [4.6, 5.2], [3, 1]], m: 'scale' },
            { L: 'head', b: 'head', t: 'cap', p1: [1.2, 2.4], p2: [1.4, 5.4], r1: 0.9, m: 'visor', mode: 'glow' },
            { L: 'head', b: 'head', t: 'dot', at: [-2.8, 4.0], outline: true },
            { L: 'torso', b: 'torso', t: 'cap', p1: [5, 4.4], p2: [15, 4.0], r1: 0.6, m: 'glow', mode: 'glow', ring: false },
            { limb: 'uarm', t: 'ell', at: [1.2, 0], rx: 2.8, ry: 2.4, m: 'metal' },
            { L: 'farm', b: 'handF', t: 'poly', pts: [[-2, -0.8], [-2, 0.8], [14, 0.8], [17, -0.2], [14, -1.2]], m: 'metal' },
            { L: 'farm', b: 'handF', t: 'cap', p1: [1, -1.1], p2: [15, -1.1], r1: 0.35, m: 'glow', mode: 'glow', ring: false },
            { L: 'barm', b: 'handB', t: 'poly', pts: [[-2, -0.8], [-2, 0.8], [14, 0.8], [17, -0.2], [14, -1.2]], m: 'metal' },
        ],
        anims: [...REACT, 'run', 'slash', 'slash2', 'lunge', 'toss', 'jump', 'flip', 'jumpkick', 'victory', 'stance'],
    }),

    oni: humanoid({
        scale: 1.12,
        cell: [172, 124],
        mats: { armor: '#5a1a1e', plate: '#2a2a30', gold: '#d8a83a', mask: '#c8282a', glow: '#ffea3a', cloth: '#1a1a24', metal: '#dfe6f2', skin: '#606878' },
        outline: '#0e0608', emissive: ['glow'],
        body: { thigh: 15, shin: 15, torso: 20, headR: 6, neck: 2.5, upperArm: 12, foreArm: 11.5 },
        w: { thigh: [5, 3.8], shin: [3.8, 3.0], uarm: [3.2, 2.8], farm: [3, 3.2], hand: 2.8, waist: 5, chest: 7.2, hips: 6, foot: 2.8 },
        m: { leg: 'cloth', shin: 'armor', arm: 'cloth', forearm: 'armor', hand: 'plate', torso: 'armor', chest: 'armor', head: 'mask', pelvis: 'cloth', foot: 'plate' },
        variants: { rage: { glow: '#ff3a3a', armor: '#2a0a0e', mask: '#ff3a3a' } },
        extras: [
            { L: 'head', b: 'head', t: 'ell', at: [1.8, -1.2], rx: 5.4, ry: 6.0, m: 'plate' },
            { L: 'head', b: 'head', t: 'poly', pts: [[4, 1], [11, 6], [6, 1.6]], m: 'gold' },
            { L: 'head', b: 'head', t: 'poly', pts: [[4, -1.8], [10, -4.6], [5.6, -1]], m: 'gold' },
            { L: 'head', b: 'head', t: 'poly', pts: [[-4.6, 0], [-6.6, 3.4], [-4, 6.4], [-2, 6.6], [-1, 3]], m: 'mask' },
            { L: 'head', b: 'head', t: 'cap', p1: [0.8, 2.6], p2: [1, 5.6], r1: 0.9, m: 'glow', mode: 'glow' },
            { L: 'head', b: 'head', t: 'cap', p1: [-3.4, 4.0], p2: [-3.2, 6.0], r1: 0.5, m: 'metal', ring: false },
            { L: 'torso', b: 'torso', t: 'cap', p1: [4, -6], p2: [4, 6], r1: 1.6, m: 'gold' },
            { L: 'torso', b: 'torso', t: 'cap', p1: [10, -6], p2: [10, 6], r1: 1.0, m: 'plate', ring: false },
            { L: 'torso', b: 'torso', t: 'cap', p1: [14, -6.4], p2: [14, 6.4], r1: 1.0, m: 'plate', ring: false },
            { L: 'fleg', b: 'hip', t: 'poly', pts: [[1, 2], [1, 8], [-12, 9], [-13, 2]], m: 'armor' },
            { L: 'bleg', b: 'hip', t: 'poly', pts: [[1, -8], [1, -1], [-13, -1], [-12, -9]], m: 'armor' },
            { limb: 'uarm', t: 'poly', pts: [[-2, -4], [-2, 5], [8, 6], [8, -5]], m: 'armor' },
            { limb: 'uarm', t: 'cap', p1: [0, -4], p2: [0, 5], r1: 0.8, m: 'gold', ring: false },
            { L: 'farm', b: 'handF', t: 'cap', p1: [-4, 0], p2: [2, 0], r1: 1.1, m: 'gold' },
            { L: 'farm', b: 'handF', t: 'poly', pts: [[2, -0.9], [2, 0.9], [36, 1.4], [42, 0.2], [36, -0.6]], m: 'metal' },
            { L: 'farm', b: 'handF', t: 'cap', p1: [4, 1.2], p2: [37, 1.6], r1: 0.35, m: 'glow', mode: 'glow', ring: false },
        ],
        anims: [...REACT, 'slash', 'slash2', 'lunge', 'stance', 'jump', 'run', 'victory', 'swingC'],
    }),

    bulwark: humanoid({
        scale: 1.3,
        cell: [184, 148],
        mats: { armor: '#5a6248', plate: '#a8ae90', dark: '#2a2e26', glow: '#ff9a2a', metal: '#7a8088', hazard: '#e8c020', cockpit: '#3ac8ff' },
        outline: '#0a0c08', emissive: ['glow', 'cockpit'],
        body: { thigh: 17, shin: 17, foot: 8, torso: 22, headR: 7.4, neck: 2, upperArm: 14, foreArm: 15, shoulderDrop: 4 },
        w: { thigh: [6.8, 5.6], shin: [6.4, 5.4], uarm: [5.6, 5.0], farm: [6.4, 7.0], hand: 4.6, waist: 9.4, chest: 13, hips: 9, neck: 4, foot: 4.2, headY: 0.8 },
        m: { leg: 'dark', shin: 'armor', arm: 'dark', forearm: 'armor', hand: 'metal', torso: 'armor', chest: 'armor', head: 'plate', pelvis: 'dark', foot: 'plate', neck: 'dark' },
        variants: { hot: { glow: '#ff3a1a', armor: '#7a3a2a', plate: '#d07a5a' } },
        extras: [
            { L: 'back', b: 'torso', t: 'poly', pts: [[26, -6], [30, -18], [12, -20], [8, -10]], m: 'plate' },
            { L: 'back', b: 'torso', t: 'dot', at: [26, -12], m: 'glow', tone: 2, size: 2 },
            { L: 'back', b: 'torso', t: 'dot', at: [21, -14], m: 'glow', tone: 2, size: 2 },
            { L: 'back', b: 'torso', t: 'dot', at: [16, -16], m: 'glow', tone: 2, size: 2 },
            { L: 'head', b: 'head', t: 'ell', at: [0, 3.6], rx: 3.6, ry: 2.6, m: 'cockpit', mode: 'glow' },
            { L: 'head', b: 'head', t: 'cap', p1: [4.6, -5], p2: [4.6, 4], r1: 1.2, m: 'armor' },
            { L: 'torso', b: 'torso', t: 'poly', pts: [[22, 2], [22, 12], [8, 12], [6, 2]], m: 'plate' },
            { L: 'torso', b: 'torso', t: 'cap', p1: [5, 4], p2: [5, 11], r1: 1.2, m: 'hazard', ring: false },
            { L: 'torso', b: 'torso', t: 'ell', at: [15, 8], rx: 2.2, ry: 2.2, m: 'glow', mode: 'glow' },
            { limb: 'uarm', t: 'poly', pts: [[-3, -7], [-3, 7], [9, 7], [9, -7]], m: 'plate' },
            { limb: 'farm', t: 'poly', pts: [[1, -6], [1, 6], [16, 6], [16, -6]], m: 'armor' },
            { L: 'farm', b: 'farmF', t: 'cap', p1: [14, -2.6], p2: [21, -2.6], r1: 1.6, m: 'metal' },
            { L: 'farm', b: 'farmF', t: 'cap', p1: [14, 2.6], p2: [21, 2.6], r1: 1.6, m: 'metal' },
            { limb: 'shin', t: 'poly', pts: [[-2, -6], [-2, 6], [10, 5], [10, -5]], m: 'plate' },
            { limb: 'thigh', t: 'cap', p1: [3, 0], p2: [14, 0], r1: 1, m: 'hazard', ring: false },
        ],
        anims: [...REACT, 'slam', 'punch', 'charge', 'windup', 'shoot', 'jump', 'land', 'stomp', 'victory'],
    }),

    goliath: humanoid({
        scale: 1.36,
        cell: [180, 140],
        mats: { skin: '#8aa07a', flesh: '#c07080', glow: '#b6ff2a', tube: '#5a6a7a', rag: '#d2d4c8', bone: '#e8dcc0', dark: '#2a3426' },
        outline: '#081006', emissive: ['glow'],
        body: { thigh: 16, shin: 15, torso: 28, headR: 6.4, neck: 3, upperArm: 18, foreArm: 18, shoulderDrop: 4 },
        w: { thigh: [7, 5.6], shin: [5.4, 4.6], uarm: [6.6, 5.6], farm: [5.6, 7.6], hand: 5.6, waist: 10, chest: 14, hips: 8, neck: 4.4, foot: 4 },
        m: { leg: 'rag', arm: 'skin', hand: 'skin', torso: 'skin', chest: 'skin', pelvis: 'rag', foot: 'skin' },
        variants: { rage: { skin: '#a07a6a', glow: '#ff3a2a', flesh: '#ff6a6a' } },
        extras: [
            { L: 'back', b: 'torso', t: 'cap', p1: [26, -10], p2: [8, -16], r1: 2.2, m: 'tube' },
            { L: 'back', b: 'torso', t: 'cap', p1: [22, -12], p2: [2, -14], r1: 1.8, m: 'tube' },
            { L: 'back', b: 'torso', t: 'ell', at: [24, -8], rx: 4, ry: 3.4, m: 'bone' },
            { L: 'torso', b: 'torso', t: 'ell', at: [20, 4], rx: 6, ry: 7.6, m: 'flesh' },
            { L: 'torso', b: 'torso', t: 'ell', at: [20, 4], rx: 2.6, ry: 2.6, m: 'glow', mode: 'glow' },
            { L: 'torso', b: 'torso', t: 'ell', at: [10, 8], rx: 2, ry: 1.6, m: 'glow', mode: 'glow' },
            { L: 'torso', b: 'torso', t: 'ell', at: [26, -6], rx: 2, ry: 1.6, m: 'glow', mode: 'glow' },
            { L: 'head', b: 'head', t: 'dot', at: [0.8, 3.8], m: 'glow', tone: 2, size: 1.6 },
            { L: 'head', b: 'head', t: 'poly', pts: [[-2, 2], [-5.6, 4.6], [-3, 6.2], [-0.6, 5]], m: 'bone' },
            { limb: 'farm', t: 'ell', at: [12, 0], rx: 5, ry: 6.4, m: 'flesh' },
            { L: 'farm', b: 'handF', t: 'poly', pts: [[1, -2], [9, -3.4], [11, -1.6], [2, 0]], m: 'bone' },
            { L: 'farm', b: 'handF', t: 'poly', pts: [[1, 1], [9, 1.6], [10, 3.4], [1.6, 2.6]], m: 'bone' },
        ],
        anims: [...REACT, 'slam', 'spit', 'punch', 'grab', 'throwF', 'jump', 'land', 'windup', 'victory', 'charge'],
    }),

    magnus: humanoid({
        cell: [124, 104],
        mats: { skin: '#e6c0a0', hair: '#d8dce4', suit: '#202232', shirt: '#f0f0f6', tie: '#c8a03a', metal: '#e8eef8', glow: '#ffd23a', shoe: '#0e0e14' },
        outline: '#0a0a10', emissive: ['glow'],
        body: { thigh: 15, shin: 15, torso: 19.5, headR: 5.8, upperArm: 11, foreArm: 10.5 },
        w: { thigh: [4.2, 3.2], shin: [3.2, 2.6], uarm: [2.8, 2.4], farm: [2.5, 2.4], hand: 2.2, waist: 4.2, chest: 6.0, hips: 5.0 },
        m: { leg: 'suit', arm: 'suit', torso: 'suit', chest: 'suit', foot: 'shoe' },
        extras: [
            { L: 'back', b: 'torso', t: 'poly', pts: [[3, -5], [3, 3], [-10, 4], [-12, -6]], m: 'suit' },
            { L: 'head', b: 'head', t: 'ell', at: [2.2, -1.4], rx: 4.0, ry: 5.4, m: 'hair' },
            { L: 'head', b: 'head', t: 'cap', p1: [3.4, 0], p2: [2.2, 4.8], r1: 1.4, m: 'hair' },
            EYE(0.8, 3.9), BROW(1.9, 3.6),
            { L: 'head', b: 'head', t: 'cap', p1: [-3, 3.2], p2: [-2.8, 5.2], r1: 0.4, m: 'hair', mode: 'dark', ring: false },
            { L: 'torso', b: 'torso', t: 'poly', pts: [[18, 2], [17, 6], [8, 5.4], [10, 3]], m: 'shirt' },
            { L: 'torso', b: 'torso', t: 'cap', p1: [17, 5], p2: [9, 5.4], r1: 0.8, m: 'tie', ring: false },
            { L: 'farm', b: 'handF', t: 'cap', p1: [-5, 0], p2: [1.5, 0], r1: 1.0, m: 'tie' },
            { L: 'farm', b: 'handF', t: 'poly', pts: [[1.5, -0.6], [1.5, 0.6], [26, 0.5], [29, 0], [26, -0.6]], m: 'metal' },
            { L: 'farm', b: 'handF', t: 'cap', p1: [3, 0], p2: [26, 0], r1: 0.3, m: 'glow', mode: 'glow', ring: false },
        ],
        anims: [...REACT, 'slash', 'slash2', 'lunge', 'stance', 'victory', 'stand', 'swingC', 'jump'],
    }),

    magnus2: humanoid({
        scale: 1.22,
        cell: [200, 160],
        mats: { skin: '#e6c0a0', hair: '#d8dce4', armor: '#e8e2d0', gold: '#d8a83a', dark: '#2a2630', glow: '#ffd23a', wing: '#ffe680', core: '#ffffff' },
        outline: '#120c06', emissive: ['glow', 'wing', 'core'],
        body: { thigh: 17, shin: 17, foot: 7, torso: 23, headR: 6.2, neck: 3, upperArm: 14, foreArm: 14, shoulderDrop: 3 },
        w: { thigh: [5.6, 4.4], shin: [4.6, 3.6], uarm: [4.2, 3.6], farm: [4, 5.4], hand: 3.6, waist: 6.4, chest: 9.6, hips: 6.6, neck: 3.2, foot: 3.4 },
        m: { leg: 'dark', shin: 'armor', arm: 'dark', forearm: 'gold', hand: 'armor', torso: 'armor', chest: 'armor', pelvis: 'dark', foot: 'armor' },
        variants: { rage: { glow: '#ff3a6a', wing: '#ff6a9a', gold: '#ff7a3a' } },
        extras: [
            { L: 'back', b: 'torso', t: 'poly', pts: [[20, -4], [44, -30], [38, -6], [50, -18], [30, 2]], m: 'wing', mode: 'glow' },
            { L: 'back', b: 'torso', t: 'poly', pts: [[16, -4], [34, -40], [30, -14], [12, -2]], m: 'wing', mode: 'glow' },
            { L: 'back', b: 'torso', t: 'poly', pts: [[12, -4], [18, -44], [22, -16], [8, -2]], m: 'gold' },
            { L: 'head', b: 'head', t: 'ell', at: [2.2, -1.4], rx: 4.4, ry: 5.6, m: 'hair' },
            { L: 'head', b: 'head', t: 'poly', pts: [[3.6, -5], [9, -1], [8, 2], [4.6, 1]], m: 'gold' },
            { L: 'head', b: 'head', t: 'cap', p1: [0.8, 2.6], p2: [1, 5.8], r1: 0.9, m: 'glow', mode: 'glow' },
            { L: 'torso', b: 'torso', t: 'ell', at: [15, 4], rx: 3, ry: 3, m: 'core', mode: 'glow' },
            { L: 'torso', b: 'torso', t: 'poly', pts: [[22, -2], [22, 10], [8, 9], [10, -1]], m: 'gold' },
            { L: 'torso', b: 'torso', t: 'ell', at: [15, 4], rx: 3, ry: 3, m: 'core', mode: 'glow' },
            { limb: 'uarm', t: 'poly', pts: [[-3, -6], [-3, 6], [8, 6], [8, -6]], m: 'armor' },
            { limb: 'farm', t: 'cap', p1: [2, 0], p2: [12, 0], r1: 0.7, m: 'glow', mode: 'glow', ring: false },
            { limb: 'shin', t: 'poly', pts: [[-2, -5], [-2, 5], [9, 4], [9, -4]], m: 'gold' },
            { L: 'farm', b: 'handF', t: 'poly', pts: [[0, -1.6], [0, 1.6], [26, 1.6], [34, 0], [26, -1.6]], m: 'wing', mode: 'glow' },
        ],
        anims: [...REACT, 'slash', 'slash2', 'lunge', 'fly', 'beam', 'jump', 'land', 'stomp', 'victory', 'windup'],
    }),
};

// Cosmetic name lists for grunt variety (the sim picks one per spawn).
export const GRUNT_NAMES = {
    punk: ['RAZOR', 'DEX', 'FANG', 'MOX', 'SPIKE', 'RICO', 'JINX', 'VERMIN', 'NIX', 'GUTTER'],
    knifer: ['SHIV', 'SLICK', 'PIKE', 'NEEDLE', 'CUTTER', 'TACK'],
    bruiser: ['BULK', 'HOGG', 'TONNE', 'ANVIL', 'BOULDER'],
    guard: ['AUREX SEC', 'SEC-04', 'SEC-11', 'WARDEN', 'SEC-23'],
    gunner: ['ENFORCER', 'DECKARD', 'VANCE', 'MAROS'],
    ninja: ['KUNOICHI', 'SHADE', 'KESTREL', 'MOTH'],
    ripper: ['RIPPER', 'GRINDER', 'TALON'],
    synth: ['SYNTH-α', 'SYNTH-β', 'SYNTH-γ', 'SYNTH-δ'],
    husk: ['HUSK', 'SPECIMEN', 'HOLLOW'],
    drone: ['HORNET'],
    mine: ['TICK MINE'],
};
