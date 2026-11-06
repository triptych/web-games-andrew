// An auto-player. It plays through the same input the player uses, so the tests, the balance table and an
// attract-mode demo all exercise the real rules. It reads only what a player could: the commission, its own
// sheet, and the features it has found. Pure, like the rest of js/sim.

import { WORLD, SCRY, QUILL, STEP } from '../config.js';
import { scryRadius, current } from './game.js';
import { astar } from './path.js';
import { planCost } from './commission.js';

const W = WORLD.w, H = WORLD.h;

/** skill is how steady the bot holds the spell: 1 is a full-focus cast every time. */
export function makeBot({ skill = 1 } = {}) {
    return { skill, focus: Math.max(0.05, Math.min(1, skill)), idx: -1, points: [], state: 'move', target: null, stuck: 0, done: false };
}

/** A hex lattice of cast points that covers a rectangle, laid out in a snake so travel is short. */
function lattice(r, R) {
    const d = R * 1.5, rowH = d * 0.866;
    const rows = [];
    for (let y = r.y + R * 0.35, j = 0; y < r.y + r.h + R * 0.45; y += rowH, j++) {
        const row = [];
        for (let x = r.x + (j % 2 ? d / 2 : 0) + R * 0.3; x < r.x + r.w + R * 0.5; x += d) row.push({ x: Math.min(x, r.x + r.w - 0.5), y: Math.min(y, r.y + r.h - 0.5) });
        rows.push(j % 2 ? row.reverse() : row);
    }
    return rows.flat();
}

/** Where to cast next on a travel commission: along the cheapest way the chart suggests, assuming the unknown is open. */
function travelTarget(G, bot, c) {
    const world = G.world, ship = c.kind === 'sail';
    const S = world.features[c.start], goalFound = G.found.includes(c.goal);
    const R = scryRadius(bot.focus);
    // the goal is known: chart the way. Otherwise head for the middle of the shaded country.
    const gx = goalFound ? world.features[c.goal].x : Math.floor(c.region.x + c.region.w / 2);
    const gy = goalFound ? world.features[c.goal].y : Math.floor(c.region.y + c.region.h / 2);
    const plan = astar(W, H, planCost(G, ship, 2), S.x, S.y, gx, gy);
    if (plan) {
        const p = plan.path;
        for (let k = 0; k < p.length; k++) {
            const i = p[k][1] * W + p[k][0];
            if (G.ink[i] === 0 || G.conf[i] < bot.focus * 100 * 0.6) {
                // stand a little way ahead, so the disc covers the gap and some of what follows
                const j = Math.min(p.length - 1, k + Math.floor(R * 0.5));
                return { x: p[j][0] + 0.5, y: p[j][1] + 0.5 };
            }
        }
        if (goalFound) return null;                       // the way is charted and the goal is known
    }
    // the goal is still hidden: sweep the shaded country
    if (!bot.sweep) bot.sweep = lattice(c.region, R);
    return bot.sweep.shift() || null;
}

export function botInput(G, bot) {
    const none = { x: 0, y: 0, a: false, r: false, h: false, d: false };
    if (G.phase !== 'work') return none;
    const c = current(G);
    if (bot.idx !== G.idx) {
        Object.assign(bot, { idx: G.idx, points: [], state: 'move', target: null, sweep: null, done: false, stuck: 0 });
        if (c.kind !== 'route' && c.kind !== 'sail') bot.points = lattice(c.region, scryRadius(bot.focus));
    }
    const q = G.q;
    if (bot.state === 'move') {
        if (!bot.target) {
            if (c.kind === 'route' || c.kind === 'sail') bot.target = travelTarget(G, bot, c);
            else bot.target = bot.points.shift() || null;
            if (!bot.target) return { ...none, d: true };            // everything is charted: hand it over
        }
        const dx = bot.target.x - q.x, dy = bot.target.y - q.y, dist = Math.hypot(dx, dy);
        if (dist < 0.12) { bot.state = 'hold'; return { ...none, a: true, h: true }; }
        const mag = Math.min(1, dist / (QUILL.speed * STEP * 1.5));
        return { ...none, x: (dx / dist) * mag, y: (dy / dist) * mag };
    }
    if (bot.state === 'hold') {
        if (G.channel && G.channel.focus >= bot.focus - 1e-9) { bot.state = 'move'; bot.target = null; return { ...none, r: true }; }
        if (!G.channel) { bot.state = 'move'; return none; }
        return { ...none, h: true };
    }
    return none;
}
