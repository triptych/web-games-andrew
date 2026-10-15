// Builds every map in the game from js/sim/data: the overworld (a grid of zones grown around
// their features, or drawn by hand for towns), the interiors and the dungeons.
//
// Pure and deterministic: the world is the same in every game (it has a story to tell), so it is
// built once from a fixed seed and cached. Nothing here depends on a save; a save only records
// what you changed (opened locks, emptied chests).

import { ZW, ZH, ZC, ZR } from '../config.js';
import { T, TILES } from './data/tiles.js';
import { BIOMES, ZONES, ZONE_AT, CONNS, TOWNS, BUILDINGS, TOWN_NPCS } from './data/world.js';
import { INTERIORS, DUNGEONS, DUNGEON_STYLE } from './data/maps.js';
import { makeRng, hash3 } from '../rng.js';
import { BIOME_FOES } from './data/enemies.js';

const WORLD_SEED = 0x5eed1e;
export const W = ZW * ZC, H = ZH * ZR;

// ------------------------------------------------------------------ helpers
function newMap(id, w, h, o = {}) {
    return {
        id, w, h,
        t: new Uint8Array(w * h),
        g: new Uint8Array(w * h),
        v: new Uint8Array(w * h),
        warps: {},          // idx → { to, x, y, need }
        objs: {},           // idx → { kind, ... }
        npcs: [],           // { id, x, y }
        spawns: [],         // { id, x, y, foes, tier }
        buildings: [],      // drawn by the view: { x, y, w, h, style, name, door }
        arrive: null,       // { x, y } where you appear coming in
        ...o,
    };
}
const noise = (x, y, s, seed) => {
    // value noise on a lattice of size s
    const fx = x / s, fy = y / s;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = hash3(x0, y0, seed), b = hash3(x0 + 1, y0, seed), c = hash3(x0, y0 + 1, seed), d = hash3(x0 + 1, y0 + 1, seed);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
};

const WALL_OF = { pit: T.pit, reef: T.reef, rapids: T.rapids };
const tileId = (name) => {
    const id = T[name];
    if (id === undefined) throw new Error('unknown tile ' + name);
    return id;
};

