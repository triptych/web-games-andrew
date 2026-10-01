/**
 * map.js — one branching map per world: ten floors (levels), Slay-the-Spire style.
 *
 * Four paths walk up a 5-column lattice from floor 1 to floor 9, stepping at
 * most one column sideways per floor and never crossing an existing edge.
 * The union of the paths is the map; floor 10 is the Warden.
 *
 * Fixed floors: 1 battle · 5 treasure · 9 campfire · 10 Warden.
 */

import { makeRng, hashSeed } from './rng.js';
import { WORLD_DEFS } from './worlds.js';
import { FLOORS } from './rules.js';

const COLS = 5;

function crosses(edges, f, a, b) {
    for (const [f2, a2, b2] of edges) {
        if (f2 !== f) continue;
        if ((a2 - a) * (b2 - b) < 0) return true;
    }
    return false;
}

export function generateMap(runSeed, w) {
    const rng = makeRng(hashSeed(runSeed, w, 555));
    const wd = WORLD_DEFS[w];
    const edges = []; // [floor, fromCol, toCol]
    const visited = new Set();
    const key = (f, c) => `${f}:${c}`;

    const starts = rng.shuffle([0, 1, 2, 3, 4]).slice(0, 3);
    starts.push(rng.int(0, COLS - 1));
    for (const s of starts) {
        let c = s;
        visited.add(key(1, c));
        for (let f = 1; f < FLOORS - 1; f++) {
            const opts = rng.shuffle([-1, 0, 1]).map((d) => c + d).filter((n) => n >= 0 && n < COLS);
            let nc = opts.find((n) => !crosses(edges, f, c, n));
            if (nc === undefined) nc = c;
            if (!edges.some((e) => e[0] === f && e[1] === c && e[2] === nc)) edges.push([f, c, nc]);
            c = nc;
            visited.add(key(f + 1, c));
        }
    }

    const nodes = {};
    const floors = [];
    for (let f = 1; f <= FLOORS; f++) floors.push([]);
    for (const k of visited) {
        const [f, c] = k.split(':').map(Number);
        const id = `n${f}_${c}`;
        nodes[id] = { id, floor: f, col: c, type: 'battle', next: [], prev: [], name: '', seed: hashSeed(runSeed, w, f, c) };
        floors[f - 1].push(id);
    }
    const bossId = `n${FLOORS}_2`;
    nodes[bossId] = { id: bossId, floor: FLOORS, col: 2, type: 'boss', next: [], prev: [], name: wd.warden, seed: hashSeed(runSeed, w, 99) };
    floors[FLOORS - 1].push(bossId);
    for (const [f, a, b] of edges) {
        const from = nodes[`n${f}_${a}`], to = nodes[`n${f + 1}_${b}`];
        if (!from.next.includes(to.id)) { from.next.push(to.id); to.prev.push(from.id); }
    }
    for (const id of floors[FLOORS - 2]) { nodes[id].next.push(bossId); nodes[bossId].prev.push(id); }
    for (const fl of floors) fl.sort((a, b) => nodes[a].col - nodes[b].col);

    // node types
    for (let f = 1; f < FLOORS; f++) {
        for (const id of floors[f - 1]) {
            const n = nodes[id];
            if (f === 1) { n.type = 'battle'; continue; }
            if (f === 5) { n.type = 'treasure'; continue; }
            if (f === FLOORS - 1) { n.type = 'rest'; continue; }
            const table = f <= 4
                ? { battle: 52, event: 30, shop: f >= 3 ? 16 : 0, elite: f === 4 && w > 0 ? 8 : 0 }
                : { battle: 38, elite: 20, event: 20, rest: f <= 7 ? 12 : 0, shop: 10 };
            let t = 'battle';
            for (let tries = 0; tries < 6; tries++) {
                t = rng.weighted(table);
                const clash = ['elite', 'shop', 'rest'].includes(t) && n.prev.some((p) => nodes[p].type === t);
                if (!clash) break;
            }
            n.type = t;
        }
    }
    // guarantee a shop and an elite exist somewhere on floors 6-8
    ensureType(rng, nodes, floors, 'shop', [3, 4, 6, 7, 8]);
    if (w > 0) ensureType(rng, nodes, floors, 'elite', [6, 7, 8]);

    // place names
    const used = new Set();
    for (const id in nodes) {
        const n = nodes[id];
        if (n.type === 'boss') continue;
        const nr = makeRng(n.seed);
        let name = '';
        for (let i = 0; i < 6; i++) {
            name = `The ${nr.pick(wd.placeAdj)} ${nr.pick(wd.placeNoun)}`;
            if (!used.has(name)) break;
        }
        used.add(name);
        n.name = name;
    }
    return { world: w, nodes, floors, bossId, startIds: floors[0] };
}

function ensureType(rng, nodes, floors, type, onFloors) {
    const any = onFloors.some((f) => floors[f - 1].some((id) => nodes[id].type === type));
    if (any) return;
    const cands = onFloors.flatMap((f) => floors[f - 1]).filter((id) => nodes[id].type === 'battle' || nodes[id].type === 'event');
    if (cands.length) nodes[rng.pick(cands)].type = type;
}

/** Which nodes can be entered next, given the node just completed (null = world start). */
export function reachable(map, fromId) {
    if (!fromId) return map.startIds.slice();
    return map.nodes[fromId]?.next.slice() ?? [];
}
