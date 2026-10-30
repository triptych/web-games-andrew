// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
//
// newGame(seed) → G. step(G, dt) runs the castle forward; act(G, cmd) applies one player command (craft, cackle,
// buy, upgrade, décor, scheme, visitor, ability, relocate, perk, room, idle, clock) and returns whether it did
// anything. The view, the UI, the audio, the bot and the tests all go through these two, and G.events tells
// everyone what happened.

import { COST_GROWTH, CLICK, FLOW, DREAD, TRIBUTE, VISITOR, OFFLINE, LEGEND, ACH_BONUS, HENCH, BOARD_SLOTS, MASTERY } from '../config.js';
import { makeRng } from '../rng.js';
import {
    HOBBIES, MINIONS, MINION, UPGRADES, UPGRADE, DECOR, DECOR_BY, ABILITY, VISITORS, SCHEMES, SCHEME_BY,
    HEIRLOOMS, HEIRLOOM, PERKS, PERK, LAIRS, ACHIEVEMENTS, GRAVES, GRAVE, M3_REWARD,
} from './data.js';
import * as M3 from './match3.js';

export const SAVE_VERSION = 1;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ------------------------------------------------------------------------------------------------ setup
export function newGame(seed = 1) {
    const G = {
        v: SAVE_VERSION,
        seed,
        rng: makeRng(seed),
        t: 0,                       // seconds simulated, all lairs
        wall: 0,                    // the real clock at the last 'clock' command (ms), for time away
        charmAll: 0,                // charm made in every lair: drives legend
        runs: 0,
        legend: { total: 0, spent: 0 },
        perks: {},
        heirlooms: {},
        ach: {},
        stats: { clicks: 0, cackles: 0, visitors: 0, heroes: 0, heroMiss: 0, schemes: 0, bestCps: 0, lowDread: false, played: 0, charmClicked: 0, goldAll: 0, bought: 0 },
        yard: newYard(),            // the cemetery: kept through every relocation
        events: [],                 // { type, ... } since the last drain; never saved
    };
    newRun(G);
    return G;
}

function newYard() {
    return { open: {}, m3: { level: 1, best: 0, three: 0, tries: 0, played: 0, won: 0, board: null } };
}

/** A fresh lair: everything bought is left behind; legend, perks, heirlooms, trophies and stats come along. */
function newRun(G) {
    const P = G.perks;
    G.lair = G.runs % LAIRS.length;
    G.runT = 0;
    G.charm = 0;
    G.charmRun = 0;
    G.gold = P.hoard ? 50 : 0;
    G.dread = P.repute ? 80 : DREAD.start;
    G.owned = Object.fromEntries(MINIONS.map((m) => [m.id, 0]));
    if (P.headstart) { G.owned.imp = 10; G.owned.cauldron = 2; }
    G.upg = {};
    G.decor = {};
    G.hench = P.union ? 3 : 0;
    G.room = 'cook';
    G.mastery = Object.fromEntries(HOBBIES.map((h) => [h.id, 0]));
    G.flow = 0;
    G.lastCraft = -99;
    G.buffs = [];
    G.cd = { cackle: 0, taste: 0, storm: 0, soiree: 0 };
    G.visitors = [];
    G.nextVisit = 25;               // the first visitor comes early, so a new player meets one
    G.vid = 1;
    G.board = [];
    G.active = [];
    for (let i = 0; i < BOARD_SLOTS; i++) G.board.push(newCard(G));
    G._mods = null;
}

function newCard(G) {
    const taken = new Set([...G.board, ...G.active.map((a) => a.card)].filter(Boolean).map((c) => c.id));
    // early lairs see the small jobs first: nothing needs more henchmen than you could hire soon
    const cap = Math.max(2, Math.min(4, G.hench + 2));
    const pool = SCHEMES.filter((s) => !taken.has(s.id) && s.need <= cap);
    const s = G.rng.pick(pool.length ? pool : SCHEMES);
    return { id: s.id };
}

