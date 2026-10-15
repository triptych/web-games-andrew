// The healing puzzle. Pure: no DOM, no renderer, no Math.random, no clock.
//
// Bumble Basket's (game-058) trail rules rethemed: drag through neighbouring afflictions where each
// hop shares a trait the healer can sense, release three or more to treat them. State is a plain
// object (S) so a scan saves and loads mid-puzzle as JSON; every action returns a list of events
// the view plays back as animation, and also pushes them onto S.events.
//
// Board: rows × cols, row 0 at the top (the head). Motes fall toward the last row; new ones well up
// at row 0. Fixed cells (holes outside the body, scar tissue, bound motes) are skipped over.
//
// Events:
//   treat  { items:[{id,r,c,m}], source:'chain'|'draught'|'lancet'|'radiant', links? }
//   scar   { r, c, left }          a scar layer softened
//   unbind { r, c, id, left }      a binding layer broken
//   prism  { items:[{id,r,c,hue}], r, c, hue }
//   bloom  { r, c, m }             a lifebloom grew where a trail ended
//   settle { moves:[{id,r,c,fromR}], spawns:[{m,r,c,fromR}] }
//   vial   { index, full }         a vial filled (full) or changed its set
//   shuffle{ items:[{id,r,c,m}] }
//   phoenix{}                      Phoenix trail armed
//   focus  { n, why }              focus given back
//   phase  { index }               a multi-phase scan moved on to its next board
//   end    { status }

import {
    KINDS, VIALS, MAX_CHARGES, MIN_CHAIN, BLOOM_CHAIN, TONIC_FOCUS, STAR2_FRAC, STAR3_FRAC, SCORE,
} from './data/ailments.js';
import { objRng } from '../rng.js';
import { hasMove, neighbours } from './search.js';

export const DEFAULT_MODS = {
    focus: 0, vialLess: 0, tonic: TONIC_FOCUS, start: [], bloomChain: BLOOM_CHAIN, unbind: 1,
    radiant: false, maxCharges: MAX_CHARGES, lantern: 0, steady: 0, wideLancet: false, debride: 1, triage: false,
};

/**
 * spec: { name, mask:[strings], kinds:[id | [id, nHues]], sevs?:['M'], focus, goals:[{t,v,n}],
 *         scars?:[[r,c,n]], bound?:[[r,c,n]], scarCount?, boundCount? }
 *       or { phases:[spec, …] } for a multi-board scan.
 * opts: { seed, senses:['kind',…], mods }
 */
export function newScan(spec, opts = {}) {
    const phases = spec.phases ? spec.phases : [spec];
    const mods = { ...DEFAULT_MODS, ...(opts.mods || {}) };
    const S = {
        v: 1,
        phases: JSON.parse(JSON.stringify(phases)),
        phase: 0,
        spec: null,
        senses: (opts.senses || ['kind']).slice(),
        mods,
        rs: (opts.seed ?? 1) | 0,
        nextId: 1,
        focus: 0,
        base: 0,
        used: 0,
        score: 0,
        status: 'playing',
        continued: false,
        wild: false,
        stars: 0,
        bonus: 0,
        found: [],
        trails: 0,
        stats: { chains: 0, longest: 0, blooms: 0, treated: 0, powers: 0, shuffles: 0, items: 0 },
        goals: [],
        vials: [],
        cells: [],
        rows: 0, cols: 0,
        events: [],
    };
    S.vials = S.senses.map((sense) => ({
        sense, power: VIALS[sense].power, need: Math.max(4, VIALS[sense].need - mods.vialLess), fill: 0, charges: 0, target: null,
    }));
    S.focus = mods.focus;
    S.base = mods.focus;
    loadPhase(S, 0);
    for (const p of mods.start) {
        const v = S.vials.find((x) => x.power === p);
        if (v) v.charges = Math.min(mods.maxCharges, v.charges + 1);
    }
    S.events.length = 0;
    return S;
}

function loadPhase(S, i) {
    S.phase = i;
    S.spec = S.phases[i];
    const mask = S.spec.mask;
    S.rows = mask.length;
    S.cols = mask[0].length;
    S.focus += S.spec.focus;
    S.base += S.spec.focus;
    S.goals = (S.spec.goals || []).map((g) => ({ ...g, have: 0 }));
    S.pool = buildPool(S.spec);
    buildBoard(S);
    for (let k = 0; k < S.vials.length; k++) newVialTarget(S, k);
}

