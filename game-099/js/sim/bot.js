// An auto-player. It plays through the same input a player has, so tests and the balance table
// exercise the real rules, and the title can run it as an attract-mode demo. Pure, like js/sim.
//
// It works on any cart: fight foes in range (shooting if the hero shoots, swinging if the hero
// swings), pick up items, bring a key to a building, and take a door when nothing is left to do.

import { makeRng } from '../rng.js';
import { alive, dist, hasTag, heroesOf, nearest, rad } from './world.js';

const IDLE = () => ({ x: 0, y: 0, a: false, b: false, ah: false, bh: false, tap: null });

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rng: makeRng(seed), tick: 0, cmd: IDLE(), lx: 0, ly: 0, stuck: 0, detour: 0, detourDir: 1 };
}

function nearestBy(G, me, pred) {
    let best = null, bd = Infinity;
    for (const o of G.insts) {
        if (o === me || !alive(o) || !pred(o)) continue;
        const d = dist(me, o);
        if (d < bd) { bd = d; best = o; }
    }
    return best;
}

function think(G, bot, me) {
    const def = G.defs[me.sid];
    const melee = def.rules.some((r) => r.hat.t === 'press' && r.body.some((b) => b.t === 'hurt'));
    const range = melee ? 2.6 : 6;
    const inp = IDLE();
    let target = null, fighting = false;

    const foe = nearest(G, me, 'monster', range);
    const lowHp = me.hp <= Math.max(2, def.hp * 0.35);
    const heart = lowHp ? nearestBy(G, me, (o) => o.sid === 'heart') : null;

    if (heart && dist(me, heart) < 12) target = heart;
    else if (foe) { target = foe; fighting = true; }
    else {
        const hasKey = (G.inv.key || 0) > 0;
        const castle = hasKey ? nearestBy(G, me, (o) => o.sid === 'castle') : null;
        const item = nearestBy(G, me, (o) => hasTag(G, o, 'item'));
        const door = nearestBy(G, me, (o) => o.sid === 'door_next');
        const anyFoe = nearestBy(G, me, (o) => hasTag(G, o, 'monster'));
        if (castle) target = castle;
        else if (item && dist(me, item) < 16) target = item;
        else if (door) target = door;
        else if (anyFoe) { target = anyFoe; fighting = true; }
    }
    if (!target) return inp;

    let dx = target.x - me.x, dy = target.y - me.y;
    const d = Math.hypot(dx, dy) || 1;
    let mag = 1;
    if (fighting) {
        const want = melee ? 1.2 : 3.2;
        if (d <= want + 0.3) mag = 0.14;          // creep: keeps facing the foe without walking into it
        const face = (me.fx * dx + me.fy * dy) / d;
        if (melee ? d < 2 : (face > 0.94 && d < range + 1)) { inp.ah = true; inp.a = true; }
    }
    let vx = dx / d, vy = dy / d;
    // steer around solids and fire; the target itself is not an obstacle
    for (const o of G.insts) {
        if (o === me || o === target || !alive(o)) continue;
        if (!(G.defs[o.sid].solid || hasTag(G, o, 'fire'))) continue;
        const ox = me.x - o.x, oy = me.y - o.y, od = Math.hypot(ox, oy);
        const reach = rad(G.defs[o.sid]) + 1.0;
        if (od < reach && od > 1e-3) { const k = (reach - od) / reach * 1.6; vx += (ox / od) * k; vy += (oy / od) * k; }
    }
    if (bot.detour > 0) { const t = vx; vx = -vy * bot.detourDir; vy = t * bot.detourDir; }
    const l = Math.hypot(vx, vy) || 1;
    inp.x = (vx / l) * mag;
    inp.y = (vy / l) * mag;
    return inp;
}

export function botInput(G, bot) {
    const heroes = heroesOf(G);
    if (!heroes.length) return IDLE();
    const me = heroes[0];
    bot.tick++;
    const lag = 1 + Math.round((1 - bot.skill) * 90);
    if (bot.tick % lag === 1 || lag === 1) bot.cmd = think(G, bot, me);

    // stuck detection: pressing on but not moving, so go round
    if (bot.tick % 12 === 0) {
        const moved = Math.hypot(me.x - bot.lx, me.y - bot.ly);
        const pushing = Math.hypot(bot.cmd.x, bot.cmd.y) > 0.5;
        bot.stuck = pushing && moved < 0.25 ? bot.stuck + 1 : 0;
        bot.lx = me.x; bot.ly = me.y;
        if (bot.stuck >= 2 && bot.detour <= 0) { bot.detour = 40; bot.detourDir = bot.rng() < 0.5 ? 1 : -1; }
    }
    if (bot.detour > 0) bot.detour--;

    const c = bot.cmd;
    // `a` is an edge: only the first step of a held press
    const out = { x: c.x, y: c.y, a: c.a && bot.tick % 4 === 0, b: false, ah: c.ah, bh: false, tap: null };
    return out;
}
