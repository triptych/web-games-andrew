// Floor generation. Pure and seeded: genFloor(seed, n) always builds the same floor n for the same game.
//
// A floor is a w×h grid of cells, filled with blocks except for the tile you drop in on. Under the blocks:
// loot, sleeping monsters, traps, chests, the hatch to the next floor, and the pieces of the floor's puzzles
// (rune blocks struck in order, a sun pedestal and channels that carry light to a sun panel, a bronze door
// and its key). Every generated floor is checked here for the things a player needs to finish it, and a bad
// one is thrown away and rolled again; dev/simtest.mjs then has the bot clear every floor on many seeds.

import { makeRng, hash3 } from '../rng.js';
import { BLOCKS, blockMix } from './data/blocks.js';
import { MONSTERS } from './data/monsters.js';
import { ART_ON_FLOOR } from './data/artifacts.js';
import { STORY_FLOORS, TREASURE_EVERY } from '../config.js';

/** N, E, S, W as [dx, dy]; bit i of a channel mask is direction i. */
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const rotMask = (m, r) => ((m << (r & 3)) | (m >> (4 - (r & 3)))) & 15;
export const ORDINARY = (b) => { const f = BLOCKS[b]?.family; return f && f !== 'puzzle'; };

/** What floor n holds. Story floors follow a fixed schedule; endless floors cycle through the same ideas. */
export function floorPlan(n) {
    const endless = n > STORY_FLOORS;
    const treasure = n % TREASURE_EVERY === 0;
    const size = n === 1 ? 6 : n <= 3 ? 7 : n <= 7 ? 8 : 9;
    const runes = (n >= 3 && ([3, 6, 7, 10, 11, 14, 15].includes(n) || treasure || (endless && n % 2 === 1)))
        ? Math.min(5, 3 + Math.floor(n / 6)) : 0;
    const conduit = n >= 5 && ([5, 9, 13].includes(n) || (treasure && n >= 8) || (endless && n % 3 === 0));
    const door = n >= 2 && ([2, 5, 7, 10, 13, 15].includes(n) || (endless && n % 2 === 0));
    const chests = treasure ? 3 : n >= 2 ? 1 : 0;
    const density = n === 1 ? 0 : Math.min(0.24, 0.11 + 0.008 * n);
    return {
        n, size, treasure, endless, runes, hidden: treasure && runes > 0, conduit, door, chests,
        boss: n === STORY_FLOORS, art: ART_ON_FLOOR[n] || null, density,
        theme: n === STORY_FLOORS ? 'heart' : treasure ? 'treasure' : 'halls',
        monsterShare: Math.min(0.5, 0.3 + n * 0.015),
    };
}

const idx = (F, x, y) => y * F.w + x;
const inb = (F, x, y) => x >= 0 && y >= 0 && x < F.w && y < F.h;
export function neighbours4(F, i) {
    const x = i % F.w, y = (i / F.w) | 0, out = [];
    for (const [dx, dy] of DIRS) if (inb(F, x + dx, y + dy)) out.push(idx(F, x + dx, y + dy));
    return out;
}
export function neighbours8(F, i) {
    const x = i % F.w, y = (i / F.w) | 0, out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && inb(F, x + dx, y + dy)) out.push(idx(F, x + dx, y + dy));
    }
    return out;
}

function weighted(rng, list) {
    let total = 0;
    for (const [, w] of list) total += w;
    let r = rng() * total;
    for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
    return list[list.length - 1][0];
}

/** Cells reachable from the start without passing through a pillar or any cell in `walls`. */
function reach(F, start, walls) {
    const seen = new Uint8Array(F.cells.length);
    const q = [start];
    seen[start] = 1;
    while (q.length) {
        const i = q.pop();
        for (const j of neighbours4(F, i)) {
            if (seen[j] || F.cells[j].k === 'p' || walls.has(j)) continue;
            seen[j] = 1;
            q.push(j);
        }
    }
    return seen;
}

export function genFloor(seed, n) {
    for (let attempt = 0; attempt < 80; attempt++) {
        const F = tryFloor(seed, n, attempt);
        if (F) return F;
    }
    throw new Error(`no valid floor ${n} for seed ${seed}`);
}

