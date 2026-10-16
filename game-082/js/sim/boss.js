// The Void Baron: the last sector. Pure.
//
// He bounces round his core like a pinball, faster as he weakens, and throws fans of void orbs
// at you. Bubbles can't hold him: zap bubbles rise from the floor, and a bolt from one that
// crosses him knocks off a point. At zero he is caught in a giant bubble; pop it and he spins
// away and leaves the Nebula Heart behind.

import { BOSS, LEFT, RIGHT, H, TIMING } from '../config.js';
import { moveBody } from './physics.js';

export function makeBoss(G) {
    return {
        x: 16, y: 13, sy: 13, w: BOSS.w, h: BOSS.h, vx: BOSS.speed, vy: BOSS.speed * 0.7,
        hp: BOSS.hp, max: BOSS.hp, st: 'enter', t: 0, throwT: 3, flash: 0, ground: false, face: -1,
    };
}

export function stepBoss(G, L, dt) {
    const B = G.boss;
    if (!B) return;
    B.t += dt;
    B.flash = Math.max(0, B.flash - dt);
    if (B.st === 'enter') {
        const k = Math.min(1, B.t / TIMING.intro);
        B.y = B.sy - (1 - k) * (1 - k) * 20;
        return;
    }
    if (B.st === 'live') {
        if (G.freezeT > 0) return;
        const sp = BOSS.speed + (BOSS.rage - BOSS.speed) * (1 - B.hp / B.max);
        B.vx = Math.sign(B.vx || 1) * sp;
        B.vy = Math.sign(B.vy || 1) * sp * 0.72;
        B.x += B.vx * dt;
        if (B.x < LEFT + B.w / 2) { B.x = LEFT + B.w / 2; B.vx = Math.abs(B.vx); }
        if (B.x > RIGHT - B.w / 2) { B.x = RIGHT - B.w / 2; B.vx = -Math.abs(B.vx); }
        B.y += B.vy * dt;
        if (B.y - B.h < 1.2) { B.y = 1.2 + B.h; B.vy = Math.abs(B.vy); }
        if (B.y > H - 1) { B.y = H - 1; B.vy = -Math.abs(B.vy); }
        B.face = Math.sign(G.player.x - B.x) || B.face;
        B.throwT -= dt;
        if (B.throwT <= 0 && G.player.state === 'alive') {
            B.throwT = BOSS.throwEvery * (0.55 + 0.45 * B.hp / B.max);
            const p = G.player;
            const cy = B.y - B.h / 2;
            const a0 = Math.atan2(p.y - p.h / 2 - cy, p.x - B.x);
            const n = B.hp <= B.max / 3 ? 5 : 3;
            for (let k = 0; k < n; k++) {
                const a = a0 + (k - (n - 1) / 2) * 0.34;
                G.shots.push({ id: G.nextId++, kind: 'orb', x: B.x + Math.cos(a) * 2, y: cy + Math.sin(a) * 2, vx: Math.cos(a) * BOSS.orbSpeed, vy: Math.sin(a) * BOSS.orbSpeed, t: 0 });
            }
            G.events.push({ type: 'bossThrow', x: B.x, y: cy });
        }
        return;
    }
    if (B.st === 'dead') {
        B.vy = Math.min(16, B.vy + 30 * dt);
        moveBody(L, B, dt);
        if (B.hitWall) B.vx = -B.vx * 0.7;
        if ((B.landed && B.t > 0.6) || B.t > 4) {
            G.items.push({ id: G.nextId++, kind: 'heart', value: 0, x: B.x, y: Math.min(B.y, H - 1), vx: 0, vy: 0, w: 2, h: 2, ground: false, t: 0 });
            G.events.push({ type: 'heart', x: B.x, y: B.y });
            G.boss = null;
        }
    }
}

/** A zap bolt crossed him. */
export function hitBoss(G) {
    const B = G.boss;
    if (!B || B.st !== 'live') return;
    B.hp--;
    B.flash = 0.18;
    G.events.push({ type: 'bossHit', x: B.x, y: B.y - B.h / 2, hp: B.hp });
    if (B.hp > 0) return;
    B.st = 'trap';
    G.shots.length = 0;
    G.bubbles.push({ id: G.nextId++, kind: 'boss', mode: 'float', x: B.x, y: B.y - B.h / 2, vx: 0, vy: 0, r: BOSS.bubbleR, t: 0, enemy: null, trapT: 0 });
    G.events.push({ type: 'bossTrap', x: B.x, y: B.y - B.h / 2 });
}

/** His bubble popped: he spins away. */
export function popBoss(G, b) {
    const B = G.boss;
    if (!B) return;
    B.st = 'dead';
    B.t = 0;
    B.x = b.x; B.y = b.y + B.h / 2;
    B.vx = (G.player.x < B.x ? 1 : -1) * 5;
    B.vy = -14;
    G.events.push({ type: 'bossPop', x: b.x, y: b.y });
}
