/**
 * enemies.js — spawning and AI for the twelve regular enemy archetypes.
 *
 * Every attack is telegraphed: a wind-up state the view can read (e.state),
 * a hazard circle or beam on the floor, or a charge line. Elites (the stage-6
 * mini-boss) use the same brains with bigger numbers and an extra flourish.
 *
 * AI functions get (w, e, dt, sm) where sm is the slow multiplier; frozen
 * enemies are skipped before their AI runs.
 */

import { ENEMIES, ELITE } from '../config.js';
import { resolveCircle, flowStep, lineClear, walkable, flyable, cellAt, colOf, rowOf, cellX, cellY, blocksShot } from './grid.js';
import { spawnBullet, addHazard } from './combat.js';

const TAU = Math.PI * 2;
const emit = (w, type, data) => w.fxQueue.push({ type, ...data });

// ------------------------------------------------------------------ Spawning

export function makeEnemy(w, type, x, y, o = {}) {
    const def = ENEMIES[type];
    const d = w.diff;
    const elite = !!o.elite;
    const hpMul = d.hp * (elite ? ELITE.hp : 1) * (o.hpMul ?? 1);
    const e = {
        id: w.nextId++, type, def, x, y,
        r: def.r * (elite ? ELITE.r : 1),
        hp: Math.round(def.hp * hpMul), maxHp: Math.round(def.hp * hpMul),
        contact: def.contact * d.dmg * (elite ? ELITE.dmg : 1),
        shot: (def.shot ?? 0) * d.dmg * (elite ? ELITE.dmg : 1),
        speed: def.speed, fly: !!def.fly, phase: !!def.phase, elite, boss: false, alive: true,
        xp: def.xp * (elite ? ELITE.xp : 1) * (1 + 0.08 * (w.diffChapter - 1)),
        state: 'idle', t: 0, cd: w.rng.range(0.6, 1.8), spawnT: o.spawnT ?? w.rng.range(0.55, 1.0),
        face: -Math.PI / 2, z: 0, flash: -1, kx: 0, ky: 0,
        tempo: d.tempo * (elite ? 1 / ELITE.cd : 1),
        minion: !!o.minion,             // summoned by a boss: no loot
        data: {},
    };
    if (type === 'slime' && !o.noSplit) e.onDeath = splitSlime;
    w.enemies.push(e);
    emit(w, 'spawn', { x, y, id: e.id, type, elite });
    return e;
}

function splitSlime(w, e) {
    for (let k = 0; k < 2; k++) {
        const a = e.face + (k ? 1.4 : -1.4);
        const s = makeEnemy(w, 'slimelet', e.x + Math.cos(a) * 0.35, e.y + Math.sin(a) * 0.35, { spawnT: 0.25, hpMul: e.elite ? 3 : 1, minion: e.minion });
        resolveCircle(w.grid, s, s.r, false);
    }
}

// ------------------------------------------------------------------ Movement helpers

const toPlayer = (w, e) => {
    const p = w.player;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1e-6;
    return { dx: dx / d, dy: dy / d, d, ang: Math.atan2(dy, dx) };
};

/** Collision radius: wide bodies that have been stuck squeeze through 1-tile gaps for a moment. */
const bodyR = (e) => (e.squeeze > 0 ? Math.min(e.r, 0.44) : e.r);

export function moveBy(w, e, dx, dy) {
    const ox = e.x, oy = e.y;
    e.x += dx; e.y += dy;
    resolveCircle(w.grid, e, bodyR(e), e.fly);
    // A big body squeezed between obstacles can be pushed onto a blocked tile: undo instead.
    if (!e.fly && !walkable(cellAt(w.grid, colOf(e.x), rowOf(e.y)))) { e.x = ox; e.y = oy; }
    const want = Math.hypot(dx, dy), got = Math.hypot(e.x - ox, e.y - oy);
    if (want > 1e-4) e.face = Math.atan2(dy, dx);
    return want < 1e-4 ? 1 : got / want;       // fraction of the move that happened
}

const groundBlocks = (t) => !walkable(t);

