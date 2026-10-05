// In-system flight simulation: the player ship, asteroid clusters, enemies, bolts, loot,
// points of interest, cruise, mining, scanning, scooping and docking.
// Pure: no three.js, no DOM, no Math.random (randomness comes from game.rng).

import { ENEMIES, ROCK_TYPES, CRUISE, ROCK_REGROW, PLANET_TYPES, ITEMS, RAW, GOODS, REFINED } from '../config.js';
import { clusterRocks } from './galaxy.js';
import { forwardOf, yawPitchTo, wrapAngle, clamp, vdist, vdist2, vlen, lerp } from './vec.js';
import { stepEnemy, leadPoint } from './ai.js';
import { questSpawns, questEvent } from './quests.js';
import { storySpawns } from './story.js';

const BOLT_SPEED = 950;
const CLUSTER_IN = 2700, CLUSTER_OUT = 3400;

export class World {
    constructor(game, mode = 'docked') {
        this.game = game;
        this.sys = game.system;
        this.t = 0;
        this.nextId = 1;
        this.enemies = [];
        this.bolts = [];
        this.loot = [];
        this.clusters = new Map();
        this.traffic = [];
        this.target = null;
        this.ctx = null;
        this.hold = { id: null, t: 0 };
        this.docked = false;
        this.dead = false;
        this.ambushT = mode === 'arrive' ? -45 : -20;
        this.spawned = new Set();     // POI ids whose encounter has been spawned this visit
        this.warp = null;             // { target, t, cost }
        this.msgT = {};               // toast rate limiting
        this.extra = [];              // quest + story POIs
        const st = game.stats();
        const sh = game.s.ship;
        this.player = {
            pos: { ...this.sys.arrival }, vel: { x: 0, y: 0, z: 0 },
            yaw: 0, pitch: 0, roll: 0, throttle: 0.35, speed: 0,
            shield: st.shield, shieldT: 9, energy: st.energyMax, heat: 0, overheated: false,
            fireCd: 0, side: 1, boosting: false, mining: null, mineAcc: 0, scooping: null,
            cruise: { state: 'off', t: 0, speed: 0 }, dead: false, hitT: 0,
        };
        const p = this.player;
        if (mode === 'arrive') {
            const a = yawPitchTo(p.pos, { x: 0, y: 0, z: 0 });
            p.yaw = a.yaw; p.pitch = 0;
            const f = forwardOf(p.yaw, 0);
            p.vel = { x: f.x * 260, y: 0, z: f.z * 260 };
            p.throttle = 0.5;
        }
        if (game.s.location.docked) this.dockAt(game.s.location.docked, true);
        if (sh.hp <= 0) sh.hp = st.hullMax;
        this.refreshExtras();
        this.initTraffic();
        this.updateClusters(true);
    }

    id() { return this.nextId++; }
    toast(text, kind = 'info', key = null, every = 3) {
        if (key) { if (this.t - (this.msgT[key] ?? -99) < every) return; this.msgT[key] = this.t; }
        this.game.emit('toast', { text, kind });
    }

    // ---------------------------------------------------------------- bodies
    refreshExtras() {
        this.extra = [...questSpawns(this.game, this.sys.id), ...storySpawns(this.game, this.sys.id)];
    }
    visiblePois() {
        const st = this.game.stats();
        return this.sys.pois.filter((p) => (!p.hidden || st.scanHidden) && !(this.game.s.poisDone[p.id] && p.kind !== 'lattice'));
    }
    // Everything you can target or fly to.
    navables() {
        return [...this.sys.stations, ...this.sys.planets, ...this.visiblePois(), ...this.extra, ...this.sys.belts.map((b) => ({ ...b, pos: this.beltNearest(b) }))];
    }
    beltNearest(b) {
        const p = this.player.pos;
        let best = b.clusters[0], bd = Infinity;
        for (const c of b.clusters) { const d = vdist2(c.pos, p); if (d < bd) { bd = d; best = c; } }
        return best.pos;
    }
    findNav(id) {
        if (!id) return null;
        if (typeof id === 'number') return this.enemies.find((e) => e.id === id) || null;
        const b = this.sys.belts.find((x) => x.id === id);
        if (b) return { ...b, pos: this.beltNearest(b), radius: 200 };
        return this.sys.stations.find((x) => x.id === id) || this.sys.planets.find((x) => x.id === id) ||
            this.sys.pois.find((x) => x.id === id) || this.extra.find((x) => x.id === id) || null;
    }
    bodyRadius(o) { return o.radius ?? (o.kind === 'hearth' || o.kind === 'hub' || o.kind === 'shipyard' || o.kind === 'embassy' || o.kind === 'outpost' || o.kind === 'refinery' ? 90 : 30); }

    // ---------------------------------------------------------------- clusters
    updateClusters(force = false) {
        const p = this.player.pos;
        const dep = this.game.s.depleted[this.sys.id] || (this.game.s.depleted[this.sys.id] = {});
        let changed = false;
        for (const b of this.sys.belts) {
            for (const c of b.clusters) {
                const key = `${b.id}:${c.idx}`;
                const d = vdist(c.pos, p);
                if (d < CLUSTER_IN && !this.clusters.has(key)) {
                    const rocks = clusterRocks(this.sys.id, b, c, this.sys.richness).filter((r) => {
                        const t = dep[r.id];
                        if (t == null) return true;
                        if (this.game.s.time - t > ROCK_REGROW) { delete dep[r.id]; return true; }
                        return false;
                    });
                    this.clusters.set(key, { key, belt: b, c, rocks, center: c.pos, r: c.spread + 60 });
                    changed = true;
                } else if (d > CLUSTER_OUT && this.clusters.has(key)) {
                    this.clusters.delete(key);
                    changed = true;
                }
            }
        }
        if (changed || force) this.game.emit('clusters', {});
    }
    *rocks() { for (const c of this.clusters.values()) yield* c.rocks; }
    rockById(id) { for (const c of this.clusters.values()) for (const r of c.rocks) if (r.id === id) return r; return null; }
    removeRock(r) {
        for (const c of this.clusters.values()) {
            const i = c.rocks.indexOf(r);
            if (i >= 0) { c.rocks.splice(i, 1); break; }
        }
        (this.game.s.depleted[this.sys.id] ||= {})[r.id] = this.game.s.time;
        this.game.emit('rockBreak', { pos: { ...r.pos }, radius: r.radius, rockType: r.type, id: r.id });
    }