// ------------------------------------------------------------------ the overworld
function buildOverworld() {
    const M = newMap('world', W, H, { name: 'Vellumvale', kind: 'world', zoneOf: new Uint8Array(W * H) });
    const reserved = new Uint8Array(W * H);     // must stay walkable (paths, doorsteps)
    const must = [];                             // [x, y, zone] that must be reachable from the zone hub
    const set = (x, y, t, g) => { const i = y * W + x; M.t[i] = t; if (g !== undefined) M.g[i] = g; };
    const idx = (x, y) => y * W + x;

    // 1. ground, variants, and each zone's border
    ZONES.forEach((z, zi) => {
        const B = BIOMES[z.biome];
        const x0 = z.c * ZW, y0 = z.r * ZH;
        const ground = tileId(B.ground === 'water' ? 'water' : B.ground);
        const groundUnder = B.ground === 'water' ? T.sand : ground;
        for (let y = 0; y < ZH; y++) for (let x = 0; x < ZW; x++) {
            const i = idx(x0 + x, y0 + y);
            M.zoneOf[i] = zi;
            M.v[i] = Math.floor(hash3(x0 + x, y0 + y, 77) * 256);
            M.t[i] = ground;
            M.g[i] = groundUnder;
            const ring = x === 0 || y === 0 || x === ZW - 1 || y === ZH - 1;
            if (ring) {
                const side = y === 0 ? 'N' : y === ZH - 1 ? 'S' : x === 0 ? 'W' : 'E';
                const over = z.edge?.[side] ?? (x === 0 || x === ZW - 1 ? z.edge?.[x === 0 ? 'W' : 'E'] : undefined);
                const wall = over || B.wall;
                M.t[i] = WALL_OF[wall] ?? tileId(wall);
                if (B.ground === 'water' && wall === 'reef') M.g[i] = T.sand;
            }
        }
    });

    // 2. passages between zones
    for (const c of CONNS) {
        const [ac, ar] = c.a, [bc, br] = c.b;
        const za = ZONE_AT[ac + ',' + ar], zb = ZONE_AT[bc + ',' + br];
        if (!za || !zb) throw new Error('bad connection ' + c.a + ' ' + c.b);
        const horiz = ar === br;                 // zones side by side: the gap is in a vertical border
        if (!horiz && ac !== bc) throw new Error('not neighbours ' + c.a + ' ' + c.b);
        const [lo, hi] = c.open ? (horiz ? [1, ZH - 2] : [1, ZW - 2]) : (c.span || (horiz ? [6, 9] : [10, 13]));
        const lockT = c.lock ? tileId(c.lock) : null;
        for (let k = lo; k <= hi; k++) {
            let cells;
            if (horiz) {
                const left = Math.min(ac, bc), y = ar * ZH + k;
                cells = [[left * ZW + ZW - 1, y, left === ac ? za : zb], [(left + 1) * ZW, y, left === ac ? zb : za]];
            } else {
                const top = Math.min(ar, br), x = ac * ZW + k;
                cells = [[x, top * ZH + ZH - 1, top === ar ? za : zb], [x, (top + 1) * ZH, top === ar ? zb : za]];
            }
            for (const [x, y, z] of cells) {
                const B = BIOMES[z.biome];
                const i = idx(x, y);
                const water = B.ground === 'water';
                M.t[i] = lockT ?? (water ? T.water : (B.path && !c.open ? tileId(B.path) : M.g[i]));
                if (!lockT && !water) reserved[i] = 1;
            }
        }
        // the tiles just inside each zone must be reachable from that zone's hub
        const mid = Math.floor((lo + hi) / 2);
        if (horiz) {
            const left = Math.min(ac, bc), y = ar * ZH + mid;
            must.push([left * ZW + ZW - 2, y, left === ac ? za : zb], [(left + 1) * ZW + 1, y, left === ac ? zb : za]);
        } else {
            const top = Math.min(ar, br), x = ac * ZW + mid;
            must.push([x, top * ZH + ZH - 2, top === ar ? za : zb], [x, (top + 1) * ZH + 1, top === ar ? zb : za]);
        }
    }

    // 3. each zone's contents
    for (const z of ZONES) {
        if (z.town) buildTown(M, z, reserved, must);
        else growZone(M, z, reserved, must);
    }

    // 4. every zone hub reaches its doorways and doorsteps (carve if it doesn't)
    for (const z of ZONES) ensureReach(M, z, must.filter((m) => m[2] === z), reserved);

    // 5. foes
    for (const z of ZONES) placeSpawns(M, z, reserved);
    return M;
}

function hubOf(z) {
    const B = BIOMES[z.biome];
    return { x: z.c * ZW + (z.hub?.[0] ?? 12), y: z.r * ZH + (z.hub?.[1] ?? 8), lake: !!B.lake };
}

// A path that wanders a little between two points. Marks it reserved; paints `paint` if given.
function carve(M, reserved, x0, y0, x1, y1, paint, rng, z, width = 2) {
    let x = x0, y = y0, guard = 0;
    const zx0 = z.c * ZW + 1, zy0 = z.r * ZH + 1, zx1 = z.c * ZW + ZW - 2, zy1 = z.r * ZH + ZH - 2;
    const mark = (cx, cy) => {
        for (let dy = 0; dy < width; dy++) for (let dx = 0; dx < width; dx++) {
            const px = Math.min(zx1, Math.max(zx0, cx + dx)), py = Math.min(zy1, Math.max(zy0, cy + dy));
            const i = py * W + px;
            if (TILES[M.t[i]].lock && !reserved[i]) continue;     // never paint over a lock
            if (M.t[i] === T.bld || M.t[i] === T.door || M.objs[i]) continue;
            reserved[i] = 1;
            if (paint != null) M.t[i] = paint; else if (TILES[M.t[i]].solid) M.t[i] = M.g[i];
        }
    };
    mark(x, y);
    while ((x !== x1 || y !== y1) && guard++ < 400) {
        const dx = Math.sign(x1 - x), dy = Math.sign(y1 - y);
        const wobble = rng() < 0.25;
        if (dx && (!dy || (Math.abs(x1 - x) > Math.abs(y1 - y)) !== wobble)) x += dx; else if (dy) y += dy; else x += dx;
        mark(x, y);
    }
}