/** A spec's kinds list → spawnable variants. */
export function buildPool(spec) {
    const sevs = spec.sevs ?? ['M'];
    const kinds = spec.kinds.map((k) => {
        const [id, n] = Array.isArray(k) ? k : [k, 1];
        const hues = KINDS[id].hues.slice(0, Math.max(1, Math.min(n, KINDS[id].hues.length)));
        return { kind: id, hues };
    });
    return { kinds, sevs };
}

const rngOf = (S) => objRng(S, 'rs');

function buildBoard(S) {
    const rng = rngOf(S);
    const mask = S.spec.mask;
    S.cells = [];
    for (let r = 0; r < S.rows; r++) {
        const row = [];
        for (let c = 0; c < S.cols; c++) row.push({ hole: mask[r][c] === ' ', scar: 0, m: null });
        S.cells.push(row);
    }
    const body = [];
    for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) if (!S.cells[r][c].hole) body.push([r, c]);
    for (const [r, c, n] of S.spec.scars ?? []) if (S.cells[r]?.[c] && !S.cells[r][c].hole) S.cells[r][c].scar = n ?? 1;
    // random scars stay off the bottom row, so a column can't be sealed shut at its foot
    let scarN = S.spec.scarCount ?? 0;
    const free = rng.shuffle(body.filter(([r, c]) => !S.cells[r][c].scar && r > 0 && r < S.rows - 1));
    while (scarN-- > 0 && free.length) { const [r, c] = free.pop(); S.cells[r][c].scar = rng() < 0.35 ? 2 : 1; }
    const bound = new Map((S.spec.bound ?? []).map(([r, c, n]) => [r * S.cols + c, n ?? 1]));
    let boundN = S.spec.boundCount ?? 0;
    while (boundN-- > 0 && free.length) { const [r, c] = free.pop(); bound.set(r * S.cols + c, rng() < 0.3 ? 2 : 1); }
    for (let tries = 0; tries < 60; tries++) {
        for (const [r, c] of body) {
            const cell = S.cells[r][c];
            if (cell.scar) { cell.m = null; continue; }
            cell.m = spawn(S, rng);
            const b = bound.get(r * S.cols + c);
            if (b) cell.m.bound = b;
        }
        if (hasMove(S, false)) break;
    }
}

function spawn(S, rng) {
    const k = rng.pick(S.pool.kinds);
    return makeMote(S, k.kind, rng.pick(k.hues), rng.pick(S.pool.sevs));
}

function makeMote(S, kind, hue, sev, bloom = false) {
    return { id: S.nextId++, kind, hue, sev, school: KINDS[kind].school, bloom, bound: 0 };
}

export const inBounds = (S, r, c) => r >= 0 && r < S.rows && c >= 0 && c < S.cols;

/** A mote that can join a trail. */
export function selectable(S, r, c) {
    if (!inBounds(S, r, c)) return false;
    const m = S.cells[r][c].m;
    return !!m && !m.bound;
}

const fixed = (cell) => cell.hole || cell.scar > 0 || (cell.m && cell.m.bound > 0);

export function forEachMote(S, fn) {
    for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) { const m = S.cells[r][c].m; if (m) fn(m, r, c); }
}

// ------------------------------------------------------------------ links

/** Traits two motes share that the healer can sense. */
export function linkTraits(S, a, b, wild = S.wild) {
    if (!a || !b) return [];
    const out = [];
    if (a.bloom || b.bloom) out.push('bloom');
    for (const s of S.senses) {
        if (s === 'hue' && (a.bloom || b.bloom)) continue;
        if (a[s] === b[s]) out.push(s);
    }
    if (!out.length && wild) out.push('phoenix');
    return out;
}

export function canLink(S, a, b, wild = S.wild) {
    if (!a || !b) return false;
    if (wild || a.bloom || b.bloom) return true;
    for (const s of S.senses) if (a[s] === b[s]) return true;
    return false;
}

export const adjacent = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) === 1;

