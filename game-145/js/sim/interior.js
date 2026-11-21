// Building interiors, generated per building from the building's own seed. Pure.
//
// A building owns w x d tiles and stacks `floors` levels on them. Each level is a set of typed arrays:
//   floor  material per tile (0 = no floor: an atrium or the hole above a stair run)
//   flags  F.* bits: solid furniture, stair runs, holes, mould, puddles, lamps, trees...
//   stair  0, or 1 + dir * 16 + index along the run
//   eN/eW  the edge on the north / west side of each tile: E.* (wall, door, window, broken, railing, glass)
//   locks  edge key → lock id, for locked doors
//   room   which room a tile belongs to (rooms[] says its wall, floor and ceiling finish)
//   props  furniture and dressing { k, x, z (metres, local), r, s }
// Stairs are switchback stairwells, 2 tiles wide and S + 2 long; level L's run climbs into the void of level L + 1.
// After the layout, every level is flood-filled from the entrances; any pocket nobody can reach gets a broken wall
// knocked through to it, so no room is ever sealed (and the city gains a few more holes in its walls).

import { TILE } from '../config.js';
import { makeRng } from '../rng.js';
import { DIRS } from './city.js';

export const E = { NONE: 0, WALL: 1, DOOR: 2, WINDOW: 3, BROKEN: 4, RAIL: 5, GLASS: 6 };
export const F = {
    SOLID: 1, STAIR: 2, VOIDSTAIR: 4, HOLE: 8, SINK: 16, PUDDLE: 32, RUBBLE: 64, LAMP: 128, MOLD: 256,
    TREE: 512, VOID: 1024, NOCEIL: 2048, LEAVES: 4096, DEBRIS: 8192, KEEP: 16384,
};
export const WALLS = ['yellow', 'floral', 'plaster', 'concrete', 'tile', 'lab', 'brick', 'rust'];
export const FLOORS = ['none', 'carpet', 'wood', 'tile', 'terrazzo', 'concrete', 'lino'];
export const CEILS = ['tiles', 'plaster', 'concrete', 'open'];
const W_ = Object.fromEntries(WALLS.map((n, i) => [n, i]));
const FL = Object.fromEntries(FLOORS.map((n, i) => [n, i]));
const CE = Object.fromEntries(CEILS.map((n, i) => [n, i]));

/** Finishes by building type: [walls], [floors], ceiling. */
const THEME = {
    house: { walls: ['floral', 'floral', 'plaster'], floors: ['wood', 'carpet', 'wood'], ceil: 'plaster' },
    apartment: { walls: ['plaster', 'floral', 'plaster'], floors: ['carpet', 'wood', 'lino'], ceil: 'plaster' },
    office: { walls: ['yellow', 'yellow', 'plaster'], floors: ['carpet'], ceil: 'tiles' },
    hotel: { walls: ['yellow', 'floral'], floors: ['carpet'], ceil: 'plaster' },
    mall: { walls: ['plaster', 'tile', 'yellow'], floors: ['terrazzo'], ceil: 'tiles' },
    hospital: { walls: ['tile', 'plaster'], floors: ['tile', 'lino'], ceil: 'tiles' },
    school: { walls: ['plaster', 'brick'], floors: ['lino'], ceil: 'tiles' },
    library: { walls: ['plaster', 'brick'], floors: ['carpet', 'wood'], ceil: 'plaster' },
    shop: { walls: ['plaster', 'tile', 'yellow'], floors: ['lino', 'tile'], ceil: 'tiles' },
    factory: { walls: ['brick', 'concrete', 'rust'], floors: ['concrete'], ceil: 'open' },
    warehouse: { walls: ['concrete', 'rust'], floors: ['concrete'], ceil: 'open' },
    garage: { walls: ['concrete'], floors: ['concrete'], ceil: 'concrete' },
    lab: { walls: ['lab'], floors: ['tile', 'lino'], ceil: 'tiles' },
    hall: { walls: ['lab', 'concrete'], floors: ['concrete'], ceil: 'open' },
};

// ------------------------------------------------------------------ level storage and edge access

function newLevel(w, d) {
    return {
        floor: new Uint8Array(w * d), flags: new Uint16Array(w * d), stair: new Uint8Array(w * d),
        room: new Int16Array(w * d).fill(-1), eN: new Uint8Array((w + 1) * (d + 1)), eW: new Uint8Array((w + 1) * (d + 1)),
        locks: new Map(), rooms: [], props: [],
    };
}

/** The array and index that hold edge `dir` of local tile (x, z). */
export function edgeRef(w, x, z, dir) {
    if (dir === 0) return ['eN', z * (w + 1) + x];
    if (dir === 2) return ['eN', (z + 1) * (w + 1) + x];
    if (dir === 3) return ['eW', z * (w + 1) + x];
    return ['eW', z * (w + 1) + x + 1];
}
export function getEdge(I, lv, x, z, dir) { const [a, i] = edgeRef(I.w, x, z, dir); return lv[a][i]; }
export function setEdge(I, lv, x, z, dir, v) { const [a, i] = edgeRef(I.w, x, z, dir); lv[a][i] = v; }
export function lockKey(I, x, z, dir) { const [a, i] = edgeRef(I.w, x, z, dir); return a + i; }
export function edgeLock(I, lv, x, z, dir) { return lv.locks.get(lockKey(I, x, z, dir)) ?? null; }

const inB = (I, x, z) => x >= 0 && z >= 0 && x < I.w && z < I.d;
const idx = (I, x, z) => z * I.w + x;

/** Can a walker cross this edge (ignoring locks)? */
export function edgeOpen(e) { return e === E.NONE || e === E.DOOR || e === E.BROKEN; }

// ------------------------------------------------------------------ public

/** The interior of building b (generated once and cached on the city). */
export function interiorOf(C, b) {
    let I = C.interiors.get(b.id);
    if (!I) { I = makeInterior(C, b); C.interiors.set(b.id, I); }
    return I;
}

export function makeInterior(C, b) {
    const rng = makeRng(b.seed);
    const H = b.h;
    const S = Math.max(2, Math.ceil(H / 1.25));
    const I = {
        b, w: b.w, d: b.d, H, S, x0: b.x0 * TILE, z0: b.z0 * TILE, floors: b.floors, levels: [], things: [],
        stair: null, power: b.type === 'hall' ? false : rng.chance(b.type === 'mall' ? 0.7 : b.type === 'hospital' ? 0.55 : 0.28),
        theme: THEME[b.type] ?? THEME.office, backrooms: [],
    };
    for (let L = 0; L < b.floors; L++) I.levels.push(newLevel(I.w, I.d));
    for (let L = 0; L < b.floors; L++) shell(I, L, rng);
    if (b.floors > 1) placeStairs(I, rng);
    for (let L = 0; L < b.floors; L++) LAYOUT[b.type](I, L, rng);
    entrances(I, rng);
    for (let L = 0; L < b.floors; L++) { furnish(I, L, rng); lamps(I, L, rng); }
    decay(I, rng);
    repair(I);
    holes(I, rng);
    things(C, I, rng);
    return I;
}

// ------------------------------------------------------------------ shell: floors, the outer wall, windows

function shell(I, L, rng) {
    const lv = I.levels[L], t = I.theme, type = I.b.type;
    lv.rooms.push(room(I, rng, null));                              // room 0: the default finish
    lv.floor.fill(FL[t.floors[0]]);
    lv.room.fill(0);
    const win = (along) => {
        if (type === 'garage') return along % 3 !== 0 ? E.WINDOW : E.WALL;   // open sides between pillars
        if (type === 'factory' || type === 'warehouse' || type === 'hall') return L === I.floors - 1 && along % 2 === 1 ? E.WINDOW : E.WALL;
        if (type === 'house') return along % 2 === 1 && rng.chance(0.8) ? E.WINDOW : E.WALL;
        if (type === 'mall') return E.WALL;
        return along % 2 === 0 || type === 'office' || type === 'hotel' ? E.WINDOW : E.WALL;
    };
    for (let x = 0; x < I.w; x++) {
        setEdge(I, lv, x, 0, 0, x === 0 || x === I.w - 1 ? E.WALL : win(x));
        setEdge(I, lv, x, I.d - 1, 2, x === 0 || x === I.w - 1 ? E.WALL : win(x));
    }
    for (let z = 0; z < I.d; z++) {
        setEdge(I, lv, 0, z, 3, z === 0 || z === I.d - 1 ? E.WALL : win(z));
        setEdge(I, lv, I.w - 1, z, 1, z === 0 || z === I.d - 1 ? E.WALL : win(z));
    }
}

