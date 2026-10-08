/**
 * population.js — who is where: named NPCs on daily schedules, city guards, camps, roaming
 * wildlife and dragon attacks. Runs about once a second; actors join and leave world.actors.
 */
import { NPCS, NPC, ENCOUNTERS, WILDLIFE } from './actors.js';
import { createActor, createNamedNpc } from './actor.js';
import { initDragon } from './dragon.js';
import { LOC, LOCATIONS, regionAt } from './geography.js';

const ACTIVE_R = 260, DROP_R = 330;
const GUARDS = { brightwater: 8, hrimvik: 4, stonecleft: 5, mirefen: 5, pinebrook: 1, kelvik: 1 };

/** Where a named NPC wants to be at an hour: { kind: 'building'|'anchor'|'wander', id } */
export function scheduleFor(n, hour) {
    const sleep = hour < 6 || hour >= 22;
    const role = n.role;
    if (role === 'companion' && n.id === 'halvard') return { kind: 'wander', id: n.loc };
    const indoorRoles = ['warden', 'steward', 'wizard', 'sworn', 'innkeeper', 'merchant', 'alchemist', 'priest', 'guildmaster', 'elder', 'scholar', 'mercenary', 'companion'];
    if (sleep) return { kind: 'building', id: n.home || n.work };
    if (indoorRoles.includes(role)) {
        if (role === 'companion' && hour > 9 && hour < 12) return { kind: 'anchor', id: `${n.loc}:train`, fallback: n.home };
        return { kind: 'building', id: n.work || n.home };
    }
    if (hour < 8) return { kind: 'building', id: n.home };
    if (hour >= 19) return { kind: 'building', id: `${n.loc}:inn` };
    return { kind: 'anchor', id: n.work };
}

export class Population {
    constructor(world) {
        this.w = world;
        this.npcs = new Map();      // npcId → actor (persistent)
        this.npcCell = new Map();   // npcId → cell they are in
        this.guards = new Map();    // loc → [actors]
        this.camps = new Map();     // loc → { actors, clearedAt }
        this.wild = [];
        this.timer = 0;
        this.wildTimer = 3;
        this.dragonTimer = 30;      // game hours until the next dragon attack (once dragons return)
        this.anchors = new Map(world.settlements.anchors.map((a) => [a.id, a]));
        this.buildings = new Map(world.settlements.buildings.map((b) => [b.id, b]));
        this.state = {};            // npcId → { dead, gone, following }
    }

    npc(id) {
        let a = this.npcs.get(id);
        if (!a) {
            const n = NPC[id];
            a = createNamedNpc(id, this.w.rng);
            const L = LOC[n.loc];
            a.pos.x = L.x + (this.w.rng.next() - 0.5) * 6; a.pos.z = L.z + (this.w.rng.next() - 0.5) * 6;
            a.pos.y = this.w.terrain.heightAt(a.pos.x, a.pos.z);
            a.ai.home = { x: L.x, z: L.z };
            this.npcs.set(id, a);
            const st = this.state[id];
            if (st?.dead) { a.dead = true; a.hp = 0; }
        }
        return a;
    }

    /** Resolve a schedule entry to a cell and a spot. */
    place(n, sch) {
        if (!sch) return null;
        if (sch.kind === 'building' && this.buildings.get(sch.id)?.door) return { cell: sch.id, b: this.buildings.get(sch.id) };
        if (sch.kind === 'anchor' && this.anchors.has(sch.id)) { const an = this.anchors.get(sch.id); return { cell: 'ext', x: an.x, z: an.z, rot: an.rot }; }
        if (sch.fallback && this.buildings.get(sch.fallback)?.door) return { cell: sch.fallback, b: this.buildings.get(sch.fallback) };
        const L = LOC[n.loc];
        return { cell: 'ext', x: L.x + Math.sin(n.id.length * 7) * 10, z: L.z + Math.cos(n.id.length * 5) * 10, wander: true };
    }

