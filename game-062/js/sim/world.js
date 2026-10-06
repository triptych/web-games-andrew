// A hole in play. All mutable state lives in `this.s` (plain data), so clone() is one structuredClone
// and a bot can try hundreds of shots from the same moment. Collider objects are per-World scratch,
// refreshed from the state every step.
//
// Phases: aim → flight → settle → (act) → aim … → done | failed. A hazard goes flight → hazard → aim.

import { newBall, stepBall } from './physics.js';
import { BALL_R, capsuleC, sphereC } from './course.js';
import { SURF, SURF_PHYS } from './realms.js';
import { launch, autoClub, CLUBS } from './clubs.js';
import { derive, SPELLS, ITEMS } from './rpg.js';
import { MONSTERS, monsterPos } from './monsters.js';
import { BOSSES } from './bosses.js';
import { Rng, hashStr } from '../rng.js';

const MAX_EVENTS = 400;
const _mp = {};

export class World {
    // opts: { profile, seed, quiet, state (for clones) }
    constructor(course, opts = {}) {
        this.course = course;
        this.hole = course.hole;
        this.opts = opts;
        this.profile = opts.profile;
        this.d = opts.derived ?? derive(opts.profile);
        this.quiet = !!opts.quiet;
        this.events = [];
        this.rng = new Rng(1);
        const bossDef = this.hole.boss;
        this.bossDef = bossDef ? BOSSES[bossDef.kind] : null;
        if (opts.state) this.s = opts.state;
        else this.s = this.initState(opts);
        this.rng.s = this.s.rngS;
        // per-World collider scratch
        this.dyn = [];
        this.millCols = [];
        for (const m of course.windmills) {
            for (let k = 0; k < 4; k++) { const C = capsuleC(0, 0, 0, 0, 1, 0, 0.45, 0.6, 'blade'); this.millCols.push(C); this.dyn.push(C); }
        }
        this.monCols = this.s.mons.map((m) => { const C = sphereC(0, 0, 0, MONSTERS[m.kind].r, 0.55, 'mon', { mon: m.i }); this.dyn.push(C); return C; });
        this.bossCols = this.bossDef ? this.bossDef.cols(this) : [];
        this.dyn.push(...this.bossCols);
        this.env = this.makeEnv();
        this.refreshDyn(0);
    }

    initState(opts) {
        const c = this.course, h = this.hole;
        const seed = opts.seed ?? hashStr(h.id + ':play');
        const windDir = ((h.wind?.[0] ?? 0) * Math.PI) / 180;
        const windSp = h.wind?.[1] ?? 0;
        const s = {
            time: 0, phase: 'aim', phaseT: 0, rngS: seed >>> 0 || 1,
            ball: newBall(c.tee.x, c.tee.y + BALL_R, c.tee.z),
            prev: null, strokes: 0, penalties: 0,
            par: h.par, limit: h.par + (h.boss ? 6 : 4),
            mp: this.d.maxMp, maxMp: this.d.maxMp,
            wind: { dir: windDir, speed: windSp, x: Math.sin(windDir) * windSp * 0.55, z: Math.cos(windDir) * windSp * 0.55 },
            aimYaw: c.teeYaw, club: 'driver',
            armed: { spell: null, item: null },
            fx: this.baseFx(),
            spells: (this.profile?.spells ?? ['mulligan']).slice(),
            items: { ...(this.profile?.items ?? {}) },
            pickups: c.pickups.map((p) => ({ ...p, got: false })),
            mons: c.monsters.map((m, i) => ({ ...m, i, alive: true, y0: c.heightAt(m.x, m.z) })),
            boss: null, sealed: !!h.boss,
            patches: [], burnt: {},
            runeCd: 0, geyserCd: 0,
            kicked: false, actT: 0,
            shotPerfect: false, shotClub: null,
            stats: { coins: 0, gems: 0, monsters: 0, monsterXp: 0, perfects: 0, itemsFound: {}, bossHits: 0, hazards: 0 },
            result: null, lastLand: null,
        };
        s.ball.surf = SURF.tee;
        this.s = s;
        if (this.bossDef) s.boss = this.bossDef.init(this, h.boss);
        s.club = autoClub(this.distToCup(), SURF.tee, this.d);
        if (h.teeClub) s.club = h.teeClub;
        return s;
    }

