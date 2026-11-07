// The simulation: a story machine. Pure: no DOM, no renderer, no Math.random, no clock.
//
// Everything that happens is a command, act(G, { t: ... }), applied the moment it is made, so no press can
// be lost or merged. step(G, dt) only moves the clock for the things the view is animating (a client walking
// in, the ball clearing, the cards turning). The view reads G and drains G.events; it never writes G.
//
// Phases: prologue (dialogue) -> dayintro -> arrive -> talk (dialogue) -> ready -> ball -> deal -> flip ->
// style -> react (dialogue) -> leave -> [next client | dusk -> scene -> night scene -> next day]. Day 7 ends
// with the grand reading, the plot ending, the festival night and the ending.

import { STEP, TIMING, RANKS, DAYS as DAYCOUNT, CLUES, ROMANCE_MIN, ROMANCE_LOVE, STYLES } from '../config.js';
import { makeRng } from '../rng.js';
import { THEME_IDS, SYMBOL_IDS, COLOUR_IDS, SYMBOLS, COLOURS, OMENS, START_KNOWN } from './data/lexicon.js';
import {
    L, PROLOGUE, DAYS, VILLAGER_BY_DAY, CLIENTS, GRAND, PRINCE, CLUE_TEXT, clueSummary, endingFor, FESTIVAL_NONE,
    VILLAGER_NAMES, VILLAGER_SURNAMES, VILLAGER_ROLES, OPENERS, STYLE_ASK, VILLAGER_AFTER, STYLE_REPLY,
} from './data/story.js';
import { CAND, CAND_IDS, SCENES, QUIET, FINALE } from './data/romance.js';
import { makeReading, scoreReading, lessons } from './reading.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function newGame(seed = 1) {
    const G = {
        v: 1, seed, rng: makeRng(seed), t: 0, pt: 0,
        phase: 'prologue', day: 1, idx: 0,
        queue: [], client: null, reading: null, dlg: null, ball: null,
        rank: 0, xp: 0, focus: RANKS[0].focus, renown: 0,
        know: { sym: {}, col: {}, omen: {} },
        clues: {}, clueHow: {},
        aff: { elias: 0, mirabel: 0, wren: 0 }, stage: { elias: 0, mirabel: 0, wren: 0 }, met: { elias: false, mirabel: false, wren: false },
        trust: 0, grandStars: -1, plot: null, romance: null, evening: null, ending: null,
        stats: { readings: 0, stars: [0, 0, 0, 0], learned: 0, studied: 0 },
        events: [],
    };
    for (const s of START_KNOWN.sym) G.know.sym[s] = true;
    for (const c of START_KNOWN.col) G.know.col[c] = true;
    for (const o of START_KNOWN.omen) G.know.omen[o] = true;
    startDlg(G, PROLOGUE, 'prologue_done');
    return G;
}

export const clueCount = (G) => CLUES.filter((c) => G.clues[c]).length;
export const isTimed = (G) => !G.dlg && ['dayintro', 'arrive', 'flip', 'leave'].includes(G.phase);
export const inBall = (G) => G.phase === 'ball' || G.phase === 'deal' || G.phase === 'flip' || G.phase === 'style' || (G.phase === 'react' && !!G.reading);

// ---------------------------------------------------------------------------------------- dialogue
function startDlg(G, lines, then, ctx = null, choices = null) {
    const n = clueCount(G);
    const filled = lines.map((l) => ({ ...l, t: l.t.replace('{clues}', clueSummary(n)) }));
    G.dlg = { lines: filled, i: 0, choices, then, ctx };
    G.events.push({ type: 'line', ...filled[0] });
}

function next(G) {
    if (isTimed(G)) { G.pt = 99; stepTimers(G); return true; }
    if (G.phase === 'ball' && G.ball && !G.ball.done) { G.pt = 99; ballTick(G); return true; }
    const d = G.dlg;
    if (!d) return false;
    if (d.i < d.lines.length - 1) {
        d.i++;
        G.events.push({ type: 'line', ...d.lines[d.i] });
        return true;
    }
    if (d.choices) return false;
    G.dlg = null;
    finishDlg(G, d);
    return true;
}

