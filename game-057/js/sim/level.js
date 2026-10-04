/**
 * level.js — procedural maps: a campaign sector (rooms on a macro grid joined
 * by corridors and blast doors), the escape route and the horde arena.
 *
 * 1 tile = 1 m. Tiles: void, floor, wall. Rooms are floor rectangles; their
 * wall line holds the doors. Corridors are 4 tiles wide, straight when the
 * rooms line up and Z-shaped through the gap between cells when they don't.
 * Everything comes from the seed, so the view and the sim agree on the map.
 */

import { makeRng } from './rng.js';
import { sectorTheme, WEAPON_SECTOR, SHOP } from '../config.js';

export const T_VOID = 0, T_FLOOR = 1, T_WALL = 2;
export const F_CORRIDOR = 1, F_HAZARD = 2, F_VENT = 4, F_PAD = 8, F_ARENA = 16, F_DOOR = 32;

const CELL = 26;
const CW = 4; // corridor width

/** Props: solid blocks movement and bullets; hp > 0 means destructible. */
export const PROPS = {
    crate:   { hp: 36, solid: true, drop: 0.7, h: 0.9 },
    barrel:  { hp: 18, solid: true, explode: true, h: 1.0 },
    pillar:  { hp: 0, solid: true, h: 1.9 },
    cargo:   { hp: 0, solid: true, h: 1.4 },
    console: { hp: 0, solid: true, h: 1.0, wall: true },
    locker:  { hp: 0, solid: true, h: 1.8, wall: true },
    sandbag: { hp: 60, solid: true, h: 0.7 },
    tank:    { hp: 45, solid: true, h: 1.8, bug: true },
    rack:    { hp: 0, solid: true, h: 1.8, wall: true },
    pipe:    { hp: 0, solid: true, h: 1.9 },
    cocoon:  { hp: 30, solid: true, h: 1.5, bug: true, drop: 0.5 },
    pod:     { hp: 20, solid: true, h: 0.8, bug: true },
};

function makeLevel(w, h, theme, seed) {
    return {
        w, h, theme, seed,
        tiles: new Uint8Array(w * h),
        flags: new Uint8Array(w * h),
        solid: new Uint8Array(w * h),
        roomAt: new Int16Array(w * h).fill(-1),
        propAt: new Int16Array(w * h).fill(-1),
        rooms: [], doors: [], props: [], lamps: [], items: [],
        start: { x: 0, y: 0 },
    };
}

const idx = (lv, x, y) => y * lv.w + x;
const inb = (lv, x, y) => x >= 0 && y >= 0 && x < lv.w && y < lv.h;

function carve(lv, x0, y0, w, h, roomId, flag) {
    for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
            if (!inb(lv, x, y)) continue;
            const i = idx(lv, x, y);
            lv.tiles[i] = T_FLOOR;
            if (roomId >= 0) lv.roomAt[i] = roomId;
            if (flag) lv.flags[i] |= flag;
        }
    }
}

function addRoom(lv, x, y, w, h, type, extra = {}) {
    const room = {
        id: lv.rooms.length, x, y, w, h, cx: x + w / 2, cy: y + h / 2, type,
        links: [], doors: [], vents: [], depth: 0, ...extra,
    };
    lv.rooms.push(room);
    carve(lv, x, y, w, h, room.id, 0);
    return room;
}

function addDoor(lv, room, x, y, vertical) {
    const door = {
        id: lv.doors.length, room: room.id, x, y, w: vertical ? 1 : CW, h: vertical ? CW : 1,
        vertical, open: 1, target: 1, cx: 0, cy: 0,
    };
    door.cx = x + door.w / 2;
    door.cy = y + door.h / 2;
    lv.doors.push(door);
    room.doors.push(door.id);
    for (let yy = y; yy < y + door.h; yy++) for (let xx = x; xx < x + door.w; xx++) lv.flags[idx(lv, xx, yy)] |= F_DOOR;
    return door;
}

