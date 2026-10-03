/**
 * gen.js — procedural level generator. Pure: no three.js, no DOM, no
 * Math.random. Same (spec, seed) → same level, byte for byte.
 *
 * The level is a grid of 2 m cells (x across, y = world z). Every open cell
 * has its own floor and ceiling height, which is all a DOOM-style map needs:
 * stairs, raised daises, sunken lava pits, crates you can shoot over and
 * open-air courtyards all fall out of per-cell heights.
 *
 * Pipeline:
 *   1. scatter rectangular rooms with a 3-cell margin
 *   2. minimum spanning tree over room centres, carve each edge with A*
 *      (corridors never touch other rooms or corridors, so the room graph
 *      is exactly the tree we asked for)
 *   3. start = one end of the tree's diameter, exit = the other
 *   4. lock 0–3 tree edges on the start→exit path; keys go in the zone
 *      before each lock (zones = components after removing locked edges)
 *   5. heights by walking the tree, constrained by corridor length so that
 *      every stair step stays under STEP
 *   6. extra loop corridors, only inside one zone (so locks still gate)
 *   7. room features (pillars, lava pits, daises, crates, platforms, sky)
 *      with a connectivity check that reverts anything that cuts a room off
 *   8. secret closets behind fake walls
 *   9. lights, monsters, ambushes, pickups, barrels, terminals, decor
 *  10. validate by playing it: flood fill from the start, picking up keys
 *      and opening doors, must reach the exit, every key and every pickup.
 *      If not, try again with the next attempt seed.
 */
import { makeRng, subSeed } from '../rng.js';
import { STEP, KEY_ORDER } from '../config.js';
import { ARCHETYPES } from '../game/bestiary.js';

export const HEADROOM = 1.95;

// cell kinds
export const K_PLAIN = 0, K_CRATE = 1, K_DAIS = 2, K_LIQUID = 3, K_CORRIDOR = 4, K_PAD = 5, K_DOOR = 6;
// wall texture variants (for rock cells)
export const W_MAIN = 0, W_ALT = 1, W_PILLAR = 2, W_SECRET = 3, W_EXIT = 4, W_TERMINAL = 5, W_CORRIDOR = 6;

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const MONSTER_WEIGHT = { husk: 10, imp: 9, hound: 6, wisp: 4, gazer: 4, skitter: 4, brute: 2.6, revenant: 2.6, hierophant: 1, juggernaut: 0.35 };

/**
 * @param spec  level spec from story.js (or a generated Descent spec)
 * @param seed  run seed
 * @param opts  { depth: 1-based level number for scaling, difficulty, arsenal: [weapon ids the player is expected to own] }
 */
export function generateLevel(spec, seed, opts = {}) {
    let lastErr = null;
    for (let attempt = 0; attempt < 60; attempt++) {
        const rng = makeRng(subSeed(seed, spec.id, attempt));
        try {
            const L = tryGenerate(spec, rng, opts);
            const v = validate(L);
            if (v.ok) { L.attempt = attempt; L.seed = seed; return L; }
            lastErr = v.reason;
        } catch (e) {
            if (!(e instanceof GenFail)) throw e;
            lastErr = e.message;
        }
    }
    throw new Error(`level generation failed for ${spec.id}: ${lastErr}`);
}

class GenFail extends Error {}