    baseFx() { return { ward: false, fire: false, frost: false, seek: false, rocket: false, sticky: false, spring: false, ghost: false, windK: this.d.windK, bounceK: this.d.bounceK, rollK: this.d.rollK }; }

    clone(quiet = true) {
        const s = structuredClone(this.s);
        return new World(this.course, { ...this.opts, derived: this.d, quiet, state: s });
    }

    // ------------------------------------------------------------ helpers used by bosses
    emit(type, data = {}) {
        if (this.quiet) return;
        this.events.push({ ...data, type, t: this.s.time });
        if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
    }
    rngNext() { const v = this.rng.next(); this.s.rngS = this.rng.s; return v; }
    rngInt(n) { return Math.floor(this.rngNext() * n); }
    addPatch(x, z, r, sid, kind) { this.s.patches.push({ x, z, r, sid, kind }); if (this.s.patches.length > 8) this.s.patches.shift(); }
    setWind(dir, speed) { const W = this.s.wind; W.dir = dir; W.speed = speed; W.x = Math.sin(dir) * speed * 0.55; W.z = Math.cos(dir) * speed * 0.55; this.emit('wind', { dir, speed }); }
    kickBall(vx, vy, vz, tag) {
        const B = this.s.ball;
        this.s.kickFrom = { x: B.x, y: B.y, z: B.z, surf: B.surf };
        B.vx = vx; B.vy = vy; B.vz = vz; B.check = 1; B.state = 'moving'; B.t = 0; B.air = 0; B.contact = false; B.landed = false; B.bounces = 0;
        this.s.kicked = true;
        this.s.fx = this.baseFx();
        this.s.phase = 'flight'; this.s.phaseT = 0;
        this.emit('kicked', { tag });
    }

    get ball() { return this.s.ball; }
    get cup() { return this.course.cup; }
    distToCup() { const B = this.s.ball, c = this.course.cup; return Math.hypot(B.x - c.x, B.z - c.z); }
    lieSurf() {
        const B = this.s.ball;
        let sid = this.course.surfAt(B.x, B.z);
        for (const p of this.s.patches) if ((B.x - p.x) ** 2 + (B.z - p.z) ** 2 < p.r * p.r) sid = p.sid;
        return sid;
    }
    bossAlive() { return !!this.s.boss && this.s.boss.hp > 0; }
    // The thing to aim at: the boss while the seal holds, else the cup.
    target() {
        if (this.s.sealed && this.bossDef) return this.bossDef.target(this);
        return { x: this.course.cup.x, y: this.course.cup.y, z: this.course.cup.z };
    }
    // Default aim: along the route (dogleg waypoints) or straight at the target.
    defaultAim() {
        const B = this.s.ball, T = this.target();
        const route = this.hole.route;
        let aim = T;
        if (route && !this.s.sealed) {
            const dCup = Math.hypot(B.x - T.x, B.z - T.z);
            for (const [x, z] of route) {
                const dp = Math.hypot(x - T.x, z - T.z);
                const db = Math.hypot(x - B.x, z - B.z);
                if (dp < dCup - 8 && db > 12) { aim = { x, z }; break; }
            }
        }
        return Math.atan2(aim.x - B.x, aim.z - B.z);
    }

    // ------------------------------------------------------------ player actions
    canAct() { return this.s.phase === 'aim'; }

    setAim(yaw) { this.s.aimYaw = yaw; }
    setClub(c) { if (CLUBS[c]) this.s.club = c; }

    armSpell(id) {
        const s = this.s;
        if (!this.canAct() || !s.spells.includes(id)) return false;
        if (id === 'mulligan') return this.mulligan();
        if (s.armed.spell === id) { s.armed.spell = null; return true; }
        if (s.mp < SPELLS[id].mp) return false;
        s.armed.spell = id;
        return true;
    }

    armItem(id) {
        const s = this.s;
        if (!this.canAct() || !(s.items[id] > 0)) return false;
        if (id === 'potion') { s.items.potion--; s.mp = Math.min(s.maxMp, s.mp + 4); this.emit('item', { id }); return true; }
        s.armed.item = s.armed.item === id ? null : id;
        return true;
    }

