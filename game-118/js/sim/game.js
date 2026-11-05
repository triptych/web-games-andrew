// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// It is turn-based: act(G, cmd) validates and resolves a whole command at once and pushes events;
// step(G, dt) only lets time pass (generators recharge, guests arrive). The view reads G and drains
// G.events; the UI, the bot and the tests all go through act(), so the whole game runs in Node.

import { COLS, ROWS, MAX_TIER, GEN, TABLES, ECON, GUESTS } from '../config.js';
import { makeRng } from '../rng.js';
import { CHAINS, CHAIN_KEYS, GUEST_LIST, LINES } from './data/items.js';
import { CHAPTERS } from './data/chapters.js';

export const idx = (c, r) => r * COLS + c;
export const colOf = (i) => i % COLS;
export const rowOf = (i) => Math.floor(i / COLS);
const dist2 = (a, b) => (colOf(a) - colOf(b)) ** 2 + (rowOf(a) - rowOf(b)) ** 2;

function emit(G, e) { if (G.events.length < 600) G.events.push(e); }

// ---------------------------------------------------------------- the board

export function isOpen(G, i) {
    const r = TABLES[G.table].rect, c = colOf(i), row = rowOf(i);
    return c >= r.c0 && c <= r.c1 && row >= r.r0 && row <= r.r1;
}
export function openCells(G) {
    const out = [];
    for (let i = 0; i < COLS * ROWS; i++) if (isOpen(G, i)) out.push(i);
    return out;
}
export function freeCells(G) {
    const out = [];
    for (let i = 0; i < COLS * ROWS; i++) if (!G.cells[i] && isOpen(G, i)) out.push(i);
    return out;
}
export function chainUnlocked(G, c) { return G.table >= CHAINS[c].unlock; }
export function unlockedChains(G) { return CHAIN_KEYS.filter((c) => chainUnlocked(G, c)); }

/** The free cell nearest to `from`; ties go to the rng so output does not always fall the same way. */
function nearestFree(G, from) {
    let best = [], bd = Infinity;
    for (const i of freeCells(G)) {
        const d = dist2(i, from);
        if (d < bd) { bd = d; best = [i]; } else if (d === bd) best.push(i);
    }
    return best.length ? G.rng.pick(best) : -1;
}

function addItem(G, cell, c, t) {
    const it = { id: G.nextId++, k: 'item', c, t };
    G.cells[cell] = it;
    if (t > (G.stats.maxTier[c] || 0)) G.stats.maxTier[c] = t;
    return it;
}
function addGen(G, cell, c) {
    const it = { id: G.nextId++, k: 'gen', c, ch: GEN.max, tm: 0 };
    G.cells[cell] = it;
    return it;
}

export const canMerge = (a, b) => !!a && !!b && a.k === 'item' && b.k === 'item' && a.c === b.c && a.t === b.t && a.t < MAX_TIER;

// ---------------------------------------------------------------- new game, save, load

export function newGame(seed = 1) {
    const G = {
        v: 1,
        seed,
        rng: makeRng(seed),
        t: 0,
        nextId: 1,
        cells: new Array(COLS * ROWS).fill(null),
        coins: ECON.startCoins,
        stars: 0,
        table: 0,
        guests: new Array(GUESTS.slots).fill(null),
        slotT: new Array(GUESTS.slots).fill(0),
        combo: { n: 0, t: -99 },
        chapter: 0,
        goalDone: {},
        won: false,
        lockedFlag: false,
        stats: { merges: 0, served: 0, spawned: 0, composted: 0, upgrades: 0, baskets: 0, refills: 0, maxTier: {} },
        events: [],
    };
    // a ready-made first move: a pair of seeds and a pair of crayons, and the two starter generators
    addGen(G, idx(1, 5), 'pumpkin');
    addGen(G, idx(4, 5), 'craft');
    addItem(G, idx(2, 3), 'pumpkin', 1);
    addItem(G, idx(3, 3), 'pumpkin', 1);
    addItem(G, idx(2, 4), 'craft', 1);
    addItem(G, idx(3, 4), 'craft', 1);
    for (let s = 0; s < GUESTS.slots; s++) newGuest(G, s);
    evalGoals(G);
    return G;
}

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1 || !Array.isArray(d.cells) || d.cells.length !== COLS * ROWS) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}

/** Time spent away: generators keep recharging while the tab is closed (the idle half of a merge game). */
export function offline(G, seconds) {
    const sec = Math.max(0, Math.min(seconds, 3 * 3600));
    for (const it of G.cells) if (it && it.k === 'gen') rechargeGen(it, sec);
}