// ------------------------------------------------------------------------------------------------ modifiers and rates
/** Fold every owned upgrade, décor, heirloom, perk and the lair into one table. Cached until something is bought. */
export function mods(G) {
    if (G._mods) return G._mods;
    const M = {
        minion: {}, hobby: {}, all: 1, click: 1, clickPct: 0, syn: [], decay: 1, cackle: 1, cd: {}, tribute: 1,
        emitH: {}, emitId: {}, dreadPs: 0, tierBoost: 1, vFreq: 1, vLife: 1, kittenDur: 1, unlock: { cackle: true },
        offRate: OFFLINE.rate, offCap: OFFLINE.cap, schemeDur: 1, flowBonus: 1, flowDecay: 1, mastery: 1, cost: 1,
    };
    const apply = (fx) => {
        for (const f of fx) {
            switch (f.k) {
                case 'minion': M.minion[f.id] = (M.minion[f.id] || 1) * f.x; break;
                case 'hobby': M.hobby[f.h] = (M.hobby[f.h] || 1) * f.x; break;
                case 'all': M.all *= f.x; break;
                case 'click': M.click *= f.x; break;
                case 'clickPct': M.clickPct += f.x; break;
                case 'syn': M.syn.push(f); break;
                case 'decay': M.decay *= f.x; break;
                case 'cackle': M.cackle *= f.x; break;
                case 'cd': M.cd[f.ab] = (M.cd[f.ab] || 1) * f.x; break;
                case 'tribute': M.tribute *= f.x; break;
                case 'emit': if (f.h) M.emitH[f.h] = (M.emitH[f.h] || 0) + f.x; else M.emitId[f.id] = (M.emitId[f.id] || 0) + f.x; break;
                case 'dreadPs': M.dreadPs += f.x; break;
                case 'tierBoost': M.tierBoost *= f.x; break;
                case 'vFreq': M.vFreq *= f.x; break;
                case 'vLife': M.vLife *= f.x; break;
                case 'kittenDur': M.kittenDur *= f.x; break;
                case 'unlock': M.unlock[f.ab] = true; break;
                case 'offRate': M.offRate += f.x; break;
                case 'offCap': M.offCap += f.x; break;
                case 'schemeDur': M.schemeDur *= f.x; break;
                case 'flowBonus': M.flowBonus *= f.x; break;
                case 'flowDecay': M.flowDecay *= f.x; break;
                case 'mastery': M.mastery *= f.x; break;
                case 'cost': M.cost *= f.x; break;
                default: break;
            }
        }
    };
    for (const id in G.upg) if (UPGRADE[id]) apply(UPGRADE[id].fx);
    for (const id in G.decor) if (DECOR_BY[id]) apply(DECOR_BY[id].fx);
    for (const id in G.heirlooms) if (HEIRLOOM[id]) apply(HEIRLOOM[id].fx);
    for (const id in G.perks) if (PERK[id]) apply(PERK[id].fx);
    apply(LAIRS[G.lair].fx);
    M.offRate = Math.min(1, M.offRate);
    return (G._mods = M);
}
const dirty = (G) => { G._mods = null; };

export function tierOf(dread) {
    let t = DREAD.tiers[0];
    for (const x of DREAD.tiers) if (dread >= x.from) t = x;
    return t;
}

export function masteryLevel(xp) {
    return xp < MASTERY.first ? 0 : Math.floor(Math.log(xp / MASTERY.first) / Math.log(MASTERY.growth)) + 1;
}
export function masteryNext(lv) { return MASTERY.first * MASTERY.growth ** lv; }

const buffMul = (G, kind) => G.buffs.reduce((m, b) => (b.kind === kind ? m * b.x : m), 1);
export const hasBuff = (G, id) => G.buffs.some((b) => b.id === id);
export const goldScale = (cps) => 1 + Math.log10(1 + cps) / 3;