    mulligan() {
        const s = this.s;
        const cost = this.d.mulliganCost;
        if (!s.prev || s.mp < cost) return false;
        s.mp -= cost;
        const B = s.ball;
        B.x = s.prev.x; B.y = s.prev.y; B.z = s.prev.z; B.vx = B.vy = B.vz = 0; B.state = 'rest'; B.surf = s.prev.surf;
        s.strokes = s.prev.strokes;
        s.patches = s.prev.patches;
        s.prev = null;
        s.club = autoClub(this.distToCup(), this.lieSurf(), this.d);
        this.emit('spell', { id: 'mulligan', x: B.x, y: B.y, z: B.z });
        return true;
    }

    // shot: { club, power 0..1, acc -1..1, perfect, yaw? }
    shoot(shot) {
        const s = this.s;
        if (!this.canAct()) return false;
        const B = s.ball;
        const club = shot.club ?? s.club;
        const yaw = shot.yaw ?? s.aimYaw;
        s.prev = { x: B.x, y: B.y, z: B.z, strokes: s.strokes, surf: B.surf, patches: s.patches.slice() };
        // effects for this shot
        const fx = this.baseFx();
        const sp = s.armed.spell;
        if (sp && s.mp >= SPELLS[sp].mp) {
            s.mp -= SPELLS[sp].mp;
            fx[sp] = true;
            if (sp === 'ward') fx.windK = 0;
            this.emit('spell', { id: sp, x: B.x, y: B.y, z: B.z });
        }
        const it = s.armed.item;
        if (it && s.items[it] > 0) { s.items[it]--; fx[it] = true; this.emit('item', { id: it }); }
        s.armed.spell = null; s.armed.item = null;
        s.fx = fx;
        const sid = this.lieSurf();
        const perfect = !!shot.perfect;
        const L = launch(club, shot.power, perfect ? 0 : shot.acc ?? 0, perfect, yaw, sid, this.d, fx);
        B.vx = L.vx; B.vy = L.vy; B.vz = L.vz; B.spin = L.spin; B.check = L.check;
        B.state = 'moving'; B.t = 0; B.air = 0; B.landed = false; B.bounces = 0; B.lipped = false; B.frostFx = false; B.firstLand = null;
        B.contact = club === 'putter';
        if (club === 'putter') B.y = this.course.heightAt(B.x, B.z) + BALL_R;
        s.strokes++;
        if (perfect) s.stats.perfects++;
        s.shotPerfect = perfect; s.shotClub = club;
        s.kicked = false;
        s.phase = 'flight'; s.phaseT = 0;
        this.emit('shot', { club, power: shot.power, acc: shot.acc ?? 0, perfect, speed: L.speed, x: B.x, y: B.y, z: B.z, fx: { ...fx } });
        return true;
    }

    // ------------------------------------------------------------ step
    step(dt) {
        const s = this.s;
        s.time += dt; s.phaseT += dt;
        s.runeCd -= dt; s.geyserCd -= dt;
        if (this.bossDef) this.bossDef.update(this, dt);
        this.refreshDyn(s.time);
        switch (s.phase) {
            case 'flight': {
                const B = s.ball;
                stepBall(B, dt, this.env);
                if (B.state === 'moving' && B.t > 45) { B.state = 'rest'; }
                if (B.state === 'rest') this.onRest();
                else if (B.state === 'holed') this.onHoled();
                else if (B.state === 'hazard') { s.phase = 'hazard'; s.phaseT = 0; s.stats.hazards++; }
                break;
            }
            case 'settle':
                if (s.phaseT > 0.45) {
                    if (this.bossAlive() && !s.kicked) {
                        const dur = this.bossDef.act(this);
                        if (s.phase === 'settle') { s.phase = 'act'; s.phaseT = 0; s.actT = dur; }
                    } else this.nextTurn();
                }
                break;
            case 'act':
                if (s.phaseT >= s.actT) this.nextTurn();
                break;
            case 'hazard':
                if (s.phaseT > 1.3) {
                    // a boss that knocks the ball into trouble doesn't cost a stroke
                    const B = s.ball, P = s.kicked && s.kickFrom ? s.kickFrom : s.prev;
                    B.x = P.x; B.y = P.y; B.z = P.z; B.vx = B.vy = B.vz = 0; B.state = 'rest'; B.surf = P.surf;
                    if (!s.kicked) { s.strokes++; s.penalties++; }
                    this.emit('drop', { x: B.x, y: B.y, z: B.z });
                    this.nextTurn();
                }
                break;
        }
    }

