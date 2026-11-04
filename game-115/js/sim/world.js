// The map: terrain, wild resources, and where things may be built. Terrain is rebuilt from the seed
// (never saved); resource nodes are saved because they deplete and regrow.

import { MAP, BOUNDS, HALL_POS, HARVEST } from '../config.js';
import { makeRng, hash3 } from '../rng.js';
import { BUILDINGS } from './data/buildings.js';

export const T_GRASS = 0, T_WATER = 1, T_BRIDGE = 2;

export const NODE_KINDS = {
    tree: { name: 'Tree', hp: 3, item: 'wood', perHit: 1, fell: 2, regrow: HARVEST.regrowTree, tool: '🪓' },
    rock: { name: 'Boulder', hp: 4, item: 'stone', perHit: 1, fell: 2, regrow: HARVEST.regrowRock, tool: '⛏️' },
    bush: { name: 'Berry Bush', hp: 1, item: 'berry', perHit: 0, fell: 3, regrow: HARVEST.regrowBush, tool: '🧺' },
    flax: { name: 'Flax', hp: 1, item: 'fiber', perHit: 0, fell: 3, regrow: HARVEST.regrowBush, tool: '🧺' },
    herbp: { name: 'Wild Herbs', hp: 1, item: 'herb', perHit: 0, fell: 2, regrow: HARVEST.regrowBush, tool: '🧺' },
    mush: { name: 'Mushrooms', hp: 1, item: 'mushroom', perHit: 0, fell: 2, regrow: HARVEST.regrowBush, tool: '🧺' },
};

export const idx = (x, y) => y * MAP.w + x;
export const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP.w && y < MAP.h;

export function riverCenter(y) { return 29.6 + 2.0 * Math.sin(y * 0.33) + 0.9 * Math.sin(y * 0.85 + 1); }

export function makeTerrain() {
    const t = new Uint8Array(MAP.w * MAP.h);
    for (let y = 0; y < MAP.h; y++) {
        const c = riverCenter(y);
        for (let x = 0; x < MAP.w; x++) {
            if (Math.abs(x + 0.5 - c) < 1.6) t[idx(x, y)] = (y === 13 || y === 14) ? T_BRIDGE : T_WATER;
        }
    }
    // a pond in the south-west
    for (let y = 18; y < 25; y++) for (let x = 2; x < 11; x++) {
        if (Math.hypot(x + 0.5 - 6.2, (y + 0.5 - 21.6) * 1.2) < 2.5) t[idx(x, y)] = T_WATER;
    }
    return t;
}

/** Which Hall level first owns a tile: 0..5, or 6 when it is always wild. */
export function zoneOf(x, y) {
    for (let i = 0; i < BOUNDS.length; i++) {
        const b = BOUNDS[i];
        if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return i;
    }
    return 6;
}

const DENS = [
    { tree: 0.085, rock: 0.05, bush: 0.025, flax: 0.02, herbp: 0.015, mush: 0.004 },
    { tree: 0.13, rock: 0.04, bush: 0.02, flax: 0.016, herbp: 0.012, mush: 0.01 },
    { tree: 0.17, rock: 0.045, bush: 0.02, flax: 0.016, herbp: 0.012, mush: 0.012 },
    { tree: 0.2, rock: 0.05, bush: 0.015, flax: 0.012, herbp: 0.012, mush: 0.014 },
    { tree: 0.25, rock: 0.05, bush: 0.012, flax: 0.01, herbp: 0.01, mush: 0.014 },
    { tree: 0.3, rock: 0.05, bush: 0.012, flax: 0.01, herbp: 0.01, mush: 0.014 },
    { tree: 0.62, rock: 0.04, bush: 0, flax: 0, herbp: 0, mush: 0 },
];

/** Reserve a margin around the starting hut and the road to the gate so the first minutes are clear. */
function reservedStart(x, y) {
    if (x >= HALL_POS.x - 1 && x <= HALL_POS.x + 3 && y >= HALL_POS.y - 1 && y <= HALL_POS.y + 5) return true;
    return false;
}
export function isGateTile(G, x, y) { return y === 15 && x >= G.bounds.x0 && x <= G.bounds.x0 + 1; }

