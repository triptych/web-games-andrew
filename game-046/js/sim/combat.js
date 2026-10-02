/**
 * combat.js — everything that deals damage: the player's volleys and arrows
 * (with every arrow ability), orbiting circles, spirit wisps, elemental
 * statuses, enemy bullets, telegraphed hazards, kills and loot drops.
 */

import { ARROW, ROOM, xpToNext } from '../config.js';
import { cellAt, colOf, rowOf, ROCK, lineClear, resolveCircle } from './grid.js';
import { healPlayer } from './abilities.js';

const TAU = Math.PI * 2;
const emit = (w, type, data) => w.fxQueue.push({ type, ...data });
const lvl = (w, id) => w.player.ab[id] || 0;

export const targetable = (e) => e.alive && !e.burrowed && !e.hidden;

// ------------------------------------------------------------------ Targeting

/** Nearest enemy in line of sight; the nearest hidden one only if none is visible. */
export function pickTarget(w) {
    const p = w.player;
    let best = null, bestScore = Infinity;
    for (const e of w.enemies) {
        if (!targetable(e)) continue;
        let s = Math.hypot(e.x - p.x, e.y - p.y);
        if (!lineClear(w.grid, p.x, p.y, e.x, e.y)) s += 100;     // anything visible beats anything behind a wall
        if (s < bestScore) { bestScore = s; best = e; }
    }
    return best;
}

function nearestEnemy(w, x, y, maxD, exclude) {
    let best = null, bd = maxD;
    for (const e of w.enemies) {
        if (!targetable(e) || exclude.includes(e.id)) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < bd) { bd = d; best = e; }
    }
    return best;
}

// ------------------------------------------------------------------ Player attack

export function updatePlayerAttack(w, dt, moving) {
    const p = w.player;
    const cd = 1 / p.stat.aspd;
    // Queued multishot volleys fire even if the player starts moving.
    for (let i = p.volleys.length - 1; i >= 0; i--) {
        const v = p.volleys[i];
        v.t -= dt;
        if (v.t <= 0) { p.volleys.splice(i, 1); fireVolley(w, p.face, true); }
    }
    if (w.phase !== 'fight') { p.atkT = cd * (1 - 0.45); p.target = 0; return; }
    const tgt = pickTarget(w);
    p.target = tgt ? tgt.id : 0;
    if (moving || !tgt) {
        p.atkT = Math.max(p.atkT, cd * 0.55);
        return;
    }
    p.face = Math.atan2(tgt.y - p.y, tgt.x - p.x);
    p.atkT += dt;
    if (p.atkT >= cd) {
        p.atkT = 0;
        fireVolley(w, p.face, false);
        for (let k = 1; k <= lvl(w, 'multishot'); k++) p.volleys.push({ t: 0.11 * k });
    }
}

function fireVolley(w, ang, echo) {
    const p = w.player, a = p.ab;
    const dmg = p.stat.atk * p.stat.arrowMul;
    const shots = [];
    const nf = 1 + (a.front || 0);
    for (let i = 0; i < nf; i++) shots.push([ang, (i - (nf - 1) / 2) * 0.3]);
    const diagAngles = [0.52, 0.87, 0.26];
    for (let i = 0; i < (a.diagonal || 0); i++) {
        shots.push([ang + diagAngles[i], 0], [ang - diagAngles[i], 0]);
    }
    if (a.side) {
        shots.push([ang + Math.PI / 2, 0], [ang - Math.PI / 2, 0]);
        if (a.side > 1) shots.push([ang + Math.PI / 2, 0.3], [ang - Math.PI / 2, -0.3]);
    }
    if (a.rear) {
        shots.push([ang + Math.PI, 0]);
        if (a.rear > 1) shots.push([ang + Math.PI - 0.3, 0], [ang + Math.PI + 0.3, 0]);
    }
    // Headshot is rolled once per volley and rides on its first arrow, so arrow count doesn't multiply it.
    let headshot = !!a.headshot && w.rng.chance(0.05 * a.headshot);
    for (const [sa, off] of shots) {
        const cx = Math.cos(sa), cy = Math.sin(sa);
        spawnArrow(w, p.x + cx * 0.35 - cy * off, p.y + cy * 0.35 + cx * off, sa, dmg, {
            headshot,
            pierce: a.pierce || 0,
            ric: 2 * (a.ricochet || 0),
            bounce: 2 * (a.bouncy || 0),
            r: p.stat.arrowR,
            elem: true,
        });
        headshot = false;
    }
    p.shootT = w.time;
    emit(w, 'shoot', { x: p.x, y: p.y, ang, n: shots.length, echo });
}

