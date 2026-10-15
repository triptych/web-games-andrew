// Path finding across every map at once. Each tile of each map is a node; doors join maps.
// The bot uses it to walk anywhere in the kingdom; the planner uses it to prove the kingdom can be
// finished; the HUD's guide uses it to point along the way you'd actually walk.

import { TILES, T } from './data/tiles.js';
import { getWorld } from './worldgen.js';
import { tileAt, clutterGone } from './rules.js';
import { NPCS } from './data/npcs.js';

let GRAPH = null;
export function graph() {
    if (GRAPH) return GRAPH;
    const { maps } = getWorld();
    const ids = Object.keys(maps);
    const off = {};
    let n = 0;
    for (const id of ids) { off[id] = n; n += maps[id].w * maps[id].h; }
    const owner = new Uint16Array(n);
    ids.forEach((id, k) => owner.fill(k, off[id], off[id] + maps[id].w * maps[id].h));
    GRAPH = { ids, off, n, owner, maps };
    return GRAPH;
}
export const node = (map, x, y) => { const g = graph(); return g.off[map] + y * g.maps[map].w + x; };
export function unnode(k) {
    const g = graph();
    const id = g.ids[g.owner[k]];
    const M = g.maps[id];
    const i = k - g.off[id];
    return { map: id, x: i % M.w, y: Math.floor(i / M.w), i };
}

/**
 * What a tile costs to cross, for someone holding `books`:
 *   0 can't, 1 walk, 2 walk after using a power on it, 3 walk after unlocking it with a key.
 * ctx: { G (for what's already opened, or null), books, keys: { dungeon: n }, placed }
 */
export function cross(ctx, M, i) {
    const t = ctx.G ? tileAt(ctx.G, M, i) : M.t[i];
    const d = TILES[t];
    if (t === T.clutter) return ctx.G ? (clutterGone(ctx.G, M, i) ? 1 : 0) : 0;
    if (d.lock) {
        if (!ctx.books.includes(d.lock)) return 0;
        if (t === T.starseal && (ctx.placed ?? ctx.books.length) < 12) return 0;
        return d.mode === 'pass' ? 1 : 2;
    }
    if (d.keyDoor) return (ctx.keys?.[M.id] || 0) > 0 ? 3 : 0;
    return d.solid ? 0 : 1;
}

function npcBlocks(ctx, M) {
    const set = new Set();
    for (const n of M.npcs) {
        if (ctx.G && NPCS[n.id]?.when && !NPCS[n.id].when(ctx.G)) continue;
        set.add(n.y * M.w + n.x);
    }
    return set;
}

/**
 * Breadth-first search from `start` (a node). goal(k) → true stops it. Returns { prev, dist, found }.
 * Warps are followed when their need is met (and a star warp only once the seal is open).
 */
export function search(ctx, start, goal = null, maxNodes = Infinity) {
    const g = graph();
    const prev = new Int32Array(g.n).fill(-2);
    const q = new Int32Array(g.n);
    let h = 0, tl = 0, found = -1;
    prev[start] = -1;
    q[tl++] = start;
    const blockCache = {};
    while (h < tl) {
        const k = q[h++];
        if (goal && goal(k)) { found = k; break; }
        if (h > maxNodes) break;
        const id = g.ids[g.owner[k]];
        const M = g.maps[id];
        const i = k - g.off[id];
        const x = i % M.w, y = (i / M.w) | 0;
        const wp = M.warps[i];
        if (wp && k !== start) {
            const ok = (!wp.need || ctx.books.includes(wp.need)) && (!wp.star || ctx.starOpen);
            if (ok) {
                const D = g.maps[wp.to];
                const tx = wp.x ?? D.arrive.x, ty = wp.y ?? D.arrive.y;
                const nk = g.off[wp.to] + ty * D.w + tx;
                if (prev[nk] === -2) { prev[nk] = k; q[tl++] = nk; }
                continue;     // stepping on a door always takes you through it
            }
        }
        const blocks = blockCache[id] ||= npcBlocks(ctx, M);
        for (let d = 0; d < 4; d++) {
            const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
            if (nx < 0 || ny < 0 || nx >= M.w || ny >= M.h) continue;
            const ni = ny * M.w + nx;
            const nk = g.off[id] + ni;
            if (prev[nk] !== -2) continue;
            if (blocks.has(ni)) continue;
            const c = cross(ctx, M, ni);
            if (!c) continue;
            // a star-seal warp tile is only a way down once opened (cross says 2 = needs the power)
            prev[nk] = k;
            q[tl++] = nk;
        }
    }
    return { prev, found, seen: (k) => prev[k] !== -2 };
}

export function pathTo(res, k) {
    const out = [];
    while (k >= 0) { out.push(k); k = res.prev[k]; }
    return out.reverse();
}

/** Nodes next to an object tile (a chest, a person) you could stand on to use it. */
export function besideNodes(map, x, y) {
    const g = graph();
    const M = g.maps[map];
    const out = [];
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= M.w || ny >= M.h) continue;
        out.push({ k: g.off[map] + ny * M.w + nx, face: dy === 1 ? 'up' : dy === -1 ? 'down' : dx === 1 ? 'left' : 'right' });
    }
    return out;
}
