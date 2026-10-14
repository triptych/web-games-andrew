// The rules of CUE VICE. One World is one episode in play.
//
// Time only flows while something is moving: the player lines up a shot with
// the world frozen, releases, and the guards walk, look and shoot until every
// ball has come to rest. All mutable state lives in the plain object `S`, so a
// shot can be undone by restoring a structuredClone of it (Instant Replay).
//
// The world never touches the DOM or three.js; it reports what happened as a
// queue of events that main.js drains for the view, the audio and the HUD.

import { SIM_DT, PHYS, VISION, ALARM, GUARD, MOTION, REWINDS } from '../config.js';
import { T, stepPhysics, lineOfSight, angleDiff, segCircle, tileAt, isSolid, castRay } from './physics.js';
import { parseLevel, buildObjectives } from './level.js';
import { CREW, FOES } from './data.js';
import {
    rnd, updateFoe, senseFoe, coneOf, alertAll, toSearch, toReturn, startDance, noiseAt, makeSuspicious, isAwake, isDown,
} from './ai.js';

const DEG = Math.PI / 180;
const BREAKABLE = new Set([T.GLASS, T.CRACK, T.CRATE]);

export class World {
    /**
     * @param def   level definition from levels.js
     * @param opts  { squad: ['rico', …], crewUp: { rico: { hp, charges } }, guide, rewinds, seed }
     */
    constructor(def, opts = {}) {
        this.def = def;
        this.L = parseLevel(def);
        this.opts = opts;
        this.events = [];
        this.history = [];
        this.S = this._init(opts);
        this.acc = 0;
    }

    emit(type, data = {}) { this.events.push({ type, ...data }); }
    drain() { const e = this.events; this.events = []; return e; }

    // ------------------------------------------------------------------ setup
    _init(opts) {
        const L = this.L, def = this.def;
        const S = {
            w: L.w, h: L.h, tiles: new Uint8Array(L.tilesInit), t: 0, rs: (opts.seed ?? 1977) >>> 0,
            bodies: [], cars: [], projectiles: [], boomboxes: [],
            cams: [], lasers: [], intel: L.intel.map(() => false), tapes: L.tapes.map(() => false),
            terms: L.terms.map(() => false), switches: L.switches.map(() => false), targets: L.targets.map(() => false),
            doors: {}, alarm: { mode: 'sneak', t: 0, x: 0, y: 0 },
            stats: { shots: 0, alarms: 0, kos: 0, sunk: 0, bodies: 0, tapes: 0, hurt: 0, style: 0, cops: 0, rewinds: 0, banks: 0, darts: 0, booms: 0 },
            phase: 'aim', motionT: 0, minT: MOTION.minPhase, waiting: false, active: null, uses: 0, freeShot: null, shotKOs: 0,
            rewinds: REWINDS + (opts.rewinds || 0), objectives: buildObjectives(L), result: null, nextId: 1,
            lockedNote: false, firsts: {},
        };
        this.S = S;
        const squad = opts.squad?.length ? opts.squad : (def.need?.length ? def.need : ['rico']);
        squad.forEach((who, i) => {
            const st = L.starts[i] ?? this.safeSpot(L.starts[0].x, L.starts[0].y);
            this._addCrew(who, st.x, st.y);
        });
        if (def.startHp) for (const b of S.bodies) if (b.kind === 'crew') b.hp = Math.min(b.hp, def.startHp);
        if (def.recruit) {
            const r = def.recruit;
            S.bodies.push(this._body({ kind: 'recruit', who: r.who, x: r.x + 0.5, y: r.y + 0.5, r: CREW[r.who].r, m: CREW[r.who].m, face: Math.PI / 2 }));
        }
        if (def.vip) S.bodies.push(this._body({ kind: 'vip', name: def.vip.name, x: def.vip.x + 0.5, y: def.vip.y + 0.5, r: 0.4, m: 1, hp: 2, face: Math.PI / 2 }));
        for (const fd of def.foes ?? []) this._addFoe(fd);
        for (const c of def.cams ?? []) {
            const a = c.a * DEG;
            S.cams.push({ x: c.x + 0.5 - Math.cos(a) * 0.4, y: c.y + 0.5 - Math.sin(a) * 0.4, a0: a, sweep: (c.sweep ?? 30) * DEG, period: c.period ?? 6, a, sus: 0, off: false, broken: false });
        }
        for (const l of def.lasers ?? []) S.lasers.push({ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, on: l.on ?? 0, off: l.off ?? 0, live: true, cut: false, cool: 0 });
        for (const c of def.cars ?? []) S.cars.push({ x: c.x + 0.5, y: c.y + 0.5, a: c.a * DEG, hw: 1.05, hh: 0.5, vx: 0, vy: 0, color: c.color, police: !!c.police });
        L.targets.forEach((t, i) => {
            if (t.kind === 'car') S.cars.push({ x: t.x, y: t.y, a: (t.a ?? 0) * DEG, hw: 1.05, hh: 0.5, vx: 0, vy: 0, color: t.color, target: i, wreck: false });
        });
        // guards walk round parked cars, not into them
        for (const c of S.cars) {
            const cs = Math.cos(c.a), sn = Math.sin(c.a);
            for (let ty = Math.floor(c.y - 2); ty <= Math.floor(c.y + 2); ty++) {
                for (let tx = Math.floor(c.x - 2); tx <= Math.floor(c.x + 2); tx++) {
                    if (tx < 0 || ty < 0 || tx >= S.w || ty >= S.h) continue;
                    const rx = tx + 0.5 - c.x, ry = ty + 0.5 - c.y;
                    const lx = rx * cs + ry * sn, ly = -rx * sn + ry * cs;
                    if (Math.abs(lx) < c.hw + 0.35 && Math.abs(ly) < c.hh + 0.35) L.blockAt[ty * S.w + tx] = 1;
                }
            }
        }
        for (const lane of def.traffic ?? []) {
            const span = S.w + 8;
            const n = Math.max(1, Math.floor(span / lane.gap));
            for (let i = 0; i < n; i++) {
                const x = -4 + (i + 0.5 * ((lane.y * 7) % 1)) * (span / n);
                S.cars.push({ x, y: lane.y, a: lane.dir > 0 ? 0 : Math.PI, hw: 1.05, hh: 0.48, vx: lane.dir * lane.speed, vy: 0, traffic: true, color: [0xff6fb0, 0x9ff0ff, 0xfff1a0, 0xffffff, 0xb44cff, 0xff8a3a][(i + Math.round(lane.y)) % 6] });
            }
        }
        return S;
    }

