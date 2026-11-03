// Enemy behaviour, one function per kind. Pure.

import { ENEMIES } from '../config.js';
import { moveBody, standable, overlap } from './physics.js';
import { ev, addEnemy, eShot, aimAt, lobAt, hasLos, hurtPlayer, hitEnemy } from './common.js';

const GRAV = 40;

function walker(G, e, dt) {
    e.vy = Math.max(-26, e.vy - GRAV * dt);
    moveBody(G.level, e, dt);
}

/** Will a walker heading `dir` step off its ledge or into acid? */
function edgeAhead(G, e, dir) {
    if (!e.ground) return false;
    const c = Math.floor(e.x + dir * (e.w / 2 + 0.25));
    return !standable(G.level, c, e.y);
}

const AI = {
    skitter(G, e, dt, def = ENEMIES.skitter, leapK = 1) {
        const p = G.player;
        const dx = p.x - e.x;
        const chasing = !p.dead && Math.abs(dx) < 9 && Math.abs(p.y - e.y) < 4;
        if (e.ground) {
            e.leaping = false;
            let dir = chasing ? Math.sign(dx) || e.face : e.face;
            if (edgeAhead(G, e, dir)) { if (!chasing) e.face = -e.face; dir = chasing ? 0 : e.face; }
            if (dir) e.face = dir;
            e.vx = dir * (chasing ? def.chase : def.speed) * G.diff;
            e.cool -= dt;
            if (chasing && Math.abs(dx) < 3.2 * leapK && e.cool <= 0) {
                e.vy = 12; e.vx = Math.sign(dx) * 7; e.cool = 2.0 + G.rng() * 1.2; e.leaping = true;
                ev(G, 'leap', { x: e.x, y: e.y, k: e.k });
            } else if (e.hitWall) e.vy = 12;
        }
        walker(G, e, dt);
    },
    hiveling(G, e, dt) { AI.skitter(G, e, dt, { speed: 4, chase: ENEMIES.hiveling.speed }, 1.4); },

    wisp(G, e, dt) {
        const p = G.player;
        e.cool -= dt;
        if (e.state === 'dive') {
            e.st -= dt;
            if (e.st <= 0) { e.state = 'idle'; e.cool = 3.0 + G.rng() * 1.5; }
        } else {
            const tx = p.x + Math.sin(e.t * 0.9 + e.id) * 3.2, ty = p.y + 3.6 + Math.sin(e.t * 2.1) * 0.6;
            const v = aimAt(e.x, e.y, tx, ty, ENEMIES.wisp.speed * G.diff);
            const d = Math.hypot(tx - e.x, ty - e.y);
            const k = Math.min(1, d / 2);
            e.vx += (v.vx * k - e.vx) * Math.min(1, dt * 3);
            e.vy += (v.vy * k - e.vy) * Math.min(1, dt * 3);
            if (e.cool <= 0 && !p.dead && Math.abs(p.x - e.x) < 9) {
                const a = aimAt(e.x, e.y, p.x, p.y + 0.9, 8 * G.diff);
                e.vx = a.vx; e.vy = a.vy; e.state = 'dive'; e.st = 0.75;
                ev(G, 'dive', { x: e.x, y: e.y });
            }
        }
        e.face = e.vx < 0 ? -1 : 1;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.y < 0.4) { e.y = 0.4; e.vy = Math.abs(e.vy); }
        if (e.y > G.level.h - 1.2) e.y = G.level.h - 1.2;
    },

    spitter(G, e, dt) {
        const p = G.player;
        e.face = p.x < e.x ? -1 : 1;
        e.st = Math.max(0, e.st - dt);
        if (p.dead || Math.abs(p.x - e.x) > 13 || Math.abs(p.y - e.y) > 8) return;
        e.cool -= dt;
        if (e.cool <= 0) {
            e.cool = ENEMIES.spitter.rate / G.diff;
            e.st = 0.35;
            const n = G.levelIdx >= 5 ? 2 : 1;
            for (let i = 0; i < n; i++) {
                const t = 0.9 + Math.min(0.6, Math.abs(p.x - e.x) / 14) + i * 0.25;
                const v = lobAt(e.x, e.y + 1.1, p.x + p.vx * 0.4, p.y + 0.4, 20, t);
                eShot(G, e.x, e.y + 1.1, v.vx, v.vy, 'acid', 20);
            }
            ev(G, 'spit', { x: e.x, y: e.y + 1.1 });
        }
    },

    turret(G, e, dt) {
        const p = G.player;
        const cx = e.x, cy = e.y + 0.6;
        const ang = Math.atan2(p.y + 0.9 - cy, p.x - cx);
        e.aim = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
        e.face = Math.cos(e.aim) < 0 ? -1 : 1;
        if (p.dead || Math.abs(p.x - cx) > 14 || Math.abs(p.y - cy) > 9) return;
        e.cool -= dt;
        if (e.cool <= 0) {
            if (!hasLos(G.level, cx, cy, p.x, p.y + 0.9)) { e.cool = 0.4; return; }
            e.burst = 2;
            e.cool = ENEMIES.turret.rate / G.diff;
            e.bt = 0;
        }
        if (e.burst > 0) {
            e.bt -= dt;
            if (e.bt <= 0) {
                e.burst--; e.bt = 0.16;
                const vx = Math.cos(e.aim) * 9, vy = Math.sin(e.aim) * 9;
                eShot(G, cx + Math.cos(e.aim) * 0.6, cy + Math.sin(e.aim) * 0.6, vx, vy, 'bolt');
                ev(G, 'eshot', { x: cx + Math.cos(e.aim) * 0.6, y: cy + Math.sin(e.aim) * 0.6, k: 'turret' });
            }
        }
    },

    brute(G, e, dt) {
        const p = G.player;
        const dx = p.x - e.x;
        if (e.state === 'wind') {
            e.vx = 0; e.st -= dt;
            if (e.st <= 0) { e.state = 'charge'; e.st = 0.95; ev(G, 'charge', { x: e.x, y: e.y }); }
        } else if (e.state === 'charge') {
            e.st -= dt;
            e.vx = e.face * 7.5 * G.diff;
            if (e.st <= 0 || e.hitWall || edgeAhead(G, e, e.face)) { e.state = 'idle'; e.cool = 1.5; e.vx = 0; }
        } else if (e.ground) {
            const near = !p.dead && Math.abs(dx) < 11 && Math.abs(p.y - e.y) < 3;
            let dir = near ? Math.sign(dx) : e.face;
            if (edgeAhead(G, e, dir)) { if (!near) e.face = -e.face; dir = 0; }
            if (dir) e.face = dir;
            e.vx = dir * ENEMIES.brute.speed;
            e.cool -= dt;
            if (near && Math.abs(dx) < 7 && e.cool <= 0) { e.state = 'wind'; e.st = 0.7; e.face = Math.sign(dx) || e.face; ev(G, 'roar', { x: e.x, y: e.y + 1.6, k: 'brute' }); }
        }
        walker(G, e, dt);
    },

    nest(G, e, dt) {
        const p = G.player;
        e.st = Math.max(0, e.st - dt);
        if (p.dead || Math.abs(p.x - e.x) > 15) return;
        e.cool -= dt;
        const kids = G.enemies.filter((o) => o.parent === e.id && !o.dead).length;
        if (e.cool <= 0 && kids < 3) {
            e.cool = ENEMIES.nest.rate / G.diff;
            e.st = 0.4;
            const h = addEnemy(G, 'hiveling', e.x, e.y + 1.0, { parent: e.id, vy: 9, vx: (p.x < e.x ? -1 : 1) * 3 });
            h.face = p.x < e.x ? -1 : 1;
            ev(G, 'hatch', { x: e.x, y: e.y + 1 });
        }
    },

    missile(G, e, dt) {
        const p = G.player;
        e.st += dt;
        if (e.st > 0.45 && e.st < 2.0 && !p.dead) {
            const want = Math.atan2(p.y + 0.9 - e.y, p.x - e.x);
            let cur = Math.atan2(e.vy, e.vx);
            let d = want - cur;
            while (d > Math.PI) d -= Math.PI * 2;
            while (d < -Math.PI) d += Math.PI * 2;
            cur += Math.max(-2.6 * dt, Math.min(2.6 * dt, d));
            const sp = Math.min(8.5, Math.hypot(e.vx, e.vy) + dt * 6);
            e.vx = Math.cos(cur) * sp; e.vy = Math.sin(cur) * sp;
        } else if (e.st <= 0.45) e.vy -= 14 * dt;
        e.x += e.vx * dt; e.y += e.vy * dt;
        e.face = e.vx < 0 ? -1 : 1;
        const L = G.level;
        if (e.st > 4.5 || e.y < 0 || (L.tiles[Math.floor(e.y) * L.w + Math.floor(e.x)] === 1)) {
            e.dead = true;
            ev(G, 'boom', { x: e.x, y: e.y, r: 1, kind: 'missile' });
        }
    },
};

export function stepEnemies(G, dt) {
    const p = G.player;
    for (let i = 0; i < G.enemies.length; i++) {
        const e = G.enemies[i];
        if (e.dead) continue;
        e.t += dt;
        e.flash = Math.max(0, e.flash - dt);
        AI[e.k](G, e, dt);
        if (e.dead) continue;
        if (e.y < -3) { e.dead = true; e.silent = true; continue; }
        if (!p.dead && overlap(p, e)) {
            if (hurtPlayer(G, 1, e.k) && e.k === 'missile') { e.dead = true; ev(G, 'boom', { x: e.x, y: e.y, r: 1, kind: 'missile' }); }
        }
        // left far behind: gone (stationary ones too; nothing walks back)
        if (e.x < p.x - 24 && !G.arenaLocked) { e.dead = true; e.silent = true; }
    }
    if (G.enemies.some((e) => e.dead)) G.enemies = G.enemies.filter((e) => !e.dead);
}

export { hitEnemy };
