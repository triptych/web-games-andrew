// Small helpers shared by the enemy, wave, boss and game modules. Pure.

import { FIELD, ENEMY } from '../config.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const W = FIELD.w;
export const H = FIELD.h;

/** Enemy bullet speed for this stage of the game. */
export const bulletSpeed = (G) => ENEMY.bulletSpeed * (1 + Math.min(ENEMY.speedCap, G.diff * ENEMY.speedScale));

/** Fire one enemy bullet at angle `ang` (radians, 0 = right, π/2 = down). k: 0 round, 1 big, 2 needle. */
export function shoot(G, x, y, ang, speed, k = 0) {
    if (G.ebullets.length >= ENEMY.maxBullets) return;
    G.ebullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, k });
}

/** The angle from (x, y) to the player. Straight down when the player is gone. */
export function aimAt(G, x, y) {
    const p = G.player;
    return p.alive ? Math.atan2(p.y - y, p.x - x) : Math.PI / 2;
}

export const emit = (G, ev) => { G.events.push(ev); };

export function angleStep(a, target, max) {
    let d = ((target - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + clamp(d, -max, max);
}
