// The runtime world of one floor: actors (hero, monsters, townsfolk), projectiles, ground
// effects, objects and loot on the floor. Pure simulation: no three.js, no DOM, no Math.random.
// Everything the view, audio and HUD need to know is pushed onto `this.events`.
//
// Coordinates: x → east, y → south, one unit per tile. Angles are atan2(dy, dx).

import { T, walkable, DIRS8 } from './tiles.js';
import { findPath, flowField, los, clearLine } from './path.js';
import { computeFov } from './fov.js';
import { MONSTERS, ELITE_MODS, hpScale, dmgScale, xpScale, uniqueName } from './data/monsters.js';
import { SKILLS, CLASSES } from './data/classes.js';
import { SHRINES, floorLevel, NPCS } from './data/story.js';
import { POTIONS } from './data/items.js';
import { computeStats, gainXp, addToInv, addPotion } from './hero.js';
import { rollDrops, rollContainer } from './items.js';
import { updateMonster } from './ai.js';
import { startSkill, updateHeroAction, tickAreas, SKILL_RANGE } from './skills.js';
import { FOV_RADIUS, SLEEP_RADIUS, DIFFICULTIES } from '../config.js';

const OBJ_DEFS = {
    crate:   { r: 0.36, solid: true, breakable: true },
    jar:     { r: 0.28, solid: true, breakable: true },
    barrel:  { r: 0.34, solid: true, breakable: true },
    keg:     { r: 0.34, solid: true, breakable: true, explode: true },
    chest:   { r: 0.4, solid: true, click: true },
    bigchest:{ r: 0.5, solid: true, click: true },
    shrine:  { r: 0.45, solid: true, click: true },
    up:      { r: 0.6, solid: false, click: true },
    down:    { r: 0.6, solid: false, click: true },
    cellar:  { r: 0.8, solid: false, click: true },
    well:    { r: 0.85, solid: true, click: true },
    stash:   { r: 0.5, solid: true, click: true },
    portal:  { r: 0.55, solid: false, click: true },
    lectern: { r: 0.4, solid: true, click: true },
    anvil:   { r: 0.45, solid: true, click: true },
};
export const OBJ_NAMES = {
    crate: 'Fruit Crate', jar: 'Jam Jar', barrel: 'Cider Barrel', keg: 'Soda Keg', chest: 'Picnic Basket', bigchest: 'Grand Hamper',
    shrine: 'Smoothie Shrine', up: 'Stairs Up', down: 'Stairs Down', cellar: 'Cellar Door', well: 'Wishing Well', stash: 'Stash',
    portal: 'Portal Pie', lectern: 'Lectern', anvil: 'The Anvil of Furry',
};

export class World {
    constructor(game, map) {
        this.game = game;
        this.map = map;
        this.floor = map.floor;
        this.town = map.floor === 0;
        this.rng = game.rng;
        this.time = 0;
        this.nextId = 1;
        this.events = [];
        this.mons = [];
        this.npcs = [];
        this.projs = [];
        this.areas = [];
        this.items = [];
        this.objs = [];
        this.vis = new Uint8Array(map.w * map.h);
        this.seen = map.seen || (map.seen = new Uint8Array(map.w * map.h));
        this.field = new Float32Array(map.w * map.h);
        this.fieldKey = -1;
        this.fovKey = -1;
        this.bossId = 0;
        this.lvl = this.town ? 1 : floorLevel(map.floor) + DIFFICULTIES[game.hero.difficulty].lvl;
        this.diff = DIFFICULTIES[game.hero.difficulty];

        for (const o of map.objs) this.addObj(o.type, o.x, o.y, o);
        if (this.town) for (const n of map.npcs) this.addNpc(n.id, n.x, n.y);
        for (const p of map.packs) this.spawnPack(p);
        this.hero = this.makeHero();
    }

    id() { return this.nextId++; }
    emit(type, data = {}) {
        this.evSeq = (this.evSeq || 0) + 1;
        this.events.push({ ...data, type });
        if (this.events.length > 800) this.events.splice(0, this.events.length - 800);
    }

    // ------------------------------------------------------------------ setup
    makeHero() {
        const g = this.game, h = g.hero;
        const st = computeStats(h);
        return {
            id: this.id(), kind: 'hero', x: this.map.start.x, y: this.map.start.y, r: 0.32, face: Math.PI / 2,
            hp: Math.min(st.maxHp, h.hp ?? st.maxHp), maxHp: st.maxHp, juice: Math.min(st.maxJuice, h.juice ?? st.maxJuice), maxJuice: st.maxJuice,
            st, act: null, intent: null, path: null, pathT: 0, dir: { x: 0, y: 0 }, moving: false,
            status: newStatus(), buffs: {}, cds: {}, potionCd: 0, heal: null, spin: null, dash: null, leap: null,
            dead: false, traps: [], hitFlash: 0, regenAcc: 0,
        };
    }

    refreshStats() {
        const h = this.hero;
        const st = computeStats(this.game.hero, this.buffMods());
        const hpFrac = h.hp / h.maxHp, jFrac = h.juice / h.maxJuice;
        h.st = st;
        h.maxHp = st.maxHp; h.maxJuice = st.maxJuice;
        h.hp = Math.min(h.maxHp, Math.max(1, hpFrac * h.maxHp));
        if (h.dead) h.hp = 0;
        h.juice = Math.min(h.maxJuice, jFrac * h.maxJuice);
    }

    buffMods() {
        const b = this.hero ? this.hero.buffs : {};
        const out = { dmg: 0, armor: 0, speed: 0 };
        for (const k in b) {
            if (b[k].dmg) out.dmg += b[k].dmg;
            if (b[k].armor) out.armor += b[k].armor;
            if (b[k].speed) out.speed += b[k].speed;
        }
        return out;
    }

    addObj(type, x, y, extra = {}) {
        const d = OBJ_DEFS[type] || { r: 0.4, solid: false };
        const o = { id: this.id(), type, x, y, r: d.r, solid: d.solid, state: 'idle', ...d, ...extra };
        o.x = x; o.y = y; o.type = type; o.kind = 'obj';
        this.objs.push(o);
        return o;
    }

    addNpc(id, x, y) {
        const n = { id: this.id(), kind: 'npc', npc: id, x, y, r: 0.4, face: Math.PI / 2, home: { x, y }, t: 0, wanderT: 2, tx: x, ty: y, name: NPCS[id].name };
        this.npcs.push(n);
        return n;
    }

