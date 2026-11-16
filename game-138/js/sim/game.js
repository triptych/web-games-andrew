// The game state. Pure: no DOM, no rendering library, no Math.random, no clock.
//
// G holds the dungeon's params (everything a share link encodes), the dungeon built from them (G.d, never saved:
// generate() rebuilds it exactly), and the first-person explorer: level, position, look, what has been found.
// The builder changes params through rebuild(); the walker moves through step().

import { generate } from './dungeon.js';
import { normalize } from './share.js';
import { stepWalker, placeAt } from './walker.js';
import { ELEMENTS } from './data/elements.js';

export function newGame(params) {
    const G = {
        v: 1,
        params: normalize(params),
        d: null,
        lv: 0, x: 0, z: 0, yaw: 0, pitch: 0,
        found: {}, gold: 0, friends: 0, visited: [], dist: 0, stepAcc: 0, wet: false, stairCool: 0,
        t: 0,
        events: [],                 // { type, ... } since the last drain; never saved
    };
    G.d = generate(G.params);
    placeAt(G, 0, 'up');
    return G;
}

/** The builder changed something: rebuild the dungeon and send the explorer back to the entrance. */
export function rebuild(G, params) {
    G.params = normalize(params);
    G.d = generate(G.params);
    G.found = {}; G.gold = 0; G.friends = 0; G.visited = []; G.dist = 0;
    placeAt(G, 0, 'up');
    G.events.push({ type: 'rebuilt' });
}

/** Totals over the whole dungeon, for the HUD ("3 of 9 friends"). */
export function totals(G) {
    let friends = 0, hoards = 0, gold = 0;
    for (const L of G.d.levels) {
        for (const f of L.features) {
            if (!f.block) continue;
            const e = ELEMENTS[f.kind];
            if (e?.cat === 'monsters') friends++;
            else if (e?.cat === 'hoards') { hoards++; gold += e.value; }
        }
    }
    return { friends, hoards, gold };
}

/** Advance one fixed step of the first-person walk. inp = { fx, sx, yaw, pitch, run }. */
export function step(G, inp, dt) {
    G.t += dt;
    stepWalker(G, inp, dt);
}

export function serialize(G) {
    const { d, events, ...rest } = G;
    return JSON.parse(JSON.stringify(rest));
}

export function deserialize(s) {
    if (!s || s.v !== 1) throw new Error('unknown save version');
    const G = { ...JSON.parse(JSON.stringify(s)), events: [] };
    G.params = normalize(G.params);
    G.d = generate(G.params);
    if (!G.d.levels[G.lv]) placeAt(G, 0, 'up');
    return G;
}
