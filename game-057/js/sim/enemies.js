/**
 * enemies.js — the Brood's behaviours and enemy bullets.
 *
 * Each behaviour sets a desired velocity (e.dvx, e.dvy) and acts; world.js
 * integrates movement, separation and wall collision for everyone.
 */

import { updateClone } from './bosses.js';
import {
    TAU, clamp, angDiff, emit, flowDir, los, hurtPlayer, killEnemy, spawnEnemy, spawnEBullet, solidAt,
} from './core.js';

const tmp = { x: 0, y: 0 };

function seePlayer(w, e, dt) {
    e.losT = (e.losT ?? 0) - dt;
    if (e.losT <= 0) {
        e.losT = 0.25 + e.seed * 0.1;
        e.los = los(w.lv, e.x, e.y, w.player.x, w.player.y);
    }
    return e.los;
}

function steer(e, dx, dy, speed) {
    e.dvx = dx * speed;
    e.dvy = dy * speed;
}

/** Move toward the player: straight when close and visible, else along the flow field. */
function chase(w, e, speed, dt, wiggle = 0) {
    const p = w.player;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1e-6;
    let ux, uy;
    if (d < 3.2 && seePlayer(w, e, dt)) { ux = dx / d; uy = dy / d; }
    else { flowDir(w, e.x, e.y, tmp); ux = tmp.x; uy = tmp.y; }
    if (wiggle) {
        const s = Math.sin(e.anim * 1.7 + e.seed * 20) * wiggle;
        const nx = ux - uy * s, ny = uy + ux * s, n = Math.hypot(nx, ny) || 1;
        ux = nx / n; uy = ny / n;
    }
    steer(e, ux, uy, speed);
}

function turnToward(e, ang, rate, dt) {
    const d = angDiff(ang, e.face);
    e.face += clamp(d, -rate * dt, rate * dt);
}

function contact(w, e, reach = 0.15, cd = 0.9) {
    const p = w.player;
    if (e.biteCd > 0 || !p.alive) return;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < e.r + p.r + reach) {
        if (hurtPlayer(w, e.dmg, { x: e.x, y: e.y, kind: e.type })) emit(w, 'bite', { x: e.x, y: e.y, kind: e.type });
        e.biteCd = cd;
    }
}

function fan(w, e, ang, n, spread, speed, opts) {
    for (let i = 0; i < n; i++) {
        const a = n === 1 ? ang : ang - spread / 2 + (spread * i) / (n - 1);
        spawnEBullet(w, e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, a, speed, opts);
    }
}

