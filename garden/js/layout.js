// Pure layout: turns the game list into a garden plan (no three.js here).
// Paths radiate from the hub, one per genre plus one down to the dock. Each
// path grows by one statue pair per two games, and the island grows around it.

import { TAU, smoothstep, clamp } from './util.js';
import { groupGames } from './genres.js';

export const PLAZA_R = 14;          // hub plaza radius
export const PATH_HALF = 1.6;       // half the width of a flagstone path
export const STATUE_OFFSET = 3.7;   // statue distance from the path centreline
export const PAIR_SPACING = 7.5;    // distance between statue pairs along a path
export const FIRST_STATUE = 13;     // arc length to the first pair
export const GATE_S = 6;            // arc length to the genre gate
export const PAVILION_GAP = 12;     // last pair to pavilion centre
export const PAVILION_PLAZA = 9;    // pavilion plaza radius
export const DOCK_LEN = 16;

const FEATURE_ORDER = ['tree', 'gear', 'tower', 'fountain', 'grove', 'grove', 'grove', 'grove'];

/** A path as a dense polyline with arc length, built from a polar centreline. */
function buildSpokeLine(angle, bend, length) {
    const pts = [];
    const r0 = PLAZA_R - 0.5;
    let s = 0, px = 0, pz = 0;
    for (let r = r0; ; r += 0.5) {
        const u = r - r0;
        const th = angle + bend * Math.sin(u / 26) * smoothstep(0, 10, u);
        const x = Math.sin(th) * r, z = Math.cos(th) * r;
        if (pts.length) s += Math.hypot(x - px, z - pz);
        pts.push({ x, z, s });
        px = x; pz = z;
        if (s >= length) break;
    }
    return pts;
}

/** Point, unit tangent and left normal at arc length s along a polyline. */
export function samplePath(pts, s) {
    s = clamp(s, 0, pts[pts.length - 1].s);
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (pts[mid].s <= s) lo = mid; else hi = mid;
    }
    const a = pts[lo], b = pts[hi];
    const seg = b.s - a.s || 1;
    const t = (s - a.s) / seg;
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
    const tx = (b.x - a.x) / seg, tz = (b.z - a.z) / seg;
    return { x, z, tx, tz, nx: -tz, nz: tx };
}

/** Closest point on a polyline: { d, s, x, z }. */
export function projectOnPath(pts, x, z) {
    let best = { d: Infinity, s: 0, x: 0, z: 0 };
    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z;
        const len2 = dx * dx + dz * dz || 1;
        const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / len2, 0, 1);
        const qx = a.x + dx * t, qz = a.z + dz * t;
        const d = Math.hypot(x - qx, z - qz);
        if (d < best.d) best = { d, s: a.s + (b.s - a.s) * t, x: qx, z: qz };
    }
    return best;
}

