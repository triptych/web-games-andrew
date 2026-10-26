// Procedural dungeon floors: a perfect maze with rooms, doors, loops, secret doors, stairs and a
// scatter of features. Floor N is a pure function of (worldSeed, N). Pure.
//
// Edges: hw[(y)*w + x] is the wall on the NORTH side of cell (x,y) (row h is the south border);
// vw[y*(w+1) + x] is the WEST side (column w is the east border).
// Edge types: 0 open, 1 wall, 2 closed door, 3 secret door (looks like a wall), 4 open door.

import { seeded } from '../rng.js';
import { DIRS } from '../config.js';
import { clamp } from './core.js';
import { HINT_SIGNS } from './names.js';

export const THEMES = [
    { id: 'crypt', name: 'Forgotten Crypt', wall: [7, 8, 15], floor: [8, 0], ceil: [0, 8], music: 0 },
    { id: 'dungeon', name: 'Old Dungeon', wall: [6, 0, 14], floor: [8, 6], ceil: [0, 8], music: 1 },
    { id: 'moss', name: 'Mossy Halls', wall: [2, 0, 10], floor: [8, 2], ceil: [0, 2], music: 2 },
    { id: 'ice', name: 'Frozen Vaults', wall: [3, 1, 11], floor: [9, 1], ceil: [1, 0], music: 3 },
    { id: 'ember', name: 'Ember Depths', wall: [4, 0, 12], floor: [6, 4], ceil: [0, 4], music: 4 },
    { id: 'sewer', name: 'Drowned Sewers', wall: [1, 0, 9], floor: [3, 1], ceil: [0, 1], music: 5 },
    { id: 'amethyst', name: 'Amethyst Caverns', wall: [5, 0, 13], floor: [8, 5], ceil: [0, 5], music: 6 },
    { id: 'bone', name: 'Ossuary', wall: [15, 7, 8], floor: [7, 8], ceil: [8, 0], music: 7 },
    { id: 'fungal', name: 'Fungal Warren', wall: [5, 2, 10], floor: [2, 0], ceil: [0, 5], music: 8 },
    { id: 'obsidian', name: 'Obsidian Spire', wall: [8, 0, 12], floor: [0, 8], ceil: [0, 0], music: 9 },
];

export const TRAP_KINDS = ['dart', 'pit', 'alarm', 'tele', 'spin', 'rune', 'gas'];
export const NPC_KINDS = ['merchant', 'hermit', 'adventurer', 'gambler', 'riddler', 'healer', 'questgiver'];
export const GATHER_KINDS = ['herb', 'ore', 'bug', 'relic'];
export const isBossFloor = (d) => d % 5 === 0;

export const hIdx = (f, x, y) => y * f.w + x;
export const vIdx = (f, x, y) => y * (f.w + 1) + x;
export function getEdge(f, x, y, d) {
    switch (d) {
        case 0: return f.hw[hIdx(f, x, y)];
        case 2: return f.hw[hIdx(f, x, y + 1)];
        case 3: return f.vw[vIdx(f, x, y)];
        default: return f.vw[vIdx(f, x + 1, y)];
    }
}
export function setEdge(f, x, y, d, t) {
    switch (d) {
        case 0: f.hw[hIdx(f, x, y)] = t; break;
        case 2: f.hw[hIdx(f, x, y + 1)] = t; break;
        case 3: f.vw[vIdx(f, x, y)] = t; break;
        default: f.vw[vIdx(f, x + 1, y)] = t;
    }
}
export const passable = (t) => t === 0 || t === 2 || t === 4;
export const clear = (t) => t === 0 || t === 4;                 // you can see through it
export const inb = (f, x, y) => x >= 0 && y >= 0 && x < f.w && y < f.h;
export const cellIdx = (f, x, y) => y * f.w + x;

