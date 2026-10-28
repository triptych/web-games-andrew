// The line of the Cinderpeak mine railway: one smooth track from the station at
// the foot of the mountain, in through the mouth, down past the lava, across the
// chasm, through the gem halls and out onto the cliff over the lava source. It is
// pure numbers (no three.js): a heading and a slope are integrated along the
// length, sampled every metre, and everything else (rails, tunnels, the cart's
// ride, the camera's lean) reads the samples. Mine coordinates are garden world
// coordinates, so the first stretch lies on the real cove outside.

import { STATION, PAD_Y } from './volcano-data.js';
import { smoothstep, clamp, lerp } from './util.js';

const DEG = Math.PI / 180;

/** Where each stretch begins and ends (metres along the track), and what it is. */
export const SECTIONS = [
    { id: 'station', name: 'Cinderpeak Station', s0: 0, s1: 40 },
    { id: 'gallery', name: 'The Old Gallery', s0: 40, s1: 126 },
    { id: 'crossing', name: 'The Molten River', s0: 126, s1: 250 },
    { id: 'descent', name: 'The Spiral Drop', s0: 250, s1: 346 },
    { id: 'tube', name: 'The Lava Tube', s0: 346, s1: 492 },
    { id: 'hairpin', name: 'The Switchback', s0: 492, s1: 560 },
    { id: 'rift', name: 'The Rift', s0: 560, s1: 676 },
    { id: 'quiet', name: 'The Quiet Seam', s0: 676, s1: 740 },
    { id: 'gems', name: 'The Glittering Deep', s0: 740, s1: 1100 },
    { id: 'passage', name: 'The Heat Passage', s0: 1100, s1: 1196 },
    { id: 'approach', name: 'The Heat Passage', s0: 1196, s1: 1240 },
    { id: 'source', name: 'The Heartfire', s0: 1240, s1: 1262 },
];
export const END_S = 1252;       // where the track ends, on the cliff
export const WALL_S = 1240;      // where the tunnel breaks out of the wall of the lava chamber
export const CUT_S = 40;         // where the outside gives way to the mine's own scene

// heading changes: [from s, to s, degrees], each eased in and out. Positive turns toward +x.
const TURNS = [
    [266, 340, 178],      // the spiral drop turns right round
    [356, 410, 32], [420, 480, 11],
    [494, 556, -168],     // the switchback turns back again
    [684, 736, 6],
    [750, 840, 12], [846, 960, -128], [966, 1072, 36],
    [1104, 1190, -98],    // the last passage swings toward the heart of the mountain
];

// slope (rise over run) keys along the track; negative is downhill
const SLOPES = [
    [0, 0], [38, 0], [46, -0.02], [126, -0.035], [150, -0.015], [215, -0.015], [250, -0.045],
    [266, -0.12], [340, -0.12], [360, -0.07], [490, -0.07], [500, -0.1], [556, -0.1], [566, -0.02],
    [670, -0.02], [684, -0.05], [736, -0.05], [760, -0.07], [860, -0.04], [900, 0.0], [980, 0.03], [1060, -0.02],
    [1104, -0.15], [1160, -0.13], [1200, -0.04], [1262, -0.01],
];

const slopeAt = (s) => {
    let i = 0;
    while (i < SLOPES.length - 2 && s > SLOPES[i + 1][0]) i++;
    const [s0, a] = SLOPES[i], [s1, b] = SLOPES[i + 1];
    return lerp(a, b, smoothstep(s0, s1, s));
};

const headingAt = (s) => {
    let h = 0;
    for (const [a, b, deg] of TURNS) h += deg * DEG * smoothstep(a, b, s);
    return h;
};

const STEP = 1;
const N = Math.ceil(END_S + 40);

