// An auto-player. It plays through the same input the player uses ({ dx, aim, drop }), so the
// tests, the balance table and the title-screen demo all exercise the real rules. Pure, like
// the rest of js/sim.
//
// For each drop it tries a row of positions and scores where the treat would land: on top of
// its twin is best, next to one is good, low is better than high, and burying a small treat
// under a big one is bad. A lower skill sometimes drops somewhere random instead.

import { JAR, ITEMS } from '../config.js';
import { makeRng } from '../rng.js';
import { landing, bodyRadius } from './game.js';

export function makeBot({ skill = 1, seed = 7, think = 0 } = {}) {
    return { skill, rng: makeRng(seed), think, wait: 0, target: null };
}

export function botInput(G, bot, dt = 1 / 120) {
    const d = G.dropper;
    if (d.cool > 0 || d.pending) { bot.target = null; return { dx: 0, aim: null, drop: false }; }
    if (bot.target === null) {
        bot.target = choose(G, bot);
        bot.wait = bot.think;
    }
    // with thinking time (the demo), glide over to the spot, then drop
    if (bot.wait > 0) {
        bot.wait -= dt;
        const step = Math.sign(bot.target - d.x) * Math.min(Math.abs(bot.target - d.x), 7 * dt);
        return { dx: 0, aim: d.x + step, drop: false };
    }
    const aim = bot.target;
    return { dx: 0, aim, drop: true };
}

function choose(G, bot) {
    const tier = G.dropper.tier, r = ITEMS[tier].r;
    if (bot.rng() > bot.skill) return bot.rng.range(r, JAR.w - r);
    const N = 29;
    let best = JAR.w / 2, bestScore = -Infinity;
    for (let i = 0; i < N; i++) {
        const x = r + ((JAR.w - 2 * r) * i) / (N - 1);
        const s = score(G, tier, x, r) + bot.rng() * 0.01;
        if (s > bestScore) { bestScore = s; best = x; }
    }
    return best;
}

function score(G, tier, x, r) {
    const { y, hit } = landing(G, x, r);
    let s = -(JAR.h - y) * 2;                         // lower is better
    if (y - r < JAR.line) s -= 400;                   // never over the line on purpose
    if (hit) {
        if (hit.tier === tier) s += 100 + tier * 12;
        else if (hit.tier < tier) s -= (tier - hit.tier) * 9;
        else s -= (hit.tier - tier) * 1.5;
    }
    // a twin it would roll against
    for (const b of G.bodies) {
        if (b === hit || b.tier !== tier) continue;
        const gap = Math.hypot(b.x - x, b.y - y) - r - bodyRadius(b);
        if (gap < 0.6) s += 40 - gap * 30;
    }
    return s;
}