    update(dt) {
        const w = this.w;
        this.timer -= dt;
        if (this.timer > 0) return;
        this.timer = 1;
        const p = w.player;
        const inExt = w.cellId === 'ext';
        const hour = w.time.hour;
        // ---- named NPCs
        for (const n of NPCS) {
            const st = this.state[n.id] || {};
            if (st.dead || st.gone || st.scripted) continue;
            const a = this.npcs.get(n.id);
            if (a?.follower || a?.ai?.kind === 'follower') continue;   // followers go where you go
            const pl = this.place(n, scheduleFor(n, hour));
            if (!pl) continue;
            const L = LOC[n.loc];
            const near = inExt ? Math.hypot(L.x - p.pos.x, L.z - p.pos.z) < ACTIVE_R : false;
            const active = a && w.actors.includes(a);
            if (inExt) {
                if (pl.cell === 'ext' && near) {
                    const actor = this.npc(n.id);
                    if (!active) { if (this.npcCell.get(n.id) !== 'ext') { actor.pos.x = pl.x; actor.pos.z = pl.z; actor.pos.y = w.terrain.heightAt(pl.x, pl.z); } w.addActor(actor); this.npcCell.set(n.id, 'ext'); }
                    actor.ai.dest = pl.wander ? null : { x: pl.x, z: pl.z, rot: pl.rot };
                    if (pl.wander) actor.ai.home = { x: pl.x, z: pl.z };
                } else if (active) {
                    // walk to the door, then go inside
                    const b = pl.b;
                    if (b && Math.hypot(b.door.x - a.pos.x, b.door.z - a.pos.z) > 1.5 && Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z) < 60 && !a.ai.target) a.ai.dest = { x: b.door.x, z: b.door.z, run: false };
                    else { w.removeActor(a); this.npcCell.set(n.id, pl.cell); }
                } else this.npcCell.set(n.id, pl.cell);
                if (active && !near) { w.removeActor(a); }
            } else {
                // inside a building: the NPCs whose schedule says here appear at the interior's spots
                if (pl.cell === w.cellId && !active) {
                    const actor = this.npc(n.id);
                    const spot = w.interiorSpot(n, actor);
                    if (spot) { actor.pos.x = spot.x; actor.pos.z = spot.z; actor.pos.y = w.space.ground(spot.x, spot.z, spot.y + 1); actor.yaw = spot.rot || 0; actor.ai.dest = { x: spot.x, z: spot.z, rot: spot.rot }; actor.ai.home = { x: spot.x, z: spot.z }; }
                    w.addActor(actor); this.npcCell.set(n.id, pl.cell);
                } else if (active && pl.cell !== w.cellId && !a.ai.target && Math.hypot(p.pos.x - a.pos.x, p.pos.z - a.pos.z) > 4) {
                    w.removeActor(a); this.npcCell.set(n.id, pl.cell);
                }
            }
        }
        if (!inExt) return;
        // ---- guards
        for (const [loc, count] of Object.entries(GUARDS)) {
            const L = LOC[loc];
            const near = Math.hypot(L.x - p.pos.x, L.z - p.pos.z) < ACTIVE_R;
            let list = this.guards.get(loc);
            if (near && !list) {
                list = [];
                const anchors = w.settlements.anchors.filter((a) => a.loc === loc && a.kind === 'guard');
                for (let i = 0; i < count; i++) {
                    const g = createActor('guard', { rng: w.rng, level: Math.max(10, p.level || 1) });
                    g.name = `${L.name} Guard`; g.homeLoc = loc;
                    const an = anchors[i % Math.max(1, anchors.length)] || { x: L.x, z: L.z, rot: 0 };
                    const ang = i * 2.4;
                    g.pos.x = an.x + Math.cos(ang) * (i < anchors.length ? 0 : 20); g.pos.z = an.z + Math.sin(ang) * (i < anchors.length ? 0 : 20);
                    g.pos.y = w.terrain.heightAt(g.pos.x, g.pos.z);
                    g.ai.home = { x: L.x, z: L.z };
                    if (i >= anchors.length) {
                        const r = (L.flat || 80) * 0.65;
                        g.ai.patrol = [0, 1, 2, 3, 4, 5].map((k) => { const a2 = ang + k * 1.05; return { x: L.x + Math.cos(a2) * r, z: L.z + Math.sin(a2) * r }; });
                    } else { g.ai.patrol = [{ x: an.x, z: an.z }]; g.ai.faceYaw = an.rot; }
                    list.push(g); w.addActor(g);
                }
                this.guards.set(loc, list);
            } else if (!near && list && Math.hypot(L.x - p.pos.x, L.z - p.pos.z) > DROP_R) {
                for (const g of list) w.removeActor(g);
                this.guards.delete(loc);
            }
        }
        // ---- camps and lairs
        for (const [loc, list] of Object.entries(ENCOUNTERS)) {
            const L = LOC[loc];
            const d = Math.hypot(L.x - p.pos.x, L.z - p.pos.z);
            let camp = this.camps.get(loc);
            if (d < 200 && (!camp || !camp.actors)) {
                if (camp?.clearedAt != null && w.time.total - camp.clearedAt < 72) continue;   // respawn after three days
                const actors = [];
                list.forEach(([tpl, n], k) => {
                    for (let i = 0; i < n; i++) {
                        const a = createActor(tpl, { rng: w.rng, level: p.level || 1 });
                        const ang = (k * 3 + i) * 1.7, r = 4 + (k + i) * 2.5;
                        a.pos.x = L.x + Math.cos(ang) * r; a.pos.z = L.z + Math.sin(ang) * r; a.pos.y = w.terrain.heightAt(a.pos.x, a.pos.z);
                        a.ai.home = { x: L.x, z: L.z };
                        a.campLoc = loc;
                        actors.push(a); w.addActor(a);
                    }
                });
                this.camps.set(loc, { actors, clearedAt: null });
            } else if (camp?.actors && d > DROP_R) {
                for (const a of camp.actors) w.removeActor(a);
                const alive = camp.actors.filter((a) => !a.dead).length;
                this.camps.set(loc, { actors: null, clearedAt: alive === 0 ? (camp.clearedAt ?? w.time.total) : null });
            } else if (camp?.actors && camp.clearedAt == null && camp.actors.length && camp.actors.every((a) => a.dead)) {
                camp.clearedAt = w.time.total;
                w.emit('cleared', { loc });
            }
        }
        // ---- roaming wildlife
        this.wild = this.wild.filter((a) => {
            if (Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) > DROP_R || (a.dead && Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) > 120)) { w.removeActor(a); return false; }
            return true;
        });
        this.wildTimer -= 1;
        if (this.wildTimer <= 0 && w.flags.prologueDone) {
            this.wildTimer = 14 + w.rng.next() * 18;
            const alive = this.wild.filter((a) => !a.dead).length;
            if (alive < 5) this.spawnWild();
        }
        // ---- dragons
        if (w.flags.dragonsReturn && !w.flags.noDragons) {
            this.dragonTimer -= 1 * 20 / 3600;   // one real second = 20 game seconds
            if (this.dragonTimer <= 0 && !w.actors.some((a) => a.rig === 'dragon' && !a.dead)) {
                this.dragonTimer = 26 + w.rng.next() * 30;
                this.spawnDragon();
            }
        }
    }

    spawnWild() {
        const w = this.w, p = w.player;
        for (let tries = 0; tries < 6; tries++) {
            const ang = w.rng.next() * Math.PI * 2, r = 130 + w.rng.next() * 60;
            const x = p.pos.x + Math.cos(ang) * r, z = p.pos.z + Math.sin(ang) * r;
            if (Math.abs(x) > 1450 || Math.abs(z) > 1450) continue;
            if (LOCATIONS.some((l) => Math.hypot(l.x - x, l.z - z) < (l.flat || 30) + 40)) continue;
            const y = w.terrain.heightAt(x, z);
            if (w.terrain.waterAt(x, z) > y || w.terrain.slopeAt(x, z) > 0.4) continue;
            const table = WILDLIFE[regionAt(x, z)] || WILDLIFE.plains;
            const lvl = p.level || 1;
            const ok = table.filter(([t]) => true);
            const tpl = w.rng.weighted(ok);
            const pack = ['wolf', 'icewolf', 'deer', 'elk', 'goat', 'giantrat', 'mudclaw', 'bandit', 'reaver', 'hearthguard'].includes(tpl) ? w.rng.int(1, 3) : 1;
            for (let i = 0; i < pack; i++) {
                const a = createActor(tpl, { rng: w.rng, level: lvl });
                a.pos.x = x + i * 2.2; a.pos.z = z + i * 1.4; a.pos.y = w.terrain.heightAt(a.pos.x, a.pos.z);
                a.ai.home = { x, z };
                w.addActor(a);
                this.wild.push(a);
            }
            return;
        }
    }

    spawnDragon(tpl = null, at = null) {
        const w = this.w, p = w.player;
        const lvl = p.level || 1;
        tpl = tpl || (lvl >= 28 ? 'elder_dragon' : lvl >= 20 ? 'frost_dragon' : lvl >= 13 ? 'blood_dragon' : 'dragon');
        const d = createActor(tpl, { rng: w.rng, level: lvl });
        const ang = w.rng.next() * Math.PI * 2;
        const from = at || { x: p.pos.x + Math.cos(ang) * 320, y: p.pos.y + 140, z: p.pos.z + Math.sin(ang) * 320 };
        initDragon(w, d, p, from);
        w.addActor(d);
        return d;
    }

    /** Going indoors: everyone outside leaves the world; camps and guards rebuild on the way out. */
    suspend() {
        for (const [loc, c] of this.camps) {
            if (!c.actors) continue;
            const alive = c.actors.filter((a) => !a.dead).length;
            this.camps.set(loc, { actors: null, clearedAt: alive === 0 ? (c.clearedAt ?? this.w.time.total) : c.clearedAt });
        }
        this.guards.clear();
        this.wild = [];
        for (const [id] of this.npcs) if (this.npcCell.get(id) === 'ext') this.npcCell.set(id, 'away');
    }

    /** Persist what matters about named NPCs. */
    save() {
        const out = { state: this.state, dragonTimer: this.dragonTimer, camps: {}, npcs: {} };
        for (const [loc, c] of this.camps) out.camps[loc] = { clearedAt: c.clearedAt };
        for (const [id, a] of this.npcs) out.npcs[id] = { dead: a.dead, gold: a.gold, inv: a.inv, follower: !!a.follower };
        return out;
    }
    load(d) {
        if (!d) return;
        this.state = d.state || {};
        this.dragonTimer = d.dragonTimer ?? 30;
        for (const [loc, c] of Object.entries(d.camps || {})) this.camps.set(loc, { actors: null, clearedAt: c.clearedAt });
        for (const [id, s] of Object.entries(d.npcs || {})) {
            const a = this.npc(id);
            a.dead = s.dead; if (s.dead) a.hp = 0;
            a.gold = s.gold; a.inv = s.inv || a.inv;
            a.equip.right = a.equip.left = null;
        }
    }
}
