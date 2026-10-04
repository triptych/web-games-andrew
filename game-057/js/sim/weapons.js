/**
 * weapons.js — the marine's guns, projectiles, grenades, the Shock Pulse and
 * gun drones.
 *
 * Bullets are plain objects swept along their path in sub-steps; the arc
 * caster and the rail lance are hitscan and emit a line for the view to draw.
 */

import { WEAPONS, MK_DMG, MK_RATE, PLAYER } from '../config.js';
import {
    TAU, angDiff, emit, raycast, los, queryHash, damageEnemy, damageProp, explode, dmgMul, hasPerk, solidAt,
} from './core.js';
import { clearBullets } from './enemies.js';

export function weaponStats(id, mk) {
    const def = WEAPONS[id];
    return { def, dmg: def.dmg * MK_DMG[mk - 1], rate: def.rate * MK_RATE[mk - 1] };
}

export function curWeapon(p) { return p.weapons[p.cur]; }

function startReload(w, p, wp) {
    const def = WEAPONS[wp.id];
    if (p.reloadT > 0 || wp.mag >= def.mag || wp.reserve <= 0) return;
    p.reloadDur = def.reload * (hasPerk(w, 'quickhands') ? 0.65 : 1);
    p.reloadT = p.reloadDur;
    p.charge = 0;
    emit(w, 'reload', { weapon: wp.id });
}

export function switchWeapon(w, idx) {
    const p = w.player;
    if (idx < 0 || idx >= p.weapons.length || idx === p.cur) return;
    p.cur = idx;
    p.reloadT = 0; p.charge = 0; p.spin = 0;
    p.fireCd = Math.max(p.fireCd, 0.15);
    emit(w, 'swap', { weapon: p.weapons[idx].id });
}

/** Muzzle point, pulled back inside the marine if the barrel pokes through a wall. */
function muzzle(w, p, a, len = 0.7) {
    const c = Math.cos(a), s = Math.sin(a);
    const free = raycast(w.lv, p.x, p.y, c, s, len);
    const l = Math.max(0, free - 0.12);
    return { x: p.x + c * l, y: p.y + s * l, blocked: free < len };
}

export function updateWeapons(w, input, dt) {
    const p = w.player;
    const wp = curWeapon(p);
    const def = WEAPONS[wp.id];
    const hyper = p.pow.hyperfire > 0;
    p.fireCd -= dt;
    if (p.reloadT > 0) {
        p.reloadT -= dt;
        if (p.reloadT <= 0) {
            p.reloadT = 0;
            const take = Math.min(def.mag - wp.mag, wp.reserve);
            wp.mag += take;
            if (wp.reserve !== Infinity) wp.reserve -= take;
            emit(w, 'reloaded', { weapon: wp.id });
        }
    }
    if (input.reload) startReload(w, p, wp);
    const firing = !!input.fire && p.alive && p.rollT <= 0;
    // Minigun spin and rail charge.
    if (def.spinup) {
        if (firing && p.reloadT <= 0 && (wp.mag > 0 || hyper)) p.spin = Math.min(1, p.spin + dt / def.spinup);
        else p.spin = Math.max(0, p.spin - dt * 1.6);
    }
    if (def.charge) {
        if (firing && p.reloadT <= 0 && (wp.mag > 0 || hyper)) {
            if (p.charge === 0) emit(w, 'charge', { weapon: wp.id });
            p.charge += dt * (hyper ? 1.6 : 1);
        } else p.charge = Math.max(0, p.charge - dt * 3);
    }
    if (!firing || p.reloadT > 0) { if (p.fireCd < 0) p.fireCd = 0; return; }
    if (wp.mag <= 0 && !hyper) {
        if (wp.reserve > 0) startReload(w, p, wp);
        else {
            // Out of ammo: fall back to the next gun that has some.
            if (p.fireCd <= 0) { emit(w, 'empty', { weapon: wp.id }); p.fireCd = 0.3; }
            for (let k = 1; k < p.weapons.length; k++) {
                const j = (p.cur + k) % p.weapons.length;
                const o = p.weapons[j];
                if (o.mag > 0 || o.reserve > 0) { switchWeapon(w, j); break; }
            }
        }
        return;
    }
    if (def.spinup && p.spin < 0.25) return;
    if (def.charge && p.charge < def.charge) return;
    if (p.fireCd > 0) return;
    let rate = def.rate * MK_RATE[wp.mk - 1] * (hyper ? 1.6 : 1);
    if (def.spinup) rate *= 0.3 + 0.7 * p.spin;
    p.fireCd += 1 / rate;
    if (p.fireCd < 0) p.fireCd = 0;
    if (!hyper) wp.mag--;
    p.shots = (p.shots ?? 0) + 1;
    w.stats.shots++;
    fire(w, p, wp, def);
    if (wp.mag <= 0 && wp.reserve > 0 && !hyper) startReload(w, p, wp);
}

