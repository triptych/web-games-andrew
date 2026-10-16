// An auto-player. It plays through the same input the player uses, so the tests, the balance
// table and the attract-mode demo behind the title all exercise the real rules. Pure.
//
// It plans on the jump graph (nav.js): pick a goal (pop the trapped bubbles, line up a shot,
// grab the loot, pop a special), find a route to a standing spot, walk to each jump's take-off
// point and replay the jump. Every step it also shoots anything lined up in front of it, turns
// to shoot anything close behind, and backs away from what it can't bubble.
// skill 1 waits for chains and reacts at once; lower skill pops early, thinks slower and dodges late.

import { PLAYER, BUBBLE, STEP, LEFT, RIGHT } from '../config.js';
import { makeRng } from '../rng.js';
import { navFor, route, standRange } from './nav.js';
import { segmentAt, groundBelow } from './physics.js';
import { level } from './game.js';

const NONE = { x: 0, jump: false, fire: false, fireP: false };
const REACH = PLAYER.jumpV * PLAYER.jumpV / (2 * PLAYER.gravity);

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rng: makeRng(seed), think: 0, goal: null, route: null, exec: null, stuckT: 0, lx: 0, ly: 0, wanderT: 0, popT: 0 };
}

const grounded = (e) => e.type === 'blip' || e.type === 'grunt' || e.type === 'spark';

export function botInput(G, bot) {
    const p = G.player;
    if (p.state !== 'alive' || (G.phase !== 'play' && G.phase !== 'clear')) { bot.exec = null; bot.route = null; return NONE; }
    const L = level(G);
    const nav = navFor(G.level);
    const out = { x: 0, jump: false, fire: false, fireP: false };

    bot.think -= STEP;
    if (bot.think <= 0) {
        bot.think = bot.skill >= 1 ? 0.12 : 0.12 + (1 - bot.skill) * 0.5;
        choose(G, bot, nav);
    }

    // ---- reflexes: shoot what's lined up in front; turn on what's lined up close behind
    const shootY = p.y - p.h * 0.55;
    const range = p.powers.long ? BUBBLE.longRange : BUBBLE.range;
    let turn = 0;
    const lined = new Set();
    for (const e of G.enemies) {
        if (e.st !== 'live' || G.freezeT > 0) continue;
        const dy = e.y - e.h / 2 - shootY, dx = e.x - p.x;
        if (Math.abs(dy) < 1.05 && dx * p.face > -0.4 && dx * p.face < range + 0.8) {
            if (p.cd <= 0 && bot.rng() < 0.4 + bot.skill * 0.6) { out.fire = out.fireP = true; lined.add(e.id); }
        } else if (Math.abs(dy) < 1.05 && Math.abs(dx) < 4.5 && Math.abs(dx) > 1.0) { turn = Math.sign(dx); lined.add(e.id); }
    }
    const midJump = bot.exec && bot.exec.phase === 'act';
    if (turn && turn !== p.face && !out.fire && !midJump && p.ground) out.x = turn;
    else drive(G, bot, nav, out);

    // ---- dodge: if the move we're about to make runs into something, try the others
    const react = bot.skill >= 1 || bot.rng() < 0.25 + bot.skill * 0.6;
    if (react) {
        const d0 = danger(G, out.x, out.jump, lined);
        if (d0 < (midJump ? 0.9 : 1.6)) {
            let best = null;
            for (const x of [-1, 0, 1]) for (const jump of p.ground ? [false, true] : [false]) {
                const d = danger(G, x, jump, lined) - (jump ? 0.05 : 0) - (x === out.x ? 0 : 0.02);
                if (!best || d > best.d) best = { x, jump, d };
            }
            if (best.d > d0 + 0.25) { out.x = best.x; out.jump = best.jump; bot.exec = null; }
        }
    }

    // stuck? wander for a moment
    if (Math.hypot(p.x - bot.lx, p.y - bot.ly) > 0.4) { bot.lx = p.x; bot.ly = p.y; bot.stuckT = 0; }
    else if (bot.goal) bot.stuckT += STEP;
    if (bot.stuckT > 2.5) { bot.stuckT = 0; bot.route = null; bot.exec = null; bot.wanderT = 0.8; bot.wanderDir = bot.rng() < 0.5 ? -1 : 1; }
    if (bot.wanderT > 0) {
        bot.wanderT -= STEP;
        out.x = bot.wanderDir;
        if (p.ground && bot.rng() < 0.02) out.jump = true;
    }
    return out;
}

