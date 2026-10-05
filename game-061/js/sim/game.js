// The persistent game: one plain-JSON state object (`s`) plus every action on it.
// The galaxy is regenerated from the seed on load; only your changes are saved.

import { RNG, hashStr, sub } from '../rng.js';
import { ITEMS, COMPONENTS, HULLS, componentCost, ALIEN_SHIPYARD_MARKUP, MODULES, TECHS, PAINTS } from '../config.js';
import { generateGalaxy, getSystem, lyDist, normSeed } from './galaxy.js';
import { newShip, shipStats, jumpCost } from './ship.js';
import * as base from './base.js';
import * as econ from './economy.js';
import * as quests from './quests.js';
import { storyPlan, checkStory, currentStage } from './story.js';
import { TEMPERAMENTS } from './species.js';

export const SAVE_VERSION = 1;

export function newState(seedText) {
    const seedStr = normSeed(seedText);
    const h = hashStr(seedStr);
    return {
        v: SAVE_VERSION, seed: seedStr, time: 0, credits: 400, data: 0,
        ship: newShip(sub(h, 'playership')),
        cargo: {}, missionCargo: {},
        base: base.newBase(),
        location: { system: null, docked: null },
        visited: [], scanned: {}, poisDone: {}, revealed: [],
        standing: {}, met: [],
        quests: [], taken: {}, questLog: [],
        story: { stage: 0, shards: 0, key: false, done: false, signal: false },
        markets: {}, depleted: {},
        stats: { mined: {}, minedTotal: 0, unloaded: {}, salesCount: 0, earned: 0, kills: 0, jumps: 0, scans: 0, planetsScanned: 0, deaths: 0, distance: 0, quests: 0, lyTravelled: 0 },
        rng: null,
        tracked: null,
        created: 0,
    };
}

export class Game {
    constructor(state, galaxy = null) {
        this.s = state;
        this.galaxy = galaxy || generateGalaxy(state.seed);
        this.plan = storyPlan(this.galaxy);
        this.rng = new RNG(sub(this.galaxy.seed, 'play'));
        if (state.rng) this.rng.state = state.rng;
        this.fx = [];
        this._stats = null;
        if (state.location.system == null) {
            state.location.system = this.galaxy.home;
            state.location.docked = `${this.galaxy.home}:S0`;
            state.visited = [this.galaxy.home];
            for (const sp of this.galaxy.species) state.standing[sp.id] = sp.hostile ? -60 : 0;
        }
        this._storyT = 0;
    }

    static create(seedText) { return new Game(newState(seedText)); }
    serialize() { this.s.rng = this.rng.state; return JSON.stringify(this.s); }

    emit(type, data = {}) {
        this.fx.push({ ...data, type });
        if (this.fx.length > 400) this.fx.splice(0, this.fx.length - 400);
    }

    // ---------------------------------------------------------------- queries
    get system() { return getSystem(this.galaxy, this.s.location.system); }
    get sysMeta() { return this.galaxy.systems[this.s.location.system]; }
    stats() {
        const key = `${this.s.ship.hull}|${Object.values(this.s.ship.comps).join(',')}|${this.s.base.tech.join(',')}`;
        if (!this._stats || this._statsKey !== key) { this._stats = shipStats(this.s.ship, this.s.base.tech); this._statsKey = key; }
        return this._stats;
    }
    hasTech(id) { return this.s.base.tech.includes(id); }
    standing(spId) { return this.s.standing[spId] ?? 0; }
    friendlyCount() { return this.galaxy.species.filter((sp) => !sp.hostile && this.standing(sp.id) >= 25).length; }
    embassyBonus() { return base.moduleLevel(this.s.base, 'embassy'); }
    cargoOf(id) { return this.s.cargo[id] || 0; }
    cargoUsed() { let n = 0; for (const k in this.s.cargo) n += this.s.cargo[k]; for (const k in this.s.missionCargo) n += this.s.missionCargo[k]; return n; }
    cargoFree() { return Math.max(0, this.stats().cargo - this.cargoUsed()); }
    atHearth() { return this.s.location.docked === `${this.galaxy.home}:S0`; }
    dockedStation() {
        const d = this.s.location.docked;
        if (!d) return null;
        const sys = getSystem(this.galaxy, Number(d.split(':')[0]));
        return sys.stations.find((s) => s.id === d) || null;
    }
    station(id) { const sys = getSystem(this.galaxy, Number(id.split(':')[0])); return sys.stations.find((s) => s.id === id) || null; }