function choose(G, i) {
    const d = G.dlg;
    if (!d || !d.choices || d.i < d.lines.length - 1) return false;
    const ch = d.choices[i];
    if (!ch) return false;
    const ctx = d.ctx || {};
    if (ctx.kind === 'cand') {
        G.aff[ctx.id] += ch.a;
        G.events.push({ type: 'aff', id: ctx.id, delta: ch.a });
    } else if (ctx.kind === 'prince') {
        G.trust = clamp(G.trust + ch.tr, 0, 8);
        G.events.push({ type: 'trust', delta: ch.tr });
    }
    G.events.push({ type: 'choice', i });
    startDlg(G, [...ch.r, ...(ctx.end || [])], d.then, ctx);
    return true;
}

function finishDlg(G, d) {
    const ctx = d.ctx || {};
    switch (d.then) {
        case 'prologue_done': beginDay(G, 1); break;
        case 'client_talk_done': G.phase = 'ready'; G.pt = 0; break;
        case 'react_done':
            if (G.client?.grand) { grandDone(G); break; }
            G.phase = 'leave'; G.pt = 0; G.events.push({ type: 'leave' }); break;
        case 'cand_done':
            G.stage[ctx.id] = Math.min(4, G.stage[ctx.id] + 1);
            if (ctx.clue) grantClue(G, ctx.clue, 'romance');
            afterEvening(G); break;
        case 'study_done': afterEvening(G); break;
        case 'prince_done': nextDay(G); break;
        case 'plot_done': openFestival(G); break;
        case 'finale_done': finish(G); break;
        default: break;
    }
}

// ---------------------------------------------------------------------------------------- days and clients
function beginDay(G, day) {
    G.day = day;
    G.idx = 0;
    G.focus = RANKS[G.rank].focus;
    G.queue = DAYS[day].map((id) => (id === '*' ? makeVillager(G, day) : id));
    if (day === DAYCOUNT) G.queue.push('grand');
    G.phase = 'dayintro';
    G.pt = 0;
    G.reading = null; G.client = null; G.ball = null;
    G.events.push({ type: 'day', day });
}

function nextDay(G) {
    if (G.day >= DAYCOUNT) return;
    beginDay(G, G.day + 1);
}

const SKINS = ['#f0cfa8', '#e2b894', '#c68a62', '#a8714a', '#7a4a2e', '#e8c3a0'];
const HAIRS = ['#2a1c14', '#5a3a1a', '#8a4a24', '#c8a050', '#cfcfd6', '#a02828', '#1a1a22'];
const ROBES = ['#8a3a5a', '#3a6a8a', '#5a7a3a', '#a06a2a', '#6a3a8a', '#2a6a6a', '#8a4a2a', '#4a4a8a'];
const TRIMS = ['#e8c14a', '#d9d27a', '#ff9ec4', '#9fd0ff', '#ffb347'];

function makeVillager(G, day) {
    const r = G.rng;
    const concern = r.pick(THEME_IDS);
    const likes = r.pick(STYLES);
    const name = r.pick(VILLAGER_NAMES) + ' ' + r.pick(VILLAGER_SURNAMES);
    return {
        gen: true, id: 'v' + day + '_' + Math.floor(r() * 1e6),
        name, role: r.pick(VILLAGER_ROLES), day, likes, concern,
        look: {
            skin: r.pick(SKINS), hair: r.pick(HAIRS), hs: r.pick(['short', 'long', 'bun', 'curly', 'bald']),
            hat: r.pick([null, null, 'cap', 'wide', 'kerchief']), hatc: r.pick(ROBES), robe: r.pick(ROBES), trim: r.pick(TRIMS),
            body: r.pick(['slim', 'broad', 'small', 'tall']), beard: r() < 0.25, glasses: r() < 0.15,
        },
        clouded: VILLAGER_BY_DAY[day].clouded,
        talk: [L('c', r.pick(OPENERS[concern]), 'w'), L('c', r.pick(STYLE_ASK[likes]))],
        after: { 3: [L('c', r.pick(VILLAGER_AFTER[3]), 'h')], 2: [L('c', r.pick(VILLAGER_AFTER[2]), 'h')], 1: [L('c', r.pick(VILLAGER_AFTER[1]))], 0: [L('c', r.pick(VILLAGER_AFTER[0]), 's')] },
    };
}

function grandClient(G) {
    const n = clueCount(G);
    const clouded = n >= 4 ? [] : n >= 2 ? [1] : [0, 1];
    return { ...clone(GRAND), id: 'grand', grand: true, clouded, talk: GRAND.pre };
}