/** How close does a move (held for a second) come to anything that kills? Straight-line guesses. */
function danger(G, dir, jump, ignore) {
    const p = G.player;
    const sp = PLAYER.speed * (p.powers.boots ? 1.3 : 1);
    let min = 99;
    for (let t = 0.08; t <= 1.2; t += 0.08) {
        const px = Math.max(LEFT + 0.75, Math.min(RIGHT - 0.75, p.x + dir * sp * t));
        let py;
        if (p.ground && !jump) py = p.y;
        else {
            const vy = p.ground ? -PLAYER.jumpV : p.vy;
            py = p.y + vy * t + 0.5 * PLAYER.gravity * t * t;
            if (vy + PLAYER.gravity * t > 0 && py > p.y && p.ground) py = p.y;
        }
        const pcy = py - p.h / 2;
        for (const s of G.shots) min = Math.min(min, Math.hypot(s.x + s.vx * t - px, s.y + s.vy * t - pcy) - 0.6);
        if (G.freezeT <= 0) for (const e of G.enemies) {
            if (e.st !== 'live' || ignore.has(e.id)) continue;
            const fly = e.type === 'glooper' || e.type === 'moth' || e.type === 'saucer';
            const ex = Math.max(LEFT, Math.min(RIGHT, e.x + e.vx * t)), ey = e.y - e.h / 2 + (fly ? e.vy * t : Math.max(0, e.vy) * t * 0.5);
            min = Math.min(min, Math.max(Math.abs(ex - px) - (e.w + p.w) / 2 + 0.6, Math.abs(ey - pcy) - (e.h + p.h) / 2 + 0.5));
        }
        const B = G.boss;
        if (B && B.st === 'live') {
            const bx = B.x + B.vx * t, by = B.y - B.h / 2 + B.vy * t;
            min = Math.min(min, Math.max(Math.abs(bx - px) - (B.w + p.w) / 2 + 0.6, Math.abs(by - pcy) - (B.h + p.h) / 2 + 0.6));
        }
        if (G.wraith) min = Math.min(min, Math.hypot(G.wraith.x - px, G.wraith.y - pcy) - 1.2 - t * 2);
        if (min < -1) break;
    }
    return min;
}

/** Pick a goal and a route to its standing spot. */
function choose(G, bot, nav) {
    const p = G.player;
    if (!p.ground) return;                       // replan only from the ground
    const here = segmentAt(nav.segs, p.x, p.y, p.w);
    if (!here) return;
    const goals = [];
    const trapped = G.bubbles.filter((b) => b.enemy != null || b.kind === 'boss');
    const live = G.enemies.filter((e) => e.st === 'live');
    const oldest = trapped.reduce((a, b) => Math.max(a, b.trapT || 0), 0);
    const popNow = trapped.length && (trapped.some((b) => b.kind === 'boss') || !live.length || G.hurry || oldest > (bot.skill >= 1 ? 3.2 : 1.2) || trapped.length >= 4);
    if (popNow) for (const b of trapped) goals.push(popGoal(G, nav, b, 0));
    for (const it of G.items) goals.push(itemGoal(G, nav, it, it.kind.startsWith('p:') || it.kind === 'heart' ? -6 : G.phase === 'clear' ? 0 : 2));
    for (const b of G.bubbles) {
        if (b.kind === 'letter') goals.push(popGoal(G, nav, b, 1));
        else if (b.kind === 'zap' && G.boss) goals.push(popGoal(G, nav, b, -2));
        else if ((b.kind === 'zap' || b.kind === 'nova') && live.length) goals.push(popGoal(G, nav, b, 4));
    }
    if (!popNow || G.hurry) for (const e of live) goals.push(shootGoal(G, nav, e));
    let best = null;
    for (const g of goals) {
        if (!g) continue;
        const r = route(nav, here.id, p.x, new Set([g.seg]));
        if (!r) continue;
        const cost = r.reduce((a, e) => a + e.time + 0.3, 0) + Math.abs((r.length ? r[r.length - 1].x1 : p.x) - g.x) / PLAYER.speed + g.pri;
        if (!best || cost < best.cost) best = { ...g, route: r, cost };
    }
    if (!best) { bot.goal = null; bot.route = null; return; }
    bot.goal = best;
    if (!bot.exec || bot.exec.phase !== 'act') { bot.route = best.route; bot.exec = null; }
}