/** Connect two rooms; `horizontal` means b is to the right of a, else below a. */
function link(lv, rng, a, b, horizontal) {
    a.links.push(b.id); b.links.push(a.id);
    if (horizontal) {
        const ax = a.x + a.w, bx = b.x - 1; // wall columns
        const lo = Math.max(a.y, b.y) + 1, hi = Math.min(a.y + a.h, b.y + b.h) - 1 - CW;
        if (hi >= lo) {
            const y = rng.int(lo, hi);
            carve(lv, ax, y, bx - ax + 1, CW, -1, F_CORRIDOR);
            addDoor(lv, a, ax, y, true); addDoor(lv, b, bx, y, true);
        } else {
            const ya = rng.int(a.y + 1, a.y + a.h - 1 - CW), yb = rng.int(b.y + 1, b.y + b.h - 1 - CW);
            const xm = rng.int(ax + 1, bx - CW);
            carve(lv, ax, ya, xm + CW - ax, CW, -1, F_CORRIDOR);
            carve(lv, xm, Math.min(ya, yb), CW, Math.abs(ya - yb) + CW, -1, F_CORRIDOR);
            carve(lv, xm, yb, bx - xm + 1, CW, -1, F_CORRIDOR);
            addDoor(lv, a, ax, ya, true); addDoor(lv, b, bx, yb, true);
        }
    } else {
        const ay = a.y + a.h, by = b.y - 1;
        const lo = Math.max(a.x, b.x) + 1, hi = Math.min(a.x + a.w, b.x + b.w) - 1 - CW;
        if (hi >= lo) {
            const x = rng.int(lo, hi);
            carve(lv, x, ay, CW, by - ay + 1, -1, F_CORRIDOR);
            addDoor(lv, a, x, ay, false); addDoor(lv, b, x, by, false);
        } else {
            const xa = rng.int(a.x + 1, a.x + a.w - 1 - CW), xb = rng.int(b.x + 1, b.x + b.w - 1 - CW);
            const ym = rng.int(ay + 1, by - CW);
            carve(lv, xa, ay, CW, ym + CW - ay, -1, F_CORRIDOR);
            carve(lv, Math.min(xa, xb), ym, Math.abs(xa - xb) + CW, CW, -1, F_CORRIDOR);
            carve(lv, xb, ym, CW, by - ym + 1, -1, F_CORRIDOR);
            addDoor(lv, a, xa, ay, false); addDoor(lv, b, xb, by, false);
        }
    }
}

/** Walls around every floor tile, corridor flags off room tiles, hazard stripes by doors. */
function finalize(lv) {
    const { w, h, tiles } = lv;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = idx(lv, x, y);
            if (tiles[i] !== T_VOID) continue;
            let near = false;
            for (let dy = -1; dy <= 1 && !near; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const xx = x + dx, yy = y + dy;
                    if (inb(lv, xx, yy) && tiles[idx(lv, xx, yy)] === T_FLOOR) { near = true; break; }
                }
            }
            if (near) tiles[i] = T_WALL;
        }
    }
    for (let i = 0; i < w * h; i++) {
        if (lv.roomAt[i] >= 0) lv.flags[i] &= ~F_CORRIDOR;
        lv.solid[i] = tiles[i] === T_FLOOR ? 0 : 1;
    }
    // Hazard stripes on the floor just inside each door.
    for (const d of lv.doors) {
        const room = lv.rooms[d.room];
        for (let k = 0; k < 2; k++) {
            for (let t = 0; t < CW; t++) {
                let x, y;
                if (d.vertical) { y = d.y + t; x = d.x < room.x ? room.x + k : room.x + room.w - 1 - k; }
                else { x = d.x + t; y = d.y < room.y ? room.y + k : room.y + room.h - 1 - k; }
                if (inb(lv, x, y)) lv.flags[idx(lv, x, y)] |= F_HAZARD;
            }
        }
    }
    for (const p of lv.props) if (PROPS[p.type].solid) lv.solid[idx(lv, p.x, p.y)] = 1;
}

function nearDoor(lv, room, x, y, dist) {
    for (const id of room.doors) {
        const d = lv.doors[id];
        if (Math.abs(x + 0.5 - d.cx) < dist + d.w / 2 && Math.abs(y + 0.5 - d.cy) < dist + d.h / 2) return true;
    }
    return false;
}

