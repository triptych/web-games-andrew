// One level on the lattice. Pure: no DOM, no rendering library, no Math.random, no clock.
// Turn-based: everything happens in actLevel(L, cmd), which validates a command, resolves it at
// once and pushes events. The run (run.js) builds levels with levelgen.js and plays them through
// here; the view, the UI, the bot and the tests only read L.
//
// Three kinds of level share the rules: 'explore' (clear lines to uncover buried deposits),
// 'refine' (clear the lines a recipe asks for to brew a potion) and 'battle' (clear lines through
// foes to cut them down before they hurt you).

import { N, HAND, SCORE, BATTLE } from '../config.js';
import { rnd } from '../rng.js';
import { SHAPES, sizeOf, rotateCells } from './data/shapes.js';
import { ELEMENT_IDS } from './data/elements.js';
import { FOES } from './data/foes.js';
import { GRADES } from './data/potions.js';

export const idx = (x, y) => y * N + x;
export const elIndex = (id) => ELEMENT_IDS.indexOf(id) + 1;   // 1..6 in L.cells
export const elOf = (v) => ELEMENT_IDS[v - 1];

/**
 * def (from levelgen.js): { kind, name, chapter, elite, boss, objective, supply: [{ shape, el }],
 *   residue: [{ c, el }], deposits, refine, battle, mercy }
 * ctx: { skills: [ids], items: { id: n }, seed }
 */
export function newLevel(def, ctx) {
    const L = {
        v: 1,
        rs: ctx.seed | 0,
        kind: def.kind,
        name: def.name,
        chapter: def.chapter,
        elite: !!def.elite,
        boss: !!def.boss,
        objective: { ...def.objective },
        cells: new Array(N * N).fill(0),      // 0 empty, 1..6 a tile of that element
        foeAt: new Array(N * N).fill(-1),     // index into battle.foes
        cover: new Array(N * N).fill(0),      // cover layers left over a deposit cell
        depAt: new Array(N * N).fill(-1),     // index into deposits
        crucible: new Array(N * N).fill(0),
        deposits: [],
        hand: new Array(HAND).fill(null),
        supply: def.supply.map((s) => ({ ...s })),
        supplyStart: def.supply.length,
        mercy: def.mercy ?? 3,
        uid: 0,
        score: 0, lines: 0, moves: 0, streak: 0, bestCombo: 0, harvested: [],
        xp: 0,
        skills: [...(ctx.skills || [])],
        items: { ...(ctx.items || {}) },
        used: {},                             // items spent this level: { id: n }
        swapCd: 0, affinityUsed: false, reclaimUsed: false,
        refine: null,
        battle: null,
        status: 'play',                       // play | stuck | won | failed
        reason: null,                         // why it failed: jammed | out | defeated | conceded
        events: [],
    };
    for (const r of def.residue || []) L.cells[r.c] = elIndex(r.el);
    (def.deposits || []).forEach((d, k) => {
        L.deposits.push({ id: d.id, el: d.el, qty: d.qty, cells: [...d.cells], layers: d.layers, cover: d.layers, harvested: false });
        for (const c of d.cells) { L.depAt[c] = k; L.cover[c] = d.layers; }
    });
    if (def.refine) {
        const R = def.refine;
        L.refine = {
            potion: R.potion,
            conds: R.conds.map((c) => ({ ...c, n: 0, met: c.type === 'forbid', violated: 0 })),
            quality: 0, boost: R.boost || 0, forgive: R.forgive || 0, grade: null,
        };
        for (const c of R.crucible) L.crucible[c] = 1;
    }
    if (def.battle) {
        L.battle = { hp: def.battle.hp, maxHp: def.battle.hp, every: def.battle.every, foes: [] };
        def.battle.foes.forEach((f, k) => {
            const F = FOES[f.kind];
            const hp = Math.round(F.hp * (f.hpMul || 1));
            L.battle.foes.push({ kind: f.kind, name: F.name, cells: [...f.cells], hp, maxHp: hp, armor: F.armor + (f.armor || 0),
                dmg: F.dmg + (f.dmg || 0), pattern: [...F.pattern], step: 0, timer: def.battle.every + (k % 2), boss: !!F.boss });
            for (const c of f.cells) L.foeAt[c] = k;
        });
    }
    deal(L);
    check(L);
    return L;
}

