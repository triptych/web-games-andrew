// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the UI and the bot change it only through act().
//
// The town is an economy, not a physics body: one step is a tenth of a second, and every system
// is written to cope with a much longer dt, which is how offline progress works (see offline()).

import { START, HALL_POS, BOUNDS, OFFLINE, DAY_LEN } from '../config.js';
import { makeRng } from '../rng.js';
import { ITEMS } from './data/items.js';
import { JOURNAL_IDS } from './data/journal.js';
import {
    nextId, recomputeMods, cozyOf, dayOf, hourOf, clamp, stock, push,
} from './core.js';
import { makeTerrain, makeNodes, rebuildOcc, NODE_KINDS } from './world.js';
import { makeVillager, tickNewcomers, arrivalInterval, autoAssign } from './townsfolk.js';
import { tickBuilds, tickProduction, tickMarket, refreshNear } from './production.js';
import { tickHeroes } from './heroes.js';
import { refreshBoard, tickParties, autoDispatch } from './quests.js';
import { tickJournal } from './journal.js';
import { tickCalendar, scheduleRaid } from './events.js';
import { act } from './commands.js';

export { act };

export const SAVE_VERSION = 1;

function freshStats() {
    return {
        hits: 0, felled: 0, goldEarned: 0, gathered: 0, crafted: {}, cooked: 0, cookedItem: {}, craftedCat: {}, tierMade: 0, sold: 0, soldGold: 0, tavernGold: 0, innGold: 0,
        marketGold: 0, marketSold: 0, questsDone: 0, questsPart: 0, questsFailed: 0, questGold: 0, regionDone: {}, raidsHeld: 0, raidsLost: 0, maxHeroLv: 0, renownEarned: 0,
        bossDown: false, placed: 0,
    };
}

export function blankBuilding(G, type, x, y, lv = 1) {
    return { id: nextId(G), type, x, y, lv, workers: [], bld: null, acc: {}, job: null, queue: [], auto: {}, near: 0 };
}

export function newGame(seed = 1, opts = {}) {
    const rng = makeRng(seed);
    const terr = makeTerrain();
    const G = {
        v: SAVE_VERSION, seed, rng, nid: 0, t: 0, day: 1, hour: 6,
        gold: START.gold, renown: 0, inv: { wood: START.wood, stone: START.stone },
        buildings: [], nodes: makeNodes(seed, terr), villagers: [], heroes: [], recruits: [], visitors: [], board: [], parties: [],
        shelves: [], priceMul: {}, autoSell: {}, upgrades: {}, journal: {}, pinned: null,
        stats: freshStats(), flags: {}, opts: { raidMul: opts.raidMul || 1 }, weather: 'clear', festival: false, merchant: null, raid: null,
        mods: {}, cozy: 0, cozyT: 0, arriveT: 0, autoT: 2, jT: 1, assignT: 5, marketBudget: 0, bounds: { ...BOUNDS[0] },
        events: [], terr, occ: null, quiet: false, sum: null,
    };
    recomputeMods(G);
    G.buildings.push(blankBuilding(G, 'hall', HALL_POS.x, HALL_POS.y, 1));
    rebuildOcc(G);
    const mabel = makeVillager(G, 1);
    Object.assign(mabel, { name: 'Mabel Thatch', look: { skin: 1, hair: 3, style: 1, outfit: 1, hat: 3 }, skills: { lumber: 2, farming: 1 }, trait: 'hardy' });
    G.villagers.push(mabel);
    G.arriveT = arrivalInterval(G) * 0.6;
    scheduleRaid(G, 5);
    G.cozy = cozyOf(G);
    refreshNear(G);
    return G;
}

function tickNodes(G, dt) {
    for (const n of G.nodes) {
        if (n.regrow > 0) { n.regrow -= dt; if (n.regrow <= 0) { n.regrow = 0; n.hp = NODE_KINDS[n.k].hp; } }
    }
}