/** BFS distances from (sx, sy). With `secret`, secret doors count as open. -1 = unreachable. */
export function distMap(f, sx, sy, secret = false) {
    const dist = new Int32Array(f.w * f.h).fill(-1);
    const q = [cellIdx(f, sx, sy)];
    dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
        const c = q[qi], x = c % f.w, y = (c / f.w) | 0;
        for (let d = 0; d < 4; d++) {
            const t = getEdge(f, x, y, d);
            if (!(passable(t) || (secret && t === 3))) continue;
            const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
            if (!inb(f, nx, ny)) continue;
            const ni = cellIdx(f, nx, ny);
            if (dist[ni] >= 0) continue;
            dist[ni] = dist[c] + 1;
            q.push(ni);
        }
    }
    return dist;
}
const farthest = (f, dist, rng) => {
    let best = -1, cells = [];
    for (let i = 0; i < dist.length; i++) {
        if (dist[i] > best) { best = dist[i]; cells = [i]; } else if (dist[i] === best) cells.push(i);
    }
    return cells[Math.floor(rng() * cells.length)];
};

export function themeFor(worldSeed, depth) {
    const stratum = Math.floor((depth - 1) / 5);
    const r = seeded(worldSeed, stratum, 9);
    let idx = Math.floor(r() * THEMES.length);
    if (stratum === 0) idx = 1;                       // the first stratum is always the old dungeon
    if (seeded(worldSeed, depth, 10)() < 0.2 && stratum > 0) idx = (idx + 1 + Math.floor(seeded(worldSeed, depth, 11)() * 8)) % THEMES.length;
    return idx;
}