/** Everything derived: charm per second (in all, by hobby, by minion), crafting power, dread drift, tribute. */
export function rates(G) {
    const M = mods(G);
    const tier = tierOf(G.dread);
    const tierMul = tier.mul > 1 ? 1 + (tier.mul - 1) * M.tierBoost : tier.mul;
    const achN = Object.keys(G.ach).length;
    const prodBuff = buffMul(G, 'prod');
    const global = M.all * (1 + achN * ACH_BONUS) * (1 + G.legend.total * LEGEND.bonus) * tierMul * prodBuff;
    const mastery = {}, hobbyMul = {}, cpsHobby = {};
    for (const h of HOBBIES) {
        mastery[h.id] = masteryLevel(G.mastery[h.id]);
        hobbyMul[h.id] = (M.hobby[h.id] || 1) * (1 + mastery[h.id] * MASTERY.bonus * M.mastery);
        cpsHobby[h.id] = 0;
    }
    const syn = {};
    for (const s of M.syn) {
        syn[s.a] = (syn[s.a] || 1) * (1 + 0.01 * G.owned[s.b]);
        syn[s.b] = (syn[s.b] || 1) * (1 + 0.002 * G.owned[s.a]);
    }
    const cpsBy = {};
    let cps = 0, minions = 0, emit = M.dreadPs;
    for (const m of MINIONS) {
        const n = G.owned[m.id];
        minions += n;
        const c = m.cps * n * (M.minion[m.id] || 1) * hobbyMul[m.hobby] * (syn[m.id] || 1) * global;
        cpsBy[m.id] = c;
        cpsHobby[m.hobby] += c;
        cps += c;
        emit += n * ((M.emitH[m.hobby] || 0) + (M.emitId[m.id] || 0));
    }
    const flowMul = 1 + (G.flow / FLOW.max) * FLOW.bonus * M.flowBonus;
    const clickBase = CLICK.base * M.click * hobbyMul[G.room] * (1 + achN * ACH_BONUS) * (1 + G.legend.total * LEGEND.bonus);
    const click = (clickBase + cps * M.clickPct) * flowMul * buffMul(G, 'click');
    const storm = hasBuff(G, 'storm');
    const decay = storm ? 0 : (DREAD.decay + DREAD.perMinion * minions) * M.decay;
    const tribute = TRIBUTE.base * (tier.tribute + (storm ? 2 : 0)) * M.tribute * goldScale(cps);
    return { M, tier, tierMul, global, cps, cpsBy, cpsHobby, hobbyMul, mastery, click, flowMul, minions, decay, emit, tribute, storm, achN, prodBuff };
}

// ------------------------------------------------------------------------------------------------ prices
export function minionCost(G, id, n = 1) {
    const m = MINION[id];
    const first = m.cost * COST_GROWTH ** G.owned[id] * mods(G).cost;
    return Math.ceil(first * (COST_GROWTH ** n - 1) / (COST_GROWTH - 1));
}
/** How many of a minion the charm in hand buys (at least 1, for showing the price). */
export function maxAffordable(G, id) {
    const m = MINION[id];
    const first = m.cost * COST_GROWTH ** G.owned[id] * mods(G).cost;
    const n = Math.floor(Math.log((G.charm * (COST_GROWTH - 1)) / first + 1) / Math.log(COST_GROWTH));
    return Math.max(0, n);
}
export const henchCost = (G) => Math.ceil(HENCH.base * HENCH.growth ** G.hench);
export const henchFree = (G) => G.hench - G.active.reduce((s, a) => s + SCHEME_BY[a.card.id].need, 0);

export function reqMet(G, r) {
    if (!r) return true;
    if (r.own) return G.owned[r.own[0]] >= r.own[1];
    if (r.hobby) return MINIONS.reduce((s, m) => s + (m.hobby === r.hobby[0] ? G.owned[m.id] : 0), 0) >= r.hobby[1];
    if (r.both) return G.owned[r.both[0]] >= r.both[2] && G.owned[r.both[1]] >= r.both[2];
    if (r.run) return G.charmRun >= r.run;
    return true;
}
/** Upgrades on offer now, cheapest first. */
export function upgradesOnOffer(G) {
    return UPGRADES.filter((u) => !G.upg[u.id] && reqMet(G, u.req)).sort((a, b) => a.cost - b.cost);
}
/** A minion is listed once you could nearly afford one, or own one. */
export function minionVisible(G, m) {
    const i = MINION[m.id].index;
    return G.owned[m.id] > 0 || G.charmRun >= m.cost * 0.4 || i === 0 || G.owned[MINIONS[i - 1].id] > 0;
}
/** A room opens when its first minion is hired; the Kitchen is always open. */
export function roomOpen(G, id) {
    return id === 'cook' || MINIONS.some((m) => m.hobby === id && G.owned[m.id] > 0);
}
export const legendFor = (charmAll) => Math.floor(Math.cbrt(charmAll / LEGEND.base));
export const legendGain = (G) => Math.max(0, legendFor(G.charmAll) - G.legend.total);
/** Charm in all needed for the next point of legend. */
export const legendNext = (G) => LEGEND.base * (Math.max(legendFor(G.charmAll), G.legend.total) + 1) ** 3;
export const abilityCd = (G, id) => ABILITY[id].cd * (mods(G).cd[id] || 1) * (mods(G).cd['*'] || 1);
export const schemeDur = (G, id) => SCHEME_BY[id].dur * mods(G).schemeDur;

