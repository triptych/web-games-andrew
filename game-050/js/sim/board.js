/**
 * board.js — the 8×8 match-3 engine.
 *
 * Cells are { id, t, sp } (t = gem type from data.G, sp = special overlay) or null while
 * resolving. y = 0 is the top row; gems fall towards larger y.
 *
 * Everything resolves instantly and pushes view events onto `ev`:
 *   swap {a,b,ids}         two gems trade places
 *   clear {cells, blasts, step}   gems removed (blasts: line/bomb/prism detonations)
 *   make {id,x,y,t,sp}     a gem became a special (or a Prism)
 *   fall {moves, spawns}   gravity + refill
 *   shuffle {cells}        no moves left: the board was rearranged
 *   morph {cells}          gems changed type/special (spells, potions)
 * After each clear, `onClear(tally, info)` lets the battle layer turn the gems into mana,
 * damage, gold and XP and push its own events right behind the clear.
 */

import { G, GEM_COUNT, SP } from './data.js';

export const W = 8, H = 8;
const idx = (x, y) => y * W + x;

export function createBoard(rng, opts = {}) {
    const b = { cells: new Array(W * H).fill(null), nextId: 1, weights: opts.weights || null };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let t, guard = 0;
        do { t = spawnType(b, rng); guard++; } while (guard < 40 && wouldMatch(b, x, y, t));
        b.cells[idx(x, y)] = { id: b.nextId++, t, sp: SP.NONE };
    }
    if (!findMoves(b).length) shuffle(b, rng, null);
    return b;
}

function spawnType(b, rng) {
    if (b.weights) return rng.weighted(b.weights.map((w, i) => [i, w]));
    return Math.floor(rng.next() * GEM_COUNT);
}

function wouldMatch(b, x, y, t) {
    const at = (xx, yy) => (xx >= 0 && yy >= 0 && xx < W && yy < H ? b.cells[idx(xx, yy)] : null);
    const a1 = at(x - 1, y), a2 = at(x - 2, y), u1 = at(x, y - 1), u2 = at(x, y - 2);
    return (a1 && a2 && a1.t === t && a2.t === t) || (u1 && u2 && u1.t === t && u2.t === t);
}

export function cloneBoard(b) {
    return { cells: b.cells.map((c) => (c ? { ...c } : null)), nextId: b.nextId, weights: b.weights };
}

export const cellAt = (b, x, y) => (x >= 0 && y >= 0 && x < W && y < H ? b.cells[idx(x, y)] : null);
export const adjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

// ------------------------------------------------------------------ Matching

function typeAt(b, x, y) {
    const c = b.cells[idx(x, y)];
    return c && c.t < G.PRISM ? c.t : -1;
}

/** All runs of 3+ in both directions. */
function findRuns(b) {
    const runs = [];
    for (let y = 0; y < H; y++) {
        let x = 0;
        while (x < W) {
            const t = typeAt(b, x, y);
            let e = x + 1;
            if (t >= 0) while (e < W && typeAt(b, e, y) === t) e++;
            if (t >= 0 && e - x >= 3) {
                const cells = [];
                for (let i = x; i < e; i++) cells.push(idx(i, y));
                runs.push({ dir: 'h', t, cells });
            }
            x = e;
        }
    }
    for (let x = 0; x < W; x++) {
        let y = 0;
        while (y < H) {
            const t = typeAt(b, x, y);
            let e = y + 1;
            if (t >= 0) while (e < H && typeAt(b, x, e) === t) e++;
            if (t >= 0 && e - y >= 3) {
                const cells = [];
                for (let i = y; i < e; i++) cells.push(idx(x, i));
                runs.push({ dir: 'v', t, cells });
            }
            y = e;
        }
    }
    return runs;
}

/** Runs merged into groups (an L or T is one group). */
export function findGroups(b) {
    const runs = findRuns(b);
    const parent = runs.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const owner = new Map();
    runs.forEach((r, i) => {
        for (const c of r.cells) {
            if (owner.has(c)) parent[find(i)] = find(owner.get(c));
            else owner.set(c, i);
        }
    });
    const groups = new Map();
    runs.forEach((r, i) => {
        const root = find(i);
        if (!groups.has(root)) groups.set(root, { t: r.t, cells: new Set(), runs: [] });
        const g = groups.get(root);
        for (const c of r.cells) g.cells.add(c);
        g.runs.push(r);
    });
    return [...groups.values()].map((g) => {
        const maxRun = Math.max(...g.runs.map((r) => r.cells.length));
        const hasH = g.runs.some((r) => r.dir === 'h'), hasV = g.runs.some((r) => r.dir === 'v');
        let make = null;
        if (maxRun >= 5) make = 'prism';
        else if (hasH && hasV) make = 'bomb';
        else if (maxRun === 4) make = g.runs.find((r) => r.cells.length === 4).dir === 'h' ? 'lineV' : 'lineH';
        return { t: g.t, cells: [...g.cells], runs: g.runs, size: g.cells.size, maxRun, make };
    });
}