// ------------------------------------------------------------------ queries

export const filled = (L, i) => L.cells[i] > 0 || L.foeAt[i] >= 0;
export const live = (L) => L.status === 'play' || L.status === 'stuck';
export const has = (L, s) => L.skills.includes(s);

export function canPlace(L, cells, x, y) {
    for (const [cx, cy] of cells) {
        const px = x + cx, py = y + cy;
        if (px < 0 || py < 0 || px >= N || py >= N) return false;
        if (filled(L, idx(px, py))) return false;
    }
    return true;
}

export function fitsAnywhere(L, cells) {
    const { w, h } = sizeOf(cells);
    for (let y = 0; y + h <= N; y++) for (let x = 0; x + w <= N; x++) if (canPlace(L, cells, x, y)) return true;
    return false;
}

/** The rows and columns a placement would complete (for the preview). */
export function wouldClear(L, cells, x, y) {
    const add = new Set(cells.map(([cx, cy]) => idx(x + cx, y + cy)));
    const full = (i) => filled(L, i) || add.has(i);
    const rows = [], cols = [];
    for (let r = 0; r < N; r++) { let ok = true; for (let c = 0; c < N && ok; c++) ok = full(idx(c, r)); if (ok) rows.push(r); }
    for (let c = 0; c < N; c++) { let ok = true; for (let r = 0; r < N && ok; r++) ok = full(idx(c, r)); if (ok) cols.push(c); }
    return { rows, cols };
}

/** How far the objective is: { done, have, need, text }. */
export function progress(L) {
    const o = L.objective;
    if (o.kind === 'lines') return { have: Math.min(L.lines, o.target), need: o.target, done: L.lines >= o.target };
    if (o.kind === 'score') return { have: Math.min(L.score, o.target), need: o.target, done: L.score >= o.target };
    if (o.kind === 'harvest') {
        const n = o.ids.filter((id) => L.harvested.includes(id)).length;
        return { have: n, need: o.ids.length, done: n >= o.ids.length };
    }
    if (o.kind === 'brew') {
        const need = L.refine.conds.filter((c) => c.type !== 'forbid');
        const n = need.filter((c) => c.met).length;
        return { have: n, need: need.length, done: n === need.length };
    }
    if (o.kind === 'defeat') {
        const F = L.battle.foes;
        const n = F.filter((f) => f.hp <= 0).length;
        return { have: n, need: F.length, done: n === F.length };
    }
    return { have: 0, need: 1, done: false };
}

/** Can an item be used now, and would it do anything? */
export function itemUsable(L, id) {
    if (!live(L) || !(L.items[id] > 0)) return false;
    if (id === 'dissolvent') return L.cells.some((v) => v > 0);
    if (id === 'catalyst') return L.hand.some(Boolean) && L.supply.length > 0;
    if (id === 'vial') return L.hand.some((h) => h && h.cells.length > 1);
    if (id === 'salts') return L.cover.some((v) => v > 0);
    if (id === 'tonic') return !!L.battle && L.battle.hp < L.battle.maxHp;
    return false;
}

/** Can an activated skill be used now? */
export function skillUsable(L, id) {
    if (!live(L) || !has(L, id)) return false;
    if (id === 'swap') return L.swapCd <= 0 && L.hand.some((h) => h && h.cells.length > 1);
    if (id === 'affinity') return !L.affinityUsed && L.hand.some(Boolean) && L.supply.length > 0;
    if (id === 'reclaim') return !L.reclaimUsed && L.hand.some(Boolean);
    return false;
}

const anyFits = (L) => L.hand.some((h) => h && fitsAnywhere(L, h.cells));

