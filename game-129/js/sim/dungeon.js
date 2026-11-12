// HOLLOWDEEP — floor generation. Pure: a floor is a function of (seed, floor number), so a save only keeps what
// the party changed (cells seen, chests opened, the reaper's position), never the map itself.
//
// A floor is a grid of cells (0 wall, 1 open). Coordinates: x right, y down. Facing: 0 N, 1 E, 2 S, 3 W.
// Layout: a recursive-backtracker maze on the odd cells, a few rooms carved over it, a few extra openings for loops.
// The down stairs sit in the dead end farthest from the up stairs, so on a guardian floor the guardian can stand in
// the one cell that leads to them (proved in dev/simtest.mjs: with the guardian's cell blocked, the stairs are
// unreachable; with it open, they are).

import { makeRng, hashInt } from '../rng.js';
import { MAP_SIZE, REAPER_FROM, REAPER_CHANCE } from '../config.js';
import { isBossFloor } from './data/monsters.js';

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];

const cache = new Map();

export function getFloor(seed, n) {
    const key = `${seed}:${n}`;
    let f = cache.get(key);
    if (!f) {
        f = makeFloor(seed, n);
        if (cache.size > 64) cache.clear();
        cache.set(key, f);
    }
    return f;
}

export const open = (f, x, y) => x >= 0 && y >= 0 && x < f.w && y < f.h && f.cells[y * f.w + x] === 1;
export const idx = (f, x, y) => y * f.w + x;

function degree(cells, w, x, y) {
    let d = 0;
    for (let k = 0; k < 4; k++) if (cells[(y + DY[k]) * w + x + DX[k]] === 1) d++;
    return d;
}

export function bfs(f, sx, sy, blocked = null) {
    const dist = new Int32Array(f.w * f.h).fill(-1);
    const q = [sx, sy];
    dist[sy * f.w + sx] = 0;
    for (let i = 0; i < q.length; i += 2) {
        const x = q[i], y = q[i + 1], d = dist[y * f.w + x];
        for (let k = 0; k < 4; k++) {
            const nx = x + DX[k], ny = y + DY[k];
            if (!open(f, nx, ny)) continue;
            const j = ny * f.w + nx;
            if (dist[j] >= 0 || (blocked && blocked(nx, ny))) continue;
            dist[j] = d + 1;
            q.push(nx, ny);
        }
    }
    return dist;
}