function fire(w, p, wp, def) {
    const a = p.face;
    const mk = wp.mk;
    const dmg = def.dmg * MK_DMG[mk - 1] * dmgMul(w);
    const m = muzzle(w, p, a);
    const rng = w.rng;
    emit(w, 'shot', { weapon: wp.id, x: m.x, y: m.y, ang: a, mk });
    const bounceBase = hasPerk(w, 'ricochet') ? 1 : 0;
    switch (def.kind) {
    case 'bullet': {
        const n = def.pellets;
        for (let i = 0; i < n; i++) {
            const spread = n > 1 ? (i / (n - 1) - 0.5) * def.spread + rng.range(-0.05, 0.05) : rng.range(-def.spread, def.spread) * (wp.id === 'minigun' ? 1 : 0.5);
            const ang = a + spread;
            const sp = def.speed * (n > 1 ? rng.range(0.85, 1.1) : 1);
            const micro = wp.id === 'pulse' && mk >= 3 && p.shots % 6 === 0;
            w.pbullets.push({
                x: m.x, y: m.y, ox: m.x, oy: m.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
                dmg, life: def.life * (n > 1 ? rng.range(0.8, 1.1) : 1), r: n > 1 ? 0.1 : 0.12, weapon: wp.id, kind: micro ? 'micro' : 'bullet',
                pierce: 0, bounce: bounceBase + (wp.id === 'scatter' && mk >= 3 ? 1 : 0), knock: def.knock,
                homing: def.homing ?? 0, fork: wp.id === 'smart' && mk >= 3, burn: wp.id === 'minigun' && mk >= 3 ? { dps: 6, t: 2 } : null,
                hits: null, target: -1, retarget: 0,
            });
        }
        if (wp.id === 'scatter') { p.kx -= Math.cos(a) * 2.2; p.ky -= Math.sin(a) * 2.2; }
        break;
    }
    case 'flame': {
        const blue = mk >= 3;
        for (let i = 0; i < 2; i++) {
            const ang = a + rng.range(-def.spread, def.spread);
            const sp = def.speed * (blue ? 1.25 : 1) * rng.range(0.85, 1.1);
            w.pbullets.push({
                x: m.x, y: m.y, ox: m.x, oy: m.y, vx: Math.cos(ang) * sp + p.vx * 0.4, vy: Math.sin(ang) * sp + p.vy * 0.4,
                dmg: dmg * 0.5, life: def.life * (blue ? 1.3 : 1), max: def.life * (blue ? 1.3 : 1), r: 0.18, weapon: 'flame', kind: 'flame',
                pierce: 99, bounce: 0, knock: def.knock, burn: { dps: def.burn * (blue ? 2 : 1) * MK_DMG[mk - 1], t: def.burnTime }, hits: [], blue,
            });
        }
        break;
    }
    case 'arc': fireArc(w, p, a, dmg, def, mk, m); break;
    case 'rail': fireRail(w, p, a, dmg, def, mk, m); break;
    case 'grenade': {
        const sp = def.speed;
        w.grenades.push({
            x: m.x, y: m.y, z: 1, ox: m.x, oy: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 2.2,
            fuse: def.life, dmg, radius: def.radius, kind: 'gl', cluster: mk >= 3, impact: true, id: w.nextId++,
        });
        break;
    }
    case 'plasma': {
        w.pbullets.push({
            x: m.x, y: m.y, ox: m.x, oy: m.y, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed,
            dmg, life: def.life, r: 0.42, weapon: 'plasma', kind: 'plasma', pierce: 99, bounce: 0, knock: def.knock,
            radius: def.radius, zap: mk >= 3, zapT: 0, hits: [],
        });
        p.kx -= Math.cos(a) * 3; p.ky -= Math.sin(a) * 3;
        break;
    }
    default: break;
    }
}