// ------------------------------------------------------------------ Moves

function swapCells(b, a, c) {
    const i = idx(a.x, a.y), j = idx(c.x, c.y);
    const t = b.cells[i]; b.cells[i] = b.cells[j]; b.cells[j] = t;
}

export function isValidSwap(b, a, c) {
    if (!adjacent(a, c)) return false;
    const ca = cellAt(b, a.x, a.y), cc = cellAt(b, c.x, c.y);
    if (!ca || !cc) return false;
    if (ca.t === G.PRISM || cc.t === G.PRISM) return true;
    swapCells(b, a, c);
    const ok = touchesMatch(b, a.x, a.y) || touchesMatch(b, c.x, c.y);
    swapCells(b, a, c);
    return ok;
}

function touchesMatch(b, x, y) {
    const t = typeAt(b, x, y);
    if (t < 0) return false;
    let n = 1;
    for (let i = x - 1; i >= 0 && typeAt(b, i, y) === t; i--) n++;
    for (let i = x + 1; i < W && typeAt(b, i, y) === t; i++) n++;
    if (n >= 3) return true;
    n = 1;
    for (let i = y - 1; i >= 0 && typeAt(b, x, i) === t; i--) n++;
    for (let i = y + 1; i < H && typeAt(b, x, i) === t; i++) n++;
    return n >= 3;
}

export function findMoves(b) {
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (x + 1 < W && isValidSwap(b, { x, y }, { x: x + 1, y })) out.push({ a: { x, y }, b: { x: x + 1, y } });
        if (y + 1 < H && isValidSwap(b, { x, y }, { x, y: y + 1 })) out.push({ a: { x, y }, b: { x, y: y + 1 } });
    }
    return out;
}

/**
 * Cheap look at what a move's first step would collect, without gravity — used by the
 * monster AI and the hint. Returns { tally[8], biggest, extra, make, prism }.
 */
export function previewMove(b, m) {
    const tally = new Array(8).fill(0);
    const ca = cellAt(b, m.a.x, m.a.y), cb = cellAt(b, m.b.x, m.b.y);
    if (ca.t === G.PRISM || cb.t === G.PRISM) {
        const other = ca.t === G.PRISM ? cb : ca;
        if (other.t === G.PRISM) { for (const c of b.cells) if (c && c.t < G.PRISM) tally[c.t]++; }
        else for (const c of b.cells) if (c && c.t === other.t) tally[c.t]++;
        return { tally, biggest: 5, extra: true, make: null, prism: true };
    }
    swapCells(b, m.a, m.b);
    const groups = findGroups(b);
    swapCells(b, m.a, m.b);
    let biggest = 0, make = null, specials = 0;
    for (const g of groups) {
        tally[g.t] += g.size;
        biggest = Math.max(biggest, g.size);
        if (g.make) make = g.make;
        for (const ci of g.cells) {
            const c = ci === idx(m.a.x, m.a.y) ? cb : ci === idx(m.b.x, m.b.y) ? ca : b.cells[ci];
            if (c && c.sp) specials++;
        }
    }
    return { tally, biggest, extra: biggest >= 4, make, specials };
}

// ------------------------------------------------------------------ Resolution

const SPECIAL_OF = { lineH: SP.LINE_H, lineV: SP.LINE_V, bomb: SP.BOMB };

/**
 * Play a swap. Returns { ok, extra, maxGroup, steps, made } (extra = a 4+ match happened
 * anywhere in the chain or a Prism fired).
 */
export function playSwap(b, rng, a, c, ev, onClear) {
    if (!isValidSwap(b, a, c)) return { ok: false };
    const ca = cellAt(b, a.x, a.y), cc = cellAt(b, c.x, c.y);
    swapCells(b, a, c);
    ev.push({ k: 'swap', a: { ...a }, b: { ...c }, ids: [ca.id, cc.id] });
    // Prism: clear every gem of the partner's type (two prisms: the whole board).
    if (ca.t === G.PRISM || cc.t === G.PRISM) {
        const prismPos = ca.t === G.PRISM ? c : a;          // positions after the swap
        const other = ca.t === G.PRISM ? cc : ca;
        const set = new Set([idx(prismPos.x, prismPos.y)]);
        for (let i = 0; i < W * H; i++) {
            const cell = b.cells[i];
            if (!cell) continue;
            if (other.t === G.PRISM ? true : cell.t === other.t) set.add(i);
        }
        const res = resolve(b, rng, ev, set, [], onClear, { prism: { x: prismPos.x, y: prismPos.y, t: other.t } });
        res.extra = true;
        return { ok: true, ...res };
    }
    return { ok: true, ...resolve(b, rng, ev, null, [idx(a.x, a.y), idx(c.x, c.y)], onClear) };
}