function startClient(G) {
    if (G.idx >= G.queue.length) { toDusk(G); return; }
    const q = G.queue[G.idx];
    const def = q === 'grand' ? grandClient(G) : typeof q === 'string' ? { ...clone(CLIENTS[q]), id: q } : clone(q);
    G.client = def;
    G.reading = makeReading(G.rng, {
        beats: def.beats, syms: def.syms, concern: def.concern, clouded: def.clouded || 0, known: !!def.known,
        near: def.known ? 1 : G.rank >= 3 ? 1 : 2,
    });
    G.reading.likes = def.likes;
    G.reading.result = null;
    G.ball = null;
    G.phase = 'arrive';
    G.pt = 0;
    G.events.push({ type: 'knock', who: def.id });
}

// ---------------------------------------------------------------------------------------- timers
export function step(G, dt = STEP) {
    G.t += dt;
    G.pt += dt;
    stepTimers(G);
    if (G.phase === 'ball') ballTick(G);
}

function stepTimers(G) {
    if (G.dlg) return;
    switch (G.phase) {
        case 'dayintro': if (G.pt >= TIMING.dayIntro) startClient(G); break;
        case 'arrive':
            if (G.pt >= TIMING.arrive) {
                G.phase = 'talk'; G.pt = 0;
                const c = G.client;
                if (c.aff) G.met[c.aff] = true;
                G.events.push({ type: 'sit', who: c.id });
                startDlg(G, c.talk, 'client_talk_done');
            }
            break;
        case 'flip': if (G.pt >= TIMING.flip) { G.phase = 'style'; G.pt = 0; G.events.push({ type: 'style' }); } break;
        case 'leave': if (G.pt >= TIMING.leave) { G.idx++; startClient(G); } break;
        default: break;
    }
}

const BALL_T0 = 0.8;
function ballTick(G) {
    const b = G.ball;
    if (!b || b.done) return;
    for (let i = b.shown; i < 3; i++) {
        if (G.pt >= BALL_T0 + i * TIMING.vision) { b.shown = i + 1; G.events.push({ type: 'vision', i, clouded: G.reading.visions[i].clouded, col: G.reading.visions[i].col }); }
    }
    const tOmen = BALL_T0 + 3 * TIMING.vision + TIMING.omenAt;
    if (!b.omen && G.pt >= tOmen) { b.omen = true; G.events.push({ type: 'omen', theme: G.reading.omen.theme }); }
    if (b.omen && G.pt >= tOmen + 1.0) { b.done = true; G.events.push({ type: 'ballready' }); }
}

// ---------------------------------------------------------------------------------------- knowledge, ranks
export function isKnown(G, kind, id) { return !!G.know[kind][id]; }

function learn(G, items) {
    const fresh = [];
    for (const { kind, id } of items) {
        if (!G.know[kind][id]) { G.know[kind][id] = true; fresh.push({ kind, id }); }
    }
    G.stats.learned += fresh.length;
    if (fresh.length) G.events.push({ type: 'learn', items: fresh });
    return fresh;
}

function addXp(G, n) {
    G.xp += n;
    while (G.rank < RANKS.length - 1 && G.xp >= RANKS[G.rank + 1].xp) {
        const gain = RANKS[G.rank + 1].focus - RANKS[G.rank].focus;
        G.rank++;
        G.focus += Math.max(0, gain);
        if (G.rank === 2) learn(G, THEME_IDS.map((id) => ({ kind: 'omen', id })));
        if (G.rank === 4) learn(G, COLOUR_IDS.map((id) => ({ kind: 'col', id })));
        G.events.push({ type: 'rankup', rank: G.rank });
    }
}

function grantClue(G, id, how) {
    if (G.clues[id]) return false;
    G.clues[id] = true;
    G.clueHow[id] = how;
    G.events.push({ type: 'clue', id });
    return true;
}

