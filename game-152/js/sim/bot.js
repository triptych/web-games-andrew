// An auto-player. It plays through the same input the player uses, so the tests, the balance table and the
// attract-mode demo all exercise the real rules. Pure, like the rest of js/sim.
//
// Each decision it tries a handful of lanes across the river, plays each forward ~1 s against the bullets, lasers,
// boats, mines, booms, banks and sandbars it can see, and steers for the safest lane nearest its goal (fuel when
// low, a pickup, the next thing to shoot). When every lane is bad and something is about to hit, it jumps.
//
// skill (0..1): how many bullets it notices, how often it re-decides (reaction time), and whether it remembers
// to jump.

import { BOAT, JUMP, BOOSTS } from '../config.js';
import { ENEMIES } from './data.js';
import { riverAt } from './river.js';
import { hash3 } from '../rng.js';
import { partPos, shielded } from './bosses.js';

const CANDS = [-10, -7, -5, -3, -1.5, 0, 1.5, 3, 5, 7, 10];

export function makeBot({ skill = 1, seed = 1 } = {}) {
    return { skill, seed, wait: 0, tx: null, fire: true, jump: false, missile: false, y: 0 };
}

const sees = (bot, id) => hash3(id, bot.seed, 7) < 0.3 + 0.7 * bot.skill;

export function botInput(G, bot, dt = 1 / 120) {
    const b = G.boat;
    if (G.over || G.phase === 'dock') return { x: 0, y: 0, fire: false, jump: false, missile: false };
    bot.wait -= dt;
    if (bot.wait <= 0 || bot.tx === null) {
        decide(G, bot);
        bot.wait = 0.05 + (1 - bot.skill) * 0.22;
    }
    const out = {
        x: Math.max(-1, Math.min(1, (bot.tx - b.x) * 0.55 - b.vx * 0.04)),
        y: bot.y, fire: bot.fire, jump: bot.jump, missile: bot.missile,
    };
    bot.jump = false;
    bot.missile = false;
    return out;
}

function decide(G, bot) {
    const b = G.boat;
    const R = G.river;
    const goal = goalX(G, bot);
    let best = null, bestScore = Infinity, bestPen = Infinity, minPen = Infinity, soon = Infinity;
    for (const dx of CANDS) {
        const { pen, first } = danger(G, bot, b.x + dx);
        const score = pen * 100 + Math.abs(b.x + dx - goal) * 0.6 + Math.abs(dx) * 0.08;
        if (score < bestScore) { bestScore = score; best = b.x + dx; bestPen = pen; }
        if (pen < minPen) minPen = pen;
        if (pen > 0) soon = Math.min(soon, first);
    }
    bot.tx = best;
    // jump when nothing is safe and it is close, or a boom / mine / sandbar is dead ahead
    const ahead = blockedAhead(G, b.x);
    const wantJump = (bestPen > 0 && minPen > 0 && soon < 0.38) || ahead;
    if (wantJump && b.charge >= 1 && b.z <= 0 && hash3(Math.floor(G.t * 10), bot.seed, 3) < 0.4 + 0.6 * bot.skill) bot.jump = true;

    // throttle: slow over a depot when the tank wants it; otherwise cruise
    bot.y = 0;
    const depot = nearestDepot(G);
    if (b.fuel < 85 && depot && depot.y - b.y < 12 && depot.y > b.y - 2 && Math.abs(depot.x - b.x) < 3) bot.y = 1;
    // don't shoot the depot we are steering for
    bot.fire = !(b.fuel < 70 && depot && Math.abs(depot.x - b.x) < 3.2 && depot.y - b.y < 60);
    // missiles: on the boss, or on something tough ahead
    if (b.missiles >= 1) {
        if (G.boss && !G.boss.entering && G.boss.parts.some((p) => !p.dead && !shielded(G, p))) bot.missile = b.missiles >= 2 || b.missileT > 0;
        else if (G.enemies.some((e) => (e.kind === 'gunboat' || e.kind === 'barge' || e.kind === 'turret') && e.y - b.y < 45 && e.y > b.y + 8)) bot.missile = true;
    }
}

function nearestDepot(G) {
    const b = G.boat;
    let best = null;
    for (const e of G.enemies) if (e.kind === 'depot' && e.y > b.y - 3 && (!best || e.y < best.y)) best = e;
    return best;
}