    onRest() {
        const s = this.s, B = s.ball;
        // settle the ball exactly on the ground
        B.y = this.course.heightAt(B.x, B.z) + BALL_R;
        B.surf = this.lieSurf();
        s.phase = 'settle'; s.phaseT = 0;
    }

    onHoled() {
        const s = this.s;
        s.phase = 'done'; s.phaseT = 0;
        s.result = {
            strokes: s.strokes, par: s.par, coins: s.stats.coins + s.stats.gems * 10, monsters: s.stats.monsters, monsterXp: s.stats.monsterXp,
            perfects: s.stats.perfects, itemsFound: s.stats.itemsFound, boss: !!s.boss, penalties: s.penalties,
        };
        this.emit('holeDone', { strokes: s.strokes, par: s.par });
    }

    nextTurn() {
        const s = this.s;
        s.fx = this.baseFx();
        if (s.strokes >= s.limit) { s.phase = 'failed'; s.phaseT = 0; this.emit('strokeLimit', {}); return; }
        s.phase = 'aim'; s.phaseT = 0;
        s.aimYaw = this.defaultAim();
        const T = this.target();
        const B = s.ball;
        s.club = autoClub(Math.hypot(T.x - B.x, T.z - B.z), this.lieSurf(), this.d);
        if (s.sealed && s.club === 'putter' && T.y - B.y > 1.5) s.club = 'wedge';
        this.emit('turn', { strokes: s.strokes });
    }