function tryGenerate(spec, rng, opts) {
    const W = spec.size, H = spec.size, N = W * H;
    const depth = opts.depth ?? 1;
    const diff = opts.difficulty ?? { count: 1, ammo: 1 };
    const L = {
        id: spec.id, name: spec.name, theme: spec.theme, W, H,
        open: new Uint8Array(N), floor: new Float32Array(N), ceil: new Float32Array(N),
        sky: new Uint8Array(N), liquid: new Uint8Array(N), kind: new Uint8Array(N),
        region: new Int16Array(N).fill(-1), door: new Int16Array(N).fill(-1), wtex: new Uint8Array(N),
        rooms: [], corridors: [], doors: [], things: [], lights: [], secrets: [],
        start: null, exit: null, stats: { monsters: 0, items: 0, secrets: 0 },
    };
    const idx = (x, y) => y * W + x;
    const inb = (x, y) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1;

    // ---------------------------------------------------------------- 1. rooms
    const target = spec.rooms;
    const rooms = L.rooms;
    const wantBig = !!spec.boss;
    for (let tries = 0; tries < 900 && rooms.length < target; tries++) {
        let w, h;
        if (spec.arena && rooms.length === 0) { w = h = Math.min(W - 14, 20); }
        else if (wantBig && rooms.length === 0) { w = rng.int(13, 16); h = rng.int(13, 16); }
        else if (rng.chance(0.18)) { w = rng.int(10, 14); h = rng.int(9, 13); }
        else { w = rng.int(5, 10); h = rng.int(5, 9); }
        if (spec.arena && rooms.length > 0) { w = rng.int(5, 7); h = rng.int(5, 7); }
        let x, y;
        if (spec.arena && rooms.length === 0) { x = (W - w) >> 1; y = (H - h) >> 1; }
        else { x = rng.int(2, W - w - 2); y = rng.int(2, H - h - 2); }
        let ok = true;
        for (const r of rooms) {
            if (x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y) { ok = false; break; }
        }
        if (!ok) continue;
        rooms.push({ id: rooms.length, x, y, w, h, cx: x + w / 2, cy: y + h / 2, floor: 0, ceil: 4, sky: 0, zone: 0, feature: 'plain', kind: 'normal', links: [], entries: [], cells: [] });
    }
    if (rooms.length < Math.max(3, Math.floor(target * 0.7))) throw new GenFail('too few rooms');

    for (const r of rooms) {
        for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) {
            const i = idx(xx, yy);
            L.open[i] = 1; L.region[i] = r.id; r.cells.push(i);
        }
    }

    // reserved[]: 1 = room or its 8-ring, 2 = corridor or its 8-ring
    const reserved = new Uint8Array(N);
    const ringOf = new Int16Array(N).fill(-1);
    for (const r of rooms) {
        for (let yy = r.y - 1; yy <= r.y + r.h; yy++) for (let xx = r.x - 1; xx <= r.x + r.w; xx++) {
            const i = idx(xx, yy);
            reserved[i] = 1;
            if (L.region[i] !== r.id) ringOf[i] = r.id;
        }
    }

    // ---------------------------------------------------------------- 2. MST + corridors
    const edges = [];
    {
        const inTree = new Set([0]);
        while (inTree.size < rooms.length) {
            let best = null, bd = Infinity;
            for (const a of inTree) for (const b of rooms) {
                if (inTree.has(b.id)) continue;
                const d = Math.hypot(rooms[a].cx - b.cx, rooms[a].cy - b.cy) * rng.range(0.85, 1.15);
                if (d < bd) { bd = d; best = [a, b.id]; }
            }
            inTree.add(best[1]);
            edges.push(best);
        }
    }

    const noise = new Float32Array(N);
    for (let i = 0; i < N; i++) noise[i] = rng() * 0.6;

    function doorCandidates(r) {
        const out = [];
        for (let xx = r.x + 1; xx < r.x + r.w - 1; xx++) { out.push([xx, r.y - 1, 0, -1]); out.push([xx, r.y + r.h, 0, 1]); }
        for (let yy = r.y + 1; yy < r.y + r.h - 1; yy++) { out.push([r.x - 1, yy, -1, 0]); out.push([r.x + r.w, yy, 1, 0]); }
        return out.filter(([cx, cy]) => {
            if (!inb(cx, cy)) return false;
            // keep doors away from other corridors (8-neighbourhood)
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const j = idx(cx + dx, cy + dy);
                if (L.region[j] === -2 || L.region[j] === -3) return false;
            }
            return true;
        });
    }

    function carve(aId, bId, maxLen = Infinity) {
        const A = rooms[aId], B = rooms[bId];
        const srcs = doorCandidates(A), tgts = doorCandidates(B);
        if (!srcs.length || !tgts.length) return null;
        const tgtSet = new Map();
        for (const t of tgts) tgtSet.set(idx(t[0], t[1]), t);
        const g = new Float32Array(N).fill(Infinity);
        const from = new Int32Array(N).fill(-1);
        const dirAt = new Int8Array(N).fill(-1);
        const heap = new MinHeap();
        const hfn = (x, y) => {
            const dx = Math.max(B.x - 1 - x, 0, x - (B.x + B.w)), dy = Math.max(B.y - 1 - y, 0, y - (B.y + B.h));
            return dx + dy;
        };
        for (const [sx, sy, ox, oy] of srcs) {
            const i = idx(sx, sy);
            g[i] = 0; from[i] = -2;
            dirAt[i] = ox !== 0 ? (ox > 0 ? 0 : 1) : (oy > 0 ? 2 : 3);
            heap.push(i, hfn(sx, sy));
        }
        let found = -1;
        while (heap.size) {
            const i = heap.pop();
            const x = i % W, y = (i / W) | 0;
            if (tgtSet.has(i) && from[i] !== -2) { found = i; break; }
            // from a source door, only step straight out of the room
            const dirs = from[i] === -2 ? [dirAt[i]] : [0, 1, 2, 3];
            for (const d of dirs) {
                const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
                if (!inb(nx, ny)) continue;
                const j = idx(nx, ny);
                const isT = tgtSet.has(j);
                if (isT) {
                    // must enter the target door heading into the room
                    const t = tgtSet.get(j);
                    if (DIRS[d][0] !== -t[2] || DIRS[d][1] !== -t[3]) continue;
                } else if (reserved[j]) continue;
                const turn = dirAt[i] >= 0 && dirAt[i] !== d ? 0.7 : 0;
                const ng = g[i] + 1 + turn + noise[j];
                if (ng < g[j]) {
                    g[j] = ng; from[j] = i; dirAt[j] = d;
                    heap.push(j, ng + hfn(nx, ny));
                }
            }
        }
        if (found < 0) return null;
        const path = [];
        for (let i = found; i !== -2; i = from[i]) { path.push(i); if (from[i] === -2) break; }
        path.reverse();
        if (path.length > maxLen) return null;
        const c = { id: L.corridors.length, a: aId, b: bId, cells: path, locked: null, doorA: null, doorB: null };
        for (const i of path) {
            L.open[i] = 1; L.region[i] = -2; L.kind[i] = K_CORRIDOR;
        }
        for (const i of path) {
            const x = i % W, y = (i / W) | 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) reserved[idx(x + dx, y + dy)] |= 2;
        }
        L.corridors.push(c);
        A.links.push({ room: bId, cor: c.id });
        B.links.push({ room: aId, cor: c.id });
        return c;
    }

    edges.sort((e1, e2) => {
        const d1 = Math.hypot(rooms[e1[0]].cx - rooms[e1[1]].cx, rooms[e1[0]].cy - rooms[e1[1]].cy);
        const d2 = Math.hypot(rooms[e2[0]].cx - rooms[e2[1]].cx, rooms[e2[0]].cy - rooms[e2[1]].cy);
        return d1 - d2;
    });
    // Carve the tree. If an edge can't be routed, try linking that room to
    // any other room already in the same tree component.
    const comp = rooms.map((r) => r.id);
    const find = (a) => (comp[a] === a ? a : (comp[a] = find(comp[a])));
    for (const [a, b] of edges) {
        if (find(a) === find(b)) continue;
        let c = carve(a, b);
        if (!c) {
            const cands = rooms.filter((r) => find(r.id) === find(a) && r.id !== a)
                .sort((p, q) => Math.hypot(p.cx - rooms[b].cx, p.cy - rooms[b].cy) - Math.hypot(q.cx - rooms[b].cx, q.cy - rooms[b].cy));
            for (const r of cands) { c = carve(r.id, b); if (c) break; }
        }
        if (!c) throw new GenFail('could not route corridor');
        comp[find(a)] = find(b);
    }
    // anything still disconnected → give up this attempt
    for (const r of rooms) if (find(r.id) !== find(0)) throw new GenFail('disconnected');

    // ---------------------------------------------------------------- 3. start / exit
    const treeAdj = rooms.map((r) => r.links.map((l) => l.room));
    const bfsTree = (s) => {
        const dist = new Array(rooms.length).fill(-1), par = new Array(rooms.length).fill(-1);
        dist[s] = 0; const q = [s];
        while (q.length) { const a = q.shift(); for (const b of treeAdj[a]) if (dist[b] < 0) { dist[b] = dist[a] + 1; par[b] = a; q.push(b); } }
        return { dist, par };
    };
    let s0 = rng.int(0, rooms.length - 1);
    let dd = bfsTree(s0).dist;
    let startId = dd.indexOf(Math.max(...dd));
    if (spec.boss || spec.arena) {
        // start away from the big room; the big room is the exit
        const big = spec.arena || spec.boss ? 0 : null;
        const dBig = bfsTree(big).dist;
        startId = dBig.indexOf(Math.max(...dBig));
    }
    const fromStart = bfsTree(startId);
    let exitId = fromStart.dist.indexOf(Math.max(...fromStart.dist));
    if (spec.boss || spec.arena) exitId = 0;
    if (startId === exitId) throw new GenFail('start is exit');
    rooms[startId].kind = 'start';
    rooms[exitId].kind = 'exit';
    L.startRoom = startId; L.exitRoom = exitId;

    // main path
    const mainPath = [];
    for (let r = exitId; r !== -1; r = fromStart.par[r]) mainPath.push(r);
    mainPath.reverse();
    const onMain = new Set(mainPath);

    // ---------------------------------------------------------------- 4. locks + zones
    const nKeys = Math.min(spec.keys ?? 0, mainPath.length - 1, 3);
    const lockEdges = [];   // {a, b, cor, key}
    if (nKeys > 0) {
        const P = mainPath.length - 1;
        const used = new Set();
        for (let k = 0; k < nKeys; k++) {
            let pos = Math.round((P * (k + 1)) / (nKeys + 1));
            pos = Math.min(P - 1, Math.max(0, pos));
            while (used.has(pos) && pos < P - 1) pos++;
            if (used.has(pos)) throw new GenFail('lock spacing');
            used.add(pos);
            lockEdges.push({ a: mainPath[pos], b: mainPath[pos + 1], key: KEY_ORDER[k], pos });
        }
        lockEdges.sort((p, q) => p.pos - q.pos);
        lockEdges.forEach((e, k) => { e.key = KEY_ORDER[k]; });
    }
    const isLocked = (a, b) => lockEdges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
    // zones: flood from start without crossing locks; lock k leads into zone k+1
    {
        const zone = new Array(rooms.length).fill(-1);
        const flood = (s, z) => {
            const q = [s]; zone[s] = z;
            while (q.length) {
                const a = q.shift();
                for (const b of treeAdj[a]) if (zone[b] < 0 && !isLocked(a, b)) { zone[b] = z; q.push(b); }
            }
        };
        flood(startId, 0);
        lockEdges.forEach((e, k) => flood(e.b, k + 1));
        for (const r of rooms) { if (zone[r.id] < 0) throw new GenFail('zone'); r.zone = zone[r.id]; }
    }
    for (const c of L.corridors) {
        const e = isLocked(c.a, c.b);
        if (e) c.locked = e.key;
    }

    // ---------------------------------------------------------------- 5. heights
    const roomDepth = fromStart.dist;
    {
        const order = [...rooms].sort((p, q) => roomDepth[p.id] - roomDepth[q.id]);
        for (const r of order) {
            if (r.id === startId) { r.floor = 0; continue; }
            const parent = fromStart.par[r.id];
            const link = r.links.find((l) => l.room === parent);
            const len = L.corridors[link.cor].cells.length;
            const maxD = Math.max(0, Math.floor(len - 1) * 0.25);
            const steps = [-1.5, -1, -0.75, -0.5, -0.25, 0, 0, 0.25, 0.5, 0.75, 1, 1.5];
            let d = rng.pick(steps);
            d = Math.max(-maxD, Math.min(maxD, d));
            r.floor = Math.max(-3, Math.min(4, rooms[parent].floor + d));
            r.floor = Math.round(r.floor * 4) / 4;
        }
        for (const r of rooms) {
            const big = r.w * r.h > 90;
            r.ceil = r.floor + (big ? rng.range(5.5, 8) : rng.range(3.6, 5.6));
            if (spec.theme !== 'station' || big) {
                const skyChance = { station: 0.25, foundry: 0.35, hell: 0.5, throne: 1 }[spec.theme] ?? 0.3;
                if ((big && rng.chance(skyChance + 0.25)) || rng.chance(skyChance * 0.4) || (spec.arena && r.id === 0)) r.sky = 1;
            }
            if (spec.theme === 'station' && big && rng.chance(0.35)) r.sky = 1;
            if (r.sky) r.ceil = r.floor + rng.range(10, 14);
            for (const i of r.cells) { L.floor[i] = r.floor; L.ceil[i] = r.ceil; L.sky[i] = r.sky; }
        }
    }

    // ---------------------------------------------------------------- 6. loops (same zone only)
    {
        const want = Math.round(rooms.length * (spec.arena ? 0.6 : 0.3));
        let made = 0;
        const pairs = [];
        for (const a of rooms) for (const b of rooms) {
            if (a.id >= b.id || a.zone !== b.zone) continue;
            if (a.links.some((l) => l.room === b.id)) continue;
            const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
            if (d < 26) pairs.push([a.id, b.id, d + rng() * 6]);
        }
        pairs.sort((p, q) => p[2] - q[2]);
        for (const [a, b] of pairs) {
            if (made >= want) break;
            const dh = Math.abs(rooms[a].floor - rooms[b].floor);
            const minLen = Math.ceil(dh / 0.25) + 1;
            const c = carve(a, b, Infinity);
            if (!c) continue;
            if (c.cells.length < minLen) {
                // too short for the height difference: undo
                for (const i of c.cells) { L.open[i] = 0; L.region[i] = -1; L.kind[i] = 0; }
                L.corridors.pop();
                rooms[a].links.pop(); rooms[b].links.pop();
                // reserved stays marked — harmless, only blocks later corridors
                continue;
            }
            c.loop = true;
            made++;
        }
    }

    // ---------------------------------------------------------------- corridor heights + doors
    for (const c of L.corridors) {
        const A = rooms[c.a], B = rooms[c.b], n = c.cells.length;
        // orient: cells[0] touches A
        const first = c.cells[0];
        const touchesA = DIRS.some(([dx, dy]) => L.region[first + dx + dy * W] === A.id);
        if (!touchesA) c.cells.reverse();
        for (let k = 0; k < n; k++) {
            const t = n === 1 ? 0 : k / (n - 1);
            let h = A.floor + (B.floor - A.floor) * t;
            h = Math.round(h * 4) / 4;
            if (k === 0) h = A.floor;
            if (k === n - 1) h = B.floor;
            const i = c.cells[k];
            L.floor[i] = h;
            L.ceil[i] = h + 3.1;
        }
        // doors at the ends
        const mkDoor = (cell, roomId, key) => {
            const x = cell % W, y = (cell / W) | 0;
            const r = rooms[roomId];
            // corridor runs along x if the room is to the left/right
            const alongX = L.region[cell + 1] === roomId || L.region[cell - 1] === roomId;
            L.region[cell] = -3; L.kind[cell] = K_DOOR;
            L.ceil[cell] = L.floor[cell] + 2.9;
            const d = { id: L.doors.length, cell, x, y, alongX, key: key ?? null, secret: false, room: roomId, open: 0 };
            L.door[cell] = d.id;
            L.doors.push(d);
            r.entries.push(cell);
            return d;
        };
        const lockKey = c.locked;
        // locked corridors get the locked door on the far side (towards the next zone)
        const zA = A.zone, zB = B.zone;
        const lockAtB = lockKey && zB > zA;
        const wantA = lockKey ? !lockAtB : rng.chance(0.55);
        const wantB = lockKey ? lockAtB : rng.chance(0.55);
        c.doorA = wantA ? mkDoor(c.cells[0], A.id, lockKey && !lockAtB ? lockKey : null) : null;
        c.doorB = wantB ? mkDoor(c.cells[n - 1], B.id, lockAtB ? lockKey : null) : null;
        if (!c.doorA) A.entries.push(c.cells[0]);
        if (!c.doorB) B.entries.push(c.cells[n - 1]);
    }

    // ---------------------------------------------------------------- 7. room features
    const entryInterior = (r) => r.entries.map((e) => {
        for (const [dx, dy] of DIRS) { const j = e + dx + dy * W; if (L.region[j] === r.id) return j; }
        return -1;
    }).filter((j) => j >= 0);

    function roomConnected(r) {
        const ent = entryInterior(r);
        if (!ent.length) return true;
        const seen = new Set([ent[0]]);
        const q = [ent[0]];
        while (q.length) {
            const a = q.shift();
            for (const [dx, dy] of DIRS) {
                const b = a + dx + dy * W;
                if (seen.has(b) || L.region[b] !== r.id || !L.open[b]) continue;
                if (Math.abs(L.floor[b] - L.floor[a]) > STEP) continue;
                seen.add(b); q.push(b);
            }
        }
        if (!ent.every((e) => seen.has(e))) return false;
        let walk = 0;
        for (const i of r.cells) if (L.open[i] && L.kind[i] !== K_CRATE) walk++;
        return seen.size >= walk * 0.8;
    }

    const snapshot = (r) => r.cells.map((i) => [i, L.open[i], L.floor[i], L.kind[i], L.liquid[i], L.wtex[i]]);
    const restore = (snap) => { for (const [i, o, f, k, l, w] of snap) { L.open[i] = o; L.floor[i] = f; L.kind[i] = k; L.liquid[i] = l; L.wtex[i] = w; } };
    const nearEntry = (i, r, dist = 1) => {
        const x = i % W, y = (i / W) | 0;
        return r.entries.some((e) => Math.abs((e % W) - x) <= dist && Math.abs(((e / W) | 0) - y) <= dist);
    };

    const FEATURES = {
        pillars(r) {
            if (r.w < 7 || r.h < 7) return false;
            const sp = r.w * r.h > 120 ? 4 : 3;
            for (let yy = r.y + 2; yy < r.y + r.h - 2; yy += sp) for (let xx = r.x + 2; xx < r.x + r.w - 2; xx += sp) {
                const i = idx(xx, yy);
                if (nearEntry(i, r, 2)) continue;
                L.open[i] = 0; L.wtex[i] = W_PILLAR;
            }
            return true;
        },
        pit(r) {
            if (r.w < 7 || r.h < 7) return false;
            const m = 2;
            const deep = rng.chance(0.5) ? -0.5 : -0.25;
            const bridge = r.w >= 9 && rng.chance(0.6);
            const by = r.y + (r.h >> 1);
            for (let yy = r.y + m; yy < r.y + r.h - m; yy++) for (let xx = r.x + m; xx < r.x + r.w - m; xx++) {
                const i = idx(xx, yy);
                if (bridge && yy === by) continue;
                L.floor[i] = r.floor + deep; L.liquid[i] = 1; L.kind[i] = K_LIQUID;
            }
            return true;
        },
        dais(r) {
            if (r.w < 8 || r.h < 8) return false;
            for (let yy = r.y + 2; yy < r.y + r.h - 2; yy++) for (let xx = r.x + 2; xx < r.x + r.w - 2; xx++) {
                const i = idx(xx, yy);
                const inner = xx >= r.x + 3 && xx < r.x + r.w - 3 && yy >= r.y + 3 && yy < r.y + r.h - 3;
                L.floor[i] = r.floor + (inner ? 1.0 : 0.5); L.kind[i] = K_DAIS;
            }
            return true;
        },
        crates(r) {
            const n = Math.max(2, Math.round(r.w * r.h / 16));
            let placed = 0;
            for (let t = 0; t < n * 4 && placed < n; t++) {
                const xx = rng.int(r.x + 1, r.x + r.w - 2), yy = rng.int(r.y + 1, r.y + r.h - 2);
                const sw = rng.chance(0.4) ? 2 : 1, sh = rng.chance(0.4) ? 2 : 1;
                const hgt = rng.pick([1.0, 1.25, 1.5]);
                const cells = [];
                for (let a = 0; a < sh; a++) for (let b = 0; b < sw; b++) {
                    const x2 = xx + b, y2 = yy + a;
                    if (x2 >= r.x + r.w - 1 || y2 >= r.y + r.h - 1) continue;
                    const i = idx(x2, y2);
                    if (L.kind[i] !== K_PLAIN || nearEntry(i, r, 1)) continue;
                    cells.push(i);
                }
                for (const i of cells) { L.floor[i] = r.floor + hgt; L.kind[i] = K_CRATE; }
                if (cells.length) placed++;
            }
            return placed > 0;
        },
        platform(r) {
            // a raised walkway along one wall with a two-step stair at one end
            const sides = rng.shuffle([0, 1, 2, 3]);
            for (const side of sides) {
                const horiz = side < 2;
                const len = horiz ? r.w : r.h;
                if (len < 6) continue;
                const cellAt = (k, dep) => {
                    if (side === 0) return idx(r.x + k, r.y + dep);
                    if (side === 1) return idx(r.x + k, r.y + r.h - 1 - dep);
                    if (side === 2) return idx(r.x + dep, r.y + k);
                    return idx(r.x + r.w - 1 - dep, r.y + k);
                };
                // longest run not near an entry
                let best = [0, -1], cur = 0;
                for (let k = 0; k <= len; k++) {
                    const ok = k < len && !nearEntry(cellAt(k, 0), r, 2) && !nearEntry(cellAt(k, 1), r, 2);
                    if (ok) { cur++; if (cur > best[1] - best[0] + 1) best = [k - cur + 1, k]; }
                    else cur = 0;
                }
                const runLen = best[1] - best[0] + 1;
                if (runLen < 5) continue;
                const hgt = rng.pick([1.0, 1.5]);
                const stairAtStart = rng.chance(0.5);
                for (let k = best[0]; k <= best[1]; k++) {
                    const ord = stairAtStart ? k - best[0] : best[1] - k;
                    let h = hgt;
                    if (hgt === 1.0) { if (ord === 0) h = 0.5; }
                    else { if (ord === 0) h = 0.5; else if (ord === 1) h = 1.0; }
                    for (let dep = 0; dep < 2; dep++) {
                        const i = cellAt(k, dep);
                        L.floor[i] = r.floor + h; L.kind[i] = K_DAIS;
                    }
                }
                r.platform = { side, hgt };
                return true;
            }
            return false;
        },
        arena(r) {
            // ring of pillars + four lava pools + a central dais
            const cx = r.x + (r.w >> 1), cy = r.y + (r.h >> 1);
            const rad = Math.min(r.w, r.h) / 2 - 3;
            for (let a = 0; a < 12; a++) {
                const ang = (a / 12) * Math.PI * 2;
                const xx = Math.round(cx + Math.cos(ang) * rad), yy = Math.round(cy + Math.sin(ang) * rad);
                const i = idx(xx, yy);
                if (L.region[i] === r.id && !nearEntry(i, r, 2)) { L.open[i] = 0; L.wtex[i] = W_PILLAR; }
            }
            for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) {
                    const i = idx(cx + qx * Math.round(rad * 0.55) + xx, cy + qy * Math.round(rad * 0.55) + yy);
                    if (L.region[i] === r.id && L.open[i]) { L.floor[i] = r.floor - 0.5; L.liquid[i] = 1; L.kind[i] = K_LIQUID; }
                }
            }
            for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) {
                const i = idx(cx + xx, cy + yy);
                const inner = Math.abs(xx) <= 1 && Math.abs(yy) <= 1;
                L.floor[i] = r.floor + (inner ? 1.0 : 0.5); L.kind[i] = K_DAIS;
            }
            return true;
        },
    };

    for (const r of rooms) {
        let opts2;
        if (spec.arena && r.id === 0) opts2 = ['arena'];
        else if (r.kind === 'start') opts2 = rng.chance(0.5) ? ['plain'] : ['crates'];
        else if (r.kind === 'exit' && spec.boss) opts2 = rng.pick([['pillars'], ['pit', 'pillars'], ['dais'], ['pillars', 'crates']]);
        else {
            const table = [
                { w: 2, f: ['plain'] }, { w: 3, f: ['pillars'] }, { w: 3, f: ['pit'] }, { w: 2, f: ['dais'] },
                { w: 3, f: ['crates'] }, { w: 3, f: ['platform'] }, { w: 1.5, f: ['platform', 'crates'] },
                { w: 1.2, f: ['pit', 'platform'] }, { w: 1, f: ['pillars', 'crates'] },
            ];
            if (spec.theme === 'foundry' || spec.theme === 'hell') table[2].w += 2;
            opts2 = rng.weighted(table).f;
        }
        for (const f of opts2) {
            if (f === 'plain') continue;
            const snap = snapshot(r);
            const ok = FEATURES[f](r);
            if (!ok || !roomConnected(r)) restore(snap);
            else r.feature = r.feature === 'plain' ? f : r.feature + '+' + f;
        }
    }

    // cells right in front of an entry must be plain floor at room height
    for (const r of rooms) for (const j of entryInterior(r)) {
        if (L.floor[j] !== r.floor || !L.open[j]) throw new GenFail('entry blocked');
    }

    // ---------------------------------------------------------------- 8. secrets
    {
        const wantSecrets = spec.arena ? 1 : rng.int(1, 3);
        const candRooms = rng.shuffle(rooms.filter((r) => r.kind !== 'start' || rooms.length < 5));
        for (const r of candRooms) {
            if (L.secrets.length >= wantSecrets) break;
            const walls = [];
            for (let xx = r.x + 1; xx < r.x + r.w - 1; xx++) { walls.push([xx, r.y - 1, 0, -1]); walls.push([xx, r.y + r.h, 0, 1]); }
            for (let yy = r.y + 1; yy < r.y + r.h - 1; yy++) { walls.push([r.x - 1, yy, -1, 0]); walls.push([r.x + r.w, yy, 1, 0]); }
            rng.shuffle(walls);
            for (const [wx, wy, ox, oy] of walls) {
                const wi = idx(wx, wy);
                if (L.open[wi] || L.region[wi] !== -1) continue;
                const inside = idx(wx - ox, wy - oy);
                if (L.floor[inside] !== r.floor || L.kind[inside] !== K_PLAIN || !L.open[inside]) continue;
                // closet: 1-cell stub then a s×s room
                const s = rng.int(2, 3);
                const cells = [];
                const stub = idx(wx + ox, wy + oy);
                cells.push(stub);
                const bx = wx + ox * 2, by = wy + oy * 2;
                const perpX = oy !== 0 ? 1 : 0, perpY = ox !== 0 ? 1 : 0;
                const off = -Math.floor(s / 2);
                for (let a = 0; a < s; a++) for (let b = off; b < off + s; b++) {
                    cells.push(idx(bx + ox * a + perpX * b, by + oy * a + perpY * b));
                }
                // all cells and their 8-neighbourhood (except the fake wall) must be untouched rock
                let ok = true;
                const cellSet = new Set(cells);
                for (const c of cells) {
                    const cx = c % W, cy = (c / W) | 0;
                    if (!inb(cx, cy) || cx < 2 || cy < 2 || cx > W - 3 || cy > H - 3) { ok = false; break; }
                    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) {
                        const j = idx(cx + dx, cy + dy);
                        if (j === wi || cellSet.has(j)) continue;
                        if (L.open[j] || L.region[j] !== -1 || reserved[j] & 2) { ok = false; break; }
                    }
                    if (!ok) break;
                }
                if (!ok) continue;
                const sid = L.secrets.length;
                for (const c of cells) {
                    L.open[c] = 1; L.region[c] = -4; L.floor[c] = r.floor; L.ceil[c] = r.floor + 3.0; L.kind[c] = K_PLAIN;
                    const cx = c % W, cy = (c / W) | 0;
                    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) reserved[idx(cx + dx, cy + dy)] |= 2;
                }
                // the fake wall is a secret door
                L.open[wi] = 1; L.region[wi] = -3; L.floor[wi] = r.floor; L.ceil[wi] = r.ceil; L.kind[wi] = K_DOOR;
                const alongX = ox !== 0;
                const d = { id: L.doors.length, cell: wi, x: wx, y: wy, alongX, key: null, secret: true, room: r.id, open: 0, secretId: sid };
                L.door[wi] = d.id; L.doors.push(d);
                const inner = cells.slice(1);
                L.secrets.push({ id: sid, door: d.id, room: r.id, cells: inner, center: inner[Math.floor(inner.length / 2)], zone: r.zone });
                break;
            }
        }
        L.stats.secrets = L.secrets.length;
    }

    // ---------------------------------------------------------------- wall texture variants
    for (let i = 0; i < N; i++) {
        if (L.open[i] || L.wtex[i]) continue;
        const x = i % W, y = (i / W) | 0;
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
        let room = -1, cor = false;
        for (const [dx, dy] of DIRS) {
            const j = i + dx + dy * W;
            if (L.region[j] >= 0) room = L.region[j];
            if (L.region[j] === -2) cor = true;
        }
        if (room >= 0) L.wtex[i] = (room * 7 + 3) % 3 === 0 ? W_ALT : W_MAIN;
        else if (cor) L.wtex[i] = W_CORRIDOR;
    }

    // ---------------------------------------------------------------- 9. things
    const occupied = new Set();
    const free = (r, filter = () => true) => r.cells.filter((i) => L.open[i] && (L.kind[i] === K_PLAIN || L.kind[i] === K_DAIS) && !L.liquid[i] && !occupied.has(i) && filter(i));
    const cellPos = (i) => ({ x: (i % W) + 0.5, z: ((i / W) | 0) + 0.5 });
    const put = (type, i, extra = {}) => {
        occupied.add(i);
        const p = cellPos(i);
        const t = { type, cell: i, x: p.x, z: p.z, ...extra };
        L.things.push(t);
        return t;
    };
    const wallSpots = (r, avoidEntries = 2) => {
        const out = [];
        for (let xx = r.x + 1; xx < r.x + r.w - 1; xx++) { out.push([xx, r.y - 1, 0, 1]); out.push([xx, r.y + r.h, 0, -1]); }
        for (let yy = r.y + 1; yy < r.y + r.h - 1; yy++) { out.push([r.x - 1, yy, 1, 0]); out.push([r.x + r.w, yy, -1, 0]); }
        return out.filter(([wx, wy, nx, ny]) => {
            const wi = idx(wx, wy), inside = idx(wx + nx, wy + ny);
            return !L.open[wi] && L.wtex[wi] !== W_SECRET && L.region[wi] === -1 && L.open[inside] && L.floor[inside] === r.floor && L.kind[inside] === K_PLAIN && !nearEntry(inside, r, avoidEntries);
        });
    };

    // start
    {
        const r = rooms[startId];
        const c = idx(Math.floor(r.cx), Math.floor(r.cy));
        let cell = c;
        if (!L.open[c] || L.kind[c] !== K_PLAIN) cell = free(r)[0];
        const p = cellPos(cell);
        // face the first entry
        const e = r.entries[0];
        const ex = (e % W) + 0.5, ey = ((e / W) | 0) + 0.5;
        L.start = { cell, x: p.x, z: p.z, angle: Math.atan2(ex - p.x, -(ey - p.z)) };
        occupied.add(cell);
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) occupied.add(cell + dx + dy * W);
        L.kind[cell] = K_PAD;
    }

    // exit switch
    {
        const r = rooms[exitId];
        const spots = wallSpots(r, 2);
        if (!spots.length) throw new GenFail('no exit wall');
        // farthest from the room's entries
        spots.sort((p, q) => {
            const dp = Math.min(...r.entries.map((e) => Math.abs((e % W) - p[0]) + Math.abs(((e / W) | 0) - p[1])));
            const dq = Math.min(...r.entries.map((e) => Math.abs((e % W) - q[0]) + Math.abs(((e / W) | 0) - q[1])));
            return dq - dp;
        });
        const [wx, wy, nx, ny] = spots[0];
        const wi = idx(wx, wy);
        L.wtex[wi] = W_EXIT;
        const inside = idx(wx + nx, wy + ny);
        L.exit = { wall: wi, cell: inside, x: wx + 0.5 + nx * 0.5, z: wy + 0.5 + ny * 0.5, nx, nz: ny, floor: L.floor[inside], needsBoss: !!spec.boss };
        occupied.add(inside);
    }

    // keys
    const keyThings = [];
    lockEdges.forEach((e, k) => {
        const zoneRooms = rooms.filter((r) => r.zone === k);
        // prefer dead ends off the main path, then far from the zone's entry
        const entry = k === 0 ? startId : lockEdges[k - 1].b;
        const dz = bfsTree(entry).dist;
        const scored = zoneRooms.map((r) => ({
            r, s: dz[r.id] * 2 + (onMain.has(r.id) ? 0 : 4) + (r.links.length === 1 ? 3 : 0) - (r.kind === 'start' ? 20 : 0) + rng() * 2,
        })).sort((p, q) => q.s - p.s);
        for (const { r } of scored) {
            const cand = free(r, (i) => !nearEntry(i, r, 1));
            if (!cand.length) continue;
            // middle-ish cell, on a dais if one exists
            const dais = cand.filter((i) => L.kind[i] === K_DAIS);
            const pool = dais.length ? dais : cand;
            pool.sort((a, b) => Math.hypot((a % W) - r.cx, ((a / W) | 0) - r.cy) - Math.hypot((b % W) - r.cx, ((b / W) | 0) - r.cy));
            const t = put('pickup', pool[0], { id: 'key_' + e.key, zone: k, room: r.id });
            keyThings.push(t);
            r.kind = r.kind === 'normal' ? 'key' : r.kind;
            r.keyRoom = e.key;
            break;
        }
    });
    if (keyThings.length !== lockEdges.length) throw new GenFail('key placement');

    // lights
    const PAL = THEME_LIGHTS[spec.theme] ?? THEME_LIGHTS.station;
    for (const r of rooms) {
        const area = r.w * r.h;
        const n = Math.max(1, Math.min(7, Math.round(area / 16)));
        const spots = rng.shuffle(wallSpots(r, 0));
        const col = rng.pick(PAL.room);
        for (let k = 0; k < n && k < spots.length; k++) {
            const [wx, wy, nx, ny] = spots[k];
            const wi = idx(wx, wy);
            if (L.wtex[wi] === W_EXIT) continue;
            const y = r.floor + Math.min(r.ceil - r.floor - 0.6, rng.range(2.3, 3.0));
            L.lights.push({ x: wx + 0.5 + nx * 0.62, z: wy + 0.5 + ny * 0.62, y, color: k === 0 ? col : rng.pick(PAL.room), radius: rng.range(6.5, 9.5), intensity: rng.range(1.2, 1.6), flicker: rng.chance(PAL.flicker) ? rng.int(1, 2) : 0, fixture: 'wall', nx, nz: ny, wall: wi });
        }
        if (r.sky) {
            L.lights.push({ x: r.cx, z: r.cy, y: r.floor + 6, color: PAL.sky, radius: Math.max(r.w, r.h) * 2 * 0.75 + 4, intensity: 0.4, flicker: 0, fixture: 'none' });
            // braziers
            const fr = free(r, (i) => !nearEntry(i, r, 1) && L.kind[i] !== K_DAIS);
            const nb = Math.min(4, Math.floor(area / 40));
            for (let k = 0; k < nb && fr.length; k++) {
                const i = fr.splice(rng.int(0, fr.length - 1), 1)[0];
                const p = cellPos(i);
                put('decor', i, { d: 'brazier', solid: 0.35 });
                L.lights.push({ x: p.x, z: p.z, y: L.floor[i] + 1.5, color: PAL.fire, radius: 7, intensity: 1.2, flicker: 2, fixture: 'none' });
            }
        } else {
            // a hanging fill light so big rooms aren't black in the middle
            const fillI = { station: 0.38, foundry: 0.5, hell: 0.32, throne: 0.38 }[spec.theme] ?? 0.4;
            L.lights.push({ x: r.cx, z: r.cy, y: r.ceil - 0.2, color: rng.pick(PAL.room), radius: Math.max(r.w, r.h) * 2 * 0.5 + 3, intensity: fillI, flicker: spec.theme === 'foundry' && rng.chance(0.3) ? 1 : 0, fixture: 'ceil' });
        }
    }
    for (const c of L.corridors) {
        // every corridor gets at least one lamp; long ones one every 5 cells
        const n = c.cells.length;
        const ks = [];
        if (n <= 6) ks.push(n >> 1);
        else for (let k = 2; k < n - 2; k += 5) ks.push(k);
        for (const k of ks) {
            const i = c.cells[k];
            if (L.door[i] >= 0) continue;
            const p = cellPos(i);
            L.lights.push({ x: p.x, z: p.z, y: L.ceil[i] - 0.15, color: rng.pick(PAL.corridor), radius: 7, intensity: 1.45, flicker: rng.chance(PAL.flicker) ? 1 : 0, fixture: 'ceil' });
        }
    }
    for (const s of L.secrets) {
        const p = cellPos(s.center);
        L.lights.push({ x: p.x, z: p.z, y: L.ceil[s.center] - 0.3, color: [0.5, 0.9, 1.0], radius: 4.5, intensity: 0.8, flicker: 0, fixture: 'ceil' });
    }

    // terminals (data logs)
    {
        const nLogs = spec.logs ?? 3;
        const cands = rng.shuffle(rooms.filter((r) => r.kind !== 'start'));
        // spread across zones: sort by zone then depth
        cands.sort((a, b) => a.zone - b.zone || roomDepth[a.id] - roomDepth[b.id]);
        const step = Math.max(1, Math.floor(cands.length / nLogs));
        let n = 0;
        for (let k = 0; k < cands.length && n < nLogs; k += step) {
            const r = cands[k];
            const spots = wallSpots(r, 1).filter(([wx, wy]) => L.wtex[idx(wx, wy)] !== W_EXIT && !L.lights.some((l) => l.wall === idx(wx, wy)));
            if (!spots.length) continue;
            const [wx, wy, nx, ny] = rng.pick(spots);
            const wi = idx(wx, wy);
            L.wtex[wi] = W_TERMINAL;
            const inside = idx(wx + nx, wy + ny);
            occupied.add(inside);
            L.things.push({ type: 'terminal', log: n, wall: wi, cell: inside, x: wx + 0.5 + nx * 0.5, z: wy + 0.5 + ny * 0.5, nx, nz: ny, floor: L.floor[inside], zone: r.zone });
            n++;
        }
    }

    // monsters
    const roster = spec.roster ?? ['husk', 'imp'];
    const density = (0.075 + 0.011 * Math.min(depth, 14)) * (diff.count ?? 1);
    const weights = roster.map((a) => ({ a, w: MONSTER_WEIGHT[a] ?? 2 }));
    const cheapest = Math.min(...roster.map((a) => ARCHETYPES[a].cost));
    let juggernauts = 0;
    for (const r of rooms) {
        if (r.kind === 'start') continue;
        let budget = r.w * r.h * density * (r.kind === 'exit' ? 1.3 : 1) * rng.range(0.7, 1.3);
        if (spec.arena && r.id === 0) budget = 0;            // the Archon brings its own
        if (spec.boss && r.id === exitId) budget *= 0.25;
        const ambushBudget = r.kind === 'key' ? budget * 0.6 : (r.kind === 'exit' && !spec.boss && rng.chance(0.5) ? budget * 0.4 : 0);
        budget -= ambushBudget * 0.5;
        const placeGroup = (amb, bud) => {
            let guard = 0;
            while (bud >= cheapest && guard++ < 40) {
                const pick = rng.weighted(weights).a;
                const A = ARCHETYPES[pick];
                if (A.cost > bud + 1) { if (rng.chance(0.7)) continue; else break; }
                if (pick === 'juggernaut' && (juggernauts >= (depth >= 9 ? 2 : 1) || r.w * r.h < 80)) continue;
                if (pick === 'hierophant' && L.things.some((t) => t.arch === 'hierophant' && t.room === r.id)) continue;
                const group = A.cost <= 2 ? rng.int(1, 3) : 1;
                for (let g = 0; g < group && bud >= A.cost * 0.6; g++) {
                    const cand = free(r, (i) => !nearEntry(i, r, 1) && L.kind[i] !== K_CRATE);
                    if (!cand.length) return;
                    const i = rng.pick(cand);
                    const elite = pick !== 'husk' && rng.chance(0.03 + depth * 0.012) ? rng.int(0, 4) : -1;
                    put('monster', i, { arch: pick, angle: rng.range(0, Math.PI * 2), room: r.id, zone: r.zone, ambush: amb, elite });
                    if (pick === 'juggernaut') juggernauts++;
                    bud -= A.cost;
                }
            }
        };
        placeGroup(false, budget);
        if (ambushBudget > 0) placeGroup(true, ambushBudget);
    }
    // the guardian
    if (spec.boss) {
        const r = rooms[exitId];
        let cell = idx(Math.floor(r.cx), Math.floor(r.cy));
        if (!L.open[cell] || L.kind[cell] === K_CRATE) cell = free(r)[0];
        // the boss stands on the centre cell even if something else is there
        put('monster', cell, { arch: spec.boss, angle: 0, room: r.id, zone: r.zone, ambush: false, elite: -1, boss: true });
    }
    L.stats.monsters = L.things.filter((t) => t.type === 'monster').length;

    // pickups
    const arsenal = opts.arsenal ?? ['blade', 'pistol'];
    const ammoTypes = new Set(['bullets']);
    const WAMMO = { shotgun: 'shells', ssg: 'shells', chaingun: 'bullets', rocket: 'rockets', plasma: 'cells', rail: 'cells', bfg: 'cells' };
    for (const w of arsenal) if (WAMMO[w]) ammoTypes.add(WAMMO[w]);
    if (spec.weapon && WAMMO[spec.weapon]) ammoTypes.add(WAMMO[spec.weapon]);
    const ammoPick = { bullets: ['clip', 'clip', 'ammobox'], shells: ['shells', 'shells', 'shellbox'], rockets: ['rocket1', 'rocket1', 'rocketbox'], cells: ['cell', 'cell', 'cellpack'] };
    const ammoList = [...ammoTypes];
    const ammoMul = diff.ammo ?? 1;
    for (const r of rooms) {
        const area = r.w * r.h;
        const cand = () => free(r);
        let nAmmo = Math.round(area / 22 * ammoMul * rng.range(0.6, 1.3));
        let nHealth = Math.round(area / 34 * rng.range(0.5, 1.4));
        if (r.kind === 'start') { nAmmo = Math.max(1, nAmmo >> 1); nHealth = 0; }
        if (spec.boss && r.id === exitId) { nAmmo += 3; nHealth += 2; }
        for (let k = 0; k < nAmmo; k++) {
            const c = cand(); if (!c.length) break;
            const t = rng.pick(ammoList);
            put('pickup', rng.pick(c), { id: rng.pick(ammoPick[t]), zone: r.zone, room: r.id });
        }
        for (let k = 0; k < nHealth; k++) {
            const c = cand(); if (!c.length) break;
            put('pickup', rng.pick(c), { id: rng.pick(['stim', 'stim', 'medkit', 'shard', 'shard', 'vial']), zone: r.zone, room: r.id });
        }
        if (rng.chance(0.18) && r.kind !== 'start') {
            const c = cand(); if (c.length) put('pickup', rng.pick(c), { id: rng.chance(0.6) ? 'vest' : 'medkit', zone: r.zone, room: r.id });
        }
        // barrels
        if (r.kind !== 'start' && rng.chance(0.4)) {
            const c = free(r, (i) => !nearEntry(i, r, 1));
            if (c.length) {
                const seed0 = rng.pick(c);
                const n = rng.int(1, 4);
                const sx = seed0 % W, sy = (seed0 / W) | 0;
                for (let k = 0; k < n; k++) {
                    const i = idx(sx + rng.int(-1, 1), sy + rng.int(-1, 1));
                    if (L.region[i] !== r.id || !c.includes(i) || occupied.has(i)) continue;
                    put('barrel', i, { room: r.id });
                }
            }
        }
    }
    // the level's new weapon: in zone 0, not in the start room if possible
    if (spec.weapon) {
        const pool = rooms.filter((r) => r.zone === 0 && r.kind !== 'start');
        const r = pool.length ? rng.pick(pool) : rooms[startId];
        const c = free(r);
        if (c.length) put('pickup', rng.pick(c), { id: 'w_' + spec.weapon, zone: r.zone, room: r.id, big: true });
    }
    // a couple of older weapons as ammo caches
    const older = arsenal.filter((w) => w !== 'blade' && w !== 'pistol');
    for (let k = 0; k < Math.min(2, older.length); k++) {
        const r = rng.pick(rooms);
        const c = free(r);
        if (c.length) put('pickup', rng.pick(c), { id: 'w_' + rng.pick(older), zone: r.zone, room: r.id });
    }
    // powerups: secrets get the good stuff
    const POWERS = ['soul', 'mega', 'berserk', 'overdrive', 'haste', 'invuln', 'cloak', 'suit', 'backpack', 'surveyor'];
    for (const s of L.secrets) {
        const cells = s.cells.filter((i) => !occupied.has(i));
        const n = Math.min(cells.length, rng.int(2, 3));
        rng.shuffle(cells);
        for (let k = 0; k < n; k++) {
            const id = k === 0 ? rng.pick(POWERS) : rng.pick(['medkit', 'shellbox', 'cellpack', 'rocketbox', 'ammobox', 'vest']);
            put('pickup', cells[k], { id, zone: s.zone, secret: s.id });
        }
    }
    {
        const nPow = Math.round(rng.range(0.6, 1.6) + depth * 0.08);
        const pool = rooms.filter((r) => r.kind !== 'start');
        for (let k = 0; k < nPow; k++) {
            const r = rng.pick(pool);
            const c = free(r);
            if (!c.length) continue;
            const hazard = r.feature.includes('pit');
            put('pickup', rng.pick(c), { id: hazard && rng.chance(0.5) ? 'suit' : rng.pick(['berserk', 'soul', 'haste', 'overdrive', 'mega', 'backpack', 'invuln', 'cloak']), zone: r.zone, room: r.id });
        }
        if (spec.theme !== 'station' && rooms.some((r) => r.feature.includes('pit'))) {
            const r = rooms[startId];
            const c = free(r);
            if (c.length && rng.chance(0.6)) put('pickup', rng.pick(c), { id: 'suit', zone: 0, room: r.id });
        }
    }
    L.stats.items = L.things.filter((t) => t.type === 'pickup' && !t.id.startsWith('key_')).length;

    // decor
    const DECOR = THEME_DECOR[spec.theme] ?? THEME_DECOR.station;
    for (const r of rooms) {
        const n = Math.round(r.w * r.h / 30 * rng.range(0.5, 1.5));
        for (let k = 0; k < n; k++) {
            const c = free(r, (i) => !nearEntry(i, r, 1) && L.kind[i] !== K_DAIS);
            if (!c.length) break;
            const i = rng.pick(c);
            // prefer along walls for big pieces
            const d = rng.pick(DECOR);
            put('decor', i, { d: d.d, solid: d.solid, room: r.id, rot: rng.range(0, Math.PI * 2) });
        }
    }

    return L;
}