/** Can the trail `path` be extended with (r, c)? */
export function canExtend(S, path, r, c) {
    if (!selectable(S, r, c)) return false;
    if (path.some(([pr, pc]) => pr === r && pc === c)) return false;
    if (!path.length) return true;
    const last = path[path.length - 1];
    if (!adjacent(last, [r, c])) return false;
    return canLink(S, S.cells[last[0]][last[1]].m, S.cells[r][c].m);
}

export function validChain(S, path) {
    if (!Array.isArray(path) || path.length < MIN_CHAIN) return false;
    const seen = new Set();
    for (let i = 0; i < path.length; i++) {
        const [r, c] = path[i];
        if (!selectable(S, r, c)) return false;
        const k = r * S.cols + c;
        if (seen.has(k)) return false;
        seen.add(k);
        if (i > 0) {
            const [pr, pc] = path[i - 1];
            if (!adjacent([pr, pc], [r, c])) return false;
            if (!canLink(S, S.cells[pr][pc].m, S.cells[r][c].m)) return false;
        }
    }
    return true;
}

// ------------------------------------------------------------------ goals

export function moteMatches(goal, m) {
    switch (goal.t) {
        case 'kind': return m.kind === goal.v;
        case 'hue': return !m.bloom && m.hue === goal.v;
        case 'sev': return m.sev === goal.v;
        case 'school': return m.school === goal.v;
        case 'any': return true;
        default: return false;
    }
}

/** How much treating a set of cells would advance unfinished goals (bot, hints). */
export function goalValue(S, path) {
    let v = 0;
    for (const g of S.goals) {
        if (g.have >= g.n) continue;
        if (g.t === 'bloom') { if (path.length >= S.mods.bloomChain) v += 6; continue; }
        if (g.t === 'scar' || g.t === 'bound') { v += obstaclesTouched(S, path, g.t) * 4; continue; }
        let m = 0;
        for (const [r, c] of path) { const x = S.cells[r][c].m; if (x && moteMatches(g, x)) m++; }
        v += Math.min(m, g.n - g.have);
    }
    return v;
}

export function obstaclesTouched(S, path, type) {
    const hit = new Set();
    for (const [r, c] of path) {
        for (const [nr, nc] of neighbours(S, r, c)) {
            const cell = S.cells[nr][nc];
            if (type === 'scar' && cell.scar > 0) hit.add(nr * S.cols + nc);
            if (type === 'bound' && cell.m && cell.m.bound > 0) hit.add(nr * S.cols + nc);
        }
    }
    return hit.size;
}

export const goalsDone = (S) => S.goals.length > 0 && S.goals.every((g) => g.have >= g.n);
export const focusLeft = (S) => S.focus - S.used;

function countTreated(S, motes) {
    for (const m of motes) {
        for (const g of S.goals) if (moteMatches(g, m)) g.have = Math.min(g.n, g.have + 1);
        if (!m.bloom && KINDS[m.kind].hues.includes(m.hue)) {
            const key = `${m.kind}|${m.hue}`;
            if (!S.found.includes(key)) S.found.push(key);
        }
    }
    S.stats.treated += motes.length;
}

function bumpGoal(S, t, n = 1) {
    for (const g of S.goals) if (g.t === t) g.have = Math.min(g.n, g.have + n);
}

// ------------------------------------------------------------------ actions

function out(S, events) { for (const e of events) S.events.push(e); return events; }

