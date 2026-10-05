// Hearth: modules, power, storage, production and research. Operates on game.s.base.

import { MODULES, moduleCost, moduleCap, moduleSlots, BASE_START_STORAGE, RECIPES, FAB, TECHS, ITEMS } from '../config.js';

export function newBase() {
    return {
        modules: [{ uid: 1, type: 'core', level: 1 }],
        nextUid: 2,
        storage: { ferrite: 10, silicate: 10 },
        recipes: { steel: true, silicon: true, coolant: false, polymer: false, cell_ice: false, alloy: true, circuit: true, cell_he3: true, lattice: true, voidcore: true },
        depot: {},
        reserve: 20,     // the refinery leaves this much of each raw resource untouched
        refCap: 150,     // …and stops a recipe once its output stock reaches this
        drones: 0,
        timers: { refinery: 0, hydro: 0, drones: 0, depot: 0, raid: 0 },
        rp: 0,
        tech: [],
        produced: {},
        raidLog: null,
    };
}

export const coreLevel = (b) => b.modules.find((m) => m.type === 'core').level;
export const modulesOf = (b, type) => b.modules.filter((m) => m.type === type);
export const moduleLevel = (b, type) => modulesOf(b, type).reduce((s, m) => s + m.level, 0);
export const hasModule = (b, type) => b.modules.some((m) => m.type === type);
export const usedSlots = (b) => b.modules.filter((m) => m.type !== 'core').length;

export function power(b) {
    let prod = 0, use = 0;
    for (const m of b.modules) {
        const d = MODULES[m.type];
        if (d.power) prod += d.power * m.level;
        if (d.use) use += d.use * (m.type === 'silo' || m.type === 'beacon' ? 1 : Math.max(1, Math.ceil(m.level * 0.75)));
    }
    return { prod, use, eff: use <= 0 ? 1 : Math.min(1, prod / use) };
}

export function storageCap(b) { return BASE_START_STORAGE + moduleLevel(b, 'silo') * 250 + (coreLevel(b) - 1) * 50; }
export function storageUsed(b) { let n = 0; for (const k in b.storage) n += b.storage[k]; return n; }

export function canAfford(game, cost, where = 'base') {
    if (!cost) return false;
    for (const [k, v] of Object.entries(cost)) {
        if (k === 'credits') { if (game.s.credits < v) return false; }
        else if (game.have(k, where) < v) return false;
    }
    return true;
}

export function missing(game, cost, where = 'base') {
    const out = [];
    for (const [k, v] of Object.entries(cost || {})) {
        const have = k === 'credits' ? game.s.credits : game.have(k, where);
        if (have < v) out.push({ id: k, need: v, have });
    }
    return out;
}

// Pay from Hearth storage first, then from the ship's hold.
export function pay(game, cost) {
    for (const [k, v] of Object.entries(cost)) {
        if (k === 'credits') game.s.credits -= v;
        else game.take(k, v, 'base');
    }
}

export function buildCheck(game, type) {
    const b = game.s.base;
    const d = MODULES[type];
    if (!d) return { ok: false, why: 'Unknown module' };
    if (d.core > coreLevel(b)) return { ok: false, why: `Needs Command Core Lv ${d.core}` };
    if (d.unique && hasModule(b, type)) return { ok: false, why: 'Already built' };
    if (usedSlots(b) >= moduleSlots(coreLevel(b))) return { ok: false, why: 'No free module slots — upgrade the Command Core' };
    const cost = moduleCost(type, 1);
    if (!canAfford(game, cost)) return { ok: false, why: 'Not enough materials', cost };
    return { ok: true, cost };
}

export function build(game, type) {
    const c = buildCheck(game, type);
    if (!c.ok) return c;
    pay(game, c.cost);
    const b = game.s.base;
    b.modules.push({ uid: b.nextUid++, type, level: 1 });
    return { ok: true };
}

export function upgradeCheck(game, uid) {
    const b = game.s.base;
    const m = b.modules.find((x) => x.uid === uid);
    if (!m) return { ok: false, why: 'No such module' };
    const d = MODULES[m.type];
    if (m.level >= d.max) return { ok: false, why: 'Maximum level' };
    if (m.type !== 'core' && m.level >= moduleCap(coreLevel(b))) return { ok: false, why: `Needs Command Core Lv ${nextCoreFor(m.level + 1)}` };
    const cost = moduleCost(m.type, m.level + 1);
    if (!cost) return { ok: false, why: 'Maximum level' };
    if (!canAfford(game, cost)) return { ok: false, why: 'Not enough materials', cost };
    return { ok: true, cost, m };
}
const nextCoreFor = (lvl) => { for (let c = 1; c <= 8; c++) if (moduleCap(c) >= lvl) return c; return 8; };