/** Could an item or a skill get a stuck hand moving? */
export function rescueAvailable(L) {
    for (const id of ['dissolvent', 'catalyst', 'vial']) if (itemUsable(L, id)) return true;
    if (skillUsable(L, 'affinity') || skillUsable(L, 'reclaim')) return true;
    if (skillUsable(L, 'swap')) {
        for (const h of L.hand) {
            if (!h) continue;
            let c = h.cells;
            for (let k = 0; k < 3; k++) { c = rotateCells(c); if (fitsAnywhere(L, c)) return true; }
        }
    }
    return false;
}

// ------------------------------------------------------------------ commands

/**
 * cmd: { t: 'place', i, x, y }            place hand tile i with its top-left cell at (x, y)
 *      { t: 'item', id, x?, y?, i? }      dissolvent / salts at a cell, vial on hand tile i, catalyst, tonic
 *      { t: 'skill', id, i? }             swap (hand tile i), affinity, reclaim
 *      { t: 'concede' }                   give up a stuck level
 * Returns true if the command did something. An illegal command changes nothing.
 */
export function actLevel(L, cmd) {
    if (!live(L) || !cmd) return false;
    let ok = false;
    if (cmd.t === 'place') ok = place(L, cmd);
    else if (cmd.t === 'item') ok = useItem(L, cmd);
    else if (cmd.t === 'skill') ok = useSkill(L, cmd);
    else if (cmd.t === 'concede') { if (L.status === 'stuck') { fail(L, 'conceded'); return true; } }
    if (!ok) { L.events.push({ type: 'invalid', cmd: cmd.t }); return false; }
    if (live(L) && L.hand.every((h) => !h)) deal(L);
    check(L);
    return true;
}

function place(L, { i, x, y }) {
    const t = L.hand[i];
    if (!t || !canPlace(L, t.cells, x, y)) return false;
    const cells = t.cells.map(([cx, cy]) => idx(x + cx, y + cy));
    const v = elIndex(t.el);
    for (const c of cells) L.cells[c] = v;
    L.hand[i] = null;
    L.moves++;
    if (L.swapCd > 0) L.swapCd--;
    L.score += cells.length * SCORE.placed;
    L.events.push({ type: 'place', slot: i, x, y, cells, el: t.el, shape: t.shape });
    const cleared = resolve(L, cells);
    if (L.battle && live(L)) foeTurns(L, cleared);
    return true;
}

function useItem(L, cmd) {
    const id = cmd.id;
    if (!itemUsable(L, id)) return false;
    if (id === 'dissolvent') {
        const c = idx(cmd.x, cmd.y);
        if (!(cmd.x >= 0 && cmd.y >= 0 && cmd.x < N && cmd.y < N) || !(L.cells[c] > 0)) return false;
        L.events.push({ type: 'item', id, c, el: elOf(L.cells[c]) });
        L.cells[c] = 0;
    } else if (id === 'salts') {
        const c = idx(cmd.x, cmd.y);
        if (!(cmd.x >= 0 && cmd.y >= 0 && cmd.x < N && cmd.y < N) || !(L.cover[c] > 0)) return false;
        L.events.push({ type: 'item', id, c });
        strip(L, [c]);
    } else if (id === 'vial') {
        const h = L.hand[cmd.i];
        if (!h || h.cells.length < 2) return false;
        h.shape = 'mono'; h.cells = [[0, 0]];
        L.events.push({ type: 'item', id, slot: cmd.i });
    } else if (id === 'catalyst') {
        redraw(L);
        L.events.push({ type: 'item', id });
    } else if (id === 'tonic') {
        const b = L.battle;
        const n = Math.min(10, b.maxHp - b.hp);
        b.hp += n;
        L.events.push({ type: 'item', id, heal: n });
    }
    L.items[id]--;
    L.used[id] = (L.used[id] || 0) + 1;
    if (L.objective.kind === 'harvest' && progress(L).done) win(L);
    return true;
}

