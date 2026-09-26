// ============================================================
// The Game: owns the save state, the generated world and the
// runtime (entities, battle, current map). No DOM, no Math.random.
// Systems live in sibling modules and are mixed into the prototype.
// ============================================================

import { Emitter } from '../core/events.js';
import { rngFor, clamp } from '../core/rng.js';
import { generateWorld } from '../gen/world.js';
import { generateSpecies } from '../gen/monsters.js';
import { generateVillager, generateMayor, glimName } from '../gen/villagers.js';
import { ITEM } from '../data/items.js';
import { G, O, O_BLOCK, G_BLOCK } from '../data/tiles.js';
import { BUILDING, BLD_W, BLD_H, VILLAGE_LEVELS } from '../data/buildings.js';
import { JOB_ORDER } from '../data/jobs.js';
import { PRONOUNS, fill } from '../gen/names.js';
import { newState, seasonOf, DAY_START, DAY_END, NIGHT_AT, MIN_PER_SEC, dateText } from './state.js';
import { addTo, countIn, removeFrom } from './inventory.js';

export const DIRS = [[0, 1], [0, -1], [-1, 0], [1, 0]];   // down, up, left, right
const WALK = 4.2, RUN = 6.2;

export class Game extends Emitter {
    constructor(state) {
        super();
        this.s = state;
        this.world = generateWorld(state.seed);
        const sp = generateSpecies(state.seed);
        this.species = sp.species; this.byRegion = sp.byRegion;
        this.mayor = generateMayor(state.seed);
        this.glim = glimName(state.seed);
        this.people = {};
        for (const j of JOB_ORDER) this.people[j] = generateVillager(state.seed, j);
        if (!state.villageName) state.villageName = this.world.glen.name;
        this.rt = {
            orig: new Map(), hits: new Map(), monsters: [], npcs: {}, animals: [], battle: null, floor: null,
            explored: new Uint8Array(this.world.W * this.world.H), msgs: [], t: 0, cooldown: 0, lastRegion: -1,
            spawnT: 0, anim: 0, swing: 0, lock: 0, companion: null,
        };
        this.applyWorldState();
        if (!state.player.x) this.placeAtHome();
        this.map = this.world;
        if (state.player.where !== 'world') { state.player.where = 'world'; this.placeAtHome(); }
        this.buildBuildingMap();
        this.loadExplored();
        this.refreshStats();
    }

    static create(opts) {
        const g = new Game(newState(opts));
        g.onNewGame?.();
        return g;
    }

    // ------------------------------------------------------------ helpers
    get p() { return this.s.player; }
    get day() { return this.s.time.day; }
    get season() { return seasonOf(this.s.time.day); }
    get isNight() { return this.s.time.min >= NIGHT_AT + 60; }
    get region() { const m = this.map; if (m !== this.world) return m.region; return this.world.region[this.tileIndex(this.p.x, this.p.y - 0.2)]; }
    get inWorld() { return this.map === this.world; }
    rng(...tag) { return rngFor(this.s.seed, ...tag, this.s.time.day, this.s.time.min | 0, this.s.stats.steps); }
    tileIndex(x, y) { return Math.floor(y) * this.map.W + Math.floor(x); }
    vars(extra = {}) {
        const pr = PRONOUNS[this.p.pronoun] ?? PRONOUNS.they;
        return { player: this.p.name, mayor: this.mayor.name, glim: this.glim, glen: this.s.villageName, aunt: this.mayor.aunt, pthey: pr.they, pthem: pr.them, ptheir: pr.their, ...extra };
    }
    t(tpl, extra) { return fill(tpl, this.vars(extra)); }
    hasRelic(id) { return this.p.relics.includes(id); }
    msg(text, icon) { this.emit('toast', { text, icon }); this.s.log.unshift(text); if (this.s.log.length > 40) this.s.log.length = 40; }
    sfx(name) { this.emit('sfx', name); }

    // ------------------------------------------------------------ inventory wrappers
    count(key) { return countIn(this.s.inv, key, this.s.invSize); }
    give(id, n = 1, quiet = false) {
        if (id === 'gold') { this.p.gold += n; if (!quiet) this.msg(`+${n} gold`, 'gold'); return 0; }
        if (id === 'hay' && (this.hasHouse?.('coop') || this.hasHouse?.('barn'))) { this.s.hay += n; if (!quiet) this.msg(`+${n} hay → silo (${this.s.hay})`, 'hay'); return 0; }
        const left = addTo(this.s.inv, id, n, this.s.invSize);
        if (left > 0) {
            const left2 = addTo(this.s.storage, id, left);
            if (!quiet) this.msg(`Backpack full — ${left - left2} ${ITEM[id].name} sent to your cabin chest`);
            if (left2 > 0) this.s.storehouse.push({ id, n: left2 });
        }
        if (!quiet && n > 0) this.emit('pickup', { id, n });
        this.emit('inv');
        return left;
    }
    take(key, n = 1) { const r = removeFrom(this.s.inv, key, n, this.s.invSize); if (r) this.emit('inv'); return r; }
    selected() { return this.s.inv[this.s.sel] ?? null; }

