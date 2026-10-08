// Enemy behaviour, one function per kind. Every enemy is a plain object in
// world.enemies: { id, kind, x, y, vx, vy, r, hp, warp, t, alive, ... }.
// `warp` > 0 means it is still materialising: harmless and untouchable.
// `minor` enemies (mines, hunters) don't hold up the end of a wave.

import { FIELD, VIEW_W, COLONIST } from '../config.js';
import { wrap, wdx } from './util.js';

export const KINDS = {
    snatcher: { r: 8, hp: 1 },
    ravager: { r: 8, hp: 1 },
    minelayer: { r: 9, hp: 1 },
    mine: { r: 4, hp: 1, minor: true },
    hive: { r: 11, hp: 1 },
    stinger: { r: 5, hp: 1 },
    hunter: { r: 8, hp: 1, minor: true },
    dart: { r: 7, hp: 1 },
    meteor: { r: 0, hp: 1 },
};

export const METEOR_R = [0, 6, 10, 17];

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function makeEnemy(w, kind, x, y, extra = {}) {
    const k = KINDS[kind] || { r: 8, hp: 1 };
    const e = {
        id: w.nextId++, kind, x: wrap(x), y, vx: 0, vy: 0, r: k.r, hp: k.hp, warp: 0, t: 0, alive: true,
        minor: !!k.minor, fireT: w.rng.range(1.2, 3), ...extra,
    };
    w.enemies.push(e);
    return e;
}

// ------------------------------------------------------------------ shooting
/** Aimed shot from e toward the ship with some lead and spread. */
export function fireAimed(w, e, speed = 120, spread = 0.12, lead = 0.5) {
    const s = w.ship;
    if (!s.alive || w.shots.length >= w.maxShots) return false;
    const dx = wdx(s.x, e.x), dy = s.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 24) return false;
    const sp = speed * w.diff.shotSpeed * (1 + w.loop * 0.15);
    const tt = (dist / sp) * lead;
    const ang = Math.atan2(dy + (s.vy || 0) * tt, dx + s.vx * tt) + w.rng.range(-spread, spread);
    w.addShot(e.x, e.y, Math.cos(ang) * sp, Math.sin(ang) * sp);
    return true;
}

/** Ready to fire: counts the enemy's timer down, only while it is on screen. */
function ready(w, e, dt, lo, hi) {
    if (!w.onScreen(e.x, -10)) return false;
    e.fireT -= dt * w.aggr * w.diff.fire;
    if (e.fireT > 0) return false;
    e.fireT = w.rng.range(lo, hi);
    return true;
}

// ------------------------------------------------------------------ kinds
function snatcher(w, e, dt) {
    const spd = w.speed;
    if (!w.planetAlive) { toRavager(w, e); return; }
    if (e.state === 'lift') {
        const c = e.carry;
        e.y += 20 * spd * dt;
        e.x = wrap(e.x + Math.sin(e.t * 3) * 6 * dt);
        if (c) { c.x = e.x; c.y = e.y - 11; }
        if (e.y >= FIELD.top) {
            if (c) w.killColonist(c, 'taken');
            e.carry = null;
            toRavager(w, e);
            w.ev('mutate', e.x, e.y);
        }
        if (ready(w, e, dt, 2.2, 4)) fireAimed(w, e, 105);
        return;
    }
    // choose a colonist to go after
    let c = e.target;
    if (c && (c.state !== 'walk' || (c.hunter && c.hunter !== e))) c = e.target = null;
    if (!c && e.t > e.idle) {
        let best = null, bd = 1e9;
        for (const o of w.colonists) {
            if (o.state !== 'walk' || o.hunter) continue;
            const d = Math.abs(wdx(o.x, e.x)) + w.rng() * 200;
            if (d < bd) { bd = d; best = o; }
        }
        if (best) { c = e.target = best; best.hunter = e; }
    }
    if (c) {
        const dx = wdx(c.x, e.x);
        const near = Math.abs(dx) < 90;
        e.vx += (clamp(dx * 2, -48, 48) * spd - e.vx) * Math.min(1, dt * 2);
        const wantY = e.state === 'grab' ? c.y + 13 : near ? FIELD.ground + 44 : e.cruise;
        if (Math.abs(dx) < 5 && e.y < FIELD.ground + 50) e.state = 'grab';
        const vy = clamp((wantY - e.y) * 2, -40 * spd, 30 * spd);
        e.y += vy * dt;
        if (e.state === 'grab') {
            e.x = wrap(e.x + clamp(dx, -30 * dt, 30 * dt));
            if (Math.abs(dx) > 14) e.state = 'drift';
            else if (e.y <= c.y + 14) {
                c.state = 'grabbed'; c.by = e; c.hunter = null;
                e.carry = c; e.target = null; e.state = 'lift';
                w.ev('abduct', e.x, e.y);
                return;
            }
        }
    } else {
        e.vx += ((e.dir * 34 * spd) - e.vx) * Math.min(1, dt);
        e.y += ((e.cruise + Math.sin(e.t * 0.9) * 18) - e.y) * Math.min(1, dt * 0.8);
    }
    e.x = wrap(e.x + e.vx * dt);
    if (ready(w, e, dt, 1.8, 3.6)) fireAimed(w, e, 110);
}