function stampBuilding(M, x, y, w, h, b, reserved) {
    // x, y: world tile of the top-left; the door is the middle of the bottom row
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const k = (y + j) * W + x + i;
        M.t[k] = T.bld;
        reserved[k] = 1;
    }
    const dx = x + Math.floor(w / 2), dy = y + h - 1;
    const rec = { x, y, w, h, style: b.style, name: b.name, id: b.id, door: { x: dx, y: dy } };
    M.buildings.push(rec);
    if (b.interior || b.dungeon) {
        M.t[dy * W + dx] = T.door;
        M.warps[dy * W + dx] = { to: b.interior || b.dungeon, need: b.need || null, dir: 'up' };
    }
    reserved[(dy + 1) * W + dx] = 1;
    return { x: dx, y: dy + 1 };
}

const TOWN_CHAR = {
    '.': null, ':': 'path', ',': 'flowers', t: 'tree', b: 'bush', h: 'hedge', x: 'flowerbox', l: 'lamp',
    w: 'well', o: 'statue', c: 'crate', r: 'barrel', k: 'counter', p: 'palm', '~': 'water', '=': 'bridge',
    f: 'fence', n: 'crate', q: 'rune',
};

function buildTown(M, z, reserved, must) {
    const B = BIOMES[z.biome];
    const art = TOWNS[z.town], blds = BUILDINGS[z.town] || {};
    const x0 = z.c * ZW + 1, y0 = z.r * ZH + 1;
    const seen = {};
    art.forEach((row, ry) => {
        if (row.length !== ZW - 2) throw new Error(`town ${z.town} row ${ry} is ${row.length} wide`);
        for (let rx = 0; rx < row.length; rx++) {
            const ch = row[rx], i = (y0 + ry) * W + x0 + rx;
            if (ch >= 'A' && ch <= 'Z') {
                (seen[ch] ||= []).push([rx, ry]);
                continue;
            }
            if (ch === 'm') { (seen.m ||= []).push([rx, ry]); continue; }
            const name = TOWN_CHAR[ch];
            if (name === undefined) throw new Error(`town ${z.town}: unknown '${ch}'`);
            if (name === 'path') { M.t[i] = tileId(B.path); M.g[i] = M.t[i]; }
            else if (name === 'flowers') { M.t[i] = T.flowers; M.g[i] = T.flowers; }
            else if (name === 'water') M.t[i] = T.water;
            else if (name === 'bridge') { M.t[i] = T.bridge; M.g[i] = T.bridge; }
            else if (name) M.t[i] = tileId(name);
            if (!TILES[M.t[i]].solid) reserved[i] = 1;
        }
    });
    for (const ch in seen) {
        if (ch === 'm') {
            // mouse houses: 2 × 2 blocks, no way in
            const cells = new Set(seen.m.map(([x, y]) => x + ',' + y));
            for (const [x, y] of seen.m) {
                if (cells.has((x - 1) + ',' + y) || cells.has(x + ',' + (y - 1))) continue;
                stampBuilding(M, x0 + x, y0 + y, 2, 2, { style: 'mousehouse', name: 'A mouse house' }, reserved);
            }
            continue;
        }
        const cells = seen[ch];
        const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
        const bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx + 1, bh = Math.max(...ys) - by + 1;
        const b = blds[ch];
        if (!b) throw new Error(`town ${z.town}: no building for '${ch}'`);
        const step = stampBuilding(M, x0 + bx, y0 + by, bw, bh, b, reserved);
        must.push([step.x, step.y, z]);
    }
    for (const [id, x, y] of TOWN_NPCS[z.town] || []) {
        M.npcs.push({ id, x: z.c * ZW + x, y: z.r * ZH + y });
        must.push([z.c * ZW + x, z.r * ZH + y, z]);
    }
}