/** Destroy a set of cell indices (spells), then cascade. collect=false: the first clear grants nothing. */
export function destroyCells(b, rng, cells, ev, onClear, opts = {}) {
    const set = new Set(cells.filter((i) => b.cells[i]));
    if (!set.size) return { steps: 0, extra: false, maxGroup: 0 };
    return resolve(b, rng, ev, set, [], onClear, opts);
}

function resolve(b, rng, ev, firstSet, preferred, onClear, opts = {}) {
    let step = 0, extra = false, maxGroup = 0, made = 0;
    let set = firstSet, creates = [];
    for (;;) {
        if (!set) {
            const groups = findGroups(b);
            if (!groups.length) break;
            set = new Set();
            creates = [];
            for (const g of groups) {
                for (const c of g.cells) set.add(c);
                maxGroup = Math.max(maxGroup, g.size);
                if (g.size >= 4) extra = true;
                if (g.make) {
                    const pos = pickCreatePos(b, g, preferred);
                    if (pos !== null) creates.push({ i: pos, kind: g.make, t: g.t });
                }
            }
        }
        step++;
        const blasts = [];
        detonate(b, rng, set, creates, blasts, step === 1 && opts.prism ? idx(opts.prism.x, opts.prism.y) : -1);
        const protect = new Set(creates.map((c) => c.i));
        const cleared = [];
        const tally = new Array(8).fill(0);
        for (const i of set) {
            if (protect.has(i)) continue;
            const cell = b.cells[i];
            if (!cell) continue;
            cleared.push({ id: cell.id, x: i % W, y: (i / W) | 0, t: cell.t, sp: cell.sp });
            if (cell.t < G.PRISM) tally[cell.t]++;
        }
        // Gems that become specials still count as collected.
        for (const cr of creates) tally[cr.t]++;
        for (const cl of cleared) b.cells[idx(cl.x, cl.y)] = null;
        ev.push({ k: 'clear', cells: cleared, blasts, step, prism: step === 1 ? opts.prism || null : null });
        if (step > 1 || opts.collect !== false) onClear?.(tally, { step, cleared, blasts });
        for (const cr of creates) {
            const cell = b.cells[cr.i];
            if (!cell) continue;
            if (cr.kind === 'prism') { cell.t = G.PRISM; cell.sp = SP.NONE; }
            else cell.sp = SPECIAL_OF[cr.kind];
            made++;
            ev.push({ k: 'make', id: cell.id, x: cr.i % W, y: (cr.i / W) | 0, t: cell.t, sp: cell.sp });
        }
        gravity(b, rng, ev);
        set = null;
        preferred = [];
        if (step > 40) break;  // pathological safety
    }
    let shuffled = false;
    if (!findMoves(b).length) { shuffle(b, rng, ev); shuffled = true; }
    return { steps: step, extra, maxGroup, made, shuffled };
}

function pickCreatePos(b, g, preferred) {
    const inGroup = new Set(g.cells);
    for (const p of preferred) if (inGroup.has(p) && b.cells[p] && !b.cells[p].sp) return p;
    if (g.make === 'bomb') {
        // the cell shared by a horizontal and a vertical run
        const h = new Set(g.runs.filter((r) => r.dir === 'h').flatMap((r) => r.cells));
        for (const r of g.runs) if (r.dir === 'v') for (const c of r.cells) if (h.has(c) && !b.cells[c].sp) return c;
    }
    const run = g.runs.reduce((m, r) => (r.cells.length > m.cells.length ? r : m), g.runs[0]);
    const mid = run.cells[(run.cells.length / 2) | 0];
    if (!b.cells[mid].sp) return mid;
    for (const c of g.cells) if (!b.cells[c].sp) return c;
    return null;
}

