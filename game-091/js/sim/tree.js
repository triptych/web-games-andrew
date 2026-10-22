// The Constellation: a skill tree laid out like a Slay the Spire map. Pure.
//
// Rows run from the bottom. Six random walks climb from row 0 to the top, each step moving at
// most one column and never crossing an edge already drawn; the nodes are every cell a walk
// visited. You light any node in row 0 first, then always a node joined by an edge to the one
// you lit last, so every point spent narrows the paths still open to you.

import { NODES, TREE } from './data.js';

const id = (r, c) => `${r}:${c}`;

/** Weighted pick from { key: weight }, skipping keys in `not`. */
function weighted(rng, pool, not = new Set()) {
    const keys = Object.keys(pool).filter((k) => !not.has(k));
    const total = keys.reduce((s, k) => s + pool[k], 0);
    let x = rng() * total;
    for (const k of keys) { x -= pool[k]; if (x < 0) return k; }
    return keys[keys.length - 1];
}

export function makeTree(rng) {
    const { rows, cols, paths } = TREE;
    const nodes = new Map();           // id → { id, r, c, kind }
    const edges = new Set();           // 'r:c>r+1:c2'
    const edgeList = [];               // [r, c, c2] for the crossing test
    const add = (r, c) => { if (!nodes.has(id(r, c))) nodes.set(id(r, c), { id: id(r, c), r, c, kind: null }); };
    const crosses = (r, a, b) => edgeList.some(([er, c, d]) => er === r && (a - c) * (b - d) < 0);

    const top = rows - 1;
    for (let p = 0; p < paths; p++) {
        let c = p < cols ? p : rng.int(0, cols - 1);
        add(0, c);
        for (let r = 0; r < top - 1; r++) {
            const opts = [c - 1, c, c + 1].filter((x) => x >= 0 && x < cols && !crosses(r, c, x));
            const n = rng.pick(opts);
            const key = `${id(r, c)}>${id(r + 1, n)}`;
            if (!edges.has(key)) { edges.add(key); edgeList.push([r, c, n]); }
            add(r + 1, n);
            c = n;
        }
    }
    // every node in the last row before the top joins the single top star
    add(top, 0);
    for (const n of nodes.values()) if (n.r === top - 1) edges.add(`${n.id}>${id(top, 0)}`);

    // contents: keystones on their rows, the top star, minor nodes elsewhere (no repeats in a row)
    const minor = {}, keys = [];
    for (const [k, d] of Object.entries(NODES)) {
        if (d.tier === 'minor') minor[k] = d.w;
        else if (d.tier === 'key') keys.push(k);
    }
    for (let r = 0; r < rows; r++) {
        const row = [...nodes.values()].filter((n) => n.r === r).sort((a, b) => a.c - b.c);
        if (r === top) { row[0].kind = 'supernova'; continue; }
        const used = new Set();
        if (TREE.keyRows.includes(r)) {
            // every keystone row offers an Extra Reel somewhere
            const pool = keys.filter((k) => k !== 'reel');
            const kinds = ['reel'];
            while (kinds.length < row.length) {
                const k = rng.pick(pool.filter((x) => !kinds.includes(x)));
                kinds.push(k);
            }
            // shuffle so the reel isn't always in the same column
            for (let i = kinds.length - 1; i > 0; i--) { const j = rng.int(0, i); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
            row.forEach((n, i) => { n.kind = kinds[i]; });
        } else {
            for (const n of row) { n.kind = weighted(rng, minor, used); used.add(n.kind); }
        }
    }
    return {
        nodes: [...nodes.values()].sort((a, b) => a.r - b.r || a.c - b.c),
        edges: [...edges].sort(),
        lit: [],                       // ids, in the order they were lit
    };
}

/** The ids you may light next. */
export function available(T) {
    if (!T.lit.length) return T.nodes.filter((n) => n.r === 0).map((n) => n.id);
    const last = T.lit[T.lit.length - 1];
    return T.edges.filter((e) => e.startsWith(last + '>')).map((e) => e.split('>')[1]);
}

export const nodeById = (T, nid) => T.nodes.find((n) => n.id === nid) || null;