/** Would this body fit along the straight line to (x, y)? Wide bodies test both edges too. */
function bodyClear(w, e, x, y) {
    if (!lineClear(w.grid, e.x, e.y, x, y, groundBlocks)) return false;
    if (bodyR(e) <= 0.5) return true;
    const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy) || 1;
    const ox = (-dy / d) * e.r * 0.95, oy = (dx / d) * e.r * 0.95;
    return lineClear(w.grid, e.x + ox, e.y + oy, x + ox, y + oy, groundBlocks)
        && lineClear(w.grid, e.x - ox, e.y - oy, x - ox, y - oy, groundBlocks);
}

/** Unit direction that walks toward the player: straight if possible, else downhill on the flow field. */
export function chaseDir(w, e) {
    const p = w.player;
    const tp = toPlayer(w, e);
    if (e.fly) {
        // Flyers cross pits but not rock: path around rock on the air field.
        if (e.phase || tp.d < 1.2 || lineClear(w.grid, e.x, e.y, p.x, p.y, blocksShot) || !w.flowAir) return tp;
        const wp = flowStep(w.grid, w.flowAir, e.x, e.y, flyable);
        if (!wp) return tp;
        const dx = wp.x - e.x, dy = wp.y - e.y, d = Math.hypot(dx, dy) || 1e-6;
        return { dx: dx / d, dy: dy / d, d: tp.d, ang: Math.atan2(dy, dx) };
    }
    if (tp.d < 1.2 || bodyClear(w, e, p.x, p.y)) return tp;
    // Big bodies follow the wide-body field so they never wedge themselves into a 1-tile gap.
    const wp = flowStep(w.grid, bodyR(e) > 0.5 && w.flowWide ? w.flowWide : w.flow, e.x, e.y);
    if (!wp) return tp;
    const dx = wp.x - e.x, dy = wp.y - e.y, d = Math.hypot(dx, dy) || 1e-6;
    return { dx: dx / d, dy: dy / d, d: tp.d, ang: Math.atan2(dy, dx) };
}

function chase(w, e, speed, dt) {
    const c = chaseDir(w, e);
    moveBy(w, e, c.dx * speed * dt, c.dy * speed * dt);
}

/** Hold a distance band from the player, strafing inside it. */
function keepRange(w, e, lo, hi, speed, dt) {
    const tp = toPlayer(w, e);
    if (tp.d > hi || !canShoot(w, e)) return chase(w, e, speed, dt);
    let dx, dy;
    if (tp.d < lo) { dx = -tp.dx; dy = -tp.dy; }
    else {
        const s = e.data.strafe ?? (e.data.strafe = (e.id % 2) ? 1 : -1);
        dx = -tp.dy * s * 0.6; dy = tp.dx * s * 0.6;
    }
    if (moveBy(w, e, dx * speed * dt, dy * speed * dt) < 0.3) e.data.strafe = -(e.data.strafe || 1);
}

const canShoot = (w, e) => lineClear(w.grid, e.x, e.y, w.player.x, w.player.y, blocksShot);

function fireFan(w, e, n, spread, speed, dmg, o) {
    const base = toPlayer(w, e).ang;
    for (let i = 0; i < n; i++) {
        const a = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
        spawnBullet(w, e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, a, speed, dmg, o);
    }
}

function fireRing(w, x, y, n, speed, dmg, offset = 0, o) {
    for (let i = 0; i < n; i++) {
        const a = offset + (i / n) * TAU;
        spawnBullet(w, x, y, a, speed, dmg, o);
    }
}

/** Nearest walkable tile centre to (x, y), for landings. */
function walkableNear(w, x, y) {
    const c0 = colOf(x), r0 = rowOf(y);
    for (let rad = 0; rad < 4; rad++) {
        for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
            if (walkable(cellAt(w.grid, c0 + dc, r0 + dr))) return rad === 0 ? { x, y } : { x: cellX(c0 + dc), y: cellY(r0 + dr) };
        }
    }
    return { x: w.player.x, y: w.player.y };
}

// ------------------------------------------------------------------ Brains