function attempt(seed, n, tries) {
    const rng = makeRng(hashInt(seed, n, 9173 + tries * 31));
    const N = MAP_SIZE(n);
    const w = N, h = N;
    const cells = new Uint8Array(w * h);
    const at = (x, y) => y * w + x;

    // 1. maze on odd cells
    const stack = [[1, 1]];
    cells[at(1, 1)] = 1;
    while (stack.length) {
        const [x, y] = stack[stack.length - 1];
        const dirs = rng.shuffle([0, 1, 2, 3]);
        let moved = false;
        for (const k of dirs) {
            const nx = x + DX[k] * 2, ny = y + DY[k] * 2;
            if (nx < 1 || ny < 1 || nx > w - 2 || ny > h - 2 || cells[at(nx, ny)]) continue;
            cells[at(x + DX[k], y + DY[k])] = 1;
            cells[at(nx, ny)] = 1;
            stack.push([nx, ny]);
            moved = true;
            break;
        }
        if (!moved) stack.pop();
    }

    // 2. the up stairs: a dead end near a corner
    const odd = [];
    for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) odd.push([x, y]);
    const corner = rng.int(0, 3);
    const cx = corner & 1 ? w - 2 : 1, cy = corner & 2 ? h - 2 : 1;
    let start = null, bd = Infinity;
    for (const [x, y] of odd) {
        if (degree(cells, w, x, y) !== 1) continue;
        const d = Math.abs(x - cx) + Math.abs(y - cy);
        if (d < bd) { bd = d; start = { x, y }; }
    }
    if (!start) start = { x: 1, y: 1 };

    // 3. the down stairs: the farthest dead end
    const pre = { w, h, cells };
    let dist = bfs(pre, start.x, start.y);
    let down = null, far = -1;
    for (const [x, y] of odd) {
        if (degree(cells, w, x, y) !== 1 || (x === start.x && y === start.y)) continue;
        if (dist[at(x, y)] > far) { far = dist[at(x, y)]; down = { x, y }; }
    }
    if (!down) return null;
    const protect = (x, y) => Math.abs(x - down.x) <= 2 && Math.abs(y - down.y) <= 2;
    const nearStart = (x, y) => Math.abs(x - start.x) <= 1 && Math.abs(y - start.y) <= 1;

    // 4. rooms
    const rooms = [];
    const nRooms = 2 + rng.int(0, Math.min(3, 1 + Math.floor(n / 6)));
    for (let r = 0; r < nRooms * 4 && rooms.length < nRooms; r++) {
        const rw = rng.pick([3, 3, 5]), rh = rng.pick([3, 3, 5]);
        const rx = 1 + 2 * rng.int(0, Math.max(0, Math.floor((w - 2 - rw) / 2))), ry = 1 + 2 * rng.int(0, Math.max(0, Math.floor((h - 2 - rh) / 2)));
        if (rx + rw > w - 1 || ry + rh > h - 1) continue;
        let bad = false;
        for (let y = ry - 1; y <= ry + rh && !bad; y++) for (let x = rx - 1; x <= rx + rw && !bad; x++) if (protect(x, y) || nearStart(x, y)) bad = true;
        for (const o of rooms) if (rx < o.x + o.w + 1 && o.x < rx + rw + 1 && ry < o.y + o.h + 1 && o.y < ry + rh + 1) bad = true;
        if (bad) continue;
        for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) cells[at(x, y)] = 1;
        rooms.push({ x: rx, y: ry, w: rw, h: rh });
    }

    // 5. loops: open some walls that join two corridors
    const loopP = 0.06 + Math.min(0.06, n * 0.002);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            if (cells[at(x, y)] || protect(x, y) || nearStart(x, y)) continue;
            const horiz = x % 2 === 0 && y % 2 === 1 && cells[at(x - 1, y)] && cells[at(x + 1, y)];
            const vert = x % 2 === 1 && y % 2 === 0 && cells[at(x, y - 1)] && cells[at(x, y + 1)];
            if ((horiz || vert) && rng() < loopP) cells[at(x, y)] = 1;
        }
    }
    if (degree(cells, w, down.x, down.y) !== 1 || degree(cells, w, start.x, start.y) < 1) return null;

    const f = { n, w, h, cells, rooms, start: { ...start, d: 0 }, down, boss: null, chests: [], fountain: null, spot: null, reaper: null };
    for (let k = 0; k < 4; k++) if (open(f, start.x + DX[k], start.y + DY[k])) { f.start.d = k; break; }
    let bossCell = null;
    for (let k = 0; k < 4; k++) if (open(f, down.x + DX[k], down.y + DY[k])) bossCell = { x: down.x + DX[k], y: down.y + DY[k], face: (k + 2) % 4 };
    if (isBossFloor(n)) f.boss = bossCell;
    f.downApproach = bossCell;

    // 6. chests, the fountain, the quest spot, the reaper's lair
    dist = bfs(f, start.x, start.y);
    f.dist = dist;
    const used = new Set([at(start.x, start.y), at(down.x, down.y), bossCell ? at(bossCell.x, bossCell.y) : -1]);
    const deadEnds = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (cells[at(x, y)] && degree(cells, w, x, y) === 1 && !used.has(at(x, y))) deadEnds.push({ x, y, d: dist[at(x, y)] });
    }
    deadEnds.sort((a, b) => b.d - a.d || a.y - b.y || a.x - b.x);
    // the quest spot: the farthest dead end left
    if (deadEnds.length) { const s = deadEnds.shift(); f.spot = { x: s.x, y: s.y }; used.add(at(s.x, s.y)); }
    const nChests = Math.min(deadEnds.length, 2 + Math.floor(n / 6) + rng.int(0, 1), 6);
    const pool = rng.shuffle(deadEnds.slice());
    for (let i = 0; i < nChests; i++) { const c = pool[i]; f.chests.push({ x: c.x, y: c.y, i }); used.add(at(c.x, c.y)); }
    if (rng() < 0.4 && rooms.length) {
        const r = rng.pick(rooms);
        const fx = r.x + (r.w >> 1), fy = r.y + (r.h >> 1);
        if (!used.has(at(fx, fy))) { f.fountain = { x: fx, y: fy }; used.add(at(fx, fy)); }
    }
    if (!f.spot) {
        // no dead end left: the farthest open cell that isn't taken
        let best = -1;
        for (let i = 0; i < cells.length; i++) if (cells[i] && !used.has(i) && dist[i] > best) { best = dist[i]; f.spot = { x: i % w, y: (i / w) | 0 }; }
    }
    if (n >= REAPER_FROM && rng() < REAPER_CHANCE) {
        const far = [];
        for (let i = 0; i < cells.length; i++) if (cells[i] && dist[i] >= 9 && !used.has(i)) far.push(i);
        if (far.length) { const i = rng.pick(far); f.reaper = { x: i % w, y: (i / w) | 0 }; }
    }
    return f;
}

export function makeFloor(seed, n) {
    for (let t = 0; t < 40; t++) {
        const f = attempt(seed, n, t);
        if (f) return f;
    }
    throw new Error(`no floor for seed ${seed} floor ${n}`);
}

/** The cell in front of (x, y) facing d. */
export const ahead = (x, y, d) => ({ x: x + DX[d], y: y + DY[d] });
