// The mech's weapons and every projectile in the air. Weapons fire on their own (it's a
// survivors game): each picks the nearest monster, or a hive when no monster is in range.
// Pure.

import { MAP, MECH, OVERDRIVE, SHARD_BEAM, FOCUS } from '../config.js';
import { solid, blocked, idx, inMap, cellOf, trace, MAT_ID } from './world.js';
import { hurtCell, hurtEnemy, hurtMech, explode, hurtHive } from './damage.js';
import { scatter } from './voxels.js';

// ------------------------------------------------------------------ spatial hash of monsters
const HB = 2, HW = Math.ceil(MAP.w / HB), HH = Math.ceil(MAP.h / HB);
export function buildHash(R) {
    // not enumerable, so it never ends up in a save
    if (!R._hash) Object.defineProperty(R, '_hash', { value: Array.from({ length: HW * HH }, () => []), writable: true, enumerable: false });
    const H = R._hash;
    for (const b of H) b.length = 0;
    for (const e of R.enemies) {
        if (e.dead) continue;
        const bx = Math.max(0, Math.min(HW - 1, Math.floor(e.x / HB))), by = Math.max(0, Math.min(HH - 1, Math.floor(e.y / HB)));
        H[by * HW + bx].push(e);
    }
    return H;
}
/** Call fn(e) for every live monster whose bucket is within r of (x, y). */
export function near(R, x, y, r, fn) {
    const H = R._hash;
    const x0 = Math.max(0, Math.floor((x - r - 2.5) / HB)), x1 = Math.min(HW - 1, Math.floor((x + r + 2.5) / HB));
    const y0 = Math.max(0, Math.floor((y - r - 2.5) / HB)), y1 = Math.min(HH - 1, Math.floor((y + r + 2.5) / HB));
    for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) for (const e of H[by * HW + bx]) if (!e.dead) fn(e);
}

/** The nearest target within range: a monster, else a live hive. Monsters behind rock still count (rockets curve, lasers cut). */
/** The monster or hive the player tapped, while it lives. When it dies, auto-aim takes over again. */
export function focusTarget(R) {
    const f = R.focus;
    if (!f) return null;
    const t = typeof f.id === 'number' ? R.enemies.find((e) => e.id === f.id && !e.dead) : R.hives.find((h) => h.id === f.id && !h.dead);
    if (t) return t;
    R.focus = null;
    R.events.push({ type: 'focus_lost' });
    return null;
}

/** Pick a focus from a tap at (x, y): the nearest monster within reach of it, else a hive, else none. */
export function setFocus(R, x, y) {
    let best = null, bd = FOCUS.pick * FOCUS.pick;
    for (const e of R.enemies) {
        if (e.dead) continue;
        const d = (e.x - x) ** 2 + (e.y - y) ** 2 - e.r * e.r;
        if (d < bd) { bd = d; best = e; }
    }
    if (!best) for (const h of R.hives) if (!h.dead && Math.hypot(h.x - x, h.y - y) < FOCUS.hive) best = h;
    R.focus = best ? { id: best.id } : null;
    R.events.push({ type: 'focus', id: best ? best.id : null, x: best ? best.x : x, y: best ? best.y : y });
    return best;
}

export function target(R, x, y, range, skip) {
    // a focused target wins if it's within reach (a little further than usual)
    if (!skip || !skip.size) {
        const f = focusTarget(R);
        if (f && (f.x - x) ** 2 + (f.y - y) ** 2 < (range * FOCUS.range) ** 2) return f;
    }
    let best = null, bd = range * range;
    near(R, x, y, range, (e) => {
        if (skip && skip.has(e.id)) return;
        const d = (e.x - x) ** 2 + (e.y - y) ** 2 - e.r * e.r;
        if (d < bd) { bd = d; best = e; }
    });
    if (best) return best;
    for (const h of R.hives) {
        if (h.dead) continue;
        const d = (h.x - x) ** 2 + (h.y - y) ** 2 - 2.25;
        if (d < bd) { bd = d; best = h; }
    }
    return best;
}

/** The middle of the thickest crowd within range (for the mortar). */
function crowd(R, x, y, range) {
    let best = null, score = 0;
    const list = [];
    near(R, x, y, range, (e) => { if ((e.x - x) ** 2 + (e.y - y) ** 2 < range * range) list.push(e); });
    const step = Math.max(1, Math.floor(list.length / 24));
    for (let k = 0; k < list.length; k += step) {
        const e = list[k];
        let n = e.boss ? 6 : 0;
        for (const o of list) if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 6.25) n++;
        if (n > score) { score = n; best = e; }
    }
    return best || target(R, x, y, range);
}

