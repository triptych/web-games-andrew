// The battlefield: a grid of voxel columns. Each cell has a height h (0 = open ground), a
// material and the hp of its top layer. Settled voxels stack on cells as `debris` (they block
// monsters and monster shots, not the mech). A flow field leads monsters to the mech.
// Pure: no DOM, no Math.random.

import { MAP, FIELD } from '../config.js';
import { MATS } from './data/enemies.js';
import { SECTORS } from './data/missions.js';
import { makeNoise } from './noise.js';
import { fixup } from './mapfix.js';

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

/** A world as compact save data: one digit per cell for h, mat and debris, and the flow field
 *  with "unreachable" written as -1. The map is 23k cells; plain arrays would be ~400 KB a save. */
export function packWorld(W) {
    return {
        h: W.h.join(''), mat: W.mat.join(''), debris: W.debris.join(''), hp: W.hp,
        ff: W.ff.map((v) => (v >= FAR ? -1 : v)), ffT: W.ffT, ffDirty: W.ffDirty, packed: 1,
    };
}
export function unpackWorld(P) {
    if (!P || !P.packed) return P;
    const digits = (str) => Array.from(str, (c) => +c);
    return {
        h: digits(P.h), mat: digits(P.mat), debris: digits(P.debris), hp: P.hp.slice(),
        ff: P.ff.map((v) => (v < 0 ? FAR : v)), ffT: P.ffT, ffDirty: P.ffDirty,
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
 * The terrain is shaped by seeded noise (no street grid, no stamped circles), then repaired so
 * every passage is wide enough for the mech, all open ground is one region and there are no
 * cul-de-sacs to be cornered in (see mapfix.js). Every cage and hive is then proved reachable
 * from the spawn; a layout that fails is thrown away and the next one tried.
 */
export function generate(mission, rng) {
    const nHives = mission.objectives.filter((o) => o.kind === 'hives').reduce((a, o) => a + o.count, 0);
    const nCages = mission.objectives.filter((o) => o.kind === 'rescue').reduce((a, o) => a + o.crew.length, 0);
    for (let attempt = 0; attempt < 16; attempt++) {
        const L = layout(mission, rng, nHives, nCages, attempt >= 10);
        if (L && provedReachable(L)) return L;
    }
    throw new Error('no reachable layout');      // never seen: simtest proves every mission on many seeds
}

/** The value below which a share q of the samples fall. */
function quantile(vals, q) {
    const s = Float32Array.from(vals).sort();
    return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * s.length)))];
}

