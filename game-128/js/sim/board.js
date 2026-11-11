// Gemheart Saga — the match-3 board. Pure: no DOM, no clock, randomness only from the rng passed in.
//
// The board is real time and fluid: gems fall under gravity, matches form the moment gems come to rest, and the
// player may swap any two resting gems at any time, even while other columns are still falling or clearing.
//
// B.cells[r * w + c] holds the tile whose resting slot is (c, r), or null. A tile's y is the row it is drawn at; it
// falls toward its slot. A tile is "settled" when y equals its row, it is not clearing and not mid-swap.
//   tile = { id, k (kind, see GEM), sp (special, see SPECIAL), y, vy, st ('idle'|'clear'), ct (clear timer),
//            lock (chained: can't be swapped), doom (seconds left, doom gems only), sw (swap animation, see below) }
// A swap animates for SWAP_TIME; tile.sw = { t, dur, fc, fr, back } holds where it came from for the view.
//
// Every resolved match or blast is pushed to B.out as { k, n, blast, chain, special, x, y }; the battle consumes
// B.out each step and turns gems into damage, mana and healing. Board events go to the events array passed in.

import { BOARD, GEM, KINDS, SPECIAL, FALL, SWAP_TIME, CLEAR_TIME } from '../config.js';

const W = BOARD.w, H = BOARD.h;
export const idx = (c, r) => r * W + c;
export const col = (i) => i % W;
export const row = (i) => Math.floor(i / W);
export const PRISM = 8;                     // the kind of a prism gem: matches nothing, activated by a swap

export function newBoard(rng) {
    const B = { w: W, h: H, cells: new Array(W * H).fill(null), nextId: 1, chain: 0, idle: 0, out: [], lastSwap: null, stable: false, moves: 0 };
    for (let r = 0; r < H; r++) {
        for (let c = 0; c < W; c++) {
            let k;
            do k = rng.int(0, KINDS - 1);
            while ((c >= 2 && kindAt(B, c - 1, r) === k && kindAt(B, c - 2, r) === k) || (r >= 2 && kindAt(B, c, r - 1) === k && kindAt(B, c, r - 2) === k));
            B.cells[idx(c, r)] = mkTile(B, k, r);
        }
    }
    if (!findMoves(B).length) shuffle(B, rng);
    return B;
}

function mkTile(B, k, y, sp = 0) {
    return { id: B.nextId++, k, sp, y, vy: 0, st: 'idle', ct: 0, lock: 0, doom: 0, sw: null };
}

function kindAt(B, c, r) {
    if (c < 0 || r < 0 || c >= W || r >= H) return -1;
    const t = B.cells[idx(c, r)];
    return t ? t.k : -1;
}

export const settled = (B, i) => {
    const t = B.cells[i];
    return !!t && t.st === 'idle' && t.y === row(i) && !t.sw;
};
const matchable = (B, i) => settled(B, i) && B.cells[i].k < KINDS;
export const swappable = (B, i) => settled(B, i) && !B.cells[i].lock && B.cells[i].k !== GEM.STONE && B.cells[i].k !== GEM.DOOM;

/** True when nothing moves, clears or swaps. */
export function isStable(B) {
    for (let i = 0; i < B.cells.length; i++) if (!settled(B, i)) return false;
    return true;
}

// ---------------------------------------------------------------- swapping
/** Try a swap of slots a and b. Returns 'ok', 'bad' (no match: the gems bounce back) or 'no' (not allowed). */
export function trySwap(B, a, b, ev) {
    if (a === b || a < 0 || b < 0 || a >= W * H || b >= W * H) return 'no';
    if (Math.abs(col(a) - col(b)) + Math.abs(row(a) - row(b)) !== 1) return 'no';
    if (!swappable(B, a) || !swappable(B, b)) return 'no';
    const A = B.cells[a], Bt = B.cells[b];
    B.idle = 0;
    // prisms and pairs of specials always go off
    const fire = A.k === PRISM || Bt.k === PRISM || (A.sp && Bt.sp);
    swapCells(B, a, b);
    if (fire || hasMatchAt(B, a) || hasMatchAt(B, b)) {
        A.sw = { t: 0, dur: SWAP_TIME, fc: col(a), fr: row(a), back: false };
        Bt.sw = { t: 0, dur: SWAP_TIME, fc: col(b), fr: row(b), back: false };
        B.lastSwap = { a: b, b: a, fire: !!fire };      // A now sits at b, Bt at a
        B.moves++;
        ev.push({ type: 'swap', a, b });
        return 'ok';
    }
    swapCells(B, a, b);
    // bounce: each tile goes toward the other slot and back
    A.sw = { t: 0, dur: SWAP_TIME * 2, fc: col(b), fr: row(b), back: true };
    Bt.sw = { t: 0, dur: SWAP_TIME * 2, fc: col(a), fr: row(a), back: true };
    ev.push({ type: 'badswap', a, b });
    return 'bad';
}