/** Where the bot would like to be across the river, ignoring danger. */
function goalX(G, bot) {
    const b = G.boat;
    const R = G.river;
    const r = riverAt(R, b.y + 16);
    let goal = r.cx;
    if (r.isl > 0) goal = r.cx + Math.sign(b.x - r.cx || 1) * (r.isl + (r.hw - r.isl) / 2);
    const depot = nearestDepot(G);
    if (b.fuel < 62 && depot && depot.y - b.y < 90) return depot.x;
    const cell = G.pickups.find((p) => p.kind === 'cell' && p.y > b.y && p.y - b.y < 60);
    if (b.fuel < 50 && cell) return cell.x;
    // a pickup in reach
    let pk = null;
    for (const p of G.pickups) {
        if (p.y < b.y + 2 || p.y - b.y > 40 || Math.abs(p.x - b.x) > 13) continue;
        if (p.kind === 'repair' && b.hull > G.stats.maxHull - 20) continue;
        if (!pk || p.y < pk.y) pk = p;
    }
    if (pk) return pk.x;
    // line up a shot
    if (G.boss && !G.boss.entering) {
        const live = G.boss.parts.filter((p) => !p.dead && !shielded(G, p));
        const tgt = live.find((p) => p.role !== 'core') || live[0];
        if (tgt) return partPos(G.boss, tgt).x;
        return G.boss.x;
    }
    let tgt = null;
    for (const e of G.enemies) {
        if (e.kind === 'depot' || ENEMIES[e.kind].where === 'bank' || e.y < b.y + 10 || e.y - b.y > 55) continue;
        if (e.kind === 'raider' && e.mode === 'charge') continue;
        if (!tgt || e.y < tgt.y) tgt = e;
    }
    if (tgt) return tgt.x;
    return goal;
}

/** Is there a boom, a mine or a sandbar right in front that we can't steer round in time? */
function blockedAhead(G, x) {
    const b = G.boat;
    const look = b.speed * 0.3;
    for (const e of G.enemies) {
        const dy = e.y - b.y;
        if (dy < 0 || dy > look + 2) continue;
        if (e.kind === 'blockade') {
            const gapX = e.gap == null ? null : e.x + e.gap * e.w;
            if (gapX == null || Math.abs(x - gapX) > 2.6) return true;
        }
        if (e.kind === 'mine' && Math.abs(e.x - x) < ENEMIES.mine.r + BOAT.radius + 0.4) return true;
    }
    const r = riverAt(G.river, b.y + look);
    if (r.isl > 0 && Math.abs(x - r.cx) < r.isl + BOAT.radius) return true;
    return false;
}

/** Penalty for steering toward x over the next second, and when the first trouble arrives. */
function danger(G, bot, tx) {
    const b = G.boat;
    const R = G.river;
    let pen = 0, first = Infinity;
    const air = b.z >= JUMP.clear;
    const T = 1.0, dtS = 0.1;
    let x = b.x;
    for (let t = dtS; t <= T + 1e-6; t += dtS) {
        x += Math.max(-BOAT.lateralMax * dtS, Math.min(BOAT.lateralMax * dtS, tx - x));
        const y = b.y + b.speed * t;
        // will we be in the air then?
        const zt = b.z > 0 || b.vz > 0 ? b.z + b.vz * t - 0.5 * JUMP.gravity * t * t : 0;
        const low = zt < JUMP.clear;
        let p = 0;
        const r = riverAt(R, y);
        if (Math.abs(x - r.cx) > r.hw - BOAT.radius - 0.6) p += 1;
        if (low && r.isl > 0 && Math.abs(x - r.cx) < r.isl + BOAT.radius + 0.5) p += 1;
        if (low && b.overdriveT <= t) {
            for (const q of G.bullets) {
                if (!sees(bot, q.id)) continue;
                const qx = q.x + q.vx * t, qy = q.y + q.vy * t;
                if (Math.hypot(qx - x, qy - y) < q.r + BOAT.radius + 0.7) p += 1;
            }
            for (const l of G.lanes) {
                const live = l.t + t >= l.tele && l.t + t <= l.tele + l.dur;
                if (live && Math.abs(x - l.x) < l.w / 2 + BOAT.radius + 0.6) p += 2;
            }
            for (const e of G.enemies) {
                const d = ENEMIES[e.kind];
                if (e.kind === 'depot' || d.where === 'bank') continue;
                const ey = e.y + e.vy * t, ex = e.x + e.vx * t;
                if (e.kind === 'blockade') {
                    if (Math.abs(ey - y) < 1.6) {
                        const gapX = e.gap == null ? null : e.x + e.gap * e.w;
                        if (gapX == null || Math.abs(x - gapX) > 2.4) p += 1;
                    }
                    continue;
                }
                if (Math.hypot(ex - x, ey - y) < d.r + BOAT.radius + 0.6) p += 1;
            }
            if (G.boss && !G.boss.dying) for (const pt of G.boss.parts) {
                if (pt.dead) continue;
                const pp = partPos(G.boss, pt);
                if (Math.hypot(pp.x - x, pp.y + b.speed * t - y) < pt.r + BOAT.radius + 0.8) p += 1;
            }
        }
        if (p > 0) {
            first = Math.min(first, t);
            pen += p * (1.3 - t * 0.6);        // sooner trouble counts more
        }
    }
    return { pen, first };
}