function room(I, rng, kind, over = {}) {
    const t = I.theme;
    return {
        kind, wall: W_[over.wall ?? rng.pick(t.walls)], floor: FL[over.floor ?? rng.pick(t.floors)],
        ceil: CE[over.ceil ?? t.ceil], lit: false,
    };
}

function newRoom(I, lv, rng, kind, over) { lv.rooms.push(room(I, rng, kind, over)); return lv.rooms.length - 1; }
function paintRoom(I, lv, r, x0, z0, w, d) {
    for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) {
        if (!inB(I, x, z)) continue;
        const i = idx(I, x, z);
        if (lv.room[i] === -2) continue;
        lv.room[i] = r;
        lv.floor[i] = lv.rooms[r].floor;
    }
}

// ------------------------------------------------------------------ stairs

function stairMap(st, u, v) {
    // u: column 0/1 across the stairwell, v: row 0..S+1 along it
    return st.axis === 'z' ? [st.x + u, st.z + v] : [st.x + v, st.z + u];
}
function stairDir(st, up) { return st.axis === 'z' ? (up ? 2 : 0) : (up ? 1 : 3); }
function sideDir(st, toward1) { return st.axis === 'z' ? (toward1 ? 1 : 3) : (toward1 ? 2 : 0); }

function placeStairs(I, rng) {
    const S = I.S, len = S + 2, type = I.b.type;
    const axis = I.d >= I.w ? 'z' : 'x';
    const long = axis === 'z' ? I.d : I.w, short = axis === 'z' ? I.w : I.d;
    if (long < len) throw new Error(`building ${I.b.id} too small for stairs`);
    let u0, v0;
    if (type === 'mall') { u0 = 3; v0 = Math.floor((long - len) / 2); }     // in the west walkway
    else if (type === 'hotel' || type === 'apartment' || type === 'hospital' || type === 'lab' || type === 'school') {
        u0 = Math.floor(short / 2) - 1; v0 = rng.chance(0.5) ? 0 : long - len;   // at one end of the corridor
    } else if (type === 'house' || type === 'shop') {
        u0 = rng.chance(0.5) ? 0 : short - 2; v0 = rng.int(0, long - len);
    } else {
        u0 = rng.chance(0.5) ? 1 : short - 3; v0 = rng.int(1, Math.max(1, long - len - 1));
    }
    const st = axis === 'z' ? { axis, x: u0, z: v0 } : { axis, x: v0, z: u0 };
    st.len = len;
    I.stair = st;
    for (let L = 0; L < I.floors; L++) {
        const lv = I.levels[L];
        // reserve the footprint and wall it in
        for (let v = 0; v < len; v++) for (let u = 0; u < 2; u++) {
            const [x, z] = stairMap(st, u, v);
            const i = idx(I, x, z);
            lv.room[i] = -2;
            lv.flags[i] |= F.KEEP;
        }
        const r = newRoom(I, lv, rng, 'stairs', { wall: I.b.type === 'house' ? 'floral' : 'concrete', floor: I.b.type === 'house' ? 'wood' : 'concrete', ceil: I.b.type === 'house' ? 'plaster' : 'concrete' });
        for (let v = 0; v < len; v++) for (let u = 0; u < 2; u++) { const [x, z] = stairMap(st, u, v); lv.room[idx(I, x, z)] = -2; lv.floor[idx(I, x, z)] = lv.rooms[r].floor; }
        lv.stairRoom = r;
        for (let v = 0; v < len; v++) {
            for (const u of [0, 1]) {
                const [x, z] = stairMap(st, u, v);
                const out = sideDir(st, u === 1);
                if (getEdge(I, lv, x, z, out) === E.NONE) setEdge(I, lv, x, z, out, E.WALL);
            }
        }
        for (const v of [0, len - 1]) for (const u of [0, 1]) {
            const [x, z] = stairMap(st, u, v);
            const out = stairDir(st, v !== 0);
            if (getEdge(I, lv, x, z, out) === E.NONE) setEdge(I, lv, x, z, out, E.WALL);
        }
        // landing doors: on the end of each landing row if that faces inside, else on a side
        for (const v of [0, len - 1]) {
            const opts = [];
            for (const u of [0, 1]) {
                const [x, z] = stairMap(st, u, v);
                const endDir = stairDir(st, v !== 0);
                const [ex, ez] = [x + DIRS[endDir][0], z + DIRS[endDir][1]];
                if (inB(I, ex, ez)) opts.push([x, z, endDir]);
                const sd = sideDir(st, u === 1);
                const [sx, sz] = [x + DIRS[sd][0], z + DIRS[sd][1]];
                if (inB(I, sx, sz)) opts.push([x, z, sd]);
            }
            if (!opts.length) continue;
            const pick = opts.find((o) => o[2] === stairDir(st, v !== 0)) ?? opts[0];
            setEdge(I, lv, pick[0], pick[1], pick[2], E.DOOR);
            lv.stairDoors ??= [];
            lv.stairDoors.push(pick);
        }
        // the railing between the two columns along the runs
        for (let v = 1; v <= S; v++) { const [x, z] = stairMap(st, 0, v); setEdge(I, lv, x, z, sideDir(st, true), E.RAIL); }
        // this level's run, going up
        if (L < I.floors - 1) {
            const even = L % 2 === 0, u = even ? 0 : 1;
            for (let k = 0; k < S; k++) {
                const v = even ? 1 + k : S - k;
                const [x, z] = stairMap(st, u, v);
                const i = idx(I, x, z);
                lv.flags[i] |= F.STAIR;
                lv.stair[i] = 1 + stairDir(st, even) * 16 + k;
            }
        }
        // the void above the run below
        if (L > 0) {
            const evenBelow = (L - 1) % 2 === 0, u = evenBelow ? 0 : 1;
            for (let v = 1; v <= S; v++) {
                const [x, z] = stairMap(st, u, v);
                const i = idx(I, x, z);
                lv.flags[i] |= F.VOIDSTAIR;
                lv.floor[i] = 0;
                // rails round the void, except the edge the run below arrives through
                const arrive = evenBelow ? v === S : v === 1;
                const endDir = stairDir(st, evenBelow);
                if (!arrive || true) {
                    if (v === 1 && !(arrive && !evenBelow)) setEdge(I, lv, x, z, stairDir(st, false), E.RAIL);
                    if (v === S && !(arrive && evenBelow)) setEdge(I, lv, x, z, stairDir(st, true), E.RAIL);
                }
                void endDir;
            }
        }
    }
}

// ------------------------------------------------------------------ layouts

/** Put a wall along a line of edges, skipping reserved tiles; returns the edges it set. */
function wallRun(I, lv, x, z, dir, along, n, type = E.WALL) {
    const set = [];
    for (let k = 0; k < n; k++) {
        const tx = x + (along === 'x' ? k : 0), tz = z + (along === 'z' ? k : 0);
        if (!inB(I, tx, tz)) continue;
        const nx = tx + DIRS[dir][0], nz = tz + DIRS[dir][1];
        if (!inB(I, nx, nz)) continue;
        if (lv.room[idx(I, tx, tz)] === -2 || lv.room[idx(I, nx, nz)] === -2) continue;
        if (lv.flags[idx(I, tx, tz)] & F.VOID || lv.flags[idx(I, nx, nz)] & F.VOID) continue;
        setEdge(I, lv, tx, tz, dir, type);
        set.push([tx, tz, dir]);
    }
    return set;
}