// ------------------------------------------------------------------------------------------------ events
const LOUD_WHEN_QUIET = new Set(['ach', 'heirloom', 'graveOpen']);
function emit(G, e) {
    if (G.quiet && !LOUD_WHEN_QUIET.has(e.type)) return;
    G.events.push(e);
}
function addCharm(G, x) {
    G.charm += x;
    G.charmRun += x;
    G.charmAll += x;
}
function addGold(G, x) {
    G.gold += x;
    G.stats.goldAll += x;
}
function addDread(G, x) {
    const floor = G.perks.repute ? 10 : 0;
    G.dread = clamp(G.dread + x, floor, 100);
}
function addBuff(G, b) {
    const old = G.buffs.find((x) => x.id === b.id);
    if (old) { old.t = Math.max(old.t, b.t); old.dur = b.t; return; }
    G.buffs.push({ ...b, dur: b.t });
}

// ------------------------------------------------------------------------------------------------ the clock
/** Advance the castle by dt seconds. */
export function step(G, dt) {
    G.t += dt;
    G.runT += dt;
    G.stats.played += dt;
    const R = rates(G);
    const M = R.M;
    const k = G.quiet ? G.offMul : 1;

    // charm, and the mastery it brings each room
    addCharm(G, R.cps * dt * k);
    for (const h of HOBBIES) G.mastery[h.id] += R.cpsHobby[h.id] * dt * k;
    addGold(G, R.tribute * dt * k);
    if (R.cps > G.stats.bestCps) G.stats.bestCps = R.cps;

    // reputation: the cosier the castle, the faster the rumours spread
    const before = R.tier.id;
    addDread(G, (R.emit - R.decay) * dt);
    if (R.storm) G.dread = 100;
    if (G.dread < 5) G.stats.lowDread = true;
    const after = tierOf(G.dread).id;
    if (after !== before) emit(G, { type: 'tier', from: before, to: after });

    // flow fades once the crafting stops
    if (G.t - G.lastCraft > FLOW.window) G.flow = Math.max(0, G.flow - FLOW.decay * M.flowDecay * dt);

    for (const id in G.cd) G.cd[id] = Math.max(0, G.cd[id] - dt);
    for (let i = G.buffs.length - 1; i >= 0; i--) {
        const b = G.buffs[i];
        b.t -= dt;
        if (b.t <= 0) { G.buffs.splice(i, 1); emit(G, { type: 'buffEnd', id: b.id }); }
    }

    // visitors leave when their time is up; a hero who leaves unfrightened tells everyone about the doilies
    for (let i = G.visitors.length - 1; i >= 0; i--) {
        const v = G.visitors[i];
        v.t -= dt;
        if (v.t > 0) continue;
        G.visitors.splice(i, 1);
        if (v.kind === 'hero') {
            addDread(G, -15);
            G.stats.heroMiss++;
            emit(G, { type: 'heroGossip', vid: v.vid });
        } else emit(G, { type: 'visitorLeft', vid: v.vid, kind: v.kind });
    }
    if (!G.quiet) {
        G.nextVisit -= dt * M.vFreq;
        if (G.nextVisit <= 0) {
            spawnVisitor(G, R);
            G.nextVisit = G.rng.range(VISITOR.min, VISITOR.max);
        }
    }

    // schemes finish on their own, with or without you
    for (let i = G.active.length - 1; i >= 0; i--) {
        const a = G.active[i];
        a.t -= dt;
        if (a.t <= 0) { G.active.splice(i, 1); finishScheme(G, a, R); }
    }

    G._achT = (G._achT || 0) - dt;
    if (G._achT <= 0) { G._achT = 0.5; checkAchievements(G, R); }
}

