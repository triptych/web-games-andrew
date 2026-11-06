// The island of Hum: its ground, its water, what stands on it and where things are. Pure and
// cached per seed. The sim walks on it, the bot plans routes over it and the view builds the
// terrain mesh from exactly the same height function, so what you see is what you stand on.
//
// Coordinates: x east, z south, y up, metres. Sea level is 0. The castle stands at the origin.

import { hash3, fbm, makeRng, hashStr } from '../rng.js';

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ------------------------------------------------------------------ fixed layout
export const SITES = {
    start: { x: 6, z: 181 },
    wreck: { x: -34, z: 188 },
    boat: { x: 28, z: 186 },
    hut: { x: 43, z: 146, w: 9, d: 7 },          // the door is in the north wall
    cross: { x: 20, z: 100 },
    castle: { x: 0, z: 0 },
    wood: { x: -118, z: 18 },
    cage: { x: -96, z: 30 },
    mere: { x: -135, z: 35, r: 14, islet: 4.2, level: 5.6 },
    seedbed: { x: -119.4, z: 35 },
    fen: { x: 122, z: 8, r: 36, rim: 43 },
    pool: { x: 133, z: -2, r: 9, islet: 3, level: 4.4 },
    spring: { x: 108, z: -16, r: 4.2, level: 4.3 },
    bellows: { x: 100, z: -9 },
    fencamp: { x: 108, z: 22 },
    moor: { x: 0, z: -150, r: 50 },
    storm: { x: 0, z: -158, r: 13, wind: 21 },
    herald: { x: 20, z: -126 },
    moorcamp: { x: -22, z: -128 },
    moat: { inner: 50, outer: 61, level: 6.0 },
    thorn: { r: 64, w: 2.4 },
    walls: { r: 17, w: 1.4 },
    keep: { x0: -7, x1: 7, z0: -9, z1: 3 },
    gallery: { x0: -6.6, x1: 6.6, z0: -8.6, z1: -2.6, up: 8 },
    heart: { x: 0, z: -6 },
};
export const HILLTOP = 28;
export const FEN_FLOOR = 4.0;
export const MOOR_RISE = 11;

export const REGION_NAMES = {
    shore: 'Wrack Beach', hut: "Elowen's Hut", heath: 'The Heath', wood: 'Whisperwood',
    fen: 'Ember Fen', moor: 'The Highmoor', castle: 'The Stilled Castle',
};

// The road network: the bot walks it, the view draws it as worn paths, trees stay off it.
export const NODES = {
    beach: [8, 181], hutdoor: [43, 138], hutin: [43, 146.5], cross: [20, 100], south: [0, 72],
    west1: [-50, 70], wood: [-88, 40], cage: [-93, 32], mereE: [-117, 35], islet: [-135, 35],
    nw: [-92, -30], moorbase: [0, -93], moortop: [0, -110], herald: [18, -122], ringS: [0, -136],
    east1: [62, 58], gorge: [72, 8], fenin: [92, 8], bellows: [100, -5], fencamp: [108, 18],
    causeway: [121, -2], fenstone: [133, -2],
    moatS: [0, 61.6], moatN: [0, 49], gate: [0, 22], court: [0, 9], keepdoor: [0, 4.5], keepin: [0, 0],
};
export const ROADS = [
    ['beach', 'hutdoor'], ['hutdoor', 'cross'], ['cross', 'south'], ['cross', 'west1'], ['west1', 'wood'],
    ['wood', 'cage'], ['cage', 'mereE'], ['west1', 'nw'], ['nw', 'moorbase'], ['moortop', 'herald'],
    ['herald', 'ringS'], ['cross', 'east1'], ['east1', 'gorge'], ['fenin', 'bellows'], ['fenin', 'fencamp'],
    ['bellows', 'causeway'], ['moatN', 'gate'],
];

// ------------------------------------------------------------------ helpers
function angDist(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); }
export function segDist(px, pz, x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / l2));
    return Math.hypot(px - (x1 + dx * t), pz - (z1 + dz * t));
}

