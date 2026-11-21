// The tycoon half: buildings, villagers, hope, production and the Great Oven. Pure.

import {
    DAY_LEN, PLOTS_OPEN, LVL_MULT, UPGRADE_COST, BUILD_DAYS, UPGRADE_DAYS, HALL_HOUSING, HALL_COST, HOPE, POP,
    STAFF_BONUS, BAKE, WALL_COST, WALL_DAYS, HARVEST, RIPE_JITTER, IDLE, HARD,
} from '../config.js';
import { BUILDINGS, RES, STAFF, ADVENTURERS, ADV_MAX } from './data.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------------ queries
export const plotsOpen = (G) => PLOTS_OPEN[G.hall.lvl - 1];
/** Finished buildings (an upgrade in progress still counts at its current level). */
export const finished = (G) => G.plots.filter((p) => p.b && !(p.b.build > 0 && !p.b.up)).map((p) => p.b);
export const countOf = (G, kind, minLvl = 1) => finished(G).filter((b) => b.kind === kind && b.lvl >= minLvl).length;
export const levelsOf = (G, kind) => finished(G).filter((b) => b.kind === kind).reduce((a, b) => a + b.lvl, 0);
export const hasAny = (G, kind) => G.plots.some((p) => p.b && p.b.kind === kind);

/** Cost to reach `lvl` (1 = build it). */
export function costOf(kind, lvl = 1) {
    const base = BUILDINGS[kind].cost, k = UPGRADE_COST ** (lvl - 1), out = {};
    for (const r of RES) if (base[r]) out[r] = Math.round(base[r] * k);
    return out;
}
export const canAfford = (G, cost) => RES.every((r) => (G.res[r] || 0) >= (cost[r] || 0) - 1e-9);
export function pay(G, cost) { for (const r of RES) if (cost[r]) G.res[r] -= cost[r]; }
export function gain(G, got) { for (const r of RES) if (got[r]) G.res[r] = Math.max(0, G.res[r] + got[r]); }

export function housing(G) {
    let h = HALL_HOUSING * G.hall.lvl;
    for (const b of finished(G)) if (BUILDINGS[b.kind].housing) h += BUILDINGS[b.kind].housing * b.lvl;
    return h;
}

/** Villagers the town needs to run every building at full speed. The oven only needs hands while lit. */
export function workersNeeded(G) {
    let n = 0;
    for (const b of finished(G)) if (b.kind !== 'oven' || G.oven.lit) n += BUILDINGS[b.kind].workers * (1 + 0.5 * (b.lvl - 1));
    return n;
}
export const staffing = (G) => { const n = workersNeeded(G); return n <= 0 ? 1 : clamp(G.pop / n, 0, 1); };
export const hopeMult = (G) => 0.6 + (G.hope / 100) * 0.8;

/** Days (fractional) until the next invasion, or Infinity when none is scheduled. */
export const daysUntil = (G) => (G.daysLeft > 0 ? G.daysLeft - G.dayT / DAY_LEN : 0);

export function hopeTarget(G) {
    let t = HOPE.base + G.hopeBonus + (G.today?.hope || 0);
    for (const b of finished(G)) if (BUILDINGS[b.kind].hope) t += BUILDINGS[b.kind].hope * LVL_MULT[b.lvl - 1];
    // fear rises over the last four days before a siege (less in the epilogue: the town has seen it all)
    const fear = HOPE.fearMax * clamp((4 - daysUntil(G)) / 4, 0, 1) * (G.phase >= 4 ? 0.4 : 1);
    if (G.wall.hp < G.wall.max * 0.999 && G.phase < 4) t -= 4;
    return clamp(t - fear, 0, 100);
}

/** The bonus a staff member gives the building they work in. */
export function staffMult(G, plotIndex) {
    for (const id in G.staff) {
        const s = G.staff[id];
        if (s.joined && s.at === plotIndex) {
            const b = G.plots[plotIndex].b;
            return 1 + (STAFF[id].aff === b.kind ? STAFF_BONUS.affinity : STAFF_BONUS.other);
        }
    }
    return 1;
}