// ---------------------------------------------------------------- validation

/**
 * Play the level as a flood fill: walk from the start, collect keys, open
 * doors whose key we hold, and repeat until nothing changes.
 */
export function validate(L) {
    const { W } = L;
    const reach = reachable(L, new Set(KEY_ORDER));
    // with every key everything must be reachable; now do it honestly
    const keys = new Set();
    let seen;
    for (let iter = 0; iter < 5; iter++) {
        seen = reachable(L, keys);
        let got = false;
        for (const t of L.things) {
            if (t.type === 'pickup' && t.id.startsWith('key_') && seen[t.cell] && !keys.has(t.id.slice(4))) { keys.add(t.id.slice(4)); got = true; }
        }
        if (!got) break;
    }
    if (!seen[L.exit.cell]) return { ok: false, reason: 'exit unreachable' };
    for (const t of L.things) {
        if (t.type === 'pickup' && !seen[t.cell]) return { ok: false, reason: `pickup ${t.id} unreachable` };
        if (t.type === 'terminal' && !seen[t.cell]) return { ok: false, reason: 'terminal unreachable' };
        if (t.type === 'monster' && !reach[t.cell]) return { ok: false, reason: 'monster in sealed area' };
    }
    for (const d of L.doors) if (d.key && !keys.has(d.key)) return { ok: false, reason: 'key never obtainable' };
    void W;
    return { ok: true, keys: [...keys] };
}

