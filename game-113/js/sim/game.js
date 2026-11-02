// The whole game state and its one step function. Pure: no DOM, no rendering, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() and act() directly.

import { makeRng } from '../rng.js';
import { newParty, useItem, equip } from './party.js';
import { loadMap, stepField } from './field.js';
import { startScene, stepScene, stepTravel, pickNode, warpToCrystal } from './story.js';
import { stepBattle, endBattle, afterDefeat } from './battle.js';

export const SAVE_V = 1;

export function newGame(seed = 1, difficulty = 'normal') {
    const G = {
        v: SAVE_V,
        seed: seed >>> 0,
        rng: makeRng(seed),
        t: 0,
        difficulty,
        mode: 'scene',
        flags: {},
        party: newParty(),
        map: 'hollow',
        p: { x: 11.5, y: 9.5, dir: 'up', walking: false, hidden: true, pose: null },
        actors: {},
        field: { enemies: [], inTrig: [] },
        opened: {},
        scene: null, battle: null, results: null, wm: null, travel: null,
        cam: null, fade: 'in', safeT: 0, pendingPush: null, lastCrystal: null,
        stats: { battles: 0, won: 0, perfects: 0, bestCombo: 0, steps: 0 },
        events: [],
    };
    loadMap(G, 'hollow', 11.5, 9.5);
    G.events.length = 0;
    startScene(G, 'prologue');
    return G;
}

/**
 * Advance one fixed step. inp = { x, y, a, b, lanes: [{lane, t}], held: [×4], cres, pick }.
 * `a` and `pick` are edges: set for the one step that should act on them.
 */
export function step(G, inp, dt) {
    G.t += dt;
    switch (G.mode) {
        case 'scene': stepScene(G, inp, dt); break;
        case 'field': if (inp.cmd) act(G, inp.cmd); stepField(G, inp, dt); break;
        case 'battle': stepBattle(G, inp, dt); break;
        case 'results': if (inp.a) endBattle(G); break;
        case 'defeat':
            if (inp.pick === 'retry' || inp.pick === 'crystal') afterDefeat(G, inp.pick, warpToCrystal);
            break;
        case 'worldmap':
            if (inp.pick) pickNode(G, inp.pick);
            else if (inp.b) { G.mode = 'field'; G.wm = null; }
            break;
        case 'travel': stepTravel(G, dt); break;
        default: break;                 // 'ending': the UI rolls the credits
    }
}

/** Menu commands from the band menu: { t: 'use', item, target } | { t: 'equip', who, charm }. */
export function act(G, cmd) {
    if (G.mode !== 'field') return false;
    if (cmd.t === 'use') return useItem(G, cmd.item, cmd.target);
    if (cmd.t === 'equip') return equip(G, cmd.who, cmd.charm);
    return false;
}

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_V) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    // Infinity does not survive JSON: a talk phrase's open length comes back as null
    const B = G.battle;
    if (B) for (const ph of [B.ph, B.next]) if (ph && ph.len === null) ph.len = Infinity;
    return G;
}