export function spawnArrow(w, x, y, ang, dmg, o) {
    const speed = o.speed ?? ARROW.speed;
    w.arrows.push({
        id: w.nextId++, x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        r: o.r ?? ARROW.r, dmg, life: ARROW.life, pierce: o.pierce ?? 0, ric: o.ric ?? 0,
        bounce: o.bounce ?? 0, elem: !!o.elem, spirit: !!o.spirit, headshot: !!o.headshot, hit: [],
    });
}

const solidForArrow = (w, x, y) =>
    Math.abs(x) > ROOM.half || y < 0 || y > w.grid.rows || cellAt(w.grid, colOf(x), rowOf(y)) === ROCK;

export function updateArrows(w, dt) {
    const arr = w.arrows;
    for (let i = arr.length - 1; i >= 0; i--) {
        const s = arr[i];
        s.life -= dt;
        const ox = s.x, oy = s.y;
        s.x += s.vx * dt; s.y += s.vy * dt;
        let dead = s.life <= 0;
        if (!dead && solidForArrow(w, s.x, s.y)) {
            if (s.bounce > 0) {
                s.bounce--;
                const hitX = solidForArrow(w, s.x, oy), hitY = solidForArrow(w, ox, s.y);
                if (hitX || !hitY) s.vx = -s.vx;
                if (hitY || !hitX) s.vy = -s.vy;
                s.x = ox; s.y = oy;
                s.hit.length = 0;
                s.life = Math.max(s.life, 0.6);
                emit(w, 'arrowBounce', { x: ox, y: oy });
            } else {
                dead = true;
                emit(w, 'arrowWall', { x: ox, y: oy, ang: Math.atan2(s.vy, s.vx) });
            }
        }
        if (!dead) {
            for (const e of w.enemies) {
                if (!targetable(e) || s.hit.includes(e.id)) continue;
                const rr = e.r + s.r;
                if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 > rr * rr) continue;
                s.hit.push(e.id);
                hitEnemy(w, e, s.dmg, { elem: s.elem, ang: Math.atan2(s.vy, s.vx), spirit: s.spirit, headshot: s.headshot });
                s.headshot = false;
                if (s.pierce > 0) {
                    s.pierce--;
                    s.dmg *= 0.67;
                    continue;
                }
                if (s.ric > 0) {
                    const nxt = nearestEnemy(w, s.x, s.y, 6, s.hit);
                    if (nxt) {
                        s.ric--;
                        s.dmg *= 0.7;
                        const a = Math.atan2(nxt.y - s.y, nxt.x - s.x);
                        const sp = Math.hypot(s.vx, s.vy);
                        s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
                        s.life = Math.max(s.life, 0.8);
                        emit(w, 'ricochet', { x: s.x, y: s.y });
                        break;
                    }
                }
                dead = true;
                break;
            }
        }
        if (dead) arr.splice(i, 1);
    }
}

// ------------------------------------------------------------------ Damage to enemies

export function hitEnemy(w, e, base, o = {}) {
    const p = w.player;
    w.stats.hits++;
    let dmg = base;
    let crit = false, headshot = false;
    if (!o.noCrit && w.rng.chance(p.stat.crit)) { crit = true; dmg *= p.stat.critMul; }
    if (p.ab.rage) dmg *= 1 + 0.2 * p.ab.rage * (1 - p.hp / p.stat.maxHp);
    if (o.headshot && !e.boss && !e.elite) {
        headshot = true; dmg = e.hp;
    }
    damageEnemy(w, e, dmg, { crit, headshot, ang: o.ang });
    if (o.elem && e.alive) applyElements(w, e);
    if (o.elem && p.ab.bolt) chainBolt(w, e);
}

