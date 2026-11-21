// Bullet patterns: every enemy, turret and boss fires through emit(). Pure.
//
// A bullet is { x, y, vx, vy, r, k, c, t } plus optional behaviours:
//   acc/maxv  speeds up along its heading      curve  turns (rad/s)
//   wa/wf     weaves sideways (amplitude, rad/s)  split  { at, n, speed } bursts into a ring
//   home      seconds of homing on the player     stop   { at, wait } halts, then re-aims
// k is the look (orb, rice, big, needle, star), c a colour index; the view reads both.

import { LIMITS } from '../config.js';

const TAU = Math.PI * 2;

export function bspeed(G) { return G.bspd || 1; }

export function addBullet(G, b) {
    if (G.bullets.length >= LIMITS.bullets) return null;
    b.t = 0;
    if (b.r == null) b.r = 0.16;
    if (!b.k) b.k = 'orb';
    if (b.c == null) b.c = 0;
    G.bullets.push(b);
    return b;
}

const shoot = (G, x, y, ang, speed, o = {}) =>
    addBullet(G, { x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, ...o });

export function aimAngle(G, x, y) {
    const p = G.player;
    return Math.atan2(p.y - y, p.x - x);
}

/**
 * Fire a named pattern from src ({ x, y, ang? }). Speeds scale with difficulty and rank.
 * Returns nothing; bullets land in G.bullets, lasers in G.beams, spawns in G.enemies (via G.spawnHook).
 */
export function emit(G, name, src, p = {}) {
    const sp = bspeed(G);
    const x = src.x, y = src.y;
    const c = p.c ?? src.c ?? 0;
    switch (name) {
        case 'aimed': {
            const n = p.n || 1, spread = p.spread || 0.15, a0 = aimAngle(G, x, y);
            for (let i = 0; i < n; i++) shoot(G, x, y, a0 + (i - (n - 1) / 2) * spread, p.speed * sp, { k: p.k || 'rice', r: 0.13, c });
            break;
        }
        case 'fan': {
            const n = p.n || 5, arc = p.arc || 0.8, dir = p.dir ?? aimAngle(G, x, y);
            for (let i = 0; i < n; i++) shoot(G, x, y, dir + (n > 1 ? (i / (n - 1) - 0.5) * arc : 0), p.speed * sp, { k: p.k || 'orb', c });
            break;
        }
        case 'ring': {
            const n = p.n || 12, off = (p.off ?? (src.ang || 0));
            for (let i = 0; i < n; i++) shoot(G, x, y, off + (i / n) * TAU, p.speed * sp, { k: p.k || 'orb', r: p.r || 0.17, c, acc: p.acc, maxv: p.maxv && p.maxv * sp });
            src.ang = (src.ang || 0) + (p.step ?? 0.13);
            break;
        }
        case 'spiral': {
            const arms = p.arms || 3;
            src.ang = (src.ang || 0) + (p.rot || 2) * 0.05;
            for (let i = 0; i < arms; i++) shoot(G, x, y, src.ang + (i / arms) * TAU, p.speed * sp, { k: p.k || 'rice', r: 0.13, c, curve: p.curve });
            break;
        }
        case 'flower': {
            const n = p.n || 16, off = src.ang || 0;
            for (let i = 0; i < n; i++) {
                const a = off + (i / n) * TAU;
                shoot(G, x, y, a, p.speed * sp * (0.8 + 0.4 * (i % 2)), { k: 'orb', c, curve: (i % 2 ? 1 : -1) * (p.curve || 0.5) });
            }
            src.ang = off + 0.2;
            break;
        }
        case 'wave': {
            const n = p.n || 5, a0 = Math.PI + (p.tilt || 0);
            for (let i = 0; i < n; i++) shoot(G, x, y, a0 + (i - (n - 1) / 2) * 0.22, p.speed * sp, { k: 'rice', c, wa: p.amp || 2, wf: p.freq || 3 });
            break;
        }
        case 'curtain': {
            // a wall of bullets moving left with a gap the player must find
            const rows = p.rows || 9, gap = p.gap || 2, h = 18;
            const hole = Math.floor(((src.ang || 0) * 7.13) % (rows - gap));
            src.ang = (src.ang || 0) + 1;
            for (let i = 0; i < rows; i++) {
                if (i >= hole && i < hole + gap) continue;
                addBullet(G, { x, y: (i + 0.5) * (h / rows), vx: -p.speed * sp, vy: 0, k: 'big', r: 0.34, c });
            }
            break;
        }
        case 'stream': {
            // a quick burst: queue the remaining shots on the source
            src.burst = { n: p.n || 5, gap: p.gap || 0.07, t: 0, speed: p.speed, a: aimAngle(G, x, y) };
            shoot(G, x, y, src.burst.a, p.speed * sp, { k: 'needle', r: 0.12, c });
            src.burst.n--;
            break;
        }
        case 'homing': {
            const n = p.n || 3;
            for (let i = 0; i < n; i++) shoot(G, x, y, Math.PI + (i - (n - 1) / 2) * 0.6, (p.speed || 4) * sp, { k: 'big', r: 0.3, c, home: p.home || 2.2 });
            break;
        }
        case 'accel': {
            const n = p.n || 8, off = src.ang || 0;
            for (let i = 0; i < n; i++) shoot(G, x, y, off + (i / n) * TAU, 1.2 * sp, { k: 'rice', r: 0.13, c, acc: p.acc || 6, maxv: (p.speed || 9) * sp });
            src.ang = off + 0.31;
            break;
        }
        case 'split': {
            const n = p.n || 3, a0 = aimAngle(G, x, y);
            for (let i = 0; i < n; i++) shoot(G, x, y, a0 + (i - (n - 1) / 2) * 0.5, (p.speed || 5) * sp, { k: 'big', r: 0.32, c, split: { at: p.at || 0.9, n: p.ring || 10, speed: (p.speed2 || 5) * sp } });
            break;
        }
        case 'stopgo': {
            const n = p.n || 12, off = src.ang || 0;
            for (let i = 0; i < n; i++) shoot(G, x, y, off + (i / n) * TAU, (p.speed || 7) * sp, { k: 'orb', c, stop: { at: p.at || 0.6, wait: p.wait || 0.6, speed: (p.speed2 || 8) * sp } });
            src.ang = off + 0.27;
            break;
        }
        case 'laser': {
            const ang = p.ang ?? aimAngle(G, x, y);
            G.beams.push({ id: G.nextId++, x, y, ang, len: p.len || 40, w: p.w || 0.5, warm: p.warm || 0.9, life: p.life || 1.0, t: 0, owner: src.id ?? null, ox: p.ox || 0, oy: p.oy || 0, spin: p.spin || 0, c });
            break;
        }
        case 'spawn':
            if (G.spawnHook) G.spawnHook(G, p.type, x - 0.5, y, p);
            break;
        default:
            break;
    }
}