export function genFloor(worldSeed, depth, quest = null) {
    const rng = seeded(worldSeed, depth, 1);
    const base = clamp(9 + Math.floor(depth * 0.8), 9, 32);
    const w = clamp(base + rng.int(-1, 3), 8, 36), h = clamp(base + rng.int(-1, 3), 8, 36);
    const f = {
        depth, w, h, theme: themeFor(worldSeed, depth), hw: new Uint8Array(w * (h + 1)).fill(1), vw: new Uint8Array((w + 1) * h).fill(1),
        seen: new Uint8Array(w * h), room: new Int16Array(w * h).fill(-1), feat: {}, start: { x: 0, y: 0 }, down: { x: 0, y: 0 }, rooms: [], secrets: 0, name: '',
    };
    f.name = `${THEMES[f.theme].name} B${depth}F`;

    // 1. perfect maze (iterative DFS)
    const vis = new Uint8Array(w * h);
    const st = [rng.int(0, w * h - 1)];
    vis[st[0]] = 1;
    while (st.length) {
        const c = st[st.length - 1], x = c % w, y = (c / w) | 0;
        const ds = rng.shuffle([0, 1, 2, 3]);
        let moved = false;
        for (const d of ds) {
            const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
            if (!inb(f, nx, ny) || vis[cellIdx(f, nx, ny)]) continue;
            setEdge(f, x, y, d, 0);
            vis[cellIdx(f, nx, ny)] = 1;
            st.push(cellIdx(f, nx, ny));
            moved = true;
            break;
        }
        if (!moved) st.pop();
    }

    // 2. rooms: open rectangles, doors where corridors meet them
    const maxR = depth > 12 ? 5 : 4;
    const tries = Math.floor(w * h / 36) + 2;
    for (let i = 0; i < tries; i++) {
        const rw = rng.int(2, maxR), rh = rng.int(2, maxR);
        const rx = rng.int(0, w - rw), ry = rng.int(0, h - rh);
        let ok = true;
        for (let y = Math.max(0, ry - 1); y <= Math.min(h - 1, ry + rh) && ok; y++) {
            for (let x = Math.max(0, rx - 1); x <= Math.min(w - 1, rx + rw) && ok; x++) if (f.room[cellIdx(f, x, y)] >= 0) ok = false;
        }
        if (!ok) continue;
        const id = f.rooms.length;
        f.rooms.push({ x: rx, y: ry, w: rw, h: rh });
        for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
            f.room[cellIdx(f, x, y)] = id;
            if (x < rx + rw - 1) setEdge(f, x, y, 1, 0);
            if (y < ry + rh - 1) setEdge(f, x, y, 2, 0);
        }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const rid = f.room[cellIdx(f, x, y)];
        if (rid < 0) continue;
        for (let d = 0; d < 4; d++) {
            const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
            if (!inb(f, nx, ny) || f.room[cellIdx(f, nx, ny)] === rid) continue;
            if (getEdge(f, x, y, d) === 0 && rng() < 0.75) setEdge(f, x, y, d, 2);
        }
    }
    // 3. loops, so the maze isn't a tree
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        for (const d of [1, 2]) {
            const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
            if (!inb(f, nx, ny) || getEdge(f, x, y, d) !== 1) continue;
            const a = f.room[cellIdx(f, x, y)], b = f.room[cellIdx(f, nx, ny)];
            if (a >= 0 && a === b) continue;
            if (rng() < 0.05) setEdge(f, x, y, d, a >= 0 || b >= 0 ? 2 : 0);
        }
    }

    // 4. stairs at the ends of the longest path
    const a = rng.int(0, w * h - 1);
    const s = farthest(f, distMap(f, a % w, (a / w) | 0), rng);
    const sx = s % w, sy = (s / w) | 0;
    const d0 = distMap(f, sx, sy);
    const dn = farthest(f, d0, rng);
    f.start = { x: sx, y: sy };
    f.down = { x: dn % w, y: (dn / w) | 0 };
    f.pathLen = d0[dn];
    // keep the main path clear of secrets: remember it
    const onPath = new Set();
    {
        let c = dn;
        while (c !== s) {
            onPath.add(c);
            const x = c % w, y = (c / w) | 0;
            for (let d = 0; d < 4; d++) {
                if (!passable(getEdge(f, x, y, d))) continue;
                const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
                if (inb(f, nx, ny) && d0[cellIdx(f, nx, ny)] === d0[c] - 1) { c = cellIdx(f, nx, ny); break; }
            }
        }
        onPath.add(s);
    }

    // 5. secret doors: only where sealing one leaves the stairs reachable and hides a small pocket
    const wantSecrets = depth >= 2 ? rng.int(0, 2) + (w * h > 500 ? 1 : 0) : 0;
    for (let att = 0; att < 40 && f.secrets < wantSecrets; att++) {
        const x = rng.int(0, w - 1), y = rng.int(0, h - 1), d = rng.int(0, 3);
        const nx = x + DIRS[d].dx, ny = y + DIRS[d].dy;
        if (!inb(f, nx, ny) || getEdge(f, x, y, d) !== 0) continue;
        if (onPath.has(cellIdx(f, x, y)) && onPath.has(cellIdx(f, nx, ny))) continue;
        if (f.room[cellIdx(f, x, y)] >= 0 && f.room[cellIdx(f, x, y)] === f.room[cellIdx(f, nx, ny)]) continue;
        setEdge(f, x, y, d, 3);
        const dm = distMap(f, sx, sy);
        let cut = 0;
        for (let i = 0; i < dm.length; i++) if (dm[i] < 0) cut++;
        if (dm[dn] < 0 || cut < 2 || cut > 40) setEdge(f, x, y, d, 0);
        else f.secrets++;
    }
    const dm = distMap(f, sx, sy);
    const secretCells = [];
    for (let i = 0; i < dm.length; i++) if (dm[i] < 0) secretCells.push(i);

    // 6. features
    const reach = [];
    for (let i = 0; i < dm.length; i++) if (dm[i] > 1 && i !== dn) reach.push(i);
    rng.shuffle(reach);
    const take = () => { const c = reach.pop(); return c === undefined ? null : { x: c % w, y: (c / w) | 0 }; };
    const put = (p, o) => { if (p) f.feat[`${p.x},${p.y}`] = o; return p; };
    const area = w * h;
    f.feat[`${sx},${sy}`] = { type: 'up' };
    f.feat[`${f.down.x},${f.down.y}`] = { type: 'down', guard: null };
    const chestN = Math.max(2, Math.round(area / 62));
    for (let i = 0; i < chestN; i++) {
        const tier = Math.min(3, Math.floor(rng() * (1 + depth / 10)));
        put(take(), { type: 'chest', tier, trap: rng() < 0.3 ? rng.pick(['needle', 'gas', 'alarm', 'blast', 'mimic']) : null, opened: false });
    }
    if (secretCells.length) {
        const c = secretCells[Math.floor(rng() * secretCells.length)];
        f.feat[`${c % w},${(c / w) | 0}`] = { type: 'chest', tier: Math.min(3, 1 + Math.floor(depth / 8)), trap: null, opened: false, secret: true };
        const c2 = secretCells[Math.floor(rng() * secretCells.length)];
        const k = `${c2 % w},${(c2 / w) | 0}`;
        if (!f.feat[k]) f.feat[k] = { type: 'gather', kind: rng.pick(GATHER_KINDS), left: 4 };
    }
    if (depth >= 2) for (let i = 0, n = Math.max(1, Math.round(area / 48)); i < n; i++) put(take(), { type: 'trap', kind: rng.pick(TRAP_KINDS), hid: true, sprung: false });
    for (let i = 0, n = Math.max(1, Math.round(area / 58)); i < n; i++) put(take(), { type: 'gather', kind: rng.pick(GATHER_KINDS), left: rng.int(2, 4) });
    for (let i = 0, n = Math.round(area / 120); i < n; i++) put(take(), { type: 'den', done: false });
    if (rng() < 0.45) put(take(), { type: 'spring', left: 1 });
    if (rng() < 0.35) put(take(), { type: 'altar', kind: rng() < 0.7 ? 'shrine' : 'blood', used: false });
    if (rng() < 0.5) put(take(), { type: 'sign', text: rng.pick(HINT_SIGNS) });
    const npcN = (rng() < 0.6 ? 1 : 0) + (rng() < 0.2 ? 1 : 0);
    for (let i = 0; i < npcN; i++) put(take(), { type: 'npc', kind: rng.pick(NPC_KINDS), seed: rng.int(1, 1e6), met: false, done: false });
    if (quest) put(take(), { type: 'relic', qid: quest.id, name: quest.relicName, taken: false });

    f.bossFloor = isBossFloor(depth);
    f.seen[cellIdx(f, sx, sy)] = 2;
    return f;
}

