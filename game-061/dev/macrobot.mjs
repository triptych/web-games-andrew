/**
 * macrobot.mjs — plays the whole progression through the real Game actions (build, refine,
 * research, upgrade, trade, warp, story), with flight replaced by time costs derived from ship
 * stats. Used by simtest.mjs to check the game can be finished and how long each milestone takes.
 */
import { Game } from '../js/sim/game.js';
import { getSystem, lyDist, route } from '../js/sim/galaxy.js';
import { ROCK_TYPES, RECIPES, ITEMS, MODULES, COMPONENTS, moduleCap, FAB } from '../js/config.js';
import * as base from '../js/sim/base.js';
import { jumpCost } from '../js/sim/ship.js';
import { complete as completeQuest } from '../js/sim/quests.js';

export function macroRun(seed, opts = {}) {
    const G = Game.create(seed);
    const gal = G.galaxy;
    const log = (...a) => { if (opts.verbose) console.log(`[${(G.s.time / 60).toFixed(1)}m]`, ...a); };
    const milestones = [];
    const mark = (k) => { if (!milestones.some((m) => m[0] === k)) { milestones.push([k, G.s.time]); log('★', k); } };
    const home = gal.home;
    const hearthId = `${home}:S0`;
    const spent = {};
    let activity = 'idle';
    const advance = (sec) => { spent[activity] = (spent[activity] || 0) + sec; advance0(sec); };
    const advance0 = (sec) => { let t = sec; while (t > 0) { const d = Math.min(5, t); G.tick(d); t -= d; } G.fx.length = 0; };
    const atHome = () => G.s.location.system === home;
    const dockHearth = () => { G.s.location.docked = hearthId; G.dock(hearthId); };
    const st = () => G.stats();
    const LIMIT = (opts.hours || 30) * 3600;

    // --- travel
    const jumpTo = (target) => {
        activity = 'jump';
        let guard = 0;
        while (G.s.location.system !== target && guard++ < 40) {
            const r = route(gal, G.s.location.system, target, st().warpRange);
            if (!r) return false;
            const next = r[1];
            const c = G.warpCheck(next);
            if (!c.ok) {
                // Refuel: at a station in this system, or scoop at the star.
                if (!refuelHere()) return false;
                continue;
            }
            G.s.location.docked = null;
            G.arrive(next, c.cost);
            advance(55);
        }
        return G.s.location.system === target;
    };
    const refuelHere = () => {
        if (st().scoopFuel) { const need = st().fuelMax - G.s.ship.fuel; G.s.ship.fuel = st().fuelMax; advance(30 + need * 4); return true; }
        const sys = G.system;
        const station = sys.stations.find((s) => s.kind !== 'hearth' && !gal.species[s.species]?.hostile);
        if (atHome()) { dockHearth(); if (G.refuel().ok) return true; }
        if (!station) return false;
        G.s.location.docked = station.id; G.dock(station.id);
        const r = G.refuel();
        advance(60);
        return r.ok;
    };
    const goHome = () => {
        activity = 'travel-home'; if (!atHome()) { if (G.recallCheck().ok) { G.arrive(home, 2); advance(40); } else jumpTo(home); } advance(50); dockHearth(); };

    // --- mining (time from laser rate, heat duty cycle and aiming overhead)
    const mineIn = (sysId, beltPred) => {
        activity = sysId === home ? 'mine-home' : 'mine-remote';
        const sys = getSystem(gal, sysId);
        const belt = sys.belts.find(beltPred) || sys.belts[0];
        if (!belt) return false;
        const S = st();
        const types = Object.keys(belt.comp).filter((k) => ROCK_TYPES[k].hard <= S.mineHard);
        if (!types.length) return false;
        G.s.location.docked = null;
        advance(40);
        let free = G.cargoFree();
        const rate = S.mineRate * 0.6;
        advance(free / rate);
        while (free > 0) {
            const t = G.rng.weighted(types, (k) => belt.comp[k]);
            const mix = ROCK_TYPES[t].mix;
            const n = Math.min(free, 12);
            for (let i = 0; i < n; i++) { const res = G.rng.weighted(Object.keys(mix), (k) => mix[k]); G.addCargo(res, 1); G.s.stats.minedTotal++; }
            free = G.cargoFree();
        }
        return true;
    };
    const scoopGas = () => {
        const S = st();
        if (!S.scoopGas) return false;
        G.s.location.docked = null;
        const free = G.cargoFree();
        advance(70 + free / 0.8);
        G.addCargo('helium3', free);
        return true;
    };
    const scanSystem = () => {
        activity = 'scan';
        const sys = G.system;
        let n = 0;
        for (const p of sys.planets) {
            if (G.s.scanned[p.id]) continue;
            G.s.scanned[p.id] = true;
            G.s.data += p.scanValue;
            G.s.stats.planetsScanned++;
            n++;
            advance(45);
            G.questEvent({ kind: 'scan', planet: p.id, system: sys.id });
        }
        for (const o of sys.pois) {
            if (G.s.poisDone[o.id] || (o.hidden && !st().scanHidden) || o.kind !== 'anomaly') continue;
            G.s.poisDone[o.id] = true;
            G.s.data += 30 + sys.danger * 8;
            G.addCargo('exotic', 2 + Math.floor(sys.danger / 2));
            advance(80);
        }
        return n;
    };

    // --- selling at the nearest friendly station in this system
    const RESERVE = { ferrite: 60, silicate: 60, ice: 60, carbon: 40, titanium: 60, cuprite: 50, helium3: 40, iridium: 999, voidstone: 999, exotic: 999, steel: 60, silicon: 40, coolant: 30, polymer: 40, alloy: 45, circuit: 45, lattice: 999, voidcore: 999, fuelcell: 20 };
    const doMissions = (station) => {
        // Take procure/mining jobs we can fill from the hold right now, and hand them in.
        for (const q of G.board()) {
            if ((q.type === 'procure' || q.type === 'mining') && G.cargoOf(q.target.item) >= q.need) {
                const r = G.accept(q);
                if (r.ok) { G.turnIn(r.q); G.s.stats.botMissions = (G.s.stats.botMissions || 0) + 1; }
            }
        }
    };
    // Take one flyable mission from this station's board and do it (time from jumps + on-site work).
    const runMission = (station) => {
        const canFight = G.s.ship.comps.weapon >= 2 && G.s.ship.comps.shield >= 2;
        const q = G.board().find((x) => ['deliver', 'survey', 'salvage', 'chart', 'envoy', ...(canFight ? ['bounty', 'clear'] : [])].includes(x.type) && (x.target.system === G.s.location.system || route(gal, G.s.location.system, x.target.system, st().warpRange)));
        if (!q) return false;
        const r = G.accept(q);
        if (!r.ok) return false;
        const from = G.s.location.system;
        if (q.target.system !== from && !jumpTo(q.target.system)) { G.abandon(r.q.id); return false; }
        activity = 'mission';
        advance(q.type === 'clear' || q.type === 'bounty' ? 260 : 160);
        delete G.s.missionCargo[r.q.id];
        completeQuest(G, r.q);
        G.s.stats.botMissions = (G.s.stats.botMissions || 0) + 1;
        return true;
    };
    const sellAt = (station, includeData = true) => {
        activity = 'trade';
        G.s.location.docked = station.id; G.dock(station.id);
        advance(40);
        doMissions(station);
        if (G.rng.chance(0.9)) { runMission(station); activity = 'trade'; if (G.s.location.system === Number(station.id.split(':')[0])) { G.s.location.docked = station.id; } }
        let total = 0;
        for (const id of Object.keys(G.s.cargo)) {
            const keep = ITEMS[id].cat === 'goods' ? 0 : 0;
            const n = G.cargoOf(id) - keep;
            if (n > 0 && !G.quote(id, station).taboo) { const r = G.sell(id, n); if (r.ok) total += r.total; }
        }
        if (includeData && G.hasTech('warp')) { const keepData = 80; if (G.s.data > keepData) { const d = G.s.data; G.s.data = keepData; const r = G.sellData(); G.s.data += d - keepData - 0; total += r.total || 0; } }
        G.refuel();
        G.repair();
        return total;
    };
    // Load surplus from storage into the hold for a sales run.
    const loadSurplus = () => {
        const b = G.s.base;
        dockHearth();
        for (const id of Object.keys(b.storage)) {
            const res = RESERVE[id] ?? 0;
            const n = Math.min(b.storage[id] - res, G.cargoFree());
            if (n > 0) G.load(id, n);
        }
    };

    // --- goals
    const needsFor = (cost) => (cost ? base.missing(G, cost) : []);
    const GOALS = [
        { k: 'build refinery', ok: () => base.hasModule(G.s.base, 'refinery'), check: () => base.buildCheck(G, 'refinery'), do: () => G.build('refinery'), cost: () => base.buildCheck(G, 'refinery').cost },
        { k: 'build lab', ok: () => base.hasModule(G.s.base, 'lab'), check: () => base.buildCheck(G, 'lab'), do: () => G.build('lab') },
        { k: 'build solar', ok: () => base.modulesOf(G.s.base, 'solar').length >= 1, check: () => base.buildCheck(G, 'solar'), do: () => G.build('solar') },
        { k: 'build shipyard', ok: () => base.hasModule(G.s.base, 'shipyard'), check: () => base.buildCheck(G, 'shipyard'), do: () => G.build('shipyard') },
        { k: 'research warp', ok: () => G.hasTech('warp'), check: () => (G.convertData(Infinity), base.researchCheck(G, 'warp')), do: () => G.research('warp') },
        { k: 'warp drive', ok: () => G.s.ship.comps.warp >= 1, check: () => G.compCheck('warp'), do: () => G.upgradeComp('warp') },
    ];
    const comp = (id, mk) => ({ k: `${id} mk${mk}`, ok: () => G.s.ship.comps[id] >= mk, check: () => G.compCheck(id), do: () => G.upgradeComp(id) });
    const mod = (type, lvl) => ({ k: `${type} lv${lvl}`, ok: () => (type === 'core' ? base.coreLevel(G.s.base) : base.modulesOf(G.s.base, type)[0]?.level || 0) >= lvl, check: () => { const m = G.s.base.modules.find((x) => x.type === type); return m ? base.upgradeCheck(G, m.uid) : base.buildCheck(G, type); }, do: () => { const m = G.s.base.modules.find((x) => x.type === type); return m ? G.upgradeModule(m.uid) : G.build(type); } });
    const build = (type, n = 1) => ({ k: `build ${type} #${n}`, ok: () => base.modulesOf(G.s.base, type).length >= n, check: () => base.buildCheck(G, type), do: () => G.build(type) });
    const tech = (id) => ({ k: `tech ${id}`, ok: () => G.hasTech(id), check: () => (G.convertData(Infinity), base.researchCheck(G, id)), do: () => G.research(id) });
    const hull = (n) => ({ k: `hull ${n}`, ok: () => G.s.ship.hull >= n, check: () => G.hullCheck(), do: () => G.upgradeHull() });
    const keyGoal = { k: 'lattice key', ok: () => G.s.story.key, check: () => { const c = base.fabCheck(G, 'key'); return { ...c, cost: FAB.find((f) => f.id === 'key').in }; }, do: () => G.fabricate('key') };
    const powerOk = () => { const p = base.power(G.s.base); return p.prod >= p.use + 4; };
    GOALS.push(
        mod('core', 2), build('silo'), build('fabricator'), mod('shipyard', 2), mod('refinery', 2), build('solar', 2), hull(2), comp('mining', 2), comp('cargo', 2), comp('scoop', 1),
        comp('warp', 2), comp('shield', 2), comp('weapon', 2), comp('scanner', 2), comp('tank', 2),
        mod('core', 3), mod('lab', 2), mod('core', 4), mod('shipyard', 3), build('solar', 3), mod('refinery', 3), hull(3), comp('mining', 3), comp('weapon', 3), comp('shield', 3), comp('cargo', 3),
        comp('scanner', 3), comp('warp', 3), comp('tank', 3), comp('scoop', 2), tech('refining'), tech('deepcore'),
        mod('core', 5), build('solar', 4), tech('advfab'), mod('shipyard', 4), mod('refinery', 4), comp('warp', 4), tech('exotic'), hull(4), comp('mining', 4), keyGoal, comp('cargo', 4),
        mod('core', 6), mod('shipyard', 5), comp('warp', 5), comp('tank', 4), build('beacon'), hull(5),
    );

    const tryGoals = () => {
        // Keep power healthy first.
        if (!powerOk()) { const s = base.modulesOf(G.s.base, 'solar'); const c = s.length && s[0].level < moduleCap(base.coreLevel(G.s.base)) ? base.upgradeCheck(G, s[0].uid) : base.buildCheck(G, 'solar'); if (c.ok) { s.length && s[0].level < moduleCap(base.coreLevel(G.s.base)) ? G.upgradeModule(s[0].uid) : G.build('solar'); log('power+'); } }
        let first = null;
        outer: for (const g of GOALS) {
            let guard = 0;
            while (!g.ok() && guard++ < 6) {
                const c = g.check();
                if (c.ok) { const r = g.do(); if (r.ok !== false) { log('✔', g.k); continue; } }
                first = { g, c };
                break outer; // follow the plan in order, like a player would
            }
            if (g.ok()) mark(g.k);
        }
        // Lattice Key once possible.
        if (G.s.story.shards >= 3 && G.hasTech('exotic') && !G.s.story.key) { const r = G.fabricate('key'); if (r.ok) mark('lattice key'); }
        if (G.s.ship.hp < st().hullMax) G.repair();
        G.refuel();
        return first;
    };

    // Which raw resources does a missing cost list ultimately need? (beyond what's in storage, above the refinery reserve)
    const rawNeeds = (miss) => {
        const want = {};
        const addWant = (id, n) => {
            if (id === 'credits') { want.credits = (want.credits || 0) + n; return; }
            if (ITEMS[id].cat === 'raw') { want[id] = (want[id] || 0) + n; return; }
            const r = RECIPES.find((x) => x.out[id] && x.id !== 'cell_ice' && x.id !== 'cell_he3') || RECIPES.find((x) => x.out[id]);
            if (!r) { want.credits = (want.credits || 0) + n * ITEMS[id].price; return; }
            const k = Math.ceil(n / Object.values(r.out)[0]);
            for (const [inId, m] of Object.entries(r.in)) {
                const haveIn = ITEMS[inId].cat === 'raw' ? 0 : G.have(inId, 'base');
                addWant(inId, Math.max(0, m * k - haveIn));
            }
        };
        for (const m of miss) addWant(m.id, m.need - m.have);
        const out = {};
        const reserve = G.s.base.reserve ?? 20;
        for (const [id, n] of Object.entries(want)) {
            if (id === 'credits') { out.credits = n; continue; }
            const gap = n + reserve - G.have(id, 'base');
            if (gap > 0) out[id] = gap;
        }
        return out;
    };
    const enableRecipes = () => { G.s.base.refCap = 60; for (const r of RECIPES) G.s.base.recipes[r.id] = r.id !== 'cell_ice' || (G.s.ship.comps.warp > 0 && !st().scoopFuel); };

    // Systems with a belt containing a rock type.
    const findBeltSystem = (rock) => {
        let best = null, bd = Infinity;
        for (const s of gal.systems) {
            if (s.id === gal.core) continue;
            const sys = getSystem(gal, s.id);
            if (!sys.belts.some((b) => b.comp[rock])) continue;
            const r = route(gal, G.s.location.system, s.id, st().warpRange);
            if (!r) continue;
            const d = r.length * 100 + lyDist(gal.systems[G.s.location.system], s);
            if (d < bd) { bd = d; best = s.id; }
        }
        return best;
    };
    const exploreOnce = () => {
        // Jump to the nearest unvisited system in range; scan; sell at a station there.
        const here = gal.systems[G.s.location.system];
        const cands = gal.systems.filter((s) => s.id !== gal.core && !G.s.visited.includes(s.id) && lyDist(s, here) <= st().warpRange).sort((a, b) => lyDist(a, here) - lyDist(b, here));
        const target = cands[0]?.id ?? gal.systems.filter((s) => s.id !== gal.core && !G.s.visited.includes(s.id)).sort((a, b) => lyDist(a, here) - lyDist(b, here))[0]?.id;
        if (target == null || !jumpTo(target)) return false;
        scanSystem();
        const station = G.system.stations.find((s) => s.kind !== 'hearth' && !gal.species[s.species]?.hostile);
        if (station) sellAt(station);
        return true;
    };

    // Standing: trade at the two nearest friendly species' home stations.
    const befriend = () => {
        // The nearest reachable station of a species we're not yet Friendly with.
        let best = null, bd = Infinity;
        for (const sys of gal.systems) {
            if (!sys.hasStation || sys.owner < 0 && sys.id !== home) continue;
            const spId = sys.id === home ? sys.stationSpecies : sys.owner;
            const sp = gal.species[spId];
            if (!sp || sp.hostile || G.standing(spId) >= 25) continue;
            const r = route(gal, G.s.location.system, sys.id, st().warpRange);
            if (!r) continue;
            const d = r.length * 100 + lyDist(gal.systems[G.s.location.system], sys);
            if (d < bd) { bd = d; best = sys.id; }
        }
        if (best == null) { log('befriend: nothing reachable'); return false; }
        goHome(); loadSurplus();
        if (!jumpTo(best)) { log('befriend: jump failed', 'fuel', G.s.ship.fuel); return false; }
        const station = G.system.stations.find((s) => s.kind !== 'hearth' && s.species >= 0 && !gal.species[s.species].hostile);
        if (!station) return false;
        sellAt(station);
        // A local mission's worth of standing and pay (procure/deliver approximated).
        G.addStanding(station.species, 4);
        advance(240);
        G.s.credits += 500;
        return true;
    };

    // ---------------------------------------------------------------- main loop
    G.s.location.docked = hearthId;
    let stuck = 0, lastStage = -1, lastProgress = 0, iter = 0, lastGoalK = null;
    while (G.s.time < LIMIT && !G.s.story.done && iter++ < 20000) {
        enableRecipes();
        if (atHome()) dockHearth();
        const first = tryGoals();
        if (G.s.story.stage !== lastStage) { lastStage = G.s.story.stage; lastProgress = G.s.time; mark(`stage ${lastStage} ${G.stage()?.title || 'done'}`); }
        if (G.s.time - lastProgress > (opts.stall || 12) * 3600) break;
        const stage = G.stage()?.id;
        // Story-driven trips once gear allows.
        if (stage === 'firstlight' || stage === 'foundations' || stage === 'business' || stage === 'eyes' || stage === 'bubble') {
            if (stage === 'business') { goHome(); loadSurplus(); if (!Object.keys(G.s.cargo).length) mineIn(home, (b) => !b.outer); sellAt(G.system.stations[1]); goHome(); G.unloadAll(); continue; }
            if (stage === 'eyes' && base.hasModule(G.s.base, 'lab') && G.s.stats.planetsScanned < 3) { scanSystem(); continue; }
            if (stage === 'bubble' && G.s.ship.comps.warp >= 1) {
                if (G.s.ship.fuel < 2) { dockHearth(); G.refuel(); if (G.s.ship.fuel < 2) { const wp = G.system.stations[1]; G.s.location.docked = wp.id; G.dock(wp.id); G.refuel(); } }
                const near = gal.systems.filter((s) => s.id !== home && lyDist(s, gal.systems[home]) <= st().warpRange).sort((a, b) => lyDist(a, gal.systems[home]) - lyDist(b, gal.systems[home]))[0];
                if (near && G.warpCheck(near.id).ok) { G.arrive(near.id, G.warpCheck(near.id).cost); advance(60); scanSystem(); goHome(); continue; }
            }
        }
        if (stage === 'echoes' && st().warpRange > 0) { if (jumpTo(G.plan.sites[0].system)) { advance(150); G.s.story.shards = Math.max(1, G.s.story.shards); mark('shard 1'); scanSystem(); goHome(); continue; } }
        if (stage === 'friends') { if (befriend()) { goHome(); continue; } }
        if (stage === 'warlord' && G.s.ship.comps.weapon >= 3 && G.s.ship.comps.shield >= 3) { if (jumpTo(G.plan.sites[1].system)) { advance(360); G.s.story.shards = Math.max(2, G.s.story.shards); mark('shard 2'); goHome(); continue; } }
        if (stage === 'deep' && G.s.ship.comps.scanner >= 3 && G.s.ship.comps.shield >= 3) { if (jumpTo(G.plan.sites[2].system)) { advance(360); G.s.story.shards = 3; mark('shard 3'); goHome(); continue; } }
        if (stage === 'heart' && G.s.ship.comps.warp >= 5 && G.s.story.key) { G.s.ship.fuel = st().fuelMax; if (jumpTo(gal.core)) { advance(420); G.s.story.done = true; mark('ending'); break; } }

        // Otherwise: work toward the first unmet goal.
        if (first && /slots|Command Core Lv/.test(first.c.why || '')) { const cc = base.upgradeCheck(G, G.s.base.modules[0].uid); if (cc.ok) { G.upgradeModule(G.s.base.modules[0].uid); mark(`core lv${base.coreLevel(G.s.base)}`); continue; } first.c = cc; }
        const miss = first ? needsFor(first.c.cost) : [];
        const lastGoalK0 = lastGoalK; lastGoalK = first?.g.k;
        if (opts.verbose && (iter % (opts.every || 25) === 0 || (first && first.g.k !== lastGoalK0))) log('goal', first?.g.k, first?.c.why, JSON.stringify(miss), 'cr', G.s.credits, 'store', JSON.stringify(G.s.base.storage));
        const need = rawNeeds(miss);
        if (!first) { exploreOnce() || mineIn(home, (b) => !b.outer); goHome(); G.unloadAll(); continue; }
        const why = first.c.why || '';
        if (/slots|Command Core Lv/.test(why)) { const cc = base.upgradeCheck(G, G.s.base.modules[0].uid); first.c = cc; if (cc.ok) { G.upgradeModule(G.s.base.modules[0].uid); continue; } }
        if (/Research|research points/.test(why)) {
            // Need data: scan home, then explore.
            if (G.system.planets.some((p) => !G.s.scanned[p.id])) { scanSystem(); continue; }
            if (st().warpRange > 0) { exploreOnce(); goHome(); continue; }
        }
        const metalNeed = ['ferrite', 'silicate', 'titanium', 'cuprite'].reduce((s, k) => s + (need[k] || 0), 0);
        const iceNeed = ['ice', 'carbon'].reduce((s, k) => s + (need[k] || 0), 0);
        const remote = ['iridium', 'voidstone', 'exotic'].find((k) => (need[k] || 0) > 0);
        if (remote && st().warpRange > 0) {
            if (remote === 'exotic') { exploreOnce(); goHome(); G.unloadAll(); continue; }
            const rock = remote === 'iridium' ? 'iridium' : 'void';
            if (ROCK_TYPES[rock].hard <= st().mineHard) {
                const sid = findBeltSystem(rock);
                if (sid != null && jumpTo(sid)) { mineIn(sid, (b) => !!b.comp[rock]); scanSystem(); goHome(); G.unloadAll(); continue; }
            }
        }
        if ((need.helium3 || 0) > 0 && st().scoopGas) { scoopGas(); goHome(); G.unloadAll(); continue; }
        const crNeed = first.c.cost?.credits || 0;
        if ((need.credits || 0) > 0 && ((need.credits || 0) / Math.max(1, crNeed) > 0.25 || metalNeed + iceNeed === 0)) {
            // Cash run: haul surplus + a fresh hold to the best buyer (Waypost, or explore once warp is up).
            goHome(); loadSurplus();
            if (G.cargoFree() > 10) mineIn(home, (b) => !b.outer);
            if (st().warpRange > 0 && G.rng.chance(0.5)) exploreOnce();
            else sellAt(getSystem(gal, home).stations[1]);
            goHome(); G.unloadAll();
            continue;
        }
        // Mine whichever home belt best yields what the goal needs.
        const hs = getSystem(gal, home);
        const beltScore = (b) => {
            let sc = 0, tot = 0;
            for (const [rk, w] of Object.entries(b.comp)) { if (ROCK_TYPES[rk].hard > st().mineHard) continue; tot += w; for (const [res, f] of Object.entries(ROCK_TYPES[rk].mix)) sc += w * f * Math.min(1, (need[res] || 0) / 40); }
            return tot ? sc / tot : 0;
        };
        const bestBelt = hs.belts.reduce((a, b) => (beltScore(b) > beltScore(a) ? b : a));
        mineIn(home, (b) => b === bestBelt);
        goHome();
        G.unloadAll();
        // Waiting on the refinery: let time pass a little.
        if (metalNeed + iceNeed === 0 && miss.every((m) => m.id !== 'credits' && ITEMS[m.id]?.cat === 'refined')) { activity = 'wait-refinery'; advance(60); }
    }
    if (G.s.story.done) mark('ending');
    if (opts.verbose) console.log('time spent (min):', JSON.stringify(Object.fromEntries(Object.entries(spent).map(([k, v]) => [k, Math.round(v / 60)]))), 'bot missions', G.s.stats.botMissions || 0, 'credits', G.s.credits);
    return { finished: !!G.s.story.done, time: G.s.time, milestones, stuck: G.stage()?.title || '', game: G, spent };
}
