/**
 * sector.js — procedural sector maps. Rows of nodes with branching edges; the
 * last row is the boss. Every node is reachable and has a way forward.
 */

export const NODE_TYPES = {
    battle:  { name: 'Skirmish', desc: 'A Null patrol.' },
    elite:   { name: 'Elite', desc: 'A hardened unit with affixes. Pick a module after.' },
    event:   { name: 'Signal', desc: 'Something on the scopes. Could be anything.' },
    salvage: { name: 'Salvage', desc: 'A wreck worth stripping. Pick one of three.' },
    depot:   { name: 'Depot', desc: 'Buy boosters and modules.' },
    rest:    { name: 'Repair Bay', desc: 'Repair your hull or tune a module.' },
    boss:    { name: 'Boss', desc: 'The sector commander.' },
};

export function generateSector(rng, chapter) {
    const nRows = chapter === 0 ? 5 : 8;
    const rows = [];
    let id = 0;
    for (let r = 0; r < nRows; r++) {
        const count = r === nRows - 1 ? 1 : r === 0 ? 3 : rng.int(2, 4);
        const row = [];
        for (let i = 0; i < count; i++) {
            const x = count === 1 ? 0.5 : 0.12 + (0.76 * i) / (count - 1) + rng.range(-0.04, 0.04);
            row.push({ id: id++, r, i, x, type: 'battle', edges: [] });
        }
        rows.push(row);
    }
    // types
    const last = nRows - 1;
    for (const row of rows) for (const n of row) n.type = pickType(rng, chapter, n.r, last);
    if (chapter === 0) {
        rows[1].forEach((n, i) => { n.type = i === 1 ? 'event' : 'battle'; });
        rows[2].forEach((n) => { n.type = 'battle'; });
        rows[3].forEach((n, i) => { n.type = i % 2 ? 'depot' : 'rest'; });
    } else {
        // the row before the boss always offers a repair bay
        if (!rows[last - 1].some((n) => n.type === 'rest')) rows[last - 1][0].type = 'rest';
    }
    // edges: each node links to the nearest node(s) in the next row
    for (let r = 0; r < last; r++) {
        const next = rows[r + 1];
        for (const n of rows[r]) {
            const sorted = next.slice().sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x));
            n.edges.push(sorted[0].id);
            if (sorted[1] && rng.chance(0.45) && Math.abs(sorted[1].x - n.x) < 0.45) n.edges.push(sorted[1].id);
        }
        for (const m of next) {
            if (rows[r].some((n) => n.edges.includes(m.id))) continue;
            const from = rows[r].slice().sort((a, b) => Math.abs(a.x - m.x) - Math.abs(b.x - m.x))[0];
            from.edges.push(m.id);
        }
    }
    const nodes = rows.flat();
    return { nodes, rows: nRows };
}

function pickType(rng, chapter, r, last) {
    if (r === last) return 'boss';
    if (r === 0) return 'battle';
    if (r === last - 1) return rng.pick(['rest', 'depot', 'rest', 'event']);
    const w = { battle: 46, event: 18, salvage: 8, depot: 8, rest: 6 };
    if (chapter > 0 && r >= 2) w.elite = 14;
    return rng.weighted(w);
}

export function nodeById(sector, id) {
    return sector.nodes.find((n) => n.id === id);
}

/** Nodes the player can move to next. */
export function nextNodes(sector) {
    if (sector.at === null) return sector.nodes.filter((n) => n.r === 0);
    const cur = nodeById(sector, sector.at);
    return cur.edges.map((id) => nodeById(sector, id));
}

/** Difficulty of a node on the shared curve. */
export function nodeX(sector, node) {
    return sector.chapter + node.r * 0.09 + 5 * sector.threat;
}