/** Mark what the party can see from (x, y) facing d: the straight line ahead and a lit room. */
export function reveal(f, x, y, d) {
    f.seen[cellIdx(f, x, y)] = 2;
    const rid = f.room[cellIdx(f, x, y)];
    if (rid >= 0) {
        const r = f.rooms[rid];
        for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) {
            const i = cellIdx(f, xx, yy);
            if (!f.seen[i]) f.seen[i] = 1;
        }
    }
    let cx = x, cy = y;
    for (let i = 0; i < 14; i++) {
        if (!clear(getEdge(f, cx, cy, d))) break;
        cx += DIRS[d].dx; cy += DIRS[d].dy;
        if (!inb(f, cx, cy)) break;
        const j = cellIdx(f, cx, cy);
        if (!f.seen[j]) f.seen[j] = 1;
        const rr = f.room[j];
        if (rr >= 0) {
            const r = f.rooms[rr];
            for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) { const k = cellIdx(f, xx, yy); if (!f.seen[k]) f.seen[k] = 1; }
        }
    }
}
export function revealAll(f) {
    for (let i = 0; i < f.seen.length; i++) if (!f.seen[i]) f.seen[i] = 1;
}

export const featAt = (f, x, y) => f.feat[`${x},${y}`] || null;

/** Plain JSON for the save. */
export function packFloor(f) {
    return {
        ...f, hw: Array.from(f.hw).join(''), vw: Array.from(f.vw).join(''), seen: Array.from(f.seen).join(''), room: Array.from(f.room),
    };
}
export function unpackFloor(o) {
    const u = (s, T) => { const a = new T(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) - 48; return a; };
    return { ...JSON.parse(JSON.stringify({ ...o, hw: 0, vw: 0, seen: 0, room: 0 })), hw: u(o.hw, Uint8Array), vw: u(o.vw, Uint8Array), seen: u(o.seen, Uint8Array), room: Int16Array.from(o.room) };
}