    // ---------------------------------------------------------------- traffic
    initTraffic() {
        const dests = [...this.sys.stations, ...this.sys.planets.slice(0, 4)];
        if (dests.length < 2) return;
        const r = this.game.rng;
        this.sys.traffic.forEach((t, i) => {
            const from = dests[i % dests.length];
            const to = dests[(i + 1 + r.int(0, dests.length - 2)) % dests.length];
            const s = r.next();
            const pos = { x: lerp(from.pos.x, to.pos.x, s), y: lerp(from.pos.y, to.pos.y, s) + 80, z: lerp(from.pos.z, to.pos.z, s) };
            this.traffic.push({ id: this.id(), pos, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, bank: 0, to, speed: r.range(70, 140), species: t.species, seed: t.seed, cls: r.int(1, 4) });
        });
    }
    stepTraffic(dt) {
        const dests = [...this.sys.stations, ...this.sys.planets.slice(0, 4)];
        for (const n of this.traffic) {
            const tp = n.to.pos;
            const want = yawPitchTo(n.pos, { x: tp.x, y: tp.y + 80, z: tp.z });
            n.yaw = wrapAngle(n.yaw + clamp(wrapAngle(want.yaw - n.yaw), -0.6 * dt, 0.6 * dt));
            n.pitch += clamp(want.pitch - n.pitch, -0.5 * dt, 0.5 * dt);
            const d = vdist(n.pos, tp);
            const sp = d > 3000 ? n.speed * 6 : n.speed;
            const f = forwardOf(n.yaw, n.pitch);
            n.vel = { x: f.x * sp, y: f.y * sp, z: f.z * sp };
            n.pos.x += n.vel.x * dt; n.pos.y += n.vel.y * dt; n.pos.z += n.vel.z * dt;
            if (d < this.bodyRadius(n.to) * 1.6 + 120) n.to = dests[this.game.rng.int(0, dests.length - 1)];
        }
    }

    // ---------------------------------------------------------------- spawning
    spawnEnemy(type, pos, opts = {}) {
        const def = ENEMIES[type];
        const danger = this.sys.danger;
        const hpMul = (1 + danger * 0.3) * (opts.hpMul || 1);
        const e = {
            id: this.id(), type, def, name: opts.name || def.name, faction: def.faction,
            pos: { ...pos }, vel: { x: 0, y: 0, z: 0 }, yaw: this.game.rng.range(-3, 3), pitch: 0, bank: 0,
            hp: def.hp * hpMul, maxHp: def.hp * hpMul, shield: def.shield * hpMul, maxShield: def.shield * hpMul,
            dmg: def.dmg * (1 + danger * 0.22) * (opts.dmgMul || 1), fireCd: 1 + this.game.rng.range(0, 1.5),
            state: 'approach', t: 0, strafe: this.game.rng.sign(), tag: opts.tag || null, boss: !!opts.boss, drops: opts.drops || null,
            seed: opts.seed ?? this.game.rng.int(1, 1e9), hitT: 0,
        };
        e.yaw = yawPitchTo(e.pos, this.player.pos).yaw;
        this.enemies.push(e);
        return e;
    }
    spawnGroup(kind, center, opts = {}) {
        const r = this.game.rng;
        const d = this.sys.danger;
        const list = [];
        if (kind === 'swarm') {
            const n = opts.n || r.int(3, 4 + Math.floor(d / 2));
            for (let i = 0; i < n; i++) list.push('drone');
            if (d >= 3 || opts.heavy) list.push('lancer');
        } else if (kind === 'warden') {
            for (let i = 0; i < (opts.n || 3); i++) list.push('warden');
        } else {
            const n = opts.n || r.int(2, 2 + Math.min(2, d));
            for (let i = 0; i < n; i++) list.push(i === 0 && (d >= 2 || opts.heavy) ? 'gunship' : 'skiff');
        }
        return list.map((type, i) => {
            const a = (i / list.length) * Math.PI * 2;
            return this.spawnEnemy(type, { x: center.x + Math.cos(a) * 140, y: center.y + r.range(-60, 60), z: center.z + Math.sin(a) * 140 }, opts);
        });
    }
    ambushAt(dist = 1300, kind = null, opts = {}) {
        const p = this.player;
        const owner = this.sys.owner >= 0 ? this.game.galaxy.species[this.sys.owner] : null;
        kind ||= owner?.hostile ? 'swarm' : 'reaver';
        const f = forwardOf(p.yaw + this.game.rng.range(-1.2, 1.2), 0);
        const c = { x: p.pos.x + f.x * dist, y: p.pos.y + this.game.rng.range(-100, 100), z: p.pos.z + f.z * dist };
        const g = this.spawnGroup(kind, c, opts);
        this.game.emit('ambush', { kind, n: g.length, text: kind === 'swarm' ? 'Swarm contacts inbound!' : 'Reaver raiders inbound!' });
        return g;
    }
    spawnBolt(pos, dir, speed, dmg, owner, faction = null, size = 1) {
        const b = { id: this.id(), pos: { x: pos.x + dir.x * 12, y: pos.y + dir.y * 12, z: pos.z + dir.z * 12 }, vel: { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed }, dmg, owner, faction, life: 1.6, size, plasma: false };
        this.bolts.push(b);
        if (owner === 'enemy') this.game.emit('efire', { pos: { ...pos }, faction });
        return b;
    }
    dropLoot(pos, items, credits = 0, special = null) {
        const r = this.game.rng;
        this.loot.push({ id: this.id(), pos: { ...pos }, vel: { x: r.range(-20, 20), y: r.range(-20, 20), z: r.range(-20, 20) }, items, credits, special, life: 150, spin: r.range(-2, 2) });
    }

    // ---------------------------------------------------------------- docking
    dockAt(stationId, instant = false) {
        const st = this.sys.stations.find((s) => s.id === stationId);
        if (!st) return;
        this.docked = true;
        this.dockedId = stationId;
        const p = this.player;
        p.pos = { x: st.pos.x, y: st.pos.y - 30, z: st.pos.z + 40 };
        p.vel = { x: 0, y: 0, z: 0 };
        p.cruise.state = 'off';
        p.mining = null;
        if (!instant) {
            this.game.dock(stationId);
            this.game.emit('dock', { station: stationId });
        }
        p.shield = this.game.stats().shield;
    }
    undock() {
        const st = this.sys.stations.find((s) => s.id === this.dockedId);
        this.docked = false;
        this.game.undock();
        const p = this.player;
        if (st) {
            const out = yawPitchTo({ x: 0, y: 0, z: 0 }, st.pos); // face away from the star-ish
            p.yaw = out.yaw + 0.6;
            p.pitch = 0;
            const f = forwardOf(p.yaw, 0);
            p.pos = { x: st.pos.x + f.x * 150, y: st.pos.y, z: st.pos.z + f.z * 150 };
            p.vel = { x: f.x * 40, y: 0, z: f.z * 40 };
        }
        p.throttle = 0.35;
        this.game.emit('undock', {});
        this.updateClusters(true);
    }