/** Advance the town by dt seconds. inp is unused: the town is steered through act(). */
export function step(G, inp, dt) {
    tickCalendar(G, dt);
    tickBuilds(G, dt);
    tickProduction(G, dt);
    tickMarket(G, dt);
    tickHeroes(G, dt);
    tickParties(G, dt);
    tickNewcomers(G, dt);
    tickNodes(G, dt);
    G.autoT -= dt;
    if (G.autoT <= 0) { G.autoT = 3; autoDispatch(G); }
    G.jT -= dt;
    if (G.jT <= 0) { G.jT = 1; tickJournal(G); }
    G.assignT -= dt;
    if (G.assignT <= 0) { G.assignT = 8; autoAssign(G); }
}

// ---------------------------------------------------------------- saving
export function serialize(G) {
    const { rng, events, terr, occ, quiet, sum, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_VERSION || !Array.isArray(d.buildings)) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [], terr: makeTerrain(), occ: null, quiet: false, sum: null };
    G.rng.setState(rngState);
    rebuildOcc(G);
    recomputeMods(G);
    G.cozy = cozyOf(G);
    refreshNear(G);
    return G;
}

// ---------------------------------------------------------------- offline progress
export function offlineLimits(G) {
    const hrs = OFFLINE.capHours + G.mods.offlineHrs;
    const eff = Math.min(0.9, OFFLINE.eff + G.mods.offlineEff);
    return { hrs, eff };
}

/**
 * Catch the town up after the player has been away. The time away is capped and scaled by an
 * efficiency, then simulated for real in coarse steps, so heroes eat, sleep, quest and get raided
 * exactly as they would online. Returns a summary for the "welcome back" sheet, or null.
 */
export function offline(G, awaySec) {
    if (!(awaySec >= OFFLINE.minAway)) return null;
    const { hrs, eff } = offlineLimits(G);
    const capped = Math.min(awaySec, hrs * 3600);
    const total = capped * eff;
    const before = {
        gold: G.gold, inv: { ...G.inv }, renown: G.renown, day: G.day, pop: G.villagers.length, heroes: G.heroes.length,
        quests: G.stats.questsDone, part: G.stats.questsPart, failed: G.stats.questsFailed, raids: G.stats.raidsHeld, lost: G.stats.raidsLost,
        lv: G.heroes.map((h) => h.lv).reduce((a, b) => a + b, 0), journal: Object.values(G.journal).filter((s) => s === 'ready').length,
    };
    G.quiet = true;
    G.sum = { notes: [] };
    const dt = Math.max(OFFLINE.step, total / 24000);
    let done = 0;
    while (done < total - 1e-9) {
        const d = Math.min(dt, total - done);
        step(G, null, d);
        done += d;
    }
    G.quiet = false;
    const notes = G.sum.notes;
    G.sum = null;
    G.events.length = 0;
    const gained = {};
    for (const k of new Set([...Object.keys(before.inv), ...Object.keys(G.inv)])) {
        const dlt = (G.inv[k] || 0) - (before.inv[k] || 0);
        if (dlt !== 0) gained[k] = dlt;
    }
    return {
        away: awaySec, capped: awaySec > capped, simulated: total, eff, days: G.day - before.day,
        gold: G.gold - before.gold, renown: G.renown - before.renown, items: gained, newVillagers: G.villagers.length - before.pop, newHeroes: G.heroes.length - before.heroes,
        quests: G.stats.questsDone - before.quests, partial: G.stats.questsPart - before.part, failed: G.stats.questsFailed - before.failed,
        raidsHeld: G.stats.raidsHeld - before.raids, raidsLost: G.stats.raidsLost - before.lost,
        levels: G.heroes.map((h) => h.lv).reduce((a, b) => a + b, 0) - before.lv,
        journal: Object.values(G.journal).filter((s) => s === 'ready').length - before.journal, notes,
    };
}
