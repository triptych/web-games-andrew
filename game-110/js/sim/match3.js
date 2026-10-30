// Skull Swap: the cemetery's match-three. Pure, like the rest of js/sim: a board is plain JSON with its random state
// inside it, so a board saves, loads and replays exactly, and the view plays back the steps a swap returns.
//
// Seven by seven, five or six kinds of token. Three in a row clear; four make a line-clearer (it clears its row or
// column when it goes); five, or an L or T, make a jack-o'-lantern that clears the 3×3 around it. Cobwebs cover cells
// and come away when a match is made on them. Levels rotate between a score goal, collecting tokens and clearing
// cobwebs, and are a pure function of the level number, so they get harder forever.

import { makeRng } from '../rng.js';

export const W = 7, H = 7;
export const KINDS = ['skull', 'cupcake', 'yarn', 'candle', 'rose', 'teacup'];
export const SP = { none: 0, row: 1, col: 2, bomb: 3 };
const idx = (x, y) => y * W + x;
const xy = (i) => [i % W, (i / W) | 0];

/**
 * What a level asks for. Goals are a share of what a sensible player reaches in the moves given (measured with the
 * bot: about 175 points a move with five kinds and 100 with six, 1.5 or 1.2 of a chosen kind a move), and the share
 * rises from 45% at level 1 to 90% from level 31.
 */
export function levelSpec(level) {
    const kinds = level < 4 ? 5 : 6;
    const type = ['score', 'collect', 'webs'][(level - 1) % 3];
    const f = Math.min(0.9, 0.45 + 0.015 * (level - 1));
    const tight = Math.min(6, Math.floor(level / 6));
    if (type === 'score') {
        const moves = 20 - tight;
        return { type, kinds, moves, target: Math.round((moves * (kinds === 5 ? 175 : 100) * f) / 50) * 50 };
    }
    if (type === 'collect') {
        const moves = 21 - tight, a = level % kinds, b = (level + 2) % kinds;
        const n = Math.round(moves * (kinds === 5 ? 1.5 : 1.2) * f);
        return { type, kinds, moves, need: { [a]: n, [b]: n } };
    }
    return { type, kinds, moves: 23 - (tight >> 1), webs: Math.min(16, 5 + Math.floor(level * 0.35)) };
}

function rngOf(B) { const r = makeRng(0); r.setState(B.rs); return r; }

export function newBoard(level, seed) {
    const spec = levelSpec(level);
    const rng = makeRng((seed ^ Math.imul(level, 2654435761)) >>> 0);
    const B = {
        level, spec, kinds: spec.kinds, cells: new Array(W * H).fill(-1), sp: new Array(W * H).fill(0), webs: new Array(W * H).fill(0),
        moves: spec.moves, movesLeft: spec.moves, score: 0, collected: {}, websLeft: 0, over: false, won: false, stars: 0, rs: 0,
    };
    for (let tries = 0; tries < 50; tries++) {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            let k;
            do k = rng.int(0, B.kinds - 1);
            while ((x >= 2 && B.cells[idx(x - 1, y)] === k && B.cells[idx(x - 2, y)] === k) || (y >= 2 && B.cells[idx(x, y - 1)] === k && B.cells[idx(x, y - 2)] === k));
            B.cells[idx(x, y)] = k;
        }
        if (hasMove(B)) break;
    }
    if (spec.type === 'webs') {
        const free = [...Array(W * H).keys()];
        for (let n = 0; n < spec.webs; n++) { const j = rng.int(0, free.length - 1); B.webs[free[j]] = 1; free.splice(j, 1); }
        B.websLeft = spec.webs;
    }
    B.rs = rng.state();
    return B;
}

