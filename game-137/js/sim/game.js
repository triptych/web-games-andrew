// SHARDFRAME — the whole game as data. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the UI, the bot and the tests change it only through
// step() (a sortie in real time) and act() (everything in the hangar).
//
// G.mode: 'hangar' (aboard the Skylark) | 'mission' (a sortie: G.run) | 'debrief' (G.debrief)

import { makeRng } from '../rng.js';
import { newHangar, buy, equip, collect, idle } from './hangar.js';
import { startRun, stepRun, abort, attach } from './run.js';
import { packWorld, unpackWorld } from './world.js';

export const SAVE_V = 2;          // 2: the 152x152 map (v1.2); the world is packed

export function newGame(seed = 1) {
    return {
        v: SAVE_V,
        seed,
        rng: makeRng(hashSeed(seed)),
        mode: 'hangar',
        hangar: newHangar(),
        unlocked: 1,
        cleared: {},
        ended: false,
        run: null,
        debrief: null,
        stats: { sorties: 0, wins: 0, kills: 0 },
        events: [],
    };
}

/** Spread small seeds apart before seeding mulberry32. */
export function hashSeed(s) {
    let h = (s | 0) ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
}

/** Advance real time. inp = { x, y, mag, od, pick }. Only a sortie moves on its own. */
export function step(G, inp, dt) {
    if (G.mode === 'mission' && G.run) stepRun(G, inp, dt);
}

/**
 * Everything that isn't real-time play is a command:
 *   { t: 'buy', part }          buy a part, or its next level
 *   { t: 'equip', slot, part }  fit a part (null empties an arm or the shoulder)
 *   { t: 'collect', crew }      take a crew member's gifts ('all' for everyone's)
 *   { t: 'idle', secs }         real time passed (the crew make gifts)
 *   { t: 'launch', mission }    start a sortie
 *   { t: 'abort' }              give up the sortie
 *   { t: 'done' }               close the debrief
 */
export function act(G, cmd) {
    switch (cmd.t) {
        case 'buy': return G.mode === 'hangar' && buy(G, cmd.part);
        case 'equip': return G.mode === 'hangar' && equip(G, cmd.slot, cmd.part);
        case 'collect': return G.mode !== 'mission' && collect(G, cmd.crew ?? 'all') > 0;
        case 'idle': return idle(G, cmd.secs) > 0;
        case 'launch': return G.mode === 'hangar' && startRun(G, cmd.mission);
        case 'abort': return G.mode === 'mission' && abort(G);
        case 'done':
            if (G.mode !== 'debrief') return false;
            G.mode = 'hangar';
            G.debrief = null;
            return true;
        default: return false;
    }
}

export function serialize(G) {
    const { rng, events, ...rest } = G;
    const run = rest.run ? { ...rest.run, W: packWorld(rest.run.W) } : rest.run;
    return JSON.parse(JSON.stringify({ ...rest, run, rngState: rng.state() }));
}

export function deserialize(d) {
    if (d && d.v === 1) {
        // a v1.1 save: the campaign carries over; a sortie in progress was on the old small map, so
        // the pilot is back aboard the Skylark instead
        d = { ...d, v: SAVE_V };
        if (d.run) d = { ...d, run: null, mode: 'hangar' };
    }
    if (!d || d.v !== SAVE_V) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    if (G.run) { G.run.W = unpackWorld(G.run.W); attach(G, G.run); }
    return G;
}