/** Flood-fill a room's free tiles from its first door; true if all free tiles are reachable. */
function roomConnected(lv, room) {
    const free = (x, y) => x >= room.x && y >= room.y && x < room.x + room.w && y < room.y + room.h && lv.propAt[idx(lv, x, y)] < 0;
    let total = 0, sx = -1, sy = -1;
    for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
            if (!free(x, y)) continue;
            total++;
            if (sx < 0) { sx = x; sy = y; }
        }
    }
    if (total === 0) return false;
    const seen = new Uint8Array(room.w * room.h);
    const stack = [[sx, sy]];
    seen[(sy - room.y) * room.w + (sx - room.x)] = 1;
    let count = 0;
    while (stack.length) {
        const [x, y] = stack.pop();
        count++;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const xx = x + dx, yy = y + dy;
            if (!free(xx, yy)) continue;
            const k = (yy - room.y) * room.w + (xx - room.x);
            if (seen[k]) continue;
            seen[k] = 1;
            stack.push([xx, yy]);
        }
    }
    return count === total;
}

function tryProp(lv, room, type, x, y) {
    if (x < room.x || y < room.y || x >= room.x + room.w || y >= room.y + room.h) return false;
    const i = idx(lv, x, y);
    if (lv.propAt[i] >= 0) return false;
    if (nearDoor(lv, room, x, y, 2.5)) return false;
    const p = { id: lv.props.length, type, x, y, hp: PROPS[type].hp, rot: 0 };
    lv.props.push(p);
    lv.propAt[i] = p.id;
    if (!roomConnected(lv, room)) { lv.props.pop(); lv.propAt[i] = -1; return false; }
    return true;
}

/** Keep a clear disc in the middle of special rooms for their item. */
function centerClear(room, x, y, r) {
    return Math.hypot(x + 0.5 - room.cx, y + 0.5 - room.cy) < r;
}

function decorate(lv, rng, room, theme, density) {
    const types = theme.props;
    const area = room.w * room.h;
    const clearR = room.type === 'combat' || room.type === 'escape' ? 0 : 3.2;
    // Symmetric pillars in larger rooms: cover to fight around.
    if (area > 170 && rng.chance(0.6)) {
        const ox = Math.floor(room.w / 4), oy = Math.floor(room.h / 4);
        const ptype = types.includes('pipe') ? 'pipe' : types.includes('cocoon') ? 'cocoon' : 'pillar';
        for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            const x = sx ? room.x + room.w - 1 - ox : room.x + ox;
            const y = sy ? room.y + room.h - 1 - oy : room.y + oy;
            if (!centerClear(room, x, y, clearR)) tryProp(lv, room, ptype, x, y);
        }
    }
    const n = Math.round(area / 26 * density);
    let tries = 0, placed = 0;
    while (placed < n && tries++ < n * 8) {
        const type = rng.pick(types);
        const def = PROPS[type];
        let x, y;
        if (def.wall) {
            // Against a wall.
            const side = rng.int(0, 3);
            if (side === 0) { x = rng.int(room.x, room.x + room.w - 1); y = room.y; }
            else if (side === 1) { x = rng.int(room.x, room.x + room.w - 1); y = room.y + room.h - 1; }
            else if (side === 2) { x = room.x; y = rng.int(room.y, room.y + room.h - 1); }
            else { x = room.x + room.w - 1; y = rng.int(room.y, room.y + room.h - 1); }
        } else {
            x = rng.int(room.x + 1, room.x + room.w - 2);
            y = rng.int(room.y + 1, room.y + room.h - 2);
        }
        if (centerClear(room, x, y, clearR)) continue;
        if (!tryProp(lv, room, type, x, y)) continue;
        placed++;
        // Crates and sandbags come in little clusters.
        if ((type === 'crate' || type === 'sandbag' || type === 'barrel') && rng.chance(0.55)) {
            const dx = rng.int(-1, 1), dy = dx === 0 ? rng.pick([-1, 1]) : 0;
            if (!centerClear(room, x + dx, y + dy, clearR)) tryProp(lv, room, rng.chance(0.25) ? 'barrel' : type, x + dx, y + dy);
        }
    }
    for (const p of lv.props) if (p.rot === 0) p.rot = rng.int(0, 3);
}