    spawnPack(p) {
        const def = MONSTERS[p.type];
        if (!def) return;
        const packId = this.id();
        const mods = [];
        if (p.elite === 'champion' || p.elite === 'unique' || p.elite === 'quest') {
            const keys = Object.keys(ELITE_MODS);
            const n = p.elite === 'champion' ? 2 : 3;
            while (mods.length < n) { const k = this.rng.pick(keys); if (!mods.includes(k)) mods.push(k); }
        }
        const count = def.boss ? 1 : p.count;
        for (let i = 0; i < count; i++) {
            const spot = i === 0 ? { x: p.x, y: p.y } : this.freeSpotNear(p.x, p.y, 3.5, def.flying);
            if (!spot) continue;
            let elite = null, myMods = [];
            if (p.elite === 'champion') { elite = 'champion'; myMods = mods; }
            if ((p.elite === 'unique' || p.elite === 'quest') && i === 0) { elite = p.elite; myMods = mods; }
            if ((p.elite === 'unique' || p.elite === 'quest') && i > 0) myMods = [mods[0]];
            if (p.elite === 'boss') elite = 'boss';
            const type = p.elite === 'quest' && i > 0 ? p.minions || p.type : p.type;
            this.spawnMon(type, spot.x, spot.y, { elite, mods: myMods, packId });
        }
    }

    spawnMon(type, x, y, { elite = null, mods = [], packId = 0, lvlBonus = 0, minion = false } = {}) {
        const def = MONSTERS[type];
        const lvl = this.lvl + (elite === 'champion' ? 1 : elite === 'unique' || elite === 'quest' ? 2 : elite === 'boss' ? 2 : 0) + lvlBonus;
        let hpMul = hpScale(lvl) * this.diff.hp;
        if (elite === 'champion') hpMul *= 2.4;
        if (elite === 'unique' || elite === 'quest') hpMul *= 4;
        if (mods.includes('juicy')) hpMul *= 1 + ELITE_MODS.juicy.hp;
        const hp = Math.round(def.hp * hpMul);
        let name = def.name;
        if (elite === 'champion') name = `Champion ${def.name}`;
        if (elite === 'unique') name = uniqueName(this.rng);
        const m = {
            id: this.id(), kind: 'mon', type, def, name, lvl, elite, mods, packId, boss: !!def.boss,
            x, y, r: def.r * (elite === 'unique' || elite === 'quest' ? 1.2 : elite === 'champion' ? 1.08 : 1), face: this.rng.range(-3.14, 3.14),
            hp, maxHp: hp, dead: false, deadT: 0,
            speed: def.speed * (mods.includes('speedy') ? 1 + ELITE_MODS.speedy.speed : 1) * this.rng.range(0.92, 1.08),
            dmgMul: dmgScale(lvl) * this.diff.dmg * (elite ? 1.25 : 1),
            elem: mods.includes('spicy') ? 'fire' : mods.includes('frosty') ? 'cold' : def.elem,
            armor: def.armor || (def.boss ? 0.1 : 0),
            flying: !!def.flying,
            aggro: false, state: 'idle', st: 0, atkT: 0, cd: this.rng.range(0, 1), act: null, home: { x, y },
            status: newStatus(), hitFlash: 0, revived: false, minion,
            wander: { t: this.rng.range(1, 4), x, y },
            anim: 0, special: 0, phase: 0,
        };
        if (def.boss) { m.state = 'sleep'; this.bossId = m.id; }
        if (def.ai === 'mimic') m.state = 'disguised';
        if (def.ai === 'burrow') m.burrowed = true;
        if (def.ai === 'turret') m.speed = 0;
        this.mons.push(m);
        return m;
    }

    freeSpotNear(x, y, rad, flying = false) {
        for (let k = 0; k < 30; k++) {
            const a = this.rng.range(0, Math.PI * 2), d = this.rng.range(0.6, rad);
            const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
            const t = this.map.at(Math.floor(px), Math.floor(py));
            if (!(walkable(t) || (flying && t === T.PUNCH))) continue;
            if (!this.passable(px, py, 0.3, flying)) continue;
            if (this.mons.some((m) => !m.dead && (m.x - px) ** 2 + (m.y - py) ** 2 < 0.5)) continue;
            if (!clearLine(this.map, x, y, px, py)) continue;
            return { x: px, y: py };
        }
        return null;
    }

    // ------------------------------------------------------------------ queries
    tileAt(x, y) { return this.map.at(Math.floor(x), Math.floor(y)); }
    canStand(t, flying) { return walkable(t) || (flying && t === T.PUNCH); }
    passable(x, y, r, flying = false) {
        const x0 = Math.floor(x - r), x1 = Math.floor(x + r), y0 = Math.floor(y - r), y1 = Math.floor(y + r);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (!this.canStand(this.map.at(tx, ty), flying)) {
            const cx = Math.max(tx, Math.min(x, tx + 1)), cy = Math.max(ty, Math.min(y, ty + 1));
            if ((cx - x) ** 2 + (cy - y) ** 2 < r * r) return false;
        }
        return true;
    }
    monById(id) { return this.mons.find((m) => m.id === id); }
    objById(id) { return this.objs.find((o) => o.id === id); }
    npcById(id) { return this.npcs.find((n) => n.id === id); }
    itemById(id) { return this.items.find((i) => i.id === id); }
    entityById(id) { return this.monById(id) || this.objById(id) || this.npcById(id) || this.itemById(id) || (this.hero.id === id ? this.hero : null); }
    dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    canSee(a, b) { return los(this.map, a.x, a.y, b.x, b.y); }
    visibleTile(x, y) { return this.vis[Math.floor(y) * this.map.w + Math.floor(x)] === 1; }

    /** Monsters within r of (x, y), alive and targetable. */
    monsInRadius(x, y, r) {
        const out = [];
        for (const m of this.mons) if (!m.dead && !m.burrowed && m.state !== 'disguised' && m.state !== 'sleep' && (m.x - x) ** 2 + (m.y - y) ** 2 <= (r + m.r) ** 2) out.push(m);
        return out;
    }