export function damageEnemy(w, e, dmg, info = {}) {
    if (!e.alive) return;
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    e.flash = w.time;
    w.stats.dmgDealt += dmg;
    if (info.ang !== undefined && !e.boss && !e.elite) {
        // A little knock-back so every hit reads.
        e.kx = (e.kx || 0) + Math.cos(info.ang) * 0.9;
        e.ky = (e.ky || 0) + Math.sin(info.ang) * 0.9;
        const k = Math.hypot(e.kx, e.ky);
        if (k > 1.2) { e.kx *= 1.2 / k; e.ky *= 1.2 / k; }
    }
    emit(w, info.dot ? 'dot' : 'hit', {
        x: e.x, y: e.y, id: e.id, dmg, crit: !!info.crit, headshot: !!info.headshot,
        elem: info.elem ?? null, boss: !!e.boss,
    });
    if (e.hp <= 0) killEnemy(w, e);
}

function applyElements(w, e) {
    const p = w.player, atk = p.stat.atk;
    if (p.ab.fire) { e.burnT = 2.5; e.burnDps = Math.max(e.burnDps || 0, 0.2 * atk * p.ab.fire); }
    if (p.ab.poison) e.poisonDps = Math.max(e.poisonDps || 0, 0.1 * atk * p.ab.poison);
    if (p.ab.frost) {
        e.slowT = 2;
        if (!e.boss && w.rng.chance(0.1 * p.ab.frost)) { e.frozenT = 1.1; emit(w, 'freeze', { x: e.x, y: e.y, id: e.id }); }
    }
}

function chainBolt(w, from) {
    const p = w.player;
    const n = 2 * p.ab.bolt;
    const hit = [from.id];
    const pts = [[from.x, from.y]];
    let cur = from;
    for (let k = 0; k < n; k++) {
        const nxt = nearestEnemy(w, cur.x, cur.y, 3.4, hit);
        if (!nxt) break;
        hit.push(nxt.id);
        pts.push([nxt.x, nxt.y]);
        damageEnemy(w, nxt, p.stat.atk * 0.3, { elem: 'bolt' });
        cur = nxt;
    }
    if (pts.length > 1) emit(w, 'bolt', { pts });
}

/** Burn / poison ticks, slow and freeze timers. Returns the speed multiplier. */
export function tickStatus(w, e, dt) {
    if (e.slowT > 0) e.slowT -= dt;
    if (e.frozenT > 0) e.frozenT -= dt;
    if (e.burnT > 0) e.burnT -= dt;
    e.dotT = (e.dotT || 0) + dt;
    if (e.dotT >= 0.5) {
        e.dotT -= 0.5;
        if (e.burnT > 0) damageEnemy(w, e, e.burnDps * 0.5, { dot: true, elem: 'fire' });
        if (e.alive && e.poisonDps) damageEnemy(w, e, e.poisonDps * 0.5, { dot: true, elem: 'poison' });
    }
    return e.slowT > 0 ? 0.55 : 1;
}

export function killEnemy(w, e) {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    w.stats.kills++;
    emit(w, 'kill', { x: e.x, y: e.y, id: e.id, type: e.type, boss: !!e.boss, elite: !!e.elite, r: e.r });
    if (e.boss) w.stats.bossKills++;
    const p = w.player;
    if (p.ab.bloodthirst) healPlayer(w, p.stat.maxHp * 0.025 * p.ab.bloodthirst);
    if (e.onDeath) e.onDeath(w, e);
    if (!e.minion) dropLoot(w, e);
}

function dropLoot(w, e) {
    const rng = w.rng;
    const n = Math.min(e.boss ? 14 : e.elite ? 8 : 5, Math.max(1, Math.ceil(e.xp)));
    for (let i = 0; i < n; i++) spawnPickup(w, 'xp', e.x, e.y, e.xp / n);
    const coins = e.boss ? 16 : e.elite ? 7 : (rng.chance(0.55) ? 1 : 0);
    const cv = 1 + Math.floor(w.diffChapter / 3);
    for (let i = 0; i < coins; i++) spawnPickup(w, 'coin', e.x, e.y, cv);
    if (!e.boss && rng.chance(e.elite ? 0.6 : 0.03)) spawnPickup(w, 'heart', e.x, e.y, 0.12);
}

