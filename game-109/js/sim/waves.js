// The wave planner. A wave is a list of timed spawn orders built from "pieces" (a swooping line, a
// V, a pincer, a Galaga grid, a Space-Invaders march, saucers, darts, a cruiser, a carrier, mines).
// New pieces unlock as the waves go on, and the first wave to use one is built around it, so the
// game keeps introducing something. Every fourth wave is a bonus stage (nothing shoots) and every
// fifth is a boss. Pure: the only randomness is G.rng.

import { WAVE } from '../config.js';
import { W } from './util.js';
import { bezPath, sinePath, linePath, marchPath, hoverPath, strafePath } from './enemies.js';

// ------------------------------------------------------------------ curves (unmirrored)
export const CURVES = {
    S:    { p: [30, -16, 30, 130, 192, 100, 192, 320], d: 4.6 },
    arc:  { p: [-16, 34, 110, 26, 200, 80, 150, 320], d: 4.8 },
    hook: { p: [112, -16, 112, 230, 16, 200, 16, -40], d: 5.4 },
    wide: { p: [-16, 90, 230, 10, -30, 10, 112, 330], d: 5.6 },
    dip:  { p: [200, -16, 200, 150, 20, 150, 20, 330], d: 4.4 },
};

/** The power-ups that carrier enemies and lucky kills drop, in turn: mostly P (weapon), some S, B and H. */
export const CARRY = ['P', 'S', 'P', 'H', 'B', 'P', 'S', 'P'];

const order = (t, type, props) => ({ t, type, props });

// ------------------------------------------------------------------ pieces
// Each takes a context { G, n (wave), diff, m (random mirror ±1), carry() } and returns { orders, dur }.

function line(curve, type, count, ctx, gap = 0.3, carryAt = [3]) {
    const c = CURVES[curve], orders = [];
    for (let i = 0; i < count; i++) {
        orders.push(order(i * gap, type, { path: bezPath(c.p, c.d, ctx.m), carry: carryAt.includes(i) ? ctx.carry() : null }));
    }
    return { orders, dur: count * gap + c.d };
}

const lineS = (ctx) => line('S', 'drone', 8 + Math.min(4, Math.floor(ctx.diff / 6)), ctx, 0.3, [3]);
const lineArc = (ctx) => line(ctx.diff > 12 ? 'dip' : 'arc', 'drone', 8 + Math.min(4, Math.floor(ctx.diff / 6)), ctx, 0.28, [4]);

function vee(ctx) {
    const orders = [], n = 7 + (ctx.diff >= 10 ? 2 : 0), half = (n - 1) / 2;
    for (let i = -half; i <= half; i++) {
        orders.push(order(0, i === 0 ? 'weaver' : 'drone', {
            path: sinePath(W / 2 + i * 17, 54 + ctx.diff, 7, 2.1, i * 0.45, -14 - Math.abs(i) * 15),
            carry: i === 0 ? ctx.carry() : null,
        }));
    }
    return { orders, dur: 7 };
}

function pincer(ctx) {
    const orders = [], n = 4 + Math.min(2, Math.floor(ctx.diff / 8)), c = [-16, 50, 120, 30, 100, 150, 250, 170];
    for (let i = 0; i < n; i++) {
        orders.push(order(i * 0.38, 'weaver', { path: bezPath(c, 4.2, 1), carry: i === 2 ? ctx.carry() : null }));
        orders.push(order(i * 0.38, 'weaver', { path: bezPath(c, 4.2, -1) }));
    }
    return { orders, dur: n * 0.38 + 4.4 };
}

