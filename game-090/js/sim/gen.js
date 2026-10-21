// Floor generation: rooms and corridors from a seed, the same layout every visit. Pure.
// A floor is { w, h, cells (0 wall, 1 floor, 2 void), rooms, up, down, anchor, chests, spawns, boss, exit, props, theme }.

import { makeRng, hashStr } from '../rng.js';
import { ZONES, bossAt } from './data/zones.js';

export const WALL = 0, FLOOR = 1, VOID = 2;
export const cellAt = (fl, x, y) => (x < 0 || y < 0 || x >= fl.w || y >= fl.h ? WALL : fl.cells[y * fl.w + x]);
export const isFloor = (fl, x, y) => cellAt(fl, x | 0, y | 0) === FLOOR;

const THEMES = {
    tunnel: { room: [4, 7, 3, 5], cw: 1, props: ['pillar', 'pipe', 'crate', 'puddle'], density: 0.05, loops: 1 },
    hall: { room: [6, 10, 5, 8], cw: 2, props: ['planter', 'bench', 'shopfront', 'tree', 'lamp'], density: 0.07, loops: 2 },
    racks: { room: [6, 10, 5, 9], cw: 1, props: ['rack', 'rack', 'appletree', 'cable', 'lamp'], density: 0.1, loops: 2 },
    nave: { room: [7, 11, 6, 9], cw: 2, props: ['pew', 'column', 'candle', 'banner', 'puddle'], density: 0.08, loops: 2 },
    rail: { room: [5, 8, 4, 6], cw: 1, props: ['rail', 'crate', 'lamp', 'antenna'], density: 0.05, loops: 1 },
    spire: { room: [6, 10, 5, 8], cw: 2, props: ['hexpillar', 'terminal', 'lamp', 'spike'], density: 0.07, loops: 2 },
};

export function floorSeed(zoneId, idx, run = 0) { return (hashStr(zoneId) + idx * 7919 + run * 104729) | 0; }

/** theme: overrides the zone's own (the Rift borrows a different one each run). */
export function genFloor(zoneId, idx, seed, opts = {}) {
    const Z = ZONES[zoneId];
    const themeName = opts.theme || Z.theme;
    const T = THEMES[themeName] || THEMES.hall;
    const last = idx === (opts.floors ?? Z.floors) - 1;
    const wantBoss = !!bossAt(Z.id, idx) && !opts.noBoss;
    for (let attempt = 0; attempt < 12; attempt++) {
        const fl = tryGen(Z, T, themeName, idx, seed + attempt * 977, wantBoss, last, opts);
        if (fl) return fl;
    }
    throw new Error('floor generation failed for ' + zoneId + ' ' + idx);
}