export function spawnPickup(w, kind, x, y, value) {
    const a = w.rng.range(0, TAU), s = w.rng.range(1.5, 4.2);
    w.pickups.push({ id: w.nextId++, kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, value, t: 0, vz: w.rng.range(3, 5), z: 0.2 });
}

export function updatePickups(w, dt) {
    const p = w.player;
    const vacuum = w.phase !== 'fight';
    for (let i = w.pickups.length - 1; i >= 0; i--) {
        const k = w.pickups[i];
        k.t += dt;
        k.vz -= 14 * dt; k.z = Math.max(0, k.z + k.vz * dt);
        if (k.z === 0 && k.vz < 0) k.vz = -k.vz * 0.35;
        const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy);
        const pull = k.t > 0.45 && (vacuum || d < p.stat.magnet || k.kind === 'xp' && k.t > 5);
        if (pull) {
            // Accelerate from when the pull began, not from the drop, and cap it:
            // loot that lay around for a while must still visibly fly in.
            k.pt = (k.pt ?? 0) + dt;
            const sp = Math.min(22, 7 + k.pt * 18);
            k.x += (dx / d) * Math.min(d, sp * dt);
            k.y += (dy / d) * Math.min(d, sp * dt);
        } else {
            k.pt = 0;
            k.x += k.vx * dt; k.y += k.vy * dt;
            const f = Math.pow(0.02, dt);
            k.vx *= f; k.vy *= f;
            // Keep loot on open floor: a drop that scattered into a rock or pit
            // was hidden (or unreachable) yet still got vacuumed up later.
            resolveCircle(w.grid, k, 0.3, false);
        }
        if (d < 0.45 && k.t > 0.3) {
            w.pickups.splice(i, 1);
            if (k.kind === 'xp') addXp(w, k.value);
            else if (k.kind === 'coin') { w.coins += k.value; emit(w, 'coin', { x: k.x, y: k.y, v: k.value }); }
            else { healPlayer(w, p.stat.maxHp * k.value); emit(w, 'heart', { x: k.x, y: k.y }); }
        }
    }
}

export function addXp(w, v) {
    const p = w.player;
    p.xp += v;
    emit(w, 'xp', { v });
    while (p.xp >= xpToNext(p.level)) {
        p.xp -= xpToNext(p.level);
        p.level++;
        w.pendingLevels++;
        emit(w, 'levelUp', { level: p.level });
    }
}

// ------------------------------------------------------------------ Orbits & spirits

export function orbitPositions(w) {
    const p = w.player, out = [];
    const nf = 2 * lvl(w, 'orbFire'), ni = 2 * lvl(w, 'orbIce');
    for (let i = 0; i < nf; i++) {
        const a = w.time * 3.4 + (i / nf) * TAU;
        out.push({ kind: 'fire', x: p.x + Math.cos(a) * 1.3, y: p.y + Math.sin(a) * 1.3 });
    }
    for (let i = 0; i < ni; i++) {
        const a = -w.time * 2.8 + (i / ni) * TAU;
        out.push({ kind: 'ice', x: p.x + Math.cos(a) * 1.75, y: p.y + Math.sin(a) * 1.75 });
    }
    return out;
}

export function updateOrbits(w, dt) {
    if (!w.player.ab.orbFire && !w.player.ab.orbIce) return;
    const orbs = orbitPositions(w);
    const atk = w.player.stat.atk;
    for (const e of w.enemies) {
        if (!targetable(e)) continue;
        e.orbCd = Math.max(0, (e.orbCd || 0) - dt);
        if (e.orbCd > 0) continue;
        for (const o of orbs) {
            const rr = e.r + 0.28;
            if ((e.x - o.x) ** 2 + (e.y - o.y) ** 2 > rr * rr) continue;
            e.orbCd = 0.4;
            damageEnemy(w, e, atk * 0.4, { elem: o.kind });
            if (!e.alive) break;
            if (o.kind === 'fire') { e.burnT = 2; e.burnDps = Math.max(e.burnDps || 0, 0.15 * atk); }
            else e.slowT = 1.5;
            break;
        }
    }
}