function rechargeGen(g, dt) {
    if (g.ch >= GEN.max) { g.tm = 0; return; }
    g.tm += dt;
    while (g.tm >= GEN.regen && g.ch < GEN.max) { g.tm -= GEN.regen; g.ch++; }
    if (g.ch >= GEN.max) g.tm = 0;
}

// ---------------------------------------------------------------- time

export function step(G, dt) {
    G.t += dt;
    for (const it of G.cells) if (it && it.k === 'gen') rechargeGen(it, dt);
    for (let s = 0; s < G.guests.length; s++) {
        if (G.guests[s]) continue;
        G.slotT[s] -= dt;
        if (G.slotT[s] <= 0) newGuest(G, s);
    }
    if (G.combo.n && G.t - G.combo.t > ECON.comboWindow) G.combo.n = 0;
    checkLock(G);
}

// ---------------------------------------------------------------- guests and their orders

const WANT_TIERS = [[2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6], [3, 4, 5, 6]];
const WANT_WEIGHTS = [[2, 4, 5], [2, 4, 4, 3], [2, 4, 4, 2], [1, 3, 4, 3]];

function pickWeighted(rng, items, weights) {
    let total = 0;
    for (const w of weights) total += w;
    let r = rng() * total;
    for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r < 0) return items[i]; }
    return items[items.length - 1];
}

/** Base items an order is worth: one tier-N item is 2^(N-1) base items. */
export const wantCost = (wants) => wants.reduce((s, w) => s + w.n * 2 ** (w.t - 1), 0);

function makeWants(G) {
    const chains = unlockedChains(G);
    const tiers = WANT_TIERS[G.table], weights = WANT_WEIGHTS[G.table];
    const count = G.rng() < 0.7 ? 1 : 2;
    const wants = [];
    for (let k = 0; k < count; k++) {
        for (let tries = 0; tries < 6; tries++) {
            const c = G.rng.pick(chains);
            const t = pickWeighted(G.rng, tiers, weights);
            const taken = wants.some((w) => w.c === c) || G.guests.some((q) => q && q.wants.some((w) => w.c === c && w.t === t));
            if (taken && tries < 5) continue;
            wants.push({ c, t, n: t <= 3 && G.rng() < 0.15 ? 2 : 1 });
            break;
        }
    }
    return wants;
}

function newGuest(G, slot) {
    const wants = makeWants(G);
    const cost = wantCost(wants);
    const here = new Set(G.guests.filter(Boolean).map((q) => q.guest));
    const pool = GUEST_LIST.filter((g) => !here.has(g.id));
    const guest = G.rng.pick(pool.length ? pool : GUEST_LIST).id;
    G.guests[slot] = {
        id: G.nextId++,
        guest,
        wants,
        coins: Math.round(cost * 0.45) + 3,
        stars: cost >= 32 ? 2 : cost >= 8 ? 1 : 0,
        say: G.rng.pick(LINES[wants[0].c]),
    };
    emit(G, { type: 'guest', slot, id: G.guests[slot].id });
}

/** Which cells would pay for an order (preferring `prefer`, a cell the player dragged over it), or null. */
export function servePlan(G, q, prefer = -1) {
    const used = new Set(), left = q.wants.map((w) => w.n);
    const take = (i, wi) => { used.add(i); left[wi]--; };
    const it = prefer >= 0 ? G.cells[prefer] : null;
    if (it && it.k === 'item') {
        const wi = q.wants.findIndex((w, k) => left[k] > 0 && w.c === it.c && w.t === it.t);
        if (wi >= 0) take(prefer, wi);
    }
    for (let wi = 0; wi < q.wants.length; wi++) {
        for (let i = 0; i < G.cells.length && left[wi] > 0; i++) {
            const c = G.cells[i];
            if (c && c.k === 'item' && !used.has(i) && c.c === q.wants[wi].c && c.t === q.wants[wi].t) take(i, wi);
        }
    }
    return left.every((n) => n <= 0) ? [...used] : null;
}
export function readyGuests(G) {
    return G.guests.filter((q) => q && servePlan(G, q)).map((q) => q.id);
}

// ---------------------------------------------------------------- goals (the Dinner Plan)

