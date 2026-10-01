/**
 * dungeon.js — floor layouts. Pure: takes an rng and a world, returns a level:
 *
 *   { w, h, world, floor, boss, tiles[], seen[], rooms[{x,y,w,h}], lights[{x,y,r,on,k}],
 *     decor[{x,y,k}], props[{x,y,k}], start{x,y}, down{x,y}, vault{...}|null, arena{...}|null }
 *
 * Generators: rooms (rooms + corridors + loops), caves (cellular automata),
 * halls (a grid of rooms) and mixed (rooms stamped into caves). Every layout
 * keeps only its largest connected region, and every feature that could cut
 * the floor in two (liquid, props) is reverted if it does.
 */

import { T, TP, DIRS4, DIRS8 } from './tiles.js';
import { WORLDS, isBossFloor } from './worlds.js';
import { distanceMap } from './path.js';

const inb = (lv, x, y) => x >= 0 && y >= 0 && x < lv.w && y < lv.h;
const at = (lv, x, y) => lv.tiles[y * lv.w + x];
const set = (lv, x, y, t) => { lv.tiles[y * lv.w + x] = t; };
const walk = (t) => TP[t].pass || t === T.DOOR || t === T.VAULT_DOOR;

export function floorSize(floor) {
    const k = Math.min(1, (floor - 1) / 90);
    return { w: Math.round(42 + k * 20), h: Math.round(32 + k * 13) };
}

export function blankLevel(w, h, world, floor) {
    return {
        w, h, world, floor, boss: false,
        tiles: new Array(w * h).fill(T.WALL), seen: new Array(w * h).fill(0),
        rooms: [], lights: [], decor: [], props: [], start: null, down: null, vault: null, arena: null,
    };
}

export function buildLevel(rng, floor, worldId) {
    const W = WORLDS[worldId];
    if (isBossFloor(floor)) return buildArena(rng, floor, worldId);
    for (let attempt = 0; attempt < 30; attempt++) {
        const { w, h } = floorSize(floor);
        const lv = blankLevel(w, h, worldId, floor);
        const kind = rng.weighted(W.gen);
        if (kind === 'rooms') genRooms(lv, rng);
        else if (kind === 'caves') genCaves(lv, rng, 0.45);
        else if (kind === 'halls') genHalls(lv, rng);
        else genMixed(lv, rng);
        lv.gen = kind;
        keepLargest(lv);
        if (countFloor(lv) < w * h * 0.22) continue;
        if (!lv.rooms.length) fakeRooms(lv, rng);
        addMoss(lv, rng, W.moss);
        addLiquids(lv, rng, W, floor);
        addPillars(lv, rng);
        addProps(lv, rng, W);
        if (floor >= 3 && rng.chance(0.22)) addVault(lv, rng);
        if (!placeStairs(lv, rng)) continue;
        addDecor(lv, rng, W);
        addLights(lv, rng, W);
        return lv;
    }
    throw new Error('level generation failed for floor ' + floor);
}

// ------------------------------------------------------------------ Generators

function carveRect(lv, x, y, w, h, t = T.FLOOR) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (inb(lv, i, j)) set(lv, i, j, t);
}

function carveCorridor(lv, rng, ax, ay, bx, by) {
    const horizFirst = rng.chance(0.5);
    const line = (x0, y0, x1, y1) => {
        const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
        let x = x0, y = y0;
        while (true) {
            if (at(lv, x, y) === T.WALL) set(lv, x, y, T.FLOOR);
            if (x === x1 && y === y1) break;
            x += dx; y += dy;
        }
    };
    if (horizFirst) { line(ax, ay, bx, ay); line(bx, ay, bx, by); }
    else { line(ax, ay, ax, by); line(ax, by, bx, by); }
}

const center = (r) => [r.x + (r.w >> 1), r.y + (r.h >> 1)];
const overlaps = (a, b, m) => a.x - m < b.x + b.w && a.x + a.w + m > b.x && a.y - m < b.y + b.h && a.y + a.h + m > b.y;

