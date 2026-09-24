// ============================================================
// Enemy behaviours. Pure: each one reads and writes plain objects and talks
// back to the game only through the `g` API (g.player, g.shootAt, g.spawnEnemy,
// g.moveEnemy, g.event, g.rng...). No DOM, no Math.random.
// ============================================================

import { TILE } from './config.js';

const sign = v => (v < 0 ? -1 : v > 0 ? 1 : 0);

function walker(speed, turnAtEdges) {
    return (e, g, dt) => {
        e.vx = e.dir * speed * (e.slow || 1);
        const r = g.moveEnemy(e, dt);
        if (r.wall) e.dir = -e.dir;
        if (turnAtEdges && e.onGround && !g.groundAhead(e)) e.dir = -e.dir;
    };
}

export const ENEMY = {
    bug: {
        w: 12, h: 12, hp: 1, stomp: true, score: 100,
        update: walker(28, false),
    },
    snail: {
        w: 12, h: 12, hp: 3, stomp: 'shell', score: 200,
        update(e, g, dt) {
            if (e.state === 'shell') {
                e.vx = 0; e.t += dt;
                g.moveEnemy(e, dt);
                if (e.t > 6) { e.state = 'walk'; e.t = 0; e.hop = 0.2; }
                return;
            }
            if (e.state === 'slide') {
                e.vx = e.dir * 210;
                const r = g.moveEnemy(e, dt);
                if (r.wall) { e.dir = -e.dir; g.event('sfx', { name: 'bump' }); }
                g.shellHits(e);
                return;
            }
            walker(22, true)(e, g, dt);
        },
    },
    frog: {
        w: 12, h: 12, hp: 2, stomp: true, score: 200,
        update(e, g, dt) {
            e.t += dt;
            if (e.onGround) {
                e.vx = 0;
                if (e.t > 1.1) {
                    e.t = 0;
                    e.dir = sign(g.player.x - e.x) || e.dir;
                    e.vx = e.dir * 62; e.vy = -250;
                    e.onGround = false;
                }
            }
            const r = g.moveEnemy(e, dt);
            if (r.wall) { e.dir = -e.dir; e.vx = -e.vx; }
        },
    },
    bee: {
        w: 12, h: 12, hp: 1, stomp: true, score: 200, fly: true,
        update(e, g, dt) {
            e.t += dt;
            if (e.baseX === undefined) { e.baseX = e.x; e.baseY = e.y; }
            e.x = e.baseX + Math.sin(e.t * 1.1) * 40;
            e.y = e.baseY + Math.sin(e.t * 3.3) * 10;
            e.dir = Math.cos(e.t * 1.1) >= 0 ? 1 : -1;
        },
    },
    prickle: {
        w: 12, h: 12, hp: 2, stomp: false, score: 200,
        update: walker(24, true),
    },
    shroom: {
        w: 12, h: 12, hp: 2, stomp: true, score: 200,
        update(e, g, dt) {
            e.t += dt;
            e.vx = 0;
            g.moveEnemy(e, dt);
            e.dir = sign(g.player.x - e.x) || 1;
            if (e.t > 2.6 && g.near(e, 180)) {
                e.t = 0; e.puff = 0.25;
                const dx = g.player.x - e.x;
                g.shootAt('spore', e.x + e.w / 2, e.y, clampAbs(dx * 0.9, 40, 110), -210);
            }
            if (e.puff > 0) e.puff -= dt;
        },
    },
    cactus: {
        w: 12, h: 14, hp: 3, stomp: false, score: 300,
        update(e, g, dt) {
            e.t += dt;
            e.vx = 0;
            g.moveEnemy(e, dt);
            if (e.t > 3 && g.near(e, 200)) {
                e.t = 0; e.puff = 0.3;
                g.shootAt('needle', e.x + e.w / 2, e.y + 6, -120, 0);
                g.shootAt('needle', e.x + e.w / 2, e.y + 6, 120, 0);
            }
            if (e.puff > 0) e.puff -= dt;
        },
    },
    chomper: {
        w: 14, h: 16, hp: 2, stomp: false, score: 200, fly: true, pipe: true,
        update(e, g, dt) {
            // e.y0 = the pipe top (hidden position); rises 16px
            if (e.y0 === undefined) { e.y0 = e.y + e.h; e.x = e.x + 1; e.y = e.y0; e.state = 'down'; e.t = 1; }
            e.t -= dt;
            const near = Math.abs(g.player.x + 5 - (e.x + e.w / 2)) < 26;
            if (e.state === 'down' && e.t <= 0 && !near) { e.state = 'up'; e.t = 0.5; }
            else if (e.state === 'up') { e.y = e.y0 - e.h * (1 - Math.max(0, e.t) / 0.5); if (e.t <= 0) { e.state = 'top'; e.t = 1.6; } }
            else if (e.state === 'top' && e.t <= 0) { e.state = 'sink'; e.t = 0.5; }
            else if (e.state === 'sink') { e.y = e.y0 - e.h * (Math.max(0, e.t) / 0.5); if (e.t <= 0) { e.state = 'down'; e.t = 1.4; } }
            e.hidden = e.state === 'down';
        },
    },
    bat: {
        w: 12, h: 10, hp: 1, stomp: true, score: 200, fly: true,
        update(e, g, dt) {
            if (e.homeY === undefined) { e.homeY = e.y; e.homeX = e.x; e.state = 'sleep'; }
            const p = g.player;
            if (e.state === 'sleep') {
                if (Math.abs(p.x - e.x) < 70 && p.y > e.y && p.y - e.y < 150) {
                    e.state = 'swoop'; e.t = 0;
                    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
                    e.vx = dx / d * 95; e.vy = dy / d * 95;
                    g.event('sfx', { name: 'bat' });
                }
            } else if (e.state === 'swoop') {
                e.t += dt;
                e.x += e.vx * dt; e.y += e.vy * dt;
                e.dir = sign(e.vx) || 1;
                if (e.t > 1.1 || g.solidAt(e.x + e.w / 2, e.y + e.h + 1)) { e.state = 'return'; }
            } else {
                const dx = e.homeX - e.x, dy = e.homeY - e.y, d = Math.hypot(dx, dy);
                if (d < 2) { e.x = e.homeX; e.y = e.homeY; e.state = 'sleep'; }
                else { e.x += dx / d * 55 * dt; e.y += dy / d * 55 * dt; e.dir = sign(dx) || 1; }
            }
        },
    },
    glint: {
        w: 14, h: 12, hp: 2, stomp: true, score: 200, splits: true,
        update(e, g, dt) {
            e.t += dt;
            if (e.onGround && e.t > (e.mini ? 0.7 : 1.3)) {
                e.t = 0; e.vy = e.mini ? -150 : -180; e.onGround = false;
                e.dir = sign(g.player.x - e.x) || e.dir;
            }
            e.vx = e.onGround ? 0 : e.dir * (e.mini ? 55 : 40);
            const r = g.moveEnemy(e, dt);
            if (r.wall) e.dir = -e.dir;
        },
    },
    drizzle: {
        w: 16, h: 12, hp: 2, stomp: true, score: 300, fly: true,
        update(e, g, dt) {
            e.t += dt;
            if (e.baseY === undefined) e.baseY = e.y;
            const dx = g.player.x - e.x;
            e.x += clampAbs(dx, 0, 38) * dt * (Math.abs(dx) > 4 ? 1 : 0);
            e.y = e.baseY + Math.sin(e.t * 2) * 4;
            e.dir = sign(dx) || 1;
            if (e.t > 1.9 && Math.abs(dx) < 40 && g.player.y > e.y) {
                e.t = 0;
                g.shootAt('rain', e.x + e.w / 2, e.y + e.h, 0, 40);
            }
        },
    },
    crusher: {
        w: 24, h: 24, hp: 99, stomp: false, invuln: true, score: 0, fly: true, noFreeze: true, solidTop: true,
        update(e, g, dt) {
            if (e.homeY === undefined) { e.homeY = e.y; e.x -= 4; e.state = 'wait'; e.t = 0; }
            const p = g.player;
            e.t += dt;
            if (e.state === 'wait') {
                if (p.x + p.w > e.x - 14 && p.x < e.x + e.w + 14 && p.y > e.y) { e.state = 'shake'; e.t = 0; }
            } else if (e.state === 'shake') {
                if (e.t > 0.3) { e.state = 'fall'; e.vy = 0; }
            } else if (e.state === 'fall') {
                e.vy = Math.min(420, e.vy + 1600 * dt);
                const r = g.moveEnemy(e, dt, true);
                if (r.landed) { e.state = 'rest'; e.t = 0; g.event('sfx', { name: 'thud' }); g.event('shake', { amt: 3 }); }
            } else if (e.state === 'rest') {
                if (e.t > 1.1) e.state = 'rise';
            } else if (e.state === 'rise') {
                e.y -= 40 * dt;
                if (e.y <= e.homeY) { e.y = e.homeY; e.state = 'wait'; e.t = 0; }
            }
        },
    },
    lavabub: {
        w: 12, h: 12, hp: 99, stomp: false, invuln: true, score: 0, fly: true, noFreeze: true,
        update(e, g, dt) {
            if (e.homeY === undefined) { e.homeY = e.y + 4; e.y = e.homeY; e.t = -g.rng.range(0, 2); e.vy = 0; }
            e.t += dt;
            if (e.t > 2.4 && e.y >= e.homeY) { e.t = 0; e.vy = -360; }
            e.vy += 700 * dt;
            e.y += e.vy * dt;
            if (e.y > e.homeY) { e.y = e.homeY; e.vy = 0; }
            e.hidden = e.y >= e.homeY - 1;
        },
    },
};

function clampAbs(v, lo, hi) {
    const s = v < 0 ? -1 : 1;
    return s * Math.min(hi, Math.max(lo, Math.abs(v)));
}

export function makeEnemy(kind, tx, ty) {
    const def = ENEMY[kind];
    const e = {
        kind, def,
        x: tx * TILE + (TILE - def.w) / 2,
        y: (ty + 1) * TILE - def.h,
        w: def.w, h: def.h,
        vx: 0, vy: 0, dir: -1, hp: def.hp, t: 0,
        onGround: false, state: 'walk', frozen: 0, hurt: 0, active: false, dead: false, puff: 0,
    };
    return e;
}
