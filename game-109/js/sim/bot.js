// An auto-player. It plays through the same input the player uses, so the tests, the balance table
// and the attract-mode demo behind the title all exercise the real rules. Pure, like the rest of
// js/sim. It dodges by scoring nine candidate moves against where the bullets and enemies will be
// a fraction of a second from now, lines its guns up under the nearest enemy, grabs power-ups when
// it is safe to, and sets off a bomb when no move is safe.
//
// skill 1 looks 0.26 s ahead and re-decides every 0.08 s; lower skills look less far and react later
// (a move is held between decisions, up to half a second at skill 0.2), so they get hit more.

import { FIELD, PLAYER } from '../config.js';

const W = FIELD.w, H = FIELD.h;
const DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.71, 0.71], [-0.71, 0.71], [0.71, -0.71], [-0.71, -0.71]];

export function makeBot({ skill = 1, bombs = true } = {}) {
    return { skill, bombs, hold: 0, last: null, n: 0 };
}

/** How dangerous is standing at (x, y) at time `tt` seconds from now? */
function danger(G, x, y, tt, bot) {
    let d = 0;
    const reach = PLAYER.r + 5 + 3 * bot.skill;
    for (const b of G.ebullets) {
        const bx = b.x + b.vx * tt, by = b.y + b.vy * tt;
        const dist = Math.hypot(bx - x, by - y);
        if (dist < reach) d += 40 * (reach - dist + 1);
        else if (dist < reach + 8) d += 4;
    }
    for (const e of G.enemies) {
        if (e.dead || e.inv || e.y < -10) continue;
        const ex = e.x + (e.vx || 0) * tt, ey = e.y + (e.vy || 0) * tt;
        const rr = e.r + PLAYER.bodyR + 5;
        if (e.parts) {
            for (const q of e.parts) { const dist = Math.hypot(ex + q.dx - x, ey + q.dy - y); if (dist < q.r + PLAYER.bodyR + 5) d += 50 * (q.r + PLAYER.bodyR + 6 - dist); }
        } else {
            const dist = Math.hypot(ex - x, ey - y);
            if (dist < rr) d += 50 * (rr - dist + 1);
        }
        // the beam's warning line already marks where the light will fall (20 px wide)
        if (e.beam && Math.abs(x - e.beam.x) < 10 + 9 && y > e.y) d += e.beam.on ? 400 : 120;
    }
    return d;
}

export function botInput(G, bot) {
    const p = G.player;
    if (!p.alive) return { x: 0, y: 0, fire: false, bomb: false };
    bot.n++;
    // reaction time: decide every so often and hold that move in between (0.08 s at skill 1, 0.5 s at 0.2)
    if (bot.hold > 0 && bot.last) { bot.hold--; return { ...bot.last, bomb: false }; }
    bot.hold = Math.round(9 + (1 - bot.skill) * 56);
    bot.last = decide(G, bot);
    return bot.last;
}

function decide(G, bot) {
    const p = G.player;

    // where to stand: under the most useful target
    let target = null, best = Infinity;
    for (const e of G.enemies) {
        if (e.dead || e.y < 4 || e.y > p.y - 6) continue;
        const score = Math.abs(e.x - p.x) * 0.7 + (p.y - e.y) * 0.25 - (e.boss ? 40 : 0);
        if (score < best) { best = score; target = e; }
    }
    const tx = target ? target.x : W / 2;
    const ty = H - 66;

    // power-ups worth a detour
    let pu = null, pd = 70;
    for (const u of G.powerups) {
        const d = Math.hypot(u.x - p.x, u.y - p.y);
        if (d < pd && u.y > 30) { pd = d; pu = u; }
    }

    const speed = PLAYER.speed + PLAYER.speedStep * p.speed;
    const look = 0.16 + 0.1 * bot.skill;
    let bestI = 0, bestS = -Infinity, bestDanger = 0;
    for (let i = 0; i < DIRS.length; i++) {
        const [dx, dy] = DIRS[i];
        const nx = Math.max(PLAYER.margin, Math.min(W - PLAYER.margin, p.x + dx * speed * look));
        const ny = Math.max(PLAYER.minY, Math.min(H - 12, p.y + dy * speed * look));
        let dng = 0;
        for (const f of [0.34, 0.67, 1]) {
            const qx = p.x + (nx - p.x) * f, qy = p.y + (ny - p.y) * f;
            dng += danger(G, qx, qy, look * f, bot);
        }
        let s = -dng * 3;
        s -= Math.abs(nx - tx) * (target ? 0.5 : 0.1);
        s -= Math.abs(ny - ty) * 0.18;
        if (nx < 22 || nx > W - 22) s -= 14;                   // keep out of the corners
        if (pu) s -= Math.hypot(pu.x - nx, pu.y - ny) * 0.55;
        if (dx === 0 && dy === 0) s += 1.5;                    // hold still when nothing is worth it
        if (s > bestS) { bestS = s; bestI = i; bestDanger = dng; }
    }

    const dir = DIRS[bestI];

    // out of safe moves: a bomb
    const bomb = bot.bombs && G.bombs > 0 && !G.bombFx && bestDanger > 700 + 500 * (1 - bot.skill) && p.inv <= 0;

    return { x: dir[0], y: dir[1], fire: true, bomb };
}