function genRooms(lv, rng) {
    const target = Math.round((lv.w * lv.h) / 120);
    for (let k = 0; k < 400 && lv.rooms.length < target; k++) {
        const rw = rng.int(4, 10), rh = rng.int(4, 8);
        const r = { x: rng.int(1, lv.w - rw - 2), y: rng.int(1, lv.h - rh - 2), w: rw, h: rh };
        if (lv.rooms.some((o) => overlaps(r, o, 2))) continue;
        lv.rooms.push(r);
        carveRect(lv, r.x, r.y, r.w, r.h);
    }
    connectRooms(lv, rng);
    addDoors(lv, rng);
}

function connectRooms(lv, rng) {
    const rooms = lv.rooms.slice().sort((a, b) => a.x - b.x);
    for (let i = 1; i < rooms.length; i++) {
        const [ax, ay] = center(rooms[i]);
        let best = null, bd = 1e9;
        for (let j = 0; j < i; j++) {
            const [bx, by] = center(rooms[j]);
            const d = Math.abs(ax - bx) + Math.abs(ay - by);
            if (d < bd) { bd = d; best = rooms[j]; }
        }
        const [bx, by] = center(best);
        carveCorridor(lv, rng, ax, ay, bx, by);
    }
    // Loops: a few extra links so the floor is not a tree.
    const extra = Math.max(1, Math.round(rooms.length * 0.25));
    for (let k = 0; k < extra; k++) {
        const a = rng.pick(rooms);
        const near = rooms.filter((r) => r !== a).sort((p, q) => dist(center(p), center(a)) - dist(center(q), center(a)));
        const b = near[rng.int(0, Math.min(2, near.length - 1))];
        if (b) { const [ax, ay] = center(a), [bx, by] = center(b); carveCorridor(lv, rng, ax, ay, bx, by); }
    }
}
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

function addDoors(lv, rng) {
    for (const r of lv.rooms) {
        const ring = [];
        for (let x = r.x; x < r.x + r.w; x++) { ring.push([x, r.y - 1]); ring.push([x, r.y + r.h]); }
        for (let y = r.y; y < r.y + r.h; y++) { ring.push([r.x - 1, y]); ring.push([r.x + r.w, y]); }
        for (const [x, y] of ring) {
            if (!inb(lv, x, y) || at(lv, x, y) !== T.FLOOR) continue;
            // A chokepoint: walls on both sides along the room edge.
            const horiz = y === r.y - 1 || y === r.y + r.h;
            const s1 = horiz ? at(lv, x - 1, y) : at(lv, x, y - 1);
            const s2 = horiz ? at(lv, x + 1, y) : at(lv, x, y + 1);
            if (s1 === T.WALL && s2 === T.WALL && rng.chance(0.55)) set(lv, x, y, T.DOOR);
        }
    }
}

function genCaves(lv, rng, fill) {
    const { w, h } = lv;
    let g = new Array(w * h);
    for (let i = 0; i < w * h; i++) {
        const x = i % w, y = (i / w) | 0;
        g[i] = x === 0 || y === 0 || x === w - 1 || y === h - 1 ? 1 : (rng.chance(fill) ? 1 : 0);
    }
    for (let it = 0; it < 5; it++) {
        const n = g.slice();
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
            let c = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) c += g[(y + dy) * w + x + dx];
            n[y * w + x] = c >= 5 ? 1 : 0;
        }
        g = n;
    }
    for (let i = 0; i < w * h; i++) lv.tiles[i] = g[i] ? T.WALL : T.FLOOR;
}