export function makeNodes(seed, terr) {
    const rng = makeRng(seed ^ 0x5eed);
    const nodes = [];
    let id = 0;
    for (let y = 0; y < MAP.h; y++) for (let x = 0; x < MAP.w; x++) {
        if (terr[idx(x, y)] !== T_GRASS || reservedStart(x, y)) continue;
        if (y === 15 && x <= HALL_POS.x) continue;                  // the road
        const dn = DENS[zoneOf(x, y)];
        const r = rng();
        let acc = 0, kind = null;
        for (const k of ['tree', 'rock', 'bush', 'flax', 'herbp', 'mush']) { acc += dn[k]; if (r < acc) { kind = k; break; } }
        if (!kind) continue;
        // keep a hand-placed feeling: nudge inside the tile, vary the picture
        nodes.push({ id: ++id, k: kind, x, y, ox: +(rng() * 0.5 - 0.25).toFixed(2), oy: +(rng() * 0.4 - 0.2).toFixed(2), v: Math.floor(rng() * 4), hp: NODE_KINDS[kind].hp, regrow: 0 });
    }
    return nodes;
}

export function rebuildOcc(G) {
    G.occ = new Int32Array(MAP.w * MAP.h);
    for (const b of G.buildings) {
        const d = BUILDINGS[b.type];
        for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) G.occ[idx(b.x + i, b.y + j)] = b.id;
    }
}

export function ownedAt(G, x, y) {
    const b = G.bounds;
    return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
}

/** Why a building cannot go here, or null if it can. `ignoreId` lets a building be moved onto itself. */
export function placeProblem(G, type, x, y, ignoreId = 0) {
    const d = BUILDINGS[type];
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
        const tx = x + i, ty = y + j;
        if (!inMap(tx, ty)) return 'off the map';
        if (!ownedAt(G, tx, ty)) return 'outside your land';
        if (G.terr[idx(tx, ty)] !== T_GRASS) return 'on water';
        const o = G.occ[idx(tx, ty)];
        if (o && o !== ignoreId) return 'something is already there';
        if (isGateTile(G, tx, ty)) return 'in the way of the gate road';
    }
    if (d.needsWater) {
        let ok = false;
        for (let j = -1; j <= d.h && !ok; j++) for (let i = -1; i <= d.w && !ok; i++) {
            const inside = i >= 0 && i < d.w && j >= 0 && j < d.h;
            if (inside) continue;
            const tx = x + i, ty = y + j;
            if (inMap(tx, ty) && G.terr[idx(tx, ty)] === T_WATER && (i < 0 || i >= d.w) !== (j < 0 || j >= d.h)) ok = true;
        }
        if (!ok) return 'it must touch the river';
    }
    return null;
}

/** Remove wild nodes under a footprint. Returns what they were worth in goods. */
export function clearNodesUnder(G, type, x, y) {
    const d = BUILDINGS[type];
    const got = {};
    G.nodes = G.nodes.filter((n) => {
        if (n.x >= x && n.x < x + d.w && n.y >= y && n.y < y + d.h) {
            const k = NODE_KINDS[n.k];
            if (n.regrow <= 0) got[k.item] = (got[k.item] || 0) + (n.k === 'tree' || n.k === 'rock' ? 2 : 1);
            return false;
        }
        return true;
    });
    return got;
}

/** How many live nodes of a kind are within `r` tiles of a building: the "forest nearby" bonus. */
export function nodesNear(G, b, kind, r = 5) {
    const d = BUILDINGS[b.type];
    const cx = b.x + d.w / 2, cy = b.y + d.h / 2;
    let n = 0;
    for (const o of G.nodes) if (o.k === kind && o.regrow <= 0 && Math.hypot(o.x + 0.5 - cx, o.y + 0.5 - cy) <= r + Math.max(d.w, d.h) / 2) n++;
    return n;
}

/** Find a free spot for a building near a point, searching in rings. Used by the bot and "auto place". */
export function findSpot(G, type, nearX, nearY, gap = 1, maxR = 14) {
    const d = BUILDINGS[type];
    let best = null, bd = Infinity;
    for (let y = G.bounds.y0; y <= G.bounds.y1; y++) for (let x = G.bounds.x0; x <= G.bounds.x1; x++) {
        if (placeProblem(G, type, x, y)) continue;
        // a gap of free tiles around it keeps paths open
        let blocked = false;
        for (let j = -gap; j < d.h + gap && !blocked; j++) for (let i = -gap; i < d.w + gap && !blocked; i++) {
            const tx = x + i, ty = y + j;
            if (i >= 0 && i < d.w && j >= 0 && j < d.h) continue;
            if (inMap(tx, ty) && G.occ[idx(tx, ty)]) blocked = true;
        }
        if (blocked) continue;
        const dd = Math.hypot(x + d.w / 2 - nearX, y + d.h / 2 - nearY) + hash3(x, y, 7) * 0.5;
        if (dd < bd && dd <= maxR) { bd = dd; best = { x, y }; }
    }
    return best;
}