/** Stand under (or beside) a bubble and jump into it. */
function popGoal(G, nav, b, pri) {
    const touch = b.r + 0.72 - 0.3;
    let best = null;
    for (const s of nav.segs) {
        const [lo, hi] = standRange(s);
        const x = Math.max(lo, Math.min(hi, b.x));
        const dx = Math.abs(x - b.x);
        if (dx > touch - 0.25) continue;
        const reachY = Math.sqrt(touch * touch - dx * dx);
        const cy = s.r - PLAYER.h / 2;
        const walk = Math.abs(b.y - cy) < reachY - 0.2;
        const jump = b.y < s.r - 0.5 && cy - REACH - b.y < reachY;
        if (!walk && !jump) continue;
        const d = s.r - b.y + dx;
        if (!best || d < best.d) best = { seg: s.id, x, jump: !walk, d };
    }
    return best && { kind: 'pop', id: b.id, seg: best.seg, x: best.x, jump: best.jump, pri };
}

function itemGoal(G, nav, it, pri) {
    const L = level(G);
    const r = it.ground ? Math.round(it.y) : groundBelow(L, it.x, it.y, it.w);
    if (r == null) return null;
    const s = segmentAt(nav.segs, it.x, r, it.w);
    if (!s) return null;
    const [lo, hi] = standRange(s);
    return { kind: 'item', id: it.id, seg: s.id, x: Math.max(lo, Math.min(hi, it.x)), pri };
}

/** A spot on a row where the bubble flies at the enemy's height, a few tiles from it. */
function shootGoal(G, nav, e) {
    const p = G.player;
    const ecy = e.y - e.h / 2;
    let best = null;
    for (const s of nav.segs) {
        const by = s.r - PLAYER.h * 0.55;
        if (grounded(e) && e.ground) { if (Math.abs(s.r - e.y) > 0.01) continue; }
        else if (Math.abs(by - ecy) > 1.6) continue;
        const [lo, hi] = standRange(s);
        if (hi < e.x - 7 || lo > e.x + 7) continue;
        const side = Math.sign(p.x - e.x) || 1;
        let x = e.x + side * 3.2;
        if (x < lo || x > hi) x = e.x - side * 3.2;
        x = Math.max(lo, Math.min(hi, x));
        const d = Math.abs(by - ecy) + Math.abs(x - e.x) * 0.1;
        if (!best || d < best.d) best = { seg: s.id, x, d };
    }
    return best && { kind: 'shoot', id: e.id, seg: best.seg, x: best.x, face: Math.sign(e.x - best.x) || 1, pri: 1 };
}

/** Walk to take-off points, replay jumps; at the goal, do its thing. */
function drive(G, bot, nav, out) {
    const p = G.player;
    if (bot.exec) {
        const ex = bot.exec;
        const e = ex.edge;
        if (ex.phase === 'walk') {
            const dx = e.x0 - p.x;
            if (!p.ground) { bot.exec = null; return; }
            if (Math.abs(dx) > 0.07) { out.x = Math.sign(dx); return; }
            ex.phase = 'act'; ex.t = 0; ex.air = 0;
            if (e.act.kind === 'jump') out.jump = true;
        }
        ex.t += STEP;
        let dir = e.act.dir;
        if (e.act.kind === 'jump') { if (ex.t > e.act.hold) dir = 0; }
        else if (!p.ground) { ex.air += STEP; if (ex.air > e.act.hold) dir = 0; }
        out.x = dir;
        if (p.ground && ex.t > 0.05 && (e.act.kind === 'jump' || ex.air > 0)) { bot.exec = null; bot.route?.shift(); }
        else if (ex.t > 4) bot.exec = null;
        return;
    }
    if (!p.ground) return;
    if (bot.route && bot.route.length) { bot.exec = { edge: bot.route[0], phase: 'walk', t: 0 }; drive(G, bot, nav, out); return; }
    const g = bot.goal;
    if (!g) return;
    const here = segmentAt(nav.segs, p.x, p.y, p.w);
    if (!here || here.id !== g.seg) { bot.route = null; bot.think = 0; return; }
    const dx = g.x - p.x;
    if (g.kind === 'shoot') {
        if (Math.abs(dx) > 0.2) { out.x = Math.sign(dx); return; }
        if (p.face !== g.face) out.x = g.face;
        return;
    }
    if (Math.abs(dx) > 0.15) { out.x = Math.sign(dx); return; }
    if (g.kind === 'pop' && g.jump) {
        const b = G.bubbles.find((q) => q.id === g.id);
        if (!b) { bot.goal = null; return; }
        out.jump = true;
        bot.goal = null;
        bot.think = 0.35;
    }
}
