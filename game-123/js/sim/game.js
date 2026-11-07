// The simulation. Pure: no DOM, no rendering, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.
//
// One season is six commissions. In each, the cartographer's quill flies over a blank sheet: hold to focus,
// release to scry, and the true terrain under the spell is inked onto the parchment, truly or not, depending
// on how steady the cast was. Deliver the chart and the client uses it; evaluate() says what happened.

import { WORLD, SCRY, QUILL, POINTS, RANKS } from '../config.js';
import { makeRng } from '../rng.js';
import { buildWorld } from './world.js';
import { makeSeason, evaluate } from './commission.js';

const W = WORLD.w, H = WORLD.h, N = W * H;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** What the spell mistakes each terrain for when it is rushed. */
const CONFUSE = {
    1: [2, 2, 3], 2: [1, 3, 3], 3: [2, 4, 2], 4: [3, 5, 5], 5: [6, 4, 10, 7], 6: [5, 9, 5, 7],
    7: [5, 8, 6], 8: [7, 7, 6], 9: [6, 12, 5], 10: [5, 4, 7], 11: [5, 5, 12], 12: [11, 5, 9],
};

export function newGame(seed = 1) {
    const world = buildWorld(seed);
    const G = {
        v: 1,
        seed,
        rng: makeRng((seed * 31 + 7) >>> 0),
        world,                                         // derived from the seed; never saved
        t: 0,
        idx: 0,                                        // which commission
        phase: 'work',                                 // work | result | over
        commissions: makeSeason(world, makeRng((seed ^ 0x9e3779b9) >>> 0)),
        ink: [], conf: [], found: [],                  // the sheet: terrain codes, how sure each is, features resolved
        q: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
        channel: null,                                 // { focus } while a spell is being held
        timeLeft: 0,
        result: null,
        results: [],                                   // one per delivered commission
        points: 0,
        casts: 0,
        events: [],                                    // { type, ... } since the last drain; never saved
    };
    setup(G);
    return G;
}

export const current = (G) => G.commissions[G.idx];

/** A fresh sheet of vellum for the next client. */
function setup(G) {
    const c = current(G);
    G.ink = new Array(N).fill(0);
    G.conf = new Array(N).fill(0);
    G.found = [];
    G.channel = null;
    G.result = null;
    G.phase = 'work';
    G.timeLeft = c.time;
    const r = c.region;
    G.q = { x: r.x + r.w / 2, y: r.y + r.h / 2, vx: 0, vy: 0 };
    if (c.start != null) {
        // the client's own starting place is already on the sheet
        const s = G.world.features[c.start];
        G.q.x = s.x + 0.5; G.q.y = s.y + 0.5;
        G.found.push(s.id);
        paint(G, s.x + 0.5, s.y + 0.5, SCRY.preInkR, 1, 0);
    }
}

/** Ink the true terrain (less `errP` of it, wrongly) in a disc. A cell only changes if the new cast is at least as sure as what is there. */
function paint(G, cx, cy, r, focus, errP) {
    const cf = Math.round(focus * 100) + 1;
    let n = 0;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++) {
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
            if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
            const i = y * W + x;
            if (cf < G.conf[i]) continue;
            let t = G.world.terrain[i];
            if (errP > 0 && G.rng() < errP) t = G.rng.pick(CONFUSE[t]);
            G.ink[i] = t; G.conf[i] = cf; n++;
        }
    }
    return n;
}

export const scryRadius = (focus) => SCRY.minR + (SCRY.maxR - SCRY.minR) * focus;
export const scryError = (focus) => SCRY.errMin + SCRY.errMax * Math.pow(1 - focus, 1.5);

function cast(G, focus) {
    const q = G.q, r = scryRadius(focus);
    const cells = paint(G, q.x, q.y, r, focus, scryError(focus));
    if (focus >= SCRY.featureFocus) {
        for (const f of G.world.features) {
            if (G.found.includes(f.id) || Math.hypot(f.x + 0.5 - q.x, f.y + 0.5 - q.y) > r) continue;
            G.found.push(f.id);
            G.events.push({ type: 'found', id: f.id, kind: f.kind, name: f.name, x: f.x, y: f.y });
        }
    }
    G.casts++;
    G.events.push({ type: 'scry', x: q.x, y: q.y, r, focus, cells });
}

/**
 * Advance one fixed step. inp = { x, y, a, r, h, d }: x and y in [-1, 1] (y down); a = scry pressed since the last
 * step, r = released since the last step, h = held now, d = deliver pressed since the last step.
 */
export function step(G, inp, dt) {
    if (G.phase !== 'work') return;
    G.t += dt;
    const q = G.q;
    const mag = Math.min(1, Math.hypot(inp.x, inp.y));

    if (inp.a && !G.channel) { G.channel = { focus: 0 }; G.events.push({ type: 'channel' }); }

    const len = Math.hypot(inp.x, inp.y), k = len > 1 ? 1 / len : 1;       // diagonals are not faster
    const sp = QUILL.speed * (G.channel ? QUILL.channelSpeed : 1);
    q.vx = inp.x * k * sp; q.vy = inp.y * k * sp;
    q.x = clamp(q.x + q.vx * dt, 0.5, W - 0.5);
    q.y = clamp(q.y + q.vy * dt, 0.5, H - 0.5);

    const ch = G.channel;
    if (ch) {
        if (mag <= SCRY.still) ch.focus = Math.min(1, ch.focus + dt / SCRY.focusTime);
        else ch.focus = Math.max(0, ch.focus - SCRY.bleed * mag * dt);
        if (!inp.h || inp.r) { cast(G, ch.focus); G.channel = null; }
    }

    G.timeLeft -= dt;
    if (inp.d || G.timeLeft <= 0) {
        G.timeLeft = Math.max(0, G.timeLeft);
        deliver(G);
    }
}

/** Hand the chart over. The client uses it and the outcome is on G.result. */
export function deliver(G) {
    if (G.phase !== 'work') return;
    const c = current(G);
    G.channel = null;
    const res = evaluate(G, c);
    res.timeLeft = Math.floor(G.timeLeft);
    res.points = res.stars ? res.stars * POINTS.star + res.timeLeft * POINTS.perSecond : 0;
    G.result = res;
    G.results.push({ id: c.id, stars: res.stars, points: res.points, pct: res.pct, outcome: res.outcome, left: res.timeLeft });
    G.points += res.points;
    G.phase = 'result';
    G.events.push({ type: 'deliver' }, { type: 'result', stars: res.stars, outcome: res.outcome });
}

export const totalStars = (G) => G.results.reduce((a, r) => a + r.stars, 0);
export const rankFor = (stars) => RANKS.find((r) => stars >= r.min).name;

/** Move on from a result: the next client, or the end of the season. */
export function next(G) {
    if (G.phase !== 'result') return;
    if (G.idx + 1 >= G.commissions.length) {
        G.phase = 'over';
        G.events.push({ type: 'over', points: G.points, stars: totalStars(G), rank: rankFor(totalStars(G)) });
        return;
    }
    G.idx++;
    setup(G);
    G.events.push({ type: 'commission', id: current(G).id });
}

export function serialize(G) {
    const { rng, events, world, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1 || !Array.isArray(d.ink) || d.ink.length !== N || !Array.isArray(d.commissions) || !d.commissions[d.idx]) {
        throw new Error('unknown save version');
    }
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.world = buildWorld(G.seed);
    G.rng.setState(rngState);
    return G;
}