function placeVents(lv, rng, room, n) {
    const ring = [];
    for (let x = room.x; x < room.x + room.w; x++) { ring.push([x, room.y]); ring.push([x, room.y + room.h - 1]); }
    for (let y = room.y + 1; y < room.y + room.h - 1; y++) { ring.push([room.x, y]); ring.push([room.x + room.w - 1, y]); }
    rng.shuffle(ring);
    const out = [];
    // Spread them out; relax the spacing if the walls are crowded.
    for (const spacing of [4, 2, 0]) {
        for (const [x, y] of ring) {
            if (out.length >= n) break;
            if (lv.propAt[idx(lv, x, y)] >= 0) continue;
            if (nearDoor(lv, room, x, y, spacing ? 2 : 1)) continue;
            if (out.some((v) => Math.abs(v.x - x - 0.5) + Math.abs(v.y - y - 0.5) < Math.max(1, spacing))) continue;
            out.push({ x: x + 0.5, y: y + 0.5 });
            lv.flags[idx(lv, x, y)] |= F_VENT;
        }
        if (out.length >= Math.min(n, 6)) break;
    }
    room.vents = out;
}

function lampsFor(lv, rng, room, theme) {
    const step = 6;
    const nx = Math.max(1, Math.round(room.w / step)), ny = Math.max(1, Math.round(room.h / step));
    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            const x = room.x + (i + 0.5) * room.w / nx, y = room.y + (j + 0.5) * room.h / ny;
            let flag = 0;
            if (room.type === 'combat' && rng.chance(0.12)) flag = 1;
            lv.lamps.push({ x, y, color: theme.lamp, power: room.type === 'boss' ? 1.25 : 1, r: 7.5, flag });
        }
    }
    if (room.type === 'combat' || room.type === 'boss') {
        // Emergency beacons in two corners: dark until the doors lock.
        lv.lamps.push({ x: room.x + 1, y: room.y + 1, color: theme.alarm, power: 0.9, r: 7, flag: 2, room: room.id });
        lv.lamps.push({ x: room.x + room.w - 1, y: room.y + room.h - 1, color: theme.alarm, power: 0.9, r: 7, flag: 2, room: room.id });
    }
}

function corridorLamps(lv, rng, theme) {
    const { w, h } = lv;
    for (let y = 2; y < h; y += 7) {
        for (let x = 2; x < w; x += 7) {
            // Find a corridor tile near this lattice point.
            let best = null;
            for (let dy = 0; dy < 7 && !best; dy++) {
                for (let dx = 0; dx < 7; dx++) {
                    const xx = x + dx, yy = y + dy;
                    if (!inb(lv, xx, yy)) continue;
                    if (lv.flags[idx(lv, xx, yy)] & F_CORRIDOR) { best = [xx, yy]; break; }
                }
            }
            if (!best) continue;
            const flag = rng.chance(0.3) ? 1 : 0;
            lv.lamps.push({ x: best[0] + 0.5, y: best[1] + 0.5, color: rng.chance(0.25) ? theme.strip : theme.lamp, power: 0.7, r: 6, flag });
        }
    }
}

function pickWeapon(rng, sector, avoid = []) {
    const ok = Object.keys(WEAPON_SECTOR).filter((k) => WEAPON_SECTOR[k] <= sector && !avoid.includes(k));
    return rng.pick(ok.length ? ok : Object.keys(WEAPON_SECTOR));
}

// ------------------------------------------------------------------ Sector

