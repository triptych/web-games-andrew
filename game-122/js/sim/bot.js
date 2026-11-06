// An auto-player. It plays through the same input the player uses, so the tests, the balance
// table and the title screen's attract mode all exercise the real rules. Pure, like the rest of
// js/sim.
//
// It looks at the mist in blocks of 8 × 8 cells, heads for the most misted block nearby (and for
// curios it hasn't seen, when skilled), and goes for a bead when it runs low on water. A lower
// skill rethinks less often, steers less surely and wanders.

import { FIELD, FOG, FOG_CELL, DROP, TAP } from '../config.js';
import { curios } from './game.js';

const B = 8;                                     // block size in cells
const BW = FOG.gw / B, BH = FOG.gh / B;

export function makeBot({ skill = 1, seed = 1 } = {}) {
    return { skill, target: null, think: 0, s: seed >>> 0 || 1, wobble: 0 };
}

// a tiny private generator, so the bot's dithering never touches the game's own rng
function rnd(bot) {
    bot.s ^= bot.s << 13; bot.s >>>= 0;
    bot.s ^= bot.s >>> 17;
    bot.s ^= bot.s << 5; bot.s >>>= 0;
    return bot.s / 4294967296;
}

function blockFog(G, bx, by) {
    let s = 0, best = -1, bi = 0;
    for (let r = by * B; r < by * B + B; r++) {
        for (let c = bx * B; c < bx * B + B; c++) {
            const v = G.fog[r * FOG.gw + c];
            s += v;
            if (v > best) { best = v; bi = r * FOG.gw + c; }
        }
    }
    return { avg: s / (B * B), x: ((bi % FOG.gw) + 0.5) * FOG_CELL, y: (Math.floor(bi / FOG.gw) + 0.5) * FOG_CELL };
}

// the most misted cell in a disc, so the drop works its way over all of a curio
function foggiest(G, x, y, R) {
    let best = 40, at = null;
    for (let r = Math.max(0, Math.floor((y - R) / FOG_CELL)); r <= Math.min(FOG.gh - 1, Math.floor((y + R) / FOG_CELL)); r++) {
        for (let c = Math.max(0, Math.floor((x - R) / FOG_CELL)); c <= Math.min(FOG.gw - 1, Math.floor((x + R) / FOG_CELL)); c++) {
            const cx = (c + 0.5) * FOG_CELL, cy = (r + 0.5) * FOG_CELL;
            if ((cx - x) ** 2 + (cy - y) ** 2 > R * R) continue;
            const v = G.fog[r * FOG.gw + c];
            if (v > best) { best = v; at = { x: cx, y: cy }; }
        }
    }
    return at;
}

function choose(G, bot) {
    const d = G.drop;
    // low on water: the nearest bead
    if (d.m < 0.8 && G.beads.length) {
        let best = null, bd = Infinity;
        for (const b of G.beads) {
            const dd = Math.hypot(b.x - d.x, b.y - d.y);
            if (dd < bd) { bd = dd; best = b; }
        }
        if (bd < 4.5) return { x: best.x, y: best.y, bead: true };
    }
    // a curio not yet seen
    if (bot.skill >= 1) {
        for (const c of curios(G)) {
            if (G.found.includes(c.id)) continue;
            if (Math.hypot(c.x - d.x, c.y - d.y) < 3.5) {
                const t = foggiest(G, c.x, c.y, c.r);
                if (t) return t;
            }
        }
    }
    let best = null, bs = -Infinity;
    for (let by = 0; by < BH; by++) {
        for (let bx = 0; bx < BW; bx++) {
            const f = blockFog(G, bx, by);
            if (f.avg < 25) continue;
            const dist = Math.hypot(f.x - d.x, f.y - d.y);
            // heavy drops slide down anyway: prefer mist below them
            const below = d.m > DROP.cling - 0.2 && f.y < d.y ? 2.5 : 0;
            const s = f.avg / 255 * 4 - dist * 0.55 - below + (bot.skill < 1 ? rnd(bot) * 2 : 0);
            if (s > bs) { bs = s; best = f; }
        }
    }
    if (!best) return null;
    // too heavy to climb back to the mist that is left: let it run off, and a fresh drop forms up top
    if (d.m > DROP.cling + 0.5 && best.y < d.y - 1) return { x: d.x, y: FIELD.h + 3, runoff: true };
    return { x: best.x, y: best.y, block: true };
}

export function botInput(G, bot) {
    const d = G.drop;
    if (G.phase !== 'play' || !d.alive) { bot.target = null; return { x: 0, y: 0, a: false }; }
    bot.think -= 1 / 120;
    const near = bot.target && Math.hypot(bot.target.x - d.x, bot.target.y - d.y) < 0.2;
    if (bot.think <= 0 || !bot.target || near) {
        bot.target = choose(G, bot);
        // commit to a patch of mist for a while, or it dithers between two
        bot.think = bot.target?.block ? (bot.skill >= 1 ? 1.5 : 2.2) : (bot.skill >= 1 ? 0.25 : 0.7);
        bot.wobble = (rnd(bot) - 0.5) * (1 - bot.skill) * 2;
    }
    const t = bot.target;
    if (!t) return { x: 0, y: 0, a: false };
    let dx = t.x - d.x, dy = t.y - d.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    // lean against the slide when heavy
    if (d.m > DROP.cling) dy -= 0.35;
    const w = bot.wobble;
    const x = dx * Math.cos(w) - dy * Math.sin(w), y = dx * Math.sin(w) + dy * Math.cos(w);
    let a = false;
    if (G.tapCD <= 0 && d.m < 1.1 && bot.skill >= 1) {
        a = G.beads.some((b) => Math.hypot(b.x - d.x, b.y - d.y) < TAP.reach * 0.9);
    }
    const mag = Math.min(1, l / 0.3) * (0.55 + 0.45 * bot.skill);
    return { x: x * mag, y: Math.max(-1, Math.min(1, y * mag)), a };
}

