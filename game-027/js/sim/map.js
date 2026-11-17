// The chapter map: a layered path from the first workings to the boss, Slay-the-Spire style. You
// move forward along an edge one node at a time. Pure and seeded.
//
// Guarantees: the first node is an exploration; a shop is reachable before the boss on every chapter;
// no elite in the first two content layers and no two elites in a row on any path; every node can be
// reached and leads on; the boss ends the map.

import { CONTENT_LAYERS } from '../config.js';
import { rnd, rint, rweighted, mix } from '../rng.js';

export const NODE_META = {
    explore: { icon: '⛏', label: 'Explore', desc: 'Clear lines to uncover buried deposits.' },
    refine: { icon: '⚗', label: 'Refine', desc: 'Brew a potion: clear the lines the recipe asks for.' },
    battle: { icon: '⚔', label: 'Battle', desc: 'Clear lines through foes before they hurt you.' },
    shop: { icon: '⚖', label: 'Shop', desc: "Pellerin's stall: buy consumables." },
    cache: { icon: '✧', label: 'Cache', desc: 'Something left behind for you.' },
    elite: { icon: '✹', label: 'Elite', desc: 'A harder level with a richer reward.' },
    boss: { icon: '☠', label: 'Boss', desc: 'The guardian of the chapter.' },
};

function weights(layer, total, ch) {
    const d = layer / Math.max(1, total - 1);
    return {
        explore: Math.max(8, 36 - d * 16 - ch * 2),
        refine: 14 + d * 4,
        battle: 12 + d * 10 + ch * 2,
        shop: 6,
        cache: 8,
        elite: layer < 2 ? 0 : 7 + d * 14 + ch * 2,
    };
}

export function makeMap(seed, ch) {
    const o = { rs: mix(seed, ch, 977) };
    const layers = [[{ id: 'n0_0', layer: 0, type: 'explore' }]];
    for (let li = 1; li <= CONTENT_LAYERS; li++) {
        const n = rint(o, 2, 3);
        const w = weights(li - 1, CONTENT_LAYERS, ch);
        const layer = [];
        for (let k = 0; k < n; k++) layer.push({ id: `n${li}_${k}`, layer: li, type: rweighted(o, w) });
        // chapter 1 shows each kind early: the second layer always offers a battle and a refinement
        if (ch === 1 && li === 1) { layer[0].type = 'refine'; layer[1].type = 'battle'; }
        layers.push(layer);
    }
    const B = CONTENT_LAYERS + 1;
    layers.push([{ id: `n${B}_0`, layer: B, type: 'boss' }]);

    const edges = [];
    const hasEdge = (a, b) => edges.some((e) => e.from === a && e.to === b);
    for (let li = 0; li < layers.length - 1; li++) {
        const from = layers[li], to = layers[li + 1];
        from.forEach((f, k) => {
            // edges go to nearby nodes so the paths don't cross too much
            const near = to.map((t, j) => ({ t, d: Math.abs(j / Math.max(1, to.length - 1) - k / Math.max(1, from.length - 1)) }))
                .sort((a, b) => a.d - b.d || rnd(o) - 0.5);
            const m = Math.min(to.length, rint(o, 1, 2));
            for (const { t } of near.slice(0, m)) if (!hasEdge(f.id, t.id)) edges.push({ from: f.id, to: t.id });
        });
        for (const t of to) if (!edges.some((e) => e.to === t.id)) {
            const j = to.indexOf(t);
            const f = from[Math.min(from.length - 1, Math.round((j / Math.max(1, to.length - 1)) * (from.length - 1)))];
            edges.push({ from: f.id, to: t.id });
        }
    }
    const map = { chapter: ch, layers, edges, entry: 'n0_0', boss: `n${B}_0` };
    fair(map, o);
    layers.forEach((layer) => layer.forEach((n, k) => {
        n.x = n.layer / (layers.length - 1);
        n.y = layer.length === 1 ? 0.5 : 0.18 + (0.64 * k) / (layer.length - 1);
        n.seed = mix(seed, ch, n.layer * 31 + k);
    }));
    return map;
}

function fair(map, o) {
    const content = map.layers.slice(1, -1);
    // a shop somewhere in the middle of the map (the original v1 rule: one is always reachable)
    const mid = content.slice(1, -1).flat();
    if (!content.flat().some((n) => n.type === 'shop')) mid[Math.floor(rnd(o) * mid.length)].type = 'shop';
    // no elite straight after an elite, and no shop straight after a shop (one would be wasted)
    for (const e of map.edges) {
        const a = node(map, e.from), b = node(map, e.to);
        if (a.type === 'elite' && b.type === 'elite') b.type = rnd(o) < 0.5 ? 'battle' : 'explore';
        if (a.type === 'shop' && b.type === 'shop') b.type = 'cache';
    }
}

export function node(map, id) {
    for (const l of map.layers) for (const n of l) if (n.id === id) return n;
    return null;
}
export const nextIds = (map, id) => (id ? map.edges.filter((e) => e.from === id).map((e) => e.to) : [map.entry]);