export function generateSector(seed, sector) {
    const theme = sectorTheme(sector);
    const rng = makeRng(seed);
    const GW = 5, GH = 4;
    const lv = makeLevel(GW * CELL + 2, GH * CELL + 2, theme, seed);
    lv.kind = 'sector';
    lv.sector = sector;
    const nRooms = sector === 0 ? 10 : sector < 3 ? 12 : 13;

    // Grow a tree of cells from a start cell on the bottom row.
    const cells = new Map(); // key → { cx, cy, parent, depth }
    const key = (x, y) => y * GW + x;
    const start = { cx: rng.int(0, GW - 1), cy: GH - 1, parent: -1, depth: 0 };
    cells.set(key(start.cx, start.cy), start);
    const edges = [];
    let guard = 0;
    while (cells.size < nRooms && guard++ < 4000) {
        const list = [...cells.values()];
        const from = rng.pick(list);
        const [dx, dy] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
        const nx = from.cx + dx, ny = from.cy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH || cells.has(key(nx, ny))) continue;
        const c = { cx: nx, cy: ny, parent: key(from.cx, from.cy), depth: from.depth + 1 };
        cells.set(key(nx, ny), c);
        edges.push([key(from.cx, from.cy), key(nx, ny)]);
    }
    // Depth by BFS over the tree; the boss goes in the deepest cell.
    let bossKey = key(start.cx, start.cy), bossDepth = -1;
    for (const [k, c] of cells) if (c.depth > bossDepth || (c.depth === bossDepth && rng.chance(0.5))) { bossDepth = c.depth; bossKey = k; }

    // Rooms.
    const roomOf = new Map();
    for (const [k, c] of cells) {
        const isBoss = k === bossKey, isStart = c === start;
        const w = isBoss ? 20 : isStart ? 12 : rng.int(11, 18);
        const h = isBoss ? 20 : isStart ? 11 : rng.int(10, 17);
        const x = 1 + c.cx * CELL + rng.int(3, CELL - 3 - w);
        const y = 1 + c.cy * CELL + rng.int(3, CELL - 3 - h);
        const room = addRoom(lv, x, y, w, h, isBoss ? 'boss' : isStart ? 'start' : 'combat', { depth: c.depth });
        roomOf.set(k, room);
    }
    // Tree links, then a couple of loops that avoid the boss.
    const linked = new Set();
    const doLink = (ka, kb) => {
        const ca = cells.get(ka), cb = cells.get(kb);
        let a = roomOf.get(ka), b = roomOf.get(kb), horizontal;
        if (ca.cy === cb.cy) { horizontal = true; if (ca.cx > cb.cx) [a, b] = [b, a]; }
        else { horizontal = false; if (ca.cy > cb.cy) [a, b] = [b, a]; }
        link(lv, rng, a, b, horizontal);
        linked.add(Math.min(ka, kb) + ':' + Math.max(ka, kb));
    };
    for (const [a, b] of edges) doLink(a, b);
    const loops = sector === 0 ? 1 : rng.int(1, 3);
    let made = 0;
    for (let t = 0; t < 60 && made < loops; t++) {
        const [ka, c] = rng.pick([...cells.entries()]);
        if (ka === bossKey) continue;
        const [dx, dy] = rng.pick([[1, 0], [0, 1]]);
        const kb = key(c.cx + dx, c.cy + dy);
        if (c.cx + dx >= GW || c.cy + dy >= GH || !cells.has(kb) || kb === bossKey) continue;
        if (linked.has(Math.min(ka, kb) + ':' + Math.max(ka, kb))) continue;
        doLink(ka, kb);
        made++;
    }

    // Room roles: leaves first for treasure, then shop, med bay, archive.
    const others = lv.rooms.filter((r) => r.type === 'combat');
    rng.shuffle(others);
    others.sort((a, b) => a.links.length - b.links.length);
    const roles = ['treasure', 'shop', 'med', 'archive'];
    if (nRooms >= 12) roles.push('treasure');
    for (let i = 0; i < roles.length && i < others.length; i++) others[i].type = roles[i];
    // Re-shuffle so the med bay is not always beside the treasure.
    const bossRoom = roomOf.get(bossKey);
    const startRoom = roomOf.get(key(start.cx, start.cy));

    // Decorate, vents, lamps, items.
    const logRooms = [];
    for (const room of lv.rooms) {
        const dens = room.type === 'combat' ? 1 : room.type === 'boss' ? 0.35 : room.type === 'start' ? 0.4 : 0.6;
        if (room.type !== 'boss') decorate(lv, rng, room, theme, dens);
        else {
            // The arena gets four pillars only.
            const ptype = theme.props.includes('pipe') ? 'pipe' : 'pillar';
            for (const [fx, fy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
                tryProp(lv, room, ptype, Math.floor(room.x + room.w * fx), Math.floor(room.y + room.h * fy));
            }
        }
        if (room.type === 'combat' || room.type === 'boss') placeVents(lv, rng, room, room.type === 'boss' ? 12 : 8);
        lampsFor(lv, rng, room, theme);
        if (room.type === 'combat') logRooms.push(room);
    }
    corridorLamps(lv, rng, theme);

    const used = [];
    for (const room of lv.rooms) {
        const cx = room.cx, cy = room.cy;
        if (room.type === 'start') {
            lv.start = { x: cx, y: cy };
            lv.items.push({ kind: 'pad', x: cx, y: cy });
            carveFlag(lv, room, F_PAD, 2.5);
        } else if (room.type === 'treasure') {
            const wpn = pickWeapon(rng, sector, used);
            used.push(wpn);
            lv.items.push({ kind: 'chest', x: cx, y: cy, weapon: wpn });
        } else if (room.type === 'shop') {
            lv.items.push({ kind: 'shopterm', x: cx, y: room.y + 1.5 });
            const stock = [rng.pick(['medkit', 'medkit', 'armor']), rng.pick(['ammo', 'grenade', 'pulse']), rng.pick(['mod', 'armor', 'stim']), 'weapon'];
            stock.forEach((s, i) => {
                const x = cx + (i - 1.5) * 2.4, y = cy + 0.5;
                if (s === 'weapon') {
                    const wpn = pickWeapon(rng, Math.min(4, sector + 1), used);
                    used.push(wpn);
                    lv.items.push({ kind: 'shopitem', x, y, item: 'weapon', weapon: wpn, price: 0 });
                } else lv.items.push({ kind: 'shopitem', x, y, item: s, price: SHOP[s].price });
            });
        } else if (room.type === 'med') {
            lv.items.push({ kind: 'med', x: cx, y: cy });
        } else if (room.type === 'archive') {
            lv.items.push({ kind: 'terminal', x: cx, y: cy, log: 0 });
        } else if (room.type === 'boss') {
            carveFlag(lv, room, F_ARENA, 7);
        }
    }
    // Two more logs in combat rooms, against a wall.
    rng.shuffle(logRooms);
    for (let i = 0; i < 2 && i < logRooms.length; i++) {
        const r = logRooms[i];
        lv.items.push({ kind: 'terminal', x: r.x + 1.5 + rng.int(0, r.w - 3), y: r.y + 0.9, log: i + 1, wall: true });
    }
    lv.items.forEach((it, i) => { it.id = i; it.used = false; });
    lv.bossRoom = bossRoom.id;
    lv.startRoom = startRoom.id;
    finalize(lv);
    return lv;
}