function useSkill(L, cmd) {
    const id = cmd.id;
    if (!skillUsable(L, id)) return false;
    if (id === 'swap') {
        const h = L.hand[cmd.i];
        if (!h || h.cells.length < 2) return false;
        h.cells = rotateCells(h.cells);
        L.swapCd = 6;
    } else if (id === 'affinity') {
        redraw(L);
        L.affinityUsed = true;
    } else if (id === 'reclaim') {
        // the hand goes back to the bottom of the supply; a fresh one is drawn from the top
        const back = L.hand.filter(Boolean).map((h) => ({ shape: h.shape, el: h.el }));
        L.hand.fill(null);
        L.reclaimUsed = true;
        deal(L);
        L.supply.push(...back);
    }
    L.events.push({ type: 'skill', id, slot: cmd.i ?? -1 });
    return true;
}

/** Catalyst and Catalyst Affinity: the hand goes back into the supply, shuffled in, and a new hand is drawn. */
function redraw(L) {
    const back = L.hand.filter(Boolean).map((h) => ({ shape: h.shape, el: h.el }));
    L.hand.fill(null);
    for (const b of back) L.supply.splice(Math.floor(rnd(L) * (L.supply.length + 1)), 0, b);
    deal(L);
}

// ------------------------------------------------------------------ clearing

/** After cells are filled: clear every full row and column, score it, and apply its effects. */
function resolve(L, placed) {
    const rows = [], cols = [];
    for (let r = 0; r < N; r++) { let ok = true; for (let c = 0; c < N && ok; c++) ok = filled(L, idx(c, r)); if (ok) rows.push(r); }
    for (let c = 0; c < N; c++) { let ok = true; for (let r = 0; r < N && ok; r++) ok = filled(L, idx(c, r)); if (ok) cols.push(c); }
    const n = rows.length + cols.length;
    if (!n) { L.streak = 0; return null; }
    const lines = [...rows.map((r) => ({ r, cells: [...Array(N)].map((_, c) => idx(c, r)) })), ...cols.map((c) => ({ c, cells: [...Array(N)].map((_, r) => idx(c, r)) }))];
    const set = new Set();
    for (const l of lines) for (const c of l.cells) set.add(c);

    if (L.refine) refineLines(L, lines, n);

    const cleared = [];
    for (const c of set) if (L.cells[c] > 0) { cleared.push({ c, el: elOf(L.cells[c]) }); L.cells[c] = 0; }
    L.streak++;
    L.lines += n;
    L.bestCombo = Math.max(L.bestCombo, n);
    let points = cleared.length * SCORE.cleared * n + SCORE.streak * (L.streak - 1);
    if (n >= 3 && has(L, 'overflow')) points += SCORE.overflow * (n - 2);
    L.score += points;
    L.xp += n + (n >= 2 && has(L, 'surge') ? 5 : 0);
    L.events.push({ type: 'clear', rows, cols, cleared, placed, points, combo: n, streak: L.streak });

    strip(L, [...set]);
    if (L.battle) hitFoes(L, set, n);
    if (progress(L).done) win(L);
    return set;
}

/**
 * A cleared line (or Reveal Salts) that touches a deposit peels one layer of cover off the whole
 * deposit, once per placement however many lines cross it. A deposit with no cover left is harvested.
 */
function strip(L, cells) {
    const touched = new Set();
    for (const c of cells) if (L.depAt[c] >= 0 && L.cover[c] > 0) touched.add(L.depAt[c]);
    if (!touched.size) return;
    const stripped = [];
    for (const k of touched) {
        const d = L.deposits[k];
        d.cover = Math.max(0, d.cover - 1);
        for (const c of d.cells) { L.cover[c] = d.cover; stripped.push(c); }
    }
    L.events.push({ type: 'strip', cells: stripped, deps: [...touched] });
    for (const k of touched) {
        const d = L.deposits[k];
        if (d.harvested || d.cover > 0) continue;
        d.harvested = true;
        const qty = d.qty + (has(L, 'vein') ? 1 : 0);
        L.harvested.push(d.id);
        L.xp += 5;
        L.events.push({ type: 'harvest', dep: k, id: d.id, el: d.el, qty, cells: [...d.cells] });
    }
}