function tryFloor(seed, n, attempt) {
    const P = floorPlan(n);
    curN = n;
    const rng = makeRng(Math.floor(hash3(seed, n, attempt) * 4294967296));
    const w = P.size, h = P.size;
    const F = {
        n, w, h, theme: P.theme, treasure: P.treasure, boss: P.boss,
        cells: [], start: 0, exit: 0,
        runeN: P.runes, runeNext: 1, hidden: P.hidden,
        lens: -1, panel: -1, pipes: [], door: -1,
        cleared: false,
    };
    for (let i = 0; i < w * h; i++) F.cells.push({ k: 'b', b: 'sand', hp: 1, mx: 1, c: null, o: null, m: 0, room: 0, r: 0, lit: 0, seen: 0, n: 0, pw: 0 });

    // ---- pillars: never touching one another, never on the rim
    if (n >= 3) {
        const count = P.treasure ? 4 : rng.int(1, 2 + Math.floor(w / 4));
        let placed = 0;
        for (let t = 0; t < 60 && placed < count; t++) {
            const x = rng.int(1, w - 2), y = rng.int(1, h - 3);
            const i = idx(F, x, y);
            if (neighbours8(F, i).some((j) => F.cells[j].k === 'p') || F.cells[i].k === 'p') continue;
            F.cells[i].k = 'p';
            placed++;
        }
    }

    // ---- the tile you drop in on (bottom row) and the hatch (as far away as possible)
    const bottom = [];
    for (let x = 0; x < w; x++) if (F.cells[idx(F, x, h - 1)].k !== 'p') bottom.push(idx(F, x, h - 1));
    F.start = rng.pick(bottom);
    const all = reach(F, F.start, new Set());
    for (let i = 0; i < F.cells.length; i++) if (F.cells[i].k !== 'p' && !all[i]) return null;  // pillars cut the floor in two
    const dist = bfsDist(F, F.start);
    let far = -1, best = -1;
    for (let i = 0; i < F.cells.length; i++) {
        if (F.cells[i].k === 'p') continue;
        const d = dist[i] + rng() * 2;
        if (d > best) { best = d; far = i; }
    }
    F.exit = far;
    F.cells[F.exit].o = { t: 'stairs' };
    const startCell = F.cells[F.start];
    startCell.k = 'o';
    const safe = new Set([F.start, ...neighbours8(F, F.start)]);   // the first dig is always safe
    const maxD = Math.max(...dist.filter((d) => d < 1e9));

    // ---- rooms: soft rubble with the good stuff in it
    const rooms = P.treasure ? 2 : rng.int(1, 2);
    for (let r = 0; r < rooms; r++) {
        const rw = rng.int(2, 3), rh = rng.int(2, 3);
        const x0 = rng.int(0, w - rw), y0 = rng.int(0, h - rh - 1);
        for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) {
            const c = F.cells[idx(F, x, y)];
            if (c.k === 'b') c.room = 1;
        }
    }

    // ---- block types: harder further from where you start
    const mix = blockMix(n).slice().sort((a, b) => BLOCKS[a[0]].hp - BLOCKS[b[0]].hp);
    for (let i = 0; i < F.cells.length; i++) {
        const c = F.cells[i];
        if (c.k !== 'b') continue;
        const far = dist[i] / Math.max(1, maxD);
        const list = c.room ? mix.slice(0, 2) : mix.map(([b, wt], k) => [b, wt * (1 + far * k * 0.5)]);
        setBlock(c, weighted(rng, list));
    }

    const free = (i) => {
        const c = F.cells[i];
        return c.k === 'b' && !c.o && !c.c && c.b !== 'rune' && c.b !== 'door' && c.b !== 'panel' && i !== F.exit && !safe.has(i);
    };
    const pickFree = (filter = () => true) => {
        const list = [];
        for (let i = 0; i < F.cells.length; i++) if (free(i) && filter(i)) list.push(i);
        return list.length ? rng.pick(list) : -1;
    };

    // ---- sun conduit: pedestal → channels → sun panel
    if (P.conduit) {
        const ok = makeConduit(F, rng, free);
        if (!ok) return null;
    }

    // ---- rune blocks
    for (let k = 1; k <= P.runes; k++) {
        const i = pickFree((j) => !neighbours4(F, j).some((q) => F.cells[q].b === 'rune' && F.cells[q].k === 'b'));
        if (i < 0) return null;
        setBlock(F.cells[i], 'rune');
        F.cells[i].r = k;
    }

    // ---- bronze door and its key
    let keyCell = -1;
    if (P.door) {
        const d = pickFree();
        if (d < 0) return null;
        setBlock(F.cells[d], 'door');
        F.door = d;
        keyCell = pickFree();
        if (keyCell < 0) return null;
        F.cells[keyCell].c = { loot: 'key', n: 1 };
    }

    // ---- chests (rooms first); a treasure floor's artifact waits in one of them
    const chestCells = [];
    for (let k = 0; k < P.chests; k++) {
        let i = pickFree((j) => F.cells[j].room);
        if (i < 0) i = pickFree();
        if (i < 0) return null;
        F.cells[i].o = makeChest(rng, n, P.treasure);
        chestCells.push(i);
    }
    if (P.art) {
        if (P.treasure && chestCells.length) {
            F.cells[chestCells[0]].o.art = P.art;
        } else {
            let i = pickFree((j) => F.cells[j].room);
            if (i < 0) i = pickFree();
            if (i < 0) return null;
            F.cells[i].c = { loot: 'art', id: P.art };
        }
    }
    // the panel guards a cache of its own
    if (F.panel >= 0) F.cells[F.panel].c = { loot: 'cache', gold: 15 + n * 3, gems: 1 + (P.treasure ? 1 : 0) };

    // ---- the warden sleeps in the middle of the Heart Chamber
    if (P.boss) {
        const mid = idx(F, w >> 1, h >> 1);
        const c = F.cells[mid];
        if (c.k !== 'b' || c.o || c.b === 'rune' || c.b === 'door' || c.b === 'panel') return null;
        setBlock(c, 'granite');
        c.c = { d: 'mon', id: 'warden' };
    }

    // ---- traps and monsters
    let blocks = 0;
    for (const c of F.cells) if (c.k === 'b') blocks++;
    const dangers = n === 1 ? 3 : Math.round(blocks * P.density);
    const mons = Object.entries(MONSTERS).filter(([, m]) => m.from <= n && !m.boss);
    for (let k = 0; k < dangers; k++) {
        const i = pickFree((j) => !F.cells[j].o && ORDINARY(F.cells[j].b));
        if (i < 0) break;
        if (rng() < P.monsterShare) {
            // the newest kinds of monster turn up more often
            const id = weighted(rng, mons.map(([mid, m]) => [mid, 1 + Math.max(0, 6 - (n - m.from))]));
            F.cells[i].c = { d: 'mon', id };
        } else {
            F.cells[i].c = { d: 'trap', kind: weighted(rng, n < 3 ? [['spout', 3], ['curse', 1]] : [['spout', 3], ['spikes', 2], ['curse', 2]]) };
        }
    }

    // ---- loot: gold, gems, food, the odd potion
    const golds = 2 + Math.floor(n / 3) + (P.treasure ? 3 : 0);
    for (let k = 0; k < golds; k++) {
        const i = pickFree();
        if (i < 0) break;
        F.cells[i].c = { loot: 'gold', n: rng.int(2, 5) + n };
    }
    const gems = n >= 2 ? 1 + (P.treasure ? 1 : 0) : 0;
    for (let k = 0; k < gems; k++) {
        const i = pickFree();
        if (i >= 0) F.cells[i].c = { loot: 'gem', n: 1 };
    }
    const foods = 1 + Math.floor(w / 4) + Math.floor(n / 6);
    for (let k = 0; k < foods; k++) {
        const i = pickFree();
        if (i >= 0) F.cells[i].c = { loot: 'food', n: rng.int(4, 6) + Math.floor(n / 3) };
    }
    if (n >= 3 && rng() < 0.4) {
        const i = pickFree();
        if (i >= 0) F.cells[i].c = { loot: 'potion', n: 1 };
    }

    // ---- proof: everything a player needs is reachable before the thing it unlocks
    const walls = new Set();
    F.cells.forEach((c, i) => { if (c.b === 'door' || c.b === 'panel' || c.b === 'rune') walls.add(i); });
    const R = reach(F, F.start, walls);
    const touches = (i) => neighbours4(F, i).some((j) => R[j]);
    if (keyCell >= 0 && !R[keyCell]) return null;
    if (F.door >= 0 && !touches(F.door)) return null;
    if (F.lens >= 0 && (!R[F.lens] || F.pipes.some((p) => !R[p]))) return null;
    if (F.panel >= 0 && !touches(F.panel)) return null;
    for (let i = 0; i < F.cells.length; i++) if (F.cells[i].b === 'rune' && F.cells[i].k === 'b' && !touches(i)) return null;
    return F;
}