/** Runs of three or more, merged into groups that share a cell, each with the special it makes. */
export function findGroups(B) {
    const runs = [];
    const scan = (horiz) => {
        for (let a = 0; a < (horiz ? H : W); a++) {
            let start = 0;
            for (let b = 1; b <= (horiz ? W : H); b++) {
                const at = (t) => (horiz ? idx(t, a) : idx(a, t));
                const k0 = B.cells[at(start)];
                const end = b === (horiz ? W : H) || B.cells[at(b)] !== k0;
                if (!end) continue;
                if (k0 >= 0 && b - start >= 3) { const cells = []; for (let t = start; t < b; t++) cells.push(at(t)); runs.push({ cells, horiz, kind: k0 }); }
                start = b;
            }
        }
    };
    scan(true); scan(false);
    if (!runs.length) return [];
    // union runs that share a cell
    const parent = runs.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const owner = new Map();
    runs.forEach((r, i) => { for (const c of r.cells) { if (owner.has(c)) parent[find(i)] = find(owner.get(c)); else owner.set(c, i); } });
    const groups = new Map();
    runs.forEach((r, i) => { const g = find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); });
    return [...groups.values()].map((rs) => {
        const cells = [...new Set(rs.flatMap((r) => r.cells))];
        const longest = rs.reduce((m, r) => (r.cells.length > m.cells.length ? r : m), rs[0]);
        const cross = rs.some((r) => r.horiz) && rs.some((r) => !r.horiz);
        const special = longest.cells.length >= 5 || cross ? SP.bomb : longest.cells.length === 4 ? (longest.horiz ? SP.row : SP.col) : SP.none;
        return { cells, kind: rs[0].kind, special, longest };
    });
}

export function hasMove(B) { return !!firstMove(B); }
function firstMove(B) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
            if (x + dx >= W || y + dy >= H) continue;
            const a = idx(x, y), b = idx(x + dx, y + dy);
            swapCells(B, a, b);
            const ok = findGroups(B).length > 0;
            swapCells(B, a, b);
            if (ok) return [a, b];
        }
    }
    return null;
}
function swapCells(B, a, b) {
    [B.cells[a], B.cells[b]] = [B.cells[b], B.cells[a]];
    [B.sp[a], B.sp[b]] = [B.sp[b], B.sp[a]];
}
export const adjacent = (a, b) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return Math.abs(ax - bx) + Math.abs(ay - by) === 1; };

/** Clear, fall and refill until nothing matches. Returns the steps for the view. */
function resolve(B, rng, swapped) {
    const steps = [];
    for (let chain = 1; chain < 40; chain++) {
        const groups = findGroups(B);
        if (!groups.length) break;
        const clear = new Set(), makes = [];
        for (const g of groups) {
            for (const c of g.cells) clear.add(c);
            if (g.special) {
                const at = swapped.find((s) => g.cells.includes(s)) ?? g.longest.cells[g.longest.cells.length >> 1];
                makes.push({ i: at, kind: g.kind, sp: g.special });
            }
        }
        // specials caught in the blast go off too, and set off others
        const fired = [];
        const queue = [...clear].filter((c) => B.sp[c]);
        const seen = new Set();
        while (queue.length) {
            const c = queue.shift();
            if (seen.has(c)) continue;
            seen.add(c);
            const [x, y] = xy(c), s = B.sp[c];
            fired.push({ i: c, sp: s });
            const hit = [];
            if (s === SP.row) for (let t = 0; t < W; t++) hit.push(idx(t, y));
            else if (s === SP.col) for (let t = 0; t < H; t++) hit.push(idx(x, t));
            else if (s === SP.bomb) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (x + i >= 0 && x + i < W && y + j >= 0 && y + j < H) hit.push(idx(x + i, y + j));
            for (const h of hit) { if (!clear.has(h)) clear.add(h); if (B.sp[h] && !seen.has(h)) queue.push(h); }
        }
        let gained = 0;
        const webs = [];
        const made = new Set(makes.map((m) => m.i));
        for (const c of clear) {
            const k = B.cells[c];
            if (k >= 0) { B.collected[k] = (B.collected[k] || 0) + 1; gained += 10 * chain; }
            if (B.webs[c]) { B.webs[c] = 0; B.websLeft--; webs.push(c); }
            if (!made.has(c)) { B.cells[c] = -1; B.sp[c] = 0; }
        }
        gained += fired.length * 40 + makes.length * 20;
        for (const m of makes) { B.cells[m.i] = m.kind; B.sp[m.i] = m.sp; }
        B.score += gained;
        steps.push({ t: 'clear', cells: [...clear].filter((c) => !made.has(c)), makes, fired, webs, gained, chain });
        // everything falls; new tokens drop in from above
        const drops = [], spawns = [];
        for (let x = 0; x < W; x++) {
            let write = H - 1;
            for (let y = H - 1; y >= 0; y--) {
                const c = idx(x, y);
                if (B.cells[c] < 0) continue;
                if (y !== write) {
                    const to = idx(x, write);
                    B.cells[to] = B.cells[c]; B.sp[to] = B.sp[c]; B.cells[c] = -1; B.sp[c] = 0;
                    drops.push({ from: c, to });
                }
                write--;
            }
            for (let y = write, n = 1; y >= 0; y--, n++) {
                const k = rng.int(0, B.kinds - 1), to = idx(x, y);
                B.cells[to] = k; B.sp[to] = 0;
                spawns.push({ to, kind: k, row: -n });
            }
        }
        steps.push({ t: 'fall', drops, spawns });
    }
    return steps;
}

