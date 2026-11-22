// An auto-player. It plays through the same input the player uses (aim, swap, use, fire), so the tests, the balance
// table and the attract-mode demo all exercise the real rules. Pure, like the rest of js/sim.
//
// For each ornament in the tray (or the loaded power-up) it traces ~100 aims, runs the real landing rules on a copy
// of the board (game.preview) and keeps the best. skill < 1 picks among the top few and wobbles the aim.

import { AIM_MIN, DEAD_Y, ROW_H } from '../config.js';
import { makeRng } from '../rng.js';
import { traceShot, cellY } from './hex.js';
import { preview, group } from './game.js';
import { POWERS } from './data/levels.js';

const N_AIMS = 104;

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rng: makeRng(seed), plan: null };
}

function idle() { return { aim: null, turn: 0, fire: false, swap: -1, cycle: false, use: -1 }; }

/** Value of resting an ornament of colour c at cell (r, c) without popping: build towards groups, stay high. */
function restValue(G, cell, col) {
    if (!cell) return -5;
    const [r, c] = cell;
    const saved = G.grid[r][c];
    G.grid[r][c] = { k: 'orn', c: col };
    const g = group(G, r, c, col).length;
    G.grid[r][c] = saved;
    return (g - 1) * 0.55 - r * 0.03;
}

function plan(G, bot) {
    const opts = G.loaded ? [{ kind: G.loaded, c: -1, slot: 0 }] : [];
    if (!G.loaded) {
        const seen = new Set();
        G.tray.forEach((c, i) => { if (!seen.has(c)) { seen.add(c); opts.push({ kind: 'orn', c, slot: i }); } });
    }
    const scored = [];
    const lo = AIM_MIN + 0.004, hi = Math.PI - AIM_MIN - 0.004;
    for (let i = 0; i < N_AIMS; i++) {
        const angle = lo + ((hi - lo) * (i + 0.5)) / N_AIMS;
        const trs = {};
        for (const o of opts) {
            const pierce = o.kind === 'candy';
            const tr = trs[pierce] || (trs[pierce] = traceShot(G, angle, pierce));
            const p = preview(G, o.kind, o.c, tr);
            let v = p.n * 1.0 + p.sack * 2.5;
            if (p.won) v += 1000;
            if (p.lost) v -= 1000;
            if (p.n === 0 && o.kind === 'orn') v += restValue(G, tr.cell, o.c);
            if (p.ceil > 0) v -= 1.5;
            if (p.low > DEAD_Y - ROW_H) v -= 4;
            if (tr.cell && cellY(G, tr.cell[0]) > DEAD_Y - 0.2) v -= 50;
            scored.push({ v, angle, slot: o.slot });
        }
    }
    scored.sort((a, b) => b.v - a.v);
    let pick = scored[0];
    if (bot.skill < 1) {
        const k = Math.max(1, Math.round((1 - bot.skill) * 14));
        if (bot.rng() > bot.skill) pick = scored[Math.floor(bot.rng() * Math.min(k, scored.length))];
    }
    const wobble = (1 - bot.skill) * 0.07 * (bot.rng() * 2 - 1);
    return { shots: G.shots, slot: pick.slot, angle: pick.angle + wobble };
}

export function botInput(G, bot) {
    const inp = idle();
    if (G.over || G.phase !== 'aim' || G.cool > 0) return inp;
    // power-ups: the passive ones when they help, the shot ones straight away (one action per step)
    if (!G.loaded && G.sack.length) {
        const i = G.sack.findIndex((p) => POWERS[p].shot || p === 'north' || (p === 'cookie' && (G.ceil > 0 || G.pressure > 3)));
        if (i >= 0) { bot.plan = null; inp.use = i; return inp; }
    }
    if (!bot.plan || bot.plan.shots !== G.shots) bot.plan = plan(G, bot);
    if (bot.plan.slot > 0) { const s = bot.plan.slot; bot.plan.slot = 0; inp.swap = s; return inp; }
    inp.aim = bot.plan.angle;
    inp.fire = true;
    return inp;
}
