// An auto-player. It plays through the same commands the player uses, so the tests, the balance
// table and the attract-mode demo all exercise the real rules. Pure, like the rest of js/sim.
//
// skill 1 plays like a quick, sensible human: every `rt` seconds it looks at the settled tokens,
// weighs each legal swap (bigger shapes and specials first) and makes the best, sometimes the
// second best. Lower skill reacts slower, picks at random more often and now and then swipes a
// swap that does nothing.

import { W, H } from '../config.js';
import { makeRng } from '../rng.js';
import { findMoves, previewSwap, DIRS } from './game.js';

export function makeBot({ skill = 1, seed = 7, rt } = {}) {
    return {
        skill,
        rng: makeRng(seed),
        rt: rt ?? (0.42 + (1 - skill) * 1.1),     // seconds between decisions
        wait: 0.3,
    };
}

const SPECIAL_VALUE = { beam: 6, bomb: 8, mirror: 12, combo: 14 };

function value(G, m) {
    const r2 = m.r + (m.dir === DIRS.DOWN ? 1 : 0), c2 = m.c + (m.dir === DIRS.RIGHT ? 1 : 0);
    const p = previewSwap(G, m.r, m.c, r2, c2);
    if (!p) return 0;
    let v = p.n + (p.special ? SPECIAL_VALUE[p.special] || 0 : 0);
    // a move low on the board shakes less of it loose: slightly steadier, slightly less lucky
    v += (m.r / H) * 0.4;
    return v;
}

/** The commands the bot gives this step, or null. Call once per step with the step's dt. */
export function botInput(G, bot, dt) {
    bot.wait -= dt;
    if (bot.wait > 0 || G.state !== 'play') return null;
    const moves = findMoves(G);
    if (!moves.length) { bot.wait = 0.1; return null; }
    bot.wait = bot.rt * (0.7 + bot.rng() * 0.6);
    // a slip: swipe something that does nothing
    if (bot.skill < 1 && bot.rng() < (1 - bot.skill) * 0.25) {
        const r = Math.floor(bot.rng() * H), c = Math.floor(bot.rng() * (W - 1));
        return { cmds: [{ t: 'swap', r, c, d: DIRS.RIGHT }] };
    }
    const scored = moves.map((m) => ({ m, v: value(G, m) })).sort((a, b) => b.v - a.v);
    let pick = scored[0];
    if (bot.rng() > 0.55 + bot.skill * 0.4) pick = scored[Math.floor(bot.rng() * scored.length)];
    else if (scored.length > 1 && bot.rng() < 0.2) pick = scored[1];
    return { cmds: [{ t: 'swap', r: pick.m.r, c: pick.m.c, d: pick.m.dir }] };
}