/** One more clear through it will harvest this deposit (Vein Sense makes it glow). */
export const nearHarvest = (L, d) => !d.harvested && d.cover === 1;

function refineLines(L, lines, n) {
    const R = L.refine;
    let rich = 0, crucible = false;
    for (const l of lines) {
        const count = {};
        for (const c of l.cells) if (L.cells[c] > 0) { const e = elOf(L.cells[c]); count[e] = (count[e] || 0) + 1; }
        if (l.cells.some((c) => L.crucible[c])) crucible = true;
        for (const cd of R.conds) {
            if (cd.type === 'lines' && !cd.met && (count[cd.el] || 0) >= 3) {
                cd.n++;
                rich++;
                if (cd.n >= cd.target) { cd.met = true; L.events.push({ type: 'cond', cond: cd }); }
            } else if (cd.type === 'forbid' && (count[cd.el] || 0) >= 3) {
                if (R.forgive > 0) { R.forgive--; L.events.push({ type: 'forgiven', el: cd.el }); }
                else { cd.violated++; L.events.push({ type: 'violation', el: cd.el }); }
            }
        }
    }
    for (const cd of R.conds) {
        if (cd.type === 'combo' && !cd.met && n >= cd.target) { cd.met = true; L.events.push({ type: 'cond', cond: cd }); }
        if (cd.type === 'streak' && !cd.met && L.streak + 1 >= cd.target) { cd.met = true; L.events.push({ type: 'cond', cond: cd }); }
    }
    let q = (n >= 3 ? 18 : n === 2 ? 11 : 5) + rich * 4;
    if (crucible) q *= 2;
    R.quality = Math.min(100, R.quality + q);
    L.events.push({ type: 'quality', quality: R.quality, crucible });
}

export function gradeOf(R) {
    let g = R.quality >= 85 ? 3 : R.quality >= 60 ? 2 : R.quality >= 35 ? 1 : 0;
    g += R.boost;
    const v = R.conds.reduce((a, c) => a + (c.type === 'forbid' ? c.violated : 0), 0);
    return GRADES[Math.max(0, Math.min(3, g - v))];
}

// ------------------------------------------------------------------ battle

function hitFoes(L, set, n) {
    const B = L.battle;
    B.foes.forEach((f, k) => {
        if (f.hp <= 0) return;
        const hits = f.cells.filter((c) => set.has(c));
        if (!hits.length) return;
        const per = BATTLE.hit + (has(L, 'surge') ? BATTLE.surge : 0);
        const dmg = Math.max(1, per * hits.length * n - f.armor);
        f.hp = Math.max(0, f.hp - dmg);
        f.hitThisTurn = true;
        // the cut cells fall away, but a foe keeps at least one cell while it lives
        let cut = [];
        if (f.hp > 0) {
            cut = hits.filter((c) => c !== f.cells[0]);
            f.cells = f.cells.filter((c) => !cut.includes(c));
        } else cut = [...f.cells];
        for (const c of cut) L.foeAt[c] = -1;
        L.events.push({ type: 'hit', foe: k, dmg, hp: f.hp, cut });
        if (f.hp <= 0) {
            f.cells = [];
            L.xp += f.boss ? 30 : 8;
            L.events.push({ type: 'defeat', foe: k, kind: f.kind });
        }
    });
    if (progress(L).done) win(L);
}