function doorIn(I, lv, rng, edges, n = 1) {
    const free = edges.filter(([x, z, dir]) => getEdge(I, lv, x, z, dir) === E.WALL);
    rng.shuffle(free);
    for (let k = 0; k < Math.min(n, free.length); k++) setEdge(I, lv, free[k][0], free[k][1], free[k][2], E.DOOR);
}

/** Binary space partition into rooms joined by doors: houses, offices, the back corridors. */
function bsp(I, lv, rng, x0, z0, w, d, opt, depth = 0) {
    const big = w > opt.max || d > opt.max;
    if (!big && (w < opt.min * 2 || d < opt.min * 2 || rng.chance(opt.stop ?? 0.25)) || depth > 9) {
        const r = newRoom(I, lv, rng, opt.kind ?? 'room', opt.finish?.(rng));
        paintRoom(I, lv, r, x0, z0, w, d);
        opt.leaf?.(r, x0, z0, w, d);
        return;
    }
    const splitX = w > d ? true : d > w ? false : rng.chance(0.5);
    if (splitX && w >= opt.min * 2) {
        const p = rng.int(opt.min, w - opt.min);
        const edges = wallRun(I, lv, x0 + p, z0, 3, 'z', d);
        doorIn(I, lv, rng, edges, opt.doors ?? 1);
        bsp(I, lv, rng, x0, z0, p, d, opt, depth + 1);
        bsp(I, lv, rng, x0 + p, z0, w - p, d, opt, depth + 1);
    } else if (d >= opt.min * 2) {
        const p = rng.int(opt.min, d - opt.min);
        const edges = wallRun(I, lv, x0, z0 + p, 0, 'x', w);
        doorIn(I, lv, rng, edges, opt.doors ?? 1);
        bsp(I, lv, rng, x0, z0, w, p, opt, depth + 1);
        bsp(I, lv, rng, x0, z0 + p, w, d - p, opt, depth + 1);
    } else {
        const r = newRoom(I, lv, rng, opt.kind ?? 'room', opt.finish?.(rng));
        paintRoom(I, lv, r, x0, z0, w, d);
        opt.leaf?.(r, x0, z0, w, d);
    }
}

/** The backrooms: yellow wallpaper, damp carpet, buzzing panels and wall segments that never quite make rooms. */
function backrooms(I, lv, rng, x0, z0, w, d) {
    const r = newRoom(I, lv, rng, 'backrooms', { wall: 'yellow', floor: 'carpet', ceil: 'tiles' });
    paintRoom(I, lv, r, x0, z0, w, d);
    lv.rooms[r].backrooms = true;
    const runs = Math.floor(w * d / 7);
    for (let k = 0; k < runs; k++) {
        const along = rng.chance(0.5) ? 'x' : 'z';
        const n = rng.int(2, 5);
        const x = x0 + rng.int(0, w - 1), z = z0 + rng.int(1, d - 1);
        if (along === 'x') wallRun(I, lv, x, z, 0, 'x', Math.min(n, x0 + w - x));
        else wallRun(I, lv, x0 + rng.int(1, w - 1), z0 + rng.int(0, d - 1), 3, 'z', Math.min(n, d));
    }
    // a few square pillars in the open
    for (let k = 0; k < Math.floor(w * d / 40); k++) {
        const x = x0 + rng.int(1, w - 2), z = z0 + rng.int(1, d - 2);
        const i = idx(I, x, z);
        if (lv.flags[i] & (F.KEEP | F.STAIR | F.VOIDSTAIR)) continue;
        lv.flags[i] |= F.SOLID;
        lv.props.push({ k: 'pillar', x: (x + 0.5) * TILE, z: (z + 0.5) * TILE, r: 0, tiles: [i] });
    }
    I.backrooms.push(lv);
}

/** A corridor down the long axis, rooms either side, a door from each room onto the corridor. */
function corridor(I, lv, rng, opt) {
    const axis = I.d >= I.w ? 'z' : 'x';
    const long = axis === 'z' ? I.d : I.w, short = axis === 'z' ? I.w : I.d;
    const cw = opt.cw ?? (short >= 12 ? 2 : 1);
    const c0 = Math.floor((short - cw) / 2);
    const map = (u, v) => (axis === 'z' ? [u, v] : [v, u]);
    const cr = newRoom(I, lv, rng, 'corridor', opt.corr);
    for (let v = 0; v < long; v++) for (let u = c0; u < c0 + cw; u++) {
        const [x, z] = map(u, v); paintRoom(I, lv, cr, x, z, 1, 1);
    }
    // walls along both sides of the corridor
    const side = (u, toward) => (axis === 'z' ? (toward ? 1 : 3) : (toward ? 2 : 0));
    for (let v = 0; v < long; v++) {
        const [ax, az] = map(c0, v), [bx, bz] = map(c0 + cw - 1, v);
        wallRun(I, lv, ax, az, side(c0, false), 'x', 1);
        wallRun(I, lv, bx, bz, side(c0 + cw - 1, true), 'x', 1);
    }
    // rooms: split each side every `rl` tiles
    for (const [ua, ub] of [[0, c0], [c0 + cw, short]]) {
        if (ub - ua < 1) continue;
        let v = 0;
        while (v < long) {
            const rl = Math.min(long - v, rng.int(opt.rl[0], opt.rl[1]));
            const r = newRoom(I, lv, rng, opt.kind ?? 'room', opt.finish?.(rng));
            for (let vv = v; vv < v + rl; vv++) for (let u = ua; u < ub; u++) { const [x, z] = map(u, vv); paintRoom(I, lv, r, x, z, 1, 1); }
            if (v + rl < long) {
                const across = axis === 'z' ? 'x' : 'z';
                const [x, z] = map(ua, v + rl);
                wallRun(I, lv, x, z, axis === 'z' ? 0 : 3, across, ub - ua);
            }
            // the door onto the corridor
            const dv = v + rng.int(0, rl - 1);
            const du = ua === 0 ? c0 - 1 : c0 + cw;
            const [dx, dz] = map(du, dv);
            const dd = ua === 0 ? side(0, true) : side(0, false);
            if (inB(I, dx, dz) && getEdge(I, lv, dx, dz, dd) === E.WALL) setEdge(I, lv, dx, dz, dd, E.DOOR);
            opt.leaf?.(r, ua, ub, v, rl, map);
            v += rl;
        }
    }
    return { axis, c0, cw, map };
}

/** Pillars on a grid, keeping clear of reserved tiles. */
function pillars(I, lv, rng, step, off = 2) {
    for (let z = off; z < I.d - 1; z += step) for (let x = off; x < I.w - 1; x += step) {
        const i = idx(I, x, z);
        if (lv.flags[i] & (F.KEEP | F.VOID | F.STAIR | F.VOIDSTAIR) || lv.room[i] === -2) continue;
        lv.flags[i] |= F.SOLID;
        lv.props.push({ k: 'column', x: (x + 0.5) * TILE, z: (z + 0.5) * TILE, r: 0, tiles: [i] });
    }
}

function solidBlock(I, lv, k, x, z, w, d, extra = {}) {
    const tiles = [];
    for (let zz = z; zz < z + d; zz++) for (let xx = x; xx < x + w; xx++) {
        if (!inB(I, xx, zz)) return false;
        const i = idx(I, xx, zz);
        if (lv.flags[i] & (F.SOLID | F.KEEP | F.STAIR | F.VOIDSTAIR | F.VOID) || lv.room[i] === -2) return false;
        tiles.push(i);
    }
    for (const i of tiles) lv.flags[i] |= F.SOLID;
    lv.props.push({ k, x: (x + w / 2) * TILE, z: (z + d / 2) * TILE, r: w >= d ? 0 : Math.PI / 2, w: w * TILE, d: d * TILE, tiles, ...extra });
    return true;
}

