// An auto-player. It plays through the same input the player uses, so the tests, the balance
// table and the attract-mode demo all exercise the real rules. Pure, like the rest of js/sim.
//
// On foot it turns to the most dangerous enemy, walks to a comfortable range, fires when the
// fireball will land and sidesteps missiles it sees coming. On the wing it shoots down firebolts
// first, then whatever is closest, and climbs or dives under the catwalks of the gorge.
// skill < 1 reacts late, aims loosely and sometimes forgets to dodge.

import { GROUND, FLIGHT, TRACKS } from '../config.js';
import { ENEMY, FOE } from './data.js';
import { obstaclesNear } from './world.js';
import { makeRng } from '../rng.js';
import { clamp, wrapA, bearing, fwdX, fwdZ } from './util.js';

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rng: makeRng(seed), target: null, wobble: 0, wobT: 0, think: 0, held: null, evade: 0, evadeDir: 1, obs: [] };
}

const THREAT = { lancer: 6, troll: 5, juggernaut: 4, dragonbane: 4, ballista: 3, wizard: 3, footman: 2, wisp: 0.5 };

function groundInput(G, bot) {
    const p = G.player, sk = bot.skill;
    const inp = { x: 0, y: 0, a: false, abs: false };
    if (G.phase === 'dead' || G.phase === 'ascend') return inp;

    // slow thinkers re-pick their target less often
    bot.think -= 1 / 120;
    if (bot.think <= 0 || !bot.target || !G.enemies.includes(bot.target)) {
        bot.think = 0.15 + (1 - sk) * 0.6;
        let best = null, bs = -Infinity;
        for (const e of G.enemies) {
            const d = Math.hypot(e.x - p.x, e.z - p.z);
            const b = Math.abs(bearing(p.x, p.z, p.h, e.x, e.z));
            const s = (THREAT[e.kind] || 1) * 10 - d * 0.25 - b * 6;
            if (s > bs) { bs = s; best = e; }
        }
        bot.target = best;
    }
    bot.wobT -= 1 / 120;
    if (bot.wobT <= 0) { bot.wobT = 0.4; bot.wobble = (bot.rng() - 0.5) * (1 - sk) * 0.5; }

    // missiles on a collision course: step out of their line
    let danger = null;
    for (const f of G.foes) {
        const rvx = f.vx, rvz = f.vz;
        const dx = p.x - f.x, dz = p.z - f.z;
        const v2 = rvx * rvx + rvz * rvz || 1;
        const tc = (dx * rvx + dz * rvz) / v2;
        if (tc < 0 || tc > 1.6) continue;
        const mx = f.x + rvx * tc - p.x, mz = f.z + rvz * tc - p.z;
        if (Math.hypot(mx, mz) < f.r + GROUND.radius + 1.2) {
            if (FOE[f.kind].shootable && Math.abs(bearing(p.x, p.z, p.h, f.x, f.z)) < 0.12) continue; // we'll shoot it
            if (!danger || tc < danger.tc) danger = { f, tc };
        }
    }
    const reacts = bot.rng() < 0.4 + sk * 0.6;
    if (danger && bot.evade <= 0 && reacts) {
        // walk forward or back, whichever moves us across its path
        const f = danger.f;
        const side = (fwdX(p.h) * -f.vz + fwdZ(p.h) * f.vx);
        bot.evadeDir = side >= 0 ? 1 : -1;
        bot.evade = 0.7;
    }

    const e = bot.target;
    if (e) {
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        // lead a moving target
        const tt = d / GROUND.shotSpeed;
        const ex = e.x + fwdX(e.h) * (e.speed || 0) * tt, ez = e.z + fwdZ(e.h) * (e.speed || 0) * tt;
        const b = bearing(p.x, p.z, p.h, ex, ez) + bot.wobble;
        inp.x = clamp(b * 4, -1, 1);
        const want = e.kind === 'troll' || e.kind === 'lancer' ? 26 : e.kind === 'dragonbane' ? 40 : 28;
        if (Math.abs(b) < 0.9) inp.y = d > want + 6 ? -1 : d < want - 8 ? 0.8 : 0;
        const tol = Math.atan2(ENEMY[e.kind].r * 0.8, d) * (0.6 + sk * 0.4);
        if (Math.abs(b) < tol && d < GROUND.shotRange - 4) inp.a = true;
    } else {
        inp.y = -0.4;
        inp.x = 0.3;
    }
    // shoot down an orb in front
    for (const f of G.foes) {
        if (FOE[f.kind].shootable && Math.abs(bearing(p.x, p.z, p.h, f.x, f.z)) < 0.05) inp.a = true;
    }
    if (bot.evade > 0) {
        bot.evade -= 1 / 120;
        inp.y = -bot.evadeDir;
    }
    // walk around standing stones instead of into them
    if (inp.y < 0) {
        obstaclesNear(G.seed, p.x, p.z, 10, bot.obs);
        for (const o of bot.obs) {
            const b = bearing(p.x, p.z, p.h, o.x, o.z);
            const d = Math.hypot(o.x - p.x, o.z - p.z) - o.r;
            if (d < 5 && Math.abs(b) < 0.8) { inp.x = b > 0 ? -1 : 1; inp.y = -0.4; }
        }
    }
    return inp;
}