const POCKET_WALL = { thorn: 'tree', boulder: 'rock', fog: 'rock', stream: 'rapids', tiny: 'hedge', sprout: 'cliff', ghost: 'stonewall', rune: 'stonewall' };
const STRUCT = {   // dungeon entrances: footprint
    oak: [5, 4], cavemouth: [4, 3], kiln: [5, 4], mine: [4, 3], icetemple: [6, 5], lighthouse: [4, 6],
    glasshouse: [7, 5], ruin: [5, 4], abbey: [7, 5], observatory: [6, 5],
};

function growZone(M, z, reserved, must) {
    const B = BIOMES[z.biome];
    const rng = makeRng((WORLD_SEED ^ (z.c * 7919 + z.r * 104729)) >>> 0);
    const x0 = z.c * ZW, y0 = z.r * ZH;
    const hub = hubOf(z);
    const idx = (x, y) => y * W + x;
    const inZone = (x, y) => x > x0 && y > y0 && x < x0 + ZW - 1 && y < y0 + ZH - 1;
    const approaches = [];
    const pathT = B.path ? tileId(B.path) : null;
    const ground = B.ground === 'water' ? T.water : tileId(B.ground);

    if (B.lake) {
        // Lumen Lake: water everywhere, a beach where it meets the land, islands
        for (const side of z.land || []) {
            for (let y = 1; y < ZH - 1; y++) for (let x = 1; x < ZW - 1; x++) {
                const d = side === 'W' ? x : side === 'E' ? ZW - 1 - x : side === 'N' ? y : ZH - 1 - y;
                const edge = 3 + Math.floor(noise(x0 + x, y0 + y, 4, 11) * 3);
                if (d <= edge) { const i = idx(x0 + x, y0 + y); M.t[i] = d <= 1 ? T.grass : T.sand; M.g[i] = M.t[i]; reserved[i] = 1; }
            }
        }
        for (const f of z.feats) {
            if (f.k !== 'island') continue;
            const cx = x0 + f.x, cy = y0 + f.y;
            for (let y = -f.r - 1; y <= f.r + 1; y++) for (let x = -f.r - 1; x <= f.r + 1; x++) {
                const d = Math.hypot(x, y * 1.15);
                if (d > f.r + 0.4 || !inZone(cx + x, cy + y)) continue;
                const i = idx(cx + x, cy + y);
                M.t[i] = d < f.r - 1 ? T.grass : T.sand; M.g[i] = M.t[i];
            }
            if (f.chest) placeChest(M, cx, cy, f.chest.id, f.chest.item, f.chest.n || 1);
            if (f.dungeon) {
                const st = stampBuilding(M, cx - 2, cy - 2, 5, 4, { style: DUNGEON_STYLE[f.dungeon], name: '', id: f.dungeon, dungeon: f.dungeon }, reserved);
                M.t[idx(st.x, st.y)] = T.sand; M.g[idx(st.x, st.y)] = T.sand;
            }
            // a reed or two
            for (let k = 0; k < 2; k++) {
                const a = rng() * Math.PI * 2, rr = f.r - 1;
                const px = Math.round(cx + Math.cos(a) * rr), py = Math.round(cy + Math.sin(a) * rr);
                const i = idx(px, py);
                if (M.t[i] === T.grass && !M.objs[i] && !reserved[i]) M.t[i] = T.bush;
            }
        }
        return;
    }

    // features first, so paths can lead to them
    for (const f of z.feats) {
        const fx = x0 + f.x, fy = y0 + f.y;
        if (f.k === 'dungeon') {
            const style = DUNGEON_STYLE[f.id];
            const [w, h] = STRUCT[style];
            const st = stampBuilding(M, fx - Math.floor(w / 2), fy - h + 1, w, h,
                { style, name: '', id: f.id, dungeon: f.id, need: f.id === 'glimmer' ? 'lumen' : null }, reserved);
            approaches.push([st.x, st.y]);
            // a clearing in front
            for (let y = 0; y < 3; y++) for (let x = -2; x <= 2; x++) {
                const i = idx(st.x + x, st.y + y);
                if (inZone(st.x + x, st.y + y) && M.t[i] !== T.bld && M.t[i] !== T.door) { reserved[i] = 1; M.t[i] = M.g[i]; }
            }
        } else if (f.k === 'building') {
            const st = stampBuilding(M, fx, fy, f.w, f.h, { style: f.style, name: '', id: f.id, interior: f.interior }, reserved);
            approaches.push([st.x, st.y]);
            for (let y = 0; y < 2; y++) for (let x = -1; x <= 1; x++) reserved[idx(st.x + x, st.y + y)] = 1;
        } else if (f.k === 'npc') {
            M.npcs.push({ id: f.id, x: fx, y: fy });
            reserved[idx(fx, fy)] = 1;
            approaches.push([fx, fy + 1]);
            reserved[idx(fx, fy + 1)] = 1;
        } else if (f.k === 'chest') {
            placeChest(M, fx, fy, f.id, f.item, f.n || 1);
            reserved[idx(fx, fy + 1)] = 1;
            approaches.push([fx, fy + 1]);
        } else if (f.k === 'sign') {
            M.t[idx(fx, fy)] = T.sign;
            M.objs[idx(fx, fy)] = { kind: 'sign', text: f.text };
            reserved[idx(fx, fy + 1)] = 1;
            approaches.push([fx, fy + 1]);
        } else if (f.k === 'pond') {
            for (let y = -f.r; y <= f.r; y++) for (let x = -f.r - 1; x <= f.r + 1; x++) {
                if (Math.hypot(x * 0.8, y) > f.r + 0.3) continue;
                const i = idx(fx + x, fy + y);
                if (inZone(fx + x, fy + y) && !reserved[i]) { M.t[i] = T.water; reserved[i] = 2; }
            }
        } else if (f.k === 'pocket') {
            // a little enclosure with a chest, opened by one grimoire
            const lockT = tileId(f.lock);
            const deep = f.lock === 'deep' || f.lock === 'chasm';
            const wallT = deep ? (f.lock === 'deep' ? T.water : T.chasm) : WALL_OF[POCKET_WALL[f.lock]] ?? tileId(POCKET_WALL[f.lock]);
            for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
                const i = idx(fx + x, fy + y);
                const ring = Math.abs(x) === 2 || Math.abs(y) === 2;
                M.t[i] = ring ? wallT : M.g[i];
                reserved[i] = 2;
            }
            if (!deep) M.t[idx(fx, fy + 2)] = lockT;
            placeChest(M, fx, fy, f.id, f.item, f.n || 1);
            reserved[idx(fx, fy + 3)] = 1;
            approaches.push([fx, fy + 3]);
        }
    }

    // the sea along the coast
    if (z.sea) {
        for (let y = 1; y < ZH - 1; y++) {
            const edge = z.sea + Math.floor(noise(x0, y0 + y, 5, 9) * 3) - 1;
            for (let x = edge; x < ZW; x++) {
                const i = idx(x0 + x, y0 + y);
                if (reserved[i] || M.t[i] === T.bld) continue;
                if (x === ZW - 1) continue;          // the border stays rock
                M.t[i] = T.water;
            }
        }
    }

    // paths from the doorways and the features to the hub
    const ins = must.filter((m) => m[2] === z);
    for (const [x, y] of ins) carve(M, reserved, x, y, hub.x, hub.y, pathT, rng, z);
    for (const [x, y] of approaches) {
        carve(M, reserved, x, y, hub.x, hub.y, pathT, rng, z);
        must.push([x, y, z]);
    }
    // the hub itself
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) reserved[idx(hub.x + x, hub.y + y)] = 1;

    // farm fields: rows of crops in the open
    if (B.fields) {
        for (let k = 0; k < 3; k++) {
            const fx = x0 + 2 + Math.floor(rng() * (ZW - 9)), fy = y0 + 2 + Math.floor(rng() * (ZH - 8));
            const fw = 4 + Math.floor(rng() * 3), fh = 3 + Math.floor(rng() * 2);
            let clear = true;
            for (let y = -1; y <= fh; y++) for (let x = -1; x <= fw; x++) if (reserved[idx(fx + x, fy + y)] || M.objs[idx(fx + x, fy + y)]) clear = false;
            if (!clear) continue;
            for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
                const i = idx(fx + x, fy + y);
                M.g[i] = T.farm;
                M.t[i] = y % 2 === 0 ? T.crop : T.farm;
                reserved[i] = 2;
            }
        }
    }

    // flowers and ground variety
    for (let y = 1; y < ZH - 1; y++) for (let x = 1; x < ZW - 1; x++) {
        const i = idx(x0 + x, y0 + y);
        if (M.t[i] === T.grass && B.flowers && noise(x0 + x, y0 + y, 3, 5) < B.flowers * 0.9 && hash3(x0 + x, y0 + y, 3) < 0.55) {
            M.t[i] = T.flowers; M.g[i] = T.flowers;
        }
    }

    // a pond or two
    if (B.ponds) {
        for (let k = 0; k < 2; k++) {
            const px = x0 + 3 + Math.floor(rng() * (ZW - 6)), py = y0 + 3 + Math.floor(rng() * (ZH - 6));
            const r = 1 + Math.floor(rng() * 2);
            let clear = true;
            for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 2; x <= r + 2; x++) if (reserved[idx(px + x, py + y)] || M.objs[idx(px + x, py + y)]) clear = false;
            if (!clear) continue;
            for (let y = -r; y <= r; y++) for (let x = -r - 1; x <= r + 1; x++) {
                if (Math.hypot(x * 0.8, y) > r + 0.3) continue;
                const i = idx(px + x, py + y);
                M.t[i] = z.biome === 'peak' ? T.ice : T.water;
                if (z.biome === 'peak') M.g[i] = T.ice;
                reserved[i] = 2;
            }
        }
    }

    // scatter scenery in clumps
    for (let y = 1; y < ZH - 1; y++) for (let x = 1; x < ZW - 1; x++) {
        const wx = x0 + x, wy = y0 + y, i = idx(wx, wy);
        if (reserved[i] || M.objs[i] || TILES[M.t[i]].solid || TILES[M.t[i]].lock) continue;
        const clump = noise(wx, wy, 4, 21);
        let roll = hash3(wx, wy, 31);
        for (const [name, dens] of B.scatter) {
            if (name === 'boulderx') continue;
            const p = dens * (0.35 + clump * 1.6);
            if (roll < p) { M.t[i] = tileId(name); break; }
            roll -= p;
        }
    }
    // trees fill the border of the woods more thickly
    void ground;
}

