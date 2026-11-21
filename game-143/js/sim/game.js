// The simulation: the day cycle, quests and story, and the hand-off between the town and the siege.
// Pure: no DOM, no Math.random, no clock. The view reads G and drains G.events; the UI, the bot and the
// tests change it only through act(G, cmd) and step(G, inp, dt).

import { DAY_LEN, PHASE_DAYS, EPI_DAYS, RETRY_DAYS, PLOTS, START, MODES } from '../config.js';
import { makeRng } from '../rng.js';
import { QUESTS, STAFF_ORDER, ADV_ORDER, DAY_EVENTS, BUILDINGS, RES } from './data.js';
import { stepTown, townAct, countOf, advsHired, canAfford, pay, gain, resetWall, wallMax, ripeFor, idleLoot, legacyOf } from './town.js';
import { newBattle, stepBattle, battleAct } from './battle.js';

const EVENT_CAP = 400;   // a headless run that never drains still can't grow without bound

/**
 * A new game. opts.mode: 'story' (the town runs itself, you hold the wall), 'normal', or 'hard' (if the wall falls
 * the game is over). opts.legacy: resources a fallen hard-mode town left behind, added to the starting stores.
 */
export function newGame(seed = 1, opts = {}) {
    const legacy = opts.legacy || null;
    const G = {
        v: 1, seed, rng: makeRng(seed), t: 0,
        diff: MODES.includes(opts.mode) ? opts.mode : 'normal',
        legacy,                       // what this game started with from the last one (for the welcome line)
        over: false,                  // hard mode: the wall fell
        mode: 'town',                 // town | battle
        phase: 0,                     // 0..3 the four invasions; 4 the epilogue
        day: 1, dayT: 0, daysLeft: PHASE_DAYS[0],
        today: null,
        res: Object.fromEntries(RES.map((r) => [r, START[r] + Math.max(0, legacy?.[r] || 0)])),
        pop: START.pop, hope: START.hope, hopeBonus: 0,
        plots: Array.from({ length: PLOTS }, () => ({ b: null })),
        hall: { lvl: 1, build: 0 },
        wall: { lvl: 1, build: 0, hp: 0, max: 0 },
        oven: { lit: false, starved: false },
        bake: { pct: 0, ings: [], honey: false },
        unlocks: {},
        staff: Object.fromEntries(STAFF_ORDER.map((id) => [id, { joined: id === 'vellum', at: null }])),
        advs: Object.fromEntries(ADV_ORDER.map((id) => [id, { hired: false, lvl: 1 }])),
        quests: { active: [], done: {}, paid: {} },
        battle: null, retries: 0, ended: false,
        epi: { waves: 0, best: 0 },
        stats: { built: 0, calmed: 0, wavesWon: 0, wavesLost: 0, quests: 0, collected: 0, idle: 0 },
        flags: { intro: false },
        speed: 1,
        events: [],
    };
    // the first plot starts with a cottage: the Mayor's own, since the castle is a bakery museum now
    G.plots[0].b = { kind: 'cottage', lvl: 1, build: 0, up: false, rt: ripeFor('cottage', 0) };
    resetWall(G);
    return G;
}

// ------------------------------------------------------------------ quests
export const questDef = (id) => QUESTS.find((q) => q.id === id);
export const needsDeliver = (q) => q.obj.kind === 'pay' || !!q.obj.pay;
export const deliverCost = (q) => (q.obj.kind === 'pay' ? q.obj.cost : q.obj.pay);

/** Is the objective met, apart from any delivery? */
export function objectiveMet(G, q) {
    const o = q.obj;
    switch (o.kind) {
        case 'build': return countOf(G, o.what) >= (o.n || 1) && (!o.and || countOf(G, o.and) > 0);
        case 'lvl': return countOf(G, o.what, o.lvl) > 0;
        case 'wall': return G.wall.lvl >= o.lvl;
        case 'hope': return G.hope >= o.v;
        case 'advs': return advsHired(G) >= o.n;
        case 'bake': return G.bake.pct >= o.pct;
        case 'pay': return true;
    }
    return false;
}
export const questReady = (G, q) => objectiveMet(G, q) && (!needsDeliver(q) || G.quests.paid[q.id]);

