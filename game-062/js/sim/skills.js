// Hero skills (start → windup → effect), hero movement actions (leap, dash, spin) and every
// ground effect in the world (traps, raisin rain, meteors, puddles, stink clouds, boss slams).

import { SKILLS } from './data/classes.js';
import { skillRank } from './hero.js';
import { walkable, T } from './tiles.js';
import { clearLine, los } from './path.js';

export const SKILL_RANGE = (sk) => (sk.kind === 'melee' ? sk.range : sk.kind === 'chain' ? sk.range : 9.5);
const ANG = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export function startSkill(w, h, id, tx, ty, targetId = 0) {
    const g = w.game.hero;
    const sk = SKILLS[id];
    if (!sk) return false;
    const rank = skillRank(g, id, h.st);
    if (rank <= 0) return false;
    if (h.act || h.leap || h.dash) return false;
    if (h.spin && sk.kind !== 'spin') return false;
    if (h.spin && sk.kind === 'spin') return false;
    if ((h.cds[id] || 0) > 0) return 'cooldown';
    const free = h.buffs.shrine_free;
    const cost = free ? 0 : Math.round(sk.cost * (1 - h.st.costReduce / 100));
    if (h.juice < cost) return 'nojuice';
    if (w.town && sk.kind !== 'buff') return false;
    h.juice -= cost;
    if (sk.cd) h.cds[id] = sk.cd * (1 - h.st.cdr / 100);
    if (tx !== h.x || ty !== h.y) h.face = Math.atan2(ty - h.y, tx - h.x);
    const aps = Math.max(0.5, h.st.aps);
    let dur = 0.45, hitAt = 0.25;
    switch (sk.kind) {
        case 'melee': dur = 1 / aps; hitAt = dur * 0.48; break;
        case 'shot': case 'fan': case 'chain': dur = 1 / aps; hitAt = dur * 0.42; break;
        case 'nova': case 'buff': dur = 0.5; hitAt = 0.28; break;
        case 'teleport': dur = 0.3; hitAt = 0.15; break;
        case 'trap': case 'rain': case 'meteor': dur = 0.55; hitAt = 0.32; break;
        case 'leap': dur = 0.6; hitAt = 0.6; break;
        case 'dash': dur = 0.32; hitAt = 0; break;
        case 'spin': dur = 0.05; hitAt = 0; break;
    }
    h.act = { id, sk, rank, t: 0, dur, hitAt, tx, ty, targetId, fired: false };
    h.intent = h.intent && h.intent.kind === 'attack' ? h.intent : null;
    h.path = h.intent ? h.path : null;
    w.emit(sk.kind === 'melee' ? 'swing' : 'cast', { skill: id, kind: sk.kind, dur, x: h.x, y: h.y, face: h.face });
    if (sk.kind === 'leap') beginLeap(w, h, sk, tx, ty);
    if (sk.kind === 'dash') beginDash(w, h, sk, tx, ty);
    return true;
}

/** Advance the hero's current action. Returns true while the action blocks movement. */
export function updateHeroAction(w, h, dt) {
    if (h.spin) tickSpin(w, h, dt);
    if (h.dash) {
        const d = h.dash;
        const step = Math.min(d.t, dt);
        w.moveActor(h, d.vx * step, d.vy * step);
        d.t -= dt;
        h.moving = true;
        if (d.t <= 0) h.dash = null;
    }
    if (h.leap) {
        const L = h.leap;
        L.t += dt;
        const k = Math.min(1, L.t / L.dur);
        h.x = L.fx + (L.tx - L.fx) * k; h.y = L.fy + (L.ty - L.fy) * k;
        h.z = Math.sin(k * Math.PI) * 1.6;
        if (k >= 1) { h.leap = null; h.z = 0; }
    }
    const a = h.act;
    if (!a) return false;
    a.t += dt;
    if (!a.fired && a.t >= a.hitAt) { a.fired = true; execute(w, h, a); }
    if (a.t >= a.dur) { h.act = null; return false; }
    return true;
}

