/**
 * map.js — Seeded procedural run-map generator (game-plan §9).
 *
 * Generates a layered DAG chapter map:
 *   - Entry node (far left, layer 0)
 *   - Content layers (each with 2–4 nodes, 2–3 forward edges per node)
 *   - Boss node (far right, single terminal)
 *
 * Fairness guarantees:
 *   - ≥1 shop reachable before the boss
 *   - No two elites back-to-back on any path
 *   - Boss is always terminal (no edges out)
 *   - Entry node is always an exploration puzzle
 *
 * Node types: 'explore' | 'refine' | 'battle' | 'shop' | 'cache' | 'elite' | 'boss'
 *
 * Usage:
 *   import { generateMap, getForwardNodes, getNodeDef } from './map.js';
 *   const mapData = generateMap(seed, chapter);
 */

// ─────────────────────────────────────────────
// Simple deterministic LCG PRNG (seeded)
// ─────────────────────────────────────────────

class Rng {
    constructor(seed) {
        // Mix the seed so small integers give distinct sequences.
        this._s = (seed ^ 0xdeadbeef) >>> 0;
        for (let i = 0; i < 8; i++) this._next();
    }
    _next() {
        this._s = Math.imul(1664525, this._s) + 1013904223;
        this._s >>>= 0;
        return this._s;
    }
    float() { return this._next() / 0x100000000; }
    int(min, max) { return min + (this._next() % (max - min + 1)); }
    pick(arr) { return arr[this._next() % arr.length]; }
    shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = this._next() % (i + 1);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
}

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

/** Content-layer count (not counting entry or boss layers). */
const CONTENT_LAYERS = 6;

/** Nodes per content layer. */
const NODES_PER_LAYER_MIN = 2;
const NODES_PER_LAYER_MAX = 3;

/** Forward edges per node (to next layer). */
const EDGES_PER_NODE_MIN = 2;
const EDGES_PER_NODE_MAX = 3;

/**
 * Node type weights per layer index (0 = first content layer).
 * Higher chapter number shifts the distribution toward tougher nodes.
 */
function layerTypeWeights(layerIndex, totalLayers, chapter) {
    const depth = layerIndex / (totalLayers - 1); // 0→1
    return {
        explore: Math.max(0, 40 - depth * 20 - chapter * 2),
        refine:  10 + depth * 5,
        battle:  10 + depth * 10 + chapter * 2,
        shop:    12,
        cache:   10,
        elite:   Math.max(0, 8 + depth * 15 + chapter * 3),
    };
}

function weightedPick(rng, weights) {
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = rng.float() * total;
    for (const [type, w] of Object.entries(weights)) {
        r -= w;
        if (r <= 0) return type;
    }
    return Object.keys(weights)[0];
}

// ─────────────────────────────────────────────
// Generator
// ─────────────────────────────────────────────

/**
 * Generate a complete map for a chapter.
 * @param {number} seed    — integer seed (deterministic)
 * @param {number} chapter — chapter number (1-based, affects difficulty weights)
 * @returns {MapData}
 */
export function generateMap(seed, chapter = 1) {
    const rng = new Rng(seed + chapter * 997);

    // --- Build layers ---
    // Layer 0: entry
    // Layers 1..CONTENT_LAYERS: content
    // Layer CONTENT_LAYERS+1: boss

    const totalContentLayers = CONTENT_LAYERS;
    const layers = [];

    // Entry node
    layers.push([{ id: 'n0_0', layer: 0, type: 'explore', x: 0, y: 0 }]);

    // Content layers
    for (let li = 0; li < totalContentLayers; li++) {
        const count = rng.int(NODES_PER_LAYER_MIN, NODES_PER_LAYER_MAX);
        const layer = [];
        const weights = layerTypeWeights(li, totalContentLayers, chapter);
        for (let ni = 0; ni < count; ni++) {
            const type = weightedPick(rng, weights);
            layer.push({ id: `n${li + 1}_${ni}`, layer: li + 1, type, x: 0, y: 0 });
        }
        layers.push(layer);
    }

    // Boss node
    const bossLayer = totalContentLayers + 1;
    layers.push([{ id: `n${bossLayer}_0`, layer: bossLayer, type: 'boss', x: 0, y: 0 }]);

    // --- Build edges (forward only) ---
    const edges = []; // { from: nodeId, to: nodeId }
    const nodeById = new Map();
    for (const layer of layers) {
        for (const n of layer) nodeById.set(n.id, n);
    }

    for (let li = 0; li < layers.length - 1; li++) {
        const fromLayer = layers[li];
        const toLayer   = layers[li + 1];

        // For each node in fromLayer, pick 2–3 targets in toLayer.
        for (const from of fromLayer) {
            const edgeCount = Math.min(
                rng.int(EDGES_PER_NODE_MIN, EDGES_PER_NODE_MAX),
                toLayer.length
            );
            const targets = rng.shuffle(toLayer).slice(0, edgeCount);
            for (const to of targets) {
                // Deduplicate
                if (!edges.find(e => e.from === from.id && e.to === to.id)) {
                    edges.push({ from: from.id, to: to.id });
                }
            }
        }

        // Ensure every toLayer node has ≥1 incoming edge (no dead nodes).
        for (const to of toLayer) {
            if (!edges.find(e => e.to === to.id)) {
                const from = rng.pick(fromLayer);
                edges.push({ from: from.id, to: to.id });
            }
        }
    }

    // --- Fairness pass ---
    _applyFairness(layers, edges, rng, chapter);

    // --- Assign display positions ---
    _assignPositions(layers);

    return {
        seed,
        chapter,
        layers,
        edges,
        entryNodeId: layers[0][0].id,
        bossNodeId:  layers[layers.length - 1][0].id,
    };
}