    _body(o) {
        return { id: this.S.nextId++, x: 0, y: 0, vx: 0, vy: 0, r: 0.4, m: 1, ctl: false, gone: false, face: 0, cush: 0, home: { x: o.x, y: o.y }, ...o };
    }

    _addCrew(who, x, y) {
        const c = CREW[who], up = this.opts.crewUp?.[who] ?? {};
        const hp = c.hp + (up.hp || 0);
        const b = this._body({
            kind: 'crew', who, x, y, r: c.r, m: c.m, hp, maxHp: hp, charges: c.charges + (up.charges || 0) * (c.abilityKey === 'dart' ? 3 : 1),
            downed: false, extracted: false, ghost: false, ghostT: 0, hurtT: 0, wrecker: who === 'tito', face: -Math.PI / 2,
        });
        this.S.bodies.push(b);
        return b;
    }

    _addFoe(fd) {
        const kd = FOES[fd.k];
        const x = fd.x + 0.5, y = fd.y + 0.5;
        const path = (fd.path ?? [[fd.x, fd.y]]).map(([px, py]) => [px + 0.5, py + 0.5]);
        const look = (fd.look ?? 90) * DEG;
        const face = path.length > 1 ? Math.atan2(path[1][1] - path[0][1], path[1][0] - path[0][0]) : look;
        const f = this._body({
            kind: 'foe', k: fd.k, kd, x, y, r: kd.r, m: kd.m, hp: kd.hp, ctl: true, face,
            state: 'patrol', st: 0, path, pi: path.length > 1 ? 0 : 0, pause: 0, look, sweep: (fd.sweep ?? 0) * DEG,
            period: fd.period ?? 6, phase: (fd.x * 1.7 + fd.y) % 6, sus: 0, seen: null, route: [], ri: 0,
            shootT: 1, koT: 0, sink: fd.sink ?? null, found: false, dazed: false,
        });
        // start on the closest point of the patrol
        if (path.length > 1) {
            let bi = 0, bd = 1e9;
            path.forEach(([px, py], i) => { const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; bi = i; } });
            f.pi = bi;
        }
        this.S.bodies.push(f);
    }

    /** Nearest open floor tile centre to (x, y) that no body is standing on. */
    safeSpot(x, y) {
        const S = this.S, L = this.L;
        const sx = Math.floor(x), sy = Math.floor(y);
        const free = (tx, ty) => {
            if (tx < 0 || ty < 0 || tx >= S.w || ty >= S.h) return false;
            const i = ty * S.w + tx, t = S.tiles[i];
            if (isSolid(t) || t === T.WATER || L.holeAt[i] || L.blockAt[i]) return false;
            return !S.bodies.some((b) => !b.gone && Math.hypot(b.x - tx - 0.5, b.y - ty - 0.5) < b.r + 0.45);
        };
        for (let r = 0; r < 12; r++) {
            for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
                if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
                if (free(sx + ox, sy + oy)) return { x: sx + ox + 0.5, y: sy + oy + 0.5 };
            }
        }
        return { x, y };
    }

    // ------------------------------------------------------------------ queries
    get crew() { return this.S.bodies.filter((b) => b.kind === 'crew'); }
    get foes() { return this.S.bodies.filter((b) => b.kind === 'foe'); }
    body(id) { return this.S.bodies.find((b) => b.id === id); }

    /** Teammates that can take the next shot. */
    shooters() {
        const S = this.S;
        if (S.freeShot != null) { const b = this.body(S.freeShot); if (b && this.canShoot(b)) return [b]; }
        return this.crew.filter((b) => this.canShoot(b));
    }
    canShoot(b) { return b && b.kind === 'crew' && !b.gone && !b.downed && !b.extracted; }

    objectivesLeft() { return this.S.objectives.filter((o) => o.id !== 'extract' && !o.done && !o.optional).length; }

    complete(id) {
        const o = this.S.objectives.find((q) => q.id === id);
        if (o && !o.done) {
            o.done = true;
            this.emit('objective', { id, text: o.text, left: this.objectivesLeft() });
            if (this.objectivesLeft() === 0 && id !== 'extract') this.emit('allClear', {});
        }
    }

    /** First teammate (or witness) a guard can see right now, if any. */
    visibleTarget(f, cone = coneOf(this.S, f)) {
        const S = this.S;
        let best = null, bd = 1e9;
        for (const b of S.bodies) {
            if (b.gone) continue;
            if (b.kind !== 'crew' && b.kind !== 'vip') continue;
            if (b.extracted || b.ghost) continue;
            const dx = b.x - f.x, dy = b.y - f.y, d = Math.hypot(dx, dy);
            if (d > cone.range && d > cone.smell) continue;
            if (d > cone.smell && Math.abs(angleDiff(f.face, Math.atan2(dy, dx))) > cone.half) continue;
            if (this._concealed(b) && d > VISION.hedgeSee) continue;
            if (d > 0.9 && !lineOfSight(S, this.L, f.x, f.y, b.x, b.y)) continue;
            if (d < bd) { bd = d; best = b; }
        }
        return best;
    }

    _concealed(b) {
        if (Math.hypot(b.vx, b.vy) > 0.4) return false;
        return tileAt(this.S, b.x, b.y) === T.HEDGE;
    }

    /** Can this guard see this teammate right now (used for "unaware" takedowns). */
    sees(f, b) {
        if (!isAwake(f) || f.state === 'dance') return false;
        if (f.state === 'alert') return true;
        if (f.state === 'suspicious' || f.state === 'investigate') {
            if (f.seen && Math.hypot(f.seen.x - b.x, f.seen.y - b.y) < 2.5) return true;
        }
        const cone = coneOf(this.S, f);
        const dx = b.x - f.x, dy = b.y - f.y;
        if (Math.abs(angleDiff(f.face, Math.atan2(dy, dx))) > cone.half * 1.1) return false;
        return true;
    }

    // ------------------------------------------------------------------ alarm
    raiseAlarm(f, x, y, why = 'spotted') {
        const S = this.S;
        if (S.phase === 'won' || S.phase === 'lost') return;
        const fresh = S.alarm.mode !== 'alert';
        S.alarm.mode = 'alert'; S.alarm.t = ALARM.alert; S.alarm.x = x; S.alarm.y = y;
        if (f) { f.lastSeen = { x, y }; f.sus = 1; }
        alertAll(this);
        for (const g of this.foes) if (g.state === 'alert') g.lastSeen = { x, y };
        if (fresh) {
            S.stats.alarms++;
            this.emit('alarm', { id: f?.id ?? null, x, y, why });
            if (this.def.noAlarm) this.lose('made');
        }
    }
    refreshAlarm(x, y) { const A = this.S.alarm; A.t = ALARM.alert; A.x = x; A.y = y; }
    setCaution() {
        const A = this.S.alarm;
        if (A.mode === 'sneak') { A.mode = 'caution'; A.t = ALARM.caution; this.emit('caution', {}); }
        else if (A.mode === 'caution') A.t = ALARM.caution;
    }
    bodyFound(f, body) {
        this.S.stats.bodies++;
        body.state = 'look'; body.st = 2; body.ctl = true; body.koT = 0; body.sus = 0.4;
        this.emit('bodyFound', { id: f.id, body: body.id, x: body.x, y: body.y });
        this.setCaution();
        if (body.dazed) body.state = 'ko';
    }

    _updateAlarm(dt) {
        const A = this.S.alarm;
        if (A.mode === 'sneak') return;
        A.t -= dt;
        if (A.t > 0) return;
        if (A.mode === 'alert') { A.mode = 'evasion'; A.t = ALARM.evasion; toSearch(this); this.emit('evasion', {}); }
        else if (A.mode === 'evasion') { A.mode = 'caution'; A.t = ALARM.caution; toReturn(this); this.emit('caution', {}); }
        else { A.mode = 'sneak'; A.t = 0; this.emit('sneak', {}); }
    }

    // ------------------------------------------------------------------ turns
    snapshot() {
        this.history.push(structuredClone(this.S));
        if (this.history.length > 12) this.history.shift();
    }

    canRewind() { return this.S.rewinds > 0 && this.history.length > 0 && this.S.phase !== 'won'; }

    rewind() {
        if (!this.canRewind()) return false;
        const left = this.S.rewinds - 1, used = this.S.stats.rewinds + 1;
        this.S = this.history.pop();
        this.S.rewinds = left;
        this.S.stats.rewinds = used;
        this.S.phase = 'aim';
        this.emit('rewind', {});
        return true;
    }

    /** Fire a teammate. power in 0..1. */
    shoot(id, angle, power) {
        const S = this.S;
        if (S.phase !== 'aim') return false;
        const b = this.body(id);
        if (!this.canShoot(b)) return false;
        if (S.freeShot != null && S.freeShot !== id) return false;
        this.snapshot();
        const c = CREW[b.who];
        const sp = (PHYS.minSpeed + (PHYS.maxSpeed - PHYS.minSpeed) * Math.max(0, Math.min(1, power))) * c.power;
        b.vx = Math.cos(angle) * sp; b.vy = Math.sin(angle) * sp; b.face = angle;
        for (const m of S.bodies) { m.home = { x: m.x, y: m.y }; m.cush = 0; m.healed = null; }
        if (S.freeShot == null) S.stats.shots++;
        S.freeShot = null;
        S.phase = 'motion'; S.motionT = 0; S.minT = MOTION.minPhase; S.waiting = false;
        S.active = id; S.uses = 0; S.shotKOs = 0;
        this.emit('shoot', { id, who: b.who, x: b.x, y: b.y, power });
        return true;
    }

    /** Let time pass without shooting. */
    wait(seconds = MOTION.waitStep) {
        const S = this.S;
        if (S.phase !== 'aim') return false;
        this.snapshot();
        for (const m of S.bodies) { m.home = { x: m.x, y: m.y }; m.cush = 0; }
        S.phase = 'motion'; S.motionT = 0; S.minT = seconds; S.waiting = true; S.active = null; S.uses = 0; S.shotKOs = 0;
        this.emit('wait', { seconds });
        return true;
    }

    /** Could the rolling teammate use their ability right now? */
    abilityReady() {
        const S = this.S;
        if (S.phase !== 'motion' || S.active == null) return false;
        const b = this.body(S.active);
        if (!b || b.gone || b.downed || b.extracted || b.charges <= 0) return false;
        const key = CREW[b.who].abilityKey;
        if (S.uses >= (key === 'dart' ? 3 : 1)) return false;
        return key === 'heal' || Math.hypot(b.vx, b.vy) >= 0.15;
    }

    /** The rolling teammate's active ability. Returns true if anything happened. */
    ability() {
        const S = this.S;
        if (S.phase !== 'motion' || S.active == null) return false;
        const b = this.body(S.active);
        if (!b || b.gone || b.downed || b.extracted) return false;
        const c = CREW[b.who];
        if (b.charges <= 0) { this.emit('noCharge', { id: b.id }); return false; }
        const sp = Math.hypot(b.vx, b.vy);
        const key = c.abilityKey;
        const limit = key === 'dart' ? 3 : 1;
        if (S.uses >= limit) return false;
        if (sp < 0.15 && key !== 'heal') return false;
        S.uses++; b.charges--;
        const dirA = sp > 0.05 ? Math.atan2(b.vy, b.vx) : b.face;
        switch (key) {
            case 'rebank':
                b.vx = 0; b.vy = 0; S.freeShot = b.id;
                this.emit('rebank', { id: b.id, x: b.x, y: b.y });
                break;
            case 'dart':
                this._spawn({ kind: 'dart', x: b.x + Math.cos(dirA) * (b.r + 0.1), y: b.y + Math.sin(dirA) * (b.r + 0.1), vx: Math.cos(dirA) * 19, vy: Math.sin(dirA) * 19, bounce: 1, life: 1.3, owner: b.id });
                S.stats.darts++;
                this.emit('dart', { id: b.id, x: b.x, y: b.y, a: dirA });
                break;
            case 'heal': {
                let n = 0;
                for (const m of this.crew) {
                    if (m.gone || m.extracted) continue;
                    if (Math.hypot(m.x - b.x, m.y - b.y) > 2.8) continue;
                    if (this.heal(m, 1)) n++;
                }
                this.emit('pulse', { id: b.id, x: b.x, y: b.y, n });
                break;
            }
            case 'boom':
                this.explode(b.x, b.y, 2.7, b);
                break;
            case 'ghost':
                b.ghost = true; b.ghostT = 1.6;
                this.emit('ghost', { id: b.id, x: b.x, y: b.y });
                break;
            case 'anchor': {
                b.vx = 0; b.vy = 0;
                for (const m of S.bodies) {
                    if (m === b || m.gone) continue;
                    const dx = m.x - b.x, dy = m.y - b.y, d = Math.hypot(dx, dy);
                    if (d > 2.6 || d < 1e-6) continue;
                    const k = (1 - d / 2.6) * 9 + 2;
                    m.vx += (dx / d) * k / Math.sqrt(m.m); m.vy += (dy / d) * k / Math.sqrt(m.m);
                    if (m.kind === 'foe' && isAwake(m)) this._stun(m, 2.4, b);
                }
                noiseAt(this, b.x, b.y, 6);
                this.emit('anchor', { id: b.id, x: b.x, y: b.y });
                break;
            }
            case 'boombox': {
                const bb = { id: S.nextId++, x: b.x, y: b.y, t: 10 };
                S.boomboxes.push(bb);
                startDance(this, bb);
                this.emit('boombox', { id: b.id, x: b.x, y: b.y, box: bb.id });
                break;
            }
        }
        this.emit('ability', { id: b.id, who: b.who, key });
        return true;
    }

    // ------------------------------------------------------------------ main step
    /** Advance real time dt (seconds). Only does anything while time flows. */
    update(dt) {
        const S = this.S;
        if (S.phase !== 'motion') return;
        this.acc += dt;
        let n = 0;
        while (this.acc >= SIM_DT && n++ < 40) {
            this.acc -= SIM_DT;
            this.step(SIM_DT);
            if (this.S.phase !== 'motion') { this.acc = 0; break; }
        }
    }

    step(dt) {
        const S = this.S;
        S.t += dt; S.motionT += dt;
        // traffic
        for (const c of S.cars) {
            if (!c.traffic) continue;
            c.x += c.vx * dt;
            if (c.vx > 0 && c.x > S.w + 4) c.x -= S.w + 8;
            if (c.vx < 0 && c.x < -4) c.x += S.w + 8;
        }
        for (const f of S.bodies) if (f.kind === 'foe') updateFoe(this, f, dt);
        stepPhysics(S, this.L, dt, this.hooks ??= this._hooks());
        this._projectiles(dt);
        this._touches();
        for (const f of S.bodies) if (f.kind === 'foe') senseFoe(this, f, dt);
        this._cameras(dt);
        this._lasers(dt);
        this._crewTimers(dt);
        for (const bb of S.boomboxes) bb.t -= dt;
        if (S.boomboxes.some((bb) => bb.t <= 0)) {
            S.boomboxes = S.boomboxes.filter((bb) => bb.t > 0);
            for (const f of this.foes) if (f.state === 'dance' && !S.boomboxes.some((bb) => bb.id === f.boombox)) { f.state = 'return'; f.route = []; f.pi = f.pi ?? 0; }
        }
        this._updateAlarm(dt);
        if (S.phase !== 'motion') return;
        if (S.motionT >= S.minT && this._atRest()) this._endMotion();
        else if (S.motionT >= MOTION.maxPhase + (S.waiting ? S.minT : 0)) {
            for (const b of S.bodies) if (!b.ctl) { b.vx = 0; b.vy = 0; }
            S.projectiles = [];
            this._endMotion();
        }
    }

    _atRest() {
        const S = this.S;
        if (S.projectiles.length) return false;
        for (const b of S.bodies) {
            if (b.gone || b.ctl) continue;
            if (b.vx !== 0 || b.vy !== 0) return false;
        }
        for (const f of this.foes) if (f.state === 'stun' && !f.gone) return false;
        return true;
    }

    _endMotion() {
        const S = this.S;
        S.phase = 'aim';
        S.active = null;
        // extraction
        const clear = this.objectivesLeft() === 0;
        let locked = false;
        for (const b of S.bodies) {
            if (b.gone || (b.kind !== 'crew' && b.kind !== 'vip')) continue;
            const tx = Math.floor(b.x), ty = Math.floor(b.y);
            if (tx < 0 || ty < 0 || tx >= S.w || ty >= S.h || !this.L.exitAt[ty * S.w + tx]) continue;
            if (b.kind === 'vip') {
                b.gone = true; b.extracted = true;
                this.complete('vip');
                this.emit('extract', { id: b.id, vip: true, x: b.x, y: b.y });
                continue;
            }
            if (!clear) { locked = true; continue; }
            b.gone = true; b.extracted = true; b.ghost = false;
            this.emit('extract', { id: b.id, who: b.who, x: b.x, y: b.y });
        }
        if (locked) this.emit('exitLocked', {});
        for (const b of S.bodies) if (b.kind === 'crew' && b.ghost && b.ghostT <= 0) b.ghost = false;
        const crew = this.crew;
        if (crew.length && crew.every((b) => b.extracted) && this.objectivesLeft() === 0) {
            this.complete('extract');
            this.win();
            return;
        }
        if (crew.some((b) => !b.extracted) && crew.filter((b) => !b.extracted).every((b) => b.downed)) {
            this.lose('down');
            return;
        }
        if (S.freeShot != null && !this.canShoot(this.body(S.freeShot))) S.freeShot = null;
        this.emit('turn', { free: S.freeShot });
    }

    // ------------------------------------------------------------------ physics hooks
    _hooks() {
        const W = this;
        return {
            wall(b, tx, ty, t, vn, nx, ny) {
                const S = W.S;
                if (vn > 0.6) b.cush = (b.cush || 0) + 1;
                if (t === T.GLASS && vn >= PHYS.glassBreak) {
                    W.breakTile(tx, ty, b);
                    b.vx *= 0.6; b.vy *= 0.6;
                    return 'break';
                }
                if ((t === T.CRACK || t === T.CRATE) && b.wrecker && vn >= 4) {
                    W.breakTile(tx, ty, b);
                    b.vx *= 0.7; b.vy *= 0.7;
                    return 'break';
                }
                if (vn > 1) W.emit('wall', { id: b.id, x: b.x - nx * b.r, y: b.y - ny * b.r, v: vn, tile: t });
                if (b.kind === 'crew' && vn > PHYS.noiseWall && !b.ghost) noiseAt(W, b.x, b.y, 2 + vn * 0.32);
                return undefined;
            },
            circle(b, c, vn) {
                if (c.kind === 'bumper') { W.emit('bumper', { x: c.x, y: c.y, v: vn }); b.cush = (b.cush || 0) + 1; }
                else if (vn > 1) W.emit('wall', { id: b.id, x: b.x, y: b.y, v: vn, tile: -1 });
                if (c.kind === 'term' && b.kind === 'crew') W.hack(c.term, b);
            },
            box(b, box, vn) {
                if (box.traffic) {
                    if (b.kind === 'crew' && vn > 3 && b.hurtT <= 0) { W.hurt(b, 1, 'car'); b.hurtT = 1; }
                    if (b.kind === 'foe' && isAwake(b) && vn > 3) W.knockOut(b, null, 'car');
                    if (b.kind === 'vip' && vn > 3) W.vipHurt(b);
                    W.emit('carHit', { x: b.x, y: b.y, v: vn });
                } else if (vn > 1) W.emit('wall', { id: b.id, x: b.x, y: b.y, v: vn, tile: -2 });
            },
            pair(a, b, vn, nx, ny) { W._pair(a, b, vn, nx, ny); },
            pocket(b, where) { W._pocket(b, where); },
        };
    }

    _pair(a, b, vn, nx, ny) {
        if (vn > 0.8) this.emit('clack', { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: vn, a: a.kind, b: b.kind });
        const pairs = [[a, b], [b, a]];
        // teammate strikes guard (first, so a knocked guard can't also "notice" the touch)
        for (const [p, q] of pairs) if (p.kind === 'crew' && !p.downed && q.kind === 'foe') this._strike(p, q, vn);
        for (const [p, q] of pairs) {
            // a flying guard bowls over another (billiards combo)
            if (p.kind === 'foe' && q.kind === 'foe' && !p.ctl && isAwake(q) && vn >= GUARD.takedownSpeed + 1 && !q.kd.boss) {
                if (!this.sees(q, p)) this.knockOut(q, this.body(this.S.active), 'combo');
                else this._stun(q, 1.4, p);
            }
            if (p.kind === 'crew' && q.kind === 'crew') {
                if (p.who === 'doc' && !p.downed && (!q.healed || q.healed !== this.S.t)) {
                    if (this.heal(q, 1)) q.healed = this.S.t;
                }
            }
            if (p.kind === 'crew' && !p.downed && q.kind === 'recruit') this._join(q);
            // a guard walking into a teammate
            if (p.kind === 'foe' && (q.kind === 'crew' || q.kind === 'vip') && isAwake(p) && p.ctl && p.state !== 'dance' && !q.ghost && !q.extracted && p.state !== 'alert') {
                if (!(q.kind === 'crew' && this.S.active === q.id && vn > GUARD.takedownSpeed)) this.raiseAlarm(p, q.x, q.y, 'touched');
            }
            if (p.kind === 'foe' && p.kd.dog && q.kind === 'crew' && p.state === 'alert' && !q.ghost && p.biteT <= 0) {
                p.biteT = 1.3; this.hurt(q, 1, 'bite');
            }
        }
        // getting hit hard makes a walking guard stagger
        for (const [p, q] of pairs) {
            if (q.kind === 'foe' && isAwake(q) && q.state !== 'stun' && vn > 1.6 && p.kind !== 'foe') {
                if (q.state !== 'ko') { q.ctl = false; q.state = 'stun'; q.st = 0.6; q.hitBy = { x: p.x, y: p.y }; }
            }
        }
    }

    _strike(p, q, vn) {
        if (q.gone) return;
        const S = this.S;
        if (isDown(q)) { if (q.state === 'ko' || q.state === 'sleep') q.koT = Math.max(q.koT, GUARD.koTime * 0.6); return; }
        const aware = this.sees(q, p) && q.state !== 'stun';
        const kd = q.kd;
        let need = (aware ? GUARD.bruteSpeed : GUARD.takedownSpeed) * (kd.ko || 1);
        if (p.who === 'rico') need = Math.min(need, 5 * (kd.ko || 1));
        if (p.who === 'tito') need = 2 * (kd.ko || 1);
        if (p.who === 'doc' && !aware && !kd.boss && vn >= 1.5) { this.knockOut(q, p, 'sedate'); return; }
        if (vn >= need) {
            if (kd.boss && q.hp > 1) {
                q.hp--;
                this._stun(q, 2.6, p);
                this.emit('bossHit', { id: q.id, hp: q.hp, x: q.x, y: q.y });
                if (S.alarm.mode !== 'alert') this.raiseAlarm(q, p.x, p.y, 'boss');
                return;
            }
            this.knockOut(q, p, aware ? 'brute' : 'sneak');
        } else if (vn > 1) {
            this._stun(q, aware ? 0.8 : 1.4, p);
            if (aware) this.raiseAlarm(q, p.x, p.y, 'fight');
            else makeSuspicious(this, q, p.x, p.y, 0.8);
            this.emit('bounce', { id: q.id, x: q.x, y: q.y });
        }
    }

    _stun(f, t, by) {
        if (f.gone || isDown(f)) return;
        f.state = 'stun'; f.st = t; f.ctl = false; f.hitBy = by ? { x: by.x, y: by.y } : null;
        this.emit('stun', { id: f.id, x: f.x, y: f.y });
    }

    knockOut(f, by, how = 'sneak') {
        const S = this.S;
        if (f.gone || isDown(f)) return;
        if (f.kd.boss) {
            f.hp = 0; f.dazed = true;
        }
        f.state = how === 'dart' || how === 'sedate' ? 'sleep' : 'ko';
        f.koT = (how === 'dart' || how === 'sedate' ? GUARD.sleepTime : GUARD.koTime) * (f.kd.boss ? 3 : 1);
        f.ctl = false; f.sus = 0; f.found = false;
        S.stats.kos++;
        S.shotKOs++;
        if (f.kd.cop) S.stats.cops++;
        let style = 300, tag = how === 'dart' ? 'TRANQ' : how === 'sedate' ? 'SEDATED' : how === 'combo' ? 'COMBO' : how === 'car' ? 'HIT & RUN' : how === 'boom' ? 'KABOOM' : how === 'brute' ? 'BRAWLER' : 'TAKEDOWN';
        if (by && by.kind === 'crew' && (by.cush || 0) >= 1 && how !== 'dart') {
            const n = by.cush;
            tag = n >= 3 ? 'TRICK SHOT' : n === 2 ? 'DOUBLE BANK' : 'BANK SHOT';
            style += 250 * Math.min(3, n);
            S.stats.banks++;
        }
        if (S.shotKOs >= 2) { style += 400 * (S.shotKOs - 1); tag = S.shotKOs >= 3 ? 'TRIPLE' : 'DOUBLE'; }
        if (f.kd.cop) { style = -500; tag = 'OFFICER DOWN'; }
        S.stats.style += style;
        this.emit('takedown', { id: f.id, by: by?.id ?? null, x: f.x, y: f.y, how, tag, style, cop: !!f.kd.cop, boss: !!f.kd.boss });
        noiseAt(this, f.x, f.y, how === 'dart' || how === 'sedate' ? 1.2 : 2.6);
    }

    _pocket(b, where) {
        const S = this.S;
        if (b.gone) return;
        this.emit('pocket', { id: b.id, kind: b.kind, who: b.who, x: b.x, y: b.y, where });
        if (b.kind === 'foe') {
            b.gone = true; b.state = 'gone'; b.vx = 0; b.vy = 0;
            S.stats.sunk++;
            S.stats.style += b.kd.cop ? -300 : 400;
            if (b.sink) this.complete(`sink-${b.k}`);
            noiseAt(this, b.x, b.y, where === 'water' ? 4 : 2.5);
            return;
        }
        if (b.kind === 'vip') { b.gone = true; this.lose('vip'); return; }
        // teammates and recruits climb out where they started the shot
        b.vx = 0; b.vy = 0; b.x = -99; b.y = -99;
        const p = this.safeSpot(b.home.x, b.home.y);
        b.x = p.x; b.y = p.y; b.home = { x: p.x, y: p.y };
        if (b.kind === 'crew' && !b.downed) this.hurt(b, 1, 'splash');
    }

    hurt(b, n, cause) {
        const S = this.S;
        if (b.kind === 'vip') { this.vipHurt(b); return; }
        if (b.kind !== 'crew' || b.downed || b.extracted || b.gone) return;
        b.hp = Math.max(0, b.hp - n);
        S.stats.hurt += n;
        this.emit('hurt', { id: b.id, who: b.who, x: b.x, y: b.y, hp: b.hp, cause });
        if (b.hp <= 0) {
            b.downed = true; b.ghost = false;
            this.emit('downed', { id: b.id, who: b.who, x: b.x, y: b.y });
            if (S.freeShot === b.id) S.freeShot = null;
        }
    }

    vipHurt(b) {
        b.hp--;
        this.emit('hurt', { id: b.id, vip: true, x: b.x, y: b.y, hp: b.hp });
        if (b.hp <= 0) this.lose('vip');
    }

    heal(m, n) {
        if (m.kind !== 'crew' || m.gone) return false;
        if (m.downed) {
            m.downed = false; m.hp = Math.min(m.maxHp, n);
            this.emit('revive', { id: m.id, who: m.who, x: m.x, y: m.y });
            return true;
        }
        if (m.hp >= m.maxHp) return false;
        m.hp = Math.min(m.maxHp, m.hp + n);
        this.emit('heal', { id: m.id, who: m.who, x: m.x, y: m.y, hp: m.hp });
        return true;
    }

    _join(r) {
        const c = CREW[r.who], up = this.opts.crewUp?.[r.who] ?? {};
        r.kind = 'crew'; r.hp = c.hp + (up.hp || 0); r.maxHp = r.hp; r.charges = c.charges + (up.charges || 0) * (c.abilityKey === 'dart' ? 3 : 1);
        r.downed = false; r.extracted = false; r.ghost = false; r.ghostT = 0; r.hurtT = 0; r.wrecker = r.who === 'tito';
        this.complete('recruit');
        this.emit('join', { id: r.id, who: r.who, x: r.x, y: r.y });
    }

    // ------------------------------------------------------------------ world interactions
    breakTile(tx, ty, by) {
        const S = this.S;
        const i = ty * S.w + tx;
        const t = S.tiles[i];
        if (!BREAKABLE.has(t)) return false;
        S.tiles[i] = T.FLOOR;
        this.emit('break', { tx, ty, tile: t, x: tx + 0.5, y: ty + 0.5 });
        noiseAt(this, tx + 0.5, ty + 0.5, t === T.GLASS ? 7 : 5);
        return true;
    }

    openDoor(g) {
        const S = this.S;
        if (S.doors[g]) return;
        S.doors[g] = true;
        for (const i of this.L.doors[g] ?? []) S.tiles[i] = T.FLOOR;
        this.emit('door', { g });
    }

    hack(i, b) {
        const S = this.S, t = this.L.terms[i];
        if (!t || S.terms[i]) return;
        if (t.secure && b.who !== 'jinx') {
            if (!S.firsts[`sec${i}`]) { S.firsts[`sec${i}`] = true; this.emit('secure', { x: t.x, y: t.y }); }
            return;
        }
        S.terms[i] = true;
        if (t.opens) for (const g of String(t.opens).split(',')) {
            if (g === 'cams') for (const c of S.cams) c.off = true;
            else if (g === 'lasers') for (const l of S.lasers) l.cut = true;
            else this.openDoor(g);
        }
        if (t.obj) this.complete(`term${i}`);
        this.emit('hack', { x: t.x, y: t.y, i, by: b.who });
    }

    explode(x, y, R, by) {
        const S = this.S;
        S.stats.booms++;
        this.emit('boom', { x, y, r: R });
        for (const m of S.bodies) {
            if (m === by || m.gone) continue;
            const dx = m.x - x, dy = m.y - y, d = Math.hypot(dx, dy);
            if (d > R + m.r) continue;
            const k = (1 - Math.min(1, d / R)) * 13 + 3;
            const ux = d > 1e-6 ? dx / d : 1, uy = d > 1e-6 ? dy / d : 0;
            m.vx += ux * k / Math.sqrt(m.m); m.vy += uy * k / Math.sqrt(m.m);
            if (m.kind === 'foe') {
                if (m.kd.boss && m.hp > 1) { m.hp--; this._stun(m, 3, by); this.emit('bossHit', { id: m.id, hp: m.hp, x: m.x, y: m.y }); }
                else this.knockOut(m, by, 'boom');
            } else if (m.kind === 'crew' && m.who !== 'dex') this.hurt(m, 1, 'boom');
            else if (m.kind === 'vip') this.vipHurt(m);
        }
        const r = Math.ceil(R);
        for (let ty = Math.floor(y) - r; ty <= Math.floor(y) + r; ty++) {
            for (let tx = Math.floor(x) - r; tx <= Math.floor(x) + r; tx++) {
                if (tx < 0 || ty < 0 || tx >= S.w || ty >= S.h) continue;
                if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > R) continue;
                this.breakTile(tx, ty, by);
            }
        }
        for (const c of S.cams) if (!c.broken && Math.hypot(c.x - x, c.y - y) < R) { c.broken = true; this.emit('camBroken', { x: c.x, y: c.y }); }
        this.L.targets.forEach((t, i) => {
            if (S.targets[i]) return;
            if ((t.kind === 'car' || t.kind === 'safe') && Math.hypot(t.x - x, t.y - y) < R + 0.9) this._target(i);
        });
        noiseAt(this, x, y, 11);
    }

    _target(i) {
        const S = this.S, t = this.L.targets[i];
        if (S.targets[i]) return;
        S.targets[i] = true;
        if (t.kind === 'car') {
            const car = S.cars.find((c) => c.target === i);
            if (car) car.wreck = true;
        }
        this.complete(`target${i}`);
        this.emit('target', { i, kind: t.kind, x: t.x, y: t.y });
    }

    fireBullet(f, tgt) {
        const a0 = Math.atan2(tgt.y - f.y, tgt.x - f.x);
        const spread = f.k === 'shark' ? [-0.18, 0, 0.18] : [0];
        for (const s of spread) {
            const a = a0 + s + (rnd(this.S) - 0.5) * 0.12;
            this._spawn({ kind: 'bullet', x: f.x + Math.cos(a) * (f.r + 0.12), y: f.y + Math.sin(a) * (f.r + 0.12), vx: Math.cos(a) * GUARD.bulletSpeed, vy: Math.sin(a) * GUARD.bulletSpeed, bounce: 0, life: 1.1, owner: f.id });
        }
        f.face = a0;
        this.emit('gunshot', { id: f.id, x: f.x, y: f.y, a: a0 });
    }

    _spawn(p) { p.id = this.S.nextId++; this.S.projectiles.push(p); }

    _projectiles(dt) {
        const S = this.S;
        for (const p of S.projectiles) {
            p.life -= dt;
            const steps = 3;
            for (let k = 0; k < steps && p.life > 0; k++) {
                const nx = p.x + p.vx * dt / steps, ny = p.y + p.vy * dt / steps;
                if (isSolid(tileAt(S, nx, ny)) || this._hitsStatic(nx, ny)) {
                    if (p.bounce > 0) {
                        p.bounce--;
                        if (isSolid(tileAt(S, nx, p.y))) p.vx = -p.vx;
                        if (isSolid(tileAt(S, p.x, ny))) p.vy = -p.vy;
                        if (!isSolid(tileAt(S, nx, p.y)) && !isSolid(tileAt(S, p.x, ny))) { p.vx = -p.vx; p.vy = -p.vy; }
                        this.emit('ricochet', { x: p.x, y: p.y });
                    } else { p.life = 0; this.emit('spark', { x: p.x, y: p.y, kind: p.kind }); }
                    break;
                }
                p.x = nx; p.y = ny;
                if (p.kind === 'dart') this._dartHits(p);
                else this._bulletHits(p);
            }
        }
        S.projectiles = S.projectiles.filter((p) => p.life > 0);
    }

    _hitsStatic(x, y) {
        for (const c of this.L.circles) if (c.opaque && Math.hypot(c.x - x, c.y - y) < c.r) return true;
        return false;
    }

    _dartHits(p) {
        const S = this.S;
        for (const c of S.cams) {
            if (!c.broken && Math.hypot(c.x - p.x, c.y - p.y) < 0.42) { c.broken = true; p.life = 0; this.emit('camBroken', { x: c.x, y: c.y }); return; }
        }
        this.L.switches.forEach((s, i) => {
            if (!S.switches[i] && Math.hypot(s.x - p.x, s.y - p.y) < 0.45) this._switch(i);
        });
        for (const f of S.bodies) {
            if (f.kind !== 'foe' || f.gone || isDown(f)) continue;
            if (Math.hypot(f.x - p.x, f.y - p.y) > f.r + 0.08) continue;
            p.life = 0;
            const shooter = this.body(p.owner);
            const aware = shooter ? this.sees(f, shooter) && f.state !== 'dance' : false;
            if (!aware && !f.kd.boss) this.knockOut(f, shooter, 'dart');
            else { this._stun(f, 1, shooter); if (S.alarm.mode !== 'alert' && shooter) makeSuspicious(this, f, shooter.x, shooter.y, 0.9); }
            this.emit('dartHit', { x: p.x, y: p.y, id: f.id });
            return;
        }
    }

    _bulletHits(p) {
        for (const b of this.S.bodies) {
            if (b.gone || b.extracted) continue;
            if (b.kind !== 'crew' && b.kind !== 'vip') continue;
            if (b.ghost || b.downed) continue;
            if (Math.hypot(b.x - p.x, b.y - p.y) > b.r + 0.05) continue;
            p.life = 0;
            this.emit('bulletHit', { x: p.x, y: p.y, id: b.id });
            this.hurt(b, 1, 'shot');
            return;
        }
    }

    _switch(i) {
        const S = this.S, s = this.L.switches[i];
        if (S.switches[i]) return;
        S.switches[i] = true;
        if (s.opens) this.openDoor(s.opens);
        this.emit('switch', { i, x: s.x, y: s.y });
    }

    /** Pickups, switches, targets, terminals, cameras: anything a teammate rolls over. */
    _touches() {
        const S = this.S, L = this.L;
        for (const b of S.bodies) {
            if (b.gone || b.kind !== 'crew' || b.extracted) continue;
            L.intel.forEach((it, i) => {
                if (S.intel[i] || Math.hypot(it.x - b.x, it.y - b.y) > b.r + 0.3) return;
                S.intel[i] = true;
                this.emit('pickup', { kind: 'intel', i, x: it.x, y: it.y, name: it.name });
                this.complete(`intel${i}`);
            });
            L.tapes.forEach((it, i) => {
                if (S.tapes[i] || Math.hypot(it.x - b.x, it.y - b.y) > b.r + 0.3) return;
                S.tapes[i] = true; S.stats.tapes++;
                this.emit('pickup', { kind: 'tape', i, x: it.x, y: it.y });
            });
            L.switches.forEach((s, i) => {
                if (!S.switches[i] && Math.hypot(s.x - b.x, s.y - b.y) < 0.5) this._switch(i);
            });
            L.targets.forEach((t, i) => {
                if (S.targets[i]) return;
                const d = Math.hypot(t.x - b.x, t.y - b.y);
                if (t.kind === 'bug' && d < b.r + 0.45 && !b.downed) this._target(i);
                if (t.kind === 'photo' && d < b.r + 0.6 && !b.downed) this._target(i);
                if (t.kind === 'safe' && d < b.r + 0.6 && (b.who === 'jinx' || (b.who === 'tito' && Math.hypot(b.vx, b.vy) > 2.5))) this._target(i);
            });
            if (b.who === 'jinx' && !b.downed) {
                L.terms.forEach((t, i) => { if (!S.terms[i] && Math.hypot(t.x - b.x, t.y - b.y) < 1.1) this.hack(i, b); });
                for (const c of S.cams) if (!c.off && !c.broken && Math.hypot(c.x - b.x, c.y - b.y) < 1.0) { c.off = true; this.emit('camOff', { x: c.x, y: c.y }); }
            }
        }
    }

    _cameras(dt) {
        const S = this.S;
        for (const c of S.cams) {
            if (c.off || c.broken) { c.sus = 0; continue; }
            c.a = c.a0 + c.sweep * Math.sin(S.t * Math.PI * 2 / c.period);
            let seen = null;
            for (const b of S.bodies) {
                if (b.gone || b.extracted || b.ghost || (b.kind !== 'crew' && b.kind !== 'vip')) continue;
                const dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy);
                if (d > VISION.camRange) continue;
                if (Math.abs(angleDiff(c.a, Math.atan2(dy, dx))) > VISION.camHalf) continue;
                if (this._concealed(b)) continue;
                if (!lineOfSight(S, this.L, c.x, c.y, b.x, b.y)) continue;
                seen = b; break;
            }
            if (seen) {
                c.sus += dt * 1.7;
                if (c.sus >= 1 && S.alarm.mode !== 'alert') { c.sus = 0; this.raiseAlarm(null, seen.x, seen.y, 'camera'); }
                else if (S.alarm.mode === 'alert') this.refreshAlarm(seen.x, seen.y);
            } else c.sus = Math.max(0, c.sus - dt);
        }
    }

    _lasers(dt) {
        const S = this.S;
        for (const l of S.lasers) {
            l.cool = Math.max(0, l.cool - dt);
            l.live = !l.cut && (!l.on || ((S.t % (l.on + l.off)) < l.on));
            if (!l.live || l.cool > 0) continue;
            for (const b of S.bodies) {
                if (b.gone || b.extracted || b.ghost || (b.kind !== 'crew' && b.kind !== 'vip')) continue;
                if (segCircle(l.x1, l.y1, l.x2, l.y2, b.x, b.y, b.r)) {
                    l.cool = 2;
                    this.emit('laser', { x: b.x, y: b.y });
                    if (S.alarm.mode !== 'alert') this.raiseAlarm(null, b.x, b.y, 'laser');
                    else this.refreshAlarm(b.x, b.y);
                    break;
                }
            }
        }
    }

    _crewTimers(dt) {
        for (const b of this.S.bodies) {
            if (b.kind !== 'crew') continue;
            b.hurtT = Math.max(0, (b.hurtT || 0) - dt);
            if (Math.hypot(b.vx, b.vy) > 0.05) b.face = Math.atan2(b.vy, b.vx);
            if (b.ghost && b.vx === 0 && b.vy === 0) {
                b.ghostT -= dt;
                if (b.ghostT <= 0) { b.ghost = false; this.emit('unghost', { id: b.id }); }
            }
        }
    }

    // ------------------------------------------------------------------ ending
    win() {
        const S = this.S;
        if (S.phase === 'won' || S.phase === 'lost') return;
        S.phase = 'won';
        S.result = this.score();
        this.emit('won', { result: S.result });
    }

    lose(why) {
        const S = this.S;
        if (S.phase === 'won' || S.phase === 'lost') return;
        S.phase = 'lost';
        S.result = { why };
        this.emit('lost', { why });
    }

    score() {
        const S = this.S, st = S.stats, par = this.def.par;
        const over = Math.max(0, st.shots - par);
        const rows = [
            ['Case closed', 5000],
            ['Style', st.style],
            ['Vice tapes', st.tapes * 1500],
            ['Alarms', -st.alarms * 1500],
            ['Bodies found', -st.bodies * 500],
            [`Shots over par (${st.shots}/${par})`, -over * 200],
            ['Ghost bonus', st.alarms === 0 ? 2500 : 0],
            ['Unused replays', S.rewinds * 400],
        ];
        const score = Math.max(500, rows.reduce((a, r) => a + r[1], 0));
        let grade = 'C';
        if (st.alarms === 0 && st.shots <= par && st.bodies === 0) grade = 'S';
        else if (st.alarms <= 1 && st.shots <= par + 4) grade = 'A';
        else if (st.alarms <= 3) grade = 'B';
        return { score, grade, rows, rep: Math.round(score / 10 / 50) * 50, tapes: st.tapes, tapesTotal: this.L.tapes.length };
    }

    // ------------------------------------------------------------------ aim guide
    /**
     * Where a shot would go: the path until the first ball it would hit (or
     * after `cushions` wall bounces, or when it stops or drops).
     */
    predict(id, angle, power, cushions = 1) {
        const S = this.S, b = this.body(id);
        if (!b) return null;
        const c = CREW[b.who];
        const sp = (PHYS.minSpeed + (PHYS.maxSpeed - PHYS.minSpeed) * Math.max(0, Math.min(1, power))) * c.power;
        const ghost = { x: b.x, y: b.y, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, r: b.r, m: b.m, ctl: false, gone: false };
        const fake = { w: S.w, h: S.h, tiles: S.tiles, bodies: [ghost], cars: S.cars.filter((k) => !k.traffic) };
        let bounces = 0, dropped = false;
        const hooks = {
            wall: (g, tx, ty, t, vn) => { if (vn > 0.3) bounces++; },
            circle: (g, cc, vn) => { if (vn > 0.3) bounces++; },
            box: (g, bx, vn) => { if (vn > 0.3) bounces++; },
            pocket: () => { dropped = true; },
        };
        const pts = [[ghost.x, ghost.y]];
        const others = S.bodies.filter((o) => o !== b && !o.gone && !o.extracted);
        let hit = null;
        for (let n = 0; n < 900; n++) {
            const px = ghost.x, py = ghost.y;
            stepPhysics(fake, this.L, SIM_DT, hooks);
            // first contact with another body: back up to the touching point
            for (const o of others) {
                const rr = o.r + ghost.r;
                if (Math.hypot(o.x - ghost.x, o.y - ghost.y) < rr) {
                    // binary search along the last step for the contact point
                    let lo = 0, hi = 1;
                    for (let k = 0; k < 10; k++) {
                        const m = (lo + hi) / 2;
                        const x = px + (ghost.x - px) * m, y = py + (ghost.y - py) * m;
                        if (Math.hypot(o.x - x, o.y - y) < rr) hi = m; else lo = m;
                    }
                    const gx = px + (ghost.x - px) * lo, gy = py + (ghost.y - py) * lo;
                    const nx = (o.x - gx) / rr, ny = (o.y - gy) / rr;
                    hit = { x: gx, y: gy, target: o.id, kind: o.kind, nx, ny };
                    pts.push([gx, gy]);
                    break;
                }
            }
            if (hit) break;
            if (n % 3 === 0) pts.push([ghost.x, ghost.y]);
            if (dropped || bounces > cushions || (ghost.vx === 0 && ghost.vy === 0)) break;
        }
        pts.push([ghost.x, ghost.y]);
        return { pts, hit, dropped, speed: sp };
    }
}

export { coneOf, castRay, isDown, isAwake };