function fireArc(w, p, a, dmg, def, mk, m) {
    const chains = mk >= 3 ? 6 : def.chains;
    const pts = [{ x: m.x, y: m.y }];
    const hit = new Set();
    // First target: nearest enemy in a 40° cone with line of sight.
    let best = null, bestScore = 1e9;
    queryHash(w, p.x, p.y, def.range, (e) => {
        if (e.spawnT > 0 || e.under || e.hidden) return false;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (d > def.range + e.r) return false;
        const da = Math.abs(angDiff(Math.atan2(dy, dx), a));
        if (da > 0.36 + e.r / Math.max(1, d)) return false;
        const score = d + da * 6;
        if (score < bestScore && los(w.lv, p.x, p.y, e.x, e.y)) { bestScore = score; best = e; }
        return false;
    });
    if (!best) {
        const len = raycast(w.lv, m.x, m.y, Math.cos(a), Math.sin(a), def.range * 0.7);
        pts.push({ x: m.x + Math.cos(a) * len, y: m.y + Math.sin(a) * len });
        emit(w, 'arc', { pts, mk });
        return;
    }
    let cur = best, d = dmg;
    for (let k = 0; k <= chains && cur; k++) {
        hit.add(cur.id);
        pts.push({ x: cur.x, y: cur.y });
        const cx = cur.x, cy = cur.y;
        damageEnemy(w, cur, d, { sx: p.x, sy: p.y, knock: def.knock, kind: 'arc', stun: mk >= 3 ? 0.5 : 0.12 });
        d *= 0.82;
        let next = null, nd = def.chainR;
        queryHash(w, cx, cy, def.chainR, (e) => {
            if (hit.has(e.id) || e.spawnT > 0 || e.under) return false;
            const dd = Math.hypot(e.x - cx, e.y - cy);
            if (dd < nd && los(w.lv, cx, cy, e.x, e.y)) { nd = dd; next = e; }
            return false;
        });
        cur = next;
    }
    emit(w, 'arc', { pts, mk });
}

function fireRail(w, p, a, dmg, def, mk, m) {
    p.charge = 0;
    const c = Math.cos(a), s = Math.sin(a);
    const len = raycast(w.lv, m.x, m.y, c, s, def.range);
    const ex = m.x + c * len, ey = m.y + s * len;
    // Everything along the line.
    const hits = [];
    const steps = Math.ceil(len / 1.5);
    const seen = new Set();
    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * len;
        const x = m.x + c * t, y = m.y + s * t;
        queryHash(w, x, y, 1.6, (e) => {
            if (seen.has(e.id) || e.spawnT > 0 || e.under) return false;
            // Distance from the beam line.
            const ox = e.x - m.x, oy = e.y - m.y;
            const along = ox * c + oy * s;
            if (along < -e.r || along > len + e.r) return false;
            const perp = Math.abs(ox * s - oy * c);
            if (perp < e.r + 0.35) { seen.add(e.id); hits.push(e); }
            return false;
        });
    }
    for (const e of hits) damageEnemy(w, e, dmg, { sx: p.x, sy: p.y, knock: def.knock, kind: 'rail' });
    // Props at the end.
    const tx = Math.floor(ex + c * 0.2), ty = Math.floor(ey + s * 0.2);
    if (tx >= 0 && ty >= 0 && tx < w.lv.w && ty < w.lv.h) {
        const pid = w.lv.propAt[ty * w.lv.w + tx];
        if (pid >= 0) damageProp(w, w.lv.props[pid], dmg);
    }
    if (mk >= 3) explode(w, ex - c * 0.3, ey - s * 0.3, 2.6, dmg * 0.45, { owner: 'player', kind: 'plasma' });
    p.kx -= c * 4; p.ky -= s * 4;
    emit(w, 'rail', { x: m.x, y: m.y, ex, ey, mk });
}