function swapCells(B, a, b) {
    const t = B.cells[a];
    B.cells[a] = B.cells[b];
    B.cells[b] = t;
}

function hasMatchAt(B, i) {
    const t = B.cells[i];
    if (!t || t.k >= KINDS) return false;
    const c = col(i), r = row(i), k = t.k;
    const same = (cc, rr) => kindAt(B, cc, rr) === k && (B.cells[idx(cc, rr)].st === 'idle');
    let h = 1, v = 1;
    for (let x = c - 1; x >= 0 && same(x, r); x--) h++;
    for (let x = c + 1; x < W && same(x, r); x++) h++;
    for (let y = r - 1; y >= 0 && same(c, y); y--) v++;
    for (let y = r + 1; y < H && same(c, y); y++) v++;
    return h >= 3 || v >= 3;
}

/** Every legal swap that makes something happen: [{ a, b, n, kinds: counts per kind, special }]. */
export function findMoves(B) {
    const moves = [];
    for (let i = 0; i < W * H; i++) {
        for (const j of [i + 1, i + W]) {
            if (j >= W * H || (j === i + 1 && col(i) === W - 1)) continue;
            if (!swappable(B, i) || !swappable(B, j)) continue;
            const m = evalSwap(B, i, j);
            if (m) moves.push(m);
        }
    }
    return moves;
}

/** What swapping i and j would match right away (no cascades), or null. */
export function evalSwap(B, i, j) {
    const A = B.cells[i], Bt = B.cells[j];
    if (A.k === PRISM || Bt.k === PRISM) {
        const other = A.k === PRISM ? Bt : A;
        const kinds = new Array(KINDS).fill(0);
        let n = 0;
        if (other.k === PRISM) { for (const t of B.cells) if (t && t.k < KINDS) { kinds[t.k]++; n++; } }
        else for (const t of B.cells) if (t && t.k === other.k) { kinds[t.k]++; n++; }
        return { a: i, b: j, n, kinds, special: true };
    }
    if (A.sp && Bt.sp) {
        const kinds = new Array(KINDS).fill(0);
        kinds[A.k]++; kinds[Bt.k]++;
        return { a: i, b: j, n: 8, kinds, special: true };
    }
    swapCells(B, i, j);
    const kinds = new Array(KINDS).fill(0);
    let n = 0, special = false;
    for (const s of [i, j]) {
        const run = runsThrough(B, s);
        if (!run) continue;
        n += run.n;
        kinds[B.cells[s].k] += run.n;
        if (run.n >= 4 || run.both) special = true;
        if (run.hasSpecial) special = true;
    }
    swapCells(B, i, j);
    return n ? { a: i, b: j, n, kinds, special } : null;
}

function runsThrough(B, i) {
    const t = B.cells[i];
    if (!t || t.k >= KINDS) return null;
    const c = col(i), r = row(i), k = t.k;
    const ok = (cc, rr) => kindAt(B, cc, rr) === k && settled(B, idx(cc, rr));
    const hs = [i], vs = [i];
    for (let x = c - 1; x >= 0 && ok(x, r); x--) hs.push(idx(x, r));
    for (let x = c + 1; x < W && ok(x, r); x++) hs.push(idx(x, r));
    for (let y = r - 1; y >= 0 && ok(c, y); y--) vs.push(idx(c, y));
    for (let y = r + 1; y < H && ok(c, y); y++) vs.push(idx(c, y));
    const h = hs.length >= 3, v = vs.length >= 3;
    if (!h && !v) return null;
    const cells = new Set([...(h ? hs : []), ...(v ? vs : [])]);
    let hasSpecial = false;
    for (const s of cells) if (B.cells[s].sp) hasSpecial = true;
    return { n: cells.size, both: h && v, hasSpecial };
}

