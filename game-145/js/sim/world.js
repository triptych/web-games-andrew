// The city as one walkable space: tile lookups that see through the outside/inside split, the walker's collision,
// stairs and holes, and the A* the bot and the solvability proof use. Pure.
//
// Levels: outside is level 0 only. Inside a building, level L is its L-th floor (y = L * b.h). A move from one tile
// to the next is allowed by exactly one function, `moves()`, for the walker, the nav and the proof alike.

import { TILE, PLAYER, DOOR_GAP, WALL_T, LOCKS } from '../config.js';
import { G_VOID, edgeKey, DIRS } from './city.js';
import { interiorOf, interiorNeighbours, getEdge, edgeLock, E, F } from './interior.js';

// ------------------------------------------------------------------ lookups

/** What is at tile (tx, tz) on level L: { out } outside, { b, I, lv, lx, lz, i } inside, or null for nothing. */
export function tileAt(C, L, tx, tz) {
    if (tx < 0 || tz < 0 || tx >= C.n || tz >= C.n) return null;
    const o = C.owner[tz * C.n + tx];
    if (o < 0) return L === 0 ? { out: true } : null;
    const b = C.buildings[o];
    if (L >= b.floors || L < 0) return null;
    const I = interiorOf(C, b);
    const lx = tx - b.x0, lz = tz - b.z0;
    return { b, I, lv: I.levels[L], lx, lz, i: lz * I.w + lx };
}

export function lockKind(C, lock) {
    if (lock === 'gate') return 'chain';
    const b = C.buildings[+lock.slice(1)];
    return lock[0] === 's' ? b.innerLock : b.lock;
}

/** The lock on the edge between (tx, tz) and its neighbour in `dir` on level L, if it is a locked door or gate. */
export function edgeLockAt(C, L, tx, tz, dir) {
    if (L === 0) {
        const f = C.fence.get(edgeKey(tx, tz, dir));
        if (f?.lock) return f.lock;
    }
    const a = tileAt(C, L, tx, tz);
    if (a?.I) { const lk = edgeLock(a.I, a.lv, a.lx, a.lz, dir); if (lk) return lk; }
    const nx = tx + DIRS[dir][0], nz = tz + DIRS[dir][1];
    const b = tileAt(C, L, nx, nz);
    if (b?.I && b.b !== a?.b) { const lk = edgeLock(b.I, b.lv, b.lx, b.lz, (dir + 2) % 4); if (lk) return lk; }
    return null;
}

/**
 * Every legal step from tile (L, tx, tz): [L2, tx2, tz2, dir]. `canOpen(lock)` says which locked doors count as open.
 * `holes`: may the walker step onto a hole (the walker can; the nav and the proof never do).
 */
const nbScratch = [];
export function moves(C, L, tx, tz, canOpen, out, holes = false) {
    out.length = 0;
    const here = tileAt(C, L, tx, tz);
    if (!here) return out;
    if (here.I) {
        const I = here.I, b = here.b;
        interiorNeighbours(I, L, here.lx, here.lz, nbScratch, { outside: true, open: { has: canOpen }, holes });
        for (const [L2, x2, z2, dir] of nbScratch) {
            const gx = b.x0 + x2, gz = b.z0 + z2;
            if (L2 < 0) {
                // through an outside door onto the street
                const o = tileAt(C, 0, gx, gz);
                if (o?.out && outdoorFree(C, gx, gz)) out.push([0, gx, gz, dir]);
                continue;
            }
            out.push([L2, gx, gz, dir]);
        }
        return out;
    }
    // outside
    for (let dir = 0; dir < 4; dir++) {
        const nx = tx + DIRS[dir][0], nz = tz + DIRS[dir][1];
        if (nx < 0 || nz < 0 || nx >= C.n || nz >= C.n) continue;
        const f = C.fence.get(edgeKey(tx, tz, dir));
        if (f && !(f.lock && canOpen(f.lock))) continue;
        const t = tileAt(C, 0, nx, nz);
        if (t.out) { if (outdoorFree(C, nx, nz)) out.push([0, nx, nz, dir]); continue; }
        // into a building: its outer edge must be an (open) door
        const e = getEdge(t.I, t.lv, t.lx, t.lz, (dir + 2) % 4);
        if (e !== E.DOOR && e !== E.BROKEN) continue;
        const lk = edgeLock(t.I, t.lv, t.lx, t.lz, (dir + 2) % 4);
        if (lk && !canOpen(lk)) continue;
        if (t.lv.flags[t.i] & (F.SOLID | F.VOID)) continue;
        out.push([0, nx, nz, dir]);
    }
    return out;
}

export function outdoorFree(C, tx, tz) {
    const i = tz * C.n + tx;
    return C.owner[i] < 0 && !C.solid[i] && C.ground[i] !== G_VOID;
}