// ------------------------------------------------------------------ Player projectiles

export function updatePBullets(w, dt) {
    const B = w.pbullets;
    const lv = w.lv;
    let n = 0;
    for (let i = 0; i < B.length; i++) {
        const b = B[i];
        b.ox = b.x; b.oy = b.y;
        b.life -= dt;
        let alive = b.life > 0;
        if (!alive && (b.kind === 'plasma' || b.kind === 'micro')) detonate(w, b);
        if (alive && b.homing) homing(w, b, dt);
        if (alive && b.kind === 'flame') {
            const f = 1 - b.life / b.max;
            b.r = 0.18 + f * 0.6;
            const drag = Math.exp(-2.6 * dt);
            b.vx *= drag; b.vy *= drag;
        }
        if (alive && b.zap) {
            b.zapT -= dt;
            if (b.zapT <= 0) {
                b.zapT = 0.14;
                let tgt = null, td = 3.6;
                queryHash(w, b.x, b.y, 3.6, (e) => { const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < td && e.spawnT <= 0 && !e.under) { td = d; tgt = e; } return false; });
                if (tgt) { damageEnemy(w, tgt, 14 * dmgMul(w), { kind: 'arc', stun: 0.1 }); emit(w, 'arc', { pts: [{ x: b.x, y: b.y }, { x: tgt.x, y: tgt.y }], mk: 1, small: true }); }
            }
        }
        const speed = Math.hypot(b.vx, b.vy);
        const sub = Math.max(1, Math.ceil((speed * dt) / 0.35));
        for (let s = 0; s < sub && alive; s++) {
            const nx = b.x + (b.vx * dt) / sub, ny = b.y + (b.vy * dt) / sub;
            const tx = Math.floor(nx), ty = Math.floor(ny);
            if (solidAt(lv, tx, ty)) {
                const pid = (tx >= 0 && ty >= 0 && tx < lv.w && ty < lv.h) ? lv.propAt[ty * lv.w + tx] : -1;
                if (pid >= 0 && b.kind !== 'flame') damageProp(w, lv.props[pid], b.dmg);
                if (b.bounce > 0 && pid < 0) {
                    b.bounce--;
                    const hx = solidAt(lv, tx, Math.floor(b.y)), hy = solidAt(lv, Math.floor(b.x), ty);
                    if (hx || !hy) b.vx = -b.vx;
                    if (hy || !hx) b.vy = -b.vy;
                    b.hits = b.hits ? [] : null;
                    emit(w, 'ricochet', { x: b.x, y: b.y });
                    continue;
                }
                alive = false;
                if (b.kind === 'plasma' || b.kind === 'micro') detonate(w, b);
                else if (b.kind !== 'flame' && w.events.length < 400) emit(w, 'pwall', { x: b.x, y: b.y, weapon: b.weapon, vx: b.vx, vy: b.vy });
                break;
            }
            b.x = nx; b.y = ny;
            // Enemies.
            queryHash(w, b.x, b.y, b.r + 1.2, (e) => {
                if (e.spawnT > 0 || e.under || e.hidden) return false;
                const rr = e.r + b.r;
                if ((e.x - b.x) * (e.x - b.x) + (e.y - b.y) * (e.y - b.y) > rr * rr) return false;
                if (b.hits && b.hits.includes(e.id)) return false;
                if (b.kind === 'micro') { detonate(w, b); alive = false; return true; }
                const killed = damageEnemy(w, e, b.dmg, { sx: b.x - b.vx * 0.05, sy: b.y - b.vy * 0.05, knock: b.knock, kind: b.kind === 'flame' ? 'fire' : 'bullet', burn: b.burn });
                if (b.kind !== 'flame' && w.events.length < 400) emit(w, 'phit', { x: b.x, y: b.y, weapon: b.weapon, kind: e.type, killed });
                if (b.kind === 'plasma') {
                    if (!killed && e.maxHp > 90) { detonate(w, b); alive = false; return true; }
                    b.hits.push(e.id);
                    return false;
                }
                if (killed && b.fork) {
                    for (const da of [-0.5, 0.5]) {
                        const a = Math.atan2(b.vy, b.vx) + da;
                        const sp = Math.hypot(b.vx, b.vy);
                        w.pbullets.push({ ...b, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, fork: false, life: 0.6, hits: [e.id], target: -1 });
                    }
                }
                if (b.pierce > 0) { b.pierce--; if (!b.hits) b.hits = []; b.hits.push(e.id); return false; }
                alive = false;
                return true;
            });
        }
        if (alive) B[n++] = b;
    }
    B.length = n;
}