// ---------------------------------------------------------------- the step
/** Advance the board dt seconds. rng refills columns; ev receives events. */
export function stepBoard(B, dt, rng, ev) {
    B.idle += dt;
    // swaps
    for (const t of B.cells) {
        if (!t || !t.sw) continue;
        t.sw.t += dt;
        if (t.sw.t >= t.sw.dur) t.sw = null;
    }
    if (B.lastSwap && !B.cells[B.lastSwap.a]?.sw && !B.cells[B.lastSwap.b]?.sw && B.lastSwap.fire) fireSwap(B, ev);
    // clearing gems vanish
    for (let i = 0; i < B.cells.length; i++) {
        const t = B.cells[i];
        if (t && t.st === 'clear') {
            t.ct -= dt;
            if (t.ct <= 0) B.cells[i] = null;
        }
    }
    gravity(B, dt, rng);
    resolve(B, ev);
    const stable = isStable(B);
    if (stable && !B.stable) {
        if (B.chain >= 2) ev.push({ type: 'chainEnd', chain: B.chain });
        B.chain = 0;
        if (!findMoves(B).length) { shuffle(B, rng); ev.push({ type: 'shuffle' }); }
    }
    B.stable = stable;
}

function gravity(B, dt, rng) {
    for (let c = 0; c < W; c++) {
        let wr = H - 1;
        for (let r = H - 1; r >= 0; r--) {
            const t = B.cells[idx(c, r)];
            if (!t) continue;
            if (t.st === 'clear' || t.sw) { wr = r - 1; continue; }     // blocks the column above it
            if (r !== wr) { B.cells[idx(c, wr)] = t; B.cells[idx(c, r)] = null; }
            wr--;
        }
        if (wr >= 0) {
            let top = 0;
            for (let r = wr + 1; r < H; r++) { const t = B.cells[idx(c, r)]; if (t && t.y < top) top = t.y; }
            for (let r = wr; r >= 0; r--) {
                const t = mkTile(B, rng.int(0, KINDS - 1), Math.min(top, 0) - (wr + 1 - r));
                B.cells[idx(c, r)] = t;
            }
        }
        for (let r = 0; r < H; r++) {
            const t = B.cells[idx(c, r)];
            if (!t || t.st === 'clear' || t.sw || t.y === r) continue;
            t.vy = Math.min(FALL.vmax, t.vy + FALL.g * dt);
            t.y += t.vy * dt;
            if (t.y >= r) { t.y = r; t.vy = 0; }
        }
    }
}