function placeChest(M, x, y, id, item, n) {
    const i = y * W + x;
    M.t[i] = T.chest;
    M.objs[i] = { kind: 'chest', id, item, n };
}

// Flood from the hub (no grimoires) and carve straight to anything that must be reachable.
function ensureReach(M, z, list, reserved) {
    const hub = hubOf(z);
    if (hub.lake) return;
    const x0 = z.c * ZW, y0 = z.r * ZH;
    const inZ = (x, y) => x >= x0 && y >= y0 && x < x0 + ZW && y < y0 + ZH;
    const walk = (i) => !TILES[M.t[i]].solid && !TILES[M.t[i]].lock;
    for (let pass = 0; pass < 8; pass++) {
        const seen = new Uint8Array(ZW * ZH);
        const q = [[hub.x, hub.y]];
        seen[(hub.y - y0) * ZW + hub.x - x0] = 1;
        while (q.length) {
            const [x, y] = q.pop();
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = x + dx, ny = y + dy;
                if (!inZ(nx, ny)) continue;
                const k = (ny - y0) * ZW + nx - x0;
                if (seen[k] || !walk(ny * W + nx)) continue;
                seen[k] = 1; q.push([nx, ny]);
            }
        }
        const lost = list.filter(([x, y]) => !seen[(y - y0) * ZW + x - x0]);
        if (!lost.length) return;
        for (const [x, y] of lost) {
            // straight L to the hub, clearing scenery (never locks, buildings or chests)
            let cx = x, cy = y;
            while (cx !== hub.x || cy !== hub.y) {
                if (cx !== hub.x && (pass % 2 === 0 || cy === hub.y)) cx += Math.sign(hub.x - cx); else cy += Math.sign(hub.y - cy);
                const i = cy * W + cx;
                const d = TILES[M.t[i]];
                if (d.solid && !d.lock && M.t[i] !== T.bld && M.t[i] !== T.chest && M.t[i] !== T.sign && !(reserved[i] === 2 && M.t[i] !== T.water && M.t[i] !== T.crop)) {
                    M.t[i] = M.g[i] === T.water ? T.sand : M.g[i];
                }
                if (d.solid && (M.t[i] === T.water || M.t[i] === T.crop)) M.t[i] = M.t[i] === T.crop ? T.farm : T.bridge;
                reserved[i] = 1;
            }
        }
    }
}