function execute(w, h, a) {
    const { sk, rank } = a;
    const st = h.st;
    switch (sk.kind) {
        case 'melee': {
            let hits = 0;
            const reach = sk.range;
            const targets = [];
            for (const m of w.monsInRadius(h.x, h.y, reach + 0.1)) {
                const ang = Math.abs(ANG(Math.atan2(m.y - h.y, m.x - h.x) - h.face));
                if (ang > (sk.arc * Math.PI) / 360 && Math.hypot(m.x - h.x, m.y - h.y) > m.r + h.r + 0.05) continue;
                if (!clearLine(w.map, h.x, h.y, m.x, m.y)) continue;
                targets.push(m);
            }
            let list = targets;
            if (sk.single) {
                const t = targets.find((m) => m.id === a.targetId) || targets.sort((p, q) => w.dist(h, p) - w.dist(h, q))[0];
                list = t ? [t] : [];
            }
            for (const m of list) {
                const { dmg, crit } = w.rollHeroDamage(sk, rank, sk.mult(rank));
                w.damageMon(m, dmg, sk.elem, { src: 'hero', crit, basic: sk.basic, melee: true, aoe: list.length > 1, stun: sk.stun ? sk.stun(rank) : 0, knock: sk.knock || 0 });
                hits++;
            }
            for (const o of w.objs) {
                if (!o.breakable || o.state === 'broken') continue;
                const d = w.dist(h, o);
                const ang = Math.abs(ANG(Math.atan2(o.y - h.y, o.x - h.x) - h.face));
                if (d < reach + o.r && ang < (sk.arc * Math.PI) / 360 + 0.3) w.breakObj(o);
            }
            w.emit('slash', { skill: a.id, x: h.x, y: h.y, face: h.face, arc: sk.arc, range: reach, hits });
            break;
        }
        case 'shot': case 'fan': {
            const base = Math.atan2(a.ty - h.y, a.tx - h.x);
            const extra = st.extraProj || 0;
            const n = sk.kind === 'fan' ? sk.count(rank) + extra : 1 + extra;
            const spread = sk.kind === 'fan' ? (sk.spread * Math.PI) / 180 : 0.17 * extra;
            for (let i = 0; i < n; i++) {
                const ang = n === 1 ? base : base - spread / 2 + (spread * i) / (n - 1);
                const { dmg, crit } = w.rollHeroDamage(sk, rank, sk.mult(rank));
                w.spawnProj({
                    owner: 'hero', proj: sk.proj, x: h.x + Math.cos(ang) * 0.4, y: h.y + Math.sin(ang) * 0.4,
                    vx: Math.cos(ang) * sk.speed, vy: Math.sin(ang) * sk.speed, dmg, crit, elem: sk.elem,
                    radius: sk.radius || 0, burn: sk.burn ? { dps: dmg * 0.18, t: sk.burn } : null,
                    homing: sk.homing || 0, target: i === 0 ? a.targetId : 0, basic: sk.basic, life: 1.0, pierce: sk.pierce || 0, r: sk.proj === 'fire' ? 0.3 : 0.22,
                });
            }
            break;
        }
        case 'chain': {
            const pts = [{ x: h.x, y: h.y }];
            let cur = a.targetId ? w.monById(a.targetId) : null;
            if (!cur || cur.dead || w.dist(h, cur) > sk.range + 1 || !los(w.map, h.x, h.y, cur.x, cur.y)) {
                cur = null;
                let bd = 1e9;
                for (const m of w.monsInRadius(h.x, h.y, sk.range)) {
                    const d = Math.hypot(m.x - a.tx, m.y - a.ty);
                    if (d < bd && los(w.map, h.x, h.y, m.x, m.y)) { bd = d; cur = m; }
                }
            }
            const hit = new Set();
            const jumps = sk.jumps(rank);
            for (let j = 0; j <= jumps && cur; j++) {
                hit.add(cur.id);
                pts.push({ x: cur.x, y: cur.y });
                const { dmg, crit } = w.rollHeroDamage(sk, rank, sk.mult(rank) * (j ? 0.85 : 1));
                w.damageMon(cur, dmg, 'light', { src: 'hero', crit, aoe: j > 0 });
                let next = null, bd = sk.jump * sk.jump;
                for (const m of w.mons) {
                    if (m.dead || hit.has(m.id) || m.burrowed || m.state === 'disguised') continue;
                    const d = (m.x - cur.x) ** 2 + (m.y - cur.y) ** 2;
                    if (d < bd && los(w.map, cur.x, cur.y, m.x, m.y)) { bd = d; next = m; }
                }
                cur = next;
            }
            if (pts.length === 1) {
                // Nothing to hit: fizzle toward the cursor.
                const ang = Math.atan2(a.ty - h.y, a.tx - h.x);
                pts.push({ x: h.x + Math.cos(ang) * 4, y: h.y + Math.sin(ang) * 4 });
            }
            w.emit('chain', { pts });
            break;
        }
        case 'nova': {
            w.emit('nova', { x: h.x, y: h.y, r: sk.radius, elem: sk.elem });
            const list = w.monsInRadius(h.x, h.y, sk.radius).filter((m) => los(w.map, h.x, h.y, m.x, m.y));
            for (const m of list) {
                const { dmg, crit } = w.rollHeroDamage(sk, rank, sk.mult(rank));
                w.damageMon(m, dmg, sk.elem, { src: 'hero', crit, aoe: true, freeze: sk.freeze(rank) });
            }
            break;
        }
        case 'buff': {
            h.buffs.juiceup = { t: sk.dur, dur: sk.dur, dmg: sk.dmg(rank), armor: sk.armor, name: sk.name };
            h.hp = Math.min(h.maxHp, h.hp + h.maxHp * sk.heal);
            w.refreshStats();
            w.emit('buff', { skill: a.id, x: h.x, y: h.y });
            break;
        }
        case 'teleport': {
            const dest = clampDest(w, h, a.tx, a.ty, sk.maxRange, true);
            if (!dest) { w.emit('fizzle', { x: h.x, y: h.y }); break; }
            w.emit('teleport', { fx: h.x, fy: h.y, tx: dest.x, ty: dest.y });
            h.x = dest.x; h.y = dest.y;
            h.path = null; h.intent = null;
            break;
        }
        case 'trap': {
            const dest = clampDest(w, h, a.tx, a.ty, sk.maxRange, false) || { x: h.x, y: h.y };
            const trap = { id: w.id(), kind: 'trap', x: dest.x, y: dest.y, r: sk.radius, t: 0, dur: 90, owner: 'hero', rank, sk };
            w.areas.push(trap);
            h.traps.push(trap.id);
            while (h.traps.length > sk.max) { const old = h.traps.shift(); const o = w.areas.find((x) => x.id === old); if (o) o.t = o.dur; }
            w.emit('trapSet', { id: trap.id, x: dest.x, y: dest.y });
            break;
        }
        case 'rain': {
            const dest = clampDest(w, h, a.tx, a.ty, sk.maxRange, false) || { x: a.tx, y: a.ty };
            w.areas.push({ id: w.id(), kind: 'rain', x: dest.x, y: dest.y, r: sk.radius, t: 0, dur: sk.dur, tick: sk.tick, tickT: 0, owner: 'hero', rank, sk });
            w.emit('rain', { x: dest.x, y: dest.y, r: sk.radius, dur: sk.dur });
            break;
        }
        case 'meteor': {
            const dest = clampDest(w, h, a.tx, a.ty, sk.maxRange, false) || { x: a.tx, y: a.ty };
            w.areas.push({ id: w.id(), kind: 'meteor', x: dest.x, y: dest.y, r: sk.radius, t: 0, dur: sk.delay, owner: 'hero', rank, sk });
            w.emit('meteor', { x: dest.x, y: dest.y, r: sk.radius, delay: sk.delay });
            break;
        }
        case 'leap': {
            const list = w.monsInRadius(h.x, h.y, sk.radius);
            for (const m of list) {
                const { dmg, crit } = w.rollHeroDamage(sk, rank, sk.mult(rank));
                w.damageMon(m, dmg, 'phys', { src: 'hero', crit, aoe: true, stun: sk.stun, knock: 1.2 });
            }
            for (const o of w.objs) if (o.breakable && o.state !== 'broken' && w.dist(o, h) < sk.radius) w.breakObj(o);
            w.emit('land', { x: h.x, y: h.y, r: sk.radius });
            break;
        }
        case 'spin': {
            h.spin = { t: sk.dur, tickT: 0, rank, sk };
            w.emit('spin', { x: h.x, y: h.y, dur: sk.dur });
            break;
        }
    }
}