function tryGen(Z, T, themeName, idx, seed, wantBoss, last, opts) {
    const rng = makeRng(seed);
    const [w, h] = Z.size;
    const fl = { w, h, theme: themeName, zone: Z.id, idx, cells: new Array(w * h).fill(themeName === 'rail' ? VOID : WALL), rooms: [], up: null, down: null, anchor: null, chests: [], spawns: [], boss: null, exit: null, props: [], last };
    const set = (x, y, v) => { if (x > 0 && y > 0 && x < w - 1 && y < h - 1) fl.cells[y * w + x] = v; };
    const carve = (rx, ry, rw, rh) => { for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) set(x, y, FLOOR); };
    const [minW, maxW, minH, maxH] = T.room;
    const want = rng.int(Z.rooms[0], Z.rooms[1]);
    for (let i = 0; i < 400 && fl.rooms.length < want; i++) {
        const rw = rng.int(minW, maxW), rh = rng.int(minH, maxH);
        const rx = rng.int(2, w - rw - 3), ry = rng.int(2, h - rh - 3);
        if (fl.rooms.some((r) => rx < r.x + r.w + 2 && rx + rw + 2 > r.x && ry < r.y + r.h + 2 && ry + rh + 2 > r.y)) continue;
        fl.rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
        carve(rx, ry, rw, rh);
    }
    if (fl.rooms.length < 4) return null;
    // a left-to-right tour joins every room; a few extra links make loops
    fl.rooms.sort((a, b) => a.cx + a.cy * 0.35 - (b.cx + b.cy * 0.35));
    const link = (a, b) => {
        const cw = T.cw;
        let x = a.cx, y = a.cy;
        const horizFirst = rng() < 0.5;
        const hseg = () => { while (x !== b.cx) { for (let k = 0; k < cw; k++) set(x, y + k, FLOOR); x += Math.sign(b.cx - x); } };
        const vseg = () => { while (y !== b.cy) { for (let k = 0; k < cw; k++) set(x + k, y, FLOOR); y += Math.sign(b.cy - y); } };
        if (horizFirst) { hseg(); vseg(); } else { vseg(); hseg(); }
        for (let k = 0; k < cw; k++) { set(b.cx + k, b.cy, FLOOR); set(b.cx, b.cy + k, FLOOR); }
    };
    for (let i = 0; i + 1 < fl.rooms.length; i++) link(fl.rooms[i], fl.rooms[i + 1]);
    for (let i = 0; i < T.loops; i++) { const a = rng.pick(fl.rooms), b = rng.pick(fl.rooms); if (a !== b) link(a, b); }

    const start = fl.rooms[0];
    fl.up = { x: start.cx, y: start.cy };
    // anchor beside the stairs, on a floor cell
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1]]) {
        if (cellAt(fl, fl.up.x + dx, fl.up.y + dy) === FLOOR) { fl.anchor = { x: fl.up.x + dx, y: fl.up.y + dy, used: false }; break; }
    }
    if (!fl.anchor) return null;
    const dist = bfs(fl, fl.up.x, fl.up.y);
    // the room farthest from the entrance holds the way on
    let far = fl.rooms[1], fd = -1;
    for (const r of fl.rooms.slice(1)) { const d = dist[r.cy * w + r.cx]; if (d > fd) { fd = d; far = r; } }
    if (fd < 12) return null;
    if (wantBoss) {
        const aw = 11, ah = 9;
        const ax = Math.max(2, Math.min(w - aw - 2, far.cx - (aw >> 1))), ay = Math.max(2, Math.min(h - ah - 2, far.cy - (ah >> 1)));
        carve(ax, ay, aw, ah);
        const cx = ax + (aw >> 1), cy = ay + (ah >> 1);
        fl.arena = { x: ax, y: ay, w: aw, h: ah, cx, cy };
        fl.boss = { x: cx, y: cy - 1 };
        fl.exit = { x: cx, y: ay + ah - 2 };
        // the arena must join the rest: link it to the room it replaced
        far.cx = cx; far.cy = cy;
        fl.rooms.push(fl.arena);
        link(fl.rooms[fl.rooms.length - 2], { cx, cy });
        fl.bossId = bossAt(Z.id, idx);
        if (!last) { fl.down = fl.exit; fl.exit = null; }
    } else if (!last) {
        fl.down = { x: far.cx, y: far.cy };
    } else {
        fl.exit = { x: far.cx, y: far.cy };   // a Rift's last floor: a portal home
    }
    // chests in rooms other than the first and the far one
    const spare = fl.rooms.filter((r) => r !== start && r !== far && r !== fl.arena);
    rng.shuffle(spare);
    const taken = new Set([`${fl.up.x},${fl.up.y}`, `${fl.anchor.x},${fl.anchor.y}`]);
    for (const r of spare.slice(0, Z.chests)) {
        const c = pickCell(fl, rng, r, taken, 2);
        if (c) { fl.chests.push({ x: c.x, y: c.y }); taken.add(`${c.x},${c.y}`); }
    }
    // Hex spawn points: anywhere that is at least 7 cells (walking) from the entrance
    const n = rng.int(Z.foes[0], Z.foes[1]);
    const rooms = fl.rooms.filter((r) => r !== start);
    for (let i = 0; i < n * 6 && fl.spawns.length < n; i++) {
        const r = rooms[i % rooms.length];
        const c = pickCell(fl, rng, r, taken, 1);
        if (!c || dist[c.y * w + c.x] < 7) continue;
        if (fl.spawns.some((s) => Math.hypot(s.x - c.x, s.y - c.y) < 4)) continue;
        if (fl.boss && Math.hypot(c.x - fl.boss.x, c.y - fl.boss.y) < 4) continue;
        fl.spawns.push({ x: c.x, y: c.y });
        taken.add(`${c.x},${c.y}`);
    }
    if (fl.spawns.length < 2) return null;
    // decoration on cells beside walls, never in the way of anything that matters
    for (const r of fl.rooms) {
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
            if (cellAt(fl, x, y) !== FLOOR || taken.has(`${x},${y}`)) continue;
            const edge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1;
            if (!edge && rng() > T.density * 0.4) continue;
            if (edge && rng() > T.density * 2.2) continue;
            if (Math.hypot(x - fl.up.x, y - fl.up.y) < 2.5 || (fl.boss && Math.hypot(x - fl.boss.x, y - fl.boss.y) < 2.5)) continue;
            // keep the doorways clear: a prop needs wall or floor on both sides of its row
            fl.props.push({ x, y, k: rng.pick(T.props), r: rng.int(0, 3) });
        }
    }
    return fl;
}

function pickCell(fl, rng, r, taken, margin) {
    for (let i = 0; i < 20; i++) {
        const x = rng.int(r.x + margin, r.x + r.w - 1 - margin), y = rng.int(r.y + margin, r.y + r.h - 1 - margin);
        if (cellAt(fl, x, y) === FLOOR && !taken.has(`${x},${y}`)) return { x, y };
    }
    return null;
}

/** Walking distance from a cell to every floor cell (4-neighbour). -1 where unreachable. */
export function bfs(fl, sx, sy) {
    const d = new Array(fl.w * fl.h).fill(-1);
    const q = [[sx, sy]];
    d[sy * fl.w + sx] = 0;
    for (let i = 0; i < q.length; i++) {
        const [x, y] = q[i];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (cellAt(fl, nx, ny) !== FLOOR || d[ny * fl.w + nx] >= 0) continue;
            d[ny * fl.w + nx] = d[y * fl.w + x] + 1;
            q.push([nx, ny]);
        }
    }
    return d;
}

/** A path of cell centres from a to b (4-neighbour BFS). null if none. Used by foes and the bot. */
export function findPath(fl, ax, ay, bx, by) {
    const d = bfs(fl, bx, by);
    if (d[ay * fl.w + ax] < 0) return null;
    const path = [];
    let x = ax, y = ay;
    while (x !== bx || y !== by) {
        let best = null;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            const v = d[ny * fl.w + nx];
            if (cellAt(fl, nx, ny) === FLOOR && v >= 0 && v < d[y * fl.w + x]) { best = [nx, ny]; break; }
        }
        if (!best) return null;
        [x, y] = best;
        path.push([x, y]);
    }
    return path;
}