export function spiritPositions(w) {
    const p = w.player, out = [];
    for (let i = 0; i < lvl(w, 'spirit'); i++) {
        const a = w.time * 0.9 + i * Math.PI + Math.PI / 2;
        out.push({ x: p.x + Math.cos(a) * 0.85, y: p.y + Math.sin(a) * 0.55 - 0.3 });
    }
    return out;
}

export function updateSpirits(w, dt) {
    const p = w.player;
    if (!p.ab.spirit || w.phase !== 'fight') return;
    p.spiritT = (p.spiritT || 0) + dt;
    if (p.spiritT < 1.0) return;
    const tgt = pickTarget(w);
    if (!tgt) return;
    p.spiritT = 0;
    for (const s of spiritPositions(w)) {
        const a = Math.atan2(tgt.y - s.y, tgt.x - s.x);
        spawnArrow(w, s.x, s.y, a, p.stat.atk * 0.3, { spirit: true, speed: 13, r: 0.12 });
    }
    emit(w, 'spiritShot', {});
}

// ------------------------------------------------------------------ Hurting the player

export function hurtPlayer(w, dmg, src = {}) {
    const p = w.player;
    if (w.phase !== 'fight' && w.phase !== 'clear') return false;
    if (p.invuln > 0 || p.starOn || p.dead) return false;
    if (p.ab.aegis && p.aegisT <= 0) {
        p.aegisT = 8;
        p.invuln = 0.35;
        emit(w, 'block', { x: p.x, y: p.y });
        return 'block';
    }
    if (w.rng.chance(p.stat.dodge)) {
        p.invuln = 0.2;
        emit(w, 'dodge', { x: p.x, y: p.y });
        return 'dodge';
    }
    const amt = Math.max(1, Math.round(dmg * p.stat.armor));
    p.hp -= amt;
    p.invuln = src.short ? 0.25 : src.kind === 'contact' ? 0.8 : 0.5;
    p.hurtT = w.time;
    w.stats.dmgTaken += amt;
    emit(w, 'playerHurt', { x: p.x, y: p.y, dmg: amt, src: src.kind ?? 'hit' });
    if (p.hp <= 0) {
        if (p.extraLife) {
            p.extraLife = false;
            p.ab.extralife = 0;
            p.hp = Math.round(p.stat.maxHp * 0.5);
            p.invuln = 2.5;
            w.bullets.length = 0;
            w.hazards = w.hazards.filter((h) => h.kind === 'line');
            emit(w, 'revive', { x: p.x, y: p.y });
        } else {
            p.hp = 0;
            p.dead = true;
            emit(w, 'death', { x: p.x, y: p.y });
        }
    }
    return true;
}

// ------------------------------------------------------------------ Enemy bullets

export function spawnBullet(w, x, y, ang, speed, dmg, o = {}) {
    w.bullets.push({
        id: w.nextId++, x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, speed,
        r: o.r ?? 0.17, dmg, life: o.life ?? 6, kind: o.kind ?? 'orb', homing: o.homing ?? 0,
        pass: !!o.pass, t: 0,
    });
}

