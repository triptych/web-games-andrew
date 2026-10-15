// The planner: what can be reached holding a given set of grimoires, assuming you open every lock
// you can and pick up every dungeon key you can reach. dev/simtest.mjs uses it to prove the
// kingdom can be finished, that each grimoire's lock really keeps you out until you have it, and
// that every chest, door and person can be reached in the end.

import { getWorld } from './worldgen.js';
import { search, node, besideNodes } from './nav.js';
import { BOOK_DUNGEON } from './story.js';

export function startNode() {
    const { maps } = getWorld();
    const W = maps.world;
    for (const k in W.warps) if (W.warps[k].to === 'library') return node('world', k % W.w, Math.floor(k / W.w) + 2);
    throw new Error('no library');
}

function objectSeen(res, map, x, y) {
    return besideNodes(map, x, y).some((b) => res.seen(b.k));
}

/** Flood the kingdom holding `books`. Returns { res, keys, objSeen(map, x, y) }. */
export function reach(books, from = startNode()) {
    const { maps } = getWorld();
    const keys = {};
    let res = null;
    const all12 = books.length >= 12;
    for (let iter = 0; iter < 16; iter++) {
        res = search({ G: null, books, keys, placed: all12 ? 12 : 0, starOpen: all12 && books.includes('stars') }, from);
        let changed = false;
        for (const id in maps) {
            const M = maps[id];
            if (keys[id]) continue;
            for (const k in M.objs) {
                const o = M.objs[k];
                if (o.kind === 'chest' && o.key && objectSeen(res, id, k % M.w, Math.floor(k / M.w))) { keys[id] = 1; changed = true; }
            }
        }
        if (!changed) break;
    }
    return { res, keys, objSeen: (map, x, y) => objectSeen(res, map, x, y) };
}

export function bossPos(dungeon) {
    const M = getWorld().maps[dungeon];
    for (const k in M.objs) if (M.objs[k].kind === 'boss') return { x: k % M.w, y: Math.floor(k / M.w) };
    return null;
}

/** Can this grimoire's guardian be reached holding `books`? */
export function bookReachable(R, id) {
    const dg = BOOK_DUNGEON[id];
    const b = bossPos(dg);
    return R.objSeen(dg, b.x, b.y);
}

/** Collect guardians greedily, as a player would. Returns the order, or null if it gets stuck. */
export function progression() {
    const books = [];
    const order = [];
    for (let round = 0; round < 13 && books.length < 12; round++) {
        const R = reach(books);
        const got = Object.keys(BOOK_DUNGEON).filter((id) => !books.includes(id) && bookReachable(R, id));
        if (!got.length) return { order, stuck: true, books };
        for (const id of got) { books.push(id); order.push(id); }
    }
    const R = reach(books);
    const fb = bossPos('undercroft');
    return { order, stuck: false, books, finalReachable: R.objSeen('undercroft', fb.x, fb.y), R };
}
