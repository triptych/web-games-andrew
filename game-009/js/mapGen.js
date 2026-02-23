/**
 * mapGen.js — Map graph generation (no Kaplay dependency, no circular imports).
 *
 * Imported by both state.js (to generate on reset) and mapPanel.js (re-exported for convenience).
 */

import { MAP_CONFIG, ENCOUNTERS } from './config.js';

// Enemy keys that are boss-only (their encounters are reserved for the boss node)
const BOSS_ENEMY_KEYS = new Set(['dragon', 'lichKing']);

/**
 * Build a semi-random branching map graph.
 * Returns { nodes: Node[], edges: [string, string][] }
 *
 * Node shape:
 *   { id, col, row, type, encounterIdx, region, label, visited, available }
 */
export function generateMapGraph() {
    const { NODES_PER_COL, NODE_TYPES_PER_COL } = MAP_CONFIG;
    const nodes = [];
    const edges = [];

    // Pool of regular (non-boss) encounters
    const regularEncs = ENCOUNTERS
        .map((enc, i) => ({ ...enc, originalIndex: i }))
        .filter(enc => !enc.enemies.some(e => BOSS_ENEMY_KEYS.has(e)));

    // Shuffle pool, repeat until we have plenty
    const shuffled = regularEncs.slice().sort(() => Math.random() - 0.5);
    let pool = shuffled.slice();
    while (pool.length < 16) pool = [...pool, ...shuffled];
    let pickIdx = 0;

    // Build nodes column by column
    for (let col = 0; col < NODES_PER_COL.length; col++) {
        const count    = NODES_PER_COL[col];
        // Shuffle the type pool so rest/shop land at random rows
        const typePool = NODE_TYPES_PER_COL[col].slice().sort(() => Math.random() - 0.5);

        for (let row = 0; row < count; row++) {
            const type = typePool[row] ?? 'battle';
            const id   = col === 0 ? 'start'
                       : col === NODES_PER_COL.length - 1 ? 'boss'
                       : `n_${col}_${row}`;

            const node = {
                id,
                col,
                row,
                type,
                encounterIdx: null,
                region:       null,
                label:        _nodeLabel(type),
                visited:      col === 0,   // village pre-visited
                available:    col === 0,
            };

            if (type === 'battle') {
                const enc          = pool[pickIdx++ % pool.length];
                node.encounterIdx  = enc.originalIndex;
                node.region        = enc.region;
            } else if (type === 'boss') {
                node.encounterIdx = 10;  // Dragon is index 10; Lich King 11 follows automatically
            }

            nodes.push(node);
        }
    }

    // Build edges: each node in col N → 1-2 nodes in col N+1
    const byCol = (col) => nodes.filter(n => n.col === col);

    for (let col = 0; col < NODES_PER_COL.length - 1; col++) {
        const from = byCol(col);
        const to   = byCol(col + 1);

        // col 0 (village) → all col 1 nodes
        if (col === 0) {
            for (const t of to) {
                edges.push([from[0].id, t.id]);
            }
            continue;
        }

        // col N-1 → boss (single node)
        if (col === NODES_PER_COL.length - 2) {
            for (const f of from) {
                edges.push([f.id, to[0].id]);
            }
            continue;
        }

        // General: sort by row to avoid crossing edges
        const fromSorted = from.slice().sort((a, b) => a.row - b.row);
        const toSorted   = to.slice().sort((a, b) => a.row - b.row);
        const reached    = new Set();

        for (let fi = 0; fi < fromSorted.length; fi++) {
            const f = fromSorted[fi];
            // Pick targets in the same row band (adjacent rows only)
            const candidates = toSorted.filter((_, ti) => Math.abs(ti - fi) <= 1);
            const count      = 1 + (Math.random() < 0.4 ? 1 : 0);
            const picks      = _pickRandom(candidates, count);
            for (const t of picks) {
                edges.push([f.id, t.id]);
                reached.add(t.id);
            }
        }

        // Ensure every destination has at least one incoming edge
        for (const t of toSorted) {
            if (!reached.has(t.id)) {
                const nearest = fromSorted.reduce((best, f) =>
                    Math.abs(f.row - t.row) < Math.abs(best.row - t.row) ? f : best
                );
                edges.push([nearest.id, t.id]);
            }
        }
    }

    return { nodes, edges };
}

function _nodeLabel(type) {
    switch (type) {
        case 'start':  return 'Village';
        case 'battle': return 'Battle';
        case 'rest':   return 'Rest Site';
        case 'shop':   return 'Merchant';
        case 'boss':   return 'Final Boss';
        default:       return type;
    }
}

function _pickRandom(arr, n) {
    return arr.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(n, arr.length));
}