    have(id, where = 'ship') {
        if (where === 'ship') return this.cargoOf(id);
        const st = this.s.base.storage[id] || 0;
        return st + (this.atHearth() ? this.cargoOf(id) : 0);
    }
    take(id, n, where = 'ship') {
        if (where === 'base') {
            const st = this.s.base.storage[id] || 0;
            const a = Math.min(st, n);
            this.s.base.storage[id] = st - a;
            if (!this.s.base.storage[id]) delete this.s.base.storage[id];
            n -= a;
        }
        if (n > 0) {
            this.s.cargo[id] = (this.s.cargo[id] || 0) - n;
            if (this.s.cargo[id] <= 0) delete this.s.cargo[id];
        }
    }
    addCargo(id, n) {
        const k = Math.max(0, Math.min(n, this.cargoFree()));
        if (k > 0) this.s.cargo[id] = (this.s.cargo[id] || 0) + k;
        return k;
    }

    addStanding(spId, delta) {
        const sp = this.galaxy.species[spId];
        if (!sp) return;
        let d = delta;
        if (d > 0) {
            d *= TEMPERAMENTS[sp.temperament].standing * (1 + this.embassyBonus() * 0.5) * (this.hasTech('xeno') ? 1.25 : 1);
            if (sp.hostile) d *= 0.5;
        }
        const cap = sp.hostile ? 20 : 100;
        const before = this.standing(spId);
        this.s.standing[spId] = Math.max(-100, Math.min(cap, before + d));
        if (Math.floor(before / 5) !== Math.floor(this.s.standing[spId] / 5)) this.emit('standing', { species: spId, value: this.s.standing[spId], delta: d });
    }

    meet(spId) {
        if (spId < 0 || this.s.met.includes(spId)) return;
        this.s.met.push(spId);
        this.emit('met', { species: spId, text: `First contact: the ${this.galaxy.species[spId].gov}` });
    }

    // ---------------------------------------------------------------- time
    tick(dt) {
        this.s.time += dt;
        base.tickBase(this, dt);
        this._storyT += dt;
        if (this._storyT > 0.5) { this._storyT = 0; checkStory(this); }
    }