    // ------------------------------------------------------------------ movement
    /** Move an actor by (dx, dy) with tile collision (circle vs tiles, axis-separated). */
    moveActor(a, dx, dy) {
        const fly = !!a.flying;
        const r = a.r * 0.9;
        // Wedged in a wall (should never happen, but never leave an actor stuck): pop out.
        if (!this.passable(a.x, a.y, r, fly)) { this.unstick(a, r, fly); return; }
        const nx = a.x + dx;
        if (this.passable(nx, a.y, r, fly)) a.x = nx;
        else if (Math.abs(dx) > 1e-4 && Math.abs(dy) < Math.abs(dx) * 0.3) {
            // Slide along a corner: nudge sideways toward the open side.
            const n = Math.abs(dx) * 0.6;
            if (this.passable(nx, a.y - 0.12, r, fly) && this.passable(a.x, a.y - n, r, fly)) a.y -= n;
            else if (this.passable(nx, a.y + 0.12, r, fly) && this.passable(a.x, a.y + n, r, fly)) a.y += n;
        }
        const ny = a.y + dy;
        if (this.passable(a.x, ny, r, fly)) a.y = ny;
        else if (Math.abs(dy) > 1e-4 && Math.abs(dx) < Math.abs(dy) * 0.3) {
            const n = Math.abs(dy) * 0.6;
            if (this.passable(a.x - 0.12, ny, r, fly) && this.passable(a.x - n, a.y, r, fly)) a.x -= n;
            else if (this.passable(a.x + 0.12, ny, r, fly) && this.passable(a.x + n, a.y, r, fly)) a.x += n;
        }
        // Solid objects.
        for (const o of this.objs) {
            if (!o.solid || o.state === 'broken') continue;
            const ddx = a.x - o.x, ddy = a.y - o.y, rr = a.r + o.r;
            const d2 = ddx * ddx + ddy * ddy;
            if (d2 < rr * rr && d2 > 1e-6) {
                const d = Math.sqrt(d2), push = rr - d;
                const px = a.x + (ddx / d) * push, py = a.y + (ddy / d) * push;
                if (this.passable(px, py, r, fly)) { a.x = px; a.y = py; }
            }
        }
    }

    unstick(a, r, fly) {
        for (let rad = 0.1; rad < 3; rad += 0.1) for (let k = 0; k < 16; k++) {
            const ang = (k / 16) * Math.PI * 2;
            const x = a.x + Math.cos(ang) * rad, y = a.y + Math.sin(ang) * rad;
            if (this.passable(x, y, r, fly)) { a.x = x; a.y = y; return; }
        }
    }

    speedMul(a) {
        let m = 1;
        if (a.status.slow > 0) m *= a.status.slowMul;
        if (a.status.chill > 0) m *= 0.65;
        if (!a.flying && this.tileAt(a.x, a.y) === T.JAM) m *= 0.5;
        return m;
    }

    /** Monsters chase along the flow field toward the hero, or straight at it when in the open. */
    steerToHero(m, dt, speed) {
        const h = this.hero;
        const d = this.dist(m, h);
        let tx = h.x, ty = h.y;
        const direct = d < 7 && clearLine(this.map, m.x, m.y, h.x, h.y, m.r * 0.8);
        if (!direct && !m.flying) {
            const mx = Math.floor(m.x), my = Math.floor(m.y), w = this.map.w;
            let best = this.field[my * w + mx], bx = mx, by = my;
            for (const [ox, oy] of DIRS8) {
                const ix = mx + ox, iy = my + oy;
                if (ix < 0 || iy < 0 || ix >= w || iy >= this.map.h) continue;
                const v = this.field[iy * w + ix];
                if (v < best && (!ox || !oy || (walkable(this.map.at(mx + ox, my)) && walkable(this.map.at(mx, my + oy))))) { best = v; bx = ix; by = iy; }
            }
            if (best === Infinity) return false;
            tx = bx + 0.5; ty = by + 0.5;
        }
        this.steer(m, tx, ty, speed, dt);
        return true;
    }