// ---------------------------------------------------------------------------------------- commands
export function act(G, cmd) {
    switch (cmd.t) {
        case 'next': return next(G);
        case 'choose': return choose(G, cmd.i);
        case 'gaze':
            if (G.phase !== 'ready') return false;
            G.phase = 'ball'; G.pt = 0; G.ball = { shown: 0, omen: false, done: false };
            G.events.push({ type: 'gaze' });
            return true;
        case 'focus': {
            const v = G.reading?.visions[cmd.i];
            if (!v || !(G.phase === 'ball' || G.phase === 'deal') || !v.clouded || G.focus <= 0) return false;
            if (G.phase === 'ball' && G.ball.shown <= cmd.i) return false;
            v.clouded = false;
            G.focus--;
            G.events.push({ type: 'focus', i: cmd.i });
            return true;
        }
        case 'draw':
            if (G.phase !== 'ball' || !G.ball.done) return false;
            G.phase = 'deal'; G.pt = 0;
            G.events.push({ type: 'deal' });
            return true;
        case 'place': {
            if (G.phase !== 'deal') return false;
            const R = G.reading;
            if (cmd.h < 0 || cmd.h >= R.hand.length || R.placed.includes(cmd.h)) return false;
            let s = cmd.s;
            if (s === undefined || s === null) s = R.placed.indexOf(null);
            if (s < 0 || s > 2) return false;
            if (R.placed[s] !== null) return false;
            R.placed[s] = cmd.h;
            G.events.push({ type: 'place', s, h: cmd.h });
            return true;
        }
        case 'unplace': {
            if (G.phase !== 'deal') return false;
            const R = G.reading;
            if (R.placed[cmd.s] === null || R.placed[cmd.s] === undefined) return false;
            R.placed[cmd.s] = null;
            G.events.push({ type: 'unplace', s: cmd.s });
            return true;
        }
        case 'lay':
            if (G.phase !== 'deal' || G.reading.placed.includes(null)) return false;
            G.phase = 'flip'; G.pt = 0;
            G.events.push({ type: 'lay' });
            return true;
        case 'say':
            if (G.phase !== 'style' || !STYLES.includes(cmd.style)) return false;
            resolve(G, cmd.style);
            return true;
        case 'evening': return evening(G, cmd.id);
        default: return false;
    }
}

// ---------------------------------------------------------------------------------------- resolving a reading
function resolve(G, style) {
    const R = G.reading, c = G.client;
    const sc = scoreReading(R);
    const styleMatch = style === R.likes;
    const fresh = learn(G, lessons(R));
    const res = { ...sc, style, styleMatch, learned: fresh, xp: 0, clue: null, clueMissed: false, aff: 0 };

    res.xp = 8 + sc.stars * 6 + (styleMatch ? 4 : 0) + fresh.length * 3;
    G.stats.readings++;
    G.stats.stars[sc.stars]++;
    G.renown = Math.max(0, G.renown + sc.stars - 1 + (styleMatch ? 1 : 0));

    if (c.clue) {
        if (sc.stars >= 2) { if (grantClue(G, c.clue, 'reading')) res.clue = c.clue; }
        else res.clueMissed = true;
    }
    if (c.aff) {
        res.aff = (sc.stars >= 3 ? 2 : sc.stars >= 2 ? 1 : 0) + (styleMatch ? 1 : 0);
        G.aff[c.aff] += res.aff;
        G.events.push({ type: 'aff', id: c.aff, delta: res.aff });
    }
    R.result = res;
    const lines = [...c.after[sc.stars].map((l) => ({ ...l }))];
    if (!c.grand) {
        if (styleMatch) lines.push(L('c', STYLE_REPLY.match[style], 'h'));
        else if (sc.stars < 3) lines.push(L('c', STYLE_REPLY.miss[style], 'n'));
    }
    if (res.clue && sc.stars === 2) lines.push(L('n', 'The shape of it is clear enough to write in your journal: “' + CLUE_TEXT[res.clue].name + '.”'));
    if (res.clueMissed) lines.push(L('n', 'The picture is too muddy to trust. There may be another way to learn what they know.'));

    const before = G.rank;
    addXp(G, res.xp);
    res.rankUp = G.rank > before;
    G.phase = 'react';
    G.events.push({ type: 'result', stars: sc.stars, total: sc.total });
    startDlg(G, lines, 'react_done');
}

function grandDone(G) {
    G.grandStars = G.reading.result.stars;
    const score = clueCount(G) + G.grandStars;
    const e = endingFor(score);
    G.plot = { score, id: e.id, title: e.title };
    G.phase = 'plot';
    G.reading = null; G.client = null; G.ball = null;
    G.events.push({ type: 'plot', id: e.id });
    startDlg(G, e.text.map((t) => L('n', t)), 'plot_done');
}

// ---------------------------------------------------------------------------------------- evenings
function toDusk(G) {
    G.phase = 'dusk';
    G.reading = null; G.client = null; G.ball = null;
    G.evening = eveningOptions(G);
    G.events.push({ type: 'dusk' });
}