export function upgrade(game, uid) {
    const c = upgradeCheck(game, uid);
    if (!c.ok) return c;
    pay(game, c.cost);
    c.m.level++;
    return { ok: true, m: c.m };
}

// Remove a module (refund nothing but frees the slot).
export function demolish(game, uid) {
    const b = game.s.base;
    const i = b.modules.findIndex((m) => m.uid === uid && m.type !== 'core');
    if (i < 0) return { ok: false };
    b.modules.splice(i, 1);
    return { ok: true };
}

// ------------------------------------------------------------------ production
export function tickBase(game, dt) {
    const b = game.s.base;
    const pw = power(b);
    const eff = pw.eff;
    const T = b.timers;
    const free = () => storageCap(b) - storageUsed(b);
    const add = (id, n) => { const k = Math.min(n, Math.max(0, free())); if (k > 0) { b.storage[id] = (b.storage[id] || 0) + k; b.produced[id] = (b.produced[id] || 0) + k; } return k; };

    // Refinery
    const ref = modulesOf(b, 'refinery')[0];
    if (ref) {
        T.refinery += dt * eff * (game.hasTech('refining') ? 1.3 : 1);
        const period = 6 / ref.level;
        let guard = 0;
        // Every period, each enabled recipe whose inputs are available runs one batch (parallel lines).
        while (T.refinery >= period && guard++ < 40) {
            T.refinery -= period;
            const keep = b.reserve ?? 20;
            let ran = 0;
            const cap = b.refCap ?? 150;
            for (const r of RECIPES) {
                if (!b.recipes[r.id] || r.minLevel > ref.level) continue;
                if (cap > 0 && Object.keys(r.out).every((id) => (b.storage[id] || 0) >= cap)) continue;
                if (!Object.entries(r.in).every(([id, n]) => (b.storage[id] || 0) >= n + (ITEMS[id].cat === 'raw' ? keep : 0))) continue;
                const outN = Object.values(r.out).reduce((s2, n) => s2 + n, 0);
                const inN = Object.values(r.in).reduce((s2, n) => s2 + n, 0);
                if (free() + inN < outN) continue;
                for (const [id, n] of Object.entries(r.in)) { b.storage[id] -= n; if (!b.storage[id]) delete b.storage[id]; }
                for (const [id, n] of Object.entries(r.out)) add(id, n);
                ran++;
            }
            if (!ran) { T.refinery = Math.min(T.refinery, period); break; }
        }
    }
    // Hydroponics
    const hydroL = moduleLevel(b, 'hydro');
    if (hydroL) {
        T.hydro += dt * eff;
        if (T.hydro >= 20) {
            T.hydro -= 20;
            add('rations', hydroL);
            if (hydroL >= 3) add('biogel', Math.floor(hydroL / 3));
        }
    }
    // Drones: each drone brings ore from the home belt every 30 s.
    const bay = modulesOf(b, 'drones')[0];
    if (bay && b.drones > 0) {
        T.drones += dt * eff;
        if (T.drones >= 30) {
            T.drones -= 30;
            const n = Math.min(b.drones, bay.level * 3) * (game.hasTech('swarm') ? 2 : 1);
            for (let i = 0; i < n; i++) {
                const r = game.rng.next();
                const id = r < 0.3 ? 'ferrite' : r < 0.55 ? 'silicate' : r < 0.72 ? 'ice' : r < 0.84 ? 'carbon' : r < 0.93 ? 'titanium' : 'cuprite';
                add(id, 3 + bay.level);
            }
        }
    }
    // Trade depot
    const depot = modulesOf(b, 'depot')[0];
    if (depot) {
        T.depot += dt * eff;
        if (T.depot >= 60) {
            T.depot -= 60;
            let earned = 0;
            for (const id of Object.keys(b.depot)) {
                if (!b.depot[id]) continue;
                const keep = 20;
                const have = b.storage[id] || 0;
                const n = Math.min(have - keep, 15 * depot.level);
                if (n <= 0) continue;
                b.storage[id] -= n;
                earned += Math.round(n * ITEMS[id].price * 0.75);
            }
            if (earned) { game.s.credits += earned; game.s.stats.depot = (game.s.stats.depot || 0) + earned; game.emit('toast', { text: `Trade Depot sold goods: +${earned} cr`, kind: 'good', quiet: true }); }
        }
    }
    // Raids while away from home.
    if (game.s.location.system !== game.galaxy.home && coreLevel(b) >= 2) {
        T.raid += dt;
        if (T.raid >= 900) {
            T.raid = 0;
            if (game.rng.chance(0.3)) raid(game);
        }
    } else T.raid = Math.min(T.raid, 600);
}