    // ---------------------------------------------------------------- trade
    quote(id, station = this.dockedStation()) { return econ.quote(this, station, id); }
    sell(id, n) {
        const st = this.dockedStation();
        if (!st || st.kind === 'hearth') return { ok: false, why: 'Not docked at a market' };
        n = Math.min(n, this.cargoOf(id));
        if (n <= 0) return { ok: false, why: 'Nothing to sell' };
        const q = econ.quote(this, st, id);
        if (q.taboo) return { ok: false, why: `The ${this.galaxy.species[st.species].name} consider ${ITEMS[id].name} taboo` };
        const total = econ.sellTo(this, st, id, n);
        this.take(id, n);
        this.s.credits += total;
        this.s.stats.salesCount++;
        this.s.stats.earned += total;
        if (st.species >= 0) this.addStanding(st.species, Math.min(3, total / 450) * (q.crave ? 1.6 : 1));
        this.emit('sold', { item: id, n, total });
        return { ok: true, total };
    }
    buy(id, n) {
        const st = this.dockedStation();
        if (!st || st.kind === 'hearth') return { ok: false, why: 'Not docked at a market' };
        const q = econ.quote(this, st, id);
        n = Math.min(n, q.stock, this.cargoFree());
        if (n <= 0) return { ok: false, why: q.stock <= 0 ? 'Out of stock' : 'Cargo hold full' };
        let k = 0, cost = 0;
        // Price rises as you buy; stop when you can't afford the next unit.
        while (k < n) {
            const unit = econ.quote(this, st, id).buy;
            if (cost + unit > this.s.credits) break;
            cost += econ.buyFrom(this, st, id, 1);
            k++;
        }
        if (k === 0) return { ok: false, why: 'Not enough credits' };
        this.s.credits -= cost;
        this.s.cargo[id] = (this.s.cargo[id] || 0) + k;
        this.emit('bought', { item: id, n: k, total: cost });
        return { ok: true, n: k, total: cost };
    }
    sellData() {
        const st = this.dockedStation();
        if (!st || st.kind === 'hearth') return { ok: false };
        const n = Math.floor(this.s.data);
        if (n <= 0) return { ok: false, why: 'No data to sell' };
        const total = Math.round(n * econ.dataPrice(this, st));
        this.s.data -= n;
        this.s.credits += total;
        this.s.stats.earned += total;
        if (st.species >= 0) this.addStanding(st.species, Math.min(2, total / 600));
        return { ok: true, total };
    }

    // ---------------------------------------------------------------- services
    fuelPrice() {
        const st = this.dockedStation();
        if (!st || st.kind === 'hearth') return 0;
        return Math.round(econ.quote(this, st, 'fuelcell').buy * 1.05);
    }
    refuel() {
        const sh = this.s.ship, max = this.stats().fuelMax;
        let need = max - sh.fuel;
        if (need <= 0) return { ok: false, why: 'Tank full' };
        let used = 0, cost = 0;
        // Cells in the hold (and at Hearth, in storage) first.
        const fromCargo = Math.min(need, this.cargoOf('fuelcell'));
        if (fromCargo) { this.take('fuelcell', fromCargo); need -= fromCargo; used += fromCargo; }
        if (need > 0 && this.atHearth()) {
            const st = Math.min(need, this.s.base.storage.fuelcell || 0);
            if (st) { this.take('fuelcell', st, 'base'); need -= st; used += st; }
        }
        if (need > 0 && !this.atHearth() && this.dockedStation()) {
            const p = this.fuelPrice();
            const afford = Math.min(need, Math.floor(this.s.credits / p));
            cost = afford * p;
            this.s.credits -= cost;
            used += afford;
            need -= afford;
        }
        sh.fuel += used;
        if (used === 0) return { ok: false, why: this.atHearth() ? 'No Warp Cells in storage — refine or fabricate some' : 'Not enough credits' };
        return { ok: true, used, cost };
    }
    repairCost() { return this.atHearth() ? 0 : Math.ceil((this.stats().hullMax - this.s.ship.hp) * 2); }
    repair() {
        const c = this.repairCost();
        const missingHp = this.stats().hullMax - this.s.ship.hp;
        if (missingHp <= 0) return { ok: false, why: 'Hull intact' };
        if (this.s.credits < c) return { ok: false, why: 'Not enough credits' };
        this.s.credits -= c;
        this.s.ship.hp = this.stats().hullMax;
        return { ok: true, cost: c };
    }