function formation(ctx) {
    const orders = [], count = Math.min(24, 12 + 2 * Math.floor(ctx.diff / 3)), cols = 8, rows = Math.ceil(count / cols);
    const slots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols && slots.length < count; c++) slots.push({ x: 42 + c * 20, y: 34 + r * 16 });
    // arrive in fours, alternately from the left and the right, in the order they will sit
    const carryAt = new Set([5, 14]);
    slots.forEach((s, i) => {
        const g = Math.floor(i / 4), side = g % 2 ? 1 : -1, x0 = side < 0 ? 26 : W - 26, depth = 150 + 22 * (g % 3);
        orders.push(order(g * 1.7 + (i % 4) * 0.2, 'striker', {
            ai: 'formation', st: 'enter', slot: s,
            path: { k: 'bez', d: 3.2, p: [x0, -16, x0, depth + 40, s.x, s.y + 100, s.x, s.y] },
            carry: carryAt.has(i) ? ctx.carry() : null,
        }));
    });
    return { orders, dur: Math.ceil(count / 4) * 1.7 + 4 };
}

function march(ctx) {
    const orders = [], cols = 6, rows = 3, sx = 22, sy = 15, type = ctx.diff >= 10 ? 'striker' : 'drone';
    const half = (W - 28 - (cols - 1) * sx) / 2, speed = 34 + ctx.diff * 1.2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        orders.push(order(0, type, {
            path: marchPath(W / 2, (c - (cols - 1) / 2) * sx, 22, r * sy, half, speed, 13),
            peace: r < rows - 1,                       // only the front rank fires
            carry: r === 1 && c === 2 ? ctx.carry() : null,
        }));
    }
    return { orders, dur: 14 };
}

function saucers(ctx) {
    const orders = [], n = 2 + (ctx.diff >= 14 ? 1 : 0);
    for (let i = 0; i < n; i++) {
        orders.push(order(i * 1.6, 'saucer', { path: strafePath(38 + i * 24, 78, 0.85 + 0.2 * i, i * 2.1, 12), carry: i === 0 ? ctx.carry() : null }));
    }
    return { orders, dur: 14 };
}

function rain(ctx) {
    const orders = [], n = 6 + Math.min(8, Math.floor(ctx.diff / 2));
    for (let i = 0; i < n; i++) {
        orders.push(order(i * 0.65, 'dart', {
            ai: 'dart', x: 18 + ctx.G.rng() * (W - 36), y: -10, ang: Math.PI / 2, speed: 115 + ctx.diff * 3,
            carry: i === 4 ? ctx.carry() : null,
        }));
    }
    return { orders, dur: n * 0.65 + 4 };
}

function cruiser(ctx) {
    const orders = [], n = ctx.diff >= 14 ? 2 : 1;
    for (let i = 0; i < n; i++) {
        orders.push(order(i * 2.5, 'cruiser', { path: hoverPath(W / 2 + (i ? 1 : -1) * 36, 52 + i * 8, 40, 0.6, i * 3, 17), carry: ctx.carry() }));
    }
    for (let i = 0; i < 6; i++) orders.push(order(3 + i * 0.35, 'drone', { path: bezPath(CURVES.S.p, CURVES.S.d, ctx.m) }));
    return { orders, dur: 12 };
}

function carrier(ctx) {
    return { orders: [order(0, 'carrier', { path: hoverPath(W / 2, 40, 62, 0.45, 0, 22), carry: ctx.carry() })], dur: 14 };
}

function mines(ctx) {
    const orders = [], n = 5 + Math.min(5, Math.floor(ctx.diff / 4));
    for (let i = 0; i < n; i++) {
        orders.push(order(i * 1.0, 'mine', { path: linePath(24 + ctx.G.rng() * (W - 48), -10, (ctx.G.rng() - 0.5) * 22, 30) }));
    }
    return { orders, dur: n + 6 };
}