/** After a placement in battle: every living foe counts down, and acts at zero. */
function foeTurns(L) {
    const B = L.battle;
    B.foes.forEach((f, k) => {
        if (f.hp <= 0 || !live(L)) return;
        const struck = f.hitThisTurn;
        f.hitThisTurn = false;
        if (--f.timer > 0) return;
        f.timer = B.every;
        let act = f.pattern[f.step % f.pattern.length];
        f.step++;
        // a foe that was just struck flinches out of hardening; one boxed in strikes instead of growing
        if (act === 'harden' && struck) act = 'attack';
        if (act === 'advance') {
            const c = growCell(L, f);
            if (c < 0) act = 'attack';
            else {
                f.cells.push(c);
                L.foeAt[c] = k;
                L.events.push({ type: 'foe', foe: k, act, c });
                return;
            }
        }
        if (act === 'harden') {
            f.armor++;
            L.events.push({ type: 'foe', foe: k, act, armor: f.armor });
            return;
        }
        B.hp = Math.max(0, B.hp - f.dmg);
        L.events.push({ type: 'foe', foe: k, act: 'attack', dmg: f.dmg, hp: B.hp });
        if (B.hp <= 0) fail(L, 'defeated');
    });
}

/** An empty cell next to the foe, preferring the way toward the middle of the board. */
function growCell(L, f) {
    const opts = [];
    for (const c of f.cells) {
        const x = c % N, y = Math.floor(c / N);
        for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
            const px = x + dx, py = y + dy;
            if (px < 0 || py < 0 || px >= N || py >= N) continue;
            const i = idx(px, py);
            if (!filled(L, i) && !opts.includes(i)) opts.push(i);
        }
    }
    if (!opts.length) return -1;
    const d = (i) => Math.abs((i % N) - 4) + Math.abs(Math.floor(i / N) - 4);
    opts.sort((a, b) => d(a) - d(b));
    return opts[Math.floor(rnd(L) * Math.min(2, opts.length))];
}

// ------------------------------------------------------------------ dealing and the end

/**
 * Deal the next hand from the top of the supply. The lattice is a little kind: if a tile can't fit,
 * it looks a few tiles further down the supply for one that can and swaps them (`mercy` looks).
 */
function deal(L) {
    const n = Math.min(HAND, L.supply.length);
    if (!n) { L.hand.fill(null); return; }
    let looks = L.mercy;
    for (let k = 0; k < n; k++) {
        const s = L.supply[k];
        if (fitsAnywhere(L, SHAPES[s.shape].cells)) continue;
        for (let j = n; j < L.supply.length && looks > 0; j++) {
            looks--;
            if (fitsAnywhere(L, SHAPES[L.supply[j].shape].cells)) { [L.supply[k], L.supply[j]] = [L.supply[j], L.supply[k]]; break; }
        }
    }
    if (has(L, 'steady') && !L.supply.slice(0, n).some((s) => SHAPES[s.shape].cells.length <= 2)) {
        const j = L.supply.findIndex((s, q) => q >= n && SHAPES[s.shape].cells.length <= 2);
        if (j >= 0) [L.supply[n - 1], L.supply[j]] = [L.supply[j], L.supply[n - 1]];
    }
    const drawn = L.supply.splice(0, n);
    L.hand = new Array(HAND).fill(null);
    drawn.forEach((s, k) => { L.hand[k] = { uid: ++L.uid, shape: s.shape, el: s.el, cells: SHAPES[s.shape].cells.map((c) => [...c]) }; });
    L.events.push({ type: 'deal', hand: L.hand.map((h) => h?.uid ?? null), left: L.supply.length });
}

function check(L) {
    if (!live(L)) return;
    if (progress(L).done) { win(L); return; }
    if (L.hand.every((h) => !h)) { fail(L, 'out'); return; }
    if (anyFits(L)) { L.status = 'play'; return; }
    if (rescueAvailable(L)) {
        if (L.status !== 'stuck') L.events.push({ type: 'stuck' });
        L.status = 'stuck';
        return;
    }
    fail(L, 'jammed');
}

function win(L) {
    if (!live(L)) return;
    L.status = 'won';
    if (L.refine) L.refine.grade = gradeOf(L.refine);
    L.events.push({ type: 'won', score: L.score, grade: L.refine?.grade || null });
}

function fail(L, reason) {
    if (!live(L)) return;
    L.status = 'failed';
    L.reason = reason;
    L.events.push({ type: 'failed', reason });
}

