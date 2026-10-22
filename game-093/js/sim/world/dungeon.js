// Dungeon generator: rooms joined by corridors, climbing from the entrance (south) to the boss (north), with water or lava
// pools, chests, wandering monsters, a save crystal and the story anchors the script needs (entrance, mid, boss).

import { makeRng, hashStr } from '../../rng.js';
import { T, WALKABLE } from './tiles.js';
import { LOCS } from './locations.js';
import { ZONES } from '../data/enemies.js';
import { weaponFor, armorFor } from '../data/items.js';

const THEMES = {
    woods: { floor: [T.MOSS, T.MOSS, T.GRASS, T.DIRT], pool: T.SHALLOW, wall: 'hedge', prop: ['tree', 'stump', 'mushroom', 'rock'], light: 0x9fe8a0, ambient: 0x7aaa7a, fog: 0x1c3a22, sky: true },
    mines: { floor: [T.DARK, T.DARK, T.DIRT], pool: T.SHALLOW, wall: 'rock', prop: ['crate', 'cart', 'pillar', 'rock'], light: 0xffb060, ambient: 0x7a7a98, fog: 0x181824 },
    temple: { floor: [T.TEMPLE, T.TEMPLE, T.STONE], pool: T.SHALLOW, wall: 'coral', prop: ['pillar', 'statue', 'urn', 'coral'], light: 0x70d8ff, ambient: 0x5a9aca, fog: 0x0c2c4c },
    pyramid: { floor: [T.SANDSTONE, T.SANDSTONE, T.SAND], pool: T.SAND, wall: 'sandstone', prop: ['pillar', 'statue', 'urn', 'sarcophagus'], light: 0xffc860, ambient: 0xb8924a, fog: 0x3a2610 },
    glacier: { floor: [T.ICEFLOOR, T.ICEFLOOR, T.SNOW], pool: T.ICE, wall: 'ice', prop: ['crystal', 'pillar', 'icicle', 'statue'], light: 0x9fe8ff, ambient: 0x7a9ac8, fog: 0x12263a },
    spire: { floor: [T.DARK, T.DARK, T.DARK], pool: T.LAVA, wall: 'obsidian', prop: ['pillar', 'statue', 'brazier', 'crystal'], light: 0xb070ff, ambient: 0x7a68b8, fog: 0x14102a },
    maw: { floor: [T.ASH, T.ASH, T.DARK], pool: T.LAVA, wall: 'basalt', prop: ['rock', 'brazier', 'pillar', 'bones'], light: 0xff7030, ambient: 0x9a5a42, fog: 0x2c0e0a },
};

export function dungeonTheme(id) { return THEMES[LOCS[id].theme]; }