/** Blocks get denser the deeper they lie: hp grows with the floor, so a stronger pick still has work to do. */
export const hpScale = (n) => 1 + (Math.min(n, 40) - 1) * 0.22;
let curN = 1;
function setBlock(c, b) {
    c.b = b;
    c.hp = c.mx = BLOCKS[b].family === 'puzzle' ? 1 : Math.max(1, Math.round(BLOCKS[b].hp * hpScale(curN)));
}

function bfsDist(F, s) {
    const d = new Array(F.cells.length).fill(1e9);
    d[s] = 0;
    const q = [s];
    for (let h = 0; h < q.length; h++) {
        const i = q[h];
        for (const j of neighbours4(F, i)) {
            if (F.cells[j].k === 'p' || d[j] <= d[i] + 1) continue;
            d[j] = d[i] + 1;
            q.push(j);
        }
    }
    return d;
}

function makeChest(rng, n, treasure) {
    const lock = [0, 0, 0, 0, 0].map(() => (rng() < 0.5 ? 1 : 0));
    if (lock.every(Boolean)) lock[rng.int(0, 4)] = 0;
    return {
        t: 'chest', open: 0, lock,
        gold: (treasure ? 25 : 10) + n * (treasure ? 5 : 3) + rng.int(0, 6),
        gems: treasure ? rng.int(1, 3) : rng() < 0.4 ? 1 : 0,
        potion: rng() < 0.3 ? 1 : 0,
        art: null,
    };
}