export function updateEnemy(w, e, dt) {
    const p = w.player;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1e-6;
    const ux = dx / d, uy = dy / d;
    const toP = Math.atan2(dy, dx);
    const slow = w.cryoT > 0 ? 0.4 : 1;
    const sp = e.speed * slow;
    e.t -= dt;
    e.cd -= dt * slow;
    e.biteCd -= dt;
    e.dvx = 0; e.dvy = 0;

    switch (e.type) {
    case 'skitter': {
        chase(w, e, sp, dt, d > 2 ? 0.45 : 0.1);
        contact(w, e, 0.12, 0.8);
        break;
    }
    case 'drone': {
        if (e.state === 'chase') {
            chase(w, e, sp, dt, 0.15);
            contact(w, e, 0.1, 1);
            if (e.cd <= 0 && d < 4.6 && seePlayer(w, e, dt)) { e.state = 'windup'; e.t = 0.42; e.lx = ux; e.ly = uy; emit(w, 'screech', { x: e.x, y: e.y, kind: 'drone' }); }
        } else if (e.state === 'windup') {
            steer(e, -e.lx, -e.ly, 0.8);
            e.face = Math.atan2(e.ly, e.lx);
            if (e.t <= 0) { e.state = 'lunge'; e.t = 0.34; e.hitDone = false; }
        } else if (e.state === 'lunge') {
            steer(e, e.lx, e.ly, 11.5 * slow);
            if (!e.hitDone && d < e.r + p.r + 0.25) { e.hitDone = true; hurtPlayer(w, e.dmg * 1.2, { x: e.x, y: e.y, kind: 'drone' }); }
            if (e.t <= 0 || e.wallHit) { e.state = 'recover'; e.t = 0.5; }
        } else {
            steer(e, 0, 0, 0);
            if (e.t <= 0) { e.state = 'chase'; e.cd = 1.1 + e.seed; }
        }
        break;
    }
    case 'spitter': {
        const sees = seePlayer(w, e, dt);
        if (!sees || d > 9.5) chase(w, e, sp, dt);
        else if (d < 5.5) steer(e, -ux, -uy, sp * 0.9);
        else {
            if ((e.strafeT = (e.strafeT ?? 0) - dt) <= 0) { e.strafeT = 1 + e.seed * 2; e.sdir = e.sdir === 1 ? -1 : 1; }
            steer(e, -uy * e.sdir, ux * e.sdir, sp * 0.7);
        }
        if (e.state === 'spit') {
            steer(e, 0, 0, 0);
            if (e.t <= 0) {
                const n = e.alpha ? 5 : 3;
                fan(w, e, toP, n, e.alpha ? 0.7 : 0.42, 7.2, { kind: 'acid', dmg: 9, r: 0.2 });
                emit(w, 'spit', { x: e.x, y: e.y });
                e.state = 'chase';
                e.cd = (2.3 + e.seed) / w.diff.fireRate;
            }
        } else if (e.cd <= 0 && sees && d < 13) { e.state = 'spit'; e.t = 0.35; }
        e.face = toP;
        break;
    }
    case 'bloater': {
        if (e.state === 'swell') {
            steer(e, 0, 0, 0);
            if (e.t <= 0) killEnemy(w, e, { kind: 'self' });
        } else {
            chase(w, e, sp, dt);
            if (d < 1.7) { e.state = 'swell'; e.t = 0.55; emit(w, 'swell', { x: e.x, y: e.y, id: e.id }); }
        }
        break;
    }
    case 'burrower': {
        if (e.state === 'chase') {
            chase(w, e, sp, dt);
            contact(w, e, 0.1, 1);
            if (e.cd <= 0 && d < 12) { e.state = 'dive'; e.t = 0.45; emit(w, 'dig', { x: e.x, y: e.y }); }
        } else if (e.state === 'dive') {
            steer(e, 0, 0, 0);
            if (e.t <= 0) { e.state = 'under'; e.under = true; e.t = 2.8; }
        } else if (e.state === 'under') {
            chase(w, e, 7.5 * slow, dt);
            if (d < 0.9 || e.t <= 0) {
                e.state = 'erupt'; e.under = false; e.t = 0.25;
                const n = e.alpha ? 14 : 10;
                for (let i = 0; i < n; i++) {
                    const a = (i / n) * TAU + e.seed;
                    spawnEBullet(w, e.x, e.y, a, 6.5, { kind: 'spine', dmg: 10, r: 0.18 });
                }
                if (d < 1.4) hurtPlayer(w, e.dmg, { x: e.x, y: e.y, kind: 'burrower' });
                emit(w, 'erupt', { x: e.x, y: e.y });
            }
        } else if (e.state === 'erupt') {
            steer(e, 0, 0, 0);
            if (e.t <= 0) { e.state = 'recover'; e.t = 1.4; }
        } else {
            steer(e, 0, 0, 0);
            if (e.t <= 0) { e.state = 'chase'; e.cd = 2.5 + e.seed * 2; }
        }
        break;
    }
    case 'brute': {
        if (e.state === 'chase') {
            chase(w, e, sp, dt);
            turnToward(e, Math.atan2(e.dvy, e.dvx), 2.6, dt);
            contact(w, e, 0.1, 1.2);
            if (e.cd <= 0 && d < 11 && d > 2.5 && seePlayer(w, e, dt)) {
                e.state = 'windup'; e.t = 0.8; e.lx = ux; e.ly = uy;
                emit(w, 'telegraph', { x: e.x, y: e.y, ang: toP, len: 13, width: e.r * 2, t: 0.8, id: e.id });
                emit(w, 'roar', { x: e.x, y: e.y, kind: 'brute' });
            }
        } else if (e.state === 'windup') {
            steer(e, 0, 0, 0);
            turnToward(e, Math.atan2(e.ly, e.lx), 8, dt);
            if (e.t <= 0) { e.state = 'charge'; e.t = 1.3; e.hitDone = false; e.face = Math.atan2(e.ly, e.lx); }
        } else if (e.state === 'charge') {
            steer(e, e.lx, e.ly, 13 * slow);
            if (!e.hitDone && d < e.r + p.r + 0.3) {
                e.hitDone = true;
                if (hurtPlayer(w, e.dmg * 1.4, { x: e.x, y: e.y, kind: 'brute' })) { p.kx += e.lx * 9; p.ky += e.ly * 9; }
            }
            if (e.wallHit) { e.state = 'stunned'; e.t = 1.8; emit(w, 'thud', { x: e.x, y: e.y }); }
            else if (e.t <= 0) { e.state = 'recover'; e.t = 0.6; }
        } else {
            steer(e, 0, 0, 0);
            if (e.t <= 0) { e.state = 'chase'; e.cd = 2 + e.seed * 1.5; }
        }
        return; // brutes manage their own facing
    }
    case 'husk': {
        const sees = seePlayer(w, e, dt);
        if (e.state === 'aim') {
            steer(e, 0, 0, 0);
            e.face = toP;
            if (e.t <= 0) { e.state = 'burst'; e.shots = e.alpha ? 5 : 3; e.t = 0; }
        } else if (e.state === 'burst') {
            steer(e, 0, 0, 0);
            e.face = toP;
            if (e.t <= 0) {
                spawnEBullet(w, e.x + ux * 0.5, e.y + uy * 0.5, toP + w.rng.range(-0.06, 0.06), 9, { kind: 'slug', dmg: 9, r: 0.16 });
                emit(w, 'eshot', { x: e.x, y: e.y, ang: toP });
                e.t = 0.13;
                if (--e.shots <= 0) { e.state = 'chase'; e.cd = (2.4 + e.seed) / w.diff.fireRate; }
            }
        } else {
            if (!sees || d > 9) chase(w, e, sp, dt);
            else if (d < 4.5) steer(e, -ux, -uy, sp * 0.8);
            else steer(e, -uy * 0.4, ux * 0.4, sp * 0.5);
            contact(w, e, 0.1, 1);
            if (e.cd <= 0 && sees && d < 14) { e.state = 'aim'; e.t = 0.45; emit(w, 'aim', { id: e.id }); }
            if (Math.hypot(e.dvx, e.dvy) > 0.1) e.face = Math.atan2(e.dvy, e.dvx);
        }
        if (e.state !== 'chase') return;
        break;
    }
    case 'wasp': {
        if (e.state === 'dive') {
            steer(e, e.lx, e.ly, 12 * slow);
            contact(w, e, 0.15, 0.7);
            if (e.t <= 0 || e.wallHit) { e.state = 'retreat'; e.t = 0.6; }
        } else if (e.state === 'retreat') {
            steer(e, -e.lx * 0.6 + Math.cos(e.anim) * 0.4, -e.ly * 0.6 + Math.sin(e.anim) * 0.4, sp * 0.8);
            if (e.t <= 0) { e.state = 'chase'; e.cd = 1.2 + e.seed * 1.5; }
        } else {
            const sees = seePlayer(w, e, dt);
            if (!sees || d > 9) chase(w, e, sp, dt, 0.5);
            else {
                // Orbit the player and wobble.
                e.orb = (e.orb ?? e.seed * TAU) + dt * (e.seed > 0.5 ? 1.1 : -1.1);
                const tx = p.x + Math.cos(e.orb) * 4.5, ty = p.y + Math.sin(e.orb) * 4.5;
                const ox = tx - e.x, oy = ty - e.y, od = Math.hypot(ox, oy) || 1;
                steer(e, ox / od + Math.sin(e.anim * 3) * 0.3, oy / od + Math.cos(e.anim * 2.6) * 0.3, sp);
                if (e.cd <= 0 && d < 7.5) { e.state = 'dive'; e.t = 0.5; e.lx = ux; e.ly = uy; emit(w, 'buzz', { x: e.x, y: e.y }); }
            }
            contact(w, e, 0.1, 0.9);
        }
        break;
    }
    case 'stalker': {
        e.cloak = Math.max(0, e.cloak - dt);
        if (e.state === 'slash') {
            steer(e, ux, uy, sp * 0.3);
            e.face = toP;
            if (e.t <= 0) {
                if (d < e.r + p.r + 0.9) hurtPlayer(w, e.dmg, { x: e.x, y: e.y, kind: 'stalker' });
                emit(w, 'slash', { x: e.x, y: e.y, ang: toP });
                e.state = 'chase'; e.cd = 0.85; e.cloak = Math.max(e.cloak, 0.6);
            }
        } else {
            chase(w, e, sp, dt, 0.2);
            if (e.cd <= 0 && d < e.r + p.r + 0.75) { e.state = 'slash'; e.t = 0.2; e.cloak = 1; }
        }
        break;
    }
    case 'clone': {
        updateClone(w, e, dt);
        return;
    }
    case 'sac': {
        steer(e, 0, 0, 0);
        const active = w.mode === 'horde' || w.mode === 'escape' || (w.activeRoom >= 0 && w.activeRoom === e.room);
        if (active && e.cd <= 0) {
            e.cd = (e.alpha ? 2.6 : 3.4) + e.seed;
            let kids = 0;
            for (const o of w.enemies) if (o.parent === e.id && !o.dead) kids++;
            if (kids < 8 && w.enemies.length < w.cap) {
                const n = e.alpha ? 3 : 2;
                for (let i = 0; i < n; i++) {
                    const a = w.rng.range(0, TAU);
                    const kid = spawnEnemy(w, 'skitter', e.x + Math.cos(a) * 0.9, e.y + Math.sin(a) * 0.9, { emerge: 0.3, room: e.room });
                    kid.parent = e.id;
                }
                emit(w, 'birth', { x: e.x, y: e.y, id: e.id });
            }
        }
        return;
    }
    default: break;
    }
    // Face the way we move.
    const vs = Math.hypot(e.dvx, e.dvy);
    if (vs > 0.2 && e.type !== 'spitter') turnToward(e, Math.atan2(e.dvy, e.dvx), 9, dt);
}

