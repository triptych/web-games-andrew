// The island's ground. Pure: the same height function feeds the walking rules, the proofs and the view.
// x runs east, z runs south, heights are metres above the sea. The field is ISLE.size square, centred on 0.

import { ISLE } from '../config.js';
import { hash3, noise2 } from '../rng.js';

const HALF = ISLE.size / 2;
const smooth = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

/** Where things stand on the island. Zones, paths, trees and the view all read these. */
export const MARKS = {
    start: [0, 116], wreck: [13, 110], cairn: [-10, 102], tidewatch: [-34, 90], fray: [-29, 95],
    mint1: [-54, 98], mint2: [-12, 82], mint3: [24, 94],
    rootshrine: [48, 62], rootDoor: [40, 62], rootTunnel: [42, 73], rootMural: [35, 56], rootWell: [62, 74],
    vineFoot: [10, -9], vineTop: [10, -37],
    grandfather: [-20, -80], rune1: [22, -62], rune2: [-58, -96], golemTunnel: [-46, -56], golemFallen: [-50, -50],
    golemRing: [-4, -70], golemSong: [32, -88], highView: [58, -46],
    caveMouth: [-88, -66],
    castle: [92, 34], castleGate: [74, 36], throne: [98, 24], garden: [86, 47], banner: [106, 37],
    underStair: [100, 31], windPerch: [103, 43],
    tideStairs: [-112, 22], tideArch: [-102, 30], fisherHut: [-88, 50],
    moonDoor: [-70, 72], moonStone: [-61, 66],
};

/** Open ways through the trees: [from, to] pairs of MARKS. Trees never grow on them. */
export const PATHS = [
    ['start', 'cairn'], ['cairn', 'fray'], ['fray', 'tidewatch'], ['fray', 'mint1'], ['cairn', 'mint2'], ['start', 'mint3'],
    ['mint2', 'rootMural'], ['rootMural', 'rootDoor'], ['mint3', 'rootTunnel'], ['rootTunnel', 'rootWell'], ['rootMural', 'vineFoot'],
    ['vineTop', 'golemRing'], ['golemRing', 'grandfather'], ['golemRing', 'rune1'], ['rune1', 'golemSong'], ['rune1', 'highView'],
    ['grandfather', 'rune2'], ['grandfather', 'golemTunnel'], ['golemTunnel', 'caveMouth'], ['rune2', 'caveMouth'],
    ['rootWell', 'castleGate'], ['castleGate', 'castle'], ['mint1', 'moonStone'], ['moonStone', 'moonDoor'],
    ['moonStone', 'fisherHut'], ['fisherHut', 'tideArch'], ['tideArch', 'tideStairs'], ['mint2', 'moonStone'],
];

/** The ground before trees: a domed island, a highland shelf to the north, a castle hill to the east. */
export function rawHeight(x, z) {
    const ang = Math.atan2(z, x);
    const R = 132 + 12 * (noise2(Math.cos(ang) * 2.2 + 7, Math.sin(ang) * 2.2 + 7, 3) - 0.5) * 2;
    const d = Math.hypot(x, z) / R;
    let h = d < 1 ? 5.2 * (1 - Math.pow(d, 2.4)) : -(d - 1) * 22;
    const land = smooth(h / 1.6);
    const w = 9 * (noise2(x * 0.028, 1.7, 9) - 0.5);
    h += ISLE.plateau * smooth((-z + ISLE.cliffZ - w) / 7 + 0.5) * land;
    h += 4 * Math.exp(-((x - 92) ** 2 + (z - 34) ** 2) / (2 * 26 * 26)) * land;
    h += (0.8 * (noise2(x * 0.045, z * 0.045, 1) - 0.5) + 0.3 * (noise2(x * 0.13, z * 0.13, 2) - 0.5)) * land;
    return h;
}

// ---------------------------------------------------------------- baked grids (derived, never saved)
const N = ISLE.size + 1;
let H = null, WALK = null, TREES = null, BUCKETS = null;

function distToSeg(px, pz, a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2));
    return Math.hypot(a[0] + t * dx - px, a[1] + t * dz - pz);
}

function bake() {
    H = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = rawHeight(i - HALF, j - HALF);
    WALK = new Uint8Array(N * N);
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
        const h = H[j * N + i];
        const gx = (H[j * N + i + 1] - H[j * N + i - 1]) / 2, gz = (H[(j + 1) * N + i] - H[(j - 1) * N + i]) / 2;
        WALK[j * N + i] = h > ISLE.shore && Math.hypot(gx, gz) < ISLE.slope ? 1 : 0;
    }
    // Trees: thick in the Mosswood (the southern lowlands), thin on the highlands, none on sand, paths or landmarks.
    TREES = [];
    BUCKETS = new Map();
    const marks = Object.values(MARKS);
    for (let n = 0; TREES.length < ISLE.trees && n < 9000; n++) {
        const x = (hash3(n, 11, 5) - 0.5) * 270, z = (hash3(n, 23, 5) - 0.5) * 270;
        const h = heightAt(x, z);
        if (h < 1.5 || !walkCell(x, z)) continue;
        const high = h > 10;
        const density = high ? 0.16 : Math.hypot(x - 92, z - 34) < 30 ? 0.08 : 0.9;
        if (hash3(n, 31, 5) > density) continue;
        if (marks.some((m) => Math.hypot(m[0] - x, m[1] - z) < 6.5)) continue;
        if (Math.hypot(x - MARKS.rootshrine[0], z - MARKS.rootshrine[1]) < 12) continue;
        if (PATHS.some(([a, b]) => distToSeg(x, z, MARKS[a], MARKS[b]) < 3.6)) continue;
        if (TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 3.2)) continue;
        const t = { x, z, r: 0.55, s: 0.8 + hash3(n, 41, 5) * 0.7, kind: high ? 1 : 0 };
        TREES.push(t);
        const k = ((x + HALF) >> 3) + ((z + HALF) >> 3) * 64;
        if (!BUCKETS.has(k)) BUCKETS.set(k, []);
        BUCKETS.get(k).push(t);
    }
}

function walkCell(x, z) {
    const i = Math.round(x + HALF), j = Math.round(z + HALF);
    return i > 0 && j > 0 && i < N - 1 && j < N - 1 && WALK[j * N + i] === 1;
}

/** Ground height at any point (bilinear over the 1 m grid). */
export function heightAt(x, z) {
    if (!H) bake();
    const fx = Math.max(0, Math.min(N - 1.001, x + HALF)), fz = Math.max(0, Math.min(N - 1.001, z + HALF));
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const a = H[j * N + i], b = H[j * N + i + 1], c = H[(j + 1) * N + i], d = H[(j + 1) * N + i + 1];
    return a + (b - a) * tx + (c + (d - c) * tx - (a + (b - a) * tx)) * tz;
}

/** Every tree: { x, z, r, s (size), kind }. The view draws them; the mover walks round them. */
export function trees() { if (!H) bake(); return TREES; }

/** Can a body of radius r stand at (x, z)? Dry, not on a cliff, not inside a tree. */
export function fieldStand(x, z, r) {
    if (!H) bake();
    if (!walkCell(x, z) || !walkCell(x + r, z) || !walkCell(x - r, z) || !walkCell(x, z + r) || !walkCell(x, z - r)) return false;
    const bi = (x + HALF) >> 3, bj = (z + HALF) >> 3;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const list = BUCKETS.get(bi + di + (bj + dj) * 64);
        if (list) for (const t of list) if ((t.x - x) ** 2 + (t.z - z) ** 2 < (t.r + r) ** 2) return false;
    }
    return true;
}