export function goalProgress(G, g) {
    if (g.type === 'make') return { have: Math.min(g.t, G.stats.maxTier[g.c] || 0), need: g.t };
    if (g.type === 'serve') return { have: Math.min(g.n, G.stats.served), need: g.n };
    if (g.type === 'merge') return { have: Math.min(g.n, G.stats.merges), need: g.n };
    return { have: Math.min(g.n, G.table), need: g.n };
}
const goalMet = (G, g) => { const p = goalProgress(G, g); return p.have >= p.need; };

function evalGoals(G) {
    while (G.chapter < CHAPTERS.length) {
        const ch = CHAPTERS[G.chapter];
        ch.goals.forEach((g, i) => {
            const key = `${G.chapter}.${i}`;
            if (!G.goalDone[key] && goalMet(G, g)) {
                G.goalDone[key] = true;
                emit(G, { type: 'goal', chapter: G.chapter, goal: i });
            }
        });
        if (!ch.goals.every((_, i) => G.goalDone[`${G.chapter}.${i}`])) return;
        G.coins += ch.reward.coins;
        G.stars += ch.reward.stars;
        emit(G, { type: 'chapter', chapter: G.chapter, coins: ch.reward.coins, stars: ch.reward.stars });
        G.chapter++;
        if (G.chapter >= CHAPTERS.length) { G.won = true; emit(G, { type: 'win' }); }
    }
}

// ---------------------------------------------------------------- board lock

export function findMerge(G) {
    const buckets = new Map();
    for (let i = 0; i < G.cells.length; i++) {
        const it = G.cells[i];
        if (!it || it.k !== 'item' || it.t >= MAX_TIER) continue;
        const key = it.c + it.t;
        if (!buckets.has(key)) buckets.set(key, { t: it.t, list: [] });
        buckets.get(key).list.push(i);
    }
    let best = null;
    for (const b of buckets.values()) {
        if (b.list.length < 2) continue;
        for (let x = 0; x < b.list.length; x++) for (let y = x + 1; y < b.list.length; y++) {
            const d = dist2(b.list[x], b.list[y]);
            if (!best || b.t < best.t || (b.t === best.t && d < best.d)) best = { t: b.t, d, pair: [b.list[x], b.list[y]] };
        }
    }
    return best ? best.pair : null;
}

/** Board lock: no free cell and no merge left. The compost bin is always the way out. */
export function boardLocked(G) {
    return freeCells(G).length === 0 && !findMerge(G);
}
function checkLock(G) {
    const now = boardLocked(G);
    if (now && !G.lockedFlag) emit(G, { type: 'locked' });
    G.lockedFlag = now;
}

// ---------------------------------------------------------------- commands

const deny = (G, reason, extra = {}) => { emit(G, { type: 'denied', reason, ...extra }); return { ok: false, reason }; };
const ok = (G) => { evalGoals(G); checkLock(G); return { ok: true }; };

function mergeInto(G, a, b) {
    const A = G.cells[a], B = G.cells[b];
    const t = B.t + 1;
    G.cells[a] = null;
    G.cells[b] = null;
    const it = addItem(G, b, B.c, t);
    G.stats.merges++;
    let coins = ECON.mergeCoins[t] || 0;
    G.combo.n = G.t - G.combo.t <= ECON.comboWindow ? G.combo.n + 1 : 1;
    G.combo.t = G.t;
    const bonus = G.combo.n >= 3 ? Math.min(Math.floor((G.combo.n - 1) / 2), ECON.comboCap) : 0;
    G.coins += coins + bonus;
    emit(G, { type: 'merge', cell: b, from: a, c: B.c, t, id: it.id, ids: [A.id, B.id], coins: coins + bonus, combo: G.combo.n, bonus });
}