// ------------------------------------------------------------------ firing
export function fireWeapons(R, dt, magnet) {
    const M = R.mech;
    const od = M.odT > 0;
    const rateMul = M.rateMul * (od ? OVERDRIVE.fire : 1) * (magnet ? MECH.magnetFire : 1);
    const dmgMul = M.dmgMul * (od ? OVERDRIVE.dmg : 1);
    for (const w of M.weapons) {
        w.cd -= dt * rateMul;
        if (w.type === 'orbit') { orbit(R, w, dt, dmgMul); continue; }
        if (w.cd > 0) continue;
        const ok = fire(R, w, dmgMul);
        w.cd = ok ? w.cd + 1 / w.rate : 0;
        if (w.cd < 0) w.cd = 0;
    }
}

function fire(R, w, dmgMul) {
    const M = R.mech;
    const rng = R.rng;
    if (w.type === 'bullet') {
        const t = target(R, M.x, M.y, w.range);
        if (!t) return false;
        const base = Math.atan2(t.y - M.y, t.x - M.x);
        M.aim = base;
        for (let k = 0; k < w.count; k++) {
            const off = w.count > 1 ? (k / (w.count - 1) - 0.5) * w.spread : 0;
            const a = base + off + rng.range(-w.spread, w.spread) * 0.25;
            R.shots.push({ k: 'b', x: M.x + Math.cos(a) * 0.7, y: M.y + Math.sin(a) * 0.7, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
                dmg: w.dmg * dmgMul, terrain: w.terrain, life: w.range / w.speed + 0.05 });
        }
        R.events.push({ type: 'fire', part: w.part });
        return true;
    }
    if (w.type === 'beam') {
        const t = target(R, M.x, M.y, w.range);
        if (!t) return false;
        const a = Math.atan2(t.y - M.y, t.x - M.x);
        M.aim = a;
        const ex = M.x + Math.cos(a) * w.range, ey = M.y + Math.sin(a) * w.range;
        const end = trace(M.x, M.y, ex, ey, (i) => solid(R.W, i));
        if (end.i >= 0) hurtCell(R, end.i, R.W.mat[end.i] === MAT_ID.hive ? w.dmg * dmgMul : w.terrain * 2);
        const sx = end.x - M.x, sy = end.y - M.y, L = Math.hypot(sx, sy) || 1;
        near(R, (M.x + end.x) / 2, (M.y + end.y) / 2, L / 2 + 1, (e) => {
            const tt = Math.max(0, Math.min(1, ((e.x - M.x) * sx + (e.y - M.y) * sy) / (L * L)));
            const d = Math.hypot(M.x + sx * tt - e.x, M.y + sy * tt - e.y);
            if (d < w.width + e.r) hurtEnemy(R, e, w.dmg * dmgMul);
        });
        R.events.push({ type: 'beam', x: M.x, y: M.y, x2: end.x, y2: end.y, w: w.width });
        return true;
    }
    if (w.type === 'rocket') {
        const used = new Set();
        let any = false;
        for (let k = 0; k < w.count; k++) {
            const t = target(R, M.x, M.y, w.range, used) || target(R, M.x, M.y, w.range);
            if (!t) break;
            if (t.id != null) used.add(t.id);
            const a = Math.atan2(t.y - M.y, t.x - M.x) + (k % 2 ? 1 : -1) * (0.6 + 0.25 * k) + rng.range(-0.2, 0.2);
            R.shots.push({ k: 'r', x: M.x, y: M.y, vx: Math.cos(a) * w.speed * 0.6, vy: Math.sin(a) * w.speed * 0.6, speed: w.speed, turn: w.turn,
                dmg: w.dmg * dmgMul, radius: w.radius, terrain: w.terrain, life: 2.4, tgt: t.id ?? null, hive: t.cells ? R.hives.indexOf(t) : -1, tx: t.x, ty: t.y });
            any = true;
        }
        if (any) R.events.push({ type: 'fire', part: w.part });
        return any;
    }
    if (w.type === 'mortar') {
        const t = crowd(R, M.x, M.y, w.range);
        if (!t) return false;
        for (let k = 0; k < w.count; k++) {
            const tx = t.x + (k ? rng.range(-1.5, 1.5) : 0), ty = t.y + (k ? rng.range(-1.5, 1.5) : 0);
            R.shots.push({ k: 'm', x: M.x, y: M.y, x0: M.x, y0: M.y, tx, ty, t: 0, T: w.flight + k * 0.12, dmg: w.dmg * dmgMul, radius: w.radius, terrain: w.terrain, life: 9 });
        }
        R.events.push({ type: 'fire', part: w.part });
        return true;
    }
    if (w.type === 'stomp') {
        let n = 0;
        near(R, M.x, M.y, w.radius, (e) => { if (Math.hypot(e.x - M.x, e.y - M.y) < w.radius + e.r) n++; });
        let rubble = false;
        for (const v of R.voxels) if (v.s === 1 && Math.abs(v.x - M.x) < 2 && Math.abs(v.y - M.y) < 2) { rubble = true; break; }
        if (!n && !rubble) return false;
        explode(R, M.x, M.y, w.radius, w.dmg * dmgMul, w.terrain, 'mech');
        R.events.push({ type: 'stomp', x: M.x, y: M.y, r: w.radius });
        return true;
    }
    return false;
}