function spawnVisitor(G, R) {
    if (G.visitors.length >= 2) return;
    const present = new Set(G.visitors.map((v) => v.kind));
    const pool = VISITORS.filter((v) => !present.has(v.id));
    const w = (v) => v.weight * (v.id === 'hero' && R.tier.id === 'suspected' ? 3 : 1);
    let r = G.rng() * pool.reduce((s, v) => s + w(v), 0);
    let kind = pool[0].id;
    for (const v of pool) { r -= w(v); if (r <= 0) { kind = v.id; break; } }
    const life = VISITOR.life * R.M.vLife;
    const v = { vid: G.vid++, kind, t: life, life, side: G.rng() < 0.5 ? -1 : 1 };
    G.visitors.push(v);
    emit(G, { type: 'visitor', vid: v.vid, kind });
}

function finishScheme(G, a, R) {
    const s = SCHEME_BY[a.card.id];
    const out = { type: 'schemeDone', id: s.id, kind: s.kind, charm: 0, gold: 0, dread: 0, heirloom: null };
    if (s.charm) { out.charm = Math.max(50, R.cps * s.charm / R.prodBuff); addCharm(G, out.charm); }
    if (s.gold) { out.gold = Math.round(s.gold * goldScale(R.cps)); addGold(G, out.gold); }
    if (s.dread) { out.dread = s.dread; addDread(G, s.dread); }
    if (s.heir && G.rng() < s.heir) {
        const left = HEIRLOOMS.filter((h) => !G.heirlooms[h.id]);
        if (left.length) {
            const h = G.rng.pick(left);
            G.heirlooms[h.id] = 1;
            out.heirloom = h.id;
            dirty(G);
            emit(G, { type: 'heirloom', id: h.id });
        }
    }
    G.stats.schemes++;
    emit(G, out);
}

function checkGraves(G, R) {
    for (const g of GRAVES) {
        if (g.soon || G.yard.open[g.id]) continue;
        const [have, want] = g.need(G, R);
        if (have >= want) { G.yard.open[g.id] = 1; emit(G, { type: 'graveOpen', id: g.id }); }
    }
}

function checkAchievements(G, R) {
    checkGraves(G, R);
    for (const a of ACHIEVEMENTS) {
        if (G.ach[a.id]) continue;
        if (a.test(G, R)) { G.ach[a.id] = 1; emit(G, { type: 'ach', id: a.id }); }
    }
}

// ------------------------------------------------------------------------------------------------ commands
/** Apply one player command. Returns true if it did anything. */
export function act(G, cmd) {
    switch (cmd.t) {
        case 'craft': return craft(G);
        case 'cackle': return cackle(G);
        case 'ability': return ability(G, cmd.id);
        case 'room': {
            if (!HOBBIES.some((h) => h.id === cmd.id) || G.room === cmd.id || !roomOpen(G, cmd.id)) return false;
            G.room = cmd.id;
            emit(G, { type: 'room', id: cmd.id });
            return true;
        }
        case 'buy': return buyMinion(G, cmd.id, cmd.n);
        case 'upgrade': return buyUpgrade(G, cmd.id);
        case 'upgradeAll': {
            let any = false;
            for (const u of upgradesOnOffer(G)) if (u.cost <= G.charm) any = buyUpgrade(G, u.id) || any;
            return any;
        }
        case 'decor': {
            const d = DECOR_BY[cmd.id];
            if (!d || G.decor[d.id] || G.gold < d.cost) return false;
            G.gold -= d.cost;
            G.decor[d.id] = 1;
            dirty(G);
            emit(G, { type: 'decor', id: d.id, room: d.room });
            return true;
        }
        case 'hench': {
            const c = henchCost(G);
            if (G.hench >= HENCH.max || G.gold < c) return false;
            G.gold -= c;
            G.hench++;
            emit(G, { type: 'hench', n: G.hench });
            return true;
        }
        case 'scheme': return startScheme(G, cmd.i);
        case 'visitor': return greet(G, cmd.vid);
        case 'relocate': return relocate(G);
        case 'perk': {
            const p = PERK[cmd.id];
            if (!p || G.perks[p.id] || G.legend.total - G.legend.spent < p.cost) return false;
            G.perks[p.id] = 1;
            G.legend.spent += p.cost;
            dirty(G);
            emit(G, { type: 'perk', id: p.id });
            return true;
        }
        case 'idle': return away(G, cmd.sec);
        case 'clock': G.wall = cmd.wall; return true;
        case 'm3start': return m3start(G);
        case 'm3swap': return m3swap(G, cmd.a, cmd.b);
        default: return false;
    }
}

