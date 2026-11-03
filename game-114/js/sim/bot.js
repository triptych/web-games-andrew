// An auto-player. It plays through the same input the player uses, so the tests, the balance
// table and the attract mode behind the title all exercise the real rules. Pure, like the rest
// of js/sim.
//
// Moving: it runs right. When the floor ahead ends, a wall rises or acid waits, it plans a jump by
// simulating the real body mover with a few amounts of stick and takes the first that lands
// somewhere safe further on. Fighting: it points the stick at the nearest threat (which also aims
// the gun) and holds fire; against bosses it keeps its distance and jumps or ducks what comes.

import { PLAYER } from '../config.js';
import { makeRng } from '../rng.js';
import { moveBody, standable, inAcid, tile, T_ACID, T_SOLID } from './physics.js';
import { runSpeed } from './game.js';
import { hasLos } from './common.js';

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rng: makeRng(seed), plan: null, think: 0, stuckX: -1, stuckT: 0, react: 0, lastX: 0, flareT: 2 };
}

/** Simulate a jump with stick x = hold; returns where it lands, or null if it ends badly. */
export function tryJump(L, p, hold, maxT = 1.6, vy = PLAYER.jump) {
    const b = { x: p.x, y: p.y, w: p.w, h: PLAYER.h, vx: runSpeed(hold), vy, ground: false, drop: 0 };
    const dt = 1 / 60;
    for (let t = 0; t < maxT; t += dt) {
        b.vy = Math.max(-PLAYER.maxFall, b.vy - PLAYER.gravity * dt);
        b.vx = runSpeed(hold);
        moveBody(L, b, dt);
        if (inAcid(L, b) || b.y < 0.5) return null;
        if (b.ground && t > 0.05) {
            if (!standable(L, Math.floor(b.x), b.y)) return null;   // teetering on an edge
            return { x: b.x, y: b.y, t };
        }
    }
    return null;
}

/** Is the next stretch of floor safe to run onto? */
function needJump(G, p, dir) {
    const L = G.level;
    const ahead = p.x + dir * (p.w / 2 + 0.55);
    const c = Math.floor(ahead);
    if (!standable(L, c, p.y)) return true;                                    // ledge or pit
    for (let r = Math.floor(p.y + 0.1); r <= Math.floor(p.y + p.h); r++) if (tile(L, Math.floor(p.x + dir * (p.w / 2 + 0.35)), r) === T_SOLID) return true;  // wall
    if (tile(L, c, Math.round(p.y)) === T_ACID || tile(L, c + dir, Math.round(p.y) - 1) === T_ACID) return true;
    return false;
}

function nearestThreat(G, p, range = 13) {
    let best = null, bd = Infinity;
    const consider = (x, y, w, isPod) => {
        const dx = x - p.x, dy = y - (p.y + 1);
        if (Math.abs(dx) > range || Math.abs(dy) > 8) return;
        if (!hasLos(G.level, p.x, p.y + 1.1, x, y)) return;
        const d = Math.hypot(dx, dy) + (isPod ? 4 : 0) + (dx < -1 ? 3 : 0);
        if (d < bd) { bd = d; best = { x, y, dx, dy }; }
    };
    for (const e of G.enemies) if (!e.dead) consider(e.x, e.y + e.h / 2, e.w, false);
    for (const pod of G.pods) if (!pod.open) consider(pod.x, pod.y + 0.9, 1, true);
    if (G.boss && G.boss.vulnerable && !G.boss.dead) {
        const B = G.boss;
        const by = B.k === 'gravemaw' ? Math.min(B.y + B.h - 1, p.y + 1) : B.k === 'queen' ? Math.min(B.y + B.h * 0.75, p.y + 3) : B.y + B.h / 2;
        consider(B.x - Math.sign(B.x - p.x) * (B.w / 2 - 0.5), by, B.w, false);
    }
    return best;
}

