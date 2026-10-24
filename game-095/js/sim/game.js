// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive act() and step() directly.
//
// A point-and-click game has no per-frame input: a tap is an action, applied the moment it
// happens (so none can be lost or merged), and step(G, dt) only moves the clock: the oven,
// the ambient spooks, and how long the player has gone without acting.

import { makeRng } from '../rng.js';
import { makeLayout } from './layout.js';
import { SPOOK, BAKE_SECONDS } from '../config.js';
import { RECIPES } from './data.js';
import {
    HOTSPOTS, say, sayAll, has, give, take, flag, goRoom, nope, hotspotShown, evidenceCount,
    tryCode, playNote, accuse, chooseTalk, partyReady,
} from './world.js';
import { firstPending, hintText } from './plan.js';

const SPOOKS = ['candle', 'breeze', 'giggle', 'sheet', 'creak'];

export function newGame(seed = 1) {
    return {
        v: 1,                       // save format version
        seed,
        layout: makeLayout(seed),
        rng: makeRng(seed),
        t: 0,
        room: 'foyer',
        visited: { foyer: true },
        f: {},                      // flags
        inv: [],
        clues: [],
        books: [],                  // library shelf: books pulled so far
        notes: [],                  // music box: notes played so far
        bake: 0,
        spookT: 18,
        idle: 0,
        talk: null,                 // { node } while Winnie is talking
        ending: null,               // warm | funny | brave
        stats: { spooks: 0, wisps: 0, hints: 0 },
        hintLevel: 0,
        hintStep: '',
        events: [],                 // { type, ... } since the last drain; never saved
    };
}

/** The opening scene. A new game calls it once; a loaded one does not. */
export function intro(G) {
    sayAll(G, [
        ['', 'Halloween night. Four friends, one sleepover, and one very old house on Hollow Hill that nobody has set foot in for a hundred years.'],
        ['Dev', 'Okay, but we were dared to stay until sunrise. Nobody said we had to enjoy it.'],
        ['Theo', 'The front door just shut by itself. That\'s a normal thing doors do. Right? Right?'],
        ['Maya', 'Let\'s look around. Something\'s making those noises, and I want to know what. A raccoon, the pipes, a prankster... or something else.'],
        ['June', 'If it\'s something else, I hope it\'s the friendly kind.'],
        ['', 'Tap things to look at them. To use an item, tap it in your pack and then tap something in the room.'],
    ]);
}

/** One action from the player (or the bot). Ignored while Winnie is talking, except her choices. */
export function act(G, a) {
    if (G.ending) return;
    G.idle = 0;
    if (G.talk) { if (a.type === 'choose') chooseTalk(G, a.i); return; }
    switch (a.type) {
        case 'click': {
            if (!HOTSPOTS[a.id] || !hotspotShown(G, a.id)) return;
            HOTSPOTS[a.id].click(G);
            break;
        }
        case 'use': {
            if (!has(G, a.item) || !HOTSPOTS[a.id] || !hotspotShown(G, a.id)) return;
            const f = HOTSPOTS[a.id].use?.[a.item];
            if (f) f(G); else nope(G, a.item);
            break;
        }
        case 'combine': {
            if (a.a === a.b || !has(G, a.a) || !has(G, a.b)) return;
            const r = RECIPES.find((r) => (r.a === a.a && r.b === a.b) || (r.a === a.b && r.b === a.a));
            if (!r) { nope(G, a.a); return; }
            take(G, r.a); take(G, r.b); give(G, r.out);
            G.events.push({ type: 'combine', out: r.out });
            sayAll(G, r.say);
            break;
        }
        case 'go': goRoom(G, a.room); break;
        case 'code': tryCode(G, a.id, a.digits || []); break;
        case 'note': playNote(G, a.n); break;
        case 'noteReset': G.notes.length = 0; break;
        case 'accuse': accuse(G, a.who); break;
        case 'hint': hint(G); break;
    }
}

/** A nudge that gets more specific each time it is asked for at the same step. */
export function hint(G) {
    const s = firstPending(G);
    if (!s) { say(G, 'Maya', 'I think we have everything. Let\'s go enjoy the party.'); return; }
    G.hintLevel = G.hintStep === s.id ? Math.min(3, G.hintLevel + 1) : 1;
    G.hintStep = s.id;
    G.stats.hints++;
    const room = G.hintLevel >= 2 ? s.room : null;
    const id = G.hintLevel >= 3 ? (typeof s.hs === 'function' ? s.hs(G) : s.hs) : null;
    G.events.push({ type: 'hint', level: G.hintLevel, text: hintText(s, G, G.hintLevel), room, id });
    say(G, 'Maya', hintText(s, G, G.hintLevel));
}

/** Where the plan is pointing right now: used to glint the hotspot when the player has idled. */
export function nudge(G) {
    const s = firstPending(G);
    if (!s) return null;
    return { room: s.room, id: typeof s.hs === 'function' ? s.hs(G) : s.hs };
}

/** Advance the clock by dt: the oven, ambient spooks and the idle timer. */
export function step(G, dt) {
    if (G.ending) return;
    G.t += dt;
    G.idle += dt;
    if (G.f.baking) {
        G.bake -= dt;
        if (G.bake <= 0) {
            G.bake = 0;
            G.f.baking = false;
            flag(G, 'baked');
            G.events.push({ type: 'ding' });
            say(G, 'Theo', G.room === 'kitchen' ? 'Ding! The oven says it\'s done.' : 'Ding! That\'s the oven in the kitchen.');
        }
    }
    G.spookT -= dt;
    if (G.spookT <= 0) {
        G.spookT = G.rng.range(SPOOK.min, SPOOK.max);
        G.stats.spooks++;
        G.events.push({ type: 'spook', kind: G.rng.pick(SPOOKS), room: G.room });
    }
}

/** The one-line goal for the journal and the HUD. */
export function objective(G) {
    if (G.ending) return 'Happy birthday, Winnie!';
    if (!G.f.case_solved) {
        const n = evidenceCount(G);
        return n < 3
            ? `Find out what is haunting Hauntly Manor. Evidence: ${n} of 3.`
            : 'You have enough evidence. Open the journal and name the culprit.';
    }
    const done = ['p_cake', 'p_banner', 'p_music', 'p_invite'].filter((k) => G.f[k]).length;
    return partyReady(G) ? 'The party has begun.' : `Throw Winnie the party she never had: cake, music, decorations and an invitation (${done} of 4 in place).`;
}

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

export { BAKE_SECONDS };