function genHalls(lv, rng) {
    const cw = rng.int(9, 12), ch = rng.int(8, 10);
    const cols = Math.floor((lv.w - 2) / cw), rows = Math.floor((lv.h - 2) / ch);
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const rw = rng.int(4, cw - 2), rh = rng.int(4, ch - 2);
        const x = 1 + c * cw + rng.int(0, cw - rw - 1), y = 1 + r * ch + rng.int(0, ch - rh - 1);
        const room = { x, y, w: rw, h: rh };
        cells.push({ c, r, room });
        lv.rooms.push(room);
        carveRect(lv, x, y, rw, rh);
    }
    // Random spanning tree over the grid + a few loops.
    const id = (c, r) => r * cols + c;
    const seen = new Set([0]);
    const stack = [0];
    const link = (a, b) => {
        const [ax, ay] = center(cells[a].room), [bx, by] = center(cells[b].room);
        carveCorridor(lv, rng, ax, ay, bx, by);
    };
    while (stack.length) {
        const cur = stack[stack.length - 1];
        const { c, r } = cells[cur];
        const nb = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]].filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rows && !seen.has(id(x, y)));
        if (!nb.length) { stack.pop(); continue; }
        const [nx, ny] = rng.pick(nb);
        const n = id(nx, ny);
        seen.add(n); stack.push(n);
        link(cur, n);
    }
    for (let k = 0; k < Math.round(cells.length * 0.3); k++) {
        const a = rng.int(0, cells.length - 1);
        const { c, r } = cells[a];
        const nb = [[c + 1, r], [c, r + 1]].filter(([x, y]) => x < cols && y < rows);
        if (nb.length) link(a, id(...rng.pick(nb)));
    }
    addDoors(lv, rng);
}

function genMixed(lv, rng) {
    genCaves(lv, rng, 0.5);
    const n = rng.int(3, 6);
    for (let k = 0; k < 80 && lv.rooms.length < n; k++) {
        const rw = rng.int(5, 9), rh = rng.int(4, 7);
        const r = { x: rng.int(2, lv.w - rw - 3), y: rng.int(2, lv.h - rh - 3), w: rw, h: rh };
        if (lv.rooms.some((o) => overlaps(r, o, 3))) continue;
        // Build walls around, then the floor.
        carveRect(lv, r.x - 1, r.y - 1, r.w + 2, r.h + 2, T.WALL);
        carveRect(lv, r.x, r.y, r.w, r.h);
        lv.rooms.push(r);
    }
    // Tie the rooms to each other (and so to the caves they cross).
    connectRooms(lv, rng);
    addDoors(lv, rng);
}

// ------------------------------------------------------------------ Connectivity

function regions(lv) {
    const { w, h } = lv;
    const reg = new Int32Array(w * h).fill(-1);
    const sizes = [];
    const q = new Int32Array(w * h);
    for (let s = 0; s < w * h; s++) {
        if (reg[s] !== -1 || !walk(lv.tiles[s])) continue;
        const id = sizes.length;
        let qh = 0, qt = 0, n = 0;
        q[qt++] = s; reg[s] = id;
        while (qh < qt) {
            const i = q[qh++]; n++;
            const x = i % w, y = (i / w) | 0;
            for (const [dx, dy] of DIRS4) {
                const X = x + dx, Y = y + dy;
                if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
                const j = Y * w + X;
                if (reg[j] !== -1 || !walk(lv.tiles[j])) continue;
                reg[j] = id; q[qt++] = j;
            }
        }
        sizes.push(n);
    }
    return { reg, sizes };
}

function keepLargest(lv) {
    const { reg, sizes } = regions(lv);
    let best = 0;
    for (let i = 1; i < sizes.length; i++) if (sizes[i] > sizes[best]) best = i;
    for (let i = 0; i < lv.tiles.length; i++) if (reg[i] !== best && walk(lv.tiles[i])) lv.tiles[i] = T.WALL;
    // Edges are always wall.
    for (let x = 0; x < lv.w; x++) { set(lv, x, 0, T.WALL); set(lv, x, lv.h - 1, T.WALL); }
    for (let y = 0; y < lv.h; y++) { set(lv, 0, y, T.WALL); set(lv, lv.w - 1, y, T.WALL); }
    // A door with no floor on either side leads nowhere.
    for (let i = 0; i < lv.tiles.length; i++) {
        if (lv.tiles[i] !== T.DOOR) continue;
        const x = i % lv.w, y = (i / lv.w) | 0;
        const ns = walk(at(lv, x, y - 1)) && walk(at(lv, x, y + 1));
        const ew = walk(at(lv, x - 1, y)) && walk(at(lv, x + 1, y));
        if (!ns && !ew) lv.tiles[i] = T.FLOOR;
    }
    lv.rooms = lv.rooms.filter((r) => walk(at(lv, r.x + (r.w >> 1), r.y + (r.h >> 1))));
}