function placeSpawns(M, z, reserved) {
    const B = BIOMES[z.biome];
    if (!B.foes || z.town) return;
    const rng = makeRng((WORLD_SEED * 3 ^ (z.c * 31 + z.r * 977)) >>> 0);
    const foes = BIOME_FOES[B.foes];
    const n = B.lake ? 2 : 3;
    const x0 = z.c * ZW, y0 = z.r * ZH;
    let placed = 0, tries = 0;
    while (placed < n && tries++ < 300) {
        const x = x0 + 3 + Math.floor(rng() * (ZW - 6)), y = y0 + 3 + Math.floor(rng() * (ZH - 6));
        const i = y * W + x;
        const t = M.t[i];
        const ok = B.lake ? (t === T.water) : (!TILES[t].solid && !TILES[t].lock && t !== T.door);
        if (!ok) continue;
        if (M.spawns.some((s) => Math.hypot(s.x - x, s.y - y) < 5)) continue;
        if (Object.keys(M.warps).some((k) => { const wx = k % W, wy = Math.floor(k / W); return Math.hypot(wx - x, wy - y) < 4; })) continue;
        M.spawns.push({ id: `${z.id}:${placed}`, x: x + 0.5, y: y + 0.5, foes, tier: z.tier, swim: B.lake });
        placed++;
    }
}