export function toRavager(w, e) {
    if (e.carry) { w.dropColonist(e.carry); e.carry = null; }
    if (e.target) { e.target.hunter = null; e.target = null; }
    e.kind = 'ravager';
    e.state = 'hunt';
    e.fireT = w.rng.range(0.6, 1.6);
}

function ravager(w, e, dt) {
    const s = w.ship, spd = w.speed;
    const dx = wdx(s.x, e.x), dy = s.y - e.y;
    e.jt = (e.jt || 0) - dt;
    if (e.jt <= 0) { e.jt = w.rng.range(0.08, 0.2); e.jx = w.rng.range(-50, 50); e.jy = w.rng.range(-90, 90); }
    const far = Math.abs(dx) > 520;
    const top = (far ? 70 : 125) * spd * (0.85 + 0.15 * w.aggr);
    const tvx = clamp(dx * 2.5, -top, top) + (s.alive ? 0 : e.jx);
    e.vx += (tvx + e.jx - e.vx) * Math.min(1, dt * 3);
    const tvy = (s.alive ? clamp(dy * 1.4, -100, 100) : 0) + e.jy;
    e.vy += (tvy - e.vy) * Math.min(1, dt * 6);
    e.x = wrap(e.x + e.vx * dt);
    e.y = clamp(e.y + e.vy * dt, FIELD.floor, FIELD.top - 4);
    if (ready(w, e, dt, 0.9, 2.0)) fireAimed(w, e, 135, 0.08);
}

function minelayer(w, e, dt) {
    e.x = wrap(e.x + e.dir * 72 * w.speed * dt);
    e.y = e.base + Math.sin(e.t * 1.3 + e.phase) * 34;
    e.dropT -= dt * w.aggr;
    if (e.dropT <= 0) {
        e.dropT = w.rng.range(0.55, 1.0);
        if (w.countKind('mine') < 30) {
            makeEnemy(w, 'mine', e.x, e.y - 4, { life: w.rng.range(5, 7) });
            w.ev('mine', e.x, e.y);
        }
    }
}

function mine(w, e, dt) {
    e.life -= dt;
    if (e.life <= 0) e.alive = false;
}

function hive(w, e, dt) {
    e.x = wrap(e.x + e.vx * w.speed * dt);
    e.y += e.vy * w.speed * dt;
    if (e.y < 70 && e.vy < 0) e.vy = -e.vy;
    if (e.y > FIELD.top - 24 && e.vy > 0) e.vy = -e.vy;
}

function stinger(w, e, dt) {
    const s = w.ship, spd = w.speed;
    const dx = wdx(s.x, e.x);
    const top = 210 * spd;
    e.vx = clamp(e.vx + Math.sign(dx) * 340 * dt, -top, top);
    e.x = wrap(e.x + e.vx * dt);
    const ty = s.y + Math.sin(e.t * 3 + e.phase) * 40;
    e.y = clamp(e.y + clamp(ty - e.y, -90 * dt, 90 * dt) * spd, FIELD.floor, FIELD.top - 4);
    if (ready(w, e, dt, 1.6, 3.2) && w.shots.length < w.maxShots) {
        const sp = 170 * w.diff.shotSpeed;
        w.addShot(e.x, e.y, Math.sign(e.vx || 1) * sp, w.rng.range(-20, 20));
    }
}