/** id → { min wave, weight, heavy (at most one a wave), build }. */
export const PIECES = {
    lineS:     { min: 1,  w: 4, build: lineS },
    lineArc:   { min: 1,  w: 3, build: lineArc },
    vee:       { min: 2,  w: 3, build: vee },
    pincer:    { min: 2,  w: 3, build: pincer },
    formation: { min: 3,  w: 5, build: formation, heavy: true },
    march:     { min: 6,  w: 3, build: march, heavy: true },
    saucers:   { min: 6,  w: 3, build: saucers },
    rain:      { min: 7,  w: 3, build: rain },
    cruiser:   { min: 8,  w: 3, build: cruiser, heavy: true },
    carrier:   { min: 11, w: 2, build: carrier, heavy: true },
    mines:     { min: 12, w: 2, build: mines },
};

/** The piece(s) a wave is built around when it is the first to use them. */
const FEATURED = { 1: ['lineS', 'lineArc'], 2: ['vee', 'pincer'], 3: ['formation', 'lineS'], 6: ['saucers', 'march'], 7: ['rain', 'pincer', 'lineArc'], 8: ['cruiser', 'formation'], 11: ['carrier', 'vee', 'saucers'], 12: ['mines', 'formation'] };

// ------------------------------------------------------------------ bonus stage
function bonusStage(ctx) {
    const orders = [], seq = ['S', 'arc', 'hook', 'wide', 'dip'];
    seq.forEach((name, g) => {
        const c = CURVES[name], m = g % 2 ? -1 : 1;
        for (let i = 0; i < 8; i++) orders.push(order(g * 2.3 + i * 0.26, 'drone', { path: bezPath(c.p, c.d, m), peace: true }));
    });
    return { orders, dur: 4 * 2.3 + 8 * 0.26 + 5.6 };
}

// ------------------------------------------------------------------ the planner
export const isBossWave = (n) => n % WAVE.bossEvery === 0;
export const isBonusWave = (n) => n % WAVE.bossEvery === WAVE.bonusAt;
/** Which boss, and how many rounds of the three it has been through. */
export const bossFor = (n) => { const k = n / WAVE.bossEvery - 1; return { idx: k % 3, cycle: Math.floor(k / 3) }; };

export function planWave(n, G) {
    const diff = n - 1;
    const plan = { n, kind: 'normal', orders: [], idx: 0, total: 0, killed: 0, escaped: 0, pieces: [] };
    const ctx = { G, n, diff, m: 1, carry: () => CARRY[G.dropIdx++ % CARRY.length] };

    if (isBossWave(n)) {
        const b = bossFor(n);
        plan.kind = 'boss';
        plan.boss = b;
        plan.orders = [{ t: 0, type: 'boss', props: { idx: b.idx, cycle: b.cycle } }];
        plan.total = 1;
        return plan;
    }
    if (isBonusWave(n)) {
        plan.kind = 'bonus';
        plan.orders = bonusStage(ctx).orders;
        plan.total = plan.orders.length;
        return plan;
    }

    // choose the pieces
    const count = n < 8 ? 2 : n < 16 ? 3 : n < 26 ? 4 : 5;
    const picked = [];
    const featured = FEATURED[n];
    if (featured) picked.push(...featured.slice(0, count));
    let guard = 0;
    while (picked.length < count && guard++ < 50) {
        const pool = Object.entries(PIECES).filter(([id, p]) => p.min <= n && (!p.heavy || n >= 20 || !picked.some((q) => PIECES[q].heavy)) && (PIECES[id].heavy || id !== picked[picked.length - 1]));
        const total = pool.reduce((a, [, p]) => a + p.w, 0);
        let r = G.rng() * total, id = pool[0][0];
        for (const [k, p] of pool) { r -= p.w; if (r <= 0) { id = k; break; } }
        picked.push(id);
    }

    let start = 0.2;
    for (const id of picked) {
        ctx.m = G.rng() < 0.5 ? 1 : -1;
        const piece = PIECES[id].build(ctx);
        for (const o of piece.orders) plan.orders.push({ ...o, t: o.t + start });
        plan.pieces.push(id);
        start += piece.dur * 0.5 + 0.6;
    }
    plan.orders.sort((a, b) => a.t - b.t);
    plan.total = plan.orders.length;
    return plan;
}
