// Gemheart Saga — Briarwick: buildings, idle production, the daily gift, the market, the armory, the requests. Pure.
//
// Time never comes from a clock here: every command that depends on time carries `now` (ms since the epoch) and the
// calendar `day` ('YYYY-MM-DD', the player's local date), passed in by main.js and by the tests.

import { BUILDINGS, BUILDING, PRODUCE, CAP_HOURS, BOOST_HOURS, RESOURCES, REQUESTS } from './data/village.js';
import { EQUIP, CONSUMABLES, ITEM, equipPrice } from './data/items.js';
import { DAILY, HOUR, MARKET_DISCOUNT, SELL_RATE, UPGRADE_COST } from '../config.js';
import { lvOf, itemStats } from './stats.js';

export function newVillage() {
    const lv = {};
    for (const b of BUILDINGS) lv[b.id] = b.start;
    return { lv, last: 0, frac: {}, boostFrom: 0, boostUntil: 0, daily: { day: null, streak: 0 } };
}

export const capHours = (G) => CAP_HOURS + 2 * lvOf(G, 'hall');

/** Production per hour of each resource. */
export function rates(G) {
    const out = {};
    for (const [b, prod] of Object.entries(PRODUCE)) {
        const l = lvOf(G, b);
        for (const [res, arr] of Object.entries(prod)) out[res] = (out[res] || 0) + arr[l];
    }
    return out;
}

/** What has built up since the last collection (fractions included), without changing G. */
export function pending(G, now) {
    const V = G.village;
    const out = {};
    if (!V.last || now <= V.last) return out;
    const from = Math.max(V.last, now - capHours(G) * HOUR);
    let hours = (now - from) / HOUR;
    // the festival doubles whatever falls inside it
    const bo = Math.max(0, Math.min(now, V.boostUntil) - Math.max(from, V.boostFrom)) / HOUR;
    hours += bo;
    for (const [res, r] of Object.entries(rates(G))) out[res] = r * hours + (V.frac[res] || 0);
    return out;
}

/** Collect the idle output. Returns what was added (whole units). */
export function collect(G, now) {
    const V = G.village;
    if (!V.last || now < V.last) { V.last = now; return {}; }
    const p = pending(G, now);
    const got = {};
    for (const [res, v] of Object.entries(p)) {
        const whole = Math.floor(v);
        V.frac[res] = v - whole;
        if (whole > 0) { G.res[res] += whole; got[res] = whole; }
    }
    V.last = now;
    if (Object.keys(got).length) G.events.push({ type: 'collect', got });
    return got;
}

/** Days since 1970-01-01 for a 'YYYY-MM-DD' string (civil calendar arithmetic, no Date object). */
export function dayNumber(day) {
    const [y0, m, d] = day.split('-').map(Number);
    const y = m <= 2 ? y0 - 1 : y0;
    const era = Math.floor(y / 400);
    const yoe = y - era * 400;
    const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
}

export const canDaily = (G, day) => G.village.daily.day !== day;

/** The daily gift: gold and materials that grow with the Town Hall and the streak, and two hours of festival. */
export function claimDaily(G, day, now) {
    if (!canDaily(G, day)) return null;
    collect(G, now);
    const D = G.village.daily;
    D.streak = D.day && dayNumber(day) - dayNumber(D.day) === 1 ? Math.min(DAILY.streakMax, D.streak + 1) : 1;
    D.day = day;
    const hall = lvOf(G, 'hall');
    const got = {
        gold: DAILY.gold * hall + DAILY.goldStreak * D.streak,
        wood: DAILY.res * hall, ore: DAILY.res * hall, grain: DAILY.res * hall,
        crystal: DAILY.crystal * hall,
    };
    for (const [k, v] of Object.entries(got)) G.res[k] += v;
    G.village.boostFrom = now;
    G.village.boostUntil = now + BOOST_HOURS * HOUR;
    G.stats.streakBest = Math.max(G.stats.streakBest, D.streak);
    G.events.push({ type: 'daily', got, streak: D.streak });
    return got;
}

// ---------------------------------------------------------------- buildings
export function buildCost(G, id) {
    const b = BUILDING[id];
    const next = lvOf(G, id) + 1;
    return next <= 5 ? b.costs[next] : null;
}

/** Why a building can't be raised, or null if it can. */
export function buildBlock(G, id) {
    const cost = buildCost(G, id);
    if (!cost) return 'At its highest level.';
    const next = lvOf(G, id) + 1;
    if (id !== 'hall' && next > lvOf(G, 'hall')) return `Raise the Town Hall to level ${next} first.`;
    for (const r of RESOURCES) if ((cost[r] || 0) > G.res[r]) return `Needs more ${r}.`;
    return null;
}

export function build(G, id, now) {
    if (now) collect(G, now);          // production up to now is paid at the old rate
    if (buildBlock(G, id)) return false;
    const cost = buildCost(G, id);
    pay(G, cost);
    G.village.lv[id]++;
    G.events.push({ type: 'build', id, lv: G.village.lv[id] });
    return true;
}