// ---------------------------------------------------------------- matching
function resolve(B, ev) {
    // runs of 3+ among settled gems
    const inH = new Map(), inV = new Map();      // slot -> run (array of slots)
    const runs = [];
    for (let r = 0; r < H; r++) {
        let c = 0;
        while (c < W) {
            const i = idx(c, r);
            if (!matchable(B, i)) { c++; continue; }
            const k = B.cells[i].k;
            let e = c + 1;
            while (e < W && matchable(B, idx(e, r)) && B.cells[idx(e, r)].k === k) e++;
            if (e - c >= 3) { const run = []; for (let x = c; x < e; x++) { run.push(idx(x, r)); inH.set(idx(x, r), run); } runs.push({ cells: run, dir: 'h', k }); }
            c = e;
        }
    }
    for (let c = 0; c < W; c++) {
        let r = 0;
        while (r < H) {
            const i = idx(c, r);
            if (!matchable(B, i)) { r++; continue; }
            const k = B.cells[i].k;
            let e = r + 1;
            while (e < H && matchable(B, idx(c, e)) && B.cells[idx(c, e)].k === k) e++;
            if (e - r >= 3) { const run = []; for (let y = r; y < e; y++) { run.push(idx(c, y)); inV.set(idx(c, y), run); } runs.push({ cells: run, dir: 'v', k }); }
            r = e;
        }
    }
    if (!runs.length) return;
    // group crossing runs of the same kind (an L or a T is one group)
    const groups = [];
    const seen = new Set();
    for (const run of runs) {
        if (seen.has(run)) continue;
        const g = { k: run.k, cells: new Set(), runs: [] };
        const stack = [run];
        while (stack.length) {
            const rr = stack.pop();
            if (seen.has(rr)) continue;
            seen.add(rr); g.runs.push(rr);
            for (const s of rr.cells) {
                g.cells.add(s);
                for (const other of [inH.get(s), inV.get(s)]) {
                    if (!other) continue;
                    const o = runs.find((x) => x.cells === other);
                    if (o && !seen.has(o)) stack.push(o);
                }
            }
        }
        groups.push(g);
    }
    B.chain++;
    const swapSlots = B.lastSwap ? [B.lastSwap.a, B.lastSwap.b] : [];
    const clearSet = new Set();
    const makes = [];
    for (const g of groups) {
        const longest = Math.max(...g.runs.map((r) => r.cells.length));
        const cross = g.runs.some((r) => r.dir === 'h') && g.runs.some((r) => r.dir === 'v');
        let sp = 0;
        if (longest >= 5) sp = SPECIAL.PRISM;
        else if (cross) sp = SPECIAL.BOMB;
        else if (longest === 4) sp = g.runs[0].dir === 'h' ? SPECIAL.LINE_H : SPECIAL.LINE_V;
        const cells = [...g.cells];
        let at = cells.find((s) => swapSlots.includes(s));
        if (at === undefined) at = cells[Math.floor(cells.length / 2)];
        let n = 0;
        for (const s of cells) {
            if (sp && s === at) continue;
            clearSet.add(s);
            n++;
        }
        if (sp) makes.push({ at, k: g.k, sp });
        const t = B.cells[at];
        B.out.push({ k: g.k, n: cells.length, blast: false, chain: B.chain, special: sp, x: col(at), y: row(at) });
        ev.push({ type: 'match', k: g.k, n: cells.length, chain: B.chain, x: col(at), y: row(at), special: sp, id: t?.id });
    }
    B.lastSwap = null;
    // special gems caught in a match go off
    clearCells(B, clearSet, ev, false);
    for (const m of makes) {
        const t = B.cells[m.at];
        if (!t) continue;
        if (t.sp) detonate(B, m.at, ev);             // a special that was itself part of the match fires first
        const nt = B.cells[m.at];
        if (nt && nt.st === 'idle') {
            nt.sp = m.sp;
            if (m.sp === SPECIAL.PRISM) nt.k = PRISM;
            nt.lock = 0;
            ev.push({ type: 'special', sp: m.sp, x: col(m.at), y: row(m.at) });
        }
    }
}

/** Mark slots as clearing; specials among them detonate; stone and doom next to a plain match break. */
function clearCells(B, set, ev, blast) {
    const queue = [...set];
    const done = new Set();
    const neighbours = new Set();
    while (queue.length) {
        const s = queue.shift();
        if (done.has(s)) continue;
        done.add(s);
        const t = B.cells[s];
        if (!t || t.st === 'clear') continue;
        t.st = 'clear'; t.ct = CLEAR_TIME; t.sw = null;
        if (t.k === GEM.DOOM) ev.push({ type: 'doomCleared', x: col(s), y: row(s) });
        if (t.sp && t.sp !== SPECIAL.PRISM) for (const x of blastArea(s, t.sp)) if (!done.has(x)) { queue.push(x); }
        if (t.sp) ev.push({ type: 'blast', sp: t.sp, x: col(s), y: row(s) });
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const c = col(s) + dc, r = row(s) + dr;
            if (c >= 0 && r >= 0 && c < W && r < H) neighbours.add(idx(c, r));
        }
    }
    // gems cleared by a blast count as collected (one entry per kind)
    if (blast || done.size > set.size) {
        const extra = new Array(KINDS).fill(0);
        for (const s of done) {
            if (set.has(s) && !blast) continue;
            const t = B.cells[s];
            if (t && t.k < KINDS) extra[t.k]++;
        }
        extra.forEach((n, k) => { if (n) B.out.push({ k, n, blast: true, chain: Math.max(1, B.chain), special: 0, x: 0, y: 0 }); });
    }
    for (const s of neighbours) {
        const t = B.cells[s];
        if (t && t.st === 'idle' && (t.k === GEM.STONE || t.k === GEM.DOOM) && !done.has(s)) {
            t.st = 'clear'; t.ct = CLEAR_TIME;
            ev.push({ type: t.k === GEM.DOOM ? 'doomCleared' : 'stoneBreak', x: col(s), y: row(s) });
        }
    }
}