/** Everything a building would do per second right now: { make, use } (before running out of inputs). */
export function buildingRate(G, i) {
    const b = G.plots[i].b, def = BUILDINGS[b.kind];
    const out = { make: {}, use: {}, bake: 0 };
    if (!b || (b.build > 0 && !b.up)) return out;
    const k = LVL_MULT[b.lvl - 1] * staffing(G) * hopeMult(G) * staffMult(G, i) * (G.today?.mods?.[b.kind] || 1);
    if (def.make) for (const r in def.make) out.make[r] = def.make[r] * k;
    if (def.use) for (const r in def.use) out.use[r] = def.use[r] * LVL_MULT[b.lvl - 1] * staffing(G);
    if (def.tax) out.make.gold = (out.make.gold || 0) + def.tax * G.pop * k;
    if (b.kind === 'oven' && G.oven.lit && G.bake.pct < bakeCap(G)) {
        out.use.flour = BAKE.flour * LVL_MULT[b.lvl - 1];
        out.use.sugar = BAKE.sugar * LVL_MULT[b.lvl - 1];
        out.bake = BAKE.rate * k * (G.bake.honey ? BAKE.honey : 1);
    }
    return out;
}

/** Net per second for the whole town (for the HUD and the bot). */
export function rates(G) {
    const net = { gold: POP.tax * G.pop, flour: 0, sugar: 0, stone: 0, bake: 0 };
    for (let i = 0; i < G.plots.length; i++) {
        if (!G.plots[i].b) continue;
        const r = buildingRate(G, i);
        for (const k in r.make) net[k] += r.make[k];
        for (const k in r.use) net[k] -= r.use[k];
        net.bake += r.bake;
    }
    return net;
}

export const bakeCap = (G) => 25 * G.bake.ings.length;

// ------------------------------------------------------------------ one step of town life
/** Every building but the oven grows a harvest bubble: producers give a burst of what they make, the rest a few coins
 *  (rent, tips at the tavern, a sold cozy, a purse found on the lookout). */
export const HARVESTS = Object.keys(BUILDINGS).filter((k) => k !== 'oven');

/** Seconds this building's bubble takes to fill: its kind's own time, nudged by the plot it stands on. */
export const ripeTime = (b) => b.rt || BUILDINGS[b.kind].ripe || HARVEST.ripe;
export const ripeFor = (kind, plot) => +((BUILDINGS[kind].ripe || HARVEST.ripe) * RIPE_JITTER[plot % RIPE_JITTER.length]).toFixed(2);

/** What a tap on this building's ripe bubble would give right now. A slow bubble holds more. */
export function harvestValue(G, i) {
    const b = G.plots[i].b, out = {};
    if (!b) return out;
    const r = buildingRate(G, i), k = ripeTime(b) / HARVEST.ripe;
    for (const res in r.make) out[res] = Math.max(HARVEST.min, Math.round(r.make[res] * HARVEST.bonus * k));
    if (!Object.keys(out).length) out.gold = Math.round(HARVEST.coins * b.lvl * k);
    return out;
}
export const isRipe = (b) => !!b && (b.ripe || 0) >= ripeTime(b) && !(b.build > 0 && !b.up);

export function stepTown(G, dt) {
    // harvest bubbles fill on every working building
    for (let i = 0; i < G.plots.length; i++) {
        const b = G.plots[i].b;
        if (!b || (b.build > 0 && !b.up) || !HARVESTS.includes(b.kind)) continue;
        const rt = ripeTime(b);
        if ((b.ripe || 0) < rt) {
            b.ripe = (b.ripe || 0) + dt;
            if (b.ripe >= rt) { b.ripe = rt; G.events.push({ type: 'ripe', plot: i }); }
        }
    }
    // construction
    for (let i = 0; i < G.plots.length; i++) {
        const b = G.plots[i].b;
        if (b && b.build > 0) {
            b.build -= dt;
            if (b.build <= 0) {
                b.build = 0;
                if (b.up) { b.lvl++; b.up = false; }
                G.events.push({ type: 'built', plot: i, kind: b.kind, lvl: b.lvl });
            }
        }
    }
    for (const part of ['hall', 'wall']) {
        const s = G[part];
        if (s.build > 0) {
            s.build -= dt;
            if (s.build <= 0) {
                s.build = 0; s.lvl++;
                if (part === 'wall') resetWall(G);
                G.events.push({ type: 'built', part, lvl: s.lvl });
            }
        }
    }

    // production: each building runs only if it can pay its inputs this step
    G.res.gold += POP.tax * G.pop * dt;
    let starved = false;
    for (let i = 0; i < G.plots.length; i++) {
        if (!G.plots[i].b) continue;
        const r = buildingRate(G, i);
        const need = {};
        for (const k in r.use) need[k] = r.use[k] * dt;
        if (!canAfford(G, need)) { if (G.plots[i].b.kind === 'oven') starved = true; continue; }
        pay(G, need);
        for (const k in r.make) G.res[k] += r.make[k] * dt;
        if (r.bake) {
            const before = G.bake.pct;
            G.bake.pct = Math.min(bakeCap(G), G.bake.pct + r.bake * dt);
            for (const m of [25, 50, 75, 100]) if (before < m && G.bake.pct >= m) G.events.push({ type: 'bakeMilestone', pct: m });
        }
    }
    if (starved && !G.oven.starved) G.events.push({ type: 'ovenStarved' });
    G.oven.starved = starved;

    // hope drifts toward its target; villagers come when hopeful and room allows, leave when frightened
    const target = hopeTarget(G);
    G.hope += (target - G.hope) * Math.min(1, HOPE.approach * dt);
    const room = housing(G);
    if (G.hope >= POP.minHope && G.pop < room) G.pop = Math.min(room, G.pop + POP.grow * (G.hope / 50) * dt);
    else if (G.hope < POP.fleeHope && G.pop > 4) G.pop = Math.max(4, G.pop - POP.shrink * dt);
    if (G.pop > room) G.pop = Math.max(room, G.pop - POP.shrink * 2 * dt);
}

