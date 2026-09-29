/**
 * bosses.js — the five chapter bosses. Each is a small state machine that
 * cycles through an attack list, swapping to a harder list (phase two) below
 * a health threshold: 50% in chapters 1–5, 75% for the "Ascended" rematches
 * in chapters 6–10.
 *
 *   slimeKing   — leaps with a landing shockwave + bullet ring, spits fans, splits at 66% / 33%
 *   boneArcher  — arrow fans, arrow rain on telegraphed circles, dashes, a double spiral
 *   cinderGolem — telegraphed charges that crash into walls, triple stomp rings, meteors
 *   tideSerpent — rotating spiral streams, bullet walls with a gap, dives and resurfaces
 *   voidLich    — homing orbs, summons, teleport rings with a gap, rotating cross beams
 */

import { BOSSES } from '../config.js';
import { resolveCircle, walkable, cellAt, colOf, rowOf, cellX, cellY } from './grid.js';
import { spawnBullet, addHazard } from './combat.js';
import { makeEnemy, moveBy, chaseDir, watchStuck } from './enemies.js';

const TAU = Math.PI * 2;
const emit = (w, type, data) => w.fxQueue.push({ type, ...data });

const SEQ = {
    slimeKing:   [['hop', 'spit', 'hop'], ['hop', 'spit', 'hop', 'hop']],
    boneArcher:  [['fan', 'rain', 'dash', 'fan', 'rain', 'dash'], ['fan', 'spiral', 'rain', 'dash']],
    cinderGolem: [['charge', 'stomp', 'meteor'], ['charge', 'meteor', 'stomp', 'charge']],
    tideSerpent: [['spiral', 'aimed', 'wall', 'dive'], ['spiral', 'wall', 'dive', 'aimed']],
    voidLich:    [['orbs', 'summon', 'ringGap', 'orbs'], ['beams', 'orbs', 'ringGap', 'summon']],
};

export function makeBoss(w, bossId, x, y) {
    const def = BOSSES[bossId];
    const d = w.diff;
    const hp = Math.round(def.hp * d.hp);
    const e = {
        id: w.nextId++, type: 'boss', bossId, def, x, y, r: def.r,
        hp, maxHp: hp, contact: def.contact * d.dmg, shot: 78 * d.dmg,
        speed: bossId === 'slimeKing' ? 1.0 : 1.3, fly: def.fly, elite: false, boss: true, alive: true,
        xp: 30 * (1 + 0.1 * (w.diffChapter - 1)),
        state: 'idle', t: 1.2, cd: 0, spawnT: 1.4, face: -Math.PI / 2, z: 0, flash: -1, kx: 0, ky: 0,
        tempo: d.tempo, p2: false, seq: 0,
        p2At: w.diffChapter > 5 ? 0.75 : 0.5,
        data: { rot: 0 },
    };
    w.enemies.push(e);
    w.boss = e;
    emit(w, 'bossSpawn', { id: e.id, bossId, x, y });
    return e;
}

const toPlayer = (w, e) => {
    const p = w.player;
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1e-6;
    return { dx: dx / d, dy: dy / d, d, ang: Math.atan2(dy, dx) };
};

function ring(w, x, y, n, speed, dmg, off = 0, o) {
    for (let i = 0; i < n; i++) spawnBullet(w, x, y, off + (i / n) * TAU, speed, dmg, o);
}
function fan(w, e, n, spread, speed, dmg, o) {
    const base = toPlayer(w, e).ang;
    for (let i = 0; i < n; i++) {
        const a = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
        spawnBullet(w, e.x + Math.cos(a) * e.r * 0.8, e.y + Math.sin(a) * e.r * 0.8, a, speed, dmg, o);
    }
}

function randomFloor(w, test) {
    for (let k = 0; k < 60; k++) {
        const c = w.rng.int(0, w.grid.cols - 1), r = w.rng.int(2, w.grid.rows - 2);
        if (!walkable(cellAt(w.grid, c, r))) continue;
        const x = cellX(c), y = cellY(r);
        if (!test || test(x, y)) return { x, y };
    }
    return { x: 0, y: w.grid.rows * 0.6 };
}

