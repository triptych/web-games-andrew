// Town markets. Every price is  base x town multiplier (m) x events x season, and moves when you trade:
// selling floods a market and drops the price, buying drains it and raises it, and both recover over days.
// Each town has shops (a general store, a smithy, ...): a shop only buys the categories it handles.
// Pure: daily noise is hashed from the day, never drawn from the order things were looked at.

import { MARKET } from '../config.js';
import { TOWN, SHOP_DEFS } from './data/towns.js';
import { MATS, FAMS, basePrice, catOf, matGrade, itemDef, isGear, keyOf } from './data/items.js';
import { hash3 } from '../rng.js';

const strHash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const gearMax = (townId) => Math.min(8, TOWN[townId].region * 2 - 1);

export const EVENTS = {
    festival: { name: 'Harvest Festival', text: 'Wine and luxuries sell for more; food is dearer.', mul: (c, t) => (c === 'trade' ? 1.35 : c === 'food' ? 1.15 : 1) },
    war: { name: 'Border Skirmishes', text: 'Weapons, armor and metal are in demand.', mul: (c) => (['sword', 'armor', 'helm', 'shield'].includes(c) ? 1.5 : c === 'ingot' || c === 'ore' ? 1.25 : 1) },
    plague: { name: 'Marsh Fever', text: 'Herbs and potions are desperately wanted.', mul: (c) => (c === 'herb' || c === 'potion' || c === 'elixir' ? 1.8 : 1) },
    harvest: { name: 'Bumper Harvest', text: 'Food is cheap and plentiful.', mul: (c) => (c === 'food' ? 0.7 : 1) },
    blight: { name: 'Crop Blight', text: 'Food is scarce and dear.', mul: (c) => (c === 'food' ? 1.5 : 1) },
    caravan: { name: 'Caravan In Town', text: 'Raw goods flood the market, prices drop.', mul: (c) => (['ore', 'cloth', 'wood', 'herb', 'food'].includes(c) ? 0.85 : 1) },
    collapse: { name: 'Mine Collapse', text: 'Ore and metal are scarce.', mul: (c) => (c === 'ore' ? 1.7 : c === 'ingot' ? 1.3 : 1) },
    fair: { name: 'Grand Fair', text: 'Everything sells a little higher.', mul: () => 1.1 },
};
const EVENT_IDS = Object.keys(EVENTS);

const seasonOf = (day) => Math.floor(((day - 1) % 120) / 30);
export const SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter'];
function seasonMul(day, t) {
    const s = seasonOf(day), c = catOf(t);
    if (s === 3) return c === 'food' || c === 'herb' ? 1.2 : t === 'furs' ? 1.25 : 1;
    if (s === 2) return c === 'food' ? 0.9 : 1;
    if (s === 1) return t === 'perfume' || t === 'wine' ? 1.1 : 1;
    return 1;
}
export function eventMul(G, townId, t) {
    let m = 1;
    const c = catOf(t);
    for (const e of G.towns[townId].events) if (e.until >= G.day) m *= EVENTS[e.k].mul(c, t);
    return m;
}

export const shopsFor = (townId) => TOWN[townId].shops;
/** The shop in a town that will buy this kind of item (best price), or null. */
export function shopFor(townId, t) {
    const c = catOf(t);
    let best = null;
    for (const s of TOWN[townId].shops) if (SHOP_DEFS[s].cats.includes(c) && (!best || SHOP_DEFS[s].buyMul > SHOP_DEFS[best].buyMul)) best = s;
    return c === 'quest' ? null : best;
}
export function shopHas(townId, shopId, t) { return TOWN[townId].shops.includes(shopId) && SHOP_DEFS[shopId].cats.includes(catOf(t)); }

export function stockCap(townId, t, lv = 0) {
    const town = TOWN[townId];
    if (!shopFor(townId, t)) return 0;
    if (isGear(t)) { const gm = gearMax(townId); return lv <= gm ? (lv <= gm - 2 ? 4 : 3) : 0; }
    if (!MATS[t] || catOf(t) === 'quest') return 0;
    const p = MATS[t].price;
    const capP = clamp(Math.round(400 / (p + 8)), 10, 60);
    if (town.produces.includes(t)) return capP;
    if (catOf(t) === 'trade') return 0;
    return matGrade(t) <= town.region ? Math.max(2, Math.round(capP * 0.3)) : 0;
}
export function target(townId, t, lv = 0) {
    const town = TOWN[townId];
    if (town.produces.includes(t)) return MARKET.produce;
    if (town.wants.includes(t)) return MARKET.want;
    return 1 + (hash3(strHash(townId), strHash(keyOf(t, lv)), 3) - 0.5) * 0.16;
}