function tickSpin(w, h, dt) {
    const s = h.spin;
    s.t -= dt; s.tickT -= dt;
    if (s.tickT <= 0) {
        s.tickT += s.sk.tick;
        const list = w.monsInRadius(h.x, h.y, s.sk.radius);
        for (const m of list) {
            const { dmg, crit } = w.rollHeroDamage(s.sk, s.rank, s.sk.mult(s.rank));
            w.damageMon(m, dmg, 'phys', { src: 'hero', crit, aoe: true, melee: true });
        }
        for (const o of w.objs) if (o.breakable && o.state !== 'broken' && w.dist(o, h) < s.sk.radius) w.breakObj(o);
    }
    if (s.t <= 0) { h.spin = null; w.emit('spinEnd', {}); }
}

function beginLeap(w, h, sk, tx, ty) {
    const dest = clampDest(w, h, tx, ty, sk.maxRange, false) || { x: h.x, y: h.y };
    h.leap = { fx: h.x, fy: h.y, tx: dest.x, ty: dest.y, t: 0, dur: 0.6 };
    h.status.invuln = Math.max(h.status.invuln, 0.62);
    h.intent = null; h.path = null;
}

function beginDash(w, h, sk, tx, ty) {
    let ang = Math.atan2(ty - h.y, tx - h.x);
    if (h.dir.x || h.dir.y) ang = Math.atan2(h.dir.y, h.dir.x);
    h.face = ang;
    const sp = sk.dist / 0.3;
    h.dash = { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, t: 0.3 };
    h.status.invuln = Math.max(h.status.invuln, sk.invuln);
    h.intent = null; h.path = null;
    w.emit('dash', { x: h.x, y: h.y, face: ang });
}