    // ---------------------------------------------------------------- Hearth
    unloadAll() {
        if (!this.atHearth()) return { ok: false };
        const b = this.s.base;
        let moved = 0;
        for (const id of Object.keys(this.s.cargo)) {
            const free = base.storageCap(b) - base.storageUsed(b);
            const n = Math.min(this.s.cargo[id], free);
            if (n <= 0) continue;
            this.take(id, n);
            b.storage[id] = (b.storage[id] || 0) + n;
            this.s.stats.unloaded[id] = (this.s.stats.unloaded[id] || 0) + n;
            moved += n;
        }
        return { ok: moved > 0, moved, full: Object.keys(this.s.cargo).length > 0 };
    }
    unload(id, n) {
        if (!this.atHearth()) return { ok: false };
        const b = this.s.base;
        n = Math.min(n, this.cargoOf(id), base.storageCap(b) - base.storageUsed(b));
        if (n <= 0) return { ok: false, why: 'Storage full' };
        this.take(id, n);
        b.storage[id] = (b.storage[id] || 0) + n;
        this.s.stats.unloaded[id] = (this.s.stats.unloaded[id] || 0) + n;
        return { ok: true, n };
    }
    load(id, n) {
        if (!this.atHearth()) return { ok: false };
        n = Math.min(n, this.s.base.storage[id] || 0, this.cargoFree());
        if (n <= 0) return { ok: false, why: 'Cargo hold full' };
        this.take(id, n, 'base');
        // take(…,'base') may dip into cargo when storage runs short; it can't here because n ≤ storage.
        this.s.cargo[id] = (this.s.cargo[id] || 0) + n;
        return { ok: true, n };
    }
    build(type) { const r = base.build(this, type); if (r.ok) this.emit('built', { module: type, text: `${MODULES[type].name} constructed` }); return r; }
    upgradeModule(uid) { const r = base.upgrade(this, uid); if (r.ok) this.emit('built', { module: r.m.type, text: `${MODULES[r.m.type].name} upgraded to Lv ${r.m.level}` }); return r; }
    fabricate(id) { return base.fabricate(this, id); }
    research(id) { const r = base.research(this, id); if (r.ok) this.emit('research', { text: `Research complete: ${r.t.name}` }); return r; }
    convertData(n) { return base.convertData(this, n); }

    // ---------------------------------------------------------------- shipyard
    compCheck(id) {
        const sh = this.s.ship, mk = sh.comps[id] + 1;
        const C = COMPONENTS[id];
        const maxMk = C.max ?? 5;
        if (sh.comps[id] >= maxMk) return { ok: false, why: 'Maximum Mk', maxed: true };
        if (!this.atHearth()) return { ok: false, why: 'Dock at Hearth' };
        const yard = base.modulesOf(this.s.base, 'shipyard')[0];
        if (!yard) return { ok: false, why: 'Build a Shipyard at Hearth', mk };
        if (yard.level < mk) return { ok: false, why: `Needs Shipyard Lv ${mk}`, mk };
        if (mk > sh.hull + (id === 'warp' ? 1 : 0) && id !== 'scoop') return { ok: false, why: `Needs a ${HULLS[mk - (id === 'warp' ? 1 : 0)]?.name || 'bigger'} hull`, mk };
        if (id === 'warp' && !this.hasTech('warp')) return { ok: false, why: 'Research Warp Theory', mk };
        if (mk >= 4 && !this.hasTech('advfab')) return { ok: false, why: 'Research Advanced Fabrication', mk };
        if (mk >= 5 && !this.hasTech('exotic')) return { ok: false, why: 'Research Exotic Physics', mk };
        const cost = componentCost(id, mk);
        if (!base.canAfford(this, cost)) return { ok: false, why: 'Not enough materials', cost, mk };
        return { ok: true, cost, mk };
    }
    upgradeComp(id) {
        const c = this.compCheck(id);
        if (!c.ok) return c;
        base.pay(this, c.cost);
        this.applyComp(id, c.mk);
        return { ok: true, mk: c.mk };
    }
    applyComp(id, mk) {
        const before = this.stats();
        this.s.ship.comps[id] = mk;
        const after = this.stats();
        if (id === 'armor') this.s.ship.hp = Math.round(this.s.ship.hp * after.hullMax / before.hullMax);
        this.emit('upgrade', { text: `${COMPONENTS[id].name} Mk ${mk} installed` });
    }
    hullCheck() {
        const sh = this.s.ship, next = sh.hull + 1;
        if (next > 5) return { ok: false, why: 'Largest hull', maxed: true };
        if (!this.atHearth()) return { ok: false, why: 'Dock at Hearth' };
        const yard = base.modulesOf(this.s.base, 'shipyard')[0];
        if (!yard || yard.level < next) return { ok: false, why: `Needs Shipyard Lv ${next}` };
        if (next >= 4 && !this.hasTech('advfab')) return { ok: false, why: 'Research Advanced Fabrication' };
        const cost = HULLS[next].cost;
        if (!base.canAfford(this, cost)) return { ok: false, why: 'Not enough materials', cost };
        return { ok: true, cost, next };
    }
    upgradeHull() {
        const c = this.hullCheck();
        if (!c.ok) return c;
        base.pay(this, c.cost);
        const before = this.stats().hullMax;
        this.s.ship.hull = c.next;
        this.s.ship.hp = Math.round(this.s.ship.hp + (this.stats().hullMax - before));
        this.emit('upgrade', { text: `New hull: ${HULLS[c.next].name}`, hull: true });
        return { ok: true };
    }
    setPaint(i) { this.s.ship.paint = ((i % PAINTS.length) + PAINTS.length) % PAINTS.length; }
    rerollDesign() { this.s.ship.design = (Math.imul(this.s.ship.design ^ 0x9e3779b9, 2654435761) >>> 0) || 1; }