function walkableNear(w, x, y) {
    const c0 = colOf(x), r0 = rowOf(y);
    for (let rad = 0; rad < 4; rad++) {
        for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
            if (walkable(cellAt(w.grid, c0 + dc, r0 + dr))) return rad === 0 ? { x, y } : { x: cellX(c0 + dc), y: cellY(r0 + dr) };
        }
    }
    return { x, y };
}

const clampRoom = (w, x, y) => ({ x: Math.max(-4.8, Math.min(4.8, x)), y: Math.max(0.8, Math.min(w.grid.rows - 0.8, y)) });

function nextAttack(w, e) {
    const list = SEQ[e.bossId][e.p2 ? 1 : 0];
    e.state = list[e.seq % list.length];
    e.seq++;
    e.t = 0;
    e.data.k = 0;
    emit(w, 'bossAttack', { id: e.id, attack: e.state });
}

function toIdle(e, dur = 1.1) {
    e.state = 'idle';
    e.t = dur / e.tempo;
    e.hidden = false;
    e.z = 0;
}

// Each brain returns nothing; `e.t` counts DOWN in idle and UP in attacks.
const BRAIN = {
    slimeKing(w, e, dt, sm) {
        const D = e.data;
        const thresholds = [0.66, 0.33];
        for (let i = 0; i < 2; i++) {
            if (!D['split' + i] && e.hp < e.maxHp * thresholds[i]) {
                D['split' + i] = true;
                for (let k = 0; k < 2; k++) {
                    const s = makeEnemy(w, 'slime', e.x + (k ? 1 : -1) * e.r, e.y, { spawnT: 0.3, hpMul: 1.4, minion: true });
                    resolveCircle(w.grid, s, s.r, false);
                }
                emit(w, 'bossSplit', { x: e.x, y: e.y });
            }
        }
        if (e.state === 'idle') {
            const c = chaseDir(w, e);
            moveBy(w, e, c.dx * e.speed * sm * dt, c.dy * e.speed * sm * dt);
            e.t -= dt;
            if (e.t <= 0) nextAttack(w, e);
            return;
        }
        e.t += dt;
        if (e.state === 'hop') {
            const AIR0 = 0.45, LAND = 1.25;
            if (D.k === 0) {
                D.k = 1;
                const t = walkableNear(w, w.player.x, w.player.y);
                D.sx = e.x; D.sy = e.y; D.tx = t.x; D.ty = t.y;
                addHazard(w, { kind: 'circle', x: t.x, y: t.y, r: 1.8, delay: LAND, dmg: e.shot * 1.2, style: 'land' });
            }
            if (e.t > AIR0 && e.t < LAND) {
                const k = (e.t - AIR0) / (LAND - AIR0);
                e.x = D.sx + (D.tx - D.sx) * k;
                e.y = D.sy + (D.ty - D.sy) * k;
                e.z = Math.sin(Math.PI * k) * 3.2;
                e.hidden = e.z > 1.2;
            }
            if (e.t >= LAND && D.k === 1) {
                D.k = 2;
                e.x = D.tx; e.y = D.ty; e.z = 0; e.hidden = false;
                resolveCircle(w.grid, e, e.r, false);
                if (!walkable(cellAt(w.grid, colOf(e.x), rowOf(e.y)))) { e.x = D.tx; e.y = D.ty; }
                ring(w, e.x, e.y, e.p2 ? 15 : 12, 3.5, e.shot * 0.8, w.rng.range(0, 1));
                emit(w, 'slam', { x: e.x, y: e.y, id: e.id, big: true });
            }
            if (e.p2 && e.t >= LAND + 0.28 && D.k === 2) {
                D.k = 3;
                ring(w, e.x, e.y, 12, 2.8, e.shot * 0.8, Math.PI / 12);
            }
            if (e.t >= LAND + 0.45) toIdle(e, 0.9);
        } else if (e.state === 'spit') {
            const times = [0.35, 0.7, 1.05];
            if (D.k < 3 && e.t >= times[D.k]) {
                D.k++;
                fan(w, e, e.p2 ? 5 : 4, 1.25, 4, e.shot * 0.7, { kind: 'goo', r: 0.2 });
                emit(w, 'enemyFire', { x: e.x, y: e.y, kind: 'goo' });
            }
            if (e.t >= 1.35) toIdle(e);
        }
    },

    boneArcher(w, e, dt, sm) {
        const D = e.data;
        const tp = toPlayer(w, e);
        e.face = tp.ang;
        if (e.state === 'idle') {
            const s = tp.d < 5 ? -1 : tp.d > 8 ? 1 : 0;
            const str = Math.sin(w.time * 0.9) > 0 ? 1 : -1;
            moveBy(w, e, (tp.dx * s - tp.dy * str * 0.7) * 2.2 * sm * dt, (tp.dy * s + tp.dx * str * 0.7) * 2.2 * sm * dt);
            e.t -= dt;
            if (e.t <= 0) nextAttack(w, e);
            return;
        }
        e.t += dt;
        if (e.state === 'fan') {
            const times = e.p2 ? [0.5, 0.85, 1.2] : [0.5, 0.9];
            if (D.k < times.length && e.t >= times[D.k]) {
                D.k++;
                fan(w, e, e.p2 ? 7 : 5, 1.1, 7.5, e.shot, { kind: 'arrow', r: 0.15 });
                emit(w, 'enemyFire', { x: e.x, y: e.y, kind: 'arrow' });
            }
            if (e.t >= times[times.length - 1] + 0.5) toIdle(e);
        } else if (e.state === 'rain') {
            if (D.k === 0 && e.t >= 0.4) {
                D.k = 1;
                const p = w.player;
                const n = e.p2 ? 8 : 5;
                for (let i = 0; i < n; i++) {
                    const c = i === 0 ? { x: p.x, y: p.y } : clampRoom(w, p.x + w.rng.range(-2.8, 2.8), p.y + w.rng.range(-2.8, 2.8));
                    addHazard(w, { kind: 'circle', x: c.x, y: c.y, r: 0.85, delay: 1.0 + i * 0.06, dmg: e.shot, style: 'rain' });
                }
                emit(w, 'enemyFire', { x: e.x, y: e.y, kind: 'volley' });
            }
            if (e.t >= 0.9) toIdle(e, 0.8);
        } else if (e.state === 'dash') {
            if (D.k === 0) {
                D.k = 1;
                const p = w.player;
                const t = randomFloor(w, (x, y) => { const d = Math.hypot(x - p.x, y - p.y); return d > 4 && d < 8; });
                D.tx = t.x; D.ty = t.y;
                emit(w, 'bossDash', { id: e.id });
            }
            const dx = D.tx - e.x, dy = D.ty - e.y, d = Math.hypot(dx, dy);
            if (d > 0.2) moveBy(w, e, (dx / d) * 9 * dt, (dy / d) * 9 * dt);
            if (d <= 0.2 || e.t > 1.0) toIdle(e, 0.5);
        } else if (e.state === 'spiral') {
            D.acc = (D.acc || 0) + dt;
            while (D.acc >= 0.09 && e.t < 2.2) {
                D.acc -= 0.09;
                D.rot += 0.27;
                spawnBullet(w, e.x, e.y, D.rot, 4, e.shot * 0.8, { kind: 'arrow', r: 0.15 });
                spawnBullet(w, e.x, e.y, D.rot + Math.PI, 4, e.shot * 0.8, { kind: 'arrow', r: 0.15 });
            }
            if (e.t >= 2.4) toIdle(e);
        }
    },

    cinderGolem(w, e, dt, sm) {
        const D = e.data;
        const tp = toPlayer(w, e);
        if (e.state === 'idle') {
            const c = chaseDir(w, e);
            moveBy(w, e, c.dx * 1.2 * sm * dt, c.dy * 1.2 * sm * dt);
            e.t -= dt;
            if (e.t <= 0) nextAttack(w, e);
            return;
        }
        e.t += dt;
        if (e.state === 'charge') {
            if (D.k === 0) {
                D.k = 1; D.ang = tp.ang;
                addHazard(w, { kind: 'line', x: e.x, y: e.y, ang: tp.ang, len: 14, life: 0.9, owner: e.id, width: e.r });
                emit(w, 'enemyWind', { id: e.id, x: e.x, y: e.y });
            }
            if (e.t < 0.65) D.ang = toPlayer(w, e).ang;
            e.face = D.ang;
            for (const h of w.hazards) if (h.kind === 'line' && h.owner === e.id) h.ang = D.ang;
            if (e.t >= 0.9) {
                if (D.k === 1) { D.k = 2; emit(w, 'charge', { id: e.id, x: e.x, y: e.y }); }
                const f = moveBy(w, e, Math.cos(D.ang) * 11 * sm * dt, Math.sin(D.ang) * 11 * sm * dt);
                if (f < 0.4) {
                    ring(w, e.x, e.y, e.p2 ? 14 : 10, 3.8, e.shot * 0.8, w.rng.range(0, 1), { kind: 'ember' });
                    emit(w, 'crash', { x: e.x, y: e.y, id: e.id, big: true });
                    e.state = 'stun'; e.t = 0;
                } else if (e.t >= 2.3) toIdle(e, 0.5);
            }
        } else if (e.state === 'stun') {
            if (e.t >= 1.1) toIdle(e, 0.6);
        } else if (e.state === 'stomp') {
            if (D.k === 0) {
                D.k = 1;
                addHazard(w, { kind: 'circle', x: e.x, y: e.y, r: 1.9, delay: 0.7, dmg: 0, style: 'tele', owner: e.id, visualOnly: true });
                emit(w, 'enemyWind', { id: e.id, x: e.x, y: e.y });
            }
            const times = [0.7, 1.05, 1.4];
            if (D.k - 1 < 3 && e.t >= times[D.k - 1]) {
                D.k++;
                addHazard(w, { kind: 'ring', x: e.x, y: e.y, r: 0.6, maxR: 6, speed: 5.5, width: 0.34, dmg: e.shot });
                if (D.k === 2) addHazard(w, { kind: 'circle', x: e.x, y: e.y, r: 1.9, delay: 0, dmg: e.shot, style: 'slam' });
                emit(w, 'slam', { x: e.x, y: e.y, id: e.id, big: D.k === 2 });
            }
            if (e.t >= 1.9) toIdle(e);
        } else if (e.state === 'meteor') {
            if (D.k === 0 && e.t >= 0.3) {
                D.k = 1;
                const p = w.player;
                const n = e.p2 ? 10 : 6;
                for (let i = 0; i < n; i++) {
                    const c = i === 0 ? { x: p.x, y: p.y } : clampRoom(w, p.x + w.rng.range(-4, 4), p.y + w.rng.range(-4, 4));
                    addHazard(w, { kind: 'circle', x: c.x, y: c.y, r: 1.0, delay: 1.3 + i * 0.08, dmg: e.shot, style: 'meteor' });
                }
                emit(w, 'roar', { id: e.id });
            }
            if (e.t >= 1.0) toIdle(e, 0.9);
        }
    },

    tideSerpent(w, e, dt, sm) {
        const D = e.data;
        const rows = w.grid.rows;
        e.face = toPlayer(w, e).ang;
        if (e.state === 'idle') {
            const tx = Math.sin(w.time * 0.7) * 3.4, ty = rows - 3.4 + Math.sin(w.time * 1.1) * 0.8;
            const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
            if (d > 0.05) moveBy(w, e, (dx / d) * Math.min(d, 2.6 * dt * sm), (dy / d) * Math.min(d, 2.6 * dt * sm));
            e.t -= dt;
            if (e.t <= 0) nextAttack(w, e);
            return;
        }
        e.t += dt;
        if (e.state === 'spiral') {
            D.acc = (D.acc || 0) + dt;
            const arms = e.p2 ? 4 : 3;
            while (D.acc >= 0.13 && e.t < 2.6) {
                D.acc -= 0.13;
                D.rot += 0.19;
                for (let i = 0; i < arms; i++) {
                    spawnBullet(w, e.x, e.y, D.rot + (i / arms) * TAU, 3.5, e.shot * 0.75, { kind: 'bubble', r: 0.19 });
                    if (e.p2 && i % 2 === 0) spawnBullet(w, e.x, e.y, -D.rot + (i / arms) * TAU, 3.0, e.shot * 0.75, { kind: 'bubble', r: 0.19 });
                }
            }
            if (e.t >= 2.8) toIdle(e);
        } else if (e.state === 'wall') {
            const waves = e.p2 ? 3 : 2;
            if (D.k < waves && e.t >= 0.3 + D.k * 0.95) {
                D.k++;
                const gx = w.rng.range(-3.4, 3.4);
                for (let x = -5.2; x <= 5.21; x += 0.52) {
                    if (Math.abs(x - gx) > 1.15) spawnBullet(w, x, e.y - 0.6, -Math.PI / 2, 3.0, e.shot * 0.75, { kind: 'bubble', r: 0.19, life: 9, pass: true });
                }
                emit(w, 'enemyFire', { x: e.x, y: e.y, kind: 'wave' });
            }
            if (e.t >= 0.3 + waves * 0.95) toIdle(e, 0.8);
        } else if (e.state === 'dive') {
            if (D.k === 0) { D.k = 1; e.hidden = true; emit(w, 'submerge', { x: e.x, y: e.y, id: e.id }); }
            if (D.k === 1 && e.t >= 0.55) {
                D.k = 2;
                e.x = w.rng.range(-3.5, 3.5);
                e.y = rows - w.rng.range(2.5, 4.8);
                resolveCircle(w.grid, e, e.r, true);
            }
            if (D.k === 2 && e.t >= 1.05) {
                D.k = 3;
                e.hidden = false;
                ring(w, e.x, e.y, e.p2 ? 24 : 16, 3.8, e.shot * 0.8, w.rng.range(0, 1), { kind: 'bubble', r: 0.19 });
                emit(w, 'emerge', { x: e.x, y: e.y, id: e.id, big: true });
            }
            if (e.t >= 1.4) toIdle(e, 0.9);
        } else if (e.state === 'aimed') {
            const times = [0.3, 0.6, 0.9];
            if (D.k < 3 && e.t >= times[D.k]) {
                D.k++;
                fan(w, e, 3, 0.36, 6, e.shot, { kind: 'bubble', r: 0.19 });
            }
            if (e.t >= 1.2) toIdle(e);
        }
    },

    voidLich(w, e, dt, sm) {
        const D = e.data;
        e.face = toPlayer(w, e).ang;
        if (e.state === 'idle') {
            if (D.tx === undefined || Math.hypot(D.tx - e.x, D.ty - e.y) < 0.3) {
                const t = clampRoom(w, w.rng.range(-4, 4), w.rng.range(w.grid.rows * 0.4, w.grid.rows - 1.5));
                D.tx = t.x; D.ty = t.y;
            }
            const dx = D.tx - e.x, dy = D.ty - e.y, d = Math.hypot(dx, dy) || 1;
            moveBy(w, e, (dx / d) * 2 * sm * dt, (dy / d) * 2 * sm * dt);
            e.t -= dt;
            if (e.t <= 0) nextAttack(w, e);
            return;
        }
        e.t += dt;
        if (e.state === 'orbs') {
            if (D.k === 0 && e.t >= 0.5) {
                D.k = 1;
                const n = e.p2 ? 5 : 3;
                const base = toPlayer(w, e).ang;
                for (let i = 0; i < n; i++) {
                    const a = base + (i / (n - 1) - 0.5) * 2.2;
                    spawnBullet(w, e.x, e.y, a, 3.2, e.shot, { kind: 'void', homing: 1.35, life: 5.5, r: 0.22, pass: true });
                }
                emit(w, 'enemyFire', { x: e.x, y: e.y, kind: 'void' });
            }
            if (e.t >= 0.9) toIdle(e);
        } else if (e.state === 'summon') {
            if (D.k === 0 && e.t >= 0.6) {
                D.k = 1;
                const minions = w.enemies.filter((m) => m.alive && !m.boss).length;
                // A capped number of summons per fight, so a weak build can't be pinned down forever.
                if (minions < 4 && (D.summoned || 0) < (e.p2 ? 8 : 4)) {
                    D.summoned = (D.summoned || 0) + 2;
                    for (let k = 0; k < 2; k++) {
                        const m = makeEnemy(w, e.p2 ? 'ghost' : 'bat', e.x + (k ? 1.2 : -1.2), e.y, { spawnT: 0.5, hpMul: 0.8, minion: true });
                        resolveCircle(w.grid, m, m.r, true);
                    }
                    emit(w, 'summon', { x: e.x, y: e.y });
                } else {
                    ring(w, e.x, e.y, 12, 3.4, e.shot, 0, { kind: 'void', pass: true });
                }
            }
            if (e.t >= 1.0) toIdle(e);
        } else if (e.state === 'ringGap') {
            if (D.k === 0) { D.k = 1; e.hidden = true; emit(w, 'teleport', { x: e.x, y: e.y, id: e.id }); }
            if (D.k === 1 && e.t >= 0.5) {
                D.k = 2;
                const p = w.player;
                let t;
                for (let i = 0; i < 20; i++) {
                    t = clampRoom(w, w.rng.range(-4, 4), w.rng.range(w.grid.rows * 0.35, w.grid.rows - 1.5));
                    if (Math.hypot(t.x - p.x, t.y - p.y) > 4) break;
                }
                e.x = t.x; e.y = t.y; e.hidden = false;
                resolveCircle(w.grid, e, e.r, true);
                emit(w, 'teleport', { x: e.x, y: e.y, id: e.id, arrive: true });
            }
            const shots = [0.85, 1.35];
            if (D.k >= 2 && D.k - 2 < 2 && e.t >= shots[D.k - 2]) {
                const gap = toPlayer(w, e).ang + w.rng.range(-0.6, 0.6);
                const n = 28;
                for (let i = 0; i < n; i++) {
                    const a = gap + (i / n) * TAU;
                    if (i < 2 || i > n - 3) continue;       // the gap, centred on the player
                    spawnBullet(w, e.x, e.y, a, 3.4, e.shot * 0.8, { kind: 'void', pass: true });
                }
                D.k++;
            }
            if (e.t >= 1.8) toIdle(e);
        } else if (e.state === 'beams') {
            if (D.k === 0) {
                D.k = 1;
                D.base = w.rng.range(0, TAU);
                for (let i = 0; i < 4; i++) addHazard(w, { kind: 'beam', x: e.x, y: e.y, ang: D.base + i * Math.PI / 2, len: 16, width: 0.34, delay: 1.1, dur: 0.5, dmg: e.shot, owner: e.id, track: false, stopAtRock: false });
                emit(w, 'enemyWind', { id: e.id, x: e.x, y: e.y });
            }
            if (D.k === 1 && e.t >= 1.7) {
                D.k = 2;
                for (let i = 0; i < 4; i++) addHazard(w, { kind: 'beam', x: e.x, y: e.y, ang: D.base + Math.PI / 4 + i * Math.PI / 2, len: 16, width: 0.34, delay: 1.0, dur: 0.5, dmg: e.shot, owner: e.id, track: false, stopAtRock: false });
            }
            if (e.t >= 3.3) toIdle(e);
        }
    },
};

export function thinkBoss(w, e, dt, sm) {
    if (e.spawnT > 0) { e.spawnT -= dt; return; }
    if (!e.p2 && e.hp < e.maxHp * e.p2At) {
        e.p2 = true;
        e.tempo *= 1.2;
        emit(w, 'bossPhase', { id: e.id, x: e.x, y: e.y });
    }
    BRAIN[e.bossId](w, e, dt, sm);
    if (e.state === 'idle') watchStuck(w, e, dt);
}
