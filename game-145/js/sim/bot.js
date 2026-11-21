// An auto-player. It walks the city through the same input a player gives (turn, walk, run, use), following the
// compass: A* to the next objective, through doors it has the tool for, up and down the stairwells, and at the end
// it sets the dials and throws the levers using only the clues in the diaries it has read. Pure, like the rest.

import { TILE, PLAYER, LOCKS } from '../config.js';
import { objective, reachable } from './game.js';
import { findPath, edgeLockAt, lockKind } from './world.js';
import { DIRS } from './city.js';

export function makeBot({ skill = 1 } = {}) {
    return { skill, path: null, pi: 0, goal: null, stuck: 0, last: null, cool: 0, replans: 0, fails: 0, wander: 0 };
}

const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

/** The next thing to walk to and use: the compass target, or a dial / lever / the master switch at the console. */
function target(G) {
    const o = objective(G);
    if (o.id !== 'master') return o;
    const S = G.story;
    // what the bot knows: only the clues in diaries it has read
    const known = { dials: [null, null, null], order: [null, null, null, null] };
    for (const k of G.read) {
        const c = S.clues[k];
        if (!c) continue;
        if (c.kind === 'dial') known.dials[c.i] = c.v; else known.order[c.i] = c.color;
    }
    for (let i = 0; i < 3; i++) if (known.dials[i] != null && G.dials[i] !== known.dials[i]) return { ...G.thingById.get(`dial${i}`), id: `dial${i}` };
    if (G.levers.length < 4) {
        const want = known.order[G.levers.length];
        const lever = S.leverColors.indexOf(want);
        if (lever >= 0) return { ...G.thingById.get(`lever${lever}`), id: `lever${lever}` };
    }
    return o;
}

export function botInput(G, bot, dt = 1 / 120) {
    const inp = { x: 0, y: 0, turn: 0, dyaw: 0, run: bot.skill > 0.5, a: false };
    if (G.won || G.portal > 0) return inp;
    const C = G.city, p = G.p;
    bot.cool = Math.max(0, bot.cool - dt);
    const t = target(G);
    const tx = Math.floor(p.x / TILE), tz = Math.floor(p.z / TILE);
    const canOpen = (lk) => G.openSet.has(lk) || G.items.includes(LOCKS[lockKind(C, lk)].item);

    if (!bot.path || bot.goal !== t.id) {
        bot.goal = t.id;
        bot.path = findPath(C, [p.L, tx, tz], (L, x, z) => L === t.L && Math.hypot((x + 0.5) * TILE - t.x, (z + 0.5) * TILE - t.z) <= 1.6, Math.floor(t.x / TILE), Math.floor(t.z / TILE), canOpen);
        bot.pi = 0; bot.stuck = 0; bot.last = [p.x, p.z];
        if (!bot.path) { bot.fails++; return inp; }
    }
    // where are we on the path?
    const P = bot.path;
    let found = -1;
    for (let i = bot.pi; i < Math.min(P.length, bot.pi + 6); i++) if (P[i][0] === p.L && P[i][1] === tx && P[i][2] === tz) { found = i; break; }
    if (found < 0) {
        // off the path (a fall, a shove past a corner): plan again from here
        bot.path = null; bot.replans++;
        return inp;
    }
    bot.pi = found;

    let aimX, aimZ, use = false;
    if (bot.pi >= P.length - 1) {
        // at the goal: face the thing and use it
        aimX = t.x; aimZ = t.z;
        const d = Math.hypot(t.x - p.x, t.z - p.z);
        const r = reachable(G)[0];
        if (r && (r.id === t.id || (t.kind === 'gate' && r.kind === 'door') || (t.kind === 'door' && r.kind === 'door'))) use = true;
        else if (d > 0.9) { /* keep closing in */ } else use = d < PLAYER.reach;
    } else {
        const n = P[bot.pi + 1];
        const dir = n[1] > tx ? 1 : n[1] < tx ? 3 : n[2] > tz ? 2 : 0;
        const lk = n[0] === p.L ? edgeLockAt(C, p.L, tx, tz, dir) : null;
        if (lk && !G.openSet.has(lk)) {
            // a locked door on the way: open it
            aimX = (tx + 0.5 + DIRS[dir][0] * 0.5) * TILE; aimZ = (tz + 0.5 + DIRS[dir][1] * 0.5) * TILE;
            use = Math.hypot(aimX - p.x, aimZ - p.z) < PLAYER.reach - 0.3;
        } else {
            aimX = (n[1] + 0.5) * TILE; aimZ = (n[2] + 0.5) * TILE;
            // through a doorway, line up with the gap first
            const cx = (tx + 0.5) * TILE, cz = (tz + 0.5) * TILE;
            const off = dir % 2 === 0 ? Math.abs(p.x - cx) : Math.abs(p.z - cz);
            if (off > 0.35) { aimX = dir % 2 === 0 ? cx : (p.x + aimX) / 2; aimZ = dir % 2 === 1 ? cz : (p.z + aimZ) / 2; }
        }
    }
    const want = Math.atan2(aimX - p.x, -(aimZ - p.z));
    const diff = wrap(want - p.yaw);
    const maxTurn = (4 + bot.skill * 6) * dt;
    inp.dyaw = Math.max(-maxTurn, Math.min(maxTurn, diff));
    const dist = Math.hypot(aimX - p.x, aimZ - p.z);
    const atGoal = bot.pi >= P.length - 1;
    if (!(atGoal && dist < 0.9) && !(use && dist < 1.2)) inp.y = Math.abs(diff) < 0.5 ? -1 : Math.abs(diff) < 1.2 ? -0.35 : 0;
    if (atGoal || dist < 1.5) inp.run = false;
    if (use && Math.abs(diff) < 0.35 && bot.cool <= 0) { inp.a = true; bot.cool = 0.3; }

    // stuck? (pressed against something for a second and a half)
    bot.stuck += dt;
    if (Math.hypot(p.x - bot.last[0], p.z - bot.last[1]) > 0.25) { bot.stuck = 0; bot.last = [p.x, p.z]; }
    if (bot.stuck > 1.5 && !use) {
        bot.stuck = 0; bot.replans++;
        // a sidestep to come unstuck, alternating sides
        bot.wander = (bot.wander + 1) % 2;
        inp.x = bot.wander ? 1 : -1;
        bot.path = null;
    }
    return inp;
}
