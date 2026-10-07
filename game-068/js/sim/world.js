/**
 * world.js — one level being played. Pure simulation: no three.js, no DOM, and all randomness from
 * the seeded RNG.
 *
 *   const w = new World({ level: 1 });
 *   w.build('medic', 5, 7); w.startWave(); w.tick(STEP) ...
 *
 * People (walkers and volunteers) share one list and one set of ailments, so every aid station
 * treats both. The dead move along the same routes as the people; in boss levels they have a
 * blight meter the volunteers cure. The view reads `people`, `dead`, `stations`, `shots` and drains
 * `events` (each with a rising `seq`).
 */

import { W, H, STEP } from '../config.js';
import { RNG, hashStr } from '../rng.js';
import { AIL, STATIONS, DEAD, BOSSES, KINDS, TRADES, ADULT_TRADES, VOL, LOOKS, SCRATCH_EVERY, REACH, VOL_REACH, SELL_BACK } from './data.js';
import { levelDef, makeWave, stationsFor, themeOf, mapSeed } from './levels.js';
import { generateMap, buildable, idx } from './mapgen.js';
import { personName, SAY } from './names.js';

const MAX_EVENTS = 600;
const HAT_COUNT = 9;

export class World {
    /**
     * opts: { level (number), roster ({ trade: count }), runSeed (Open Road) }
     */
    constructor(opts = {}) {
        this.levelN = opts.level ?? 1;
        this.level = levelDef(this.levelN);
        this.runSeed = opts.runSeed ?? 0;
        this.theme = themeOf(this.level, this.runSeed);
        this.boss = !!this.level.boss;
        this.endless = !!this.level.endless;
        this.map = generateMap({ seed: mapSeed(this.level, this.runSeed), theme: this.theme, branch: !!this.level.branch });
        this.routes = this.map.routes;
        this.ail = new Set(this.level.ailments.filter((a) => a !== 'cold' || this.theme === 'winter'));
        this.open = stationsFor(this.level);
        this.rng = new RNG(hashStr(`world-${this.levelN}-${this.runSeed}`));

        this.time = 0;
        this.supplies = this.level.supplies;
        this.hope = this.hopeMax = this.level.hope;
        this.wave = 0;
        this.waveCount = this.level.waves;
        this.state = 'build';          // build | wave | won | lost
        this.queue = [];
        this.waveT = 0;
        this.autoT = 0;                // countdown to the next wave (0 = waiting for the player)

        this.people = [];
        this.dead = [];
        this.stations = [];
        this.shots = [];
        this.occ = new Int32Array(W * H);   // >0 station id, <0 volunteer id
        this.nextId = 1;
        this.events = [];
        this.seq = 0;
        this.sayCool = 0;

        this.stats = { spawned: 0, saved: 0, thriving: 0, lost: 0, treated: 0, cured: 0, restored: 0, revived: 0, scratches: 0, supplied: 0 };
        this.saved = [];                // { name, kind, trade, care, thriving, restored }
        this.lostNames = [];
        this.bossEnt = null;
        this.bossCured = false;

        // Volunteers (boss levels): the roster, what's deployed and who is resting.
        this.roster = { ...(opts.roster || {}) };
        this.slots = this.level.slots || 0;
        this.resting = [];              // { trade, t }
    }

