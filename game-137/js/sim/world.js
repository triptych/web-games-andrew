// The battlefield: a grid of voxel columns. Each cell has a height h (0 = open ground), a
// material and the hp of its top layer. Settled voxels stack on cells as `debris` (they block
// monsters and monster shots, not the mech). A flow field leads monsters to the mech.
// Pure: no DOM, no Math.random.

import { MAP } from '../config.js';
import { MATS } from './data/enemies.js';
import { SECTORS } from './data/missions.js';

export const MAT_LIST = ['', 'stone', 'crystal', 'rust', 'neon', 'edge', 'hive'];
export const MAT_ID = Object.fromEntries(MAT_LIST.map((m, i) => [m, i]));
export const FAR = 1e9;               // "unreachable" in the flow field (Infinity does not survive JSON)

export const idx = (x, y) => y * MAP.w + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP.w && y < MAP.h;
export const cellOf = (v) => Math.floor(v);

/** A cell that stops the mech and player shots: terrain, hive walls and the map edge. */
export const solid = (W, i) => W.h[i] > 0;
/** A cell that stops monsters and their shots: solid, or any settled voxel on it. */
export const blocked = (W, i) => W.h[i] > 0 || W.debris[i] > 0;
export const solidAt = (W, x, y) => { const cx = cellOf(x), cy = cellOf(y); return !inMap(cx, cy) || solid(W, idx(cx, cy)); };
export const blockedAt = (W, x, y) => { const cx = cellOf(x), cy = cellOf(y); return !inMap(cx, cy) || blocked(W, idx(cx, cy)); };

export function emptyWorld() {
    const n = MAP.w * MAP.h;
    return {
        h: new Array(n).fill(0), mat: new Array(n).fill(0), hp: new Array(n).fill(0),
        debris: new Array(n).fill(0), ff: new Array(n).fill(FAR), ffT: 0, ffDirty: true,
    };
}

function setCell(W, x, y, h, mat) {
    if (!inMap(x, y)) return;
    const i = idx(x, y);
    W.h[i] = h; W.mat[i] = h > 0 ? MAT_ID[mat] : 0;
    W.hp[i] = h > 0 && MATS[mat] ? MATS[mat].hp : 0;
}

/**
 * Build the map for a mission. Returns { W, spawn, hives: [{x,y}], cages: [{x,y}] }.
 * Every cage and every hive is proved reachable from the spawn over open ground (flood fill);
 * a layout that fails is thrown away and the next one tried.
 */
export function generate(mission, rng) {
    const nHives = mission.objectives.filter((o) => o.kind === 'hives').reduce((a, o) => a + o.count, 0);
    const nCages = mission.objectives.filter((o) => o.kind === 'rescue').reduce((a, o) => a + o.crew.length, 0);
    for (let attempt = 0; attempt < 40; attempt++) {
        const L = layout(mission, rng, nHives, nCages, attempt >= 30);
        if (L && provedReachable(L)) return L;
    }
    throw new Error('no reachable layout');      // never seen: simtest proves 60 seeds per mission
}