    // ------------------------------------------------------------ stats
    refreshStats() {
        const p = this.p, lv = p.level, b = p.bonus;
        const eq = ['weapon', 'armor', 'charm'].map(k => ITEM[p.equip[k]]?.eq).filter(Boolean);
        const sum = k => eq.reduce((a, e) => a + (e[k] ?? 0), 0);
        const buff = p.buffs.day === this.day ? p.buffs : {};
        p.maxHp = Math.round(50 + (lv - 1) * 8 + b.hp + sum('hp'));
        p.maxSp = Math.round(10 + (lv - 1) * 2 + sum('sp'));
        p.maxEnergy = 100 + b.en + (this.s.blessings.includes('energy') ? 20 : 0);
        this.stats = {
            atk: Math.round(5 + (lv - 1) * 1.5 + b.atk + sum('atk') + (buff.atk ?? 0)),
            def: Math.round(2 + (lv - 1) * 1 + b.def + sum('def') + (buff.def ?? 0)),
            spd: Math.round(5 + (lv - 1) * 0.5 + b.spd + sum('spd') + (buff.spd ?? 0)),
            luck: sum('luck') + (buff.luck ?? 0),
            elem: p.weaponElem || 'none',
        };
        p.hp = Math.min(p.hp, p.maxHp); p.sp = Math.min(p.sp, p.maxSp); p.energy = Math.min(p.energy, p.maxEnergy);
    }
    xpToNext(lv = this.p.level) { return Math.round(20 * Math.pow(lv, 1.6)); }
    gainXp(n) {
        const p = this.p; p.xp += n;
        let ups = 0;
        while (p.xp >= this.xpToNext()) { p.xp -= this.xpToNext(); p.level++; ups++; }
        if (ups) { this.refreshStats(); p.hp = p.maxHp; p.sp = p.maxSp; this.emit('levelup', { level: p.level }); this.msg(`Level up! You are now level ${p.level}.`, 'star'); this.sfx('levelup'); }
        return ups;
    }
    skillXp(skill, n) {
        const sk = this.p.skills[skill]; if (!sk || sk.lv >= 10) return;
        sk.xp += n;
        const need = 30 * sk.lv;
        if (sk.xp >= need) { sk.xp -= need; sk.lv++; this.msg(`${skill[0].toUpperCase() + skill.slice(1)} skill is now ${sk.lv}!`, 'star'); this.sfx('skill'); }
    }
    energyCost(tool) {
        const base = { hoe: 2, can: 2, axe: 3, pick: 3, scythe: 1 }[tool] ?? 2;
        const tier = this.p.tools[tool] ?? 0;
        const sk = { hoe: 'farming', can: 'farming', axe: 'foraging', pick: 'mining', scythe: 'foraging' }[tool];
        let c = base - Math.floor(tier / 2) - Math.floor((this.p.skills[sk]?.lv ?? 1) / 5) - (this.s.blessings.includes('tailor') ? 1 : 0);
        if (this.p.buffs.day === this.day && this.p.buffs.farm) c -= 1;
        return Math.max(1, c);
    }
    useEnergy(n) {
        if (this.p.energy < n) { this.msg("You're too tired. Eat something or rest.", 'tired'); this.sfx('deny'); return false; }
        this.p.energy -= n; return true;
    }