    // Alien shipyard: credits only, up to Mk 3 (Mk 4 when Allied).
    alienOffers() {
        const st = this.dockedStation();
        if (!st || st.kind !== 'shipyard') return [];
        const sp = this.galaxy.species[st.species];
        const cap = this.standing(sp.id) >= 60 ? 4 : 3;
        const out = [];
        for (const id of Object.keys(COMPONENTS)) {
            const mk = this.s.ship.comps[id] + 1;
            const maxMk = COMPONENTS[id].max ?? 5;
            if (mk > maxMk || mk > cap) continue;
            const base0 = componentCost(id, mk);
            let credits = base0.credits;
            for (const [k, v] of Object.entries(base0)) if (k !== 'credits') credits += v * ITEMS[k].price;
            credits = Math.round(credits * ALIEN_SHIPYARD_MARKUP * (1 - Math.max(0, this.standing(sp.id)) / 400));
            let why = null;
            if (mk > this.s.ship.hull + (id === 'warp' ? 1 : 0) && id !== 'scoop') why = `Needs a ${HULLS[mk - (id === 'warp' ? 1 : 0)].name} hull`;
            else if (id === 'warp' && !this.hasTech('warp')) why = 'Research Warp Theory';
            else if (mk >= 4 && !this.hasTech('advfab')) why = 'Research Advanced Fabrication';
            else if (this.s.credits < credits) why = 'Not enough credits';
            out.push({ id, mk, credits, ok: !why, why });
        }
        return out;
    }
    buyAlien(id) {
        const o = this.alienOffers().find((x) => x.id === id);
        if (!o || !o.ok) return { ok: false, why: o?.why || 'Unavailable' };
        this.s.credits -= o.credits;
        this.applyComp(id, o.mk);
        return { ok: true };
    }

