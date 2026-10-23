// The simulation. Pure: no DOM, no rendering, no Math.random, no clock.
// It is a turn-based story machine: the player picks a choice, the sim applies it and appends
// events (G.events). The view turns those into a transcript, a picture and sound.

import { MAX_ITEMS, HEALTH_MAX, CLARITY_MAX, UND_MAX, START_DAY, START_MIN, ARDENT_DAY, STATS } from '../config.js';
import { makeRng } from '../rng.js';
import { ITEMS } from './data/items.js';
import { CODEX } from './data/codex.js';
import { NODES, START } from './story.js';

const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const resolve = (v, G) => (typeof v === 'function' ? v(G) : v);

export function newGame(seed = 1) {
    const G = {
        v: 1,                               // save format version
        seed,
        rng: makeRng(seed),
        node: START,
        day: START_DAY,
        min: START_MIN,
        spec: '',
        stats: { ANL: 2, FLD: 2, INT: 2, WIL: 2 },
        health: HEALTH_MAX,
        clarity: CLARITY_MAX,
        und: 0,                             // genome decoded, %
        inv: [],
        flags: {},
        codex: [],
        steps: 0,
        over: false,
        ending: null,
        events: [],                         // { type, ... } since the last drain; never saved
    };
    G.events.push({ type: 'scene', node: START, quiet: false });
    return G;
}

// ------------------------------------------------------------------ reading the current node
export function nodeOf(G) { return NODES[G.node]; }

/** The passage for the current node: { title, art, lines }. */
export function passage(G) {
    const n = NODES[G.node];
    return { title: n.title, art: n.art, lines: arr(resolve(n.text, G)) };
}

/** The passage of any node, with the current state filled in (the view asks for the node a scene event names). */
export function passageOf(G, id) {
    const n = NODES[id];
    return { title: n.title, art: n.art, lines: arr(resolve(n.text, G)) };
}