    // ------------------------------------------------------------ world state
    applyWorldState() {
        const w = this.world, W = this.s.world;
        for (const k of Object.keys(W.removed)) { const i = +k; this.rt.orig.set(i, w.obj[i]); w.obj[i] = O.NONE; }
        for (const k of Object.keys(W.placed)) { const i = +k; if (!this.rt.orig.has(i)) this.rt.orig.set(i, w.obj[i]); w.obj[i] = O.PLACED; }
        for (const k of Object.keys(W.gates)) { const i = +k; if (w.ground[i] === G.SHALLOW) w.ground[i] = G.BRIDGE; }
        for (const [lot, b] of Object.entries(W.lots)) { const L = w.lots[+lot]; if (L && b) { w.obj[L.sign.y * w.W + L.sign.x] = O.NONE; } }
        if (this.s.village.board) { /* board is drawn as built */ }
    }
    removeObj(i, regrow = true) {
        const w = this.world;
        if (this.map !== w) { this.map.obj[i] = O.NONE; return; }
        this.rt.orig.set(i, w.obj[i]);
        this.s.world.removed[i] = regrow ? this.day : -1;
        w.obj[i] = O.NONE;
        this.emit('tile', i);
    }
    placeObj(i, id) {
        const w = this.world;
        if (!this.rt.orig.has(i)) this.rt.orig.set(i, w.obj[i]);
        this.s.world.placed[i] = { id };
        w.obj[i] = O.PLACED;
        this.emit('tile', i);
    }
    unplaceObj(i) {
        delete this.s.world.placed[i];
        this.world.obj[i] = O.NONE;
        this.s.world.removed[i] = -1;
        this.emit('tile', i);
    }
    /** Building footprints (cabin, hall, lot buildings) → Map tileIndex → building record */
    buildBuildingMap() {
        const w = this.world, m = new Map();
        const list = [];
        const add = (b) => { list.push(b); for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) m.set(y * w.W + x, b); };
        add({ ...w.glen.cabin, type: 'cabin', name: 'Your Cabin' });
        add({ ...w.glen.hall, type: 'hall', name: "Mayor's Hall" });
        for (const [lot, rec] of Object.entries(this.s.world.lots)) {
            const L = w.lots[+lot];
            if (!L || !rec) continue;
            const B = BUILDING[rec.b];
            add({ id: 'lot' + lot, lot: +lot, x: L.x + 1, y: L.y + 1, w: BLD_W, h: BLD_H, type: rec.b, name: B.name, built: rec.day });
        }
        this.buildings = list; this.bmap = m;
        this.emit('buildings');
    }
    buildingAt(x, y) { if (this.map !== this.world) return null; return this.bmap.get(Math.floor(y) * this.world.W + Math.floor(x)) ?? null; }

    // ------------------------------------------------------------ collision
    blockedTile(tx, ty) {
        const m = this.map;
        if (tx < 0 || ty < 0 || tx >= m.W || ty >= m.H) return true;
        const i = ty * m.W + tx;
        const g = m.ground[i];
        if (g === G.SHALLOW) { if (!(this.hasRelic('lilypad') || m !== this.world)) return true; }
        else if (G_BLOCK.has(g)) return true;
        const o = m.obj[i];
        if (o === O.DARK) return !this.hasRelic('lantern');
        if (o === O.GLIMMER) return this.glimmerAwakeAt(i);
        if (o && O_BLOCK.has(o)) return true;
        if (m === this.world && this.bmap.has(i)) return true;
        return false;
    }
    blockedBox(x, y) {
        const x0 = Math.floor(x - 0.28), x1 = Math.floor(x + 0.28), y0 = Math.floor(y - 0.34), y1 = Math.floor(y - 0.02);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.blockedTile(tx, ty)) return true;
        return false;
    }
    facingTile() {
        const [dx, dy] = DIRS[this.p.dir];
        const x = Math.floor(this.p.x) + dx, y = Math.floor(this.p.y - 0.2) + dy;
        return { x, y, i: y * this.map.W + x };
    }
    placeAtHome() {
        const s = this.world.glen.start;
        this.p.x = s.x + 0.5; this.p.y = s.y + 0.9; this.p.dir = 0;
    }

    // ------------------------------------------------------------ the frame
    /** input: { mx, my, run, act } */
    update(dt, input = {}) {
        const rt = this.rt;
        rt.t += dt; rt.anim += dt;
        if (rt.battle || rt.lock > 0) { rt.lock = Math.max(0, rt.lock - dt); return; }
        rt.cooldown = Math.max(0, rt.cooldown - dt);
        rt.swing = Math.max(0, rt.swing - dt);
        this.s.playtime += dt;
        // clock
        const before = this.s.time.min;
        this.s.time.min += dt * MIN_PER_SEC;
        if (before < DAY_END - 60 && this.s.time.min >= DAY_END - 60) this.msg("It's getting very late…", 'moon');
        if (this.s.time.min >= DAY_END) { this.passOut(); return; }
        if (Math.floor(before / 60) !== Math.floor(this.s.time.min / 60)) this.onHour?.();
        // movement
        let { mx = 0, my = 0 } = input;
        const len = Math.hypot(mx, my);
        const p = this.p;
        rt.moving = len > 0.15;
        if (rt.moving) {
            if (len > 1) { mx /= len; my /= len; }
            if (Math.abs(mx) > Math.abs(my)) p.dir = mx < 0 ? 2 : 3; else p.dir = my < 0 ? 1 : 0;
            const ice = this.map === this.world && this.map.ground[this.tileIndex(p.x, p.y - 0.1)] === G.ICE;
            const sp = (input.run ? RUN : WALK) * (this.p.buffs.day === this.day && this.p.buffs.speed ? 1.15 : 1) * (ice ? 1.1 : 1);
            const nx = p.x + mx * sp * dt, ny = p.y + my * sp * dt;
            if (!this.blockedBox(nx, p.y)) p.x = nx;
            else if (Math.abs(my) < 0.3) this.nudge(0, mx);
            if (!this.blockedBox(p.x, ny)) p.y = ny;
            else if (Math.abs(mx) < 0.3) this.nudge(1, my);
            rt.stepAcc = (rt.stepAcc ?? 0) + sp * dt;
            if (rt.stepAcc > 1) { rt.stepAcc = 0; this.s.stats.steps++; this.onStep(); }
        }
        this.updateEntities?.(dt);
        this.checkStory?.();
    }
    /** Slide around corners: if pushing into a wall, try a small perpendicular nudge. */
    nudge(axis, dir) {
        const p = this.p;
        for (const off of [0.25, -0.25, 0.45, -0.45]) {
            if (axis === 0) { if (!this.blockedBox(p.x + dir * 0.1, p.y + off) && !this.blockedBox(p.x, p.y + off)) { p.y += Math.sign(off) * 0.06; return; } }
            else if (!this.blockedBox(p.x + off, p.y + dir * 0.1) && !this.blockedBox(p.x + off, p.y)) { p.x += Math.sign(off) * 0.06; return; }
        }
    }
    onStep() {
        const p = this.p;
        const i = this.tileIndex(p.x, p.y - 0.2);
        const m = this.map;
        if (m === this.world) {
            this.revealAround(p.x, p.y);
            const rg = this.world.region[i];
            if (rg !== this.rt.lastRegion && rg !== 255) {
                const prev = this.rt.lastRegion;
                this.rt.lastRegion = rg;
                if (rg >= 1 && rg <= 5) { this.s.quests.flags['visited_r' + rg] = true; if (prev !== -1) this.emit('region', rg); }
                else if (prev !== -1 && rg === 0) this.emit('region', 0);
            }
        }
        // stepping onto stairs / keys in dungeons
        const o = m.obj[i];
        if (m !== this.world) {
            if (o === O.DOWN) this.descend?.();
            else if (o === O.UP) this.ascend?.();
            else if (o === O.KEY) { m.obj[i] = O.NONE; this.rt.floorKey = true; this.msg('Picked up an Old Key.', 'key'); this.sfx('key'); }
        }
    }

    // ------------------------------------------------------------ fog of war
    revealAround(x, y) {
        const w = this.world, e = this.rt.explored;
        const R = 7;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
            if (dx * dx + dy * dy > R * R) continue;
            const tx = Math.floor(x) + dx, ty = Math.floor(y) + dy;
            if (tx < 0 || ty < 0 || tx >= w.W || ty >= w.H) continue;
            e[ty * w.W + tx] = 1;
        }
    }
    saveExplored() {
        const e = this.rt.explored, bytes = new Uint8Array(Math.ceil(e.length / 8));
        for (let i = 0; i < e.length; i++) if (e[i]) bytes[i >> 3] |= 1 << (i & 7);
        let s = ''; for (const b of bytes) s += String.fromCharCode(b);
        this.s.world.explored = typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
    }
    loadExplored() {
        const src = this.s.world.explored;
        if (src) {
            const s = typeof atob === 'function' ? atob(src) : Buffer.from(src, 'base64').toString('binary');
            for (let i = 0; i < this.rt.explored.length; i++) if (s.charCodeAt(i >> 3) & (1 << (i & 7))) this.rt.explored[i] = 1;
        }
        // the Glen is always known
        const w = this.world;
        for (let i = 0; i < w.W * w.H; i++) if (w.region[i] === 0) this.rt.explored[i] = 1;
    }

    // ------------------------------------------------------------ village level helpers used everywhere
    villageTitle(lv = this.s.village.level) { return VILLAGE_LEVELS[lv - 1]?.title ?? ''; }
    residents() { return Object.keys(this.s.villagers).filter(j => this.s.villagers[j].joined); }
    isResident(job) { return !!this.s.villagers[job]?.joined; }
    dateText() { return dateText(this.day); }
}

export { clamp };