export function resetWall(G) {
    const max = wallMax(G);
    G.wall.max = max;
    G.wall.hp = max;
}
export const wallMax = (G) => [300, 520, 850, 1300, 1900][G.wall.lvl - 1];
export const wallArmor = (G) => Math.min(0.4, levelsOf(G, 'tailor') * BUILDINGS.tailor.armor);
export const advSlots = (G) => { const t = finished(G).filter((b) => b.kind === 'tavern'); return t.length ? Math.max(...t.map((b) => BUILDINGS.tavern.slots[b.lvl - 1])) : 0; };
export const advsHired = (G) => Object.values(G.advs).filter((a) => a.hired).length;
export const trainCost = (lvl) => Math.round(60 * 1.7 ** (lvl - 1));

/** Can this building go up a level right now (finished, below ★3, and affordable)? The view's "!" badge. */
export function canUpgrade(G, i) {
    const b = G.plots[i]?.b;
    return !!b && b.lvl < 3 && !(b.build > 0) && canAfford(G, costOf(b.kind, b.lvl + 1));
}
export const canUpgradeHall = (G) => G.hall.lvl < HALL_COST.length && !(G.hall.build > 0) && canAfford(G, HALL_COST[G.hall.lvl]);

// ------------------------------------------------------------------ time away and hard mode
/** What the town saved up while the player was away `sec` real seconds, or null for a short break. */
export function idleLoot(G, sec) {
    if (!(sec >= IDLE.min)) return null;
    const days = clamp(sec / IDLE.perDay, IDLE.minDays, IDLE.maxDays), eff = days * DAY_LEN;
    const r = rates(G), out = {};
    for (const k of RES) {
        const v = Math.round(Math.max(0, r[k]) * eff * IDLE.share);
        if (v > 0) out[k] = v;
    }
    out.gold = Math.max(out.gold || 0, Math.round(IDLE.floor * days));
    return out;
}

/** What a fallen hard-mode town leaves the next game: part of the stores, and part of what its buildings cost. */
export function legacyOf(G) {
    const out = {};
    for (const r of RES) out[r] = (G.res[r] || 0) * HARD.keep;
    for (const p of G.plots) {
        if (!p.b) continue;
        for (let l = 1; l <= p.b.lvl; l++) { const c = costOf(p.b.kind, l); for (const r in c) out[r] += c[r] * HARD.refund; }
    }
    for (const r of RES) out[r] = Math.round(out[r]);
    return out;
}

// ------------------------------------------------------------------ commands (the UI, the bot and the tests all come through here)
export function canBuild(G, plot, kind) {
    const def = BUILDINGS[kind];
    if (!def) return 'no such building';
    if (plot < 0 || plot >= plotsOpen(G)) return 'plot not open';
    if (G.plots[plot].b) return 'plot taken';
    if (def.unlock && !G.unlocks[def.unlock]) return 'locked';
    if (def.unique && hasAny(G, kind)) return 'only one';
    if (!canAfford(G, costOf(kind))) return 'too dear';
    return null;
}