export function genDungeon(seed, id) {
    const L = LOCS[id], th = THEMES[L.theme];
    const rng = makeRng(hashStr(`${seed}:${id}`));
    const [w, h] = L.size;
    const tile = new Uint8Array(w * h).fill(T.WALL), hgt = new Int8Array(w * h), blk = new Uint8Array(w * h);
    const at = (x, y) => y * w + x;
    const props = [], lights = [], anchors = {}, mobs = [], chests = [], rooms = [];
    const floorTile = () => rng.pick(th.floor);
    const carve = (x, y) => { if (x > 0 && y > 0 && x < w - 1 && y < h - 1) tile[at(x, y)] = floorTile(); };

    // rooms: the boss room first (north), the entrance room (south), the rest scattered between
    const tryRoom = (rw, rh, x0, y0, x1, y1) => {
        for (let k = 0; k < 80; k++) {
            const x = rng.int(x0, x1 - rw), y = rng.int(y0, y1 - rh);
            if (rooms.some((r) => x < r.x + r.w + 3 && x + rw + 3 > r.x && y < r.y + r.h + 3 && y + rh + 3 > r.y)) continue;
            const r = { x, y, w: rw, h: rh, i: rooms.length, cx: x + (rw >> 1), cy: y + (rh >> 1) };
            rooms.push(r); return r;
        }
        return null;
    };
    const boss = tryRoom(11, 9, 6, 3, w - 6, 14) || tryRoom(9, 8, 3, 3, w - 3, 16);
    const entrance = tryRoom(9, 7, 6, h - 14, w - 6, h - 3) || tryRoom(7, 6, 3, h - 14, w - 3, h - 2);
    for (let a = 0; a < 400 && rooms.length < L.rooms; a++) tryRoom(rng.int(6, 10), rng.int(6, 9), 3, 3, w - 3, h - 3);
    // connect: Prim over centre distance, plus a few loops
    const joined = [entrance.i];
    const edges = [];
    const pending = rooms.map((r) => r.i).filter((i) => i !== entrance.i);
    while (pending.length) {
        let best = null;
        for (const a of joined) for (const b of pending) {
            const d = Math.hypot(rooms[a].cx - rooms[b].cx, (rooms[a].cy - rooms[b].cy) * 1.2);
            if (!best || d < best.d) best = { a, b, d };
        }
        edges.push([best.a, best.b]); joined.push(best.b); pending.splice(pending.indexOf(best.b), 1);
    }
    for (let k = 0; k < 3; k++) { const a = rng.int(0, rooms.length - 1), b = rng.int(0, rooms.length - 1); if (a !== b && !edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) edges.push([a, b]); }
    // depth of each room along the tree from the entrance
    const adj = rooms.map(() => []);
    for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
    const depth = rooms.map(() => -1); depth[entrance.i] = 0;
    const order = [entrance.i];
    for (let i = 0; i < order.length; i++) for (const n of adj[order[i]]) if (depth[n] < 0) { depth[n] = depth[order[i]] + 1; order.push(n); }
    const maxD = Math.max(...depth);
    for (const r of rooms) r.level = Math.min(4, Math.round((depth[r.i] / Math.max(1, maxD)) * 4));
    boss.level = Math.max(boss.level, 3);
    // carve rooms
    for (const r of rooms) {
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { carve(x, y); hgt[at(x, y)] = r.level + 1; }
    }
    // corridors, two wide, with a height ramp
    for (const [ai, bi] of edges) {
        const A = rooms[ai], B = rooms[bi];
        const cells = [];
        let x = A.cx, y = A.cy;
        const horizFirst = rng() < 0.5;
        const stepTo = (tx, ty, hz) => {
            while (hz ? x !== tx : y !== ty) { if (hz) x += Math.sign(tx - x); else y += Math.sign(ty - y); cells.push([x, y]); }
        };
        cells.push([x, y]);
        if (horizFirst) { stepTo(B.cx, 0, true); stepTo(0, B.cy, false); } else { stepTo(0, B.cy, false); stepTo(B.cx, 0, true); }
        // cells inside a room keep the room's level; outside, ramp between the two levels
        const inRoom = (cx, cy) => rooms.find((r) => cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h);
        const outside = cells.map((c) => !inRoom(c[0], c[1]));
        const first = outside.indexOf(true), last = outside.lastIndexOf(true);
        const n = Math.max(1, last - first + 1);
        cells.forEach(([cx, cy], k) => {
            for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
                const px = cx + ox, py = cy + oy;
                if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
                if (inRoom(px, py)) continue;
                const i = at(px, py);
                if (WALKABLE[tile[i]] && hgt[i] > 0) continue;
                carve(px, py);
                const t = outside[k] ? (k - first + 0.5) / n : 0;
                hgt[i] = Math.round((A.level + 1) + (B.level - A.level) * Math.min(1, Math.max(0, t)));
            }
        });
    }
    // enforce climbable steps among walkable neighbours
    for (let pass = 0; pass < 60; pass++) {
        let changed = false;
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
            const i = at(x, y); if (!WALKABLE[tile[i]]) continue;
            for (const [dx, dy] of [[1, 0], [0, 1]]) {
                const j = at(x + dx, y + dy); if (!WALKABLE[tile[j]]) continue;
                if (hgt[i] - hgt[j] > 1) { hgt[i] = hgt[j] + 1; changed = true; }
                else if (hgt[j] - hgt[i] > 1) { hgt[j] = hgt[i] + 1; changed = true; }
            }
        }
        if (!changed) break;
    }
    // pools in the bigger rooms (never across the middle row, so the room stays crossable)
    for (const r of rooms) {
        if (r === entrance || r === boss || r.w < 7 || rng() < 0.4) continue;
        const px = rng.int(r.x + 1, r.x + r.w - 3), py = r.y + 1 + (rng() < 0.5 ? 0 : r.h - 3);
        for (let y = py; y < py + 2; y++) for (let x = px; x < px + 2; x++) { if (y < r.y + 1 || y >= r.y + r.h - 1) continue; tile[at(x, y)] = th.pool; hgt[at(x, y)] -= th.pool === T.LAVA ? 1 : 0; }
    }
    // dressing and doors
    const roomFree = (r, x, y) => x > r.x && x < r.x + r.w - 1 && y > r.y && y < r.y + r.h - 1 && tile[at(x, y)] !== th.pool && WALKABLE[tile[at(x, y)]] && !blk[at(x, y)];
    for (const r of rooms) {
        // wall lights along the north wall
        for (let x = r.x + 1; x < r.x + r.w - 1; x += 3) {
            if (tile[at(x, r.y - 1)] === T.WALL) lights.push({ x: x + 0.5, y: r.y - 0.2, z: 1.6, color: th.light, intensity: 2.2, r: 6.5, kind: 'torch', flicker: true });
        }
        const n = rng.int(1, 3);
        for (let k = 0; k < n; k++) {
            const x = rng.pick([r.x + 1, r.x + r.w - 2]), y = rng.pick([r.y + 1, r.y + r.h - 2]);
            if (!roomFree(r, x, y) || (r === entrance && Math.abs(x - r.cx) < 2)) continue;
            const kind = rng.pick(th.prop);
            props.push({ type: 'deco', kind, x, y, seed: Math.floor(rng() * 1e6) }); blk[at(x, y)] = 1;
        }
    }
    // entrance: an exit on the south wall, a save crystal inside
    const ex = entrance.cx, ey = entrance.y + entrance.h;
    tile[at(ex, ey)] = T.STONE; hgt[at(ex, ey)] = hgt[at(ex, ey - 1)]; tile[at(ex - 1, ey)] = T.STONE; hgt[at(ex - 1, ey)] = hgt[at(ex, ey)];
    props.push({ type: 'save', x: entrance.cx + 2, y: entrance.cy, id: `${id}:save` }); blk[at(entrance.cx + 2, entrance.cy)] = 1;
    lights.push({ x: entrance.cx + 2.5, y: entrance.cy + 0.5, z: 1.2, color: 0x80d8ff, intensity: 2.5, r: 7, kind: 'crystal' });
    props.push({ type: 'portal', x: ex - 1, y: ey, w: 2 });
    anchors.entrance = [entrance.cx, entrance.cy + 1]; anchors.exit = [ex, ey];
    anchors.boss = [boss.cx, boss.cy - 2];
    // chests: stronger the deeper they are
    const tier = Math.min(5, Math.floor((L.rec || 1) / 8));
    const chestRooms = rooms.filter((r) => r !== entrance && r !== boss).sort(() => rng() - 0.5).slice(0, Math.max(3, Math.floor(rooms.length * 0.5)));
    chestRooms.forEach((r, k) => {
        const cands = [[r.x + 1, r.y + 1], [r.x + r.w - 2, r.y + 1], [r.x + 1, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2]].filter(([x, y]) => roomFree(r, x, y));
        if (!cands.length) return;
        const [x, y] = rng.pick(cands);
        const loot = lootFor(rng, tier, k);
        const locked = k % 4 === 3;
        const c = { type: 'chest', x, y, id: `${id}:c${k}`, loot, locked: locked ? 'mira' : null, depth: depth[r.i] };
        props.push(c); chests.push(c); blk[at(x, y)] = 1;
    });
    // cracked wall nooks (Brom): a treasure cell behind a wall in two rooms
    const nookRooms = rooms.filter((r) => r !== entrance && r !== boss && r.w >= 7).slice(0, 2);
    nookRooms.forEach((r, k) => {
        const x = r.x + (r.w >> 1) + k, y = r.y - 1;
        if (y < 3 || tile[at(x, y)] !== T.WALL || tile[at(x, y - 1)] !== T.WALL || tile[at(x, y - 2)] !== T.WALL) return;
        // a 1-tile cell two tiles north, closed by a cracked wall
        tile[at(x, y - 1)] = th.floor[0]; hgt[at(x, y - 1)] = hgt[at(x, y + 1)];
        const c = { type: 'chest', x, y: y - 1, id: `${id}:n${k}`, loot: lootFor(rng, tier + 1, 9 + k), locked: null, nook: true };
        props.push(c); chests.push(c); blk[at(x, y - 1)] = 1;
        props.push({ type: 'crack', x, y, id: `${id}:crack${k}` }); blk[at(x, y)] = 2;
        tile[at(x, y)] = T.DARK; hgt[at(x, y)] = hgt[at(x, y + 1)];
    });
    // the story's middle: a room about halfway along the main path
    const mainPath = pathRooms(adj, entrance.i, boss.i);
    const midRoom = rooms[mainPath[Math.floor(mainPath.length / 2)]];
    anchors.mid = [midRoom.cx, midRoom.cy];
    // monsters: one or two pairs in every room but the entrance, the boss room and the hush around the middle
    const zone = ZONES[L.zone];
    for (const r of rooms) {
        if (r === entrance || r === boss) continue;
        const n = r.w * r.h > 50 ? 2 : 1;
        for (let k = 0; k < n; k++) {
            const x = rng.int(r.x + 1, r.x + r.w - 2) + 0.5, y = rng.int(r.y + 1, r.y + r.h - 2) + 0.5;
            if (!roomFree(r, x | 0, y | 0)) continue;
            if (r === midRoom && Math.hypot(x - midRoom.cx, y - midRoom.cy) < 3) continue;
            const kinds = rng.pick(zone.forms);
            const form = kinds.map((kind) => ({ kind, lvl: rng.int(zone.lvl[0], zone.lvl[1]) }));
            mobs.push({ id: `${id}:m${mobs.length}`, x, y, hx: x, hy: y, form, state: 'wander', t: rng() * 3, dir: 'down', room: r.i, face: ZONES_FACE(kinds), speed: 1.2 });
        }
    }
    // a few sparkles for the quest pickups
    const spots = rooms.filter((r) => r !== entrance && r !== boss).map((r) => [r.x + 1 + rng.int(0, Math.max(0, r.w - 3)), r.y + 1 + rng.int(0, Math.max(0, r.h - 3))]).filter(([x, y]) => WALKABLE[tile[at(x, y)]] && !blk[at(x, y)]);
    anchors.spots = spots;
    // flood the lower pools' neighbours with decor so that the walls have something to say
    return {
        id, kind: 'dungeon', name: L.name, theme: L.theme, w, h, tile, hgt, blk, props, lights, anchors, mobs, chests, rooms, depth,
        exits: [{ x: ex - 1, y: ey + 0, to: 'over', w: 2, h: 1, dy: 0 }], npcs: [], spawn: [entrance.cx + 0.5, entrance.cy + 1.5], music: 'dungeon', th, zone: L.zone, bossRoom: boss, midRoom,
    };
}

