// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the UI, the bot and the tests all drive act() directly.
//
// It is turn-based, so input is a command, not a stick: act(G, cmd) validates, resolves the whole
// command at once and pushes events. step(G, inp, dt) only keeps time.
//
//   battle: { t: 'play', id }  { t: 'draw' }  { t: 'end' }  { t: 'gadget', i, target }
//   map:    { t: 'go', id }
//   panels: { t: 'take', what: 'card' | 'gadget' | 'relic', i, slot }  { t: 'buy', what, i, slot }
//           { t: 'rest', what: 'heal' | 'upgrade' }  { t: 'choose', i }  { t: 'pick', uid }  { t: 'done' }
//
// G.phase: intro | map | battle | reward | shop | rest | event | over.  G.pick: a pending deck pick.

import { START } from '../config.js';
import { makeRng } from '../rng.js';
import { START_DECK, START_GADGETS } from './data.js';
import { drawCard, endTurn, playCard, useGadget } from './battle.js';
import { battleWon, buy, choose, done, gameOver, makeMap, pick, rest, take, travel } from './run.js';

export function newGame(seed = 1) {
    const G = {
        v: 1,
        seed,
        rng: makeRng(seed),
        t: 0,
        hp: START.hp, maxHp: START.hp, bucks: START.bucks,
        deck: [], nextUid: 1,
        gadgets: START_GADGETS.slice(),
        relics: ['rabbit_foot'],
        act: 0, map: null, pos: null, trail: [],
        phase: 'intro', offer: null, pick: null, battle: null,
        removePrice: 50, lastFoe: null, seenEvents: [],
        over: false, won: false,
        stats: { dmg: 0, taken: 0, played: 0, draws: 0, gadgets: 0, bestChain: 0, sweeps: 0, fights: 0, elites: 0, bosses: 0, floors: 0 },
        events: [],                 // { type, ... } since the last drain; never saved
    };
    for (const c of START_DECK) G.deck.push({ uid: G.nextUid++, up: false, ...c });
    G.map = makeMap(G);
    return G;
}

/** Do one command. Returns false (and changes nothing) when it isn't legal right now. */
export function act(G, cmd) {
    if (!cmd || G.over) return false;
    let ok = false;
    if (G.pick) ok = cmd.t === 'pick' && pick(G, cmd.uid);
    else switch (cmd.t) {
        case 'play': ok = G.phase === 'battle' && playCard(G, cmd.id); break;
        case 'draw': ok = G.phase === 'battle' && drawCard(G); break;
        case 'end': ok = G.phase === 'battle' && endTurn(G); break;
        case 'gadget': ok = G.phase === 'battle' && useGadget(G, cmd.i, cmd.target); break;
        case 'go': ok = travel(G, cmd.id); break;
        case 'take': ok = take(G, cmd); break;
        case 'buy': ok = buy(G, cmd); break;
        case 'rest': ok = rest(G, cmd); break;
        case 'choose': ok = choose(G, cmd.i); break;
        case 'done': ok = done(G); break;
    }
    if (ok && G.phase === 'battle' && G.battle?.done) {
        if (G.battle.won) battleWon(G);
        else gameOver(G);
    }
    return ok;
}

/** Time only: the game waits for commands. */
export function step(G, inp, dt) { G.t += dt; }

export function score(G) {
    const s = G.stats;
    return s.floors * 10 + s.elites * 30 + s.bosses * 150 + s.bestChain * 5 + s.sweeps * 15 + (G.won ? 500 + G.hp * 5 : 0);
}

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1 || !Array.isArray(d.deck) || !d.map || !Array.isArray(d.trail)) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