function connected(lv) {
    const { sizes } = regions(lv);
    return sizes.length === 1;
}

const countFloor = (lv) => lv.tiles.reduce((n, t) => n + (walk(t) ? 1 : 0), 0);

function fakeRooms(lv, rng) {
    // Caves have no rooms; sample open pockets so placement code has anchors.
    for (let k = 0; k < 400 && lv.rooms.length < 14; k++) {
        const x = rng.int(3, lv.w - 4), y = rng.int(3, lv.h - 4);
        let open = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (at(lv, x + dx, y + dy) === T.FLOOR) open++;
        if (open < 9) continue;
        const r = { x: x - 1, y: y - 1, w: 3, h: 3, cave: true };
        if (lv.rooms.some((o) => overlaps(r, o, 4))) continue;
        lv.rooms.push(r);
    }
}

// ------------------------------------------------------------------ Features

function blob(lv, rng, cx, cy, size, fn) {
    const cells = [];
    let x = cx, y = cy;
    for (let k = 0; k < size; k++) {
        if (inb(lv, x, y)) cells.push([x, y]);
        const [dx, dy] = rng.pick(DIRS8);
        x = Math.max(1, Math.min(lv.w - 2, x + dx));
        y = Math.max(1, Math.min(lv.h - 2, y + dy));
        if (rng.chance(0.15)) { x = cx + rng.int(-1, 1); y = cy + rng.int(-1, 1); }
    }
    for (const [i, j] of cells) fn(i, j);
    return cells;
}

function addMoss(lv, rng, chance) {
    if (!chance) return;
    const n = Math.round(chance * 10);
    for (let k = 0; k < n; k++) {
        const x = rng.int(2, lv.w - 3), y = rng.int(2, lv.h - 3);
        if (at(lv, x, y) !== T.FLOOR) continue;
        blob(lv, rng, x, y, rng.int(8, 22), (i, j) => { if (at(lv, i, j) === T.FLOOR) set(lv, i, j, T.MOSS); });
    }
}

function addLiquids(lv, rng, W, floor) {
    const shallow = W.liquid === 'ice' ? T.ICE : W.liquid === 'shallow' ? T.SHALLOW : null;
    if (shallow) {
        for (let k = 0, n = rng.int(1, 4); k < n; k++) {
            const x = rng.int(3, lv.w - 4), y = rng.int(3, lv.h - 4);
            if (at(lv, x, y) !== T.FLOOR) continue;
            blob(lv, rng, x, y, rng.int(10, 30), (i, j) => { const t = at(lv, i, j); if (t === T.FLOOR || t === T.MOSS) set(lv, i, j, shallow); });
        }
    }
    const deep = W.deep === 'lava' ? T.LAVA : W.deep === 'chasm' ? T.CHASM : W.deep === 'deep' ? T.DEEP : null;
    if (!deep) return;
    const n = rng.int(1, 3) + (floor > 30 ? 1 : 0);
    for (let k = 0, placed = 0; k < 25 && placed < n; k++) {
        const x = rng.int(4, lv.w - 5), y = rng.int(4, lv.h - 5);
        if (!walk(at(lv, x, y))) continue;
        const before = [];
        blob(lv, rng, x, y, rng.int(8, 26), (i, j) => {
            const t = at(lv, i, j);
            if (t === T.FLOOR || t === T.MOSS || t === T.SHALLOW || t === T.ICE) { before.push([i, j, t]); set(lv, i, j, deep); }
        });
        // Deep water rims itself with shallows.
        if (deep === T.DEEP) for (const [i, j] of before) for (const [dx, dy] of DIRS8) if (at(lv, i + dx, j + dy) === T.FLOOR) set(lv, i + dx, j + dy, T.SHALLOW);
        if (!connected(lv) || countFloor(lv) < lv.w * lv.h * 0.2) {
            for (const [i, j, t] of before) set(lv, i, j, t);
        } else placed++;
    }
    // Bridges: where a single liquid cell separates two floors in a straight line, maybe span it.
    for (let y = 1; y < lv.h - 1; y++) for (let x = 1; x < lv.w - 1; x++) {
        if (at(lv, x, y) !== deep || !rng.chance(0.3)) continue;
        if ((walk(at(lv, x - 1, y)) && walk(at(lv, x + 1, y))) || (walk(at(lv, x, y - 1)) && walk(at(lv, x, y + 1)))) set(lv, x, y, T.BRIDGE);
    }
}