export function defenseRating(b) { return moduleLevel(b, 'defense') * 1.6; }

function raid(game) {
    const b = game.s.base;
    const strength = 1 + coreLevel(b) * 0.8 + game.rng.range(0, 1.5);
    const def = defenseRating(b);
    if (def >= strength) {
        b.raidLog = { t: game.s.time, repelled: true, lost: {} };
        game.emit('toast', { text: 'Hearth repelled a Reaver raid!', kind: 'good' });
        return;
    }
    const frac = Math.min(0.25, 0.08 + (strength - def) * 0.03);
    const lost = {};
    for (const id of Object.keys(b.storage)) {
        const n = Math.floor(b.storage[id] * frac);
        if (n > 0) { b.storage[id] -= n; lost[id] = n; }
    }
    b.raidLog = { t: game.s.time, repelled: false, lost };
    game.emit('toast', { text: 'Hearth was raided while you were away! Build a Defense Grid.', kind: 'bad' });
}

// ------------------------------------------------------------------ fabricator & research
export function fabCheck(game, id) {
    const r = FAB.find((f) => f.id === id);
    const b = game.s.base;
    if (!hasModule(b, 'fabricator')) return { ok: false, why: 'Build a Fabricator' };
    if (r.special === 'key' && !game.hasTech('exotic')) return { ok: false, why: 'Research Exotic Physics' };
    if (r.special === 'key' && game.s.story.shards < 3) return { ok: false, why: 'Requires three Precursor Shards' };
    if (r.special === 'key' && game.s.story.key) return { ok: false, why: 'Already forged' };
    if (r.special === 'drone') {
        const bay = modulesOf(b, 'drones')[0];
        if (!bay) return { ok: false, why: 'Build a Drone Bay' };
        if (b.drones >= bay.level * 3) return { ok: false, why: 'Drone Bay full — upgrade it' };
    }
    if (r.special === 'repair' && game.s.ship.hp >= game.stats().hullMax) return { ok: false, why: 'Hull already intact' };
    const fabL = modulesOf(b, 'fabricator')[0].level;
    if (id.startsWith('goods_') && fabL < 2) return { ok: false, why: 'Needs Fabricator Lv 2' };
    if (!canAfford(game, r.in)) return { ok: false, why: 'Not enough materials' };
    return { ok: true, r };
}

export function fabricate(game, id) {
    const c = fabCheck(game, id);
    if (!c.ok) return c;
    pay(game, c.r.in);
    const b = game.s.base;
    if (c.r.out) for (const [k, n] of Object.entries(c.r.out)) b.storage[k] = (b.storage[k] || 0) + n;
    if (c.r.special === 'repair') game.s.ship.hp = game.stats().hullMax;
    if (c.r.special === 'drone') b.drones++;
    if (c.r.special === 'key') game.s.story.key = true;
    return { ok: true, r: c.r };
}

export function labRate(b) { const lab = modulesOf(b, 'lab')[0]; return lab ? 0.5 + 0.15 * lab.level : 0; }

export function convertData(game, amount) {
    const b = game.s.base;
    const rate = labRate(b);
    if (!rate) return { ok: false, why: 'Build a Research Lab' };
    const n = Math.min(amount, Math.floor(game.s.data));
    if (n <= 0) return { ok: false, why: 'No data to convert' };
    game.s.data -= n;
    b.rp += n * rate;
    return { ok: true, rp: n * rate };
}

export function researchCheck(game, id) {
    const t = TECHS.find((x) => x.id === id);
    const b = game.s.base;
    if (!hasModule(b, 'lab')) return { ok: false, why: 'Build a Research Lab' };
    if (b.tech.includes(id)) return { ok: false, why: 'Researched' };
    if (t.req && !b.tech.includes(t.req)) return { ok: false, why: `Requires ${TECHS.find((x) => x.id === t.req).name}` };
    if (b.rp < t.rp) return { ok: false, why: 'Not enough research points' };
    return { ok: true, t };
}

export function research(game, id) {
    const c = researchCheck(game, id);
    if (!c.ok) return c;
    game.s.base.rp -= c.t.rp;
    game.s.base.tech.push(id);
    return { ok: true, t: c.t };
}
