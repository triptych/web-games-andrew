// The simulation facade: newGame, act (one command), step (time passing), serialize/deserialize.
// Pure: no DOM, no rendering library, no Math.random, no clock. The view reads G and drains G.events;
// the tests and the bot drive act()/step() directly.

import { STEP, TOOLS } from '../config.js';
import { makeRng } from '../rng.js';
import { jobAct, jobStep } from './job.js';
import { nextGoal } from './plan.js';
import { restY } from './rules.js';
import { jobPassed, shopAct, startCampaign, startFree } from './shop.js';
import { CLUES, TIPS } from './story.js';

export const SAVE_VERSION = 1;

export function newGame(seed = 1) {
    return {
        v: SAVE_VERSION, seed, rng: makeRng(seed), t: 0, phase: 'title',
        story: null, job: null, pending: null, dlg: null, last: null, jobCount: 0,
        tool: 'hand', bit: 'phil', socket: 8, manual: false,
        ptr: { ref: null, bx: 0, bz: 0, ax: 0, az: 0, down: false, travel: 0 },
        tipsSeen: {},
        events: [],                 // { type, ... } since the last drain; never saved
    };
}

/** One command from the player (or the bot, or a test). Returns true when it did something. */
export function act(G, c) {
    switch (c.t) {
        case 'campaign': startCampaign(G, c.seed ?? G.seed); return true;
        case 'free': startFree(G, c); return true;
        case 'title': G.phase = 'title'; G.job = null; G.dlg = null; return true;
        case 'manual': G.manual = !!c.on; return true;
        case 'hint': {
            if (G.phase !== 'bench' || !G.job) return false;
            const g = nextGoal(G, { stash: false });
            return jobAct(G, { t: 'hint', text: g ? g.text : '' });
        }
        default: break;
    }
    if (G.phase === 'bench') {
        const r = jobAct(G, c);
        tips(G);
        return r;
    }
    if (G.phase === 'freeover' && c.t === 'again') { startFree(G, c); return true; }
    return shopAct(G, c);
}

/** Time passing. Only a repair on the bench has anything to simulate. */
export function step(G, inp, dt) {
    G.t += dt;
    if (G.phase === 'bench' && G.job) {
        jobStep(G, dt);
        tips(G);
        if (G.job.stage === 'done' && G.job.result) jobPassed(G);
    }
}

// Tutorial tips: the first time something happens, Spanner says what it was.
const TIP_FOR = {
    job: 'bench', turn: 'screws', lift: 'lift', pick: 'lift', unplug: 'wires', probe_ok: 'probe', probe_bad: 'probe', solder: 'solder',
    scrub: 'brush', drip: 'brush', spare: 'spare', stash: 'stash', gov_pulled: 'gov', seat: 'carry',
};
function tips(G) {
    if (!G.events.length) return;
    const s = G.story;
    for (const e of G.events.slice()) {
        if (e.type === 'stash' && e.clue && s) {
            if (!s.clues.includes(e.clue) && CLUES[e.clue]) { s.clues.push(e.clue); G.events.push({ type: 'clue', id: e.clue }); }
        }
        const id = TIP_FOR[e.type];
        if (id && !G.tipsSeen[id] && (!s || s.day <= 3 || s.free || id === 'gov' || id === 'stash')) {
            G.tipsSeen[id] = true;
            G.events.push({ type: 'tip', id, text: TIPS[id] });
        }
    }
    if (G.job && G.job.stage === 'work' && !G.tipsSeen.test && G.job.dev.slotOrder.every((id) => G.job.dev.slots[id].holes.every((h) => h.prog > 0.999)) && G.job.stats.slips + G.job.stats.taps + G.job.time > 60 && G.events.some((e) => e.type === 'secured')) {
        G.tipsSeen.test = true;
        G.events.push({ type: 'tip', id: 'test', text: TIPS.test });
    }
}

// ------------------------------------------------------------------ saving
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_VERSION) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    if (G.job) {
        const J = G.job;
        J.test = null; if (J.stage === 'testing') J.stage = 'work'; G.ptr.down = false; J.use = null;
        // whatever was in hand when the game was saved is put down on the bench
        if (J.held) {
            const h = J.held; J.held = null;
            if (h.k === 'part') { const p = J.dev.parts[h.id]; p.loc = 'free'; p.pos[1] = 0; }
            else { const e = J.dev.wires[h.w].ends[h.e]; e.pos[1] = restY(J.dev, e.pos[0], e.pos[2]); }
        }
    }
    return G;
}

export { STEP, TOOLS };
