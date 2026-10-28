// The shop: the campaign's days, customers, dialogue, pay and upgrades. Pure, like the rest of js/sim.
// Phases: title, dialogue, shop, brief, bench, result, endday, credits, freeover.

import { TUNE, UPGRADES } from '../config.js';
import { makeRng } from '../rng.js';
import { generateDevice } from './device.js';
import { KINDS, kindsForTier } from './kinds.js';
import { newJob } from './job.js';
import { CLUES, DAYS, SCENES, THANKS, THREE_STAR_TIPS, WALKINS } from './story.js';

export function newStory(free = false) {
    return { free, day: 0, queue: [], idx: 0, credits: 0, stars: 0, jobs: 0, freed: 0, flags: {}, clues: [], upgrades: {}, today: null, tips: {}, results: [] };
}

const ev = (G, e) => G.events.push(e);

// ------------------------------------------------------------------ dialogue
function cond(G, term) {
    const s = G.story;
    const neg = term.startsWith('!');
    const t = neg ? term.slice(1) : term;
    let v = false;
    if (t === 'job.govPulled') v = !!(G.last && G.last.govPulled);
    else if (t.startsWith('found:')) v = !!(G.last && G.last.found.includes(t.slice(6)));
    else if (t.startsWith('flag:')) v = !!s.flags[t.slice(5)];
    else if (t.startsWith('freed>=')) v = s.freed >= +t.slice(7);
    else if (t.startsWith('freed<')) v = s.freed < +t.slice(6);
    return neg ? !v : v;
}
const visible = (G, line) => !line.when || line.when.split('&&').every((t) => cond(G, t.trim()));

export function showScene(G, id, over = {}) {
    const sc = SCENES[id];
    showLines(G, sc.lines, over.then || sc.then, id);
}
export function showLines(G, lines, then, id = null) {
    G.dlg = { id, lines: lines.map((l) => ({ ...l })), i: -1, then };
    G.phase = 'dialogue';
    advance(G);
}

function grantClue(G, id) {
    const s = G.story;
    if (!s || s.clues.includes(id) || !CLUES[id]) return;
    s.clues.push(id);
    ev(G, { type: 'clue', id });
}

function enterLine(G, line) {
    if (line.clue) grantClue(G, line.clue);
    if (line.flag) G.story.flags[line.flag] = true;
    if (line.credits) { G.story.credits = Math.max(0, G.story.credits + line.credits); ev(G, { type: 'credits', n: line.credits }); }
    ev(G, { type: 'line', w: line.w });
}

function advance(G) {
    const d = G.dlg;
    d.i++;
    while (d.i < d.lines.length && !visible(G, d.lines[d.i])) d.i++;
    if (d.i >= d.lines.length) return finishDialogue(G);
    enterLine(G, d.lines[d.i]);
}

function finishDialogue(G) {
    const then = G.dlg.then;
    G.dlg = null;
    route(G, then);
}

function route(G, then) {
    if (then === 'shop') { G.phase = 'shop'; return; }
    if (then === 'brief') { G.phase = 'brief'; return; }
    if (then === 'endday') return endDay(G);
    if (then === 'credits') { G.phase = 'credits'; ev(G, { type: 'ending' }); return; }
    if (then === 'ending') { G.phase = 'credits'; return; }
    if (then.startsWith('day:')) return beginDay(G, +then.slice(4));
    if (then.startsWith('scene:')) return showScene(G, then.slice(6));
    G.phase = 'shop';
}

// ------------------------------------------------------------------ campaign
export function startCampaign(G, seed) {
    G.seed = seed;
    G.story = newStory(false);
    G.job = null; G.pending = null; G.last = null;
    showScene(G, 'intro');
}

function prepare(G, spec, day, i) {
    const seed = ((G.seed * 31 + day * 1009 + i * 131) >>> 0) % 1000003 + 1;
    const rng = makeRng(seed);
    const out = { ...spec, seed, tier: spec.tier };
    if (spec.walk) {
        const kinds = kindsForTier(spec.tier);
        out.kind = kinds[Math.floor(rng() * kinds.length)];
        out.who = 'walk';
        out.walkin = WALKINS[Math.floor(rng() * WALKINS.length)];
        out.pay = 1;
    }
    return out;
}

export function beginDay(G, n) {
    const s = G.story;
    const day = DAYS[n - 1];
    s.day = n; s.idx = 0; s.today = { jobs: 0, earned: 0, stars: 0 };
    s.queue = day.jobs.map((j, i) => prepare(G, j, n, i));
    G.pending = null;
    ev(G, { type: 'day', n });
    showScene(G, day.open);
}

function walkLines(G, spec, dev) {
    const w = spec.walkin;
    const rng = makeRng(spec.seed + 7);
    const k = KINDS[spec.kind];
    const mk = (t, who = 'walk') => ({ w: who, t, name: w.name, role: w.role, look: w.look });
    const lines = [mk(w.greet[Math.floor(rng() * w.greet.length)])];
    lines.push(mk(`I have a ${k.name.toLowerCase()} for you: ${k.blurb}. ${dev.complaint}`));
    lines.push({ w: 'you', t: 'Leave it with me.' });
    return lines;
}

