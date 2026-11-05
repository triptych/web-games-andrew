// An auto-player. It plays through the same input the player uses ({ x, y, ax, ay, fire, dash }
// in screen terms), so the tests, the balance table and the attract mode all exercise the real
// rules. Pure, like the rest of js/sim: its own seeded noise, no clock.
//
// It walks the maze toward the nearest live beacon by a breadth-first field over open edges,
// shoots whatever it can see (enemies first), keeps a stand-off distance from turrets, picks up
// repairs when hurt, dashes across incoming bolts, and wiggles free when it gets stuck.

import * as V from './vec.js';
import { cellOf, bfs, los } from './world.js';
import { right, objectives } from './game.js';
import { makeRng } from '../rng.js';
import { ENEMY, PLAYER } from '../config.js';

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rng: makeRng(seed), next: 0, world: null, fields: new Map(), here: -1, hereField: null, move: null, aim: null, fire: false, dash: false, stuckT: 0, lastP: null, lastT: 0, wiggleT: 0, wiggle: null, goalKey: '' };
}

function field(bot, W, cell) {
    let f = bot.fields.get(cell);
    if (!f) { f = bfs(W, cell); bot.fields.set(cell, f); }
    return f;
}

function think(G, bot) {
    const P = G.player, W = G.world, R = W.R;
    if (bot.world !== W) { bot.world = W; bot.fields.clear(); }
    const pc = cellOf(W, P.p);
    const fromMe = field(bot, W, pc);
    const sk = bot.skill;

    // ---- where to go
    const objs = objectives(G);
    let goal = null, gd = Infinity;
    for (const o of objs) {
        const d = fromMe[cellOf(W, o.p)];
        if (d >= 0 && d < gd) { gd = d; goal = o; }
    }
    let move = null;
    let standoff = false;
    if (goal) {
        const gcell = cellOf(W, goal.p);
        const dist = V.chord(P.p, goal.p) * R;
        const keep = goal.kind === 'exit' ? 0 : goal.kind === 'boss' ? 7 : 4.5;
        if ((gcell === pc || (dist < 11 && los(W, P.p, goal.p, 11))) && goal.kind !== 'exit') {
            standoff = true;
            const to = V.toward(P.p, goal.p);
            const side = V.cross(P.p, to);
            const k = dist > keep + 1 ? 1 : dist < keep - 1 ? -1 : 0;
            move = V.add(V.scale(to, k), V.scale(side, Math.sin(G.t * 0.9) * 0.8));
        } else if (gcell === pc) {
            move = V.toward(P.p, goal.p);
        } else {
            const f = field(bot, W, gcell);
            const cell = W.cells[pc];
            let best = -1;
            for (let k = 0; k < 4; k++) if (cell.open[k] && f[cell.nb[k]] >= 0 && f[cell.nb[k]] < f[pc]) { best = cell.nb[k]; break; }
            if (best >= 0) {
                const nc = W.cells[best].c;
                const door = V.norm(V.add(cell.c, nc));
                // head for the doorway, but from the cell's middle line so corners don't snag
                const atDoor = V.chord(P.p, door) * R < 0.9;
                move = V.toward(P.p, atDoor ? nc : door);
            } else move = V.toward(P.p, goal.p);
        }
    }

    // ---- pickups worth a detour
    for (const k of G.pickups) {
        const d = V.chord(P.p, k.p) * R;
        const want = k.kind === 'repair' ? P.hp < PLAYER.hp * 0.75 : k.kind === 'power' ? true : sk > 0.8;
        if (want && d < 6 && los(W, P.p, k.p, 6)) { move = V.toward(P.p, k.p); break; }
    }

    // ---- what to shoot
    let target = null, td = Infinity;
    const cand = G.enemies.map((e) => ({ e, d: V.chord(P.p, e.p) * R })).filter((c) => c.d < 11).sort((a, b) => a.d - b.d).slice(0, 4);
    for (const c of cand) if (c.d < td && los(W, P.p, c.e.p, 11)) { target = c.e; td = c.d; break; }
    if (!target) {
        for (const t of G.turrets) {
            if (!t.alive) continue;
            const d = V.chord(P.p, t.p) * R;
            if (d < 13 && d < td && los(W, P.p, t.p, 13)) { target = t; td = d; }
        }
        const B = G.boss;
        if (!target && B?.alive && !B.shield && los(W, P.p, B.p, 14)) target = B;
    }
    // back off from anything about to touch us
    for (const c of cand) {
        const rr = ENEMY[c.e.kind].r + PLAYER.r + 1.6;
        if (c.d < rr) { const away = V.scale(V.toward(P.p, c.e.p), -1); move = move ? V.add(V.scale(V.norm(move), 0.4), away) : away; break; }
    }
    bot.aim = null; bot.fire = false;
    if (target) {
        let a = V.toward(P.p, target.p);
        // lead a moving target a little
        if (target.vel) {
            const lead = V.madd(target.p, target.vel, (td / 30) / R);
            a = V.toward(P.p, V.norm(lead));
        }
        const err = (bot.rng() - 0.5) * (1 - sk) * 0.9;
        bot.aim = V.turn(P.p, a, err);
        bot.fire = bot.rng() < 0.55 + sk * 0.45;
    }

    // ---- dodge incoming bolts
    bot.dash = false;
    if (P.dashCd <= 0 && bot.rng() < sk * 0.6) {
        for (const b of G.bullets) {
            if (b.own) continue;
            const d = V.chord(P.p, b.p) * R;
            if (d > 2.4) continue;
            if (V.dot(b.d, V.toward(b.p, P.p)) > 0.93) {
                const side = V.cross(P.p, V.toward(P.p, b.p));
                move = bot.rng() < 0.5 ? side : V.scale(side, -1);
                bot.dash = true;
                break;
            }
        }
    }

    // ---- stuck? wiggle
    if (!bot.lastP || G.t - bot.lastT > 1.5) {
        if (bot.lastP && move && !standoff && V.chord(bot.lastP, P.p) * R < 0.6) {
            bot.wiggleT = G.t + 0.6;
            bot.wiggle = V.turn(P.p, move, (bot.rng() < 0.5 ? 1 : -1) * (1.2 + bot.rng()));
        }
        bot.lastP = P.p.slice(); bot.lastT = G.t;
    }
    if (G.t < bot.wiggleT && bot.wiggle) move = bot.wiggle;
    bot.move = move ? V.norm(move) : null;
}

export function botInput(G, bot) {
    const out = { x: 0, y: 0, ax: 0, ay: 0, fire: false, dash: false };
    if (G.over || G.phase === 'warp' || G.phase === 'dead') return out;
    if (G.t >= bot.next || bot.world !== G.world) { think(G, bot); bot.next = G.t + 0.1; }
    const P = G.player, R0 = right(P);
    const toScreen = (d) => { const t = V.norm(V.tangent(P.p, d)); return [V.dot(t, R0), -V.dot(t, P.f)]; };
    if (bot.move) {
        const [x, y] = toScreen(bot.move);
        out.x = x * bot.skill; out.y = y * bot.skill;
    }
    if (bot.aim) {
        const [x, y] = toScreen(bot.aim);
        out.ax = x; out.ay = y; out.fire = bot.fire;
    }
    if (bot.dash) { out.dash = true; bot.dash = false; }
    return out;
}