function layout(mission, rng, nHives, nCages, sparse) {
    const S = SECTORS[mission.sector];
    const W = emptyWorld();
    const Nz = makeNoise(rng.int(1, 0x3fffffff));
    const n = MAP.w * MAP.h;
    const spawn = { x: Math.floor(MAP.w / 2) + 0.5, y: Math.floor(MAP.h / 2) + 0.5 };
    const f = new Float32Array(n);
    const each = (fn) => { for (let y = 0; y < MAP.h; y++) for (let x = 0; x < MAP.w; x++) fn(x, y, idx(x, y)); };

    if (mission.sector === 'prairie') {
        // rolling crystal outcrops and stony knolls: blobs of fractal noise, taller in their hearts
        const cover = sparse ? 0.12 : 0.19;
        each((x, y, i) => { f[i] = Nz.fbm(x / 13, y / 13, 4) + 0.3 * (Nz.fbm(x / 4.5 + 50, y / 4.5, 2) - 0.5); });
        const t1 = quantile(f, 1 - cover), t2 = quantile(f, 1 - cover * 0.55), t3 = quantile(f, 1 - cover * 0.22);
        each((x, y, i) => {
            if (f[i] < t1) return;
            setCell(W, x, y, f[i] >= t3 ? 3 : f[i] >= t2 ? 2 : 1, Nz.fbm(x / 9 + 100, y / 9, 3) > 0.42 ? S.mat : S.alt);
        });
        smoothRock(W);
    } else if (mission.sector === 'canyon') {
        // ridged noise: long winding walls and mesas with washes between them
        const cover = sparse ? 0.2 : 0.3;
        each((x, y, i) => {
            const r = 1 - Math.abs(2 * Nz.fbm(x / 24, y / 24, 3) - 1);
            f[i] = 0.55 * r * r + 0.45 * Nz.fbm(x / 9 + 30, y / 9 - 20, 3);
        });
        const t1 = quantile(f, 1 - cover), t2 = quantile(f, 1 - cover * 0.72), t3 = quantile(f, 1 - cover * 0.42);
        each((x, y, i) => {
            if (f[i] < t1) return;
            setCell(W, x, y, f[i] >= t3 ? 3 : f[i] >= t2 ? 2 : 1, Nz.n2(x / 6 + 7, y / 6) > 0.7 ? S.alt : S.mat);
        });
        smoothRock(W);
    } else {
        // a ruined city: towers scattered off any grid, L-shaped wings, gnawed by collapse, rubble between
        const want = sparse ? 90 : 175;
        const pts = [];
        for (let t = 0; t < 3000 && pts.length < want; t++) {
            const x = rng.range(5, MAP.w - 5), y = rng.range(5, MAP.h - 5), gap = rng.range(7, 9.5);
            if (pts.every((p) => Math.hypot(p.x - x, p.y - y) > Math.max(gap, p.gap))) pts.push({ x, y, gap });
        }
        const rect = (x0, y0, w, d, ht) => {
            for (let y = y0; y < y0 + d; y++) for (let x = x0; x < x0 + w; x++) if (inMap(x, y)) setCell(W, x, y, ht, rng() < 0.88 ? S.mat : S.alt);
        };
        for (const p of pts) {
            const w = rng.int(3, 6), d = rng.int(3, 6), ht = rng() < 0.2 ? 1 : rng() < 0.5 ? 2 : 3;
            const x0 = Math.round(p.x - w / 2), y0 = Math.round(p.y - d / 2);
            rect(x0, y0, w, d, ht);
            if (rng() < 0.35) {           // a lower wing off one side
                const ww = rng.int(2, 3), dd = rng.int(2, 3), side = rng.int(0, 3);
                const wx = side === 0 ? x0 + w : side === 1 ? x0 - ww : x0 + rng.int(0, Math.max(0, w - ww));
                const wy = side === 2 ? y0 + d : side === 3 ? y0 - dd : y0 + rng.int(0, Math.max(0, d - dd));
                rect(wx, wy, ww, dd, Math.max(1, ht - 1));
            }
        }
        // collapse: noise knocks whole corners down to rubble or flat
        each((x, y, i) => {
            if (!W.h[i]) return;
            const e = Nz.fbm(x / 3.5, y / 3.5, 2);
            if (e < 0.3) setCell(W, x, y, 0, '');
            else if (e < 0.4) setCell(W, x, y, 1, S.alt);
        });
        // rubble mounds in the streets
        each((x, y, i) => { f[i] = Nz.fbm(x / 6 + 70, y / 6, 3); });
        const tr = quantile(f, 0.955);
        each((x, y, i) => { if (!W.h[i] && f[i] > tr) setCell(W, x, y, 1, S.alt); });
    }

    // the edge: unbreakable cliffs, a ragged band two to five cells thick
    each((x, y) => {
        const b = Math.min(x, y, MAP.w - 1 - x, MAP.h - 1 - y);
        const band = 1 + 6 * Math.max(0, Nz.fbm(x / 10 + 300, y / 10 + 300, 3) - 0.22);
        if (b === 0 || b < band) setCell(W, x, y, 3, 'edge');
    });

    // a clear landing zone
    const prot = new Uint8Array(n);
    clearDisc(W, spawn.x, spawn.y, 6.5, prot);

    // hives (3x3) a walk from the spawn, apart from each other
    const hives = [];
    for (let k = 0; k < nHives; k++) {
        const p = pickRing(rng, spawn, FIELD.near, FIELD.far, (x, y) => hives.every((h) => Math.hypot(h.x - x, h.y - y) > 11));
        if (!p) return null;
        clearDisc(W, p.x, p.y, 4.2, prot);
        for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
            const i = idx(Math.floor(p.x) + x, Math.floor(p.y) + y);
            W.h[i] = 2; W.mat[i] = MAT_ID.hive; W.hp[i] = 0; prot[i] = 0;
        }
        hives.push(p);
    }
    // cages: away from the spawn and the hives
    const cages = [];
    for (let k = 0; k < nCages; k++) {
        const p = pickRing(rng, spawn, FIELD.near - 1, FIELD.far, (x, y) => cages.every((c) => Math.hypot(c.x - x, c.y - y) > 12)
            && hives.every((h) => Math.hypot(h.x - x, h.y - y) > 7));
        if (!p) return null;
        clearDisc(W, p.x, p.y, 2.6, prot);
        cages.push(p);
    }

    const fixed = (i) => W.mat[i] === MAT_ID.edge || W.mat[i] === MAT_ID.hive;
    const ctx = {
        W, prot, fixed,
        open: (i) => { W.h[i] = 0; W.mat[i] = 0; W.hp[i] = 0; },
        // fill a cell with what's next to it, so filled pockets read as part of the rock
        fill: (i) => {
            const x = i % MAP.w, y = (i / MAP.w) | 0;
            let mat = '', h = 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
                if (!inMap(x + dx, y + dy)) { mat = mat || 'edge'; h = Math.max(h, 3); continue; }
                const j = idx(x + dx, y + dy);
                if (!W.h[j]) continue;
                const m = MAT_LIST[W.mat[j]];
                if (m === 'hive') continue;
                if (!mat || (mat === 'edge' && m !== 'edge')) { mat = m; h = W.h[j]; }
            }
            setCell(W, x, y, mat === 'edge' ? 3 : Math.max(1, Math.min(3, h || 2)), mat || S.mat);
        },
    };
    if (!fixup(ctx, idx(cellOf(spawn.x), cellOf(spawn.y)))) return null;
    return { W, spawn, hives, cages };
}