export function clockText(G) {
    const h = Math.floor(G.min / 60) % 24, m = G.min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function has(G, id) { return G.inv.includes(id); }

/** Why a requirement is not met: { hidden } or { reason }, or null when it is. */
function unmet(G, req) {
    if (!req) return null;
    for (const f of arr(req.flag)) if (!G.flags[f]) return { hidden: true };
    for (const f of arr(req.notFlag)) if (G.flags[f]) return { hidden: true };
    for (const id of arr(req.noItem)) if (has(G, id)) return { hidden: true };
    for (const id of arr(req.item)) if (!has(G, id)) return { reason: 'NEEDS ' + ITEMS[id].name.toUpperCase() };
    if (req.room && G.inv.length >= MAX_ITEMS) return { reason: 'PACK FULL (DROP SOMETHING FIRST)' };
    if (req.und && G.und < req.und) return { reason: `NEEDS ${req.und}% DECODED` };
    if (req.flagsN) {
        const n = req.flagsN.of.filter((f) => G.flags[f]).length;
        if (n < req.flagsN.n) return { reason: 'NOT YET' };
    }
    return null;
}

/** The choices the player sees: [{ i, t, locked: string|null, id, adv, src }]; i is the position the sim accepts. */
export function choicesFor(G) {
    if (G.over) return [];
    const list = resolve(NODES[G.node].choices, G) || [];
    const out = [];
    for (const c of list) {
        const u = unmet(G, c.req);
        if (u && !c.lock && u.hidden) continue;
        const locked = u ? (c.lock || u.reason || 'LOCKED') : null;
        out.push({ i: out.length, t: resolve(c.t, G), locked, id: c.id || null, adv: !!c.adv, src: c });
    }
    return out;
}

// ------------------------------------------------------------------ effects
function note(G, text, tone = 'sys') { G.events.push({ type: 'notice', text, tone }); }

function addMinutes(G, hours) {
    G.min += Math.round(hours * 60);
    while (G.min >= 24 * 60) { G.min -= 24 * 60; G.day++; }
}

export function giveItem(G, id) {
    if (has(G, id)) return false;
    if (G.inv.length >= MAX_ITEMS) { note(G, `PACK FULL: ${ITEMS[id].name} left behind.`, 'bad'); return false; }
    G.inv.push(id);
    G.events.push({ type: 'item', id, gained: true });
    return true;
}

function takeItem(G, id) {
    const k = G.inv.indexOf(id);
    if (k < 0) return false;
    G.inv.splice(k, 1);
    G.events.push({ type: 'item', id, gained: false });
    return true;
}

function change(G, which, delta) {
    const max = which === 'health' ? HEALTH_MAX : CLARITY_MAX;
    const before = G[which];
    G[which] = clamp(before + delta, 0, max);
    if (G[which] !== before) G.events.push({ type: 'stat', which, delta: G[which] - before, value: G[which] });
}

function applyFx(G, fx) {
    for (const f of arr(fx)) {
        if (f.when && unmet(G, f.when)) continue;
        if (f.stats) Object.assign(G.stats, f.stats);
        if (f.spec) G.spec = f.spec;
        for (const k of arr(f.flag)) G.flags[k] = true;
        for (const k of arr(f.unflag)) delete G.flags[k];
        if (f.give) giveItem(G, f.give);
        if (f.take) takeItem(G, f.take);
        if (f.health) change(G, 'health', f.health);
        if (f.clarity) change(G, 'clarity', f.clarity);
        if (f.und) {
            const before = G.und;
            G.und = clamp(G.und + f.und, 0, UND_MAX);
            if (G.und !== before) G.events.push({ type: 'und', delta: G.und - before, value: G.und });
        }
        if (f.codex && !G.codex.includes(f.codex)) {
            G.codex.push(f.codex);
            G.events.push({ type: 'codex', id: f.codex });
        }
        if (f.time) addMinutes(G, f.time);
        if (f.say) note(G, resolve(f.say, G), f.tone || 'sys');
    }
}

// ------------------------------------------------------------------ acting
/**
 * Take choice `i` of the current node. opts.force = 'pass' | 'fail' decides a check (tests and the bot).
 * Returns false when the choice does not exist or is locked.
 */
export function choose(G, i, opts = {}) {
    if (G.over) return false;
    const c = choicesFor(G)[i];
    if (!c || c.locked) return false;
    const src = c.src;
    G.steps++;
    G.events.push({ type: 'choice', text: c.t });

    let out = src;
    if (src.check) {
        const ck = src.check;
        const d1 = 1 + Math.floor(G.rng() * 6), d2 = 1 + Math.floor(G.rng() * 6);
        const bonus = arr(ck.bonus).filter((id) => has(G, id)).length;
        const total = d1 + d2 + G.stats[ck.stat] + bonus;
        let ok = total >= ck.dc;
        if (opts.force === 'pass') ok = true;
        else if (opts.force === 'fail') ok = false;
        G.events.push({ type: 'roll', stat: ck.stat, dice: [d1, d2], mod: G.stats[ck.stat], bonus, total, dc: ck.dc, ok });
        out = ok ? ck.pass : ck.fail;
        // the cost of trying lands whether or not it works; the outcome's own fx come after its text
        applyFx(G, src.fx);
    }
    const lines = arr(resolve(out.text, G));
    if (lines.length) G.events.push({ type: 'result', lines });
    if (out !== src || !src.check) applyFx(G, out.fx);

    let to = out.to ?? src.to ?? G.node;
    if (!NODES[to].end) {
        if (G.health <= 0) to = 'end_quiet';
        else if (G.clarity <= 0) to = 'end_chorus';
        else if (G.day >= ARDENT_DAY) to = 'end_ardent';
    }
    enter(G, to, { quiet: to === G.node && !NODES[to].end ? true : !!out.quiet });
    return true;
}

function enter(G, id, { quiet }) {
    G.node = id;
    const n = NODES[id];
    G.events.push({ type: 'scene', node: id, quiet });
    if (n.end) {
        G.over = true;
        G.ending = n.end.id;
        G.events.push({ type: 'end', id: n.end.id, name: n.end.name });
    }
}

/** Use a consumable from the pack. */
export function useItem(G, id) {
    const it = ITEMS[id];
    if (G.over || !has(G, id)) return false;
    if (!it.use) { note(G, it.desc, 'dim'); return false; }
    takeItem(G, id);
    G.flags['used_' + id] = true;
    if (it.use.health) change(G, 'health', it.use.health);
    if (it.use.clarity) change(G, 'clarity', it.use.clarity);
    note(G, `You use the ${it.name.toLowerCase()}.`);
    return true;
}

export function dropItem(G, id) {
    if (G.over || !has(G, id)) return false;
    if (ITEMS[id].keep) { note(G, `You can't bring yourself to leave ${ITEMS[id].name} behind.`, 'dim'); return false; }
    takeItem(G, id);
    return true;
}

/** The end-of-run card. */
export function summary(G) {
    const n = NODES[G.node];
    return {
        name: n.end ? n.end.name : '',
        days: G.day - START_DAY + 1,
        und: G.und,
        codex: G.codex.length,
        codexTotal: Object.keys(CODEX).length,
        items: G.inv.length,
    };
}

// ------------------------------------------------------------------ saving
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    if (!NODES[d.node]) throw new Error('unknown node');
    for (const k of STATS) if (!Number.isFinite(d.stats?.[k])) throw new Error('bad stats');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