    // ------------------------------------------------------------ colliders, env, callbacks
    refreshDyn(t) {
        const c = this.course;
        let k = 0;
        for (const m of c.windmills) {
            const ang = t * (m.speed ?? 0.9);
            const cx = m.x, cy = m.y + 6.2, cz = m.z;
            const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw);
            // blades turn in the plane facing the tee direction (normal = (fx, 0, fz)), hub in front of the tower
            const hx = cx - fx * 2.3, hz = cz - fz * 2.3;
            const rx = -fz, rz = fx;   // right vector in that plane
            for (let i = 0; i < 4; i++) {
                const a = ang + (i * Math.PI) / 2;
                const ux = rx * Math.cos(a), uy = Math.sin(a), uz = rz * Math.cos(a);
                const C = this.millCols[k++];
                C.ax = hx + ux * 0.6; C.ay = cy + uy * 0.6; C.az = hz + uz * 0.6;
                C.cx = hx + ux * 5.6; C.cy = cy + uy * 5.6; C.cz = hz + uz * 5.6;
                C.bx = (C.ax + C.cx) / 2; C.by = (C.ay + C.cy) / 2; C.bz = (C.az + C.cz) / 2; C.br = 2.5 + C.r;
                const w = m.speed ?? 0.9;
                C.vx = -rx * Math.sin(a) * w * 3; C.vy = Math.cos(a) * w * 3; C.vz = -rz * Math.sin(a) * w * 3;
            }
        }
        for (let i = 0; i < this.s.mons.length; i++) {
            const m = this.s.mons[i], C = this.monCols[i];
            if (!m.alive) { C.off = true; continue; }
            monsterPos(c, m, t, _mp);
            C.x = C.bx = _mp.x; C.y = C.by = _mp.y; C.z = C.bz = _mp.z; C.vx = _mp.vx; C.vz = _mp.vz; C.off = false;
        }
    }

    makeEnv() {
        const w = this;
        const c = this.course;
        return {
            course: c,
            get fx() { return w.s.fx; },
            get wind() { return w.s.wind; },
            colliders: c.statics,
            dyn: this.dyn,
            get patches() { return w.s.patches; },
            cup: c.cup,
            get sealed() { return w.s.sealed; },
            get pickups() { return w.s.pickups; },
            emit: (type, data) => w.emit(type, data),
            onHit: (C, speed, b) => w.onHit(C, speed, b),
            onPickup: (p) => w.onPickup(p),
            onTrigger: (b) => w.onTrigger(b),
            onBurn: (C) => {
                const id = c.statics.indexOf(C);
                if (!w.s.burnt[id]) { w.s.burnt[id] = 1; w.emit('burn', { x: C.x, y: C.y, z: C.z, id }); }
            },
        };
    }

    onHit(C, speed, b) {
        const s = this.s;
        if (C.tag === 'mon') {
            const m = s.mons[C.mon];
            if (!m.alive) return 'pass';
            if (speed > 2.2 || s.fx.fire) {
                m.alive = false; C.off = true;
                const M = MONSTERS[m.kind];
                s.stats.monsters++; s.stats.monsterXp += M.xp; s.stats.coins += M.gold;
                b.vx *= 0.7; b.vy *= 0.7; b.vz *= 0.7;
                this.emit('monsterHit', { kind: m.kind, i: m.i, x: C.x, y: C.y, z: C.z, xp: M.xp, gold: M.gold });
                return 'pass';
            }
            return;
        }
        if (C.tag === 'boss' && this.bossDef) {
            if (speed < 2.0) return;
            let dmg = 1 + (s.shotPerfect ? 1 : 0) + this.d.bossBonus;
            if (s.fx.fire) dmg *= 2;
            const r = this.bossDef.hit(this, C.part, dmg);
            if (r === 'wall') { if (s.fx.fire) return 'pass'; return; }
            if (r) {
                s.stats.bossHits++;
                this.emit('bossHit', { part: C.part, dmg, x: C.x, y: C.y, z: C.z, hp: s.boss.hp, max: s.boss.max, perfect: s.shotPerfect, fire: s.fx.fire });
                if (s.boss.hp <= 0 && r !== 'phase') {
                    s.sealed = false;
                    this.emit('bossDown', { kind: s.boss.kind, x: C.x, y: C.y, z: C.z });
                    this.emit('sealBroken', { x: this.course.cup.x, y: this.course.cup.y, z: this.course.cup.z });
                }
            }
        }
    }

    onPickup(p) {
        const s = this.s;
        p.got = true;
        if (p.kind === 'coin') s.stats.coins++;
        else if (p.kind === 'gem') s.stats.gems++;
        else if (p.kind === 'orb') s.mp = Math.min(s.maxMp, s.mp + 3);
        else if (p.kind === 'crystal') { s.items[p.item] = (s.items[p.item] || 0) + 1; s.stats.itemsFound[p.item] = (s.stats.itemsFound[p.item] || 0) + 1; }
        this.emit('pickup', { kind: p.kind, item: p.item, x: p.x, y: p.y, z: p.z });
    }

    onTrigger(b) {
        const c = this.course, s = this.s;
        if (s.geyserCd <= 0) {
            for (const g of c.geysers) {
                if ((b.x - g.x) ** 2 + (b.z - g.z) ** 2 < 2.6 && b.y < g.y + 4 && geyserActive(g, s.time)) {
                    b.vy = 24; b.vx *= 0.55; b.vz *= 0.55; b.contact = false; b.air = 0.01; b.landed = false;
                    s.geyserCd = 0.6;
                    this.emit('geyser', { x: g.x, y: g.y, z: g.z });
                }
            }
        }
        if (s.runeCd <= 0) {
            for (const r of c.runes) {
                if ((b.x - r.ax) ** 2 + (b.z - r.az) ** 2 < 2.0 && b.y < r.ay + 1.2) {
                    b.x = r.bx; b.z = r.bz; b.y = r.by + 0.6;
                    s.runeCd = 1.5;
                    this.emit('rune', { ax: r.ax, az: r.az, bx: r.bx, bz: r.bz });
                }
            }
        }
    }

    // ------------------------------------------------------------ info for the UI
    lieInfo() {
        const sid = this.lieSurf();
        const T = this.target();
        const B = this.s.ball;
        return { sid, label: SURF_PHYS[sid].label, dist: Math.hypot(T.x - B.x, T.z - B.z), elev: T.y - B.y };
    }
    hash() {
        const B = this.s.ball;
        return `${this.s.strokes}|${B.x.toFixed(4)}|${B.y.toFixed(4)}|${B.z.toFixed(4)}|${this.s.phase}|${this.s.boss ? this.s.boss.hp : '-'}`;
    }
}

export function geyserActive(g, t) { return ((t + g.phase) % g.period) < 1.5; }

// Runs the world until the current shot settles (or a time cap). Used by bots and tests.
export function runUntilSettled(w, maxT = 60, dt = 1 / 240) {
    let t = 0;
    while (t < maxT && (w.s.phase === 'flight' || w.s.phase === 'settle' || w.s.phase === 'act' || w.s.phase === 'hazard')) {
        w.step(dt);
        t += dt;
    }
    return t;
}

export { SPELLS, ITEMS };