const ZONES_FACE = (kinds) => kinds[0];

function pathRooms(adj, a, b) {
    const prev = new Map([[a, -1]]); const q = [a];
    for (let i = 0; i < q.length; i++) for (const n of adj[q[i]]) if (!prev.has(n)) { prev.set(n, q[i]); q.push(n); }
    const out = []; for (let c = b; c !== -1 && c !== undefined; c = prev.get(c)) out.push(c);
    return out.reverse();
}

const LOOT_GOLD = [60, 120, 260, 520, 1000, 1800];
function lootFor(rng, tier, k) {
    const t = Math.max(0, Math.min(5, tier));
    const r = rng();
    if (k >= 9) {
        const pick = rng.pick(['weapon', 'armor', 'charm']);
        if (pick === 'weapon') return { item: weaponFor(rng.pick(['sword', 'spear', 'bow', 'axe', 'dagger', 'staff', 'tome']), t), n: 1 };
        if (pick === 'armor') return { item: armorFor(rng.pick(['cloth', 'light', 'heavy']), t), n: 1 };
        return { item: rng.pick(['c_power', 'c_mage', 'c_guard', 'c_boots', 'c_vital', 'c_mana', 'c_hero']), n: 1 };
    }
    if (r < 0.28) return { gold: Math.round(LOOT_GOLD[t] * (0.7 + rng() * 0.8)) };
    if (r < 0.52) return { item: rng.pick(t >= 3 ? ['hiPotion', 'xPotion', 'hiEther'] : t >= 1 ? ['potion', 'hiPotion', 'ether'] : ['potion', 'antidote']), n: rng.int(1, 3) };
    if (r < 0.66) return { item: 'phoenixDown', n: 1 };
    if (r < 0.78) return { item: rng.pick(['fireOrb', 'iceOrb', 'boltOrb']), n: rng.int(1, 2) };
    if (r < 0.86 && t >= 1) return { item: rng.pick(['hpSeed', 'mpSeed', 'powerSeed']), n: 1 };
    if (r < 0.93) return { item: weaponFor(rng.pick(['sword', 'spear', 'bow', 'axe', 'dagger', 'staff', 'tome']), t - (rng() < 0.5 ? 1 : 0)), n: 1 };
    return { item: rng.pick(['c_power', 'c_mage', 'c_guard', 'c_boots', 'c_antivenom', 'c_wake']), n: 1 };
}
