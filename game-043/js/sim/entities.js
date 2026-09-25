// ============================================================
// Runtime entities: roaming monsters, villagers on their daily
// routine, animals in their yards, the companion, Glim.
// Positions are in tile units (feet). Nothing here is saved.
// ============================================================

import { rngFor } from '../core/rng.js';
import { astar } from '../core/grid.js';
import { O, G } from '../data/tiles.js';
import { BUILDING } from '../data/buildings.js';
import { JOBS } from '../data/jobs.js';
import { ANIMALS } from './farm.js';

const MON_SPEED = 2.3, CHASE_SPEED = 3.1, NPC_SPEED = 2.2;

export const EntityMethods = {
    updateEntities(dt) {
        if (this.inWorld) { this.updateNpcs(dt); this.updateAnimals(dt); this.spawnMonsters(dt); }
        this.updateMonsters(dt);
        this.updateCompanion(dt);
    },

    // ------------------------------------------------------------ monsters
    monsterCap() {
        if (!this.inWorld) return 0;
        const rg = this.region;
        if (rg === 0 || rg === 255) return 0;
        let cap = 3 + (this.isNight ? 3 : 0) + (this.s.weather === 'storm' ? 2 : 0);
        if (this.isResident('guard') && rg <= 2) cap -= 2;
        return Math.max(1, cap);
    },
    spawnMonsters(dt) {
        const rt = this.rt;
        rt.spawnT -= dt;
        if (rt.spawnT > 0) return;
        rt.spawnT = 1.2;
        const p = this.p, w = this.world;
        // despawn far ones
        rt.monsters = rt.monsters.filter(m => Math.abs(m.x - p.x) < 26 && Math.abs(m.y - p.y) < 22);
        const rg = this.region;
        if (rt.monsters.length >= this.monsterCap()) return;
        const r = rngFor(this.s.seed, 'spawn', this.day, Math.floor(this.s.time.min), this.s.stats.steps, rt.monsters.length);
        for (let t = 0; t < 12; t++) {
            const a = r.range(0, Math.PI * 2), d = r.range(11, 17);
            const x = Math.floor(p.x + Math.cos(a) * d), y = Math.floor(p.y + Math.sin(a) * d);
            if (x < 1 || y < 1 || x >= w.W - 1 || y >= w.H - 1) continue;
            const i = y * w.W + x;
            if (w.region[i] !== rg || this.blockedTile(x, y) || w.road[i] === 2) continue;
            const pool = this.byRegion[rg].filter(id => !this.species[id].night || this.isNight);
            const sp = r.pick(pool);
            rt.monsters.push({ id: 'm' + (rt.nextId = (rt.nextId ?? 0) + 1), sp, x: x + 0.5, y: y + 0.9, dir: 0, t: r.range(0, 2), vx: 0, vy: 0, depth: 0, stun: 0, fade: 0, region: rg });
            return;
        }
    },
    updateMonsters(dt) {
        const rt = this.rt, p = this.p;
        const r = rngFor(this.s.seed, 'mwalk', Math.floor(rt.t * 4));
        for (const m of rt.monsters) {
            m.fade = Math.min(1, m.fade + dt * 2);
            if (m.stun > 0) { m.stun -= dt; continue; }
            m.t -= dt;
            const dx = p.x - m.x, dy = p.y - m.y, dist = Math.hypot(dx, dy);
            const sense = this.isNight ? 6 : 4.5;
            let vx = m.vx, vy = m.vy, sp = MON_SPEED;
            if (m.boss) { vx = 0; vy = 0; if (dist < 2.2 && !rt.battle && rt.cooldown <= 0) { this.engage(m, false); return; } m.dir = 0; continue; }
            if (dist < sense && !rt.battle) { vx = dx / dist; vy = dy / dist; sp = CHASE_SPEED; m.chasing = true; }
            else {
                m.chasing = false;
                if (m.t <= 0) { m.t = r.range(1, 3); const a = r.range(0, Math.PI * 2); const go = r.chance(0.6); vx = go ? Math.cos(a) : 0; vy = go ? Math.sin(a) : 0; }
            }
            m.vx = vx; m.vy = vy;
            const nx = m.x + vx * sp * dt, ny = m.y + vy * sp * dt;
            if (!this.monsterBlocked(nx, m.y, m)) m.x = nx; else m.vx = -m.vx;
            if (!this.monsterBlocked(m.x, ny, m)) m.y = ny; else m.vy = -m.vy;
            if (Math.abs(vx) > Math.abs(vy)) m.dir = vx < 0 ? 2 : 3; else if (vy) m.dir = vy < 0 ? 1 : 0;
            if (dist < 0.7 && !rt.battle && rt.cooldown <= 0 && m.fade >= 1) { this.engage(m, false); return; }
        }
    },
    monsterBlocked(x, y, m) {
        const tx = Math.floor(x), ty = Math.floor(y - 0.2);
        if (this.blockedTile(tx, ty)) return true;
        if (this.inWorld) { const rg = this.world.region[ty * this.world.W + tx]; if (rg !== m.region) return true; }
        return false;
    },
    monsterNear(x, y, rad) {
        let best = null, bd = rad;
        for (const m of this.rt.monsters) { if (m.stun > 0) continue; const d = Math.hypot(m.x - x, m.y - 0.3 - y); if (d < bd) { bd = d; best = m; } }
        return best;
    },
    engage(m, firstStrike) {
        const group = m.boss ? [m] : [m, ...this.rt.monsters.filter(o => o !== m && o.stun <= 0 && Math.hypot(o.x - m.x, o.y - m.y) < 3.2)].slice(0, 3);
        const depth = m.depth ?? 0;
        const inDungeon = !this.inWorld;
        const rg = inDungeon ? this.map.region : m.region;
        const specs = m.boss ? [{ sp: m.sp, depth: 0 }, { sp: this.byRegion[rg][0], depth: 1 }] : group.map(g => ({ sp: g.sp, depth: g.depth ?? depth }));
        const B = this.startBattle(specs, { firstStrike, boss: !!m.boss, region: rg, bg: inDungeon ? this.map.kind : this.world.regions[rg - 1]?.biome.id ?? 'forest', entity: m, site: inDungeon ? this.map.site : null });
        B.entities = group;
    },

    // ------------------------------------------------------------ villagers & friends
    homeDoor(job) {
        const v = this.s.villagers[job];
        const L = this.world.lots[v?.lot];
        if (!L) return null;
        return { x: L.x + 3.5, y: L.y + 4.9 };
    },
    npcSchedule(id) {
        const w = this.world, g = w.glen, m = this.s.time.min;
        const plaza = (k) => { const a = k * 1.7 + Math.floor(m / 90) * 0.9; return { x: w.cx + Math.cos(a) * 5.2, y: w.cy + Math.sin(a) * 5.2 + 0.4 }; };
        if (id === 'mayor' && !this.s.quests.flags.met_mayor) return { x: w.cx - 2.5, y: w.cy + 3.9 };
        if (id === 'mayor') return m < 21 * 60 ? { x: g.hall.x + 2.5 + (Math.floor(m / 120) % 2 ? 1.5 : -0.5), y: g.hall.y + 4.4 } : null;
        if (id === 'glim') return { x: w.cx + 0.5 + Math.cos(this.rt.t * 0.7) * 2.8, y: w.cy + 3.2 + Math.sin(this.rt.t * 0.9) * 0.5, float: true };
        if (id.startsWith('app_')) { const k = this.s.applicants.indexOf(id.slice(4)); return m < 21 * 60 ? plaza(k + 3) : null; }
        const v = this.s.villagers[id];
        if (!v?.joined || v.away) return null;
        const door = this.homeDoor(id);
        if (!door) return null;
        const k = Object.keys(this.s.villagers).indexOf(id);
        if (m < 7 * 60 || m >= 21 * 60) return null;
        if (m < 9 * 60) return door;
        if (m < 17 * 60) return (Math.floor(m / 60) + k) % 3 === 0 ? plaza(k) : { x: door.x + ((k % 2) ? 1 : -1), y: door.y + 0.4 };
        if (m < 20 * 60) return this.isResident('bard') && k % 2 ? this.homeDoor('bard') ?? plaza(k) : plaza(k + 1);
        return door;
    },
    updateNpcs(dt) {
        const npcs = this.rt.npcs;
        const ids = ['mayor', 'glim', ...this.residents(), ...this.s.applicants.map(j => 'app_' + j)];
        if (!this.s.quests.flags.met_mayor && !npcs.mayor) { /* the Mayor starts by the tree */ }
        for (const id of Object.keys(npcs)) if (!ids.includes(id)) delete npcs[id];
        for (const id of ids) {
            const goal = this.npcSchedule(id);
            let n = npcs[id];
            if (!goal) { if (n) n.hidden = true; continue; }
            if (!n) { n = npcs[id] = { id, x: goal.x, y: goal.y, dir: 0, path: null, hidden: false, walk: 0 }; }
            n.hidden = false;
            if (goal.float) { n.x = goal.x; n.y = goal.y; continue; }
            const d = Math.hypot(goal.x - n.x, goal.y - n.y);
            if (d > 20) { n.x = goal.x; n.y = goal.y; n.path = null; continue; }
            if (d < 0.3) { n.walk = 0; n.path = null; this.faceTowardPlayer(n); continue; }
            if (!n.path || n.goalKey !== `${goal.x | 0},${goal.y | 0}`) {
                n.goalKey = `${goal.x | 0},${goal.y | 0}`;
                const W = this.world.W;
                const path = astar(W, this.world.H, Math.floor(n.y - 0.2) * W + Math.floor(n.x), Math.floor(goal.y - 0.2) * W + Math.floor(goal.x), i => (this.world.region[i] !== 0 && this.world.region[i] !== 255) || this.blockedTile(i % W, (i / W) | 0) ? Infinity : 1, 4000);
                n.path = path ? path.slice(1).map(i => ({ x: i % W + 0.5, y: ((i / W) | 0) + 0.8 })) : [];
                if (!path) { n.x = goal.x; n.y = goal.y; }
            }
            const next = n.path[0] ?? goal;
            const dx = next.x - n.x, dy = next.y - n.y, dd = Math.hypot(dx, dy);
            if (dd < 0.08) { n.path.shift(); continue; }
            const step = Math.min(dd, NPC_SPEED * dt);
            n.x += dx / dd * step; n.y += dy / dd * step; n.walk += dt;
            n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
        }
    },
    faceTowardPlayer(n) {
        const dx = this.p.x - n.x, dy = this.p.y - n.y;
        if (Math.hypot(dx, dy) < 3) n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
    },
    npcNear(x, y, rad) {
        if (!this.inWorld) return null;
        let best = null, bd = rad;
        for (const n of Object.values(this.rt.npcs)) { if (n.hidden) continue; const d = Math.hypot(n.x - x, n.y - 0.35 - y); if (d < bd) { bd = d; best = n; } }
        return best;
    },

    // ------------------------------------------------------------ animals
    updateAnimals(dt) {
        const out = this.s.time.min >= 8 * 60 && this.s.time.min < 18 * 60 && this.s.weather !== 'rain' && this.s.weather !== 'storm' && this.s.weather !== 'snow' && this.season !== 3;
        const list = this.rt.animals;
        const want = out ? this.s.animals : [];
        this.rt.animals = want.map(a => list.find(x => x.id === a.id) ?? this.spawnAnimal(a)).filter(Boolean);
        const r = rngFor(this.s.seed, 'awalk', Math.floor(this.rt.t * 2));
        for (const a of this.rt.animals) {
            a.t -= dt;
            if (a.t <= 0) { a.t = r.range(1, 4); const go = r.chance(0.5); const ang = r.range(0, 6.28); a.vx = go ? Math.cos(ang) * 0.8 : 0; a.vy = go ? Math.sin(ang) * 0.8 : 0; }
            const nx = a.x + a.vx * dt, ny = a.y + a.vy * dt;
            if (Math.hypot(nx - a.hx, ny - a.hy) < 3.5 && !this.blockedTile(Math.floor(nx), Math.floor(ny - 0.2))) { a.x = nx; a.y = ny; }
            else { a.vx = -a.vx; a.vy = -a.vy; }
            if (a.vx) a.dir = a.vx < 0 ? 2 : 3;
        }
    },
    spawnAnimal(a) {
        const home = ANIMALS[a.kind].home;
        const lot = Object.entries(this.s.world.lots).find(([, l]) => l?.b === home);
        if (!lot) return null;
        const L = this.world.lots[+lot[0]];
        const k = this.s.animals.indexOf(a);
        return { id: a.id, kind: a.kind, x: L.x + 1 + (k % 4) * 1.2, y: L.y + 4.9 + Math.floor(k / 4) * 0.8, hx: L.x + 3, hy: L.y + 5.2, vx: 0, vy: 0, t: 0, dir: 3 };
    },
    animalNear(x, y, rad) {
        let best = null, bd = rad;
        for (const a of this.rt.animals) { const d = Math.hypot(a.x - x, a.y - 0.3 - y); if (d < bd) { bd = d; best = a; } }
        return best;
    },

    // ------------------------------------------------------------ companion
    updateCompanion(dt) {
        const job = this.p.companion;
        if (!job) { this.rt.companion = null; return; }
        let c = this.rt.companion;
        if (!c || c.job !== job || c.map !== this.map) c = this.rt.companion = { job, x: this.p.x - 0.8, y: this.p.y, dir: 0, walk: 0, trail: [], map: this.map };
        c.trail.push({ x: this.p.x, y: this.p.y, dir: this.p.dir });
        if (c.trail.length > 18) c.trail.shift();
        const tgt = c.trail[0];
        const d = Math.hypot(this.p.x - c.x, this.p.y - c.y);
        if (d > 1.1 && tgt) { c.x += (tgt.x - c.x) * Math.min(1, dt * 6); c.y += (tgt.y - c.y) * Math.min(1, dt * 6); c.dir = tgt.dir; c.walk += dt; }
        else c.walk = 0;
        if (d > 8) { c.x = this.p.x; c.y = this.p.y; }
    },
};

export { BUILDING, JOBS, O, G };