export function buildLayout(games) {
    const groups = groupGames(games);
    const slots = groups.length + 1; // +1 for the dock path
    const spokes = groups.map((g, i) => {
        const angle = ((i + 1) / slots) * TAU;
        const pairs = Math.ceil(g.games.length / 2);
        const lastS = FIRST_STATUE + (pairs - 1) * PAIR_SPACING;
        const pavS = lastS + PAVILION_GAP;
        const bend = (i % 2 ? 1 : -1) * 0.11;
        const pts = buildSpokeLine(angle, bend, pavS);
        const spoke = { index: i, genre: g.genre, games: g.games, angle, pts, length: pavS, statues: [], lamps: [], benches: [] };

        g.games.forEach((game, k) => {
            const pair = Math.floor(k / 2);
            const side = k % 2 ? 1 : -1;
            const s = FIRST_STATUE + pair * PAIR_SPACING;
            const p = samplePath(pts, s);
            const x = p.x + p.nx * side * STATUE_OFFSET, z = p.z + p.nz * side * STATUE_OFFSET;
            // statue front (+z local) faces the path
            const rot = Math.atan2(-p.nx * side, -p.nz * side);
            spoke.statues.push({ game, genre: g.genre, spoke, s, side, x, z, rot, pathX: p.x, pathZ: p.z });
        });

        for (let pair = 0; pair < pairs; pair++) {
            const s = FIRST_STATUE + pair * PAIR_SPACING + PAIR_SPACING / 2;
            if (s > pavS - PAVILION_PLAZA - 1) break;
            const p = samplePath(pts, s);
            const side = pair % 2 ? 1 : -1;
            spoke.lamps.push({ x: p.x + p.nx * side * (PATH_HALF + 0.7), z: p.z + p.nz * side * (PATH_HALF + 0.7) });
        }

        const gp = samplePath(pts, GATE_S);
        spoke.gate = { s: GATE_S, x: gp.x, z: gp.z, rot: Math.atan2(gp.tx, gp.tz) };
        const pp = samplePath(pts, pavS);
        spoke.pavilion = { x: pp.x, z: pp.z, r: PAVILION_PLAZA, rot: Math.atan2(-pp.tx, -pp.tz) };
        // benches around the pavilion plaza, facing in
        for (let b = 0; b < 4; b++) {
            const a = spoke.pavilion.rot + Math.PI / 4 + (b * Math.PI) / 2;
            const bx = pp.x + Math.sin(a) * (PAVILION_PLAZA - 1.6), bz = pp.z + Math.cos(a) * (PAVILION_PLAZA - 1.6);
            spoke.benches.push({ x: bx, z: bz, rot: a + Math.PI });
        }
        return spoke;
    });

    const maxEnd = Math.max(40, ...spokes.map((s) => Math.hypot(s.pavilion.x, s.pavilion.z)));
    const hubR = clamp(maxEnd * 0.44, 32, 60);

    // the dock path runs straight down to the shore at angle 0 (+z)
    const dockEnd = hubR - 3;
    const dockPts = [];
    for (let r = PLAZA_R - 0.5; r <= dockEnd; r += 0.5) dockPts.push({ x: 0, z: r, s: r - (PLAZA_R - 0.5) });
    const dock = {
        pts: dockPts,
        start: dockEnd - 1.5,          // planks start a little on land
        end: dockEnd + DOCK_LEN,
        y: 1.45,
        lamps: [{ x: -1.9, z: dockEnd - 1 }, { x: 1.9, z: dockEnd - 1 }, { x: -1.9, z: dockEnd + DOCK_LEN - 0.6 }, { x: 1.9, z: dockEnd + DOCK_LEN - 0.6 }],
    };

    const features = [];
    for (let j = 0; j < slots; j++) {
        const a = ((j + 0.5) / slots) * TAU;
        const left = j === 0 ? null : spokes[j - 1];
        const right = j === slots - 1 ? null : spokes[j];
        const neighbourLen = Math.min(...[left, right].filter(Boolean).map((s) => s.length + PLAZA_R));
        const r = clamp(neighbourLen * 0.62, PLAZA_R + 20, hubR + 10);
        features.push({ angle: a, r, x: Math.sin(a) * r, z: Math.cos(a) * r, type: null, nearDock: !left || !right });
    }
    // the most open gaps get the big set pieces
    const order = features.map((f, i) => i).sort((a, b) => features[b].r - features[a].r);
    let fi = 0;
    for (const i of order) {
        const f = features[i];
        if (f.nearDock) continue;
        f.type = FEATURE_ORDER[fi++] || 'grove';
    }
    features[0].type = 'stones';
    features[slots - 1].type = 'lighthouse';
    if (fi < 3) features[0].type = 'tree';

    return {
        games, spokes, dock, features, hubR, slots,
        islandR: maxEnd + PAVILION_PLAZA + 16,
        islet: { angle: 0.55, r: hubR + 40 }, // clock tower islet, seen from the dock
        spawn: { x: 0.0, z: dockEnd + DOCK_LEN - 2.5, yaw: 0 },
    };
}

/** Every walkable path as a list of polylines for path-mesh and flattening. */
export function allPaths(layout) {
    return [...layout.spokes.map((s) => s.pts), layout.dock.pts];
}