function activateQuests(G) {
    for (const q of QUESTS) {
        if (G.quests.active.length >= 5 && !q.main) continue;
        if (q.phase > G.phase || G.quests.done[q.id] || G.quests.active.includes(q.id)) continue;
        if (q.needs && !q.needs.every((n) => G.quests.done[n])) continue;
        G.quests.active.push(q.id);
        const what = q.obj.what && BUILDINGS[q.obj.what];
        if (what?.unlock) G.unlocks[what.unlock] = true;
        G.events.push({ type: 'questNew', id: q.id });
    }
}

function completeQuests(G) {
    for (let i = G.quests.active.length - 1; i >= 0; i--) {
        const q = questDef(G.quests.active[i]);
        if (!questReady(G, q)) continue;
        G.quests.active.splice(i, 1);
        G.quests.done[q.id] = true;
        G.stats.quests++;
        const r = q.reward;
        gain(G, r);
        if (r.staff) G.staff[r.staff].joined = true;
        if (r.adv) G.advs[r.adv].hired = true;
        if (r.hopeBonus) G.hopeBonus += r.hopeBonus;
        if (r.ing && !G.bake.ings.includes(r.ing)) G.bake.ings.push(r.ing);
        if (r.honey) G.bake.honey = true;
        G.events.push({ type: 'questDone', id: q.id });
    }
}

// ------------------------------------------------------------------ the day cycle
function newDay(G) {
    G.day++;
    G.dayT = 0;
    G.daysLeft--;
    G.today = null;
    if (G.daysLeft <= 0) { startBattle(G); return; }
    if (G.rng() < 0.55) {
        const ev = G.rng.pick(DAY_EVENTS);
        G.today = { id: ev.id, mods: ev.mods || null, hope: ev.hope || 0 };
        if (ev.trade && canAfford(G, { flour: -ev.trade.flour })) gain(G, ev.trade);
    }
    G.events.push({ type: 'day', day: G.day, daysLeft: G.daysLeft, ev: G.today?.id || null });
}

function startBattle(G) {
    G.mode = 'battle';
    G.battle = newBattle(G);
    G.events.push({ type: 'invasion', wave: G.battle.wave, epi: G.battle.epi, readyAll: G.battle.readyAll });
}

function endBattle(G) {
    const B = G.battle, res = B.result;
    const summary = { type: 'battleEnd', result: res, wave: B.wave, epi: B.epi, calmed: B.calmed, gold: 0, sugar: 0 };
    G.wall.hp = Math.max(1, (B.wall.hp / B.wall.max) * G.wall.max);
    if (res === 'win' || res === 'love') {
        summary.gold = 60 + 40 * (B.epi ? 2 + Math.min(B.n, 6) : B.wave) + B.loot.gold;
        summary.sugar = B.loot.sugar;
        gain(G, { gold: summary.gold, sugar: summary.sugar });
        G.retries = 0;
        if (B.epi) {
            G.epi.waves++;
            G.epi.best = Math.max(G.epi.best, G.epi.waves);
            G.daysLeft = EPI_DAYS;
        } else if (res === 'love') {
            G.phase = 4; G.ended = true; G.unlocks.ginger = true;
            G.daysLeft = EPI_DAYS; G.hopeBonus += 10;
            G.wall.hp = G.wall.max;
        } else {
            G.stats.wavesWon++;
            G.phase++;
            G.hopeBonus += 3;
            G.daysLeft = PHASE_DAYS[G.phase];
        }
    } else if (res === 'retreat') {
        G.daysLeft = RETRY_DAYS;
    } else if (G.diff === 'hard') {   // hard mode: the wall fell, and that's the end of this Thistlegloom
        G.stats.wavesLost++;
        G.over = true;
        summary.result = 'over';
        summary.legacy = legacyOf(G);
    } else {   // lose: the horde gets into the edge of town, then wanders off with the snacks
        G.stats.wavesLost++;
        G.retries++;
        const built = G.plots.filter((p) => p.b && p.b.lvl > 1 && !(p.b.build > 0));
        for (let i = 0; i < 1 && built.length; i++) {
            const p = built.splice(Math.floor(G.rng() * built.length), 1)[0];
            p.b.lvl--;
        }
        for (const r of RES) G.res[r] *= 0.85;
        G.hope = Math.max(0, G.hope - 10);
        G.daysLeft = RETRY_DAYS;
    }
    G.battle = null;
    G.mode = 'town';
    G.dayT = 0;
    G.events.push(summary);
}