    steer(a, tx, ty, speed, dt) {
        const dx = tx - a.x, dy = ty - a.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.02) return;
        // Separation from packmates so they surround instead of stacking.
        let sx = 0, sy = 0;
        if (a.kind === 'mon') for (const o of this.mons) {
            if (o === a || o.dead || o.burrowed) continue;
            const ox = a.x - o.x, oy = a.y - o.y, rr = a.r + o.r;
            const d2 = ox * ox + oy * oy;
            if (d2 < rr * rr && d2 > 1e-6) { const dd = Math.sqrt(d2); sx += (ox / dd) * (rr - dd); sy += (oy / dd) * (rr - dd); }
        }
        const step = Math.min(d, speed * dt);
        this.moveActor(a, (dx / d) * step + sx * 0.5 * dt * 6, (dy / d) * step + sy * 0.5 * dt * 6);
        a.face = turnToward(a.face, Math.atan2(dy, dx), dt * 12);
        a.moving = true;
    }

    // ------------------------------------------------------------------ hero control (input layer)
    heroMoveTo(x, y) {
        const h = this.hero;
        if (h.dead) return;
        h.intent = { kind: 'move', x, y };
        this.repath(x, y);
    }
    heroDirect(dx, dy) { this.hero.dir.x = dx; this.hero.dir.y = dy; if (dx || dy) { this.hero.path = null; if (this.hero.intent && this.hero.intent.kind === 'move') this.hero.intent = null; } }
    heroAttack(monId, slot = 0) {
        const h = this.hero;
        if (h.dead) return;
        const skill = this.game.hero.bar[slot] || CLASSES[this.game.hero.cls].skills[0];
        h.intent = { kind: 'attack', id: monId, skill, slot };
    }
    heroSkill(slot, x, y, targetId = 0) {
        const h = this.hero;
        if (h.dead) return false;
        const id = this.game.hero.bar[slot];
        if (!id) return false;
        const sk = SKILLS[id];
        if (sk.kind === 'melee' || sk.kind === 'shot' || sk.kind === 'fan' || sk.kind === 'chain') {
            const tgt = targetId ? this.monById(targetId) : null;
            if (tgt && !tgt.dead) { h.intent = { kind: 'attack', id: tgt.id, skill: id, slot, once: slot !== 0 }; return true; }
        }
        if (h.act) { h.queued = { slot, x, y, targetId }; return true; }
        return this.tryStart(id, x, y, targetId);
    }
    tryStart(id, x, y, targetId) {
        const r = startSkill(this, this.hero, id, x, y, targetId);
        if (r === 'nojuice') this.emit('nojuice');
        if (r === 'cooldown') this.emit('cooldown', { skill: id });
        return r === true;
    }
    heroInteract(targetId) {
        const h = this.hero;
        if (h.dead) return;
        const t = this.entityById(targetId);
        if (!t) return;
        h.intent = { kind: t.kind === 'item' ? 'pickup' : 'interact', id: targetId };
        this.repath(t.x, t.y);
    }
    heroStop() { this.hero.intent = null; this.hero.path = null; }

    repath(x, y) {
        const h = this.hero;
        const p = findPath(this.map, Math.floor(h.x), Math.floor(h.y), Math.floor(x), Math.floor(y));
        h.path = p;
        if (p && p.length) {
            // Replace the final tile centre by the exact click point if it's reachable in a line.
            const last = p[p.length - 1];
            if (Math.floor(last[0]) === Math.floor(x) && Math.floor(last[1]) === Math.floor(y)) { last[0] = x; last[1] = y; }
        }
        h.pathT = 0.3;
    }

    followPath(a, dt, speed) {
        if (!a.path || !a.path.length) return false;
        const [tx, ty] = a.path[0];
        const d = Math.hypot(tx - a.x, ty - a.y);
        if (d < 0.12) { a.path.shift(); return a.path.length > 0; }
        const ox = a.x, oy = a.y;
        this.steer(a, tx, ty, speed, dt);
        if (Math.hypot(a.x - ox, a.y - oy) < speed * dt * 0.15) {
            a.stuck = (a.stuck || 0) + dt;
            if (a.stuck > 0.4) { a.stuck = 0; a.path.shift(); }
        } else a.stuck = 0;
        return true;
    }

    // ------------------------------------------------------------------ the tick
    update(dt) {
        this.time += dt;
        const h = this.hero;
        // Vision + flow field when the hero changes tile.
        const key = Math.floor(h.y) * this.map.w + Math.floor(h.x);
        if (key !== this.fovKey) {
            this.fovKey = key;
            computeFov(this.map, Math.floor(h.x), Math.floor(h.y), this.town ? 22 : FOV_RADIUS, this.vis);
            for (let i = 0; i < this.vis.length; i++) if (this.vis[i]) this.seen[i] = 1;
        }
        if (key !== this.fieldKey && !this.town) {
            this.fieldKey = key;
            flowField(this.map, Math.floor(h.x), Math.floor(h.y), 34, this.field);
        }

        this.updateHero(dt);
        for (const m of this.mons) {
            if (m.dead) { m.deadT += dt; continue; }
            if (m.hitFlash > 0) m.hitFlash -= dt;
            if ((m.x - h.x) ** 2 + (m.y - h.y) ** 2 > SLEEP_RADIUS * SLEEP_RADIUS && !m.boss) continue;
            tickStatus(this, m, dt);
            if (m.dead) continue;
            m.moving = false;
            if (m.status.stun > 0 || m.status.freeze > 0) { m.act = null; continue; }
            updateMonster(this, m, dt);
        }
        // Corpses linger for revives and splats, then go.
        if (this.mons.length > 40 && (this.time % 2) < dt) this.mons = this.mons.filter((m) => !m.dead || m.deadT < 14);
        for (const n of this.npcs) this.updateNpc(n, dt);
        this.updateProjs(dt);
        tickAreas(this, dt);
        this.updateItems(dt);
    }

    updateNpc(n, dt) {
        n.t += dt;
        n.wanderT -= dt;
        const h = this.hero;
        const near = this.dist(n, h) < 3;
        if (near) n.face = turnToward(n.face, Math.atan2(h.y - n.y, h.x - n.x), dt * 6);
        else if (n.wanderT <= 0) {
            n.wanderT = this.rng.range(3, 7);
            n.tx = n.home.x + this.rng.range(-1.2, 1.2); n.ty = n.home.y + this.rng.range(-0.8, 0.8);
        }
        n.moving = false;
        if (!near && Math.hypot(n.tx - n.x, n.ty - n.y) > 0.1) this.steer(n, n.tx, n.ty, 0.9, dt);
    }

    updateHero(dt) {
        const h = this.hero, g = this.game.hero;
        if (h.dead) return;
        if (!h.leap && !this.passable(h.x, h.y, h.r * 0.9)) this.unstick(h, h.r * 0.9);
        h.moving = false;
        if (h.hitFlash > 0) h.hitFlash -= dt;
        g.stats.time += dt;
        // Regen and timers.
        const st = h.st;
        h.hp = Math.min(h.maxHp, h.hp + st.hpRegen * dt * (this.town ? 8 : 1));
        h.juice = Math.min(h.maxJuice, h.juice + st.juiceRegen * dt * (this.town ? 4 : 1));
        if (h.heal) {
            const k = Math.min(h.heal.t, dt) / h.heal.dur;
            h.hp = Math.min(h.maxHp, h.hp + h.heal.hp * k);
            h.juice = Math.min(h.maxJuice, h.juice + h.heal.juice * k);
            h.heal.t -= dt;
            if (h.heal.t <= 0) h.heal = null;
        }
        if (h.potionCd > 0) h.potionCd -= dt;
        for (const k in h.cds) if (h.cds[k] > 0) h.cds[k] -= dt;
        let buffsChanged = false;
        for (const k in h.buffs) { h.buffs[k].t -= dt; if (h.buffs[k].t <= 0) { delete h.buffs[k]; buffsChanged = true; this.emit('buffEnd', { buff: k }); } }
        if (buffsChanged) this.refreshStats();
        tickStatus(this, h, dt);
        if (h.dead) return;
        if (h.status.stun > 0 || h.status.freeze > 0) { h.act = null; return; }

        // Actions in progress (swings, casts, leaps, dashes) own the hero until they end.
        if (updateHeroAction(this, h, dt)) return;
        if (h.queued) { const q = h.queued; h.queued = null; const id = g.bar[q.slot]; if (id && this.tryStart(id, q.x, q.y, q.targetId)) return; }

        const speed = st.moveSpeed * this.speedMul(h) * (h.spin ? 0.8 : 1);
        // Direct steering (WASD / stick) wins over everything except an action in progress.
        if (h.dir.x || h.dir.y) {
            const l = Math.hypot(h.dir.x, h.dir.y);
            const m = Math.min(1, l);
            this.moveActor(h, (h.dir.x / l) * speed * m * dt, (h.dir.y / l) * speed * m * dt);
            h.face = turnToward(h.face, Math.atan2(h.dir.y, h.dir.x), dt * 16);
            h.moving = true;
            if (h.intent && h.intent.kind !== 'attack') h.intent = null;
            this.autoPickup(h);
            if (!h.intent) return;
        }
        const it = h.intent;
        if (!it) { this.autoPickup(h); return; }
        h.pathT -= dt;
        if (it.kind === 'move') {
            if (!this.followPath(h, dt, speed)) h.intent = null;
        } else if (it.kind === 'attack') {
            const m = this.monById(it.id);
            if (!m || m.dead || m.burrowed || m.state === 'disguised') { h.intent = null; h.path = null; return; }
            const sk = SKILLS[it.skill];
            const range = SKILL_RANGE(sk) + m.r;
            const d = this.dist(h, m);
            const inReach = d <= range && (sk.kind === 'melee' ? clearLine(this.map, h.x, h.y, m.x, m.y) : this.canSee(h, m));
            if (inReach) {
                h.path = null;
                const ok = this.tryStart(it.skill, m.x, m.y, m.id);
                if (!ok && it.skill !== g.bar[0]) {
                    // Out of juice / on cooldown: fall back to the free basic attack.
                    this.tryStart(g.bar[0] || CLASSES[g.cls].skills[0], m.x, m.y, m.id);
                }
                if (it.once) h.intent = it.hold ? it : null;
            } else {
                if (h.pathT <= 0 || !h.path || !h.path.length) this.repath(m.x, m.y);
                if (!this.followPath(h, dt, speed)) this.steer(h, m.x, m.y, speed, dt);
            }
        } else if (it.kind === 'interact' || it.kind === 'pickup') {
            const t = this.entityById(it.id);
            if (!t) { h.intent = null; return; }
            const reach = (t.r || 0.3) + h.r + (it.kind === 'pickup' ? 0.7 : 0.75);
            if (this.dist(h, t) <= reach) {
                h.intent = null; h.path = null;
                h.face = Math.atan2(t.y - h.y, t.x - h.x);
                if (it.kind === 'pickup') this.pickup(t); else this.interact(t);
            } else {
                if (h.pathT <= 0 && (!h.path || !h.path.length)) this.repath(t.x, t.y);
                if (!this.followPath(h, dt, speed)) { this.steer(h, t.x, t.y, speed, dt); }
                it.t = (it.t || 0) + dt;
                if (it.t > 8) { h.intent = null; h.path = null; this.emit('toast', { text: "You can't reach that." }); }
            }
        }
        this.autoPickup(h);
    }

    // ------------------------------------------------------------------ objects & loot
    interact(o) {
        const g = this.game;
        if (o.kind === 'npc') { this.emit('npc', { npc: o.npc, id: o.id }); return; }
        if (o.kind !== 'obj') return;
        if (o.breakable) { this.breakObj(o); return; }
        switch (o.type) {
            case 'chest': case 'bigchest':
                if (o.state !== 'idle') return;
                o.state = 'open';
                this.emit('open', { id: o.id, x: o.x, y: o.y, big: o.type === 'bigchest' });
                this.spawnLoot(rollContainer(this.rng, o.type, this.lvl, g.hero, this.hero.st.magicFind + this.diff.mf), o.x, o.y);
                break;
            case 'shrine': {
                if (o.state !== 'idle') { this.emit('toast', { text: 'The shrine is dry. Somebody drank it all.' }); return; }
                o.state = 'used';
                const s = SHRINES[o.shrine];
                if (s.instant === 'full') { this.hero.hp = this.hero.maxHp; this.hero.juice = this.hero.maxJuice; }
                else this.hero.buffs['shrine_' + s.buff] = { t: s.dur, dur: s.dur, [s.buff]: s.v, name: s.name };
                this.refreshStats();
                this.emit('shrine', { id: o.id, x: o.x, y: o.y, text: s.msg, shrine: o.shrine });
                break;
            }
            case 'up': case 'down': case 'cellar':
                this.emit('stairs', { dir: o.type === 'down' || o.type === 'cellar' ? 1 : -1 });
                break;
            case 'well': this.emit('ui', { panel: 'waypoint' }); break;
            case 'stash': this.emit('ui', { panel: 'stash' }); break;
            case 'portal': this.emit('portal', { id: o.id }); break;
            case 'lectern':
                if (o.state !== 'idle') return;
                o.state = 'used';
                g.questEvent('recipe');
                this.emit('toast', { text: "You found Granny's Recipe Book! (Return to Granny Smith.)", kind: 'quest' });
                this.emit('open', { id: o.id, x: o.x, y: o.y });
                break;
            case 'anvil':
                if (o.state !== 'idle') return;
                o.state = 'used';
                g.questEvent('anvil');
                this.emit('toast', { text: 'You heave the fuzzy Anvil of Furry onto your back. (Return to Grapeswold.)', kind: 'quest' });
                this.emit('open', { id: o.id, x: o.x, y: o.y });
                break;
        }
    }

    breakObj(o) {
        if (o.state === 'broken') return;
        o.state = 'broken';
        this.emit('break', { id: o.id, x: o.x, y: o.y, obj: o.type });
        if (o.explode) {
            this.emit('explode', { x: o.x, y: o.y, r: 2.4, elem: 'fire', big: true });
            const dmg = (8 + this.lvl * 4.5);
            for (const m of this.monsInRadius(o.x, o.y, 2.4)) this.damageMon(m, dmg * 2, 'fire', { src: 'keg', knock: 1.5 });
            if (this.dist(this.hero, o) < 2.2) this.damageHero(dmg * 0.6, 'fire', null, { aoe: true });
            for (const p of this.objs) if (p !== o && p.breakable && p.state !== 'broken' && this.dist(p, o) < 2.4) this.later(0.15, () => this.breakObj(p));
        }
        this.spawnLoot(rollContainer(this.rng, o.type, this.lvl, this.game.hero, this.hero.st.magicFind + this.diff.mf), o.x, o.y);
    }

    later(t, fn) { this.areas.push({ id: this.id(), kind: 'later', t: 0, dur: t, fn }); }

    spawnLoot(drop, x, y) {
        const place = () => {
            for (let k = 0; k < 12; k++) {
                const a = this.rng.range(0, 6.283), d = this.rng.range(0.3, 1.3);
                const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
                if (!walkable(this.tileAt(px, py)) || !this.passable(px, py, 0.2)) continue;
                if (this.objs.some((o) => o.solid && o.state !== 'broken' && (o.x - px) ** 2 + (o.y - py) ** 2 < (o.r + 0.15) ** 2)) continue;
                if (!clearLine(this.map, x, y, px, py)) continue;
                return { x: px, y: py };
            }
            return { x, y };
        };
        for (const it of drop.items) {
            const p = place();
            const gi = { id: this.id(), kind: 'item', item: it, x: p.x, y: p.y, fromX: x, fromY: y, t: 0, r: 0.3 };
            this.items.push(gi);
            this.emit('drop', { id: gi.id, rarity: it.rarity, x: p.x, y: p.y });
        }
        if (drop.sugar) { const p = place(); this.items.push({ id: this.id(), kind: 'item', sugar: drop.sugar, x: p.x, y: p.y, fromX: x, fromY: y, t: 0, r: 0.25 }); }
        if (drop.potion) { const p = place(); this.items.push({ id: this.id(), kind: 'item', potion: drop.potion, x: p.x, y: p.y, fromX: x, fromY: y, t: 0, r: 0.25 }); }
        if (drop.quest) { const p = place(); this.items.push({ id: this.id(), kind: 'item', quest: drop.quest, x: p.x, y: p.y, fromX: x, fromY: y, t: 0, r: 0.3 }); }
    }

    updateItems(dt) { for (const it of this.items) it.t += dt; }

    /** Walking over loot picks it up: sugar and potions within reach, items you step on (unless you dropped them). */
    autoPickup(h) {
        const room = this.game.hero.inv.includes(null);
        for (const gi of [...this.items]) {
            if (gi.t < 0.45) continue;
            const d2 = (gi.x - h.x) ** 2 + (gi.y - h.y) ** 2;
            if (gi.item) {
                if (gi.dropped || d2 > 0.6 * 0.6) continue;
                if (!room) { if (!gi.warned) { gi.warned = true; this.emit('toast', { text: 'Your backpack is full!', kind: 'warn' }); } continue; }
            } else if (d2 > 0.9 * 0.9) continue;
            this.pickup(gi);
        }
    }

    pickup(gi) {
        const g = this.game.hero;
        if (!this.items.includes(gi)) return;
        if (gi.sugar) {
            const n = Math.round(gi.sugar * (1 + this.hero.st.goldFind / 100));
            g.sugar += n; g.stats.gold += n;
            this.emit('pickup', { what: 'sugar', n, x: gi.x, y: gi.y });
        } else if (gi.potion) {
            if (!addPotion(g, gi.potion, 1)) { if (!gi.warned) { gi.warned = true; this.emit('toast', { text: `Your belt is full of ${POTIONS[gi.potion].name}.` }); } return; }
            this.emit('pickup', { what: 'potion', potion: gi.potion, x: gi.x, y: gi.y });
        } else if (gi.item) {
            if (!addToInv(g, gi.item)) { this.emit('toast', { text: 'Your backpack is full!', kind: 'warn' }); return; }
            if (gi.item.rarity === 'legendary') g.stats.legendaries++;
            this.emit('pickup', { what: 'item', item: gi.item, x: gi.x, y: gi.y });
        } else if (gi.quest) {
            this.game.questEvent(gi.quest);
            this.emit('pickup', { what: 'quest', x: gi.x, y: gi.y });
        }
        this.items.splice(this.items.indexOf(gi), 1);
    }

    dropItem(item) {
        const h = this.hero;
        const gi = { id: this.id(), kind: 'item', item, x: h.x + Math.cos(h.face) * 0.6, y: h.y + Math.sin(h.face) * 0.6, fromX: h.x, fromY: h.y, t: 0, r: 0.3, dropped: true };
        if (!walkable(this.tileAt(gi.x, gi.y))) { gi.x = h.x; gi.y = h.y; }
        this.items.push(gi);
        this.emit('drop', { id: gi.id, rarity: item.rarity, x: gi.x, y: gi.y, quiet: true });
    }

    // ------------------------------------------------------------------ potions & portal
    drink(kind) {
        const h = this.hero, g = this.game.hero;
        if (h.dead || g.potions[kind] <= 0 || h.potionCd > 0) return false;
        if (kind === 'hp' && h.hp >= h.maxHp) return false;
        if (kind === 'juice' && h.juice >= h.maxJuice) return false;
        g.potions[kind]--;
        const P = POTIONS[kind];
        const cur = h.heal || { hp: 0, juice: 0, t: 0, dur: P.over };
        if (kind === 'hp') cur.hp = h.maxHp * P.heal; else cur.juice = h.maxJuice * P.heal;
        cur.t = cur.dur = P.over;
        h.heal = cur;
        h.potionCd = 0.4;
        this.emit('drink', { kind });
        return true;
    }

    // ------------------------------------------------------------------ damage
    rollHeroDamage(sk, rank, mult) {
        const h = this.hero, st = h.st;
        const base = this.rng.range(st.dmgMin, st.dmgMax);
        const ef = st.elemFlat;
        const flat = ef.fire + ef.cold + ef.light + ef.pois;
        let dmg = (base + flat) * mult * (1 + st.mainStat / 100) * (1 + st.dmgPct / 100);
        if (sk && (sk.elem !== 'phys' || CLASSES[this.game.hero.cls].main === 'mag')) dmg *= 1 + st.spellDmg / 100;
        const crit = this.rng.chance(st.crit / 100);
        if (crit) dmg *= 1 + st.critDmg / 100;
        return { dmg, crit };
    }

    /** Damage a monster. opts: { src, crit, knock, stun, freeze, burn, chill, aoe, skill } */
    damageMon(m, dmg, elem = 'phys', opts = {}) {
        if (m.dead || m.burrowed || m.state === 'disguised') return 0;
        const h = this.hero, st = h.st;
        if (m.state === 'sleep') m.state = 'chase';
        dmg *= 1 - (m.armor || 0);
        if (m.boss && m.status.freeze > 0) dmg *= 1;
        dmg = Math.max(1, Math.round(dmg));
        m.hp -= dmg;
        m.hitFlash = 0.12;
        this.aggroPack(m);
        this.emit('hit', { id: m.id, x: m.x, y: m.y, n: dmg, crit: !!opts.crit, elem, src: opts.src || 'hero' });
        if (opts.src === 'hero' || opts.src === 'skill') {
            const aoeK = opts.aoe ? 0.35 : 1;
            if (st.lifeOnHit) h.hp = Math.min(h.maxHp, h.hp + st.lifeOnHit * aoeK);
            if (st.lifeSteal) h.hp = Math.min(h.maxHp, h.hp + dmg * st.lifeSteal / 100 * aoeK * 0.5);
            if (opts.basic && st.juiceOnHit) h.juice = Math.min(h.maxJuice, h.juice + st.juiceOnHit);
            if (st.stunChance && this.rng.chance(st.stunChance / 100)) opts.stun = Math.max(opts.stun || 0, 0.8);
            if (st.freezeChance && this.rng.chance(st.freezeChance / 100)) opts.freeze = Math.max(opts.freeze || 0, 1.0);
            if (st.elemFlat.cold > 0 && !opts.chill) opts.chill = 1.5;
            if (st.elemFlat.fire > 0 && !opts.burn) opts.burn = { dps: st.elemFlat.fire * 0.5, t: 2 };
            if (m.mods.includes('thorny') && !opts.aoe && opts.melee) this.damageHero(dmg * ELITE_MODS.thorny.thorns, 'phys', m, { thorns: true });
        }
        const bossK = m.boss ? 0.35 : 1;
        if (opts.stun) m.status.stun = Math.max(m.status.stun, opts.stun * bossK);
        if (opts.freeze) { m.status.freeze = Math.max(m.status.freeze, opts.freeze * bossK); this.emit('freeze', { id: m.id }); }
        if (opts.chill) m.status.chill = Math.max(m.status.chill, opts.chill);
        if (opts.burn) m.status.burn = { dps: opts.burn.dps, t: opts.burn.t };
        if (opts.knock && !m.boss) {
            const a = Math.atan2(m.y - h.y, m.x - h.x);
            m.knock = { x: Math.cos(a) * opts.knock, y: Math.sin(a) * opts.knock, t: 0.18 };
        }
        if (m.hp <= 0) this.killMon(m, opts);
        return dmg;
    }

    aggroPack(m) {
        if (m.aggro) return;
        m.aggro = true;
        if (m.state === 'idle') m.state = 'chase';
        for (const o of this.mons) if (!o.dead && o.packId === m.packId && !o.aggro) { o.aggro = true; if (o.state === 'idle') o.state = 'chase'; }
    }

    killMon(m, opts = {}) {
        if (m.dead) return;
        m.dead = true; m.deadT = 0; m.hp = 0; m.act = null;
        const g = this.game, hero = g.hero, h = this.hero;
        hero.stats.kills++;
        this.emit('death', { id: m.id, x: m.x, y: m.y, mon: m.type, boss: m.boss, elite: m.elite, crit: !!opts.crit });
        // Experience, scaled down for monsters far below the hero.
        const gap = hero.level - m.lvl;
        const pen = gap > 5 ? Math.max(0.1, 1 - (gap - 5) * 0.15) : 1;
        const eliteK = m.elite === 'champion' ? 3 : m.elite === 'unique' || m.elite === 'quest' ? 7 : 1;
        const shrineXp = h.buffs.shrine_xp ? 1 + h.buffs.shrine_xp.xp : 1;
        const xp = m.def.xp * xpScale(m.lvl) * eliteK * this.diff.xp * pen * shrineXp * (1 + h.st.xpPct / 100) * (m.minion ? 0.5 : 1);
        const ups = gainXp(hero, xp);
        this.emit('xp', { n: Math.round(xp) });
        if (ups) {
            this.refreshStats();
            h.hp = h.maxHp; h.juice = h.maxJuice;
            this.emit('levelup', { level: hero.level, x: h.x, y: h.y });
        }
        if (h.st.healOnKill) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * h.st.healOnKill / 100);
        if (!m.minion) this.spawnLoot(rollDrops(this.rng, m, hero, h.st.magicFind + this.diff.mf), m.x, m.y);
        // Death effects.
        const blast = m.def.deathBlast || (m.mods.includes('spicy') ? ELITE_MODS.spicy.deathBlast : 0);
        if (blast) this.areas.push({ id: this.id(), kind: 'blast', x: m.x, y: m.y, r: blast, t: 0, dur: 0.55, elem: 'fire', dmg: 6 * m.dmgMul, owner: 'mon' });
        if (m.type === 'thief') g.questEvent('leg');
        if (m.boss) {
            hero.stats.bosses++;
            this.emit('bossDead', { mon: m.type, x: m.x, y: m.y });
            g.onBossDead(m.type, this);
        }
    }

    /** Damage the hero. src: the attacking monster (for thorns / knockback) or null. */
    damageHero(dmg, elem = 'phys', src = null, opts = {}) {
        const h = this.hero;
        if (h.dead || h.status.invuln > 0 || this.game.god) return 0;
        if (!opts.aoe && !opts.dot && !opts.thorns && this.rng.chance(h.st.dodge / 100)) { this.emit('dodge', { x: h.x, y: h.y }); return 0; }
        if (elem === 'phys') {
            const lvl = src ? src.lvl : this.lvl;
            const dr = Math.min(0.75, h.st.armor / (h.st.armor + 11 * lvl + 35));
            dmg *= 1 - dr;
        } else dmg *= 1 - h.st.res[elem] / 100;
        dmg = Math.max(1, Math.round(dmg));
        h.hp -= dmg;
        h.hitFlash = 0.15;
        if (!opts.dot) this.emit('heroHit', { n: dmg, elem, x: h.x, y: h.y, big: dmg > h.maxHp * 0.15 });
        if (src && h.st.thorns && !opts.thorns && this.dist(src, h) < 2.5) this.damageMon(src, h.st.thorns, 'phys', { src: 'thorns' });
        if (src && src.mods && src.mods.includes('frosty')) h.status.chill = Math.max(h.status.chill, 1.5);
        if (src && src.mods && src.mods.includes('bouncy')) {
            const a = Math.atan2(h.y - src.y, h.x - src.x);
            h.knock = { x: Math.cos(a) * 3, y: Math.sin(a) * 3, t: 0.15 };
        }
        if (h.hp <= 0) this.heroDie(src);
        return dmg;
    }

    heroDie(src) {
        const h = this.hero, g = this.game.hero;
        if (h.dead) return;
        h.hp = 0; h.dead = true; h.act = null; h.intent = null; h.path = null; h.spin = null;
        g.stats.deaths++;
        this.emit('heroDeath', { by: src ? src.name : 'something nasty' });
    }

    // ------------------------------------------------------------------ projectiles
    spawnProj(p) {
        const pr = { id: this.id(), t: 0, life: 1.6, r: 0.2, pierce: 0, hit: [], ...p };
        this.projs.push(pr);
        this.emit('proj', { id: pr.id, proj: pr.proj, owner: pr.owner });
        return pr;
    }

    updateProjs(dt) {
        const h = this.hero;
        for (const p of this.projs) {
            if (p.done) continue;
            p.t += dt;
            if (p.homing && p.owner === 'hero') {
                let tgt = p.target ? this.monById(p.target) : null;
                if (!tgt || tgt.dead) { tgt = this.nearestMon(p.x, p.y, 4); p.target = tgt ? tgt.id : 0; }
                if (tgt) {
                    const want = Math.atan2(tgt.y - p.y, tgt.x - p.x), cur = Math.atan2(p.vy, p.vx), sp = Math.hypot(p.vx, p.vy);
                    const a = turnToward(cur, want, p.homing * dt);
                    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
                }
            }
            if (p.boomerang && p.t > p.life * 0.5 && !p.back) { p.back = true; }
            if (p.back) {
                const src = this.monById(p.srcId);
                if (src && !src.dead) { const a = Math.atan2(src.y - p.y, src.x - p.x), sp = Math.hypot(p.vx, p.vy); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; if (this.dist(p, src) < 0.5) { p.done = true; continue; } }
            }
            const steps = Math.max(1, Math.ceil(Math.hypot(p.vx, p.vy) * dt / 0.25));
            for (let s = 0; s < steps && !p.done; s++) {
                p.x += p.vx * dt / steps; p.y += p.vy * dt / steps;
                const t = this.tileAt(p.x, p.y);
                if (t === T.SOLID || t === T.BLOCK) { this.projImpact(p, true); break; }
                if (p.owner === 'hero') {
                    for (const m of this.mons) {
                        if (m.dead || m.burrowed || m.state === 'disguised' || p.hit.includes(m.id)) continue;
                        if ((m.x - p.x) ** 2 + (m.y - p.y) ** 2 < (m.r + p.r) ** 2) {
                            p.hit.push(m.id);
                            if (p.radius) { this.projImpact(p, false); break; }
                            this.damageMon(m, p.dmg, p.elem, { src: 'hero', crit: p.crit, burn: p.burn, basic: p.basic, chill: p.elem === 'cold' ? 1.5 : 0 });
                            if (p.pierce-- <= 0) { this.projImpact(p, false); break; }
                        }
                    }
                    for (const o of this.objs) {
                        if (!o.breakable || o.state === 'broken') continue;
                        if ((o.x - p.x) ** 2 + (o.y - p.y) ** 2 < (o.r + p.r) ** 2) { this.breakObj(o); this.projImpact(p, false); break; }
                    }
                } else if (!h.dead && (h.x - p.x) ** 2 + (h.y - p.y) ** 2 < (h.r + p.r) ** 2) {
                    if (p.radius) { this.projImpact(p, false); break; }
                    const src = this.monById(p.srcId);
                    this.damageHero(p.dmg, p.elem, src || null, {});
                    if (p.slow) { h.status.slow = 1.5; h.status.slowMul = 0.6; }
                    this.projImpact(p, false);
                    break;
                }
            }
            if (!p.done && p.t > p.life) this.projImpact(p, true, true);
        }
        this.projs = this.projs.filter((p) => !p.done);
    }

    projImpact(p, wall, expire = false) {
        if (p.done) return;
        p.done = true;
        this.emit('impact', { id: p.id, proj: p.proj, x: p.x, y: p.y, wall, expire });
        if (p.radius && !(expire && p.owner === 'mon' && !p.puddle)) {
            this.emit('explode', { x: p.x, y: p.y, r: p.radius, elem: p.elem, proj: p.proj });
            if (p.owner === 'hero') {
                for (const m of this.monsInRadius(p.x, p.y, p.radius)) this.damageMon(m, p.dmg, p.elem, { src: 'hero', crit: p.crit, burn: p.burn, aoe: true });
                for (const o of this.objs) if (o.breakable && o.state !== 'broken' && this.dist(o, p) < p.radius) this.breakObj(o);
            } else if (this.dist(this.hero, p) < p.radius + this.hero.r) this.damageHero(p.dmg, p.elem, this.monById(p.srcId), { aoe: true });
        }
        if (p.puddle) this.areas.push({ id: this.id(), kind: 'puddle', x: p.x, y: p.y, r: 1.2, t: 0, dur: 4, tick: 0.5, tickT: 0, owner: 'mon', dmg: p.dmg * 0.35, elem: 'pois', slow: true });
    }

    nearestMon(x, y, r) {
        let best = null, bd = r * r;
        for (const m of this.mons) {
            if (m.dead || m.burrowed || m.state === 'disguised' || m.state === 'sleep') continue;
            const d = (m.x - x) ** 2 + (m.y - y) ** 2;
            if (d < bd) { bd = d; best = m; }
        }
        return best;
    }

    // ------------------------------------------------------------------ helpers for the view & bots
    aliveCount() { return this.mons.filter((m) => !m.dead).length; }
    boss() { return this.bossId ? this.monById(this.bossId) : null; }
}