function hunter(w, e, dt) {
    const s = w.ship;
    e.ot = (e.ot || 0) - dt;
    if (e.ot <= 0) { e.ot = w.rng.range(0.6, 1.4); e.ox = w.rng.range(-70, 70); e.oy = w.rng.range(-50, 50); }
    const tx = s.x + s.vx * 0.35 + e.ox;
    const dx = wdx(tx, e.x);
    const top = 470 * w.speed;
    e.vx += (clamp(s.vx + dx * 2.2, -top, top) - e.vx) * Math.min(1, dt * 3);
    e.x = wrap(e.x + e.vx * dt);
    e.y = clamp(e.y + clamp(s.y + e.oy - e.y, -130 * dt, 130 * dt), FIELD.floor + 6, FIELD.top - 6);
    if (ready(w, e, dt, 0.7, 1.3)) fireAimed(w, e, 150, 0.06, 0.8);
}

// Galaga-style squadron dart: enter along a curve, hold formation above the ship,
// peel off to dive, climb back to the slot.
function dart(w, e, dt) {
    const sq = e.sq, s = w.ship;
    if (e.state === 'wait') { e.delay -= dt; if (e.delay <= 0) e.state = 'enter'; e.warp = 0.0001; return; }
    const slotX = wrap(sq.ax + (e.slot - (sq.n - 1) / 2) * 24 + Math.sin(w.time * 1.6 + e.slot) * 5);
    const slotY = sq.ay + (e.slot % 2) * 12 + Math.sin(w.time * 2.2 + e.slot * 0.7) * 3;
    if (e.state === 'enter') {
        e.u = Math.min(1, e.u + dt * 0.55 * w.speed);
        const u = e.u, v = 1 - u;
        const p0x = -e.side * 230, p0y = 262, p1x = -e.side * 40, p1y = 40, p2x = e.side * 170, p2y = 60;
        const p3x = wdx(slotX, sq.ax), p3y = slotY;
        const bx = v * v * v * p0x + 3 * v * v * u * p1x + 3 * v * u * u * p2x + u * u * u * p3x;
        const by = v * v * v * p0y + 3 * v * v * u * p1y + 3 * v * u * u * p2y + u * u * u * p3y;
        const nx = wrap(sq.ax + bx);
        e.vx = wdx(nx, e.x) / dt; e.vy = (by - e.y) / dt;
        e.x = nx; e.y = by;
        if (u >= 1) e.state = 'form';
        return;
    }
    if (e.state === 'form') {
        e.x = wrap(e.x + wdx(slotX, e.x) * Math.min(1, dt * 4));
        e.y += (slotY - e.y) * Math.min(1, dt * 4);
        e.vx = 0; e.vy = 0;
        return;
    }
    if (e.state === 'dive' || e.state === 'return') {
        const sp = (e.state === 'dive' ? 175 : 150) * w.speed;
        const tx = e.state === 'dive' ? s.x : slotX, ty = e.state === 'dive' ? s.y : slotY;
        const want = Math.atan2(ty - e.y, wdx(tx, e.x));
        let da = want - e.ang;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        e.ang += clamp(da, -2.6 * dt, 2.6 * dt);
        e.vx = Math.cos(e.ang) * sp; e.vy = Math.sin(e.ang) * sp;
        e.x = wrap(e.x + e.vx * dt);
        e.y = clamp(e.y + e.vy * dt, FIELD.floor, FIELD.top + 10);
        e.dt += dt;
        if (e.state === 'dive') {
            if (!e.shot && e.dt > 0.5) { e.shot = true; fireAimed(w, e, 140, 0.05); }
            if (e.dt > 2.4 || e.y < Math.max(FIELD.floor + 8, s.y - 30) || (Math.abs(wdx(s.x, e.x)) < 12 && e.dt > 1)) {
                e.state = 'return'; e.dt = 0;
            }
        } else if ((Math.hypot(wdx(slotX, e.x), slotY - e.y) < 10) || e.dt > 4) {
            e.state = 'form';
        }
    }
}

/** The squadron's brain: drift the anchor after the ship and send divers. */
export function stepSquadron(w, sq, dt) {
    const s = w.ship;
    const dx = wdx(s.x, sq.ax);
    sq.ax = wrap(sq.ax + clamp(dx, -80 * dt, 80 * dt));
    sq.diveT -= dt * w.aggr;
    if (sq.diveT <= 0) {
        sq.diveT = w.rng.range(1.2, 2.6);
        const forming = w.enemies.filter((e) => e.alive && e.sq === sq && e.state === 'form');
        if (forming.length && s.alive && w.onScreen(sq.ax, 60)) {
            const d = w.rng.pick(forming);
            d.state = 'dive'; d.dt = 0; d.shot = false; d.ang = Math.PI / 2 + (wdx(s.x, d.x) > 0 ? -0.6 : 0.6);
            w.ev('dive', d.x, d.y);
        }
    }
}