function craft(G) {
    // this craft is worth what the flow was; then flow builds with every quick craft and fades a moment after you stop
    const amount = rates(G).click;
    G.flow = G.t - G.lastCraft <= FLOW.window ? Math.min(FLOW.max, G.flow + FLOW.gain) : Math.max(G.flow, FLOW.gain);
    G.lastCraft = G.t;
    addCharm(G, amount);
    G.mastery[G.room] += amount;
    G.stats.clicks++;
    G.stats.charmClicked += amount;
    emit(G, { type: 'craft', amount, flow: G.flow, room: G.room });
    return true;
}

function cackle(G) {
    if (G.cd.cackle > 0) return false;
    const M = mods(G);
    G.cd.cackle = abilityCd(G, 'cackle');
    addDread(G, DREAD.cackle * M.cackle);
    G.stats.cackles++;
    emit(G, { type: 'cackle', dread: G.dread });
    // any hero at the gate flees
    for (const v of [...G.visitors]) if (v.kind === 'hero') greet(G, v.vid, true);
    return true;
}

function ability(G, id) {
    if (id === 'cackle') return cackle(G);
    const A = ABILITY[id];
    const M = mods(G);
    if (!A || !M.unlock[id] || G.cd[id] > 0) return false;
    G.cd[id] = abilityCd(G, id);
    if (id === 'taste') addBuff(G, { id: 'taste', kind: 'click', x: 10, t: A.dur });
    else if (id === 'storm') {
        G.dread = 100;
        addBuff(G, { id: 'storm', kind: 'storm', x: 1, t: A.dur });
        addGold(G, Math.round(3 * goldScale(rates(G).cps)));
    } else if (id === 'soiree') {
        addBuff(G, { id: 'soiree', kind: 'prod', x: 3, t: A.dur });
        addDread(G, -20);
    }
    emit(G, { type: 'ability', id });
    return true;
}

function buyMinion(G, id, n = 1) {
    const m = MINION[id];
    if (!m || !minionVisible(G, m)) return false;
    if (n === 'max') n = maxAffordable(G, id);
    n = Math.max(0, n | 0);
    if (!n) return false;
    const cost = minionCost(G, id, n);
    if (cost > G.charm) return false;
    G.charm -= cost;
    G.owned[id] += n;
    G.stats.bought += n;
    emit(G, { type: 'buy', id, n, hobby: m.hobby, owned: G.owned[id] });
    return true;
}

function buyUpgrade(G, id) {
    const u = UPGRADE[id];
    if (!u || G.upg[id] || !reqMet(G, u.req) || u.cost > G.charm) return false;
    G.charm -= u.cost;
    G.upg[id] = 1;
    dirty(G);
    emit(G, { type: 'upgrade', id });
    return true;
}

function startScheme(G, i) {
    const card = G.board[i];
    if (!card) return false;
    const s = SCHEME_BY[card.id];
    if (henchFree(G) < s.need) return false;
    const t = schemeDur(G, s.id);
    G.active.push({ card, t, dur: t });
    G.board[i] = null;
    G.board[i] = newCard(G);
    emit(G, { type: 'schemeStart', id: s.id });
    return true;
}

function greet(G, vid, byCackle = false) {
    const i = G.visitors.findIndex((v) => v.vid === vid);
    if (i < 0) return false;
    const v = G.visitors[i];
    G.visitors.splice(i, 1);
    const R = rates(G);
    const e = { type: 'greet', vid, kind: v.kind, byCackle };
    if (v.kind === 'kitten') {
        addBuff(G, { id: 'cuddle', kind: 'prod', x: 7, t: 60 * R.M.kittenDur });
    } else if (v.kind === 'critic') {
        e.amount = Math.min(G.charm * 0.15, R.cps * 900) + 13;
        addCharm(G, e.amount);
    } else if (v.kind === 'bard') {
        addBuff(G, { id: 'encore', kind: 'click', x: 13, t: 15 });
    } else if (v.kind === 'hero') {
        addDread(G, 18);
        e.gold = Math.round(5 * goldScale(R.cps));
        addGold(G, e.gold);
        G.stats.heroes++;
    }
    G.stats.visitors++;
    emit(G, e);
    return true;
}

