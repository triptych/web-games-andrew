// Helpers shared by the player, the enemies and the bosses. Pure.

import { ENEMIES, PLAYER, SCORE } from '../config.js';
import { solidAt } from './physics.js';

export const ev = (G, type, o = {}) => { G.events.push({ type, ...o }); };

export function addEnemy(G, k, x, y, extra = {}) {
    const d = ENEMIES[k];
    const hp = Math.max(1, Math.round(d.hp * G.hpScale));
    const e = {
        id: G.nextId++, k, x, y, w: d.w, h: d.h, vx: 0, vy: 0, ground: false, drop: 0,
        hp, maxHp: hp, face: -1, t: G.rng() * 3, cool: 0.6 + G.rng() * 1.2, flash: 0, state: 'idle', st: 0, dead: false,
        ...extra,
    };
    G.enemies.push(e);
    return e;
}

/** An enemy projectile. k: bolt | acid | ring | egg | spit. g = gravity. */
export function eShot(G, x, y, vx, vy, k = 'bolt', g = 0) {
    G.ebul.push({ x, y, vx, vy, k, g, life: 5, r: k === 'acid' || k === 'egg' ? 0.26 : 0.18 });
}

/** Velocity that flies straight at a point. */
export function aimAt(x0, y0, x1, y1, speed) {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1;
    return { vx: (dx / l) * speed, vy: (dy / l) * speed };
}

/** Velocity for a lob under gravity g that lands on a point after about `t` seconds. */
export function lobAt(x0, y0, x1, y1, g, t) {
    return { vx: (x1 - x0) / t, vy: (y1 - y0 + 0.5 * g * t * t) / t };
}

/** A clear straight line between two points (sampled every half tile). */
export function hasLos(L, x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let i = 1; i < n; i++) {
        const t = i / n;
        if (solidAt(L, Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t))) return false;
    }
    return true;
}

export function addScore(G, n) {
    const before = Math.floor(G.score / SCORE.extraLifeEvery);
    G.score += n;
    if (Math.floor(G.score / SCORE.extraLifeEvery) > before) {
        G.lives++;
        ev(G, 'extraLife');
    }
}

export function hurtPlayer(G, n = 1, kind = 'hit') {
    const p = G.player;
    if (p.dead || p.inv > 0 || G.phase !== 'play') return false;
    G.stats.hits++;
    if (G.god) { p.inv = 0.3; ev(G, 'hurt', { x: p.x, y: p.y + 1, hp: p.hp, kind, god: true }); return true; }
    p.hp -= n;
    p.inv = PLAYER.iframes;
    p.knock = 0.14;
    p.knockV = -p.face * 6;
    ev(G, 'hurt', { x: p.x, y: p.y + 1, hp: p.hp, kind });
    if (p.hp <= 0) killPlayer(G);
    return true;
}

export function killPlayer(G) {
    const p = G.player;
    if (p.dead) return;
    p.dead = true;
    p.hp = 0;
    p.vx = 0;
    G.lives--;
    G.stats.deaths++;
    G.levelDeaths++;
    ev(G, 'die', { x: p.x, y: p.y + 0.8, lives: G.lives });
    G.phase = 'dying';
    G.phaseT = PLAYER.respawnT;
}

/** Damage an enemy; returns true if it died. */
export function hitEnemy(G, e, dmg, from = 'shot') {
    if (e.dead) return false;
    e.hp -= dmg;
    e.flash = 0.09;
    if (e.hp > 0) { ev(G, 'ehit', { x: e.x, y: e.y + e.h / 2, k: e.k }); return false; }
    e.dead = true;
    G.stats.kills++;
    addScore(G, ENEMIES[e.k].score);
    ev(G, 'kill', { k: e.k, x: e.x, y: e.y + e.h / 2, from });
    return true;
}

export function hitBoss(G, dmg) {
    const B = G.boss;
    if (!B || B.dead || !B.vulnerable) return false;
    B.hp -= dmg;
    B.flash = 0.07;
    G.stats.bossDmg += dmg;
    ev(G, 'bhit', { x: B.x, y: B.y + B.h / 2 });
    return true;
}

/** Point-in-box test with a margin (bullets are tiny circles). */
export const inBox = (x, y, b, r = 0) =>
    x > b.x - b.w / 2 - r && x < b.x + b.w / 2 + r && y > b.y - r && y < b.y + b.h + r;

/** A blast: hurts enemies, the boss and pods within r. */
export function explode(G, x, y, r, dmg, kind, opts = {}) {
    ev(G, 'boom', { x, y, r, kind });
    for (const e of G.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - x, e.y + e.h / 2 - y);
        if (d < r + e.w / 2) hitEnemy(G, e, dmg, kind);
    }
    const B = G.boss;
    if (B && !B.dead && B.vulnerable) {
        const dx = Math.max(0, Math.abs(B.x - x) - B.w / 2), dy = Math.max(0, B.y - y, y - (B.y + B.h));
        if (Math.hypot(dx, dy) < r) hitBoss(G, dmg);
    }
    for (const pod of G.pods) if (!pod.open && Math.hypot(pod.x - x, pod.y + 0.9 - y) < r + 0.5) hitPod(G, pod, 3);
    if (opts.clearShots) {
        const n = G.ebul.length;
        G.ebul = G.ebul.filter((b) => Math.hypot(b.x - x, b.y - y) > r);
        if (G.ebul.length < n) ev(G, 'cleared', { x, y, n: n - G.ebul.length });
    }
}

export function hitPod(G, pod, dmg) {
    if (pod.open) return;
    pod.hp -= dmg;
    pod.flash = 0.1;
    if (pod.hp > 0) { ev(G, 'podHit', { x: pod.x, y: pod.y + 1 }); return; }
    pod.open = true;
    G.rescued[G.levelIdx]++;
    addScore(G, SCORE.pod);
    const p = G.player;
    if (!p.dead && p.hp < PLAYER.hp - (G.hard ? 1 : 0)) p.hp++;
    ev(G, 'rescue', { x: pod.x, y: pod.y, n: G.rescued[G.levelIdx] });
}
