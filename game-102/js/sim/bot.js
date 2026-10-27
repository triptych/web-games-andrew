// An auto-player. It plays through the same input the player uses, so the tests, the balance
// table and an attract-mode demo all exercise the real rules. Pure, like the rest of js/sim.
//
// skill 1: finds the shots that pass close to a robot, then plays each one out on a copy of the
//          game and fires the best.
// skill < 1: picks one of the closest-passing shots at random and wobbles the aim.

import { SLING, STEP } from '../config.js';
import { makeRng } from '../rng.js';
import { step, predict, serialize, deserialize } from './game.js';

export function makeBot({ skill = 1, seed = 1 } = {}) {
    return { skill, rng: makeRng(seed), plan: null };
}

/** Every angle/power on a grid whose free flight comes near a robot, closest first. */
function candidates(G) {
    const robots = G.bodies.filter((b) => b.mat === 'robot');
    if (!robots.length) return [];
    const out = [];
    for (let a = 0.12; a <= 1.35; a += 0.04) {
        for (let p = 0.4; p <= 1.0001; p += 0.05) {
            const path = predict(G, a, p, 3.6, 0.04);
            let best = Infinity, bx = 0;
            for (const pt of path) {
                if (pt.x < SLING.x + 4) continue;
                for (const r of robots) {
                    const d = Math.hypot(pt.x - r.x, pt.y - r.y);
                    if (d < best) { best = d; bx = pt.x; }
                }
            }
            if (best < Infinity) out.push({ angle: a, power: p, d: best, tapX: null, nearX: bx });
        }
    }
    return out.sort((u, v) => u.d - v.d);
}

/** The best few that are not near-duplicates of each other. */
function spread(list, n) {
    const picked = [];
    for (const c of list) {
        if (picked.every((q) => Math.abs(q.angle - c.angle) > 0.07 || Math.abs(q.power - c.power) > 0.14)) picked.push(c);
        if (picked.length >= n) break;
    }
    return picked;
}

/** Play a plan out on a copy; higher is better. */
function rollout(G, plan) {
    const g = deserialize(serialize(G));
    const bot = { plan, rng: null };
    const robots0 = g.robots, score0 = g.score;
    for (let t = 0; t < 14 && !g.over; t += STEP) {
        const inp = flightInput(g, bot) || { aim: plan.aim ?? { angle: plan.angle, power: plan.power }, fire: g.state === 'ready' && t === 0 };
        step(g, inp, STEP);
        g.events.length = 0;
        if (t > STEP && g.state === 'ready') break;
    }
    return (g.score - score0) + 400 * (robots0 - g.robots) + (g.won ? 2000 : 0);
}

function flightInput(G, bot) {
    if (G.state !== 'flight') return null;
    const p = bot.plan;
    const b = G.bodies.find((o) => o.id === G.proj);
    if (p && p.tapX != null && b && b.tag === 'proj' && !b.spent && b.x >= p.tapX) return { act: true };
    return {};
}

function decide(G, bot) {
    const cands = candidates(G);
    if (!cands.length) return { angle: G.aim.angle, power: G.aim.power, tapX: null };
    if (bot.skill < 1) {
        const top = cands.slice(0, 8);
        const c = top[Math.floor(bot.rng() * top.length)];
        const wob = (1 - bot.skill) * 0.12;
        return { angle: c.angle + bot.rng.range(-wob, wob), power: Math.min(1, c.power + bot.rng.range(-wob, wob)), tapX: null };
    }
    let best = null, bestScore = -Infinity;
    for (const c of spread(cands, 9)) {
        for (const tapX of [null, c.nearX - 4, c.nearX - 1.5]) {
            const plan = { angle: c.angle, power: c.power, tapX };
            const s = rollout(G, plan);
            if (s > bestScore) { bestScore = s; best = plan; }
        }
    }
    return best;
}

export function botInput(G, bot) {
    if (G.state === 'ready' && G.ammo.length) {
        bot.plan ||= decide(G, bot);
        return { aim: { angle: bot.plan.angle, power: bot.plan.power }, fire: true };
    }
    if (G.state === 'flight') return flightInput(G, bot) || {};
    bot.plan = null;
    return {};
}