export function eveningOptions(G) {
    const o = [];
    for (const id of CAND_IDS) if (G.met[id]) o.push({ id, kind: 'cand', stage: G.stage[id], aff: G.aff[id] });
    o.push({ id: 'study', kind: 'study' });
    return o;
}

function evening(G, id) {
    if (G.phase === 'festival') return festival(G, id);
    if (G.phase !== 'dusk') return false;
    if (!G.evening.some((o) => o.id === id)) return false;
    G.evening = null;
    G.phase = 'scene';
    G.pt = 0;
    G.events.push({ type: 'evening', id });
    if (id === 'study') {
        const items = pickUnknown(G, 3);
        const fresh = learn(G, items);
        G.stats.studied++;
        addXp(G, 15);
        const names = fresh.map((f) => labelOf(f)).join(', ');
        startDlg(G, [
            L('n', 'You spend the evening with Madame Orla’s journal, the candle at your elbow, turning the pages until the margin notes begin to make sense.'),
            L('n', fresh.length ? 'By the time the candle drowns, you understand a little more: ' + names + '.' : 'You know every page by heart now, and still it hums.'),
        ], 'study_done');
        return true;
    }
    const k = G.stage[id];
    if (k >= SCENES[id].length) {
        G.aff[id] = Math.min(20, G.aff[id] + 1);
        G.events.push({ type: 'aff', id, delta: 1 });
        startDlg(G, QUIET[id], 'cand_done', { kind: 'quiet', id });
        return true;
    }
    const sc = SCENES[id][k];
    startDlg(G, sc.lines, 'cand_done', { kind: 'cand', id, clue: sc.clue || null, end: sc.end }, sc.choices);
    return true;
}

function pickUnknown(G, n) {
    const pool = [];
    for (const s of SYMBOL_IDS) if (!G.know.sym[s]) pool.push({ kind: 'sym', id: s });
    for (const c of COLOUR_IDS) if (!G.know.col[c]) pool.push({ kind: 'col', id: c });
    for (const o of THEME_IDS) if (!G.know.omen[o]) pool.push({ kind: 'omen', id: o });
    const out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(G.rng() * pool.length), 1)[0]);
    return out;
}
export function labelOf(f) {
    return f.kind === 'sym' ? 'the ' + SYMBOLS[f.id].name : f.kind === 'col' ? COLOURS[f.id].name : OMENS[f.id].name;
}

function afterEvening(G) {
    if ([2, 4, 6].includes(G.day)) {
        const p = PRINCE['n' + G.day];
        G.phase = 'scene';
        G.events.push({ type: 'prince', day: G.day });
        startDlg(G, p.lines, 'prince_done', { kind: 'prince', end: p.end }, p.choices);
    } else nextDay(G);
}

// ---------------------------------------------------------------------------------------- the festival and the end
function openFestival(G) {
    G.phase = 'festival';
    G.evening = [...CAND_IDS.filter((id) => G.met[id]).map((id) => ({ id, kind: 'cand', stage: G.stage[id], aff: G.aff[id] })), { id: 'alone', kind: 'alone' }];
    G.events.push({ type: 'festival' });
}

export function tierOf(aff) { return aff >= ROMANCE_LOVE ? 'love' : aff >= ROMANCE_MIN ? 'sweet' : 'friend'; }

function festival(G, id) {
    if (!G.evening.some((o) => o.id === id)) return false;
    G.evening = null;
    G.phase = 'finale';
    if (id === 'alone') {
        G.romance = { pick: null, tier: 'alone' };
        startDlg(G, FESTIVAL_NONE, 'finale_done');
    } else {
        const tier = tierOf(G.aff[id]);
        G.romance = { pick: id, tier };
        startDlg(G, FINALE[id][tier], 'finale_done');
    }
    G.events.push({ type: 'finale', id });
    return true;
}

function finish(G) {
    G.phase = 'ending';
    const e = endingFor(G.plot.score);
    G.ending = {
        id: e.id, title: e.title, text: e.text, score: G.plot.score, clues: clueCount(G), grand: G.grandStars,
        rank: G.rank, renown: G.renown, romance: G.romance, aff: { ...G.aff }, trust: G.trust, stars: [...G.stats.stars],
    };
    G.events.push({ type: 'end', id: e.id });
}

// ---------------------------------------------------------------------------------------- save
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