function detonate(w, b) {
    if (b.done) return;
    b.done = true;
    if (b.kind === 'plasma') explode(w, b.x, b.y, b.radius, b.dmg, { owner: 'player', kind: 'plasma', knock: 6 });
    else explode(w, b.x, b.y, 1.8, b.dmg * 2.5, { owner: 'player', kind: 'fire', knock: 3 });
}

function homing(w, b, dt) {
    b.retarget -= dt;
    if (b.retarget <= 0) {
        b.retarget = 0.12;
        const a = Math.atan2(b.vy, b.vx);
        let best = -1, bs = 1e9;
        queryHash(w, b.x, b.y, 8, (e) => {
            if (e.spawnT > 0 || e.under || e.hidden) return false;
            const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy);
            if (d > 8) return false;
            const da = Math.abs(angDiff(Math.atan2(dy, dx), a));
            if (da > 1.2) return false;
            const sc = d + da * 4;
            if (sc < bs) { bs = sc; best = e.id; b.tx = e.x; b.ty = e.y; }
            return false;
        });
        b.target = best;
    }
    if (b.target < 0) return;
    const e = w.byId.get(b.target);
    if (!e || e.dead) { b.target = -1; return; }
    const a = Math.atan2(b.vy, b.vx), want = Math.atan2(e.y - b.y, e.x - b.x);
    const turn = Math.max(-b.homing * dt, Math.min(b.homing * dt, angDiff(want, a)));
    const sp = Math.hypot(b.vx, b.vy);
    b.vx = Math.cos(a + turn) * sp; b.vy = Math.sin(a + turn) * sp;
}

// ------------------------------------------------------------------ Grenades

export function throwGrenade(w, tx, ty) {
    const p = w.player;
    if (p.grenades <= 0 || !p.alive) return false;
    p.grenades--;
    let dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1;
    const dist = Math.max(1.5, Math.min(9, d));
    dx /= d; dy /= d;
    const T = 0.5 + dist * 0.035, g = 18, z0 = 1.1;
    const vz = (0.5 * g * T * T - z0) / T;
    w.grenades.push({
        x: p.x, y: p.y, z: z0, ox: p.x, oy: p.y, vx: (dx * dist) / T, vy: (dy * dist) / T, vz,
        fuse: 1.15, dmg: 115, radius: 3.6, kind: 'hand', impact: false, id: w.nextId++,
    });
    emit(w, 'throw', { x: p.x, y: p.y });
    return true;
}

export function updateGrenades(w, dt) {
    const G = w.grenades;
    const lv = w.lv;
    let n = 0;
    for (let i = 0; i < G.length; i++) {
        const g = G[i];
        g.ox = g.x; g.oy = g.y;
        g.fuse -= dt;
        g.vz -= 18 * dt;
        g.z += g.vz * dt;
        if (g.z <= 0.12) {
            g.z = 0.12;
            if (g.vz < -1.5) { g.vz = -g.vz * 0.42; g.vx *= 0.68; g.vy *= 0.68; emit(w, 'bounce', { x: g.x, y: g.y }); }
            else { g.vz = 0; g.vx *= Math.exp(-6 * dt); g.vy *= Math.exp(-6 * dt); }
        }
        const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
        if (solidAt(lv, Math.floor(nx), Math.floor(g.y))) { g.vx = -g.vx * 0.6; } else g.x = nx;
        if (solidAt(lv, Math.floor(g.x), Math.floor(ny))) { g.vy = -g.vy * 0.6; } else g.y = ny;
        let boom = g.fuse <= 0;
        if (!boom && g.impact && g.z < 1.2) {
            queryHash(w, g.x, g.y, 1.5, (e) => {
                if (e.spawnT > 0 || e.under) return false;
                if (Math.hypot(e.x - g.x, e.y - g.y) < e.r + 0.3) { boom = true; return true; }
                return false;
            });
        }
        if (boom) {
            explode(w, g.x, g.y, g.radius, g.dmg, { owner: 'player', kind: g.kind === 'bomblet' ? 'small' : 'fire', knock: 6 });
            if (g.cluster) {
                for (let k = 0; k < 4; k++) {
                    const a = (k / 4) * TAU + w.rng.range(0, 0.5);
                    w.grenades.push({ x: g.x, y: g.y, z: 0.6, ox: g.x, oy: g.y, vx: Math.cos(a) * 5, vy: Math.sin(a) * 5, vz: 5, fuse: 0.55 + k * 0.06, dmg: g.dmg * 0.45, radius: 2.2, kind: 'bomblet', impact: false, id: w.nextId++ });
                }
            }
            continue;
        }
        G[n++] = g;
    }
    G.length = n;
}