function layout(mission, rng, nHives, nCages, sparse) {
    const S = SECTORS[mission.sector];
    const W = emptyWorld();
    const cx = MAP.w / 2, cy = MAP.h / 2;
    const spawn = { x: cx + 0.5, y: cy + 0.5 };
    // the edge: an unbreakable wall one cell thick
    for (let x = 0; x < MAP.w; x++) { setCell(W, x, 0, 3, 'edge'); setCell(W, x, MAP.h - 1, 3, 'edge'); }
    for (let y = 0; y < MAP.h; y++) { setCell(W, 0, y, 3, 'edge'); setCell(W, MAP.w - 1, y, 3, 'edge'); }

    const density = sparse ? 0.4 : 1;
    if (mission.sector === 'prairie') {
        // crystal outcrops: round clumps, taller in the middle
        const n = Math.round(26 * density);
        for (let k = 0; k < n; k++) {
            const ox = rng.int(3, MAP.w - 4), oy = rng.int(3, MAP.h - 4), r = rng.range(1, 2.6);
            const mat = rng() < 0.75 ? S.mat : S.alt;
            for (let y = Math.floor(oy - r); y <= oy + r; y++) for (let x = Math.floor(ox - r); x <= ox + r; x++) {
                const d = Math.hypot(x - ox, y - oy);
                if (d <= r && inMap(x, y) && W.mat[idx(x, y)] !== MAT_ID.edge) setCell(W, x, y, Math.max(1, Math.min(3, Math.round(3 - d * 1.1 + rng() * 0.6))), mat);
            }
        }
    } else if (mission.sector === 'canyon') {
        // ridges: wandering walls with gaps
        const n = Math.round(11 * density);
        for (let k = 0; k < n; k++) {
            let x = rng.range(3, MAP.w - 3), y = rng.range(3, MAP.h - 3);
            let a = rng() * Math.PI * 2;
            const len = rng.int(8, 20);
            for (let s = 0; s < len; s++) {
                a += rng.range(-0.5, 0.5);
                x += Math.cos(a); y += Math.sin(a);
                if (rng() < 0.12) continue;                     // a gap
                const w = rng() < 0.4 ? 1 : 0;
                for (let dy = -w; dy <= w; dy++) for (let dx = -w; dx <= w; dx++) {
                    const gx = Math.floor(x) + dx, gy = Math.floor(y) + dy;
                    if (inMap(gx, gy) && W.mat[idx(gx, gy)] !== MAT_ID.edge) setCell(W, gx, gy, rng.int(2, 3), rng() < 0.7 ? S.mat : S.alt);
                }
            }
        }
    } else {
        // city blocks on a street grid, some knocked down to rubble mounds
        for (let by = 3; by < MAP.h - 4; by += 7) for (let bx = 3; bx < MAP.w - 4; bx += 7) {
            if (rng() > 0.78 * density) continue;
            const w = rng.int(2, 4), d = rng.int(2, 4), ht = rng() < 0.25 ? 1 : rng.int(2, 3);
            const ox = bx + rng.int(0, 1), oy = by + rng.int(0, 1);
            for (let y = oy; y < oy + d; y++) for (let x = ox; x < ox + w; x++) setCell(W, x, y, ht, rng() < 0.85 ? S.mat : S.alt);
        }
    }

    // a clear landing zone
    clearDisc(W, spawn.x, spawn.y, 4.5);

    // hives (3x3) far from the spawn, apart from each other
    const hives = [];
    for (let k = 0; k < nHives; k++) {
        const p = pickSpot(rng, (x, y) => Math.hypot(x - spawn.x, y - spawn.y) > 12
            && hives.every((h) => Math.hypot(h.x - x, h.y - y) > 9), 4);
        if (!p) return null;
        clearDisc(W, p.x, p.y, 3.8);
        for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
            const i = idx(Math.floor(p.x) + x, Math.floor(p.y) + y);
            W.h[i] = 2; W.mat[i] = MAT_ID.hive; W.hp[i] = 0;
        }
        hives.push(p);
    }
    // cages: away from the spawn and the hives
    const cages = [];
    for (let k = 0; k < nCages; k++) {
        const p = pickSpot(rng, (x, y) => Math.hypot(x - spawn.x, y - spawn.y) > 13
            && cages.every((c) => Math.hypot(c.x - x, c.y - y) > 10)
            && hives.every((h) => Math.hypot(h.x - x, h.y - y) > 6), 3);
        if (!p) return null;
        clearDisc(W, p.x, p.y, 2.2);
        cages.push(p);
    }
    return { W, spawn, hives, cages };
}

function pickSpot(rng, ok, margin) {
    for (let t = 0; t < 200; t++) {
        const x = Math.floor(rng.range(margin, MAP.w - margin)) + 0.5, y = Math.floor(rng.range(margin, MAP.h - margin)) + 0.5;
        if (ok(x, y)) return { x, y };
    }
    return null;
}

function clearDisc(W, px, py, r) {
    for (let y = Math.floor(py - r); y <= py + r; y++) for (let x = Math.floor(px - r); x <= px + r; x++) {
        if (!inMap(x, y) || W.mat[idx(x, y)] === MAT_ID.edge) continue;
        if (Math.hypot(x + 0.5 - px, y + 0.5 - py) <= r) setCell(W, x, y, 0, '');
    }
}

/** Flood fill over open ground (4-neighbour, the way the mech walks). */
export function reach(W, sx, sy) {
    const seen = new Uint8Array(MAP.w * MAP.h);
    const q = [idx(cellOf(sx), cellOf(sy))];
    seen[q[0]] = 1;
    while (q.length) {
        const i = q.pop(), x = i % MAP.w, y = (i / MAP.w) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!inMap(nx, ny)) continue;
            const j = idx(nx, ny);
            if (!seen[j] && !solid(W, j)) { seen[j] = 1; q.push(j); }
        }
    }
    return seen;
}

export function provedReachable(L) {
    const seen = reach(L.W, L.spawn.x, L.spawn.y);
    for (const c of L.cages) if (!seen[idx(cellOf(c.x), cellOf(c.y))]) return false;
    // a hive is reachable if some cell in the ring around it is
    for (const h of L.hives) {
        let ok = false;
        for (let y = -2; y <= 2 && !ok; y++) for (let x = -2; x <= 2; x++) {
            if (Math.abs(x) < 2 && Math.abs(y) < 2) continue;
            if (seen[idx(cellOf(h.x) + x, cellOf(h.y) + y)]) { ok = true; break; }
        }
        if (!ok) return false;
    }
    return true;
}

// ------------------------------------------------------------------ flow field
/** Dijkstra from the mech's cell. Debris costs more than open ground, so monsters go round a
 *  pile when there is a road, and chew through it when there isn't. */