/** Ground height under (x, z) on level L, stairs included. */
export function groundAt(C, L, x, z) {
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
    const t = tileAt(C, L, tx, tz);
    if (!t || t.out) return 0;
    const H = t.b.h, base = L * H;
    if (t.lv.flags[t.i] & F.STAIR) {
        const s = t.lv.stair[t.i] - 1, dir = s >> 4, k = s & 15;
        const fx = x / TILE - tx, fz = z / TILE - tz;
        const along = dir === 0 ? 1 - fz : dir === 2 ? fz : dir === 1 ? fx : 1 - fx;
        return base + ((k + along) / t.I.S) * H;
    }
    return base;
}

/** The floor material under the walker, for footsteps. */
export function surfaceAt(C, L, x, z) {
    const tx = Math.floor(x / TILE), tz = Math.floor(z / TILE);
    const t = tileAt(C, L, tx, tz);
    if (!t) return 'none';
    if (t.out) return ['none', 'road', 'walk', 'grass', 'road', 'grass', 'walk', 'walk'][C.ground[tz * C.n + tx]];
    if (t.lv.flags[t.i] & F.PUDDLE) return 'water';
    if (t.lv.flags[t.i] & F.STAIR) return t.b.type === 'house' ? 'wood' : 'concrete';
    return ['none', 'carpet', 'wood', 'tile', 'tile', 'concrete', 'tile'][t.lv.floor[t.i]] ?? 'concrete';
}

// ------------------------------------------------------------------ collision

/** Blocking boxes on level L near (x, z): [x0, z0, x1, z1] in metres. */
function boxesNear(C, G, L, x, z, r, out) {
    out.length = 0;
    const tx0 = Math.floor((x - r - 0.2) / TILE), tx1 = Math.floor((x + r + 0.2) / TILE);
    const tz0 = Math.floor((z - r - 0.2) / TILE), tz1 = Math.floor((z + r + 0.2) / TILE);
    const open = G.openSet;
    for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) {
        const t = tileAt(C, L, tx, tz);
        const X0 = tx * TILE, Z0 = tz * TILE, X1 = X0 + TILE, Z1 = Z0 + TILE;
        if (!t) { out.push([X0, Z0, X1, Z1]); continue; }
        if (t.out) {
            if (!outdoorFree(C, tx, tz)) out.push([X0 + 0.15, Z0 + 0.15, X1 - 0.15, Z1 - 0.15]);
        } else {
            const f = t.lv.flags[t.i];
            if (f & F.SOLID) out.push([X0 + 0.12, Z0 + 0.12, X1 - 0.12, Z1 - 0.12]);
            else if (f & F.VOID || (t.lv.floor[t.i] === 0 && !(f & F.VOIDSTAIR))) out.push([X0, Z0, X1, Z1]);
        }
        // the four edges of this tile
        for (let dir = 0; dir < 4; dir++) {
            const kind = edgeKind(C, L, tx, tz, dir, t, open);
            if (kind === 0) continue;
            const horiz = dir === 0 || dir === 2;
            const ex = dir === 1 ? X1 : X0, ez = dir === 2 ? Z1 : Z0, h = WALL_T / 2;
            if (kind === 1) {
                out.push(horiz ? [X0 - h, ez - h, X1 + h, ez + h] : [ex - h, Z0 - h, ex + h, Z1 + h]);
            } else {
                // a doorway: two stubs either side of the gap
                const g = DOOR_GAP / 2, m = TILE / 2;
                if (horiz) { out.push([X0 - h, ez - h, X0 + m - g, ez + h]); out.push([X0 + m + g, ez - h, X1 + h, ez + h]); }
                else { out.push([ex - h, Z0 - h, ex + h, Z0 + m - g]); out.push([ex - h, Z0 + m + g, ex + h, Z1 + h]); }
            }
        }
    }
    return out;
}

/** 0 open, 1 solid wall, 2 doorway (stubs). */
function edgeKind(C, L, tx, tz, dir, t, open) {
    const nx = tx + DIRS[dir][0], nz = tz + DIRS[dir][1];
    if (L === 0) {
        const f = C.fence.get(edgeKey(tx, tz, dir));
        if (f) return f.lock && open.has(f.lock) ? 0 : 1;
    }
    const kindOf = (I, lv, lx, lz, d) => {
        const e = getEdge(I, lv, lx, lz, d);
        if (e === E.NONE || e === E.BROKEN) return 0;
        if (e === E.DOOR) { const lk = edgeLock(I, lv, lx, lz, d); return lk && !open.has(lk) ? 1 : 2; }
        return 1;
    };
    if (t?.I) return kindOf(t.I, t.lv, t.lx, t.lz, dir);
    const n = tileAt(C, L, nx, nz);
    if (n?.I) return kindOf(n.I, n.lv, n.lx, n.lz, (dir + 2) % 4);
    return 0;
}

