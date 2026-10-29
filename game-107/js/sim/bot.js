// An auto-player. It plays through the same input the player uses, so the tests, the balance
// table and the title screen's attract mode all exercise the real rules. Pure, like the rest of js/sim.

import { bHeight } from './data.js';

export function makeBot({ skill = 1 } = {}) {
    return { skill, target: null, until: 0, wob: 0, tick: 0 };
}

const dist = Math.hypot;

function nearestTarget(G, p) {
    let best = null, bs = Infinity;
    for (const o of G.buildings) {
        if (o.dead) continue;
        // prefer what is near and what is worth hitting; tiny bridge bits last
        const d = dist(o.x - p.x, o.y - p.y);
        const score = d - 0.04 * o.hp - (o.t === 'deck' ? -6 : 0);
        if (score < bs) { bs = score; best = o; }
    }
    return best;
}

/** One step of input for the ball. */
export function botInput(G, bot) {
    const out = { x: 0, y: 0, a: false };
    if (G.phase !== 'play') return out;
    const p = G.ball;
    bot.tick++;

    // pick (and stick to) a target
    const lowHp = p.hp < p.maxHp * 0.45;
    if (!bot.target || bot.target.dead || bot.tick > bot.until) {
        bot.target = nearestTarget(G, p);
        bot.until = bot.tick + 120 * 5;
    }
    let tx, ty;
    let heal = null;
    if (lowHp) {
        let hd = 40;
        for (const t of G.things) if ((t.k === 'cart' || t.k === 'pizza') && dist(t.x - p.x, t.y - p.y) < hd) { hd = dist(t.x - p.x, t.y - p.y); heal = t; }
        for (const k of G.pickups) if ((k.k === 'heart' || k.k === 'shield') && dist(k.x - p.x, k.y - p.y) < hd) { hd = dist(k.x - p.x, k.y - p.y); heal = k; }
    }
    // loose power-ups nearby are worth a detour
    let pick = null, pd = 14;
    for (const k of G.pickups) { const d = dist(k.x - p.x, k.y - p.y); if (d < pd) { pd = d; pick = k; } }
    const t = heal || pick || bot.target;
    if (!t) return out;
    tx = t.x; ty = t.y;
    if (t === bot.target) {
        // aim at the near face of a box, so the ball bounces rather than sliding past
        const dx = p.x - t.x, dy = p.y - t.y;
        if (t.shape === 'box') {
            const ax = Math.abs(dx) - t.w / 2, ay = Math.abs(dy) - t.d / 2;
            if (ax > ay) tx = t.x + Math.sign(dx) * t.w / 2; else ty = t.y + Math.sign(dy) * t.d / 2;
        }
    }

    let dx = tx - p.x, dy = ty - p.y;
    const d = dist(dx, dy) || 1;
    // a little wander so a poor bot is sloppy and a good one is precise
    bot.wob += 0.02 + (1 - bot.skill) * 0.04;
    const ang = Math.atan2(dy, dx) + Math.sin(bot.wob) * (1 - bot.skill) * 0.9;
    out.x = Math.cos(ang) * Math.min(1, bot.skill + 0.2);
    out.y = Math.sin(ang) * Math.min(1, bot.skill + 0.2);

    if (p.cd <= 0 && !p.air) {
        const R = p.r * 2.2 + 1.6;
        // slam when a building is within reach of the shockwave
        let near = 0;
        for (const o of G.buildings) {
            if (o.dead) continue;
            const ddx = Math.max(Math.abs(p.x - o.x) - (o.w || 0) / 2, 0), ddy = Math.max(Math.abs(p.y - o.y) - (o.d || 0) / 2, 0);
            const dd = o.shape === 'circle' ? Math.max(0, dist(p.x - o.x, p.y - o.y) - o.r) : dist(ddx, ddy);
            if (dd < R * 0.7) near++;
        }
        if (near >= 2 || (near >= 1 && d < R)) out.a = true;
        // dodge anything fast and close
        for (const s of G.shots) {
            const sd = dist(s.x - p.x, s.y - p.y);
            if (sd < 4.2 && (s.vx * (p.x - s.x) + s.vy * (p.y - s.y)) > 0 && bot.skill > 0.5) out.a = true;
        }
        // swat a helicopter
        for (const f of G.foes) if (f.k === 'heli' && dist(f.x - p.x, f.y - p.y) < p.r + 2.2) out.a = true;
        // flatten a tank
        for (const f of G.foes) if (f.k === 'tank' && dist(f.x - p.x, f.y - p.y) < R * 0.8) out.a = true;
    }
    void bHeight;
    return out;
}