export function canStep(L, a, b) {
    if (!L.open[b]) return false;
    if (L.floor[b] - L.floor[a] > STEP + 1e-4) return false;
    const top = Math.min(L.ceil[a], L.ceil[b]);
    if (top - Math.max(L.floor[a], L.floor[b]) < HEADROOM) return false;
    return true;
}

export function reachable(L, keys) {
    const { W, H } = L;
    const seen = new Uint8Array(W * H);
    const q = [L.start.cell];
    seen[L.start.cell] = 1;
    while (q.length) {
        const a = q.pop();
        for (const [dx, dy] of DIRS) {
            const b = a + dx + dy * W;
            if (seen[b] || !canStep(L, a, b)) continue;
            const d = L.door[b];
            if (d >= 0 && L.doors[d].key && !keys.has(L.doors[d].key)) continue;
            seen[b] = 1; q.push(b);
        }
    }
    return seen;
}

// ---------------------------------------------------------------- theme tables

export const THEME_LIGHTS = {
    station: { room: [[0.75, 0.88, 1.0], [0.55, 0.8, 1.0], [1.0, 0.82, 0.55], [0.6, 1.0, 0.85]], corridor: [[0.6, 0.85, 1.0], [1.0, 0.7, 0.35]], sky: [0.95, 0.7, 0.5], fire: [1.0, 0.55, 0.2], flicker: 0.12 },
    foundry: { room: [[1.0, 0.6, 0.3], [1.0, 0.75, 0.45], [0.95, 0.45, 0.2]], corridor: [[1.0, 0.55, 0.25], [1.0, 0.8, 0.5]], sky: [1.0, 0.55, 0.3], fire: [1.0, 0.5, 0.15], flicker: 0.25 },
    hell: { room: [[1.0, 0.3, 0.2], [0.9, 0.25, 0.45], [1.0, 0.5, 0.25], [0.6, 0.3, 1.0]], corridor: [[1.0, 0.3, 0.2], [0.7, 0.25, 0.8]], sky: [1.0, 0.35, 0.25], fire: [1.0, 0.45, 0.15], flicker: 0.3 },
    throne: { room: [[0.9, 0.85, 1.0], [0.7, 0.6, 1.0]], corridor: [[0.8, 0.7, 1.0]], sky: [0.85, 0.75, 1.0], fire: [0.7, 0.55, 1.0], flicker: 0.1 },
};