/** Treat a trail. Returns events, or null if the trail is not legal. */
export function playChain(S, path) {
    if (S.status !== 'playing' || focusLeft(S) <= 0) return null;
    if (!validChain(S, path)) return null;
    const events = [];
    const links = [];
    for (let i = 1; i < path.length; i++) {
        links.push(linkTraits(S, S.cells[path[i - 1][0]][path[i - 1][1]].m, S.cells[path[i][0]][path[i][1]].m));
    }
    const usedWild = S.wild;
    S.wild = false;
    const free = S.mods.triage && S.stats.chains === 0;
    if (!free) S.used++;
    S.stats.chains++;
    S.trails++;
    S.stats.longest = Math.max(S.stats.longest, path.length);
    const items = path.map(([r, c]) => ({ id: S.cells[r][c].m.id, r, c, m: S.cells[r][c].m }));
    const n = path.length;
    S.score += SCORE.perChainSq * n * n;
    events.push({ type: 'treat', items, source: 'chain', links, wild: usedWild, free });
    const radiant = [];
    if (S.mods.radiant) {
        for (const it of items) {
            if (!it.m.bloom) continue;
            for (const [nr, nc] of neighbours(S, it.r, it.c)) {
                const x = S.cells[nr][nc].m;
                if (x && !x.bound && !path.some(([pr, pc]) => pr === nr && pc === nc) && !radiant.some((q) => q.id === x.id)) {
                    radiant.push({ id: x.id, r: nr, c: nc, m: x });
                }
            }
        }
    }
    removeMotes(S, items, events);
    if (radiant.length) {
        events.push({ type: 'treat', items: radiant, source: 'radiant' });
        S.score += SCORE.power * radiant.length;
        removeMotes(S, radiant, events);
    }
    if (n >= S.mods.bloomChain) {
        const last = items[items.length - 1];
        const [r, c] = path[path.length - 1];
        const b = makeMote(S, last.m.kind, last.m.hue, last.m.sev, true);
        S.cells[r][c].m = b;
        S.stats.blooms++;
        bumpGoal(S, 'bloom');
        events.push({ type: 'bloom', r, c, m: b });
    }
    if (S.mods.steady && n >= S.mods.steady) { S.focus++; events.push({ type: 'focus', n: 1, why: 'steady' }); }
    if (S.mods.lantern && S.trails % S.mods.lantern === 0 && !S.wild) { S.wild = true; events.push({ type: 'phoenix', lantern: true }); }
    afterTreat(S, [...path, ...radiant.map((q) => [q.r, q.c])], events);
    return out(S, events);
}

/** Use a vial's power at (r, c). The Phoenix needs no target. */
export function usePower(S, vialIndex, r, c) {
    if (S.status !== 'playing') return null;
    const vial = S.vials[vialIndex];
    if (!vial || vial.charges <= 0) return null;
    const events = [];
    if (vial.power === 'phoenix') {
        if (S.wild || focusLeft(S) <= 0) return null;
        S.wild = true;
        vial.charges--;
        S.stats.powers++;
        events.push({ type: 'phoenix' });
        return out(S, events);
    }
    if (!inBounds(S, r, c) || S.cells[r][c].hole) return null;
    const target = S.cells[r][c].m;

    if (vial.power === 'draught') {
        if (!target) return null;
        const items = [], unb = [];
        forEachMote(S, (m, mr, mc) => {
            if (m.kind !== target.kind) return;
            if (m.bound) unb.push([mr, mc]); else items.push({ id: m.id, r: mr, c: mc, m });
        });
        if (!items.length) return null;
        vial.charges--;
        S.stats.powers++;
        S.score += SCORE.power * items.length;
        events.push({ type: 'treat', items, source: 'draught', r, c });
        removeMotes(S, items, events);
        for (const [mr, mc] of unb) unbind(S, mr, mc, events);
        afterTreat(S, items.map((i) => [i.r, i.c]), events, { noObstacles: true });
        return out(S, events);
    }

    if (vial.power === 'prism') {
        if (!target || target.bloom) return null;
        const items = [];
        for (const [nr, nc] of neighbours(S, r, c)) {
            const m = S.cells[nr][nc].m;
            if (!m || m.bloom || m.bound || m.hue === target.hue) continue;
            m.hue = target.hue;
            items.push({ id: m.id, r: nr, c: nc, hue: target.hue });
        }
        vial.charges--;
        S.stats.powers++;
        events.push({ type: 'prism', items, r, c, hue: target.hue });
        ensureMove(S, events);
        checkEnd(S, events);
        return out(S, events);
    }

    if (vial.power === 'lancet') {
        const area = [[r, c], ...neighbours(S, r, c)];
        if (S.mods.wideLancet) for (const [dr, dc] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) if (inBounds(S, r + dr, c + dc)) area.push([r + dr, c + dc]);
        const items = [];
        for (const [nr, nc] of area) {
            const m = S.cells[nr][nc].m;
            if (m && !m.bound) items.push({ id: m.id, r: nr, c: nc, m });
        }
        const obstacle = area.some(([nr, nc]) => S.cells[nr][nc].scar > 0 || S.cells[nr][nc].m?.bound > 0);
        if (!items.length && !obstacle) return null;
        vial.charges--;
        S.stats.powers++;
        S.score += SCORE.power * items.length;
        events.push({ type: 'treat', items, source: 'lancet', r, c, wide: S.mods.wideLancet });
        removeMotes(S, items, events);
        afterTreat(S, area, events);
        return out(S, events);
    }
    return null;
}