/** Expand the clear set through any specials it contains (chain reactions). */
function detonate(b, rng, set, creates, blasts, skip) {
    const protect = new Set(creates.map((c) => c.i));
    const queue = [...set];
    const fired = new Set([skip]);
    while (queue.length) {
        const i = queue.pop();
        if (fired.has(i) || protect.has(i)) continue;
        const cell = b.cells[i];
        if (!cell) continue;
        const x = i % W, y = (i / W) | 0;
        let add = [];
        if (cell.sp === SP.LINE_H) { for (let xx = 0; xx < W; xx++) add.push(idx(xx, y)); blasts.push({ kind: 'lineH', x, y }); }
        else if (cell.sp === SP.LINE_V) { for (let yy = 0; yy < H; yy++) add.push(idx(x, yy)); blasts.push({ kind: 'lineV', x, y }); }
        else if (cell.sp === SP.BOMB) {
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const xx = x + dx, yy = y + dy;
                if (xx >= 0 && yy >= 0 && xx < W && yy < H) add.push(idx(xx, yy));
            }
            blasts.push({ kind: 'bomb', x, y });
        } else if (cell.t === G.PRISM && set.size > 1) {
            // A Prism caught in a blast takes the most common gem type with it.
            const counts = new Array(GEM_COUNT).fill(0);
            for (const c of b.cells) if (c && c.t < GEM_COUNT) counts[c.t]++;
            const t = counts.indexOf(Math.max(...counts));
            for (let j = 0; j < W * H; j++) if (b.cells[j] && b.cells[j].t === t) add.push(j);
            blasts.push({ kind: 'prism', x, y, t });
        } else continue;
        fired.add(i);
        for (const j of add) {
            if (!set.has(j) && !protect.has(j)) { set.add(j); queue.push(j); }
        }
    }
}

function gravity(b, rng, ev) {
    const moves = [], spawns = [];
    for (let x = 0; x < W; x++) {
        let write = H - 1;
        for (let y = H - 1; y >= 0; y--) {
            const c = b.cells[idx(x, y)];
            if (!c) continue;
            if (write !== y) {
                b.cells[idx(x, write)] = c;
                b.cells[idx(x, y)] = null;
                moves.push({ id: c.id, x, y0: y, y1: write });
            }
            write--;
        }
        let n = 0;
        for (let y = write; y >= 0; y--) {
            n++;
            const c = { id: b.nextId++, t: spawnType(b, rng), sp: SP.NONE };
            b.cells[idx(x, y)] = c;
            spawns.push({ id: c.id, t: c.t, sp: c.sp, x, y, from: -n });
        }
    }
    if (moves.length || spawns.length) ev.push({ k: 'fall', moves, spawns });
}

export function shuffle(b, rng, ev) {
    for (let tries = 0; tries < 60; tries++) {
        const list = b.cells.slice();
        rng.shuffle(list);
        b.cells = list;
        if (!findGroups(b).length && findMoves(b).length) break;
        if (tries > 30) {
            // re-roll plain gems outright if shuffling alone can't fix it
            for (let i = 0; i < W * H; i++) if (!b.cells[i].sp && b.cells[i].t !== G.PRISM) b.cells[i].t = spawnType(b, rng);
        }
    }
    if (findGroups(b).length) {
        // last resort: break every match by re-rolling until clean
        for (let i = 0; i < W * H; i++) {
            const c = b.cells[i];
            const x = i % W, y = (i / W) | 0;
            let guard = 0;
            while (guard++ < 20 && (touchesMatch(b, x, y))) c.t = (c.t + 1) % GEM_COUNT;
        }
    }
    ev?.push({ k: 'shuffle', cells: b.cells.map((c, i) => ({ id: c.id, t: c.t, sp: c.sp, x: i % W, y: (i / W) | 0 })) });
}

/** Change gems in place (convert / conjure specials), then resolve any matches that creates. */
export function morphCells(b, rng, changes, ev, onClear) {
    const cells = [];
    for (const ch of changes) {
        const c = b.cells[ch.i];
        if (!c) continue;
        if (ch.t !== undefined) c.t = ch.t;
        if (ch.sp !== undefined) c.sp = ch.sp;
        cells.push({ id: c.id, x: ch.i % W, y: (ch.i / W) | 0, t: c.t, sp: c.sp });
    }
    if (cells.length) ev.push({ k: 'morph', cells });
    return resolve(b, rng, ev, null, [], onClear);
}

export function countType(b, t) {
    let n = 0;
    for (const c of b.cells) if (c && c.t === t) n++;
    return n;
}

export function indexOf(x, y) { return idx(x, y); }

/** Invariant check for tests: full board, unique ids, no standing matches, at least one move. */
export function boardProblems(b) {
    const out = [];
    const ids = new Set();
    for (let i = 0; i < W * H; i++) {
        const c = b.cells[i];
        if (!c) { out.push(`empty cell ${i}`); continue; }
        if (ids.has(c.id)) out.push(`duplicate id ${c.id}`);
        ids.add(c.id);
        if (!(c.t >= 0 && c.t <= G.PRISM)) out.push(`bad type ${c.t}`);
    }
    if (!out.length && findGroups(b).length) out.push('standing match');
    if (!out.length && !findMoves(b).length) out.push('no moves');
    return out;
}