const cache = new Map();
export function getWorld(seed) {
    if (!cache.has(seed)) { cache.set(seed, makeWorld(seed)); if (cache.size > 4) cache.delete(cache.keys().next().value); }
    return cache.get(seed);
}

function makeWorld(seed) {
    const sd = hashStr('hum-world-' + seed) % 100000;
    const ph = [hash3(sd, 1, 7) * 6.283, hash3(sd, 2, 7) * 6.283, hash3(sd, 3, 7) * 6.283];
    const S = SITES;

    function coastR(a) {
        const south = 1 - Math.exp(-(angDist(a, Math.PI / 2) ** 2) / 0.25);
        return 200 + south * (7 * Math.sin(3 * a + ph[0]) + 5 * Math.sin(5 * a + ph[1]) + 3 * Math.sin(9 * a + ph[2]));
    }

    function baseH(x, z) {
        const r = Math.hypot(x, z), a = Math.atan2(z, x);
        const t = r / coastR(a);
        const inland = 1 - ss(0.72, 0.97, t);
        let h = 7.5 * (1 - ss(0.80, 1.0, t)) - 1.2 - 10 * ss(1.0, 1.3, t);
        h += (fbm(sd, x / 46, z / 46, 4) - 0.5) * 9 * inland;
        h += (fbm(sd + 9, x / 11, z / 11, 2) - 0.5) * 1.3 * inland;
        return h;
    }
    const hutFloor = Math.max(4.2, baseH(S.hut.x, S.hut.z)) + 0.15;

    function height(x, z) {
        let h = baseH(x, z);
        const r = Math.hypot(x, z);
        // the castle hill: flattened plain, hill, moat
        if (r < 100) {
            h = lerp(7, h, ss(70, 98, r));
            h += 21 * (1 - ss(20, 50, r));
            const M = S.moat;
            if (r > M.inner && r < M.outer) {
                const e = Math.min(r - M.inner, M.outer - r);
                h = Math.min(h, M.level + 1 - 3.4 * ss(0, 3, e));
            }
        }
        // the hut's level yard
        {
            const dx = Math.abs(x - S.hut.x) - S.hut.w / 2, dz = Math.abs(z - S.hut.z) - S.hut.d / 2;
            const d = Math.max(dx, dz);
            if (d < 9) h = lerp(hutFloor, h, ss(0, 9, d));
        }
        // Ember Fen: a basin inside a steep ring of rock, open only by the western gorge
        {
            const F = S.fen, dx = x - F.x, dz = z - F.z, d = Math.hypot(dx, dz);
            if (d < F.rim + 10) {
                const a = Math.atan2(dz, dx);
                const gap = 1 - ss(0.085, 0.115, angDist(a, Math.PI));
                const floor = FEN_FLOOR + (fbm(sd + 3, x / 9, z / 9, 2) - 0.5) * 0.6;
                if (d < F.r) h = floor;
                else if (d < F.rim) h = lerp(floor, h, ss(F.r, F.rim, d));
                // the ridge: steep both sides, a rough crest
                const ridge = ss(F.r - 0.5, F.r + 1.6, d) * (1 - ss(F.rim - 1.4, F.rim + 0.8, d));
                h += ridge * (14 + fbm(sd + 4, x / 7, z / 7, 2) * 5) * (1 - gap);
                // pools
                for (const P of [S.pool, S.spring]) {
                    const pd = Math.hypot(x - P.x, z - P.z);
                    if (pd < P.r + 2) {
                        const deep = P === S.pool ? 2.0 : 0.65;
                        const bed = P.level - deep * ss(0, 1.6, P.r - pd);
                        h = Math.min(h, lerp(bed, h, ss(P.r - 0.2, P.r + 2, pd)));
                    }
                }
                const P = S.pool, pd = Math.hypot(x - P.x, z - P.z);
                if (pd < P.islet + 1) h = Math.max(h, lerp(P.level + 0.9, h, ss(P.islet - 0.6, P.islet + 1, pd)));
                if (x > P.x - P.r - 1 && x < P.x && Math.abs(z - P.z) < 1.9) h = Math.max(h, lerp(P.level + 0.45, h, ss(1.0, 1.9, Math.abs(z - P.z))));
            }
        }
        // the Highmoor: a plateau behind an eleven-metre cliff
        {
            const M = S.moor, d = Math.hypot(x - M.x, z - M.z);
            h += MOOR_RISE * (1 - ss(M.r - 1.2, M.r + 1.2, d));
            if (d < M.r) h += (fbm(sd + 5, x / 18, z / 18, 3) - 0.5) * 3 * ss(M.r - 6, M.r - 14, d);
        }
        // the mere in Whisperwood, with its islet
        {
            const M = S.mere, d = Math.hypot(x - M.x, z - M.z);
            if (d < M.r + 9) {
                const rim = M.level + 0.9;
                h = lerp(rim, h, ss(M.r, M.r + 9, d));
                if (d < M.r) h = Math.min(h, lerp(M.level - 2.4, rim, ss(M.r - 3, M.r, d)));
                if (d < M.islet + 1.5) h = Math.max(h, lerp(M.level + 0.8, M.level - 2.4, ss(M.islet - 0.5, M.islet + 1.5, d)));
            }
        }
        return h;
    }

    // water bodies with their own levels; the sea is whatever lies below 0
    const WATERS = [
        { id: 'moat', kind: 'moat', level: S.moat.level, inside: (x, z) => { const r = Math.hypot(x, z); return r > S.moat.inner - 1 && r < S.moat.outer + 1; } },
        { id: 'mere', kind: 'fresh', level: S.mere.level, inside: (x, z) => Math.hypot(x - S.mere.x, z - S.mere.z) < S.mere.r + 1 },
        { id: 'pool', kind: 'boil', level: S.pool.level, inside: (x, z) => Math.hypot(x - S.pool.x, z - S.pool.z) < S.pool.r + 1 },
        { id: 'spring', kind: 'hot', level: S.spring.level, inside: (x, z) => Math.hypot(x - S.spring.x, z - S.spring.z) < S.spring.r + 1 },
    ];
    const SEA = { id: 'sea', kind: 'sea', level: 0 };
    /** The water at (x, z) with its surface above the ground there, or null. */
    function water(x, z, g = height(x, z)) {
        for (const w of WATERS) if (w.inside(x, z)) return g < w.level ? w : null;
        return g < 0 ? SEA : null;
    }

    function regionAt(x, z) {
        const r = Math.hypot(x, z);
        if (r < 68) return 'castle';
        if (Math.abs(x - S.hut.x) < 9 && Math.abs(z - S.hut.z) < 8) return 'hut';
        if (Math.hypot(x - S.fen.x, z - S.fen.z) < S.fen.rim) return 'fen';
        if (Math.hypot(x - S.moor.x, z - S.moor.z) < S.moor.r) return 'moor';
        if (Math.hypot(x - S.wood.x, z - S.wood.z) < 62) return 'wood';
        if (z > 130 && r > 150) return 'shore';
        return 'heath';
    }

    // ------------------------------------------------------------------ roads
    const roadSegs = ROADS.map(([a, b]) => [...NODES[a], ...NODES[b]]);
    const nearRoad = (x, z, d) => roadSegs.some((s) => segDist(x, z, s[0], s[1], s[2], s[3]) < d);

    // ------------------------------------------------------------------ static colliders
    const circles = [];
    const addC = (x, z, r, tag) => circles.push({ x, z, r, tag });
    const keepOut = [
        [S.hut.x, S.hut.z, 12], [S.start.x, S.start.z, 6], [S.cage.x, S.cage.z, 6], [S.seedbed.x, S.seedbed.z, 5],
        [S.bellows.x, S.bellows.z, 5], [S.fencamp.x, S.fencamp.z, 6], [S.herald.x, S.herald.z, 5],
        [S.moorcamp.x, S.moorcamp.z, 6], [S.boat.x, S.boat.z, 6], [S.wreck.x, S.wreck.z, 10], [S.cross.x, S.cross.z, 6],
    ];
    const clear = (x, z, pad) => keepOut.every(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) > kr + pad);

    const rng = makeRng(sd * 7 + 1);
    const trees = [];
    const slopeAt = (x, z) => {
        const e = 1.5;
        return Math.max(Math.abs(height(x + e, z) - height(x - e, z)), Math.abs(height(x, z + e) - height(x, z - e))) / (2 * e);
    };
    for (let gx = -210; gx < 210; gx += 4.4) {
        for (let gz = -210; gz < 210; gz += 4.4) {
            const x = gx + rng() * 4.4, z = gz + rng() * 4.4;
            const reg = regionAt(x, z);
            const r = Math.hypot(x, z);
            let p = 0;
            if (reg === 'wood') p = 0.92 * (1 - ss(30, 62, Math.hypot(x - S.wood.x, z - S.wood.z))) + 0.08;
            else if (reg === 'heath') p = 0.03 + 0.2 * ss(0.6, 0.85, fbm(sd + 11, x / 30, z / 30, 2));
            else if (reg === 'fen') p = 0.025;
            else if (reg === 'moor') p = 0.012;
            else if (reg === 'castle') p = r > 66 ? 0.12 : 0;
            else if (reg === 'shore') p = 0.02;
            const roll = rng(), s = 0.75 + rng() * 0.6, kindRoll = rng();
            if (roll > p) continue;
            const g = height(x, z);
            if (g < 1.6 || water(x, z, g) || slopeAt(x, z) > 0.75) continue;
            if (nearRoad(x, z, 3.6) || !clear(x, z, 2)) continue;
            if (Math.hypot(x - S.mere.x, z - S.mere.z) < S.mere.r + 2.5) continue;
            if (Math.hypot(x - S.storm.x, z - S.storm.z) < S.storm.wind + 4) continue;
            if (Math.hypot(x - S.moor.x, z - S.moor.z) > S.moor.r - 3 && Math.hypot(x - S.moor.x, z - S.moor.z) < S.moor.r + 4) continue;
            const fd = Math.hypot(x - S.fen.x, z - S.fen.z);
            if (fd > S.fen.r - 3 && fd < S.fen.rim + 3) continue;
            if (Math.hypot(x - S.pool.x, z - S.pool.z) < S.pool.r + 4) continue;
            let type = 'oak';
            if (reg === 'wood') type = kindRoll < 0.58 ? 'pine' : kindRoll < 0.93 ? 'oak' : 'birch';
            else if (reg === 'heath') type = kindRoll < 0.3 ? 'pine' : kindRoll < 0.8 ? 'oak' : 'birch';
            else if (reg === 'fen' || reg === 'castle') type = 'dead';
            else if (reg === 'moor') type = 'twisted';
            trees.push({ x, z, s, type, rot: kindRoll * 6.283 });
            addC(x, z, 0.32 * s + 0.12, 'tree');
        }
    }
    const rocks = [];
    for (let gx = -210; gx < 210; gx += 11) {
        for (let gz = -210; gz < 210; gz += 11) {
            const x = gx + rng() * 11, z = gz + rng() * 11;
            const reg = regionAt(x, z);
            const p = reg === 'moor' ? 0.35 : reg === 'shore' ? 0.12 : reg === 'fen' ? 0.18 : reg === 'castle' ? 0.05 : 0.06;
            const roll = rng(), s = 0.5 + rng() * rng() * 2.2, rot = rng() * 6.283;
            if (roll > p) continue;
            const g = height(x, z);
            if (g < 0.4 || water(x, z, g) || nearRoad(x, z, 3.2) || !clear(x, z, 2.5)) continue;
            if (Math.hypot(x - S.storm.x, z - S.storm.z) < S.storm.r + 2.5 && Math.hypot(x - S.storm.x, z - S.storm.z) > S.storm.r - 2.5) continue;
            if (Math.hypot(x, z) < 66 && Math.hypot(x, z) > 45) continue;
            if (Math.hypot(x - S.mere.x, z - S.mere.z) < S.mere.r + 2) continue;
            const fd = Math.hypot(x - S.fen.x, z - S.fen.z);
            if (fd > S.fen.r - 2 && fd < S.fen.rim + 2) continue;
            if (Math.hypot(x - S.pool.x, z - S.pool.z) < S.pool.r + 3) continue;
            rocks.push({ x, z, s, rot });
            if (s > 0.8) addC(x, z, 0.75 * s, 'rock');
        }
    }

    // standing stones of the storm ring, the Seal Stones, the herald stone
    const ringStones = [];
    for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + 0.3;
        const x = S.storm.x + Math.cos(a) * S.storm.r, z = S.storm.z + Math.sin(a) * S.storm.r;
        ringStones.push({ x, z, a, h: 3.2 + hash3(i, sd, 5) * 1.6 });
        addC(x, z, 0.85, 'stone');
    }
    addC(S.storm.x, S.storm.z, 0.9, 'stone');
    addC(S.mere.x, S.mere.z, 0.8, 'stone');
    addC(S.pool.x, S.pool.z, 0.8, 'stone');
    addC(S.herald.x, S.herald.z, 0.7, 'stone');
    addC(S.bellows.x, S.bellows.z, 1.6, 'rock');
    addC(S.wreck.x, S.wreck.z, 3.2, 'wreck');
    addC(S.wreck.x + 5, S.wreck.z - 1, 1.6, 'wreck');
    addC(S.boat.x, S.boat.z, 1.3, 'boat');
    addC(S.cross.x + 2, S.cross.z, 0.25, 'sign');
    addC(S.fencamp.x + 3, S.fencamp.z - 1, 1.3, 'tent');
    addC(S.moorcamp.x + 2, S.moorcamp.z - 1, 1.2, 'tent');

    // hut: walls with a door in the north side, furniture you bump into
    const H = S.hut, hx0 = H.x - H.w / 2, hx1 = H.x + H.w / 2, hz0 = H.z - H.d / 2, hz1 = H.z + H.d / 2;
    const segs = [
        { x1: hx0, z1: hz0, x2: H.x - 1.1, z2: hz0, r: 0.2 }, { x1: H.x + 1.1, z1: hz0, x2: hx1, z2: hz0, r: 0.2 },
        { x1: hx1, z1: hz0, x2: hx1, z2: hz1, r: 0.2 }, { x1: hx1, z1: hz1, x2: hx0, z2: hz1, r: 0.2 },
        { x1: hx0, z1: hz1, x2: hx0, z2: hz0, r: 0.2 },
    ];
    // furniture, in hut-local coordinates
    const HUT_LOCAL = {
        hearth: [-3.8, 0.2], alembic: [-3.2, -2.5], bells: [-3.2, 2.4], orrery: [3.2, -2.4],
        desk: [3.75, -0.2], bed: [3.3, 2.35], circle: [0, 1.0], lintel: [0, 3.35], shelf: [-1.6, -3.2],
    };
    const hutAt = (k) => ({ x: H.x + HUT_LOCAL[k][0], z: H.z + HUT_LOCAL[k][1] });
    addC(hutAt('hearth').x - 0.2, hutAt('hearth').z, 0.75, 'hut');
    addC(hutAt('alembic').x, hutAt('alembic').z, 0.55, 'hut');
    addC(hutAt('bells').x, hutAt('bells').z, 0.6, 'hut');
    addC(hutAt('orrery').x, hutAt('orrery').z, 0.6, 'hut');
    segs.push({ x1: hutAt('desk').x, z1: hutAt('desk').z - 0.7, x2: hutAt('desk').x, z2: hutAt('desk').z + 0.7, r: 0.35 });
    segs.push({ x1: hutAt('bed').x - 0.5, z1: hutAt('bed').z, x2: hutAt('bed').x + 0.7, z2: hutAt('bed').z, r: 0.55 });

    // keep walls (the door is a seal until Lumen shows it)
    const K = S.keep;
    segs.push(
        { x1: K.x0, z1: K.z0, x2: K.x1, z2: K.z0, r: 0.5 }, { x1: K.x1, z1: K.z0, x2: K.x1, z2: K.z1, r: 0.5 },
        { x1: K.x0, z1: K.z1, x2: K.x0, z2: K.z0, r: 0.5 },
        { x1: K.x0, z1: K.z1, x2: -2.0, z2: K.z1, r: 0.5 }, { x1: 2.0, z1: K.z1, x2: K.x1, z2: K.z1, r: 0.5 },
        { x1: -2.0, z1: K.z1, x2: 2.0, z2: K.z1, r: 0.5, open: 'door' },
    );
    // the frozen falls in the fen gorge
    const gx = S.fen.x - S.fen.r - 3.5;
    segs.push({ x1: gx, z1: S.fen.z - 7, x2: gx, z2: S.fen.z + 7, r: 0.9, open: 'iceWall' });

    const rings = [
        { id: 'thorn', x: 0, z: 0, r: S.thorn.r, w: S.thorn.w, gaps: [{ a: Math.PI / 2, half: 0.075, open: 'thornGap' }] },
        { id: 'walls', x: 0, z: 0, r: S.walls.r, w: S.walls.w, gaps: [{ a: Math.PI / 2, half: 0.13, open: 'gate' }] },
    ];

    // fixed platforms: the vine bridge (once grown) and the keep's upper gallery
    const G_ = S.gallery;
    const platforms = [
        { id: 'bridge', x0: S.mere.x + S.mere.islet - 1, x1: S.seedbed.x + 1.2, z0: S.mere.z - 1.1, z1: S.mere.z + 1.1, top: S.mere.level + 0.55, open: 'bridge' },
        { id: 'gallery', x0: G_.x0, x1: G_.x1, z0: G_.z0, z1: G_.z1, top: HILLTOP + G_.up },
    ];

    // a spatial hash for the circles
    const CELL = 8;
    const grid = new Map();
    for (const c of circles) {
        const i0 = Math.floor((c.x - c.r) / CELL), i1 = Math.floor((c.x + c.r) / CELL);
        const j0 = Math.floor((c.z - c.r) / CELL), j1 = Math.floor((c.z + c.r) / CELL);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
            const k = i * 4096 + j;
            if (!grid.has(k)) grid.set(k, []);
            grid.get(k).push(c);
        }
    }
    const circlesNear = (x, z) => grid.get(Math.floor(x / CELL) * 4096 + Math.floor(z / CELL)) || [];

    // ------------------------------------------------------------------ spawn points
    /** n seeded points in a region that suit a pickup (dry, not too steep, clear of trees). */
    function spawnPoints(where, n, salt) {
        const r2 = makeRng(hashStr(`spawn-${seed}-${salt}`));
        const out = [];
        const box = {
            shore: [-95, 110, 168, 196], wood: [-178, -62, -40, 78], fen: [S.fen.x - 34, S.fen.x + 34, S.fen.z - 34, S.fen.z + 34],
            moor: [-46, 46, -196, -104], heath: [-80, 110, -60, 140],
        }[where];
        for (let tries = 0; tries < 4000 && out.length < n; tries++) {
            const x = box[0] + r2() * (box[1] - box[0]), z = box[2] + r2() * (box[3] - box[2]);
            const g = height(x, z);
            const reg = regionAt(x, z);
            if (where === 'shore' ? !(g > 0.3 && g < 3.2 && z > 150) : reg !== where) continue;
            if (water(x, z, g) || slopeAt(x, z) > 0.6) continue;
            if (circlesNear(x, z).some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 1.4)) continue;
            if (where === 'moor' && Math.hypot(x - S.storm.x, z - S.storm.z) < S.storm.wind + 2) continue;
            if (where === 'moor' && Math.hypot(x - S.moor.x, z - S.moor.z) > S.moor.r - 4) continue;
            if (where === 'fen' && Math.hypot(x - S.fen.x, z - S.fen.z) > S.fen.r - 3) continue;
            if (where === 'wood' && Math.hypot(x - S.mere.x, z - S.mere.z) < S.mere.r + 2) continue;
            if (out.some((p) => Math.hypot(p.x - x, p.z - z) < 7)) continue;
            out.push({ x, z });
        }
        return out;
    }

    return {
        seed, height, water, regionAt, coastR, hutFloor, slopeAt,
        circles, circlesNear, segs, rings, platforms, trees, rocks, ringStones,
        roadSegs, nearRoad, spawnPoints, hutAt, HUT_LOCAL, WATERS,
    };
}