/** Clamp a target point to `range` from the hero and to a walkable, standable spot. */
function clampDest(w, h, tx, ty, range, needSeen) {
    let dx = tx - h.x, dy = ty - h.y;
    const d = Math.hypot(dx, dy);
    if (d > range) { dx *= range / d; dy *= range / d; }
    for (let k = 1; k >= 0; k -= 0.05) {
        const x = h.x + dx * k, y = h.y + dy * k;
        const t = w.tileAt(x, y);
        if (!walkable(t)) continue;
        if (!w.passable(x, y, h.r * 0.9)) continue;
        if (needSeen && !w.seen[Math.floor(y) * w.map.w + Math.floor(x)]) continue;
        if (!needSeen && !los(w.map, h.x, h.y, x, y)) continue;
        if (k < 0.05) return null;
        return { x, y };
    }
    return null;
}

// ---------------------------------------------------------------------------- ground effects
export function tickAreas(w, dt) {
    const h = w.hero;
    const inside = (a, x, y, r = 0) => (x - a.x) ** 2 + (y - a.y) ** 2 < (a.r + r) ** 2;
    for (const a of w.areas) {
        a.t += dt;
        switch (a.kind) {
            case 'later':
                if (a.t >= a.dur) a.fn();
                break;
            case 'blast':
                if (a.t >= a.dur && !a.done) {
                    a.done = true;
                    w.emit('explode', { x: a.x, y: a.y, r: a.r, elem: a.elem });
                    if (inside(a, h.x, h.y, h.r)) w.damageHero(a.dmg, a.elem, null, { aoe: true });
                }
                break;
            case 'slam':
                if (a.t >= a.dur && !a.done) {
                    a.done = true;
                    w.emit('explode', { x: a.x, y: a.y, r: a.r, elem: a.elem, slam: true });
                    if (inside(a, h.x, h.y, h.r * 0.5)) {
                        w.damageHero(a.dmg, a.elem, w.monById(a.srcId) || null, { aoe: true });
                        if (a.stun) h.status.stun = Math.max(h.status.stun, a.stun);
                    }
                    if (a.then) a.then();
                }
                break;
            case 'puddle': case 'stink': case 'fire': case 'jamtrail': case 'mold':
                a.tickT = (a.tickT || 0) - dt;
                if (a.tickT <= 0) {
                    a.tickT += a.tick || 0.5;
                    if (a.owner === 'mon' && inside(a, h.x, h.y, h.r * 0.4)) {
                        if (a.dmg) w.damageHero(a.dmg, a.elem, null, { aoe: true, dot: true });
                        if (a.slow) { h.status.slow = 0.6; h.status.slowMul = 0.55; }
                    } else if (a.owner === 'hero') {
                        for (const m of w.monsInRadius(a.x, a.y, a.r)) w.damageMon(m, a.dmg, a.elem, { src: 'skill', aoe: true });
                    }
                }
                break;
            case 'rain':
                a.tickT -= dt;
                if (a.tickT <= 0) {
                    a.tickT += a.tick;
                    for (const m of w.monsInRadius(a.x, a.y, a.r)) {
                        const { dmg, crit } = w.rollHeroDamage(a.sk, a.rank, a.sk.mult(a.rank));
                        w.damageMon(m, dmg, 'phys', { src: 'hero', crit, aoe: true });
                    }
                }
                break;
            case 'trap':
                if (a.t > 0.5 && !a.done) {
                    const trig = w.mons.find((m) => !m.dead && !m.flying && !m.burrowed && m.state !== 'disguised' && inside(a, m.x, m.y, -a.r * 0.35));
                    if (trig) {
                        a.done = true; a.t = a.dur;
                        w.emit('trapFire', { id: a.id, x: a.x, y: a.y, r: a.r });
                        for (const m of w.monsInRadius(a.x, a.y, a.r)) {
                            const { dmg, crit } = w.rollHeroDamage(a.sk, a.rank, a.sk.mult(a.rank));
                            w.damageMon(m, dmg, 'phys', { src: 'hero', crit, aoe: true, stun: a.sk.stun(a.rank) });
                        }
                    }
                }
                break;
            case 'meteor':
                if (a.t >= a.dur && !a.done) {
                    a.done = true;
                    w.emit('explode', { x: a.x, y: a.y, r: a.r, elem: 'fire', big: true, meteor: true });
                    for (const m of w.monsInRadius(a.x, a.y, a.r)) {
                        const { dmg, crit } = w.rollHeroDamage(a.sk, a.rank, a.sk.mult(a.rank));
                        w.damageMon(m, dmg, 'fire', { src: 'hero', crit, aoe: true, burn: { dps: dmg * 0.1, t: 3 }, knock: 1.5 });
                    }
                    for (const o of w.objs) if (o.breakable && o.state !== 'broken' && w.dist(o, a) < a.r) w.breakObj(o);
                    const ref = w.rollHeroDamage(a.sk, a.rank, a.sk.mult(a.rank) * 0.12);
                    w.areas.push({ id: w.id(), kind: 'fire', x: a.x, y: a.y, r: a.r * 0.8, t: 0, dur: 3, tick: 0.5, tickT: 0.5, owner: 'hero', dmg: ref.dmg, elem: 'fire' });
                    w.emit('groundFire', { x: a.x, y: a.y, r: a.r * 0.8, dur: 3 });
                }
                break;
        }
    }
    w.areas = w.areas.filter((a) => a.t < a.dur || (a.kind === 'blast' && !a.done) || (a.kind === 'slam' && !a.done) || (a.kind === 'meteor' && !a.done));
}

export { T };