function meteor(w, e, dt) {
    e.x = wrap(e.x + e.vx * dt);
    e.y += e.vy * dt;
    e.spin += dt;
    if (e.y > FIELD.top + 30 && e.vy > 0) e.vy = -Math.abs(e.vy);
    if (e.y - e.r < FIELD.ground) {
        if (w.planetAlive) {
            e.alive = false;
            w.meteorImpact(e);
        } else if (e.vy < 0) e.vy = -e.vy;
    }
}

const UPDATE = { snatcher, ravager, minelayer, mine, hive, stinger, hunter, dart, meteor };

export function stepEnemy(w, e, dt) {
    e.t += dt;
    if (e.warp > 0) { e.warp -= dt; if (e.warp > 0) return; e.warp = 0; }
    const f = UPDATE[e.kind];
    if (f) f(w, e, dt);
}

// ------------------------------------------------------------------ spawning
export function spawnSnatcher(w) {
    const x = w.spawnX(180);
    return makeEnemy(w, 'snatcher', x, w.rng.range(160, 225), {
        warp: 0.9, state: 'drift', dir: w.rng.chance(0.5) ? 1 : -1, cruise: w.rng.range(110, 200), idle: w.rng.range(0.5, 4),
    });
}

export function spawnMinelayer(w) {
    const x = w.spawnX(260);
    return makeEnemy(w, 'minelayer', x, 150, { warp: 0.9, dir: w.rng.chance(0.5) ? 1 : -1, base: w.rng.range(110, 190), phase: w.rng.range(0, 6), dropT: 1.5 });
}

export function spawnHive(w) {
    const x = w.spawnX(260);
    return makeEnemy(w, 'hive', x, w.rng.range(100, 200), {
        warp: 0.9, vx: w.rng.chance(0.5) ? 30 : -30, vy: w.rng.chance(0.5) ? 18 : -18, rot: w.rng.range(0, 6),
    });
}

export function burstHive(w, e) {
    const n = Math.min(8, 5 + w.loop);
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        makeEnemy(w, 'stinger', e.x + Math.cos(a) * 6, e.y + Math.sin(a) * 6, {
            vx: Math.cos(a) * 120, phase: a, fireT: w.rng.range(1.2, 2.6),
        });
    }
    w.ev('hiveBurst', e.x, e.y);
}

export function spawnHunter(w) {
    const s = w.ship;
    const side = w.rng.chance(0.5) ? 1 : -1;
    return makeEnemy(w, 'hunter', s.x + side * (VIEW_W * 0.75), w.rng.range(80, 220), { warp: 0.6, vx: s.vx });
}

export function spawnSquadron(w) {
    const n = Math.min(8, 6 + w.loop);
    const side = w.rng.chance(0.5) ? 1 : -1;
    const sq = { id: w.nextId++, n, killed: 0, lost: 0, ax: w.ship.x, ay: w.rng.range(190, 210), diveT: 3.5, done: false };
    w.squadrons.push(sq);
    for (let i = 0; i < n; i++) {
        makeEnemy(w, 'dart', sq.ax - side * 230, 262, { sq, slot: i, side, state: 'wait', delay: i * 0.16, u: 0, ang: 0, dt: 0, warp: 0 });
    }
    w.ev('squadron', sq.ax, 240);
    return sq;
}

export function spawnMeteor(w, size = 3, x = null, y = null, vx = null, vy = null) {
    const s = w.ship;
    const mx = x ?? s.x + w.rng.range(-420, 420);
    return makeEnemy(w, 'meteor', mx, y ?? FIELD.top + 18, {
        size, r: METEOR_R[size],
        vx: vx ?? w.rng.range(-55, 55), vy: vy ?? -w.rng.range(22, 42) * w.speed,
        spin: w.rng.range(0, 10), seed: w.rng.int(1, 1e6),
    });
}

export function splitMeteor(w, e) {
    if (e.size <= 1) return;
    const sp = Math.hypot(e.vx, e.vy) * 1.35 + 15;
    const base = Math.atan2(e.vy, e.vx);
    for (const d of [-0.6, 0.6]) {
        const a = base + d + w.rng.range(-0.25, 0.25);
        spawnMeteor(w, e.size - 1, e.x, e.y, Math.cos(a) * sp, Math.sin(a) * sp);
    }
}

export { COLONIST };