/** Saw drones circle the mech; each touches what it passes, w.rate times a second at most. */
function orbit(R, w, dt, dmgMul) {
    const M = R.mech;
    if (w.cd > 0) return;
    w.cd = 1 / w.rate;
    for (let k = 0; k < w.count; k++) {
        const a = R.t * w.spin + (k / w.count) * Math.PI * 2;
        const x = M.x + Math.cos(a) * w.radius, y = M.y + Math.sin(a) * w.radius;
        near(R, x, y, 0.8, (e) => { if (Math.hypot(e.x - x, e.y - y) < 0.55 + e.r) hurtEnemy(R, e, w.dmg * dmgMul); });
        for (const h of R.hives) if (!h.dead && Math.abs(h.x - x) < 2 && Math.abs(h.y - y) < 2) hurtHive(R, h, w.dmg * dmgMul * 0.5);
    }
}

// ------------------------------------------------------------------ the Shard Beam
/** Fire it if it's charged and off cooldown. Returns true if it fired. */
export function fireShardBeam(R) {
    const M = R.mech;
    if (M.beam < 1 || M.beamCd > 0 || M.beamT > 0) return false;
    const t = target(R, M.x, M.y, SHARD_BEAM.range);
    M.beamA = t ? Math.atan2(t.y - M.y, t.x - M.x) : M.face;
    M.beam = 0;
    M.beamT = SHARD_BEAM.time;
    M.beamCd = SHARD_BEAM.cooldown + SHARD_BEAM.time;
    M.beamTick = 0;
    R.events.push({ type: 'shard_beam', x: M.x, y: M.y, a: M.beamA });
    return true;
}

/** While it fires: it swings towards the target and hits everything along its line, rock included, every tick. */
export function stepShardBeam(R, dt) {
    const M = R.mech;
    M.beamCd = Math.max(0, M.beamCd - dt);
    if (M.beamT <= 0) return;
    M.beamT -= dt;
    const t = target(R, M.x, M.y, SHARD_BEAM.range);
    if (t) {
        let d = Math.atan2(t.y - M.y, t.x - M.x) - M.beamA;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        M.beamA += Math.max(-SHARD_BEAM.turn * dt, Math.min(SHARD_BEAM.turn * dt, d));
    }
    M.beamTick -= dt;
    while (M.beamTick <= 0) {
        M.beamTick += SHARD_BEAM.tick;
        const dmg = SHARD_BEAM.dmg * M.dmgMul * (M.odT > 0 ? OVERDRIVE.dmg : 1);
        const ex = M.x + Math.cos(M.beamA) * SHARD_BEAM.range, ey = M.y + Math.sin(M.beamA) * SHARD_BEAM.range;
        // every rock cell along the line takes a bite; the map edge stops it
        const end = trace(M.x, M.y, ex, ey, (i) => {
            if (R.W.mat[i] === MAT_ID.edge) return true;
            if (solid(R.W, i)) hurtCell(R, i, R.W.mat[i] === MAT_ID.hive ? dmg : SHARD_BEAM.terrain);
            return false;
        });
        const sx = end.x - M.x, sy = end.y - M.y, L = Math.hypot(sx, sy) || 1;
        near(R, (M.x + end.x) / 2, (M.y + end.y) / 2, L / 2 + 1.5, (e) => {
            const u = Math.max(0, Math.min(1, ((e.x - M.x) * sx + (e.y - M.y) * sy) / (L * L)));
            if (Math.hypot(M.x + sx * u - e.x, M.y + sy * u - e.y) < SHARD_BEAM.width + e.r) hurtEnemy(R, e, dmg);
        });
        M.beamLen = L;
        if (M.beamT <= 0) break;
    }
}

