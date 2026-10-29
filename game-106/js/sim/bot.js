// An auto-player. It plays through the same input the player uses, so the tests, the balance
// table and the attract-mode demo on the title screen all exercise the real rules. Pure, like the
// rest of js/sim.
//
// It steers by a potential field: robots, bolts, the Grinner and the electrified walls push it
// away, the nearest chip pulls it in. skill scales its speed and, below 1, it stops reading bolts.

import { FIELD, PLAYER, ROBOTS, GRINNER } from '../config.js';

export function makeBot({ skill = 1 } = {}) {
    return { skill };
}

export function botInput(G, bot) {
    const p = G.player;
    let fx = 0, fy = 0, danger = 0;
    const away = (x, y, w) => {
        const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 0.01;
        fx += (dx / d) * w; fy += (dy / d) * w;
    };
    for (const r of G.robots) {
        const R = ROBOTS[r.kind];
        const gap = Math.hypot(r.x - p.x, r.y - p.y) - R.r - PLAYER.radius;
        if (gap > 6) continue;
        const w = (R.dmg / 10) / Math.max(0.25, gap) ** 2;
        away(r.x, r.y, w);
        if (gap < 1.2) danger += R.dmg / 10;
    }
    if (bot.skill >= 1) {
        for (const b of G.bolts) {
            const d = Math.hypot(b.x - p.x, b.y - p.y);
            if (d < 4) away(b.x, b.y, 1.5 / Math.max(0.3, d) ** 2);
        }
    }
    if (G.grinner) {
        const g = G.grinner, d = Math.hypot(g.x - p.x, g.y - p.y) - GRINNER.r;
        if (d < 14) away(g.x, g.y, 9 / Math.max(0.4, d));
        if (d < 2.5) danger += 3;
    }
    for (const w of G.walls) {
        const nx = Math.max(w.x, Math.min(p.x, w.x + w.w)), ny = Math.max(w.y, Math.min(p.y, w.y + w.h));
        const d = Math.hypot(p.x - nx, p.y - ny) - PLAYER.radius;
        if (d < 1.4) away(nx, ny, 0.9 / Math.max(0.12, d) ** 2);
    }
    // the edges of the room, and a gentle pull to the middle so it doesn't get cornered
    const edge = (d) => 0.6 / Math.max(0.2, d) ** 2;
    fx += edge(p.x) - edge(FIELD.w - p.x);
    fy += edge(p.y) - edge(FIELD.h - p.y);
    fx += (FIELD.w / 2 - p.x) * 0.02;
    fy += (FIELD.h / 2 - p.y) * 0.02;
    // the nearest chip, worth less the more danger there is
    let best = null, bd = 100;
    for (const c of G.chips) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } }
    if (best) {
        const pull = 1.2 / (1 + danger * 2);
        fx += ((best.x - p.x) / (bd || 1)) * pull;
        fy += ((best.y - p.y) / (bd || 1)) * pull;
    }
    const l = Math.hypot(fx, fy);
    if (l < 0.05) return { x: 0, y: 0, a: false };
    return { x: (fx / l) * bot.skill, y: (fy / l) * bot.skill, a: danger > 1.5 && p.dashCool <= 0 };
}

const PREFER = ['split', 'rate', 'power', 'orbit', 'pierce', 'pulse', 'armor', 'magnet', 'speed', 'repair'];

/** Which of G.choice.options the bot would take. */
export function botChoose(G) {
    const opts = G.choice?.options || [];
    const low = G.player.hp < G.player.maxHp * 0.4;
    const order = low ? ['repair', 'armor', ...PREFER] : PREFER;
    for (const id of order) { const i = opts.indexOf(id); if (i >= 0) return i; }
    return 0;
}