/** The next customer comes in: make their job now so the brief can describe it. */
function callNext(G) {
    const s = G.story;
    const spec = s.queue[s.idx];
    const dev = generateDevice(spec.seed, spec.kind, spec.tier, { faults: spec.faults, stash: spec.stash, gov: spec.gov });
    G.pending = { spec, dev };
    if (spec.walk) showLines(G, walkLines(G, spec, dev), 'brief');
    else showScene(G, spec.pre);
}

function acceptJob(G) {
    const { spec, dev } = G.pending;
    const free = G.story.free;
    const k = KINDS[spec.kind];
    const base = Math.round(TUNE.pay[spec.tier] * (spec.pay || 1));
    newJob(G, dev, { name: k.name, customer: spec.walkin ? spec.walkin.name : spec.who, base, story: spec.id || null, free });
    G.job.spec = { id: spec.id || null, who: spec.who, walk: !!spec.walk, tier: spec.tier, kind: spec.kind, post: spec.post || null, walkin: spec.walkin || null, seed: spec.seed };
    G.pending = null;
    G.phase = 'bench';
}

/** Called once a bench job has passed its test. */
export function jobPassed(G) {
    const J = G.job;
    G.phase = 'result';
    ev(G, { type: 'result', stars: J.result.stars });
}

function collect(G) {
    const s = G.story, J = G.job, R = J.result;
    const found = J.dev.stash.filter((t) => t.taken).map((t) => t.clue);
    const tip = R.stars === 3 ? 10 : 0;
    const bonus = found.length * 10;
    const total = R.net + tip + bonus;
    s.credits += total;
    s.stars += R.stars; s.jobs++; s.results.push(R.stars);
    if (R.govPulled) s.freed++;
    if (s.today) { s.today.jobs++; s.today.earned += total; s.today.stars += R.stars; }
    G.last = { govPulled: R.govPulled, stars: R.stars, found, total };
    ev(G, { type: 'paid', total });
    const spec = J.spec;
    G.job = null;
    if (s.free) { G.phase = 'freeover'; return; }
    s.idx++;
    if (spec.walk) {
        const rng = makeRng(spec.seed + 99);
        const lines = [{ w: 'walk', t: THANKS[Math.floor(rng() * THANKS.length)], name: spec.walkin.name, role: spec.walkin.role, look: spec.walkin.look }];
        if (R.stars === 3) lines.push({ w: 'walk', t: THREE_STAR_TIPS[Math.floor(rng() * THREE_STAR_TIPS.length)], name: spec.walkin.name, role: spec.walkin.role, look: spec.walkin.look });
        showLines(G, lines, 'shop');
    } else showScene(G, spec.post);
}

function endDay(G) {
    G.phase = 'endday';
    ev(G, { type: 'endday' });
}

// ------------------------------------------------------------------ free bench
export function startFree(G, { kind, tier, seed }) {
    G.seed = seed;
    G.story = newStory(true);
    G.last = null;
    const dev = generateDevice(seed, kind, tier, {});
    G.pending = { spec: { kind, tier, seed, who: 'walk', pay: 1, walk: true, walkin: { name: 'Free bench', role: 'practice', look: 'walk', greet: [''] } }, dev };
    acceptJob(G);
}

// ------------------------------------------------------------------ commands
export function shopAct(G, c) {
    const s = G.story;
    switch (c.t) {
        case 'next':
            if (G.phase !== 'dialogue') return false;
            if (G.dlg.lines[G.dlg.i].ask) return false;
            advance(G); return true;
        case 'choose': {
            if (G.phase !== 'dialogue') return false;
            const line = G.dlg.lines[G.dlg.i];
            const ch = line.ask && line.ask[c.i];
            if (!ch) return false;
            if (ch.flag) s.flags[ch.flag] = true;
            if (ch.next) showScene(G, ch.next); else advance(G);
            return true;
        }
        case 'call':
            if (G.phase !== 'shop' || s.idx >= s.queue.length) return false;
            callNext(G); return true;
        case 'close': {
            if (G.phase !== 'shop' || s.idx < s.queue.length) return false;
            const day = DAYS[s.day - 1];
            if (day.close) showScene(G, day.close); else endDay(G);
            return true;
        }
        case 'accept':
            if (G.phase !== 'brief' || !G.pending) return false;
            acceptJob(G); return true;
        case 'collect':
            if (G.phase !== 'result') return false;
            collect(G); return true;
        case 'buy': {
            if (G.phase !== 'endday' && G.phase !== 'shop') return false;
            const u = UPGRADES.find((x) => x.id === c.id);
            if (!u || s.upgrades[u.id] || s.credits < u.cost) return false;
            s.credits -= u.cost; s.upgrades[u.id] = true;
            ev(G, { type: 'buy', id: u.id });
            return true;
        }
        case 'nextday':
            if (G.phase !== 'endday') return false;
            beginDay(G, s.day + 1); return true;
        default: return false;
    }
}