/** Open the middle of the floor above the ground: an atrium or a mezzanine. */
function voidRect(I, lv, x0, z0, w, d) {
    for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) {
        if (!inB(I, x, z)) continue;
        const i = idx(I, x, z);
        if (lv.room[i] === -2) continue;
        // keep a walkway round the stairwell, or its landing doors open onto thin air
        let nearStairs = false;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (inB(I, x + dx, z + dz) && lv.room[idx(I, x + dx, z + dz)] === -2) nearStairs = true;
        if (nearStairs) continue;
        lv.flags[i] |= F.VOID;
        lv.floor[i] = 0;
    }
    for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) {
        if (!inB(I, x, z) || !(lv.flags[idx(I, x, z)] & F.VOID)) continue;
        for (let dir = 0; dir < 4; dir++) {
            const nx = x + DIRS[dir][0], nz = z + DIRS[dir][1];
            if (inB(I, nx, nz) && !(lv.flags[idx(I, nx, nz)] & (F.VOID | F.VOIDSTAIR))) setEdge(I, lv, x, z, dir, E.RAIL);
        }
    }
}

const LAYOUT = {
    house(I, L, rng) {
        const lv = I.levels[L];
        bsp(I, lv, rng, 0, 0, I.w, I.d, {
            min: 2, max: 4, stop: 0.3, kind: L === 0 ? 'living' : 'bedroom',
            finish: (r) => (L === 0 && r.chance(0.35) ? { floor: 'lino', wall: 'plaster' } : {}),
        });
        if (L === 0 && lv.rooms.length > 2) lv.rooms[2].kind = 'kitchen';
        if (lv.rooms.length > 3 && L > 0) lv.rooms[lv.rooms.length - 1].kind = 'bath';
    },
    apartment(I, L, rng) {
        const lv = I.levels[L];
        corridor(I, lv, rng, { rl: [3, 4], kind: 'flat', corr: { floor: 'carpet', wall: 'plaster', ceil: 'tiles' } });
        if (L > 0 && rng.chance(0.25)) {   // a gutted flat
            const r = lv.rooms[rng.int(2, lv.rooms.length - 1)]; if (r) r.gutted = true;
        }
    },
    hotel(I, L, rng) {
        const lv = I.levels[L];
        if (L === 0) {
            // the lobby: one big room with the front desk
            const r = newRoom(I, lv, rng, 'lobby', { wall: 'floral', floor: 'carpet', ceil: 'plaster' });
            paintRoom(I, lv, r, 0, 0, I.w, I.d);
            bsp(I, lv, rng, 0, Math.floor(I.d * 0.6), I.w, I.d - Math.floor(I.d * 0.6), { min: 2, max: 4, kind: 'office' });
            wallRun(I, lv, 0, Math.floor(I.d * 0.6), 0, 'x', I.w);
            doorIn(I, lv, rng, wallRun(I, lv, 0, Math.floor(I.d * 0.6), 0, 'x', I.w), 2);
            pillars(I, lv, rng, 4, 2);
            return;
        }
        corridor(I, lv, rng, { rl: [2, 3], kind: 'hotelroom', corr: { wall: 'yellow', floor: 'carpet', ceil: 'tiles' } });
        if (L === I.floors - 1 || rng.chance(0.3)) { lv.backroomsFlavour = true; }
    },
    office(I, L, rng) {
        const lv = I.levels[L];
        if (L === 0) {
            bsp(I, lv, rng, 0, 0, I.w, I.d, { min: 3, max: 7, stop: 0.2, kind: 'lobby', finish: () => ({ floor: 'terrazzo', wall: 'plaster' }) });
            return;
        }
        if (rng.chance(0.45)) { backrooms(I, lv, rng, 0, 0, I.w, I.d); return; }
        // open plan with a ring of offices along the outer wall
        bsp(I, lv, rng, 0, 0, I.w, 3, { min: 2, max: 4, kind: 'office' });
        doorIn(I, lv, rng, wallRun(I, lv, 0, 3, 0, 'x', I.w), 2);
        const r = newRoom(I, lv, rng, 'openplan', { wall: 'yellow', floor: 'carpet' });
        paintRoom(I, lv, r, 0, 3, I.w, I.d - 3);
        lv.cubicles = true;
    },
    mall(I, L, rng) {
        const lv = I.levels[L];
        const ax = 5, az = 5, aw = I.w - 10, ad = I.d - 10;          // the atrium
        const walk = newRoom(I, lv, rng, 'walkway', { floor: 'terrazzo', wall: 'plaster', ceil: 'tiles' });
        paintRoom(I, lv, walk, 3, 3, I.w - 6, I.d - 6);
        if (L > 0) voidRect(I, lv, ax, az, aw, ad);
        else {
            const atr = newRoom(I, lv, rng, 'atrium', { floor: 'terrazzo', wall: 'plaster', ceil: 'open' });
            paintRoom(I, lv, atr, ax, az, aw, ad);
            lv.atrium = { x: ax, z: az, w: aw, d: ad };
        }
        lv.atriumRect = { x: ax, z: az, w: aw, d: ad };
        // shop units in the 3-tile ring between the walkway and the outer wall, glass fronts onto the walkway
        const unit = (x, z, w, d, front) => {
            const r = newRoom(I, lv, rng, 'store', rng.chance(0.3) ? { wall: 'yellow', floor: 'carpet' } : {});
            paintRoom(I, lv, r, x, z, w, d);
            const edges = [];
            for (let k = 0; k < (front % 2 === 0 ? w : d); k++) {
                const tx = front % 2 === 0 ? x + k : front === 1 ? x + w - 1 : x;
                const tz = front % 2 === 1 ? z + k : front === 2 ? z + d - 1 : z;
                if (lv.room[idx(I, tx + DIRS[front][0], tz + DIRS[front][1])] === -2) { setEdge(I, lv, tx, tz, front, E.WALL); continue; }
                setEdge(I, lv, tx, tz, front, E.GLASS);
                edges.push([tx, tz, front]);
            }
            if (edges.length) { const e = edges[Math.floor(edges.length / 2)]; setEdge(I, lv, e[0], e[1], e[2], rng.chance(0.2) ? E.BROKEN : E.DOOR); }
            return r;
        };
        const span = (len, cb) => { let p = 0; while (p < len) { const n = Math.min(len - p, rng.int(3, 5)); cb(p, n); p += n; } };
        span(I.w, (p, n) => { unit(p, 0, n, 3, 2); unit(p, I.d - 3, n, 3, 0); });
        span(I.d - 6, (p, n) => { unit(0, 3 + p, 3, n, 1); unit(I.w - 3, 3 + p, 3, n, 3); });
        // walls between units
        for (let x = 1; x < I.w; x++) for (const z of [0, 1, 2, I.d - 3, I.d - 2, I.d - 1]) {
            if (lv.room[idx(I, x, z)] !== lv.room[idx(I, x - 1, z)] && lv.room[idx(I, x, z)] >= 0 && lv.room[idx(I, x - 1, z)] >= 0 && getEdge(I, lv, x, z, 3) === E.NONE) setEdge(I, lv, x, z, 3, E.WALL);
        }
        for (let z = 1; z < I.d; z++) for (const x of [0, 1, 2, I.w - 3, I.w - 2, I.w - 1]) {
            if (lv.room[idx(I, x, z)] !== lv.room[idx(I, x, z - 1)] && lv.room[idx(I, x, z)] >= 0 && lv.room[idx(I, x, z - 1)] >= 0 && getEdge(I, lv, x, z, 0) === E.NONE) setEdge(I, lv, x, z, 0, E.WALL);
        }
        // a service corridor behind one row of shops: the door that should not be there (Dale's diary)
        if (L === 0) lv.serviceDoor = true;
    },
    hospital(I, L, rng) {
        const lv = I.levels[L];
        const c = corridor(I, lv, rng, { cw: 2, rl: [3, 4], kind: L === 0 ? 'clinic' : 'ward', corr: { wall: 'tile', floor: 'lino', ceil: 'tiles' } });
        // a cross corridor
        const long = c.axis === 'z' ? I.d : I.w, short = c.axis === 'z' ? I.w : I.d;
        const v = Math.floor(long / 2);
        const r = lv.room[idx(I, ...c.map(c.c0, v))];
        for (let u = 0; u < short; u++) for (const dv of [0, 1]) {
            const [x, z] = c.map(u, v + dv);
            if (lv.room[idx(I, x, z)] === -2) continue;
            paintRoom(I, lv, r, x, z, 1, 1);
        }
        const [nS, sS, wS] = c.axis === 'z' ? [0, 2, 3] : [3, 1, 0];
        for (let u = 0; u < short; u++) {
            const [x, z] = c.map(u, v), [x2, z2] = c.map(u, v + 1);
            const inCorr = u >= c.c0 && u < c.c0 + c.cw;
            if (lv.room[idx(I, x, z)] === -2 || lv.room[idx(I, x2, z2)] === -2) continue;
            setEdge(I, lv, x, z, nS, inCorr ? E.NONE : u % 3 === 1 ? E.DOOR : E.WALL);
            setEdge(I, lv, x, z, sS, E.NONE);
            setEdge(I, lv, x2, z2, sS, inCorr ? E.NONE : u % 3 === 1 ? E.DOOR : E.WALL);
            if (u > 0) { setEdge(I, lv, x, z, wS, E.NONE); setEdge(I, lv, x2, z2, wS, E.NONE); }
        }
    },
    school(I, L, rng) {
        corridor(I, I.levels[L], rng, { cw: 2, rl: [4, 5], kind: 'classroom', corr: { wall: 'brick', floor: 'lino', ceil: 'tiles' } });
    },
    library(I, L, rng) {
        const lv = I.levels[L];
        const r = newRoom(I, lv, rng, 'stacks', { floor: L ? 'carpet' : 'wood', wall: 'plaster' });
        paintRoom(I, lv, r, 0, 0, I.w, I.d);
        bsp(I, lv, rng, 0, 0, I.w, 3, { min: 2, max: 5, kind: 'reading' });
        doorIn(I, lv, rng, wallRun(I, lv, 0, 3, 0, 'x', I.w), 3);
        if (L > 0) voidRect(I, lv, Math.floor(I.w / 2) - 2, 6, 4, 4);
        lv.shelves = { z0: 4 };
    },
    shop(I, L, rng) {
        const lv = I.levels[L];
        if (L === 0) {
            const r = newRoom(I, lv, rng, 'shopfloor', {});
            paintRoom(I, lv, r, 0, 0, I.w, I.d);
            const back = Math.max(2, I.d - 3);
            doorIn(I, lv, rng, wallRun(I, lv, 0, back, 0, 'x', I.w), 1);
            const r2 = newRoom(I, lv, rng, 'backroom', { wall: 'concrete', floor: 'concrete' });
            paintRoom(I, lv, r2, 0, back, I.w, I.d - back);
            lv.shopFloor = r;
            return;
        }
        bsp(I, lv, rng, 0, 0, I.w, I.d, { min: 2, max: 4, kind: 'flat', finish: () => ({ wall: 'floral', floor: 'carpet', ceil: 'plaster' }) });
    },
    factory(I, L, rng) {
        const lv = I.levels[L];
        // offices along the north wall, the hall below, a catwalk mezzanine above
        bsp(I, lv, rng, 0, 0, I.w, 3, { min: 2, max: 4, kind: 'office', finish: () => ({ wall: 'plaster', floor: 'lino', ceil: 'tiles' }) });
        doorIn(I, lv, rng, wallRun(I, lv, 0, 3, 0, 'x', I.w), 3);
        const r = newRoom(I, lv, rng, 'hall', {});
        paintRoom(I, lv, r, 0, 3, I.w, I.d - 3);
        if (L > 0) voidRect(I, lv, 2, 5, I.w - 4, I.d - 7);
        else { pillars(I, lv, rng, 5, 5); lv.machines = true; }
    },
    warehouse(I, L, rng) {
        const lv = I.levels[L];
        bsp(I, lv, rng, 0, 0, Math.min(5, I.w), 3, { min: 2, max: 4, kind: 'office', finish: () => ({ wall: 'plaster', floor: 'lino', ceil: 'tiles' }) });
        doorIn(I, lv, rng, wallRun(I, lv, 0, 3, 0, 'x', Math.min(5, I.w)), 1);
        wallRun(I, lv, Math.min(5, I.w), 0, 3, 'z', 3);
        if (L > 0) voidRect(I, lv, 2, 5, I.w - 4, I.d - 7);
        else lv.racks = true;
    },
    garage(I, L, rng) {
        const lv = I.levels[L];
        pillars(I, lv, rng, 4, 2);
        lv.parking = true;
        if (L === I.floors - 1) for (const r of lv.rooms) r.ceil = CE.open;
    },
    lab(I, L, rng) {
        const lv = I.levels[L];
        if (I.w < 12 && I.d < 12) {            // the substation: one room of switchgear
            const r = newRoom(I, lv, rng, 'switchgear', { wall: 'concrete', floor: 'concrete', ceil: 'concrete' });
            paintRoom(I, lv, r, 0, 0, I.w, I.d);
            lv.switchgear = true;
            return;
        }
        corridor(I, lv, rng, { cw: 2, rl: [3, 5], kind: 'labroom', corr: { wall: 'lab', floor: 'tile', ceil: 'tiles' } });
    },
    hall(I, L, rng) {
        const lv = I.levels[L];
        const r = newRoom(I, lv, rng, 'hall', { wall: 'lab', floor: 'concrete', ceil: 'open' });
        paintRoom(I, lv, r, 0, 0, I.w, I.d);
        // the breaker room in the north-west corner
        const br = newRoom(I, lv, rng, 'breaker', { wall: 'concrete', floor: 'concrete', ceil: 'concrete' });
        paintRoom(I, lv, br, 0, 0, 5, 4);
        wallRun(I, lv, 0, 4, 0, 'x', 5);
        wallRun(I, lv, 5, 0, 3, 'z', 4);
        setEdge(I, lv, 2, 4, 0, E.DOOR);
        lv.breaker = { x: 0, z: 1 };
        // control booths along the south wall
        bsp(I, lv, rng, 0, I.d - 4, 10, 4, { min: 2, max: 5, kind: 'control', finish: () => ({ wall: 'lab', floor: 'tile', ceil: 'tiles' }) });
        doorIn(I, lv, rng, wallRun(I, lv, 0, I.d - 4, 0, 'x', 10), 2);
        wallRun(I, lv, 10, I.d - 4, 3, 'z', 4);
        lv.ring = { x: Math.floor(I.w / 2), z: Math.floor(I.d / 2) - 1 };
    },
};