/** A remedy from the satchel: 'salts' +3 focus, 'calm' reshuffle, 'star' fills the fullest vial. */
export function useItem(S, item) {
    if (S.status !== 'playing' && !(S.status === 'lost' && item === 'salts')) return null;
    const events = [];
    if (item === 'salts') {
        S.focus += 3;
        if (S.status === 'lost') S.status = 'playing';
        events.push({ type: 'focus', n: 3, why: 'salts' });
    } else if (item === 'calm') {
        shuffle(S, events, true);
    } else if (item === 'star') {
        let best = -1, bf = -1;
        S.vials.forEach((v, i) => { if (v.charges < S.mods.maxCharges && v.fill / v.need > bf) { bf = v.fill / v.need; best = i; } });
        if (best < 0) return null;
        const v = S.vials[best];
        v.fill = 0; v.charges++; v.justFilled = true;
        newVialTarget(S, best);
        events.push({ type: 'vial', index: best, full: true });
    } else return null;
    S.stats.items++;
    return out(S, events);
}

/** Out of focus: drink the tonic (once per scan, caps it at one star). */
export function drinkTonic(S) {
    if (S.status !== 'lost' || S.continued) return false;
    S.continued = true;
    S.focus += S.mods.tonic;
    S.status = 'playing';
    S.events.push({ type: 'focus', n: S.mods.tonic, why: 'tonic' });
    return true;
}

// ------------------------------------------------------------------ resolution

function removeMotes(S, items, events) {
    const motes = [];
    for (const it of items) {
        const cell = S.cells[it.r][it.c];
        if (cell.m && cell.m.id === it.id) {
            if (cell.m.bloom) S.score += SCORE.bloom;
            motes.push(cell.m);
            cell.m = null;
        }
    }
    countTreated(S, motes);
    fillVials(S, motes, events);
}

function afterTreat(S, area, events, opts = {}) {
    if (!opts.noObstacles) {
        const hit = new Set();
        for (const [r, c] of area) for (const [nr, nc] of [[r, c], ...neighbours(S, r, c)]) hit.add(nr * S.cols + nc);
        for (const k of hit) {
            const r = Math.floor(k / S.cols), c = k % S.cols;
            const cell = S.cells[r][c];
            if (cell.scar > 0) {
                cell.scar = Math.max(0, cell.scar - S.mods.debride);
                events.push({ type: 'scar', r, c, left: cell.scar });
                if (cell.scar === 0) bumpGoal(S, 'scar');
            } else if (cell.m && cell.m.bound > 0) {
                for (let i = 0; i < S.mods.unbind && cell.m.bound > 0; i++) unbind(S, r, c, events);
            }
        }
    }
    settle(S, events);
    for (let i = 0; i < S.vials.length; i++) {
        if (!targetOnBoard(S, S.vials[i])) { newVialTarget(S, i); events.push({ type: 'vial', index: i, full: false }); }
    }
    ensureMove(S, events);
    checkEnd(S, events);
}

function unbind(S, r, c, events) {
    const m = S.cells[r][c].m;
    if (!m || !m.bound) return;
    m.bound--;
    events.push({ type: 'unbind', r, c, id: m.id, left: m.bound });
    if (m.bound === 0) bumpGoal(S, 'bound');
}

/** Gravity and refill, column by column, skipping fixed cells. */
function settle(S, events) {
    const rng = rngOf(S);
    const moves = [], spawns = [];
    for (let c = 0; c < S.cols; c++) {
        const slots = [];
        for (let r = S.rows - 1; r >= 0; r--) if (!fixed(S.cells[r][c])) slots.push(r);
        const motes = [];
        for (const r of slots) {
            const m = S.cells[r][c].m;
            if (m) motes.push({ m, r });
            S.cells[r][c].m = null;
        }
        let i = 0;
        for (; i < motes.length; i++) {
            const r = slots[i];
            S.cells[r][c].m = motes[i].m;
            if (motes[i].r !== r) moves.push({ id: motes[i].m.id, r, c, fromR: motes[i].r });
        }
        for (let k = 0; i < slots.length; i++, k++) {
            const r = slots[i];
            const m = spawn(S, rng);
            S.cells[r][c].m = m;
            spawns.push({ m, r, c, fromR: -1 - k });
        }
    }
    events.push({ type: 'settle', moves, spawns });
}