export function townAct(G, c) {
    const fail = (why) => { G.events.push({ type: 'refused', cmd: c.t, why }); return false; };
    switch (c.t) {
        case 'build': {
            const why = canBuild(G, c.plot, c.kind);
            if (why) return fail(why);
            pay(G, costOf(c.kind));
            G.plots[c.plot].b = { kind: c.kind, lvl: 1, build: BUILD_DAYS * DAY_LEN, up: false, rt: ripeFor(c.kind, c.plot) };
            G.stats.built++;
            G.events.push({ type: 'build', plot: c.plot, kind: c.kind });
            return true;
        }
        case 'upgrade': {
            const b = G.plots[c.plot]?.b;
            if (!b || b.build > 0) return fail('busy');
            if (b.lvl >= 3) return fail('max level');
            const cost = costOf(b.kind, b.lvl + 1);
            if (!canAfford(G, cost)) return fail('too dear');
            pay(G, cost);
            b.up = true; b.build = UPGRADE_DAYS * DAY_LEN;
            G.events.push({ type: 'build', plot: c.plot, kind: b.kind, up: true });
            return true;
        }
        case 'collect': {
            const b = G.plots[c.plot]?.b;
            if (!isRipe(b)) return fail('not ripe');
            const got = harvestValue(G, c.plot);
            gain(G, got);
            b.ripe = 0;
            G.stats.collected = (G.stats.collected || 0) + 1;
            G.events.push({ type: 'collect', plot: c.plot, got });
            return true;
        }
        case 'collectAll': {
            let n = 0;
            for (let i = 0; i < G.plots.length; i++) if (isRipe(G.plots[i].b)) { townAct(G, { t: 'collect', plot: i }); n++; }
            return n > 0;
        }
        case 'demolish': {
            const b = G.plots[c.plot]?.b;
            if (!b || b.kind === 'oven') return fail('cannot');
            for (const id in G.staff) if (G.staff[id].at === c.plot) G.staff[id].at = null;
            G.plots[c.plot].b = null;
            G.events.push({ type: 'demolish', plot: c.plot });
            return true;
        }
        case 'assign': {
            const s = G.staff[c.staff];
            if (!s || !s.joined) return fail('not here');
            if (c.plot != null) {
                const b = G.plots[c.plot]?.b;
                if (!b || (b.build > 0 && !b.up)) return fail('nothing there');
                for (const id in G.staff) if (G.staff[id].at === c.plot) G.staff[id].at = null;
            }
            s.at = c.plot ?? null;
            G.events.push({ type: 'assign', staff: c.staff, plot: s.at });
            return true;
        }
        case 'hall': case 'wall': {
            const s = G[c.t];
            const costs = c.t === 'hall' ? HALL_COST : WALL_COST;
            if (s.build > 0 || s.lvl >= costs.length) return fail('busy');
            const cost = costs[s.lvl];
            if (!canAfford(G, cost)) return fail('too dear');
            pay(G, cost);
            s.build = (c.t === 'wall' ? WALL_DAYS : 0.5) * DAY_LEN;
            G.events.push({ type: 'build', part: c.t });
            return true;
        }
        case 'hire': {
            const a = G.advs[c.adv], def = ADVENTURERS[c.adv];
            if (!a || a.hired) return fail('cannot');
            if (def.phase > G.phase && G.phase < 4) return fail('not yet');
            if (def.needs && !G.quests.done[def.needs]) return fail('not yet');
            if (c.adv === 'tobias') return fail('quest');
            if (advsHired(G) >= advSlots(G)) return fail('no room');
            if (G.res.gold < def.cost) return fail('too dear');
            G.res.gold -= def.cost;
            a.hired = true;
            G.events.push({ type: 'hired', adv: c.adv });
            return true;
        }
        case 'train': {
            const a = G.advs[c.adv];
            if (!a || !a.hired || a.lvl >= ADV_MAX) return fail('cannot');
            const cost = trainCost(a.lvl);
            if (G.res.gold < cost) return fail('too dear');
            G.res.gold -= cost;
            a.lvl++;
            G.events.push({ type: 'trained', adv: c.adv, lvl: a.lvl });
            return true;
        }
        case 'oven': {
            if (!hasAny(G, 'oven')) return fail('no oven');
            G.oven.lit = !!c.on;
            G.events.push({ type: 'oven', on: G.oven.lit });
            return true;
        }
    }
    return null;   // not a town command
}