    // ---------------------------------------------------------------- travel
    warpCheck(targetId) {
        if (targetId === this.s.location.system) return { ok: false, why: 'Already here' };
        const st = this.stats();
        const latticeFree = this.s.story.done && this.s.visited.includes(targetId);
        const d = lyDist(this.galaxy.systems[this.s.location.system], this.galaxy.systems[targetId]);
        if (latticeFree) return { ok: true, cost: 1, d, lattice: true };
        if (st.warpRange <= 0) return { ok: false, why: 'No warp drive installed' };
        if (d > st.warpRange) return { ok: false, why: `Out of range (${d.toFixed(1)} ly > ${st.warpRange} ly)`, d };
        const cost = jumpCost(d, this.s.base.tech);
        if (this.s.ship.fuel < cost) return { ok: false, why: `Needs ${cost} Warp Cells (have ${this.s.ship.fuel})`, d, cost };
        return { ok: true, cost, d };
    }
    recallCheck() {
        if (!base.hasModule(this.s.base, 'beacon')) return { ok: false, why: 'Build a Warp Beacon at Hearth' };
        if (this.s.location.system === this.galaxy.home) return { ok: false, why: 'Already home' };
        if (this.s.ship.fuel < 2) return { ok: false, why: 'Needs 2 Warp Cells' };
        return { ok: true, cost: 2 };
    }
    // Called when the warp tunnel completes.
    arrive(targetId, cost) {
        const from = this.galaxy.systems[this.s.location.system];
        const to = this.galaxy.systems[targetId];
        this.s.ship.fuel -= cost;
        this.s.stats.jumps++;
        this.s.stats.lyTravelled += lyDist(from, to);
        this.s.location.system = targetId;
        this.s.location.docked = null;
        const first = !this.s.visited.includes(targetId);
        if (first) {
            this.s.visited.push(targetId);
            const value = Math.round(8 + to.danger * 4 + (to.homeOf >= 0 ? 10 : 0));
            this.s.data += value;
            this.emit('toast', { text: `New system charted: ${to.name}  +${value} data`, kind: 'data' });
        }
        if (to.owner >= 0) this.meet(to.owner);
        quests.questEvent(this, { kind: 'arrive', system: targetId });
        return { first };
    }

    dock(stationId) {
        this.s.location.docked = stationId;
        const st = this.station(stationId);
        if (st && st.species >= 0) this.meet(st.species);
        quests.questEvent(this, { kind: 'dock', station: stationId });
        if (stationId === `${this.galaxy.home}:S0` && this.s.ship.hp < this.stats().hullMax) this.s.ship.hp = this.stats().hullMax;
        // Contraband check in a species' space.
        if (st && st.species >= 0) {
            const sp = this.galaxy.species[st.species];
            const n = this.cargoOf(sp.taboo);
            if (n > 0 && this.rng.chance(0.5)) {
                const fine = Math.round(n * ITEMS[sp.taboo].price * 0.8);
                this.take(sp.taboo, n);
                this.s.credits = Math.max(0, this.s.credits - fine);
                this.addStanding(sp.id, -6);
                this.emit('toast', { text: `Customs seized ${n} ${ITEMS[sp.taboo].name} (taboo to the ${sp.name}) and fined you ${fine} cr`, kind: 'bad' });
            }
        }
    }
    undock() { this.s.location.docked = null; }

    die() {
        this.s.stats.deaths++;
        const lostCargo = this.cargoUsed();
        this.s.cargo = {};
        for (const q of this.s.quests) if (this.s.missionCargo[q.id]) { q.state = 'failed'; if (q.giver.species >= 0) this.addStanding(q.giver.species, -4); }
        this.s.quests = this.s.quests.filter((q) => q.state !== 'failed');
        this.s.missionCargo = {};
        const fee = Math.round(this.s.credits * 0.1);
        this.s.credits -= fee;
        this.s.ship.hp = this.stats().hullMax;
        this.s.location.system = this.galaxy.home;
        this.s.location.docked = `${this.galaxy.home}:S0`;
        return { fee, lostCargo };
    }

    // ---------------------------------------------------------------- quests
    board() { const st = this.dockedStation(); return st && st.kind !== 'hearth' ? quests.boardFor(this, st) : []; }
    accept(q) { return quests.accept(this, this.dockedStation(), q); }
    abandon(qid) { quests.abandon(this, qid); }
    turnIn(q) { return quests.turnIn(this, q); }
    canTurnIn(q) { return quests.canTurnIn(this, q); }
    questEvent(ev) { quests.questEvent(this, ev); }
    stage() { return currentStage(this); }
}