function pay(G, cost) {
    for (const r of RESOURCES) G.res[r] -= cost[r] || 0;
    G.stats.goldSpent += cost.gold || 0;
}

// ---------------------------------------------------------------- the market
export function stock(G) {
    const m = lvOf(G, 'market');
    return [...CONSUMABLES.filter((c) => (c.tier || 1) <= Math.max(1, m)).map((c) => c.id),
        ...EQUIP.filter((e) => e.tier <= m).map((e) => e.id)];
}

export function price(G, id) {
    const it = ITEM[id];
    const base = it.slot ? equipPrice(it) : it.price;
    return Math.round(base * (1 - MARKET_DISCOUNT * lvOf(G, 'market')));
}

export function buy(G, id) {
    if (!stock(G).includes(id)) return false;
    const p = price(G, id);
    if (G.res.gold < p) return false;
    pay(G, { gold: p });
    giveItem(G, id);
    G.events.push({ type: 'buy', id });
    return true;
}

export function giveItem(G, id) {
    const it = ITEM[id];
    if (it.slot) {
        const inv = { uid: G.nextUid++, id, plus: 0 };
        G.inv.push(inv);
        return inv;
    }
    G.bag[id] = (G.bag[id] || 0) + 1;
    return null;
}

export function sell(G, uid) {
    const i = G.inv.findIndex((x) => x.uid === uid);
    if (i < 0) return false;
    if (Object.values(G.hero.eq).includes(uid)) return false;
    const it = ITEM[G.inv[i].id];
    const v = Math.round(equipPrice(it) * SELL_RATE * (1 + 0.5 * G.inv[i].plus));
    G.inv.splice(i, 1);
    G.res.gold += v;
    G.events.push({ type: 'sell', id: it.id, gold: v });
    return true;
}

export function equip(G, uid) {
    const inv = G.inv.find((x) => x.uid === uid);
    if (!inv) return false;
    G.hero.eq[ITEM[inv.id].slot] = uid;
    G.events.push({ type: 'equip', id: inv.id });
    return true;
}

// ---------------------------------------------------------------- the armory
export const maxPlus = (G) => 2 * lvOf(G, 'armory');
export function upgradeCost(G, uid) {
    const inv = G.inv.find((x) => x.uid === uid);
    return inv ? UPGRADE_COST(ITEM[inv.id].tier, inv.plus) : null;
}
export function upgradeBlock(G, uid) {
    const inv = G.inv.find((x) => x.uid === uid);
    if (!inv) return 'No such item.';
    if (lvOf(G, 'armory') < 1) return 'Build the Armory first.';
    if (inv.plus >= maxPlus(G)) return `The Armory (level ${lvOf(G, 'armory')}) can't go past +${maxPlus(G)}.`;
    const c = upgradeCost(G, uid);
    if (G.res.gold < c.gold || G.res.ore < c.ore) return 'Needs more gold or ore.';
    return null;
}
export function upgrade(G, uid) {
    if (upgradeBlock(G, uid)) return false;
    const inv = G.inv.find((x) => x.uid === uid);
    pay(G, upgradeCost(G, uid));
    inv.plus++;
    G.stats.bestPlus = Math.max(G.stats.bestPlus, inv.plus);
    G.events.push({ type: 'upgrade', id: inv.id, plus: inv.plus });
    return true;
}

/** A rough score for comparing gear (the bot and the "better" marker in the UI). */
export function gearScore(inv) {
    const s = itemStats(inv);
    let v = s.atk * 3 + s.def * 2 + s.hp * 0.3;
    for (const x of Object.values(s.mods)) v += x * 60;
    return v;
}

// ---------------------------------------------------------------- requests
export function requestDone(G, rq) {
    const n = rq.need;
    if (n.kills) return (G.stats.kills[n.kills] || 0) >= n.n;
    if (n.build) return lvOf(G, n.build) >= n.n;
    if (n.stat) return (G.stats[n.stat] || 0) >= n.n;
    if (n.level) return G.hero.lv >= n.level;
    return false;
}
export function requestProgress(G, rq) {
    const n = rq.need;
    if (n.kills) return [Math.min(n.n, G.stats.kills[n.kills] || 0), n.n];
    if (n.build) return [Math.min(n.n, lvOf(G, n.build)), n.n];
    if (n.stat) return [Math.min(n.n, G.stats[n.stat] || 0), n.n];
    if (n.level) return [Math.min(n.level, G.hero.lv), n.level];
    return [0, 1];
}
export function claim(G, id) {
    const rq = REQUESTS.find((r) => r.id === id);
    if (!rq || G.claimed[id] || !requestDone(G, rq)) return false;
    G.claimed[id] = true;
    for (const [k, v] of Object.entries(rq.reward)) {
        if (k === 'item') giveItem(G, v);
        else G.res[k] += v;
    }
    G.events.push({ type: 'claim', id });
    return true;
}