function shuffle(B, rng) {
    const toks = B.cells.map((k, i) => [k, B.sp[i]]);
    for (let tries = 0; tries < 200; tries++) {
        for (let i = toks.length - 1; i > 0; i--) { const j = rng.int(0, i); [toks[i], toks[j]] = [toks[j], toks[i]]; }
        toks.forEach(([k, s], i) => { B.cells[i] = k; B.sp[i] = s; });
        if (!findGroups(B).length && hasMove(B)) return;
    }
    // hopeless: deal fresh plain tokens
    for (let tries = 0; tries < 200; tries++) {
        for (let i = 0; i < W * H; i++) { B.cells[i] = rng.int(0, B.kinds - 1); B.sp[i] = 0; }
        if (!findGroups(B).length && hasMove(B)) return;
    }
}

export function goalMet(B) {
    const s = B.spec;
    if (s.type === 'score') return B.score >= s.target;
    if (s.type === 'collect') return Object.entries(s.need).every(([k, n]) => (B.collected[k] || 0) >= n);
    return B.websLeft <= 0;
}
/** 0..1 towards the goal. */
export function goalProgress(B) {
    const s = B.spec;
    if (s.type === 'score') return Math.min(1, B.score / s.target);
    if (s.type === 'collect') { const e = Object.entries(s.need); return e.reduce((a, [k, n]) => a + Math.min(1, (B.collected[k] || 0) / n), 0) / e.length; }
    return 1 - B.websLeft / s.webs;
}
export function starsFor(B) {
    const r = B.movesLeft / B.moves;
    return r >= 0.3 ? 3 : r >= 0.12 ? 2 : 1;
}

/** Swap two cells. A swap that makes no match is refused (and costs nothing). */
export function trySwap(B, a, b) {
    if (B.over || !(a >= 0 && b >= 0 && a < W * H && b < W * H) || !adjacent(a, b)) return { ok: false, steps: [] };
    swapCells(B, a, b);
    if (!findGroups(B).length) { swapCells(B, a, b); return { ok: false, steps: [{ t: 'bad', a, b }] }; }
    const rng = rngOf(B);
    B.movesLeft--;
    const steps = [{ t: 'swap', a, b }, ...resolve(B, rng, [a, b])];
    if (goalMet(B)) { B.won = true; B.over = true; B.stars = starsFor(B); }
    else if (B.movesLeft <= 0) B.over = true;
    if (!B.over && !hasMove(B)) { shuffle(B, rng); steps.push({ t: 'shuffle', cells: [...B.cells], sp: [...B.sp] }); }
    B.rs = rng.state();
    return { ok: true, steps };
}

/** Every swap that makes a match. */
export function validMoves(B) {
    const out = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (x + dx >= W || y + dy >= H) continue;
        const a = idx(x, y), b = idx(x + dx, y + dy);
        swapCells(B, a, b);
        if (findGroups(B).length) out.push([a, b]);
        swapCells(B, a, b);
    }
    return out;
}

/**
 * A bot's move. skill 1 looks at what each swap does right now (the groups it makes and where they are) without
 * peeking at the tokens that will fall in; skill 0 picks any legal swap.
 */
export function botMove(B, skill = 1, r = () => 0.5) {
    const moves = validMoves(B);
    if (!moves.length) return null;
    if (skill <= 0) return moves[Math.floor(r() * moves.length)];
    const need = B.spec.type === 'collect' ? B.spec.need : {};
    let best = moves[0], bv = -Infinity;
    for (const [a, b] of moves) {
        swapCells(B, a, b);
        const gs = findGroups(B);
        let v = 0;
        for (const g of gs) {
            v += g.cells.length * 10 + (g.special ? 60 + g.special * 10 : 0);
            if (need[g.kind] && (B.collected[g.kind] || 0) < need[g.kind]) v += g.cells.length * 25;
            for (const c of g.cells) { if (B.webs[c]) v += 45; if (B.sp[c]) v += 70; v += xy(c)[1] * 1.5; }   // lower matches stir up more
        }
        swapCells(B, a, b);
        v += r() * 4;
        if (v > bv) { bv = v; best = [a, b]; }
    }
    return best;
}