/** The stored market entry, or a fresh one at its natural price (not stored until you trade). */
export function entry(G, townId, t, lv = 0) {
    const k = keyOf(t, lv);
    return G.mkt[townId][k] || { m: target(townId, t, lv), s: stockCap(townId, t, lv) };
}
function store(G, townId, t, lv) {
    const k = keyOf(t, lv);
    return (G.mkt[townId][k] ||= { m: target(townId, t, lv), s: stockCap(townId, t, lv) });
}
export const repStars = (G, townId) => Math.min(5, Math.floor(G.towns[townId].rep / 3));

export function midPrice(G, townId, t, lv = 0) {
    return basePrice(t, lv) * entry(G, townId, t, lv).m * eventMul(G, townId, t) * seasonMul(G.day, t);
}
export function buyUnit(G, townId, t, lv = 0) {
    return midPrice(G, townId, t, lv) * MARKET.buyMarkup * (1 - 0.015 * repStars(G, townId));
}
export function sellUnit(G, townId, t, lv = 0) {
    const sh = shopFor(townId, t);
    if (!sh) return 0;
    return midPrice(G, townId, t, lv) * MARKET.sellMarkdown * SHOP_DEFS[sh].buyMul * (1 + 0.012 * repStars(G, townId));
}
const impactOf = (t) => (isGear(t) ? MARKET.impactGear : MARKET.impact);

/** Total price for n units, with the price moving a little after every unit. dir = 'buy' | 'sell'. */
export function quote(G, townId, t, lv, dir, n) {
    const unit = dir === 'buy' ? buyUnit(G, townId, t, lv) : sellUnit(G, townId, t, lv);
    const k = impactOf(t) * (dir === 'buy' ? 1 : -1);
    let total = 0, p = unit;
    for (let i = 0; i < n; i++) { total += Math.round(p); p *= 1 + k; }
    return { total, unit, last: p };
}
export function stockOf(G, townId, t, lv = 0) {
    if (!stockCap(townId, t, lv)) return 0;
    return Math.floor(entry(G, townId, t, lv).s);
}
/** Update the market after you buy n units. Returns the money it cost. */
export function applyBuy(G, townId, t, lv, n) {
    const q = quote(G, townId, t, lv, 'buy', n);
    const e = store(G, townId, t, lv);
    e.s = Math.max(0, e.s - n);
    e.m = clamp(e.m * Math.pow(1 + impactOf(t), n), MARKET.minM, MARKET.maxM);
    return q.total;
}
export function applySell(G, townId, t, lv, n) {
    const q = quote(G, townId, t, lv, 'sell', n);
    const e = store(G, townId, t, lv);
    e.s += n;
    e.m = clamp(e.m * Math.pow(1 - impactOf(t), n), MARKET.minM, MARKET.maxM);
    return q.total;
}

/** Everything moves one day: prices drift home, stock refills, events come and go. */
export function dailyMarket(G) {
    const day = G.day;
    let ti = 0;
    for (const town of Object.keys(G.towns)) {
        ti++;
        const T = G.towns[town];
        T.events = T.events.filter((e) => e.until >= day);
        for (const k of Object.keys(G.mkt[town])) {
            const e = G.mkt[town][k];
            const [t, l] = k.split(':');
            const lv = l ? +l : 0;
            const tg = target(town, t, lv);
            const noise = (hash3(day * 131 + ti, strHash(k), 7) - 0.5) * 2 * MARKET.noise;
            e.m = clamp(e.m + (tg - e.m) * MARKET.recover + noise * tg, MARKET.minM, MARKET.maxM);
            const cap = stockCap(town, t, lv);
            if (e.s < cap) e.s = Math.min(cap, e.s + Math.max(1, (cap - e.s) * 0.3));
            else if (e.s > cap) e.s = Math.max(cap, e.s - Math.max(1, (e.s - cap) * 0.15));
        }
        if (G.rng() < MARKET.eventChance && T.events.length < 2) {
            const k = EVENT_IDS[Math.floor(G.rng() * EVENT_IDS.length)];
            const dur = 5 + Math.floor(G.rng() * 6);
            T.events.push({ k, until: day + dur });
            G.events.push({ type: 'market-event', town, k, until: day + dur });
        }
    }
}
export function initMarkets(G) {
    G.mkt = {};
    for (const t of Object.keys(G.towns)) G.mkt[t] = {};
}
export { itemDef };