export function newStatus() {
    return { stun: 0, slow: 0, slowMul: 1, freeze: 0, chill: 0, burn: null, pois: null, invuln: 0 };
}

function tickStatus(w, a, dt) {
    const s = a.status;
    if (s.stun > 0) s.stun -= dt;
    if (s.freeze > 0) s.freeze -= dt;
    if (s.slow > 0) s.slow -= dt;
    if (s.chill > 0) s.chill -= dt;
    if (s.invuln > 0) s.invuln -= dt;
    if (a.knock) {
        const k = a.knock;
        w.moveActor(a, k.x * dt / 0.18, k.y * dt / 0.18);
        k.t -= dt;
        if (k.t <= 0) a.knock = null;
    }
    for (const key of ['burn', 'pois']) {
        const d = s[key];
        if (!d) continue;
        d.t -= dt;
        d.acc = (d.acc || 0) + d.dps * dt;
        if (d.acc >= 1) {
            const n = Math.floor(d.acc); d.acc -= n;
            if (a.kind === 'hero') w.damageHero(n, key === 'burn' ? 'fire' : 'pois', null, { dot: true });
            else if (!a.dead) { a.hp -= n; w.emit('hit', { id: a.id, x: a.x, y: a.y, n, elem: key === 'burn' ? 'fire' : 'pois', dot: true }); if (a.hp <= 0) w.killMon(a); }
        }
        if (d.t <= 0) s[key] = null;
    }
}

export function turnToward(cur, want, maxStep) {
    let d = want - cur;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) <= maxStep) return want;
    return cur + Math.sign(d) * maxStep;
}

export { OBJ_DEFS };