    // ---------------------------------------------------------------- the step
    step(inp, dt) {
        this.t += dt;
        const G = this.game;
        G.tick(dt);
        if (this.docked) { this.stepEnemies(dt); this.stepTraffic(dt); return; }
        const p = this.player;
        const st = G.stats();
        if (p.dead) { this.stepEnemies(dt); this.stepBolts(dt); return; }

        // --- steering & throttle
        const cr = p.cruise;
        const turnMul = cr.state === 'on' ? 0.55 : 1;
        let steerX = inp.steerX || 0, steerY = inp.steerY || 0;
        const navT = this.findNav(this.target);
        let align = 1;
        if ((cr.state === 'on' || cr.state === 'charge') && navT && !inp.manual) {
            // Autopilot: steer at the target, around any star or planet in the way.
            const want = yawPitchTo(p.pos, this.avoid(p.pos, navT.pos, navT));
            steerX = clamp(-wrapAngle(want.yaw - p.yaw) * 3, -1, 1);
            steerY = clamp((want.pitch - p.pitch) * 3, -1, 1);
            align = Math.cos(Math.min(Math.PI, Math.abs(wrapAngle(want.yaw - p.yaw)) + Math.abs(want.pitch - p.pitch)));
        }
        p.yaw = wrapAngle(p.yaw - steerX * st.turn * turnMul * dt);
        p.pitch = clamp(p.pitch + steerY * st.turn * 0.85 * turnMul * dt, -1.15, 1.15);
        p.roll = lerp(p.roll, -steerX * 0.65, Math.min(1, dt * 4));
        if (inp.throttleSet != null) p.throttle = clamp(inp.throttleSet, 0, 1);
        if (inp.throttle) p.throttle = clamp(p.throttle + inp.throttle * 0.7 * dt, 0, 1);
        if (inp.stop) p.throttle = 0;

        // --- cruise
        if (inp.cruise) this.toggleCruise();
        if (cr.state === 'charge') {
            cr.t += dt;
            if (this.cruiseLocked()) { cr.state = 'off'; this.game.emit('cruise', { state: 'abort' }); }
            else if (cr.t >= CRUISE.charge) { cr.state = 'on'; cr.speed = Math.max(st.speed, vlen(p.vel)); this.game.emit('cruise', { state: 'on' }); }
        }
        const f = forwardOf(p.yaw, p.pitch);
        if (cr.state === 'on') {
            let maxV = CRUISE.max;
            if (navT) {
                const d = vdist(p.pos, navT.pos) - this.bodyRadius(navT) * (navT.kind === 'planet' ? 2.6 : 1) - 250;
                maxV = clamp(d * 0.9, 220, CRUISE.max);
                if (d < 40) { this.dropCruise('arrived'); }
            }
            // Gravity wells: don't cruise through planets or the star.
            for (const b of [...this.sys.planets, { pos: { x: 0, y: 0, z: 0 }, radius: this.sys.star.radius }]) {
                const dd = vdist(p.pos, b.pos);
                if (dd < b.radius * 1.9) { this.dropCruise('gravity'); break; }
                const ahead = { x: p.pos.x + f.x * cr.speed * 0.6, y: p.pos.y + f.y * cr.speed * 0.6, z: p.pos.z + f.z * cr.speed * 0.6 };
                if (vdist(ahead, b.pos) < b.radius * 1.5) maxV = Math.min(maxV, Math.max(220, (dd - b.radius * 1.9) * 0.8));
            }
            maxV *= clamp((align - 0.6) / 0.35, 0.08, 1);
            if (cr.state === 'on') {
                cr.speed = cr.speed < maxV ? Math.min(maxV, cr.speed + CRUISE.accel * dt) : Math.max(maxV, cr.speed - CRUISE.accel * 2.2 * dt);
                p.vel = { x: f.x * cr.speed, y: f.y * cr.speed, z: f.z * cr.speed };
                if (inp.throttle < 0 || inp.stop) this.dropCruise('manual');
                // Interdiction
                const danger = this.sys.danger + (this.sys.pirate ? 2 : 0);
                if (danger >= 1 && this.t > 20 && G.rng.chance(dt * 0.0035 * danger) && !this.sys.stations.some((s) => vdist(s.pos, p.pos) < 3000)) {
                    this.dropCruise('interdict');
                    this.game.emit('interdict', { text: 'INTERDICTED! Hostiles pulled you out of cruise.' });
                    this.ambushT = this.t - 60;
                    this.ambushAt(700);
                }
            }
        }
        if (cr.state !== 'on') {
            p.boosting = !!inp.boost && p.energy > 2 && p.throttle > 0;
            if (p.boosting) p.energy = Math.max(0, p.energy - 22 * dt);
            else p.energy = Math.min(st.energyMax, p.energy + 12 * dt);
            const target = p.throttle * st.speed * (p.boosting ? st.boostMul : 1);
            const tv = { x: f.x * target, y: f.y * target, z: f.z * target };
            const dv = { x: tv.x - p.vel.x, y: tv.y - p.vel.y, z: tv.z - p.vel.z };
            const dl = vlen(dv);
            const acc = st.accel * (p.boosting ? 2.2 : 1) * (dl > st.speed * 1.4 ? 3 : 1) * dt;
            if (dl > 0) { const k = Math.min(1, acc / dl); p.vel.x += dv.x * k; p.vel.y += dv.y * k; p.vel.z += dv.z * k; }
        }
        p.pos.x += p.vel.x * dt; p.pos.y += p.vel.y * dt; p.pos.z += p.vel.z * dt;
        p.speed = vlen(p.vel);
        G.s.stats.distance += p.speed * dt;

        // --- shields
        p.shieldT += dt;
        if (p.shieldT > 3 && p.shield < st.shield) p.shield = Math.min(st.shield, p.shield + st.regen * dt);
        p.hitT = Math.max(0, p.hitT - dt);

        // --- weapons
        p.fireCd -= dt;
        if (inp.fire && cr.state !== 'on' && p.fireCd <= 0) this.firePlayer(st, f);

        // --- mining
        this.stepMining(inp, st, f, dt);

        // --- interaction context (dock / scan / salvage …)
        this.stepContext(inp, st, dt);

        // --- scooping
        this.stepScoop(st, dt);

        // --- collisions
        this.collide(dt);

        // --- everything else
        this.stepEnemies(dt);
        this.stepBolts(dt);
        this.stepLoot(dt);
        this.stepTraffic(dt);
        this.stepEncounters(dt);
        if (inp.targetNext) this.cycleTarget(inp.targetNext);
        if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) this.updateClusters();
        if (this.target && typeof this.target === 'number' && !this.enemies.some((e) => e.id === this.target)) this.target = null;