const AI = {
    slime(w, e, dt, sm) {
        if (e.state === 'hop') {
            e.t -= dt;
            const k = 1 - e.t / 0.42;
            e.z = Math.sin(Math.PI * Math.min(1, k)) * (e.type === 'slimelet' ? 0.35 : 0.55);
            moveBy(w, e, e.data.hx * e.speed * sm * dt, e.data.hy * e.speed * sm * dt);
            if (e.t <= 0) {
                e.z = 0;
                e.state = 'rest';
                e.t = w.rng.range(0.4, 0.85) / e.tempo;
                emit(w, 'land', { x: e.x, y: e.y, id: e.id });
                if (e.elite) fireRing(w, e.x, e.y, 8, 3.6, e.shot || e.contact * 0.7, w.rng.range(0, 1));
            }
        } else {
            e.t -= dt * sm;
            if (e.t <= 0) {
                const c = chaseDir(w, e);
                e.data.hx = c.dx; e.data.hy = c.dy;
                e.state = 'hop'; e.t = 0.42;
            }
        }
    },

    bat(w, e, dt, sm) {
        const tp = toPlayer(w, e);
        if (e.state === 'wind') {
            e.t -= dt;
            if (e.t <= 0) { e.state = 'dive'; e.t = 0.42; }
        } else if (e.state === 'dive') {
            e.t -= dt;
            moveBy(w, e, e.data.dx * 7.5 * sm * dt, e.data.dy * 7.5 * sm * dt);
            if (e.t <= 0) {
                e.state = 'fly'; e.cd = w.rng.range(2.2, 3.4) / e.tempo;
                if (e.elite) fireRing(w, e.x, e.y, 6, 3.4, e.contact * 0.7);
            }
        } else {
            const wob = Math.sin(w.time * 3.1 + e.id) * 1.0;
            const a = chaseDir(w, e).ang + wob;
            moveBy(w, e, Math.cos(a) * e.speed * sm * dt, Math.sin(a) * e.speed * sm * dt);
            e.cd -= dt;
            if (e.cd <= 0 && tp.d < 5.5) {
                e.state = 'wind'; e.t = 0.45;
                e.data.dx = tp.dx; e.data.dy = tp.dy;
                emit(w, 'enemyWind', { id: e.id, x: e.x, y: e.y });
            }
        }
    },

    archer(w, e, dt, sm) {
        if (e.state === 'aim') {
            e.t -= dt;
            if (e.t > 0.2) e.data.aim = toPlayer(w, e).ang;
            e.face = e.data.aim;
            if (e.t <= 0) {
                const n = e.elite ? 3 : 1;
                for (let i = 0; i < n; i++) {
                    const a = e.data.aim + (i - (n - 1) / 2) * 0.24;
                    spawnBullet(w, e.x + Math.cos(a) * 0.4, e.y + Math.sin(a) * 0.4, a, 7.5, e.shot, { kind: 'arrow', r: 0.14 });
                }
                emit(w, 'enemyFire', { x: e.x, y: e.y, kind: 'arrow' });
                e.state = 'move'; e.t = w.rng.range(1.0, 1.8) / e.tempo;
            }
        } else {
            keepRange(w, e, 4, 7, e.speed * sm, dt);
            e.t -= dt;
            if (e.t <= 0 && canShoot(w, e)) {
                e.state = 'aim'; e.t = 0.75; e.data.aim = toPlayer(w, e).ang;
            }
        }
    },

    plant(w, e, dt) {
        e.face = toPlayer(w, e).ang;
        if (e.state === 'wind') {
            e.t -= dt;
            if (e.t <= 0) {
                const n = e.elite ? 14 : 8;
                e.data.rot = (e.data.rot || 0) + Math.PI / n;
                fireRing(w, e.x, e.y, n, 3.8, e.shot, e.data.rot);
                emit(w, 'enemyFire', { x: e.x, y: e.y, kind: 'seed' });
                e.state = 'idle'; e.cd = 2.9 / e.tempo;
            }
        } else {
            e.cd -= dt;
            if (e.cd <= 0) { e.state = 'wind'; e.t = 0.55; emit(w, 'enemyWind', { id: e.id, x: e.x, y: e.y }); }
        }
    },

    mage(w, e, dt, sm) {
        if (e.state === 'cast') {
            e.t -= dt;
            e.face = toPlayer(w, e).ang;
            if (e.t <= 0) {
                fireFan(w, e, e.elite ? 5 : 3, e.elite ? 1.1 : 0.62, 4.6, e.shot, { kind: 'hex' });
                emit(w, 'enemyFire', { x: e.x, y: e.y, kind: 'hex' });
                if (e.elite && !e.data.second) { e.data.second = true; e.t = 0.35; return; }
                e.data.second = false;
                e.state = 'move'; e.cd = w.rng.range(2.2, 3.0) / e.tempo;
            }
        } else {
            keepRange(w, e, 3.5, 6.5, e.speed * sm, dt);
            e.cd -= dt;
            if (e.cd <= 0 && canShoot(w, e)) { e.state = 'cast'; e.t = 0.6; emit(w, 'enemyWind', { id: e.id, x: e.x, y: e.y }); }
        }
    },

    spider(w, e, dt, sm) {
        if (e.state === 'wind') {
            e.t -= dt;
            if (e.t <= 0) {
                e.state = 'leap'; e.t = 0.5;
                e.data.sx = e.x; e.data.sy = e.y;
            }
        } else if (e.state === 'leap') {
            e.t -= dt;
            const k = 1 - Math.max(0, e.t) / 0.5;
            e.x = e.data.sx + (e.data.tx - e.data.sx) * k;
            e.y = e.data.sy + (e.data.ty - e.data.sy) * k;
            e.z = Math.sin(Math.PI * k) * 1.6;
            e.face = Math.atan2(e.data.ty - e.data.sy, e.data.tx - e.data.sx);
            if (e.t <= 0) {
                e.z = 0;
                resolveCircle(w.grid, e, e.r, false);
                emit(w, 'land', { x: e.x, y: e.y, id: e.id, heavy: true });
                if (e.elite) fireRing(w, e.x, e.y, 8, 4, e.shot * 0.7, 0);
                e.state = 'idle'; e.cd = w.rng.range(1.1, 1.7) / e.tempo;
            }
        } else {
            chase(w, e, e.speed * sm * 0.6, dt);
            e.cd -= dt;
            const tp = toPlayer(w, e);
            if (e.cd <= 0 && tp.d < 7) {
                const t = walkableNear(w, w.player.x, w.player.y);
                e.data.tx = t.x; e.data.ty = t.y;
                e.state = 'wind'; e.t = 0.55;
                addHazard(w, { kind: 'circle', x: t.x, y: t.y, r: 0.95, delay: 1.05, dmg: e.shot, style: 'land' });
            }
        }
    },

    boar(w, e, dt, sm) {
        const tp = toPlayer(w, e);
        if (e.state === 'wind') {
            e.t -= dt;
            if (e.t > 0.25) e.data.ang = tp.ang;
            e.face = e.data.ang;
            if (e.t <= 0) { e.state = 'charge'; e.t = 0.9; emit(w, 'charge', { id: e.id, x: e.x, y: e.y }); }
        } else if (e.state === 'charge') {
            e.t -= dt;
            const sp = (e.elite ? 10.5 : 9) * sm;
            const f = moveBy(w, e, Math.cos(e.data.ang) * sp * dt, Math.sin(e.data.ang) * sp * dt);
            e.face = e.data.ang;
            if (f < 0.4 || e.t <= 0) {
                if (f < 0.4) {
                    emit(w, 'crash', { x: e.x, y: e.y, id: e.id });
                    if (e.elite) fireRing(w, e.x, e.y, 10, 3.6, e.contact * 0.6);
                }
                e.state = 'stun'; e.t = f < 0.4 ? 1.0 : 0.6;
            }
        } else if (e.state === 'stun') {
            e.t -= dt;
            if (e.t <= 0) { e.state = 'walk'; e.cd = w.rng.range(0.8, 1.4) / e.tempo; }
        } else {
            chase(w, e, e.speed * sm, dt);
            e.cd -= dt;
            if (e.cd <= 0 && tp.d < 8 && lineClear(w.grid, e.x, e.y, w.player.x, w.player.y, groundBlocks)) {
                e.state = 'wind'; e.t = 0.8; e.data.ang = tp.ang;
                addHazard(w, { kind: 'line', x: e.x, y: e.y, ang: tp.ang, len: 8, life: 0.8, owner: e.id, width: e.r });
                emit(w, 'enemyWind', { id: e.id, x: e.x, y: e.y });
            }
        }
    },

    bomber(w, e, dt, sm) {
        if (e.state === 'throw') {
            e.t -= dt;
            e.face = toPlayer(w, e).ang;
            if (e.t <= 0) {
                const p = w.player;
                const n = e.elite ? 3 : 1;
                for (let i = 0; i < n; i++) {
                    const ox = i === 0 ? 0 : w.rng.range(-2, 2), oy = i === 0 ? 0 : w.rng.range(-2, 2);
                    const tx = Math.max(-5, Math.min(5, p.x + ox)), ty = Math.max(0.5, Math.min(w.grid.rows - 0.5, p.y + oy));
                    addHazard(w, { kind: 'circle', x: tx, y: ty, r: 1.15, delay: 1.1, dmg: e.shot, style: 'bomb', fromX: e.x, fromY: e.y });
                }
                emit(w, 'enemyFire', { x: e.x, y: e.y, kind: 'bomb' });
                e.state = 'move'; e.cd = w.rng.range(2.8, 3.6) / e.tempo;
            }
        } else {
            keepRange(w, e, 4, 7.5, e.speed * sm, dt);
            e.cd -= dt;
            if (e.cd <= 0 && toPlayer(w, e).d < 9) { e.state = 'throw'; e.t = 0.4; }
        }
    },

    ghost(w, e, dt, sm) {
        const tp = toPlayer(w, e);
        if (tp.d > 2.2) moveBy(w, e, tp.dx * e.speed * sm * dt, tp.dy * e.speed * sm * dt);
        e.face = tp.ang;
        if (e.state === 'cast') {
            e.t -= dt;
            if (e.t <= 0) {
                const n = e.elite ? 3 : 1;
                for (let i = 0; i < n; i++) {
                    const a = tp.ang + (i - (n - 1) / 2) * 0.7;
                    spawnBullet(w, e.x, e.y, a, 3.1, e.shot, { kind: 'wisp', homing: 1.5, life: 5, r: 0.2, pass: true });
                }
                emit(w, 'enemyFire', { x: e.x, y: e.y, kind: 'wisp' });
                e.state = 'drift'; e.cd = w.rng.range(3.2, 4.2) / e.tempo;
            }
        } else {
            e.cd -= dt;
            if (e.cd <= 0) { e.state = 'cast'; e.t = 0.55; emit(w, 'enemyWind', { id: e.id, x: e.x, y: e.y }); }
        }
    },

    golem(w, e, dt, sm) {
        const tp = toPlayer(w, e);
        if (e.state === 'wind') {
            e.t -= dt;
            if (e.t <= 0) {
                const rings = e.elite ? 2 : 1;
                for (let i = 0; i < rings; i++) {
                    addHazard(w, { kind: 'ring', x: e.x, y: e.y, r: 0.4 - i * 1.3, maxR: 4, speed: 5.2, width: 0.32, dmg: e.shot });
                }
                addHazard(w, { kind: 'circle', x: e.x, y: e.y, r: 1.35, delay: 0, dmg: e.shot, style: 'slam' });
                emit(w, 'slam', { x: e.x, y: e.y, id: e.id });
                e.state = 'recover'; e.t = 0.8;
            }
        } else if (e.state === 'recover') {
            e.t -= dt;
            if (e.t <= 0) { e.state = 'walk'; e.cd = w.rng.range(2.4, 3.2) / e.tempo; }
        } else {
            chase(w, e, e.speed * sm, dt);
            e.cd -= dt;
            if (e.cd <= 0 && tp.d < 2.6) {
                e.state = 'wind'; e.t = 0.85;
                addHazard(w, { kind: 'circle', x: e.x, y: e.y, r: 1.35, delay: 0.85, dmg: 0, style: 'tele', owner: e.id, visualOnly: true });
                emit(w, 'enemyWind', { id: e.id, x: e.x, y: e.y });
            }
        }
    },

    worm(w, e, dt, sm) {
        if (e.state === 'under' || e.state === 'idle') {
            e.burrowed = true;
            if (e.state === 'idle') {
                e.state = 'under'; e.t = w.rng.range(1.3, 1.9);
                const p = w.player, a = w.rng.range(0, TAU), r = w.rng.range(1.8, 2.8);
                const t = walkableNear(w, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
                e.data.tx = t.x; e.data.ty = t.y;
            }
            const dx = e.data.tx - e.x, dy = e.data.ty - e.y, d = Math.hypot(dx, dy);
            if (d > 0.1) {
                const c = d < 1.2 || lineClear(w.grid, e.x, e.y, e.data.tx, e.data.ty, groundBlocks) ? { dx: dx / d, dy: dy / d } : chaseDir(w, e);
                moveBy(w, e, c.dx * e.speed * sm * dt, c.dy * e.speed * sm * dt);
            }
            e.t -= dt;
            if (e.t <= 0) { e.state = 'rise'; e.t = 0.5; emit(w, 'enemyWind', { id: e.id, x: e.x, y: e.y }); }
        } else if (e.state === 'rise') {
            e.t -= dt;
            if (e.t <= 0) {
                e.burrowed = false;
                const n = e.elite ? 12 : 6;
                fireRing(w, e.x, e.y, n, 3.9, e.shot, w.rng.range(0, 1));
                if (e.elite) fireFan(w, e, 3, 0.5, 5.5, e.shot);
                emit(w, 'emerge', { x: e.x, y: e.y, id: e.id });
                e.state = 'up'; e.t = 1.7 / e.tempo;
            }
        } else if (e.state === 'up') {
            e.face = toPlayer(w, e).ang;
            e.t -= dt;
            if (e.t <= 0) { e.state = 'dive'; e.t = 0.4; }
        } else if (e.state === 'dive') {
            e.t -= dt;
            if (e.t <= 0) { e.state = 'idle'; emit(w, 'burrow', { x: e.x, y: e.y, id: e.id }); }
        }
    },

    eye(w, e, dt, sm) {
        const tp = toPlayer(w, e);
        e.face = tp.ang;
        if (e.state === 'charge') {
            e.t -= dt;
            if (e.t <= 0) { e.state = 'hover'; e.cd = w.rng.range(3.0, 3.8) / e.tempo; }
        } else {
            // Drift to hold 4–7 units away.
            const s = tp.d < 4 ? -1 : tp.d > 7 ? 1 : 0;
            const wob = Math.sin(w.time * 1.3 + e.id * 2.1);
            moveBy(w, e, (tp.dx * s - tp.dy * wob * 0.5) * e.speed * sm * dt, (tp.dy * s + tp.dx * wob * 0.5) * e.speed * sm * dt);
            e.cd -= dt;
            if (e.cd <= 0) {
                e.state = 'charge'; e.t = 1.35;
                const offs = e.elite ? [-0.45, 0, 0.45] : [0];
                for (const off of offs) {
                    addHazard(w, { kind: 'beam', x: e.x, y: e.y, ang: tp.ang + off, angOff: off, len: 8, width: 0.28, delay: 1.0, dur: 0.35, dmg: e.shot, owner: e.id, track: true });
                }
                emit(w, 'enemyWind', { id: e.id, x: e.x, y: e.y });
            }
        }
    },
};
AI.slimelet = AI.slime;

// ------------------------------------------------------------------ Per-tick update

/** Run one enemy's brain plus the shared bits (spawn-in, knock-back, contact). */
export function thinkEnemy(w, e, dt, sm) {
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    if (e.kx || e.ky) {
        const k = Math.min(1, dt * 10);
        moveBy(w, e, e.kx * k * 0.5, e.ky * k * 0.5);
        e.kx *= 1 - k; e.ky *= 1 - k;
        if (Math.abs(e.kx) + Math.abs(e.ky) < 0.01) e.kx = e.ky = 0;
    }
    AI[e.type](w, e, dt, sm);
    watchStuck(w, e, dt);
}

/**
 * A wide walker that has made no progress toward a distant player for two
 * seconds squeezes (narrow collision) for three: the player can stand where
 * only narrow bodies fit, and the room must still be winnable.
 */
export function watchStuck(w, e, dt) {
    if (e.squeeze > 0) e.squeeze -= dt;
    if (e.fly || e.r <= 0.5 || e.speed <= 0) return;
    const D = e.data;
    D.chkT = (D.chkT ?? 1) - dt;
    if (D.chkT > 0) return;
    D.chkT = 1;
    const moved = Math.hypot(e.x - (D.lx ?? e.x + 9), e.y - (D.ly ?? e.y));
    D.lx = e.x; D.ly = e.y;
    const far = Math.hypot(w.player.x - e.x, w.player.y - e.y) > 2.4;
    D.stuck = moved < 0.25 && far ? (D.stuck || 0) + 1 : 0;
    if (D.stuck >= 2) { e.squeeze = 3; D.stuck = 0; }
}

export function canContact(e) {
    // A boss mid-leap deals its damage through the landing blast, not its body.
    return e.alive && e.spawnT <= 0 && !e.burrowed && !e.hidden && e.z < 0.5 && e.state !== 'rise' && !(e.boss && e.state === 'hop');
}

/** Contact damage multiplier while charging. */
export const contactMul = (e) => (e.state === 'charge' || e.state === 'dive' ? 1.3 : 1);