// ------------------------------------------------------------------------------------------------ Skull Swap
/** Open the board for the current level: the one in progress, or a fresh one after a win or a loss. */
function m3start(G) {
    if (!G.yard.open.skull) return false;
    const m = G.yard.m3;
    if (!m.board || m.board.over) {
        m.tries++;
        m.board = M3.newBoard(m.level, (Math.imul(G.seed, 31) + m.level * 977 + m.tries * 13) | 0);
        m.played++;
    }
    emit(G, { type: 'm3board', level: m.level });
    return true;
}

function m3swap(G, a, b) {
    const m = G.yard.m3, B = m.board;
    if (!G.yard.open.skull || !B || B.over) return false;
    const res = M3.trySwap(B, a, b);
    emit(G, { type: 'm3', ok: res.ok, steps: res.steps, level: B.level });
    if (!res.ok || !B.over) return res.ok;
    const out = { type: 'm3end', level: B.level, won: B.won, stars: B.stars, score: B.score, charm: 0, gold: 0 };
    if (B.won) {
        const cps = rates(G).cps;
        out.charm = Math.max(100, cps * M3_REWARD.charmSec[B.stars]);
        out.gold = Math.round((M3_REWARD.gold + B.level * M3_REWARD.goldPerLevel) * goldScale(cps) * (0.6 + 0.2 * B.stars));
        addCharm(G, out.charm);
        addGold(G, out.gold);
        m.won++;
        if (B.stars === 3) m.three++;
        m.best = Math.max(m.best, B.level);
        m.level = B.level + 1;
        m.tries = 0;
    }
    emit(G, out);
    return true;
}

function relocate(G) {
    const gain = legendGain(G);
    if (gain < 1) return false;
    const from = G.lair;
    G.legend.total += gain;
    G.runs++;
    newRun(G);
    emit(G, { type: 'relocate', gain, from, to: G.lair });
    return true;
}

/** Time away: the same rules in ten-second chunks, at the offline rate, with nobody greeting the visitors. */
export function away(G, sec) {
    if (!(sec > 0)) return false;
    const M = mods(G);
    const counted = Math.min(sec, M.offCap);
    const before = { charm: G.charmAll, gold: G.stats.goldAll, schemes: G.stats.schemes, dread: G.dread, heir: Object.keys(G.heirlooms).length };
    G.quiet = true;
    G.offMul = M.offRate;
    for (let left = counted; left > 1e-9;) {
        const d = Math.min(OFFLINE.chunk, left);
        step(G, d);
        left -= d;
    }
    G.quiet = false;
    G.offMul = 1;
    emit(G, {
        type: 'away', sec, counted, rate: M.offRate,
        charm: G.charmAll - before.charm, gold: G.stats.goldAll - before.gold, schemes: G.stats.schemes - before.schemes,
        dread: G.dread - before.dread, heirlooms: Object.keys(G.heirlooms).length - before.heir,
    });
    return true;
}

// ------------------------------------------------------------------------------------------------ saving
export function serialize(G) {
    const out = {};
    for (const k in G) {
        if (k === 'rng' || k === 'events' || k === 'quiet' || k === 'offMul' || k.startsWith('_')) continue;
        out[k] = G[k];
    }
    out.rngState = G.rng.state();
    return JSON.parse(JSON.stringify(out));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_VERSION) throw new Error('unknown save version');
    const base = newGame(d.seed || 1);
    const { rngState, ...rest } = JSON.parse(JSON.stringify(d));
    const G = { ...base, ...rest, rng: makeRng(0), events: [] };
    // anything added since the save was written takes its default
    G.stats = { ...base.stats, ...rest.stats };
    G.yard = { ...base.yard, ...rest.yard, m3: { ...base.yard.m3, ...(rest.yard?.m3 || {}) } };
    G.owned = { ...base.owned, ...rest.owned };
    G.mastery = { ...base.mastery, ...rest.mastery };
    G.cd = { ...base.cd, ...rest.cd };
    G.board = (G.board || []).filter((c) => c && SCHEME_BY[c.id]);
    while (G.board.length < BOARD_SLOTS) G.board.push(newCard(G));
    G.active = (G.active || []).filter((a) => a && a.card && SCHEME_BY[a.card.id]);
    G.rng.setState(rngState);
    if (!roomOpen(G, G.room)) G.room = 'cook';     // a save made in a room that is now locked
    G._mods = null;
    return G;
}