export function buildFlow(W, tx, ty) {
    const N = MAP.w * MAP.h;
    const dist = W.ff;
    dist.fill(FAR);
    const start = idx(Math.max(0, Math.min(MAP.w - 1, cellOf(tx))), Math.max(0, Math.min(MAP.h - 1, cellOf(ty))));
    dist[start] = 0;
    // binary heap of [cost, cell]
    const hc = [0], hi = [start];
    const push = (c, i) => {
        let k = hc.length; hc.push(c); hi.push(i);
        while (k > 0) {
            const p = (k - 1) >> 1;
            if (hc[p] <= hc[k]) break;
            [hc[p], hc[k]] = [hc[k], hc[p]]; [hi[p], hi[k]] = [hi[k], hi[p]];
            k = p;
        }
    };
    const pop = () => {
        const c = hc[0], i = hi[0];
        const lc = hc.pop(), li = hi.pop();
        if (hc.length) {
            hc[0] = lc; hi[0] = li;
            let k = 0;
            for (;;) {
                const l = 2 * k + 1, r = l + 1;
                let m = k;
                if (l < hc.length && hc[l] < hc[m]) m = l;
                if (r < hc.length && hc[r] < hc[m]) m = r;
                if (m === k) break;
                [hc[m], hc[k]] = [hc[k], hc[m]]; [hi[m], hi[k]] = [hi[k], hi[m]];
                k = m;
            }
        }
        return [c, i];
    };
    while (hc.length) {
        const [c, i] = pop();
        if (c > dist[i]) continue;
        const x = i % MAP.w, y = (i / MAP.w) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = x + dx, ny = y + dy;
            if (!inMap(nx, ny)) continue;
            const j = idx(nx, ny);
            if (W.h[j] > 0) continue;
            if (dx && dy && (W.h[idx(x + dx, y)] > 0 || W.h[idx(x, y + dy)] > 0)) continue;   // no corner cutting
            const step = (dx && dy ? 14 : 10) + W.debris[j] * 35;
            const nc = c + step;
            if (nc < dist[j]) { dist[j] = nc; push(nc, j); }
        }
    }
    W.ffDirty = false;
    return dist;
}

/** The direction a monster at (x, y) should walk, as a unit vector, or null if it has no route. */
export function flowDir(W, x, y) {
    const cx = cellOf(x), cy = cellOf(y);
    if (!inMap(cx, cy)) return null;
    const here = W.ff[idx(cx, cy)];
    let best = here, bx = 0, by = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!inMap(nx, ny)) continue;
        if (dx && dy && (W.h[idx(cx + dx, cy)] > 0 || W.h[idx(cx, cy + dy)] > 0)) continue;
        const d = W.ff[idx(nx, ny)];
        if (d < best) { best = d; bx = nx + 0.5; by = ny + 0.5; }
    }
    if (best >= FAR || best === here) return null;
    const vx = bx - x, vy = by - y, l = Math.hypot(vx, vy) || 1;
    return { x: vx / l, y: vy / l };
}

/** Push a circle out of every cell `isSolid` says is solid. Returns the index of a cell it hit, or -1. */
export function collide(W, ent, r, isSolid) {
    let hit = -1;
    const x0 = Math.floor(ent.x - r), x1 = Math.floor(ent.x + r), y0 = Math.floor(ent.y - r), y1 = Math.floor(ent.y + r);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (inMap(x, y) && !isSolid(W, idx(x, y))) continue;
        const nx = Math.max(x, Math.min(ent.x, x + 1)), ny = Math.max(y, Math.min(ent.y, y + 1));
        let dx = ent.x - nx, dy = ent.y - ny;
        const d = Math.hypot(dx, dy);
        if (d >= r) continue;
        if (d < 1e-6) {           // centre inside the cell: out along the shortest side
            const l = ent.x - x, rr = x + 1 - ent.x, t = ent.y - y, b = y + 1 - ent.y;
            const m = Math.min(l, rr, t, b);
            if (m === l) ent.x = x - r; else if (m === rr) ent.x = x + 1 + r; else if (m === t) ent.y = y - r; else ent.y = y + 1 + r;
        } else {
            dx /= d; dy /= d;
            ent.x = nx + dx * r; ent.y = ny + dy * r;
        }
        if (inMap(x, y)) hit = idx(x, y);
    }
    return hit;
}

/** Walk a line in small steps; the first point where `stop(i)` is true, or the end. */
export function trace(x0, y0, x1, y1, stop) {
    const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(len / 0.25));
    for (let k = 1; k <= n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const cx = cellOf(x), cy = cellOf(y);
        if (!inMap(cx, cy)) return { x, y, i: -1, hit: true };
        const i = idx(cx, cy);
        if (stop(i)) return { x, y, i, hit: true };
    }
    return { x: x1, y: y1, i: -1, hit: false };
}