function hits(boxes, x, z, r) {
    for (const [x0, z0, x1, z1] of boxes) {
        const cx = x < x0 ? x0 : x > x1 ? x1 : x, cz = z < z0 ? z0 : z > z1 ? z1 : z;
        const dx = x - cx, dz = z - cz;
        if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
}

const boxScratch = [], moveScratch = [];
/** Try to move the walker's centre to (nx, nz); returns true if it moved. Changes level on stairs. */
export function tryMove(C, G, p, nx, nz) {
    const tx = Math.floor(p.x / TILE), tz = Math.floor(p.z / TILE);
    const ntx = Math.floor(nx / TILE), ntz = Math.floor(nz / TILE);
    let L2 = p.L;
    if (ntx !== tx || ntz !== tz) {
        if (Math.abs(ntx - tx) + Math.abs(ntz - tz) !== 1) return false;     // never cut a corner
        const dir = ntx > tx ? 1 : ntx < tx ? 3 : ntz > tz ? 2 : 0;
        const canOpen = (lk) => G.openSet.has(lk);
        const m = moves(C, p.L, tx, tz, canOpen, moveScratch, true).find((mv) => mv[3] === dir);
        if (!m) return false;
        L2 = m[0];
    }
    if (hits(boxesNear(C, G, L2, nx, nz, PLAYER.radius, boxScratch), nx, nz, PLAYER.radius)) return false;
    if (!p.air && groundAt(C, L2, nx, nz) > p.y + PLAYER.step) return false;
    p.x = nx; p.z = nz;
    if (L2 !== p.L) { p.L = L2; p.y = groundAt(C, L2, nx, nz); }
    return true;
}

/** Is the walker standing over a hole? (centre well inside the hole's tile) */
export function overHole(C, p) {
    const tx = Math.floor(p.x / TILE), tz = Math.floor(p.z / TILE);
    const t = tileAt(C, p.L, tx, tz);
    if (!t?.I || !(t.lv.flags[t.i] & F.HOLE)) return false;
    const fx = p.x / TILE - tx, fz = p.z / TILE - tz;
    return fx > 0.2 && fx < 0.8 && fz > 0.2 && fz < 0.8;
}

// ------------------------------------------------------------------ nav (A*)

const N2 = (C) => C.n * C.n;
let scratch = null;

/** Shortest walk from (L, tx, tz) to any tile `goal(L, tx, tz)` returns true for. A list of [L, tx, tz], or null. */
export function findPath(C, from, goal, hx, hz, canOpen, maxNodes = 400000) {
    const n2 = N2(C), LMAX = 9;
    if (!scratch || scratch.g.length < n2 * LMAX) scratch = { g: new Float32Array(n2 * LMAX), stamp: new Uint32Array(n2 * LMAX), prev: new Int32Array(n2 * LMAX), run: 0 };
    const S = scratch;
    S.run++;
    const key = (L, x, z) => L * n2 + z * C.n + x;
    const heap = [];        // [f, key]
    const push = (f, k) => {
        heap.push([f, k]);
        let i = heap.length - 1;
        while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
        const top = heap[0], last = heap.pop();
        if (heap.length) {
            heap[0] = last;
            let i = 0;
            for (;;) {
                const l = i * 2 + 1, r = l + 1;
                let m = i;
                if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                if (m === i) break;
                [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
            }
        }
        return top;
    };
    const h = (x, z) => (hx == null ? 0 : Math.abs(x - hx) + Math.abs(z - hz));
    const k0 = key(from[0], from[1], from[2]);
    S.stamp[k0] = S.run; S.g[k0] = 0; S.prev[k0] = -1;
    push(h(from[1], from[2]), k0);
    const nb = [];
    let expanded = 0;
    while (heap.length) {
        const [f, k] = pop();
        const L = Math.floor(k / n2), rem = k - L * n2, z = Math.floor(rem / C.n), x = rem - z * C.n;
        const g = S.g[k];
        if (f - h(x, z) > g + 1e-6) continue;          // stale entry
        if (goal(L, x, z)) {
            const path = [];
            for (let c = k; c >= 0; c = S.prev[c]) { const l = Math.floor(c / n2), r2 = c - l * n2; path.push([l, r2 % C.n, Math.floor(r2 / C.n)]); }
            return path.reverse();
        }
        if (++expanded > maxNodes) return null;
        for (const [L2, x2, z2] of moves(C, L, x, z, canOpen, nb)) {
            const k2 = key(L2, x2, z2);
            const g2 = g + 1 + (L2 !== L ? 0.5 : 0);
            if (S.stamp[k2] === S.run && S.g[k2] <= g2) continue;
            S.stamp[k2] = S.run; S.g[k2] = g2; S.prev[k2] = k;
            push(g2 + h(x2, z2), k2);
        }
    }
    return null;
}

/** The tile a thing stands on, and the tile next to it the walker can actually reach (things sit on furniture). */
export function thingTile(t) { return [t.L, Math.floor(t.x / TILE), Math.floor(t.z / TILE)]; }

export function lockInfo(C, lock) { const k = lockKind(C, lock); return { kind: k, ...LOCKS[k] }; }