const isDoorish = (t) => t === T.DOOR || t === T.DOOR_OPEN || t === T.VAULT_DOOR;
function nearDoor(lv, x, y) {
    for (const [dx, dy] of DIRS8) if (inb(lv, x + dx, y + dy) && isDoorish(at(lv, x + dx, y + dy))) return true;
    return false;
}

function addPillars(lv, rng) {
    for (const r of lv.rooms) {
        if (r.cave || r.w < 7 || r.h < 6 || !rng.chance(0.45)) continue;
        const step = rng.pick([2, 3]);
        for (let y = r.y + 1; y < r.y + r.h - 1; y += step) for (let x = r.x + 1; x < r.x + r.w - 1; x += step) {
            if ((x === r.x + 1 || x === r.x + r.w - 2 || y === r.y + 1 || y === r.y + r.h - 2) && at(lv, x, y) === T.FLOOR && !nearDoor(lv, x, y)) {
                // Only a ring of pillars one in from the walls, leaving the room's middle open.
                if (step === 3 || (x - r.x + y - r.y) % 2 === 0) set(lv, x, y, T.PILLAR);
            }
        }
        if (!connected(lv)) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (at(lv, x, y) === T.PILLAR) set(lv, x, y, T.FLOOR);
    }
}

function addProps(lv, rng, W) {
    if (!W.props.length) return;
    const placed = [];
    for (let k = 0; k < lv.w * lv.h * 0.02; k++) {
        const x = rng.int(1, lv.w - 2), y = rng.int(1, lv.h - 2);
        if (at(lv, x, y) !== T.FLOOR || nearDoor(lv, x, y)) continue;
        // Against a wall, in an open area (not in a corridor).
        let walls = 0, open = 0;
        for (const [dx, dy] of DIRS4) if (at(lv, x + dx, y + dy) === T.WALL) walls++;
        for (const [dx, dy] of DIRS8) if (walk(at(lv, x + dx, y + dy))) open++;
        if (walls < 1 || open < 4) continue;
        set(lv, x, y, T.PROP);
        placed.push({ x, y, k: rng.pick(W.props) });
    }
    if (!connected(lv)) {
        // Back them out one at a time until the floor is whole again.
        while (placed.length && !connected(lv)) { const p = placed.pop(); set(lv, p.x, p.y, T.FLOOR); }
    }
    lv.props.push(...placed);
}

function addVault(lv, rng) {
    for (let k = 0; k < 300; k++) {
        const vw = rng.int(4, 6), vh = rng.int(3, 5);
        const x = rng.int(2, lv.w - vw - 3), y = rng.int(2, lv.h - vh - 3);
        let solid = true;
        for (let j = y - 1; j <= y + vh && solid; j++) for (let i = x - 1; i <= x + vw; i++) if (at(lv, i, j) !== T.WALL) { solid = false; break; }
        if (!solid) continue;
        // A door cell on one side with walkable floor just beyond it.
        const sides = rng.shuffle([
            [x + (vw >> 1), y - 1, 0, -1], [x + (vw >> 1), y + vh, 0, 1],
            [x - 1, y + (vh >> 1), -1, 0], [x + vw, y + (vh >> 1), 1, 0],
        ]);
        for (const [dx0, dy0, sx, sy] of sides) {
            const ox = dx0 + sx, oy = dy0 + sy;
            if (!inb(lv, ox, oy) || at(lv, ox, oy) !== T.FLOOR) continue;
            carveRect(lv, x, y, vw, vh);
            set(lv, dx0, dy0, T.VAULT_DOOR);
            lv.vault = { x, y, w: vw, h: vh, door: { x: dx0, y: dy0 } };
            return;
        }
    }
}