// ------------------------------------------------------------------ interiors and dungeons
const CH = {
    '#': 'wall', '.': null, ',': 'rug', ':': 'path', '~': 'water', '=': 'bridge', '^': 'pit',
    T: 'thorn', F: 'fog', B: 'boulder', S: 'stream', t: 'tiny', V: 'sprout', G: 'ghost', R: 'rune', C: 'chasm',
    '*': 'starseal', d: 'dark', D: 'locked',
    s: 'shelf', b: 'bed', h: 'hearth', q: 'table', K: 'counter', o: 'statue', '|': 'pillar', l: 'lamp', L: 'lectern',
    Q: 'counter', r: 'barrel', x: 'crate', p: 'flowerbox', z: 'clutter', M: 'mushroom', Y: 'tree', n: 'kiln', w: 'well',
    u: 'telescope', P: 'pedestal', a: 'anvil',
};

function buildRoom(def, kind) {
    const h = def.rows.length;
    const w = Math.max(...def.rows.map((r) => r.length));
    const floor = tileId(def.floor || 'wood');
    const M = newMap(def.id, w, h, {
        name: def.name, kind, style: def.style, music: def.music, dark: !!def.dark, indoor: true,
        tier: def.tier || 1, shop: def.shop || null, inn: !!def.inn, boss: def.boss || null, def,
    });
    let chestN = 0, lecternN = 0, foeN = 0;
    for (let y = 0; y < h; y++) {
        const row = def.rows[y].padEnd(w, '#');
        for (let x = 0; x < w; x++) {
            const ch = row[x], i = y * w + x;
            M.g[i] = floor;
            M.v[i] = Math.floor(hash3(x, y, def.id.length * 13 + 5) * 256);
            let name = CH[ch];
            if (ch === '@') { M.arrive = { x, y }; name = null; }
            else if (ch === 'X' || ch === '<') {
                M.t[i] = T.door;
                M.warps[i] = { to: kind === 'dungeon' && def.up ? 'library' : 'world', back: true, dir: 'down' };
                M.exit = { x, y };
                continue;
            } else if (ch === 'c' || ch === 'k') {
                const key = ch === 'k';
                const c = key ? { item: 'key' } : (def.chests || [])[chestN++] || { item: 'tea' };
                M.t[i] = T.chest;
                M.objs[i] = { kind: 'chest', id: `${def.id}:${key ? 'key' : 'c' + chestN}`, item: c.item, n: c.n || 1, key, dungeon: def.id };
                continue;
            } else if (ch === 'e') {
                M.spawns.push({ id: `${def.id}:${foeN++}`, x: x + 0.5, y: y + 0.5, foes: def.foes, tier: def.tier });
                name = null;
            } else if (ch === 'E') {
                M.objs[i] = { kind: 'boss', id: def.boss, dungeon: def.id };
                M.t[i] = T.pedestal;
                continue;
            } else if (name === undefined) throw new Error(`${def.id}: unknown '${ch}' at ${x},${y}`);
            if (ch === 'Q') M.objs[i] = { kind: 'returns' };
            if (ch === 'L') M.objs[i] = { kind: 'lectern', n: lecternN++ };
            if (ch === 'b') M.objs[i] = { kind: 'bed' };
            if (ch === 'h' && def.id === 'library') M.objs[i] = { kind: 'hearth' };
            if (ch === 'u') M.objs[i] = { kind: 'telescope' };
            M.t[i] = name ? tileId(name) : floor;
            if (name === 'rug' || name === 'path') M.g[i] = M.t[i];
        }
    }
    if (def.shelves) {
        M.shelves = {};
        for (const y in def.shelves) M.shelves[y] = def.shelves[y];
    }
    for (const wp of def.warps || []) M.warps[wp.y * w + wp.x] = { to: wp.to, need: wp.need, dir: 'down', star: true };
    for (const [id, x, y] of def.npcs || []) M.npcs.push({ id, x, y });
    return M;
}