function blastArea(s, sp) {
    const c = col(s), r = row(s), out = [];
    if (sp === SPECIAL.LINE_H) for (let x = 0; x < W; x++) out.push(idx(x, r));
    else if (sp === SPECIAL.LINE_V) for (let y = 0; y < H; y++) out.push(idx(c, y));
    else if (sp === SPECIAL.BOMB) for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (x >= 0 && y >= 0 && x < W && y < H) out.push(idx(x, y));
    return out;
}

function detonate(B, s, ev) {
    const t = B.cells[s];
    if (!t) return;
    clearCells(B, new Set([s]), ev, true);
}

/** A swap that fires specials: prism + gem clears that colour; prism + prism clears all; two specials both go off. */
function fireSwap(B, ev) {
    const { a, b } = B.lastSwap;
    B.lastSwap = null;
    const A = B.cells[a], Bt = B.cells[b];
    if (!A || !Bt) return;
    B.chain++;
    const set = new Set();
    if (A.k === PRISM || Bt.k === PRISM) {
        const [p, o] = A.k === PRISM ? [a, b] : [b, a];
        const ok = B.cells[o].k;
        set.add(p);
        B.cells.forEach((t, i) => { if (t && t.st === 'idle' && (ok === PRISM ? t.k < KINDS || t.k === PRISM : t.k === ok)) set.add(i); });
        ev.push({ type: 'prism', k: ok, x: col(p), y: row(p) });
    } else { set.add(a); set.add(b); }
    clearCells(B, set, ev, true);
}

// ---------------------------------------------------------------- curses and tools (used by the battle)
/** Slots of plain, resting, unlocked gems, in board order. */
export function plainSlots(B) {
    const out = [];
    B.cells.forEach((t, i) => { if (t && settled(B, i) && t.k < KINDS && !t.sp && !t.lock) out.push(i); });
    return out;
}

/** Turn n random plain gems into kind k (stone, doom, sword…). Returns the slots changed. */
export function convert(B, rng, n, k, from = -1) {
    let slots = plainSlots(B).filter((i) => from < 0 || B.cells[i].k === from);
    if (k < KINDS) slots = slots.filter((i) => B.cells[i].k !== k);
    const out = [];
    while (out.length < n && slots.length) {
        const j = rng.int(0, slots.length - 1);
        const s = slots.splice(j, 1)[0];
        const t = B.cells[s];
        t.k = k;
        if (k === GEM.DOOM) t.doom = 0;
        out.push(s);
    }
    return out;
}

export function lockGems(B, rng, n) {
    const slots = plainSlots(B);
    const out = [];
    while (out.length < n && slots.length) {
        const s = slots.splice(rng.int(0, slots.length - 1), 1)[0];
        B.cells[s].lock = 1;
        out.push(s);
    }
    return out;
}

/** Clear whole columns (a skill). Everything in them counts as collected. */
export function blastColumns(B, cols, ev) {
    const set = new Set();
    for (const c of cols) for (let r = 0; r < H; r++) { const t = B.cells[idx(c, r)]; if (t && t.st === 'idle') set.add(idx(c, r)); }
    if (!set.size) return 0;
    B.chain = Math.max(1, B.chain);
    clearCells(B, set, ev, true);
    return set.size;
}

/** Reshuffle the plain gems until the board has no match and at least one move; stone and doom go too. */
export function shuffle(B, rng, purge = false) {
    if (purge) for (const t of B.cells) if (t && (t.k === GEM.STONE || t.k === GEM.DOOM)) { t.k = rng.int(0, KINDS - 1); t.doom = 0; t.lock = 0; }
    const slots = [];
    B.cells.forEach((t, i) => { if (t && t.k < KINDS && !t.sp && t.st === 'idle') slots.push(i); });
    for (let tries = 0; tries < 60; tries++) {
        for (const s of slots) B.cells[s].k = rng.int(0, KINDS - 1);
        let bad = false;
        for (const s of slots) if (hasMatchAt(B, s)) { bad = true; break; }
        if (!bad && findMoves(B).length) return;
    }
}

export function hint(B) {
    const m = findMoves(B);
    if (!m.length) return null;
    m.sort((x, y) => y.n - x.n);
    return m[0];
}