export function updateBullets(w, dt) {
    const p = w.player;
    const b = w.bullets;
    for (let i = b.length - 1; i >= 0; i--) {
        const s = b[i];
        if (!s) continue;                   // a revive cleared the list mid-loop
        s.t += dt;
        s.life -= dt;
        if (s.homing && s.t < 3.2) {
            const want = Math.atan2(p.y - s.y, p.x - s.x);
            let cur = Math.atan2(s.vy, s.vx);
            let d = want - cur;
            while (d > Math.PI) d -= TAU;
            while (d < -Math.PI) d += TAU;
            cur += Math.max(-s.homing * dt, Math.min(s.homing * dt, d));
            s.vx = Math.cos(cur) * s.speed; s.vy = Math.sin(cur) * s.speed;
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
        let dead = s.life <= 0 || Math.abs(s.x) > ROOM.half + 0.3 || s.y < -0.3 || s.y > w.grid.rows + 0.3;
        if (!dead && !s.pass && cellAt(w.grid, colOf(s.x), rowOf(s.y)) === ROCK) {
            dead = true;
            emit(w, 'bulletPop', { x: s.x, y: s.y, kind: s.kind });
        }
        if (!dead && !p.dead) {
            const rr = s.r + p.r * 0.8;
            if ((s.x - p.x) ** 2 + (s.y - p.y) ** 2 < rr * rr) {
                const res = hurtPlayer(w, s.dmg, { kind: s.kind });
                dead = res === true || res === 'block' || !!p.starOn;
                if (dead) emit(w, 'bulletPop', { x: s.x, y: s.y, kind: s.kind });
            }
        }
        if (dead && b[i] === s) b.splice(i, 1);
    }
}

// ------------------------------------------------------------------ Hazards

/**
 * circle — telegraphed blast: hurts the player inside r when t reaches delay.
 * ring   — expanding shockwave, hurts once when its edge crosses the player.
 * beam   — telegraphed laser (tracks until 0.3 s before firing), then live for dur.
 * line   — purely visual charge telegraph.
 */
export function addHazard(w, h) {
    h.t = 0;
    h.id = w.nextId++;
    w.hazards.push(h);
    return h;
}

function segDist(px, py, x, y, ang, len) {
    const cx = Math.cos(ang), cy = Math.sin(ang);
    const t = Math.max(0, Math.min(len, (px - x) * cx + (py - y) * cy));
    return Math.hypot(px - (x + cx * t), py - (y + cy * t));
}

export function updateHazards(w, dt) {
    const p = w.player;
    const hz = w.hazards;
    for (let i = hz.length - 1; i >= 0; i--) {
        const h = hz[i];
        h.t += dt;
        let dead = false;
        const owner = h.owner ? w.enemies.find((e) => e.id === h.owner) : null;
        if (h.owner && (!owner || !owner.alive) && h.kind !== 'circle' && h.kind !== 'ring') { hz.splice(i, 1); continue; }
        if (h.kind === 'circle' && h.visualOnly) {
            if (owner) { h.x = owner.x; h.y = owner.y; }
            dead = h.t >= h.delay || (h.owner && (!owner || !owner.alive));
        } else if (h.kind === 'circle') {
            if (h.t >= h.delay) {
                if (Math.hypot(p.x - h.x, p.y - h.y) < h.r + p.r * 0.6) hurtPlayer(w, h.dmg, { kind: 'blast' });
                emit(w, 'boom', { x: h.x, y: h.y, r: h.r, style: h.style ?? 'bomb' });
                dead = true;
            }
        } else if (h.kind === 'ring') {
            h.r += h.speed * dt;
            const d = Math.hypot(p.x - h.x, p.y - h.y);
            if (!h.hit && Math.abs(d - h.r) < h.width + p.r * 0.6) {
                if (hurtPlayer(w, h.dmg, { kind: 'ring' })) h.hit = true;
            }
            dead = h.r >= h.maxR;
        } else if (h.kind === 'beam') {
            if (owner) { h.x = owner.x; h.y = owner.y; }
            if (h.track && h.t < h.delay - 0.3) {
                h.ang = Math.atan2(p.y - h.y, p.x - h.x) + (h.angOff || 0);
            }
            if (h.t >= h.delay && !h.fired) { h.fired = true; emit(w, 'beam', { x: h.x, y: h.y, ang: h.ang, len: h.len }); }
            if (h.t < h.delay - 0.3 || !h.fixedLen) h.len = rayLengthFor(w, h);
            if (h.t >= h.delay && !h.hit && segDist(p.x, p.y, h.x, h.y, h.ang, h.len) < h.width + p.r * 0.7) {
                if (hurtPlayer(w, h.dmg, { kind: 'beam' })) h.hit = true;
            }
            dead = h.t >= h.delay + h.dur;
        } else if (h.kind === 'line') {
            if (owner) { h.x = owner.x; h.y = owner.y; }
            dead = h.t >= h.life;
        }
        if (dead) hz.splice(i, 1);
    }
}

function rayLengthFor(w, h) {
    const cx = Math.cos(h.ang), cy = Math.sin(h.ang);
    for (let d = 0.3; d < 16; d += 0.1) {
        const px = h.x + cx * d, py = h.y + cy * d;
        if (Math.abs(px) > ROOM.half || py < 0 || py > w.grid.rows) return d;
        if (h.stopAtRock !== false && cellAt(w.grid, colOf(px), rowOf(py)) === ROCK) return d;
    }
    return 16;
}