/** The 8-way stick direction closest to (dx, dy). */
function aimStick(dx, dy) {
    const a = Math.atan2(dy, dx);
    const s = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
    return { x: Math.round(Math.cos(s)), y: Math.round(Math.sin(s)) };
}

/** Danger the bot should get out of the way of, most urgent first. */
function dangerLow(G, p) {
    const B = G.boss;
    if (B && !B.dead) {
        if (B.k === 'gravemaw' && ((B.state === 'burrow' && B.st < 0.7) || B.state === 'erupt' || B.state === 'intro') && Math.abs(p.x - B.tx) < 2.4) return 'flee';
        if (B.k === 'gravemaw' && B.h > 0.5 && Math.abs(p.x - B.x) < 1.8) return 'flee';
        if (B.k === 'brood' && B.state === 'charge' && B.st <= 0 && Math.sign(p.x - B.x) === B.face && Math.abs(p.x - B.x) < 4.4) return 'jump';
    }
    for (const h of G.hazards) {
        if (h.k === 'beam' && h.warn < 0.35) return h.y > 3 ? 'duck' : 'jump';
        if (h.k === 'wave' && Math.sign(p.x - h.x) === h.dir && Math.abs(p.x - h.x) < 2.6) return 'jump';
    }
    for (const e of G.enemies) {
        if (e.dead) continue;
        if ((e.k === 'brute' && e.state === 'charge' && Math.sign(p.x - e.x) === e.face && Math.abs(p.x - e.x) < 3.2) ||
            ((e.k === 'skitter' || e.k === 'hiveling') && e.leaping && Math.abs(p.x - e.x) < 1.8 && Math.abs(p.y - e.y) < 1.5)) return 'jump';
    }
    return shotDodge(G, p);
}

/** How many enemy shots would hit the player over the next 0.7 s if it did `m`? */
function hitsIf(G, p, m) {
    let n = 0;
    const h = m.duck ? 1.05 : 1.7;
    for (const b of G.ebul) {
        for (let t = 0.05; t <= 0.7; t += 0.05) {
            const bx = b.x + b.vx * t, by = b.y + b.vy * t - 0.5 * b.g * t * t;
            const px = p.x + m.vx * t;
            const py = m.jump ? p.y + Math.max(0, PLAYER.jump * t - 0.5 * PLAYER.gravity * t * t) : p.y;
            if (Math.abs(bx - px) < 0.35 + b.r && by > py - b.r && by < py + h + b.r) { n += 1 + (0.7 - t); break; }
        }
    }
    return n;
}

const MOVES = [
    { id: 'stay', vx: 0 }, { id: 'dodgeL', vx: -PLAYER.speed }, { id: 'dodgeR', vx: PLAYER.speed },
    { id: 'jump', vx: 0, jump: true }, { id: 'duck', vx: 0, duck: true },
    { id: 'jumpL', vx: -PLAYER.speed * 0.6, jump: true }, { id: 'jumpR', vx: PLAYER.speed * 0.6, jump: true },
];

function shotDodge(G, p) {
    if (!G.ebul.length) return null;
    const stay = hitsIf(G, p, MOVES[0]);
    if (stay === 0) return null;
    let best = null, bs = stay;
    const a = G.level.arena;
    for (const m of MOVES.slice(1)) {
        if (a && G.arenaLocked && ((m.vx < 0 && p.x < a.x0 + 1.5) || (m.vx > 0 && p.x > a.x1 - 1.5))) continue;
        const n = hitsIf(G, p, m);
        if (n < bs - 0.05) { bs = n; best = m.id; }
    }
    return best;
}

/** Something short on the ground in front: crouch and shoot it (the standing shot flies over). */
function lowTarget(G, p) {
    for (const e of G.enemies) {
        if (e.dead || e.h > 0.95 || e.k === 'wisp' || e.k === 'missile') continue;
        const dx = e.x - p.x;
        if (Math.abs(dx) < 8 && Math.abs(dx) > 0.6 && Math.abs(e.y - p.y) < 0.3) return dx;
    }
    return 0;
}