// ------------------------------------------------------------------ entrances

function entrances(I, rng) {
    const lv = I.levels[0], b = I.b;
    for (const e of b.entrances) {
        setEdge(I, lv, e.x, e.z, e.dir, E.DOOR);
        if (b.lock) lv.locks.set(lockKey(I, e.x, e.z, e.dir), `b${b.id}`);
        lv.flags[idx(I, e.x, e.z)] |= F.KEEP;
        // the tile just inside never gets furniture, and is never a hole
        const ix = e.x - DIRS[e.dir][0], iz = e.z - DIRS[e.dir][1];
        if (inB(I, ix, iz)) lv.flags[idx(I, ix, iz)] |= F.KEEP;
    }
    // shop fronts: a glass window either side of the door
    if (b.type === 'shop') for (const e of b.entrances) for (const k of [-1, 1, -2, 2]) {
        const x = e.dir % 2 === 0 ? e.x + k : e.x, z = e.dir % 2 === 1 ? e.z + k : e.z;
        if (inB(I, x, z) && getEdge(I, lv, x, z, e.dir) !== E.DOOR && (e.dir % 2 === 0 ? x > 0 && x < I.w - 1 : z > 0 && z < I.d - 1)) setEdge(I, lv, x, z, e.dir, E.GLASS);
    }
    // inner lock: the stairwell doors on the ground floor
    if (b.innerLock && lv.stairDoors) for (const [x, z, dir] of lv.stairDoors) lv.locks.set(lockKey(I, x, z, dir), `s${b.id}`);
}