function carveFlag(lv, room, flag, r) {
    for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
            if (Math.hypot(x + 0.5 - room.cx, y + 0.5 - room.cy) < r) lv.flags[idx(lv, x, y)] |= flag;
        }
    }
}

// ------------------------------------------------------------------ Escape

export function generateEscape(seed) {
    const theme = sectorTheme('escape');
    const rng = makeRng(seed);
    const GW = 6, GH = 2;
    const lv = makeLevel(GW * CELL + 2, GH * CELL + 2, theme, seed);
    lv.kind = 'escape';
    lv.sector = 'escape';
    // A hairpin: along the top row, down, and back along the bottom row.
    const path = [];
    for (let cx = 0; cx < GW; cx++) path.push([cx, 0]);
    const back = rng.int(1, 2);
    for (let cx = GW - 1; cx >= back; cx--) path.push([cx, 1]);
    const rooms = path.map(([gx, gy], i) => {
        const first = i === 0, last = i === path.length - 1;
        const w = first ? 18 : last ? 18 : rng.int(12, 18);
        const h = first ? 18 : last ? 16 : rng.int(10, 16);
        const x = 1 + gx * CELL + rng.int(3, CELL - 3 - w);
        const y = 1 + gy * CELL + rng.int(3, CELL - 3 - h);
        return addRoom(lv, x, y, w, h, first ? 'nest' : last ? 'pad' : 'escape', { depth: i, gx, gy });
    });
    for (let i = 1; i < rooms.length; i++) {
        const a = rooms[i - 1], b = rooms[i];
        if (a.gy === b.gy) { if (a.gx < b.gx) link(lv, rng, a, b, true); else link(lv, rng, b, a, true); }
        else if (a.gy < b.gy) link(lv, rng, a, b, false);
        else link(lv, rng, b, a, false);
    }
    // Three jammed bulkheads to hold out in, spread along the route.
    const mids = rooms.filter((r) => r.type === 'escape' && r.depth >= 2 && r.depth <= rooms.length - 2);
    const picks = [mids[Math.floor(mids.length * 0.15)], mids[Math.floor(mids.length * 0.5)], mids[Math.floor(mids.length * 0.85)]];
    for (const r of picks) if (r) r.type = 'holdout';
    for (const room of rooms) {
        if (room.type === 'escape' || room.type === 'holdout') decorate(lv, rng, room, theme, room.type === 'holdout' ? 0.5 : 0.7);
        placeVents(lv, rng, room, 8);
        lampsFor(lv, rng, room, theme);
        if (room.type !== 'pad') {
            lv.lamps.push({ x: room.x + 1, y: room.y + 1, color: theme.alarm, power: 1, r: 8, flag: 3 });
            lv.lamps.push({ x: room.x + room.w - 1, y: room.y + room.h - 1, color: theme.alarm, power: 1, r: 8, flag: 3 });
        }
    }
    corridorLamps(lv, rng, theme);
    const nest = rooms[0], pad = rooms[rooms.length - 1];
    lv.start = { x: nest.cx, y: nest.cy };
    carveFlag(lv, nest, F_ARENA, 7);
    carveFlag(lv, pad, F_PAD, 4);
    lv.items.push({ kind: 'dropship', x: pad.cx, y: pad.cy });
    lv.items.forEach((it, i) => { it.id = i; it.used = false; });
    lv.padRoom = pad.id;
    lv.startRoom = nest.id;
    finalize(lv);
    return lv;
}

