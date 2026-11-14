// A diorama as a few hundred bytes, for share links. Pure: pack() turns a room into small arrays,
// unpack() rebuilds a game from them and re-checks every placement, dropping anything that no
// longer fits (an old link, a hand-edited one). The base64 wrapping lives in ../share-link.js.

import { KIND_IDS, KINDS, PALETTE, validRecipe } from './data/catalog.js';
import { LEVEL } from './data/levels.js';
import { newGame } from './game.js';
import { placementFor } from './room.js';

const CIDX = Object.fromEntries(PALETTE.map((c, i) => [c.id, i]));
const ORDER = { rug: 0, floor: 1, top: 2, wall: 3 };

export function pack(G, caption = '') {
    const P = G.items.filter((i) => i.at).sort((a, b) => ORDER[a.at.layer] - ORDER[b.at.layer] || a.id - b.id);
    const index = new Map(P.map((it, i) => [it.id, i]));
    const it = P.map((i) => {
        const head = [KIND_IDS.indexOf(i.kind), i.size, i.variant, i.motif | 0, CIDX[i.colors[0]], CIDX[i.colors[1]], i.lump % 1000];
        const a = i.at;
        if (a.layer === 'wall') return [...head, 3, a.wall === 'L' ? 0 : 1, a.u, a.v];
        if (a.layer === 'top') return [...head, 2, a.x, a.y, a.rot, index.get(a.on)];
        return [...head, a.layer === 'rug' ? 0 : 1, a.x, a.y, a.rot];
    });
    const out = { v: 1, l: G.level, it };
    if (caption) out.c = String(caption).slice(0, 60);
    return out;
}

/** Rebuild a read-only game from a packed diorama. Returns { G, dropped } or null if unreadable. */
export function unpack(o) {
    if (!o || o.v !== 1 || !LEVEL[o.l] || !Array.isArray(o.it) || o.it.length > 200) return null;
    const G = newGame(1, o.l);
    G.items = [];
    G.events.length = 0;
    G.clay = 0;
    const ids = [];
    let dropped = 0;
    for (const row of o.it) {
        if (!Array.isArray(row) || row.length < 11) { dropped++; ids.push(null); continue; }
        const [k, size, variant, motif, c0, c1, lump, layer, a, b, c, d] = row;
        const kind = KIND_IDS[k];
        const recipe = { kind, size, variant, motif, colors: [PALETTE[c0]?.id, PALETTE[c1]?.id] };
        if (!kind || !validRecipe({ ...recipe, motif: KINDS[kind].motifs || KINDS[kind].glow ? motif : 0 })) { dropped++; ids.push(null); continue; }
        const it = { id: G.nextId++, ...recipe, motif: motif | 0, lump: lump | 0, gift: false, at: null };
        G.items.push(it);
        let spec;
        if (layer === 3) spec = { wall: a === 0 ? 'L' : 'R', u: b, v: c };
        else if (layer === 2) {
            const host = ids[d];
            if (host == null) { G.items.pop(); dropped++; ids.push(null); continue; }
            spec = { x: a, y: b, rot: c };
        } else spec = { x: a, y: b, rot: c };
        const p = placementFor(G, it.id, spec);
        const want = layer === 3 ? 'wall' : layer === 2 ? 'top' : layer === 0 ? 'rug' : 'floor';
        if (!p.at || p.at.layer !== want) { G.items.pop(); dropped++; ids.push(null); continue; }
        it.at = p.at;
        ids.push(it.id);
    }
    G.visit = { caption: typeof o.c === 'string' ? o.c.slice(0, 60) : '' };
    return { G, dropped };
}