function placeStairs(lv, rng) {
    const cand = lv.rooms.filter((r) => !lv.vault || !overlaps(r, lv.vault, 0));
    if (!cand.length) return false;
    const r = rng.pick(cand);
    let sx = r.x + rng.int(0, r.w - 1), sy = r.y + rng.int(0, r.h - 1);
    if (at(lv, sx, sy) !== T.FLOOR) {
        const c = center(r); sx = c[0]; sy = c[1];
        if (at(lv, sx, sy) !== T.FLOOR) return false;
    }
    const D = distanceMap(lv, [[sx, sy]], (i) => walk(lv.tiles[i]) && lv.tiles[i] !== T.VAULT_DOOR);
    let maxd = 0;
    for (let i = 0; i < D.length; i++) if (D[i] > maxd) maxd = D[i];
    if (maxd < 18) return false;
    const far = [];
    for (let i = 0; i < D.length; i++) {
        if (D[i] < maxd * 0.8 || lv.tiles[i] !== T.FLOOR) continue;
        const x = i % lv.w, y = (i / lv.w) | 0;
        if (nearDoor(lv, x, y)) continue;
        if (lv.vault && x >= lv.vault.x && x < lv.vault.x + lv.vault.w && y >= lv.vault.y && y < lv.vault.y + lv.vault.h) continue;
        far.push(i);
    }
    if (!far.length) return false;
    const di = rng.pick(far);
    lv.start = { x: sx, y: sy };
    lv.down = { x: di % lv.w, y: (di / lv.w) | 0 };
    set(lv, sx, sy, T.STAIRS_UP);
    set(lv, lv.down.x, lv.down.y, T.STAIRS_DOWN);
    return true;
}

function addDecor(lv, rng, W) {
    if (!W.deco.length) return;
    const n = Math.round(lv.w * lv.h * 0.035);
    for (let k = 0; k < n; k++) {
        const x = rng.int(1, lv.w - 2), y = rng.int(1, lv.h - 2);
        const t = at(lv, x, y);
        if (t !== T.FLOOR && t !== T.MOSS) continue;
        lv.decor.push({ x, y, k: rng.pick(W.deco), r: rng.int(0, 359) });
    }
}

function addLights(lv, rng, W) {
    // Wall torches: a wall cell with a room floor in front of it.
    const torches = [];
    const want = Math.round(lv.rooms.length * W.torches * 1.4);
    for (let k = 0; k < 600 && torches.length < want; k++) {
        const r = rng.pick(lv.rooms);
        if (r.cave && rng.chance(0.6)) continue;
        const side = rng.int(0, 3);
        const x = side < 2 ? r.x + rng.int(0, r.w - 1) : side === 2 ? r.x - 1 : r.x + r.w;
        const y = side >= 2 ? r.y + rng.int(0, r.h - 1) : side === 0 ? r.y - 1 : r.y + r.h;
        if (!inb(lv, x, y) || at(lv, x, y) !== T.WALL) continue;
        const [fx, fy] = side === 0 ? [x, y + 1] : side === 1 ? [x, y - 1] : side === 2 ? [x + 1, y] : [x - 1, y];
        if (!inb(lv, fx, fy) || !TP[at(lv, fx, fy)].pass) continue;
        if (torches.some((t) => Math.abs(t.wx - x) + Math.abs(t.wy - y) < 6)) continue;
        torches.push({ x: fx, y: fy, wx: x, wy: y, r: 4, on: true, k: 'torch' });
    }
    lv.lights.push(...torches);
    // Glowing decor (fungus, crystals, candles, coals…).
    if (W.glow) {
        const n = Math.round(lv.w * lv.h / 160);
        for (let k = 0, placed = 0; k < 400 && placed < n; k++) {
            const x = rng.int(1, lv.w - 2), y = rng.int(1, lv.h - 2);
            const t = at(lv, x, y);
            if (t !== T.FLOOR && t !== T.MOSS) continue;
            let wallN = 0;
            for (const [dx, dy] of DIRS8) if (at(lv, x + dx, y + dy) === T.WALL) wallN++;
            if (wallN < 2) continue;
            if (lv.lights.some((l) => Math.abs(l.x - x) + Math.abs(l.y - y) < 5)) continue;
            lv.lights.push({ x, y, r: 3, on: true, k: 'glow', g: W.glow });
            placed++;
        }
    }
}