export function act(G, cmd) {
    switch (cmd.t) {
        case 'tap': {
            const g = G.cells[cmd.cell];
            if (!g || g.k !== 'gen' || !isOpen(G, cmd.cell)) return { ok: false, reason: 'nothing' };
            if (g.ch <= 0) return deny(G, 'empty', { cell: cmd.cell });
            const to = nearestFree(G, cmd.cell);
            if (to < 0) return deny(G, 'full', { cell: cmd.cell });
            g.ch--;
            const it = addItem(G, to, g.c, G.rng() < GEN.tier2 ? 2 : 1);
            G.stats.spawned++;
            emit(G, { type: 'spawn', cell: to, from: cmd.cell, c: it.c, t: it.t, id: it.id });
            return ok(G);
        }
        case 'move': {
            const { from, to } = cmd;
            const A = G.cells[from];
            if (!A || from === to || !isOpen(G, from) || !isOpen(G, to)) return { ok: false, reason: 'invalid' };
            const B = G.cells[to];
            if (!B) {
                G.cells[to] = A; G.cells[from] = null;
                emit(G, { type: 'move', from, to, id: A.id });
            } else if (canMerge(A, B)) mergeInto(G, from, to);
            else {
                G.cells[to] = A; G.cells[from] = B;
                emit(G, { type: 'swap', from, to, ids: [A.id, B.id] });
            }
            return ok(G);
        }
        case 'compost': {
            const it = G.cells[cmd.cell];
            if (!it || it.k !== 'item' || !isOpen(G, cmd.cell)) return { ok: false, reason: 'invalid' };
            G.cells[cmd.cell] = null;
            const coins = ECON.compostCoins(it.t);
            G.coins += coins;
            G.stats.composted++;
            emit(G, { type: 'compost', cell: cmd.cell, c: it.c, t: it.t, coins });
            return ok(G);
        }
        case 'serve': {
            const s = G.guests.findIndex((q) => q && q.id === cmd.q);
            if (s < 0) return { ok: false, reason: 'invalid' };
            const q = G.guests[s];
            const plan = servePlan(G, q, cmd.prefer ?? -1);
            if (!plan) return deny(G, 'missing', { q: q.id });
            const taken = plan.map((i) => ({ cell: i, c: G.cells[i].c, t: G.cells[i].t }));
            for (const i of plan) G.cells[i] = null;
            G.coins += q.coins;
            G.stars += q.stars;
            G.stats.served++;
            G.guests[s] = null;
            G.slotT[s] = GUESTS.arrive;
            emit(G, { type: 'serve', q: q.id, guest: q.guest, slot: s, taken, coins: q.coins, stars: q.stars });
            return ok(G);
        }
        case 'upgrade': {
            if (G.table >= TABLES.length - 1) return { ok: false, reason: 'max' };
            const next = TABLES[G.table + 1];
            if (G.stars < next.cost) return deny(G, 'stars', { need: next.cost });
            G.stars -= next.cost;
            const before = new Set(openCells(G));
            G.table++;
            G.stats.upgrades++;
            const opened = openCells(G).filter((i) => !before.has(i) && !G.cells[i]);
            let gift = null;
            if (next.gift && !G.cells.some((it) => it && it.k === 'gen' && it.c === next.gift)) {
                // the new generator goes in the middle of the new cells (bottom row first)
                const spot = [...opened].sort((x, y) => rowOf(y) - rowOf(x) || Math.abs(colOf(x) - 2.5) - Math.abs(colOf(y) - 2.5))[0];
                if (spot !== undefined) { addGen(G, spot, next.gift); gift = { c: next.gift, cell: spot }; }
            }
            emit(G, { type: 'upgrade', table: G.table, gift });
            return ok(G);
        }
        case 'refill': {
            const gens = G.cells.filter((it) => it && it.k === 'gen' && it.ch < GEN.max);
            if (!gens.length) return { ok: false, reason: 'full' };
            const cost = refillCost(G);
            if (G.coins < cost) return deny(G, 'coins', { need: cost });
            G.coins -= cost;
            for (const g of gens) { g.ch = GEN.max; g.tm = 0; }
            G.stats.refills++;
            emit(G, { type: 'refill' });
            return ok(G);
        }
        case 'basket': {
            if (G.coins < ECON.basket) return deny(G, 'coins', { need: ECON.basket });
            const centre = idx(2, 3);
            const to = nearestFree(G, centre);
            if (to < 0) return deny(G, 'full');
            G.coins -= ECON.basket;
            const c = G.rng.pick(unlockedChains(G));
            const it = addItem(G, to, c, G.rng() < 0.7 ? 2 : 3);
            G.stats.baskets++;
            emit(G, { type: 'basket', cell: to, c, t: it.t, id: it.id });
            return ok(G);
        }
        default:
            return { ok: false, reason: 'unknown' };
    }
}

/** What a refill costs right now: so many coins for every charge the generators are missing. */
export function refillCost(G) {
    let missing = 0;
    for (const it of G.cells) if (it && it.k === 'gen') missing += GEN.max - it.ch;
    return Math.max(ECON.refillMin, missing * ECON.refillPer);
}

// ---------------------------------------------------------------- test and debug helpers

/** Put an item or generator in a cell, for tests and the ?debug=1 hooks only. */
export function debugPlace(G, cell, c, t) {
    G.cells[cell] = null;
    if (t === 'gen') addGen(G, cell, c);
    else if (c) addItem(G, cell, c, t);
    return G.cells[cell];
}