// ------------------------------------------------------------------ the whole kingdom
let CACHE = null;

export function getWorld() {
    if (CACHE) return CACHE;
    const maps = {};
    const world = buildOverworld();
    maps.world = world;
    for (const d of INTERIORS) maps[d.id] = buildRoom(d, 'interior');
    for (const d of DUNGEONS) maps[d.id] = buildRoom(d, 'dungeon');

    // Link the doors both ways: a building's door leads to its map's arrival point, and the map's
    // way out leads back to the doorstep.
    for (const k in world.warps) {
        const wp = world.warps[k];
        const dest = maps[wp.to];
        if (!dest) throw new Error('door to nowhere: ' + wp.to);
        const dx = k % W, dy = Math.floor(k / W);
        wp.x = dest.arrive.x; wp.y = dest.arrive.y;
        const ex = dest.exit;
        dest.warps[ex.y * dest.w + ex.x] = { to: 'world', x: dx, y: dy + 1, dir: 'down' };
        dest.entrance = { x: dx, y: dy + 1 };
    }
    // the Undercroft: down from the Rotunda's star seal, up the stairs back to it
    const lib = maps.library, uc = maps.undercroft;
    for (const k in lib.warps) {
        const wp = lib.warps[k];
        if (wp.star) { wp.x = uc.arrive.x; wp.y = uc.arrive.y; }
    }
    const star = Object.keys(lib.warps).map(Number).find((k) => lib.warps[k].star);
    uc.warps[uc.exit.y * uc.w + uc.exit.x] = { to: 'library', x: star % lib.w, y: Math.floor(star / lib.w) + 1, dir: 'down' };
    uc.entrance = { x: star % lib.w, y: Math.floor(star / lib.w) + 1 };

    const zoneList = ZONES;
    CACHE = { maps, zones: zoneList, W, H };
    return CACHE;
}

export const zoneAt = (x, y) => ZONE_AT[Math.floor(x / ZW) + ',' + Math.floor(y / ZH)] || null;