/** Advance a source's queued burst (from 'stream'). */
export function stepBurst(G, src, dt) {
    const b = src.burst;
    if (!b || b.n <= 0) return;
    b.t += dt;
    while (b.t >= b.gap && b.n > 0) {
        b.t -= b.gap;
        b.n--;
        shoot(G, src.x, src.y, b.a, b.speed * bspeed(G), { k: 'needle', r: 0.12, c: src.c ?? 0 });
    }
}

/** Move every enemy bullet one step. `slow` is the chrono factor. Bullets far off screen are dropped. */
export function stepBullets(G, dt, slow = 1) {
    const d = dt * slow;
    const p = G.player;
    const out = [];
    for (const b of G.bullets) {
        b.t += d;
        if (b.acc) {
            const v = Math.hypot(b.vx, b.vy) || 1;
            const nv = Math.min(b.maxv || 20, v + b.acc * d);
            b.vx *= nv / v; b.vy *= nv / v;
        }
        if (b.curve) {
            const c = Math.cos(b.curve * d), s = Math.sin(b.curve * d);
            const vx = b.vx * c - b.vy * s; b.vy = b.vx * s + b.vy * c; b.vx = vx;
        }
        if (b.home && b.t < b.home) {
            const v = Math.hypot(b.vx, b.vy) || 1;
            const a = Math.atan2(b.vy, b.vx), want = Math.atan2(p.y - b.y, p.x - b.x);
            let da = want - a;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            const na = a + Math.max(-1.6 * d, Math.min(1.6 * d, da));
            b.vx = Math.cos(na) * v; b.vy = Math.sin(na) * v;
        }
        if (b.stop && b.t >= b.stop.at && !b.stop.done) {
            if (b.t < b.stop.at + b.stop.wait) { b.x += 0; b.y += 0; out.push(b); continue; }
            b.stop.done = true;
            const a = Math.atan2(p.y - b.y, p.x - b.x);
            b.vx = Math.cos(a) * b.stop.speed; b.vy = Math.sin(a) * b.stop.speed;
        }
        let px = 0, py = 0;
        if (b.wa) {
            const v = Math.hypot(b.vx, b.vy) || 1;
            const w = b.wa * b.wf * Math.cos(b.wf * b.t);
            px = (-b.vy / v) * w; py = (b.vx / v) * w;
        }
        b.x += (b.vx + px) * d;
        b.y += (b.vy + py) * d;
        if (b.split && b.t >= b.split.at) {
            const { n, speed } = b.split;
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2;
                out.push({ x: b.x, y: b.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 0.14, k: 'orb', c: b.c, t: 0 });
            }
            continue;
        }
        if (b.x < -3 || b.x > 36 || b.y < -3 || b.y > 21) continue;
        out.push(b);
    }
    G.bullets = out.length > 1400 ? out.slice(out.length - 1400) : out;
}

/** Distance from point (px, py) to the beam's segment. */
export function beamDist(bm, px, py) {
    const ex = bm.x + Math.cos(bm.ang) * bm.len, ey = bm.y + Math.sin(bm.ang) * bm.len;
    const dx = ex - bm.x, dy = ey - bm.y, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - bm.x) * dx + (py - bm.y) * dy) / l2));
    return Math.hypot(bm.x + t * dx - px, bm.y + t * dy - py);
}