/** Where saw drone k is right now (the view draws them from this). */
export function dronePos(R, w, k) {
    const a = R.t * w.spin + (k / w.count) * Math.PI * 2;
    return { x: R.mech.x + Math.cos(a) * w.radius, y: R.mech.y + Math.sin(a) * w.radius, a };
}

// ------------------------------------------------------------------ projectiles
export function stepShots(R, dt) {
    const W = R.W, M = R.mech;
    for (const s of R.shots) {
        if (s.dead) continue;
        s.life -= dt;
        if (s.k === 'm') {                       // lobbed: ignores walls, lands on its mark
            s.t += dt;
            const u = Math.min(1, s.t / s.T);
            s.x = s.x0 + (s.tx - s.x0) * u; s.y = s.y0 + (s.ty - s.y0) * u;
            s.z = 0.8 + Math.sin(u * Math.PI) * 4;
            if (u >= 1) { s.dead = true; explode(R, s.x, s.y, s.radius, s.dmg, s.terrain, 'mech'); }
            continue;
        }
        if (s.k === 'r') {                       // homing
            let tx = s.tx, ty = s.ty;
            if (s.tgt != null) {
                const t = R.enemies.find((e) => e.id === s.tgt && !e.dead);
                if (t) { tx = t.x; ty = t.y; s.tx = tx; s.ty = ty; } else s.tgt = null;
            } else if (s.hive >= 0 && R.hives[s.hive]?.dead) s.hive = -1;
            const want = Math.atan2(ty - s.y, tx - s.x);
            let a = Math.atan2(s.vy, s.vx);
            let da = want - a;
            while (da > Math.PI) da -= Math.PI * 2;
            while (da < -Math.PI) da += Math.PI * 2;
            a += Math.max(-s.turn * dt, Math.min(s.turn * dt, da));
            const sp = Math.min(s.speed, Math.hypot(s.vx, s.vy) + s.speed * 2 * dt);
            s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp;
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
        const cx = cellOf(s.x), cy = cellOf(s.y);
        if (!inMap(cx, cy)) { s.dead = true; continue; }
        const i = idx(cx, cy);
        if (s.k === 'e') {
            if (blocked(W, i)) { s.dead = true; R.events.push({ type: 'splat', x: s.x, y: s.y }); continue; }
            if (Math.hypot(M.x - s.x, M.y - s.y) < MECH.radius + 0.25) { s.dead = true; hurtMech(R, s.dmg, 'shot'); continue; }
            if (s.life <= 0) s.dead = true;
            continue;
        }
        // the mech's bullets and rockets
        if (solid(W, i)) {
            s.dead = true;
            if (s.k === 'r') explode(R, s.x - s.vx * dt, s.y - s.vy * dt, s.radius, s.dmg, s.terrain, 'mech');
            else hurtCell(R, i, W.mat[i] === MAT_ID.hive ? s.dmg : s.terrain);
            continue;
        }
        let hit = null;
        near(R, s.x, s.y, 1, (e) => { if (!hit && Math.hypot(e.x - s.x, e.y - s.y) < e.r + 0.15) hit = e; });
        if (hit) {
            s.dead = true;
            if (s.k === 'r') explode(R, s.x, s.y, s.radius, s.dmg, s.terrain, 'mech');
            else hurtEnemy(R, hit, s.dmg);
            continue;
        }
        if (s.k === 'r' && Math.hypot(s.tx - s.x, s.ty - s.y) < 0.4) { s.dead = true; explode(R, s.x, s.y, s.radius, s.dmg, s.terrain, 'mech'); continue; }
        if (s.life <= 0) {
            s.dead = true;
            if (s.k === 'r') explode(R, s.x, s.y, s.radius, s.dmg, s.terrain, 'mech');
        }
    }
    R.shots = R.shots.filter((s) => !s.dead);
}

export { scatter };