        // --- warp charge
        if (this.warp) {
            this.warp.t += dt;
            if (this.warp.t >= 3.2) { this.game.emit('warpGo', { target: this.warp.target, cost: this.warp.cost, recall: this.warp.recall }); this.warp.done = true; }
        }
    }

    // Waypoint that skirts the first body blocking the straight line from `a` to `b`.
    avoid(a, b, targetObj) {
        let best = null, bt = Infinity;
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const L2 = dx * dx + dy * dy + dz * dz || 1;
        for (const body of [{ pos: { x: 0, y: 0, z: 0 }, radius: this.sys.star.radius }, ...this.sys.planets]) {
            if (body === targetObj) continue;
            const t = ((body.pos.x - a.x) * dx + (body.pos.y - a.y) * dy + (body.pos.z - a.z) * dz) / L2;
            if (t <= 0 || t >= 1) continue;
            const cx = a.x + dx * t - body.pos.x, cy = a.y + dy * t - body.pos.y, cz = a.z + dz * t - body.pos.z;
            const d = Math.hypot(cx, cy, cz);
            if (d < body.radius * 2.6 && t < bt) { bt = t; best = { body, cx, cy, cz, d }; }
        }
        if (!best) return b;
        const { body, d } = best;
        let { cx, cy, cz } = best;
        if (d < 1) { cx = -dz; cy = 0; cz = dx; }
        const k = (body.radius * 3.2) / (Math.hypot(cx, cy, cz) || 1);
        return { x: body.pos.x + cx * k, y: body.pos.y + cy * k, z: body.pos.z + cz * k };
    }

    cruiseLocked() {
        const p = this.player;
        if (this.sys.stations.some((s) => vdist(s.pos, p.pos) < CRUISE.massLock)) return 'Mass locked: too close to a station';
        if (this.enemies.some((e) => !e.gone && e.state !== 'flee' && vdist(e.pos, p.pos) < CRUISE.hostileLock)) return 'Hostiles nearby: cannot engage cruise';
        for (const b of this.sys.planets) if (vdist(b.pos, p.pos) < b.radius * 2) return 'Mass locked: planet too close';
        if (vdist({ x: 0, y: 0, z: 0 }, p.pos) < this.sys.star.radius * 2) return 'Mass locked: star too close';
        return null;
    }
    toggleCruise() {
        const cr = this.player.cruise;
        if (cr.state === 'on' || cr.state === 'charge') { this.dropCruise('manual'); return; }
        const why = this.cruiseLocked();
        if (why) { this.toast(why, 'warn', 'cruiselock', 1.5); this.game.emit('cruise', { state: 'denied' }); return; }
        cr.state = 'charge'; cr.t = 0;
        this.player.mining = null;
        this.game.emit('cruise', { state: 'charge' });
    }
    dropCruise(why) {
        const p = this.player, cr = p.cruise;
        if (cr.state === 'off') return;
        const wasOn = cr.state === 'on';
        cr.state = 'off';
        if (wasOn) {
            const st = this.game.stats();
            const f = forwardOf(p.yaw, p.pitch);
            p.vel = { x: f.x * st.speed * 0.8, y: f.y * st.speed * 0.8, z: f.z * st.speed * 0.8 };
            p.throttle = Math.max(p.throttle, 0.5);
        }
        this.game.emit('cruise', { state: 'off', why });
        if (why === 'gravity') this.toast('Cruise dropped: gravity well', 'warn', 'grav', 2);
    }

    firePlayer(st, f) {
        const p = this.player;
        p.fireCd = 1 / st.fireRate;
        // Aim assist: bend toward the lead point of the hostile closest to the nose.
        let dir = f;
        let best = null, bestDot = Math.cos(0.12);
        for (const e of this.enemies) {
            const d = vdist(e.pos, p.pos);
            if (d > 1100) continue;
            const lead = leadPoint(p.pos, e.pos, e.vel, BOLT_SPEED);
            const v = { x: lead.x - p.pos.x, y: lead.y - p.pos.y, z: lead.z - p.pos.z };
            const L = vlen(v) || 1;
            const dot = (v.x * f.x + v.y * f.y + v.z * f.z) / L;
            if (dot > bestDot) { bestDot = dot; best = { x: v.x / L, y: v.y / L, z: v.z / L }; }
        }
        if (best) dir = best;
        const right = { x: -Math.cos(p.yaw), y: 0, z: Math.sin(p.yaw) };
        const sc = st.scale * 5;
        const muzzles = st.twin ? [-1, 1] : [p.side = -p.side];
        for (const s of muzzles) {
            const o = { x: p.pos.x + right.x * s * sc + f.x * 6, y: p.pos.y + f.y * 6 - 1, z: p.pos.z + right.z * s * sc + f.z * 6 };
            const b = this.spawnBolt(o, dir, BOLT_SPEED, st.dmg, 'player', null, st.plasma ? 1.8 : 1);
            b.vel.x += p.vel.x; b.vel.y += p.vel.y; b.vel.z += p.vel.z;
            b.plasma = st.plasma;
        }
        this.game.emit('fire', { twin: st.twin, plasma: st.plasma });
    }

    stepMining(inp, st, f, dt) {
        const p = this.player;
        const G = this.game;
        if (!p.overheated) p.heat = Math.max(0, p.heat - (p.mining ? 0 : 16) * dt);
        else { p.heat = Math.max(0, p.heat - 22 * dt); if (p.heat <= 25) { p.overheated = false; } }
        if (!inp.mine || p.cruise.state === 'on' || p.overheated) { p.mining = null; return; }
        let r = p.mining ? this.rockById(p.mining) : null;
        const inRange = (rk) => vdist(rk.pos, p.pos) - rk.radius < st.mineRange;
        const aimOk = (rk, lim) => {
            const v = { x: rk.pos.x - p.pos.x, y: rk.pos.y - p.pos.y, z: rk.pos.z - p.pos.z };
            const L = vlen(v) || 1;
            return (v.x * f.x + v.y * f.y + v.z * f.z) / L > lim;
        };
        if (r && (!inRange(r) || !aimOk(r, 0.8))) r = null;
        if (!r) {
            let best = null, bs = -Infinity;
            const tgt = typeof this.target === 'string' ? this.target : null;
            for (const rk of this.rocks()) {
                if (!inRange(rk)) continue;
                const v = { x: rk.pos.x - p.pos.x, y: rk.pos.y - p.pos.y, z: rk.pos.z - p.pos.z };
                const L = vlen(v) || 1;
                const dot = (v.x * f.x + v.y * f.y + v.z * f.z) / L;
                if (dot < 0.9) continue;
                const score = dot * 3 - L / st.mineRange + (rk.id === tgt ? 5 : 0) - (rk.hard > st.mineHard ? 4 : 0);
                if (score > bs) { bs = score; best = rk; }
            }
            r = best;
        }
        if (!r) { p.mining = null; this.toast('No asteroid in mining range: aim at a rock and close in', 'warn', 'norock', 4); return; }
        p.mining = r.id;
        if (r.hard > st.mineHard) {
            this.toast(`Laser too weak for ${ROCK_TYPES[r.type].name} rock: needs Mining Laser Mk ${r.hard}`, 'warn', 'hard', 3);
            p.heat = Math.min(100, p.heat + 6 * dt);
            return;
        }
        if (G.cargoFree() <= 0) {
            this.toast('Cargo hold full: dock at Hearth to unload, or sell at a station', 'warn', 'full', 4);
            G.emit('cargoFull', {});
            p.mining = null;
            return;
        }
        p.heat = Math.min(100, p.heat + 9.5 * dt);
        if (p.heat >= 100) { p.overheated = true; G.emit('overheat', {}); this.toast('Mining laser overheated!', 'warn', 'heat', 2); }
        const amt = Math.min(r.ore, st.mineRate * dt);
        r.ore -= amt;
        p.mineAcc += amt;
        while (p.mineAcc >= 1) {
            p.mineAcc -= 1;
            const mix = ROCK_TYPES[r.type].mix;
            const res = G.rng.weighted(Object.keys(mix), (k) => mix[k]);
            if (G.addCargo(res, 1)) {
                G.s.stats.mined[res] = (G.s.stats.mined[res] || 0) + 1;
                G.s.stats.minedTotal++;
                G.emit('mine', { res, pos: { ...r.pos }, rock: r.id });
            }
        }
        if (r.ore <= 0.01) { this.removeRock(r); p.mining = null; }
    }

    // Find the best contextual interaction in range.
    stepContext(inp, st, dt) {
        const p = this.player;
        const G = this.game;
        let ctx = null;
        const consider = (c) => { if (!ctx || c.prio > ctx.prio || (c.prio === ctx.prio && c.d < ctx.d)) ctx = c; };
        for (const s of this.sys.stations) {
            const d = vdist(s.pos, p.pos);
            if (d < 340) consider({ kind: 'dock', id: s.id, name: s.name, d, prio: 3, hold: 0, ok: p.speed < 90, why: p.speed < 90 ? null : 'Slow down to dock' });
        }
        for (const pl of this.sys.planets) {
            const d = vdist(pl.pos, p.pos);
            const range = pl.radius * 3 + 400 + st.scanRange * 0.04;
            if (d < range) consider({ kind: 'scan', id: pl.id, name: pl.name, d, prio: 1, hold: 4 / st.scanSpeed, ok: true, rescan: !!G.s.scanned[pl.id] });
        }
        for (const o of [...this.visiblePois(), ...this.extra]) {
            const d = vdist(o.pos, p.pos);
            const R = o.kind === 'lattice' ? 900 : o.kind === 'anomaly' || o.kind === 'precursor' ? 450 : 260;
            if (d > R) continue;
            const holds = { derelict: 3, anomaly: 6, cache: 1.5, beacon: 2, wreck: 3, precursor: 6, lattice: 4, hoard: 0 };
            if (o.kind === 'bountyZone' || o.kind === 'nest' || o.kind === 'hoard') continue;
            let ok = true, why = null;
            if (o.kind === 'lattice') {
                if (!G.s.story.key) { ok = false; why = 'You need the Lattice Key'; }
                else if (this.enemies.some((e) => e.faction === 'warden')) { ok = false; why = 'The Wardens still guard the Lattice'; }
                else if (G.s.story.done) { ok = false; why = 'The Lattice is awake'; }
            }
            if (o.kind === 'precursor' && this.enemies.some((e) => e.tag === o.id)) { ok = false; why = 'Defeat the guardians first'; }
            consider({ kind: o.kind, id: o.id, name: o.name, d, prio: 2, hold: (holds[o.kind] ?? 2) / (o.kind === 'anomaly' || o.kind === 'precursor' ? st.scanSpeed : 1), ok, why, o });
        }
        if (this.warp) ctx = null;
        this.ctx = ctx;
        if (!ctx) { this.hold.t = Math.max(0, this.hold.t - dt * 2); return; }
        if (this.hold.id !== ctx.id) this.hold = { id: ctx.id, t: 0 };
        if (!ctx.ok) { if (inp.interactPressed && ctx.why) this.toast(ctx.why, 'warn', 'ctxwhy', 1); return; }
        if (ctx.hold === 0) {
            if (inp.interactPressed) this.interact(ctx);
            return;
        }
        if (inp.interact) {
            if (this.hold.t === 0) G.emit('scanStart', { kind: ctx.kind });
            this.hold.t += dt;
            if (this.hold.t >= ctx.hold) { this.hold.t = 0; this.interact(ctx); }
        } else this.hold.t = Math.max(0, this.hold.t - dt * 1.5);
        ctx.progress = Math.min(1, this.hold.t / ctx.hold);
    }

    interact(ctx) {
        const G = this.game, r = G.rng;
        const p = this.player;
        switch (ctx.kind) {
            case 'dock':
                this.dockAt(ctx.id);
                return;
            case 'scan': {
                const pl = this.sys.planets.find((x) => x.id === ctx.id);
                const first = !G.s.scanned[pl.id];
                let value = 0;
                if (first) {
                    G.s.scanned[pl.id] = true;
                    value = pl.scanValue + (pl.inhabited ? 8 : 0);
                    G.s.data += value;
                    G.s.stats.planetsScanned++;
                }
                G.s.stats.scans++;
                G.emit('scanDone', { id: pl.id, value, first, text: first ? `Survey of ${pl.name} (${PLANET_TYPES[pl.type].name}) complete  +${value} data` : `${pl.name} re-scanned (no new data)` });
                G.questEvent({ kind: 'scan', planet: pl.id, system: this.sys.id });
                return;
            }
            case 'derelict': {
                G.s.poisDone[ctx.id] = true;
                const items = {};
                const n = r.int(2, 4);
                for (let i = 0; i < n; i++) { const it = r.pick(r.chance(0.5) ? GOODS : r.chance(0.5) ? REFINED.slice(0, 6) : RAW.slice(0, 6)); items[it] = (items[it] || 0) + r.int(2, 8); }
                this.dropLoot(ctx.o.pos, items, r.int(60, 260) * (1 + this.sys.danger * 0.4));
                G.emit('scanDone', { id: ctx.id, text: `Salvaged ${ctx.name}`, value: 0 });
                if (ctx.o.trap) { this.toast('It was a trap! Raiders decloaking!', 'bad'); this.ambushAt(600, 'reaver'); }
                G.questEvent({ kind: 'poi', poi: ctx.id, system: this.sys.id });
                return;
            }
            case 'anomaly': {
                G.s.poisDone[ctx.id] = true;
                const data = r.int(20, 40) + this.sys.danger * 8;
                G.s.data += data;
                const ex = r.int(1, 3) + Math.floor(this.sys.danger / 2);
                const got = G.addCargo('exotic', ex);
                G.emit('scanDone', { id: ctx.id, value: data, text: `Anomaly studied: +${data} data${got ? `, +${got} Exotic Matter` : ''}` });
                G.questEvent({ kind: 'poi', poi: ctx.id, system: this.sys.id });
                return;
            }
            case 'cache': {
                G.s.poisDone[ctx.id] = true;
                const items = {};
                for (let i = 0; i < 3; i++) { const it = r.pick(['ferrite', 'silicate', 'ice', 'carbon', 'titanium', 'cuprite']); items[it] = (items[it] || 0) + r.int(5, 14); }
                if (r.chance(0.5)) items.fuelcell = r.int(1, 3);
                this.dropLoot(ctx.o.pos, items, r.int(20, 120));
                G.emit('scanDone', { id: ctx.id, text: 'Cache cracked open', value: 0 });
                return;
            }
            case 'beacon': {
                const here = G.galaxy.systems[this.sys.id];
                let n = 0;
                for (const s of G.galaxy.systems) if (Math.hypot(s.x - here.x, s.y - here.y) < 26 && !G.s.revealed.includes(s.id) && !G.s.visited.includes(s.id)) { G.s.revealed.push(s.id); n++; }
                G.s.poisDone[ctx.id] = true;
                G.s.data += 8;
                G.emit('scanDone', { id: ctx.id, text: n ? `Nav beacon decoded: ${n} nearby systems revealed on the map` : 'Nav beacon decoded: nothing new', value: 8 });
                return;
            }
            case 'wreck': {
                G.questEvent({ kind: 'salvage', quest: ctx.o.quest });
                this.refreshExtras();
                G.emit('scanDone', { id: ctx.id, text: 'Flight recorder recovered', value: 0 });
                return;
            }
            case 'precursor': {
                G.s.story.shards = Math.max(G.s.story.shards, ctx.o.shard + 1);
                G.emit('shard', { n: G.s.story.shards, text: `PRECURSOR SHARD RECOVERED (${G.s.story.shards}/3)` });
                G.s.data += 40;
                this.refreshExtras();
                return;
            }
            case 'lattice': {
                G.s.story.done = true;
                G.emit('ending', {});
                return;
            }
            default: return;
        }
    }

    stepScoop(st, dt) {
        const p = this.player;
        const G = this.game;
        const sh = G.s.ship;
        p.scooping = null;
        const sd = vlen(p.pos);
        const R = this.sys.star.radius;
        if (sd < R * 1.7 && this.sys.star.cls !== 'core') {
            if (st.scoopFuel && sh.fuel < st.fuelMax) {
                p.scoopAcc = (p.scoopAcc || 0) + dt * 0.3;
                p.scooping = 'fuel';
                if (p.scoopAcc >= 1) { p.scoopAcc -= 1; sh.fuel = Math.min(st.fuelMax, sh.fuel + 1); G.emit('scoop', { kind: 'fuel', text: `Fuel scooped: ${sh.fuel}/${st.fuelMax} Warp Cells` }); }
            }
            if (sd < R * 1.3) {
                this.damagePlayer(14 * dt * (R * 1.3 - sd) / (R * 0.3) + 2 * dt, true);
                this.toast('WARNING: hull temperature critical', 'bad', 'heatdmg', 2);
            } else if (!st.scoopFuel) this.toast('Star corona: fit a Scoop at Hearth to harvest fuel here', 'info', 'scoophint', 20);
        }
        if (st.scoopGas) {
            for (const pl of this.sys.planets) {
                if (!PLANET_TYPES[pl.type].giant) continue;
                const d = vdist(pl.pos, p.pos);
                if (d < pl.radius * 1.3 && d > pl.radius) {
                    if (p.speed > 80) { this.toast('Slow below 80 u/s to skim gas', 'info', 'gasslow', 3); continue; }
                    p.scooping = 'gas';
                    p.gasAcc = (p.gasAcc || 0) + dt * 0.8;
                    if (p.gasAcc >= 1) { p.gasAcc -= 1; if (G.addCargo('helium3', 1)) G.emit('mine', { res: 'helium3', pos: { ...p.pos }, gas: true }); else this.toast('Cargo hold full', 'warn', 'full', 4); }
                }
            }
        }
    }

    collide(dt) {
        const p = this.player;
        const st = this.game.stats();
        const pr = st.radius;
        const push = (c, R, hard) => {
            const dx = p.pos.x - c.x, dy = p.pos.y - c.y, dz = p.pos.z - c.z;
            const d = Math.hypot(dx, dy, dz) || 1;
            if (d >= R + pr) return false;
            const n = { x: dx / d, y: dy / d, z: dz / d };
            const vn = p.vel.x * n.x + p.vel.y * n.y + p.vel.z * n.z;
            if (vn < 0) {
                const impact = -vn;
                p.vel.x -= n.x * vn * 1.6; p.vel.y -= n.y * vn * 1.6; p.vel.z -= n.z * vn * 1.6;
                if (impact > 30) { this.damagePlayer((impact - 30) * (hard ? 0.5 : 0.25)); this.game.emit('bump', { pos: { ...p.pos }, impact }); }
                if (p.cruise.state === 'on') this.dropCruise('collision');
            }
            const over = R + pr - d;
            p.pos.x += n.x * over; p.pos.y += n.y * over; p.pos.z += n.z * over;
            return true;
        };
        push({ x: 0, y: 0, z: 0 }, this.sys.star.radius, true);
        for (const pl of this.sys.planets) push(pl.pos, pl.radius, true);
        for (const s of this.sys.stations) push(s.pos, 55, true);
        if (p.cruise.state === 'on') return; // cruise slips through rock fields
        for (const c of this.clusters.values()) {
            if (vdist(c.center, p.pos) > c.r + 60) continue;
            for (const r of c.rocks) push(r.pos, r.radius * (0.55 + 0.45 * r.ore / r.maxOre), false);
        }
    }

    damagePlayer(amount, bypassShield = false) {
        const p = this.player, G = this.game;
        if (p.dead || amount <= 0 || G.god) return;
        p.shieldT = 0;
        if (!bypassShield && p.shield > 0) {
            const a = Math.min(p.shield, amount);
            p.shield -= a; amount -= a;
            if (p.shield <= 0) G.emit('shieldDown', {});
        }
        if (amount > 0) {
            G.s.ship.hp -= amount;
            p.hitT = 0.4;
            if (G.s.ship.hp <= 0) {
                G.s.ship.hp = 0;
                p.dead = true;
                p.cruise.state = 'off';
                G.emit('explode', { pos: { ...p.pos }, size: 3, player: true });
                G.emit('death', {});
            }
        }
    }

    stepEnemies(dt) {
        for (const e of this.enemies) {
            stepEnemy(this, e, dt);
            e.hitT = Math.max(0, e.hitT - dt);
            if (e.maxShield > 0 && e.t > 0) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.04 * dt);
        }
        const before = this.enemies.length;
        this.enemies = this.enemies.filter((e) => !e.gone && !e.dead);
        if (before !== this.enemies.length) this.game.emit('enemies', {});
    }

    stepBolts(dt) {
        const p = this.player;
        const st = this.game.stats();
        for (const b of this.bolts) {
            b.life -= dt;
            const ox = b.pos.x, oy = b.pos.y, oz = b.pos.z;
            b.pos.x += b.vel.x * dt; b.pos.y += b.vel.y * dt; b.pos.z += b.vel.z * dt;
            const hitSeg = (c, R) => segSphere(ox, oy, oz, b.pos.x, b.pos.y, b.pos.z, c, R);
            if (b.owner === 'player') {
                for (const e of this.enemies) {
                    if (e.dead) continue;
                    if (hitSeg(e.pos, 9 * e.def.size + (b.plasma ? 6 : 0))) { this.hitEnemy(e, b.dmg, b.pos); b.life = 0; break; }
                }
            } else if (!p.dead && !this.docked && hitSeg(p.pos, st.radius + 2)) {
                this.damagePlayer(b.dmg);
                this.game.emit('hit', { pos: { ...b.pos }, shield: p.shield > 0, from: b.faction });
                b.life = 0;
            }
            if (b.life > 0) {
                for (const c of this.clusters.values()) {
                    if (vdist2(c.center, b.pos) > (c.r + 40) ** 2) continue;
                    for (const r of c.rocks) if (hitSeg(r.pos, r.radius * 0.8)) { b.life = 0; this.game.emit('spark', { pos: { ...b.pos } }); break; }
                    if (b.life <= 0) break;
                }
            }
        }
        this.bolts = this.bolts.filter((b) => b.life > 0);
    }

    hitEnemy(e, dmg, pos) {
        const G = this.game;
        e.hitT = 0.15;
        e.aggro = true;
        let d = dmg;
        if (e.shield > 0) { const a = Math.min(e.shield, d); e.shield -= a; d -= a; }
        e.hp -= d;
        G.emit('ehit', { pos: { ...pos }, shield: e.shield > 0, id: e.id });
        if (e.hp <= 0 && !e.dead) this.killEnemy(e);
    }

    killEnemy(e) {
        const G = this.game, r = G.rng;
        e.dead = true;
        G.emit('explode', { pos: { ...e.pos }, size: e.def.size, faction: e.faction, boss: e.boss });
        G.s.stats.kills++;
        const bounty = Math.round(e.def.bounty * (1 + this.sys.danger * 0.3) * (e.boss ? 1 : 0.5));
        G.s.credits += bounty;
        G.emit('toast', { text: `${e.name} destroyed  +${bounty} cr bounty`, kind: 'good' });
        if (this.sys.owner >= 0 && e.faction !== 'swarm') G.addStanding(this.sys.owner, 1.2);
        if (e.faction === 'swarm') for (const sp of G.galaxy.species) if (!sp.hostile && sp.temperament === 'martial') G.addStanding(sp.id, 0.6);
        // Loot
        const items = {};
        const n = r.int(1, e.def.cls + 1);
        for (let i = 0; i < n; i++) {
            const pool = e.faction === 'swarm' ? ['biogel', 'exotic', 'iridium', 'circuit'] : e.faction === 'warden' ? ['exotic', 'voidstone', 'lattice'] : ['ferrite', 'titanium', 'steel', 'circuit', 'arms', 'stims', 'fuelcell', 'medkits'];
            const it = r.pick(pool);
            items[it] = (items[it] || 0) + r.int(1, ITEMS[it].price > 80 ? 2 : 6);
        }
        this.dropLoot(e.pos, items, r.int(20, 60) * e.def.cls);
        if (e.drops === 'shard') this.dropLoot(e.pos, {}, 500, 'shard');
        G.questEvent({ kind: 'kill', enemy: e.type, enemyFaction: e.faction, system: this.sys.id, tag: e.tag });
        if (e.tag) this.refreshExtras();
    }

    stepLoot(dt) {
        const p = this.player, G = this.game;
        for (const l of this.loot) {
            l.life -= dt;
            const d = vdist(l.pos, p.pos);
            if (!p.dead && d < 90) {
                const k = Math.min(1, dt * 4);
                l.vel.x += ((p.pos.x - l.pos.x) / d * 160 - l.vel.x) * k;
                l.vel.y += ((p.pos.y - l.pos.y) / d * 160 - l.vel.y) * k;
                l.vel.z += ((p.pos.z - l.pos.z) / d * 160 - l.vel.z) * k;
            } else { l.vel.x *= 0.98; l.vel.y *= 0.98; l.vel.z *= 0.98; }
            l.pos.x += l.vel.x * dt; l.pos.y += l.vel.y * dt; l.pos.z += l.vel.z * dt;
            if (!p.dead && d < G.stats().radius + 10) {
                const got = {};
                let left = 0;
                for (const [id, n] of Object.entries(l.items)) {
                    const k = G.addCargo(id, n);
                    if (k) got[id] = k;
                    l.items[id] = n - k;
                    if (!l.items[id]) delete l.items[id]; else left += l.items[id];
                }
                if (l.credits) { G.s.credits += Math.round(l.credits); got.credits = Math.round(l.credits); l.credits = 0; }
                if (l.special === 'shard') {
                    G.s.story.shards = Math.max(G.s.story.shards, 2);
                    G.emit('shard', { n: G.s.story.shards, text: `PRECURSOR SHARD RECOVERED (${G.s.story.shards}/3)` });
                    l.special = null;
                    this.refreshExtras();
                }
                if (Object.keys(got).length) G.emit('pickup', { got, pos: { ...l.pos } });
                if (left > 0) { this.toast('Cargo hold full: some salvage left floating', 'warn', 'lootfull', 4); l.vel = { x: (l.pos.x - p.pos.x) * 0.5, y: 10, z: (l.pos.z - p.pos.z) * 0.5 }; l.pos.x += (l.pos.x - p.pos.x) * 0.5; l.pos.z += (l.pos.z - p.pos.z) * 0.5; }
                else l.life = 0;
            }
        }
        this.loot = this.loot.filter((l) => l.life > 0);
    }

    // Ambushes in belts, quest nests and bosses, story guardians.
    stepEncounters(dt) {
        const p = this.player, G = this.game;
        const sysDanger = this.sys.danger + (this.sys.pirate ? 1.5 : 0);
        // Random belt ambushes.
        this.ambushT += dt;
        if (this.ambushT > 25 && sysDanger >= 1 && this.enemies.length === 0) {
            this.ambushT = 0;
            const inBelt = [...this.clusters.values()].some((c) => vdist(c.center, p.pos) < c.r + 600);
            if (inBelt && G.rng.chance(0.05 * sysDanger)) this.ambushAt(1300);
        }
        // Raids near Hearth (home), rare, only when Hearth has a defence or is big.
        for (const o of this.extra) {
            if (this.spawned.has(o.id)) continue;
            const d = vdist(o.pos, p.pos);
            if (o.kind === 'nest' && d < 1900) {
                this.spawned.add(o.id);
                const g = this.spawnGroup(this.sys.owner >= 0 && G.galaxy.species[this.sys.owner].hostile ? 'swarm' : 'reaver', o.pos, { n: o.count, tag: o.quest });
                G.emit('ambush', { n: g.length, text: 'Raider nest: hostiles scrambling!' });
            } else if (o.kind === 'bountyZone' && d < 2100) {
                this.spawned.add(o.id);
                const boss = this.spawnEnemy('gunship', o.pos, { name: o.boss, tag: o.quest, boss: true, hpMul: 2.4, dmgMul: 1.2 });
                this.spawnGroup('reaver', { x: o.pos.x + 200, y: o.pos.y, z: o.pos.z }, { n: 2 });
                G.emit('ambush', { n: 3, text: `${o.boss} spotted!`, boss: true });
                this.target = boss.id;
            } else if (o.kind === 'wreck' && o.ambush && d < 1500) {
                this.spawned.add(o.id);
                this.ambushAt(900, 'reaver');
            } else if (o.kind === 'hoard' && d < 2600) {
                this.spawned.add(o.id);
                const w = this.spawnEnemy('warlord', o.pos, { name: G.plan.warlord, boss: true, drops: 'shard', tag: o.id });
                this.spawnGroup('reaver', { x: o.pos.x + 250, y: o.pos.y, z: o.pos.z }, { n: 3, heavy: true });
                G.emit('ambush', { n: 4, text: `${G.plan.warlord} is here. "That shard is mine, little Wright."`, boss: true });
                this.target = w.id;
            } else if (o.kind === 'precursor' && o.shard === 2 && d < 2400) {
                this.spawned.add(o.id);
                this.spawnGroup('swarm', o.pos, { n: 5, heavy: true, tag: o.id });
                G.emit('ambush', { n: 6, text: 'The Swarm guards the site!' });
            }
        }
        // The Lattice Wardens: two waves.
        const lat = this.sys.pois.find((x) => x.kind === 'lattice');
        if (lat && !G.s.story.done) {
            const d = vdist(lat.pos, p.pos);
            const wardens = this.enemies.filter((e) => e.faction === 'warden').length;
            if (d < 3200 && !this.spawned.has('W1')) {
                this.spawned.add('W1');
                this.spawnGroup('warden', lat.pos, { n: 3 });
                G.emit('ambush', { n: 3, text: 'LATTICE WARDENS AWAKEN', boss: true });
            } else if (this.spawned.has('W1') && !this.spawned.has('W2') && wardens === 0) {
                this.spawned.add('W2');
                this.spawnGroup('warden', lat.pos, { n: 4 });
                G.emit('ambush', { n: 4, text: 'The Lattice sends its last guardians', boss: true });
            }
        }
    }

    cycleTarget(dir = 1) {
        const p = this.player;
        const list = [...this.enemies, ...this.navables()].map((o) => ({ o, d: vdist(o.pos, p.pos) + (typeof o.id === 'number' ? -1e6 : 0) }));
        list.sort((a, b) => a.d - b.d);
        if (!list.length) return;
        const i = list.findIndex((x) => x.o.id === this.target);
        const n = list[(i + (dir > 0 ? 1 : list.length - 1) + list.length) % list.length];
        this.target = n.o.id;
        this.game.emit('target', { id: this.target });
    }
    setTarget(id) { this.target = id; this.game.emit('target', { id }); }

    startWarp(target, cost, recall = false) {
        if (this.warp || this.docked) return false;
        this.player.cruise.state = 'off';
        this.player.mining = null;
        this.warp = { target, cost, t: 0, recall };
        this.game.emit('warpCharge', { target });
        return true;
    }
}

function segSphere(ax, ay, az, bx, by, bz, c, R) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const fx = ax - c.x, fy = ay - c.y, fz = az - c.z;
    const L2 = dx * dx + dy * dy + dz * dz || 1e-9;
    let t = -(fx * dx + fy * dy + fz * dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = fx + dx * t, py = fy + dy * t, pz = fz + dz * t;
    return px * px + py * py + pz * pz < R * R;
}