// ------------------------------------------------------------------ furniture

const FURNITURE = {
    living: ['couch', 'armchair', 'tv', 'shelf', 'table', 'piano'],
    kitchen: ['fridge', 'stove', 'counter', 'table'],
    bedroom: ['bed', 'bed', 'wardrobe', 'dresser', 'cot'],
    bath: ['bathtub', 'toilet'],
    flat: ['bed', 'couch', 'table', 'fridge', 'wardrobe', 'tv'],
    hotelroom: ['bed', 'bed', 'dresser', 'tv'],
    office: ['desk', 'desk', 'filing', 'shelf'],
    lobby: ['planter', 'sofa', 'desk'],
    clinic: ['gurney', 'cabinet', 'desk', 'wheelchair'],
    ward: ['hospbed', 'hospbed', 'hospbed', 'cabinet', 'curtain'],
    classroom: ['schooldesk', 'schooldesk', 'schooldesk', 'schooldesk', 'blackboard'],
    reading: ['table', 'shelf', 'armchair'],
    store: ['rack', 'rack', 'counter', 'mannequin', 'shelf'],
    shopfloor: ['shelf', 'shelf', 'counter', 'fridge'],
    backroom: ['crate', 'shelf', 'crate'],
    labroom: ['bench', 'bench', 'cabinet', 'machine'],
    control: ['console', 'desk'],
    room: ['crate', 'table', 'shelf'],
};

function furnish(I, L, rng) {
    const lv = I.levels[L], b = I.b;
    const free = (x, z) => {
        if (!inB(I, x, z)) return false;
        const i = idx(I, x, z);
        if (lv.flags[i] & (F.SOLID | F.KEEP | F.STAIR | F.VOIDSTAIR | F.VOID) || lv.room[i] < 0) return false;
        // never in front of a door
        for (let dir = 0; dir < 4; dir++) { const e = getEdge(I, lv, x, z, dir); if (e === E.DOOR || e === E.BROKEN) return false; }
        return true;
    };
    const byRoom = new Map();
    for (let z = 0; z < I.d; z++) for (let x = 0; x < I.w; x++) {
        const r = lv.room[idx(I, x, z)];
        if (r < 0) continue;
        if (!byRoom.has(r)) byRoom.set(r, []);
        byRoom.get(r).push([x, z]);
    }
    for (const [r, tiles] of byRoom) {
        const R = lv.rooms[r];
        const list = FURNITURE[R.kind];
        if (!list || R.gutted) continue;
        // against walls first: tiles with a wall on at least one side
        const walled = tiles.filter(([x, z]) => [0, 1, 2, 3].some((dir) => { const e = getEdge(I, lv, x, z, dir); return e === E.WALL || e === E.WINDOW; }));
        rng.shuffle(walled);
        const n = Math.min(walled.length, Math.max(1, Math.floor(tiles.length / 5)));
        for (let k = 0; k < n; k++) {
            const [x, z] = walled[k];
            if (!free(x, z)) continue;
            // keep the room crossable: never fill more than a third of a room
            const kind = rng.pick(list);
            const wallDir = [0, 1, 2, 3].find((dir) => { const e = getEdge(I, lv, x, z, dir); return e === E.WALL || e === E.WINDOW; });
            const i = idx(I, x, z);
            lv.flags[i] |= F.SOLID;
            lv.props.push({ k: kind, x: (x + 0.5) * TILE, z: (z + 0.5) * TILE, r: wallDir * -Math.PI / 2, tiles: [i], tip: rng.chance(b.decay * 0.25) });
        }
        // loose junk on the floor: papers, chairs on their side, boxes (not solid)
        for (const [x, z] of tiles) if (rng.chance(0.12 + b.decay * 0.12)) {
            lv.props.push({ k: rng.pick(['papers', 'papers', 'chair', 'box', 'bottle', 'debris', 'books']), x: (x + rng()) * TILE, z: (z + rng()) * TILE, r: rng() * 6.28, tip: rng.chance(0.5) });
        }
    }
    // a working vending machine against a wall somewhere in the bigger buildings
    if (['office', 'mall', 'hospital', 'factory', 'school', 'hotel', 'garage', 'warehouse', 'lab'].includes(b.type) && rng.chance(0.75 / Math.max(1, I.floors * 0.6))) {
        const cands = [];
        for (let z = 0; z < I.d; z++) for (let x = 0; x < I.w; x++) {
            if (!free(x, z)) continue;
            const wallDir = [0, 1, 2, 3].find((dir) => getEdge(I, lv, x, z, dir) === E.WALL);
            if (wallDir !== undefined) cands.push([x, z, wallDir]);
        }
        if (cands.length) {
            const [x, z, wallDir] = rng.pick(cands);
            const i = idx(I, x, z);
            lv.flags[i] |= F.SOLID;
            lv.props.push({ k: 'vending', x: (x + 0.5) * TILE, z: (z + 0.5) * TILE, r: wallDir * -Math.PI / 2, tiles: [i] });
        }
    }
    // type-specific big pieces
    if (lv.cubicles) for (let z = 5; z < I.d - 2; z += 3) for (let x = 2; x < I.w - 2; x += 3) {
        if (rng.chance(0.75)) solidBlock(I, lv, 'cubicle', x, z, 1, 1, { r: rng.int(0, 3) * Math.PI / 2 });
    }
    if (lv.machines) for (let k = 0; k < 10; k++) {
        const w = rng.int(2, 3), d = rng.int(1, 2);
        solidBlock(I, lv, rng.pick(['machine', 'press', 'conveyor']), rng.int(1, I.w - w - 1), rng.int(5, I.d - d - 1), w, d);
    }
    if (lv.racks) for (let x = 2; x < I.w - 2; x += 3) {
        const gap = rng.int(4, I.d - 4);
        for (let z = 5; z < I.d - 2; z++) if (Math.abs(z - gap) > 0) solidBlock(I, lv, 'rack', x, z, 1, 1);
    }
    if (lv.parking) for (let z = 1; z < I.d - 2; z += 3) for (let x = 1; x < I.w - 1; x += 1) {
        if ((x + z) % 4 === 1 && rng.chance(0.4)) solidBlock(I, lv, 'pcar', x, z, 1, 2, { c: rng.int(0, 7), r: rng.chance(0.5) ? 0 : Math.PI });
    }
    if (lv.shelves) for (let z = lv.shelves.z0 + 1; z < I.d - 1; z += 2) for (let x = 1; x < I.w - 1; x++) {
        if (x % 5 !== 0 && rng.chance(0.85)) solidBlock(I, lv, 'bookcase', x, z, 1, 1);
    }
    if (lv.switchgear) for (let x = 1; x < I.w - 1; x += 2) solidBlock(I, lv, 'switchgear', x, 1, 1, 1);
    if (lv.atrium) {
        const a = lv.atrium, cx = a.x + Math.floor(a.w / 2), cz = a.z + Math.floor(a.d / 2);
        solidBlock(I, lv, 'mallfountain', cx - 1, cz - 1, 2, 2);
        const tx = a.x + 2 + rng.int(0, a.w - 5), tz = a.z + 1 + rng.int(0, 1);
        if (solidBlock(I, lv, 'bigtree', tx, tz, 1, 1, { s: 1.4 + rng() * 0.4 })) lv.flags[idx(I, tx, tz)] |= F.TREE | F.NOCEIL;
        for (let k = 0; k < 6; k++) solidBlock(I, lv, rng.pick(['planter', 'bench', 'kiosk']), a.x + rng.int(0, a.w - 1), a.z + rng.int(0, a.d - 1), 1, 1);
    }
    if (lv.ring) {
        const { x, z } = lv.ring;
        solidBlock(I, lv, 'ring', x - 3, z, 6, 1);
        lv.props[lv.props.length - 1].ring = true;
        solidBlock(I, lv, 'console', x - 2, z + 4, 4, 1);
        for (let k = -5; k <= 5; k += 10) solidBlock(I, lv, 'coil', x + k, z, 1, 1);
    }
    if (lv.breaker) solidBlock(I, lv, 'breaker', lv.breaker.x, lv.breaker.z, 1, 1);
}

