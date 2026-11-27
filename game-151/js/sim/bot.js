// An auto-player. It plays through the same commands the player's taps send, so the tests, the balance table and
// the attract demo all exercise the real rules. Pure, like the rest of js/sim.
//
// skill 1: thinks for 0.45 s a move, always takes the swap that charges what the mothership needs most, and holds
//          the Lance until every ratio is past 2× (an S) or the clock runs out.
// lower:   slower, and picks a random legal swap some of the time.

import { makeRng } from '../rng.js';
import { BOSSES } from './data.js';
import { KINDS, ELEMENTS, CHARGE, UPGRADES } from '../config.js';
import { evaluate, suggestRoute, upgradeCost, shieldCap, ROUTES } from './game.js';
import { listMoves, swapGain } from './board.js';

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rng: makeRng(seed), wait: 0.6 };
}

/** Per-tile weights: how much a tile of each kind is worth to this shot right now. */
export function needWeights(G) {
    const m = G.m, boss = BOSSES[m.level];
    const { ratios } = evaluate(G);
    const goal = 2.1;
    const def = (r) => Math.max(0.03, goal - r);
    const w = {
        power: def(ratios.armor) / boss.req.armor,
        speed: def(ratios.speed) / boss.req.speed,
        shield: 0,
    };
    for (const e of ELEMENTS) w[e] = (def(ratios.barrier) * Math.max(0, 1 - m.resist[e])) / boss.req.barrier;
    if (m.phase === 'round') {
        const aiming = m.drones.filter((d) => d.st === 'aim').length;
        const threat = aiming + 0.3 * m.drones.length;
        w.shield = threat * (1 - m.shield / shieldCap(G)) * 0.006;
    }
    return w;
}

function pickMove(G, bot) {
    const cells = G.m.board.cells;
    const moves = listMoves(cells);
    if (!moves.length) return null;
    if (bot.rng() > bot.skill * 0.9 + 0.1 * (bot.skill >= 1)) return moves[Math.floor(bot.rng() * moves.length)];
    const w = needWeights(G);
    let best = null, bs = -Infinity;
    for (const mv of moves) {
        const g = swapGain(cells, mv.a, mv.b);
        let s = 0;
        for (const t of g.cells) s += w[KINDS[t.k]] || 0;
        s *= 1 + 0.35 * (g.longest - 3);
        // a little preference for swaps low on the board, which set up cascades
        s *= 1 + 0.02 * Math.floor(Math.max(mv.a, mv.b) / 7);
        if (s > bs) { bs = s; best = mv; }
    }
    return best;
}

function hangarCmd(G) {
    if (G.ended) return null;
    const level = Math.min(G.unlocked, BOSSES.length - 1);
    const boss = BOSSES[level];
    // the upgrades that matter for the next mothership: power, speed, its best element, and survival
    const bestEl = ELEMENTS.reduce((a, e) => (boss.resist[e] < boss.resist[a] ? e : a), ELEMENTS[0]);
    const wanted = ['capacitor', 'coils', bestEl, 'reactor', 'deflector', 'missiles'];
    let pick = null, pc = Infinity;
    for (const id of wanted) {
        const c = upgradeCost(G, id);
        if (c <= G.scrap && c < pc) { pc = c; pick = id; }
    }
    if (pick) return { t: 'buy', id: pick };
    return { t: 'start', level };
}

/** The next command, or null to wait. Call once per step with that step's dt. */
export function botCmd(G, bot, dt) {
    const m = G.m;
    if (!m) return hangarCmd(G);
    switch (m.phase) {
        case 'brief': return { t: 'launch' };
        case 'clear':
            return { t: 'route', stat: bot.rng() < bot.skill ? suggestRoute(G) : ROUTES[Math.floor(bot.rng() * ROUTES.length)] };
        case 'result': return { t: 'done' };
        case 'beam': return null;
        case 'round':
        case 'lance': {
            if (m.fireQueued || m.board.phase !== 'idle') return null;
            if (m.phase === 'lance') {
                const { min } = evaluate(G);
                if (min >= (bot.skill >= 0.9 ? 2.02 : 1.3) && (!BOSSES[m.level].shift || bestTuning(G))) return { t: 'fire' };
            }
            bot.wait -= dt;
            if (bot.wait > 0) return null;
            bot.wait = 0.45 + (1 - bot.skill) * 1.4;
            const mv = pickMove(G, bot);
            return mv ? { t: 'swap', a: mv.a, b: mv.b } : null;
        }
    }
    return null;
}

/** Is the shifting barrier as soft as it gets for the charge the Lance holds? */
function bestTuning(G) {
    const m = G.m, c = m.charge;
    const set = BOSSES[m.level].shift.set;
    const now = ELEMENTS.reduce((s, e) => s + c[e] * (1 - m.resist[e]), 0);
    let best = -Infinity;
    for (let k = 0; k < set.length; k++) best = Math.max(best, ELEMENTS.reduce((s, e, j) => s + c[e] * (1 - set[(j + k) % set.length]), 0));
    return now >= best - 1e-6;
}

export { UPGRADES, CHARGE };