function shuffle(S, events, force = false) {
    const rng = rngOf(S);
    const cells = [];
    forEachMote(S, (m, r, c) => { if (!m.bound) cells.push([r, c]); });
    for (let tries = 0; tries < 40; tries++) {
        const motes = cells.map(([r, c]) => S.cells[r][c].m);
        rng.shuffle(motes);
        cells.forEach(([r, c], i) => { S.cells[r][c].m = motes[i]; });
        if (tries > 20) for (const [r, c] of cells) if (!S.cells[r][c].m.bloom) S.cells[r][c].m = spawn(S, rng);
        if (hasMove(S, false) && (!force || tries > 0)) break;
    }
    S.stats.shuffles++;
    events.push({ type: 'shuffle', items: cells.map(([r, c]) => ({ id: S.cells[r][c].m.id, r, c, m: S.cells[r][c].m })) });
}

function ensureMove(S, events) {
    if (!hasMove(S, false)) shuffle(S, events);
}

function checkEnd(S, events) {
    if (S.status !== 'playing') return;
    if (goalsDone(S)) {
        if (S.phase < S.phases.length - 1) {
            const next = S.phase + 1;
            loadPhase(S, next);
            S.wild = false;
            events.push({ type: 'phase', index: next });
            return;
        }
        S.status = 'won';
        const left = Math.max(0, focusLeft(S));
        S.bonus = left * SCORE.leftover;
        S.score += S.bonus;
        const frac = Math.min(1, left / Math.max(1, S.base));
        S.stars = S.continued ? 1 : frac >= STAR3_FRAC ? 3 : frac >= STAR2_FRAC ? 2 : 1;
        events.push({ type: 'end', status: 'won' });
        return;
    }
    if (focusLeft(S) <= 0) {
        const canPower = S.vials.some((v) => v.charges > 0 && v.power !== 'phoenix');
        if (!canPower) { S.status = 'lost'; events.push({ type: 'end', status: 'lost' }); }
    }
}

// ------------------------------------------------------------------ vials

export function vialMatches(vial, m) {
    if (vial.sense === 'hue' && m.bloom) return false;
    return m[vial.sense] === vial.target;
}

function fillVials(S, motes, events) {
    const max = S.mods.maxCharges;
    for (let i = 0; i < S.vials.length; i++) {
        const v = S.vials[i];
        if (v.target == null) continue;
        let n = 0;
        for (const m of motes) if (vialMatches(v, m)) n++;
        if (!n) continue;
        if (v.charges >= max) { v.fill = v.need; continue; }
        v.fill += n;
        while (v.fill >= v.need && v.charges < max) {
            v.fill -= v.need;
            v.charges++;
            v.justFilled = true;
            newVialTarget(S, i);
            events.push({ type: 'vial', index: i, full: true });
        }
        if (v.charges >= max) v.fill = Math.min(v.fill, v.need);
    }
}

function targetOnBoard(S, v) {
    if (v.target == null) return false;
    let found = false;
    forEachMote(S, (m) => { if (!found && vialMatches(v, m)) found = true; });
    return found;
}

/** Pick a new set for a vial from what is on the grid, weighted by count. */
function newVialTarget(S, i) {
    const rng = rngOf(S);
    const v = S.vials[i];
    const counts = new Map();
    forEachMote(S, (m) => { if (!m.bloom) counts.set(m[v.sense], (counts.get(m[v.sense]) ?? 0) + 1); });
    const entries = [...counts.entries()].filter(([x]) => x !== v.target || counts.size === 1);
    if (!entries.length) return;
    const total = entries.reduce((s, [, n]) => s + n, 0);
    let x = rng() * total;
    for (const [val, n] of entries) { x -= n; if (x <= 0) { v.target = val; return; } }
    v.target = entries[entries.length - 1][0];
}

/** Clear and return which vials just filled (the HUD's sparkle). */
export function takeFilledVials(S) {
    const outv = [];
    S.vials.forEach((v, i) => { if (v.justFilled) { outv.push(i); v.justFilled = false; } });
    return outv;
}

export function moteCount(S) { let n = 0; forEachMote(S, () => n++); return n; }