function lamps(I, L, rng) {
    const lv = I.levels[L];
    const step = I.b.type === 'factory' || I.b.type === 'warehouse' || I.b.type === 'hall' ? 4 : I.b.type === 'mall' ? 3 : 2;
    for (let z = 0; z < I.d; z++) for (let x = 0; x < I.w; x++) {
        const i = idx(I, x, z);
        if ((x + z * 3) % step !== 0 || (z % 2 && step === 2) || lv.flags[i] & (F.VOID | F.VOIDSTAIR | F.STAIR)) continue;
        if (lv.room[i] < 0 && lv.room[i] !== -2) continue;
        lv.flags[i] |= F.LAMP;
    }
    for (const r of lv.rooms) r.lit = I.power && rng.chance(r.backrooms || r.kind === 'corridor' ? 0.9 : 0.55);
}

// ------------------------------------------------------------------ decay

function decay(I, rng) {
    const dk = I.b.decay;
    for (let L = 0; L < I.floors; L++) {
        const lv = I.levels[L];
        for (let z = 0; z < I.d; z++) for (let x = 0; x < I.w; x++) {
            const i = idx(I, x, z);
            if (lv.flags[i] & (F.VOID | F.VOIDSTAIR)) continue;
            if (rng.chance(0.08 + dk * 0.22)) lv.flags[i] |= F.MOLD;
            if (rng.chance(0.03 + dk * 0.1)) lv.flags[i] |= F.PUDDLE;
            if (rng.chance(0.02 + dk * 0.06)) lv.flags[i] |= F.RUBBLE;
            if (rng.chance(dk * 0.05)) lv.flags[i] |= F.SINK;
            if (rng.chance(dk * 0.04) && L < I.floors - 1) lv.flags[i] |= F.NOCEIL;
            if (rng.chance(0.03)) lv.flags[i] |= F.DEBRIS;
        }
        // interior walls that have given way
        for (let z = 0; z < I.d; z++) for (let x = 0; x < I.w; x++) for (const dir of [0, 3]) {
            const nx = x + DIRS[dir][0], nz = z + DIRS[dir][1];
            if (!inB(I, nx, nz)) continue;
            if (lv.room[idx(I, x, z)] === -2 || lv.room[idx(I, nx, nz)] === -2) continue;
            if (getEdge(I, lv, x, z, dir) === E.WALL && rng.chance(0.02 + dk * 0.06)) setEdge(I, lv, x, z, dir, E.BROKEN);
        }
        // broken windows (most of them) let the leaves in
        for (let z = 0; z < I.d; z++) for (let x = 0; x < I.w; x++) for (let dir = 0; dir < 4; dir++) {
            if (getEdge(I, lv, x, z, dir) === E.WINDOW && rng.chance(0.4)) lv.flags[idx(I, x, z)] |= F.LEAVES;
        }
    }
    // a tree through the floor of an old house
    if (I.b.type === 'house' && I.floors > 1 && rng.chance(0.25)) {
        const x = rng.int(1, I.w - 2), z = rng.int(1, I.d - 2);
        const ok = I.levels.every((lv) => !(lv.flags[idx(I, x, z)] & (F.SOLID | F.KEEP | F.STAIR | F.VOIDSTAIR)) && lv.room[idx(I, x, z)] >= 0);
        if (ok) {
            for (let L = 0; L < I.floors; L++) {
                const lv = I.levels[L], i = idx(I, x, z);
                lv.flags[i] |= F.SOLID | F.TREE | F.NOCEIL;
                if (L === 0) lv.props.push({ k: 'bigtree', x: (x + 0.5) * TILE, z: (z + 0.5) * TILE, r: rng() * 6, s: 0.8 + rng() * 0.3, tiles: [i], floors: I.floors });
            }
        }
    }
}

// ------------------------------------------------------------------ connectivity

/** Moves inside one building, used by the repair pass and by the nav (world.js has the full city version). */
export function interiorNeighbours(I, L, x, z, out, opts = {}) {
    out.length = 0;
    const lv = I.levels[L];
    const i = idx(I, x, z);
    const here = lv.flags[i];
    for (let dir = 0; dir < 4; dir++) {
        const nx = x + DIRS[dir][0], nz = z + DIRS[dir][1];
        // a stair run: only along its axis; leaving the top end puts you on the level above
        if (here & F.STAIR) {
            const sd = (lv.stair[i] - 1) >> 4, k = (lv.stair[i] - 1) & 15;
            if (dir === sd && k === I.S - 1) { if (L + 1 < I.floors && inB(I, nx, nz)) out.push([L + 1, nx, nz, dir]); continue; }
            if (dir !== sd && dir !== (sd + 2) % 4) continue;
        }
        const e = getEdge(I, lv, x, z, dir);
        if (!edgeOpen(e)) continue;
        if (e === E.DOOR && !opts.ignoreLocks) {
            const lk = edgeLock(I, lv, x, z, dir);
            if (lk && !opts.open?.has(lk)) continue;
        }
        if (!inB(I, nx, nz)) { if (L === 0 && opts.outside) out.push([-1, nx, nz, dir]); continue; }
        const j = idx(I, nx, nz), f = lv.flags[j];
        if (f & F.SOLID) continue;
        if (f & F.VOIDSTAIR) {
            // stepping off the landing onto the top of the run below
            if (L > 0) {
                const lb = I.levels[L - 1];
                const sd = (lb.stair[j] - 1) >> 4, k = (lb.stair[j] - 1) & 15;
                if (lb.flags[j] & F.STAIR && k === I.S - 1 && dir === (sd + 2) % 4) out.push([L - 1, nx, nz, dir]);
            }
            continue;
        }
        if (f & F.VOID) continue;
        if (f & F.HOLE && !opts.holes) continue;
        if (f & F.STAIR) {
            // only onto the bottom of a run, from below it
            const sd = (lv.stair[j] - 1) >> 4, k = (lv.stair[j] - 1) & 15;
            if (!(dir === sd && k === 0) && !(here & F.STAIR)) continue;
        }
        out.push([L, nx, nz, dir]);
    }
    return out;
}

function flood(I, opts) {
    const seen = I.levels.map(() => new Uint8Array(I.w * I.d));
    const q = [];
    for (const e of I.b.entrances) { seen[0][idx(I, e.x, e.z)] = 1; q.push([0, e.x, e.z]); }
    const nb = [];
    while (q.length) {
        const [L, x, z] = q.pop();
        for (const [L2, x2, z2] of interiorNeighbours(I, L, x, z, nb, opts)) {
            if (L2 < 0) continue;
            const j = idx(I, x2, z2);
            if (seen[L2][j]) continue;
            seen[L2][j] = 1;
            q.push([L2, x2, z2]);
        }
    }
    return seen;
}

function walkable(lv, i) { return !(lv.flags[i] & (F.SOLID | F.VOID | F.VOIDSTAIR)) && lv.floor[i] > 0; }