function aimFor(G, x, y, z) {
    const p = G.player, rz = z - G.fl.dist;
    return {
        ax: Math.atan2(x - p.px, rz) / FLIGHT.aimYaw,
        ay: Math.atan2(y - p.py, rz) / FLIGHT.aimPitch,
    };
}

function flightInput(G, bot) {
    const p = G.player, fl = G.fl, sk = bot.skill, T = TRACKS[fl.track];
    const inp = { x: 0, y: 0, a: false, abs: true };
    if (G.phase === 'dead') return inp;
    let target = null, best = Infinity;
    // firebolts first (they hurt), then the nearest thing worth shooting
    for (const f of G.foes) {
        const rz = f.z - fl.dist;
        if (rz < 6) continue;
        const s = rz * 0.6;
        if (s < best) { best = s; target = f; }
    }
    if (!target || best > 40) {
        for (const e of G.enemies) {
            const rz = e.z - fl.dist;
            if (rz < 12 || rz > 240) continue;
            const s = rz + (e.kind === 'wardstone' ? -500 : 0);
            if (s < best) { best = s; target = e; }
        }
    }
    let ax = 0, ay = 0;
    if (target) {
        const rz = target.z - fl.dist;
        const tt = Math.hypot(target.x - p.px, target.y - p.py, rz) / FLIGHT.shotSpeed;
        const vx = target.vx || 0, vy = target.vy || 0, vz = (target.vz || 0) - (target.kind === 'griffon' ? 0 : FLIGHT.speed);
        const a = aimFor(G, target.x + vx * tt, target.y + vy * tt, target.z + vz * tt);
        ax = a.ax; ay = a.ay;
        const err = Math.hypot((p.ax - ax) * FLIGHT.aimYaw, (p.ay - ay) * FLIGHT.aimPitch) * rz;
        if (err < (ENEMY[target.kind]?.r ?? target.r ?? 1) * (0.5 + sk * 0.5) + 0.4 && rz < 260) inp.a = true;
    }
    // keep the body clear of the catwalks: they matter more than any shot
    if (fl.track === 'gorge') {
        for (const w of fl.walks) {
            const rz = w.z - fl.dist;
            if (rz < -2 || rz > 70) continue;
            const safeY = w.y < 7 ? w.y + 6 : w.y > 12 ? w.y - 6 : (p.py > w.y ? w.y + 5.5 : w.y - 5.5);
            ay = (clamp(safeY, T.base - T.latY + 0.3, T.base + T.latY - 0.3) - T.base) / T.latY;
            break;
        }
    }
    if (fl.track === 'ramparts') {
        // fly above the shafts of the towers ahead
        for (const e of G.enemies) {
            const rz = e.z - fl.dist;
            if (e.th && rz > -2 && rz < 25 && Math.abs(e.x - p.px) < 5) ay = Math.max(ay, ((e.th + 3) - T.base) / T.latY);
        }
    }
    const wob = (1 - sk) * 0.35;
    bot.wobT -= 1 / 120;
    if (bot.wobT <= 0) { bot.wobT = 0.3; bot.wobble = (bot.rng() - 0.5) * wob; }
    inp.x = clamp(ax + bot.wobble, -1, 1);
    inp.y = -clamp(ay, -1, 1);
    return inp;
}

export function botInput(G, bot) {
    return G.mode === 'ground' ? groundInput(G, bot) : flightInput(G, bot);
}

// re-export for the tests' convenience
export { wrapA };