// ─────────────────────────────────────────────
// Fairness guarantees
// ─────────────────────────────────────────────

function _applyFairness(layers, edges, rng, chapter) {
    const contentLayers = layers.slice(1, layers.length - 1);

    // Guarantee 1: ≥1 shop reachable before the boss.
    const hasShop = contentLayers.some(layer => layer.some(n => n.type === 'shop'));
    if (!hasShop && contentLayers.length >= 2) {
        // Force a shop into the middle content layer.
        const midLayer = contentLayers[Math.floor(contentLayers.length / 2)];
        const target = rng.pick(midLayer);
        target.type = 'shop';
    }

    // Guarantee 2: No two consecutive elite nodes on any path through layers.
    for (let li = 0; li < contentLayers.length - 1; li++) {
        for (const n of contentLayers[li]) {
            if (n.type !== 'elite') continue;
            // Find toLayer nodes reachable from this elite.
            const reachable = edges
                .filter(e => e.from === n.id)
                .map(e => contentLayers[li + 1]?.find(m => m.id === e.to))
                .filter(Boolean);
            for (const next of reachable) {
                if (next.type === 'elite') {
                    // Demote to explore or battle.
                    next.type = rng.float() < 0.5 ? 'explore' : 'battle';
                }
            }
        }
    }

    // Guarantee 3: Early layers (first 2) have no elites or bosses.
    for (const n of (contentLayers[0] || [])) {
        if (n.type === 'elite') n.type = 'explore';
    }
    if (contentLayers[1]) {
        for (const n of contentLayers[1]) {
            if (n.type === 'elite') n.type = rng.float() < 0.5 ? 'battle' : 'refine';
        }
    }
}

// ─────────────────────────────────────────────
// Display positions (logical, for MapScene to scale)
// ─────────────────────────────────────────────

function _assignPositions(layers) {
    const totalLayers = layers.length;
    for (let li = 0; li < totalLayers; li++) {
        const layer = layers[li];
        const count = layer.length;
        for (let ni = 0; ni < count; ni++) {
            // x: 0→1 left-to-right
            layer[ni].x = li / (totalLayers - 1);
            // y: evenly spaced 0→1 top-to-bottom, centred
            layer[ni].y = count === 1 ? 0.5 : ni / (count - 1);
        }
    }
}

// ─────────────────────────────────────────────
// Query helpers
// ─────────────────────────────────────────────

/**
 * Return forward-reachable node ids from a given nodeId.
 * @param {MapData} mapData
 * @param {string}  nodeId
 * @returns {string[]}
 */
export function getForwardNodeIds(mapData, nodeId) {
    return mapData.edges
        .filter(e => e.from === nodeId)
        .map(e => e.to);
}

/**
 * Find a node definition by id.
 * @param {MapData} mapData
 * @param {string}  nodeId
 * @returns {MapNode|undefined}
 */
export function getNodeDef(mapData, nodeId) {
    for (const layer of mapData.layers) {
        const n = layer.find(n => n.id === nodeId);
        if (n) return n;
    }
}

/**
 * Return all nodes reachable (via edges) from the entry node,
 * in BFS order — useful for greying out unreachable branches.
 * @param {MapData} mapData
 * @param {string}  fromNodeId — start of reachability check
 * @returns {Set<string>}
 */
export function getReachableIds(mapData, fromNodeId) {
    const visited = new Set([fromNodeId]);
    const queue   = [fromNodeId];
    while (queue.length) {
        const cur = queue.shift();
        for (const { from, to } of mapData.edges) {
            if (from === cur && !visited.has(to)) {
                visited.add(to);
                queue.push(to);
            }
        }
    }
    return visited;
}

// ─────────────────────────────────────────────
// Node-type metadata (icon, label, color)
// ─────────────────────────────────────────────

export const NODE_META = {
    explore: { icon: '⚗',  label: 'Explore', color: 0x6ab04c },
    refine:  { icon: '🜲', label: 'Refine',  color: 0xa29bfe },
    battle:  { icon: '⚔',  label: 'Battle',  color: 0xe17055 },
    shop:    { icon: '🛒', label: 'Shop',    color: 0xfdcb6e },
    cache:   { icon: '🎁', label: 'Cache',   color: 0x74b9ff },
    elite:   { icon: '🔥', label: 'Elite',   color: 0xff7675 },
    boss:    { icon: '💀', label: 'BOSS',    color: 0xd63031 },
};

/**
 * Map the node type to the Phaser scene key and init data to launch.
 * GameScene/UIScene handle explore, refine, battle, elite.
 * ShopScene handles shop (Phase 8 — for now, uses a stub).
 * VNScene handles cache/event.
 * @param {MapNode}    node
 * @param {GameState}  state
 * @returns {{ scene: string, data: object }}
 */
export function nodeToScene(node, state) {
    switch (node.type) {
        case 'explore':
        case 'refine':
        case 'battle':
        case 'elite':
        case 'boss':
            return { scene: 'GameScene', data: { nodeId: node.id, nodeType: node.type } };
        case 'shop':
            return { scene: 'ShopScene', data: { nodeId: node.id } };
        case 'cache':
            return { scene: 'VNScene', data: { scriptId: 'cache-event', nodeId: node.id } };
        default:
            return { scene: 'GameScene', data: { nodeId: node.id, nodeType: 'explore' } };
    }
}