function repair(I) {
    for (let round = 0; round < 3000; round++) {
        const seen = flood(I, { ignoreLocks: true, holes: true });
        let fixed = false, missing = 0;
        for (let L = 0; L < I.floors && !fixed; L++) {
            const lv = I.levels[L];
            for (let z = 0; z < I.d && !fixed; z++) for (let x = 0; x < I.w && !fixed; x++) {
                const i = idx(I, x, z);
                if (seen[L][i] || !walkable(lv, i) || lv.flags[i] & F.STAIR) continue;
                missing++;
                for (let dir = 0; dir < 4; dir++) {
                    const nx = x + DIRS[dir][0], nz = z + DIRS[dir][1];
                    if (!inB(I, nx, nz)) continue;
                    const j = idx(I, nx, nz);
                    if (!seen[L][j] || lv.flags[j] & F.STAIR) continue;
                    const e = getEdge(I, lv, x, z, dir);
                    if (e === E.WALL || e === E.RAIL || e === E.GLASS) {
                        if (lv.room[i] === -2 || lv.room[j] === -2) continue;   // never through the stairwell
                        setEdge(I, lv, x, z, dir, E.BROKEN); fixed = true; break;
                    }
                }
            }
        }
        if (fixed) continue;
        if (!missing) return;
        // pockets sealed by furniture: clear a solid tile next to the reached area
        let cleared = false;
        for (let L = 0; L < I.floors && !cleared; L++) {
            const lv = I.levels[L];
            for (let k = lv.props.length - 1; k >= 0 && !cleared; k--) {
                const p = lv.props[k];
                if (!p.tiles || p.ring || p.k === 'breaker' || p.k === 'console' || p.k === 'bigtree') continue;
                const touches = p.tiles.some((i) => {
                    const x = i % I.w, z = (i / I.w) | 0;
                    return [0, 1, 2, 3].some((dir) => { const nx = x + DIRS[dir][0], nz = z + DIRS[dir][1]; return inB(I, nx, nz) && seen[L][idx(I, nx, nz)]; });
                });
                const borders = p.tiles.some((i) => {
                    const x = i % I.w, z = (i / I.w) | 0;
                    return [0, 1, 2, 3].some((dir) => { const nx = x + DIRS[dir][0], nz = z + DIRS[dir][1]; if (!inB(I, nx, nz)) return false; const j = idx(I, nx, nz); return !seen[L][j] && walkable(lv, j); });
                });
                if (touches && borders) {
                    for (const i of p.tiles) lv.flags[i] &= ~F.SOLID;
                    lv.props.splice(k, 1);
                    cleared = true;
                }
            }
        }
        if (!cleared) {
            // the last resort: a pocket behind the stairwell wall or a railing. Knock through anywhere adjacent.
            for (let L = 0; L < I.floors && !cleared; L++) {
                const lv = I.levels[L];
                for (let z = 0; z < I.d && !cleared; z++) for (let x = 0; x < I.w && !cleared; x++) {
                    const i = idx(I, x, z);
                    if (seen[L][i] || !walkable(lv, i) || lv.flags[i] & F.STAIR) continue;
                    // mark it unusable rather than leave a sealed room
                    lv.flags[i] |= F.SOLID; lv.props.push({ k: 'rubblepile', x: (x + 0.5) * TILE, z: (z + 0.5) * TILE, r: 0, tiles: [i] });
                    cleared = true;
                }
            }
        }
    }
}

function holes(I, rng) {
    if (I.floors < 2) return;
    const want = Math.floor((I.w * I.d * (I.floors - 1)) / 90 * I.b.decay);
    let made = 0;
    for (let tries = 0; tries < want * 8 && made < want; tries++) {
        const L = rng.int(1, I.floors - 1), x = rng.int(1, I.w - 2), z = rng.int(1, I.d - 2);
        const lv = I.levels[L], lb = I.levels[L - 1], i = idx(I, x, z);
        if (lv.flags[i] & (F.SOLID | F.KEEP | F.STAIR | F.VOIDSTAIR | F.VOID | F.HOLE | F.TREE) || lv.room[i] < 0) continue;
        if (lb.flags[i] & (F.SOLID | F.STAIR | F.VOIDSTAIR | F.VOID) || lb.room[i] < 0) continue;
        let doorNear = false;
        for (let dir = 0; dir < 4; dir++) { const e = getEdge(I, lv, x, z, dir); if (e === E.DOOR || e === E.BROKEN) doorNear = true; }
        if (doorNear) continue;
        lv.flags[i] |= F.HOLE;
        // a hole must not cut its own floor in two
        const seen = flood(I, { ignoreLocks: true });
        let ok = true;
        for (let zz = 0; zz < I.d && ok; zz++) for (let xx = 0; xx < I.w && ok; xx++) {
            const j = idx(I, xx, zz);
            if (!seen[L][j] && walkable(lv, j) && !(lv.flags[j] & (F.HOLE | F.STAIR))) ok = false;
        }
        if (!ok) { lv.flags[i] &= ~F.HOLE; continue; }
        lb.flags[i] |= F.RUBBLE | F.NOCEIL;
        made++;
    }
}

// ------------------------------------------------------------------ things to find

function things(C, I, rng) {
    const b = I.b;
    const spots = (L, filter = () => true) => {
        const lv = I.levels[L], out = [];
        for (let z = 0; z < I.d; z++) for (let x = 0; x < I.w; x++) {
            const i = idx(I, x, z);
            if (lv.flags[i] & (F.SOLID | F.STAIR | F.VOIDSTAIR | F.VOID | F.HOLE) || lv.room[i] < 0) continue;
            if (filter(x, z, lv, i)) out.push([x, z]);
        }
        return out;
    };
    const add = (kind, L, x, z, extra = {}, exact = false) => {
        const id = `${kind[0]}${b.id}_${I.things.length}`;
        const o = exact ? 0 : 0.5;
        I.things.push({ id, kind, b: b.id, L, x: I.x0 + (x + o) * TILE, z: I.z0 + (z + o) * TILE, ...extra });
    };
    const nFrag = b.type === 'house' ? (rng.chance(0.35) ? 1 : 0) : rng.int(1, 3);
    for (let k = 0; k < nFrag; k++) {
        const L = rng.int(0, I.floors - 1), s = spots(L);
        if (s.length) { const [x, z] = rng.pick(s); add('fragment', L, x, z, { t: Math.floor(rng() * 1e6) }); }
    }
    // the working vending machines (placed as furniture before the connectivity repair, so they never seal a room)
    for (let L = 0; L < I.floors; L++) for (const p of I.levels[L].props) {
        if (p.k !== 'vending') continue;
        const t = p.tiles[0], x = t % I.w, z = Math.floor(t / I.w);
        add('vending', L, x, z, { r: p.r });
    }
    if (rng.chance(b.type === 'house' ? 0.15 : 0.3)) {
        const L = rng.int(0, I.floors - 1), s = spots(L);
        if (s.length) { const [x, z] = rng.pick(s); add('radio', L, x, z, {}); }
    }
    // the hall: the breaker box and the console's dials and levers
    const lv0 = I.levels[0];
    if (lv0.breaker) add('breaker', 0, lv0.breaker.x + 0.98, lv0.breaker.z + 0.5, {}, true);
    if (lv0.ring) {
        const cs = lv0.ring.x - 2, cz = lv0.ring.z + 4.92;
        const at = (id, kind, u, extra) => I.things.push({ id, kind, b: b.id, L: 0, x: I.x0 + (cs + u) * TILE, z: I.z0 + cz * TILE, ...extra });
        at('lever0', 'lever', 0.35, { i: 0 }); at('lever1', 'lever', 0.8, { i: 1 });
        at('dial0', 'dial', 1.4, { i: 0 }); at('dial1', 'dial', 1.8, { i: 1 }); at('dial2', 'dial', 2.2, { i: 2 });
        at('master', 'master', 2.75, {});
        at('lever2', 'lever', 3.25, { i: 2 }); at('lever3', 'lever', 3.68, { i: 3 });
    }
}

/** Free floor tiles of a level (for placing story objects), optionally only ones the flood reached. */
export function freeTiles(I, L) {
    const lv = I.levels[L], out = [];
    for (let z = 0; z < I.d; z++) for (let x = 0; x < I.w; x++) {
        const i = idx(I, x, z);
        if (lv.flags[i] & (F.SOLID | F.STAIR | F.VOIDSTAIR | F.VOID | F.HOLE | F.KEEP) || lv.room[i] < 0) continue;
        out.push([x, z]);
    }
    return out;
}