// ------------------------------------------------------------------ Warden arenas

function buildArena(rng, floor, worldId) {
    const W = WORLDS[worldId];
    const w = 33, h = 38;
    const lv = blankLevel(w, h, worldId, floor);
    lv.boss = true;
    lv.gen = 'arena';
    // Antechamber (south) → corridor → arena (north).
    const ante = { x: 12, y: 30, w: 9, h: 6 };
    const ar = { x: 5, y: 4, w: 23, h: 19 };
    carveRect(lv, ante.x, ante.y, ante.w, ante.h);
    carveRect(lv, 15, 23, 3, 7);
    carveRect(lv, ar.x, ar.y, ar.w, ar.h);
    // Round the arena's corners.
    for (const [cx, cy, sx, sy] of [[ar.x, ar.y, 1, 1], [ar.x + ar.w - 1, ar.y, -1, 1], [ar.x, ar.y + ar.h - 1, 1, -1], [ar.x + ar.w - 1, ar.y + ar.h - 1, -1, -1]]) {
        for (let j = 0; j < 3; j++) for (let i = 0; i < 3 - j; i++) set(lv, cx + sx * i, cy + sy * j, T.WALL);
    }
    lv.rooms.push(ante, ar);
    // Pillars in a world-flavoured pattern (never in the middle).
    const pat = [[-6, -4], [6, -4], [-6, 4], [6, 4], [-9, 0], [9, 0], [0, -7]];
    const mx = ar.x + (ar.w >> 1), my = ar.y + (ar.h >> 1);
    for (const [dx, dy] of pat.slice(0, 4 + (worldId % 3))) set(lv, mx + dx, my + dy, T.PILLAR);
    // Decorative liquid pockets in the arena's flanks.
    const deep = W.deep === 'lava' ? T.LAVA : W.deep === 'chasm' ? T.CHASM : W.deep === 'deep' ? T.DEEP : null;
    if (deep) for (const sx of [-1, 1]) {
        const cx = mx + sx * 10, cy = my + 2;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 0; i++) if (at(lv, cx + i * sx, cy + j) === T.FLOOR) set(lv, cx + i * sx, cy + j, deep);
    }
    lv.start = { x: ante.x + 4, y: ante.y + 4 };
    set(lv, lv.start.x, lv.start.y, T.STAIRS_UP);
    lv.down = { x: mx, y: ar.y + 2 };            // revealed when the Warden falls
    lv.arena = { ...ar, cx: mx, cy: my };
    // Braziers ring the arena, all lit.
    for (const [dx, dy] of [[-8, -7], [8, -7], [-8, 8], [8, 8]]) lv.lights.push({ x: mx + dx, y: my + dy, r: 6, on: true, k: 'brazier', fixed: true });
    lv.lights.push({ x: ante.x + 1, y: ante.y + 1, r: 4, on: true, k: 'glow', g: W.glow || 'candles' });
    lv.lights.push({ x: ante.x + ante.w - 2, y: ante.y + 1, r: 4, on: true, k: 'glow', g: W.glow || 'candles' });
    addDecor(lv, rng, W);
    lv.decor = lv.decor.filter((d) => !(d.x === lv.down.x && d.y === lv.down.y));
    return lv;
}