/** One pass of a cellular automaton: lone specks of rock go, pinholes in rock close. */
function smoothRock(W) {
    const h = W.h.slice(), mat = W.mat.slice();
    for (let y = 1; y < MAP.h - 1; y++) for (let x = 1; x < MAP.w - 1; x++) {
        const i = idx(x, y);
        let rock = 0, hs = 0, m = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const j = idx(x + dx, y + dy);
            if (h[j] > 0) { rock++; hs += h[j]; m = mat[j]; }
        }
        if (h[i] > 0 && rock <= 1) setCell(W, x, y, 0, '');
        else if (!h[i] && rock >= 6) setCell(W, x, y, Math.max(1, Math.round(hs / rock)), MAT_LIST[m]);
    }
}

function pickRing(rng, c, r0, r1, ok) {
    for (let t = 0; t < 300; t++) {
        const a = rng() * Math.PI * 2, d = rng.range(r0, r1);
        const x = Math.floor(c.x + Math.cos(a) * d) + 0.5, y = Math.floor(c.y + Math.sin(a) * d) + 0.5;
        if (Math.min(x, y, MAP.w - x, MAP.h - y) < 10) continue;
        if (ok(x, y)) return { x, y };
    }
    return null;
}

function clearDisc(W, px, py, r, prot) {
    for (let y = Math.floor(py - r); y <= py + r; y++) for (let x = Math.floor(px - r); x <= px + r; x++) {
        if (!inMap(x, y) || W.mat[idx(x, y)] === MAT_ID.edge) continue;
        if (Math.hypot(x + 0.5 - px, y + 0.5 - py) <= r) { setCell(W, x, y, 0, ''); if (prot) prot[idx(x, y)] = 1; }
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
const FLOW_MAX = FIELD.flow * 10;
/** Dijkstra from the mech's cell, out to FIELD.flow cells of walking. Debris costs more than open ground, so monsters go round a
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
            if (nc > FLOW_MAX) continue;            // far monsters walk straight at the mech
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