    // ------------------------------------------------------------------ events
    emit(type, data = {}) {
        data.type = type;
        data.seq = ++this.seq;
        this.events.push(data);
        if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS);
        return data;
    }
    /** Events after `seq` (by sequence number, never by index: the queue is capped). */
    eventsSince(seq) {
        const out = [];
        for (let i = this.events.length - 1; i >= 0 && this.events[i].seq > seq; i--) out.push(this.events[i]);
        return out.reverse();
    }
    say(p, pool) {
        if (this.sayCool > 0 || !SAY[pool]) return;
        this.sayCool = 1.1;
        this.emit('say', { id: p.id, text: this.rng.pick(SAY[pool]) });
    }

    // ------------------------------------------------------------------ building
    canBuild(type, x, z) {
        if (!this.open.includes(type)) return 'locked';
        if (this.state === 'won' || this.state === 'lost') return 'over';
        if (!buildable(this.map, x, z)) return 'ground';
        if (this.occ[idx(x, z)]) return 'taken';
        if (this.supplies < STATIONS[type].cost[0]) return 'supplies';
        return '';
    }
    build(type, x, z) {
        const why = this.canBuild(type, x, z);
        if (why) return { ok: false, why };
        const cost = STATIONS[type].cost[0];
        this.supplies -= cost;
        const s = { id: this.nextId++, type, lv: 0, tx: x, tz: z, x: x + 0.5, z: z + 0.5, cool: 0.3, spent: cost, channel: null, flareT: 0, ringT: 0, hopT: 0, treated: 0, aim: null, busy: 0 };
        this.stations.push(s);
        this.occ[idx(x, z)] = s.id;
        this.emit('build', { id: s.id, kind: type, x: s.x, z: s.z });
        return { ok: true, station: s };
    }
    upgradeCost(s) { return s.lv < 2 ? STATIONS[s.type].cost[s.lv + 1] : 0; }
    upgrade(id) {
        const s = this.stations.find((t) => t.id === id);
        if (!s || s.lv >= 2) return { ok: false, why: 'max' };
        const c = this.upgradeCost(s);
        if (this.supplies < c) return { ok: false, why: 'supplies' };
        this.supplies -= c;
        s.spent += c;
        s.lv++;
        this.emit('upgrade', { id: s.id, kind: s.type, lv: s.lv, x: s.x, z: s.z });
        return { ok: true };
    }
    sellValue(s) { return Math.floor(s.spent * SELL_BACK); }
    sell(id) {
        const i = this.stations.findIndex((t) => t.id === id);
        if (i < 0) return { ok: false };
        const s = this.stations[i];
        this.supplies += this.sellValue(s);
        this.stations.splice(i, 1);
        this.occ[idx(s.tx, s.tz)] = 0;
        this.emit('sell', { id: s.id, kind: s.type, x: s.x, z: s.z });
        return { ok: true };
    }

    // ------------------------------------------------------------------ volunteers
    tradePower(trade) {
        if (trade === 'neighbour') return 1;
        const n = this.roster[trade] || 0;
        return 1 + Math.min(VOL.maxBonus, VOL.perExtra * Math.max(0, n - 1));
    }
    available(trade) {
        const total = trade === 'neighbour' ? VOL.neighbours : (this.roster[trade] || 0);
        const out = this.people.filter((p) => p.role === 'vol' && p.trade === trade).length + this.resting.filter((r) => r.trade === trade).length;
        return Math.max(0, total - out);
    }
    activeVols() { return this.people.filter((p) => p.role === 'vol').length; }
    canDeploy(trade, x, z) {
        if (!this.boss) return 'boss';
        if (this.state === 'won' || this.state === 'lost') return 'over';
        if (!TRADES[trade]) return 'trade';
        if (this.available(trade) <= 0) return 'none';
        if (this.activeVols() >= this.slots) return 'slots';
        if (!buildable(this.map, x, z)) return 'ground';
        if (this.occ[idx(x, z)]) return 'taken';
        return '';
    }
    deploy(trade, x, z) {
        const why = this.canDeploy(trade, x, z);
        if (why) return { ok: false, why };
        const p = this.makePerson({ kind: trade === 'storyteller' ? 'elder' : 'adult', trade, role: 'vol' });
        p.tx = x; p.tz = z; p.x = x + 0.5; p.z = z + 0.5; p.state = 'stand';
        p.power = this.tradePower(trade);
        p.cool = 0.5;
        p.yaw = 0;
        this.occ[idx(x, z)] = -p.id;
        this.people.push(p);
        this.emit('deploy', { id: p.id, trade, x: p.x, z: p.z });
        if (this.rng.chance(0.5)) this.say(p, 'vol');
        return { ok: true, person: p };
    }
    recall(id) {
        const p = this.people.find((q) => q.id === id && q.role === 'vol');
        if (!p) return { ok: false };
        this.removeVol(p, 2);
        this.emit('recall', { id, x: p.x, z: p.z });
        return { ok: true };
    }
    removeVol(p, rest) {
        this.occ[idx(p.tx, p.tz)] = 0;
        p.state = 'gone';
        this.people.splice(this.people.indexOf(p), 1);
        this.resting.push({ trade: p.trade, t: rest });
    }

    // ------------------------------------------------------------------ waves
    startWave() {
        if (this.state !== 'build' || this.wave >= this.waveCount) return false;
        if (this.autoT > 0 && this.wave > 0) {
            const bonus = Math.floor(this.autoT * 0.6);
            if (bonus > 0) { this.supplies += bonus; this.emit('early', { bonus }); }
        }
        this.wave++;
        this.queue = makeWave(this.level, this.wave, this.routes.length > 1, this.runSeed);
        this.waveT = 0;
        this.autoT = 0;
        this.state = 'wave';
        this.emit('waveStart', { wave: this.wave, boss: this.queue.some((q) => q.what === 'boss') });
        return true;
    }

    makePerson({ kind = 'adult', trade = null, role = 'civ', route = 0, lane = 0, family = null, ail = {} }) {
        const r = this.rng;
        const K = KINDS[kind];
        if (role === 'civ' && !trade) trade = kind === 'elder' ? 'storyteller' : kind === 'child' ? null : r.pick(ADULT_TRADES);
        const look = {
            skin: r.int(0, LOOKS.skin.length - 1), hair: kind === 'elder' ? 5 + r.int(0, 1) : r.int(0, 4),
            top: r.int(0, LOOKS.cloth.length - 1), bottom: r.int(0, LOOKS.cloth.length - 1), hat: r.int(0, HAT_COUNT - 1),
        };
        const p = {
            id: this.nextId++, role, kind, trade, name: personName(r, kind), look, family,
            route, d: 0, lane, lane0: lane, x: 0, z: 0, yaw: 0, phase: r.range(0, 6.28),
            hp: K.hp, maxHp: K.hp, temp: 0,
            wound: ail.wound || 0, sick: ail.sick || 0, hunger: !!ail.hunger, cold: ail.cold || 0, fracture: !!ail.fracture, fear: ail.fear || 0,
            warmT: 0, immuneT: 0, safeT: 0, boostT: 0, freezeT: 0, fearT: r.range(0, 2.5), adrenT: 0, downT: 0,
            state: 'walk', speed: 0, care: {}, had: Object.keys(ail).filter((k) => ail[k]), restored: false, rally: 0, slowAura: 0,
            hitT: 0, treatT: 0, carriedT: 0,
        };
        return p;
    }

    spawn(e) {
        if (e.what === 'civ') {
            const p = this.makePerson({ kind: e.kind, route: e.route, lane: e.lane, family: e.family, ail: e.ail });
            this.place(p);
            this.people.push(p);
            this.stats.spawned++;
            this.emit('spawn', { id: p.id });
        } else {
            this.spawnDead(e.what === 'boss' ? e.kind : e.kind, e.route, e.lane, 0, e.what === 'boss');
        }
    }

    spawnDead(kind, route, lane, d = 0, boss = false) {
        const D = boss ? BOSSES[kind] : DEAD[kind];
        const z = {
            id: this.nextId++, kind, boss, route, d, lane, x: 0, z: 0, yaw: 0, phase: this.rng.range(0, 6.28),
            speed: D.speed * this.rng.range(0.92, 1.08), blight: D.blight, blightMax: D.blight, scale: D.scale,
            state: 'walk', mode: 'road', scratchT: 0, pauseT: 0, stunT: 0, lureT: 0, lureX: 0, lureZ: 0, fade: 0,
            slow: 0, specialT: 2 + this.rng.range(0, 2), callT: boss ? D.call.every * 0.6 : 0, slamT: 2, phaseN: 0, engaged: 0, hitT: 0,
            look: { top: this.rng.int(0, 5), hat: this.rng.int(0, HAT_COUNT - 1), hair: this.rng.int(0, 4) },
        };
        if (boss) z.resist = 0.6;
        this.placeDead(z);
        this.dead.push(z);
        if (boss) { this.bossEnt = z; this.emit('bossArrives', { id: z.id, kind }); }
        return z;
    }

    // ------------------------------------------------------------------ positions
    place(p) {
        const R = this.routes[p.route];
        const o = R.at(p.d, this._o || (this._o = {}));
        p.x = o.x - o.dz * p.lane;
        p.z = o.z + o.dx * p.lane;
        p.yaw = Math.atan2(o.dx, o.dz);
    }
    placeDead(z) {
        if (z.mode !== 'road') return;
        const R = this.routes[z.route];
        const o = R.at(z.d, this._o || (this._o = {}));
        const lane = z.boss ? 0 : z.lane;
        z.x = o.x - o.dz * lane;
        z.z = o.z + o.dx * lane;
        z.yaw = Math.atan2(o.dx, o.dz);
    }
    progress(e) { return e.d / this.routes[e.route].length; }

    // ------------------------------------------------------------------ damage & care
    hurt(p, amt) {
        if (amt <= 0 || p.state === 'down' || p.state === 'saved' || p.state === 'lost') return;
        if (p.hunger) amt *= AIL.hungerHurt;
        if (p.temp > 0) { const a = Math.min(p.temp, amt); p.temp -= a; amt -= a; }
        p.hp -= amt;
        if (p.hp <= 0) this.collapse(p);
    }
    collapse(p) {
        p.hp = 0; p.temp = 0;
        p.state = 'down';
        p.downT = p.role === 'vol' ? VOL.downTime : AIL.downTime;
        p.freezeT = 0;
        this.emit('collapse', { id: p.id, x: p.x, z: p.z, vol: p.role === 'vol' });
    }
    revive(p, frac, by) {
        if (p.state !== 'down') return;
        p.state = p.role === 'vol' ? 'stand' : 'walk';
        p.hp = Math.max(1, p.maxHp * frac);
        p.adrenT = 1;
        p.care[by] = (p.care[by] || 0) + 1;
        this.stats.revived++;
        this.emit('revive', { id: p.id, x: p.x, z: p.z, by });
        this.say(p, 'revive');
    }
    treat(p, by) {
        p.care[by] = (p.care[by] || 0) + 1;
        p.treatT = 0.6;
        this.stats.treated++;
    }

    // ------------------------------------------------------------------ the frame
    tick(dt = STEP) {
        if (this.state === 'won' || this.state === 'lost') { this.time += dt; this.moveShots(dt); return; }
        this.time += dt;
        this.sayCool -= dt;
        for (const r of this.resting) r.t -= dt;
        for (let i = this.resting.length - 1; i >= 0; i--) if (this.resting[i].t <= 0) { this.emit('volBack', { trade: this.resting[i].trade }); this.resting.splice(i, 1); }

        if (this.state === 'wave') {
            this.waveT += dt;
            while (this.queue.length && this.queue[0].t <= this.waveT) this.spawn(this.queue.shift());
        } else if (this.state === 'build' && this.autoT > 0) {
            this.autoT -= dt;
            if (this.autoT <= 0) { this.autoT = 0; this.startWave(); }
        }

        this.auras(dt);
        for (const p of this.people.slice()) this.updatePerson(p, dt);
        for (const z of this.dead.slice()) this.updateDead(z, dt);
        for (const s of this.stations) this.updateStation(s, dt);
        for (const p of this.people.slice()) if (p.role === 'vol' && p.state === 'stand') this.volAct(p, dt);
        this.moveShots(dt);
        this.cleanup();
        this.checkWave();
    }

    // Auras: lantern, fire, song and the musician/storyteller. Computed fresh every tick.
    auras(dt) {
        for (const z of this.dead) z.slow = 0;
        for (const p of this.people) { p.rally = 0; }
        for (const s of this.stations) {
            const L = STATIONS[s.type].lv[s.lv];
            if (s.type === 'lantern') {
                const r2 = L.range * L.range;
                for (const z of this.dead) if (d2(z, s) <= r2) z.slow = Math.max(z.slow, L.slow);
                for (const p of this.people) if (p.fear > 0 && d2(p, s) <= r2) p.fear = Math.max(0, p.fear - 4 * dt);
            } else if (s.type === 'fire') {
                const r2 = L.range * L.range;
                s.busy = 0;
                for (const p of this.people) {
                    if (!alive(p) || d2(p, s) > r2) continue;
                    if (p.cold > 0 || L.heal) {
                        const before = p.cold;
                        p.cold = Math.max(0, p.cold - L.warm * dt);
                        if (before > 0) { s.busy = 1; if (p.cold === 0 && before > 0) { this.treat(p, 'fire'); s.treated++; this.emit('warm', { id: p.id, x: p.x, z: p.z }); this.say(p, 'fire'); } }
                    }
                    if (this.ail.has('cold')) p.warmT = Math.max(p.warmT, L.buff);
                    if (L.heal && p.hp < p.maxHp && p.state !== 'down') p.hp = Math.min(p.maxHp, p.hp + L.heal * dt);
                }
            } else if (s.type === 'song') {
                const r2 = L.range * L.range;
                s.busy = 0;
                for (const p of this.people) {
                    if (!alive(p) || p.state === 'down' || d2(p, s) > r2) continue;
                    if (p.fear > 0) {
                        const before = p.fear;
                        p.fear = Math.max(0, p.fear - L.calm * dt);
                        s.busy = 1;
                        if (before >= 30 && p.fear < 30) { this.treat(p, 'song'); s.treated++; this.emit('calm', { id: p.id, x: p.x, z: p.z }); this.say(p, 'song'); }
                    }
                    if (p.temp < L.cap) { p.temp = Math.min(L.cap, p.temp + L.courage * dt); s.busy = 1; }
                }
                if (L.sway) for (const z of this.dead) if (d2(z, s) <= r2) z.slow = Math.max(z.slow, L.sway);
            }
        }
        // volunteers' auras
        for (const v of this.people) {
            if (v.role !== 'vol' || v.state !== 'stand') continue;
            const T = TRADES[v.trade];
            if (v.trade === 'musician') {
                const r2 = T.range * T.range;
                for (const z of this.dead) if (z.state === 'walk' && d2(z, v) <= r2) {
                    z.slow = Math.max(z.slow, T.slow);
                    this.cureDead(z, T.aura * v.power * this.volRate(v) * dt, v);
                }
                for (const p of this.people) if (p.role === 'vol' && d2(p, v) <= r2) p.fear = Math.max(0, p.fear - T.calm * dt);
            } else if (v.trade === 'storyteller') {
                const r2 = T.range * T.range;
                for (const p of this.people) if (p.role === 'vol' && p !== v && d2(p, v) <= r2) { p.rally = T.rally; p.fear = 0; }
            }
        }
    }

    // ------------------------------------------------------------------ people
    updatePerson(p, dt) {
        p.treatT = Math.max(0, p.treatT - dt);
        p.hitT = Math.max(0, p.hitT - dt);
        if (p.state === 'down') {
            const near = this.dead.some((z) => z.state === 'walk' && d2(z, p) < 0.7 * 0.7);
            p.downT -= dt * (near ? AIL.downTime / AIL.downTimeNear : 1);
            if (p.downT <= 0) {
                if (p.role === 'vol') { this.emit('volRest', { id: p.id, trade: p.trade, x: p.x, z: p.z }); this.removeVol(p, VOL.rest); }
                else this.lose(p);
            }
            return;
        }
        if (p.state !== 'walk' && p.state !== 'stand') return;

        // timers
        p.warmT = Math.max(0, p.warmT - dt);
        p.immuneT = Math.max(0, p.immuneT - dt);
        p.boostT = Math.max(0, p.boostT - dt);
        p.freezeT = Math.max(0, p.freezeT - dt);
        p.adrenT = Math.max(0, p.adrenT - dt);
        p.safeT = Math.max(0, p.safeT - dt);
        p.carriedT = Math.max(0, p.carriedT - dt);
        if (p.temp > 0) p.temp = Math.max(0, p.temp - AIL.tempDecay * dt);

        // ailments
        let drain = 0;
        if (p.wound > 0) drain += p.wound * AIL.woundDrain;
        if (p.sick > 0) {
            if (p.immuneT <= 0) p.sick = Math.min(100, p.sick + AIL.sickSpread * dt);
            if (p.sick >= 100) drain += AIL.sickDrainMax; else if (p.sick > AIL.sickHi) drain += AIL.sickDrainHi;
        }
        if (this.ail.has('cold')) {
            if (p.warmT > 0) p.cold = Math.max(0, p.cold - 10 * dt);
            else p.cold = Math.min(100, p.cold + AIL.coldRise * dt);
        }
        if (p.cold >= 100) drain += AIL.coldDrainMax; else if (p.cold > 50) drain += AIL.coldDrainHi;
        if (this.ail.has('fear')) {
            const near = this.dead.some((z) => z.state === 'walk' && d2(z, p) < 1.8 * 1.8);
            if (near && p.rally <= 0 && !p.restored) p.fear = Math.min(100, p.fear + AIL.fearNear * KINDS[p.kind].fearMul * dt);
            else if (!near) p.fear = Math.max(0, p.fear - AIL.fearDecay * dt);
            p.fearT -= dt;
            if (p.fearT <= 0) {
                p.fearT = 2.5;
                if (p.fear > 50 && p.role === 'civ' && p.freezeT <= 0 && this.rng.chance(AIL.fearFreezeChance)) { p.freezeT = 1.2; this.emit('freeze', { id: p.id }); }
            }
        }
        if (drain > 0) this.hurt(p, drain * dt);
        if (p.state !== 'walk') return;     // volunteers stand; the collapsed lie still

        // walking
        let v = KINDS[p.kind].speed;
        if (p.restored) v = 1.2;
        if (p.fracture) v *= AIL.fractureSlow;
        if (p.cold > 50) v *= AIL.coldSlow;
        if (p.hunger) v *= AIL.hungerSlow;
        if (p.adrenT > 0) v *= 1.5;
        if (p.boostT > 0) v *= 1.3;
        if (p.freezeT > 0) v = 0;
        p.speed = v;
        p.d += v * dt;
        p.phase += v * dt * 9;
        const R = this.routes[p.route];
        if (p.d >= R.length) { this.arrive(p); return; }
        this.dodge(p, R, dt);
        this.place(p);
    }

    /** Step round the dead ahead: ease toward the far side of the road, then back to your lane. */
    dodge(p, R, dt) {
        const o = R.at(p.d, this._o2 || (this._o2 = {}));
        let want = p.lane0;
        for (const z of this.dead) {
            if (z.state !== 'walk') continue;
            const rx = z.x - p.x, rz = z.z - p.z;
            if (rx * rx + rz * rz > 1.6 * 1.6 || rx * o.dx + rz * o.dz < -0.2) continue;
            const lat = (z.x - o.x) * -o.dz + (z.z - o.z) * o.dx;
            if (Math.abs(lat - p.lane) < 0.4 * Math.sqrt(z.scale)) want = lat > 0 ? -0.42 : 0.42;
        }
        const k = Math.min(1, dt * 2.5);
        p.lane += (want - p.lane) * k;
    }

    isThriving(p) {
        return p.hp >= p.maxHp * 0.6 && p.wound === 0 && p.sick < 10 && !p.hunger && !p.fracture && p.cold < 30 && p.fear < 30;
    }

    arrive(p) {
        p.state = 'saved';
        const thriving = !p.restored && this.isThriving(p);
        let gain = p.restored ? 2 : 4 + (thriving ? 6 : 0) + (KINDS[p.kind].supplies || 0);
        this.supplies += gain;
        this.stats.supplied += gain;
        if (p.restored) this.stats.restored++;
        else { this.stats.saved++; if (thriving) this.stats.thriving++; }
        const rec = { name: p.name, kind: p.kind, trade: p.trade, care: p.care, thriving, restored: p.restored, had: p.had };
        this.saved.push(rec);
        // Thriving adults (and everyone cured back to life) join the roster straight away.
        if ((thriving || p.restored) && p.trade) this.roster[p.trade] = (this.roster[p.trade] || 0) + 1;
        this.emit('saved', { id: p.id, thriving, restored: p.restored, gain, x: p.x, z: p.z, name: p.name, trade: p.trade, look: p.look, kind: p.kind, joins: (thriving || p.restored) && !!p.trade });
        if (!p.restored) this.say(p, 'saved');
    }

    lose(p) {
        p.state = 'lost';
        this.stats.lost++;
        this.lostNames.push(`${p.name.first} ${p.name.last}`);
        this.hope = Math.max(0, this.hope - 1);
        this.emit('lost', { id: p.id, x: p.x, z: p.z, name: p.name });
    }

    // ------------------------------------------------------------------ the dead
    updateDead(z, dt) {
        z.hitT = Math.max(0, z.hitT - dt);
        if (z.state === 'fading') {
            z.fade += dt / 1.6;
            if (z.fade >= 1) z.state = 'gone';
            if (z.mode === 'road') { z.d += z.speed * 0.3 * dt; this.placeDead(z); }
            return;
        }
        if (z.state !== 'walk') return;
        z.scratchT -= dt; z.pauseT -= dt; z.stunT -= dt; z.specialT -= dt;
        z.phase += dt * 5;
        const D = z.boss ? BOSSES[z.kind] : DEAD[z.kind];
        const resist = z.boss ? 0.6 : D.resist || 0;
        const slow = z.slow * (1 - resist);

        if (z.boss) this.bossAct(z, D, dt);
        else if (D.spit && z.specialT <= 0) {
            const t = this.nearestPerson(z, D.spit.range);
            if (t) {
                z.specialT = D.spit.every;
                this.shots.push({ kind: 'spit', x: z.x, z: z.z, tx: t.x, tz: t.z, target: t.id, t: 0, dur: 0.7, from: z.id, sick: D.spit.sick, hurt: D.spit.hurt, h: 0.5 });
                this.emit('spit', { id: z.id, x: z.x, z: z.z });
            } else z.specialT = 0.6;
        } else if (D.howl && z.specialT <= 0) {
            const r2 = D.howl.range * D.howl.range;
            const hit = this.people.filter((p) => alive(p) && p.state !== 'down' && d2(p, z) <= r2);
            z.specialT = hit.length ? D.howl.every : 1;
            if (hit.length) {
                if (this.ail.has('fear')) for (const p of hit) if (p.rally <= 0 && !p.restored) p.fear = Math.min(100, p.fear + D.howl.fear * KINDS[p.kind].fearMul);
                this.emit('howl', { id: z.id, x: z.x, z: z.z });
            }
        }

        // scratching: walkers on the road in reach, or a volunteer standing beside it
        let target = null;
        const zv = z.speed * (1 - slow);
        if (z.mode === 'road' || z.mode === 'return') {
            let bd = Infinity;
            for (const p of this.people) {
                if (p.state !== 'walk' && p.state !== 'stand') continue;
                if (p.restored || p.safeT > 0) continue;
                // Only someone the dead can keep up with gets caught: the quick slip past.
                if (p.role === 'civ' && p.freezeT <= 0 && p.speed > zv + 0.05) continue;
                const reach = (p.role === 'vol' ? VOL_REACH : REACH) * (z.boss ? 1.6 : Math.sqrt(z.scale));
                const dd = d2(p, z);
                if (dd <= reach * reach && dd < bd) { bd = dd; target = p; }
            }
        }
        z.engaged = target && target.role === 'vol' && !z.boss ? target.id : 0;
        if (target && z.scratchT <= 0 && z.stunT <= 0) {
            z.scratchT = SCRATCH_EVERY;
            z.pauseT = target.role === 'vol' ? 0 : 1;
            if (!z.boss) this.scratch(target, D, z);
        }

        // moving
        let v = z.speed * (1 - slow);
        if (z.stunT > 0 || z.pauseT > 0 || z.engaged) v = 0;
        if (z.mode === 'road') {
            z.d += v * dt;
            const R = this.routes[z.route];
            if (z.d >= R.length) { this.deadArrives(z); return; }
            this.placeDead(z);
        } else if (z.mode === 'lured') {
            z.lureT -= dt;
            const dx = z.lureX - z.x, dz = z.lureZ - z.z, dist = Math.hypot(dx, dz);
            if (dist > 0.6 && v > 0) { z.x += (dx / dist) * v * dt; z.z += (dz / dist) * v * dt; z.yaw = Math.atan2(dx, dz); }
            if (z.lureT <= 0) z.mode = 'return';
        } else if (z.mode === 'return') {
            const o = this.routes[z.route].at(z.d, {});
            const dx = o.x - z.x, dz = o.z - z.z, dist = Math.hypot(dx, dz);
            if (dist < 0.08) { z.mode = 'road'; this.placeDead(z); }
            else if (v > 0) { const s = Math.min(dist, v * dt); z.x += (dx / dist) * s; z.z += (dz / dist) * s; z.yaw = Math.atan2(dx, dz); }
        }
    }

    nearestPerson(z, range) {
        let best = null, bd = range * range;
        for (const p of this.people) {
            if ((p.state !== 'walk' && p.state !== 'stand') || p.restored) continue;
            const dd = d2(p, z);
            if (dd < bd) { bd = dd; best = p; }
        }
        return best;
    }

    scratch(p, D, z) {
        this.stats.scratches++;
        p.hitT = 0.4;
        if (this.ail.has('wound') && D.wound) p.wound = Math.min(3, p.wound + D.wound);
        if (this.ail.has('sick') && D.sick && p.immuneT <= 0) p.sick = Math.min(100, Math.max(p.sick, 0) + D.sick);
        if (this.ail.has('fear') && D.fear && p.rally <= 0) p.fear = Math.min(100, p.fear + D.fear * KINDS[p.kind].fearMul);
        if (p.role === 'civ') { p.adrenT = 2; p.freezeT = 0; p.safeT = 2.5; }
        this.emit('scratch', { id: p.id, by: z.id, x: p.x, z: p.z });
        this.hurt(p, D.hurt);
    }

    deadArrives(z) {
        if (this.boss) {
            const D = z.boss ? BOSSES[z.kind] : DEAD[z.kind];
            this.hope = Math.max(0, this.hope - D.haven);
            this.emit('breach', { id: z.id, x: z.x, z: z.z, boss: z.boss, hope: D.haven, blight: z.blight, blightMax: z.blightMax });
            z.state = 'gone';
        } else {
            z.state = 'fading';
            z.fade = 0.3;
            this.emit('turnAway', { id: z.id, x: z.x, z: z.z });
        }
    }

    bossAct(z, B, dt) {
        const frac = z.blight / z.blightMax;
        if (B.phases && z.phaseN < B.phases.length && frac < B.phases[z.phaseN]) {
            z.phaseN++;
            z.speed = B.speed * (1 + 0.25 * z.phaseN);
            this.emit('bossPhase', { id: z.id, phase: z.phaseN, x: z.x, z: z.z });
        }
        z.callT -= dt;
        if (z.callT <= 0) {
            z.callT = B.call.every * (1 - 0.2 * z.phaseN);
            for (let i = 0; i < B.call.n; i++) this.spawnDead(B.call.kind, z.route, this.rng.range(-0.2, 0.2), Math.max(0, z.d - 0.6 - i * 0.4));
            if (B.call.also) this.spawnDead(B.call.also, z.route, this.rng.range(-0.2, 0.2), Math.max(0, z.d - 1.4));
            this.emit('bossCall', { id: z.id, x: z.x, z: z.z });
        }
        const vols = (r) => this.people.filter((p) => p.role === 'vol' && p.state === 'stand' && d2(p, z) <= r * r);
        if (B.slam) {
            z.slamT -= dt;
            if (z.slamT <= 0) {
                const hit = vols(B.slam.range);
                z.slamT = hit.length ? B.slam.every : 0.5;
                if (hit.length) {
                    z.pauseT = 0.8;
                    for (const p of hit) this.scratch(p, { hurt: B.slam.hurt, wound: B.slam.wound, sick: 0, fear: B.slam.fear }, z);
                    this.emit('slam', { id: z.id, x: z.x, z: z.z, r: B.slam.range });
                }
            }
        }
        if (B.wail && z.specialT <= 0) {
            const hit = vols(B.wail.range);
            z.specialT = hit.length ? B.wail.every : 0.8;
            if (hit.length) {
                for (const p of hit) {
                    if (this.ail.has('fear') && p.rally <= 0) p.fear = Math.min(100, p.fear + B.wail.fear);
                    if (this.ail.has('cold')) p.cold = Math.min(100, p.cold + B.wail.cold);
                    this.hurt(p, B.wail.hurt);
                }
                this.emit('wail', { id: z.id, x: z.x, z: z.z, r: B.wail.range });
            }
        }
        if (B.glob && z.specialT <= 0) {
            const hit = vols(B.glob.range);
            z.specialT = hit.length ? B.glob.every * (1 - 0.15 * z.phaseN) : 0.6;
            if (hit.length) {
                const t = this.rng.pick(hit);
                this.shots.push({ kind: 'glob', x: z.x, z: z.z, tx: t.x, tz: t.z, target: 0, t: 0, dur: 1.0, from: z.id, sick: B.glob.sick, hurt: B.glob.hurt, splash: B.glob.splash, h: 1.8 });
                this.emit('glob', { id: z.id, x: z.x, z: z.z });
            }
        }
    }

    /** Cure some blight from one of the dead. */
    cureDead(z, amt, by) {
        if (z.state !== 'walk' || amt <= 0) return;
        z.blight -= amt;
        z.hitT = 0.25;
        if (z.blight > 0) return;
        if (z.boss) { this.cureBoss(z); return; }
        this.restore(z, by);
    }
    restore(z, by) {
        z.state = 'cured';
        this.stats.cured++;
        this.supplies += 4;
        const p = this.makePerson({ kind: 'adult', route: z.route, lane: z.lane });
        p.restored = true;
        p.d = Math.min(z.d, this.routes[z.route].length - 0.1);
        p.immuneT = 999;
        this.place(p);
        this.people.push(p);
        this.emit('cured', { id: z.id, pid: p.id, x: z.x, z: z.z, by: by ? by.id : 0, kind: z.kind });
        this.say(p, 'cured');
    }
    cureBoss(z) {
        this.bossCured = true;
        this.emit('bossCured', { id: z.id, kind: z.kind, x: z.x, z: z.z, who: BOSSES[z.kind].cured });
        this.restore(z, null);
        // The blight breaks: everything still walking is cured with it.
        for (const o of this.dead) if (o !== z && o.state === 'walk') this.restore(o, null);
        this.queue = this.queue.filter((q) => q.what === 'civ');
    }

    // ------------------------------------------------------------------ stations
    candidates(s, range, filter) {
        const r2 = range * range;
        const out = [];
        for (const p of this.people) if (alive(p) && d2(p, s) <= r2 && filter(p)) out.push(p);
        return out;
    }

    updateStation(s, dt) {
        const L = STATIONS[s.type].lv[s.lv];
        s.cool -= dt;
        switch (s.type) {
            case 'medic': {
                if (s.cool > 0) break;
                const c = this.candidates(s, L.range, (p) => p.state === 'down' || p.wound > 0 || p.hp < p.maxHp * 0.97);
                if (!c.length) { s.cool = 0.15; break; }
                c.sort((a, b) => need(b) - need(a));
                for (const p of c.slice(0, L.targets)) {
                    this.shots.push({ kind: 'bandage', x: s.x, z: s.z, tx: p.x, tz: p.z, target: p.id, t: 0, dur: 0.35, from: s.id, heal: L.heal, h: 0.6 });
                }
                s.aim = c[0].id;
                s.cool = L.every;
                break;
            }
            case 'remedy': {
                if (s.cool > 0) break;
                const c = this.candidates(s, L.range, (p) => p.sick >= 5 && p.state !== 'down');
                if (!c.length) { s.cool = 0.15; break; }
                c.sort((a, b) => b.sick - a.sick);
                const p = c[0];
                this.shots.push({ kind: 'vial', x: s.x, z: s.z, tx: p.x, tz: p.z, target: p.id, t: 0, dur: 0.55, from: s.id, cure: L.cure, splash: L.splash, immune: L.immune || 0, h: 1.0 });
                s.aim = p.id;
                s.cool = L.every;
                break;
            }
            case 'kitchen': {
                if (s.cool > 0) break;
                const c = this.candidates(s, L.range, (p) => p.state !== 'down' && (p.hunger || p.temp < Math.min(60, L.temp) - 4) && !p.restored);
                if (!c.length) { s.cool = 0.15; break; }
                c.sort((a, b) => (b.hunger - a.hunger) || (a.temp - b.temp) || (a.hp / a.maxHp - b.hp / b.maxHp));
                const p = c[0];
                this.shots.push({ kind: 'soup', x: s.x, z: s.z, tx: p.x, tz: p.z, target: p.id, t: 0, dur: 0.45, from: s.id, temp: L.temp, h: 0.8 });
                s.aim = p.id;
                s.cool = L.every;
                break;
            }
            case 'splint': {
                if (s.cool > 0) break;
                const c = this.candidates(s, L.range, (p) => p.fracture && p.state !== 'down');
                if (!c.length) { s.cool = 0.15; break; }
                c.sort((a, b) => this.progress(b) - this.progress(a));
                for (const p of c.slice(0, L.targets)) {
                    this.shots.push({ kind: 'splint', x: s.x, z: s.z, tx: p.x, tz: p.z, target: p.id, t: 0, dur: 0.3, from: s.id, boost: L.boost, h: 0.5 });
                }
                s.aim = c[0].id;
                s.cool = L.every;
                break;
            }
            case 'stretcher': {
                if (s.channel) {
                    const p = this.people.find((q) => q.id === s.channel.id);
                    if (!p || p.state !== 'down' || d2(p, s) > (L.range * 1.3) ** 2) { s.channel = null; s.cool = 0.2; break; }
                    s.channel.t += dt;
                    if (s.channel.t >= L.channel) {
                        this.revive(p, L.revive, 'stretcher');
                        if (p.role === 'civ') { p.d = Math.min(this.routes[p.route].length - 0.2, p.d + L.carry); this.place(p); p.carriedT = 0.5; }
                        s.treated++;
                        this.stats.treated++;
                        s.channel = null;
                        s.cool = L.every;
                    }
                    break;
                }
                if (s.cool <= 0) {
                    const c = this.candidates(s, L.range, (p) => p.state === 'down');
                    if (c.length) {
                        c.sort((a, b) => a.downT - b.downT);
                        s.channel = { id: c[0].id, t: 0 };
                        s.aim = c[0].id;
                        this.emit('stretcherOut', { id: s.id, target: c[0].id });
                    } else s.cool = 0.15;
                }
                if (L.hop) {
                    s.hopT -= dt;
                    if (s.hopT <= 0 && !s.channel) {
                        const c = this.candidates(s, L.range, (p) => p.role === 'civ' && p.state === 'walk' && (p.fracture || p.speed < 0.7) && p.carriedT <= 0);
                        if (c.length) {
                            c.sort((a, b) => a.speed - b.speed);
                            const p = c[0];
                            p.d = Math.min(this.routes[p.route].length - 0.2, p.d + 1);
                            p.carriedT = 0.5;
                            this.place(p);
                            this.treat(p, 'stretcher');
                            this.emit('carry', { id: p.id, x: p.x, z: p.z, sx: s.x, sz: s.z });
                            s.hopT = L.hop;
                        } else s.hopT = 0.5;
                    }
                }
                break;
            }
            case 'lantern': {
                if (!L.flare) break;
                s.flareT -= dt;
                if (s.flareT > 0) break;
                const r2 = L.range * L.range;
                const hit = this.dead.filter((z) => z.state === 'walk' && !z.boss && d2(z, s) <= r2);
                if (!hit.length) { s.flareT = 0.3; break; }
                for (const z of hit) z.stunT = Math.max(z.stunT, L.stun * (1 - (DEAD[z.kind].resist || 0)));
                s.flareT = L.flare;
                this.emit('flare', { id: s.id, x: s.x, z: s.z, r: L.range });
                break;
            }
            case 'bell': {
                s.ringT -= dt;
                if (s.ringT > 0) break;
                const r2 = L.range * L.range;
                const hit = this.dead.filter((z) => z.state === 'walk' && !z.boss && z.mode === 'road' && d2(z, s) <= r2);
                if (!hit.length) { s.ringT = 0.3; break; }
                for (const z of hit) {
                    z.mode = 'lured';
                    z.lureT = L.lure * (1 - (DEAD[z.kind].resist || 0));
                    z.lureX = s.x + this.rng.range(-0.3, 0.3);
                    z.lureZ = s.z + this.rng.range(-0.3, 0.3);
                }
                s.ringT = L.every;
                this.emit('ring', { id: s.id, x: s.x, z: s.z, r: L.range, n: hit.length });
                break;
            }
            default: break;
        }
    }

    // ------------------------------------------------------------------ volunteers acting
    volRate(v) {
        let r = 1 + v.rally;
        if (v.fear > 50) r *= 0.5;
        if (v.cold > 50) r *= 0.75;
        return r;
    }
    deadInRange(v, range) {
        const r2 = range * range;
        const out = [];
        for (const z of this.dead) if (z.state === 'walk' && d2(z, v) <= r2) out.push(z);
        return out;
    }
    volAct(v, dt) {
        const T = TRADES[v.trade];
        v.cool -= dt * this.volRate(v);
        if (T.mend) {
            v.mendT = (v.mendT ?? T.mend.every) - dt;
            if (v.mendT <= 0) {
                v.mendT = T.mend.every;
                const r2 = T.mend.range * T.mend.range;
                for (const p of this.people) if (p.role === 'vol' && p.state === 'stand' && d2(p, v) <= r2 && (p.hp < p.maxHp || p.wound)) {
                    p.hp = Math.min(p.maxHp, p.hp + T.mend.heal); p.wound = Math.max(0, p.wound - 1); this.treat(p, 'medic');
                    this.emit('mend', { id: p.id, by: v.id, x: p.x, z: p.z });
                }
            }
        }
        if (v.trade === 'storyteller') {
            const c = this.deadInRange(v, T.range);
            if (c.length) {
                c.sort((a, b) => d2(a, v) - d2(b, v));
                this.cureDead(c[0], T.aura * v.power * dt, v);
                v.aim = c[0].id;
            }
            return;
        }
        if (v.trade === 'musician' || v.cool > 0) return;
        const c = this.deadInRange(v, T.range);
        if (!c.length) { v.cool = 0.1; return; }
        // aim at the one closest to the Haven (bosses count as very close)
        c.sort((a, b) => (this.progress(b) + (b.boss ? 0.05 : 0)) - (this.progress(a) + (a.boss ? 0.05 : 0)));
        const t = c[0];
        v.aim = t.id;
        v.yaw = Math.atan2(t.x - v.x, t.z - v.z);
        v.cool = T.every;
        const amt = T.cure * v.power;
        if (v.trade === 'firefighter') {
            const ax = t.x - v.x, az = t.z - v.z, al = Math.hypot(ax, az) || 1;
            const cosMax = Math.cos(T.cone);
            for (const z of c) {
                const bx = z.x - v.x, bz = z.z - v.z, bl = Math.hypot(bx, bz) || 1;
                if ((ax * bx + az * bz) / (al * bl) < cosMax) continue;
                this.cureDead(z, amt, v);
                if (z.state === 'walk' && !z.boss && z.mode === 'road') { z.d = Math.max(0, z.d - T.push * (1 - (DEAD[z.kind].resist || 0))); this.placeDead(z); }
            }
            this.emit('spray', { id: v.id, x: v.x, z: v.z, tx: t.x, tz: t.z });
        } else if (v.trade === 'mechanic') {
            const ax = t.x - v.x, az = t.z - v.z, al = Math.hypot(ax, az) || 1;
            const ux = ax / al, uz = az / al;
            for (const z of c) {
                const bx = z.x - v.x, bz = z.z - v.z;
                const along = bx * ux + bz * uz;
                if (along < 0 || along > T.range) continue;
                const off = Math.abs(bx * uz - bz * ux);
                if (off > T.beam + (z.boss ? 0.6 : 0)) continue;
                this.cureDead(z, amt, v);
                if (!z.boss) z.stunT = Math.max(z.stunT, T.stun);
            }
            this.emit('beam', { id: v.id, x: v.x, z: v.z, tx: v.x + ux * T.range, tz: v.z + uz * T.range });
        } else {
            const kind = v.trade === 'gardener' ? 'bomb' : v.trade === 'nurse' ? 'dart' : 'toss';
            this.shots.push({ kind, x: v.x, z: v.z, tx: t.x, tz: t.z, target: t.id, dead: true, t: 0, dur: kind === 'bomb' ? 0.7 : 0.35, from: v.id, cure: amt, splash: T.splash || 0, h: kind === 'bomb' ? 1.2 : 0.5 });
        }
    }

    // ------------------------------------------------------------------ shots
    moveShots(dt) {
        for (const sh of this.shots) {
            sh.t += dt;
            // home on the target while in flight
            if (sh.target) {
                const tgt = sh.dead ? this.dead.find((z) => z.id === sh.target) : this.people.find((p) => p.id === sh.target);
                if (tgt) { sh.tx = tgt.x; sh.tz = tgt.z; }
            }
            if (sh.t >= sh.dur) { sh.done = true; this.land(sh); }
        }
        this.shots = this.shots.filter((s) => !s.done);
    }

    land(sh) {
        const at = { x: sh.tx, z: sh.tz };
        const person = sh.target && !sh.dead ? this.people.find((p) => p.id === sh.target) : null;
        switch (sh.kind) {
            case 'bandage': {
                if (!person || !alive(person)) return;
                const st = this.stations.find((s) => s.id === sh.from);
                const wasDown = person.state === 'down';
                const before = person.hp;
                person.hp = Math.min(person.maxHp, person.hp + sh.heal);
                if (wasDown) { if (person.hp >= person.maxHp * 0.25) this.revive(person, person.hp / person.maxHp, 'medic'); }
                const closed = person.wound > 0;
                person.wound = Math.max(0, person.wound - 1);
                this.treat(person, 'medic');
                if (st) st.treated++;
                this.emit('heal', { id: person.id, x: person.x, z: person.z, amt: person.hp - before, by: 'medic', closed });
                if (closed || this.rng.chance(0.15)) this.say(person, 'medic');
                break;
            }
            case 'vial': {
                const r2 = sh.splash * sh.splash;
                let n = 0;
                for (const p of this.people) {
                    if (!alive(p) || (p.x - at.x) ** 2 + (p.z - at.z) ** 2 > r2) continue;
                    if (p.sick <= 0 && !sh.immune) continue;
                    const was = p.sick;
                    p.sick = Math.max(0, p.sick - sh.cure);
                    if (sh.immune) p.immuneT = Math.max(p.immuneT, sh.immune);
                    if (was > 0) { this.treat(p, 'remedy'); n++; if (p.sick === 0) this.say(p, 'remedy'); }
                }
                const st = this.stations.find((s) => s.id === sh.from);
                if (st) st.treated += n;
                this.emit('splash', { x: at.x, z: at.z, r: sh.splash, by: 'remedy', n });
                break;
            }
            case 'soup': {
                if (!person || !alive(person) || person.state === 'down') return;
                const wasHungry = person.hunger;
                person.hunger = false;
                person.temp = Math.min(60, Math.max(person.temp, 0) + sh.temp);
                this.treat(person, 'kitchen');
                const st = this.stations.find((s) => s.id === sh.from);
                if (st) st.treated++;
                this.emit('fed', { id: person.id, x: person.x, z: person.z, hungry: wasHungry });
                if (wasHungry || this.rng.chance(0.2)) this.say(person, 'kitchen');
                break;
            }
            case 'splint': {
                if (!person || !alive(person) || !person.fracture) return;
                person.fracture = false;
                if (sh.boost) person.boostT = sh.boost;
                this.treat(person, 'splint');
                const st = this.stations.find((s) => s.id === sh.from);
                if (st) st.treated++;
                this.emit('splinted', { id: person.id, x: person.x, z: person.z });
                this.say(person, 'splint');
                break;
            }
            case 'spit': {
                if (!person || !alive(person) || person.state === 'down') return;
                if (Math.hypot(person.x - at.x, person.z - at.z) > 0.6) return;
                if (this.ail.has('sick') && person.immuneT <= 0 && !person.restored) person.sick = Math.min(100, person.sick + sh.sick);
                this.hurt(person, sh.hurt);
                this.emit('spitHit', { id: person.id, x: at.x, z: at.z });
                break;
            }
            case 'glob': {
                const r2 = sh.splash * sh.splash;
                for (const p of this.people) {
                    if (!alive(p) || p.state === 'down' || p.restored || (p.x - at.x) ** 2 + (p.z - at.z) ** 2 > r2) continue;
                    if (this.ail.has('sick') && p.immuneT <= 0) p.sick = Math.min(100, p.sick + sh.sick);
                    this.hurt(p, sh.hurt);
                }
                this.emit('globHit', { x: at.x, z: at.z, r: sh.splash });
                break;
            }
            default: {
                // volunteers' cure: dart, toss, bomb
                if (sh.splash) {
                    const r2 = sh.splash * sh.splash;
                    for (const z of this.dead) if (z.state === 'walk' && (z.x - at.x) ** 2 + (z.z - at.z) ** 2 <= r2 + (z.boss ? 1 : 0)) this.cureDead(z, sh.cure, this.people.find((p) => p.id === sh.from));
                    this.emit('bloom', { x: at.x, z: at.z, r: sh.splash });
                } else {
                    const z = this.dead.find((q) => q.id === sh.target);
                    if (z) this.cureDead(z, sh.cure, this.people.find((p) => p.id === sh.from));
                }
            }
        }
    }

    // ------------------------------------------------------------------ bookkeeping
    cleanup() {
        if (this.people.some((p) => p.state === 'saved' || p.state === 'lost')) this.people = this.people.filter((p) => p.state !== 'saved' && p.state !== 'lost');
        if (this.dead.some((z) => z.state === 'gone' || z.state === 'cured')) this.dead = this.dead.filter((z) => z.state !== 'gone' && z.state !== 'cured');
        if (this.bossEnt && this.bossEnt.state !== 'walk') this.bossEnt = null;
    }

    checkWave() {
        if (this.hope <= 0) {
            this.state = 'lost';
            this.emit('defeat', { wave: this.wave });
            return;
        }
        if (this.state !== 'wave' || this.queue.length) return;
        const walkers = this.people.some((p) => p.role === 'civ' && (p.state === 'walk' || p.state === 'down') && !p.restored);
        if (this.boss) {
            if (this.dead.some((z) => z.state === 'walk')) return;
            if (this.people.some((p) => p.role === 'civ' && p.state === 'walk')) return;   // the restored are still walking in
        } else {
            if (walkers) return;
            // The people are through; the dead still on the road drift back into the fog.
            let faded = false;
            for (const z of this.dead) if (z.state === 'walk') { z.state = 'fading'; z.fade = 0; faded = true; }
            if (faded) this.emit('fogTakes', {});
            if (this.people.some((p) => p.role === 'civ' && p.state === 'walk')) return;
        }
        const bonus = 15 + this.wave * 5;
        this.supplies += bonus;
        this.emit('waveEnd', { wave: this.wave, bonus });
        if (this.wave >= this.waveCount) {
            this.state = 'won';
            this.emit('victory', { stars: this.stars() });
        } else {
            this.state = 'build';
            this.autoT = this.level.hints && this.wave < 2 ? 0 : 25;
        }
    }

    stars() {
        if (this.boss) return this.hope >= this.hopeMax ? 3 : this.hope >= this.hopeMax * 0.6 ? 2 : 1;
        const n = this.stats.spawned;
        if (!n) return 1;
        const f = this.stats.saved / n;
        return f >= 1 ? 3 : f >= 0.9 ? 2 : 1;
    }

    /** Everything worth showing on the results screen and saving to progress. */
    summary() {
        return {
            level: this.levelN, state: this.state, stars: this.state === 'won' ? this.stars() : 0, wave: this.wave,
            stats: { ...this.stats }, hope: this.hope, hopeMax: this.hopeMax, saved: this.saved, lost: this.lostNames, roster: { ...this.roster },
        };
    }
}

// ------------------------------------------------------------------ helpers
function d2(a, b) { return (a.x - b.x) ** 2 + (a.z - b.z) ** 2; }
function alive(p) { return p.state === 'walk' || p.state === 'stand' || p.state === 'down'; }
function need(p) {
    if (p.state === 'down') return 100 + (20 - p.downT);
    return (1 - p.hp / p.maxHp) + p.wound * 0.35;
}