// ------------------------------------------------------------------ Shock Pulse

export function firePulse(w) {
    const p = w.player;
    if (p.pulses <= 0 || !p.alive) return false;
    p.pulses--;
    const cleared = clearBullets(w, p.x, p.y, 9.5);
    const cap = hasPerk(w, 'capacitor');
    queryHash(w, p.x, p.y, 6.5, (e) => {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > 6.5 + e.r) return false;
        if (cap) damageEnemy(w, e, 60, { sx: p.x, sy: p.y, knock: 10, kind: 'explosion', stun: 1 });
        else if (!e.boss) {
            const a = Math.atan2(e.y - p.y, e.x - p.x), k = 10 / Math.max(0.5, e.mass);
            e.kx += Math.cos(a) * k; e.ky += Math.sin(a) * k; e.stun = Math.max(e.stun, 0.9);
        }
        return false;
    });
    p.inv = Math.max(p.inv, 0.4);
    emit(w, 'pulse', { x: p.x, y: p.y, cleared });
    return true;
}

// ------------------------------------------------------------------ Drones

export function updateDrones(w, dt) {
    const p = w.player;
    const want = (p.pow.drone > 0 ? 1 : 0) + (hasPerk(w, 'companion') ? 1 : 0);
    while (p.drones.length < want) { p.drones.push({ a: p.drones.length * Math.PI, cd: 0.3, x: p.x, y: p.y, ox: p.x, oy: p.y, face: 0 }); emit(w, 'droneUp', {}); }
    while (p.drones.length > want) p.drones.pop();
    for (const d of p.drones) {
        d.ox = d.x; d.oy = d.y;
        d.a += dt * 1.8;
        const tx = p.x + Math.cos(d.a) * 1.25, ty = p.y + Math.sin(d.a) * 1.25;
        d.x += (tx - d.x) * Math.min(1, dt * 10);
        d.y += (ty - d.y) * Math.min(1, dt * 10);
        d.cd -= dt;
        if (d.cd > 0) continue;
        let tgt = null, td = 9.5;
        queryHash(w, d.x, d.y, 9.5, (e) => {
            if (e.spawnT > 0 || e.under || e.hidden) return false;
            const dd = Math.hypot(e.x - d.x, e.y - d.y);
            if (dd < td) { td = dd; tgt = e; }
            return false;
        });
        if (!tgt || !los(w.lv, d.x, d.y, tgt.x, tgt.y)) { d.cd = 0.12; continue; }
        d.cd = 0.17;
        const a = Math.atan2(tgt.y - d.y, tgt.x - d.x);
        d.face = a;
        w.pbullets.push({
            x: d.x, y: d.y, ox: d.x, oy: d.y, vx: Math.cos(a) * 26, vy: Math.sin(a) * 26, dmg: 7 * dmgMul(w), life: 0.6, r: 0.1,
            weapon: 'drone', kind: 'bullet', pierce: 0, bounce: 0, knock: 0.3, homing: 0, hits: null,
        });
        emit(w, 'shot', { weapon: 'drone', x: d.x, y: d.y, ang: a, mk: 1, quiet: true });
    }
}

export { PLAYER };