// ------------------------------------------------------------------ Enemy bullets

export function updateEBullets(w, dt) {
    const p = w.player;
    const lv = w.lv;
    const B = w.ebullets;
    let n = 0;
    for (let i = 0; i < B.length; i++) {
        const b = B[i];
        b.ox = b.x; b.oy = b.y;
        b.t += dt;
        let alive = true;
        if (b.delay > 0) {
            b.delay -= dt;
        } else {
            if (b.curve) {
                const c = Math.cos(b.curve * dt), s = Math.sin(b.curve * dt);
                const vx = b.vx * c - b.vy * s, vy = b.vx * s + b.vy * c;
                b.vx = vx; b.vy = vy;
            }
            if (b.accel) {
                const sp = Math.hypot(b.vx, b.vy) || 1;
                const ns = Math.max(0.5, Math.min(18, sp + b.accel * dt));
                b.vx *= ns / sp; b.vy *= ns / sp;
            }
            const slow = w.cryoT > 0 ? 0.55 : 1;
            b.x += b.vx * dt * slow;
            b.y += b.vy * dt * slow;
            b.life -= dt;
            if (b.life <= 0) alive = false;
            else if (solidAt(lv, Math.floor(b.x), Math.floor(b.y))) {
                alive = false;
                if (w.events.length < 400) emit(w, 'bwall', { x: b.x, y: b.y, kind: b.kind });
            }
        }
        if (alive && p.alive) {
            const rr = b.r + p.r * 0.72;
            if ((b.x - p.x) * (b.x - p.x) + (b.y - p.y) * (b.y - p.y) < rr * rr) {
                if (p.rollT > 0) {
                    if (!b.grazed) { b.grazed = true; w.stats.grazes++; }
                } else {
                    const hit = hurtPlayer(w, b.dmg, { x: b.x - b.vx * 0.1, y: b.y - b.vy * 0.1, kind: b.kind });
                    if (hit && b.slow) p.slowT = Math.max(p.slowT, b.slow);
                    alive = false;
                }
            }
        }
        if (alive) B[n++] = b;
    }
    B.length = n;
}

export function clearBullets(w, x, y, r) {
    const B = w.ebullets;
    let n = 0, cleared = 0;
    for (let i = 0; i < B.length; i++) {
        const b = B[i];
        if ((b.x - x) * (b.x - x) + (b.y - y) * (b.y - y) < r * r) {
            cleared++;
            if (cleared < 80) emit(w, 'bclear', { x: b.x, y: b.y, kind: b.kind });
            continue;
        }
        B[n++] = b;
    }
    B.length = n;
    return cleared;
}