// ------------------------------------------------------------------ Horde arena

export function generateHorde(seed) {
    const theme = sectorTheme('horde');
    const rng = makeRng(seed);
    const lv = makeLevel(40, 34, theme, seed);
    lv.kind = 'horde';
    lv.sector = 'horde';
    const room = addRoom(lv, 3, 3, 34, 28, 'horde');
    // Cover: four pillar clusters and a few crate walls, mirrored.
    const half = [[9, 9], [10, 9], [9, 10]];
    for (const [x, y] of half) {
        for (const [mx, my] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            const px = mx ? room.x + room.w - 1 - (x - room.x) : x;
            const py = my ? room.y + room.h - 1 - (y - room.y) : y;
            tryProp(lv, room, 'pillar', px, py);
        }
    }
    for (let i = 0; i < 10; i++) {
        const x = rng.int(room.x + 3, room.x + room.w - 4), y = rng.int(room.y + 3, room.y + room.h - 4);
        if (Math.hypot(x - room.cx, y - room.cy) < 5) continue;
        tryProp(lv, room, rng.pick(['crate', 'crate', 'barrel', 'sandbag']), x, y);
    }
    placeVents(lv, rng, room, 16);
    lampsFor(lv, rng, room, theme);
    for (const l of lv.lamps) if (l.flag === 2) l.flag = 3;
    lv.start = { x: room.cx, y: room.cy };
    carveFlag(lv, room, F_ARENA, 6);
    lv.items.forEach((it, i) => { it.id = i; it.used = false; });
    lv.startRoom = room.id;
    finalize(lv);
    return lv;
}

export function tileIndex(lv, x, y) { return Math.floor(y) * lv.w + Math.floor(x); }
export function isSolid(lv, x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= lv.w || ty >= lv.h) return true;
    return lv.solid[ty * lv.w + tx] === 1;
}
export function roomAtPos(lv, x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= lv.w || ty >= lv.h) return -1;
    return lv.roomAt[ty * lv.w + tx];
}
export { pickWeapon };