/** The track sampled every metre: positions, directions, roll. */
function build() {
    const px = new Float64Array(N + 1), py = new Float64Array(N + 1), pz = new Float64Array(N + 1);
    const hd = new Float64Array(N + 1), sl = new Float64Array(N + 1);
    px[0] = STATION.cart.x;
    pz[0] = STATION.cart.z;
    py[0] = PAD_Y + 0.12;
    for (let i = 0; i < N; i++) {
        const s = i + 0.5;
        const h = headingAt(s), m = slopeAt(s);
        const k = 1 / Math.sqrt(1 + m * m);
        px[i + 1] = px[i] + Math.sin(h) * k * STEP;
        pz[i + 1] = pz[i] + Math.cos(h) * k * STEP;
        py[i + 1] = py[i] + m * k * STEP;
        hd[i] = headingAt(i);
        sl[i] = slopeAt(i);
    }
    hd[N] = headingAt(N);
    sl[N] = slopeAt(N);
    return { px, py, pz, hd, sl };
}

const D = build();

const lerpA = (a, s) => {
    const i = clamp(Math.floor(s), 0, N - 1), f = clamp(s - i, 0, 1);
    return a[i] + (a[i + 1] - a[i]) * f;
};

/** Position of the rail top at s, written into out {x,y,z}. */
export function pointAt(s, out = {}) {
    out.x = lerpA(D.px, s);
    out.y = lerpA(D.py, s);
    out.z = lerpA(D.pz, s);
    return out;
}

/** Heading (radians, 0 along +z, positive toward +x) and slope at s. */
export const headingAtS = (s) => headingAt(s);
export const slopeAtS = (s) => slopeAt(s);

/** How hard the track is turning at s: radians per metre. */
export function curvatureAt(s) {
    return (headingAt(s + 2) - headingAt(s - 2)) / 4;
}

/**
 * The frame at s: unit tangent t, left l (horizontal, +x when heading +z) and up u,
 * banked into curves by `bank` (0..1 of the usual lean).
 */
export function frameAt(s, out = {}, bank = 1) {
    const h = headingAt(s), m = slopeAt(s);
    const k = 1 / Math.sqrt(1 + m * m);
    const t = { x: Math.sin(h) * k, y: m * k, z: Math.cos(h) * k };
    // left = up_world x t, normalised
    let lx = t.z, lz = -t.x;
    const ll = Math.hypot(lx, lz) || 1;
    lx /= ll; lz /= ll;
    // up = t x left
    let ux = t.y * lz, uy = t.z * lx - t.x * lz, uz = -t.y * lx;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul; uy /= ul; uz /= ul;
    // lean into the curve: a left-hand turn (positive heading change is toward +x, i.e. to the left when heading +z)
    const roll = clamp(-curvatureAt(s) * 11, -0.32, 0.32) * bank;
    const c = Math.cos(roll), sn = Math.sin(roll);
    out.t = t;
    out.l = { x: lx * c + ux * sn, y: uy * sn, z: lz * c + uz * sn };
    out.u = { x: ux * c - lx * sn, y: uy * c, z: uz * c - lz * sn };
    out.roll = roll;
    return out;
}

/** Which stretch of the track is s in. */
export function sectionAt(s) {
    for (const sec of SECTIONS) if (s < sec.s1) return sec;
    return SECTIONS[SECTIONS.length - 1];
}

/** Ride speed along the line, in m/s, by stretch: slow where there is something to see. */
const SPEEDS = [
    [0, 0.5], [6, 3.2], [40, 7.5], [60, 10], [120, 10], [140, 7.5], [235, 7.5], [262, 13], [340, 14], [352, 17],
    [486, 17], [500, 12], [556, 11], [568, 8.5], [668, 8.5], [684, 7], [736, 6.5], [760, 5.2], [1090, 5.2],
    [1110, 11], [1170, 11], [1196, 5], [1232, 2.8], [1248, 0.8], [1252, 0],
];
export function speedAt(s) {
    let i = 0;
    while (i < SPEEDS.length - 2 && s > SPEEDS[i + 1][0]) i++;
    const [s0, a] = SPEEDS[i], [s1, b] = SPEEDS[i + 1];
    return lerp(a, b, smoothstep(s0, s1, s));
}

export const TRACK = { gauge: 0.92, railW: 0.06, railH: 0.1, sleeperEvery: 0.85 };
export { N as SAMPLES, D as SAMPLED };