/** Lay a self-avoiding channel of 4–7 tiles from a sun pedestal to a sun panel, then scramble the channels. */
function makeConduit(F, rng, free) {
    for (let t = 0; t < 40; t++) {
        const lens = (() => {
            const list = [];
            for (let i = 0; i < F.cells.length; i++) if (free(i)) list.push(i);
            return list.length ? rng.pick(list) : -1;
        })();
        if (lens < 0) return false;
        const len = rng.int(4, 7);
        const path = [];
        const used = new Set([lens]);
        let cur = lens;
        for (let s = 0; s < len; s++) {
            const opts = neighbours4(F, cur).filter((j) => free(j) && !used.has(j)
                && neighbours4(F, j).filter((q) => used.has(q)).length === 1);   // no shortcuts that touch the path twice
            if (!opts.length) break;
            cur = rng.pick(opts);
            used.add(cur);
            path.push(cur);
        }
        if (path.length < 3) continue;
        const end = path[path.length - 1];
        const panels = neighbours4(F, end).filter((j) => free(j) && !used.has(j)
            && neighbours4(F, j).filter((q) => used.has(q)).length === 1);
        if (!panels.length) continue;
        const panel = rng.pick(panels);
        // masks: each channel opens toward the tile before it and the tile after it
        const chain = [lens, ...path, panel];
        for (let k = 1; k < chain.length - 1; k++) {
            const m = dirBit(F, chain[k], chain[k - 1]) | dirBit(F, chain[k], chain[k + 1]);
            const c = F.cells[chain[k]];
            setBlock(c, 'sand');
            c.o = { t: 'pipe', m, r: rng.int(0, 3) };
        }
        F.cells[lens].o = { t: 'lens' };
        setBlock(F.cells[lens], 'sand');
        setBlock(F.cells[panel], 'panel');
        F.lens = lens;
        F.panel = panel;
        F.pipes = path;
        // a scrambled puzzle must start unsolved
        if (conducts(F, true)) F.cells[path[0]].o.r = (F.cells[path[0]].o.r + 1) & 3;
        if (conducts(F, true)) continue;
        return true;
    }
    return false;
}

function dirBit(F, from, to) {
    const dx = (to % F.w) - (from % F.w), dy = ((to / F.w) | 0) - ((from / F.w) | 0);
    for (let d = 0; d < 4; d++) if (DIRS[d][0] === dx && DIRS[d][1] === dy) return 1 << d;
    return 0;
}

/**
 * Which cells the sun pedestal powers. With ignoreCover the blocks over the channels are ignored (used to
 * check that a fresh puzzle starts unsolved); otherwise light only runs through uncovered channels.
 * Returns the set of powered cells, and sets .panelLit when light reaches the panel.
 */
export function power(F, ignoreCover = false) {
    const lit = new Set();
    if (F.lens < 0) return lit;
    const open = (i) => ignoreCover || F.cells[i].k === 'o';
    if (!open(F.lens)) return lit;
    lit.add(F.lens);
    const q = [F.lens];
    lit.panelLit = false;
    while (q.length) {
        const i = q.pop();
        const c = F.cells[i];
        const mask = c.o?.t === 'lens' ? 15 : rotMask(c.o.m, c.o.r);
        const x = i % F.w, y = (i / F.w) | 0;
        for (let d = 0; d < 4; d++) {
            if (!(mask & (1 << d))) continue;
            const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
            if (!inb(F, nx, ny)) continue;
            const j = idx(F, nx, ny);
            const nc = F.cells[j];
            if (j === F.panel && c.o?.t === 'pipe') { lit.panelLit = true; continue; }
            if (lit.has(j) || nc.o?.t !== 'pipe' || !open(j)) continue;
            if (!(rotMask(nc.o.m, nc.o.r) & (1 << ((d + 2) & 3)))) continue;
            lit.add(j);
            q.push(j);
        }
    }
    return lit;
}
const conducts = (F, ignoreCover) => power(F, ignoreCover).panelLit;