export const THEME_DECOR = {
    station: [{ d: 'console', solid: 0.45 }, { d: 'pipe', solid: 0.3 }, { d: 'lamp', solid: 0.25 }, { d: 'debris', solid: 0 }, { d: 'body', solid: 0 }],
    foundry: [{ d: 'pipe', solid: 0.3 }, { d: 'chain', solid: 0 }, { d: 'debris', solid: 0 }, { d: 'body', solid: 0 }, { d: 'brazier', solid: 0.35 }],
    hell: [{ d: 'spike', solid: 0.3 }, { d: 'bones', solid: 0 }, { d: 'tree', solid: 0.35 }, { d: 'candles', solid: 0 }, { d: 'body', solid: 0 }],
    throne: [{ d: 'spike', solid: 0.3 }, { d: 'candles', solid: 0 }, { d: 'crystal', solid: 0.3 }],
};

// ---------------------------------------------------------------- tiny binary heap

class MinHeap {
    constructor() { this.k = []; this.p = []; }
    get size() { return this.k.length; }
    push(key, pri) {
        const k = this.k, p = this.p;
        k.push(key); p.push(pri);
        let i = k.length - 1;
        while (i > 0) {
            const par = (i - 1) >> 1;
            if (p[par] <= p[i]) break;
            [k[i], k[par]] = [k[par], k[i]]; [p[i], p[par]] = [p[par], p[i]];
            i = par;
        }
    }
    pop() {
        const k = this.k, p = this.p;
        const top = k[0];
        const lk = k.pop(), lp = p.pop();
        if (k.length) {
            k[0] = lk; p[0] = lp;
            let i = 0;
            for (;;) {
                const l = i * 2 + 1, r = l + 1;
                let m = i;
                if (l < k.length && p[l] < p[m]) m = l;
                if (r < k.length && p[r] < p[m]) m = r;
                if (m === i) break;
                [k[i], k[m]] = [k[m], k[i]]; [p[i], p[m]] = [p[m], p[i]];
                i = m;
            }
        }
        return top;
    }
}