export function botInput(G, bot) {
    const p = G.player;
    const inp = { x: 0, y: 0, jump: false, jumpHeld: false, fire: false, flare: false };
    if (p.dead || G.phase !== 'play') return inp;
    const L = G.level;
    const sk = bot.skill;
    const B = G.boss && !G.boss.dead ? G.boss : null;

    // ---- in the air: follow the plan
    if (!p.ground && bot.plan) {
        // check the plan still lands somewhere safe; if not, steer to wherever does
        bot.recheck = (bot.recheck || 0) - 1;
        if (bot.recheck <= 0) {
            bot.recheck = 6;
            if (!tryJump(L, p, bot.plan.hold, 2, p.vy)) {
                for (const h of [1, 0.6, 0.3, 0, -0.3, -0.6, -1]) if (tryJump(L, p, h, 2, p.vy)) { bot.plan.hold = h; break; }
            }
        }
        inp.x = bot.plan.hold;
        inp.jumpHeld = true;
        const t = nearestThreat(G, p, 10);
        if (t) { inp.fire = true; const a = aimStick(t.dx, t.dy); if (a.y && !bot.plan.lockAim) inp.y = a.y; }
        return inp;
    }
    if (p.ground) bot.plan = null;
    else if (!bot.plan) bot.plan = { hold: 0, lockAim: false };

    // ---- dodge what is coming (a mortal bot sometimes reacts late)
    bot.react -= 1 / 120;
    const danger = dangerLow(G, p);
    if (danger && bot.react <= 0 && bot.rng() < 0.08 + 0.9 * sk) {
        if (danger === 'duck') { inp.y = -1; inp.fire = true; return inp; }
        if (danger === 'dodgeL' || danger === 'dodgeR') { inp.x = danger === 'dodgeL' ? -1 : 1; inp.fire = true; return inp; }
        if (danger === 'jumpL' || danger === 'jumpR') {
            const hold = danger === 'jumpL' ? -0.6 : 0.6;
            inp.jump = inp.jumpHeld = true; inp.x = hold;
            bot.plan = { hold, lockAim: false };
            bot.react = 0.2 + (1 - sk) * 0.5;
            return inp;
        }
        if (danger === 'flee') {
            const a = L.arena;
            const bx = B.h > 0.5 ? B.x : B.tx;
            let dir = p.x < bx ? -1 : 1;
            // cornered: dash past it while it is still under the floor
            if ((dir < 0 && p.x < a.x0 + 2.5) || (dir > 0 && p.x > a.x1 - 2.5)) dir = B.h > 0.5 ? 0 : -dir;
            inp.x = dir;
            inp.fire = B.h > 0.5;
            return inp;
        }
        if (danger === 'jump') {
            const hold = B ? (p.x > (L.arena.x0 + L.arena.x1) / 2 ? -0.5 : 0.5) : 0;
            inp.jump = true; inp.jumpHeld = true; inp.x = hold;
            bot.plan = { hold, lockAim: false };
            bot.react = 0.25 + (1 - sk) * 0.5;
            return inp;
        }
    } else if (danger && bot.react <= 0) bot.react = 0.3;

    const threat = nearestThreat(G, p);
    // ---- boss fight: keep a distance, face it, fire
    if (B && G.arenaLocked) {
        const a = L.arena;
        let want = B.k === 'queen' ? Math.max(a.x0 + 2, B.x - 11) : B.x + (p.x < B.x ? -7 : 7);
        if (B.k === 'warden') want = B.x + (p.x < B.x ? -4 : 4);
        if (B.k === 'gravemaw') {
            const roomL = B.x - a.x0, roomR = a.x1 - B.x;
            const side = p.x < B.x ? -1 : 1;
            want = B.h > 0.5 ? B.x + side * Math.min(6, (side < 0 ? roomL : roomR) - 1) : (a.x0 + a.x1) / 2 + (p.x < (a.x0 + a.x1) / 2 ? -3 : 3);
        }
        want = Math.max(a.x0 + 1.5, Math.min(a.x1 - 1.5, want));
        if (B.k !== 'gravemaw' && Math.abs(want - p.x) > 4 && (want < a.x0 + 2 || want > a.x1 - 2)) want = p.x < B.x ? a.x1 - 2 : a.x0 + 2;
        const dir = Math.abs(want - p.x) > 1 ? Math.sign(want - p.x) : 0;
        if (threat) {
            const s = aimStick(threat.dx, threat.dy);
            inp.fire = true;
            inp.x = s.x || dir;
            inp.y = s.y > 0 ? 1 : 0;
            if (s.y > 0 && s.x === 0) inp.x = 0;
            if (dir && Math.sign(dir) !== Math.sign(s.x) && Math.abs(want - p.x) > 2.5) { inp.x = dir; inp.y = s.y > 0 ? 1 : 0; }
        } else inp.x = dir;
        const low = lowTarget(G, p);
        if (low && Math.abs(low) < 6) { inp.x = Math.sign(low) * 0.3; inp.y = -1; inp.fire = true; }
        if (bot.flareT > 0) bot.flareT -= 1 / 120;
        if (bot.flareT <= 0 && p.flares > 0 && B.vulnerable && Math.abs(B.x - p.x) < 9 && sk > 0.5) { inp.flare = true; bot.flareT = 6; }
        return inp;
    }

    // ---- everywhere else: run right, shoot what's near
    let dir = 1;
    // vents: wait for the steam to stop
    for (const v of G.vents) {
        const d = v.x - p.x;
        if (d > 0 && d < 2.2 && (v.on || v.warn || v.t > 1.0)) dir = 0;
    }
    if (threat && threat.dx < -0.5 && Math.abs(threat.dx) < 5) dir = -0.0001;     // something behind: turn and shoot
    if (threat) {
        inp.fire = bot.rng() < 0.5 + 0.5 * sk;
        const s = aimStick(threat.dx, threat.dy);
        if (dir < 0.01 && dir !== 0) { inp.x = -1; inp.y = s.y > 0 ? 1 : 0; dir = 0; }
        else if (s.y > 0) inp.y = 1;
        else if (s.y < 0 && Math.abs(threat.dx) < 1.5 && threat.dy < -1) inp.y = -1;
        if (s.y > 0 && s.x === 0) {
            // straight up: line up under it first
            if (Math.abs(threat.dx) > 0.35) { inp.x = Math.sign(threat.dx); inp.y = 0; }
            else inp.x = 0;
            dir = 0;
        }
        const low = lowTarget(G, p);
        if (low && Math.abs(low) < 5) { inp.y = -1; inp.x = Math.sign(low) * 0.3; dir = 0; }   // crouch for low ones
        if (threat.dx > 0 && threat.dx < 2.5 && Math.abs(threat.dy) < 1.2 && !(G.enemies.length === 0)) dir = 0;   // don't walk into it
    }
    if (dir > 0) {
        inp.x = 1;
        if (needJump(G, p, 1)) {
            // plan a jump with the real body mover
            for (const hold of [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2]) {
                const land = tryJump(L, p, hold);
                if (land && land.x > p.x + 0.6) {
                    inp.jump = inp.jumpHeld = true; inp.x = hold;
                    bot.plan = { hold, lockAim: true };
                    break;
                }
            }
            // nothing lands yet: shuffle to the edge first, but never off it
            if (!inp.jump) inp.x = standable(L, Math.floor(p.x + 0.6), p.y) ? 0.25 : 0;
        }
    }
    // stuck: try a plain jump
    if (Math.abs(p.x - bot.stuckX) > 0.5) { bot.stuckX = p.x; bot.stuckT = 0; }
    else if (dir > 0 && (bot.stuckT += 1 / 120) > 2.5) { inp.jump = inp.jumpHeld = true; inp.x = 1; bot.plan = { hold: 1, lockAim: true }; bot.stuckT = 0; }
    return inp;
}