// ------------------------------------------------------------------ the loop
/** Advance one fixed step. inp = { ax, aim, fire } (only the siege reads it). */
export function step(G, inp, dt) {
    if (G.over) return;
    if (!G.flags.intro) { G.flags.intro = true; G.events.push({ type: 'scene', id: 'intro' }); }
    G.t += dt;
    if (G.mode === 'battle') {
        stepBattle(G, inp || {}, dt);
        if (G.battle.result && G.battle.resultT >= 2.5) endBattle(G);
    } else {
        stepTown(G, dt);
        G.wall.hp = Math.min(G.wall.max, G.wall.hp + (G.wall.max * 0.3 / DAY_LEN) * dt);
        G.dayT += dt;
        if (G.dayT >= DAY_LEN) newDay(G);
        // quests every step is cheap: there are only a handful
        activateQuests(G);
        completeQuests(G);
    }
    if (G.events.length > EVENT_CAP) G.events.splice(0, G.events.length - EVENT_CAP);
}

/** Commands. Returns true when it did something. */
export function act(G, c) {
    if (c.t === 'ability' || c.t === 'queen') return battleAct(G, c);
    if (G.over) return false;
    if (c.t === 'speed') { G.speed = [0, 1, 2, 3].includes(c.v) ? c.v : 1; return true; }
    if (c.t === 'idle') {
        // the player was away c.sec real seconds: the town saved some of its takings
        const got = idleLoot(G, c.sec);
        if (!got) return false;
        gain(G, got);
        G.stats.idle = (G.stats.idle || 0) + 1;
        G.events.push({ type: 'idle', sec: c.sec, got });
        return true;
    }
    if (G.mode !== 'town') return false;
    if (c.t === 'deliver') {
        const q = questDef(c.id);
        if (!q || !G.quests.active.includes(q.id) || !needsDeliver(q) || G.quests.paid[q.id]) return false;
        if (!objectiveMet(G, q)) { G.events.push({ type: 'refused', cmd: 'deliver', why: 'not yet' }); return false; }
        const cost = deliverCost(q);
        if (!canAfford(G, cost)) { G.events.push({ type: 'refused', cmd: 'deliver', why: 'too dear' }); return false; }
        pay(G, cost);
        G.quests.paid[q.id] = true;
        G.events.push({ type: 'delivered', id: q.id });
        completeQuests(G);
        return true;
    }
    if (c.t === 'nextDay') {
        // sleep until morning: the rest of the day runs at once, in quarter-second chunks
        const day = G.day;
        let guard = 0;
        while (G.mode === 'town' && G.day === day && guard++ < 1000) step(G, null, 0.25);
        return true;
    }
    const r = townAct(G, c);
    if (r) completeQuests(G);
    return !!r;
}

// ------------------------------------------------------------------ saving
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    // saves from before v1.2 have no mode
    if (!MODES.includes(G.diff)) G.diff = 'normal';
    G.over = !!G.over;
    return G;
}

export { wallMax };
